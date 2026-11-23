export interface QuizQ {
  q: string
  options: string[]
  answer: number // index
  why: string
}

export interface Module {
  id: string
  n: number
  title: string
  outcome: string
  minutes: number
  concepts: string[]
  example: string
  exercise: string
  tool: { label: string; to: string }
  free?: boolean
  quiz: QuizQ[]
}

export const modules: Module[] = [
  {
    id: 'm1', n: 1, title: 'Know Your Numbers', minutes: 30, free: true,
    outcome: 'List every debt with balance, APR, minimum and due date, and calculate the cash left after essentials.',
    concepts: [
      'Take-home pay vs. gross pay: only take-home money can be spent.',
      'Fixed, variable and irregular expenses.',
      'APR is a yearly rate; card interest accrues on the balance, usually daily.',
      'Minimum payment vs. payoff: minimums are built to keep you in debt.',
    ],
    example: 'The Carters take home $7,200. Essentials, including $1,220 of debt minimums, are $6,740. That leaves $460, currently spent with no plan.',
    exercise: 'Complete your debt inventory and monthly cash-flow sheet.',
    tool: { label: 'Open Debt Inventory', to: '/app/debts' },
    quiz: [
      { q: 'Why plan from take-home pay instead of gross pay?', options: ['Gross pay is taxed twice', 'Only take-home money can be spent', 'Banks require it', 'It makes debt look smaller'], answer: 1, why: 'Taxes and deductions never reach your account.' },
      { q: 'The Carters take home $7,200 and have $6,740 of essentials including minimums. What is left?', options: ['$460', '$540', '$1,220', '$7,200'], answer: 0, why: '$7,200 − $6,740 = $460.' },
      { q: 'Which four fields does every debt row need?', options: ['Name, color, balance, lender', 'Balance, APR, minimum payment, due date', 'Balance, credit score, limit, date opened', 'APR, term, lender, address'], answer: 1, why: 'Those four drive every calculation in the app.' },
    ],
  },
  {
    id: 'm2', n: 2, title: 'A Spending Plan Two Adults Will Keep', minutes: 35,
    outcome: 'Assign every dollar in a monthly plan, including sinking funds, and run a monthly money review with a partner.',
    concepts: [
      'Zero-based budgeting: every dollar gets a job.',
      'Sinking funds for irregular costs: car repairs, school fees, birthdays.',
      'Personal allowances so neither adult has to justify small purchases.',
      'The monthly money date: 30 minutes, same day each month.',
    ],
    example: 'The Carters cut $150 from groceries (meal planning) and $90 from subscriptions and takeout. Free cash rises from $460 to $700: $150 to sinking funds, $150 to personal allowances, $400 extra to debt.',
    exercise: 'Build a one-month plan with category limits and sinking-fund targets.',
    tool: { label: 'Open Budget Builder', to: '/app/budget' },
    quiz: [
      { q: 'What is a sinking fund?', options: ['A fund that loses value', 'A monthly amount saved for an expense that will come due later', 'An investment account', 'Money borrowed against your house'], answer: 1, why: 'It turns a surprise bill into a planned one.' },
      { q: 'With $700 of free cash, how do the Carters allocate it?', options: ['All $700 to debt', '$150 sinking, $150 allowances, $400 extra debt', '$300 sinking, $400 debt', '$700 to savings'], answer: 1, why: 'Sinking funds and allowances keep the plan realistic enough to stick.' },
      { q: 'Why hold a monthly money review?', options: ['To audit your partner', 'Plans drift; a short review catches problems before they become new debt', 'Banks require it', 'To change your goals every month'], answer: 1, why: 'Small corrections are cheap; big ones are not.' },
    ],
  },
  {
    id: 'm3', n: 3, title: 'Cut the Interest Bleed', minutes: 35,
    outcome: 'Calculate monthly interest on each debt and take at least three steps to lower its cost.',
    concepts: [
      'Monthly interest is roughly APR ÷ 12 × balance. Card issuers usually accrue daily, so treat this as an estimate.',
      'Minimum-only payments can take decades.',
      'Ask each lender for a lower rate; hardship programs exist.',
      'Balance transfers: check the fee, the promo end date, and the rate after the promo.',
      'Stop new charges, or the balance refills.',
    ],
    example: 'The Carters’ three cards cost about $275 a month in interest. Getting the 24.9% card cut to 19.9% saves about $22 a month on its $5,200 balance.',
    exercise: 'Calculate interest on every debt, then use the call script and balance-transfer checklist.',
    tool: { label: 'Open Interest Calculator', to: '/app/interest' },
    quiz: [
      { q: 'Roughly how much interest does $14,800 at 22% APR add in one month?', options: ['About $27', 'About $271', 'About $2,700', 'About $3,256'], answer: 1, why: '$14,800 × 22% ÷ 12 ≈ $271.' },
      { q: 'What must you check before a balance transfer?', options: ['Only the promo rate', 'The transfer fee, the promo end date, and the rate after the promo', 'Your credit limit only', 'Nothing; transfers are free'], answer: 1, why: 'A 3–5% fee and a promo expiry can erase the savings.' },
      { q: 'Why doesn’t a rate cut alone fix the problem?', options: ['Rates always go back up', 'New charges can refill the balance, so spending has to change too', 'Lenders reverse it', 'It lowers your credit score'], answer: 1, why: 'The plan has to stop the inflow, not just slow the cost.' },
    ],
  },
  {
    id: 'm4', n: 4, title: 'Choose a Payoff Strategy', minutes: 40, free: true,
    outcome: 'Choose avalanche, snowball or a hybrid, and set a payoff order with dates.',
    concepts: [
      'Avalanche: highest APR first. Saves the most interest.',
      'Snowball: smallest balance first. Faster early wins.',
      'Hybrid: clear one small, stressful bill first, then use avalanche.',
      'Employer 401(k) match: keeping the full match is a common default, so check the math for your situation.',
      'A starter emergency fund is a choice, not a rule.',
    ],
    example: 'The Carters have $1,620 a month for debt ($1,220 minimums plus $400 extra). Avalanche order: 24.9% card, 21.5% card, 19.99% card, auto, student loans. Snowball starts with the $2,300 medical bill, then the $3,500 card.',
    exercise: 'Pick a method and generate your dated payoff schedule.',
    tool: { label: 'Open Payoff Planner', to: '/calculator' },
    quiz: [
      { q: 'Which card does avalanche pay first for the Carters?', options: ['The $3,500 card', 'The 24.9% card', 'The 21.5% card', 'The smallest balance'], answer: 1, why: 'Avalanche targets the highest APR.' },
      { q: 'What is the main trade-off between avalanche and snowball?', options: ['Avalanche is illegal', 'Avalanche saves more interest; snowball gives faster early wins', 'Snowball costs less interest', 'There is no difference'], answer: 1, why: 'The best method is the one you will actually finish.' },
      { q: 'Why keep contributing to a 401(k) match while paying debt?', options: ['The match is an immediate return on the contribution; confirm the math for your situation', 'It is required by law', 'Debt interest is tax-deductible', 'It lowers your APR'], answer: 0, why: 'Skipping a match is leaving pay on the table.' },
    ],
  },
  {
    id: 'm5', n: 5, title: 'Handle the Special Debts', minutes: 40,
    outcome: 'Evaluate student loans, auto loans and medical bills, and pick one action for each.',
    concepts: [
      'Federal student loans have repayment options and protections that private loans may not.',
      'Refinancing federal loans into private loans can lock in a lower rate and remove those protections.',
      'Medical bills: ask for an itemized bill, check the insurer’s explanation of benefits, ask about financial assistance.',
      'Auto refinancing helps only if total interest falls, not just the payment.',
      'Mortgage prepayment vs. saving is a decision to model, not a rule.',
    ],
    example: 'The Carters check their student-loan plan with the servicer first, request an itemized bill for the $2,300 medical balance, and compare total interest, not just the payment, before touching the auto loan.',
    exercise: 'Complete a one-page decision sheet for each special debt you carry.',
    tool: { label: 'Open Special-Debt Guide', to: '/app/special' },
    quiz: [
      { q: 'What should you request before paying a medical bill?', options: ['A payment plan only', 'An itemized bill and the insurer’s explanation of benefits', 'A new insurer', 'Nothing'], answer: 1, why: 'Billing errors are common; check before you pay.' },
      { q: 'What can you lose by refinancing federal student loans with a private lender?', options: ['Nothing', 'Federal protections such as income-driven plans and public service loan forgiveness eligibility', 'Your credit history', 'Your degree'], answer: 1, why: 'Verify current federal terms before deciding.' },
      { q: 'Why can a lower auto payment still cost more?', options: ['Lenders add hidden fees', 'A longer term increases total interest', 'Cars lose value', 'It cannot'], answer: 1, why: 'Compare total interest paid, not only the monthly payment.' },
    ],
  },
  {
    id: 'm6', n: 6, title: 'Protect the Plan', minutes: 35,
    outcome: 'Set a starter emergency fund, review insurance and withholding, and adopt rules that prevent new debt.',
    concepts: [
      'Starter emergency fund: a small cushion so surprises stop going on cards.',
      'Insurance basics: employer life and disability coverage; term life when dependents rely on your income.',
      'Dependent care accounts and childcare tax benefits (verify current amounts).',
      'W-4 withholding: a large refund means you overpaid during the year.',
      'No-new-debt rules: buy now, pay later, 0% promo offers, cash or debit for variable spending.',
    ],
    example: 'The Carters build a $1,000 starter fund from $150 a month in sinking funds over about seven months. Then that $150 moves to debt.',
    exercise: 'Complete the protection checklist and set your starter-fund goal.',
    tool: { label: 'Open Protection Checklist', to: '/app/protect' },
    quiz: [
      { q: 'Why keep a starter fund while paying down debt?', options: ['It earns more than debt costs', 'Without one, the next surprise repair goes back on a card and undoes progress', 'It is required', 'It improves your APR'], answer: 1, why: 'A cushion protects your momentum.' },
      { q: 'What does a large tax refund usually mean?', options: ['You earned a bonus', 'You overpaid through withholding and lent the government money interest-free', 'You underpaid', 'Nothing'], answer: 1, why: 'Review your W-4 with a tax professional.' },
      { q: 'Which rule helps keep the balance from growing again?', options: ['Use cash or debit for variable spending', 'Use the card with the highest limit', 'Open a new 0% card each year', 'Skip the budget'], answer: 0, why: 'Cash and debit cap what you can spend.' },
    ],
  },
  {
    id: 'm7', n: 7, title: 'Debt-Free and Staying There', minutes: 30,
    outcome: 'Redirect freed-up payments, set the next three goals, and finish a one-page family plan.',
    concepts: [
      'Redirect each paid-off debt’s full payment to the next goal, not to spending.',
      'Full emergency fund: three to six months of essential expenses.',
      'Retirement contributions and credit-score rebuilding.',
      'Education savings options (verify plan rules).',
      'An annual money review keeps the plan current.',
    ],
    example: 'When the 24.9% card is paid off, its full monthly payment moves to the next debt in the chosen order.',
    exercise: 'Finish your Family Debt-Free Plan: payoff order and dates, monthly budget, emergency fund target, retirement contributions, and your next review date.',
    tool: { label: 'Open Family Plan', to: '/app/plan' },
    quiz: [
      { q: 'Where does a paid-off card’s payment go?', options: ['Back to spending', 'To the next debt in your order, or the next goal', 'To a new card', 'It disappears'], answer: 1, why: 'The payment is already in your budget; keep using it.' },
      { q: 'What usually comes right after debt-free?', options: ['A bigger car', 'A full emergency fund', 'A new loan', 'Stopping the budget'], answer: 1, why: 'It protects what you just built.' },
      { q: 'Why keep an annual review?', options: ['Income, childcare costs and rules change, so the plan needs updating', 'It is required by banks', 'To refinance yearly', 'It is not needed'], answer: 0, why: 'A plan is a living document.' },
    ],
  },
]

