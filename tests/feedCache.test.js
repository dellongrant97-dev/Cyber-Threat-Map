import test from 'node:test'
import assert from 'node:assert/strict'
import { loadCachedGlobalEvents } from '../src/globalEvents.js'
import { loadCachedGlobalNews } from '../src/globalNews.js'
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
    const checkedAt = 1700000000000
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
    writeJsonCache('sentinel-global-news-v1', {
      updatedAt: checkedAt,
      stale: false,
      articles: [{
        id: 'https://www.bbc.co.uk/news/articles/example',
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
