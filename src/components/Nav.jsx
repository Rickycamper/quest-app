// ─────────────────────────────────────────────
// QUEST — BottomNav + NotifBell
// ─────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { HomeIcon, RanksIcon, FolderIcon, TruckIcon, PlusIcon, BellIcon, CounterIcon, UserIcon, ShopIcon } from './Icons'
import Avatar from './Avatar'
import { HAPTIC } from '../lib/design-tokens'

// ── Owner nav: Feed · Shop · Rank · Counter · Tracking · Notifs ──
function OwnerBottomNav({ active, hidden, tabs }) {
  const [tapped, setTapped] = useState(null)
  const tapTimer = useRef(null)
  useEffect(() => () => clearTimeout(tapTimer.current), [])

  const handleTap = (id, action) => {
    HAPTIC.tap()                    // 8 ms vibration on Android Chrome / iOS Safari
    clearTimeout(tapTimer.current)
    setTapped(id)
    tapTimer.current = setTimeout(() => setTapped(null), 420)
    action()
  }

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      // Tighter without labels — was 56 px, now 52. Still well above the
      // 44 px minimum hit target.
      height: 'calc(52px + env(safe-area-inset-bottom, 0px))',
      background: 'rgba(10,10,10,0.82)',
      backdropFilter: 'saturate(180%) blur(24px)',
      WebkitBackdropFilter: 'saturate(180%) blur(24px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 -8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
      display: 'flex', alignItems: 'center',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 100,
      transform: hidden ? 'translateY(100%)' : 'translateY(0)',
      // Spring physics — overshoot easing for that "Apple bounce" feel.
      transition: 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      willChange: 'transform',
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => handleTap(tab.id, tab.action)}
            aria-label={tab.label}
            title={tab.label}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', cursor: 'pointer', background: 'none', border: 'none',
              padding: 0,
              transition: 'opacity 200ms cubic-bezier(0.2, 0, 0.38, 0.9)',
            }}
          >
            <div style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: tapped === tab.id ? 'tabBounce 0.42s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
              // Subtle scale-up of the active icon — fills the space that
              // the label used to occupy and reinforces the active state.
              transform: isActive ? 'scale(1.12)' : 'scale(1)',
              transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              opacity: isActive ? 1 : 0.65,
            }}>
              {tab.icon(isActive)}
              {tab.badge > 0 && (
                <div style={{
                  position: 'absolute', top: -3, right: -6,
                  minWidth: 16, height: 16, borderRadius: 8,
                  background: '#EF4444', border: '1.5px solid #0A0A0A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: '#FFF', padding: '0 3px',
                }}>{tab.badge > 9 ? '9+' : tab.badge}</div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── All users get the same nav ───────────────────────────────────────
// The 5th tab used to be the bell ("Avisos"). It's now the user's own avatar
// — taps open their profile, and the unread-count badge sits on the avatar
// so they don't lose the notification affordance. Notifications themselves
// live inside the profile (Avisos card at the top).
export function BottomNav({ active, hidden, onTab, onLifeCounter, onMyProfile, unreadCount, isOwner, profile }) {
  // Avatar-as-icon for the "Yo / Profile" tab. The `active` ring color comes
  // from the rest of the nav so the visual treatment stays consistent.
  const AvatarTabIcon = ({ active: isActive }) => (
    <div style={{
      width: 26, height: 26, borderRadius: '50%',
      background: '#1F1F1F',
      border: `1.5px solid ${isActive ? '#FFFFFF' : '#2A2A2A'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      boxShadow: isActive ? '0 0 10px rgba(255,255,255,0.18), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
      transition: 'border-color 220ms cubic-bezier(0.2, 0, 0.38, 0.9), box-shadow 220ms',
    }}>
      {profile?.avatar_url
        ? <Avatar url={profile.avatar_url} size={26} role={profile.role} isOwner={profile.is_owner} />
        : <UserIcon active={isActive} />}
    </div>
  )

  // Labels in Spanish to match the rest of the app's copy.
  // Short forms picked to fit tab-bar width on iPhone SE (320 px).
  const tabs = [
    { id: 'feed',  label: 'Feed',     icon: (a) => <HomeIcon active={a} />,    action: () => onTab('feed') },
    { id: 'shop',  label: 'Tienda',   icon: (a) => <ShopIcon active={a} />,    action: () => onTab('shop') },
    { id: 'ranks', label: 'Ranking',  icon: (a) => <RanksIcon active={a} />,   action: () => onTab('ranks') },
    { id: 'life',  label: 'Vida',     icon: (a) => <CounterIcon active={a} />, action: onLifeCounter },
    { id: 'me',    label: 'Yo',       icon: (a) => <AvatarTabIcon active={a} />, action: onMyProfile, badge: unreadCount },
  ]
  return (
    <OwnerBottomNav
      active={active} hidden={hidden} tabs={tabs}
    />
  )
}

export function NotifBell({ count, onClick }) {
  return (
    <button onClick={onClick} style={{
      position: 'relative', background: 'none', border: 'none',
      color: '#6B7280', cursor: 'pointer', padding: 4,
    }}>
      <BellIcon />
      {count > 0 && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          minWidth: 16, height: 16, borderRadius: 8,
          background: '#EF4444', border: '2px solid #0A0A0A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800, color: '#FFFFFF', padding: '0 3px',
        }}>{count > 9 ? '9+' : count}</div>
      )}
    </button>
  )
}

export function StatusBar() {
  const now = new Date()
  const time = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <div style={{
      padding: '14px 24px 0', display: 'flex', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 50,
      background: 'linear-gradient(to bottom, #0A0A0A 70%, transparent)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{time}</span>
      <span style={{ color: '#FFFFFF', fontSize: 12 }}>▲▲▲ 🔋</span>
    </div>
  )
}
