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
  const minNext    = topBid ? topBid.amount + 1 : auction.min_bid

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
      setChat(prev => [...prev, payload.new])
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
      // Optimistic — realtime will also fire but dedup by id is fine
      setChat(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
    } catch { /* silent */ }
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

        {/* Card image + lock */}
        <div style={{ position: 'relative', padding: '16px 16px 0' }}>
          <div
            onClick={() => setViewImg(true)}
            style={{
              borderRadius: 14, overflow: 'hidden', position: 'relative',
              background: '#111', cursor: 'pointer',
              // natural aspect ratio once loaded, fallback 3:4 portrait
              aspectRatio: imgRatio ? String(imgRatio) : '3/4',
              maxHeight: imgRatio && imgRatio > 1 ? 220 : 320,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <img
              src={auction.image_url}
              alt={auction.title}
              onLoad={e => setImgRatio(e.target.naturalWidth / e.target.naturalHeight)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {/* Lock overlay */}
            {!isUnlocked && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(10,10,10,0.72)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                backdropFilter: 'blur(3px)',
              }}>
                <div style={{ fontSize: 38 }}>🔒</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.4 }}>
                  Bid mínimo para<br />desbloquear: {fmtAmt(auction.min_bid)}
                </div>
                <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>Toca para ver la carta</div>
              </div>
            )}
            {/* Unlocked badge */}
            {isUnlocked && (
              <div style={{
                position: 'absolute', top: 10, right: 10,
                background: 'rgba(74,222,128,0.15)',
                border: '1px solid rgba(74,222,128,0.35)',
                borderRadius: 8, padding: '4px 10px',
                fontSize: 11, fontWeight: 800, color: '#4ADE80',
              }}>🔓 DESBLOQUEADO</div>
            )}
          </div>
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
              onClick={() => setViewImg(false)}
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

        {/* Current top bid */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{
            background: '#111', borderRadius: 12,
            border: '1px solid #1F1F1F', padding: '14px 16px',
          }}>
            {topBid ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#4B5563', fontWeight: 700, marginBottom: 3 }}>BID ACTUAL</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#FFF', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtAmt(topBid.amount)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 4 }}>Lider</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1F1F1F', overflow: 'hidden', flexShrink: 0 }}>
                      <Avatar url={topBid.profiles?.avatar_url} size={26} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#D1D5DB' }}>
                      @{topBid.profiles?.username ?? '…'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={{ fontSize: 13, color: '#4B5563' }}>Sin bids todavía</div>
                <div style={{ fontSize: 11, color: '#374151', marginTop: 3 }}>Bid mínimo: {fmtAmt(auction.min_bid)}</div>
              </div>
            )}
          </div>

          {/* Ended result */}
          {ended && (
            <div style={{
              marginTop: 10, padding: '12px 16px', borderRadius: 12,
              background: topBid && topBid.amount >= auction.min_bid
                ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${topBid && topBid.amount >= auction.min_bid
                ? 'rgba(74,222,128,0.25)' : 'rgba(239,68,68,0.25)'}`,
              textAlign: 'center',
            }}>
              {topBid && topBid.amount >= auction.min_bid ? (
                <>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>🏆</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#4ADE80' }}>
                    @{topBid.profiles?.username} ganó por {fmtAmt(topBid.amount)}
                  </div>
                  <div style={{ fontSize: 11, color: '#4B5563', marginTop: 3 }}>El admin te contactará para coordinar el pago</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>🔒</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#F87171' }}>Item no vendido</div>
                  <div style={{ fontSize: 11, color: '#4B5563', marginTop: 3 }}>No se alcanzó el precio mínimo</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Bid history */}
        {sortedBids.length > 0 && (
          <div style={{ padding: '14px 16px 0' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 8 }}>
              HISTORIAL DE BIDS ({sortedBids.length})
            </div>
            <div style={{
              background: '#111', borderRadius: 12,
              border: '1px solid #1A1A1A', overflow: 'hidden',
            }}>
              {sortedBids.slice(0, 20).map((bid, i) => (
                <div key={bid.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  borderBottom: i < Math.min(sortedBids.length, 20) - 1 ? '1px solid #161616' : 'none',
                  background: i === 0 ? 'rgba(74,222,128,0.04)' : 'transparent',
                }}>
                  {i === 0 && <span style={{ fontSize: 14 }}>👑</span>}
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1F1F1F', overflow: 'hidden', flexShrink: 0 }}>
                    <Avatar url={bid.profiles?.avatar_url} size={26} />
                  </div>
                  <span style={{ flex: 1, fontSize: 12, color: '#D1D5DB', fontWeight: 600 }}>
                    @{bid.profiles?.username ?? '…'}
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color: i === 0 ? '#4ADE80' : '#6B7280',
                    fontVariantNumeric: 'tabular-nums',
                  }}>{fmtAmt(bid.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live chat */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 10 }}>
            💬 CHAT EN VIVO
          </div>
          <div style={{ minHeight: 60 }}>
            {chat.length === 0 ? (
              <div style={{ fontSize: 12, color: '#374151', padding: '4px 0' }}>Sin mensajes aún…</div>
            ) : (
              chat.map((m) => {
                const isMe = m.user_id === profile?.id
                return (
                  <div key={m.id} style={{
                    display: 'flex',
                    flexDirection: isMe ? 'row-reverse' : 'row',
                    gap: 8, marginBottom: 10, alignItems: 'flex-end',
                  }}>
                    {!isMe && (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1F1F1F', overflow: 'hidden', flexShrink: 0 }}>
                        <Avatar url={m.profiles?.avatar_url} size={24} />
                      </div>
                    )}
                    <div style={{ maxWidth: '72%' }}>
                      {!isMe && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', marginBottom: 3 }}>
                          @{m.profiles?.username ?? '…'}
                        </div>
                      )}
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isMe ? '#FFFFFF' : '#1A1A1F',
                        color: isMe ? '#111' : '#E5E5E5',
                        fontSize: 13, lineHeight: 1.4,
                      }}>
                        {m.message}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Bottom padding so content isn't hidden behind fixed controls */}
        <div style={{ height: 170 }} />
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

            {/* Bid row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {/* Quick +$1 over current */}
              <button
                onClick={() => handleBid(minNext)}
                disabled={bidding}
                style={{
                  flexShrink: 0, padding: '10px 14px', borderRadius: 10, border: 'none',
                  background: 'rgba(74,222,128,0.12)', color: '#4ADE80',
                  fontSize: 12, fontWeight: 800, cursor: bidding ? 'default' : 'pointer',
                  opacity: bidding ? 0.5 : 1, fontFamily: 'Inter, sans-serif',
                  whiteSpace: 'nowrap',
                }}>
                +$1 → {fmtAmt(minNext)}
              </button>

              {/* Custom amount */}
              <div style={{ flex: 1, position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: '#4B5563', fontSize: 13, fontWeight: 700,
                }}>$</span>
                <input
                  type="number" min={minNext} step="1"
                  value={customAmt}
                  onChange={e => { setCustomAmt(e.target.value); setBidErr('') }}
                  placeholder={String(Math.ceil(minNext))}
                  onKeyDown={e => e.key === 'Enter' && handleBid(customAmt)}
                  style={{
                    width: '100%', padding: '10px 10px 10px 24px',
                    background: '#111', border: '1px solid #2A2A2A',
                    borderRadius: 10, color: '#FFF', fontSize: 14,
                    outline: 'none', fontFamily: 'Inter, sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Bid button */}
              <button
                onClick={() => handleBid(customAmt || minNext)}
                disabled={bidding}
                style={{
                  flexShrink: 0, padding: '10px 18px', borderRadius: 10, border: 'none',
                  background: bidding ? '#1A1A1A' : '#FFFFFF',
                  color: bidding ? '#555' : '#111',
                  fontSize: 13, fontWeight: 800, cursor: bidding ? 'default' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}>
                {bidding ? '…' : '🔨 BID'}
              </button>
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
