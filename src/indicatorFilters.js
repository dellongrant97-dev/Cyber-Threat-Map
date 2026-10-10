export function filterIndicators({
  indicators,
  locations,
  confidence = 'all',
  category = 'all',
  country = 'all',
  snapshotWindow = 'all',
  publishedAt,
  query = '',
  now = Date.now(),
}) {
  const locationByIp = new Map(locations.map((location) => [location.ip, location]))
  const search = query.trim().toLowerCase()
  const maxAgeDays = snapshotWindow === '7d' ? 7 : snapshotWindow === '30d' ? 30 : null
  const snapshotAgeDays = Number.isFinite(Date.parse(publishedAt))
    ? Math.max(0, (now - Date.parse(publishedAt)) / 86_400_000)
    : Infinity

  if (maxAgeDays !== null && snapshotAgeDays > maxAgeDays) return []
  if (category !== 'all' && category !== 'ip-reputation') return []

  return indicators.filter((indicator) => {
    if (confidence === 'high' && indicator.consensus < 6) return false
    if (confidence === 'medium' && indicator.consensus >= 6) return false

    const location = locationByIp.get(indicator.ip)
    if (country === 'unavailable' && location) return false
    if (country !== 'all' && country !== 'unavailable' && location?.country !== country) return false
    if (!search) return true

    return [
      indicator.ip,
      location?.country,
      location?.countryCode,
      location?.city,
      location?.organization,
    ].some((value) => value?.toLowerCase().includes(search))
  })
}
