// ─────────────────────────────────────────────
// QUEST — NotificationPanel
// ─────────────────────────────────────────────
import { useState } from 'react'
import { NOTIF_CONFIG, ROLE_CONFIG } from '../lib/constants'
import { respondToMatch, markNotificationResponded } from '../lib/supabase'

const NOTIF_TAB = {
  package_arrived:    'tracking',
  package_delivered:  'tracking',
  new_package:        'tracking',
  claim_approved:     'ranks',
  claim_rejected:     'ranks',
  tournament_created: 'ranks',
  new_follower:       'feed',
  post_like:          'feed',
  post_comment:       'feed',
  new_message:        'feed',
  match_result:       'feed',
}

function MatchActions({ notif, onResponded }) {
  const [busy,   setBusy]   = useState(false)
  const [done,   setDone]   = useState(null)  // 'accepted' | 'rejected'
  const [err,    setErr]    = useState('')

  const handle = async (accept) => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      const matchMeta = typeof notif.meta === 'string' ? JSON.parse(notif.meta) : notif.meta
      const finalStatus = accept ? 'confirmed' : 'rejected'
      await respondToMatch(matchMeta.matchId, accept)
      // Persist the response in the notification meta so it survives a refresh
      await markNotificationResponded(notif.id, finalStatus)
      setDone(accept ? 'accepted' : 'rejected')
      onResponded?.(notif.id, finalStatus)
    } catch (e) {
      setErr(e.message || 'Error')
      setBusy(false)
    }
  }

  if (done) return (
    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
      color: done === 'accepted' ? '#4ADE80' : '#F87171' }}>
      {done === 'accepted' ? '✅ Resultado confirmado' : '❌ Resultado rechazado'}
    </div>
  )

  return (
    <div style={{ marginTop: 10 }}>
      {err && <div style={{ fontSize: 11, color: '#F87171', marginBottom: 6, fontFamily: 'Inter, sans-serif' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); handle(true) }}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 8, cursor: busy ? 'default' : 'pointer',
            background: 'rgba(74,222,128,0.12)', border: '1.5px solid rgba(74,222,128,0.35)',
            color: '#4ADE80', fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
            opacity: busy ? 0.5 : 1, transition: 'opacity 0.15s',
          }}
        >
          {busy ? '…' : '✅ Confirmar'}
        </button>
        <button
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); handle(false) }}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 8, cursor: busy ? 'default' : 'pointer',
            background: 'rgba(248,113,113,0.1)', border: '1.5px solid rgba(248,113,113,0.3)',
            color: '#F87171', fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
            opacity: busy ? 0.5 : 1, transition: 'opacity 0.15s',
          }}
        >
          ❌ Rechazar
        </button>
      </div>
    </div>
  )
}

function NotifCard({ notif, onRead, onNavigate, onMatchResponded }) {
  const cfg   = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.new_package
  const emoji = notif.title.split(' ')[0]
  const title = notif.title.split(' ').slice(1).join(' ')
  const timeAgo = new Date(notif.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

  // Parse meta safely (realtime delivers jsonb as string)
  const meta = typeof notif.meta === 'string'
    ? (() => { try { return JSON.parse(notif.meta) } catch { return {} } })()
    : (notif.meta || {})

  // Show confirm/reject buttons if: it's a match result, has a matchId, and user hasn't responded yet
  const isPendingMatch = notif.type === 'match_result' &&
    !!meta.matchId &&
    meta.status !== 'responded' &&
    meta.status !== 'confirmed' &&
    meta.status !== 'rejected'

  const handleClick = () => {
    if (isPendingMatch) return   // don't navigate — user must respond first
    if (!notif.read) onRead(notif.id)
    const tab = NOTIF_TAB[notif.type] ?? 'feed'
    onNavigate?.(tab)
  }

  return (
    <div onClick={handleClick} style={{
      background: notif.read ? '#0D0D0D' : '#111111',
      border: `1px solid ${notif.read ? '#1A1A1A' : cfg.border}`,
      borderRadius: 12, padding: '12px 14px', marginBottom: 8,
      cursor: isPendingMatch ? 'default' : (notif.read ? 'default' : 'pointer'),
      opacity: notif.read && !isPendingMatch ? 0.6 : 1,
      position: 'relative', overflow: 'hidden',
      transition: 'all 0.15s',
    }}>
      {!notif.read && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: cfg.color, borderRadius: '12px 0 0 12px',
        }} />
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: cfg.bg, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>{emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', marginBottom: 3 }}>{title}</div>
          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.4 }}>{notif.body}</div>
          <div style={{ fontSize: 11, color: '#374151', marginTop: 5 }}>{timeAgo}</div>
          {/* Accept / Reject buttons for pending match requests */}
          {isPendingMatch && (
            <MatchActions notif={notif} onResponded={(id, status) => { onRead(id); onMatchResponded?.(id, status) }} />
          )}
        </div>
        {!notif.read && !isPendingMatch && (
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: cfg.color, flexShrink: 0, marginTop: 4,
            boxShadow: `0 0 6px ${cfg.color}`,
          }} />
        )}
        {isPendingMatch && (
          <div style={{
            fontSize: 9, fontWeight: 800, color: '#FB923C',
            background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.3)',
            borderRadius: 6, padding: '3px 7px', flexShrink: 0,
            fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em',
          }}>PENDIENTE</div>
        )}
      </div>
    </div>
  )
}

