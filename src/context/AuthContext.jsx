// ─────────────────────────────────────────────
// QUEST — Auth Context
// Provides: user, profile, role, loading
// ─────────────────────────────────────────────
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getProfile, getQPoints, acceptTerms } from '../lib/supabase'

const AuthContext = createContext(null)

/**
 * Read the stored Supabase user from localStorage synchronously.
 * Supabase persists the session under a key like "sb-{ref}-auth-token".
 * If found, we can skip the loading screen entirely for returning users —
 * onAuthStateChange will still fire and update state with fresh tokens.
 */
function getStoredUser() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('sb-') && k?.endsWith('-auth-token')) {
        const val = JSON.parse(localStorage.getItem(k) || '{}')
        if (val?.access_token && val?.user?.id) return val.user
      }
    }
  } catch {}
  return null
}

export function AuthProvider({ children }) {
  // Pre-populate user from localStorage so returning users skip the loading screen.
  // useState lazy-init runs once; onAuthStateChange still fires and refreshes state.
  const [user, setUser]                   = useState(getStoredUser)
  const [profile, setProfile]             = useState(null)
  const [loading, setLoading]             = useState(() => !getStoredUser())
  const [authEvent, setAuthEvent]         = useState(null)
  const [recoverySession, setRecoverySession] = useState(null)

  // If the URL has ?code= we're returning from an OAuth/PKCE redirect.
  // The code exchange is an async network call that can easily exceed 2 s —
  // keep loading=true until Supabase fires SIGNED_IN or INITIAL_SESSION.
  const isOAuthCallback = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('code')

  // Load profile after auth. Logs errors (so slow/failed network shows up
  // in console) and retries once with a short delay before giving up.
  const loadProfile = async (authUser, attempt = 1) => {
    if (!authUser) { setProfile(null); return }
    try {
      const p = await getProfile(authUser.id)

      // OAuth users (Discord, Twitch, Facebook) never go through the email
      // sign-up flow that sets terms_accepted_at, so they get stuck on the
      // full-screen TermsModal after every login. Auto-accept for them:
      // the OAuth provider itself is the consent gate, not our terms screen.
      if (p && !p.terms_accepted_at) {
        const provider = authUser?.app_metadata?.provider
        if (provider && provider !== 'email') {
          // Fire-and-forget — don't block profile render on this write
          acceptTerms().then(() => {
            setProfile(prev => prev ? { ...prev, terms_accepted_at: new Date().toISOString() } : prev)
          }).catch(() => {})
          p.terms_accepted_at = new Date().toISOString()
        }
      }

      setProfile(p)
      // Separately fetch q_points so a failure there can't block/null the
      // main profile (keeps isOwner/role stable if the q_points column has
      // any RLS quirks). Merge in once it arrives.
      getQPoints(authUser.id).then(q => {
        if (q != null) setProfile(prev => prev ? { ...prev, q_points: q } : prev)
      })
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

    // OAuth callbacks (Discord, Twitch, etc.) need a network round-trip to exchange
    // the ?code= for a session. Give up to 30 s before falling back to opening screen.
    // Normal loads (no code in URL) keep the original 2 s fallback.
    const timeout = setTimeout(done, isOAuthCallback ? 30_000 : 2_000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setAuthEvent(event)
        setUser(session?.user ?? null)
        if (event === 'PASSWORD_RECOVERY' && session) {
          setRecoverySession({ access_token: session.access_token, refresh_token: session.refresh_token })
        }
        // For OAuth callbacks: hold loading until Supabase tells us the outcome.
        // SIGNED_IN = exchange succeeded. INITIAL_SESSION = exchange failed or no code.
        // For all other loads: unblock immediately on any event.
        if (!isOAuthCallback || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          done()
        }
        loadProfile(session?.user ?? null)
      }
    )

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
