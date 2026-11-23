# DebtFree Family

SaaS web app for W-2 parents going from carrying debt to debt-free. Built from `docs/digital.product/dp.1.md`.

## Run

```bash
npm install
npm run dev:api   # API on :8787; embedded dev database in .pglite/ unless DATABASE_URL is set
npm run dev       # web app on http://localhost:5174, proxies /api
npm test          # engine + server tests
npm run build && npm start   # production: one server serves API and built app
```

## What is built

- Free: payoff calculator at `/calculator` (no account), Module 1 and 4 lessons, debt inventory.
- Family plan: budget builder, interest tools, special-debt guide, protection checklist, Family Plan, all 7 lessons with quizzes.
- Accounts: email + password (scrypt), HttpOnly session cookie, login rate limiting, origin/JSON checks on writes.
- Households: one record per household, up to two logins via a single-use 7-day invite link. State syncs to the server with version checks.
- Trial: 14 days from signup, no card, enforced server-side.
- Stripe: Checkout (annual/monthly), customer portal, and a signature-verified webhook that is the only thing that grants paid access.

## Stripe setup (test mode first)

1. Create two recurring prices ($99/year, $12/month); put their ids in `STRIPE_PRICE_ANNUAL` / `STRIPE_PRICE_MONTHLY`.
2. Set `STRIPE_SECRET_KEY`. Enable the customer portal in the Stripe dashboard.
3. `stripe listen --forward-to localhost:8787/api/stripe/webhook`, and set `STRIPE_WEBHOOK_SECRET` to the `whsec_` it prints.
   In production add a webhook endpoint for `checkout.session.completed` and `customer.subscription.created|updated|deleted`.
4. Pay with Stripe test card 4242 4242 4242 4242.

## Known limits

- Stripe has not been exercised live: the webhook and checkout logic are tested against signed fake events and a stubbed client only.
- Paid lesson bodies, quizzes and tool guides live in `server/content.ts` and are served from `/api/content/*` only to households with a trial or subscription (free modules need just a login). Calculators run client-side and are not gated by the API.
- No email: invites are links the owner shares; no password reset or email verification yet.
- Login and signup rate limits are stored in the database. Cookies are Secure on Vercel and when `NODE_ENV=production`.
- Data is in Postgres (Supabase). Local dev uses an embedded PGlite database in `.pglite/` that is not meant for production.
- Still open: bank connections, terms/privacy policy, counsel review, and the "verify before publishing" figures in dp.1.md.

## Deploy to Vercel + Supabase

1. **Supabase:** create a project. Copy the **Transaction pooler** connection string (Project Settings, Database; port 6543).
2. **Schema:** run it once from this folder with that URL in `.env` as `DATABASE_URL`:
   ```bash
   npm run db:migrate
   ```
   (Or paste `SCHEMA_SQL` from `server/schema.ts` into the Supabase SQL editor.) Tables have Row Level Security on with no policies, so the Supabase public API cannot read them; the server connects directly.
3. **Vercel:** `npx vercel login`, then `npx vercel link` in this folder.
4. **Environment variables** (Vercel, Project Settings): `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_MONTHLY`. Leave `APP_URL` unset to use the request's own host, or set it to your custom domain.
5. **Deploy a preview first:** `npx vercel`. Then production: `npx vercel --prod`.
6. **Stripe webhook:** in the Stripe dashboard add an endpoint `https://YOUR-DOMAIN/api/stripe/webhook` for `checkout.session.completed` and `customer.subscription.created|updated|deleted`; put its signing secret in `STRIPE_WEBHOOK_SECRET` and redeploy. Live keys need live-mode prices and a live-mode webhook; test-mode ids do not work with live keys.
7. Sign up on the deployed site, check `/api/me`, then run one small real purchase yourself and refund it.

`/api/*` is served by `api/index.ts`; everything else is the static app with an index.html fallback (`vercel.json`).
