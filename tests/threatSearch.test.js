import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findDomainReports,
  findIpReputation,
  loadOpenPhishFeed,
  parseOpenPhishFeed,
  serializeThreatLookup,
  validateThreatLookupInput,
} from '../src/threatSearch.js'

test('validates IPv4, domains, and safe optional web URLs', () => {
  assert.deepEqual(validateThreatLookupInput('203.0.113.4'), {
    valid: true, type: 'ip', value: '203.0.113.4', error: '',
  })
  assert.equal(validateThreatLookupInput(' Example.COM ').value, 'example.com')
  assert.equal(validateThreatLookupInput('https://sub.example.com/path?q=1').value, 'sub.example.com')
  assert.equal(validateThreatLookupInput('http://example.com:8080/path').valid, false)
  assert.equal(validateThreatLookupInput('javascript:alert(1)').valid, false)
  assert.equal(validateThreatLookupInput('https://user:pass@example.com').valid, false)
  assert.equal(validateThreatLookupInput('localhost').valid, false)
  assert.equal(validateThreatLookupInput('256.1.1.1').valid, false)
  assert.equal(validateThreatLookupInput('2001:db8::1').valid, false)
})

test('matches IP reputation only to the exact IPsum indicator and keeps feed times distinct', () => {
  const result = findIpReputation('203.0.113.4', {
    indicators: [{ ip: '203.0.113.4', consensus: 6 }],
    publishedAt: '2026-10-10T10:00:00.000Z',
    retrievedAt: '2026-10-10T11:00:00.000Z',
  })
  assert.equal(result.found, true)
  assert.equal(result.consensus, 6)
  assert.equal(result.publishedAt, '2026-10-10T10:00:00.000Z')
  assert.equal(result.checkedAt, '2026-10-10T11:00:00.000Z')
  assert.equal(result.observationTimeAvailable, false)
  assert.equal(findIpReputation('203.0.113.5', { indicators: [] }).found, false)
  assert.throws(() => findIpReputation('not-an-ip', {}), TypeError)
})

test('parses only valid HTTP(S) phishing report URLs', () => {
  assert.deepEqual(parseOpenPhishFeed([
    'https://phish.example/signin',
    'https://phish.example/signin',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'https://localhost/login',
    'not a url',
  ].join('\n')), ['https://phish.example/signin'])
  assert.throws(() => parseOpenPhishFeed('javascript:alert(1)'), /valid phishing URL indicators/)
})

test('matches exact domains and their subdomains but not suffix lookalikes', () => {
  const result = findDomainReports('example.com', {
    urls: [
      'https://example.com/login',
      'http://login.example.com/session',
      'https://notexample.com/',
      'https://example.com.evil.test/',
    ],
    retrievedAt: '2026-10-10T11:00:00.000Z',
  })
  assert.deepEqual(result.matches, ['https://example.com/login', 'http://login.example.com/session'])
  assert.equal(result.individualReportTimesAvailable, false)
  assert.equal(result.retrievedAt, '2026-10-10T11:00:00.000Z')
  assert.throws(() => findDomainReports('localhost', {}), TypeError)
})

test('exports bounded findings as JSON and formula-safe CSV', () => {
  const result = {
    query: 'example.com',
    type: 'domain',
    data: {
      source: 'OpenPhish Community Feed',
      sourceUrl: 'https://openphish.com/',
      retrievedAt: '2026-10-10T11:00:00.000Z',
      matches: ['https://example.com/login', '=HYPERLINK("https://evil.test")'],
    },
  }
  const json = serializeThreatLookup(result)
  const parsed = JSON.parse(json.content)
  assert.equal(json.extension, 'json')
  assert.equal(parsed.matches.length, 2)
  assert.equal(parsed.retrievedAt, '2026-10-10T11:00:00.000Z')
  assert.match(parsed.limitations, /At most 20/)
  const csv = serializeThreatLookup(result, 'csv')
  assert.equal(csv.extension, 'csv')
  assert.match(csv.content, /'=HYPERLINK/)
  assert.throws(() => serializeThreatLookup(null), TypeError)
  assert.throws(() => serializeThreatLookup(result, 'xml'), TypeError)
})

test('uses a recent cached domain feed without making another request', async () => {
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  const values = new Map([['sentinel-openphish-search-v1', JSON.stringify({
    urls: ['https://phish.example/login'],
    retrievedAt: '2026-10-10T11:50:00.000Z',
  })]])
  let fetched = false
  globalThis.window = { setTimeout: () => 1, clearTimeout: () => {}, localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } }
  globalThis.fetch = async () => { fetched = true; throw new Error('should not fetch') }

  try {
    const result = await loadOpenPhishFeed({ now: Date.parse('2026-10-10T12:00:00.000Z') })
    assert.equal(result.stale, false)
    assert.equal(result.urls.length, 1)
    assert.equal(fetched, false)
  } finally {
    globalThis.fetch = previousFetch
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

test('retrieves and caches the public feed with a dashboard retrieval timestamp', async () => {
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  const values = new Map()
  globalThis.window = { setTimeout: () => 1, clearTimeout: () => {}, localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } }
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => 'https://phish.example/login\nhttps://sub.phish.example/account',
  })

  try {
    const result = await loadOpenPhishFeed({ now: Date.parse('2026-10-10T12:00:00.000Z'), force: true })
    assert.equal(result.stale, false)
    assert.equal(result.retrievedAt, '2026-10-10T12:00:00.000Z')
    assert.equal(result.urls.length, 2)
    assert.equal(JSON.parse(values.get('sentinel-openphish-search-v1')).retrievedAt, result.retrievedAt)
  } finally {
    globalThis.fetch = previousFetch
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

test('falls back to stale cached results with an explicit source failure', async () => {
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  const values = new Map([['sentinel-openphish-search-v1', JSON.stringify({
    urls: ['https://phish.example/login'],
    retrievedAt: '2026-10-10T10:00:00.000Z',
  })]])
  globalThis.window = { setTimeout: () => 1, clearTimeout: () => {}, localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } }
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }

  try {
    const result = await loadOpenPhishFeed({ now: Date.parse('2026-10-10T12:00:00.000Z') })
    assert.equal(result.stale, true)
    assert.match(result.error, /Failed to fetch/)
  } finally {
    globalThis.fetch = previousFetch
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})
