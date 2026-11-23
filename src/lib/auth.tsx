import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface Me {
  user: { email: string; isOwner: boolean }
  household: {
    members: { email: string; isOwner: boolean }[]
    access: 'subscribed' | 'trial' | 'none'
    trialEndsAt: number
    subStatus: string | null
    periodEnd: number | null
    hasCustomer: boolean
  }
}

export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

interface AuthCtx {
  me: Me | null
  loading: boolean
  hasPaid: boolean
  login: (email: string, password: string) => Promise<string | null>
  register: (email: string, password: string) => Promise<string | null>
  acceptInvite: (token: string, email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const r = await api<Me>('/api/me')
    setMe(r.ok ? r.data : null)
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const submit = useCallback(async (path: string, body: unknown) => {
    const r = await api<Me>(path, 'POST', body)
    if (!r.ok) return r.data.error ?? 'Something went wrong. Try again.'
    setMe(r.data)
    return null
  }, [])

  const value = useMemo<AuthCtx>(() => ({
    me, loading,
    hasPaid: !!me && me.household.access !== 'none',
    login: (email, password) => submit('/api/auth/login', { email, password }),
    register: (email, password) => submit('/api/auth/register', { email, password }),
    acceptInvite: (token, email, password) => submit(`/api/invite/${encodeURIComponent(token)}/accept`, { email, password }),
    logout: async () => { await api('/api/auth/logout', 'POST', {}); setMe(null) },
    refresh,
  }), [me, loading, submit, refresh])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth outside AuthProvider')
  return c
}
