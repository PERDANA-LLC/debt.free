import type { BudgetLine, Debt, Household } from './types'

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function totalMinimums(debts: Debt[]): number {
  return sum(debts.filter((d) => d.balance > 0).map((d) => d.minimum))
}

export function totalDebt(debts: Debt[]): number {
  return sum(debts.map((d) => d.balance))
}

/** Cash left after essentials and debt minimums, before any plan. */
export function cashLeft(h: Household, debts: Debt[]): number {
  return h.takeHome - h.essentials - totalMinimums(debts)
}

export interface PlanCheck {
  planned: number
  unassigned: number // takeHome - essentials - minimums - allocated lines - extraToDebt
  balanced: boolean
}

export function checkPlan(h: Household, debts: Debt[], lines: BudgetLine[]): PlanCheck {
  const planned = sum(lines.filter((l) => l.kind !== 'essential').map((l) => l.amount))
  const unassigned = Math.round((cashLeft(h, debts) - planned - h.extraToDebt) * 100) / 100
  return { planned, unassigned, balanced: Math.abs(unassigned) < 0.005 }
}

export function monthlyDebtBudget(h: Household, debts: Debt[]): number {
  return totalMinimums(debts) + Math.max(0, h.extraToDebt)
}

export function weightedApr(debts: Debt[]): number {
  const t = totalDebt(debts)
  if (t === 0) return 0
  return sum(debts.map((d) => d.balance * d.apr)) / t
}

export function fmtUSD(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits })
}
