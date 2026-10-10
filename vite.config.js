import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { addProductionSecurityMeta, CONTENT_SECURITY_POLICY } from './src/securityPolicy.js'

const cspReportOnly = process.env.CSP_REPORT_ONLY === 'true'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'production-security-policy',
      apply: 'build',
      transformIndexHtml: (html) => addProductionSecurityMeta(html, { reportOnly: cspReportOnly }),
    },
  ],
  base: process.env.GITHUB_ACTIONS ? '/Cyber-Threat-Map/' : '/',
  preview: {
    headers: cspReportOnly ? { 'Content-Security-Policy-Report-Only': CONTENT_SECURITY_POLICY } : {},
  },
})
