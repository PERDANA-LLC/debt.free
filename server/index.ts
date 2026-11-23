// Local development and self-hosted server. On Vercel, api/index.ts is the entry instead.
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { existsSync, readFileSync } from 'node:fs'
import { buildApp } from './bootstrap'

const app = await buildApp()

// Serve the built SPA when present, falling back to index.html for client routes.
if (existsSync('dist/index.html')) {
  const html = readFileSync('dist/index.html', 'utf8')
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', (c) => c.html(html))
}

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8787) }, (i) => console.log(`API on http://localhost:${i.port}`))
