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

test('normalizeGlobalNewsItems keeps only trusted source image URLs and supports missing images', () => {
  const articles = normalizeGlobalNewsItems([
    item('BBC image', '2026-10-10T11:00:00Z', {
      thumbnail: 'https://ichef.bbci.co.uk/news/640/example.jpg',
    }),
    item('Enclosure image', '2026-10-10T10:00:00Z', {
      enclosure: { thumbnail: 'https://ichef.bbci.co.uk/news/640/second.jpg' },
    }),
    item('Lookalike image host', '2026-10-10T09:00:00Z', {
      thumbnail: 'https://ichef.bbci.co.uk.attacker.example/image.jpg',
    }),
    item('Credentialed image URL', '2026-10-10T08:00:00Z', {
      thumbnail: 'https://user@ichef.bbci.co.uk/image.jpg',
    }),
    item('Insecure image URL', '2026-10-10T07:00:00Z', {
      thumbnail: 'http://ichef.bbci.co.uk/image.jpg',
    }),
    item('No optional fields', '2026-10-10T06:00:00Z', {
      description: undefined,
      thumbnail: undefined,
    }),
  ], { now, textCleaner: clean })

  assert.deepEqual(articles.map((article) => article.imageUrl), [
    'https://ichef.bbci.co.uk/news/640/example.jpg',
    'https://ichef.bbci.co.uk/news/640/second.jpg',
    '',
    '',
    '',
    '',
  ])
  assert.equal(articles[0].publisher, 'BBC News')
  assert.equal(articles[0].category, 'World news')
  assert.equal(articles[5].summary, '')
  assert.equal(articles[5].location, null)
})

test('normalizeGlobalNewsItems limits results and rejects malformed feed data', () => {
  const items = Array.from({ length: 35 }, (_, index) => (
    item(`Story ${index}`, new Date(now - index * 60_000).toISOString())
  ))

  assert.equal(normalizeGlobalNewsItems(items, { now, textCleaner: clean }).length, 30)
  assert.throws(() => normalizeGlobalNewsItems(null), /invalid data/)
})

test('loadGlobalNews surfaces upstream failures so the dashboard can keep its cached fallback', async () => {
  const originalWindow = globalThis.window
  const originalFetch = globalThis.fetch
  globalThis.window = { setTimeout, clearTimeout }
  globalThis.fetch = async () => { throw new TypeError('network unavailable') }

  try {
    await assert.rejects(loadGlobalNews(), /network unavailable/)
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    globalThis.fetch = originalFetch
  }
})