export default function NotificationPanel({ profile, notifications, onClose, onMarkRead, onMarkAll, onMarkResponded, onNavigate }) {
  // Track locally which pending match notifications have been responded to (to hide buttons immediately)
  const [respondedIds, setRespondedIds] = useState(new Set())

  const augmented = notifications.map(n => {
    const m = typeof n.meta === 'string' ? (() => { try { return JSON.parse(n.meta) } catch { return {} } })() : (n.meta || {})
    return respondedIds.has(n.id) && m.status === 'pending'
      ? { ...n, meta: { ...m, status: 'responded' } }
      : { ...n, meta: m }
  })

  const unreadList = augmented.filter(n => !n.read)
  const readList   = augmented.filter(n =>  n.read)
  const unread = unreadList.length
  const rc = ROLE_CONFIG[profile?.role] || ROLE_CONFIG.client
  const isStaff = profile?.role === 'staff' || profile?.role === 'admin'

  const handleMatchResponded = (id, status) => {
    setRespondedIds(prev => new Set([...prev, id]))
    onMarkResponded?.(id, status)  // update local state in hook so refresh doesn't show buttons again
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, background: '#0A0A0A',
      zIndex: 300, display: 'flex', flexDirection: 'column',
      animation: 'slideDown 0.25s ease both',
    }}>
      <div style={{
        padding: '52px 20px 16px',
        background: '#111111', borderBottom: '1px solid #1F1F1F', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF' }}>Notificaciones</div>
            {unread > 0 && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{unread} sin leer</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {unread > 0 && (
              <button onClick={onMarkAll} style={{
                padding: '7px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', border: '1px solid #2A2A2A',
                color: '#9CA3AF', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}>✓ Leer todo</button>
            )}
            <button onClick={onClose} style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', border: 'none',
              color: '#9CA3AF', cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>
        </div>

        {isStaff && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 10,
            background: rc.bg, border: `1px solid ${rc.border}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>{profile?.role === 'admin' ? '👑' : '🛡️'}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: rc.color, letterSpacing: '0.06em' }}>
                {profile?.role === 'admin' ? 'ADMINISTRADOR — TODAS LAS SUCURSALES' : `STAFF · ${profile?.branch}`}
              </div>
              <div style={{ fontSize: 11, color: '#4B5563' }}>Notificaciones operativas activas</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '12px 16px' }}>
        {unreadList.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.12em', padding: '4px 0 10px' }}>SIN LEER</div>
            {unreadList.map(n => (
              <NotifCard key={n.id} notif={n} onRead={onMarkRead}
                onNavigate={(tab) => { onNavigate?.(tab); onClose() }}
                onMatchResponded={handleMatchResponded}
              />
            ))}
          </>
        )}
        {readList.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.12em', padding: '16px 0 10px' }}>ANTERIORES</div>
            {readList.map(n => (
              <NotifCard key={n.id} notif={n} onRead={onMarkRead}
                onNavigate={(tab) => { onNavigate?.(tab); onClose() }}
                onMatchResponded={handleMatchResponded}
              />
            ))}
          </>
        )}
        {notifications.length === 0 && (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            <div style={{ fontSize: 14, color: '#4B5563' }}>Sin notificaciones</div>
          </div>
        )}
      </div>
    </div>
  )
}
