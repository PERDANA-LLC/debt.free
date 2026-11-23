// End-to-end Stripe TEST-mode check. Run: node --env-file=.env scripts/stripe-e2e.mjs
// Needs: API on :8787, `stripe listen` forwarding to /api/stripe/webhook. Refuses to run with a non-test key.
import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY ?? ''
if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) throw new Error('Refusing: not a test-mode key')
const stripe = new Stripe(key)
const base = 'http://localhost:8787'
const origin = process.env.APP_URL ?? 'http://localhost:5174'
const email = `e2e+${Date.now()}@debtfree.test`
const password = `e2e-${Math.random().toString(36).slice(2)}-pass`
let cookie = ''
const results = []
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`) }

async function call(method, path, body) {
  const res = await fetch(base + path, { method, headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const set = res.headers.get('set-cookie'); if (set) cookie = set.split(';')[0]
  return { status: res.status, json: await res.json().catch(() => ({})) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(fn, ms = 20000) { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(1000) } return null }

const reg = await call('POST', '/api/auth/register', { email, password })
check('register + trial', reg.status === 201 && reg.json.household.access === 'trial')

const co = await call('POST', '/api/billing/checkout', { plan: 'annual' })
check('checkout session created', co.status === 200 && String(co.json.url).startsWith('https://checkout.stripe.com/'))

const found = await stripe.customers.list({ email, limit: 1 })
const row = { c: found.data[0]?.id }
check('customer created and linked', !!row?.c, row?.c ?? '')

// Subscribe via API with Stripe's test payment method (no card entry needed), so real webhooks flow.
const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: row.c })
await stripe.customers.update(row.c, { invoice_settings: { default_payment_method: pm.id } })
const sub = await stripe.subscriptions.create({ customer: row.c, items: [{ price: process.env.STRIPE_PRICE_ANNUAL }] })
check('test subscription created', sub.status === 'active', sub.status)

const active = await waitFor(async () => (await call('GET', '/api/me')).json.household?.access === 'subscribed')
check('webhook flipped access to subscribed', !!active)
const me = (await call('GET', '/api/me')).json
check('status active with period end', me.household.subStatus === 'active' && me.household.periodEnd > Date.now() / 1000, String(me.household.subStatus))
check('second checkout blocked', (await call('POST', '/api/billing/checkout', { plan: 'monthly' })).status === 409)
const portal = await call('POST', '/api/billing/portal', {})
check('portal session', portal.status === 200 && String(portal.json.url).startsWith('https://billing.stripe.com/'), portal.json.error ?? '')

// Cancel at period end, then immediately.
await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true })
await sleep(4000)
check('cancel-at-period-end keeps access', (await call('GET', '/api/me')).json.household.access === 'subscribed')
await stripe.subscriptions.cancel(sub.id)
const gone = await waitFor(async () => (await call('GET', '/api/me')).json.household?.subStatus === 'canceled')
check('deletion webhook recorded canceled', !!gone)
const after = (await call('GET', '/api/me')).json
console.log('access after immediate cancel:', after.household.access, '(trial_ends_at is in the future, so trial may still apply)')

// Clean up the test customer.
await stripe.customers.del(row.c)
console.log(results.every(Boolean) ? '\nALL PASSED' : '\nSOME FAILED')
process.exit(results.every(Boolean) ? 0 : 1)
