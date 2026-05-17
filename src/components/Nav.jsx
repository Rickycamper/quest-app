// ─────────────────────────────────────────────
// QUEST — BottomNav + NotifBell
// ─────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { HomeIcon, RanksIcon, FolderIcon, TruckIcon, PlusIcon, BellIcon, CounterIcon, UserIcon, ShopIcon } from './Icons'
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
      height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      background: 'rgba(10,10,10,0.82)',
      backdropFilter: 'saturate(180%) blur(24px)',
      WebkitBackdropFilter: 'saturate(180%) blur(24px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 -8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
      display: 'flex', alignItems: 'flex-end',
      paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))', zIndex: 100,
      transform: hidden ? 'translateY(100%)' : 'translateY(0)',
      // Spring physics — overshoot easing for that "Apple bounce" feel.
      transition: 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      willChange: 'transform',
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button key={tab.id} onClick={() => handleTap(tab.id, tab.action)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, cursor: 'pointer', background: 'none', border: 'none',
            // The whole tab area (flex:1 of a 56px nav) already gives the user
            // a ~75×56 hit target — well above Apple's 44 px minimum — so we
            // don't need minHeight here. Adding it was squashing the spacing.
            transition: 'opacity 200ms cubic-bezier(0.2, 0, 0.38, 0.9)',
          }}>
            <div style={{ animation: tapped === tab.id ? 'tabBounce 0.42s cubic-bezier(0.34,1.56,0.64,1)' : 'none', position: 'relative' }}>
              {tab.icon(isActive)}
              {tab.badge > 0 && (
                <div style={{
                  position: 'absolute', top: -2, right: -4,
                  minWidth: 16, height: 16, borderRadius: 8, // unified with NotifBell
                  background: '#EF4444', border: '1.5px solid #0A0A0A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: '#FFF', padding: '0 3px',
                }}>{tab.badge > 9 ? '9+' : tab.badge}</div>
              )}
            </div>
            <span style={{
              // Apple iOS tab bar labels are 10pt — was 9 (below readable threshold).
              fontSize: 10, fontWeight: isActive ? 700 : 500,
              color: isActive ? '#FFFFFF' : '#6B7280',
              letterSpacing: '0.015em',
              transition: 'color 200ms cubic-bezier(0.2, 0, 0.38, 0.9)',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── All users get the same nav ───────────────────────────────────────
export function BottomNav({ active, hidden, onTab, onLifeCounter, onNotifs, unreadCount, isOwner }) {
  // Labels in Spanish to match the rest of the app's copy.
  // Short forms picked to fit tab-bar width on iPhone SE (320 px).
  const tabs = [
    { id: 'feed',  label: 'Feed',     icon: (a) => <HomeIcon active={a} />,    action: () => onTab('feed') },
    { id: 'shop',  label: 'Tienda',   icon: (a) => <ShopIcon active={a} />,    action: () => onTab('shop') },
    { id: 'ranks', label: 'Ranking',  icon: (a) => <RanksIcon active={a} />,   action: () => onTab('ranks') },
    { id: 'life',  label: 'Vida',     icon: (a) => <CounterIcon active={a} />, action: onLifeCounter },
    { id: 'notif', label: 'Avisos',   icon: (a) => <BellIcon active={a} />,    action: onNotifs, badge: unreadCount },
  ]
  return (
    <OwnerBottomNav
      active={active} hidden={hidden} tabs={tabs}
      onTab={onTab} onLifeCounter={onLifeCounter} onNotifs={onNotifs} unreadCount={unreadCount}
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
