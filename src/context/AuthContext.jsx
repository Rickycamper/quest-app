// ─────────────────────────────────────────────
// QUEST — Auth Context
// Provides: user, profile, role, loading
// ─────────────────────────────────────────────
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getProfile } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [profile, setProfile]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [authEvent, setAuthEvent] = useState(null)

  // Load profile after auth
  const loadProfile = async (authUser) => {
    if (!authUser) { setProfile(null); return }
    try {
      const p = await getProfile(authUser.id)
      setProfile(p)
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    let ready = false
    const done = () => { if (!ready) { ready = true; setLoading(false) } }

    // Fallback: never stay stuck on loading > 4s
    const timeout = setTimeout(done, 4000)

    // INITIAL_SESSION fires synchronously from localStorage — no network hang
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setAuthEvent(event)
        setUser(session?.user ?? null)
        await loadProfile(session?.user ?? null)
        done()
      }
    )

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  const isStaff = profile?.role === 'staff' || profile?.role === 'admin'
  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isStaff, isAdmin, authEvent, refreshProfile: () => loadProfile(user) }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
