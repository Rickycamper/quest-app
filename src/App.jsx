// ─────────────────────────────────────────────
// QUEST — App.jsx  (main router)
// ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, useMemo, Component } from 'react'
import questLogo from './assets/quest-logo-sm.png'
import { GuestContext, useGuest } from './context/GuestContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import { useNotifications } from './hooks/useNotifications'
import { OpeningScreen, SignupScreen, EmailSignupScreen, LoginScreen, ForgotPasswordScreen, ResetPasswordScreen, TermsModal } from './screens/AuthScreens'
import FeedScreen            from './screens/FeedScreen'
import ProfileScreen         from './screens/ProfileScreen'
import EditProfileScreen     from './screens/EditProfileScreen'
import RankingsScreen        from './screens/RankingsScreen'
import FolderScreen          from './screens/FolderScreen'
import TrackingScreen, { CreatePackageModal } from './screens/TrackingScreen'
import CreatePostModal       from './screens/CreatePostModal'
import ClaimModal            from './screens/ClaimModal'
import CreateTournamentModal from './screens/CreateTournamentModal'
import AdminScreen           from './screens/AdminScreen'
import AuctionScreen         from './screens/AuctionScreen'
import QuestHubScreen        from './screens/QuestHubScreen'
import LifeCounterScreen     from './screens/LifeCounterScreen'
import ChatScreen            from './screens/ChatScreen'
import LogMatchModal         from './screens/LogMatchModal'
import SearchScreen          from './screens/SearchScreen'
import ShopScreen            from './screens/ShopScreen'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0A0A0A', padding:24, gap:16 }}>
        <div style={{ fontSize:32 }}>⚠️</div>
        <div style={{ color:'#EF4444', fontSize:13, fontFamily:'monospace', textAlign:'center', maxWidth:340, wordBreak:'break-all', lineHeight:1.6 }}>
          {this.state.error?.message || String(this.state.error)}
        </div>
        <button onClick={() => window.location.reload()} style={{ marginTop:8, padding:'12px 28px', background:'#FFF', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer' }}>
          Recargar
        </button>
      </div>
    )
    return this.props.children
  }
}

