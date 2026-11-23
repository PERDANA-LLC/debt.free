// Vercel entry: every /api/* request is rewritten here (see vercel.json). The app is built once per warm instance.
import type { Hono } from 'hono'
import { buildApp } from '../server/bootstrap'

let app: Promise<Hono> | undefined

export default {
  async fetch(req: Request): Promise<Response> {
    app ??= buildApp().catch((e) => { app = undefined; throw e })
    return (await app).fetch(req)
  },
}
