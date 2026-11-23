import { describe, expect, it, beforeEach } from 'vitest'
import Stripe from 'stripe'
import { createApp, type Config } from './app'
import { connectPglite, migrate } from './db'
import { accessFor } from './entitlement'
import { hashPassword, verifyPassword } from './security'

const ORIGIN = 'http://localhost:5174'
const SECRET = 'whsec_test_secret'
const cfg: Config = { appUrl: ORIGIN, secureCookies: false, stripeWebhookSecret: SECRET, priceAnnual: 'price_year', priceMonthly: 'price_month', trialDays: 14 }
const realStripe = new Stripe('sk_test_dummy') // used only for offline signature verification

async function setup() {
  const db = await connectPglite()
  await migrate(db)
  const calls: any[] = []
  const stripe: any = {
    customers: { create: async (p: any) => (calls.push(['customer', p]), { id: 'cus_1' }) },
    checkout: { sessions: { create: async (p: any) => (calls.push(['checkout', p]), { url: 'https://checkout.stripe.test/s' }) } },
    billingPortal: { sessions: { create: async (p: any) => (calls.push(['portal', p]), { url: 'https://portal.stripe.test/p' }) } },
    webhooks: realStripe.webhooks,
  }
  const app = createApp({ db, stripe, cfg })
  let cookie = ''
  const req = async (method: string, path: string, body?: unknown, opts: { cookie?: string | null } = {}) => {
    const headers: Record<string, string> = { origin: ORIGIN, 'content-type': 'application/json' }
    const ck = opts.cookie === undefined ? cookie : opts.cookie
    if (ck) headers.cookie = ck
    const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const set = res.headers.get('set-cookie')
    if (set && opts.cookie === undefined) cookie = set.split(';')[0]
    return { status: res.status, json: (await res.json().catch(() => null)) as any, res }
  }
  const webhook = async (event: object, sig?: string) => {
    const payload = JSON.stringify(event)
    const header = sig ?? realStripe.webhooks.generateTestHeaderString({ payload, secret: SECRET })
    const res = await app.request('/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': header, 'content-type': 'application/json' }, body: payload })
    return { status: res.status, json: (await res.json()) as any }
  }
  return { db, req, webhook, calls, clearCookie: () => (cookie = '') }
}

const subEvent = (id: string, type: string, status: string, created: number, end = 4_102_444_800) => ({
  id, type, created, data: { object: { id: 'sub_1', customer: 'cus_1', status, items: { data: [{ current_period_end: end }] } } },
})

describe('passwords', () => {
  it('hashes and verifies', async () => {
    const h = await hashPassword('correct horse battery')
    expect(h).not.toContain('correct horse')
    expect(await verifyPassword('correct horse battery', h)).toBe(true)
    expect(await verifyPassword('wrong password!!', h)).toBe(false)
  })
})

describe('entitlement', () => {
  const now = 1_000_000
  it('trial, none, subscribed, canceled-in-period', () => {
    expect(accessFor({ trial_ends_at: now + 10, sub_status: null, current_period_end: null }, now)).toBe('trial')
    expect(accessFor({ trial_ends_at: now - 10, sub_status: null, current_period_end: null }, now)).toBe('none')
    expect(accessFor({ trial_ends_at: 0, sub_status: 'active', current_period_end: null }, now)).toBe('subscribed')
    expect(accessFor({ trial_ends_at: 0, sub_status: 'canceled', current_period_end: now + 5 }, now)).toBe('none')
    expect(accessFor({ trial_ends_at: 0, sub_status: 'canceled', current_period_end: now - 5 }, now)).toBe('none')
    expect(accessFor({ trial_ends_at: 0, sub_status: 'unpaid', current_period_end: now + 5 }, now)).toBe('none')
  })
})

