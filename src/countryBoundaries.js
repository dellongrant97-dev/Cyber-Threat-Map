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
export function countryContainsLocation(feature, longitude, latitude) {
  const inRing = (ring) => {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      const crosses = ((yi > latitude) !== (yj > latitude)) && (longitude < ((xj - xi) * (latitude - yi)) / ((yj - yi) || Number.EPSILON) + xi)
      if (crosses) inside = !inside
    }
    return inside
  }
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : []
  return polygons.some((rings) => rings.length > 0 && inRing(rings[0]) && !rings.slice(1).some((hole) => inRing(hole)))
}