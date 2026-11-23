import { useMemo, useState } from 'react'
import { fmtUSD, monthlyDebtBudget, totalDebt, totalMinimums } from '../lib/cashflow'
import { fmtMonths, payoffOrder, simulatePayoff } from '../lib/payoff'
import { useStore } from '../lib/store'
import type { Strategy } from '../lib/types'
import { BalanceChart, Card, Disclaimer, Num, Stat } from './ui'

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Not reached')

export function Planner({ useHousehold }: { useHousehold: boolean }) {
  const { s, set } = useStore()
  const mins = totalMinimums(s.debts)
  const [manualExtra, setManualExtra] = useState(0)
  const budget = useHousehold ? monthlyDebtBudget(s.household, s.debts) : mins + manualExtra
  const input = { debts: s.debts, monthlyBudget: budget, strategy: s.strategy, hybridFirstId: s.hybridFirstId }
  const r = useMemo(() => simulatePayoff(input), [s.debts, budget, s.strategy, s.hybridFirstId]) // eslint-disable-line react-hooks/exhaustive-deps
  const other: Strategy = s.strategy === 'avalanche' ? 'snowball' : 'avalanche'
  const alt = useMemo(() => simulatePayoff({ ...input, strategy: other }), [s.debts, budget, s.strategy, s.hybridFirstId]) // eslint-disable-line react-hooks/exhaustive-deps
  const order = payoffOrder(s.debts, s.strategy, s.hybridFirstId)
  const nameOf = (id: string) => s.debts.find((d) => d.id === id)?.name ?? id

  if (s.debts.length === 0) return <Card><p>Add your debts first.</p></Card>

  return (
    <>
      <Card title="Method">
        <div className="seg" role="radiogroup" aria-label="Payoff strategy">
          {(['avalanche', 'snowball', 'hybrid'] as Strategy[]).map((m) => (
            <button key={m} role="radio" aria-checked={s.strategy === m} className={s.strategy === m ? 'on' : ''} onClick={() => set({ strategy: m })}>
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <p className="muted small">
          {s.strategy === 'avalanche' && 'Highest APR first. Saves the most interest.'}
          {s.strategy === 'snowball' && 'Smallest balance first. Faster early wins.'}
          {s.strategy === 'hybrid' && 'Clear one small, stressful bill first, then highest APR.'}
        </p>
        {s.strategy === 'hybrid' && (
          <label className="field">Clear first
            <select value={s.hybridFirstId ?? ''} onChange={(e) => set({ hybridFirstId: e.target.value || null })}>
              <option value="">Choose a debt</option>
              {s.debts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        )}
        <div className="row">
          <span>Total monthly debt payment</span>
          {useHousehold ? (
            <strong>{fmtUSD(budget)} <span className="muted small">({fmtUSD(mins)} minimums + {fmtUSD(budget - mins)} extra, set in Budget)</span></strong>
          ) : (
            <span className="row">
              <strong>{fmtUSD(mins)}</strong> minimums + extra <Num label="Extra per month" prefix="$" value={manualExtra} step={25} onChange={setManualExtra} />
            </span>
          )}
        </div>
      </Card>

      {!r.feasible ? (
        <Card><p role="alert" className="warn">{r.reason}</p></Card>
      ) : (
        <>
          <div className="stats">
            <Stat label="Debt-free date" value={fmtDate(r.debtFreeDate)} sub={fmtMonths(r.months)} />
            <Stat label="Total interest" value={fmtUSD(r.totalInterest)} sub={`on ${fmtUSD(totalDebt(s.debts))} of debt`} />
            <Stat label={`vs. ${other}`} value={fmtUSD(alt.totalInterest - r.totalInterest)} sub={alt.totalInterest >= r.totalInterest ? 'interest saved by your method' : 'extra interest vs. that method'} />
          </div>
          <Card title="Total balance over time"><BalanceChart curve={r.balanceCurve} months={r.months} /></Card>
          <Card title="Payoff order">
            <ol className="order">
              {order.map((d, i) => {
                const pr = r.perDebt.find((x) => x.id === d.id)
                return (
                  <li key={d.id}>
                    <span className="badge">{i + 1}</span>
                    <span className="grow">{nameOf(d.id)} <span className="muted small">{d.apr}% · {fmtUSD(d.balance)}</span></span>
                    <span>{fmtDate(pr?.paidOffDate ?? null)}</span>
                  </li>
                )
              })}
            </ol>
          </Card>
        </>
      )}
      <Disclaimer />
    </>
  )
}
