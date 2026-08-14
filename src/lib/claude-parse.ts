import { CostBuilder, type Sample } from './cost-builder.js'
import type { PriceTable } from './pricing.js'
import type { Cost } from './types.js'

type AssistantRecord = {
  type?: string
  timestamp?: string
  requestId?: string
  attributionSkill?: string
  attributionAgent?: string
  attributionMcpServer?: string
  attributionMcpTool?: string
  message?: {
    id?: string
    model?: string
    usage?: {
      input_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
      cache_creation?: {
        ephemeral_5m_input_tokens?: number
        ephemeral_1h_input_tokens?: number
      }
      output_tokens?: number
      output_tokens_details?: { thinking_tokens?: number }
    }
  }
}

export type ClaudeAggregate = {
  cost: Cost
  warnings: string[]
}

const num = (value: unknown): number => (typeof value === 'number' && isFinite(value) ? value : 0)

export const aggregateClaude = (
  lines: Iterable<string>,
  options: { sinceMs: number; table: PriceTable },
): ClaudeAggregate => {
  const byMessageId = new Map<string, { sample: Sample; total: number }>()
  let malformed = 0

  for (const line of lines) {
    if (line.length === 0) continue
    let record: AssistantRecord
    try {
      record = JSON.parse(line) as AssistantRecord
    } catch {
      malformed += 1
      continue
    }
    if (record.type !== 'assistant') continue

    const usage = record.message?.usage
    const model = record.message?.model
    if (usage === undefined || model === undefined || record.timestamp === undefined) continue

    const epochMs = Date.parse(record.timestamp)
    if (!isFinite(epochMs) || epochMs < options.sinceMs) continue

    const breakdown = usage.cache_creation
    const write5m =
      breakdown === undefined
        ? num(usage.cache_creation_input_tokens)
        : num(breakdown.ephemeral_5m_input_tokens)
    const write1h = breakdown === undefined ? 0 : num(breakdown.ephemeral_1h_input_tokens)

    const sample: Sample = {
      epochMs,
      model,
      usage: {
        uncachedInput: num(usage.input_tokens),
        cacheRead: num(usage.cache_read_input_tokens),
        cacheWrite: write5m,
        cacheWrite1h: write1h,
        output: num(usage.output_tokens),
      },
      reasoning: num(usage.output_tokens_details?.thinking_tokens),
      attributions: {
        skills: record.attributionSkill === undefined ? [] : [`/${record.attributionSkill}`],
        subagents: record.attributionAgent === undefined ? [] : [record.attributionAgent],
        mcpTools: mcpLabel(record),
      },
    }
    const total =
      sample.usage.uncachedInput +
      sample.usage.cacheRead +
      sample.usage.cacheWrite +
      sample.usage.cacheWrite1h +
      sample.usage.output

    const id = record.message?.id ?? `${record.requestId ?? ''}:${epochMs}`
    const previous = byMessageId.get(id)
    if (previous === undefined || total > previous.total) byMessageId.set(id, { sample, total })
  }

  const builder = new CostBuilder(options.table)
  for (const { sample } of byMessageId.values()) builder.add(sample)

  const warnings: string[] = []
  const unpriced = builder.unpricedModels()
  if (unpriced.length > 0) warnings.push(`No price known for ${unpriced.join(', ')}`)
  if (malformed > 0) warnings.push(`${malformed} unparsable transcript line(s) skipped`)

  return { cost: builder.build(), warnings }
}

const mcpLabel = (record: AssistantRecord): string[] => {
  const server = record.attributionMcpServer
  const tool = record.attributionMcpTool
  if (server === undefined && tool === undefined) return []
  if (server === undefined) return [tool as string]
  if (tool === undefined) return [server]
  return [`${server}: ${tool}`]
}