describe('auth', () => {
  let t: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => { t = await setup() })

  it('registers with a 14-day trial, then reads /api/me', async () => {
    const r = await t.req('POST', '/api/auth/register', { email: 'A@Example.com', password: 'longenough123' })
    expect(r.status).toBe(201)
    expect(r.json.user.email).toBe('a@example.com')
    expect(r.json.household.access).toBe('trial')
    expect(r.res.headers.get('set-cookie')).toMatch(/HttpOnly/i)
    expect((await t.req('GET', '/api/me')).json.user.isOwner).toBe(true)
  })
  it('rejects weak passwords, bad emails and duplicates', async () => {
    expect((await t.req('POST', '/api/auth/register', { email: 'a@b.co', password: 'short' })).status).toBe(400)
    expect((await t.req('POST', '/api/auth/register', { email: 'nope', password: 'longenough123' })).status).toBe(400)
    await t.req('POST', '/api/auth/register', { email: 'a@b.co', password: 'longenough123' })
    expect((await t.req('POST', '/api/auth/register', { email: 'a@b.co', password: 'longenough123' })).status).toBe(409)
  })
  it('logs in, rejects bad password, logs out', async () => {
    await t.req('POST', '/api/auth/register', { email: 'a@b.co', password: 'longenough123' })
    t.clearCookie()
    expect((await t.req('POST', '/api/auth/login', { email: 'a@b.co', password: 'wrongwrong12' })).status).toBe(401)
    expect((await t.req('POST', '/api/auth/login', { email: 'a@b.co', password: 'longenough123' })).status).toBe(200)
    expect((await t.req('POST', '/api/auth/logout', {})).status).toBe(200)
    expect((await t.req('GET', '/api/me')).status).toBe(401)
  })
  it('rate limits repeated bad logins', async () => {
    let last = 0
    for (let i = 0; i < 12; i++) last = (await t.req('POST', '/api/auth/login', { email: 'x@y.co', password: 'badbadbad123' })).status
    expect(last).toBe(429)
  })
})

describe('csrf', () => {
  it('rejects a foreign Origin and non-JSON content type', async () => {
    const t = await setup()
    const app = createApp({ db: t.db, stripe: null, cfg })
    const foreign = await app.request('/api/auth/logout', { method: 'POST', headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, body: '{}' })
    expect(foreign.status).toBe(403)
    const form = await app.request('/api/auth/logout', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'text/plain' }, body: '{}' })
    expect(form.status).toBe(415)
  })
})

describe('state sync', () => {
  it('saves, versions, strips billing fields, and reports conflicts', async () => {
    const t = await setup()
    await t.req('POST', '/api/auth/register', { email: 'a@b.co', password: 'longenough123' })
    const g = (await t.req('GET', '/api/state')).json
    expect(g.version).toBe(0)
    const p1 = await t.req('PUT', '/api/state', { version: 0, state: { debts: [{ id: 'x' }], tier: 'paid', trialStarted: 'now' } })
    expect(p1.json.version).toBe(1)
    const after = (await t.req('GET', '/api/state')).json
    expect(after.state.tier).toBeUndefined()
    expect(after.state.debts).toHaveLength(1)
    const stale = await t.req('PUT', '/api/state', { version: 0, state: { debts: [] } })
    expect(stale.status).toBe(409)
    expect(stale.json.version).toBe(1)
    expect((await t.req('PUT', '/api/state', { version: 1, state: 'nope' })).status).toBe(400)
  })
  it('requires a session', async () => {
    expect((await (await setup()).req('GET', '/api/state')).status).toBe(401)
  })
})

describe('household invites', () => {
  it('lets a second login join, share state, and caps at two', async () => {
    const t = await setup()
    await t.req('POST', '/api/auth/register', { email: 'a@b.co', password: 'longenough123' })
    await t.req('PUT', '/api/state', { version: 0, state: { marker: 1 } })
    const inv = (await t.req('POST', '/api/household/invite', {})).json
    expect(inv.link).toContain('/invite/')
    const token = inv.link.split('/invite/')[1]
    expect((await t.req('GET', `/api/invite/${token}`)).json.valid).toBe(true)
    t.clearCookie()
    const acc = await t.req('POST', `/api/invite/${token}/accept`, { email: 'b@b.co', password: 'longenough456' })
    expect(acc.status).toBe(201)
    expect(acc.json.user.isOwner).toBe(false)
    expect(acc.json.household.members).toHaveLength(2)
    expect((await t.req('GET', '/api/state')).json.state.marker).toBe(1)
    expect((await t.req('POST', '/api/household/invite', {})).status).toBe(403) // not owner
    expect((await t.req('POST', `/api/invite/${token}/accept`, { email: 'c@b.co', password: 'longenough789' })).status).toBe(410) // single use
  })
})

