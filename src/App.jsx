// ─────────────────────────────────────────────
// QUEST — App.jsx  (main router)
// ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, useMemo, Component, lazy, Suspense } from 'react'
import * as Sentry from '@sentry/react'
import questLogo from './assets/quest-logo-sm.png'
import { GuestContext, useGuest } from './context/GuestContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/Confirm'
import { useNotifications } from './hooks/useNotifications'
import { OpeningScreen, SignupScreen, EmailSignupScreen, LoginScreen, ForgotPasswordScreen, ResetPasswordScreen, TermsModal, friendlyOAuthError } from './screens/AuthScreens'
import FeedScreen            from './screens/FeedScreen'

// ── Lazy-loaded screens & modals ──────────────────────────────────────────────
// Each of these becomes its own JS chunk that's only downloaded when needed.
// Cuts the initial bundle from ~776 KB → ~200 KB.
const ProfileScreen         = lazy(() => import('./screens/ProfileScreen'))
const EditProfileScreen     = lazy(() => import('./screens/EditProfileScreen'))
const RankingsScreen        = lazy(() => import('./screens/RankingsScreen'))
const FolderScreen          = lazy(() => import('./screens/FolderScreen'))
const TrackingScreen        = lazy(() => import('./screens/TrackingScreen'))
const CreatePackageModal    = lazy(() => import('./screens/TrackingScreen').then(m => ({ default: m.CreatePackageModal })))
const CreatePostModal       = lazy(() => import('./screens/CreatePostModal'))
const ClaimModal            = lazy(() => import('./screens/ClaimModal'))
const CreateTournamentModal = lazy(() => import('./screens/CreateTournamentModal'))
const CreateLeagueModal     = lazy(() => import('./screens/CreateLeagueModal'))
const AdminScreen           = lazy(() => import('./screens/AdminScreen'))
const AuctionScreen         = lazy(() => import('./screens/AuctionScreen'))
const QuestHubScreen        = lazy(() => import('./screens/QuestHubScreen'))
const LifeCounterScreen     = lazy(() => import('./screens/LifeCounterScreen'))
const ChatScreen            = lazy(() => import('./screens/ChatScreen'))
const LogMatchModal         = lazy(() => import('./screens/LogMatchModal'))
const SearchScreen          = lazy(() => import('./screens/SearchScreen'))
const ShopScreen            = lazy(() => import('./screens/ShopScreen'))