export const getModule = (id: string) => modules.find((m) => m.id === id)

export const protectChecklist = [
  { id: 'starter', label: 'Set a starter emergency fund goal' },
  { id: 'employerLife', label: 'Check employer life and disability coverage' },
  { id: 'term', label: 'Review term life if dependents rely on your income' },
  { id: 'dcfsa', label: 'Ask HR about a dependent care account (verify current limits)' },
  { id: 'w4', label: 'Review W-4 withholding with a tax professional' },
  { id: 'bnpl', label: 'Delete buy-now-pay-later apps' },
  { id: 'promo', label: 'Decline 0% promo card offers while paying down debt' },
  { id: 'cash', label: 'Switch variable spending to cash or debit' },
]

export const specialDebtGuide = {
  student: {
    title: 'Student loans',
    steps: [
      'Log in to the loan servicer and confirm whether each loan is federal or private.',
      'For federal loans, confirm your current repayment plan and options on the official studentaid.gov site. Terms have changed recently.',
      'Before refinancing into a private loan, list the federal protections you would lose.',
      'Never pay a company for “forgiveness” help. Official federal programs are free to apply for.',
    ],
  },
  medical: {
    title: 'Medical bills',
    steps: [
      'Request an itemized bill.',
      'Compare it to your insurer’s explanation of benefits.',
      'Ask the provider about financial assistance.',
      'Negotiate a lower amount or a zero-interest payment plan, in writing.',
      'Track whether the account has gone to collections.',
    ],
  },
  auto: {
    title: 'Auto loan',
    steps: [
      'Check the current rate and remaining term.',
      'Compare refinance offers on total interest, not only the payment.',
      'Do not extend the term just to lower the payment.',
      'Refinance only after your credit score has improved.',
    ],
  },
  mortgage: {
    title: 'Mortgage (decision guide)',
    steps: [
      'Compare your mortgage rate with your highest-APR debt first.',
      'Keep your emergency fund before prepaying a mortgage.',
      'Model prepayment against saving or retirement contributions; the right answer depends on your rate and goals.',
    ],
  },
} as const
