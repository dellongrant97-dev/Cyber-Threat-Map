import test from 'node:test'
import assert from 'node:assert/strict'
import { loadGlobalNews, normalizeGlobalNewsItems } from '../src/globalNews.js'

const now = Date.parse('2026-10-10T12:00:00Z')
const clean = (value = '') => value.replace(/<[^>]*>/g, '').trim()
const item = (title, pubDate, overrides = {}) => ({
  title,
  description: '<p>Background summary</p>',
  link: 'https://www.bbc.co.uk/news/articles/test',
  pubDate,
  ...overrides,
})

test('normalizeGlobalNewsItems prefers specific headline matches and falls back to summary', () => {
  const articles = normalizeGlobalNewsItems([
    item('Riyadh update', '2026-10-10T11:00:00Z'),
    item('Storm update', '2026-10-10T10:00:00Z', { description: '<p>Storm makes landfall in Italy.</p>' }),
    item('World update', '2026-10-10T09:00:00Z'),
  ], { now, textCleaner: clean })

  assert.equal(articles[0].location.name, 'Riyadh, Saudi Arabia')
  assert.equal(articles[0].location.precision, 'city')
  assert.equal(articles[0].locationBasis, 'headline')
  assert.equal(articles[1].location.name, 'Italy')
  assert.equal(articles[1].locationBasis, 'summary')
  assert.equal(articles[2].location, null)
  assert.equal(articles[2].locationBasis, null)
})

test('normalizeGlobalNewsItems filters unsafe links, invalid dates, future items, and old items', () => {
  const articles = normalizeGlobalNewsItems([
    item('Allowed BBC article', '2026-10-10T11:00:00Z'),
    item('External link', '2026-10-10T11:00:00Z', { link: 'https://www.bbc.co.uk.attacker.example/story' }),
    item('Malformed date', 'not a date'),
    item('Too far in the future', '2026-10-10T14:00:00Z'),
    item('Outside recency window', '2026-10-07T11:00:00Z'),
    null,
  ], { now, textCleaner: clean })

  assert.deepEqual(articles.map((article) => article.title), ['Allowed BBC article'])
})

test('normalizeGlobalNewsItems rejects credentialed and lookalike BBC links', () => {
  const now = Date.parse('2026-10-10T12:00:00.000Z')
  const articles = normalizeGlobalNewsItems([
    item('Credentialed URL', '2026-10-10T11:00:00Z', { link: 'https://www.bbc.co.uk@attacker.example/story' }),
    item('Lookalike host', '2026-10-10T11:00:00Z', { link: 'https://www.bbc.co.uk.attacker.example/story' }),
    item('HTTP link', '2026-10-10T11:00:00Z', { link: 'http://www.bbc.co.uk/story' }),
    item('Valid BBC link', '2026-10-10T11:00:00Z', { link: 'https://www.bbc.co.uk/story' }),
  ], { now, textCleaner: (value) => value })
  assert.deepEqual(articles.map((article) => article.url), ['https://www.bbc.co.uk/story'])
})


test('normalizeGlobalNewsItems selects actual BBC image URLs, not article links', () => {
  const articles = normalizeGlobalNewsItems([
    item('Picture story in Canada', '2026-10-10T11:00:00Z', {
      enclosure: { link: 'https://www.bbc.co.uk/news/articles/story', url: 'https://ichef.bbci.co.uk/news/1024/cpsprodpb/example.jpg' },
      'media:thumbnail': { $: { url: 'https://ichef.bbci.co.uk/news/640/cpsprodpb/thumb.webp' } },
    }),
  ], { now, textCleaner: clean })

  assert.equal(articles[0].imageUrl, 'https://ichef.bbci.co.uk/news/640/cpsprodpb/thumb.webp')
})

