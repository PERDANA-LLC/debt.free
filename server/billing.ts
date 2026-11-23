import type { Db } from './db'

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface StripeLike {
  customers: { create(p: any): Promise<{ id: string }> }
  checkout: { sessions: { create(p: any): Promise<{ url: string | null }> } }
  billingPortal: { sessions: { create(p: any): Promise<{ url: string }> } }
  webhooks: { constructEvent(body: string, sig: string, secret: string): any }
}

/** Newer Stripe API versions put the period end on the subscription item. */
export function periodEnd(sub: any): number | null {
  return sub?.items?.data?.[0]?.current_period_end ?? sub?.current_period_end ?? null
}

/**
 * Apply a verified Stripe event. Idempotent per event id; ignores subscription
 * events older than the newest one already applied to a household.
 */
export async function applyStripeEvent(db: Db, event: any, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const seen = await db.one('SELECT 1 FROM webhook_events WHERE id = $1', [event.id])
  if (seen) return 'duplicate'

  let outcome = 'ignored'
  const obj = event.data?.object

  if (event.type === 'checkout.session.completed' && obj?.mode === 'subscription') {
    const hid = obj.client_reference_id
    if (hid && obj.customer) {
      await db.exec(
        'UPDATE households SET stripe_customer_id = COALESCE(stripe_customer_id, $1), stripe_subscription_id = $2 WHERE id = $3',
        [obj.customer, obj.subscription ?? null, hid],
      )
      outcome = 'linked'
    }
  } else if (String(event.type).startsWith('customer.subscription.')) {
    const h = await db.one<{ id: string; sub_event_ts: number }>('SELECT id, sub_event_ts FROM households WHERE stripe_customer_id = $1', [obj.customer])
    if (!h) outcome = 'unknown-customer'
    else if (event.created < h.sub_event_ts) outcome = 'stale'
    else {
      const status = event.type === 'customer.subscription.deleted' ? 'canceled' : obj.status
      await db.exec(
        'UPDATE households SET sub_status = $1, stripe_subscription_id = $2, current_period_end = $3, sub_event_ts = $4 WHERE id = $5',
        [status, obj.id, periodEnd(obj), event.created, h.id],
      )
      outcome = 'updated'
    }
  }
  // 'unknown-customer' may arrive before the customer is linked; leave it unrecorded so Stripe's retry can succeed.
  if (outcome !== 'unknown-customer')
    await db.exec('INSERT INTO webhook_events (id, received_at) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [event.id, nowSec])
  return outcome
}
