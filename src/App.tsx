import { Navigate, Route, Routes } from 'react-router-dom'
import { Budget, Dashboard, Debts, Interest, Lesson, Lessons, PayoffPage, Plan, Protect, Shell, Special } from './pages/AppPages'
import { Calculator, Landing } from './pages/Marketing'
import { Billing, Invite, Login, RequireAuth, Signup } from './pages/Account'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/calculator" element={<Calculator />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/invite/:token" element={<Invite />} />
      <Route element={<RequireAuth />}>
      <Route path="/app" element={<Shell />}>
        <Route path="billing" element={<Billing />} />
        <Route index element={<Dashboard />} />
        <Route path="debts" element={<Debts />} />
        <Route path="budget" element={<Budget />} />
        <Route path="interest" element={<Interest />} />
        <Route path="payoff" element={<PayoffPage />} />
        <Route path="special" element={<Special />} />
        <Route path="protect" element={<Protect />} />
        <Route path="plan" element={<Plan />} />
        <Route path="lessons" element={<Lessons />} />
        <Route path="lessons/:id" element={<Lesson />} />
      </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
