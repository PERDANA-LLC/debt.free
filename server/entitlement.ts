export interface HouseholdBilling {
  trial_ends_at: number
  sub_status: string | null
  current_period_end: number | null
}

export type Access = 'subscribed' | 'trial' | 'none'

/** Epoch seconds everywhere. Subscription states come from Stripe webhooks. */
export function accessFor(h: HouseholdBilling, nowSec = Math.floor(Date.now() / 1000)): Access {
  const s = h.sub_status
  if (s === 'active' || s === 'trialing' || s === 'past_due') return 'subscribed' // past_due: Stripe is still retrying
  // 'canceled' means the subscription has ended (Stripe sends it when a cancel-at-period-end plan actually lapses,
  // or on an immediate cancel/refund). Access stops; the trial can still apply if it has not expired.
  if (h.trial_ends_at > nowSec) return 'trial'
  return 'none'
}

export const isEntitled = (h: HouseholdBilling, now?: number) => accessFor(h, now) !== 'none'
