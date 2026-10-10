import test from 'node:test'
import assert from 'node:assert/strict'
import { filterIndicators } from '../src/indicatorFilters.js'

const indicators = [
  { ip: '203.0.113.1', consensus: 6 },
  { ip: '198.51.100.2', consensus: 3 },
  { ip: '192.0.2.3', consensus: 6 },
]
const locations = [
  { ip: '203.0.113.1', country: 'United States', city: 'Ashburn', organization: 'Example ASN' },
  { ip: '198.51.100.2', country: 'Germany', city: 'Berlin' },
]
const options = {
  indicators,
  locations,
  publishedAt: '2025-01-25T00:00:00.000Z',
  now: Date.parse('2025-01-30T00:00:00.000Z'),
}

test('filters indicators by consensus tier, country, unavailable location, and query', () => {
  assert.deepEqual(filterIndicators({ ...options, confidence: 'high' }).map(({ ip }) => ip), ['203.0.113.1', '192.0.2.3'])
  assert.deepEqual(filterIndicators({ ...options, country: 'Germany' }).map(({ ip }) => ip), ['198.51.100.2'])
  assert.deepEqual(filterIndicators({ ...options, country: 'unavailable' }).map(({ ip }) => ip), ['192.0.2.3'])
  assert.deepEqual(filterIndicators({ ...options, query: 'example asn' }).map(({ ip }) => ip), ['203.0.113.1'])
})

test('supports only the reputation category supplied by the feed', () => {
  assert.deepEqual(filterIndicators({ ...options, category: 'all' }), indicators)
  assert.deepEqual(filterIndicators({ ...options, category: 'ip-reputation' }), indicators)
  assert.deepEqual(filterIndicators({ ...options, category: 'malware' }), [])
})

test('date ranges filter by shared publisher snapshot date, not per-IP observation dates', () => {
  assert.deepEqual(filterIndicators({ ...options, snapshotWindow: '7d' }), indicators)
  assert.deepEqual(filterIndicators({ ...options, snapshotWindow: '30d' }), indicators)
  assert.deepEqual(filterIndicators({
    ...options,
    snapshotWindow: '7d',
    now: Date.parse('2025-02-10T00:00:00.000Z'),
  }), [])
  assert.deepEqual(filterIndicators({ ...options, snapshotWindow: '7d', publishedAt: undefined }), [])
})
