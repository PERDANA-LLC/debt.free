import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { Card, Disclaimer, Gate, Num, Stat } from '../components/ui'
import { DebtTable } from '../components/DebtTable'
import { Planner } from '../components/Planner'
import { cashLeft, checkPlan, fmtUSD, sum, totalDebt, totalMinimums, weightedApr } from '../lib/cashflow'
import { modules, type LessonBody, type ToolsContent } from '../lib/curriculum'
import { monthlyInterest, monthsToPayoff, fmtMonths, simulatePayoff } from '../lib/payoff'
import { monthlyDebtBudget } from '../lib/cashflow'
import { api, useAuth } from '../lib/auth'
import { useStore } from '../lib/store'

/** Loads gated content from the API. status 402 means the household has no access. */
function useContent<T>(path: string) {
  const [r, setR] = useState<{ data: T | null; status: number | null }>({ data: null, status: null })
  useEffect(() => {
    let off = false
    setR({ data: null, status: null })
    void api<T>(path).then((x) => { if (!off) setR({ data: x.ok ? (x.data as T) : null, status: x.status }) })
    return () => { off = true }
  }, [path])
  return r
}

const nav = [
  ['/app', 'Dashboard'], ['/app/lessons', 'Lessons'], ['/app/debts', '1 · Debts'], ['/app/budget', '2 · Budget'],
  ['/app/interest', '3 · Interest'], ['/app/payoff', '4 · Payoff'], ['/app/special', '5 · Special debts'],
  ['/app/protect', '6 · Protect'], ['/app/plan', '7 · Family plan'], ['/app/billing', 'Account'],
]

export function Shell() {
  const { hasPaid, reset, sync } = useStore()
  const { me } = useAuth()
  return (
    <div className="shell">
      <aside className="side">
        <Link to="/" className="brand">DebtFree Family</Link>
        <nav>{nav.map(([to, label]) => <NavLink key={to} to={to} end={to === '/app'}>{label}</NavLink>)}</nav>
        <div className="side-foot">
          <span className="pill">{me?.household.access === 'subscribed' ? 'Family' : hasPaid ? 'Trial' : 'Free'}</span>
          <span className="muted small" role="status">{sync === 'saving' ? 'Saving…' : sync === 'saved' ? 'Saved' : sync === 'error' ? 'Sync error' : ''}</span>
          <button className="btn ghost small" onClick={() => confirm('Erase all your plan data?') && reset()}>Reset</button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  )
}

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—')

export function Dashboard() {
  const { s, loadExample } = useStore()
  const done = modules.filter((m) => s.lessonDone[m.id]).length
  const r = simulatePayoff({ debts: s.debts, monthlyBudget: monthlyDebtBudget(s.household, s.debts), strategy: s.strategy, hybridFirstId: s.hybridFirstId })
  if (s.debts.length === 0)
    return (
      <>
        <h1>Welcome</h1>
        <Card title="Start with Module 1">
          <p>Add your debts and household numbers, or look around with the example family.</p>
          <div className="row"><Link className="btn primary" to="/app/debts">Enter my numbers</Link><button className="btn" onClick={loadExample}>Load example household</button></div>
        </Card>
      </>
    )
  return (
    <>
      <h1>Dashboard</h1>
      <div className="stats">
        <Stat label="Debt-free date" value={r.feasible ? fmtDate(r.debtFreeDate) : 'Needs a bigger budget'} sub={r.feasible ? fmtMonths(r.months) : r.reason} />
        <Stat label="Total debt" value={fmtUSD(totalDebt(s.debts))} sub={`${s.debts.length} debts · avg ${weightedApr(s.debts).toFixed(1)}% APR`} />
        <Stat label="Monthly to debt" value={fmtUSD(monthlyDebtBudget(s.household, s.debts))} sub={`${fmtUSD(s.household.extraToDebt)} extra`} />
        <Stat label="Lessons done" value={`${done} / ${modules.length}`} />
      </div>
      <Card title="Starter fund">
        <progress max={s.starterFundGoal || 1} value={Math.min(s.starterFundSaved, s.starterFundGoal)} />
        <p className="small muted">{fmtUSD(s.starterFundSaved)} of {fmtUSD(s.starterFundGoal)}</p>
      </Card>
      <Card title="Next up">
        {(() => { const m = modules.find((x) => !s.lessonDone[x.id]); return m ? <p><Link to={`/app/lessons/${m.id}`}>Module {m.n}: {m.title}</Link> · {m.minutes} min</p> : <p>All modules complete. Review your Family Plan.</p> })()}
      </Card>
      <Disclaimer />
    </>
  )
}

