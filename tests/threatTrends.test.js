import test from 'node:test'
import assert from 'node:assert/strict'
import { buildThreatTrendModel } from '../src/threatTrends.js'

const snapshots = [
  { id: 'rev-b', publishedAt: '2026-10-09T00:00:00Z', retrievedAt: '2026-10-09T01:00:00Z', totalCount: 12, highCount: 4, mediumCount: 8, newlyListed: { count: 3 }, noLongerListed: { count: 2 } },
  { id: 'rev-a', publishedAt: '2026-10-08T00:00:00Z', retrievedAt: '2026-10-08T01:00:00Z', totalCount: 10, highCount: 3, mediumCount: 7, newlyListed: { count: 0 }, noLongerListed: { count: 0 } },
  { id: 'rev-c', publishedAt: '2026-10-10T00:00:00Z', retrievedAt: '2026-10-10T01:00:00Z', totalCount: 11, highCount: 5, mediumCount: 6, newlyListed: { count: 2 }, noLongerListed: { count: 3 } },
]

test('orders collected snapshots by dashboard retrieval time and calculates actual count deltas', () => {
  const result = buildThreatTrendModel([
    ...snapshots,
    { ...snapshots[0], retrievedAt: '2026-10-09T02:00:00Z' },
  ], [], [], [])
  assert.deepEqual(result.snapshots.map((entry) => entry.id), ['rev-a', 'rev-b', 'rev-c'])
  assert.equal(result.snapshotCount, 3)
  assert.equal(result.snapshots[0].totalChange, null)
  assert.equal(result.snapshots[1].totalChange, 2)
  assert.equal(result.snapshots[1].highChange, 1)
  assert.equal(result.snapshots[2].totalChange, -1)
  assert.equal(result.snapshots[2].highChange, 1)
  assert.equal(result.comparisonAvailable, true)
})

test('does not create history when snapshots are missing or malformed', () => {
  const result = buildThreatTrendModel([
    { id: 'incomplete' },
    { id: 'bad', publishedAt: 'never', retrievedAt: 'never', totalCount: 10, highCount: 6, mediumCount: 3, newlyListed: { count: 0 }, noLongerListed: { count: 0 } },
  ], [], [], [])
  assert.equal(result.snapshotCount, 0)
  assert.equal(result.latest, null)
  assert.equal(result.comparisonAvailable, false)
})

test('aggregates only unique current-feed indicators with resolved country data', () => {
  const result = buildThreatTrendModel([], [
    { ip: '192.0.2.1', consensus: 6 },
    { ip: '192.0.2.2', consensus: 3 },
    { ip: '192.0.2.3', consensus: 6 },
  ], [
    { ip: '192.0.2.1', country: 'Exampleland' },
    { ip: '192.0.2.1', country: 'Exampleland' },
    { ip: '192.0.2.2', country: 'Exampleland' },
    { ip: '192.0.2.3', country: '' },
    { ip: '198.51.100.8', country: 'Not in feed' },
  ], [], 3)
  assert.deepEqual(result.countryCoverage, {
    resolvedIndicators: 2,
    attemptedIndicators: 3,
    countries: [{ country: 'Exampleland', count: 2, highCount: 1 }],
  })
})

test('describes only available feed categories and groups fetched CVEs by supplied severity', () => {
  const result = buildThreatTrendModel([], [{ ip: '192.0.2.1' }], [], [
    { metrics: { severity: 'HIGH' } },
    { metrics: { severity: 'MEDIUM' } },
    { metrics: { severity: 'NOT-A-SEVERITY' } },
  ])
  assert.equal(result.categories.ipReputationCount, 1)
  assert.equal(result.categories.vulnerabilityCount, 3)
  assert.deepEqual(result.categories.vulnerabilitySeverities, [
    { severity: 'HIGH', count: 1 },
    { severity: 'MEDIUM', count: 1 },
    { severity: 'UNKNOWN', count: 1 },
  ])
})
