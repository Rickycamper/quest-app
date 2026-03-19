// ─────────────────────────────────────────────
// QUEST — H2HModal
// Bottom-sheet showing full head-to-head breakdown vs another user.
// Premium/admin can manually reset; free users see monthly auto-reset.
// ─────────────────────────────────────────────
import { useState } from 'react'
import { GAMES, GAME_STYLES } from '../lib/constants'
import GameIcon from './GameIcon'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'ahora'
  if (m < 60)  return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30)  return `${d}d`
  const mo = Math.floor(d / 30)
  return `${mo}mo`
}

function monthName() {
  return new Date().toLocaleString('es', { month: 'long', year: 'numeric' })
}

export default function H2HModal({ opponentName, h2h, isPremium = false, onClose, onReset }) {
  const { wins, losses, total, matches = [], myId } = h2h
  const [resetting,   setResetting]   = useState(false)
  const [resetDone,   setResetDone]   = useState(false)
  const [resetError,  setResetError]  = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  // Per-game breakdown
  const byGame = {}
  for (const g of GAMES) byGame[g] = { wins: 0, losses: 0 }
  for (const m of matches) {
    if (!byGame[m.game]) byGame[m.game] = { wins: 0, losses: 0 }
    if (m.winner_id === myId) byGame[m.game].wins++
    else                      byGame[m.game].losses++
  }
  const gamesPlayed = GAMES.filter(g => (byGame[g]?.wins + byGame[g]?.losses) > 0)
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0

  const handleReset = async () => {
    setResetting(true)
    setResetError('')
    try {
      await onReset?.()
      setResetDone(true)
      setConfirmReset(false)
    } catch (e) {
      setResetError(e.message || 'Error al resetear')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'flex-end',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', background: '#111111',
        borderRadius: '20px 20px 0 0',
        border: '1px solid #222',
        padding: '20px 20px 40px',
        display: 'flex', flexDirection: 'column', gap: 20,
        maxHeight: '82vh', overflowY: 'auto', scrollbarWidth: 'none',
        animation: 'slideUp 0.22s ease',
      }}>

        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333', margin: '0 auto -8px', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF', fontFamily: 'Inter, sans-serif' }}>
            ⚔️ vs @{opponentName}
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 3, fontFamily: 'Inter, sans-serif' }}>
            {total} partida{total !== 1 ? 's' : ''} confirmada{total !== 1 ? 's' : ''}
            {!isPremium && <span style={{ color: '#374151' }}> · {monthName()}</span>}
          </div>
        </div>

        {/* Free user monthly reset notice */}
        {!isPremium && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)',
            borderRadius: 10, padding: '9px 12px',
          }}>
            <span style={{ fontSize: 14 }}>🔒</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA', fontFamily: 'Inter, sans-serif' }}>
                Historial mensual
              </div>
              <div style={{ fontSize: 10, color: '#6B7280', fontFamily: 'Inter, sans-serif', marginTop: 1 }}>
                El contador se reinicia el 1° de cada mes. Premium conserva el historial completo y puede resetear cuando quiera.
              </div>
            </div>
          </div>
        )}

        {/* Overall score */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: '#0D0D0D', borderRadius: 14, padding: '16px 0',
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#4ADE80', fontFamily: 'Inter, sans-serif', lineHeight: 1 }}>{wins}</div>
            <div style={{ fontSize: 10, color: '#4ADE80', fontWeight: 700, marginTop: 4, fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em' }}>VICTORIAS</div>
          </div>
          <div style={{ width: 1, height: 44, background: '#222' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#9CA3AF', fontFamily: 'Inter, sans-serif', lineHeight: 1 }}>{winPct}%</div>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 700, marginTop: 4, fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em' }}>WIN RATE</div>
          </div>
          <div style={{ width: 1, height: 44, background: '#222' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#F87171', fontFamily: 'Inter, sans-serif', lineHeight: 1 }}>{losses}</div>
            <div style={{ fontSize: 10, color: '#F87171', fontWeight: 700, marginTop: 4, fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em' }}>DERROTAS</div>
          </div>
        </div>

        {/* Per-game breakdown */}
        {gamesPlayed.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 10, fontFamily: 'Inter, sans-serif' }}>POR JUEGO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gamesPlayed.map(g => {
                const gs  = GAME_STYLES[g] ?? {}
                const gw  = byGame[g].wins
                const gl  = byGame[g].losses
                const gt  = gw + gl
                const gp  = gt > 0 ? Math.round((gw / gt) * 100) : 0
                return (
                  <div key={g} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: gs.bg, border: `1px solid ${gs.border}`,
                    borderRadius: 10, padding: '9px 12px',
                  }}>
                    <GameIcon game={g} size={18} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: gs.color, fontFamily: 'Inter, sans-serif' }}>{g}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#4ADE80', fontFamily: 'Inter, sans-serif' }}>{gw}V</span>
                    <span style={{ fontSize: 11, color: '#333' }}>·</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#F87171', fontFamily: 'Inter, sans-serif' }}>{gl}D</span>
                    <span style={{ fontSize: 11, color: '#555', fontFamily: 'Inter, sans-serif', minWidth: 34, textAlign: 'right' }}>{gp}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Match history */}
        {matches.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 10, fontFamily: 'Inter, sans-serif' }}>HISTORIAL</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {matches.map(m => {
                const iWon = m.winner_id === myId
                const isF  = m.match_type === 'final'
                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#0D0D0D',
                    border: `1px solid ${iWon ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.12)'}`,
                    borderRadius: 10, padding: '9px 12px',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: iWon ? '#4ADE80' : '#F87171',
                      boxShadow: `0 0 5px ${iWon ? '#4ADE80' : '#F87171'}`,
                    }} />
                    <GameIcon game={m.game} size={14} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: iWon ? '#4ADE80' : '#F87171', fontFamily: 'Inter, sans-serif' }}>
                        {iWon ? 'Victoria' : 'Derrota'}
                        <span style={{ fontSize: 10, fontWeight: 500, color: '#555', marginLeft: 6 }}>
                          {isF ? '🏆 Final' : '⚔️ Casual'}
                        </span>
                      </div>
                      {m.notes && (
                        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2, fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.notes}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: '#444', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>
                      {timeAgo(m.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {total === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🃏</div>
            <div style={{ fontSize: 13, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>Sin partidas confirmadas aún</div>
          </div>
        )}

        {/* Premium manual reset */}
        {isPremium && (
          <div>
            {resetDone ? (
              <div style={{ textAlign: 'center', fontSize: 12, color: '#4ADE80', fontFamily: 'Inter, sans-serif', padding: '8px 0' }}>
                ✅ Historial reseteado correctamente
              </div>
            ) : confirmReset ? (
              <div style={{
                background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
                borderRadius: 12, padding: '14px', display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F87171', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
                  ¿Resetear historial vs @{opponentName}?
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
                  El contador vuelve a 0. Las partidas pasadas no se borran del sistema.
                </div>
                {resetError && <div style={{ fontSize: 11, color: '#F87171', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>{resetError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmReset(false)} style={{
                    flex: 1, padding: '9px 0', borderRadius: 8, background: 'transparent',
                    border: '1px solid #2A2A2A', color: '#6B7280', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}>Cancelar</button>
                  <button onClick={handleReset} disabled={resetting} style={{
                    flex: 1, padding: '9px 0', borderRadius: 8,
                    background: resetting ? '#1A1A1A' : 'rgba(248,113,113,0.15)',
                    border: '1px solid rgba(248,113,113,0.4)',
                    color: '#F87171', fontSize: 12, fontWeight: 700,
                    cursor: resetting ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
                    opacity: resetting ? 0.5 : 1,
                  }}>{resetting ? 'Reseteando…' : '🔄 Confirmar reset'}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmReset(true)} style={{
                width: '100%', padding: '10px 0', borderRadius: 10,
                background: 'transparent', border: '1px solid #2A2A2A',
                color: '#4B5563', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                🔄 Resetear H2H contra @{opponentName}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
