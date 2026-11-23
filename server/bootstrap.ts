import Stripe from 'stripe'
import { createApp, type Config } from './app'
import { connectPglite, connectPostgres, migrate, type Db } from './db'

const env = process.env

export function configFromEnv(): Config {
  return {
    appUrl: (env.APP_URL ?? '').replace(/\/$/, ''),
    secureCookies: env.NODE_ENV === 'production' || !!env.VERCEL,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
    priceAnnual: env.STRIPE_PRICE_ANNUAL ?? '',
    priceMonthly: env.STRIPE_PRICE_MONTHLY ?? '',
    trialDays: Number(env.TRIAL_DAYS ?? 14),
  }
}

/** DATABASE_URL (Supabase) when set; otherwise a local PGlite folder for development only. */
export async function connectFromEnv(): Promise<Db> {
  if (env.DATABASE_URL) return connectPostgres(env.DATABASE_URL)
  if (env.VERCEL || env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production')
  const db = await connectPglite(env.PGLITE_DIR ?? '.pglite')
  await migrate(db)
  return db
}

export async function buildApp() {
  const cfg = configFromEnv()
  const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null
  if (!stripe) console.warn('STRIPE_SECRET_KEY not set: checkout, portal and webhooks return 503.')
  else if (!cfg.priceAnnual || !cfg.priceMonthly || !cfg.stripeWebhookSecret)
    console.warn('Set STRIPE_PRICE_ANNUAL, STRIPE_PRICE_MONTHLY and STRIPE_WEBHOOK_SECRET.')
  return createApp({ db: await connectFromEnv(), stripe: stripe as never, cfg })
}
