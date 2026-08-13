export const formatUsd = (usd: number): string => {
  if (usd === 0) return '$0.00'
  if (usd < 0.01) return '<$0.01'
  if (usd < 1000) return `$${usd.toFixed(2)}`
  return `$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export const formatTokens = (tokens: number): string => {
  if (tokens < 1_000) return String(Math.round(tokens))
  if (tokens < 1_000_000) return `${(tokens / 1_000).toFixed(1)}K`
  if (tokens < 1_000_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  return `${(tokens / 1_000_000_000).toFixed(2)}B`
}

export const formatPercent = (percent: number): string => `${Math.round(percent)}%`

export const formatShare = (part: number, whole: number): string =>
  whole <= 0 ? '0%' : `${Math.round((part / whole) * 100)}%`

/** "Resets in 2h" granularity: whole days, then whole hours, then minutes. */
export const formatUntil = (isoTimestamp: string | null, nowMs: number): string | null => {
  if (isoTimestamp === null) return null
  const target = Date.parse(isoTimestamp)
  if (!isFinite(target)) return null
  const seconds = Math.round((target - nowMs) / 1000)
  if (seconds <= 0) return 'now'
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86_400)}d`
}

/** "3m ago" for the age of a cached snapshot. */
export const formatAgo = (isoTimestamp: string | null, nowMs: number): string | null => {
  if (isoTimestamp === null) return null
  const then = Date.parse(isoTimestamp)
  if (!isFinite(then)) return null
  const seconds = Math.max(0, Math.round((nowMs - then) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86_400)}d ago`
}

export const formatDate = (isoDate: string): string => {
  const parts = isoDate.split('-')
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!isFinite(month) || !isFinite(day)) return isoDate
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[month - 1] ?? ''} ${day}`
}
