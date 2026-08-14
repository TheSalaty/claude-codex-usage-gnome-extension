import assert from 'node:assert/strict'
import { test } from 'node:test'

import { panelLimits } from '../src/lib/snapshot.js'
import { emptyCost, type Snapshot } from '../src/lib/types.js'

test('the panel shows Claude’s session limit instead of its higher weekly limit', () => {
  const snapshot: Snapshot = {
    generatedAt: '', since: '', windowDays: 7, warnings: [],
    providers: [{
      id: 'claude', name: 'Claude Code', limitsAt: null, warnings: [], cost: emptyCost(),
      account: { authMethod: null, email: null, organization: null, plan: null },
      limits: [
        { label: 'Weekly (7 day)', percent: 76, resetsAt: null, isActive: false },
        { label: 'Session (5h)', percent: 70, resetsAt: null, isActive: true },
      ],
    }],
  }
  assert.equal(panelLimits(snapshot, 'claude')[0]?.limit.label, 'Session (5h)')
})