export function Debts() {
  const { s, setHousehold, loadExample, set } = useStore()
  const h = s.household
  const left = cashLeft(h, s.debts)
  return (
    <>
      <h1>Module 1 · Know your numbers</h1>
      <Card title="Household">
        <div className="grid2">
          <label className="field">Adult 1<input value={h.adultA} onChange={(e) => setHousehold({ adultA: e.target.value })} /></label>
          <label className="field">Adult 2<input value={h.adultB} onChange={(e) => setHousehold({ adultB: e.target.value })} /></label>
          <label className="field">Take-home pay / month<Num label="Take-home" prefix="$" value={h.takeHome} step={50} onChange={(n) => setHousehold({ takeHome: n })} /></label>
          <label className="field">Essentials / month (excluding debt minimums)<Num label="Essentials" prefix="$" value={h.essentials} step={50} onChange={(n) => setHousehold({ essentials: n })} /></label>
        </div>
      </Card>
      <Card title="Debt inventory" aside={<button className="btn small" onClick={loadExample}>Load example</button>}>
        <DebtTable />
      </Card>
      <div className="stats">
        <Stat label="Total debt" value={fmtUSD(totalDebt(s.debts))} />
        <Stat label="Minimums" value={fmtUSD(totalMinimums(s.debts))} sub="per month" />
        <Stat label="Cash left after essentials" value={fmtUSD(left)} sub={left < 0 ? 'Spending exceeds income' : 'before any plan'} />
      </div>
      <div className="row"><button className="btn primary" onClick={() => set({ onboarded: true })}>Save</button><Link className="btn" to="/app/budget">Next: Budget →</Link></div>
    </>
  )
}

export function Budget() {
  const { s, setLines, setHousehold } = useStore()
  const h = s.household
  const chk = checkPlan(h, s.debts, s.lines)
  const up = (id: string, amount: number) => setLines(s.lines.map((l) => (l.id === id ? { ...l, amount } : l)))
  return (
    <>
      <h1>Module 2 · Spending plan</h1>
      <Gate what="The budget builder">
        <Card title="Free cash to assign">
          <p><strong>{fmtUSD(cashLeft(h, s.debts))}</strong> per month after essentials and minimums.</p>
          <label className="field">Extra to debt<Num label="Extra to debt" prefix="$" value={h.extraToDebt} step={25} onChange={(n) => setHousehold({ extraToDebt: n })} /></label>
        </Card>
        <Card title="Sinking funds and allowances" aside={<button className="btn small" onClick={() => setLines([...s.lines, { id: crypto.randomUUID(), name: 'New line', amount: 0, kind: 'sinking' }])}>+ Add</button>}>
          {s.lines.map((l) => (
            <div className="line" key={l.id}>
              <input aria-label="Line name" value={l.name} onChange={(e) => setLines(s.lines.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)))} />
              <select aria-label="Kind" value={l.kind} onChange={(e) => setLines(s.lines.map((x) => (x.id === l.id ? { ...x, kind: e.target.value as 'sinking' | 'allowance' } : x)))}>
                <option value="sinking">sinking fund</option><option value="allowance">allowance</option>
              </select>
              <Num label={`${l.name} amount`} prefix="$" value={l.amount} onChange={(n) => up(l.id, n)} />
              <button className="btn ghost" aria-label={`Remove ${l.name}`} onClick={() => setLines(s.lines.filter((x) => x.id !== l.id))}>✕</button>
            </div>
          ))}
        </Card>
        <Card>
          <p className={chk.balanced ? 'ok' : 'warn'} role="status">
            {chk.balanced ? 'Every dollar has a job.' : chk.unassigned > 0 ? `${fmtUSD(chk.unassigned)} still unassigned.` : `Over by ${fmtUSD(-chk.unassigned)}. Trim a line or lower extra to debt.`}
          </p>
          <p className="muted small">Planned: {fmtUSD(chk.planned)} sinking + allowances · {fmtUSD(h.extraToDebt)} extra to debt.</p>
        </Card>
        <p className="muted small">Hold a 30-minute money date each month to review this plan together.</p>
      </Gate>
    </>
  )
}

