import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatDuration, isTerminal, jobId, sortJobs, statusMeta } from '../lib/format.js'

describe('isTerminal', () => {
  it('marks completed/killed/failed terminal, running/stopping live', () => {
    assert.equal(isTerminal('completed'), true)
    assert.equal(isTerminal('killed'), true)
    assert.equal(isTerminal('failed'), true)
    assert.equal(isTerminal('running'), false)
    assert.equal(isTerminal('stopping'), false)
  })
})

describe('statusMeta', () => {
  it('maps every lifecycle state to an icon and color', () => {
    assert.equal(statusMeta('running').icon, '●')
    assert.equal(statusMeta('stopping').icon, '◌')
    assert.equal(statusMeta('completed').icon, '✓')
    assert.equal(statusMeta('killed').icon, '⊘')
    assert.equal(statusMeta('failed').icon, '✗')
    assert.equal(statusMeta('bogus').icon, '?')
  })
})

describe('formatDuration', () => {
  const t0 = 1_000_000
  it('sub-second, seconds, minutes, hours', () => {
    assert.equal(formatDuration(t0, t0 + 900), '0.9s')
    assert.equal(formatDuration(t0, t0 + 42_000), '42s')
    assert.equal(formatDuration(t0, t0 + 65_000), '1m 5s')
    assert.equal(formatDuration(t0, t0 + 7_500_000), '2h 5m')
  })

  it('running jobs measure against now', () => {
    const now = Date.now()
    assert.equal(formatDuration(now - 30_000, undefined, now), '30s')
  })
})

describe('sortJobs', () => {
  it('running first, then stopping, then terminal newest-first', () => {
    const jobs = [
      { id: 'a', status: 'completed', startedAt: 1 },
      { id: 'b', status: 'running', startedAt: 2 },
      { id: 'c', status: 'failed', startedAt: 9 },
      { id: 'd', status: 'stopping', startedAt: 3 },
      { id: 'e', status: 'running', startedAt: 4 },
    ]
    assert.deepEqual(sortJobs(jobs).map((j) => j.id), ['e', 'b', 'd', 'c', 'a'])
  })
})

describe('jobId', () => {
  it('accepts strings and branded objects', () => {
    assert.equal(jobId({ id: 'bash-1' }), 'bash-1')
    assert.equal(jobId({ id: { value: 'subagent-2' } }), 'subagent-2')
    assert.equal(jobId({}), '')
  })
})
