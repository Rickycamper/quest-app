// ─────────────────────────────────────────────
// QUEST — NotificationPanel
// Icons: Font Awesome Free 6.7.2 via Streamline (https://streamlinehq.com)
// License: CC BY 4.0 — https://fontawesome.com/license/free
// ─────────────────────────────────────────────
import { useState } from 'react'
import { NOTIF_CONFIG, ROLE_CONFIG } from '../lib/constants'
import { respondToMatch, markNotificationResponded, joinTournament } from '../lib/supabase'

// Inline SVG icons — Font Awesome Free 6.7.2 via Streamline (https://streamlinehq.com)
// License: CC BY 4.0 — https://fontawesome.com/license/free
function NotifIcon({ type, color }) {
  const s = { display: 'block' }
  // bell
  if (type === 'auction_live') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={color} style={s}>
      <path d="M7.999325 0.16c-0.542 0-0.98 0.438-0.98 0.98v0.588c-2.236 0.453-3.92 2.432-3.92 4.802v0.576c0 1.439-0.53 2.83-1.485 3.908l-0.227 0.254c-0.257 0.288-0.318 0.701-0.162 1.053s0.505 0.579 0.891 0.579h11.76c0.386 0 0.735-0.227 0.894-0.579s0.095-0.765-0.162-1.053l-0.227-0.254c-0.956-1.078-1.485-2.465-1.485-3.908V6.53c0-2.37-1.684-4.349-3.92-4.802V1.14c0-0.542-0.438-0.98-0.98-0.98Zm1.387 15.107c0.368-0.368 0.573-0.867 0.573-1.387h-3.92c0 0.521 0.205 1.02 0.573 1.387s0.867 0.573 1.387 0.573 1.02-0.205 1.387-0.573Z" strokeWidth="0"/>
    </svg>
  )
  // bolt
  if (type === 'match_result') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={color} style={s}>
      <path d="M11.84 1.526c0.181-0.42 0.046-0.91-0.325-1.179s-0.876-0.245-1.222 0.055L2.454 7.262c-0.306 0.269-0.416 0.701-0.273 1.081s0.511 0.637 0.919 0.637h3.415l-2.355 5.494c-0.181 0.42-0.046 0.91 0.325 1.179s0.876 0.245 1.222-0.055l8.839-7.599c0.306-0.269 0.416-0.701 0.273-1.081s-0.508-0.634-0.919-0.634H10.486l2.355-5.497Z" strokeWidth="0"/>
    </svg>
  )
  // crown
  if (type === 'auction_won' || type === 'tournament_pending') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={color} style={s}>
      <path d="M8.572 3.917c0.31-0.191 0.517-0.536 0.517-0.926 0-0.601-0.487-1.089-1.089-1.089s-1.089 0.487-1.089 1.089c0 0.392 0.207 0.735 0.517 0.926l-1.56 3.12c-0.248 0.495-0.89 0.637-1.323 0.291L2.12 5.387c0.136-0.182 0.218-0.408 0.218-0.653 0-0.601-0.487-1.089-1.089-1.089S0.16 4.133 0.16 4.734s0.487 1.089 1.089 1.089h0.019l1.244 6.844c0.15 0.828 0.871 1.432 1.715 1.432h7.546c0.841 0 1.563-0.601 1.715-1.432l1.244-6.844h0.019c0.601 0 1.089-0.487 1.089-1.089s-0.487-1.089-1.089-1.089-1.089 0.487-1.089 1.089c0 0.245 0.082 0.471 0.218 0.653l-2.426 1.941c-0.433 0.346-1.075 0.204-1.323-0.291L8.572 3.917Z" strokeWidth="0"/>
    </svg>
  )
  // gavel
  if (type === 'auction_ended') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={color} style={s}>
      <path d="M9.917 0.449c-0.383-0.383-1.004-0.383-1.387 0L4.856 4.122c-0.383 0.383-0.383 1.004 0 1.387l0.49 0.49c0.383 0.383 1.004 0.383 1.387 0l0.122-0.122 3.27 3.267-0.122 0.122c-0.383 0.383-0.383 1.004 0 1.387l0.49 0.49c0.383 0.383 1.004 0.383 1.387 0l4.122-4.122c0.383-0.383 0.383-1.004 0-1.387l-0.49-0.49c-0.383-0.383-1.004-0.383-1.387 0l-0.122 0.122-3.27-3.266 0.122-0.122c0.383-0.383 0.383-1.004 0-1.387L9.917 0.449ZM5.263 9.266c-0.383-0.383-1.004-0.383-1.387 0L0.447 12.695c-0.383 0.383-0.383 1.004 0 1.387l1.47 1.47c0.383 0.383 1.004 0.383 1.387 0l3.429-3.429c0.383-0.383 0.383-1.004 0-1.387l-0.043-0.043 1.8-1.797-1.387-1.387-1.797 1.797-0.043-0.043Z" strokeWidth="0"/>
    </svg>
  )
  // message
  if (type === 'new_message') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={color} style={s}>
      <path d="M2 0C0.897 0 0 0.897 0 2v9c0 1.103 0.897 2 2 2h3v2.5c0 0.191 0.106 0.363 0.275 0.447s0.372 0.066 0.525-0.047L9.666 13H14c1.103 0 2-0.897 2-2V2c0-1.103-0.897-2-2-2H2z" strokeWidth="0"/>
    </svg>
  )
  // truck
  if (type === 'new_package') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={color} style={s}>
      <path d="M1.336 1.728c-0.649 0-1.176 0.527-1.176 1.176v7.84c0 0.649 0.527 1.176 1.176 1.176h0.392c0 1.299 1.054 2.352 2.352 2.352s2.352-1.054 2.352-2.352h3.136c0 1.299 1.054 2.352 2.352 2.352s2.352-1.054 2.352-2.352h0.784c0.434 0 0.784-0.35 0.784-0.784s-0.35-0.784-0.784-0.784V7.542c0-0.417-0.164-0.816-0.458-1.11L13.232 4.538c-0.294-0.294-0.693-0.458-1.11-0.458H10.352V2.904c0-0.649-0.527-1.176-1.176-1.176H1.336Zm9.016 3.92h1.242l1.894 1.894V8H10.352V5.648ZM2.904 11.92c0-0.905 0.98-1.471 1.764-1.018 0.364 0.21 0.588 0.598 0.588 1.018 0 0.905-0.98 1.471-1.764 1.018-0.364-0.21-0.588-0.598-0.588-1.018Zm9.016-1.176c0.905 0 1.471 0.98 1.018 1.764-0.21 0.364-0.598 0.588-1.018 0.588-0.905 0-1.471-0.98-1.018-1.764 0.21-0.364 0.598-0.588 1.018-0.588Z" strokeWidth="0"/>
    </svg>
  )
  // circle-check
  if (type === 'package_arrived' || type === 'claim_approved') return (
    <svg width="16" height="16" viewBox="0 0 512 512" fill={color} style={s}>
      <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z" strokeWidth="0"/>
    </svg>
  )
  // circle-xmark
  if (type === 'claim_rejected') return (
    <svg width="16" height="16" viewBox="0 0 512 512" fill={color} style={s}>
      <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z" strokeWidth="0"/>
    </svg>
  )
  // ticket / tournament invite
  if (type === 'tournament_invite') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={color} style={s}>
      <path d="M14.56 5.84a1.68 1.68 0 0 0 0-3.36H1.44a1.68 1.68 0 0 0 0 3.36 .84 .84 0 0 1 0 1.68 1.68 1.68 0 0 0 0 3.36h13.12a1.68 1.68 0 0 0 0-3.36 .84 .84 0 0 1 0-1.68ZM6.16 4.72h3.68v1.12H6.16V4.72Zm0 4.48v-1.12h3.68V9.2H6.16Z" strokeWidth="0"/>
    </svg>
  )
  // flag
  if (type === 'new_claim' || type === 'post_reported') return (
    <svg width="16" height="16" viewBox="0 0 448 512" fill={color} style={s}>
      <path d="M64 32C64 14.3 49.7 0 32 0S0 14.3 0 32L0 64 0 368 0 480c0 17.7 14.3 32 32 32s32-14.3 32-32l0-128 64.3-16.1c41.1-10.3 84.6-5.5 122.5 13.4c44.2 22.1 95.5 24.8 141.7 7.4l34.7-13c12.5-4.7 20.8-16.6 20.8-30l0-247.7c0-23-24.2-38-44.8-27.7l-9.6 4.8c-46.3 23.2-100.8 23.2-147.1 0c-35.1-17.6-75.4-22-113.5-12.5L64 48l0-16z" strokeWidth="0"/>
    </svg>
  )
  // triangle-exclamation (default fallback)
  return (
    <svg width="16" height="16" viewBox="0 0 512 512" fill={color} style={s}>
      <path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480L40 480c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24l0 112c0 13.3 10.7 24 24 24s24-10.7 24-24l0-112c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z" strokeWidth="0"/>
    </svg>
  )
}

