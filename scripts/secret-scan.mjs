import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const scriptPath = fileURLToPath(import.meta.url)
const ignoredDirectories = new Set(['.git', 'node_modules', '.vite', '.cache', 'coverage'])
const secretPatterns = [
  { id: 'github-token', expression: ['\\bgh', '[pousr]_[A-Za-z0-9_]{30,}\\b'].join('') },
  { id: 'github-fine-grained-token', expression: '\\bgithub_pat_[A-Za-z0-9_]{22,}\\b' },
  { id: 'aws-access-key-id', expression: '\\b(?:AKIA|ASIA)[A-Z0-9]{16}\\b' },
  { id: 'google-api-key', expression: '\\bAIza[0-9A-Za-z_-]{35}\\b' },
  { id: 'stripe-live-secret', expression: '\\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\\b' },
  { id: 'gitlab-token', expression: '\\bglpat-[A-Za-z0-9_-]{20,}\\b' },
  { id: 'slack-token', expression: '\\bxox[baprs]-[A-Za-z0-9-]{10,}\\b' },
  { id: 'private-key-header', expression: ['-----BEGIN ', '(?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'].join('') },
  {
    id: 'credential-assignment',
    expression: '\\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\\b\\s*[:=]\\s*[\\x22\\x27][^\\x22\\x27\\r\\n]{16,}[\\x22\\x27]',
  },
].map(({ id, expression }) => ({ id, pattern: new RegExp(expression, 'gi') }))

export function findSecretMatches(text) {
  const findings = []
  const lines = text.split(/\r?\n/)
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    for (const { id, pattern } of secretPatterns) {
      pattern.lastIndex = 0
      if (pattern.test(lines[lineIndex])) findings.push({ rule: id, line: lineIndex + 1 })
    }
  }
  return findings
}

function scanDirectory(directory, findings) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) scanDirectory(path, findings)
      continue
    }
    if (!entry.isFile()) continue

    const size = statSync(path).size
    if (size > 20_000_000) {
      findings.push({ path: relative(root, path), rule: 'file-over-scan-size-limit', line: 0 })
      continue
    }
    const contents = readFileSync(path)
    if (contents.includes(0)) continue
    for (const match of findSecretMatches(contents.toString('utf8'))) {
      findings.push({ path: relative(root, path), ...match })
    }
  }
}

const findings = []
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  scanDirectory(root, findings)
  if (findings.length) {
    console.error('Secret scan failed; matched values are intentionally not displayed:')
    for (const finding of findings) {
      console.error(`${finding.path}:${finding.line} ${finding.rule}`)
    }
    process.exitCode = 1
  } else {
    console.log('Secret scan passed; no supported credential patterns found.')
  }
}
