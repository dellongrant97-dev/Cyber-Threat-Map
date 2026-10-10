const ACTIVITY_SAMPLE_LIMIT = 20

function sortIndicators(indicators) {
  return [...indicators].sort((first, second) => (
    second.consensus - first.consensus || first.ip.localeCompare(second.ip)
  ))
}

function summarize(indicators, limit) {
  const highCount = indicators.filter((indicator) => indicator.consensus >= 6).length
  return {
    count: indicators.length,
    highCount,
    mediumCount: indicators.length - highCount,
    sample: sortIndicators(indicators).slice(0, limit),
  }
}

export function createSnapshotActivity(previous, current, sampleLimit = ACTIVITY_SAMPLE_LIMIT) {
  if (!current?.sha || !Array.isArray(current.indicators)) {
    throw new TypeError('A valid current IPsum snapshot is required.')
  }

  const baseline = !previous || !Array.isArray(previous.indicators)
  const previousByIp = new Map((baseline ? [] : previous.indicators).map((indicator) => [indicator.ip, indicator]))
  const currentByIp = new Map(current.indicators.map((indicator) => [indicator.ip, indicator]))
  const newlyListed = []
  const retained = []
  const noLongerListed = []
  const strengthened = []

  if (!baseline) {
    for (const indicator of current.indicators) {
      const previousIndicator = previousByIp.get(indicator.ip)
      if (!previousIndicator) newlyListed.push(indicator)
      else {
        retained.push(indicator)
        if (previousIndicator.consensus < 6 && indicator.consensus >= 6) strengthened.push(indicator)
      }
    }
    for (const indicator of previous.indicators) {
      if (!currentByIp.has(indicator.ip)) noLongerListed.push(indicator)
    }
  }

  const currentHighCount = current.indicators.filter((indicator) => indicator.consensus >= 6).length
  const addedCounts = summarize(newlyListed, sampleLimit)
  const retainedCounts = summarize(retained, sampleLimit)
  const removedCounts = summarize(noLongerListed, sampleLimit)
  const strengthenedCounts = summarize(strengthened, sampleLimit)

  return {
    id: current.sha,
    source: 'IPsum',
    sourceUrl: 'https://github.com/stamparm/ipsum',
    baseline,
    publishedAt: current.publishedAt,
    retrievedAt: current.retrievedAt ?? current.checkedAt ?? null,
    dashboardTimestampType: current.retrievedAt ? 'retrieved' : 'checked',
    totalCount: current.indicators.length,
    highCount: currentHighCount,
    mediumCount: current.indicators.length - currentHighCount,
    newlyListed: addedCounts,
    retained: retainedCounts,
    noLongerListed: removedCounts,
    strengthened: strengthenedCounts,
  }
}

export function ensureSnapshotActivity(snapshot) {
  if (isValidSnapshotActivity(snapshot.activity) && snapshot.activity.length) return snapshot.activity
  return [createSnapshotActivity(null, snapshot)]
}

export function isValidSnapshotActivity(activity) {
  return Array.isArray(activity) && activity.every((entry) => (
    entry && typeof entry.id === 'string'
    && entry.source === 'IPsum'
    && typeof entry.baseline === 'boolean'
    && Number.isFinite(Date.parse(entry.publishedAt))
    && Number.isFinite(Date.parse(entry.retrievedAt))
    && ['retrieved', 'checked'].includes(entry.dashboardTimestampType)
    && Number.isInteger(entry.totalCount) && entry.totalCount >= 0
    && Number.isInteger(entry.highCount) && entry.highCount >= 0
    && Number.isInteger(entry.mediumCount) && entry.mediumCount >= 0
    && entry.highCount + entry.mediumCount === entry.totalCount
    && typeof entry.sourceUrl === 'string'
    && entry.sourceUrl === 'https://github.com/stamparm/ipsum'
    && [entry.newlyListed, entry.retained, entry.noLongerListed, entry.strengthened].every((summary) => (
      summary && Number.isInteger(summary.count) && summary.count >= 0
      && Number.isInteger(summary.highCount) && summary.highCount >= 0
      && Number.isInteger(summary.mediumCount) && summary.mediumCount >= 0
      && summary.highCount + summary.mediumCount === summary.count
      && Array.isArray(summary.sample)
      && summary.sample.every((indicator) => indicator
        && typeof indicator.ip === 'string'
        && /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(indicator.ip)
        && [3, 6].includes(indicator.consensus))
    ))
  ))
}
