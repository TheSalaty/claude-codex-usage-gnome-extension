import { priceFor, priceUsage, type PriceTable, type Usage } from './pricing.js'
import { emptyCost, type Attribution, type Cost, type DayCost, type ModelCost } from './types.js'

export const localDay = (epochMs: number): string => {
  const d = new Date(epochMs)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export type Sample = {
  epochMs: number
  model: string
  usage: Usage
  reasoning: number
  attributions: Readonly<Record<string, readonly string[]>>
}

export class CostBuilder {
  private usd = 0
  private usdWithoutCache = 0
  private readonly tokens = {
    uncachedInput: 0,
    cacheRead: 0,
    cacheWrite: 0,
    output: 0,
    reasoning: 0,
  }
  private readonly byModel = new Map<string, ModelCost>()
  private readonly byDay = new Map<string, DayCost>()
  private readonly byDimension = new Map<string, Map<string, number>>()
  private readonly unpriced = new Set<string>()

  constructor(private readonly table: PriceTable) {}

  add(sample: Sample): void {
    const tokens =
      sample.usage.uncachedInput +
      sample.usage.cacheRead +
      sample.usage.cacheWrite +
      sample.usage.cacheWrite1h +
      sample.usage.output
    if (tokens === 0) return

    const price = priceFor(sample.model, this.table)
    if (price === null) this.unpriced.add(sample.model)
    const { usd, usdWithoutCache } = priceUsage(sample.usage, price)

    this.usd += usd
    this.usdWithoutCache += usdWithoutCache
    this.tokens.uncachedInput += sample.usage.uncachedInput
    this.tokens.cacheRead += sample.usage.cacheRead
    this.tokens.cacheWrite += sample.usage.cacheWrite + sample.usage.cacheWrite1h
    this.tokens.output += sample.usage.output
    this.tokens.reasoning += sample.reasoning

    const model = this.byModel.get(sample.model) ?? { model: sample.model, usd: 0, tokens: 0 }
    model.usd += usd
    model.tokens += tokens
    this.byModel.set(sample.model, model)

    const date = localDay(sample.epochMs)
    const day = this.byDay.get(date) ?? { date, usd: 0, tokens: 0 }
    day.usd += usd
    day.tokens += tokens
    this.byDay.set(date, day)

    for (const [dimension, names] of Object.entries(sample.attributions)) {
      let bucket = this.byDimension.get(dimension)
      if (bucket === undefined) {
        bucket = new Map()
        this.byDimension.set(dimension, bucket)
      }
      for (const name of new Set(names)) bucket.set(name, (bucket.get(name) ?? 0) + usd)
    }
  }

  unpricedModels(): string[] {
    return [...this.unpriced].sort()
  }

  build(): Cost {
    const cost = emptyCost()
    cost.usd = this.usd
    cost.usdWithoutCache = this.usdWithoutCache
    cost.tokens = { ...this.tokens }
    cost.models = [...this.byModel.values()].sort((a, b) => b.usd - a.usd || b.tokens - a.tokens)
    cost.days = [...this.byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
    cost.activeDays = cost.days.filter((d) => d.tokens > 0).length
    cost.skills = this.dimension('skills')
    cost.subagents = this.dimension('subagents')
    cost.mcpTools = this.dimension('mcpTools')
    return cost
  }

  private dimension(name: string): Attribution[] {
    const bucket = this.byDimension.get(name)
    if (bucket === undefined) return []
    return [...bucket.entries()]
      .map(([label, usd]) => ({ name: label, usd }))
      .sort((a, b) => b.usd - a.usd || a.name.localeCompare(b.name))
  }
}
