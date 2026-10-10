import { readJsonCache, writeJsonCache } from './localCache.js'

const FEED_REPOSITORY = 'stamparm/ipsum'
const FEED_COMMIT_URL = `https://api.github.com/repos/${FEED_REPOSITORY}/commits?path=levels/6.txt&per_page=1`
const RAW_REPOSITORY_URL = `https://raw.githubusercontent.com/${FEED_REPOSITORY}`
const SNAPSHOT_KEY = 'sentinel-threat-feed-v1'
const GEO_CACHE_KEY = 'sentinel-threat-geo-v1'
const FEED_CHECK_INTERVAL = 15 * 60 * 1000
const GEO_LOOKUP_LIMIT = 16
const VALID_IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

function readFeedCache() {
  return readJsonCache(SNAPSHOT_KEY, (snapshot) => (
    typeof snapshot?.sha === 'string'
    && Number.isFinite(Date.parse(snapshot.publishedAt))
    && Array.isArray(snapshot.indicators)
    && snapshot.indicators.every((indicator) => indicator && typeof indicator.ip === 'string' && VALID_IPV4.test(indicator.ip) && [3, 6].includes(indicator.consensus))
  ))
}

export function parseIpList(text) {
  return new Set(text.split(/\r?\n/).map((line) => line.trim()).filter((line) => VALID_IPV4.test(line)))
}

export function createIndicators(threeOrMore, sixOrMore) {
  const result = []
  for (const ip of threeOrMore) {
    result.push({ ip, consensus: sixOrMore.has(ip) ? 6 : 3 })
  }
  return result
}

function getGeoCache() {
  const cache = readJsonCache(GEO_CACHE_KEY, (value) => (
    value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([ip, location]) => (
      VALID_IPV4.test(ip)
      && Number.isFinite(location?.latitude)
      && location.latitude >= -90
      && location.latitude <= 90
      && Number.isFinite(location?.longitude)
      && location.longitude >= -180
      && location.longitude <= 180
      && typeof location?.country === 'string'
    ))
  ))
  return cache ?? {}
}

function chooseGeoSample(indicators, limit, seed) {
  if (indicators.length <= limit) return indicators

  let hash = 0
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  const start = hash % indicators.length
  const step = Math.max(1, Math.floor(indicators.length / limit))
  const selected = []
  for (let index = 0; selected.length < limit; index += 1) {
    const candidate = indicators[(start + index * step) % indicators.length]
    if (!selected.some((item) => item.ip === candidate.ip)) selected.push(candidate)
  }
  return selected
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Threat source returned HTTP ${response.status}.`)
    return await response.json()
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Threat source request timed out. Please retry.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

async function fetchText(url) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Threat feed returned HTTP ${response.status}.`)
    return await response.text()
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Threat feed download timed out. Please retry.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function loadThreatFeed() {
  const cached = readFeedCache()
  const commitHistory = await fetchJson(FEED_COMMIT_URL)
  const latest = commitHistory?.[0]
  if (!latest?.sha || !latest?.commit?.committer?.date) {
    throw new Error('The public threat feed returned invalid update metadata.')
  }

  const checkedAt = new Date().toISOString()
  if (cached?.sha === latest.sha && Array.isArray(cached.indicators)) {
    const snapshot = { ...cached, checkedAt, stale: false }
    writeJsonCache(SNAPSHOT_KEY, snapshot)
    return snapshot
  }

  const [threeText, sixText] = await Promise.all([
    fetchText(`${RAW_REPOSITORY_URL}/${latest.sha}/levels/3.txt`),
    fetchText(`${RAW_REPOSITORY_URL}/${latest.sha}/levels/6.txt`),
  ])
  const sixOrMore = parseIpList(sixText)
  const threeOrMore = parseIpList(threeText)
  if (!threeOrMore.size || !sixOrMore.size) {
    throw new Error('The public threat feed did not contain any valid IP indicators.')
  }

  const snapshot = {
    sha: latest.sha,
    publishedAt: latest.commit.committer.date,
    checkedAt,
    indicators: createIndicators(threeOrMore, sixOrMore),
    stale: false,
  }
  writeJsonCache(SNAPSHOT_KEY, snapshot)
  return snapshot
}

export function loadCachedThreatFeed() {
  return readFeedCache()
}

export async function resolveIndicatorLocations(indicators, feedVersion) {
  const geoCache = getGeoCache()
  const highConfidence = indicators.filter((indicator) => indicator.consensus >= 6)
  const moderateConfidence = indicators.filter((indicator) => indicator.consensus < 6)
  const candidates = [
    ...chooseGeoSample(highConfidence, 12, `${feedVersion}-high`),
    ...chooseGeoSample(moderateConfidence, GEO_LOOKUP_LIMIT - 12, `${feedVersion}-medium`),
  ]
  const unresolved = candidates.filter((indicator) => !geoCache[indicator.ip])
  let nextCache = geoCache
  let failures = 0

  for (let index = 0; index < unresolved.length; index += 3) {
    const batch = unresolved.slice(index, index + 3)
    const results = await Promise.all(batch.map(async ({ ip }) => {
      try {
        const location = await fetchJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`)
        const latitude = Number(location.latitude)
        const longitude = Number(location.longitude)
        if (location.error || !location.country_name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          throw new Error(location.reason || 'The IP geolocation service returned incomplete data.')
        }
        return [ip, {
          latitude,
          longitude,
          country: location.country_name,
          countryCode: location.country_code,
          city: location.city || '',
          organization: location.org || '',
        }]
      } catch (error) {
        console.warn(`Could not resolve location for threat indicator ${ip}.`, error)
        failures += 1
        return null
      }
    }))
    const resolved = results.filter(Boolean)
    if (resolved.length) {
      nextCache = { ...nextCache, ...Object.fromEntries(resolved) }
      writeJsonCache(GEO_CACHE_KEY, nextCache)
    }
  }

  const locations = candidates.flatMap(({ ip, consensus }) => {
    const location = nextCache[ip]
    return location ? [{ ip, consensus, ...location }] : []
  })

  return { locations, attempted: candidates.length, failures }
}

export const threatFeedInfo = {
  repository: 'https://github.com/stamparm/ipsum',
  refreshMinutes: FEED_CHECK_INTERVAL / 60000,
  geoLookupLimit: GEO_LOOKUP_LIMIT,
  geolocationProvider: 'https://ipapi.co/',
}
