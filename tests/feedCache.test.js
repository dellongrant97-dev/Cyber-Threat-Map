import test from 'node:test'
import assert from 'node:assert/strict'
import { loadCachedGlobalEvents, loadGlobalEvents } from '../src/globalEvents.js'
import { loadCachedGlobalNews, normalizeGlobalNewsItems } from '../src/globalNews.js'
import { readJsonCache, writeJsonCache } from '../src/localCache.js'

test('feed caches restore validated results and label them stale until refreshed', () => {
  const values = new Map()
  const previousWindow = globalThis.window
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  }

  try {
    const checkedAt = Date.now() - 60_000
    writeJsonCache('sentinel-global-events-v1', {
      updatedAt: checkedAt,
      stale: false,
      events: [{
        id: 'usgs-1',
        magnitude: 5.1,
        occurredAt: checkedAt,
        latitude: 12,
        longitude: -45,
        place: 'Sample location',
      }],
    })
    writeJsonCache('sentinel-global-news-v7', {
      updatedAt: checkedAt,
      stale: false,
      articles: [{
        id: 'https://www.bbc.co.uk/news/articles/example',
        sourceId: 'bbc',
        sourceName: 'BBC News',
        title: 'Sample headline',
        summary: 'Sample summary',
        url: 'https://www.bbc.co.uk/news/articles/example',
        publishedAt: checkedAt,
        location: null,
      }],
    })

    assert.equal(loadCachedGlobalEvents().stale, true)
    assert.equal(loadCachedGlobalEvents().events[0].id, 'usgs-1')
    assert.equal(loadCachedGlobalNews().stale, true)
    assert.equal(loadCachedGlobalNews().articles[0].title, 'Sample headline')

    values.set('invalid', '{')
    const previousWarn = console.warn
    console.warn = () => {}
    try {
      assert.equal(readJsonCache('invalid', () => true), null)
      assert.equal(readJsonCache('missing', () => true), null)
    } finally {
      console.warn = previousWarn
    }
  } finally {
    globalThis.window = previousWindow
  }
})

test('global news normalizes only fresh articles from the selected publisher', () => {
  const now = Date.now()
  const articles = normalizeGlobalNewsItems([
    { title: 'Current world report', description: 'A sample report', link: 'https://www.aljazeera.com/news/sample', pubDate: new Date(now - 60_000).toISOString() },
    { title: 'Expired world report', description: 'An old report', link: 'https://www.aljazeera.com/news/old', pubDate: new Date(now - 49 * 60 * 60 * 1000).toISOString() },
    { title: 'Untrusted link', description: 'Lookalike domain', link: 'https://www.aljazeera.com.fake.example/news/sample', pubDate: new Date(now - 60_000).toISOString() },
  ], { now, textCleaner: (value) => value, sourceId: 'aljazeera' })
  assert.equal(articles.length, 1)
  assert.equal(articles[0].sourceId, 'aljazeera')
  assert.equal(articles[0].sourceName, 'Al Jazeera English')
  assert.equal(articles[0].title, 'Current world report')
})

test('expired global news cache entries are rejected', () => {
  const values = new Map()
  const previousWindow = globalThis.window
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } }
  try {
    const now = Date.now()
    writeJsonCache('sentinel-global-news-v7', {
      updatedAt: now,
      articles: [{
        id: 'https://www.bbc.co.uk/news/articles/expired',
        sourceId: 'bbc',
        title: 'Expired headline',
        summary: 'Old story',
        url: 'https://www.bbc.co.uk/news/articles/expired',
        publishedAt: now - 49 * 60 * 60 * 1000,
        location: null,
      }],
    })
    assert.equal(loadCachedGlobalNews(), null)
  } finally {
    globalThis.window = previousWindow
  }
})

test('storage failures do not prevent the public feeds from being used', () => {
  const previousWindow = globalThis.window
  const warnings = []
  const previousWarn = console.warn
  globalThis.window = {
    localStorage: {
      getItem() { throw new Error('Storage is disabled') },
      setItem() { throw new Error('Storage is disabled') },
    },
  }
  console.warn = (...args) => warnings.push(args)

  try {
    assert.equal(readJsonCache('blocked', () => true), null)
    writeJsonCache('blocked', {})
    assert.equal(warnings.length, 2)
  } finally {
    globalThis.window = previousWindow
    console.warn = previousWarn
  }
})

test('USGS records dashboard retrieval separately from feed-generation time', async () => {
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  const previousNow = Date.now
  const values = new Map()
  const retrievedAt = 1700000001234
  globalThis.window = {
    setTimeout: () => 1,
    clearTimeout: () => {},
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  }
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ metadata: { generated: 1700000000000 }, features: [] }),
  })
  Date.now = () => retrievedAt

  try {
    const result = await loadGlobalEvents()
    assert.equal(result.updatedAt, 1700000000000)
    assert.equal(result.retrievedAt, retrievedAt)
    assert.equal(JSON.parse(values.get('sentinel-global-events-v1')).retrievedAt, retrievedAt)
  } finally {
    globalThis.window = previousWindow
    globalThis.fetch = previousFetch
    Date.now = previousNow
  }
})
