import { logClientError } from './clientLog.js'

export function readJsonCache(key, isValid) {
  let value
  try {
    value = window.localStorage.getItem(key)
  } catch (error) {
    logClientError('cache_read_failed', error, 'warn')
    return null
  }
  if (!value) return null

  try {
    const result = JSON.parse(value)
    if (!isValid(result)) {
      console.warn('[Sentinel] cached_data_rejected (validation_failed)')
      return null
    }
    return result
  } catch (error) {
    logClientError('cache_parse_failed', error, 'warn')
    return null
  }
}

export function writeJsonCache(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    logClientError('cache_write_failed', error, 'warn')
  }
}
