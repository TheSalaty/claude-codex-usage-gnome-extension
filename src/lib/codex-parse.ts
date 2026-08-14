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
  resets_at?: number
}

type RolloutEvent = {
  timestamp?: string
  type?: string
  payload?: {
    type?: string
    model?: string
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
  limits: Limit[]
  limitsAt: string | null
  planType: string | null
  warnings: string[]
}

const num = (value: unknown): number => (typeof value === 'number' && isFinite(value) ? value : 0)

const FORK_COPY_MAX_GAP_MS = 1000

const cumulative = (usage: TokenUsage | undefined) => ({
  input: num(usage?.input_tokens),
  cached: num(usage?.cached_input_tokens),
  write: num(usage?.cache_write_input_tokens),
  output: num(usage?.output_tokens),
  reasoning: num(usage?.reasoning_output_tokens),
})

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
