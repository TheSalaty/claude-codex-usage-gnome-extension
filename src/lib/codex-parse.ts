import { CostBuilder } from './cost-builder.js'
import type { PriceTable } from './pricing.js'
import type { Cost, Limit } from './types.js'

type TokenUsage = {
  input_tokens?: number
  cached_input_tokens?: number
  cache_write_input_tokens?: number
  output_tokens?: number
  reasoning_output_tokens?: number
}

type RateWindow = {
  used_percent?: number
  window_minutes?: number
  /** Unix seconds. */
  resets_at?: number
}

type RolloutEvent = {
  timestamp?: string
  type?: string
  payload?: {
    type?: string
    model?: string
    /** Present on a fork's or subagent's own `session_meta`, naming the thread it branched from. */
    forked_from_id?: string
    info?: {
      total_token_usage?: TokenUsage
      last_token_usage?: TokenUsage
    }
    rate_limits?: {
      primary?: RateWindow | null
      secondary?: RateWindow | null
      plan_type?: string | null
    } | null
  }
}

export type CodexAggregate = {
  cost: Cost
  /** Rate limits from the most recent snapshot Codex wrote, with the time it was written. */
  limits: Limit[]
  limitsAt: string | null
  planType: string | null
  warnings: string[]
}

const num = (value: unknown): number => (typeof value === 'number' && isFinite(value) ? value : 0)

/**
 * A fork or subagent opens its rollout with the parent's history copied in, every line
 * re-stamped to the fork instant and written in one burst; the child's first real turn only
 * lands seconds later, so a gap this size ends the copies.
 */
const FORK_COPY_MAX_GAP_MS = 1000

const cumulative = (usage: TokenUsage | undefined) => ({
  input: num(usage?.input_tokens),
  cached: num(usage?.cached_input_tokens),
  write: num(usage?.cache_write_input_tokens),
  output: num(usage?.output_tokens),
  reasoning: num(usage?.reasoning_output_tokens),
})

/**
 * Aggregates Codex rollout sessions. Codex reports token usage as a running total per session
 * and repeats the same snapshot across events, so spend per request is the rise in that total —
 * summing the per-request field instead would double-count every repeated snapshot.
 */
export const aggregateCodex = (
  sessions: Iterable<{ lines: Iterable<string> }>,
  options: { sinceMs: number; table: PriceTable },
): CodexAggregate => {
  const builder = new CostBuilder(options.table)
  let malformed = 0
  let latestLimits: { limits: Limit[]; at: string; plan: string | null } | null = null

  for (const session of sessions) {
    let previous = cumulative(undefined)
    let model = 'unknown'
    let sawSessionMeta = false
    let forkCopyAnchorMs: number | null = null

    for (const line of session.lines) {
      if (line.length === 0) continue
      let event: RolloutEvent
      try {
        event = JSON.parse(line) as RolloutEvent
      } catch {
        malformed += 1
        continue
      }

      // Only the first meta describes this file's own session — a fork replays its ancestors'.
      if (event.type === 'session_meta' && !sawSessionMeta) {
        sawSessionMeta = true
        const at = Date.parse(event.timestamp ?? '')
        if (typeof event.payload?.forked_from_id === 'string' && isFinite(at)) forkCopyAnchorMs = at
        continue
      }
      if (event.type === 'turn_context' && typeof event.payload?.model === 'string') {
        model = event.payload.model
        continue
      }
      if (event.payload?.type !== 'token_count') continue

      const limits = event.payload.rate_limits
      if (limits !== undefined && limits !== null && typeof event.timestamp === 'string') {
        if (latestLimits === null || event.timestamp > latestLimits.at) {
          latestLimits = {
            limits: toLimits(limits),
            at: event.timestamp,
            plan: limits.plan_type ?? null,
          }
        }
      }

      const totals = event.payload.info?.total_token_usage
      if (totals === undefined) continue
      const current = cumulative(totals)
      // A total that went backwards means the session's counter restarted — a resumed or forked
      // thread starts a fresh count — so the whole snapshot is new spend, not a negative delta.
      const base =
        current.input < previous.input || current.output < previous.output
          ? cumulative(undefined)
          : previous
      const delta = {
        input: current.input - base.input,
        cached: current.cached - base.cached,
        write: current.write - base.write,
        output: current.output - base.output,
        reasoning: Math.max(0, current.reasoning - base.reasoning),
      }
      previous = current
      if (delta.input + delta.output === 0) continue

      const epochMs = Date.parse(event.timestamp ?? '')
      if (!isFinite(epochMs)) continue

      // The copied history was already counted from the parent's own rollout.
      if (forkCopyAnchorMs !== null) {
        if (epochMs - forkCopyAnchorMs < FORK_COPY_MAX_GAP_MS) {
          forkCopyAnchorMs = epochMs
          continue
        }
        forkCopyAnchorMs = null
      }

      if (epochMs < options.sinceMs) continue

      builder.add({
        epochMs,
        model,
        usage: {
          // Codex counts cached and freshly written tokens inside `input_tokens`.
          uncachedInput: Math.max(0, delta.input - delta.cached - delta.write),
          cacheRead: delta.cached,
          cacheWrite: delta.write,
          cacheWrite1h: 0,
          output: delta.output,
        },
        reasoning: delta.reasoning,
        attributions: {},
      })
    }
  }

  const warnings: string[] = []
  const unpriced = builder.unpricedModels()
  if (unpriced.length > 0) warnings.push(`No price known for ${unpriced.join(', ')}`)
  if (malformed > 0) warnings.push(`${malformed} unparsable session line(s) skipped`)

  return {
    cost: builder.build(),
    limits: latestLimits?.limits ?? [],
    limitsAt: latestLimits?.at ?? null,
    planType: latestLimits?.plan ?? null,
    warnings,
  }
}

export const windowLabel = (minutes: number): string => {
  if (minutes % (60 * 24) === 0) {
    const days = minutes / (60 * 24)
    return days === 7 ? 'Weekly (7 day)' : `${days} day`
  }
  if (minutes % 60 === 0) return `Session (${minutes / 60}h)`
  return `${minutes} min`
}

const toLimits = (raw: { primary?: RateWindow | null; secondary?: RateWindow | null }): Limit[] => {
  const limits: Limit[] = []
  for (const [index, window] of [raw.primary, raw.secondary].entries()) {
    if (window === undefined || window === null) continue
    const minutes = num(window.window_minutes)
    limits.push({
      label: minutes > 0 ? windowLabel(minutes) : index === 0 ? 'Primary' : 'Secondary',
      percent: num(window.used_percent),
      resetsAt:
        typeof window.resets_at === 'number'
          ? new Date(window.resets_at * 1000).toISOString()
          : null,
      isActive: index === 0,
    })
  }
  return limits.sort((a, b) => b.percent - a.percent)
}
