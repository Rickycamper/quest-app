// ─────────────────────────────────────────────
// QUEST — Auth Context
// Provides: user, profile, role, loading
// ─────────────────────────────────────────────
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getProfile } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]                   = useState(null)
  const [profile, setProfile]             = useState(null)
  const [loading, setLoading]             = useState(true)
  const [authEvent, setAuthEvent]         = useState(null)
  const [recoverySession, setRecoverySession] = useState(null)

  // Load profile after auth. Logs errors (so slow/failed network shows up
  // in console) and retries once with a short delay before giving up.
  const loadProfile = async (authUser, attempt = 1) => {
    if (!authUser) { setProfile(null); return }
    try {
      const p = await getProfile(authUser.id)
      setProfile(p)
    } catch (e) {
      console.warn(`[auth] getProfile failed (attempt ${attempt}):`, e?.message || e)
      if (attempt < 2) {
        setTimeout(() => loadProfile(authUser, attempt + 1), 1500)
        return
      }
      // After 2 failed attempts, keep any existing profile (don't nuke it)
      // so a transient network blip doesn't log the user out of owner/staff UI.
      setProfile(prev => prev ?? null)
    }
  }

  useEffect(() => {
    let ready = false
    const done = () => { if (!ready) { ready = true; setLoading(false) } }

    // Fallback: never stay stuck on loading > 2s
    const timeout = setTimeout(done, 2000)

    // INITIAL_SESSION fires synchronously from localStorage — no network hang.
    // Call done() immediately after setting user so the app renders right away.
    // Profile loads in the background — components read it once it arrives.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setAuthEvent(event)
        setUser(session?.user ?? null)
        // Capture recovery session tokens directly from the event so
        // ResetPasswordScreen can use them even if getSession() returns null
        if (event === 'PASSWORD_RECOVERY' && session) {
          setRecoverySession({ access_token: session.access_token, refresh_token: session.refresh_token })
        }
        done() // unblock the app immediately — don't wait for profile network call
        loadProfile(session?.user ?? null) // load profile in background
      }
    )

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  // ── Realtime: keep q_points (and profile) in sync ──────────────
  // When award_points RPC updates the profiles row, push the new
  // values straight into state so the header coin counter updates
  // without requiring a manual refresh.
  useEffect(() => {
    if (!user?.id) return
    const ch = supabase
      .channel(`profile-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          if (!payload.new) return
          // Only merge into an existing profile. If prev is null (initial load
          // failed), a partial realtime payload (e.g. just {id, q_points})
          // would clobber role/is_owner/etc. — so wait for loadProfile to run.
          setProfile(prev => prev ? { ...prev, ...payload.new } : prev)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id])

  const isOwner   = profile?.is_owner === true
  const isStaff   = profile?.role === 'staff' || profile?.role === 'admin' || isOwner
  const isAdmin   = profile?.role === 'admin' || isOwner
  const isPremium = profile?.role === 'premium' || isStaff // staff+ inherits premium

  return (
    <AuthContext.Provider value={{ user, profile, loading, isStaff, isAdmin, isOwner, isPremium, authEvent, recoverySession, refreshProfile: () => loadProfile(user) }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
