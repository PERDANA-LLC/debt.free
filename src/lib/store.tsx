import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppState, BudgetLine, Debt } from './types'
import { carters, emptyState } from './sample'
import { api, useAuth } from './auth'

const KEY = 'debtfree.v1'

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...emptyState(), ...JSON.parse(raw) }
  } catch {
    /* storage unavailable: start empty */
  }
  return emptyState()
}

export type SyncStatus = 'local' | 'loading' | 'saved' | 'saving' | 'error'

interface Ctx {
  s: AppState
  set: (patch: Partial<AppState>) => void
  setHousehold: (patch: Partial<AppState['household']>) => void
  addDebt: () => void
  updateDebt: (id: string, patch: Partial<Debt>) => void
  removeDebt: (id: string) => void
  setLines: (lines: BudgetLine[]) => void
  loadExample: () => void
  reset: () => void
  hasPaid: boolean
  sync: SyncStatus
}

const Store = createContext<Ctx | null>(null)

/**
 * Anonymous visitors: state lives in localStorage only.
 * Signed-in users: state also syncs to the household record on the server (last write wins per version;
 * on conflict the server copy is adopted). First sign-in with an empty server record uploads local data.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const { me, hasPaid } = useAuth()
  const [s, setS] = useState<AppState>(load)
  const [sync, setSync] = useState<SyncStatus>('local')
  const version = useRef<number | null>(null)
  const ready = useRef(false) // true once the server copy has been reconciled
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const email = me?.user.email ?? null

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ }
  }, [s])

  // Reconcile with the server whenever the signed-in user changes.
  useEffect(() => {
    ready.current = false
    version.current = null
    if (!email) { setSync('local'); return }
    let cancelled = false
    setSync('loading')
    void api<{ state: Partial<AppState>; version: number }>('/api/state').then((r) => {
      if (cancelled) return
      if (!r.ok) { setSync('error'); return }
      version.current = r.data.version
      if (Object.keys(r.data.state ?? {}).length > 0) setS({ ...emptyState(), ...r.data.state })
      ready.current = true
      setSync('saved')
      if (Object.keys(r.data.state ?? {}).length === 0) setS((p) => ({ ...p })) // push local data up
    })
    return () => { cancelled = true }
  }, [email])

  // Debounced save.
  useEffect(() => {
    if (!email || !ready.current || version.current === null) return
    setSync('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const r = await api<{ version: number; state?: Partial<AppState> }>('/api/state', 'PUT', { state: s, version: version.current })
      if (r.ok) { version.current = r.data.version; setSync('saved') }
      else if (r.status === 409 && r.data.state) {
        version.current = r.data.version
        ready.current = false
        setS({ ...emptyState(), ...r.data.state }) // another login saved first: adopt theirs
        setTimeout(() => { ready.current = true; setSync('saved') }, 0)
      } else setSync('error')
    }, 700)
    return () => clearTimeout(timer.current)
  }, [s, email])

  const value = useMemo<Ctx>(() => ({
    s, sync, hasPaid,
    set: (patch) => setS((p) => ({ ...p, ...patch })),
    setHousehold: (patch) => setS((p) => ({ ...p, household: { ...p.household, ...patch } })),
    addDebt: () => setS((p) => ({
      ...p,
      debts: [...p.debts, { id: crypto.randomUUID(), name: 'New debt', type: 'card', balance: 0, apr: 0, minimum: 0, dueDay: 1 }],
    })),
    updateDebt: (id, patch) => setS((p) => ({ ...p, debts: p.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
    removeDebt: (id) => setS((p) => ({ ...p, debts: p.debts.filter((d) => d.id !== id) })),
    setLines: (lines) => setS((p) => ({ ...p, lines })),
    loadExample: () => setS(carters()),
    reset: () => setS(emptyState()),
  }), [s, sync, hasPaid])

  return <Store.Provider value={value}>{children}</Store.Provider>
}

export function useStore(): Ctx {
  const c = useContext(Store)
  if (!c) throw new Error('useStore outside StoreProvider')
  return c
}