test('normalizeGlobalNewsItems limits results and rejects malformed feed data', () => {
  const items = Array.from({ length: 35 }, (_, index) => (
    item(`Story ${index}`, new Date(now - index * 60_000).toISOString())
  ))

  assert.equal(normalizeGlobalNewsItems(items, { now, textCleaner: clean }).length, 30)
  assert.throws(() => normalizeGlobalNewsItems(null), /invalid data/)
})


test('loadGlobalNews falls back to the RSS proxy when the JSON converter fails', async () => {
  const previousWindow = globalThis.window
  const calls = []
  const fallbackNow = Date.parse('2026-10-22T12:00:00Z')
  const values = {
    title: 'Fresh BBC World headline about Kenya',
    description: '<p>Latest report from Kenya.</p>',
    link: 'https://www.bbc.co.uk/news/articles/fresh-test',
    pubDate: new Date(fallbackNow - 60_000).toISOString(),
  }
  const rssItem = {
    getElementsByTagName(name) {
      if (name === 'media:thumbnail' || name === 'enclosure') return []
      return [{ textContent: values[name] || '', getAttribute: () => '' }]
    },
  }
  const xmlParser = {
    parseFromString() {
      return {
        querySelector: () => null,
        querySelectorAll: () => [rssItem],
      }
    },
  }

  globalThis.window = {
    setTimeout,
    clearTimeout,
    localStorage: { setItem() {} },
  }

  try {
    const result = await loadGlobalNews({
      now: fallbackNow,
      xmlParser,
      textCleaner: (value = '') => value.replace(/<[^>]*>/g, '').trim(),
      fetchImpl: async (url) => {
        calls.push(url)
        if (calls.length === 1) return { ok: false, status: 503 }
        return { ok: true, text: async () => '<rss><channel><item /></channel></rss>' }
      },
    })

    assert.equal(calls.length, 2)
    assert.match(calls[0], /api\.rss2json\.com/)
    assert.match(calls[1], /api\.allorigins\.win/)
    assert.equal(result.stale, false)
    assert.equal(result.updatedAt, fallbackNow)
    assert.equal(result.source, 'BBC News World (AllOrigins RSS fallback)')
    assert.equal(result.articles[0].title, values.title)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})


test('loadGlobalNews tries the third CORS proxy when both earlier routes fail', async () => {
  const previousWindow = globalThis.window
  const calls = []
  const fallbackNow = Date.parse('2026-10-22T12:00:00Z')
  const values = {
    title: 'Third-route fresh BBC World headline',
    description: '<p>Latest report from Kenya.</p>',
    link: 'https://www.bbc.co.uk/news/articles/third-route-test',
    pubDate: new Date(fallbackNow - 60_000).toISOString(),
  }
  const rssItem = {
    getElementsByTagName(name) {
      if (name === 'media:thumbnail' || name === 'enclosure') return []
      return [{ textContent: values[name] || '', getAttribute: () => '' }]
    },
  }
  const xmlParser = {
    parseFromString() {
      return {
        querySelector: () => null,
        querySelectorAll: () => [rssItem],
      }
    },
  }

  globalThis.window = {
    setTimeout,
    clearTimeout,
    localStorage: { setItem() {} },
  }

  try {
    const result = await loadGlobalNews({
      now: fallbackNow,
      xmlParser,
      textCleaner: (value = '') => value.replace(/<[^>]*>/g, '').trim(),
      fetchImpl: async (url) => {
        calls.push(url)
        if (calls.length < 3) return { ok: false, status: 503 }
        return { ok: true, text: async () => '<rss><channel><item /></channel></rss>' }
      },
    })

    assert.equal(calls.length, 3)
    assert.ok(calls[0].includes('api.rss2json.com'))
    assert.ok(calls[1].includes('api.allorigins.win'))
    assert.ok(calls[2].includes('proxy.cors.dev'))
    assert.equal(result.stale, false)
    assert.equal(result.updatedAt, fallbackNow)
    assert.equal(result.source, 'BBC News World (CORS proxy fallback)')
    assert.equal(result.articles[0].title, values.title)
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})
