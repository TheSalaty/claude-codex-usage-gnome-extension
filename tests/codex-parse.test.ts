import assert from 'node:assert/strict'
import { test } from 'node:test'

import { aggregateCodex, windowLabel } from '../src/lib/codex-parse.js'
import { DEFAULT_PRICES } from '../src/lib/pricing.js'

const options = { sinceMs: Date.parse('2026-08-12T00:00:00Z'), table: DEFAULT_PRICES }

const turnContext = (model: string): string =>
  JSON.stringify({ timestamp: '2026-08-12T09:00:00Z', type: 'turn_context', payload: { model } })

const tokenCount = (
  at: string,
  totals: { input: number; cached: number; write?: number; output: number; reasoning?: number },
  rateLimits?: { primary?: { used_percent: number; window_minutes: number; resets_at: number } },
): string =>
  JSON.stringify({
    timestamp: at,
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        total_token_usage: {
          input_tokens: totals.input,
          cached_input_tokens: totals.cached,
          cache_write_input_tokens: totals.write ?? 0,
          output_tokens: totals.output,
          reasoning_output_tokens: totals.reasoning ?? 0,
        },
      },
      ...(rateLimits === undefined ? {} : { rate_limits: { ...rateLimits, plan_type: 'plus' } }),
    },
  })

test('spend is the rise in the running total, not the repeated snapshot', () => {
  const { cost } = aggregateCodex(
    [
      {
        lines: [
          turnContext('gpt-5.6-terra'),
          tokenCount('2026-08-12T10:00:00Z', { input: 1_000_000, cached: 0, output: 0 }),
          // Same snapshot re-emitted: contributes nothing.
          tokenCount('2026-08-12T10:00:01Z', { input: 1_000_000, cached: 0, output: 0 }),
          tokenCount('2026-08-12T10:05:00Z', { input: 3_000_000, cached: 2_000_000, output: 100_000 }),
        ],
      },
    ],
    options,
  )
  // Uncached input is 1M + 0M, cached 2M at 0.1x, output 100K at $10/M.
  assert.equal(cost.tokens.uncachedInput, 1_000_000)
  assert.equal(cost.tokens.cacheRead, 2_000_000)
  assert.equal(cost.tokens.output, 100_000)
  assert.equal(Number(cost.usd.toFixed(4)), Number((1.25 * 1 + 1.25 * 0.2 + 10 * 0.1).toFixed(4)))
})

test('a restarted counter is treated as fresh spend rather than a negative delta', () => {
  const { cost } = aggregateCodex(
    [
      {
        lines: [
          tokenCount('2026-08-12T10:00:00Z', { input: 500_000, cached: 0, output: 1000 }),
          tokenCount('2026-08-12T10:01:00Z', { input: 100, cached: 0, output: 1 }),
        ],
      },
    ],
    options,
  )
  assert.equal(cost.tokens.uncachedInput, 500_100)
  assert.equal(cost.tokens.output, 1001)
})

test('each session accumulates from zero, so two sessions do not cancel out', () => {
  const { cost } = aggregateCodex(
    [
      { lines: [tokenCount('2026-08-12T10:00:00Z', { input: 200, cached: 0, output: 10 })] },
      { lines: [tokenCount('2026-08-12T11:00:00Z', { input: 300, cached: 0, output: 20 })] },
    ],
    options,
  )
  assert.equal(cost.tokens.uncachedInput, 500)
  assert.equal(cost.tokens.output, 30)
})

test('the newest rate-limit snapshot wins even when an older session is listed later', () => {
  const limitsAt = (at: string, percent: number): string =>
    tokenCount(at, { input: 10, cached: 0, output: 1 }, {
      primary: { used_percent: percent, window_minutes: 10_080, resets_at: 1_787_031_017 },
    })

  const { limits, limitsAt: recordedAt, planType } = aggregateCodex(
    [{ lines: [limitsAt('2026-08-12T12:00:00Z', 61)] }, { lines: [limitsAt('2026-08-12T09:00:00Z', 20)] }],
    options,
  )
  assert.equal(limits[0]?.percent, 61)
  assert.equal(limits[0]?.label, 'Weekly (7 day)')
  assert.equal(recordedAt, '2026-08-12T12:00:00Z')
  assert.equal(planType, 'plus')
})

test('window minutes map to the labels the CLIs use', () => {
  assert.equal(windowLabel(10_080), 'Weekly (7 day)')
  assert.equal(windowLabel(300), 'Session (5h)')
  assert.equal(windowLabel(43_200), '30 day')
  assert.equal(windowLabel(45), '45 min')
})
