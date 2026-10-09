const EARTHQUAKE_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'
const REQUEST_TIMEOUT = 15000

export async function loadGlobalEvents() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(EARTHQUAKE_FEED_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/geo+json, application/json' },
    })
    if (!response.ok) throw new Error(`USGS event feed returned HTTP ${response.status}.`)

    const feed = await response.json()
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

    return {
      events,
      updatedAt: feed.metadata.generated,
    }
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
