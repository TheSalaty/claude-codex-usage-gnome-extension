import type { Limit, PanelLimitSource, Provider, Snapshot, WindowDays } from './types.js'

export const isWindowDays = (value: number): value is WindowDays =>
  value === 1 || value === 7 || value === 30

/** The limit the panel should shout about: whatever is closest to being hit. */
export const tightestLimit = (snapshot: Snapshot): { provider: Provider; limit: Limit } | null => {
  let best: { provider: Provider; limit: Limit } | null = null
  for (const provider of snapshot.providers) {
    for (const limit of provider.limits) {
      if (best === null || limit.percent > best.limit.percent) best = { provider, limit }
    }
  }
  return best
}

/** The one limit per selected provider that fits in the panel. */
export const panelLimits = (
  snapshot: Snapshot,
  source: PanelLimitSource,
): { provider: Provider; limit: Limit }[] => {
  const providers = source === 'both' ? snapshot.providers : snapshot.providers.filter(({ id }) => id === source)
  return providers.flatMap((provider) => {
    const limit = provider.limits.reduce<Limit | null>(
      (best, current) => best === null || current.percent > best.percent ? current : best,
      null,
    )
    return limit === null ? [] : [{ provider, limit }]
  })
}

export const totalUsd = (snapshot: Snapshot): number =>
  snapshot.providers.reduce((sum, provider) => sum + provider.cost.usd, 0)

export type Severity = 'normal' | 'warning' | 'critical'

export const severityFor = (percent: number): Severity => {
  if (percent >= 90) return 'critical'
  if (percent >= 70) return 'warning'
  return 'normal'
}

/**
 * Validates a decoded snapshot. The collector is a separate process whose output can be
 * truncated by a kill or a full disk, so a half-written cache must not brick the panel.
 */
export const isSnapshot = (value: unknown): value is Snapshot => {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Partial<Snapshot>
  return (
    typeof candidate.generatedAt === 'string' &&
    typeof candidate.windowDays === 'number' &&
    Array.isArray(candidate.providers) &&
    Array.isArray(candidate.warnings)
  )
}
