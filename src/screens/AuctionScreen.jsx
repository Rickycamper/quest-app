// ─────────────────────────────────────────────
// QUEST — AuctionScreen
// ─────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { getAuctions, toggleAuctionWatch } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { GAME_STYLES, GAMES } from '../lib/constants'
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

// ── Compact Auction Card (2-col grid) ─────────
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
    <div
      onClick={() => !isPast && onOpen(auction)}
      style={{
        background: '#111', borderRadius: 14,
        border: `1px solid ${isActive ? 'rgba(239,68,68,0.4)' : '#1F1F1F'}`,
        overflow: 'hidden', cursor: isPast ? 'default' : 'pointer',
        boxShadow: isActive ? '0 0 14px rgba(239,68,68,0.12)' : 'none',
        animation: 'fadeUp 0.3s ease both',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', overflow: 'hidden', background: '#0A0A0A' }}>
        <img
          src={auction.image_url}
          alt={auction.title}
          style={{
            display: 'block', width: '100%',
            aspectRatio: '3/4', objectFit: 'cover', objectPosition: 'center',
          }}
        />

        {/* EN VIVO badge */}
        {isActive && (
          <div style={{
            position: 'absolute', top: 6, left: 6,
            background: 'rgba(239,68,68,0.9)', borderRadius: 6,
            padding: '3px 7px', fontSize: 9, color: '#FFF', fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FFF', display: 'inline-block', animation: 'pulse 1s infinite' }} />
            LIVE
          </div>
        )}

        {/* Price / lock badge */}
        {!isPast && (
          <div style={{
            position: 'absolute', bottom: 6, left: 6,
            background: isUnlocked ? 'rgba(74,222,128,0.2)' : 'rgba(0,0,0,0.72)',
            border: isUnlocked ? '1px solid rgba(74,222,128,0.4)' : 'none',
            borderRadius: 8, padding: '3px 8px',
            fontSize: 11, fontWeight: 800,
            color: isUnlocked ? '#4ADE80' : '#9CA3AF',
          }}>
            {isUnlocked ? fmtAmt(topBid.amount) : <><svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style={{marginRight:3,verticalAlign:'middle'}}><path d="M5.55 4.569999999999999v1.4699999999999998h4.8999999999999995v-1.4699999999999998c0 -1.3536249999999999 -1.0963749999999999 -2.4499999999999997 -2.4499999999999997 -2.4499999999999997s-2.4499999999999997 1.0963749999999999 -2.4499999999999997 2.4499999999999997Zm-1.96 1.4699999999999998v-1.4699999999999998C3.59 2.1353142857142857 5.565314285714286 0.16 8 0.16s4.41 1.9753142857142856 4.41 4.41v1.4699999999999998h0.49c1.0810642857142856 0 1.96 0.8789392857142856 1.96 1.96v5.879999999999999c0 1.0810607142857143 -0.8789357142857142 1.96 -1.96 1.96H3.0999999999999996c-1.0810607142857143 0 -1.96 -0.8789392857142856 -1.96 -1.96V8c0 -1.0810607142857143 0.8789392857142856 -1.96 1.96 -1.96h0.49Z" strokeWidth="0"/></svg>{fmtAmt(auction.min_bid)}</>}
          </div>
        )}

        {/* Watch bell — pending only */}
        {!isActive && !isPast && (
          <button
            onClick={e => { e.stopPropagation(); onWatchToggle(auction, !isWatching) }}
            style={{
              position: 'absolute', top: 6, right: 6,
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: isWatching ? 'rgba(167,139,250,0.3)' : 'rgba(0,0,0,0.6)',
              color: isWatching ? '#A78BFA' : '#9CA3AF',
              fontSize: 13, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.999325 0.16c-0.5420642857142857 0 -0.98 0.4379392857142857 -0.98 0.98v0.588c-2.2356249999999998 0.45325 -3.92 2.431625 -3.92 4.802v0.5757499999999999c0 1.439375 -0.5298142857142857 2.82975 -1.4853142857142856 3.90775l-0.226625 0.25418928571428573c-0.25725 0.28787499999999994 -0.31849999999999995 0.7013107142857143 -0.16231071428571428 1.0534999999999999S1.73345 12.899999999999999 2.119325 12.899999999999999h11.759999999999998c0.385875 0 0.7349999999999999 -0.226625 0.89425 -0.5788107142857143s0.09493571428571428 -0.765625 -0.16231428571428572 -1.0534999999999999l-0.226625 -0.25418928571428573c-0.9555 -1.078 -1.4853107142857143 -2.4653107142857142 -1.4853107142857143 -3.90775V6.529999999999999c0 -2.370375 -1.684375 -4.34875 -3.92 -4.802V1.14c0 -0.5420607142857142 -0.4379392857142857 -0.98 -0.98 -0.98Zm1.3873107142857144 15.107314285714285c0.36749999999999994 -0.36749999999999994 0.5726892857142857 -0.8666892857142856 0.5726892857142857 -1.3873142857142857h-3.92c0 0.520625 0.20518571428571425 1.0198142857142856 0.5726857142857142 1.3873142857142857s0.8666892857142856 0.5726857142857142 1.3873142857142857 0.5726857142857142 1.0198107142857142 -0.20518571428571425 1.3873107142857144 -0.5726857142857142Z" strokeWidth="0"/>
            </svg>
          </button>
        )}

        {/* Past overlay */}
        {isPast && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            {topBid && status === 'ended' ? (
              <>
                <div style={{ fontSize: 18 }}>🏆</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#4ADE80' }}>{fmtAmt(topBid.amount)}</div>
              </>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 800, color: '#6B7280' }}>No vendida</div>
            )}
          </div>
        )}
      </div>

      {/* Compact info strip */}
      <div style={{ padding: '8px 10px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{
          fontSize: 12, fontWeight: 800, color: '#FFF',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{auction.title}</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          {gs && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 9, fontWeight: 700, color: gs.color,
              background: gs.bg, border: `1px solid ${gs.border}`,
              borderRadius: 5, padding: '2px 6px',
            }}>
              <GameIcon game={auction.game} size={9} />{auction.game}
            </span>
          )}
          <span style={{ fontSize: 10, color: isActive ? '#F87171' : '#6B7280', fontWeight: 600, flexShrink: 0 }}>
            {isActive
              ? <Countdown targetMs={endMs} />
              : isPast ? (status === 'cancelled' ? 'Cancelada' : 'Finalizada')
              : <Countdown targetMs={startMs} />}
          </span>
        </div>
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
  const [gameFilter,  setGameFilter]  = useState(null) // null = all
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

  const filteredUpcoming = gameFilter
    ? upcoming.filter(a => a.game === gameFilter)
    : upcoming

  const list = tab === 'upcoming' ? filteredUpcoming : history
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
          <button key={t.id} onClick={() => { setTab(t.id); setGameFilter(null) }} style={{
            padding: '6px 14px', borderRadius: 8,
            border: `1px solid ${tab === t.id ? 'rgba(255,255,255,0.3)' : '#222'}`,
            background: tab === t.id ? 'rgba(255,255,255,0.07)' : 'transparent',
            color: tab === t.id ? '#FFF' : '#4B5563',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>{t.label}</button>
        ))}
      </div>

      {/* TCG filter chips — shown only on Próximas tab */}
      {tab === 'upcoming' && (
        <div style={{
          display: 'flex', gap: 6, padding: '8px 16px 0',
          overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0,
        }}>
          <button
            onClick={() => setGameFilter(null)}
            style={{
              flexShrink: 0, padding: '4px 12px', borderRadius: 20,
              border: `1px solid ${!gameFilter ? 'rgba(255,255,255,0.3)' : '#222'}`,
              background: !gameFilter ? 'rgba(255,255,255,0.07)' : 'transparent',
              color: !gameFilter ? '#FFF' : '#4B5563',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >Todos</button>
          {GAMES.map(g => {
            const gs = GAME_STYLES[g]
            const active = gameFilter === g
            return (
              <button key={g} onClick={() => setGameFilter(active ? null : g)} style={{
                flexShrink: 0, padding: '4px 12px', borderRadius: 20,
                border: `1px solid ${active ? gs.border : '#222'}`,
                background: active ? gs.bg : 'transparent',
                color: active ? gs.color : '#4B5563',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <GameIcon game={g} size={10} />{g}
              </button>
            )
          })}
        </div>
      )}

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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {list.map(a => (
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
