// ─────────────────────────────────────────────
// QUEST — App.jsx  (main router)
// ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import questLogo from './assets/quest-logo-sm.png'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import { useNotifications } from './hooks/useNotifications'

import { OpeningScreen, SignupScreen, EmailSignupScreen, LoginScreen, ForgotPasswordScreen, ResetPasswordScreen, TermsModal } from './screens/AuthScreens'
import FeedScreen      from './screens/FeedScreen'
import ProfileScreen     from './screens/ProfileScreen'
import EditProfileScreen from './screens/EditProfileScreen'
import RankingsScreen  from './screens/RankingsScreen'
import FolderScreen    from './screens/FolderScreen'
import TrackingScreen, { CreatePackageModal } from './screens/TrackingScreen'
import CreatePostModal        from './screens/CreatePostModal'
import ClaimModal             from './screens/ClaimModal'
import CreateTournamentModal  from './screens/CreateTournamentModal'
import AdminScreen            from './screens/AdminScreen'
import AuctionScreen          from './screens/AuctionScreen'
import QuestHubScreen         from './screens/QuestHubScreen'
import ChatScreen             from './screens/ChatScreen'
import LogMatchModal          from './screens/LogMatchModal'
import SearchScreen           from './screens/SearchScreen'

import { acceptTerms } from './lib/supabase'
import { BottomNav, NotifBell } from './components/Nav'
import { ShieldIcon, SearchIcon } from './components/Icons'
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

function AuthFlow() {
  const [screen, setScreen] = useState('opening')
  if (screen === 'opening')        return <OpeningScreen        onSignIn={() => setScreen('login')}   onSignUp={() => setScreen('signup')} />
  if (screen === 'signup')         return <SignupScreen         onEmail={() => setScreen('email-signup')} onLogin={() => setScreen('login')} />
  if (screen === 'email-signup')   return <EmailSignupScreen    onBack={() => setScreen('signup')}   onDone={() => setScreen('login')} />
  if (screen === 'login')          return <LoginScreen          onBack={() => setScreen('opening')}  onSignUp={() => setScreen('signup')} onForgot={() => setScreen('forgot')} />
  if (screen === 'forgot')         return <ForgotPasswordScreen onBack={() => setScreen('login')}    onDone={() => setScreen('login')} />
  return null
}

function MainApp() {
  const { profile, isStaff, isOwner, refreshProfile } = useAuth()
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
  const [showAuction,       setShowAuction]       = useState(false)
  const [showHub,           setShowHub]           = useState(false)
  const [packageRefreshKey, setPackageRefreshKey] = useState(0)
  const [feedRefreshKey,    setFeedRefreshKey]    = useState(0)
  const [showOnboarding,    setShowOnboarding]    = useState(false)
  const [headerHidden, setHeaderHidden] = useState(false)
  const [navHidden,    setNavHidden]    = useState(false)
  const lastScrollY = useRef(0)
  const scrollRef   = useRef(null)

  const handleScroll = (e) => {
    const y = e.currentTarget.scrollTop
    const delta = y - lastScrollY.current
    if (delta > 16 && y > 60) { setHeaderHidden(true);  setNavHidden(true)  }
    else if (delta < -12)     { setHeaderHidden(false); setNavHidden(false) }
    lastScrollY.current = y
  }

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

  const screens = useMemo(() => ({
    feed:     <FeedScreen     profile={profile} isStaff={isStaff} onViewProfile={handleViewProfile} refreshKey={feedRefreshKey} />,
    ranks:    <RankingsScreen profile={profile} isStaff={isStaff} onReportClaim={() => setShowClaim(true)} onCreateTournament={() => setShowTournament(true)} onViewProfile={handleViewProfile} />,
    folder:   <FolderScreen   profile={profile} />,
    search:   <SearchScreen   onViewProfile={handleViewProfile} />,
    tracking: <TrackingScreen profile={profile} isStaff={isStaff} onNewPackage={() => setShowPackageCreate(true)} refreshKey={packageRefreshKey} />,
  }), [profile, isStaff, handleViewProfile, packageRefreshKey, feedRefreshKey])

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
          onClose={() => setShowHub(false)}
          onOpenAuction={() => { setShowHub(false); setShowAuction(true) }}
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
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {isStaff && (
              <button onClick={() => setShowAdmin(true)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9CA3AF', padding: 2, lineHeight: 1, position: 'relative',
                display: 'flex', alignItems: 'center',
              }}><ShieldIcon size={20} /></button>
            )}
            <button onClick={() => setShowSearch(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6B7280', padding: 4, lineHeight: 1,
              display: 'flex', alignItems: 'center',
            }}><SearchIcon size={20} /></button>
            <NotifBell count={unreadCount} onClick={() => setShowNotifs(true)} />
            <div onClick={handleOwnProfile} style={{
              width: 34, height: 34, borderRadius: '50%',
              background: '#1F1F1F', border: '1.5px solid #2A2A2A',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              cursor: 'pointer', overflow: 'hidden',
            }}><Avatar url={profile?.avatar_url} size={34} /></div>
          </div>
        </div>
      </div>

      {/* All screens stay mounted — only visibility toggles. No re-fetch on tab switch. */}
      <div ref={scrollRef} className="screen-scroll" onScroll={handleScroll}>
        {Object.keys(screens).map(tab => (
          <div key={tab} style={{ display: tab === activeTab ? 'block' : 'none', minHeight: '100%' }}>
            {screens[tab]}
          </div>
        ))}
      </div>
      <BottomNav
        active={activeTab}
        hidden={navHidden}
        onTab={(tab) => {
          if (tab === 'feed' && activeTab === 'feed') {
            scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            setFeedRefreshKey(k => k + 1)
            return
          }
          setActiveTab(tab); setViewingUserId(null); setShowEditProfile(false)
          // Reset scroll to top for the new tab
          requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 })
        }}
        onPost={() => setShowPost(true)}
      />
    </>
  )
}

function AppInner() {
  const { user, loading, authEvent, recoverySession } = useAuth()
  const [showReset,     setShowReset]     = useState(false)
  const [showConfirmed, setShowConfirmed] = useState(false)

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

  return user ? <MainApp /> : (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <AuthFlow />
    </div>
  )
}

export default function App() {

  return (
    <ToastProvider>
      <style>{globalCSS}</style>
      <div className="phone-wrap">
        <div className="phone">
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </div>
      </div>
    </ToastProvider>
  )
}
