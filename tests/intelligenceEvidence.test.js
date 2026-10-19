import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyEvidenceAge, describeIndicatorEvidence } from '../src/intelligenceEvidence.js'

const NOW = Date.parse('2026-01-08T12:00:00Z')

test('classifies evidence timestamps by age without calling age a confidence score', () => {
  assert.deepEqual(classifyEvidenceAge(NOW - 60_000, NOW), { key: 'fresh', label: 'Within 24 hours' })
  assert.deepEqual(classifyEvidenceAge(NOW - 2 * 24 * 60 * 60 * 1000, NOW), { key: 'recent', label: '1–7 days old' })
  assert.deepEqual(classifyEvidenceAge(NOW - 8 * 24 * 60 * 60 * 1000, NOW), { key: 'older', label: 'Over 7 days old' })
})

test('handles missing and future timestamps conservatively', () => {
  assert.deepEqual(classifyEvidenceAge(null, NOW), { key: 'unknown', label: 'Age unknown' })
  assert.deepEqual(classifyEvidenceAge(NOW + 1000, NOW), { key: 'unknown', label: 'Timestamp in future' })
})

test('describes list agreement as a signal, not proof of an attack', () => {
  assert.match(describeIndicatorEvidence(6).meaning, /not independent confirmation/i)
  assert.equal(describeIndicatorEvidence(3).label, '3–5 public source-list matches')
  assert.match(describeIndicatorEvidence(0).meaning, /not a verdict/i)
})
