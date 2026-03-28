// ─────────────────────────────────────────────
// QUEST — BottomNav + NotifBell
// ─────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { HomeIcon, RanksIcon, FolderIcon, TruckIcon, PlusIcon, BellIcon } from './Icons'

export function BottomNav({ active, hidden, onTab, onPost }) {
  const [tapped,       setTapped]       = useState(null)
  const [postPressed,  setPostPressed]  = useState(false)
  const tapTimer  = useRef(null)
  const postTimer = useRef(null)
  useEffect(() => () => { clearTimeout(tapTimer.current); clearTimeout(postTimer.current) }, [])

  const handleTab = (id) => {
    clearTimeout(tapTimer.current)
    setTapped(id)
    tapTimer.current = setTimeout(() => setTapped(null), 420)
    onTab(id)
  }

  const tabs = [
    { id: 'feed',     label: 'Feed',     icon: (a) => <HomeIcon active={a}   /> },
    { id: 'ranks',    label: 'Ranks',    icon: (a) => <RanksIcon active={a}  /> },
    { id: 'post',     label: 'Post',     isPost: true },
    { id: 'folder',   label: 'Folder',   icon: (a) => <FolderIcon active={a} /> },
    { id: 'tracking', label: 'Tracking', icon: (a) => <TruckIcon active={a}  /> },
  ]

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      background: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(20px)',
      borderTop: '1px solid #1F1F1F',
      display: 'flex', alignItems: 'flex-end',
      paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))', zIndex: 100,
      overflow: 'visible',
      transform: hidden ? 'translateY(100%)' : 'translateY(0)',
      transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
      willChange: 'transform',
    }}>
      {tabs.map(tab => {
        if (tab.isPost) return (
          <button key="post"
            onTouchStart={() => { clearTimeout(postTimer.current); setPostPressed(true) }}
            onTouchEnd={() => { postTimer.current = setTimeout(() => setPostPressed(false), 180) }}
            onClick={onPost}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'flex-end', background: 'none', border: 'none', cursor: 'pointer',
              position: 'relative', height: '100%',
            }}>
            {/* Circle that sticks out above the nav */}
            <div style={{
              position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
              width: 48, height: 48, borderRadius: 16,
            }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: 16,
                background: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
                color: '#111111',
                transform: postPressed ? 'scale(0.87)' : 'scale(1)',
                transition: 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1)',
              }}><PlusIcon /></div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>Post</span>
          </button>
        )
        const isActive = active === tab.id
        return (
          <button key={tab.id} onClick={() => handleTab(tab.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, cursor: 'pointer',
            background: 'none', border: 'none', transition: 'all 0.15s',
          }}>
            <div style={{ animation: tapped === tab.id ? 'tabBounce 0.42s cubic-bezier(0.34,1.56,0.64,1)' : 'none' }}>
              {tab.icon(isActive)}
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, color: isActive ? '#FFFFFF' : '#4B5563', fontFamily: 'Inter, sans-serif' }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
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