// Fallback shown while a chunk is being downloaded. Dark background so it
// blends with the app; spinner is intentionally minimal — most chunks load
// in <300 ms on 4G so a heavy skeleton would flash unpleasantly.
function ScreenFallback() {
  return (
    <div style={{
      minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0A0A0A',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        border: '2px solid #2A2A2A', borderTopColor: '#A78BFA',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  )
}

// ── Chunk-load error detection ────────────────────────────────────────────────
// When a new deploy lands, users on an old bundle may request lazy chunks that
// no longer exist on the server. React surfaces this as "ChunkLoadError" or as
// a "failed to fetch dynamically imported module" error. Without recovery, the
// user gets a permanent crash card. Cheap fix without paid Skew Protection:
// detect the chunk-load case and auto-reload once (so they get the fresh bundle).
function isChunkLoadError(e) {
  const msg = (e?.message || e?.name || '').toLowerCase()
  return (
    e?.name === 'ChunkLoadError' ||
    msg.includes('chunkloaderror') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading chunk')
  )
}
// One-shot guard so a chunk load that keeps failing (real outage, offline) doesn't
// reload-loop the page. Stored in sessionStorage so it resets per browser tab session.
const RELOAD_FLAG = 'quest_chunk_reload_at'
function reloadOncePerSession() {
  try {
    const last = parseInt(sessionStorage.getItem(RELOAD_FLAG) || '0', 10)
    // If we reloaded for this reason in the last 15s, don't loop — show the error.
    if (Date.now() - last < 15_000) return false
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
    window.location.reload()
    return true
  } catch { return false }
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  componentDidCatch(error, info) {
    // Surface to console so the user can screenshot it if needed
    console.error('[ErrorBoundary]', this.props.label || 'root', error, info?.componentStack)
    // Chunk-load errors after a deploy: silently reload to fetch the new bundle.
    // This handles the common case where lazy-loaded screens go 404 mid-session.
    if (isChunkLoadError(error) && reloadOncePerSession()) return
    // Report to Sentry with the boundary label (which tab/screen crashed)
    try {
      Sentry.withScope(scope => {
        scope.setTag('error_boundary', this.props.label || 'root')
        scope.setTag('error_type', isChunkLoadError(error) ? 'chunk_load' : 'runtime')
        scope.setContext('componentStack', { stack: info?.componentStack || '' })
        Sentry.captureException(error)
      })
    } catch {}
  }
  componentDidUpdate(prevProps) {
    // Auto-reset when the resetKey changes (e.g. user switches tab).
    // Without this, a single screen crash would stay "stuck" forever.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }
  render() {
    if (this.state.error) {
      const compact = this.props.compact
      const msg = this.state.error?.message || String(this.state.error)
      return (
        <div style={{
          minHeight: compact ? 300 : '100%',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          background:'#0A0A0A', padding: compact ? 32 : 24, gap:14, textAlign:'center',
        }}>
          <div style={{ fontSize: compact ? 36 : 32 }}>⚠️</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#E5E5E5' }}>
            {compact ? 'Esta pantalla no se pudo cargar' : 'Algo salió mal'}
          </div>
          <div style={{ color:'#9CA3AF', fontSize:12, fontFamily:'monospace', maxWidth:320, wordBreak:'break-word', lineHeight:1.6 }}>
            {msg}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button onClick={() => this.setState({ error: null })} style={{
              padding:'10px 22px', background:'transparent', border:'1px solid #2A2A2A',
              color:'#E5E5E5', borderRadius:10, fontWeight:700, fontSize:13, cursor:'pointer',
            }}>Reintentar</button>
            <button onClick={() => window.location.reload()} style={{
              padding:'10px 22px', background:'#FFF', border:'none',
              color:'#111', borderRadius:10, fontWeight:700, fontSize:13, cursor:'pointer',
            }}>Recargar app</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

import { acceptTerms, subscribeToPush, supabase } from './lib/supabase'
import { BottomNav, NotifBell } from './components/Nav'
import { ShieldIcon, SearchIcon, DiamondIcon } from './components/Icons'
// NotificationPanel + OnboardingModal + FeatureTour lazy-loaded — none shows on first render
const NotificationPanel = lazy(() => import('./components/NotificationPanel'))
const OnboardingModal   = lazy(() => import('./components/OnboardingModal'))
const FeatureTour       = lazy(() => import('./components/FeatureTour'))
import Avatar from './components/Avatar'
import InstallPrompt from './components/InstallPrompt'
import OfflineBanner from './components/OfflineBanner'
import DCPreviewToggle from './components/DCPreviewToggle'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

const globalCSS = `
  /* Inter is the fallback when SF Pro isn't available (Android, Windows).
     The system font stack below resolves to SF Pro Display/Text on Apple
     devices automatically — that's why questhobbystore.com feels noticeably
     more native on iPhone Safari now. */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: 100%; }
  body {
    height: 100%; background: #1A1A1A;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif;
    overflow: hidden; font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  .phone-wrap { display:flex; justify-content:center; align-items:center; height:100vh; padding:20px; overflow:hidden; }
  /* .phone bg is transparent so the body's ambient gradient bleeds through
     to whatever's underneath the cards. The desktop "device frame" still
     shows via the box-shadow (which paints the bezel + drop). */
  .phone { width:390px; height:844px; border-radius:44px; overflow:hidden; position:relative; background:transparent; box-shadow:0 30px 80px rgba(0,0,0,0.6), 0 0 0 6px #111111; display:flex; flex-direction:column; }
  @media (max-width: 480px) {
    /*
     * URL bar collapse strategy:
     * - body has NO overflow:hidden and NO position:fixed → Safari can detect
     *   native touch-scroll on .screen-scroll and collapse its URL bar.
     * - .phone-wrap clips the phone visually (overflow:hidden) without
     *   restricting the body, so Safari sees an unrestricted scroll context.
     * - No window.scrollBy() hacks needed (they caused the black bar).
     * - Chrome Android 108+ also collapses from overflow container scroll.
     */
    html { height: 100%; }
    /* Keep the body's ambient gradient visible on mobile. The original
       solid #0A0A0A here was killing the glow under .phone — replicating
       the same radial set so the gradient survives the media query. */
    body {
      min-height: 100%;
      background:
        radial-gradient(ellipse 60% 50% at 15% 10%, rgba(59,130,246,0.10) 0%, transparent 65%),
        radial-gradient(ellipse 55% 45% at 85% 35%, rgba(167,139,250,0.10) 0%, transparent 65%),
        radial-gradient(ellipse 70% 40% at 50% 110%, rgba(251,146,60,0.07) 0%, transparent 65%),
        #08080C;
      background-attachment: fixed;
    }
    .phone-wrap { padding:0; display:flex; align-items:stretch; width:100%; height:100dvh; overflow:hidden; }
    .phone { width:100%; height:100%; border-radius:0; box-shadow:none; background:transparent; }
    input, textarea, select { font-size: 16px !important; }
  }
  .app-header { flex-shrink:0; }
  /* screen-scroll bg also transparent so the ambient gradient reaches
     all the way up to the cards (glass picks it up through blur). */
  .screen-scroll { flex:1; overflow-y:auto; overflow-x:hidden; scrollbar-width:none; padding-bottom:calc(64px + env(safe-area-inset-bottom, 0px)); padding-top:calc(56px + env(safe-area-inset-top, 0px)); min-height:0; background:transparent; }
  .screen-scroll::-webkit-scrollbar { display:none; }
  .filter-scroll { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; touch-action:pan-x; -webkit-overflow-scrolling:touch; }
  .filter-scroll::-webkit-scrollbar { display:none; }
  /* Animations — built-in spring overshoot so every callsite gets the "Apple
     bounce" without needing to edit each animation: ... line. The overshoot
     keyframe at ~65% travels PAST the destination, then settles back. This
     is how iOS UIKit springs work under the hood. */
  @keyframes fadeUp   {
    0%   { opacity: 0; transform: translateY(8px); }
    65%  { opacity: 1; transform: translateY(-2px); }   /* gentle overshoot */
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideUp  {
    0%   { opacity: 0; transform: translateY(30px); }
    65%  { opacity: 1; transform: translateY(-6px); }   /* bouncy entrance */
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideDown{
    0%   { opacity: 0; transform: translateY(-20px); }
    65%  { opacity: 1; transform: translateY(4px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin     { to{transform:rotate(360deg)} }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes bounce   { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-14px)} 60%{transform:translateY(-7px)} }
  @keyframes fadeInOut{ 0%{opacity:0;transform:translateX(-50%) translateY(-6px)} 20%,80%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0;transform:translateX(-50%) translateY(-6px)} }
  @keyframes likePop  { 0%{transform:scale(1)} 20%{transform:scale(1.55)} 45%{transform:scale(0.88)} 70%{transform:scale(1.22)} 100%{transform:scale(1.15)} }
  @keyframes tabBounce{ 0%{transform:scale(1) translateY(0)} 30%{transform:scale(1.32) translateY(-4px)} 65%{transform:scale(0.91) translateY(0)} 100%{transform:scale(1) translateY(0)} }
  @keyframes iconPop  { 0%{transform:scale(1)} 35%{transform:scale(1.22)} 65%{transform:scale(0.92)} 100%{transform:scale(1)} }
  @keyframes ringPulse { 0%{box-shadow:0 0 0 0 rgba(167,139,250,0.55)} 65%{box-shadow:0 0 0 11px rgba(167,139,250,0)} 100%{box-shadow:0 0 0 0 rgba(167,139,250,0)} }
  @keyframes fadeInFast  { 0%{opacity:0} 100%{opacity:1} }
  @keyframes fadeOutFast { 0%{opacity:1} 100%{opacity:0} }
  @keyframes shimmer     { 0%{background-position:-400px 0} 100%{background-position:calc(400px + 100%) 0} }
  @keyframes onboardPop  { 0%{transform:scale(0.5);opacity:0} 100%{transform:scale(1);opacity:1} }
  @keyframes toastIn { from { opacity: 0; transform: translateY(-12px) scale(0.95); } to   { opacity: 1; transform: translateY(0)    scale(1);    } }
  @keyframes heartPop { 0%   { transform: scale(1);    } 40%  { transform: scale(1.35); } 70%  { transform: scale(0.88); } 100% { transform: scale(1);    } }
  button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  button:not([disabled]):active { opacity: 0.72; }
`

// GuestContext + useGuest are in ./context/GuestContext.jsx (avoids circular imports)

function GuestGateModal({ onLogin, onSignup, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 390,
        background: '#111', borderRadius: '24px 24px 0 0',
        padding: '28px 24px calc(28px + env(safe-area-inset-bottom, 0px))',
        animation: 'slideUp 0.25s ease',
      }}>
        <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 10 }}>⚔️</div>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#FFF', textAlign: 'center', marginBottom: 6 }}>
          Únete a la batalla
        </div>
        <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 1.5, marginBottom: 24 }}>
          Crea tu cuenta para dar likes, interactuar con jugadores y mucho más.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={onSignup} style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: '#FFF', border: 'none', color: '#111',
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
          }}>Crear cuenta</button>
          <button onClick={onLogin} style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: 'transparent', border: '1px solid #2A2A2A', color: '#9CA3AF',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>Ya tengo cuenta — Log in</button>
        </div>
      </div>
    </div>
  )
}

