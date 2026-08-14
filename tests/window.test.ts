import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatRange } from '../src/lib/format.js'
import { windowStartMs } from '../src/lib/snapshot.js'

const at = (isoLocal: string): number => new Date(isoLocal).getTime()

test('a multi-day window starts at local midnight so it spans whole days', () => {
  const now = at('2026-08-14T09:40:00')
  assert.equal(new Date(windowStartMs(30, now)).getTime(), at('2026-07-16T00:00:00'))
  assert.equal(new Date(windowStartMs(7, now)).getTime(), at('2026-08-08T00:00:00'))
})

test('the 24-hour window stays rolling rather than snapping to midnight', () => {
  const now = at('2026-08-14T09:40:00')
  assert.equal(windowStartMs(1, now), at('2026-08-13T09:40:00'))
})

test('the range names the first and last day the window covers', () => {
  const now = at('2026-08-14T09:40:00')
  assert.equal(formatRange(new Date(windowStartMs(30, now)).toISOString(), now), 'Jul 16 – Aug 14')
  assert.equal(formatRange('not-a-date', now), null)
})
