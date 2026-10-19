import { readJsonCache, writeJsonCache } from './localCache.js'

const CISA_FEED = 'https://www.cisa.gov/cybersecurity-advisories/all.xml'
const RSS_CONVERTER = 'https://api.rss2json.com/v1/api.json'
const CACHE_KEY = 'sentinel-cisa-cyber-news-v1'
const REQUEST_TIMEOUT = 20000
const MAX_ITEMS = 20
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000

function cleanText(value) {
  if (typeof DOMParser === 'undefined') return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const document = new DOMParser().parseFromString(value ?? '', 'text/html')
  return document.body.textContent.replace(/\s+/g, ' ').trim()
}

function isOfficialCisaUrl(value) {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password) return ''
    if (host !== 'cisa.gov' && !host.endsWith('.cisa.gov')) return ''
    return url.href
  } catch { return '' }
}

function getSafeImageUrl(value) {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    const allowed = host === 'cisa.gov' || host.endsWith('.cisa.gov')
      || host === 'media.defense.gov' || host === 'www.dhs.gov'
    if (url.protocol !== 'https:' || !allowed || url.pathname === '/' || url.username || url.password) return ''
    return url.href
  } catch { return '' }
}

function imageCandidates(item) {
  const values = [item?.thumbnail, item?.enclosure, item?.image, item?.['media:thumbnail'], item?.['media:content']]
  return [...new Set(values.flatMap((value) => {
    if (typeof value === 'string') return [value]
    if (!value || typeof value !== 'object') return []
    return [value.url, value.src, value.href, value.$?.url, value.$?.src].filter((entry) => typeof entry === 'string')
  }).map(getSafeImageUrl).filter(Boolean))]
}

function isValidCache(cache) {
  return Number.isFinite(cache?.updatedAt) && Array.isArray(cache.items)
    && cache.items.every((item) => typeof item.id === 'string'
      && typeof item.title === 'string' && typeof item.summary === 'string'
      && isOfficialCisaUrl(item.url) === item.url
      && (!item.imageUrl || getSafeImageUrl(item.imageUrl) === item.imageUrl)
      && Number.isFinite(item.publishedAt))
}

export function loadCachedCyberNews() {
  const cache = readJsonCache(CACHE_KEY, isValidCache)
  return cache ? { ...cache, stale: true } : null
}

export function normalizeCyberNewsItems(items, { now = Date.now(), textCleaner = cleanText } = {}) {
  if (!Array.isArray(items)) throw new Error('CISA advisory feed returned invalid data.')
  return items.flatMap((item) => {
    const title = textCleaner(item?.title)
    const summary = textCleaner(item?.description || item?.content)
    const url = isOfficialCisaUrl(item?.link)
    const rawDate = item?.pubDate
    const publishedAt = typeof rawDate === 'string' && /(?:Z|GMT|UTC|[+-]\d{2}:?\d{2})$/i.test(rawDate.trim())
      ? Date.parse(rawDate) : new Date(`${rawDate} UTC`).getTime()
    if (!title || !url || !Number.isFinite(publishedAt)
      || publishedAt > now + 60 * 60 * 1000 || publishedAt < now - WINDOW_MS) return []
    const images = imageCandidates(item)
    return [{ id: url, title, summary, url, imageUrl: images[0] || '', publishedAt }]
  }).sort((a, b) => b.publishedAt - a.publishedAt).slice(0, MAX_ITEMS)
}

export async function loadCyberNews() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const url = `${RSS_CONVERTER}?rss_url=${encodeURIComponent(CISA_FEED)}`
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`CISA advisory feed returned HTTP ${response.status}.`)
    const feed = await response.json()
    if (feed?.status !== 'ok' || !Array.isArray(feed?.items)) throw new Error(feed?.message || 'CISA advisory feed returned invalid data.')
    const result = { items: normalizeCyberNewsItems(feed.items), updatedAt: Date.now(), stale: false }
    writeJsonCache(CACHE_KEY, result)
    return result
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('CISA advisory feed request timed out. Please retry.')
    throw error
  } finally { window.clearTimeout(timeout) }
}

export const cyberNewsInfo = {
  name: 'CISA Cybersecurity Advisories',
  source: 'https://www.cisa.gov/cybersecurity-advisories',
  feed: CISA_FEED,
  refreshMinutes: 15,
}
