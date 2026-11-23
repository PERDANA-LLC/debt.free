import { useStore } from '../lib/store'
import type { DebtType } from '../lib/types'
import { Num } from './ui'

const types: DebtType[] = ['card', 'auto', 'student', 'medical', 'personal', 'other']

export function DebtTable() {
  const { s, addDebt, updateDebt, removeDebt } = useStore()
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Debt</th><th>Type</th><th>Balance</th><th>APR</th><th>Minimum / mo</th><th>Due day</th><th /></tr>
        </thead>
        <tbody>
          {s.debts.map((d) => (
            <tr key={d.id}>
              <td><input aria-label="Debt name" value={d.name} onChange={(e) => updateDebt(d.id, { name: e.target.value })} /></td>
              <td>
                <select aria-label="Type" value={d.type} onChange={(e) => updateDebt(d.id, { type: e.target.value as DebtType })}>
                  {types.map((t) => <option key={t}>{t}</option>)}
                </select>
              </td>
              <td><Num label={`${d.name} balance`} prefix="$" value={d.balance} onChange={(n) => updateDebt(d.id, { balance: n })} /></td>
              <td><Num label={`${d.name} APR`} suffix="%" step={0.01} value={d.apr} onChange={(n) => updateDebt(d.id, { apr: n })} /></td>
              <td><Num label={`${d.name} minimum`} prefix="$" value={d.minimum} onChange={(n) => updateDebt(d.id, { minimum: n })} /></td>
              <td><Num label={`${d.name} due day`} value={d.dueDay} min={1} onChange={(n) => updateDebt(d.id, { dueDay: Math.min(28, n || 1) })} /></td>
              <td><button className="btn ghost" aria-label={`Remove ${d.name}`} onClick={() => removeDebt(d.id)}>✕</button></td>
            </tr>
          ))}
          {s.debts.length === 0 && <tr><td colSpan={7} className="muted">No debts yet. Add one or load the example household.</td></tr>}
        </tbody>
      </table>
      <div className="row">
        <button className="btn" onClick={addDebt}>+ Add debt</button>
      </div>
    </div>
  )
}
