import { Link } from 'react-router-dom'
import { Disclaimer } from '../components/ui'
import { DebtTable } from '../components/DebtTable'
import { Planner } from '../components/Planner'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { modules } from '../lib/curriculum'

export function Landing() {
  const { loadExample } = useStore()
  const { me } = useAuth()
  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">For W-2 moms and dads</p>
        <h1>From carrying debt to debt-free, with a plan both of you will keep.</h1>
        <p className="lead">Seven short modules, real calculators, and a dated payoff plan built around your family’s actual numbers.</p>
        <div className="row center">
          <Link className="btn primary" to="/calculator">Try the free payoff calculator</Link>
          {me ? <Link className="btn" to="/app">Open my app</Link> : <Link className="btn" to="/signup">Start 14-day free trial</Link>}
          {!me && <Link className="btn ghost" to="/login">Sign in</Link>}
        </div>
      </header>

      <section>
        <h2>The path</h2>
        <ol className="path">
          {modules.map((m) => (
            <li key={m.id}><strong>{m.n}. {m.title}</strong><span className="muted small">{m.outcome}</span></li>
          ))}
        </ol>
      </section>

      <section id="pricing">
        <h2>Pricing</h2>
        <div className="plans">
          <div className="plan"><h3>Free</h3><p className="price">$0</p>
            <ul><li>Payoff calculator (avalanche, snowball, hybrid)</li><li>Module 1 and Module 4 lessons</li><li>Debt inventory</li></ul></div>
          <div className="plan best"><h3>Family</h3><p className="price">$99<span>/year</span></p><p className="muted small">or $12/month · 14-day free trial</p>
            <ul><li>All 7 modules with quizzes</li><li>Budget builder and sinking funds</li><li>Interest, special-debt and protection tools</li><li>Dashboard and Family Debt-Free Plan</li><li>Two logins per household</li></ul>
            <Link className="btn primary" to="/signup">Start free trial</Link></div>
        </div>
      </section>

      <section>
        <h2>See it with the example family</h2>
        <p>The Carters carry $73,700 of non-mortgage debt. <Link to="/calculator" onClick={loadExample}>Load their numbers</Link> into the calculator.</p>
      </section>
      <Disclaimer />
    </div>
  )
}

export function Calculator() {
  const { loadExample, s } = useStore()
  return (
    <div className="wrap">
      <Link to="/" className="muted small">← Home</Link>
      <h1>Free debt payoff calculator</h1>
      <p className="lead">Enter your debts, choose a method, and see your debt-free date. Your numbers stay in this browser.</p>
      <div className="row">
        <button className="btn" onClick={loadExample}>Load example household</button>
        <Link className="btn" to="/app">Open full app →</Link>
      </div>
      <div className="card"><DebtTable /></div>
      {s.debts.length > 0 && <Planner useHousehold={false} />}
    </div>
  )
}
