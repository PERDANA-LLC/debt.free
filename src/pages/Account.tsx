import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui'
import { api, useAuth } from '../lib/auth'

/** Wraps /app routes: signed-out visitors go to login. */
export function RequireAuth() {
  const { me, loading } = useAuth()
  if (loading) return <p className="wrap muted">Loading…</p>
  if (!me) return <Navigate to="/login" replace />
  return <Outlet />
}

function Form({ title, cta, onSubmit, extra }: { title: string; cta: string; onSubmit: (email: string, pw: string) => Promise<string | null>; extra?: React.ReactNode }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const go = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const m = await onSubmit(email, pw)
    setBusy(false)
    if (m) setErr(m)
    else nav('/app')
  }
  return (
    <div className="wrap narrow">
      <Link to="/" className="muted small">← Home</Link>
      <h1>{title}</h1>
      <form className="card" onSubmit={go}>
        <label className="field">Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">Password (10+ characters)
          <input type="password" autoComplete={cta === 'Sign in' ? 'current-password' : 'new-password'} required minLength={cta === 'Sign in' ? 1 : 10} value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {err && <p role="alert" className="warn">{err}</p>}
        <div className="row"><button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : cta}</button></div>
      </form>
      {extra}
    </div>
  )
}

export const Login = () => {
  const { login } = useAuth()
  return <Form title="Sign in" cta="Sign in" onSubmit={login} extra={<p>New here? <Link to="/signup">Start your free trial</Link></p>} />
}

export const Signup = () => {
  const { register } = useAuth()
  return <Form title="Start your 14-day free trial" cta="Create account" onSubmit={register}
    extra={<p className="muted small">No card needed. Already have an account? <Link to="/login">Sign in</Link></p>} />
}

export function Invite() {
  const { token = '' } = useParams()
  const { acceptInvite } = useAuth()
  const [valid, setValid] = useState<boolean | null>(null)
  useEffect(() => { void api<{ valid: boolean }>(`/api/invite/${encodeURIComponent(token)}`).then((r) => setValid(!!r.data.valid)) }, [token])
  if (valid === null) return <p className="wrap muted">Checking invite…</p>
  if (!valid) return <div className="wrap narrow"><h1>Invite not valid</h1><p>This invite was already used or has expired. Ask your partner for a new one.</p></div>
  return <Form title="Join your household" cta="Create my login" onSubmit={(e, p) => acceptInvite(token, e, p)} />
}

const fmt = (sec: number | null) => (sec ? new Date(sec * 1000).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '')

export function Billing() {
  const { me, refresh, logout } = useAuth()
  const [params] = useSearchParams()
  const [msg, setMsg] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const nav = useNavigate()
  const status = params.get('status')

  // After Stripe returns, the webhook may land a moment after the redirect: poll briefly.
  useEffect(() => {
    if (status !== 'success') return
    let n = 0
    const t = setInterval(() => { void refresh(); if (++n >= 8) clearInterval(t) }, 2000)
    return () => clearInterval(t)
  }, [status, refresh])

  if (!me) return null
  const h = me.household
  const go = async (path: string, body: unknown) => {
    setMsg(null)
    const r = await api<{ url?: string }>(path, 'POST', body)
    if (r.ok && r.data.url) window.location.assign(r.data.url)
    else setMsg(r.data.error ?? 'Could not start billing.')
  }
  const invite = async () => {
    const r = await api<{ link?: string }>('/api/household/invite', 'POST', {})
    if (r.ok && r.data.link) setLink(r.data.link)
    else setMsg(r.data.error ?? 'Could not create invite.')
  }

  return (
    <>
      <h1>Account and billing</h1>
      {status === 'success' && <p className="ok" role="status">Thanks. Your subscription is being confirmed{h.access === 'subscribed' ? ' and is active.' : '…'}</p>}
      {status === 'canceled' && <p className="muted">Checkout canceled. You have not been charged.</p>}
      <Card title="Plan">
        {h.access === 'subscribed' && <p><strong>Family plan</strong> · {h.subStatus}{h.periodEnd ? ` · period ends ${fmt(h.periodEnd)}` : ''}</p>}
        {h.access === 'trial' && <p><strong>Free trial</strong> · ends {fmt(h.trialEndsAt)}</p>}
        {h.access === 'none' && <p><strong>Trial ended.</strong> Free tools still work. Subscribe to unlock the full plan.</p>}
        {h.access !== 'subscribed' || h.subStatus === 'canceled' ? (
          <div className="row">
            <button className="btn primary" onClick={() => go('/api/billing/checkout', { plan: 'annual' })}>$99 / year</button>
            <button className="btn" onClick={() => go('/api/billing/checkout', { plan: 'monthly' })}>$12 / month</button>
          </div>
        ) : null}
        {h.hasCustomer && <div className="row"><button className="btn" onClick={() => go('/api/billing/portal', {})}>Manage billing</button></div>}
        {msg && <p role="alert" className="warn">{msg}</p>}
      </Card>
      <Card title="Household logins">
        <ul>{h.members.map((m) => <li key={m.email}>{m.email}{m.isOwner ? ' (owner)' : ''}</li>)}</ul>
        {me.user.isOwner && h.members.length < 2 && <button className="btn" onClick={invite}>Invite your partner</button>}
        {link && <p className="small">Send this link (valid 7 days, one use):<br /><code className="wrapcode">{link}</code></p>}
      </Card>
      <div className="row"><button className="btn" onClick={async () => { await logout(); nav('/') }}>Sign out</button></div>
    </>
  )
}
