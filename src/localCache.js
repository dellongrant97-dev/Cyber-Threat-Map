export function readJsonCache(key, isValid) {
  let value
  try {
    value = window.localStorage.getItem(key)
  } catch (error) {
    console.warn(`Could not read cached data (${key}).`, error)
    return null
  }
  if (!value) return null

  try {
    const result = JSON.parse(value)
    if (!isValid(result)) {
      console.warn(`Ignoring invalid cached data (${key}).`)
      return null
    }
    return result
  } catch (error) {
    console.warn(`Ignoring invalid cached data (${key}).`, error)
    return null
  }
}

export function writeJsonCache(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`Could not cache data (${key}).`, error)
  }
}
