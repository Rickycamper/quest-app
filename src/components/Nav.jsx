// ─────────────────────────────────────────────
// QUEST — BottomNav + NotifBell
// ─────────────────────────────────────────────
import { HomeIcon, RanksIcon, FolderIcon, TruckIcon, PlusIcon, BellIcon } from './Icons'

export function BottomNav({ active, onTab, onPost }) {
  const tabs = [
    { id: 'feed',     label: 'Feed',     icon: (a) => <HomeIcon active={a}   /> },
    { id: 'ranks',    label: 'Ranks',    icon: (a) => <RanksIcon active={a}  /> },
    { id: 'post',     label: 'Post',     isPost: true },
    { id: 'folder',   label: 'Folder',   icon: (a) => <FolderIcon active={a} /> },
    { id: 'tracking', label: 'Tracking', icon: (a) => <TruckIcon active={a}  /> },
  ]

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 46,
      background: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(20px)',
      borderTop: '1px solid #1F1F1F',
      display: 'flex', alignItems: 'center', paddingTop: 0, zIndex: 100,
    }}>
      {tabs.map(tab => {
        if (tab.isPost) return (
          <button key="post" onClick={onPost} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', paddingTop: 0, background: 'none', border: 'none', cursor: 'pointer',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(255,255,255,0.15)', color: '#111111',
            }}><PlusIcon /></div>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', marginTop: 3, fontFamily: 'Inter, sans-serif' }}>Post</span>
          </button>
        )
        const isActive = active === tab.id
        return (
          <button key={tab.id} onClick={() => onTab(tab.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, cursor: 'pointer', paddingTop: 0,
            background: 'none', border: 'none', transition: 'all 0.15s',
          }}>
            {tab.icon(isActive)}
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
