// Public lesson metadata only. Lesson bodies, quizzes and tool guides live in server/content.ts and are served
// from /api/content/* to signed-in users with access (free modules need only a login).

export interface QuizQ {
  q: string
  options: string[]
  answer: number
  why: string
}

export interface ModuleMeta {
  id: string
  n: number
  title: string
  minutes: number
  outcome: string
  free: boolean
}

export interface LessonBody {
  concepts: string[]
  example: string
  exercise: string
  tool: { label: string; to: string }
  quiz: QuizQ[]
}

export interface ToolsContent {
  protectChecklist: { id: string; label: string }[]
  specialDebtGuide: Record<string, { title: string; steps: string[] }>
}

export const modules: ModuleMeta[] = [
  {
    "id": "m1",
    "n": 1,
    "title": "Know Your Numbers",
    "minutes": 30,
    "outcome": "List every debt with balance, APR, minimum and due date, and calculate the cash left after essentials.",
    "free": true
  },
  {
    "id": "m2",
    "n": 2,
    "title": "A Spending Plan Two Adults Will Keep",
    "minutes": 35,
    "outcome": "Assign every dollar in a monthly plan, including sinking funds, and run a monthly money review with a partner.",
    "free": false
  },
  {
    "id": "m3",
    "n": 3,
    "title": "Cut the Interest Bleed",
    "minutes": 35,
    "outcome": "Calculate monthly interest on each debt and take at least three steps to lower its cost.",
    "free": false
  },
  {
    "id": "m4",
    "n": 4,
    "title": "Choose a Payoff Strategy",
    "minutes": 40,
    "outcome": "Choose avalanche, snowball or a hybrid, and set a payoff order with dates.",
    "free": true
  },
  {
    "id": "m5",
    "n": 5,
    "title": "Handle the Special Debts",
    "minutes": 40,
    "outcome": "Evaluate student loans, auto loans and medical bills, and pick one action for each.",
    "free": false
  },
  {
    "id": "m6",
    "n": 6,
    "title": "Protect the Plan",
    "minutes": 35,
    "outcome": "Set a starter emergency fund, review insurance and withholding, and adopt rules that prevent new debt.",
    "free": false
  },
  {
    "id": "m7",
    "n": 7,
    "title": "Debt-Free and Staying There",
    "minutes": 30,
    "outcome": "Redirect freed-up payments, set the next three goals, and finish a one-page family plan.",
    "free": false
  }
]
