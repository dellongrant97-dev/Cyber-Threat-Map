const COUNTRY_GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'
let countryBoundaryPromise

export function loadCountryBoundaries() {
  if (!countryBoundaryPromise) {
    countryBoundaryPromise = fetch(COUNTRY_GEOJSON_URL, { headers: { Accept: 'application/geo+json' } })
      .then((response) => { if (!response.ok) throw new Error('Country boundaries unavailable'); return response.json() })
      .then((data) => { if (!Array.isArray(data.features)) throw new Error('Unexpected country boundary data'); return data.features.filter((feature) => feature.geometry && feature.properties) })
      .catch((error) => { countryBoundaryPromise = null; throw error })
  }
  return countryBoundaryPromise
}

export function countryName(feature) {
  return feature.properties.ADMIN || feature.properties.name || feature.properties.NAME || 'Unknown country'
}

export function countryGeometryPolygons(feature) {
  const geometry = feature.geometry
  if (geometry.type === 'Polygon') return geometry.coordinates
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat()
  return []
}

export function countrySvgPath(feature) {
  return countryGeometryPolygons(feature).map((ring) => ring.map(([longitude, latitude], index) => {
    const x = ((longitude + 180) / 360) * 1000
    const y = ((90 - latitude) / 180) * 500
    return (index ? 'L' : 'M') + x.toFixed(2) + ',' + y.toFixed(2)
  }).join(' ') + 'Z').join(' ')
}