function AuthFlow({ onGuest, initialScreen, onDone, oauthError }) {
  const [screen, setScreen] = useState(initialScreen ?? 'opening')
  const back = onDone ? onDone : () => setScreen('opening')
  if (screen === 'opening')        return <OpeningScreen        onSignIn={() => setScreen('login')}   onSignUp={() => setScreen('signup')} onGuest={onGuest} oauthError={oauthError} />
  if (screen === 'signup')         return <SignupScreen         onEmail={() => setScreen('email-signup')} onLogin={() => setScreen('login')} />
  if (screen === 'email-signup')   return <EmailSignupScreen    onBack={() => setScreen('signup')}   onDone={() => setScreen('login')} />
  if (screen === 'login')          return <LoginScreen          onBack={back}  onSignUp={() => setScreen('signup')} onForgot={() => setScreen('forgot')} oauthError={oauthError} />
  if (screen === 'forgot')         return <ForgotPasswordScreen onBack={() => setScreen('login')}    onDone={() => setScreen('login')} />
  return null
}

function MainApp({ initialTab, openTournamentId, openLeagueId, openUsername } = {}) {
  const { user, profile, isStaff, isOwner, isAdmin, refreshProfile } = useAuth()
  const { isGuest, requireAuth } = useGuest()
  const { notifications, unreadCount, markRead, markAll, markResponded } = useNotifications()
  const [activeTab,      setActiveTab]     = useState(initialTab ?? 'feed')
  const [showNotifs,      setShowNotifs]     = useState(false)
  const [showSearch,      setShowSearch]     = useState(false)
  const [showPost,        setShowPost]       = useState(false)
  const [showClaim,       setShowClaim]      = useState(false)
  const [showTournament,  setShowTournament] = useState(false)
  const [showLeague,      setShowLeague]     = useState(false)
  const [showAdmin,       setShowAdmin]      = useState(false)
  const [viewingUserId,   setViewingUserId]  = useState(null)
  // Resolve deep-linked ?u=username → user id and open the profile overlay once.
  // Runs on mount only; if the username doesn't exist we silently no-op
  // (no point flashing an error for a stale share link).
  useEffect(() => {
    if (!openUsername) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', openUsername)
          .maybeSingle()
        if (!cancelled && data?.id) setViewingUserId(data.id)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [openUsername])
  const [showEditProfile, setShowEditProfile]= useState(false)
  const [chatUser,        setChatUser]       = useState(null)   // { id, username }
  const [vsUser,          setVsUser]         = useState(null)   // { id, username } | null = no preselect
  const [showMatchModal,    setShowMatchModal]    = useState(false)
  const [showPackageCreate, setShowPackageCreate] = useState(false)
  const [showTracking,      setShowTracking]      = useState(false)
  const [packageRefreshKey, setPackageRefreshKey] = useState(0)
  const [showAuction,       setShowAuction]       = useState(false)
  const [showHub,           setShowHub]           = useState(false)
  const [hubInitialView,    setHubInitialView]    = useState(null)
  const [showLifeCounter,   setShowLifeCounter]   = useState(false)
  const [feedRefreshKey,    setFeedRefreshKey]    = useState(0)
  const [showOnboarding,    setShowOnboarding]    = useState(false)
  const [showFeatureTour,   setShowFeatureTour]   = useState(false)
  const [headerHidden, setHeaderHidden] = useState(false)
  const [navHidden,    setNavHidden]    = useState(false)
  const lastScrollY  = useRef(0)
  const scrollRef    = useRef(null)
  const scrollTickRef = useRef(false)

  // Scroll fires ~60+ times per second. Each setHeaderHidden/setNavHidden
  // call re-renders the entire MainApp subtree, which is expensive on the
  // feed. rAF-throttle so we only run the logic ONCE per frame.
  const handleScroll = (e) => {
    if (scrollTickRef.current) return
    scrollTickRef.current = true
    const target = e.currentTarget
    requestAnimationFrame(() => {
      const y = target.scrollTop
      const delta = y - lastScrollY.current
      if (delta > 16 && y > 60) { setHeaderHidden(true);  setNavHidden(true)  }
      else if (delta < -12)     { setHeaderHidden(false); setNavHidden(false) }
      lastScrollY.current = y
      scrollTickRef.current = false
    })
  }

  // Register push notifications once per user session
  useEffect(() => {
    if (!profile?.id) return
    subscribeToPush(profile.id)
  }, [profile?.id])

  // Pre-warm the Shop chunk + product cache 2 s after the feed settles, so
  // tapping the Shop tab for the first time feels instant. Pulls the lazy
  // chunk early and calls the named prefetch helper from it.
  useEffect(() => {
    if (!profile?.id) return
    const t = setTimeout(() => {
      import('./screens/ShopScreen').then(m => m.prefetchShopProducts?.()).catch(() => {})
    }, 2000)
    return () => clearTimeout(t)
  }, [profile?.id])

  // Expose openSearch globally so QuestHub can trigger it after closing
  useEffect(() => {
    window.__questOpenSearch = () => setShowSearch(true)
    return () => { delete window.__questOpenSearch }
  }, [])

  // Show onboarding once per user (tracked in localStorage).
  // Small delay so auth + profile are fully settled before we check.
  useEffect(() => {
    if (!profile?.id) return
    const t = setTimeout(() => {
      const key = `quest_ob2_${profile.id}`
      if (!localStorage.getItem(key)) setShowOnboarding(true)
    }, 400)
    return () => clearTimeout(t)
  }, [profile?.id])

  const handleOnboardingDone = () => {
    if (profile?.id) localStorage.setItem(`quest_ob2_${profile.id}`, '1')
    setShowOnboarding(false)
  }

  // FeatureTour — actionable walkthrough for returning users (one-shot).
  // Fires ONLY when the legacy onboarding is finished/dismissed AND the tour
  // hasn't been completed yet — never shows back-to-back with onboarding.
  // Delay 2.5 s so the app settles, the feed renders, etc.
  useEffect(() => {
    if (!profile?.id) return
    if (showOnboarding) return  // legacy onboarding takes priority on first signup
    const t = setTimeout(() => {
      const key = `quest_feature_tour_done_v1_${profile.id}`
      if (!localStorage.getItem(key)) setShowFeatureTour(true)
    }, 2500)
    return () => clearTimeout(t)
  }, [profile?.id, showOnboarding])

  // Owner profile (RickyQuest) — used as the demo recipient in the tracking
  // step so the owner can clean up the test packages later.
  const DEMO_OWNER = {
    id: '3efec9b5-35ab-4b91-b3d7-38631ab13cbb',
    username: 'RickyQuest',
    avatar_url: null,
  }

  // FeatureTour action callback: open the relevant flow for the step the
  // user tapped "Probar ahora" on. After this fires, the tour closes itself
  // and the flag is set so it never shows again.
  const handleTourAction = useCallback((action) => {
    setShowFeatureTour(false)
    if (action === 'profile') {
      // Open own profile → then Edit overlay
      const id = profile?.id ?? user?.id
      if (id) { setViewingUserId(id); setShowEditProfile(true) }
    } else if (action === 'match') {
      setVsUser(null); setShowMatchModal(true)
    } else if (action === 'tracking') {
      // Pre-fill recipient = owner so any demo packages land on RickyQuest's
      // dashboard and can be deleted afterwards.
      window.__questDemoRecipient = DEMO_OWNER
      setShowPackageCreate(true)
    } else if (action === 'rankings') {
      setActiveTab('ranks')
      setVisitedTabs(prev => { if (prev.has('ranks')) return prev; const next = new Set(prev); next.add('ranks'); return next })
    } else if (action === 'tournaments') {
      setActiveTab('ranks')
      setVisitedTabs(prev => { if (prev.has('ranks')) return prev; const next = new Set(prev); next.add('ranks'); return next })
    }
  }, [profile?.id, user?.id])

  const handleViewProfile = useCallback((userId) => setViewingUserId(userId), [])
  const handleOwnProfile  = useCallback(() => {
    const id = profile?.id ?? user?.id
    if (id) setViewingUserId(id)
  }, [profile?.id, user?.id])

  // Lazy mount: only render a screen after it has been visited for the first time.
  // FeedScreen is pre-visited so it loads immediately; all others wait until tapped.
  const [visitedTabs, setVisitedTabs] = useState(() => {
    const s = new Set(['feed'])
    if (initialTab && initialTab !== 'feed') s.add(initialTab) // pre-mount deep-linked tab
    return s
  })

  const screenMap = useMemo(() => ({
    feed:     <FeedScreen     profile={profile} isStaff={isStaff} isOwner={isOwner} onViewProfile={(id) => requireAuth(() => handleViewProfile(id))} onPost={() => requireAuth(() => setShowPost(true))} refreshKey={feedRefreshKey} />,
    // Shop is visible to everyone; ShopScreen internally gates add/edit/delete
    // behind canEdit = isOwner || isStaff, so regular users see a read-only catalog.
    shop:     <ShopScreen isOwner={isOwner} isStaff={isStaff} />,
    ranks:    <RankingsScreen profile={profile} isStaff={isStaff} isAdminOrOwner={isOwner || isAdmin} onReportClaim={() => setShowClaim(true)} onCreateTournament={() => setShowTournament(true)} onCreateLeague={() => setShowLeague(true)} onViewProfile={handleViewProfile} openTournamentId={openTournamentId} openLeagueId={openLeagueId} />,
    folder:   <FolderScreen   profile={profile} />,
    search:   <SearchScreen   onViewProfile={handleViewProfile} />,
  }), [profile, isStaff, isOwner, handleViewProfile, feedRefreshKey])

const needsTerms = profile && !profile.terms_accepted_at

  const handleAcceptTerms = async () => {
    await acceptTerms()
    await refreshProfile()
  }

  return (
    <Suspense fallback={<ScreenFallback />}>
      {needsTerms && (
        <TermsModal acceptOnly onAccept={handleAcceptTerms} />
      )}
      {/* Onboarding shown once per user. TermsModal (z:9999) overlaps it if terms are pending. */}
      {showOnboarding && (
        <OnboardingModal onDone={handleOnboardingDone} />
      )}
      {/* Feature Tour — actionable walkthrough for returning users (one-shot).
          Closes itself + flags done on either skip or any "Probar ahora" tap. */}
      {showFeatureTour && profile?.id && (
        <FeatureTour
          userId={profile.id}
          onSkip={() => setShowFeatureTour(false)}
          onAction={handleTourAction}
        />
      )}
      {showNotifs && (
        <NotificationPanel profile={profile} notifications={notifications}
          onClose={() => setShowNotifs(false)} onMarkRead={markRead} onMarkAll={markAll}
          onMarkResponded={markResponded}
          onNavigate={(tab) => { setActiveTab(tab); setShowNotifs(false) }}
          onOpenChat={(u) => { setChatUser(u); setShowNotifs(false) }}
          onViewProfile={(id) => { setViewingUserId(id); setShowNotifs(false) }} />
      )}
      {showPost   && <CreatePostModal onClose={() => setShowPost(false)} />}
      {showSearch && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: '#0A0A0A', display: 'flex', flexDirection: 'column', animation: 'slideDown 0.22s ease' }}>
          <div style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 12, display: 'flex', alignItems: 'center', gap: 10, background: '#111', borderBottom: '1px solid #1F1F1F' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif', flex: 1 }}>Buscar jugadores</span>
            <button onClick={() => setShowSearch(false)} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
            <SearchScreen onViewProfile={(id) => { setShowSearch(false); setViewingUserId(id) }} />
          </div>
        </div>
      )}
      {showClaim      && <ClaimModal            onClose={() => setShowClaim(false)} isStaff={isStaff} />}
      {showTournament && <CreateTournamentModal onClose={() => setShowTournament(false)} defaultBranch={(isOwner || isAdmin) ? null : (profile?.branch ?? null)} />}
      {showLeague     && <CreateLeagueModal     onClose={() => setShowLeague(false)}     defaultBranch={(isOwner || isAdmin) ? null : (profile?.branch ?? null)} />}
      {showAdmin && <AdminScreen     onClose={() => setShowAdmin(false)} />}
      {showAuction && <AuctionScreen isStaff={isStaff} onClose={() => setShowAuction(false)} />}
      {showHub && (
        <QuestHubScreen
          onClose={() => { setShowHub(false); setHubInitialView(null) }}
          onOpenAuction={() => { setShowHub(false); setShowAuction(true) }}
          onOpenLifeCounter={() => { setShowHub(false); setShowLifeCounter(true) }}
          onOpenTracking={() => { setShowHub(false); setShowTracking(true) }}
          onOpenFolder={() => { setShowHub(false); setActiveTab('folder'); setVisitedTabs(prev => { const n = new Set(prev); n.add('folder'); return n }) }}
          onOpenProfile={() => { setShowHub(false); handleOwnProfile() }}
          onOpenShop={() => { setShowHub(false); setActiveTab('shop'); setVisitedTabs(prev => { const n = new Set(prev); n.add('shop'); return n }) }}
          profile={profile}
          initialView={hubInitialView}
        />
      )}
      {showTracking && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: '#0A0A0A', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top,0px)', animation: 'slideUp 0.22s ease' }}>
          {/* Header — refined for admin/owner, original for everyone else */}
          {(isOwner || isAdmin) ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px 12px', flexShrink: 0,
              background: 'rgba(255,255,255,0.03)',
              borderBottom: '0.5px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            }}>
              <button onClick={() => setShowTracking(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 22, lineHeight: 1, padding: '0 2px' }}>‹</button>
              <span style={{
                fontSize: 17, fontWeight: 700, color: '#FFFFFF',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif',
                letterSpacing: '-0.015em',
              }}>Tracking</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 12px', background: '#0D0D0D', borderBottom: '1px solid #1A1A1A', flexShrink: 0 }}>
              <button onClick={() => setShowTracking(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 20, lineHeight: 1, padding: '0 2px' }}>←</button>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif' }}>Tracking</span>
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <TrackingScreen profile={profile} isStaff={isStaff} onNewPackage={() => setShowPackageCreate(true)} refreshKey={packageRefreshKey} />
          </div>
        </div>
      )}
      {showLifeCounter && (
        <LifeCounterScreen
          onClose={() => setShowLifeCounter(false)}
          onViewProfile={(id) => { setShowLifeCounter(false); setViewingUserId(id) }}
        />
      )}

      {/* Profile overlay — slides over everything, including BottomNav (z:100) */}
      {viewingUserId && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 150,
          background: '#0A0A0A', overflowY: 'auto', scrollbarWidth: 'none',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          animation: 'slideUp 0.22s ease',
        }}>
          {showEditProfile ? (
            <EditProfileScreen
              userId={profile?.id}
              onBack={() => setShowEditProfile(false)}
              onSaved={() => { setShowEditProfile(false); setViewingUserId(null) }}
            />
          ) : (
            <ProfileScreen
              userId={viewingUserId}
              currentUserId={profile?.id}
              onBack={() => setViewingUserId(null)}
              onEditProfile={() => setShowEditProfile(true)}
              onMessage={(u) => setChatUser(u)}
              onVs={(u) => { setVsUser(u ?? null); setShowMatchModal(true) }}
              onNotifs={() => setShowNotifs(true)}
              unreadCount={unreadCount}
              isAdminOrOwner={isOwner || isAdmin}
            />
          )}
        </div>
      )}

      {/* Chat overlay — sits above Profile overlay */}
      {chatUser && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 110,
          background: '#0A0A0A', display: 'flex', flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          animation: 'slideUp 0.22s ease',
        }}>
          <ChatScreen otherUser={chatUser} onBack={() => setChatUser(null)} />
        </div>
      )}

      {/* Log Match modal — bottom sheet, works with or without a preselected opponent */}
      {showMatchModal && (
        <LogMatchModal
          opponent={vsUser}
          onClose={() => { setShowMatchModal(false); setVsUser(null) }}
          onLogged={() => { setShowMatchModal(false); setVsUser(null) }}
        />
      )}

      {/* Create Package modal — app-level so it fills full screen without clipping.
          `initialRecipient` is pulled from a window-global the FeatureTour sets
          when the user taps "Probar tracking" — pre-fills RickyQuest so the demo
          packages can be cleaned up later. Cleared on close. */}
      {showPackageCreate && (
        <CreatePackageModal
          currentUserId={profile?.id}
          initialRecipient={window.__questDemoRecipient ?? null}
          onClose={() => {
            window.__questDemoRecipient = null
            setShowPackageCreate(false)
          }}
          onCreated={() => {
            window.__questDemoRecipient = null
            setShowPackageCreate(false)
            setPackageRefreshKey(k => k + 1)
          }}
        />
      )}

      {/* App header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 'calc(56px + env(safe-area-inset-top, 0px))',
        zIndex: 20,
        transform: headerHidden ? 'translateY(-100%)' : 'translateY(0)',
        opacity: headerHidden ? 0 : 1,
        transition: 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 350ms ease',
        willChange: 'transform',
        background: `
          radial-gradient(ellipse 180px 70px at 15% 70%, rgba(167,139,250,0.035), transparent 75%),
          rgba(10,10,10,0.95)
        `,
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        paddingBottom: 0,
      }}>
        {/* Content row — sits below the safe area, same 56px as before */}
        <div style={{
          height: 56, flexShrink: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingLeft: 20, paddingRight: 20,
        }}>
          <img
            src={questLogo} alt="Abrir Quest Hub"
            onClick={() => setShowHub(true)}
            role="button"
            aria-label="Abrir Quest Hub"
            width={80}
            height={80}
            decoding="async"
            style={{ width: 80, height: 'auto', cursor: 'pointer' }}
          />
          {/* ── Header right side ── */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {activeTab === 'shop' && (
              <span style={{ fontSize: 20, fontWeight: 900, color: '#FFF', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>Shop</span>
            )}
            {isStaff && activeTab !== 'shop' && (
              <button onClick={() => setShowAdmin(true)} aria-label="Panel de admin" style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9CA3AF',
                width: 36, height: 36, padding: 8, lineHeight: 1, // bigger touch target
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><ShieldIcon size={20} /></button>
            )}
            {activeTab !== 'shop' && (
              isGuest ? (
                <button onClick={() => requireAuth(null)} style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: '#111111', border: '1px solid #2A2A2A',
                  color: '#9CA3AF', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>Crear cuenta</button>
              ) : (
                <button
                  onClick={() => { setHubInitialView('qpoints'); setShowHub(true) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px 6px 10px', borderRadius: 8,
                    background: 'linear-gradient(135deg, #1C1500 0%, #111111 100%)',
                    border: '1px solid rgba(251,191,36,0.28)',
                    boxShadow: '0 0 10px rgba(251,191,36,0.08), inset 0 1px 0 rgba(251,191,36,0.06)',
                    cursor: 'pointer', minWidth: 76,
                  }}
                >
                  <DiamondIcon size={16} color={profile?.role === 'premium' ? '#A78BFA' : '#FBBF24'} />
                  {/* Bold Inter — heavy weight reads as "currency value".
                      Bebas Neue here looked like a movie title, not coins.
                      Keep only a subtle gold glow for the premium hint. */}
                  <span style={{
                    fontSize: 13, fontWeight: 800, color: '#FBBF24',
                    letterSpacing: '0.01em',
                    textShadow: '0 0 8px rgba(251,191,36,0.25)',
                  }}>
                    {(profile?.q_points ?? 0).toLocaleString()}
                  </span>
                </button>
              )
            )}
            {/* Admin/owner: avatar button (opens own profile, where the
                Avisos card lives). Regular users: the original '+'
                post button — they keep the existing UX. */}
            {activeTab !== 'shop' && !isGuest && (isOwner || isAdmin) && (
              <button
                onClick={() => { if (profile?.id) setViewingUserId(profile.id) }}
                aria-label="Abrir mi perfil"
                style={{
                  position: 'relative',
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#1F1F1F',
                  border: '1.5px solid #2A2A2A',
                  cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'visible',
                  transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.92)' }}
                onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)' }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Avatar url={profile?.avatar_url} size={32} role={profile?.role} isOwner={profile?.is_owner} />
                </div>
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3,
                    minWidth: 16, height: 16, borderRadius: 8,
                    background: '#EF4444', border: '1.5px solid #0A0A0A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: '#FFFFFF', padding: '0 4px',
                    fontFamily: 'Inter, sans-serif',
                  }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
            )}
            {/* Regular users: original '+' post button in header */}
            {activeTab !== 'shop' && !(isOwner || isAdmin) && (
              <button
                onClick={() => requireAuth(() => setShowPost(true))}
                aria-label="Crear post"
                style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #E8E8E8 100%)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.6)',
                  transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.92)' }}
                onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)' }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="#111" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lazy-mount: screens render on first visit, then stay mounted (no re-fetch on tab switch). */}
      {/* Per-screen ErrorBoundary: if one tab crashes (stale bundle, bad data, etc.)   */}
      {/* the user gets a "Reintentar / Recargar" card instead of a silent black screen */}
      {/* and the other tabs keep working.                                              */}
      {/* Suspense wraps the screen container so each lazy chunk shows a spinner while loading. */}
      <div ref={scrollRef} className="screen-scroll" onScroll={handleScroll}>
        {Object.keys(screenMap).map(tab => (
          visitedTabs.has(tab) ? (
            <div key={tab} style={{ display: tab === activeTab ? 'block' : 'none', minHeight: '100%' }}>
              <ErrorBoundary label={tab} compact resetKey={activeTab}>
                <Suspense fallback={<ScreenFallback />}>
                  {screenMap[tab]}
                </Suspense>
              </ErrorBoundary>
            </div>
          ) : null
        ))}
      </div>
      <BottomNav
        active={activeTab}
        hidden={navHidden}
        isAdminOrOwner={isOwner || isAdmin}
        onPost={() => requireAuth(() => setShowPost(true))}
        onNotifs={() => setShowNotifs(true)}
        unreadCount={unreadCount}
        onTab={(tab) => {
          if (tab === 'feed' && activeTab === 'feed') {
            scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            setFeedRefreshKey(k => k + 1)
            return
          }
          setVisitedTabs(prev => { if (prev.has(tab)) return prev; const next = new Set(prev); next.add(tab); return next })
          setActiveTab(tab); setViewingUserId(null); setShowEditProfile(false)
          requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 })
        }}
        onLifeCounter={() => setShowLifeCounter(true)}
      />
      {/* PWA install prompt — auto-shows on Android Chrome and iOS Safari (with a tip). */}
      <InstallPrompt />
      {/* Premium preview toggle — visible to owner AND admins so the
          staff can try the redesign and feed back opinions. Other users
          (regular / staff-only / guest) never see this. Pure visual,
          stored per-user in localStorage. */}
      <DCPreviewToggle canPreview={isOwner || isAdmin} />
    </Suspense>
  )
}