const NOTIF_TAB = {
  package_arrived:    'tracking',
  package_delivered:  'tracking',
  new_package:        'tracking',
  claim_approved:     'ranks',
  claim_rejected:     'ranks',
  tournament_created: 'ranks',
  tournament_invite:  'ranks',
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

function TournamentInviteActions({ notif, onResponded }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err,  setErr]  = useState('')

  const meta = typeof notif.meta === 'string'
    ? (() => { try { return JSON.parse(notif.meta) } catch { return {} } })()
    : (notif.meta || {})

  const handle = async (e) => {
    e.stopPropagation()
    if (busy) return
    setBusy(true); setErr('')
    try {
      await joinTournament(meta.tournamentId)
      await markNotificationResponded(notif.id, 'confirmed')
      setDone(true)
      onResponded?.(notif.id, 'confirmed')
    } catch (e) {
      setErr(e.message || 'Error al inscribirse')
      setBusy(false)
    }
  }

  if (done) return (
    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#34D399', fontFamily: 'Inter, sans-serif' }}>
      ✅ ¡Te inscribiste!
    </div>
  )

  return (
    <div style={{ marginTop: 10 }}>
      {err && <div style={{ fontSize: 11, color: '#F87171', marginBottom: 6, fontFamily: 'Inter, sans-serif' }}>{err}</div>}
      <button
        disabled={busy}
        onClick={handle}
        style={{
          width: '100%', padding: '8px 0', borderRadius: 8,
          cursor: busy ? 'default' : 'pointer',
          background: 'rgba(52,211,153,0.12)', border: '1.5px solid rgba(52,211,153,0.35)',
          color: '#34D399', fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
          opacity: busy ? 0.5 : 1, transition: 'opacity 0.15s',
        }}
      >
        {busy ? '…' : '🏆 Unirse al torneo'}
      </button>
    </div>
  )
}