export function Interest() {
  const { s, updateDebt } = useStore()
  const [pay, setPay] = useState<Record<string, number>>({})
  return (
    <>
      <h1>Module 3 · Interest calculator</h1>
      <Gate what="The interest calculator and call scripts">
        <Card>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Debt</th><th>Balance</th><th>APR</th><th>Interest / mo</th><th>Minimum-only payoff</th><th>What if APR drops to…</th></tr></thead>
            <tbody>
              {s.debts.filter((d) => d.balance > 0).map((d) => {
                const target = pay[d.id] ?? Math.max(0, d.apr - 5)
                return (
                  <tr key={d.id}>
                    <td>{d.name}</td><td>{fmtUSD(d.balance)}</td><td>{d.apr}%</td>
                    <td>{fmtUSD(monthlyInterest(d.balance, d.apr))}</td>
                    <td>{d.minimum > 0 ? fmtMonths(monthsToPayoff(d.balance, d.apr, d.minimum)) : '—'}</td>
                    <td><Num label={`${d.name} target APR`} suffix="%" step={0.1} value={target} onChange={(n) => setPay({ ...pay, [d.id]: n })} />
                      {' '}saves {fmtUSD(monthlyInterest(d.balance, d.apr) - monthlyInterest(d.balance, target))}/mo
                      {target < d.apr && <button className="btn ghost small" onClick={() => updateDebt(d.id, { apr: target })}>apply</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        </Card>
        <Card title="Rate-reduction call script">
          <p className="script">“Hi, I’ve been a customer for [X] years and I’m working on paying down this balance. I’d like to ask for a lower APR. Can you review my account for a rate reduction or a hardship program?” If declined, ask: “Is there a retention team that can review it?” Note the date, name, and result.</p>
        </Card>
        <Card title="Balance-transfer checklist">
          <ul>
            <li>Transfer fee (often a few percent of the balance): ______</li>
            <li>Promo period ends: ______ and the rate afterward: ______</li>
            <li>Monthly payment that clears the balance before it ends: ______</li>
            <li>No new charges on either card.</li>
          </ul>
        </Card>
        <Disclaimer />
      </Gate>
    </>
  )
}

export const PayoffPage = () => (
  <>
    <h1>Module 4 · Payoff planner</h1>
    <Planner useHousehold />
  </>
)

export function Special() {
  const { s } = useStore()
  const { data } = useContent<ToolsContent>('/api/content/tools')
  const has = (t: string) => s.debts.some((d) => d.type === t)
  const g = data?.specialDebtGuide ?? {}
  return (
    <>
      <h1>Module 5 · Special debts</h1>
      <Gate what="The special-debt guide">
        {Object.keys(g).map((k) => (
          <Card key={k} title={g[k].title} aside={has(k === 'mortgage' ? 'other' : k) ? <span className="pill">you have this</span> : undefined}>
            <ol>{g[k].steps.map((t) => <li key={t}>{t}</li>)}</ol>
          </Card>
        ))}
        <p className="muted small">For federal loan options, use official sources such as studentaid.gov. This app is not affiliated with any government agency.</p>
        <Disclaimer />
      </Gate>
    </>
  )
}

export function Protect() {
  const { s, set } = useStore()
  const protectChecklist = useContent<ToolsContent>('/api/content/tools').data?.protectChecklist ?? []
  const done = protectChecklist.filter((c) => s.checklist[c.id]).length
  return (
    <>
      <h1>Module 6 · Protect the plan</h1>
      <Gate what="The protection checklist and fund tracker">
        <Card title="Starter emergency fund">
          <div className="grid2">
            <label className="field">Goal<Num label="Goal" prefix="$" step={100} value={s.starterFundGoal} onChange={(n) => set({ starterFundGoal: n })} /></label>
            <label className="field">Saved<Num label="Saved" prefix="$" step={50} value={s.starterFundSaved} onChange={(n) => set({ starterFundSaved: n })} /></label>
          </div>
          <progress max={s.starterFundGoal || 1} value={Math.min(s.starterFundSaved, s.starterFundGoal)} />
        </Card>
        <Card title={`Checklist (${done}/${protectChecklist.length})`}>
          {protectChecklist.map((c) => (
            <label key={c.id} className="check">
              <input type="checkbox" checked={!!s.checklist[c.id]} onChange={(e) => set({ checklist: { ...s.checklist, [c.id]: e.target.checked } })} /> {c.label}
            </label>
          ))}
        </Card>
        <Disclaimer />
      </Gate>
    </>
  )
}

export function Plan() {
  const { s } = useStore()
  const h = s.household
  const r = simulatePayoff({ debts: s.debts, monthlyBudget: monthlyDebtBudget(h, s.debts), strategy: s.strategy, hybridFirstId: s.hybridFirstId })
  const [review, setReview] = useState('')
  return (
    <>
      <h1>Module 7 · Family Debt-Free Plan</h1>
      <Gate what="The Family Debt-Free Plan">
        <article className="card printable">
          <h2>{[h.adultA, h.adultB].filter(Boolean).join(' & ') || 'Our'} Family Debt-Free Plan</h2>
          <p><strong>Debt-free date:</strong> {r.feasible ? fmtDate(r.debtFreeDate) : 'not yet reachable at this budget'} · <strong>Method:</strong> {s.strategy}</p>
          <h3>Payoff order</h3>
          <ol>{r.order.map((id) => { const d = s.debts.find((x) => x.id === id)!; const p = r.perDebt.find((x) => x.id === id); return <li key={id}>{d.name} ({fmtUSD(d.balance)} at {d.apr}%) · paid off {fmtDate(p?.paidOffDate ?? null)}</li> })}</ol>
          <h3>Monthly budget</h3>
          <ul>
            <li>Take-home: {fmtUSD(h.takeHome)}</li><li>Essentials: {fmtUSD(h.essentials)}</li>
            <li>Debt payments: {fmtUSD(monthlyDebtBudget(h, s.debts))} ({fmtUSD(h.extraToDebt)} extra)</li>
            {s.lines.map((l) => <li key={l.id}>{l.name}: {fmtUSD(l.amount)}</li>)}
            <li>Total sinking + allowances: {fmtUSD(sum(s.lines.map((l) => l.amount)))}</li>
          </ul>
          <h3>Goals after debt-free</h3>
          <ol><li>Full emergency fund (3–6 months of essentials)</li><li>Retirement contributions</li><li>Education savings, if it fits your goals</li></ol>
          <label className="field">Next money review date<input type="date" value={review} onChange={(e) => setReview(e.target.value)} /></label>
          <p className="disclaimer">General education only. Not financial, tax, legal or investment advice.</p>
        </article>
        <button className="btn" onClick={() => window.print()}>Print or save as PDF</button>
      </Gate>
    </>
  )
}

export function Lessons() {
  const { s, hasPaid } = useStore()
  return (
    <>
      <h1>Lessons</h1>
      <div className="list">
        {modules.map((m) => (
          <Link key={m.id} to={`/app/lessons/${m.id}`} className="card row between">
            <span><strong>Module {m.n}: {m.title}</strong><br /><span className="muted small">{m.minutes} min · {m.outcome}</span></span>
            <span className="pill">{s.lessonDone[m.id] ? `Done · ${s.quiz[m.id]}/3` : m.free || hasPaid ? 'Start' : 'Family plan'}</span>
          </Link>
        ))}
      </div>
    </>
  )
}

export function Lesson() {
  const { id } = useParams()
  const meta = modules.find((x) => x.id === id)
  const { data: m, status } = useContent<LessonBody>(`/api/content/lessons/${id}`)
  const { s, set } = useStore()
  const nav = useNavigate()
  const [picked, setPicked] = useState<(number | null)[]>([null, null, null])
  const [submitted, setSubmitted] = useState(false)
  if (!meta) return <p>Lesson not found. <Link to="/app/lessons">Back to lessons</Link></p>
  const header = (
    <>
      <Link to="/app/lessons" className="muted small">← Lessons</Link>
      <h1>Module {meta.n}: {meta.title}</h1>
    </>
  )
  if (status === 402) return <>{header}<Gate what={`Module ${meta.n}`}><p>Reload to view this lesson.</p></Gate></>
  if (!m) return <>{header}<p className="muted">{status === null ? 'Loading…' : 'Could not load this lesson.'}</p></>
  const score = m.quiz.reduce((n, q, i) => n + (picked[i] === q.answer ? 1 : 0), 0)
  const finish = () => {
    setSubmitted(true)
    set({ quiz: { ...s.quiz, [meta.id]: Math.max(s.quiz[meta.id] ?? 0, score) }, lessonDone: { ...s.lessonDone, [meta.id]: true } })
  }
  return (
    <>
      {header}
      <Card title="What you will be able to do"><p>{meta.outcome}</p></Card>
      <Card title="Key concepts"><ul>{m.concepts.map((c) => <li key={c}>{c}</li>)}</ul></Card>
      <Card title="Worked example: the Carters"><p>{m.example}</p></Card>
      <Card title="Your exercise"><p>{m.exercise}</p><Link className="btn primary" to={m.tool.to}>{m.tool.label}</Link></Card>
      <Card title="Quiz">
        {m.quiz.map((q, qi) => (
          <fieldset key={qi} className="q" disabled={submitted}>
            <legend>{qi + 1}. {q.q}</legend>
            {q.options.map((o, oi) => (
              <label key={oi} className={`check ${submitted ? (oi === q.answer ? 'right' : picked[qi] === oi ? 'wrong' : '') : ''}`}>
                <input type="radio" name={`q${qi}`} checked={picked[qi] === oi} onChange={() => setPicked(picked.map((p, i) => (i === qi ? oi : p)))} /> {o}
              </label>
            ))}
            {submitted && <p className="small muted">{q.why}</p>}
          </fieldset>
        ))}
        {!submitted ? (
          <button className="btn primary" disabled={picked.some((p) => p === null)} onClick={finish}>Check answers</button>
        ) : (
          <div className="row"><strong role="status">Score: {score} / {m.quiz.length}</strong>
            <button className="btn" onClick={() => { setPicked([null, null, null]); setSubmitted(false) }}>Retry</button>
            <button className="btn primary" onClick={() => nav('/app/lessons')}>Back to lessons</button></div>
        )}
      </Card>
    </>
  )
}
