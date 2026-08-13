import assert from 'node:assert/strict'
import { test } from 'node:test'

import { aggregateClaude } from '../src/lib/claude-parse.js'
import { DEFAULT_PRICES } from '../src/lib/pricing.js'

const NOW = Date.parse('2026-08-13T12:00:00.000Z')
const options = { sinceMs: NOW - 86_400_000, table: DEFAULT_PRICES }

const assistant = (overrides: {
  id: string
  at: string
  model?: string
  input?: number
  output?: number
  cacheRead?: number
  write5m?: number
  write1h?: number
  legacyWrite?: number
  skill?: string
  agent?: string
}): string =>
  JSON.stringify({
    type: 'assistant',
    timestamp: overrides.at,
    ...(overrides.skill === undefined ? {} : { attributionSkill: overrides.skill }),
    ...(overrides.agent === undefined ? {} : { attributionAgent: overrides.agent }),
    message: {
      id: overrides.id,
      model: overrides.model ?? 'claude-opus-5',
      usage: {
        input_tokens: overrides.input ?? 0,
        cache_read_input_tokens: overrides.cacheRead ?? 0,
        ...(overrides.legacyWrite === undefined
          ? {
              cache_creation: {
                ephemeral_5m_input_tokens: overrides.write5m ?? 0,
                ephemeral_1h_input_tokens: overrides.write1h ?? 0,
              },
            }
          : { cache_creation_input_tokens: overrides.legacyWrite }),
        output_tokens: overrides.output ?? 0,
      },
    },
  })

test('a message logged twice while streaming is counted once, at its final usage', () => {
  const { cost } = aggregateClaude(
    [
      assistant({ id: 'msg_1', at: '2026-08-13T10:00:00Z', output: 100 }),
      assistant({ id: 'msg_1', at: '2026-08-13T10:00:00Z', output: 400 }),
    ],
    options,
  )
  assert.equal(cost.tokens.output, 400)
  assert.equal(Number(cost.usd.toFixed(6)), Number(((400 * 25) / 1e6).toFixed(6)))
})

test('records older than the window are dropped', () => {
  const { cost } = aggregateClaude(
    [
      assistant({ id: 'old', at: '2026-08-01T10:00:00Z', output: 1000 }),
      assistant({ id: 'new', at: '2026-08-13T10:00:00Z', output: 10 }),
    ],
    options,
  )
  assert.equal(cost.tokens.output, 10)
})

test('a usage object without the cache_creation breakdown still counts its writes', () => {
  const { cost } = aggregateClaude(
    [assistant({ id: 'legacy', at: '2026-08-13T10:00:00Z', legacyWrite: 2000 })],
    options,
  )
  assert.equal(cost.tokens.cacheWrite, 2000)
})

test('skills and subagents are independent shares of the same spend', () => {
  const { cost } = aggregateClaude(
    [
      assistant({ id: 'a', at: '2026-08-13T10:00:00Z', output: 100, skill: 'ponytail', agent: 'Explore' }),
      assistant({ id: 'b', at: '2026-08-13T11:00:00Z', output: 100, skill: 'ponytail' }),
      assistant({ id: 'c', at: '2026-08-13T11:30:00Z', output: 200 }),
    ],
    options,
  )
  assert.deepEqual(
    cost.skills.map((entry) => entry.name),
    ['/ponytail'],
  )
  assert.equal(cost.skills[0]?.usd, cost.usd / 2, 'two of four hundred output tokens')
  assert.equal(cost.subagents[0]?.name, 'Explore')
  assert.equal(cost.subagents[0]?.usd, cost.usd / 4)
})

test('non-assistant lines and unparsable lines never break the run', () => {
  const { cost, warnings } = aggregateClaude(
    [
      '{"type":"user","message":{"content":[{"type":"text","text":"\\"type\\":\\"assistant\\""}]}}',
      '{ truncated',
      assistant({ id: 'ok', at: '2026-08-13T10:00:00Z', output: 10 }),
    ],
    options,
  )
  assert.equal(cost.tokens.output, 10)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0] ?? '', /unparsable/)
})

test('an unknown model is priced at zero and named in a warning', () => {
  const { cost, warnings } = aggregateClaude(
    [assistant({ id: 'x', at: '2026-08-13T10:00:00Z', model: 'claude-next-9', output: 1000 })],
    options,
  )
  assert.equal(cost.usd, 0)
  assert.equal(cost.models[0]?.tokens, 1000)
  assert.match(warnings[0] ?? '', /claude-next-9/)
})
