// ─────────────────────────────────────────────
// QUEST — BottomNav + NotifBell
// ─────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { HomeIcon, RanksIcon, FolderIcon, TruckIcon, PlusIcon, BellIcon, CounterIcon, UserIcon, ShopIcon } from './Icons'

// ── Owner nav: Feed · Shop · Rank · Counter · Tracking · Notifs ──
function OwnerBottomNav({ active, hidden, tabs }) {
  const [tapped, setTapped] = useState(null)
  const tapTimer = useRef(null)
  useEffect(() => () => clearTimeout(tapTimer.current), [])

  const handleTap = (id, action) => {
    clearTimeout(tapTimer.current)
    setTapped(id)
    tapTimer.current = setTimeout(() => setTapped(null), 420)
    action()
  }

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      background: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(20px)',
      borderTop: '1px solid #1F1F1F',
      display: 'flex', alignItems: 'flex-end',
      paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))', zIndex: 100,
      transform: hidden ? 'translateY(100%)' : 'translateY(0)',
      transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
      willChange: 'transform',
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button key={tab.id} onClick={() => handleTap(tab.id, tab.action)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, cursor: 'pointer', background: 'none', border: 'none', transition: 'all 0.15s',
          }}>
            <div style={{ animation: tapped === tab.id ? 'tabBounce 0.42s cubic-bezier(0.34,1.56,0.64,1)' : 'none', position: 'relative' }}>
              {tab.icon(isActive)}
              {tab.badge > 0 && (
                <div style={{
                  position: 'absolute', top: -2, right: -4,
                  minWidth: 14, height: 14, borderRadius: 7,
                  background: '#EF4444', border: '1.5px solid #0A0A0A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 800, color: '#FFF', padding: '0 2px',
                }}>{tab.badge > 9 ? '9+' : tab.badge}</div>
              )}
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, color: isActive ? '#FFFFFF' : '#4B5563', fontFamily: 'Inter, sans-serif' }}>
              {tab.label}
            </span>
            {/* Active indicator pill */}
            <div style={{
              height: 2, borderRadius: 2,
              width: isActive ? 18 : 0,
              background: '#FFFFFF',
              boxShadow: isActive ? '0 0 6px rgba(255,255,255,0.5)' : 'none',
              transition: 'width 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease',
              marginTop: 1,
            }} />
          </button>
        )
      })}
    </div>
  )
}

// ── All users get the same nav ───────────────────────────────────────
export function BottomNav({ active, hidden, onTab, onLifeCounter, onNotifs, unreadCount, isOwner }) {
  const tabs = [
    { id: 'feed',  label: 'Feed',    icon: (a) => <HomeIcon active={a} />,    action: () => onTab('feed') },
    { id: 'shop',  label: 'Shop',    icon: (a) => <ShopIcon active={a} />,    action: () => onTab('shop') },
    { id: 'ranks', label: 'Rank',    icon: (a) => <RanksIcon active={a} />,   action: () => onTab('ranks') },
    { id: 'life',  label: 'Counter', icon: (a) => <CounterIcon active={a} />, action: onLifeCounter },
    { id: 'notif', label: 'Notifs',  icon: (a) => <BellIcon active={a} />,    action: onNotifs, badge: unreadCount },
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