function NotifCard({ notif, onRead, onNavigate, onOpenChat, onMatchResponded, onTournamentJoined, onViewProfile }) {
  const cfg   = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.new_package
  const title = notif.title.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, '')
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

  // Show join button if: it's a tournament invite, has a tournamentId, and user hasn't responded yet
  const isPendingInvite = notif.type === 'tournament_invite' &&
    !!meta.tournamentId &&
    meta.status !== 'confirmed' &&
    meta.status !== 'responded'

  const handleClick = () => {
    if (isPendingMatch || isPendingInvite) return   // don't navigate — user must respond first
    if (!notif.read) onRead(notif.id)

    // Message notifications → open chat directly with the sender
    if (notif.type === 'new_message' && meta.senderId) {
      onOpenChat?.({ id: meta.senderId, username: meta.senderUsername ?? '' })
      return
    }
    // Winner clicks auction_won → open DM with the admin who will coordinate payment
    if (notif.type === 'auction_won' && meta.adminId) {
      onOpenChat?.({ id: meta.adminId, username: meta.adminUsername ?? 'Quest' })
      return
    }
    // Admin clicks auction_ended → open DM with the winner to coordinate payment/logistics
    if (notif.type === 'auction_ended' && meta.winnerId) {
      onOpenChat?.({ id: meta.winnerId, username: meta.winnerUsername ?? '' })
      return
    }
    // Like/follow notifications → go to that user's profile
    if (notif.type === 'like' && meta.userId) {
      onViewProfile?.(meta.userId); return
    }
    if (notif.type === 'follow' && meta.userId) {
      onViewProfile?.(meta.userId); return
    }
    const tab = NOTIF_TAB[notif.type] ?? 'feed'
    onNavigate?.(tab)
  }

  return (
    <div onClick={handleClick} style={{
      background: notif.read ? '#0D0D0D' : '#111111',
      border: `1px solid ${notif.read ? '#1A1A1A' : cfg.border}`,
      borderRadius: 12, padding: '12px 14px', marginBottom: 8,
      cursor: (isPendingMatch || isPendingInvite) ? 'default' : (['auction_won','auction_ended'].includes(notif.type) || !notif.read) ? 'pointer' : 'default',
      opacity: notif.read && !isPendingMatch && !isPendingInvite ? 0.6 : 1,
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
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <NotifIcon type={notif.type} color={cfg.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', marginBottom: 3 }}>{title}</div>
          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.4 }}>{notif.body}</div>
          <div style={{ fontSize: 11, color: '#374151', marginTop: 5 }}>{timeAgo}</div>
          {/* Accept / Reject buttons for pending match requests */}
          {isPendingMatch && (
            <MatchActions notif={notif} onResponded={(id, status) => { onRead(id); onMatchResponded?.(id, status) }} />
          )}
          {/* One-click join for tournament invites */}
          {isPendingInvite && (
            <TournamentInviteActions notif={notif} onResponded={(id, status) => { onRead(id); onTournamentJoined?.(id, status) }} />
          )}
        </div>
        {!notif.read && !isPendingMatch && !isPendingInvite && (
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
        {isPendingInvite && (
          <div style={{
            fontSize: 9, fontWeight: 800, color: '#34D399',
            background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)',
            borderRadius: 6, padding: '3px 7px', flexShrink: 0,
            fontFamily: 'Inter, sans-serif', letterSpacing: '0.04em',
          }}>INVITACIÓN</div>
        )}
      </div>
    </div>
  )
}

export default function NotificationPanel({ profile, notifications, onClose, onMarkRead, onMarkAll, onMarkResponded, onNavigate, onOpenChat, onViewProfile, onTournamentJoined }) {
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
        padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 16px',
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
                onOpenChat={(u) => { onOpenChat?.(u); onClose() }}
                onMatchResponded={handleMatchResponded}
                onTournamentJoined={(id, s) => { onMarkRead(id); onMarkResponded?.(id, s); onTournamentJoined?.() }}
                onViewProfile={(id) => { onViewProfile?.(id); onClose() }}
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
                onOpenChat={(u) => { onOpenChat?.(u); onClose() }}
                onMatchResponded={handleMatchResponded}
                onTournamentJoined={(id, s) => { onMarkRead(id); onMarkResponded?.(id, s); onTournamentJoined?.() }}
                onViewProfile={(id) => { onViewProfile?.(id); onClose() }}
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
