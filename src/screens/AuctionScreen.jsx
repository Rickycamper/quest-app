// ─────────────────────────────────────────────
// QUEST — AuctionScreen
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
  const start = new Date(a.start_time).getTime()
  const end   = start + a.duration_seconds * 1000
  const now   = Date.now()
  if (a.status === 'ended' || a.status === 'cancelled') return a.status
  if (now < start) return 'pending'
  if (now <= end)  return 'active'
  return 'ended'
}

function fmtDateTime(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short' })
    + ' · '
    + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function Countdown({ targetMs }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    const tick = () => {
      const diff = targetMs - Date.now()
      if (diff <= 0) { setLabel('¡Ahora!'); return }
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
  return <span>{label}</span>
}

// ── Auction Card ──────────────────────────────
function AuctionCard({ auction, onOpen, onWatchToggle }) {
  const { profile } = useAuth()
  const status     = auctionStatus(auction)
  const gs         = auction.game ? (GAME_STYLES[auction.game] ?? GAME_STYLES['MTG']) : null
  const bids       = auction.auction_bids ?? []
  const topBid     = bids.reduce((max, b) => b.amount > (max?.amount ?? 0) ? b : max, null)
  const isWatching = (auction.auction_watches ?? []).some(w => w.user_id === profile?.id)
  const startMs    = new Date(auction.start_time).getTime()
  const endMs      = startMs + auction.duration_seconds * 1000
  const isUnlocked = topBid && topBid.amount >= auction.min_bid
  const isActive   = status === 'active'
  const isPast     = status === 'ended' || status === 'cancelled'

  return (
    <div style={{
      background: '#111', borderRadius: 16,
      border: `1px solid ${isActive ? 'rgba(239,68,68,0.35)' : '#1F1F1F'}`,
      marginBottom: 12, overflow: 'hidden',
      boxShadow: isActive ? '0 0 20px rgba(239,68,68,0.1)' : 'none',
      animation: 'fadeUp 0.3s ease both',
    }}>
      {/* Image + status badge */}
      <div
        onClick={() => !isPast && onOpen(auction)}
        style={{ position: 'relative', cursor: isPast ? 'default' : 'pointer' }}
      >
        <img
          src={auction.image_url} alt={auction.title}
          style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
        />

        {/* Lock / unlock overlay */}
        {!isUnlocked && !isPast && (
          <div style={{
            position: 'absolute', bottom: 10, left: 10,
            background: 'rgba(0,0,0,0.75)', borderRadius: 10,
            padding: '4px 10px', fontSize: 12, color: '#9CA3AF', fontWeight: 700,
          }}>🔒 Mín {fmtAmt(auction.min_bid)}</div>
        )}
        {isUnlocked && !isPast && (
          <div style={{
            position: 'absolute', bottom: 10, left: 10,
            background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)',
            borderRadius: 10, padding: '4px 10px', fontSize: 12, color: '#4ADE80', fontWeight: 800,
          }}>🔓 {fmtAmt(topBid.amount)}</div>
        )}

        {/* Status badge */}
        {isActive && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(239,68,68,0.9)', borderRadius: 8,
            padding: '4px 10px', fontSize: 11, color: '#FFF', fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFF', display: 'inline-block', animation: 'pulse 1s infinite' }} />
            EN VIVO · <Countdown targetMs={endMs} />
          </div>
        )}
        {isPast && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#6B7280' }}>
              {status === 'cancelled' ? '🔒 No vendida' : '✓ Finalizada'}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '14px 14px 12px' }}>
        {/* Title + game */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#FFF', marginBottom: 4 }}>
              {auction.title}
            </div>
            {gs && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 700, color: gs.color,
                background: gs.bg, border: `1px solid ${gs.border}`,
                borderRadius: 6, padding: '2px 8px',
              }}>
                <GameIcon game={auction.game} size={10} />{auction.game}
              </span>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: '#4B5563', marginBottom: 2 }}>
              {topBid ? 'Bid actual' : 'Bid mínimo'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#FFF' }}>
              {topBid ? fmtAmt(topBid.amount) : fmtAmt(auction.min_bid)}
            </div>
            {bids.length > 0 && (
              <div style={{ fontSize: 10, color: '#4B5563' }}>{bids.length} bid{bids.length !== 1 ? 's' : ''}</div>
            )}
          </div>
        </div>

        {/* Schedule row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 10px', borderRadius: 10,
          background: isActive ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isActive ? 'rgba(239,68,68,0.15)' : '#1A1A1A'}`,
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 13 }}>{isActive ? '🔴' : isPast ? '✅' : '🕐'}</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#F87171' : '#9CA3AF' }}>
              {isActive ? 'EN VIVO ahora' : isPast ? 'Finalizada' : `Empieza ${fmtDateTime(auction.start_time)}`}
            </div>
            {isActive && (
              <div style={{ fontSize: 10, color: '#4B5563' }}>Termina en <Countdown targetMs={endMs} /></div>
            )}
            {!isActive && !isPast && (
              <div style={{ fontSize: 10, color: '#4B5563' }}>En <Countdown targetMs={startMs} /></div>
            )}
          </div>
        </div>

        {/* Actions */}
        {isActive && (
          <button
            onClick={() => onOpen(auction)}
            style={{
              width: '100%', padding: '11px', borderRadius: 10, border: 'none',
              background: '#FFF', color: '#111',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>
            🔨 Ver subasta en vivo
          </button>
        )}

        {!isActive && !isPast && (
          <button
            onClick={() => onWatchToggle(auction, !isWatching)}
            style={{
              width: '100%', padding: '10px', borderRadius: 10,
              border: `1px solid ${isWatching ? 'rgba(167,139,250,0.4)' : '#222'}`,
              background: isWatching ? 'rgba(167,139,250,0.08)' : 'transparent',
              color: isWatching ? '#A78BFA' : '#4B5563',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>
            {isWatching ? '🔔 Notificación activa' : '🔕 Notificarme cuando empiece'}
          </button>
        )}

        {isPast && topBid && status === 'ended' && (
          <div style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)',
            fontSize: 12, color: '#4ADE80', fontWeight: 700, textAlign: 'center',
          }}>
            🏆 Vendida por {fmtAmt(topBid.amount)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Screen ───────────────────────────────
export default function AuctionScreen({ isStaff, onClose }) {
  const { profile } = useAuth()
  const [auctions,    setAuctions]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [liveAuction, setLiveAuction] = useState(null)
  const [showCreate,  setShowCreate]  = useState(false)
  const [tab,         setTab]         = useState('upcoming')
  const [error,       setError]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getAuctions()
      setAuctions(data || [])
    } catch (e) {
      setError(e.message || 'Error cargando subastas')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

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

  const upcoming = auctions
    .filter(a => { const s = auctionStatus(a); return s === 'active' || s === 'pending' })
    .sort((a, b) => {
      // active first, then by start_time asc
      const sa = auctionStatus(a), sb = auctionStatus(b)
      if (sa === 'active' && sb !== 'active') return -1
      if (sb === 'active' && sa !== 'active') return 1
      return new Date(a.start_time) - new Date(b.start_time)
    })

  const history = auctions
    .filter(a => { const s = auctionStatus(a); return s === 'ended' || s === 'cancelled' })
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))

  const list = tab === 'upcoming' ? upcoming : history
  const hasLive = upcoming.some(a => auctionStatus(a) === 'active')

  const sk = (w, h, r = 8) => ({
    width: w, height: h, borderRadius: r, display: 'block',
    background: 'linear-gradient(90deg,#141414 25%,#1E1E1E 50%,#141414 75%)',
    backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite linear',
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
            <div style={{ fontSize: 10, color: '#F87171', fontWeight: 800, letterSpacing: '0.06em' }}>
              ● EN VIVO AHORA
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        {isStaff && (
          <button onClick={() => setShowCreate(true)} style={{
            padding: '7px 14px', borderRadius: 10, border: 'none',
            background: 'rgba(255,255,255,0.06)', color: '#9CA3AF',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>+ Nueva</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px 0', flexShrink: 0 }}>
        {[
          { id: 'upcoming', label: `Próximas${upcoming.length ? ` (${upcoming.length})` : ''}` },
          { id: 'history',  label: `Historial${history.length  ? ` (${history.length})`  : ''}` },
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

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '12px 16px 32px' }}>
        {error ? (
          <div style={{ margin: '16px 0', padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13 }}>{error}</div>
        ) : loading ? (
          [...Array(2)].map((_, i) => (
            <div key={i} style={{ borderRadius: 16, background: '#111', border: '1px solid #1A1A1A', marginBottom: 12, overflow: 'hidden' }}>
              <span style={{ ...sk('100%', 200, 0), display: 'block' }} />
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={sk('65%', 16)} />
                <span style={sk('40%', 12)} />
                <span style={sk('100%', 38)} />
              </div>
            </div>
          ))
        ) : list.length === 0 ? (
          <div style={{ padding: '64px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔨</div>
            <div style={{ fontSize: 14, color: '#4B5563' }}>
              {tab === 'upcoming' ? 'No hay subastas próximas' : 'Sin historial'}
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
          list.map(a => (
            <AuctionCard
              key={a.id}
              auction={a}
              onOpen={setLiveAuction}
              onWatchToggle={handleWatchToggle}
            />
          ))
        )}
      </div>

      {/* Live auction overlay */}
      {liveAuction && (
        <LiveAuctionScreen
          auction={liveAuction}
          onClose={() => setLiveAuction(null)}
          onAuctionEnded={load}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateAuctionModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}
    </div>
  )
}
