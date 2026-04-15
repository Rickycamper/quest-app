// ─────────────────────────────────────────────
// QUEST — LifeCounterScreen
// Life counter for MTG / Riftbound + W/L logger
// for Pokemon, One Piece, Digimon, Gundam
// ─────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { logMatch, searchUsers } from '../lib/supabase'
import { GAMES, GAME_STYLES } from '../lib/constants'
import Avatar from '../components/Avatar'
import GameIcon from '../components/GameIcon'
import qLogo from '../assets/q-logo.png'
import biohazardIcon from '../assets/Biohazard--Streamline-Font-Awesome.svg'
import crownIcon from '../assets/Crown--Streamline-Font-Awesome.svg'
import fireIcon from '../assets/small-fire-svgrepo-com.svg'
import kingIcon from '../assets/king-svgrepo-com.svg'

// ── Gold middle-finger icon (victory taunt) ───
function MiddleFingerIcon({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <g fill="#F59E0B">
        {/* Middle finger — tallest */}
        <rect x="13" y="3" width="6" height="17" rx="3"/>
        {/* Index finger */}
        <rect x="7"  y="12" width="5" height="12" rx="2.5"/>
        {/* Ring finger */}
        <rect x="20" y="12" width="5" height="12" rx="2.5"/>
        {/* Pinky */}
        <rect x="25.5" y="15" width="4" height="9" rx="2"/>
        {/* Thumb */}
        <rect x="2.5" y="18" width="4.5" height="8" rx="2"/>
        {/* Palm */}
        <rect x="7" y="22" width="18" height="7" rx="4"/>
      </g>
    </svg>
  )
}

// ── Constants ─────────────────────────────────
const COUNTER_GAMES = new Set(['MTG', 'Riftbound'])

const PLAYER_COLORS = [
  '#932885',  // P1 Dark Magenta
  '#D92200',  // P2 Sinopia
  '#FF099D',  // P3 Persian Rose
  '#234DC2',  // P4 Violet Blue
]

function getStartHP(game, commander) {
  if (game === 'MTG') return commander ? 40 : 20
  if (game === 'Riftbound') return 0   // counts UP from 0 to 8
  return 20
}

function getMaxHP(game, commander) {
  if (game === 'MTG') return commander ? 40 : 20
  if (game === 'Riftbound') return 8   // first to 8 wins
  return 20
}

// ── localStorage persistence (5 minutes) ──────
const SAVE_KEY = 'quest_lc_v1'
const SAVE_TTL = 5 * 60 * 1000

function saveCounterState(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, savedAt: Date.now() })) } catch {}
}
function loadCounterState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - data.savedAt > SAVE_TTL) { localStorage.removeItem(SAVE_KEY); return null }
    return data
  } catch { return null }
}
function clearCounterState() {
  try { localStorage.removeItem(SAVE_KEY) } catch {}
}

// ── Tap-or-hold hook ──────────────────────────
// Quick tap  → onTap()   (±1)
// Hold 600ms → onHold()  (±10, fires once)
// NOTE: onPointerLeave intentionally only cancels — never triggers tap,
// to avoid double-fire on mobile (pointerleave + pointerup both calling stop).
function useTapOrHold(onTap, onHold, holdMs = 600) {
  const holdTimer = useRef(null)
  const fired     = useRef(false)

  const start = useCallback((e) => {
    e.preventDefault()
    fired.current = false
    holdTimer.current = setTimeout(() => {
      fired.current = true
      onHold()
      navigator.vibrate?.(30)
    }, holdMs)
  }, [onHold, holdMs])

  // Only called by pointerUp — triggers tap if hold never fired
  const commit = useCallback(() => {
    clearTimeout(holdTimer.current)
    if (!fired.current) onTap()
    fired.current = false
  }, [onTap])

  // Called by cancel/leave — silently abort, never triggers tap
  const abort = useCallback(() => {
    clearTimeout(holdTimer.current)
    fired.current = true  // block any late pointerup
  }, [])

  return {
    onPointerDown:   start,
    onPointerUp:     commit,
    onPointerCancel: abort,
    onPointerLeave:  abort,
  }
}

