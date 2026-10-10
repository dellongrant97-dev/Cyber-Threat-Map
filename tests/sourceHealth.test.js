import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSourceHealthRows } from '../src/sourceHealth.js'

test('distinguishes loading, first-retrieval error, successful empty, and idle source states', () => {
  const sources = buildSourceHealthRows({
    threat: { loading: true, attempted: true },
    events: { error: 'USGS HTTP 503', attempted: true },
    news: { lastSuccessAt: 1700000000000, latestUpdateAt: null, count: 0, attempted: true },
    phishing: { attempted: false },
  })
  assert.equal(sources.find((source) => source.id === 'ipsum').status, 'loading')
  assert.equal(sources.find((source) => source.id === 'usgs').status, 'error')
  assert.equal(sources.find((source) => source.id === 'usgs').error, 'USGS HTTP 503')
  assert.equal(sources.find((source) => source.id === 'bbc').status, 'empty')
  assert.equal(sources.find((source) => source.id === 'openphish').status, 'idle')
})

test('reports cached data as stale after refresh failure without losing the error', () => {
  const [source] = buildSourceHealthRows({
    threat: {
      count: 20,
      lastSuccessAt: '2026-10-10T10:00:00Z',
      latestUpdateAt: '2026-10-10T09:00:00Z',
      error: 'Network request failed',
    },
  })
  assert.equal(source.status, 'stale')
  assert.equal(source.stale, true)
  assert.equal(source.lastSuccessAt, '2026-10-10T10:00:00Z')
  assert.equal(source.latestUpdateAt, '2026-10-10T09:00:00Z')
  assert.equal(source.error, 'Network request failed')
})

test('marks a failed refresh after a successful empty response as stale instead of empty and current', () => {
  const source = buildSourceHealthRows({
    events: {
      count: 0,
      lastSuccessAt: 1700000000000,
      attempted: true,
      error: 'USGS request timed out',
    },
  }).find((entry) => entry.id === 'usgs')
  assert.equal(source.status, 'stale')
  assert.equal(source.stale, true)
  assert.equal(source.lastSuccessAt, 1700000000000)
})

test('shows offline status and marks displayed snapshots as potentially stale', () => {
  const sources = buildSourceHealthRows({
    online: false,
    events: { count: 2, lastSuccessAt: 1700000000000, attempted: true, error: 'Last request timed out.' },
  })
  const source = sources.find((entry) => entry.id === 'usgs')
  assert.equal(source.status, 'offline')
  assert.equal(source.stale, true)
  assert.match(source.error, /offline/)
})

test('tracks non-cyber feeds separately and leaves source timestamps unavailable when not supplied', () => {
  const rows = buildSourceHealthRows({
    phishing: { count: 3, lastSuccessAt: 1700000000000, attempted: true },
    geolocation: { resolved: 4, attempted: 8, attemptedRequest: true, lastSuccessAt: 1700000000000 },
  })
  const phishing = rows.find((source) => source.id === 'openphish')
  const geoip = rows.find((source) => source.id === 'geoip')
  assert.equal(phishing.latestUpdateAt, null)
  assert.equal(phishing.latestUpdateLabel, 'Provider update timestamp not supplied')
  assert.equal(phishing.description.includes('only when requested'), true)
  assert.equal(geoip.hasData, true)
  assert.equal(geoip.count, 4)
})
