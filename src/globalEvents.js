import { readJsonCache, writeJsonCache } from './localCache.js'

const EARTHQUAKE_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'
const REQUEST_TIMEOUT = 15000
const CACHE_KEY = 'sentinel-global-events-v1'

function isValidEventCache(cache) {
  return Number.isFinite(cache?.updatedAt)
    && Array.isArray(cache.events)
    && cache.events.every((event) => (
      typeof event.id === 'string'
      && Number.isFinite(event.magnitude)
      && Number.isFinite(event.occurredAt)
      && Number.isFinite(event.latitude)
      && event.latitude >= -90
      && event.latitude <= 90
      && Number.isFinite(event.longitude)
      && event.longitude >= -180
      && event.longitude <= 180
      && typeof event.place === 'string'
    ))
}

export function loadCachedGlobalEvents() {
  const cache = readJsonCache(CACHE_KEY, isValidEventCache)
  return cache ? { ...cache, stale: true } : null
}

export function normalizeGlobalEvents(feed) {
  if (!Array.isArray(feed?.features) || !Number.isFinite(feed?.metadata?.generated)) {
    throw new Error('The USGS event feed returned invalid data.')
  }

  const events = feed.features.flatMap((feature) => {
    const properties = feature?.properties
    const coordinates = feature?.geometry?.coordinates
    const [longitude, latitude, depth] = Array.isArray(coordinates) ? coordinates : []
    if (
      typeof feature.id !== 'string'
      || !Number.isFinite(properties?.mag)
      || properties.mag < 4.5
      || !Number.isFinite(properties?.time)
      || !Number.isFinite(latitude)
      || latitude < -90
      || latitude > 90
      || !Number.isFinite(longitude)
      || longitude < -180
      || longitude > 180
      || typeof properties?.place !== 'string'
    ) return []

    return [{
      id: feature.id,
      magnitude: properties.mag,
      place: properties.place,
      occurredAt: properties.time,
      latitude,
      longitude,
      depth: Number.isFinite(depth) ? depth : null,
      url: typeof properties.url === 'string' ? properties.url : '',
    }]
  }).sort((first, second) => second.occurredAt - first.occurredAt)

  return { events, updatedAt: feed.metadata.generated, stale: false }
}

export async function loadGlobalEvents() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(EARTHQUAKE_FEED_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/geo+json, application/json' },
    })
    if (!response.ok) throw new Error(`USGS event feed returned HTTP ${response.status}.`)
    const result = normalizeGlobalEvents(await response.json())
    writeJsonCache(CACHE_KEY, result)
    return result
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The USGS event feed request timed out. Please retry.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export const globalEventsInfo = {
  source: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
  refreshMinutes: 5,
}
