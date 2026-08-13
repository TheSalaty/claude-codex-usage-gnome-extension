export type ProviderId = 'claude' | 'codex'

export type WindowDays = 1 | 7 | 30

/** A rolling usage limit as the provider reports it — percent consumed plus when it clears. */
export type Limit = {
  label: string
  percent: number
  /** ISO 8601, or `null` when the provider reports no reset time. */
  resetsAt: string | null
  /** The limit the provider currently throttles on. */
  isActive: boolean
}

export type TokenTotals = {
  uncachedInput: number
  cacheRead: number
  cacheWrite: number
  output: number
  reasoning: number
}

export type ModelCost = {
  model: string
  usd: number
  tokens: number
}

export type DayCost = {
  /** `YYYY-MM-DD` in local time. */
  date: string
  usd: number
  tokens: number
}

/** Share of window cost attributed to a named skill, subagent or slash command. */
export type Attribution = {
  name: string
  usd: number
}

export type Cost = {
  usd: number
  /** What the same traffic would have cost without prompt caching. */
  usdWithoutCache: number
  tokens: TokenTotals
  models: ModelCost[]
  days: DayCost[]
  skills: Attribution[]
  subagents: Attribution[]
  mcpTools: Attribution[]
  activeDays: number
}

export type Account = {
  authMethod: string | null
  email: string | null
  organization: string | null
  plan: string | null
}

export type Provider = {
  id: ProviderId
  name: string
  account: Account
  limits: Limit[]
  /**
   * When the limits were measured. `null` means they were read live — Codex has no usage
   * endpoint, so its figures come from the snapshot its last session happened to record.
   */
  limitsAt: string | null
  cost: Cost
  /** Non-fatal problems worth surfacing — stale limits, expired token, unpriced models. */
  warnings: string[]
}

export type Snapshot = {
  generatedAt: string
  windowDays: WindowDays
  providers: Provider[]
  warnings: string[]
}

export const emptyTokens = (): TokenTotals => ({
  uncachedInput: 0,
  cacheRead: 0,
  cacheWrite: 0,
  output: 0,
  reasoning: 0,
})

export const emptyCost = (): Cost => ({
  usd: 0,
  usdWithoutCache: 0,
  tokens: emptyTokens(),
  models: [],
  days: [],
  skills: [],
  subagents: [],
  mcpTools: [],
  activeDays: 0,
})

export const totalTokens = (t: TokenTotals): number =>
  t.uncachedInput + t.cacheRead + t.cacheWrite + t.output
