// ─────────────────────────────────────────────
// QUEST — App.jsx  (main router)
// ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import questLogo from './assets/quest-logo.png'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useNotifications } from './hooks/useNotifications'

import { OpeningScreen, SignupScreen, EmailSignupScreen, LoginScreen, ForgotPasswordScreen, ResetPasswordScreen } from './screens/AuthScreens'
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
import ChatScreen             from './screens/ChatScreen'
import LogMatchModal          from './screens/LogMatchModal'
import SearchScreen           from './screens/SearchScreen'

import { BottomNav, NotifBell } from './components/Nav'
import { ShieldIcon, SearchIcon } from './components/Icons'
import NotificationPanel from './components/NotificationPanel'
import Avatar from './components/Avatar'

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; }
  body { background: #1A1A1A; font-family: 'Inter', sans-serif; position: fixed; width: 100%; }
  .phone-wrap { display:flex; justify-content:center; align-items:center; height:100vh; padding:20px; overflow:hidden; }
  .phone { width:390px; height:844px; border-radius:44px; overflow:hidden; position:relative; background:#0A0A0A; box-shadow:0 30px 80px rgba(0,0,0,0.6), 0 0 0 6px #111111; display:flex; flex-direction:column; }
  @media (max-width: 480px) {
    .phone-wrap { padding:0; align-items:stretch; height:100dvh; }
    .phone { width:100%; height:100dvh; border-radius:0; box-shadow:none; }
    input, textarea, select { font-size: 16px !important; }
  }
  .app-header { flex-shrink:0; }
  .screen-scroll { flex:1; overflow-y:auto; overflow-x:hidden; scrollbar-width:none; padding-bottom:46px; padding-top:56px; min-height:0; }
  .screen-scroll::-webkit-scrollbar { display:none; }
  .filter-scroll { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; }
  .filter-scroll::-webkit-scrollbar { display:none; }
  @keyframes fadeUp   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideUp  { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideDown{ from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin     { to{transform:rotate(360deg)} }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes bounce   { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-18px)} 60%{transform:translateY(-10px)} }
  @keyframes fadeInOut{ 0%{opacity:0;transform:translateX(-50%) translateY(-6px)} 20%,80%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0;transform:translateX(-50%) translateY(-6px)} }
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
  const { profile, isStaff } = useAuth()
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
  const [packageRefreshKey, setPackageRefreshKey] = useState(0)
  const [headerHidden,      setHeaderHidden]      = useState(false)
  const lastScrollY = useRef(0)

  const handleScroll = (e) => {
    const y = e.currentTarget.scrollTop
    if (y - lastScrollY.current > 16 && y > 60) setHeaderHidden(true)
    else if (lastScrollY.current - y > 12)      setHeaderHidden(false)
    lastScrollY.current = y
  }

  const handleViewProfile = useCallback((userId) => setViewingUserId(userId), [])
  const handleOwnProfile  = useCallback(() => { if (profile?.id) setViewingUserId(profile.id) }, [profile?.id])

  const screens = useMemo(() => ({
    feed:     <FeedScreen     profile={profile} isStaff={isStaff} onViewProfile={handleViewProfile} />,
    ranks:    <RankingsScreen profile={profile} isStaff={isStaff} onReportClaim={() => setShowClaim(true)} onCreateTournament={() => setShowTournament(true)} />,
    folder:   <FolderScreen   profile={profile} />,
    search:   <SearchScreen   onViewProfile={handleViewProfile} />,
    tracking: <TrackingScreen profile={profile} isStaff={isStaff} onNewPackage={() => setShowPackageCreate(true)} refreshKey={packageRefreshKey} />,
  }), [profile, isStaff, handleViewProfile, packageRefreshKey])

  return (
    <>
      {showNotifs && (
        <NotificationPanel profile={profile} notifications={notifications}
          onClose={() => setShowNotifs(false)} onMarkRead={markRead} onMarkAll={markAll}
          onMarkResponded={markResponded}
          onNavigate={(tab) => { setActiveTab(tab); setShowNotifs(false) }} />
      )}
      {showPost   && <CreatePostModal onClose={() => setShowPost(false)} />}
      {showSearch && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: '#0A0A0A', display: 'flex', flexDirection: 'column', animation: 'slideDown 0.22s ease' }}>
          <div style={{ padding: '52px 16px 0', display: 'flex', alignItems: 'center', gap: 10, background: '#111', borderBottom: '1px solid #1F1F1F', paddingBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif', flex: 1 }}>Buscar jugadores</span>
            <button onClick={() => setShowSearch(false)} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
            <SearchScreen onViewProfile={(id) => { setShowSearch(false); setViewingUserId(id) }} />
          </div>
        </div>
      )}
      {showClaim      && <ClaimModal            onClose={() => setShowClaim(false)} isStaff={isStaff} />}
      {showTournament && <CreateTournamentModal onClose={() => setShowTournament(false)} />}
      {showAdmin && <AdminScreen     onClose={() => setShowAdmin(false)} />}

      {/* Profile overlay — slides over everything */}
      {viewingUserId && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: '#0A0A0A', overflowY: 'auto', scrollbarWidth: 'none',
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
          display: 'flex', flexDirection: 'column',
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

      {/* App header — position:absolute so content never reflows when hidden */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 56, zIndex: 20,
        transform: headerHidden ? 'translateY(-100%)' : 'translateY(0)',
        opacity: headerHidden ? 0 : 1,
        transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
        willChange: 'transform',
        background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingLeft: 20, paddingRight: 20,
      }}>
        <img src={questLogo} alt="Quest" style={{ width: 80, height: 'auto' }} />
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

      <div className="screen-scroll" onScroll={handleScroll}>{screens[activeTab] || screens.feed}</div>
      <BottomNav
        active={activeTab}
        onTab={(tab) => { setActiveTab(tab); setViewingUserId(null); setShowEditProfile(false) }}
        onPost={() => setShowPost(true)}
      />
    </>
  )
}

function AppInner() {
  const { user, loading, authEvent } = useAuth()
  const [showReset,     setShowReset]     = useState(false)
  const [showConfirmed, setShowConfirmed] = useState(false)

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
    <ResetPasswordScreen onDone={async () => {
      setShowReset(false)
      const { supabase: sb } = await import('./lib/supabase')
      await sb.auth.signOut()
    }} />
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
    <>
      <style>{globalCSS}</style>
      <div className="phone-wrap">
        <div className="phone">
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </div>
      </div>
    </>
  )
}