// ── Setup step ────────────────────────────────
function SetupStep({ profile, onStart }) {
  const [game,        setGame]       = useState('MTG')
  const [commander,   setCommander]  = useState(false)
  const [matchType,   setMatchType]  = useState('casual')
  const [playerCount, setPlayerCount] = useState(2)
  const [opponents,   setOpponents]  = useState([null, null, null])
  const [activeSlot,  setActiveSlot] = useState(0)
  const [query,       setQuery]      = useState('')
  const [allUsers,    setAllUsers]   = useState([])
  const [loadingU,    setLoadingU]   = useState(false)
  const [error,       setError]      = useState('')
  const [showOpponents, setShowOpponents] = useState(false)

  useEffect(() => {
    setLoadingU(true)
    searchUsers('')
      .then(data => setAllUsers((data ?? []).filter(u => u.id !== profile?.id)))
      .catch(() => {})
      .finally(() => setLoadingU(false))
  }, [profile?.id])

  const q = query.trim().toLowerCase()
  const results = q ? allUsers.filter(u => u.username?.toLowerCase().includes(q)) : allUsers

  // Filter out already-selected opponents from results
  const filteredResults = results.filter(u => !opponents.some(o => o?.id === u.id))

  const neededSlots = game === 'MTG' && commander ? playerCount - 1 : 1
  // MTG and Riftbound: opponent is optional (can play solo / vs non-user)
  const allowGuest = COUNTER_GAMES.has(game)

  // Create a guest player object from the current query string
  const addGuest = (name, slotIndex) => {
    if (!name.trim()) return
    handleSelectOpponent({ id: null, username: name.trim(), avatar_url: null, isGuest: true }, slotIndex)
  }

  const handleStart = () => {
    const activeOpponents = opponents.slice(0, neededSlots)
    // Counter games: opponent optional — start even if none selected
    // Non-counter games: require a real opponent to log W/L
    if (!allowGuest && activeOpponents.some(o => !o)) {
      setError('Elige un oponente para continuar')
      return
    }
    onStart({
      game,
      commander,
      matchType,
      playerCount: game === 'MTG' && commander ? playerCount : 2,
      opponents: activeOpponents,
      opponent: activeOpponents[0] ?? null,
    })
  }

  const handleSelectOpponent = (u, slotIndex) => {
    setOpponents(prev => {
      const next = [...prev]
      next[slotIndex] = u
      return next
    })
    setQuery('')
    setError('')
    // Auto-advance to next unfilled slot
    const updatedOpponents = [...opponents]
    updatedOpponents[slotIndex] = u
    const nextSlot = updatedOpponents.slice(0, neededSlots).findIndex((o, i) => i !== slotIndex && !o)
    if (nextSlot !== -1) {
      setActiveSlot(nextSlot)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '20px 16px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Game picker */}
      <div>
        <SectionLabel>Juego</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {GAMES.map(g => {
            const gs = GAME_STYLES[g]
            const active = game === g
            return (
              <button key={g} onClick={() => { setGame(g); setCommander(false); setPlayerCount(2); setOpponents([null, null, null]); setActiveSlot(0) }} style={{
                padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                background: active ? gs.bg : '#111111',
                border: `1.5px solid ${active ? gs.border : '#1E1E1E'}`,
                color: active ? gs.color : '#555',
                fontSize: 11, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.15s',
                boxShadow: active ? `0 0 8px ${gs.border}44` : 'none',
              }}>
                <GameIcon game={g} size={14} />{g}
              </button>
            )
          })}
        </div>

        {/* MTG mode toggle */}
        {game === 'MTG' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {[{ v: false, label: 'Standard (20)' }, { v: true, label: 'Commander (40)' }].map(({ v, label }) => (
              <button key={String(v)} onClick={() => { setCommander(v); setPlayerCount(2); setOpponents([null, null, null]); setActiveSlot(0) }} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                background: commander === v ? 'rgba(167,139,250,0.12)' : 'transparent',
                border: `1.5px solid ${commander === v ? 'rgba(167,139,250,0.4)' : '#2A2A2A'}`,
                color: commander === v ? '#A78BFA' : '#555',
                fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        )}

        {/* Player count picker — Commander only */}
        {game === 'MTG' && commander && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {[2, 3, 4].map(n => (
              <button key={n} onClick={() => { setPlayerCount(n); setOpponents([null, null, null]); setActiveSlot(0) }} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                background: playerCount === n ? 'rgba(167,139,250,0.12)' : 'transparent',
                border: `1.5px solid ${playerCount === n ? 'rgba(167,139,250,0.4)' : '#2A2A2A'}`,
                color: playerCount === n ? '#A78BFA' : '#555',
                fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                transition: 'all 0.15s',
              }}>{n} jugadores</button>
            ))}
          </div>
        )}

        {/* Non-counter games hint */}
        {!COUNTER_GAMES.has(game) && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#4B5563', background: '#111', borderRadius: 8, padding: '8px 12px', border: '1px solid #1A1A1A' }}>
            💡 {game} usa sus propias vidas — solo registrarás W/L al terminar
          </div>
        )}
      </div>

      {/* Match type */}
      <div>
        <SectionLabel>Tipo de partida</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { v: 'casual', icon: fireIcon, label: 'Casual', desc: 'Solo H2H' },
            { v: 'final',  icon: kingIcon, label: 'Final',  desc: 'Se publica en el feed' },
          ].map(({ v, icon, label, desc }) => (
            <button key={v} onClick={() => setMatchType(v)} style={{
              flex: 1, padding: '9px 8px', borderRadius: 10, cursor: 'pointer',
              background: matchType === v ? 'rgba(167,139,250,0.12)' : 'transparent',
              border: `1.5px solid ${matchType === v ? 'rgba(167,139,250,0.5)' : '#2A2A2A'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              transition: 'all 0.15s',
            }}>
              <img src={icon} alt={label} style={{ width: 22, height: 22, opacity: matchType === v ? 1 : 0.3, filter: matchType === v ? 'invert(1)' : 'invert(0.4)' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: matchType === v ? '#A78BFA' : '#555', fontFamily: 'Inter, sans-serif' }}>{label}</span>
              <span style={{ fontSize: 10, color: matchType === v ? '#C4B5FD' : '#374151', fontFamily: 'Inter, sans-serif' }}>{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Opponent slots */}
      {allowGuest && !showOpponents ? (
        <button
          onClick={() => setShowOpponents(true)}
          style={{
            width: '100%', padding: '11px 0', borderRadius: 10,
            background: 'transparent', border: '1.5px dashed #2A2A2A',
            color: '#6B7280', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 16 }}>+</span> Agregar jugador
        </button>
      ) : (
      <div style={{ flex: 1 }}>
        <SectionLabel>{neededSlots === 1 ? 'Oponente' : 'Oponentes'}</SectionLabel>

        {/* Render one picker per needed slot */}
        {Array.from({ length: neededSlots }).map((_, i) => {
          const slotUser = opponents[i]
          const isActive = activeSlot === i
          const slotLabel = neededSlots === 1 ? '' : `Jugador ${i + 2}`
          return (
            <div key={i} style={{ marginBottom: i < neededSlots - 1 ? 10 : 0 }}>
              {neededSlots > 1 && (
                <div style={{ fontSize: 10, color: '#555', fontFamily: 'Inter, sans-serif', fontWeight: 700, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {slotLabel}
                </div>
              )}
              {slotUser ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#1A1A1A', border: `1.5px solid ${slotUser.isGuest ? 'rgba(251,146,60,0.3)' : 'rgba(74,222,128,0.3)'}`,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: '#2A2A2A', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    {slotUser.isGuest ? '👤' : <Avatar url={slotUser.avatar_url} size={32} />}
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#FFF', fontFamily: 'Inter, sans-serif' }}>
                    {slotUser.isGuest ? slotUser.username : `@${slotUser.username}`}
                    {slotUser.isGuest && <span style={{ fontSize: 10, color: '#FB923C', marginLeft: 6, fontWeight: 600 }}>invitado</span>}
                  </span>
                  <button onClick={() => { setOpponents(prev => { const next = [...prev]; next[i] = null; return next }); setActiveSlot(i) }} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 18, padding: '0 2px' }}>✕</button>
                </div>
              ) : (
                <div
                  onClick={() => setActiveSlot(i)}
                  style={{
                    background: '#1A1A1A', border: `1.5px solid ${isActive ? '#2A2A2A' : '#1E1E1E'}`,
                    borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                  }}
                >
                  {isActive ? (
                    <>
                      <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && allowGuest && query.trim()) addGuest(query, i) }}
                        placeholder={allowGuest ? 'Buscar jugador o escribir nombre…' : 'Buscar jugador…'}
                        autoFocus
                        style={{
                          width: '100%', background: 'transparent', border: 'none',
                          padding: '10px 12px', color: '#FFF', fontSize: 14,
                          outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
                        }}
                      />
                      {loadingU && <div style={{ fontSize: 12, color: '#4B5563', padding: '4px 12px 8px' }}>Cargando jugadores…</div>}
                      <div style={{ background: '#111', borderTop: '1px solid #222', maxHeight: 200, overflowY: 'auto' }}>
                        {/* Guest option — only for MTG/Riftbound and when there's a typed name */}
                        {allowGuest && query.trim() && (
                          <button onClick={e => { e.stopPropagation(); addGuest(query, i) }} style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', background: 'rgba(251,146,60,0.06)', border: 'none',
                            borderBottom: filteredResults.length > 0 ? '1px solid #1A1A1A' : 'none',
                            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                          }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(251,146,60,0.15)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#FB923C' }}>Jugar como invitado</div>
                              <div style={{ fontSize: 11, color: '#6B7280' }}>"{query.trim()}" — sin cuenta Quest</div>
                            </div>
                          </button>
                        )}
                        {filteredResults.slice(0, 20).map((u, ri) => (
                          <button key={u.id} onClick={e => { e.stopPropagation(); handleSelectOpponent(u, i) }} style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', background: 'none', border: 'none',
                            borderBottom: ri < filteredResults.length - 1 ? '1px solid #1A1A1A' : 'none',
                            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                          }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: '#2A2A2A', flexShrink: 0 }}>
                              <Avatar url={u.avatar_url} size={28} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#FFF' }}>@{u.username}</span>
                          </button>
                        ))}
                        {!loadingU && filteredResults.length === 0 && !query.trim() && (
                          <div style={{ padding: '8px 12px', fontSize: 12, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>
                            {allowGuest ? 'Escribe para buscar o agregar invitado' : 'Escribe para buscar jugadores'}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '10px 12px', fontSize: 14, color: '#555', fontFamily: 'Inter, sans-serif' }}>
                      {allowGuest ? 'Buscar jugador o invitado…' : 'Buscar jugador…'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#F87171', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>{error}</div>}

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!allowGuest && opponents.slice(0, neededSlots).some(o => !o)}
        style={{
          padding: '15px 0', borderRadius: 14,
          background: (allowGuest || opponents.slice(0, neededSlots).every(o => !!o)) ? '#FFF' : '#1A1A1A',
          border: 'none', color: (allowGuest || opponents.slice(0, neededSlots).every(o => !!o)) ? '#111' : '#555',
          fontSize: 15, fontWeight: 800, cursor: (allowGuest || opponents.slice(0, neededSlots).every(o => !!o)) ? 'pointer' : 'default',
          fontFamily: 'Inter, sans-serif', transition: 'all 0.15s', flexShrink: 0,
        }}
      >
        {COUNTER_GAMES.has(game) ? '⚔️ Iniciar contador' : '⚔️ Iniciar duelo'}
      </button>
    </div>
  )
}

// ── Player panel ──────────────────────────────
function PlayerPanel({ user, hp, maxHp, game, poison, onAdjust, onPoison, isMTG, isCommander, cmdDmg, onCmdDmg, flipped, dead, playerColor, compact = false }) {
  const isRiftbound = game === 'Riftbound'
  const holdDelta   = isRiftbound ? 1 : 10

  const tapMinus  = useCallback(() => onAdjust(-1),         [onAdjust])
  const holdMinus = useCallback(() => onAdjust(-holdDelta), [onAdjust, holdDelta])
  const tapPlus   = useCallback(() => onAdjust(+1),         [onAdjust])
  const holdPlus  = useCallback(() => onAdjust(+holdDelta), [onAdjust, holdDelta])

  const minusEvents = useTapOrHold(tapMinus, holdMinus, 600)
  const plusEvents  = useTapOrHold(tapPlus,  holdPlus,  600)

  // Expanded damage/poison panels — tap badge to open, tap again to close
  const [cmdOpen,    setCmdOpen]    = useState(false)
  const [poisonOpen, setPoisonOpen] = useState(false)

  const pct = Math.max(0, Math.min(1, hp / maxHp))

  // Panel bg: solid vivid color (or muted on death)
  const panelBg = dead
    ? `${playerColor}40`
    : playerColor

  // HP number: always white
  const hpColor = dead ? 'rgba(255,255,255,0.5)' : '#FFFFFF'

  // Dark creep from bottom as HP decreases (shadow grows upward)
  const shadowPct = (1 - pct) * 100

  // ── Reusable sub-elements (shared between flipped/non-flipped layouts) ──

  const infoRow = (isAtBottom) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      // When at bottom of CSS column (flipped panel), invert vertical padding so it
      // reads correctly after the 180° outer rotation.
      padding: compact
        ? (isAtBottom ? '2px 10px 8px' : '8px 10px 2px')
        : (isAtBottom ? '4px 16px 12px' : '12px 16px 4px'),
      flexShrink: 0, zIndex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 0 : 8 }}>
        <div style={{
          width: compact ? 26 : 28, height: compact ? 26 : 28,
          borderRadius: '50%', overflow: 'hidden',
          background: 'rgba(0,0,0,0.25)', flexShrink: 0,
          border: '2px solid rgba(255,255,255,0.3)',
        }}>
          <Avatar url={user?.avatar_url} size={compact ? 26 : 28} />
        </div>
        {!compact && (
          <span style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFF', fontFamily: 'Inter, sans-serif', letterSpacing: '0.01em' }}>
            @{user?.username ?? '…'}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: compact ? 4 : 6, alignItems: 'center' }}>
        {isCommander && (
          <button
            onClick={e => { e.stopPropagation(); setCmdOpen(v => !v); setPoisonOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
              background: cmdOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
              border: `1px solid rgba(255,255,255,${cmdOpen ? 0.4 : 0.2})`,
              borderRadius: 7, padding: compact ? '3px 6px' : '4px 10px',
              transition: 'background 0.2s',
            }}
          >
            <img src={crownIcon} alt="cmd" style={{ width: compact ? 11 : 13, height: compact ? 11 : 13, pointerEvents: 'none', flexShrink: 0, filter: 'invert(1)', opacity: cmdDmg >= 15 ? 1 : 0.6 }} />
            {!compact && <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'Inter, sans-serif', fontVariantNumeric: 'tabular-nums', pointerEvents: 'none', color: '#FFFFFF' }}>{cmdDmg}/21</span>}
            {compact  && <span style={{ fontSize: 10, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif', fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>{cmdDmg}</span>}
          </button>
        )}
        {isMTG && (
          <button
            onClick={e => { e.stopPropagation(); setPoisonOpen(v => !v); setCmdOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
              background: poisonOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
              border: `1px solid rgba(255,255,255,${poisonOpen ? 0.4 : 0.2})`,
              borderRadius: 7, padding: compact ? '3px 6px' : '4px 10px',
              transition: 'background 0.2s',
            }}
          >
            <img src={biohazardIcon} alt="poison" style={{ width: compact ? 10 : 12, height: compact ? 10 : 12, pointerEvents: 'none', flexShrink: 0, filter: 'invert(1)', opacity: poison >= 7 ? 1 : 0.6 }} />
            {!compact && <span style={{ fontSize: 11, fontWeight: 800, color: '#FFFFFF', fontFamily: 'Inter, sans-serif', fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>{poison}/10</span>}
            {compact  && <span style={{ fontSize: 10, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif', fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>{poison}</span>}
          </button>
        )}
      </div>
    </div>
  )

  const expandedPanels = (
    <>
      {/* ── Expanded commander damage ── */}
      {isCommander && cmdOpen && (
        <div style={{
          flexShrink: 0, zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px',
          background: 'rgba(0,0,0,0.2)',
          borderTop: '1px solid rgba(0,0,0,0.15)',
          borderBottom: '1px solid rgba(0,0,0,0.15)',
          gap: 12,
        }}>
          <button onClick={e => { e.stopPropagation(); onCmdDmg(-1) }} style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="4" viewBox="0 0 20 4"><rect x="0" y="0" width="20" height="4" rx="2" fill="rgba(255,255,255,0.9)"/></svg>
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <img src={crownIcon} alt="cmd" style={{ width: 16, height: 16, filter: 'invert(1)', opacity: 0.7 }} />
            <span style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', fontFamily: 'Inter, sans-serif', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{cmdDmg}</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em' }}>/ 21 CMD</span>
          </div>
          <button onClick={e => { e.stopPropagation(); onCmdDmg(+1) }} style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="8" y="0" width="4" height="20" rx="2" fill="rgba(255,255,255,0.9)"/><rect x="0" y="8" width="20" height="4" rx="2" fill="rgba(255,255,255,0.9)"/></svg>
          </button>
        </div>
      )}
      {/* ── Expanded poison ── */}
      {isMTG && poisonOpen && (
        <div style={{
          flexShrink: 0, zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px',
          background: 'rgba(0,0,0,0.2)',
          borderTop: '1px solid rgba(0,0,0,0.15)',
          borderBottom: '1px solid rgba(0,0,0,0.15)',
          gap: 12,
        }}>
          <button onClick={e => { e.stopPropagation(); onPoison(-1) }} style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="4" viewBox="0 0 20 4"><rect x="0" y="0" width="20" height="4" rx="2" fill="rgba(255,255,255,0.9)"/></svg>
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <img src={biohazardIcon} alt="poison" style={{ width: 16, height: 16, filter: 'invert(1)', opacity: 0.7 }} />
            <span style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', fontFamily: 'Inter, sans-serif', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{poison}</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em' }}>/ 10 VENENO</span>
          </div>
          <button onClick={e => { e.stopPropagation(); onPoison(+1) }} style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(0,0,0,0.18)', border: '1.5px solid rgba(0,0,0,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="8" y="0" width="4" height="20" rx="2" fill="rgba(255,255,255,0.9)"/><rect x="0" y="8" width="20" height="4" rx="2" fill="rgba(255,255,255,0.9)"/></svg>
          </button>
        </div>
      )}
    </>
  )

  // ── Panel body ─────────────────────────────────
  // For flipped panels (rotate 180°): info row must be at CSS-bottom so it
  // ends up at the VISUAL TOP (outer edge, away from centre divider) after rotation.
  // For non-flipped panels: info row is at CSS-top as usual.
  // Shadow also flips: non-flipped → grows from CSS bottom; flipped → grows from CSS top
  // (both cases: shadow grows from the VISUAL bottom = inner/centre edge).
  const inner = (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
      background: panelBg,
      transition: 'background 0.4s',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
    }}>
      {/* Shadow — grows from visual bottom (inner/centre edge) */}
      <div style={{
        position: 'absolute',
        ...(flipped ? { top: 0 } : { bottom: 0 }),
        left: 0, right: 0,
        height: `${shadowPct}%`,
        background: 'rgba(0,0,0,0.55)',
        transition: 'height 0.35s ease',
        pointerEvents: 'none',
      }} />

      {/* HP number — absolutely positioned on the OUTER panel div so it centres
          relative to the full panel height, not just the flex-1 tap zone */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', gap: 4, zIndex: 2,
      }}>
        <span style={{
          fontSize: compact ? (hp >= 100 ? 52 : 68) : (hp >= 100 ? 72 : 96),
          fontWeight: 800, color: hpColor,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'Inter, sans-serif',
          lineHeight: 1,
          transition: 'color 0.35s, font-size 0.2s',
          textShadow: dead ? '0 0 30px rgba(0,0,0,0.4)' : 'none',
        }}>{hp}</span>
        {!compact && (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.1em' }}>
            MANTÉN = ±{holdDelta}
          </span>
        )}
      </div>

      {/* In 1v1 (non-compact): info row at CSS-top so both players see name at the
          visual top of their panel. Flipped panel still uses CSS-bottom (= visual top). */}
      {!compact && !flipped && infoRow(false)}
      {!compact && !flipped && expandedPanels}

      {/* Tap zones — fill remaining space, HP number floats above via absolute */}
      <div style={{ flex: 1, display: 'flex', zIndex: 3 }}>
        <div {...minusEvents} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}>
          <svg width="32" height="4" viewBox="0 0 32 4" style={{ pointerEvents: 'none', display: 'block' }}>
            <rect x="0" y="0" width="32" height="4" rx="2" fill="rgba(255,255,255,0.25)" />
          </svg>
        </div>
        <div {...plusEvents} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" style={{ pointerEvents: 'none', display: 'block' }}>
            <rect x="12" y="0" width="4" height="28" rx="2" fill="rgba(255,255,255,0.25)" />
            <rect x="0" y="12" width="28" height="4" rx="2" fill="rgba(255,255,255,0.25)" />
          </svg>
        </div>
      </div>

      {/* Compact or flipped: info row at CSS-bottom (outer edge) */}
      {(compact || flipped) && expandedPanels}
      {(compact || flipped) && infoRow(true)}
    </div>
  )

  return flipped ? (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', transform: 'rotate(180deg)' }}>
      {inner}
    </div>
  ) : inner
}

// ── Counter step (MTG / Riftbound) ─────────────
function CounterStep({ game, commander, me, opponents, playerCount, matchType, onResult, onBack }) {
  const startHp = getStartHP(game, commander)
  const maxHp   = getMaxHP(game, commander)
  const isRiftbound = game === 'Riftbound'

  const allPlayers = [me, ...opponents] // length = playerCount

  const saved = useMemo(() => {
    const s = loadCounterState()
    if (s && s.game === game && s.playerCount === playerCount) return s
    return null
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [hps,     setHps]     = useState(() => saved?.hps     ?? Array(playerCount).fill(startHp))
  const [poisons, setPoisons] = useState(() => saved?.poisons ?? Array(playerCount).fill(0))
  const [cmdDmgs, setCmdDmgs] = useState(() => saved?.cmdDmgs ?? Array(playerCount).fill(0))
  const [losers,   setLosers]  = useState([])   // indices of eliminated players
  const [winner,   setWinner]  = useState(null) // index of the last standing player
  const [logging,  setLogging]  = useState(false)
  const [err,      setErr]      = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  // Keep screen awake while counter is active
  useEffect(() => {
    let wakeLock = null
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen')
      } catch {}
    }
    acquire()
    const onVisible = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      wakeLock?.release().catch(() => {})
    }
  }, [])

  // Save to localStorage whenever hps/poisons/cmdDmgs change
  useEffect(() => {
    saveCounterState({
      game, commander, playerCount, hps, poisons, cmdDmgs, matchType,
      players: allPlayers.map(p => ({ id: p?.id, username: p?.username, avatar_url: p?.avatar_url }))
    })
  }, [hps, poisons, cmdDmgs]) // eslint-disable-line react-hooks/exhaustive-deps

  const triggerDeath = (idx) => {
    navigator.vibrate?.([100, 50, 150])
    setLosers(prev => {
      if (prev.includes(idx)) return prev
      const next = [...prev, idx]
      // One player left standing → game over
      if (next.length === playerCount - 1) {
        const winIdx = Array.from({ length: playerCount }, (_, i) => i).find(i => !next.includes(i))
        setWinner(winIdx ?? 0)
      }
      return next
    })
  }

  const adjust = (idx, delta) => {
    if (winner !== null || losers.includes(idx)) return
    setHps(prev => {
      const next = [...prev]
      const newVal = isRiftbound
        ? Math.max(0, Math.min(maxHp, prev[idx] + delta))
        : prev[idx] + delta
      next[idx] = newVal
      if (isRiftbound && newVal >= maxHp) {
        // That player reached 8 — all others lose (simplified: first to reach 8 wins, so mark opponent as loser)
        // For multi-player Riftbound: the player who reached maxHp wins; we mark index 0 (me) as loser if idx != 0
        // Simple approach: trigger death on the "other" side
        const loserIdx = idx === 0 ? 1 : 0
        setTimeout(() => triggerDeath(loserIdx), 0)
      }
      if (!isRiftbound && newVal <= 0) {
        setTimeout(() => triggerDeath(idx), 0)
      }
      return next
    })
  }

  const addPoison = (idx, delta = 1) => {
    if (winner !== null || losers.includes(idx)) return
    setPoisons(prev => {
      const next = [...prev]
      next[idx] = Math.max(0, prev[idx] + delta)
      if (next[idx] >= 10) setTimeout(() => triggerDeath(idx), 0)
      return next
    })
  }

  const addCmdDmg = (idx, delta = 1) => {
    if (winner !== null || losers.includes(idx)) return
    setCmdDmgs(prev => {
      const next = [...prev]
      next[idx] = Math.max(0, prev[idx] + delta)
      if (next[idx] >= 21) setTimeout(() => triggerDeath(idx), 0)
      return next
    })
  }

  const handleConfirmResult = async () => {
    if (winner === null || logging) return
    setLogging(true)
    try {
      const winnerUser = allPlayers[winner]
      const cmdNote = playerCount > 2 ? `Commander (${playerCount}p)` : null

      if (winner === 0) {
        // P1 (me) won — log vs each real (non-guest) loser
        await Promise.all(
          losers
            .filter(idx => !allPlayers[idx]?.isGuest)
            .map(loserIdx => logMatch(allPlayers[loserIdx]?.id, winnerUser?.id, game, cmdNote, matchType))
        )
      } else if (!winnerUser?.isGuest) {
        // Someone else won and they have a real account — log P1's loss vs them
        await logMatch(winnerUser?.id, winnerUser?.id, game, cmdNote, matchType)
      }
      // If winner is a guest: no match to log (can't send notifications to non-users)

      clearCounterState()
      onResult({ winner: winner === 0 ? 'me' : 'them' })
    } catch (e) {
      setErr(e.message || 'Error al registrar')
      setLogging(false)
    }
  }

  const handleReset = () => {
    setHps(Array(playerCount).fill(startHp))
    setPoisons(Array(playerCount).fill(0))
    setCmdDmgs(Array(playerCount).fill(0))
    setLosers([])
    setWinner(null)
    setErr('')
    clearCounterState()
  }

  const winnerUser = winner !== null ? allPlayers[winner] : null

  // 2-player: normal vertical portrait layout
  // 3/4-player: landscape rotation so phone lies flat on table
  const isLandscape = playerCount > 2

  return (
    <div style={isLandscape ? {
      position: 'fixed',
      top: '50%',
      left: '50%',
      width: '100dvh',
      height: '100dvw',
      transform: 'translate(-50%, -50%) rotate(-90deg)',
      overflow: 'hidden',
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
    } : {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
    }}>

      {/* TOP ROW */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>
        {playerCount === 2 && (
          <PlayerPanel
            user={allPlayers[1]}
            hp={hps[1]} maxHp={maxHp} game={game}
            poison={poisons[1]}
            onAdjust={d => adjust(1, d)}
            onPoison={d => addPoison(1, d)}
            isMTG={game === 'MTG'}
            isCommander={game === 'MTG' && commander}
            cmdDmg={cmdDmgs[1]}
            onCmdDmg={d => addCmdDmg(1, d)}
            flipped
            dead={losers.includes(1)}
            playerColor={PLAYER_COLORS[1 % PLAYER_COLORS.length]}
          />
        )}
        {playerCount === 3 && (
          <>
            <PlayerPanel user={allPlayers[1]} hp={hps[1]} maxHp={maxHp} game={game} poison={poisons[1]} onAdjust={d => adjust(1, d)} onPoison={d => addPoison(1, d)} isMTG={game === 'MTG'} isCommander={game === 'MTG' && commander} cmdDmg={cmdDmgs[1]} onCmdDmg={d => addCmdDmg(1, d)} flipped dead={losers.includes(1)} playerColor={PLAYER_COLORS[1]} compact />
            <div style={{ width: 2, background: 'rgba(0,0,0,0.5)', flexShrink: 0 }} />
            <PlayerPanel user={allPlayers[2]} hp={hps[2]} maxHp={maxHp} game={game} poison={poisons[2]} onAdjust={d => adjust(2, d)} onPoison={d => addPoison(2, d)} isMTG={game === 'MTG'} isCommander={game === 'MTG' && commander} cmdDmg={cmdDmgs[2]} onCmdDmg={d => addCmdDmg(2, d)} flipped dead={losers.includes(2)} playerColor={PLAYER_COLORS[2]} compact />
          </>
        )}
        {playerCount === 4 && (
          <>
            <PlayerPanel user={allPlayers[2]} hp={hps[2]} maxHp={maxHp} game={game} poison={poisons[2]} onAdjust={d => adjust(2, d)} onPoison={d => addPoison(2, d)} isMTG={game === 'MTG'} isCommander={game === 'MTG' && commander} cmdDmg={cmdDmgs[2]} onCmdDmg={d => addCmdDmg(2, d)} flipped dead={losers.includes(2)} playerColor={PLAYER_COLORS[2]} compact />
            <div style={{ width: 2, background: 'rgba(0,0,0,0.5)', flexShrink: 0 }} />
            <PlayerPanel user={allPlayers[3]} hp={hps[3]} maxHp={maxHp} game={game} poison={poisons[3]} onAdjust={d => adjust(3, d)} onPoison={d => addPoison(3, d)} isMTG={game === 'MTG'} isCommander={game === 'MTG' && commander} cmdDmg={cmdDmgs[3]} onCmdDmg={d => addCmdDmg(3, d)} flipped dead={losers.includes(3)} playerColor={PLAYER_COLORS[3]} compact />
          </>
        )}
      </div>

      {/* Center line — Q badge floats over it */}
      <div style={{ flexShrink: 0, height: 2, background: 'rgba(0,0,0,0.5)', position: 'relative', overflow: 'visible', zIndex: 20 }}>

        {/* Q badge — opens menu */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 56, height: 56,
            background: '#000000',
            border: 'none',
            borderRadius: 16,
            cursor: 'pointer',
            boxShadow: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            zIndex: 21,
          }}
        >
          <img src={qLogo} alt="Q" style={{ width: 46, height: 46, objectFit: 'contain' }} />
        </button>

        {/* Menu popup — slides up from center */}
        {menuOpen && (
          <>
            {/* Backdrop tap-to-close */}
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 19 }}
            />
            <div style={{
              position: 'absolute', left: '50%', bottom: 36,
              transform: 'translateX(-50%)',
              background: '#111111',
              border: '1px solid #2A2A2A',
              borderRadius: 16,
              padding: '6px',
              display: 'flex', flexDirection: 'column', gap: 4,
              minWidth: 200,
              boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
              animation: 'slideUp 0.18s ease',
              zIndex: 22,
            }}>
              {/* Reset */}
              <button onClick={() => { handleReset(); setMenuOpen(false) }} style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1A1A1A'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 18 }}>↺</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF' }}>Reiniciar</div>
                  <div style={{ fontSize: 10, color: '#4B5563' }}>Volver a las vidas iniciales</div>
                </div>
              </button>

              <div style={{ height: 1, background: '#1E1E1E', margin: '0 4px' }} />

              {/* Change format / game */}
              <button onClick={() => { onBack(); setMenuOpen(false) }} style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1A1A1A'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 18 }}>⚙️</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF' }}>Cambiar formato</div>
                  <div style={{ fontSize: 10, color: '#4B5563' }}>Juego, modo y jugador</div>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* BOTTOM ROW */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>
        {playerCount === 2 && (
          <PlayerPanel
            user={allPlayers[0]}
            hp={hps[0]} maxHp={maxHp} game={game}
            poison={poisons[0]}
            onAdjust={d => adjust(0, d)}
            onPoison={d => addPoison(0, d)}
            isMTG={game === 'MTG'}
            isCommander={game === 'MTG' && commander}
            cmdDmg={cmdDmgs[0]}
            onCmdDmg={d => addCmdDmg(0, d)}
            flipped={false}
            dead={losers.includes(0)}
            playerColor={PLAYER_COLORS[0 % PLAYER_COLORS.length]}
          />
        )}
        {playerCount === 3 && (
          <PlayerPanel
            user={allPlayers[0]}
            hp={hps[0]} maxHp={maxHp} game={game}
            poison={poisons[0]}
            onAdjust={d => adjust(0, d)}
            onPoison={d => addPoison(0, d)}
            isMTG={game === 'MTG'}
            isCommander={game === 'MTG' && commander}
            cmdDmg={cmdDmgs[0]}
            onCmdDmg={d => addCmdDmg(0, d)}
            flipped={false}
            dead={losers.includes(0)}
            playerColor={PLAYER_COLORS[0 % PLAYER_COLORS.length]}
          />
        )}
        {playerCount === 4 && (
          <>
            <PlayerPanel
              user={allPlayers[0]}
              hp={hps[0]} maxHp={maxHp} game={game}
              poison={poisons[0]}
              onAdjust={d => adjust(0, d)}
              onPoison={d => addPoison(0, d)}
              isMTG={game === 'MTG'}
              isCommander={game === 'MTG' && commander}
              cmdDmg={cmdDmgs[0]}
              onCmdDmg={d => addCmdDmg(0, d)}
              flipped={false}
              dead={losers.includes(0)}
              playerColor={PLAYER_COLORS[0 % PLAYER_COLORS.length]}
              compact
            />
            <div style={{ width: 2, background: 'rgba(0,0,0,0.5)', flexShrink: 0 }} />
            <PlayerPanel
              user={allPlayers[1]}
              hp={hps[1]} maxHp={maxHp} game={game}
              poison={poisons[1]}
              onAdjust={d => adjust(1, d)}
              onPoison={d => addPoison(1, d)}
              isMTG={game === 'MTG'}
              isCommander={game === 'MTG' && commander}
              cmdDmg={cmdDmgs[1]}
              onCmdDmg={d => addCmdDmg(1, d)}
              flipped={false}
              dead={losers.includes(1)}
              playerColor={PLAYER_COLORS[1 % PLAYER_COLORS.length]}
              compact
            />
          </>
        )}
      </div>

      {/* Result overlay — shown only when a winner is determined (last player standing) */}
      {winner !== null && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          animation: 'fadeUp 0.3s ease',
          padding: 24,
        }}>
          <div>
            {winner === 0 ? <MiddleFingerIcon size={72} /> : <div style={{ fontSize: 56 }}>💀</div>}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
            {winnerUser ? `¡@${winnerUser.username} ganó!` : 'Partida terminada'}
          </div>
          {losers.length > 0 && (
            <div style={{ fontSize: 12, color: '#6B7280', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
              {losers.map(i => `@${allPlayers[i]?.username}`).join(', ')} {losers.length === 1 ? 'perdió' : 'perdieron'}
            </div>
          )}
          <div style={{ fontSize: 13, color: '#6B7280', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
            ¿Confirmar y registrar el resultado?
          </div>

          {err && <div style={{ fontSize: 12, color: '#F87171', fontFamily: 'Inter, sans-serif' }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 300 }}>
            <button
              onClick={() => { setWinner(null); setLosers([]) }}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 12,
                background: 'rgba(255,255,255,0.06)', border: '1px solid #2A2A2A',
                color: '#9CA3AF', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >Fue error</button>
            <button
              onClick={handleConfirmResult}
              disabled={logging}
              style={{
                flex: 2, padding: '13px 0', borderRadius: 12,
                background: logging ? '#1A1A1A' : '#FFF',
                border: 'none', color: logging ? '#555' : '#111',
                fontSize: 13, fontWeight: 800,
                cursor: logging ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >{logging ? 'Registrando…' : '✓ Confirmar resultado'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Digimon Memory Gauge ──────────────────────
// Shared track: negative = P1's memory, positive = P2's memory.
// When mem > 0  → P2's turn (P2 has that many memory).
// When mem <= 0 → P1's turn (P1 has |mem| memory, 0 = end of turn).
function MemoryGauge({ onBack }) {
  const [mem, setMem] = useState(-1) // start: P1 has 1 memory

  const step = (dir) => {
    setMem(v => { const nv = Math.max(-10, Math.min(10, v + dir)); navigator.vibrate?.(8); return nv })
  }

  const isP1Turn = mem <= 0
  const absVal   = Math.abs(mem)
  const P1C      = PLAYER_COLORS[0]
  const P2C      = PLAYER_COLORS[1]
  const activeC  = isP1Turn ? P1C : P2C
  // dots: -10…-1 = P1, 0 = center, 1…10 = P2
  const DOTS = Array.from({ length: 21 }, (_, i) => i - 10)

  return (
    <div style={{
      flexShrink: 0, background: '#0A0A0A', zIndex: 10,
      borderTop: '2px solid rgba(0,0,0,0.8)', borderBottom: '2px solid rgba(0,0,0,0.8)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
      paddingBottom: 4,
    }}>
      {/* Turn label — P2 side (reads right-side up for P2 since top panel is flipped) */}
      <div style={{
        transform: 'rotate(180deg)', width: '100%',
        display: 'flex', justifyContent: 'center', paddingTop: 6, paddingBottom: 2,
      }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
          color: !isP1Turn ? P2C : 'rgba(255,255,255,0.15)',
          fontFamily: 'Inter, sans-serif', transition: 'color 0.2s',
        }}>
          {!isP1Turn ? `TURNO P2 · ${absVal} MEMORIA` : 'ESPERANDO…'}
        </span>
      </div>

      {/* Dot track */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '4px 8px', flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none', maxWidth: '100%' }}>
        {DOTS.map(pos => {
          const isActive = pos === mem
          const isP1dot  = pos < 0
          const isCenter = pos === 0
          const dotC     = isP1dot ? P1C : isCenter ? '#4B5563' : P2C
          return (
            <div key={pos} style={{
              width: isCenter ? 10 : 9, height: isCenter ? 10 : 9,
              borderRadius: '50%', margin: '0 2px', flexShrink: 0,
              background: isActive ? dotC : isCenter ? '#1F1F1F' : 'rgba(255,255,255,0.05)',
              border: isActive ? 'none' : `1px solid ${isCenter ? '#333' : 'rgba(255,255,255,0.08)'}`,
              boxShadow: isActive ? `0 0 6px ${dotC}` : 'none',
              transition: 'all 0.15s',
            }} />
          )
        })}
      </div>

      {/* Controls row: [P1 −]  [VALUE]  [P1 +]   back   [P2 −]  [VALUE flipped]  [P2 +] */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '2px 12px', gap: 0, justifyContent: 'space-between' }}>

        {/* P1 controls (bottom player) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onPointerDown={() => step(1)} style={{
            width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${P1C}44`,
            background: `${P1C}14`, color: P1C, fontSize: 20, fontWeight: 900,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>+</button>
          <div style={{ textAlign: 'center', minWidth: 36 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: isP1Turn ? P1C : '#333', fontFamily: 'Inter, sans-serif', lineHeight: 1, transition: 'color 0.2s' }}>
              {isP1Turn ? absVal : '·'}
            </div>
            <div style={{ fontSize: 8, fontWeight: 700, color: P1C, letterSpacing: '0.1em', marginTop: 1 }}>P1</div>
          </div>
          <button onPointerDown={() => step(-1)} style={{
            width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${P1C}44`,
            background: `${P1C}14`, color: P1C, fontSize: 24, fontWeight: 900,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>−</button>
        </div>

        {/* Back button */}
        <button onClick={onBack} style={{
          width: 38, height: 38, background: '#111', border: '1px solid #2A2A2A',
          borderRadius: 10, cursor: 'pointer', color: '#6B7280', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>←</button>

        {/* P2 controls (top player, flipped) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, transform: 'rotate(180deg)' }}>
          <button onPointerDown={() => step(-1)} style={{
            width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${P2C}44`,
            background: `${P2C}14`, color: P2C, fontSize: 20, fontWeight: 900,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>+</button>
          <div style={{ textAlign: 'center', minWidth: 36 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: !isP1Turn ? P2C : '#333', fontFamily: 'Inter, sans-serif', lineHeight: 1, transition: 'color 0.2s' }}>
              {!isP1Turn ? absVal : '·'}
            </div>
            <div style={{ fontSize: 8, fontWeight: 700, color: P2C, letterSpacing: '0.1em', marginTop: 1 }}>P2</div>
          </div>
          <button onPointerDown={() => step(1)} style={{
            width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${P2C}44`,
            background: `${P2C}14`, color: P2C, fontSize: 24, fontWeight: 900,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>−</button>
        </div>
      </div>

      {/* Turn label — P1 side */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', paddingBottom: 6, paddingTop: 2 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
          color: isP1Turn ? P1C : 'rgba(255,255,255,0.15)',
          fontFamily: 'Inter, sans-serif', transition: 'color 0.2s',
        }}>
          {isP1Turn ? `TURNO P1 · ${absVal} MEMORIA` : 'ESPERANDO…'}
        </span>
      </div>
    </div>
  )
}

// ── W/L step (non-counter games) ──────────────
// Looks like the life counter: two full-screen colored panels.
// ── Chess-clock times per game (seconds per player) ──────────────
const CLOCK_SECS = { 'One Piece': 15*60, 'Pokemon': 25*60, 'Gundam': 15*60, 'Digimon': 15*60 }

function fmt(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// Chess-clock: tap your panel = end your turn (stops YOUR time, starts THEIRS).
// Hold 5 s on your panel = instant win.
function WLStep({ game, me, opponent, matchType, onResult, onBack }) {
  const startSecs  = CLOCK_SECS[game] ?? 15 * 60
  const [meTime,   setMeTime]   = useState(startSecs)
  const [themTime, setThemTime] = useState(startSecs)
  const [active,   setActive]   = useState(null)   // null | 'me' | 'them'
  const [winner,   setWinner]   = useState(null)   // null | 'me' | 'them'
  const [holdPct,  setHoldPct]  = useState(0)      // 0–1 hold progress
  const [holdWho,  setHoldWho]  = useState(null)
  const [logging,  setLogging]  = useState(false)
  const [err,      setErr]      = useState('')
  const holdRef  = useRef(null)
  const rafRef   = useRef(null)
  const holdStart = useRef(0)
  const HOLD_MS  = 5000

  // Countdown tick
  useEffect(() => {
    if (!active || winner) return
    const id = setInterval(() => {
      if (active === 'me') {
        setMeTime(t => {
          if (t <= 1) { setWinner('them'); setActive(null); return 0 }
          return t - 1
        })
      } else {
        setThemTime(t => {
          if (t <= 1) { setWinner('me'); setActive(null); return 0 }
          return t - 1
        })
      }
    }, 1000)
    return () => clearInterval(id)
  }, [active, winner])

  // Tap: end YOUR turn → start OPPONENT's timer
  const handleTap = (who) => {
    if (winner) return
    // Only act if it's currently your turn (or game hasn't started)
    if (active !== null && active !== who) return
    setActive(who === 'me' ? 'them' : 'me')
    navigator.vibrate?.(18)
  }

  // Hold start
  const startHold = (who) => {
    if (winner) return
    holdStart.current = Date.now()
    setHoldWho(who)
    const tick = () => {
      const pct = Math.min((Date.now() - holdStart.current) / HOLD_MS, 1)
      setHoldPct(pct)
      if (pct < 1) { rafRef.current = requestAnimationFrame(tick) }
      else {
        navigator.vibrate?.([40, 30, 80])
        setWinner(who)
        setActive(null)
        setHoldWho(null)
        setHoldPct(0)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }
  const cancelHold = () => {
    cancelAnimationFrame(rafRef.current)
    setHoldWho(null)
    setHoldPct(0)
  }

  const handleSubmit = async () => {
    if (!winner || logging) return
    setLogging(true)
    try {
      if (!opponent?.isGuest) {
        const winnerId = winner === 'me' ? me.id : opponent.id
        await logMatch(opponent.id, winnerId, game, null, matchType)
      }
      onResult({ winner })
    } catch (e) {
      setErr(e.message || 'Error al registrar')
      setLogging(false)
    }
  }

  const ClockPanel = ({ who, user, secs, flipped }) => {
    const isActive   = active === who
    const isWinner   = winner === who
    const isLoser    = winner !== null && winner !== who
    const isHolding  = holdWho === who
    const color      = who === 'me' ? PLAYER_COLORS[0] : PLAYER_COLORS[1]
    const low        = secs <= 60 && secs > 0
    const urgent     = secs <= 10 && secs > 0

    const bg = isWinner ? color
      : isLoser   ? `${color}22`
      : isActive  ? `${color}cc`
      : `${color}44`

    // SVG ring for hold progress
    const R = 38, CIRC = 2 * Math.PI * R
    const dash = isHolding ? CIRC * holdPct : 0

    return (
      <div
        onPointerDown={() => startHold(who)}
        onPointerUp={() => { cancelHold(); handleTap(who) }}
        onPointerLeave={cancelHold}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: bg, transition: 'background 0.3s',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', touchAction: 'none',
          transform: flipped ? 'rotate(180deg)' : 'none',
          userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        {/* Active pulse ring */}
        {isActive && !winner && (
          <div style={{
            position: 'absolute', inset: 0,
            border: `3px solid ${color}`,
            borderRadius: 0,
            animation: 'ringPulse 1.4s infinite',
            pointerEvents: 'none',
          }} />
        )}

        {/* Winner icon */}
        {isWinner && (
          <div style={{ animation: 'fadeUp 0.3s ease', pointerEvents: 'none' }}>
            {who === 'me'
              ? <MiddleFingerIcon size={72} />
              : <div style={{ fontSize: 60, lineHeight: 1 }}>💀</div>
            }
          </div>
        )}

        {/* Timer display */}
        {!isWinner && (
          <div style={{
            fontSize: urgent ? 72 : 64, fontWeight: 900,
            fontFamily: 'Inter, sans-serif', letterSpacing: '-2px',
            color: low ? '#FCA5A5' : '#FFF',
            animation: urgent && isActive ? 'pulse 0.8s infinite' : 'none',
            pointerEvents: 'none',
          }}>
            {fmt(secs)}
          </div>
        )}

        {/* Hold progress ring */}
        {isHolding && (
          <svg width={90} height={90} style={{ position: 'absolute', pointerEvents: 'none' }}>
            <circle cx={45} cy={45} r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={4} />
            <circle cx={45} cy={45} r={R} fill="none" stroke="#FFF" strokeWidth={4}
              strokeDasharray={`${dash} ${CIRC}`} strokeLinecap="round"
              transform="rotate(-90 45 45)" />
          </svg>
        )}

        {/* Hint label */}
        {!winner && active === null && (
          <div style={{ position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif' }}>
              TOCA AL TERMINAR TU TURNO
            </span>
          </div>
        )}

        {/* Player info */}
        <div style={{
          position: 'absolute', bottom: 14, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          pointerEvents: 'none',
        }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
            <Avatar url={user?.avatar_url} size={26} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter, sans-serif' }}>
            @{user?.username ?? '…'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'relative',
      userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
    }}>
      {/* Opponent panel — top, flipped */}
      <ClockPanel who="them" user={opponent} secs={themTime} flipped />

      {/* Center divider + back (or Digimon memory gauge) */}
      {game === 'Digimon'
        ? <MemoryGauge onBack={onBack} />
        : (
          <div style={{ flexShrink: 0, height: 2, background: 'rgba(0,0,0,0.7)', position: 'relative', overflow: 'visible', zIndex: 10 }}>
            <button
              onClick={onBack}
              style={{
                position: 'absolute', left: '50%', top: '50%',
                transform: 'translate(-50%,-50%)',
                width: 44, height: 44, background: '#111', border: '1px solid #2A2A2A',
                borderRadius: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6B7280', fontSize: 18, zIndex: 11,
              }}
            >←</button>
          </div>
        )
      }

      {/* My panel — bottom */}
      <ClockPanel who="me" user={me} secs={meTime} flipped={false} />

      {/* Confirm overlay — slides up when winner decided */}
      {winner && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '16px 20px calc(env(safe-area-inset-bottom,0px) + 16px)',
          background: 'linear-gradient(to top, rgba(0,0,0,0.96) 70%, transparent)',
          zIndex: 20, display: 'flex', flexDirection: 'column', gap: 8,
          animation: 'fadeUp 0.22s ease',
        }}>
          {err && <div style={{ fontSize: 12, color: '#F87171', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>{err}</div>}
          <button onClick={handleSubmit} disabled={logging} style={{
            padding: '15px 0', borderRadius: 14,
            background: logging ? '#1A1A1A' : '#FFF',
            border: 'none', color: logging ? '#555' : '#111',
            fontSize: 15, fontWeight: 800,
            cursor: logging ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            {logging ? 'Registrando…' : matchType === 'final' ? '🏆 Confirmar resultado final' : '⚔️ Confirmar resultado'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Done screen ───────────────────────────────
function DoneScreen({ winner, me, opponent, onClose, onViewProfile }) {
  const iWon = winner === 'me'
  const hasRealOpponent = opponent && !opponent.isGuest && opponent.id

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      padding: 32, textAlign: 'center',
      animation: 'fadeUp 0.4s ease',
    }}>

      {/* Icon */}
      {iWon
        ? <MiddleFingerIcon size={80} />
        : <div style={{ fontSize: 64 }}>🤝</div>
      }

      {/* Result text */}
      <div style={{ fontSize: 24, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif' }}>
        {iWon ? '¡Ganaste!' : `@${opponent?.username ?? '…'} ganó`}
      </div>
      <div style={{ fontSize: 13, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
        Resultado registrado en tu H2H
      </div>

      {/* Opponent profile card — tap to view their profile */}
      {hasRealOpponent && (
        <button
          onClick={() => onViewProfile?.(opponent.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 18px', borderRadius: 16,
            background: 'rgba(255,255,255,0.05)', border: '1px solid #2A2A2A',
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            width: '100%', maxWidth: 280, textAlign: 'left',
            marginTop: 4,
          }}
        >
          <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid #2A2A2A', background: '#111' }}>
            <Avatar url={opponent.avatar_url} size={42} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              @{opponent.username}
            </div>
            <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, marginTop: 2 }}>
              Ver win rate H2H →
            </div>
          </div>
        </button>
      )}

      <button
        onClick={onClose}
        style={{
          marginTop: 8, padding: '13px 40px', borderRadius: 14,
          background: '#FFF', border: 'none', color: '#111',
          fontSize: 14, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}
      >Cerrar</button>
    </div>
  )
}

// ── Small helpers ─────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, color: '#6B7280', fontFamily: 'Inter, sans-serif', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
      {children}
    </div>
  )
}

// ── Main export ───────────────────────────────
// Works both as a nav tab (no onClose) and as a modal overlay (onClose provided).
export default function LifeCounterScreen({ onClose, onViewProfile }) {
  const { profile } = useAuth()
  const [step,    setStep]   = useState('setup') // 'setup' | 'counter' | 'wl' | 'done'
  const [config,  setConfig] = useState(null)
  const [result,  setResult] = useState(null)

  // ── Wake lock — keep screen on during active game ──
  useEffect(() => {
    if (step !== 'counter' && step !== 'wl') return
    let lock = null
    navigator.wakeLock?.request('screen')
      .then(l => { lock = l })
      .catch(() => {})
    return () => { lock?.release().catch(() => {}) }
  }, [step])

  // Check for saved state on mount — if valid, jump straight to counter
  useEffect(() => {
    const saved = loadCounterState()
    if (saved && saved.game) {
      setConfig({
        game: saved.game,
        commander: saved.commander,
        playerCount: saved.playerCount,
        matchType: saved.matchType,
        opponents: saved.players?.slice(1).map(p => p) ?? [],
        opponent: saved.players?.[1] ?? null,
      })
      setStep(COUNTER_GAMES.has(saved.game) ? 'counter' : 'wl')
    }
  }, [])

  const handleStart = (cfg) => {
    setConfig(cfg)
    setStep(COUNTER_GAMES.has(cfg.game) ? 'counter' : 'wl')
  }

  const handleResult = (res) => {
    setResult(res)
    setStep('done')
  }

  // As a tab, the screen fills the main scroll area (flex child).
  // As a modal overlay (onClose provided), it covers everything absolutely.
  const isModal = !!onClose

  return (
    <div style={isModal ? {
      position: 'absolute', inset: 0, zIndex: 200,
      background: '#0A0A0A', display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      animation: 'slideUp 0.22s ease',
    } : {
      display: 'flex', flexDirection: 'column',
      background: '#0A0A0A', minHeight: '100%',
    }}>

      {/* Header — only on setup and done */}
      {(step === 'setup' || step === 'done') && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px 12px', flexShrink: 0,
          background: '#0D0D0D', borderBottom: '1px solid #1A1A1A',
        }}>
          {/* Back arrow only in modal mode; in tab mode show nothing (nav handles back) */}
          {isModal
            ? <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 20, lineHeight: 1, padding: '0 2px' }}>←</button>
            : <div style={{ width: 28 }} />
          }
          <div style={{ fontSize: 17, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="#fff" strokeWidth="0">
              <path d="M13 12.465625c1.828125 -1.284375 3 -3.253125 3 -5.465625C16 3.134375 12.41875 0 8 0S0 3.134375 0 7c0 2.209375 1.171875 4.18125 3 5.465625l0 0.034375v2c0 0.828125 0.671875 1.5 1.5 1.5h1.5v-1.5c0 -0.275 0.225 -0.5 0.5 -0.5s0.5 0.225 0.5 0.5v1.5h2v-1.5c0 -0.275 0.225 -0.5 0.5 -0.5s0.5 0.225 0.5 0.5v1.5h1.5c0.828125 0 1.5 -0.671875 1.5 -1.5v-2l0 -0.034375zM3 8a2 2 0 1 1 4 0 2 2 0 1 1 -4 0zm8 -2a2 2 0 1 1 0 4 2 2 0 1 1 0 -4z"/>
            </svg>
            Life Counter
          </div>
        </div>
      )}

      {step === 'setup' && (
        <SetupStep profile={profile} onStart={handleStart} />
      )}

      {step === 'counter' && config && (
        <CounterStep
          game={config.game}
          commander={config.commander}
          me={profile}
          opponents={config.opponents ?? [config.opponent]}
          playerCount={config.playerCount ?? 2}
          matchType={config.matchType}
          onResult={handleResult}
          onBack={() => setStep('setup')}
        />
      )}

      {step === 'wl' && config && (
        <WLStep
          game={config.game}
          me={profile}
          opponent={config.opponent}
          matchType={config.matchType}
          onResult={handleResult}
          onBack={() => setStep('setup')}
        />
      )}

      {step === 'done' && (
        <DoneScreen
          winner={result?.winner}
          me={profile}
          opponent={config?.opponent}
          onViewProfile={onViewProfile}
          onClose={onClose ?? (() => { setStep('setup'); setConfig(null); setResult(null) })}
        />
      )}
    </div>
  )
}
