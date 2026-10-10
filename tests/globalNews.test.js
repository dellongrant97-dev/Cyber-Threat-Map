import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeGlobalNewsItems } from '../src/globalNews.js'

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

test('normalizeGlobalNewsItems limits results and rejects malformed feed data', () => {
  const items = Array.from({ length: 35 }, (_, index) => (
    item(`Story ${index}`, new Date(now - index * 60_000).toISOString())
  ))

  assert.equal(normalizeGlobalNewsItems(items, { now, textCleaner: clean }).length, 30)
  assert.throws(() => normalizeGlobalNewsItems(null), /invalid data/)
})
