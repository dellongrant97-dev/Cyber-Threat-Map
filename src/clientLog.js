const SAFE_ERROR_NAMES = new Set([
  'AbortError',
  'Error',
  'QuotaExceededError',
  'SecurityError',
  'SyntaxError',
  'TypeError',
])

export function logClientError(event, error, level = 'error') {
  const safeEvent = typeof event === 'string' && /^[a-z0-9_-]{1,48}$/i.test(event)
    ? event
    : 'client_error'
  const errorName = error instanceof Error && SAFE_ERROR_NAMES.has(error.name)
    ? error.name
    : 'Error'
  const logger = level === 'warn' ? console.warn : console.error
  logger(`[Sentinel] ${safeEvent} (${errorName})`)
}
