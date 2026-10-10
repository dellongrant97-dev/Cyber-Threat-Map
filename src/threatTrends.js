const VULNERABILITY_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE', 'UNKNOWN']

function isValidSnapshot(entry) {
  return entry
    && typeof entry.id === 'string'
    && Number.isFinite(Date.parse(entry.publishedAt))
    && Number.isFinite(Date.parse(entry.retrievedAt))
    && Number.isInteger(entry.totalCount) && entry.totalCount >= 0
    && Number.isInteger(entry.highCount) && entry.highCount >= 0
    && Number.isInteger(entry.mediumCount) && entry.mediumCount >= 0
    && entry.highCount + entry.mediumCount === entry.totalCount
    && Number.isInteger(entry.newlyListed?.count) && entry.newlyListed.count >= 0
    && Number.isInteger(entry.noLongerListed?.count) && entry.noLongerListed.count >= 0
}

export function buildThreatTrendModel(activity, indicators, locations, vulnerabilities, geoAttempted = 0) {
  const revisionsById = new Map()
  for (const snapshot of Array.isArray(activity) ? activity : []) {
    if (!isValidSnapshot(snapshot)) continue
    const existing = revisionsById.get(snapshot.id)
    if (!existing || Date.parse(snapshot.retrievedAt) > Date.parse(existing.retrievedAt)) {
      revisionsById.set(snapshot.id, snapshot)
    }
  }
  const snapshots = [...revisionsById.values()]
    .sort((first, second) => Date.parse(first.retrievedAt) - Date.parse(second.retrievedAt))
    .map((snapshot, index, all) => {
      const previous = all[index - 1]
      return {
        ...snapshot,
        totalChange: previous ? snapshot.totalCount - previous.totalCount : null,
        highChange: previous ? snapshot.highCount - previous.highCount : null,
      }
    })

  const indicatorByIp = new Map((Array.isArray(indicators) ? indicators : []).map((indicator) => [indicator.ip, indicator]))
  const countryCounts = new Map()
  const seenIps = new Set()
  for (const location of Array.isArray(locations) ? locations : []) {
    const indicator = indicatorByIp.get(location?.ip)
    const country = typeof location?.country === 'string' ? location.country.trim() : ''
    if (!indicator || !country || seenIps.has(location.ip)) continue
    seenIps.add(location.ip)
    const count = countryCounts.get(country) ?? { country, count: 0, highCount: 0 }
    count.count += 1
    if (indicator.consensus >= 6) count.highCount += 1
    countryCounts.set(country, count)
  }
  const countries = [...countryCounts.values()].sort((first, second) => (
    second.count - first.count || first.country.localeCompare(second.country)
  ))

  const severityCounts = new Map(VULNERABILITY_SEVERITIES.map((severity) => [severity, 0]))
  for (const vulnerability of Array.isArray(vulnerabilities) ? vulnerabilities : []) {
    const severity = VULNERABILITY_SEVERITIES.includes(vulnerability?.metrics?.severity)
      ? vulnerability.metrics.severity
      : 'UNKNOWN'
    severityCounts.set(severity, severityCounts.get(severity) + 1)
  }

  const latest = snapshots.at(-1) ?? null
  const previous = snapshots.at(-2) ?? null
  return {
    snapshots,
    latest,
    previous,
    snapshotCount: snapshots.length,
    comparisonAvailable: snapshots.length > 1,
    countryCoverage: {
      resolvedIndicators: seenIps.size,
      attemptedIndicators: Number.isInteger(geoAttempted) && geoAttempted > 0 ? geoAttempted : seenIps.size,
      countries,
    },
    categories: {
      ipReputationCount: Array.isArray(indicators) ? indicators.length : 0,
      vulnerabilityCount: Array.isArray(vulnerabilities) ? vulnerabilities.length : 0,
      vulnerabilitySeverities: VULNERABILITY_SEVERITIES
        .map((severity) => ({ severity, count: severityCounts.get(severity) }))
        .filter((entry) => entry.count > 0),
    },
  }
}
