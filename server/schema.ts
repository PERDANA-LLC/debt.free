/**
 * Database schema (Postgres / Supabase). Idempotent. Apply with `npm run db:migrate`
 * or paste into the Supabase SQL editor.
 *
 * Row Level Security is ON with no policies: Supabase exposes the public schema to the anon key through its
 * REST API, and this keeps these tables unreadable that way. The server connects with the database owner
 * role (DATABASE_URL), which bypasses RLS.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 0,
  trial_ends_at BIGINT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  sub_status TEXT,
  current_period_end BIGINT,
  sub_event_ts BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  household_id TEXT NOT NULL REFERENCES households(id),
  is_owner INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS users_household_idx ON users(household_id);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS invites (
  token_hash TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  expires_at BIGINT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  received_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_key_idx ON rate_limits(key, ts);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
`
