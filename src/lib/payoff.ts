import type { Debt, Strategy } from './types'

export interface PayoffInput {
  debts: Debt[]
  monthlyBudget: number // total dollars per month across all debts
  strategy: Strategy
  hybridFirstId?: string | null
  startDate?: Date
  maxMonths?: number
}

export interface DebtResult {
  id: string
  name: string
  paidOffMonth: number | null // 1-based month index
  paidOffDate: Date | null
  interestPaid: number
}

export interface PayoffResult {
  feasible: boolean
  months: number
  debtFreeDate: Date | null
  totalInterest: number
  totalPaid: number
  perDebt: DebtResult[]
  order: string[]
  /** total remaining balance at end of each month, index 0 = start */
  balanceCurve: number[]
  reason?: string
}

const cents = (n: number) => Math.round(n * 100) / 100

export function monthlyInterest(balance: number, aprPercent: number): number {
  return cents((balance * aprPercent) / 100 / 12)
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1)
  return r
}

export function payoffOrder(debts: Debt[], strategy: Strategy, hybridFirstId?: string | null): Debt[] {
  const active = debts.filter((d) => d.balance > 0)
  const byApr = (a: Debt, b: Debt) => b.apr - a.apr || a.balance - b.balance
  const byBal = (a: Debt, b: Debt) => a.balance - b.balance || b.apr - a.apr
  if (strategy === 'snowball') return [...active].sort(byBal)
  if (strategy === 'hybrid') {
    const first = active.find((d) => d.id === hybridFirstId)
    const rest = active.filter((d) => d.id !== hybridFirstId).sort(byApr)
    return first ? [first, ...rest] : rest
  }
  return [...active].sort(byApr)
}

export function simulatePayoff(input: PayoffInput): PayoffResult {
  const { debts, monthlyBudget, strategy, hybridFirstId } = input
  const start = input.startDate ?? new Date()
  const maxMonths = input.maxMonths ?? 600
  const ordered = payoffOrder(debts, strategy, hybridFirstId)
  const bal = new Map(ordered.map((d) => [d.id, d.balance]))
  const per = new Map<string, DebtResult>(
    ordered.map((d) => [d.id, { id: d.id, name: d.name, paidOffMonth: null, paidOffDate: null, interestPaid: 0 }]),
  )
  const totalMin = ordered.reduce((s, d) => s + d.minimum, 0)
  const empty: PayoffResult = {
    feasible: true, months: 0, debtFreeDate: null, totalInterest: 0, totalPaid: 0,
    perDebt: [], order: [], balanceCurve: [0],
  }
  if (ordered.length === 0) return { ...empty, debtFreeDate: start }
  if (monthlyBudget < totalMin - 0.005) {
    return { ...empty, feasible: false, perDebt: [...per.values()], order: ordered.map((d) => d.id),
      balanceCurve: [ordered.reduce((s, d) => s + d.balance, 0)],
      reason: `Monthly budget ($${monthlyBudget.toFixed(0)}) is below total minimums ($${totalMin.toFixed(0)}).` }
  }

  const curve = [cents(ordered.reduce((s, d) => s + d.balance, 0))]
  let totalInterest = 0
  let totalPaid = 0
  let m = 0
  while (m < maxMonths && [...bal.values()].some((b) => b > 0.005)) {
    m++
    let pool = monthlyBudget
    // accrue interest
    for (const d of ordered) {
      const b = bal.get(d.id)!
      if (b <= 0) continue
      const i = monthlyInterest(b, d.apr)
      bal.set(d.id, cents(b + i))
      per.get(d.id)!.interestPaid = cents(per.get(d.id)!.interestPaid + i)
      totalInterest += i
    }
    // minimums
    for (const d of ordered) {
      const b = bal.get(d.id)!
      if (b <= 0) continue
      const pay = Math.min(d.minimum, b, pool)
      bal.set(d.id, cents(b - pay))
      pool = cents(pool - pay)
      totalPaid += pay
    }
    // extra in priority order
    for (const d of ordered) {
      if (pool <= 0) break
      const b = bal.get(d.id)!
      if (b <= 0) continue
      const pay = Math.min(b, pool)
      bal.set(d.id, cents(b - pay))
      pool = cents(pool - pay)
      totalPaid += pay
    }
    for (const d of ordered) {
      const r = per.get(d.id)!
      if (r.paidOffMonth === null && bal.get(d.id)! <= 0.005) {
        r.paidOffMonth = m
        r.paidOffDate = addMonths(start, m)
      }
    }
    curve.push(cents([...bal.values()].reduce((s, b) => s + b, 0)))
  }
  const done = [...bal.values()].every((b) => b <= 0.005)
  return {
    feasible: done,
    months: m,
    debtFreeDate: done ? addMonths(start, m) : null,
    totalInterest: cents(totalInterest),
    totalPaid: cents(totalPaid),
    perDebt: ordered.map((d) => per.get(d.id)!),
    order: ordered.map((d) => d.id),
    balanceCurve: curve,
    reason: done ? undefined : 'Balances do not reach zero within 50 years. Raise the monthly budget.',
  }
}

/** Months to pay off a single debt at a fixed payment. Infinity if payment <= interest. */
export function monthsToPayoff(balance: number, aprPercent: number, payment: number): number {
  if (balance <= 0) return 0
  const r = aprPercent / 100 / 12
  if (payment <= balance * r) return Infinity
  if (r === 0) return Math.ceil(balance / payment)
  return Math.ceil(-Math.log(1 - (balance * r) / payment) / Math.log(1 + r))
}

export function fmtMonths(n: number): string {
  if (!Number.isFinite(n)) return 'never at this payment'
  const y = Math.floor(n / 12)
  const m = n % 12
  return [y ? `${y} yr` : '', m ? `${m} mo` : ''].filter(Boolean).join(' ') || '0 mo'
}
