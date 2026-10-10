import test from 'node:test'
import assert from 'node:assert/strict'
import { createIndicators, parseIpList } from '../src/threatIntel.js'

test('parseIpList accepts valid IPv4 addresses, trims whitespace, and removes duplicates', () => {
  const addresses = parseIpList([
    ' 8.8.8.8 ',
    '8.8.8.8',
    '256.1.1.1',
    '2001:db8::1',
    '127.0.0.1',
    '# comment',
    '',
  ].join('\n'))

  assert.deepEqual([...addresses], ['8.8.8.8', '127.0.0.1'])
})

test('createIndicators labels overlap with the stronger source-list tier', () => {
  const threeOrMore = new Set(['8.8.8.8', '1.1.1.1', '9.9.9.9'])
  const sixOrMore = new Set(['8.8.8.8', '9.9.9.9'])

  assert.deepEqual(createIndicators(threeOrMore, sixOrMore), [
    { ip: '8.8.8.8', consensus: 6 },
    { ip: '1.1.1.1', consensus: 3 },
    { ip: '9.9.9.9', consensus: 6 },
  ])
})
