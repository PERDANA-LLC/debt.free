import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'

export const Disclaimer = () => (
  <p className="disclaimer">
    General education only. Not financial, tax, legal or investment advice. Results are estimates from the numbers you enter; confirm
    with your lenders and a licensed professional before acting.
  </p>
)

export function Card({ title, children, aside }: { title?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card">
      {(title || aside) && (
        <div className="card-head">
          {title && <h3>{title}</h3>}
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Num({ value, onChange, step = 1, prefix, suffix, min = 0, label }: {
  value: number; onChange: (n: number) => void; step?: number; prefix?: string; suffix?: string; min?: number; label: string
}) {
  return (
    <span className="num">
      {prefix && <span className="affix">{prefix}</span>}
      <input
        aria-label={label}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(min, parseFloat(e.target.value) || 0))}
      />
      {suffix && <span className="affix">{suffix}</span>}
    </span>
  )
}

/** Paywall: Module 1 and 4 tools stay free. Everything else needs a trial or paid plan. */
export function Gate({ children, what }: { children: ReactNode; what: string }) {
  const { hasPaid } = useStore()
  const { me } = useAuth()
  if (hasPaid) return <>{children}</>
  return (
    <Card title="Included with the Family plan">
      <p>{what} is part of the Family plan: $99/year or $12/month, with two logins per household.{me ? ' Your free trial has ended.' : ''}</p>
      <div className="row">
        <Link className="btn primary" to="/app/billing">Subscribe</Link>
      </div>
    </Card>
  )
}

export function BalanceChart({ curve, months }: { curve: number[]; months: number }) {
  if (curve.length < 2) return null
  const W = 600, H = 180, P = 8
  const max = Math.max(...curve, 1)
  const pts = curve.map((v, i) => `${P + (i / Math.max(1, curve.length - 1)) * (W - 2 * P)},${H - P - (v / max) * (H - 2 * P)}`)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Total debt balance over ${months} months`}>
      <polyline points={`${P},${H - P} ${pts.join(' ')} ${W - P},${H - P}`} className="area" />
      <polyline points={pts.join(' ')} className="line" fill="none" />
    </svg>
  )
}
