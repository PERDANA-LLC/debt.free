import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Db } from './db'
import { applyStripeEvent, type StripeLike } from './billing'
import { getModule, protectChecklist, specialDebtGuide } from './content'
import { accessFor } from './entitlement'
import { hashPassword, newId, newToken, sha256, validEmail, verifyPassword } from './security'

export interface Config {
  appUrl: string // public site URL, no trailing slash. Empty = derive from the request (Vercel previews)
  secureCookies: boolean
  stripeWebhookSecret: string
  priceAnnual: string
  priceMonthly: string
  trialDays: number
}

interface Deps {
  db: Db
  stripe: StripeLike | null
  cfg: Config
}

interface UserRow { id: string; email: string; household_id: string; is_owner: number; password_hash: string }
interface HouseholdRow {
  id: string; state_json: string; version: number; trial_ends_at: number; stripe_customer_id: string | null
  sub_status: string | null; current_period_end: number | null
}

const DAY = 86400
const SESSION_DAYS = 30
const MAX_STATE_BYTES = 200_000
const nowSec = () => Math.floor(Date.now() / 1000)

export function createApp({ db, stripe, cfg }: Deps) {
  const app = new Hono()

  const ipOf = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0].trim() || c.req.header('x-real-ip') || 'local'
  const q = <T,>(sql: string, ...a: (string | number | null)[]) => db.one<T>(sql, a)

  // Attempt limiter kept in the database so it works across serverless instances.
  async function rateOk(key: string, max: number, windowMs: number): Promise<boolean> {
    const now = Date.now()
    await db.exec('INSERT INTO rate_limits (key, ts) VALUES ($1, $2)', [key, now])
    const r = await q<{ n: number }>('SELECT COUNT(*) AS n FROM rate_limits WHERE key = $1 AND ts > $2', key, now - windowMs)
    if (Math.random() < 0.02) await db.exec('DELETE FROM rate_limits WHERE ts < $1', [now - 24 * 3600_000])
    return (r?.n ?? 0) <= max
  }
  const loginOk = (key: string) => rateOk(`login|${key}`, 10, 15 * 60_000)
  const signupOk = (ip: string) => rateOk(`signup|${ip}`, 20, 60 * 60_000)

  const hostOrigin = (c: Context) => {
    const host = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? ''
    const proto = c.req.header('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    return host ? `${proto}://${host}` : ''
  }
  const baseUrl = (c: Context) => cfg.appUrl || hostOrigin(c)

  // CSRF: state-changing API calls must come from our origin, as JSON. The Stripe webhook is exempt (signature-verified instead).
  app.use('/api/*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.path !== '/api/stripe/webhook') {
      const origin = c.req.header('origin')
      if (origin && origin !== baseUrl(c) && origin !== hostOrigin(c)) return c.json({ error: 'Bad origin' }, 403)
      if (!c.req.header('content-type')?.startsWith('application/json')) return c.json({ error: 'JSON required' }, 415)
    }
    c.header('Cache-Control', 'no-store')
    await next()
  })

  async function startSession(c: Context, userId: string) {
    const token = newToken()
    await db.exec('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [sha256(token), userId, nowSec() + SESSION_DAYS * DAY])
    setCookie(c, 'sid', token, { httpOnly: true, sameSite: 'Lax', secure: cfg.secureCookies, path: '/', maxAge: SESSION_DAYS * DAY })
  }

  async function currentUser(c: Context): Promise<UserRow | null> {
    const token = getCookie(c, 'sid')
    if (!token) return null
    const row = await q<UserRow & { expires_at: number }>(
      'SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1', sha256(token))
    if (!row || row.expires_at < nowSec()) return null
    return row
  }

  const household = async (id: string) => (await q<HouseholdRow>('SELECT * FROM households WHERE id = $1', id))!

  async function me(u: UserRow) {
    const h = await household(u.household_id)
    const members = await db.many<{ email: string; is_owner: number }>('SELECT email, is_owner FROM users WHERE household_id = $1 ORDER BY created_at', [u.household_id])
    return {
      user: { email: u.email, isOwner: !!u.is_owner },
      household: {
        members: members.map((m) => ({ email: m.email, isOwner: !!m.is_owner })),
        access: accessFor(h),
        trialEndsAt: h.trial_ends_at,
        subStatus: h.sub_status,
        periodEnd: h.current_period_end,
        hasCustomer: !!h.stripe_customer_id,
      },
    }
  }

  async function createUser(email: string, password: string, householdId: string, isOwner: boolean) {
    const id = newId()
    await db.exec('INSERT INTO users (id, email, password_hash, household_id, is_owner, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, email, await hashPassword(password), householdId, isOwner ? 1 : 0, nowSec()])
    return id
  }

  function parseCreds(body: any): { email: string; password: string } | string {
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')
    if (!validEmail(email)) return 'Enter a valid email.'
    if (password.length < 10) return 'Password must be at least 10 characters.'
    if (password.length > 200) return 'Password is too long.'
    return { email, password }
  }

  // ---- auth ----
  app.post('/api/auth/register', async (c) => {
    if (!(await signupOk(ipOf(c)))) return c.json({ error: 'Too many attempts. Try later.' }, 429)
    const body = await c.req.json().catch(() => null)
    const creds = parseCreds(body)
    if (typeof creds === 'string') return c.json({ error: creds }, 400)
    if (await q('SELECT 1 FROM users WHERE email = $1', creds.email)) return c.json({ error: 'An account with this email already exists.' }, 409)
    const hid = newId()
    await db.exec('INSERT INTO households (id, trial_ends_at, created_at) VALUES ($1, $2, $3)', [hid, nowSec() + cfg.trialDays * DAY, nowSec()])
    let uid: string
    try {
      uid = await createUser(creds.email, creds.password, hid, true)
    } catch {
      await db.exec('DELETE FROM households WHERE id = $1', [hid]) // lost a race on the unique email
      return c.json({ error: 'An account with this email already exists.' }, 409)
    }
    await startSession(c, uid)
    return c.json(await me((await q<UserRow>('SELECT * FROM users WHERE id = $1', uid))!), 201)
  })

  app.post('/api/auth/login', async (c) => {
    const body = await c.req.json().catch(() => null)
    const email = String(body?.email ?? '').trim().toLowerCase()
    const key = `${ipOf(c)}|${email}`
    if (!(await loginOk(key))) return c.json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429)
    const u = await q<UserRow>('SELECT * FROM users WHERE email = $1', email)
    const ok = u ? await verifyPassword(String(body?.password ?? ''), u.password_hash) : (await hashPassword('x'), false)
    if (!u || !ok) return c.json({ error: 'Email or password is incorrect.' }, 401)
    await db.exec('DELETE FROM rate_limits WHERE key = $1', [`login|${key}`])
    await startSession(c, u.id)
    return c.json(await me(u))
  })

  app.post('/api/auth/logout', async (c) => {
    const token = getCookie(c, 'sid')
    if (token) await db.exec('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)])
    deleteCookie(c, 'sid', { path: '/' })
    return c.json({ ok: true })
  })

  app.get('/api/me', async (c) => {
    const u = await currentUser(c)
    return u ? c.json(await me(u)) : c.json({ error: 'Not signed in' }, 401)
  })

  // ---- household members ----
  app.post('/api/household/invite', async (c) => {
    const u = await currentUser(c)
    if (!u) return c.json({ error: 'Not signed in' }, 401)
    if (!u.is_owner) return c.json({ error: 'Only the household owner can invite.' }, 403)
    const count = (await q<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE household_id = $1', u.household_id))!.n
    if (count >= 2) return c.json({ error: 'This household already has two logins.' }, 409)
    await db.exec('UPDATE invites SET used = 1 WHERE household_id = $1 AND used = 0', [u.household_id]) // one live invite at a time
    const token = newToken()
    await db.exec('INSERT INTO invites (token_hash, household_id, expires_at) VALUES ($1, $2, $3)', [sha256(token), u.household_id, nowSec() + 7 * DAY])
    return c.json({ link: `${baseUrl(c)}/invite/${token}`, expiresInDays: 7 })
  })

  app.get('/api/invite/:token', async (c) => {
    const inv = await q<{ expires_at: number; used: number }>('SELECT * FROM invites WHERE token_hash = $1', sha256(c.req.param('token')))
    return c.json({ valid: !!inv && !inv.used && inv.expires_at > nowSec() })
  })

  app.post('/api/invite/:token/accept', async (c) => {
    if (!(await signupOk(ipOf(c)))) return c.json({ error: 'Too many attempts. Try later.' }, 429)
    const th = sha256(c.req.param('token'))
    const inv = await q<{ household_id: string; expires_at: number; used: number }>('SELECT * FROM invites WHERE token_hash = $1', th)
    if (!inv || inv.used || inv.expires_at < nowSec()) return c.json({ error: 'This invite is invalid or expired.' }, 410)
    const creds = parseCreds(await c.req.json().catch(() => null))
    if (typeof creds === 'string') return c.json({ error: creds }, 400)
    if (await q('SELECT 1 FROM users WHERE email = $1', creds.email)) return c.json({ error: 'An account with this email already exists.' }, 409)
    if ((await q<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE household_id = $1', inv.household_id))!.n >= 2)
      return c.json({ error: 'This household already has two logins.' }, 409)
    const claimed = await db.exec('UPDATE invites SET used = 1 WHERE token_hash = $1 AND used = 0', [th])
    if (claimed !== 1) return c.json({ error: 'This invite is invalid or expired.' }, 410)
    let uid: string
    try {
      uid = await createUser(creds.email, creds.password, inv.household_id, false)
    } catch {
      return c.json({ error: 'An account with this email already exists.' }, 409)
    }
    await startSession(c, uid)
    return c.json(await me((await q<UserRow>('SELECT * FROM users WHERE id = $1', uid))!), 201)
  })

  // ---- synced app state ----
  app.get('/api/state', async (c) => {
    const u = await currentUser(c)
    if (!u) return c.json({ error: 'Not signed in' }, 401)
    const h = await household(u.household_id)
    return c.json({ state: JSON.parse(h.state_json), version: h.version })
  })

  app.put('/api/state', async (c) => {
    const u = await currentUser(c)
    if (!u) return c.json({ error: 'Not signed in' }, 401)
    const raw = await c.req.text()
    if (raw.length > MAX_STATE_BYTES) return c.json({ error: 'State too large' }, 413)
    let body: any
    try { body = JSON.parse(raw) } catch { return c.json({ error: 'Invalid JSON' }, 400) }
    if (!body || typeof body.state !== 'object' || body.state === null || Array.isArray(body.state) || !Number.isInteger(body.version))
      return c.json({ error: 'Expected { state, version }' }, 400)
    const { tier: _t, trialStarted: _s, ...state } = body.state // billing never comes from the client
    const changed = await db.exec('UPDATE households SET state_json = $1, version = version + 1 WHERE id = $2 AND version = $3',
      [JSON.stringify(state), u.household_id, body.version])
    if (changed !== 1) {
      const h = await household(u.household_id)
      return c.json({ error: 'conflict', state: JSON.parse(h.state_json), version: h.version }, 409)
    }
    return c.json({ version: body.version + 1 })
  })

  // ---- gated content ----
  // Free modules need a login; the rest need trial or subscription. Bodies are never in the client bundle.
  app.get('/api/content/tools', async (c) => {
    const u = await currentUser(c)
    if (!u) return c.json({ error: 'Not signed in' }, 401)
    if (accessFor(await household(u.household_id)) === 'none') return c.json({ error: 'Subscription required' }, 402)
    return c.json({ protectChecklist, specialDebtGuide })
  })

  app.get('/api/content/lessons/:id', async (c) => {
    const u = await currentUser(c)
    if (!u) return c.json({ error: 'Not signed in' }, 401)
    const m = getModule(c.req.param('id'))
    if (!m) return c.json({ error: 'Not found' }, 404)
    if (!m.free && accessFor(await household(u.household_id)) === 'none') return c.json({ error: 'Subscription required' }, 402)
    const { concepts, example, exercise, tool, quiz } = m
    return c.json({ concepts, example, exercise, tool, quiz })
  })

  // ---- billing ----
  app.post('/api/billing/checkout', async (c) => {
    const u = await currentUser(c)
    if (!u) return c.json({ error: 'Not signed in' }, 401)
    if (!stripe) return c.json({ error: 'Billing is not configured.' }, 503)
    const body = await c.req.json().catch(() => null)
    const price = body?.plan === 'annual' ? cfg.priceAnnual : body?.plan === 'monthly' ? cfg.priceMonthly : null
    if (!price) return c.json({ error: 'Choose annual or monthly.' }, 400)
    const h = await household(u.household_id)
    if (['active', 'trialing', 'past_due'].includes(h.sub_status ?? '')) return c.json({ error: 'Already subscribed. Use Manage billing.' }, 409)
    let customer = h.stripe_customer_id
    if (!customer) {
      customer = (await stripe.customers.create({ email: u.email, metadata: { household_id: h.id } })).id
      await db.exec('UPDATE households SET stripe_customer_id = $1 WHERE id = $2 AND stripe_customer_id IS NULL', [customer, h.id])
      customer = (await household(h.id)).stripe_customer_id!
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: h.id,
      line_items: [{ price, quantity: 1 }],
      success_url: `${baseUrl(c)}/app/billing?status=success`,
      cancel_url: `${baseUrl(c)}/app/billing?status=canceled`,
      allow_promotion_codes: true,
    })
    return c.json({ url: session.url })
  })

  app.post('/api/billing/portal', async (c) => {
    const u = await currentUser(c)
    if (!u) return c.json({ error: 'Not signed in' }, 401)
    if (!stripe) return c.json({ error: 'Billing is not configured.' }, 503)
    const h = await household(u.household_id)
    if (!h.stripe_customer_id) return c.json({ error: 'No billing account yet.' }, 404)
    const s = await stripe.billingPortal.sessions.create({ customer: h.stripe_customer_id, return_url: `${baseUrl(c)}/app/billing` })
    return c.json({ url: s.url })
  })

  app.post('/api/stripe/webhook', async (c) => {
    if (!stripe || !cfg.stripeWebhookSecret) return c.json({ error: 'Webhook not configured' }, 503)
    const sig = c.req.header('stripe-signature')
    if (!sig) return c.json({ error: 'Missing signature' }, 400)
    const body = await c.req.text() // raw body: signature covers exact bytes
    let event
    try {
      event = stripe.webhooks.constructEvent(body, sig, cfg.stripeWebhookSecret)
    } catch {
      return c.json({ error: 'Invalid signature' }, 400)
    }
    const outcome = await applyStripeEvent(db, event)
    return c.json({ received: true, outcome })
  })

  app.onError((err, c) => {
    console.error(err)
    return c.json({ error: 'Server error' }, 500)
  })

  return app
}
