function sourceStatus(source, online) {
  if (!online) return 'offline'
  if (source.loading) return 'loading'
  if (source.error) return source.hasData || source.lastSuccessAt ? 'stale' : 'error'
  if (source.stale) return 'stale'
  if (!source.attempted) return 'idle'
  if (!source.hasData) return 'empty'
  return 'ready'
}

export function buildSourceHealthRows({
  online = true,
  threat = {},
  geolocation = {},
  events = {},
  news = {},
  vulnerabilities = {},
  phishing = {},
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

  return definitions.map((source) => ({
    ...source,
    status: sourceStatus(source, online),
    stale: Boolean(source.stale || (source.error && (source.hasData || source.lastSuccessAt)) || (!online && (source.hasData || source.lastSuccessAt))),
    error: !online
      ? [source.error, 'Browser is offline; a new retrieval cannot be confirmed.'].filter(Boolean).join(' ')
      : source.error || '',
  }))
}