import { acceptTerms, subscribeToPush } from './lib/supabase'
import { BottomNav, NotifBell } from './components/Nav'
import { ShieldIcon, SearchIcon, DiamondIcon } from './components/Icons'
import NotificationPanel from './components/NotificationPanel'
import OnboardingModal   from './components/OnboardingModal'
import Avatar from './components/Avatar'

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: 100%; }
  body { height: 100%; background: #1A1A1A; font-family: 'Inter', sans-serif; overflow: hidden; }
  .phone-wrap { display:flex; justify-content:center; align-items:center; height:100vh; padding:20px; overflow:hidden; }
  .phone { width:390px; height:844px; border-radius:44px; overflow:hidden; position:relative; background:#0A0A0A; box-shadow:0 30px 80px rgba(0,0,0,0.6), 0 0 0 6px #111111; display:flex; flex-direction:column; }
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
    body { min-height: 100%; background: #0A0A0A; }
    .phone-wrap { padding:0; display:flex; align-items:stretch; width:100%; height:100dvh; overflow:hidden; }
    .phone { width:100%; height:100%; border-radius:0; box-shadow:none; }
    input, textarea, select { font-size: 16px !important; }
  }
  .app-header { flex-shrink:0; }
  .screen-scroll { flex:1; overflow-y:auto; overflow-x:hidden; scrollbar-width:none; padding-bottom:calc(64px + env(safe-area-inset-bottom, 0px)); padding-top:calc(56px + env(safe-area-inset-top, 0px)); min-height:0; background:#0A0A0A; }
  .screen-scroll::-webkit-scrollbar { display:none; }
  .filter-scroll { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; touch-action:pan-x; -webkit-overflow-scrolling:touch; }
  .filter-scroll::-webkit-scrollbar { display:none; }
  @keyframes fadeUp   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideUp  { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideDown{ from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin     { to{transform:rotate(360deg)} }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes bounce   { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-18px)} 60%{transform:translateY(-10px)} }
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

function AuthFlow({ onGuest, initialScreen, onDone }) {
  const [screen, setScreen] = useState(initialScreen ?? 'opening')
  const back = onDone ? onDone : () => setScreen('opening')
  if (screen === 'opening')        return <OpeningScreen        onSignIn={() => setScreen('login')}   onSignUp={() => setScreen('signup')} onGuest={onGuest} />
  if (screen === 'signup')         return <SignupScreen         onEmail={() => setScreen('email-signup')} onLogin={() => setScreen('login')} />
  if (screen === 'email-signup')   return <EmailSignupScreen    onBack={() => setScreen('signup')}   onDone={() => setScreen('login')} />
  if (screen === 'login')          return <LoginScreen          onBack={back}  onSignUp={() => setScreen('signup')} onForgot={() => setScreen('forgot')} />
  if (screen === 'forgot')         return <ForgotPasswordScreen onBack={() => setScreen('login')}    onDone={() => setScreen('login')} />
  return null
}

function ShopComingSoon() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '70vh', gap: 20, padding: 32,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 64 }}>🛒</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', fontFamily: 'Inter, sans-serif' }}>
        Quest Shop
      </div>
      <div style={{
        fontSize: 13, color: '#6B7280', fontFamily: 'Inter, sans-serif',
        lineHeight: 1.6, maxWidth: 260,
      }}>
        Próximamente podrás comprar singles, sobres y accesorios directamente desde la app.
      </div>
      <div style={{
        marginTop: 8, padding: '8px 20px', borderRadius: 20,
        background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
        fontSize: 12, fontWeight: 700, color: '#FBBF24', fontFamily: 'Inter, sans-serif',
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        Coming Soon
      </div>
    </div>
  )
}

function MainApp() {
  const { profile, isStaff, isOwner, refreshProfile } = useAuth()
  const { isGuest, requireAuth } = useGuest()
  const { notifications, unreadCount, markRead, markAll, markResponded } = useNotifications()
  const [activeTab,      setActiveTab]     = useState('feed')
  const [showNotifs,      setShowNotifs]     = useState(false)
  const [showSearch,      setShowSearch]     = useState(false)
  const [showPost,        setShowPost]       = useState(false)
  const [showClaim,       setShowClaim]      = useState(false)
  const [showTournament,  setShowTournament] = useState(false)
  const [showAdmin,       setShowAdmin]      = useState(false)
  const [viewingUserId,   setViewingUserId]  = useState(null)
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
  const [headerHidden, setHeaderHidden] = useState(false)
  const [navHidden,    setNavHidden]    = useState(false)
  const lastScrollY  = useRef(0)
  const scrollRef    = useRef(null)
  const swipeOrigin  = useRef(null)
  const screenMapRef = useRef(screenMap)
  useEffect(() => { screenMapRef.current = screenMap }, [screenMap])

  // Swipe navigation — use native window listeners so iOS Safari doesn't
  // swallow the touch inside the scrollable screen-scroll container.
  useEffect(() => {
    const onStart = (e) => {
      const t = e.touches[0]
      swipeOrigin.current = { x: t.clientX, y: t.clientY }
    }
    const onEnd = (e) => {
      if (!swipeOrigin.current) return
      const t  = e.changedTouches[0]
      const dx = t.clientX - swipeOrigin.current.x
      const dy = t.clientY - swipeOrigin.current.y
      swipeOrigin.current = null
      // Must be horizontal — lower threshold so it's easy to trigger
      if (Math.abs(dx) < 30 || Math.abs(dx) < Math.abs(dy) * 1.0) return
      setActiveTab(prev => {
        const tabs = Object.keys(screenMapRef.current)
        const idx  = tabs.indexOf(prev)
        if (dx < 0 && idx < tabs.length - 1) return tabs[idx + 1]
        if (dx > 0 && idx > 0)               return tabs[idx - 1]
        return prev
      })
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend',   onEnd,   { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend',   onEnd)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = (e) => {
    const y = e.currentTarget.scrollTop
    const delta = y - lastScrollY.current
    if (delta > 16 && y > 60) { setHeaderHidden(true);  setNavHidden(true)  }
    else if (delta < -12)     { setHeaderHidden(false); setNavHidden(false) }
    lastScrollY.current = y
  }

  // Register push notifications once per user session
  useEffect(() => {
    if (!profile?.id) return
    subscribeToPush(profile.id)
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

  const handleViewProfile = useCallback((userId) => setViewingUserId(userId), [])
  const handleOwnProfile  = useCallback(() => { if (profile?.id) setViewingUserId(profile.id) }, [profile?.id])

  // Lazy mount: only render a screen after it has been visited for the first time.
  // FeedScreen is pre-visited so it loads immediately; all others wait until tapped.
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(['feed']))

  const screenMap = useMemo(() => ({
    feed:     <FeedScreen     profile={profile} isStaff={isStaff} isOwner={isOwner} onViewProfile={(id) => requireAuth(() => handleViewProfile(id))} onPost={() => requireAuth(() => setShowPost(true))} refreshKey={feedRefreshKey} />,
    shop:     isOwner
      ? <ShopScreen isOwner={isOwner} />
      : <ShopComingSoon />,
    ranks:    <RankingsScreen profile={profile} isStaff={isStaff} onReportClaim={() => setShowClaim(true)} onCreateTournament={() => setShowTournament(true)} onViewProfile={handleViewProfile} />,
    folder:   <FolderScreen   profile={profile} />,
    search:   <SearchScreen   onViewProfile={handleViewProfile} />,
  }), [profile, isStaff, isOwner, handleViewProfile, feedRefreshKey])

  const needsTerms = profile && !profile.terms_accepted_at

  const handleAcceptTerms = async () => {
    await acceptTerms()
    await refreshProfile()
  }

  return (
    <>
      {needsTerms && (
        <TermsModal acceptOnly onAccept={handleAcceptTerms} />
      )}
      {/* Onboarding shown once per user. TermsModal (z:9999) overlaps it if terms are pending. */}
      {showOnboarding && (
        <OnboardingModal onDone={handleOnboardingDone} />
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
      {showTournament && <CreateTournamentModal onClose={() => setShowTournament(false)} defaultBranch={isOwner ? null : (profile?.branch ?? null)} />}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 12px', background: '#0D0D0D', borderBottom: '1px solid #1A1A1A', flexShrink: 0 }}>
            <button onClick={() => setShowTracking(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 20, lineHeight: 1, padding: '0 2px' }}>←</button>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif' }}>Tracking</span>
          </div>
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

      {/* Profile overlay — slides over everything */}
      {viewingUserId && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
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

      {/* Create Package modal — app-level so it fills full screen without clipping */}
      {showPackageCreate && (
        <CreatePackageModal
          currentUserId={profile?.id}
          onClose={() => setShowPackageCreate(false)}
          onCreated={() => {
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
        transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
        willChange: 'transform',
        background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)',
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
            src={questLogo} alt="Quest"
            onClick={() => setShowHub(true)}
            style={{ width: 80, height: 'auto', cursor: 'pointer' }}
          />
          {/* ── Header right side ── */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {activeTab === 'shop' && (
              <span style={{ fontSize: 20, fontWeight: 900, color: '#FFF', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>Shop</span>
            )}
            {isStaff && activeTab !== 'shop' && (
              <button onClick={() => setShowAdmin(true)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9CA3AF', padding: 2, lineHeight: 1,
                display: 'flex', alignItems: 'center',
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
                    background: '#111111', border: '1px solid #1E1E1E',
                    cursor: 'pointer', minWidth: 76,
                  }}
                >
                  <DiamondIcon size={16} color={profile?.role === 'premium' ? '#A78BFA' : '#FFFFFF'} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#FBBF24', fontFamily: 'Inter, sans-serif', letterSpacing: '0.01em' }}>
                    {(profile?.q_points ?? 0).toLocaleString()}
                  </span>
                </button>
              )
            )}
            {activeTab !== 'shop' && (
              <button
                onClick={() => requireAuth(() => setShowPost(true))}
                style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: '#FFFFFF', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                }}
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
      <div ref={scrollRef} className="screen-scroll" onScroll={handleScroll}>
        {Object.keys(screenMap).map(tab => (
          visitedTabs.has(tab) ? (
            <div key={tab} style={{ display: tab === activeTab ? 'block' : 'none', minHeight: '100%' }}>
              {screenMap[tab]}
            </div>
          ) : null
        ))}
      </div>
      <BottomNav
        active={activeTab}
        hidden={navHidden}
        isOwner={isOwner}
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
        onPost={() => requireAuth(() => setShowPost(true))}
        onLifeCounter={() => setShowLifeCounter(true)}
      />
    </>
  )
}

function AppInner() {
  const { user, loading, authEvent, recoverySession } = useAuth()
  const [showReset,     setShowReset]     = useState(false)
  const [showConfirmed, setShowConfirmed] = useState(false)
  const [isGuest,       setIsGuest]       = useState(false)
  const [gateScreen,    setGateScreen]    = useState(null) // null | 'login' | 'signup'
  const [showGateModal, setShowGateModal] = useState(false)

  // Detect recovery from URL hash on first load (implicit flow: #type=recovery)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      setShowReset(true)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // Also detect via Supabase auth events (PKCE flow or when events fire after load)
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
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#0A0A0A' }}>
      <img src={questLogo} alt="Quest" style={{ width: 110, animation: 'bounce 0.9s ease infinite' }} />
    </div>
  )

  if (showReset) return (
    <ResetPasswordScreen
      recoverySession={recoverySession}
      onDone={async () => {
        setShowReset(false)
        const { supabase: sb } = await import('./lib/supabase')
        await sb.auth.signOut()
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
      <img src={questLogo} alt="Quest" style={{ width: 100 }} />
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
        <MainApp />
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
      <AuthFlow onGuest={() => setIsGuest(true)} />
    </div>
  )
}

export default function App() {

  return (
    <ErrorBoundary>
      <ToastProvider>
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
      </ToastProvider>
    </ErrorBoundary>
  )
}
