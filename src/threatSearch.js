import { readJsonCache, writeJsonCache } from './localCache.js'

const OPENPHISH_FEED_URL = 'https://raw.githubusercontent.com/openphish/public_feed/main/feed.txt'
const OPENPHISH_SOURCE_URL = 'https://openphish.com/'
const CACHE_KEY = 'sentinel-openphish-search-v1'
const REQUEST_TIMEOUT_MS = 20000
const CACHE_MAX_AGE_MS = 30 * 60 * 1000
const MAX_MATCHES = 20
const MAX_FEED_URLS = 10000
const MAX_FEED_BYTES = 5_000_000
const VALID_IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
const VALID_DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

function isIpv4(value) {
  return VALID_IPV4.test(value)
}

function isDomain(value) {
  return typeof value === 'string'
    && VALID_DOMAIN.test(value)
    && !isIpv4(value)
    && value.split('.').every((label) => label.length <= 63)
}

function getLookupHost(value) {
  const candidate = value.trim()
  if (!candidate || candidate.length > 2048) return null

  if (isIpv4(candidate)) return { type: 'ip', value: candidate }
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(candidate)) {
    return isDomain(candidate) ? { type: 'domain', value: candidate.toLowerCase() } : null
  }

  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
    if (isIpv4(hostname)) return { type: 'ip', value: hostname }
    return isDomain(hostname) ? { type: 'domain', value: hostname } : null
  } catch {
    return null
  }
}

export function validateThreatLookupInput(value) {
  const result = getLookupHost(value)
  if (result) return { valid: true, ...result, error: '' }
  return {
    valid: false,
    type: null,
    value: '',
    error: 'Enter a valid IPv4 address or domain name (optionally with an http/https URL). IPv6 lookups are not supported by these sources.',
  }
}

export function findIpReputation(ip, snapshot) {
  if (!isIpv4(ip)) throw new TypeError('A valid IPv4 address is required.')
  const indicator = snapshot?.indicators?.find((item) => item.ip === ip)
  return {
    query: ip,
    source: 'IPsum',
    sourceUrl: 'https://github.com/stamparm/ipsum',
    found: Boolean(indicator),
    consensus: indicator?.consensus ?? null,
    publishedAt: snapshot?.publishedAt ?? null,
    checkedAt: snapshot?.retrievedAt ?? snapshot?.checkedAt ?? null,
    stale: Boolean(snapshot?.stale),
    observationTimeAvailable: false,
  }
}

export function parseOpenPhishFeed(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('The OpenPhish feed was empty or invalid.')
  if (text.length > MAX_FEED_BYTES) throw new Error('The OpenPhish feed exceeded the supported size limit.')
  const urls = new Set()
  for (const line of text.split(/\r?\n/)) {
    const candidate = line.trim()
    if (!candidate || candidate.length > 2048) continue
    try {
      const url = new URL(candidate)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !isDomain(url.hostname.toLowerCase())) continue
      urls.add(url.href)
    } catch {
      continue
    }
  }
  if (!urls.size) throw new Error('The OpenPhish feed did not contain any valid phishing URL indicators.')
  if (urls.size > MAX_FEED_URLS) throw new Error('The OpenPhish feed exceeded the supported size limit.')
  return [...urls]
}

function isValidOpenPhishCache(cache) {
  return Number.isFinite(Date.parse(cache?.retrievedAt))
    && Array.isArray(cache.urls)
    && cache.urls.length > 0
    && cache.urls.length <= MAX_FEED_URLS
    && cache.urls.every((value) => {
      if (typeof value !== 'string' || value.length > 2048) return false
      try {
        const url = new URL(value)
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && isDomain(url.hostname.toLowerCase())
      } catch {
        return false
      }
    })
}

export function loadCachedOpenPhishFeed() {
  const cache = readJsonCache(CACHE_KEY, isValidOpenPhishCache)
  return cache ? { ...cache, stale: true, error: '' } : null
}

