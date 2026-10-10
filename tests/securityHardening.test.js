import test from 'node:test'
import assert from 'node:assert/strict'
import { logClientError } from '../src/clientLog.js'
import { addProductionSecurityMeta, CONTENT_SECURITY_POLICY } from '../src/securityPolicy.js'
import { findSecretMatches } from '../scripts/secret-scan.mjs'

test('production CSP allows only app and required providers without unsafe script execution', () => {
  for (const directive of [
    "default-src 'self'",
    "script-src 'self'",
    "script-src-attr 'none'",
    "style-src-attr 'unsafe-inline'",
    "style-src-elem 'self' https://fonts.googleapis.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-src 'none'",
    "worker-src 'none'",
    'https://api.github.com',
    'https://raw.githubusercontent.com',
    'https://ipapi.co',
    'https://earthquake.usgs.gov',
    'https://api.rss2json.com',
    'https://services.nvd.nist.gov',
  ]) {
    assert.ok(CONTENT_SECURITY_POLICY.includes(directive), `CSP should include ${directive}`)
  }
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /unsafe-eval|https?:\s*\*|style-src 'self' 'unsafe-inline'/)
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /\bdata:/)
  const securedHtml = addProductionSecurityMeta('<html><head><script src="/app.js"></script></head></html>')
  assert.ok(securedHtml.indexOf('Content-Security-Policy') < securedHtml.indexOf('<script'))
})

test('report-only build omits the enforcing meta policy for header-based preview testing', () => {
  const html = '<html><head><script src="/app.js"></script></head></html>'
  assert.equal(addProductionSecurityMeta(html, { reportOnly: true }), html)
})

test('secret scanning detects supported tokens without returning their values', () => {
  const token = `ghp_${'A'.repeat(40)}`
  const matches = findSecretMatches(`safe line\nGITHUB_TOKEN=${token}`)
  assert.deepEqual(matches, [{ rule: 'github-token', line: 2 }])
  assert.equal(JSON.stringify(matches).includes(token), false)
})

test('secret scanning detects credential assignments but ignores obvious placeholders', () => {
  const matches = findSecretMatches([
    `api_key="${'x'.repeat(24)}"`,
    'client_secret="replace-me"',
    'password = "example-only"',
  ].join('\n'))
  assert.deepEqual(matches, [{ rule: 'credential-assignment', line: 1 }])
})

test('client logs omit exception messages, stacks, and invalid event data', () => {
  const originalError = console.error
  const originalWarn = console.warn
  const messages = []
  console.error = (message) => messages.push(message)
  console.warn = (message) => messages.push(message)
  try {
    const error = new Error('sensitive query value and private endpoint')
    error.stack = 'secret stack contents'
    logClientError('feed_refresh_failed', error)
    logClientError('private query value', error, 'warn')
  } finally {
    console.error = originalError
    console.warn = originalWarn
  }

  assert.equal(messages.length, 2)
  assert.match(messages[0], /feed_refresh_failed \(Error\)/)
  assert.match(messages[1], /client_error \(Error\)/)
  assert.doesNotMatch(messages.join(' '), /sensitive query|private endpoint|secret stack/)
})
