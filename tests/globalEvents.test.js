import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeGlobalEvents } from '../src/globalEvents.js'

const validFeature = (id, time, overrides = {}) => ({
  id,
  properties: { mag: 5.2, time, place: 'Test location', url: `https://earthquake.usgs.gov/${id}` },
  geometry: { coordinates: [12.5, -8.25, 40] },
  ...overrides,
})

test('normalizeGlobalEvents validates, sorts, and maps USGS GeoJSON features', () => {
  const result = normalizeGlobalEvents({
    metadata: { generated: 1700000000000 },
    features: [
      validFeature('older', 1699999999000),
      validFeature('newer', 1699999999500, { properties: { mag: 6.1, time: 1699999999500, place: 'New location' } }),
      validFeature('small', 1700000000000, { properties: { mag: 4.4, time: 1700000000000, place: 'Below threshold' } }),
      validFeature('invalid', 1700000000000, { geometry: { coordinates: [181, 0, 10] } }),
    ],
  })

  assert.equal(result.updatedAt, 1700000000000)
  assert.equal(result.stale, false)
  assert.deepEqual(result.events.map((event) => event.id), ['newer', 'older'])
  assert.deepEqual(result.events[0], {
    id: 'newer',
    magnitude: 6.1,
    place: 'New location',
    occurredAt: 1699999999500,
    latitude: -8.25,
    longitude: 12.5,
    depth: 40,
    url: '',
  })
})

test('normalizeGlobalEvents rejects malformed feed envelopes', () => {
  assert.throws(() => normalizeGlobalEvents({ features: [] }), /invalid data/)
  assert.throws(() => normalizeGlobalEvents(null), /invalid data/)
})

test('normalizeGlobalEvents only keeps safe HTTPS links to the official USGS host', () => {
  const result = normalizeGlobalEvents({
    metadata: { generated: 1700000000000 },
    features: [
      validFeature('safe', 1699999999000),
      validFeature('javascript', 1699999999500, {
        properties: { mag: 5.1, time: 1699999999500, place: 'Test location', url: 'javascript:alert(1)' },
      }),
      validFeature('lookalike', 1699999999800, {
        properties: { mag: 5.1, time: 1699999999800, place: 'Test location', url: 'https://earthquake.usgs.gov.attacker.example/event' },
      }),
    ],
  })
  assert.equal(result.events.find((event) => event.id === 'safe').url, 'https://earthquake.usgs.gov/safe')
  assert.equal(result.events.find((event) => event.id === 'javascript').url, '')
  assert.equal(result.events.find((event) => event.id === 'lookalike').url, '')
})
