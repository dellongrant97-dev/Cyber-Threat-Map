import test from 'node:test'
import assert from 'node:assert/strict'
import { createSnapshotActivity, ensureSnapshotActivity } from '../src/threatActivity.js'

const indicator = (ip, consensus = 3) => ({ ip, consensus })

test('compares successive snapshots and summarizes new, retained, removed, and strengthened IPs', () => {
  const previous = {
    indicators: [
      indicator('203.0.113.1', 3),
      indicator('198.51.100.2', 6),
      indicator('192.0.2.3', 3),
    ],
  }
  const current = {
    sha: 'snapshot-2',
    publishedAt: '2026-10-10T11:00:00.000Z',
    retrievedAt: '2026-10-10T12:00:00.000Z',
    indicators: [
      indicator('203.0.113.1', 6),
      indicator('198.51.100.2', 6),
      indicator('192.0.2.4', 3),
    ],
  }

  assert.deepEqual(createSnapshotActivity(previous, current), {
    id: 'snapshot-2',
    source: 'IPsum',
    sourceUrl: 'https://github.com/stamparm/ipsum',
    baseline: false,
    publishedAt: '2026-10-10T11:00:00.000Z',
    retrievedAt: '2026-10-10T12:00:00.000Z',
    dashboardTimestampType: 'retrieved',
    totalCount: 3,
    highCount: 2,
    mediumCount: 1,
    newlyListed: { count: 1, highCount: 0, mediumCount: 1, sample: [indicator('192.0.2.4', 3)] },
    retained: { count: 2, highCount: 2, mediumCount: 0, sample: [indicator('198.51.100.2', 6), indicator('203.0.113.1', 6)] },
    noLongerListed: { count: 1, highCount: 0, mediumCount: 1, sample: [indicator('192.0.2.3', 3)] },
    strengthened: { count: 1, highCount: 1, mediumCount: 0, sample: [indicator('203.0.113.1', 6)] },
  })
})

test('creates a baseline without claiming historical additions', () => {
  const current = {
    sha: 'initial-snapshot',
    publishedAt: '2026-10-10T11:00:00.000Z',
    checkedAt: '2026-10-10T12:00:00.000Z',
    indicators: [indicator('203.0.113.1')],
  }

  const activity = createSnapshotActivity(null, current)
  assert.equal(activity.baseline, true)
  assert.equal(activity.totalCount, 1)
  assert.equal(activity.newlyListed.count, 0)
  assert.equal(activity.retained.count, 0)
  assert.equal(activity.retrievedAt, current.checkedAt)
  assert.equal(activity.dashboardTimestampType, 'checked')
})

test('samples large changes but retains exact summary counts', () => {
  const indicators = Array.from({ length: 30 }, (_, index) => indicator(`10.0.0.${index + 1}`))
  const activity = createSnapshotActivity({ indicators: [] }, {
    sha: 'large-snapshot',
    indicators,
  }, 5)

  assert.equal(activity.newlyListed.count, 30)
  assert.equal(activity.newlyListed.sample.length, 5)
  assert.equal(activity.newlyListed.sample[0].ip, '10.0.0.1')
})

test('ensures old cached snapshots are explicitly represented as a baseline', () => {
  const snapshot = {
    sha: 'legacy',
    publishedAt: '2026-10-10T11:00:00.000Z',
    checkedAt: '2026-10-10T12:00:00.000Z',
    indicators: [indicator('203.0.113.1')],
  }
  assert.equal(ensureSnapshotActivity(snapshot)[0].baseline, true)
  assert.throws(() => createSnapshotActivity(null, {}), TypeError)
})
