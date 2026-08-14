import GLib from 'gi://GLib'

import { aggregateCodex } from '../lib/codex-parse.js'
import type { PriceTable } from '../lib/pricing.js'
import type { Provider } from '../lib/types.js'
import { exists, isoSeconds, onPath, readTextFile, runShell } from './io.js'

const home = (): string => GLib.get_home_dir()
const codexDir = (): string => GLib.build_filenamev([home(), '.codex'])
const sessionsDir = (): string => GLib.build_filenamev([codexDir(), 'sessions'])

export const codexInstalled = (): boolean => exists(codexDir()) || onPath('codex')

/**
 * Session files inside the window, plus the newest few regardless of it. Codex has no usage
 * endpoint — its rate limits only exist as a snapshot inside the last session it ran — so a
 * short window with no Codex activity would otherwise show no limits at all.
 */
const sessionFiles = (sinceMs: number): string[] => {
  const root = sessionsDir()
  if (!exists(root)) return []
  const recent = runShell(
    'find "$ROOT" -name "rollout-*.jsonl" -newermt "$SINCE" 2>/dev/null || true',
    { ROOT: root, SINCE: isoSeconds(sinceMs) },
  )
  const newest = runShell(
    'find "$ROOT" -name "rollout-*.jsonl" -printf "%T@ %p\\n" 2>/dev/null' +
      ' | sort -rn | head -3 | cut -d" " -f2- || true',
    { ROOT: root },
  )
  const paths = new Set<string>()
  for (const line of `${recent}\n${newest}`.split('\n')) {
    const path = line.trim()
    if (path.length > 0) paths.add(path)
  }
  return [...paths]
}

const readSession = (path: string): string[] => {
  const text = readTextFile(path)
  if (text === null) return []
  // Only these event kinds carry the numbers or the fork marker; dropping the rest here keeps
  // JSON.parse off the multi-megabyte reasoning and tool-output lines that fill a rollout.
  return text
    .split('\n')
    .filter(
      (line) =>
        line.includes('"token_count"') ||
        line.includes('"turn_context"') ||
        line.includes('"session_meta"'),
    )
}

export const collectCodex = (options: { sinceMs: number; table: PriceTable }): Provider => {
  const files = sessionFiles(options.sinceMs)
  const aggregate = aggregateCodex(
    files.map((path) => ({ lines: readSession(path) })),
    options,
  )

  const warnings = [...aggregate.warnings]
  if (aggregate.limits.length === 0) {
    warnings.push('No rate-limit snapshot found — run Codex once to record one')
  }

  return {
    id: 'codex',
    name: 'Codex',
    account: {
      authMethod: exists(GLib.build_filenamev([codexDir(), 'auth.json'])) ? 'ChatGPT' : null,
      email: null,
      organization: null,
      plan: aggregate.planType === null ? null : capitalise(aggregate.planType),
    },
    limits: aggregate.limits,
    limitsAt: aggregate.limitsAt,
    cost: aggregate.cost,
    warnings,
  }
}

const capitalise = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)