describe('gated content', () => {
  it('needs a login, serves free modules to everyone, and gates paid ones on access', async () => {
    const t = await setup()
    expect((await t.req('GET', '/api/content/lessons/m1')).status).toBe(401)
    await t.req('POST', '/api/auth/register', { email: 'a@b.co', password: 'longenough123' })
    expect((await t.req('GET', '/api/content/lessons/m2')).json.quiz).toHaveLength(3) // trial
    expect((await t.req('GET', '/api/content/lessons/nope')).status).toBe(404)
    expect((await t.req('GET', '/api/content/tools')).json.protectChecklist.length).toBeGreaterThan(0)
    await t.db.exec('UPDATE households SET trial_ends_at = 0') // trial over, no subscription
    expect((await t.req('GET', '/api/content/lessons/m2')).status).toBe(402)
    expect((await t.req('GET', '/api/content/tools')).status).toBe(402)
    const free = await t.req('GET', '/api/content/lessons/m1')
    expect(free.status).toBe(200)
    expect(free.json.title).toBeUndefined()
  })
})

describe('billing + Stripe webhook', () => {
  let t: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => {
    t = await setup()
    await t.req('POST', '/api/auth/register', { email: 'a@b.co', password: 'longenough123' })
  })

  it('creates a checkout session with the household as client_reference_id', async () => {
    const r = await t.req('POST', '/api/billing/checkout', { plan: 'annual' })
    expect(r.json.url).toBe('https://checkout.stripe.test/s')
    const [, p] = t.calls.find((c) => c[0] === 'checkout')!
    expect(p.mode).toBe('subscription')
    expect(p.line_items[0].price).toBe('price_year')
    expect(p.customer).toBe('cus_1')
    expect(p.client_reference_id).toBeTruthy()
    expect((await t.req('POST', '/api/billing/checkout', { plan: 'lifetime' })).status).toBe(400)
  })

  it('rejects unsigned and wrongly signed webhooks', async () => {
    expect((await t.webhook({ id: 'e1', type: 'x', created: 1 }, 't=1,v1=deadbeef')).status).toBe(400)
    const res = await ((await setup()).webhook({ id: 'e1', type: 'x', created: 1 }, undefined))
    expect(res.status).toBe(200) // valid signature on an ignorable event
  })

  it('subscription becomes active only after a verified webhook', async () => {
    await t.req('POST', '/api/billing/checkout', { plan: 'monthly' })
    expect((await t.req('GET', '/api/me')).json.household.access).toBe('trial')
    const w = await t.webhook(subEvent('evt_1', 'customer.subscription.created', 'active', 100))
    expect(w.json.outcome).toBe('updated')
    const me = (await t.req('GET', '/api/me')).json
    expect(me.household.access).toBe('subscribed')
    expect(me.household.subStatus).toBe('active')
    expect(me.household.periodEnd).toBe(4_102_444_800)
  })

  it('is idempotent and ignores stale events', async () => {
    await t.req('POST', '/api/billing/checkout', { plan: 'monthly' })
    await t.webhook(subEvent('evt_new', 'customer.subscription.updated', 'active', 200))
    expect((await t.webhook(subEvent('evt_new', 'customer.subscription.updated', 'active', 200))).json.outcome).toBe('duplicate')
    expect((await t.webhook(subEvent('evt_old', 'customer.subscription.updated', 'unpaid', 150))).json.outcome).toBe('stale')
    expect((await t.req('GET', '/api/me')).json.household.subStatus).toBe('active')
  })

  it('an ended subscription loses access, even with a future period end', async () => {
    await t.req('POST', '/api/billing/checkout', { plan: 'monthly' })
    await t.db.exec('UPDATE households SET trial_ends_at = 0')
    await t.webhook(subEvent('evt_a2', 'customer.subscription.updated', 'active', 250))
    expect((await t.req('GET', '/api/me')).json.household.access).toBe('subscribed')
    await t.webhook(subEvent('evt_c', 'customer.subscription.deleted', 'canceled', 300, Math.floor(Date.now() / 1000) + 86400))
    expect((await t.req('GET', '/api/me')).json.household.access).toBe('none')
  })

  it('blocks a second checkout while subscribed and opens the portal', async () => {
    await t.req('POST', '/api/billing/checkout', { plan: 'monthly' })
    await t.webhook(subEvent('evt_a', 'customer.subscription.created', 'active', 100))
    expect((await t.req('POST', '/api/billing/checkout', { plan: 'annual' })).status).toBe(409)
    expect((await t.req('POST', '/api/billing/portal', {})).json.url).toBe('https://portal.stripe.test/p')
  })
})
