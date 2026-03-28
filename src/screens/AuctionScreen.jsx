// ─────────────────────────────────────────────
// QUEST — AuctionScreen (gallery + live entry)
// ─────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { getAuctions, toggleAuctionWatch } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { GAME_STYLES } from '../lib/constants'
import GameIcon from '../components/GameIcon'
import LiveAuctionScreen from './LiveAuctionScreen'
import CreateAuctionModal from './CreateAuctionModal'

// ── Helpers ──────────────────────────────────
function fmtAmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function auctionStatus(a) {
  const start   = new Date(a.start_time).getTime()
  const end     = start + a.duration_seconds * 1000
  const now     = Date.now()
  if (a.status === 'ended' || a.status === 'cancelled') return a.status
  if (now < start) return 'pending'
  if (now <= end)  return 'active'
  return 'ended'
}

function useCountdownShort(targetMs) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    const tick = () => {
      const diff = targetMs - Date.now()
      if (diff <= 0) { setLabel('Ahora'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      if (h > 0) setLabel(`${h}h ${m}m`)
      else if (m > 0) setLabel(`${m}m ${s}s`)
      else setLabel(`${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetMs])
  return label
}

// ── Auction Card ──────────────────────────────
function AuctionCard({ auction, onOpen, onWatchToggle }) {
  const { profile } = useAuth()
  const status    = auctionStatus(auction)
  const gs        = auction.game ? (GAME_STYLES[auction.game] ?? GAME_STYLES['MTG']) : null
  const bids      = auction.auction_bids ?? []
  const topBid    = bids.reduce((max, b) => b.amount > (max?.amount ?? 0) ? b : max, null)
  const isWatching = (auction.auction_watches ?? []).some(w => w.user_id === profile?.id)
  const startMs   = new Date(auction.start_time).getTime()
  const endMs     = startMs + auction.duration_seconds * 1000
  const countdown = useCountdownShort(status === 'active' ? endMs : startMs)
  const isUnlocked = topBid && topBid.amount >= auction.min_bid

  const statusPill = {
    pending:   { label: `🕐 En ${countdown}`,    color: '#FCD34D', bg: 'rgba(252,211,77,0.1)',  border: 'rgba(252,211,77,0.25)' },
    active:    { label: `🔴 LIVE · ${countdown}`, color: '#F87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
    ended:     { label: '✓ Finalizada',           color: '#4ADE80', bg: 'rgba(74,222,128,0.08)',border: 'rgba(74,222,128,0.2)'  },
    cancelled: { label: '🔒 No vendida',          color: '#6B7280', bg: 'rgba(107,114,128,0.1)',border: 'rgba(107,114,128,0.2)' },
  }[status] ?? { label: status, color: '#6B7280', bg: '#111', border: '#222' }

  return (
    <div
      onClick={() => onOpen(auction)}
      style={{
        background: '#111', borderRadius: 14,
        border: `1px solid ${status === 'active' ? 'rgba(239,68,68,0.3)' : '#1F1F1F'}`,
        overflow: 'hidden', cursor: 'pointer',
        boxShadow: status === 'active' ? '0 0 16px rgba(239,68,68,0.12)' : 'none',
        animation: 'fadeUp 0.3s ease both',
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', height: 160, overflow: 'hidden', background: '#0D0D0D' }}>
        <img
          src={auction.image_url} alt={auction.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* Lock overlay on image */}
        {(status === 'pending' || (status !== 'ended' && status !== 'cancelled' && !isUnlocked)) && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            fontSize: 16, background: 'rgba(0,0,0,0.6)',
            borderRadius: 8, padding: '3px 8px',
          }}>🔒</div>
        )}
        {isUnlocked && status !== 'ended' && status !== 'cancelled' && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            fontSize: 10, fontWeight: 800, color: '#4ADE80',
            background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)',
            borderRadius: 8, padding: '3px 8px',
          }}>🔓</div>
        )}
        {/* Status pill */}
        <div style={{
          position: 'absolute', top: 8, right: 8,
          fontSize: 10, fontWeight: 800,
          padding: '3px 8px', borderRadius: 8,
          color: statusPill.color, background: statusPill.bg,
          border: `1px solid ${statusPill.border}`,
        }}>{statusPill.label}</div>
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', marginBottom: 6 }}>{auction.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {gs && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 700, color: gs.color,
                background: gs.bg, border: `1px solid ${gs.border}`,
                borderRadius: 6, padding: '2px 7px',
              }}>
                <GameIcon game={auction.game} size={10} />{auction.game}
              </span>
            )}
            <span style={{ fontSize: 11, color: '#4B5563' }}>
              {bids.length} bid{bids.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#4B5563' }}>
              {topBid ? 'Bid actual' : 'Mín'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#FFF' }}>
              {topBid ? fmtAmt(topBid.amount) : fmtAmt(auction.min_bid)}
            </div>
          </div>
        </div>

        {/* Watch toggle (only for pending/active) */}
        {(status === 'pending' || status === 'active') && (
          <button
            onClick={e => { e.stopPropagation(); onWatchToggle(auction, !isWatching) }}
            style={{
              marginTop: 10, width: '100%', padding: '7px',
              borderRadius: 8, border: `1px solid ${isWatching ? 'rgba(167,139,250,0.4)' : '#222'}`,
              background: isWatching ? 'rgba(167,139,250,0.1)' : 'transparent',
              color: isWatching ? '#A78BFA' : '#4B5563',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>
            {isWatching ? '🔔 Notificación activa' : '🔕 Notificarme'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Screen ───────────────────────────────
export default function AuctionScreen({ isStaff, onClose }) {
  const { profile } = useAuth()
  const [tab,         setTab]         = useState('upcoming')
  const [auctions,    setAuctions]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [liveAuction, setLiveAuction] = useState(null)
  const [showCreate,  setShowCreate]  = useState(false)
  const [refreshKey,  setRefreshKey]  = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAuctions()
      setAuctions(data || [])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  // Auto-open live auction if exists
  useEffect(() => {
    const live = auctions.find(a => auctionStatus(a) === 'active')
    if (live && !liveAuction) {
      // Don't auto-open — let user tap
    }
  }, [auctions, liveAuction])

  const handleWatchToggle = async (auction, watching) => {
    setAuctions(prev => prev.map(a => {
      if (a.id !== auction.id) return a
      const watches = a.auction_watches ?? []
      return {
        ...a,
        auction_watches: watching
          ? [...watches, { user_id: profile.id }]
          : watches.filter(w => w.user_id !== profile.id),
      }
    }))
    await toggleAuctionWatch(auction.id, watching)
  }

  const now = Date.now()
  const upcomingList = auctions.filter(a => {
    const s = auctionStatus(a)
    return s === 'pending' || s === 'active'
  }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

  const historyList = auctions.filter(a => {
    const s = auctionStatus(a)
    return s === 'ended' || s === 'cancelled'
  }).sort((a, b) => new Date(b.start_time) - new Date(a.start_time))

  const listToShow = tab === 'upcoming' ? upcomingList : historyList

  const hasLive = upcomingList.some(a => auctionStatus(a) === 'active')

  // Skeleton
  const sk = (w, h, r = 6) => ({
    width: w, height: h, borderRadius: r, background:
      'linear-gradient(90deg,#141414 25%,#1E1E1E 50%,#141414 75%)',
    backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite linear',
    display: 'block',
  })

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      background: '#0A0A0A', display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      animation: 'slideUp 0.22s ease',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 16px 12px',
        background: '#0D0D0D', borderBottom: '1px solid #1A1A1A', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6B7280', fontSize: 20, lineHeight: 1, padding: '0 2px',
        }}>←</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#FFF' }}>Subastas</div>
          {hasLive && (
            <div style={{ fontSize: 10, color: '#F87171', fontWeight: 800, letterSpacing: '0.06em' }}>● EN VIVO</div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        {isStaff && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '7px 14px', borderRadius: 10, border: 'none',
              background: 'rgba(255,255,255,0.06)', color: '#9CA3AF',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>+ Nueva</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', flexShrink: 0, borderBottom: '1px solid #141414' }}>
        {[
          { id: 'upcoming', label: `Próximas / En vivo${upcomingList.length ? ` (${upcomingList.length})` : ''}` },
          { id: 'history',  label: `Historial${historyList.length ? ` (${historyList.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '6px 14px', borderRadius: 8,
            border: `1px solid ${tab === t.id ? 'rgba(255,255,255,0.3)' : '#222'}`,
            background: tab === t.id ? 'rgba(255,255,255,0.07)' : 'transparent',
            color: tab === t.id ? '#FFF' : '#4B5563',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '12px 16px 32px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ borderRadius: 14, background: '#111', overflow: 'hidden', border: '1px solid #1A1A1A' }}>
                <span style={{ ...sk('100%', 160, 0), display: 'block' }} />
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={sk('80%', 13)} />
                  <span style={sk('55%', 11)} />
                </div>
              </div>
            ))}
          </div>
        ) : listToShow.length === 0 ? (
          <div style={{ padding: '64px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔨</div>
            <div style={{ fontSize: 14, color: '#4B5563' }}>
              {tab === 'upcoming' ? 'No hay subastas próximas' : 'Sin historial de subastas'}
            </div>
            {tab === 'upcoming' && isStaff && (
              <button onClick={() => setShowCreate(true)} style={{
                marginTop: 16, padding: '10px 24px', borderRadius: 10, border: 'none',
                background: '#FFF', color: '#111', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>Crear primera subasta</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {listToShow.map(a => (
              <AuctionCard
                key={a.id}
                auction={a}
                onOpen={setLiveAuction}
                onWatchToggle={handleWatchToggle}
              />
            ))}
          </div>
        )}
      </div>

      {/* Live auction overlay */}
      {liveAuction && (
        <LiveAuctionScreen
          auction={liveAuction}
          onClose={() => setLiveAuction(null)}
          onAuctionEnded={() => setRefreshKey(k => k + 1)}
        />
      )}

      {/* Create modal (staff) */}
      {showCreate && (
        <CreateAuctionModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setRefreshKey(k => k + 1) }}
        />
      )}
    </div>
  )
}
