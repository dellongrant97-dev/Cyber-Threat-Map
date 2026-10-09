const BBC_WORLD_FEED = 'https://feeds.bbci.co.uk/news/world/rss.xml'
const RSS_CONVERTER = 'https://api.rss2json.com/v1/api.json'
const NEWS_REFRESH_MINUTES = 15
const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000
const MAX_NEWS_ITEMS = 30

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

export async function loadGlobalNews() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20000)
  const url = `${RSS_CONVERTER}?rss_url=${encodeURIComponent(BBC_WORLD_FEED)}`

  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`BBC World news feed returned HTTP ${response.status}.`)
    const feed = await response.json()
    if (feed?.status !== 'ok' || !Array.isArray(feed?.items)) {
      throw new Error(feed?.message || 'The BBC World news feed returned invalid data.')
    }

    const now = Date.now()
    const articles = feed.items.flatMap((item) => {
      const title = cleanText(item.title)
      const summary = cleanText(item.description)
      const link = typeof item.link === 'string' ? item.link : ''
      const publishedAt = new Date(`${item.pubDate} UTC`).getTime()
      if (
        !title
        || !link.startsWith('https://www.bbc.co.uk/')
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
        url: link,
        publishedAt,
        location,
        locationBasis: location ? (titleLocation ? 'headline' : 'summary') : null,
      }]
    }).sort((first, second) => second.publishedAt - first.publishedAt)

    return {
      articles: articles.slice(0, MAX_NEWS_ITEMS),
      updatedAt: Date.now(),
      source: feed.feed?.title || 'BBC News',
    }
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The world news feed request timed out. Please retry.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export const globalNewsInfo = {
  source: 'https://www.bbc.co.uk/news/world',
  refreshMinutes: NEWS_REFRESH_MINUTES,
}
