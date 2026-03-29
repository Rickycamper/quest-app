// ─────────────────────────────────────────────
// QUEST — LiveAuctionScreen (full screen overlay)
// ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getAuctionBids, getAuctionChat, placeBid,
  endAuction, sendAuctionChat,
  subscribeToAuctionBids, subscribeToAuctionChat,
  notifyAuctionWatchers,
} from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { GAME_STYLES } from '../lib/constants'
import GameIcon from '../components/GameIcon'
import Avatar from '../components/Avatar'

// ── Helpers ──────────────────────────────────
function fmtAmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function useCountdown(endTime) {
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, endTime - Date.now())
      setRemaining(diff)
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [endTime])
  return remaining
}

function formatTimer(ms) {
  if (ms <= 0) return '00:00'
  const totalSecs = Math.ceil(ms / 1000)
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Main Component ────────────────────────────
export default function LiveAuctionScreen({ auction, onClose, onAuctionEnded }) {
  const { profile } = useAuth()
  const [bids,        setBids]        = useState([])
  const [chat,        setChat]        = useState([])
  const [chatMsg,     setChatMsg]     = useState('')
  const [sendingChat, setSendingChat] = useState(false)
  const [customAmt,   setCustomAmt]   = useState('')
  const [bidding,     setBidding]     = useState(false)
  const [bidErr,      setBidErr]      = useState('')
  const [bidSuccess,  setBidSuccess]  = useState(false)
  const [ended,       setEnded]       = useState(false)
  const [imgRatio,    setImgRatio]    = useState(null)  // natural w/h ratio
  const [viewImg,     setViewImg]     = useState(false) // full-screen image viewer
  const [lockTip,     setLockTip]     = useState(() => !localStorage.getItem('quest_lock_seen'))
  const [showBids,    setShowBids]    = useState(false)
  const lastBidTime   = useRef(0)
  const chatEndRef    = useRef(null)
  const endedRef      = useRef(false)

  const endTimeMs = new Date(auction.start_time).getTime() + auction.duration_seconds * 1000
  const remaining = useCountdown(endTimeMs)
  const isActive  = remaining > 0
  const gs        = auction.game ? (GAME_STYLES[auction.game] ?? GAME_STYLES['MTG']) : null

  // Derived bid stats
  const sortedBids = [...bids].sort((a, b) => b.amount - a.amount)
  const topBid     = sortedBids[0]
  const isUnlocked = topBid && topBid.amount >= auction.min_bid
  const minNext    = topBid ? Number(topBid.amount) + 1 : Number(auction.min_bid)

  // ── Load initial data ─────────────────────
  useEffect(() => {
    getAuctionBids(auction.id).then(setBids).catch(() => {})
    getAuctionChat(auction.id).then(setChat).catch(() => {})
  }, [auction.id])

  // ── Notify watchers when first goes live ──
  useEffect(() => {
    if (!isActive) return
    notifyAuctionWatchers(auction.id).catch(() => {})
  }, [auction.id, isActive])

  // ── Realtime subscriptions ────────────────
  useEffect(() => {
    const bidCh = subscribeToAuctionBids(auction.id, async () => {
      const fresh = await getAuctionBids(auction.id).catch(() => [])
      setBids(fresh)
    })
    const chatCh = subscribeToAuctionChat(auction.id, (payload) => {
      setChat(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
    })
    return () => {
      bidCh.unsubscribe()
      chatCh.unsubscribe()
    }
  }, [auction.id])

  // ── End auction when timer hits 0 ─────────
  useEffect(() => {
    if (remaining === 0 && !endedRef.current) {
      endedRef.current = true
      endAuction(auction.id)
        .then(() => getAuctionBids(auction.id))
        .then(fresh => { setBids(fresh); setEnded(true); onAuctionEnded?.() })
        .catch(() => { setEnded(true); onAuctionEnded?.() })
    }
  }, [remaining, auction.id, onAuctionEnded])

  // ── Auto-scroll chat ──────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  // ── Place bid ─────────────────────────────
  const handleBid = useCallback(async (amount) => {
    const now = Date.now()
    if (now - lastBidTime.current < 300) {
      setBidErr('Espera un momento antes de volver a pujar')
      return
    }
    if (!amount || isNaN(amount) || +amount < minNext) {
      setBidErr(`Bid mínimo: ${fmtAmt(minNext)}`)
      return
    }
    if (!isActive) { setBidErr('La subasta ha terminado'); return }

    setBidding(true); setBidErr(''); setBidSuccess(false)
    lastBidTime.current = now
    try {
      await placeBid(auction.id, parseFloat(amount))
      const fresh = await getAuctionBids(auction.id)
      setBids(fresh)
      setBidSuccess(true)
      setCustomAmt('')
      setTimeout(() => setBidSuccess(false), 2000)
    } catch (e) {
      setBidErr(e.message || 'Error al pujar')
    }
    setBidding(false)
  }, [auction.id, isActive, minNext])

  // ── Send chat ─────────────────────────────
  const handleSendChat = async () => {
    const msg = chatMsg.trim()
    if (!msg || sendingChat) return
    setSendingChat(true)
    try {
      const newMsg = await sendAuctionChat(auction.id, msg)
      setChatMsg('')
      // Enrich with local profile so it renders immediately
      const enriched = { ...newMsg, profiles: { username: profile?.username, avatar_url: profile?.avatar_url } }
      setChat(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, enriched])
    } catch (e) {
      console.error('chat error', e)
    }
    setSendingChat(false)
  }

  const timerColor = remaining < 30000 ? '#F87171' : remaining < 60000 ? '#FB923C' : '#4ADE80'

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 300,
      background: '#0A0A0A', display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      animation: 'slideUp 0.25s ease',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px 12px', flexShrink: 0,
        background: '#0D0D0D', borderBottom: '1px solid #1A1A1A',
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6B7280', fontSize: 20, lineHeight: 1, padding: '0 2px',
        }}>←</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 800, color: '#FFF',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{auction.title}</div>
          {gs && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <GameIcon game={auction.game} size={11} />
              <span style={{ fontSize: 11, color: gs.color, fontWeight: 600 }}>{auction.game}</span>
            </div>
          )}
        </div>

        {/* Timer */}
        <div style={{
          padding: '6px 12px', borderRadius: 10,
          background: isActive ? 'rgba(0,0,0,0.4)' : 'rgba(239,68,68,0.1)',
          border: `1.5px solid ${isActive ? timerColor + '55' : 'rgba(239,68,68,0.3)'}`,
          textAlign: 'center', flexShrink: 0,
        }}>
          {isActive ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 800, color: timerColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {formatTimer(remaining)}
              </div>
              <div style={{ fontSize: 9, color: '#4B5563', fontWeight: 700, marginTop: 2 }}>EN VIVO</div>
            </>
          ) : (
            <div style={{ fontSize: 12, fontWeight: 800, color: '#F87171' }}>FIN</div>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>

        {/* ── Hero image (full-bleed, protagonist) ── */}
        <div
          onClick={() => setViewImg(true)}
          style={{ position: 'relative', cursor: 'pointer', overflow: 'hidden', background: '#0A0A0A' }}
        >
          <img
            src={auction.image_url}
            alt={auction.title}
            onLoad={e => setImgRatio(e.target.naturalWidth / e.target.naturalHeight)}
            style={{
              display: 'block', width: '100%',
              maxHeight: imgRatio && imgRatio < 1 ? 420 : 280,
              objectFit: 'cover', objectPosition: 'center',
            }}
          />

          {/* Lock overlay (active, no qualifying bid yet) */}
          {!isUnlocked && !ended && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(4px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <div style={{ fontSize: 44 }}>🔒</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF' }}>
                Mín {fmtAmt(auction.min_bid)} para desbloquear
              </div>
              <div style={{ fontSize: 11, color: '#4B5563' }}>Toca para ver la carta</div>

              {/* First-time tip */}
              {lockTip && (
                <div
                  onClick={e => { e.stopPropagation(); localStorage.setItem('quest_lock_seen','1'); setLockTip(false) }}
                  style={{
                    position: 'absolute', bottom: 14, left: 14, right: 14,
                    background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)',
                    borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA', marginBottom: 3 }}>¿Qué es el candado?</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
                    La carta se desbloquea cuando alguien puje el mínimo. Hasta entonces está oculta, pero puedes verla tocando la imagen.
                  </div>
                  <div style={{ fontSize: 10, color: '#6B7280', marginTop: 6 }}>Toca para cerrar</div>
                </div>
              )}
            </div>
          )}

          {/* Ended overlay — winner */}
          {ended && topBid && topBid.amount >= auction.min_bid && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center',
            }}>
              <div style={{ fontSize: 40 }}>🏆</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#4ADE80' }}>{fmtAmt(topBid.amount)}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF' }}>@{topBid.profiles?.username ?? '…'} ganó</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Admin te contactará para coordinar</div>
            </div>
          )}

          {/* Ended overlay — no sale */}
          {ended && !(topBid && topBid.amount >= auction.min_bid) && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(2px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center',
            }}>
              <div style={{ fontSize: 40 }}>🔒</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F87171' }}>Item no vendido</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>No se alcanzó el precio mínimo</div>
            </div>
          )}

          {/* Unlocked badge */}
          {isUnlocked && !ended && (
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)',
              borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 800, color: '#4ADE80',
            }}>🔓 DESBLOQUEADO</div>
          )}

          {/* Bid info bar at bottom of image — only when there's a qualifying bid */}
          {!ended && (isUnlocked || topBid) && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.88))',
              padding: '32px 14px 12px',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            }}>
              {topBid ? (
                <>
                  <div>
                    <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.08em' }}>BID ACTUAL</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#FFF', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                      {fmtAmt(topBid.amount)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1F1F1F', overflow: 'hidden', flexShrink: 0 }}>
                      <Avatar url={topBid.profiles?.avatar_url} size={24} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#FFF' }}>
                      @{topBid.profiles?.username ?? '…'}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                  Sin bids · mín {fmtAmt(auction.min_bid)}
                </div>
              )}
            </div>
          )}

          {/* ── Floating chat overlay (last 4 messages) ── */}
          {chat.length > 0 && (
            <div style={{
              position: 'absolute',
              bottom: (isUnlocked || topBid) && !ended ? 56 : 10,
              left: 10, right: 10,
              display: 'flex', flexDirection: 'column', gap: 4,
              pointerEvents: 'none',
            }}>
              {chat.slice(-4).map(m => {
                const isMe = m.user_id === profile?.id
                return (
                  <div key={m.id} style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    display: 'flex', flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    gap: 2, maxWidth: '80%',
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: isMe ? 'rgba(255,255,255,0.6)' : '#A78BFA', paddingLeft: 4, paddingRight: 4 }}>
                      @{m.profiles?.username ?? '…'}
                    </span>
                    <div style={{
                      background: isMe ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.6)',
                      backdropFilter: 'blur(6px)',
                      borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      padding: '5px 11px', fontSize: 12, color: '#FFF', lineHeight: 1.4,
                    }}>
                      {m.message}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Full-screen image viewer */}
        {viewImg && (
          <div
            onClick={() => setViewImg(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 500,
              background: 'rgba(0,0,0,0.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20,
            }}
          >
            <img
              src={auction.image_url}
              alt={auction.title}
              style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, objectFit: 'contain' }}
            />
            <button
              onClick={e => { e.stopPropagation(); setViewImg(false) }}
              style={{
                position: 'absolute', top: 20, right: 20,
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#FFF', fontSize: 16, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>
        )}

        {/* ── Collapsible bid history ── */}
        {sortedBids.length > 0 && (
          <div style={{ padding: '10px 16px 0' }}>
            {/* Top bid row — always visible, tap to expand */}
            <div
              onClick={() => setShowBids(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: '#111', borderRadius: showBids ? '12px 12px 0 0' : 12,
                border: '1px solid #1A1A1A', borderBottom: showBids ? 'none' : '1px solid #1A1A1A',
                padding: '10px 14px', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 14 }}>👑</span>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1F1F1F', overflow: 'hidden', flexShrink: 0 }}>
                <Avatar url={topBid.profiles?.avatar_url} size={26} />
              </div>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#FFF' }}>
                @{topBid.profiles?.username ?? '…'}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#4ADE80', fontVariantNumeric: 'tabular-nums' }}>
                {fmtAmt(topBid.amount)}
              </span>
              <span style={{ fontSize: 11, color: '#4B5563', marginLeft: 4 }}>
                {sortedBids.length} bid{sortedBids.length !== 1 ? 's' : ''} {showBids ? '▲' : '▼'}
              </span>
            </div>

            {/* Expanded list */}
            {showBids && (
              <div style={{
                background: '#111', borderRadius: '0 0 12px 12px',
                border: '1px solid #1A1A1A', borderTop: '1px solid #161616', overflow: 'hidden',
              }}>
                {sortedBids.slice(1, 20).map((bid, i) => (
                  <div key={bid.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px',
                    borderBottom: i < sortedBids.length - 2 ? '1px solid #161616' : 'none',
                  }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1F1F1F', overflow: 'hidden', flexShrink: 0 }}>
                      <Avatar url={bid.profiles?.avatar_url} size={24} />
                    </div>
                    <span style={{ flex: 1, fontSize: 12, color: '#9CA3AF' }}>
                      @{bid.profiles?.username ?? '…'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtAmt(bid.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom padding so content isn't hidden behind fixed controls */}
        <div style={{ height: 150 }} />
      </div>

      {/* ── Fixed bid + chat controls ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid #1A1A1A',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
        padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)',
      }}>
        {isActive ? (
          <>
            {/* Bid error */}
            {bidErr && (
              <div style={{ fontSize: 11, color: '#F87171', marginBottom: 6, textAlign: 'center' }}>{bidErr}</div>
            )}
            {bidSuccess && (
              <div style={{ fontSize: 11, color: '#4ADE80', marginBottom: 6, textAlign: 'center', fontWeight: 700 }}>✓ ¡Bid registrado!</div>
            )}

            {/* Primary one-tap bid button */}
            <button
              onClick={() => handleBid(customAmt || minNext)}
              disabled={bidding}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: bidding ? '#1A1A1A' : '#FFFFFF',
                color: bidding ? '#555' : '#111',
                fontSize: 15, fontWeight: 800, cursor: bidding ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif', marginBottom: 8,
              }}>
              {bidding ? '…' : `🔨 Pujar ${fmtAmt(customAmt && +customAmt >= minNext ? +customAmt : minNext)}`}
            </button>

            {/* Custom amount — secondary */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: '#4B5563', fontSize: 13, fontWeight: 700,
                }}>$</span>
                <input
                  type="number" min={minNext} step="1"
                  value={customAmt}
                  onChange={e => { setCustomAmt(e.target.value); setBidErr('') }}
                  placeholder={`Otro monto (mín ${fmtAmt(minNext)})`}
                  onKeyDown={e => e.key === 'Enter' && handleBid(customAmt)}
                  style={{
                    width: '100%', padding: '8px 10px 8px 24px',
                    background: '#111', border: '1px solid #1A1A1A',
                    borderRadius: 10, color: '#9CA3AF', fontSize: 13,
                    outline: 'none', fontFamily: 'Inter, sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Chat input */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                placeholder="Escribe algo..."
                style={{
                  flex: 1, padding: '8px 12px',
                  background: '#111', border: '1px solid #1A1A1A',
                  borderRadius: 10, color: '#FFF', fontSize: 13,
                  outline: 'none', fontFamily: 'Inter, sans-serif',
                }}
              />
              <button
                onClick={handleSendChat}
                disabled={!chatMsg.trim() || sendingChat}
                style={{
                  padding: '8px 14px', borderRadius: 10, border: 'none',
                  background: chatMsg.trim() ? 'rgba(167,139,250,0.15)' : '#111',
                  color: chatMsg.trim() ? '#A78BFA' : '#374151',
                  fontSize: 13, cursor: chatMsg.trim() ? 'pointer' : 'default',
                  fontFamily: 'Inter, sans-serif', fontWeight: 700,
                }}>↑</button>
            </div>
          </>
        ) : (
          /* Auction ended — show chat only */
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              placeholder="Comentar resultado..."
              style={{
                flex: 1, padding: '10px 12px',
                background: '#111', border: '1px solid #1A1A1A',
                borderRadius: 10, color: '#FFF', fontSize: 13,
                outline: 'none', fontFamily: 'Inter, sans-serif',
              }}
            />
            <button
              onClick={handleSendChat}
              disabled={!chatMsg.trim() || sendingChat}
              style={{
                padding: '10px 14px', borderRadius: 10, border: 'none',
                background: chatMsg.trim() ? 'rgba(167,139,250,0.15)' : '#111',
                color: chatMsg.trim() ? '#A78BFA' : '#374151',
                fontSize: 13, cursor: chatMsg.trim() ? 'pointer' : 'default',
                fontFamily: 'Inter, sans-serif', fontWeight: 700,
              }}>↑</button>
          </div>
        )}
      </div>
    </div>
  )
}