function AppInner() {
  const { user, loading, authEvent, recoverySession } = useAuth()
  const [showReset,     setShowReset]     = useState(false)
  const [showConfirmed, setShowConfirmed] = useState(false)

  // Deep link: ?tournament=TOURNAMENT_ID  — opens a specific tournament as guest
  //            ?tab=ranks                 — opens the tournaments tab as guest (e.g. from email CTA)
  //            ?u=username                — opens a specific user profile (shared link)
  // Also captures ?error= / ?error_description= from failed OAuth redirects (Discord, etc.)
  // Read all params before cleaning the URL (replaceState empties search immediately).
  const [deepLinks] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const tournament = params.get('tournament') ?? null
    const liga       = params.get('liga')       ?? null
    const tab        = params.get('tab')        ?? null
    const username   = params.get('u')          ?? null
    // Capture OAuth error from failed redirect (e.g. Discord email conflict)
    const oauthErr   = params.get('error_description') ?? params.get('error') ?? null
    // Track whether we arrived via a Discord/OAuth redirect (?code=).
    // Used to show "Conectando con Discord…" in the loading state and to
    // detect when the exchange timed out (arrived via OAuth but ended up with no session).
    const wasOAuthCallback = params.has('code')
    if (tournament || tab || liga || username) window.history.replaceState(null, '', window.location.pathname)
    return { tournament, liga, tab, username, oauthErr, wasOAuthCallback }
  })
  const deepLinkTournament = deepLinks.tournament
  const deepLinkLeagueId   = deepLinks.liga
  const deepLinkTab        = deepLinks.tab
  const deepLinkUsername   = deepLinks.username

  // Auto-enter guest mode when arriving via tournament or tab deep-link and not logged in.
  // If user is already logged in (from localStorage) this stays false.
  const [isGuest,       setIsGuest]       = useState(() => !user && (!!deepLinkTournament || !!deepLinkLeagueId || deepLinkTab === 'ranks' || !!deepLinkUsername))
  const [gateScreen,    setGateScreen]    = useState(null) // null | 'login' | 'signup'
  const [showGateModal, setShowGateModal] = useState(false)

  // Detect recovery from URL hash on first load (legacy implicit flow: #type=recovery)
  // PKCE flow sends ?code= instead; Supabase JS exchanges it automatically and
  // fires PASSWORD_RECOVERY through onAuthStateChange — no manual handling needed.
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      setShowReset(true)
      window.history.replaceState(null, '', window.location.pathname)
    }
    // Clean up PKCE code param from URL so it doesn't stay in the address bar
    // after Supabase exchanges it. Supabase reads it before React mounts so this
    // removal is safe to do on first render.
    // Note: ?tournament= is already consumed above in the deepLinkTournament useState.
    const params = new URLSearchParams(window.location.search)
    if (params.has('code') || params.has('error') || params.has('error_description')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // Detect via Supabase auth events (works for both implicit and PKCE flows)
  useEffect(() => {
    if (authEvent === 'PASSWORD_RECOVERY') { setShowReset(true); return }
    if (authEvent === 'SIGNED_IN') {
      const hash = window.location.hash
      if (hash.includes('type=signup') || hash.includes('type=email')) {
        setShowConfirmed(true)
        window.history.replaceState(null, '', window.location.pathname)
      }
    }
  }, [authEvent])

  const requireAuth = useCallback((fn) => {
    if (!isGuest) { fn?.(); return }
    setShowGateModal(true)
  }, [isGuest])

  if (loading) return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0A0A0A', gap: 16 }}>
      {/* Stable /public URL + explicit dims + fetchpriority high = LCP image
          paints immediately. The preload link in index.html starts the download
          before the JS bundle even arrives, cutting LCP from ~3.5 s → ~1 s. */}
      <img
        src="/quest-logo-loading.png"
        alt="Quest"
        width={110}
        height={110}
        fetchpriority="high"
        decoding="async"
        style={{ width: 110, height: 110, animation: 'bounce 0.9s ease infinite' }}
      />
      {deepLinks.wasOAuthCallback && (
        <span style={{ fontSize: 13, color: '#4B5563' }}>
          Conectando con Discord…
        </span>
      )}
    </div>
  )

  if (showReset) return (
    <ResetPasswordScreen
      recoverySession={recoverySession}
      onDone={async () => {
        setShowReset(false)
        await supabase.auth.signOut()
      }}
    />
  )

  if (showConfirmed) return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0A0A0A', padding: 32, gap: 16, textAlign: 'center',
      animation: 'fadeUp 0.4s ease',
    }}>
      <div style={{ fontSize: 64 }}>🎉</div>
      <img src={questLogo} alt="Quest" width={100} height={100} style={{ width: 100, height: 'auto' }} />
      <div style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
        ¡Cuenta confirmada!
      </div>
      <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, maxWidth: 260 }}>
        Tu email fue verificado exitosamente. Ya podés usar la app.
      </div>
      <button
        onClick={() => setShowConfirmed(false)}
        style={{
          marginTop: 8, padding: '14px 36px',
          background: '#FFFFFF', border: 'none', borderRadius: 14,
          color: '#111111', fontSize: 15, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>
        Entrar →
      </button>
    </div>
  )

  if (user || isGuest) {
    const guestValue = { isGuest, requireAuth }
    return (
      <GuestContext.Provider value={guestValue}>
        <MainApp
          initialTab={(deepLinkTournament || deepLinkLeagueId || deepLinkTab === 'ranks') ? 'ranks' : undefined}
          openTournamentId={deepLinkTournament}
          openLeagueId={deepLinkLeagueId}
          openUsername={deepLinkUsername}
        />
        {showGateModal && (
          <GuestGateModal
            onClose={() => setShowGateModal(false)}
            onLogin={() => { setShowGateModal(false); setIsGuest(false); setGateScreen('login') }}
            onSignup={() => { setShowGateModal(false); setIsGuest(false); setGateScreen('signup') }}
          />
        )}
        {gateScreen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9100, display: 'flex', flexDirection: 'column', background: '#111' }}>
            <AuthFlow onGuest={null} initialScreen={gateScreen} onDone={() => setGateScreen(null)} />
          </div>
        )}
      </GuestContext.Provider>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <AuthFlow
        onGuest={() => setIsGuest(true)}
        oauthError={
          // Apply friendlyOAuthError to the raw URL error HERE so OpeningScreen
          // receives an already-translated string and doesn't double-process it.
          // If no URL error but we came via OAuth (?code=) and ended up with no
          // session, the PKCE exchange silently failed — show a generic retry msg.
          (deepLinks.oauthErr ? friendlyOAuthError(deepLinks.oauthErr) : null)
            ?? (deepLinks.wasOAuthCallback ? 'No se pudo conectar con Discord. Intentá de nuevo o usá tu email.' : null)
        }
      />
    </div>
  )
}

export default function App() {

  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <style>{globalCSS}</style>
          <div className="phone-wrap">
            <div className="phone">
              <ErrorBoundary>
                <AuthProvider>
                  <AppInner />
                </AuthProvider>
              </ErrorBoundary>
            </div>
          </div>
          {/* Offline indicator — sits above everything (z:9999), only renders when offline */}
          <OfflineBanner />
          {/* Vercel Analytics — page views, traffic, referrers (zero config) */}
          <Analytics />
          {/* Speed Insights — real-user Core Web Vitals (LCP, FCP, CLS) */}
          <SpeedInsights />
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
