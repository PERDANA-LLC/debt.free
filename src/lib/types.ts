export type DebtType = 'card' | 'auto' | 'student' | 'medical' | 'personal' | 'other'
export type Strategy = 'avalanche' | 'snowball' | 'hybrid'

export interface Debt {
  id: string
  name: string
  type: DebtType
  balance: number
  apr: number // percent, e.g. 24.9
  minimum: number
  dueDay: number
}

export interface BudgetLine {
  id: string
  name: string
  amount: number
  kind: 'essential' | 'sinking' | 'allowance'
}

export interface Household {
  adultA: string
  adultB: string
  kids: number
  takeHome: number
  essentials: number // monthly essentials excluding debt minimums
  extraToDebt: number
}

export interface AppState {
  household: Household
  debts: Debt[]
  lines: BudgetLine[]
  strategy: Strategy
  hybridFirstId: string | null
  starterFundGoal: number
  starterFundSaved: number
  checklist: Record<string, boolean>
  quiz: Record<string, number> // moduleId -> best score
  lessonDone: Record<string, boolean>
  onboarded: boolean
}