export async function loadOpenPhishFeed({ now, force = false } = {}) {
  const cached = readJsonCache(CACHE_KEY, isValidOpenPhishCache)
  const cacheAge = cached ? (now ?? Date.now()) - Date.parse(cached.retrievedAt) : Infinity
  if (!force && cached && cacheAge >= 0 && cacheAge < CACHE_MAX_AGE_MS) {
    return { ...cached, stale: false, error: '' }
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(OPENPHISH_FEED_URL, {
      signal: controller.signal,
      headers: { Accept: 'text/plain' },
    })
    if (!response.ok) throw new Error(`OpenPhish feed returned HTTP ${response.status}.`)
    const urls = parseOpenPhishFeed(await response.text())
    const result = { urls, retrievedAt: new Date(now ?? Date.now()).toISOString() }
    writeJsonCache(CACHE_KEY, result)
    return { ...result, stale: false, error: '' }
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'The OpenPhish request timed out.'
      : error instanceof Error ? error.message : 'Could not retrieve the OpenPhish feed.'
    if (cached) return { ...cached, stale: true, error: message }
    if (error.name === 'AbortError') throw new Error(message)
    throw error instanceof Error ? error : new Error(message)
  } finally {
    window.clearTimeout(timeout)
  }
}

export function findDomainReports(domain, feed) {
  if (!isDomain(domain)) throw new TypeError('A valid domain name is required.')
  const normalizedDomain = domain.toLowerCase()
  const matchedUrls = []
  for (const value of feed?.urls ?? []) {
    let hostname
    try {
      hostname = new URL(value).hostname.toLowerCase()
    } catch {
      continue
    }
    if (hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`)) {
      matchedUrls.push(value)
      if (matchedUrls.length >= MAX_MATCHES) break
    }
  }
  return {
    query: normalizedDomain,
    source: 'OpenPhish Community Feed',
    sourceUrl: OPENPHISH_SOURCE_URL,
    retrievedAt: feed?.retrievedAt ?? null,
    stale: Boolean(feed?.stale),
    error: feed?.error ?? '',
    matches: matchedUrls,
    individualReportTimesAvailable: false,
  }
}

export function serializeThreatLookup(result, format = 'json') {
  if (!result || !['ip', 'domain'].includes(result.type)) {
    throw new TypeError('A completed threat lookup result is required.')
  }
  const document = {
    query: result.query,
    indicatorType: result.type,
    source: result.data.source,
    sourceUrl: result.data.sourceUrl,
    found: result.data.found ?? result.data.matches.length > 0,
    stale: Boolean(result.data.stale),
    sourceRefreshError: result.data.error ?? '',
    retrievedAt: result.type === 'ip' ? result.data.checkedAt : result.data.retrievedAt,
    publishedAt: result.type === 'ip' ? result.data.publishedAt : null,
    confidence: result.type === 'ip' ? result.data.consensus : null,
    matches: result.type === 'domain' ? result.data.matches : [],
    limitations: result.type === 'ip'
      ? 'IPsum does not provide per-IP observation times. A listing is reputation intelligence, not proof of an attack; absence is not proof of safety.'
      : `OpenPhish does not provide per-report timestamps in this feed. A listing is not proof of current compromise; absence is not proof of safety. At most ${MAX_MATCHES} matching URLs are included.`,
  }
  if (format === 'json') return { content: JSON.stringify(document, null, 2), extension: 'json', mimeType: 'application/json;charset=utf-8' }
  if (format !== 'csv') throw new TypeError('Export format must be json or csv.')
  const csvCell = (value) => {
    const safe = String(value ?? '').replace(/^[\s]*[=+\-@]/, (formula) => `'${formula}`)
    return `"${safe.replaceAll('"', '""')}"`
  }
  const rows = [['Query', 'Type', 'Source', 'Match', 'Result', 'Confidence', 'Published at', 'Retrieved at', 'Cached snapshot', 'Source refresh error', 'Limitations']]
  const matches = document.matches.length ? document.matches : ['']
  for (const match of matches) {
    rows.push([
      document.query,
      document.indicatorType,
      document.source,
      match,
      document.found ? 'Listed' : 'Not found in checked snapshot',
      document.confidence === null ? '' : `${document.confidence}+ source lists`,
      document.publishedAt,
      document.retrievedAt,
      document.stale ? 'Yes' : 'No',
      document.sourceRefreshError,
      document.limitations,
    ])
  }
  return {
    content: rows.map((row) => row.map(csvCell).join(',')).join('\r\n'),
    extension: 'csv',
    mimeType: 'text/csv;charset=utf-8',
  }
}

export const threatSearchInfo = {
  ipSource: 'https://github.com/stamparm/ipsum',
  domainSource: OPENPHISH_SOURCE_URL,
  domainFeedUrl: OPENPHISH_FEED_URL,
  feedCacheMinutes: CACHE_MAX_AGE_MS / 60000,
  maxMatches: MAX_MATCHES,
}
