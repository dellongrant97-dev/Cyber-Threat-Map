export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-elem 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "script-src-attr 'none'",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self'",
  "connect-src 'self' https://api.github.com https://raw.githubusercontent.com https://ipapi.co https://earthquake.usgs.gov https://api.rss2json.com https://services.nvd.nist.gov",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join('; ')

export function addProductionSecurityMeta(html, { reportOnly = false } = {}) {
  if (reportOnly) return html
  const meta = `    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`
  return html.replace('<head>', `<head>\n${meta}`)
}
