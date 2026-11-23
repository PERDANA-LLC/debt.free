import { describe, expect, it } from 'vitest'
import { monthlyInterest, monthsToPayoff, payoffOrder, simulatePayoff } from './payoff'
import { carters } from './sample'
import { cashLeft, checkPlan, totalDebt, totalMinimums, weightedApr } from './cashflow'

describe('Carters worked example', () => {
  const s = carters()
  it('totals $73,700 of debt and $1,220 of minimums', () => {
    expect(totalDebt(s.debts)).toBe(73700)
    expect(totalMinimums(s.debts)).toBe(1220)
  })
  it('leaves $460 after essentials before the plan, $700 after the cuts', () => {
    expect(cashLeft({ ...s.household, essentials: 5520 }, s.debts)).toBe(460)
    expect(cashLeft(s.household, s.debts)).toBe(700)
    expect(checkPlan(s.household, s.debts, s.lines).balanced).toBe(true)
  })
  it('card interest is about $275 a month', () => {
    const cards = s.debts.filter((d) => d.type === 'card')
    const i = cards.reduce((t, d) => t + monthlyInterest(d.balance, d.apr), 0)
    expect(Math.round(i)).toBe(275)
    expect(weightedApr(cards)).toBeCloseTo(22.34, 1)
  })
  it('a 5-point rate cut on the $5,200 card saves about $22 a month', () => {
    expect(Math.round(monthlyInterest(5200, 24.9) - monthlyInterest(5200, 19.9))).toBe(22)
  })
  it('avalanche orders by APR, snowball by balance', () => {
    expect(payoffOrder(s.debts, 'avalanche').map((d) => d.id).slice(0, 5)).toEqual(['cardA', 'cardB', 'cardC', 'auto', 'student'])
    expect(payoffOrder(s.debts, 'snowball').map((d) => d.id).slice(0, 2)).toEqual(['medical', 'cardC'])
  })
  it('$14,800 at 22% is about $271 a month', () => {
    expect(Math.round(monthlyInterest(14800, 22))).toBe(271)
  })
})

describe('simulatePayoff', () => {
  const s = carters()
  const base = { debts: s.debts, monthlyBudget: 1620, startDate: new Date(2026, 0, 1) }
  it('pays everything off with $1,620/mo', () => {
    const r = simulatePayoff({ ...base, strategy: 'avalanche' })
    expect(r.feasible).toBe(true)
    expect(r.months).toBeGreaterThan(36)
    expect(r.months).toBeLessThan(80)
    expect(r.balanceCurve[r.balanceCurve.length - 1]).toBe(0)
  })
  it('avalanche never pays more interest than snowball', () => {
    const a = simulatePayoff({ ...base, strategy: 'avalanche' })
    const b = simulatePayoff({ ...base, strategy: 'snowball' })
    expect(a.totalInterest).toBeLessThanOrEqual(b.totalInterest)
  })
  it('total paid equals principal plus interest', () => {
    const r = simulatePayoff({ ...base, strategy: 'avalanche' })
    expect(r.totalPaid).toBeCloseTo(73700 + r.totalInterest, 0)
  })
  it('hybrid puts the chosen debt first', () => {
    const r = simulatePayoff({ ...base, strategy: 'hybrid', hybridFirstId: 'medical' })
    expect(r.order[0]).toBe('medical')
    expect(r.order[1]).toBe('cardA')
  })
  it('flags a budget below minimums', () => {
    const r = simulatePayoff({ ...base, monthlyBudget: 500, strategy: 'avalanche' })
    expect(r.feasible).toBe(false)
    expect(r.reason).toMatch(/below total minimums/)
  })
  it('flags a budget that never beats interest', () => {
    const r = simulatePayoff({
      debts: [{ id: 'x', name: 'x', type: 'card', balance: 10000, apr: 30, minimum: 100, dueDay: 1 }],
      monthlyBudget: 100, strategy: 'avalanche',
    })
    expect(r.feasible).toBe(false)
  })
  it('handles no debt', () => {
    expect(simulatePayoff({ debts: [], monthlyBudget: 0, strategy: 'avalanche' }).feasible).toBe(true)
  })
})

describe('monthsToPayoff', () => {
  it('is infinite when payment does not cover interest', () => {
    expect(monthsToPayoff(10000, 24, 150)).toBe(Infinity)
  })
  it('matches a known amortization', () => {
    expect(monthsToPayoff(10000, 12, 300)).toBe(41)
  })
})
