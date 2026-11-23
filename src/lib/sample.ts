import type { AppState } from './types'

export function emptyState(): AppState {
  return {
    household: { adultA: '', adultB: '', kids: 0, takeHome: 0, essentials: 0, extraToDebt: 0 },
    debts: [],
    lines: [],
    strategy: 'avalanche',
    hybridFirstId: null,
    starterFundGoal: 1000,
    starterFundSaved: 0,
    checklist: {},
    quiz: {},
    lessonDone: {},
    onboarded: false,
  }
}

/** The Carters after their Module 2 plan: essentials trimmed from $5,520 to $5,280 (groceries -$150, subscriptions/takeout -$90). */
export function carters(): AppState {
  return {
    ...emptyState(),
    household: { adultA: 'Jordan', adultB: 'Sam', kids: 2, takeHome: 7200, essentials: 5280, extraToDebt: 400 },
    debts: [
      { id: 'cardA', name: 'Card A', type: 'card', balance: 5200, apr: 24.9, minimum: 150, dueDay: 5 },
      { id: 'cardB', name: 'Card B', type: 'card', balance: 6100, apr: 21.5, minimum: 170, dueDay: 12 },
      { id: 'cardC', name: 'Card C', type: 'card', balance: 3500, apr: 19.99, minimum: 100, dueDay: 20 },
      { id: 'auto', name: 'Auto loan', type: 'auto', balance: 18600, apr: 6.9, minimum: 445, dueDay: 1 },
      { id: 'student', name: 'Federal student loans', type: 'student', balance: 38000, apr: 5.8, minimum: 355, dueDay: 15 },
      { id: 'medical', name: 'Medical bill', type: 'medical', balance: 2300, apr: 0, minimum: 0, dueDay: 28 },
    ],
    lines: [
      { id: 'sink', name: 'Sinking funds', amount: 150, kind: 'sinking' },
      { id: 'allowA', name: 'Allowance: Jordan', amount: 75, kind: 'allowance' },
      { id: 'allowB', name: 'Allowance: Sam', amount: 75, kind: 'allowance' },
    ],
    onboarded: true,
  }
}
