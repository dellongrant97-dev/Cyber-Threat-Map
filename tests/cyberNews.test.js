import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCyberNewsItems } from '../src/cyberNews.js'

const now = Date.parse('2026-10-19T12:00:00Z')
const clean = (value = '') => value.replace(/<[^>]*>/g, '').trim()
const item = (title, pubDate, overrides = {}) => ({
  title, description: '<p>Official cybersecurity advisory</p>',
  link: 'https://www.cisa.gov/news-events/cybersecurity-advisories/example',
  pubDate, ...overrides,
})

test('normalizes current CISA advisories and sorts newest first', () => {
  const result = normalizeCyberNewsItems([
    item('Older advisory', '2026-10-18T09:00:00Z'),
    item('Newer advisory', '2026-10-19T10:00:00Z'),
  ], { now, textCleaner: clean })
  assert.equal(result.length, 2)
  assert.equal(result[0].title, 'Newer advisory')
  assert.equal(result[0].url, 'https://www.cisa.gov/news-events/cybersecurity-advisories/example')
})

test('rejects untrusted links, invalid dates, future items, and stale items', () => {
  const result = normalizeCyberNewsItems([
    item('Allowed', '2026-10-19T11:00:00Z'),
    item('Lookalike domain', '2026-10-19T11:00:00Z', { link: 'https://cisa.gov.attacker.example/story' }),
    item('HTTP', '2026-10-19T11:00:00Z', { link: 'http://www.cisa.gov/story' }),
    item('Invalid date', 'not a date'),
    item('Future', '2026-10-19T15:00:00Z'),
    item('Old', '2026-08-01T12:00:00Z'),
  ], { now, textCleaner: clean })
  assert.deepEqual(result.map((entry) => entry.title), ['Allowed'])
})

test('accepts only trusted image hosts', () => {
  const result = normalizeCyberNewsItems([
    item('Image advisory', '2026-10-19T11:00:00Z', {
      thumbnail: 'https://www.cisa.gov/sites/default/files/styles/image.jpg',
      enclosure: { url: 'https://attacker.example/evil.jpg' },
    }),
  ], { now, textCleaner: clean })
  assert.equal(result[0].imageUrl, 'https://www.cisa.gov/sites/default/files/styles/image.jpg')
})

test('rejects malformed feed data', () => {
  assert.throws(() => normalizeCyberNewsItems(null), /invalid data/)
})
