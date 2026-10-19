export function classifyEvidenceAge(timestamp, now = Date.now()) {
  const parsed = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp)
  if (!Number.isFinite(parsed) || parsed <= 0) return { key: 'unknown', label: 'Age unknown' }
  const age = now - parsed
  if (age < 0) return { key: 'unknown', label: 'Timestamp in future' }
  if (age <= 24 * 60 * 60 * 1000) return { key: 'fresh', label: 'Within 24 hours' }
  if (age <= 7 * 24 * 60 * 60 * 1000) return { key: 'recent', label: '1–7 days old' }
  return { key: 'older', label: 'Over 7 days old' }
}

export function describeIndicatorEvidence(consensus) {
  if (consensus >= 6) return {
    label: '6+ public source-list matches',
    meaning: 'Broader agreement across the IPsum lists. This is a reputation signal, not independent confirmation of an attack.',
  }
  if (consensus >= 3) return {
    label: '3–5 public source-list matches',
    meaning: 'Several IPsum source lists include this address. Check the original source and context before drawing conclusions.',
  }
  return {
    label: 'Limited source-list evidence',
    meaning: 'The available source-list agreement is limited or unavailable. Treat this as an investigation lead, not a verdict.',
  }
}
