import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Client, Profile } from '../lib/types'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  client: Client | null
  isAdmin: boolean
  isDelivery: boolean
  /** admin o delivery */
  isStaff: boolean
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({} as AuthState)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUserData = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null)
      setClient(null)
      return
    }
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.from('clients').select('*').eq('user_id', s.user.id).maybeSingle(),
    ])
    setProfile((p as Profile) ?? null)
    setClient((c as Client) ?? null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadUserData(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
      // diferir para no bloquear el callback de auth
      setTimeout(() => loadUserData(s), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadUserData])

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    client,
    isAdmin: profile?.role === 'admin',
    isDelivery: profile?.role === 'delivery',
    isStaff: profile?.role === 'admin' || profile?.role === 'delivery',
    loading,
    refresh: () => loadUserData(session),
    signOut: async () => {
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
      setClient(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
