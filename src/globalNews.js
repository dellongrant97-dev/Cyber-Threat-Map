import { readJsonCache, writeJsonCache } from './localCache.js'

const BBC_WORLD_FEED = 'https://feeds.bbci.co.uk/news/world/rss.xml'
const RSS_CONVERTER = 'https://api.rss2json.com/v1/api.json'
const RSS_PROXY = 'https://api.allorigins.win/raw?url='
const NEWS_REFRESH_MINUTES = 15
const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000
const MAX_NEWS_ITEMS = 30
const CACHE_KEY = 'sentinel-global-news-v5'

const headlineLocations = [
  { name: 'New York City, United States', latitude: 40.7128, longitude: -74.006, precision: 'city', terms: ['New York City', "New York City's", 'New York', 'NYC', 'Bronx', 'Marble Hill'] },
  { name: 'Riyadh, Saudi Arabia', latitude: 24.7136, longitude: 46.6753, precision: 'city', terms: ['Riyadh'] },
  { name: 'Kyiv, Ukraine', latitude: 50.4501, longitude: 30.5234, precision: 'city', terms: ['Kyiv', 'Kyiv\'s', 'Kiev'] },
  { name: 'Florence, Italy', latitude: 43.7696, longitude: 11.2558, precision: 'city', terms: ['Florence'] },
  { name: 'Monaco', latitude: 43.7384, longitude: 7.4246, precision: 'country', terms: ['Monaco'] },
  { name: 'South Africa', latitude: -29.0, longitude: 24.0, precision: 'country', terms: ['South Africa', 'South African'] },
  { name: 'United States', latitude: 39.8283, longitude: -98.5795, precision: 'country', terms: ['United States', 'U.S.', 'US'] },
  { name: 'Saudi Arabia', latitude: 23.8859, longitude: 45.0792, precision: 'country', terms: ['Saudi Arabia', 'Saudi'] },
  { name: 'Ukraine', latitude: 48.3794, longitude: 31.1656, precision: 'country', terms: ['Ukraine', 'Ukrainian'] },
  { name: 'Italy', latitude: 41.8719, longitude: 12.5674, precision: 'country', terms: ['Italy', 'Italian'] },
  { name: 'Yemen', latitude: 15.5527, longitude: 48.5164, precision: 'country', terms: ['Yemen', 'Yemeni'] },
  { name: 'Russia', latitude: 61.524, longitude: 105.3188, precision: 'country', terms: ['Russia', 'Russian'] },
  { name: 'Israel', latitude: 31.0461, longitude: 34.8516, precision: 'country', terms: ['Israel', 'Israeli'] },
  { name: 'Gaza', latitude: 31.5, longitude: 34.4667, precision: 'country', terms: ['Gaza'] },
  { name: 'Iran', latitude: 32.4279, longitude: 53.688, precision: 'country', terms: ['Iran', 'Iranian'] },
  { name: 'China', latitude: 35.8617, longitude: 104.1954, precision: 'country', terms: ['China', 'Chinese'] },
  { name: 'Taiwan', latitude: 23.6978, longitude: 120.9605, precision: 'country', terms: ['Taiwan', 'Taiwanese'] },
  { name: 'Japan', latitude: 36.2048, longitude: 138.2529, precision: 'country', terms: ['Japan', 'Japanese'] },
  { name: 'India', latitude: 20.5937, longitude: 78.9629, precision: 'country', terms: ['India', 'Indian'] },
  { name: 'Pakistan', latitude: 30.3753, longitude: 69.3451, precision: 'country', terms: ['Pakistan', 'Pakistani'] },
  { name: 'Afghanistan', latitude: 33.9391, longitude: 67.71, precision: 'country', terms: ['Afghanistan', 'Afghan'] },
  { name: 'Myanmar', latitude: 21.9162, longitude: 95.956, precision: 'country', terms: ['Myanmar'] },
  { name: 'Thailand', latitude: 15.87, longitude: 100.9925, precision: 'country', terms: ['Thailand', 'Thai'] },
  { name: 'Indonesia', latitude: -0.7893, longitude: 113.9213, precision: 'country', terms: ['Indonesia', 'Indonesian'] },
  { name: 'Philippines', latitude: 12.8797, longitude: 121.774, precision: 'country', terms: ['Philippines', 'Filipino'] },
  { name: 'Australia', latitude: -25.2744, longitude: 133.7751, precision: 'country', terms: ['Australia', 'Australian'] },
  { name: 'New Zealand', latitude: -40.9006, longitude: 174.886, precision: 'country', terms: ['New Zealand'] },
  { name: 'Sudan', latitude: 12.8628, longitude: 30.2176, precision: 'country', terms: ['Sudan', 'Sudanese'] },
  { name: 'Democratic Republic of the Congo', latitude: -2.5, longitude: 23.5, precision: 'country', terms: ['Democratic Republic of the Congo', 'DR Congo'] },
  { name: 'Ethiopia', latitude: 9.145, longitude: 40.4897, precision: 'country', terms: ['Ethiopia', 'Ethiopian'] },
  { name: 'Nigeria', latitude: 9.082, longitude: 8.6753, precision: 'country', terms: ['Nigeria', 'Nigerian'] },
  { name: 'Kenya', latitude: -0.0236, longitude: 37.9062, precision: 'country', terms: ['Kenya', 'Kenyan'] },
  { name: 'Brazil', latitude: -14.235, longitude: -51.9253, precision: 'country', terms: ['Brazil', 'Brazilian'] },
  { name: 'Mexico', latitude: 23.6345, longitude: -102.5528, precision: 'country', terms: ['Mexico', 'Mexican'] },
  { name: 'Haiti', latitude: 18.9712, longitude: -72.2852, precision: 'country', terms: ['Haiti', 'Haitian'] },
  { name: 'Cuba', latitude: 21.5218, longitude: -77.7812, precision: 'country', terms: ['Cuba', 'Cuban'] },
  { name: 'Colombia', latitude: 4.5709, longitude: -74.2973, precision: 'country', terms: ['Colombia', 'Colombian'] },
  { name: 'Venezuela', latitude: 6.4238, longitude: -66.5897, precision: 'country', terms: ['Venezuela', 'Venezuelan'] },
  { name: 'Argentina', latitude: -38.4161, longitude: -63.6167, precision: 'country', terms: ['Argentina', 'Argentine'] },
  { name: 'Canada', latitude: 56.1304, longitude: -106.3468, precision: 'country', terms: ['Canada', 'Canadian'] },
  { name: 'United Kingdom', latitude: 55.3781, longitude: -3.436, precision: 'country', terms: ['United Kingdom', 'Britain', 'British'] },
  { name: 'France', latitude: 46.2276, longitude: 2.2137, precision: 'country', terms: ['France', 'French'] },
  { name: 'Germany', latitude: 51.1657, longitude: 10.4515, precision: 'country', terms: ['Germany', 'German'] },
  { name: 'Poland', latitude: 51.9194, longitude: 19.1451, precision: 'country', terms: ['Poland', 'Polish'] },
  { name: 'Turkey', latitude: 38.9637, longitude: 35.2433, precision: 'country', terms: ['Turkey', 'Turkish'] },
  { name: 'Syria', latitude: 34.8021, longitude: 38.9968, precision: 'country', terms: ['Syria', 'Syrian'] },
  { name: 'Lebanon', latitude: 33.8547, longitude: 35.8623, precision: 'country', terms: ['Lebanon', 'Lebanese'] },
  { name: 'North Korea', latitude: 40.3399, longitude: 127.5101, precision: 'country', terms: ['North Korea', 'North Korean'] },
  { name: 'South Korea', latitude: 35.9078, longitude: 127.7669, precision: 'country', terms: ['South Korea', 'South Korean'] },
]

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findHeadlineLocation(text) {
  const matches = headlineLocations.flatMap((location) => location.terms
    .filter((term) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}([^\\p{L}\\p{N}]|$)`, 'iu').test(text))
    .map((term) => ({ location, term })))
  matches.sort((first, second) => (
    Number(second.location.precision === 'city') - Number(first.location.precision === 'city')
    || second.term.length - first.term.length
  ))
  const match = matches[0]
  return match ? { ...match.location, matchedTerm: match.term } : null
}

function cleanText(value) {
  const document = new DOMParser().parseFromString(value ?? '', 'text/html')
  return document.body.textContent.replace(/\s+/g, ' ').trim()
}

function getSafeBbcStoryUrl(value) {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !['www.bbc.co.uk', 'www.bbc.com'].includes(url.hostname.toLowerCase()) || url.username || url.password) return ''
    return url.href
  } catch {
    return ''
  }
}

function getSafeBbcImageUrl(value) {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    const isBbcImageHost = host === 'bbci.co.uk' || host.endsWith('.bbci.co.uk')
      || host === 'bbc.co.uk' || host.endsWith('.bbc.co.uk')
    if (url.protocol !== 'https:' || !isBbcImageHost || url.pathname === '/' || url.username || url.password) return ''
    return url.href
  } catch {
    return ''
  }
}

function collectImageUrls(value) {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return [
    value.url,
    value.src,
    value.href,
    value.$?.url,
    value.$?.src,
    value.$?.href,
  ].flatMap((candidate) => typeof candidate === 'string' ? [candidate] : [])
}

function getDescriptionImageSources(html) {
  const tag = String(html ?? '').match(/<img\b[^>]*>/i)?.[0] ?? ''
  return [...tag.matchAll(/\b(?:src|data-src|data-original)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+))/gi)]
    .map((match) => match[1] ?? match[2] ?? match[3] ?? '')
}

function getNewsImageUrls(item) {
  const candidates = [
    ...collectImageUrls(item?.thumbnail),
    ...collectImageUrls(item?.['media:thumbnail']),
    ...collectImageUrls(item?.['media:content']),
    ...collectImageUrls(item?.enclosure),
    ...collectImageUrls(item?.image),
    ...getDescriptionImageSources(item?.description),
  ]
  return [...new Set(candidates
    .map((candidate) => getSafeBbcImageUrl(candidate))
    .filter(Boolean))]
}

function isValidNewsCache(cache) {
  return Number.isFinite(cache?.updatedAt)
    && Array.isArray(cache.articles)
    && cache.articles.every((article) => (
      typeof article.id === 'string'
      && typeof article.title === 'string'
      && typeof article.summary === 'string'
      && getSafeBbcStoryUrl(article.url) === article.url
      && (!article.imageUrl || getSafeBbcImageUrl(article.imageUrl) === article.imageUrl)
      && (!article.imageUrls || (Array.isArray(article.imageUrls) && article.imageUrls.every((url) => getSafeBbcImageUrl(url) === url)))
      && Number.isFinite(article.publishedAt)
      && article.publishedAt <= Date.now() + 60 * 60 * 1000
      && article.publishedAt >= Date.now() - NEWS_WINDOW_MS
      && (!article.location || (
        typeof article.location.name === 'string'
        && Number.isFinite(article.location.latitude)
        && article.location.latitude >= -90
        && article.location.latitude <= 90
        && Number.isFinite(article.location.longitude)
        && article.location.longitude >= -180
        && article.location.longitude <= 180
      ))
    ))
}

export function loadCachedGlobalNews() {
  const cache = readJsonCache(CACHE_KEY, isValidNewsCache)
  return cache ? { ...cache, stale: true } : null
}

export function normalizeGlobalNewsItems(items, { now = Date.now(), textCleaner = cleanText } = {}) {
  if (!Array.isArray(items)) throw new Error('The BBC World news feed returned invalid data.')
  const articles = items.flatMap((item) => {
    const title = textCleaner(item?.title)
    const summary = textCleaner(item?.description)
    const link = getSafeBbcStoryUrl(item?.link)
    const rawPublishedAt = item?.pubDate
    const explicitTimezone = typeof rawPublishedAt === 'string' && /(?:Z|GMT|UTC|[+-]\d{2}:?\d{2})$/i.test(rawPublishedAt.trim())
    const publishedAt = explicitTimezone
      ? Date.parse(rawPublishedAt)
      : new Date(`${rawPublishedAt} UTC`).getTime()
    if (
      !title
      || !link
      || !Number.isFinite(publishedAt)
      || publishedAt > now + 60 * 60 * 1000
      || publishedAt < now - NEWS_WINDOW_MS
    ) return []

    const titleLocation = findHeadlineLocation(title)
    const location = titleLocation || findHeadlineLocation(summary)
    return [{
      id: link,
      title,
      summary,
      imageUrls: getNewsImageUrls(item),
      imageUrl: getNewsImageUrls(item)[0] || '',
      url: link,
      publishedAt,
      location,
      locationBasis: location ? (titleLocation ? 'headline' : 'summary') : null,
    }]
  }).sort((first, second) => second.publishedAt - first.publishedAt)

  return articles.slice(0, MAX_NEWS_ITEMS)
}

function parseRssXml(xmlText, parser = new DOMParser()) {
  const document = parser.parseFromString(xmlText, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error('BBC World RSS returned invalid XML.')
  const items = [...document.querySelectorAll('item')].map((item) => {
    const value = (name) => item.getElementsByTagName(name)[0]?.textContent?.trim() || ''
    const thumbnail = item.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url')
      || item.getElementsByTagName('enclosure')[0]?.getAttribute('url')
      || ''
    return {
      title: value('title'),
      description: value('description'),
      link: value('link'),
      pubDate: value('pubDate'),
      thumbnail,
    }
  })
  if (!items.length) throw new Error('BBC World RSS returned no readable articles.')
  return items
}

async function fetchWithTimeout(fetchImpl, url, { responseType = 'json', timeoutMs = 12000 } = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: responseType === 'json' ? 'application/json' : 'application/rss+xml, application/xml, text/xml' },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`News provider returned HTTP ${response.status}.`)
    return responseType === 'json' ? await response.json() : await response.text()
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function loadGlobalNews({ fetchImpl = fetch, now = Date.now(), xmlParser, textCleaner = cleanText } = {}) {
  const attempts = [
    async () => {
      const url = `${RSS_CONVERTER}?rss_url=${encodeURIComponent(BBC_WORLD_FEED)}&refresh=${now}`
      const feed = await fetchWithTimeout(fetchImpl, url)
      if (feed?.status !== 'ok' || !Array.isArray(feed?.items)) {
        throw new Error(feed?.message || 'RSS-to-JSON converter returned invalid data.')
      }
      return { items: feed.items, source: feed.feed?.title || 'BBC News (RSS-to-JSON)' }
    },
    async () => {
      const xml = await fetchWithTimeout(fetchImpl, `${RSS_PROXY}${encodeURIComponent(BBC_WORLD_FEED)}&refresh=${now}`, { responseType: 'text' })
      return { items: parseRssXml(xml, xmlParser), source: 'BBC News World (AllOrigins RSS fallback)' }
    },
    async () => {
      const xml = await fetchWithTimeout(fetchImpl, `https://proxy.cors.dev/${BBC_WORLD_FEED}?refresh=${now}`, { responseType: 'text' })
      return { items: parseRssXml(xml, xmlParser), source: 'BBC News World (CORS proxy fallback)' }
    },
  ]

  const errors = []
  for (const attempt of attempts) {
    try {
      const feed = await attempt()
      const articles = normalizeGlobalNewsItems(feed.items, { now, textCleaner })
      if (!articles.length) throw new Error('The news source returned no recent, valid headlines.')
      const result = { articles, updatedAt: now, source: feed.source, stale: false }
      writeJsonCache(CACHE_KEY, result)
      return result
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown feed error.')
    }
  }

  throw new Error(`All news refresh routes failed. ${errors.join(' ')} The last successful cached headlines, if any, remain available.`)
}

export const globalNewsInfo = {
  name: 'BBC World (via rss2json converter)',
  source: 'https://www.bbc.co.uk/news/world',
  converter: RSS_CONVERTER,
  refreshMinutes: NEWS_REFRESH_MINUTES,
}
