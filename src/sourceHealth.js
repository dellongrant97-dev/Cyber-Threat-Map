const REFRESH_WINDOWS = {
  ipsum: 45 * 60 * 1000,
  usgs: 15 * 60 * 1000,
  bbc: 45 * 60 * 1000,
  nvd: 90 * 60 * 1000,
}

function timestampMs(value) {
  if (Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function sourceStatus(source, online, now) {
  if (!online) return 'offline'
  if (source.loading) return 'loading'
  if (source.error) return source.hasData || source.lastSuccessAt ? 'stale' : 'error'
  if (source.stale) return 'stale'
  if (!source.attempted) return 'idle'
  if (!source.hasData) return 'empty'

  const lastSuccessMs = timestampMs(source.lastSuccessAt)
  const refreshWindow = REFRESH_WINDOWS[source.id]
  if (refreshWindow && lastSuccessMs !== null && now >= lastSuccessMs && now - lastSuccessMs > refreshWindow) {
    return 'delayed'
  }
  return 'ready'
}

function recoveryHint(source, status) {
  if (status === 'offline') return 'Reconnect to the internet, then use Check now to verify this source.'
  if (status === 'loading') return 'The request is in progress. Keep this panel open while it completes.'
  if (status === 'stale') return source.hasData
    ? 'Showing the last available snapshot. Retry the source check when the connection or provider is available.'
    : 'The last request failed. Retry when the connection or provider is available.'
  if (status === 'error') return 'No successful snapshot is available yet. Check the connection or provider status, then retry.'
  if (status === 'delayed') return 'The last successful check is older than the expected refresh window. Check now to verify it.'
  if (status === 'idle') return source.id === 'openphish'
    ? 'This feed is checked only when requested. Use Refresh feed when you need a current lookup.'
    : 'No request has been recorded in this session yet.'
  if (status === 'empty') return 'The last request succeeded but returned no displayable records; this is not proof that no activity exists.'
  return ''
}

export function buildSourceHealthRows({
  online = true,
  threat = {},
  geolocation = {},
  events = {},
  news = {},
  vulnerabilities = {},
  phishing = {},
  now = Date.now(),
}) {
  const definitions = [
    {
      id: 'ipsum',
      name: 'IPsum public blocklists',
      description: 'Suspicious IPv4 reputation · source publication timestamp available',
      sourceUrl: 'https://github.com/stamparm/ipsum',
      lastSuccessAt: threat.lastSuccessAt,
      latestUpdateAt: threat.latestUpdateAt,
      latestUpdateLabel: 'IPsum revision published',
      hasData: threat.count > 0,
      count: threat.count,
      attempted: Boolean(threat.attempted),
      loading: threat.loading,
      stale: threat.stale,
      error: threat.error,
      refresh: 'ipsum',
    },
    {
      id: 'geoip',
      name: 'ipapi.co GeoIP',
      description: 'Limited sample of approximate IP hosting locations',
      sourceUrl: 'https://ipapi.co/',
      lastSuccessAt: geolocation.lastSuccessAt,
      latestUpdateAt: null,
      latestUpdateLabel: 'Provider update timestamp not supplied',
      hasData: geolocation.resolved > 0,
      count: geolocation.resolved,
      attempted: geolocation.attemptedRequest,
      loading: geolocation.loading,
      stale: geolocation.stale,
      error: geolocation.error,
      refresh: 'geoip',
    },
    {
      id: 'usgs',
      name: 'USGS earthquake feed',
      description: 'M4.5+ earthquake events · separate from cyber threat data',
      sourceUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
      lastSuccessAt: events.lastSuccessAt,
      latestUpdateAt: events.latestUpdateAt,
      latestUpdateLabel: 'USGS feed generated',
      hasData: events.count > 0,
      count: events.count,
      attempted: Boolean(events.attempted),
      loading: events.loading,
      stale: events.stale,
      error: events.error,
      refresh: 'usgs',
    },
    {
      id: 'bbc',
      name: 'BBC World news (rss2json)',
      description: 'World news headlines · converter is an additional dependency',
      sourceUrl: 'https://www.bbc.co.uk/news/world',
      lastSuccessAt: news.lastSuccessAt,
      latestUpdateAt: news.latestUpdateAt,
      latestUpdateLabel: 'Newest included article published',
      hasData: news.count > 0,
      count: news.count,
      attempted: Boolean(news.attempted),
      loading: news.loading,
      stale: news.stale,
      error: news.error,
      refresh: 'bbc',
    },
    {
      id: 'nvd',
      name: 'NVD CVE API',
      description: 'Recent vulnerability records · subject to public API rate limits',
      sourceUrl: 'https://nvd.nist.gov/vuln',
      lastSuccessAt: vulnerabilities.lastSuccessAt,
      latestUpdateAt: vulnerabilities.latestUpdateAt,
      latestUpdateLabel: 'Newest returned CVE published',
      hasData: vulnerabilities.count > 0,
      count: vulnerabilities.count,
      attempted: Boolean(vulnerabilities.attempted),
      loading: vulnerabilities.loading,
      stale: vulnerabilities.stale,
      error: vulnerabilities.error,
      refresh: 'nvd',
    },
    {
      id: 'openphish',
      name: 'OpenPhish community feed',
      description: 'Domain reputation lookup · retrieved only when requested',
      sourceUrl: 'https://openphish.com/',
      lastSuccessAt: phishing.lastSuccessAt,
      latestUpdateAt: null,
      latestUpdateLabel: 'Provider update timestamp not supplied',
      hasData: phishing.count > 0,
      count: phishing.count,
      attempted: phishing.attempted,
      loading: phishing.loading,
      stale: phishing.stale,
      error: phishing.error,
      refresh: 'openphish',
    },
  ]

  return definitions.map((source) => {
    const status = sourceStatus(source, online, now)
    const lastSuccessMs = timestampMs(source.lastSuccessAt)
    const ageMs = lastSuccessMs !== null && now >= lastSuccessMs ? now - lastSuccessMs : null
    const stale = Boolean(source.stale || (source.error && (source.hasData || source.lastSuccessAt)) || (!online && (source.hasData || source.lastSuccessAt)))
    return {
      ...source,
      status,
      ageMs,
      stale,
      recoveryHint: recoveryHint(source, status),
      error: !online
        ? [source.error, 'Browser is offline; a new retrieval cannot be confirmed.'].filter(Boolean).join(' ')
        : source.error || '',
    }
  })
}
