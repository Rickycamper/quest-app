// ─────────────────────────────────────────────
// QUEST — LifeCounterScreen
// Life counter for MTG / Riftbound + W/L logger
// for Pokemon, One Piece, Digimon, Gundam
// ─────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { logMatch, searchUsers, createNotification } from '../lib/supabase'
import { shareOrCopy } from '../lib/share'
import { useToast } from '../components/Toast'
import { GAMES, GAME_STYLES } from '../lib/constants'
import Avatar from '../components/Avatar'
import GameIcon from '../components/GameIcon'
// Lucide — used in the admin/owner refined header (matches the
// medieval nav family: Swords for combat / life counter).
import { Swords as SwordIcon } from 'lucide-react'
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

// ── Player picker sheet ───────────────────────
// Bottom-sheet para asignar un usuario real (o invitado con nombre) a un
// slot de oponente DESDE ADENTRO del counter/reloj — sin pasar por el setup.
function PlayerPickerSheet({ excludeIds = [], onPick, onClose }) {
  const [query,   setQuery]   = useState('')
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    searchUsers('')
      .then(d => { if (alive) setUsers(d ?? []) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const q = query.trim().toLowerCase()
  const results = users
    .filter(u => !excludeIds.includes(u.id))
    .filter(u => !q || u.username?.toLowerCase().includes(q))
    .slice(0, 30)

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 120,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxHeight: '70%', background: '#111',
        borderRadius: '20px 20px 0 0', border: '1px solid #222', borderBottom: 'none',
        padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', gap: 10,
        animation: 'slideUp 0.22s ease', fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#FFF' }}>Agregar jugador</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar @usuario…"
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10,
            background: '#0A0A0A', border: '1px solid #2A2A2A',
            color: '#FFF', fontWeight: 600, outline: 'none', boxSizing: 'border-box',
          }}
        />
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Invitado con nombre — para rivales sin cuenta */}
          {query.trim() && (
            <button
              onClick={() => onPick({ id: null, username: query.trim(), avatar_url: null, isGuest: true })}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10, background: 'rgba(255,255,255,0.04)',
                border: '1px dashed rgba(255,255,255,0.18)', cursor: 'pointer',
                color: '#9CA3AF', fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif', textAlign: 'left',
              }}
            >
              👤 Jugar vs “{query.trim()}” <span style={{ fontWeight: 500, color: '#4B5563' }}>(invitado, sin cuenta)</span>
            </button>
          )}
          {loading && <div style={{ padding: 18, textAlign: 'center', color: '#4B5563', fontSize: 12 }}>Cargando…</div>}
          {!loading && results.map(u => (
            <button
              key={u.id}
              onClick={() => onPick(u)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 10, background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', textAlign: 'left',
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                <Avatar url={u.avatar_url} size={32} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#FFF' }}>{u.username}</span>
            </button>
          ))}
          {!loading && !results.length && !query.trim() && (
            <div style={{ padding: 18, textAlign: 'center', color: '#4B5563', fontSize: 12 }}>Sin usuarios</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Setup step ────────────────────────────────
function SetupStep({ profile, invite, resumeConfig, onStart }) {
  // Si llegamos por una invitación, preseleccionamos game/commander/etc
  // y el host queda preadded como oponente. El usuario sólo tiene que
  // tap 'Iniciar contador'.
  const [game,        setGame]       = useState(invite?.g ?? resumeConfig?.game ?? 'MTG')
  const [commander,   setCommander]  = useState(invite ? !!invite.c : !!resumeConfig?.commander)
  const [matchType,   setMatchType]  = useState(invite?.m ?? resumeConfig?.matchType ?? 'casual')
  const [playerCount, setPlayerCount] = useState(invite?.p ?? resumeConfig?.playerCount ?? 2)
  // Flujo en 2 fases: primero elegís el JUEGO a pantalla completa (logos
  // grandes) y arranca AL TOQUE. El config solo aparece con invite o cuando
  // volvés desde el counter ("Cambiar formato" → resumeConfig).
  const [phase,       setPhase]      = useState((invite || resumeConfig) ? 'config' : 'game')
  const [opponents,   setOpponents]  = useState(() => {
    if (invite?.h && invite?.hi) {
      return [{ id: invite.hi, username: invite.h, avatar_url: null }, null, null]
    }
    if (resumeConfig?.opponents?.length) {
      const slots = [null, null, null]
      resumeConfig.opponents.forEach((o, i) => { if (o && !o.isGuest && i < 3) slots[i] = o })
      return slots
    }
    return [null, null, null]
  })
  const [activeSlot,  setActiveSlot] = useState(invite ? 1 : 0)
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
    // Slots vacíos → invitados. Ya no bloqueamos: el usuario real se puede
    // asignar desde adentro del counter (PlayerPickerSheet).
    const activeOpponents = opponents.slice(0, neededSlots)
      .map(o => o ?? { id: null, username: 'Invitado', avatar_url: null, isGuest: true })
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

  // ── Fase 1: elegir juego a PANTALLA COMPLETA (logos grandes) ──
  if (phase === 'game') {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: '14px 14px calc(14px + env(safe-area-inset-bottom, 0px))',
        gap: 12, overflow: 'hidden',
      }}>
        <div style={{ textAlign: 'center', margin: '4px 0 2px' }}>
          <div style={{ fontSize: 21, fontWeight: 900, color: '#FFF', letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>
            ¿Qué van a jugar?
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, fontFamily: 'Inter, sans-serif' }}>
            Tocá tu TCG y arrancá al toque
          </div>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: '1fr', gap: 10, minHeight: 0 }}>
          {GAMES.map((g, i) => {
            const gs = GAME_STYLES[g]
            return (
              <button
                key={g}
                onClick={() => {
                  // Quick-start: arranca el counter/reloj del juego AL TOQUE
                  // vs un invitado. El usuario real se agrega desde adentro
                  // (menú Q / botón 👤) y formato desde "Cambiar formato".
                  const GUEST = { id: null, username: 'Invitado', avatar_url: null, isGuest: true }
                  onStart({ game: g, commander: false, matchType: 'casual', playerCount: 2, opponents: [GUEST], opponent: GUEST })
                }}
                style={{
                  borderRadius: 20, cursor: 'pointer', minHeight: 0, padding: 10,
                  background: `radial-gradient(ellipse 95% 75% at 50% 32%, ${gs.bg}, rgba(255,255,255,0.02) 85%)`,
                  border: `1.5px solid ${gs.border}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
                  boxShadow: `0 0 22px ${gs.border}33, inset 0 1px 0 rgba(255,255,255,0.06)`,
                  fontFamily: 'Inter, sans-serif',
                  animation: `fadeUp 0.35s ease ${i * 60}ms both`,
                  transition: 'transform 180ms cubic-bezier(0.34,1.56,0.64,1)',
                }}
                onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.94)' }}
                onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.94)' }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                <GameIcon game={g} size={68} style={{ filter: `drop-shadow(0 0 20px ${gs.color}77)` }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: gs.color, letterSpacing: '-0.01em' }}>{g}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Fase 2: formato / jugadores / oponentes ──
  return (
    <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '20px 16px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Invite banner — solo si llegamos por un link */}
      {invite && (
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(251,146,60,0.14) 0%, rgba(244,114,182,0.10) 50%, rgba(167,139,250,0.14) 100%)',
          backdropFilter: 'blur(18px) saturate(180%)',
          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
          border: '1px solid rgba(244,114,182,0.30)',
          boxShadow: '0 0 14px rgba(244,114,182,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(244,114,182,0.18)',
            border: '1px solid rgba(244,114,182,0.40)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <SwordIcon size={18} strokeWidth={2.3} color="#F472B6" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.005em' }}>
              <span style={{ color: '#F472B6' }}>@{invite.h}</span> te invitó
            </div>
            <div style={{ fontSize: 11, color: '#C4B5FD', marginTop: 2 }}>
              {invite.g}{invite.c ? ' · Commander' : ''}{invite.m === 'final' ? ' · Final' : ' · Casual'}
            </div>
          </div>
        </div>
      )}

      {/* Juego elegido — tocá para volver a la pantalla de juegos */}
      <div>
        <button
          onClick={() => setPhase('game')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
            padding: '13px 16px', borderRadius: 16, cursor: 'pointer',
            background: `radial-gradient(ellipse 90% 100% at 15% 50%, ${GAME_STYLES[game].bg}, rgba(255,255,255,0.02) 90%)`,
            border: `1.5px solid ${GAME_STYLES[game].border}`,
            boxShadow: `0 0 16px ${GAME_STYLES[game].border}33, inset 0 1px 0 rgba(255,255,255,0.05)`,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <GameIcon game={game} size={40} style={{ filter: `drop-shadow(0 0 12px ${GAME_STYLES[game].color}66)` }} />
          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: GAME_STYLES[game].color, letterSpacing: '-0.01em' }}>{game}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>Tocá para cambiar de juego</div>
          </div>
          <span style={{ color: '#6B7280', fontSize: 18, lineHeight: 1 }}>›</span>
        </button>

        {/* MTG mode toggle */}
        {game === 'MTG' && (
          <div style={{ marginTop: 14 }}>
            <SectionLabel>Formato</SectionLabel>
          </div>
        )}
        {game === 'MTG' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 0 }}>
            {[{ v: false, label: 'Standard (20)' }, { v: true, label: 'Commander (40)' }].map(({ v, label }) => (
              <button key={String(v)} onClick={() => { setCommander(v); setPlayerCount(2); setOpponents([null, null, null]); setActiveSlot(0) }} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                background: commander === v ? 'rgba(167,139,250,0.14)' : 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(18px) saturate(180%)',
                WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                border: `1px solid ${commander === v ? 'rgba(167,139,250,0.45)' : 'rgba(255,255,255,0.08)'}`,
                color: commander === v ? '#A78BFA' : '#9CA3AF',
                fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                transition: 'all 0.2s',
                boxShadow: commander === v ? '0 0 14px rgba(167,139,250,0.22), inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
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
                background: playerCount === n ? 'rgba(167,139,250,0.14)' : 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(18px) saturate(180%)',
                WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                border: `1px solid ${playerCount === n ? 'rgba(167,139,250,0.45)' : 'rgba(255,255,255,0.08)'}`,
                color: playerCount === n ? '#A78BFA' : '#9CA3AF',
                fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                transition: 'all 0.2s',
                boxShadow: playerCount === n ? '0 0 14px rgba(167,139,250,0.22), inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
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
              background: matchType === v ? 'rgba(167,139,250,0.14)' : 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(18px) saturate(180%)',
              WebkitBackdropFilter: 'blur(18px) saturate(180%)',
              border: `1px solid ${matchType === v ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              transition: 'all 0.2s',
              boxShadow: matchType === v ? '0 0 14px rgba(167,139,250,0.22), inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
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
                  background: 'rgba(255,255,255,0.04)',
                  backdropFilter: 'blur(18px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                  border: `1px solid ${slotUser.isGuest ? 'rgba(251,146,60,0.35)' : 'rgba(74,222,128,0.35)'}`,
                  borderRadius: 10, padding: '10px 12px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
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
                    background: 'rgba(255,255,255,0.03)',
                    backdropFilter: 'blur(18px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                    border: `1px solid ${isActive ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
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
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#FFF' }}>{u.username}</span>
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

      {/* Action buttons — Iniciar contador (gradient) + Compartir invitación
          (glass). Share genera un link con la config codificada en base64
          y, si el oponente es un usuario Quest, le manda una notificación. */}
      {(() => {
        const canStart = allowGuest || opponents.slice(0, neededSlots).every(o => !!o)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={canStart ? 'pressable' : ''}
              style={{
                padding: '15px 0', borderRadius: 14,
                background: canStart
                  ? 'linear-gradient(135deg, #FB923C 0%, #F472B6 60%, #A78BFA 130%)'
                  : 'rgba(255,255,255,0.03)',
                border: canStart ? 'none' : '1px solid rgba(255,255,255,0.06)',
                color: canStart ? '#FFFFFF' : '#555',
                fontSize: 15, fontWeight: 800,
                cursor: canStart ? 'pointer' : 'default',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.01em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: canStart
                  ? '0 10px 28px rgba(251,146,60,0.30), 0 4px 10px rgba(167,139,250,0.22), inset 0 1px 0 rgba(255,255,255,0.30)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                textShadow: canStart ? '0 1px 0 rgba(0,0,0,0.18)' : 'none',
                transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease',
              }}
            >
              <SwordIcon size={18} strokeWidth={2.3} color={canStart ? '#FFFFFF' : '#555'} />
              {COUNTER_GAMES.has(game) ? 'Iniciar contador' : 'Iniciar duelo'}
            </button>

            <ShareInviteButton
              profile={profile}
              game={game}
              commander={commander}
              matchType={matchType}
              playerCount={playerCount}
              opponents={opponents.slice(0, neededSlots)}
            />
          </div>
        )
      })()}
    </div>
  )
}

// ── Share invite ────────────────────────────────────────────────────
// Genera un link con la config codificada en base64. Si el oponente
// es un usuario Quest existente, dispara también una notificación
// in-app + push para que le llegue avisado.
function ShareInviteButton({ profile, game, commander, matchType, playerCount, opponents }) {
  const toast = useToast()
  const [sharing, setSharing] = useState(false)
  const handleShare = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const payload = {
        h:  profile?.username ?? '',
        hi: profile?.id ?? '',
        g:  game,
        c:  commander,
        m:  matchType,
        p:  playerCount,
        t:  Date.now(),
      }
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const url = `${window.location.origin}/?lc-invite=${b64}`
      const text = `@${profile?.username ?? 'alguien'} te invitó a una partida de ${game}${commander ? ' Commander' : ''}${matchType === 'final' ? ' (Final)' : ''} en Quest TCG`

      const res = await shareOrCopy({ title: 'Invitación Quest TCG', text, url })
      if (res?.method === 'clipboard' || res?.method === 'legacy') {
        toast?.('Link copiado — mándalo a tu oponente', { type: 'success' })
      }

      // Notification + push to selected Quest users (skip guests).
      // Fire-and-forget so the share UX isn't blocked by network.
      const realOpps = (opponents ?? []).filter(o => o && o.id && !o.isGuest)
      for (const opp of realOpps) {
        createNotification(
          opp.id,
          'lc_invite',
          '⚔️ Te invitaron a una partida',
          `@${profile?.username ?? 'alguien'} te invitó a ${game}${commander ? ' Commander' : ''}`,
          { url, game, commander, matchType, host_id: profile?.id }
        ).catch(() => {})
      }
    } catch (e) {
      toast?.('No se pudo compartir', { type: 'error' })
    } finally {
      setSharing(false)
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={sharing}
      className="pressable"
      style={{
        padding: '12px 0', borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(18px) saturate(180%)',
        WebkitBackdropFilter: 'blur(18px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.10)',
        color: '#E5E7EB',
        fontSize: 13, fontWeight: 700,
        cursor: sharing ? 'wait' : 'pointer',
        fontFamily: 'Inter, sans-serif',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        transition: 'all 0.2s',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      {sharing ? 'Compartiendo…' : 'Invitar jugador'}
    </button>
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

  // Panel bg — glass: el color del jugador en bajo alpha sobre el
  // fondo translúcido del app. backdrop-filter blurea lo que hay
  // detrás para que se sienta como un cristal pintado. Cuando el
  // jugador muere, el panel se desatura.
  const panelBg = dead
    ? `linear-gradient(135deg, ${playerColor}18 0%, rgba(255,255,255,0.02) 100%)`
    : `linear-gradient(135deg, ${playerColor}66 0%, ${playerColor}33 60%, ${playerColor}55 100%)`

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
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 8, minWidth: 0 }}>
        <div style={{
          width: compact ? 22 : 28, height: compact ? 22 : 28,
          borderRadius: '50%', overflow: 'hidden',
          background: 'rgba(0,0,0,0.25)', flexShrink: 0,
          border: '2px solid rgba(255,255,255,0.3)',
        }}>
          <Avatar url={user?.avatar_url} size={compact ? 22 : 28} />
        </div>
        {compact && user?.username && (
          <span style={{
            fontSize: 11, fontWeight: 800, color: '#FFFFFF',
            fontFamily: 'Inter, sans-serif', letterSpacing: '0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 90,
            textShadow: '0 1px 2px rgba(0,0,0,0.4)',
          }}>
            {user?.username ?? ''}
          </span>
        )}
        {!compact && (
          <span style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFF', fontFamily: 'Inter, sans-serif', letterSpacing: '0.01em' }}>
            {user?.username ?? '…'}
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
      backdropFilter: 'blur(30px) saturate(180%)',
      WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      boxShadow: dead ? 'none' : `inset 0 1px 0 rgba(255,255,255,0.10), inset 0 0 80px ${playerColor}22`,
      transition: 'background 0.4s, box-shadow 0.4s',
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
          fontSize: compact ? (hp >= 100 ? 88 : 112) : (hp >= 100 ? 72 : 96),
          fontWeight: 800, color: hpColor,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'Inter, sans-serif',
          lineHeight: 1,
          transition: 'color 0.35s, font-size 0.2s',
          textShadow: dead ? '0 0 30px rgba(0,0,0,0.4)' : '0 2px 14px rgba(0,0,0,0.45)',
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

      {/* Tap zones — split left/right. En compact (3p/4p) los iconos
          se alinean a las orillas del panel (flex-start / flex-end)
          para que NO se solapen con el número de HP grande del centro.
          Padding lateral genera el aire necesario. */}
      <div style={{ flex: 1, display: 'flex', zIndex: 3 }}>
        <div {...minusEvents} style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: compact ? 'flex-start' : 'center',
          paddingLeft: compact ? 16 : 0,
          cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none',
        }}>
          <svg width="32" height="4" viewBox="0 0 32 4" style={{ pointerEvents: 'none', display: 'block' }}>
            <rect x="0" y="0" width="32" height="4" rx="2" fill="rgba(255,255,255,0.35)" />
          </svg>
        </div>
        <div {...plusEvents} style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: compact ? 'flex-end' : 'center',
          paddingRight: compact ? 16 : 0,
          cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none',
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" style={{ pointerEvents: 'none', display: 'block' }}>
            <rect x="12" y="0" width="4" height="28" rx="2" fill="rgba(255,255,255,0.35)" />
            <rect x="0" y="12" width="28" height="4" rx="2" fill="rgba(255,255,255,0.35)" />
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
function CounterStep({ game, commander, me, opponents, playerCount, matchType, onResult, onBack, onUpdateOpponent }) {
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
  const [pickerOpen, setPickerOpen] = useState(false)
  // Slot a asignar cuando eligen usuario: el primer oponente invitado/vacío
  // (si todos son reales, reemplaza el primero).
  const guestSlotIdx = opponents.findIndex(o => !o || o.isGuest)
  const assignSlotIdx = guestSlotIdx === -1 ? 0 : guestSlotIdx

  // Keep screen awake while counter is active
  useEffect(() => {
    let wakeLock = null
    let cancelled = false
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) {
          const l = await navigator.wakeLock.request('screen')
          // Si el efecto ya se limpió mientras esperábamos, soltamos el lock
          // recién obtenido para no dejarlo huérfano.
          if (cancelled) l.release().catch(() => {})
          else wakeLock = l
        }
      } catch {}
    }
    acquire()
    const onVisible = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
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
            <div style={{ width: 2, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
            <PlayerPanel user={allPlayers[2]} hp={hps[2]} maxHp={maxHp} game={game} poison={poisons[2]} onAdjust={d => adjust(2, d)} onPoison={d => addPoison(2, d)} isMTG={game === 'MTG'} isCommander={game === 'MTG' && commander} cmdDmg={cmdDmgs[2]} onCmdDmg={d => addCmdDmg(2, d)} flipped dead={losers.includes(2)} playerColor={PLAYER_COLORS[2]} compact />
          </>
        )}
        {playerCount === 4 && (
          <>
            <PlayerPanel user={allPlayers[2]} hp={hps[2]} maxHp={maxHp} game={game} poison={poisons[2]} onAdjust={d => adjust(2, d)} onPoison={d => addPoison(2, d)} isMTG={game === 'MTG'} isCommander={game === 'MTG' && commander} cmdDmg={cmdDmgs[2]} onCmdDmg={d => addCmdDmg(2, d)} flipped dead={losers.includes(2)} playerColor={PLAYER_COLORS[2]} compact />
            <div style={{ width: 2, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
            <PlayerPanel user={allPlayers[3]} hp={hps[3]} maxHp={maxHp} game={game} poison={poisons[3]} onAdjust={d => adjust(3, d)} onPoison={d => addPoison(3, d)} isMTG={game === 'MTG'} isCommander={game === 'MTG' && commander} cmdDmg={cmdDmgs[3]} onCmdDmg={d => addCmdDmg(3, d)} flipped dead={losers.includes(3)} playerColor={PLAYER_COLORS[3]} compact />
          </>
        )}
      </div>

      {/* Center line — Q badge floats over it */}
      <div style={{ flexShrink: 0, height: 2, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'visible', zIndex: 20 }}>

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

              {/* Agregar / asignar jugador real sin salir del counter */}
              <button onClick={() => { setPickerOpen(true); setMenuOpen(false) }} style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1A1A1A'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: 18 }}>👤</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF' }}>Agregar jugador</div>
                  <div style={{ fontSize: 10, color: '#4B5563' }}>Asigná un usuario real al rival</div>
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
            <div style={{ width: 2, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320 }}>
            <button
              onClick={handleConfirmResult}
              disabled={logging}
              className={logging ? '' : 'pressable'}
              style={{
                padding: '14px 0', borderRadius: 12,
                background: logging
                  ? 'rgba(255,255,255,0.04)'
                  : 'linear-gradient(135deg, #4ADE80 0%, #22D3EE 100%)',
                border: 'none',
                color: logging ? '#555' : '#062013',
                fontSize: 14, fontWeight: 800,
                cursor: logging ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                boxShadow: logging ? 'none' : '0 6px 18px rgba(74,222,128,0.30), inset 0 1px 0 rgba(255,255,255,0.30)',
                textShadow: logging ? 'none' : '0 1px 0 rgba(0,0,0,0.10)',
                transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease',
              }}
            >{logging ? 'Registrando…' : '✓ Confirmar y registrar'}</button>
            <button
              onClick={handleReset}
              className="pressable"
              style={{
                padding: '13px 0', borderRadius: 12,
                background: 'linear-gradient(135deg, #FB923C 0%, #F472B6 60%, #A78BFA 130%)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: 14, fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.01em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                boxShadow: '0 6px 18px rgba(251,146,60,0.28), 0 2px 6px rgba(167,139,250,0.18), inset 0 1px 0 rgba(255,255,255,0.28)',
                textShadow: '0 1px 0 rgba(0,0,0,0.18)',
                transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1)',
              }}
            >
              <SwordIcon size={16} strokeWidth={2.3} color="#FFFFFF" />
              REVANCHA
            </button>
            <button
              onClick={() => { setWinner(null); setLosers([]) }}
              style={{
                padding: '11px 0', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: '#9CA3AF', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >Fue error · seguir jugando</button>
          </div>
        </div>
      )}

      {/* Asignar usuario real a un slot — sin salir del counter */}
      {pickerOpen && (
        <PlayerPickerSheet
          excludeIds={[me?.id, ...opponents.filter(o => o?.id).map(o => o.id)]}
          onClose={() => setPickerOpen(false)}
          onPick={(u) => { onUpdateOpponent?.(assignSlotIdx, u); setPickerOpen(false) }}
        />
      )}
    </div>
  )
}

// ── Digimon Memory Gauge ──────────────────────────────────────────
//
//  HORIZONTAL layout — two cards confronted, 0 uniting them:
//
//   ← P2 (left, rotated 180°, reads correctly from top) │ 0 │ P1 (right, normal) →
//      [5][4][3][2][1]                                   │   │ [5][4][3][2][1]
//      [6][7][8][9][10]                                  │   │ [6][7][8][9][10]
//
//  mem <= 0 → P1's turn (stays at 0, 0 belongs to active player)
//  mem >  0 → P2's turn
//
function MemoryGauge({ mem, onSet, onBack }) {
  const isP1Turn = mem <= 0
  const P1C  = PLAYER_COLORS[0]
  const P2C  = PLAYER_COLORS[1]
  const p1Val = mem <= 0 ? Math.abs(mem) : 0
  const p2Val = mem >  0 ? mem            : 0
  const tapP1 = (n) => onSet(mem === -n ? 0 : -n)
  const tapP2 = (n) => onSet(mem === n  ? 0 :  n)

  // Both cards: Row1=[5,4,3,2,1]  Row2=[6,7,8,9,10]
  // 1 is always closest to the 0 center.
  // P2's card (left) is rotated 180° so P2 reads the layout correctly from the top.
  const ROWS = [[5,4,3,2,1],[6,7,8,9,10]]
  const SZ   = 38   // circle px — as large as possible while fitting 5 per row

  const Card = ({ val, active, color, onTap, flip }) => (
    <div style={{
      flex: 1, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 5, padding: '8px 2px',
      background: active
        ? `linear-gradient(${flip ? '225deg' : '135deg'}, ${color}28, ${color}0C)`
        : 'transparent',
      transform: flip ? 'rotate(180deg)' : 'none',
      transition: 'background 0.3s',
    }}>
      {ROWS.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 4 }}>
          {row.map(n => {
            const on = active && val === n
            return (
              <button key={n} onPointerDown={() => onTap(n)} style={{
                width: SZ, height: SZ, borderRadius: '50%',
                background: on ? '#FFFFFF' : '#101010',
                border: on
                  ? `3px solid ${color}`
                  : `2px solid rgba(255,255,255,${active ? 0.18 : 0.08})`,
                color: on ? '#0A0A0A'
                  : active ? 'rgba(255,255,255,0.88)'
                  : 'rgba(255,255,255,0.22)',
                fontSize: n === 10 ? 12 : 16, fontWeight: 900,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif', lineHeight: 1,
                boxShadow: on ? `0 0 0 4px ${color}40, 0 0 20px ${color}70` : 'none',
                transform: on ? 'scale(1.14)' : 'scale(1)',
                transition: 'all 0.13s', touchAction: 'none',
              }}>{n}</button>
            )
          })}
        </div>
      ))}
      {/* Tiny label readable by the correct player */}
      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'Inter, sans-serif', marginTop: 1, color: active ? color : 'rgba(255,255,255,0.15)' }}>
        {flip ? 'P2' : 'P1'}{active && val > 0 ? ` · ${val}` : ''}
      </div>
    </div>
  )

  return (
    <div style={{
      flexShrink: 0, zIndex: 10, background: '#090909',
      borderTop: '2px solid #000', borderBottom: '2px solid #000',
      display: 'flex', flexDirection: 'row', alignItems: 'stretch',
    }}>
      {/* P2 card — LEFT, rotated 180° → P2 reads from top */}
      <Card val={p2Val} active={!isP1Turn} color={P2C} onTap={tapP2} flip={true} />

      {/* Center column — 0 unites both cards + back button */}
      <div style={{
        width: 42, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8,
        borderLeft: '1px solid #1C1C1C', borderRight: '1px solid #1C1C1C',
        background: '#060606',
      }}>
        <button onClick={onBack} style={{
          width: 30, height: 26, borderRadius: 7,
          background: 'transparent', border: '1px solid #222',
          color: '#4B5563', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>←</button>

        {/* 0 — same size as number circles */}
        <button onPointerDown={() => onSet(0)} style={{
          width: SZ, height: SZ, borderRadius: '50%',
          background: mem === 0 ? '#FFF' : '#101010',
          border: mem === 0 ? '3px solid #FFF' : '2px solid rgba(255,255,255,0.2)',
          color: mem === 0 ? '#0A0A0A' : 'rgba(255,255,255,0.4)',
          fontSize: 16, fontWeight: 900, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif', lineHeight: 1,
          boxShadow: mem === 0 ? '0 0 16px rgba(255,255,255,0.4)' : 'none',
          transition: 'all 0.13s', touchAction: 'none',
        }}>0</button>
      </div>

      {/* P1 card — RIGHT, normal → P1 reads from bottom */}
      <Card val={p1Val} active={isP1Turn}  color={P1C} onTap={tapP1} flip={false} />
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
function WLStep({ game, me, opponent, matchType, onResult, onBack, onUpdateOpponent }) {
  const isDigimon  = game === 'Digimon'
  const startSecs  = CLOCK_SECS[game] ?? 15 * 60
  const [meTime,   setMeTime]   = useState(startSecs)
  const [themTime, setThemTime] = useState(startSecs)
  const [active,   setActive]   = useState(null)   // null | 'me' | 'them'  (non-Digimon)
  const [mem,      setMem]      = useState(0)       // Digimon memory gauge: -10…0…10
  const [winner,   setWinner]   = useState(null)   // null | 'me' | 'them'
  const [holdPct,  setHoldPct]  = useState(0)      // 0–1 hold progress
  const [holdWho,  setHoldWho]  = useState(null)
  const [logging,  setLogging]  = useState(false)
  const [err,      setErr]      = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  // ── Reconocimiento de voz: "paso" / "paso turno" cambia el timer ──
  // Web Speech API del navegador (opt-in con el botón 🎤). El tap manual
  // sigue funcionando siempre; esto es un extra manos-libres.
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
  const [voiceOn,    setVoiceOn]    = useState(false)
  const [voiceHeard, setVoiceHeard] = useState(false)
  const [voiceErr,   setVoiceErr]   = useState('')
  const lastVoiceRef = useRef(0)
  const holdRef  = useRef(null)
  const rafRef   = useRef(null)
  const holdStart = useRef(0)
  const HOLD_MS  = 5000

  // Cancelar cualquier requestAnimationFrame en vuelo al desmontar (si la
  // pantalla se cierra mientras se mantiene presionado para ganar).
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // For Digimon: derive whose clock ticks from memory side.
  // mem <= 0 → P1's turn ('me'), mem > 0 → P2's turn ('them').
  // Game auto-starts the moment it loads (no tap needed to begin).
  const clockActive = isDigimon
    ? (winner ? null : (mem > 0 ? 'them' : 'me'))
    : active

  // Countdown tick — driven by clockActive
  useEffect(() => {
    if (!clockActive || winner) return
    const id = setInterval(() => {
      if (clockActive === 'me') {
        setMeTime(t => {
          if (t <= 1) { setWinner('them'); return 0 }
          return t - 1
        })
      } else {
        setThemTime(t => {
          if (t <= 1) { setWinner('me'); return 0 }
          return t - 1
        })
      }
    }, 1000)
    return () => clearInterval(id)
  }, [clockActive, winner])

  // Refs con el estado fresco para el callback de reconocimiento (closure)
  const activeRef = useRef(active); activeRef.current = active
  const winnerRef = useRef(winner); winnerRef.current = winner

  // Motor de voz: escucha continua; "paso" / "turno" → cambia el timer
  // (o lo ARRANCA si aún no corre ninguno). Solo juegos con reloj por
  // turnos (no Digimon: ahí el turno lo define el memory gauge).
  //
  // Robustez (fix): el auto-restart ahora tiene BACKOFF de 600ms — antes
  // reiniciaba en loop apretado cuando el servicio cortaba al instante
  // (típico iOS), congelando la UI y dejando el toggle "pegado". Si el
  // servicio termina 4 veces seguidas sin captar audio, asumimos que este
  // navegador no soporta voz → se apaga solo con un mensaje.
  useEffect(() => {
    if (!voiceOn || !SR || isDigimon) return
    let stopped = false
    let restartTimer = null
    let errTimer = null
    let gotAudio = false
    let rapidEnds = 0
    const rec = new SR()
    rec.lang = 'es-ES'
    rec.continuous = true
    rec.interimResults = true
    const showErr = (msg) => {
      setVoiceErr(msg)
      errTimer = setTimeout(() => setVoiceErr(''), 4000)
    }
    rec.onaudiostart = () => { gotAudio = true; rapidEnds = 0 }
    rec.onresult = (e) => {
      gotAudio = true
      let txt = ''
      for (let i = e.resultIndex; i < e.results.length; i++) txt += ' ' + (e.results[i][0]?.transcript || '')
      if (!/pas[oó]|turno/i.test(txt)) return
      const now = Date.now()
      if (now - lastVoiceRef.current < 2000) return   // debounce anti-doble
      if (winnerRef.current) return
      lastVoiceRef.current = now
      const cur = activeRef.current
      // Sin reloj corriendo → el comando ARRANCA la partida (turno mío);
      // con reloj corriendo → pasa el turno al otro.
      setActive(cur === null ? 'me' : (cur === 'me' ? 'them' : 'me'))
      navigator.vibrate?.(18)
      setVoiceHeard(true)
      setTimeout(() => setVoiceHeard(false), 900)
    }
    rec.onend = () => {
      if (stopped) return
      rapidEnds += 1
      if (rapidEnds >= 4 && !gotAudio) {
        // El servicio corta al toque sin captar nada → no disponible acá
        stopped = true
        setVoiceOn(false)
        showErr('La voz no está disponible en este navegador')
        return
      }
      restartTimer = setTimeout(() => { if (!stopped) { try { rec.start() } catch {} } }, 600)
    }
    rec.onerror = (ev) => {
      const code = ev?.error
      if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
        stopped = true
        setVoiceOn(false)
        showErr(code === 'not-allowed' ? 'Permití el micrófono para usar la voz' : 'La voz no está disponible en este navegador')
      }
    }
    try { rec.start() } catch { setVoiceOn(false) }
    return () => {
      stopped = true
      clearTimeout(restartTimer)
      clearTimeout(errTimer)
      try { rec.onend = null; rec.onresult = null; rec.onerror = null; (rec.abort || rec.stop).call(rec) } catch {}
    }
  }, [voiceOn, SR, isDigimon])

  // Vibrate when memory crosses sides (Digimon turn change)
  const prevMemSide = useRef(mem > 0 ? 'them' : 'me')
  useEffect(() => {
    if (!isDigimon) return
    const newSide = mem > 0 ? 'them' : 'me'
    if (newSide !== prevMemSide.current) {
      navigator.vibrate?.([30, 20, 60])
      prevMemSide.current = newSide
    }
  }, [mem, isDigimon])

  const stepMem = (dir) => {
    if (winner) return
    setMem(v => Math.max(-10, Math.min(10, v + dir)))
    navigator.vibrate?.(8)
  }
  // Direct absolute set for memory circles
  const setMemAbs = (v) => {
    if (winner) return
    setMem(Math.max(-10, Math.min(10, v)))
    navigator.vibrate?.(8)
  }

  // Digimon memory helpers (used inside ClockPanel via closure)
  const p1Val  = mem <= 0 ? Math.abs(mem) : 0
  const p2Val  = mem > 0  ? mem            : 0
  const tapP1  = (n) => setMemAbs(mem === -n ? 0 : -n)
  const tapP2  = (n) => setMemAbs(mem === n  ? 0 : n)

  // Tap: end YOUR turn → start OPPONENT's timer (non-Digimon only)
  const handleTap = (who) => {
    if (isDigimon || winner) return
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
    const isActive  = clockActive === who
    const isWinner  = winner === who
    const isLoser   = winner !== null && winner !== who
    const isHolding = holdWho === who
    const color     = who === 'me' ? PLAYER_COLORS[0] : PLAYER_COLORS[1]
    const low       = secs <= 60 && secs > 0
    const urgent    = secs <= 10 && secs > 0

    const bg = isWinner ? color
      : isLoser  ? `${color}22`
      : isActive ? `${color}bb`
      : `${color}40`

    const R = 38, CIRC = 2 * Math.PI * R
    const dash = isHolding ? CIRC * holdPct : 0

    return (
      <div
        onPointerDown={() => startHold(who)}
        onPointerUp={() => { cancelHold(); handleTap(who) }}
        onPointerLeave={cancelHold}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: bg, transition: 'background 0.35s',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', touchAction: 'none',
          transform: flipped ? 'rotate(180deg)' : 'none',
          userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        {/* Active pulse ring */}
        {isActive && !winner && (
          <div style={{ position: 'absolute', inset: 0, border: `3px solid ${color}`, animation: 'ringPulse 1.4s infinite', pointerEvents: 'none' }} />
        )}

        {/* Winner icon */}
        {isWinner && (
          <div style={{ animation: 'fadeUp 0.3s ease', pointerEvents: 'none' }}>
            {who === 'me' ? <MiddleFingerIcon size={64} /> : <div style={{ fontSize: 52, lineHeight: 1 }}>💀</div>}
          </div>
        )}

        {/* Center: avatar + name */}
        {!isWinner && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', border: `3px solid rgba(255,255,255,${isActive ? 0.65 : 0.22})`, background: 'rgba(0,0,0,0.4)', transition: 'border-color 0.3s' }}>
              <Avatar url={user?.avatar_url} size={52} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: `rgba(255,255,255,${isActive ? 0.95 : 0.45})`, fontFamily: 'Inter, sans-serif', transition: 'color 0.3s' }}>
              {user?.username ?? '…'}
            </span>
          </div>
        )}

        {/* Timer — left side */}
        {!isWinner && (
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <div style={{
              fontSize: 34, fontWeight: 900, fontFamily: 'Inter, sans-serif',
              letterSpacing: '-1px', lineHeight: 1,
              color: low ? '#FCA5A5' : `rgba(255,255,255,${isActive ? 1 : 0.38})`,
              animation: urgent && isActive ? 'pulse 0.8s infinite' : 'none',
              transition: 'color 0.3s',
            }}>{fmt(secs)}</div>
            {isActive && !winner && (
              <div style={{ fontSize: 8, fontWeight: 700, color, letterSpacing: '0.1em', marginTop: 3, fontFamily: 'Inter, sans-serif' }}>▶ TU TURNO</div>
            )}
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

        {/* Hint label (non-Digimon only) */}
        {!winner && !isDigimon && active === null && (
          <div style={{ position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', fontFamily: 'Inter, sans-serif' }}>
              TOCA AL TERMINAR TU TURNO
            </span>
          </div>
        )}
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

      {/* Voz "paso turno" — toggle flotante a la izquierda de la línea media.
          Verde pulsante = escuchando; flash cuando reconoce el comando. */}
      {!winner && !isDigimon && !!SR && (
        <button
          onClick={(e) => { e.stopPropagation(); setVoiceOn(v => !v) }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          title='Decí "paso" o "paso turno" para cambiar el timer'
          style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            zIndex: 30, display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 999, cursor: 'pointer',
            background: voiceHeard
              ? 'rgba(74,222,128,0.25)'
              : voiceOn ? 'rgba(74,222,128,0.14)' : 'rgba(20,20,28,0.92)',
            border: `1px solid ${voiceOn ? 'rgba(74,222,128,0.55)' : 'rgba(255,255,255,0.16)'}`,
            color: voiceOn ? '#4ADE80' : '#E5E7EB',
            fontSize: 12, fontWeight: 800, fontFamily: 'Inter, sans-serif',
            boxShadow: voiceOn ? '0 0 14px rgba(74,222,128,0.25)' : '0 4px 14px rgba(0,0,0,0.5)',
            animation: voiceOn && !voiceHeard ? 'pulse 1.6s ease-in-out infinite' : 'none',
            transition: 'background 0.2s, border 0.2s, color 0.2s',
          }}
        >
          🎤 {voiceHeard ? '¡Paso!' : voiceOn ? 'Escuchando' : 'Voz'}
        </button>
      )}

      {/* Aviso cuando la voz no está disponible / falta permiso */}
      {voiceErr && (
        <div style={{
          position: 'absolute', left: 12, top: 'calc(50% + 28px)', zIndex: 30,
          maxWidth: 'calc(100% - 24px)',
          padding: '7px 12px', borderRadius: 10,
          background: 'rgba(127,29,29,0.92)', border: '1px solid rgba(239,68,68,0.5)',
          color: '#FCA5A5', fontSize: 11, fontWeight: 700, fontFamily: 'Inter, sans-serif',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)', animation: 'fadeUp 0.25s ease',
        }}>
          {voiceErr}
        </div>
      )}

      {/* Agregar jugador — flotante sobre la línea del medio (solo si el
          rival aún es invitado/vacío) */}
      {!winner && (!opponent || opponent.isGuest) && (
        <button
          onClick={() => setPickerOpen(true)}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            zIndex: 30, display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 999, cursor: 'pointer',
            background: 'rgba(20,20,28,0.92)', border: '1px solid rgba(255,255,255,0.16)',
            color: '#E5E7EB', fontSize: 12, fontWeight: 800, fontFamily: 'Inter, sans-serif',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
          }}
        >
          👤 + Jugador
        </button>
      )}

      {pickerOpen && (
        <PlayerPickerSheet
          excludeIds={[me?.id]}
          onClose={() => setPickerOpen(false)}
          onPick={(u) => { onUpdateOpponent?.(0, u); setPickerOpen(false) }}
        />
      )}

      {/* Center divider */}
      {isDigimon ? (
        /* Digimon: slim bar — 0 reset circle + back button */
        <div style={{
          flexShrink: 0, height: 48, background: '#080808', zIndex: 10,
          borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
        }}>
          <button onClick={onBack} style={{
            width: 36, height: 32, borderRadius: 8, background: 'transparent',
            border: '1px solid #252525', color: '#555', fontSize: 14,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>←</button>

          {/* Mini position track */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {Array.from({ length: 21 }, (_, i) => i - 10).map(pos => {
              const on = pos === mem
              const c  = pos < 0 ? PLAYER_COLORS[0] : pos > 0 ? PLAYER_COLORS[1] : '#555'
              return <div key={pos} style={{
                width: on ? 9 : 5, height: on ? 9 : 5, borderRadius: '50%', flexShrink: 0,
                background: on ? c : 'rgba(255,255,255,0.08)',
                boxShadow: on ? `0 0 6px ${c}` : 'none',
                transition: 'all 0.12s',
              }} />
            })}
          </div>

          <button onPointerDown={() => setMemAbs(0)} style={{
            width: 36, height: 36, borderRadius: '50%',
            background: mem === 0 ? '#FFF' : '#141414',
            border: mem === 0 ? '2px solid #FFF' : '2px solid rgba(255,255,255,0.15)',
            color: mem === 0 ? '#111' : 'rgba(255,255,255,0.5)',
            fontSize: 14, fontWeight: 900, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', lineHeight: 1,
            boxShadow: mem === 0 ? '0 0 14px rgba(255,255,255,0.3)' : 'none',
            transition: 'all 0.12s',
          }}>0</button>
        </div>
      ) : (
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
      )}

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
function DoneScreen({ winner, me, opponent, onClose, onViewProfile, onRematch }) {
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

      {/* Opponent profile card — glass, tap to view their profile */}
      {hasRealOpponent && (
        <button
          onClick={() => onViewProfile?.(opponent.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 18px', borderRadius: 16,
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
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
              {opponent.username}
            </div>
            <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, marginTop: 2 }}>
              Ver win rate H2H →
            </div>
          </div>
        </button>
      )}

      {/* Action buttons — Rematch (Battle Now gradient) + Cerrar (glass) */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        width: '100%', maxWidth: 280, marginTop: 8,
      }}>
        {onRematch && (
          <button
            onClick={onRematch}
            className="pressable"
            style={{
              padding: '14px 24px', borderRadius: 14,
              background: 'linear-gradient(135deg, #FB923C 0%, #F472B6 60%, #A78BFA 130%)',
              border: 'none', color: '#FFFFFF',
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.01em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 10px 28px rgba(251,146,60,0.30), 0 4px 10px rgba(167,139,250,0.22), inset 0 1px 0 rgba(255,255,255,0.30)',
              textShadow: '0 1px 0 rgba(0,0,0,0.18)',
              transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <SwordIcon size={18} strokeWidth={2.3} color="#FFFFFF" />
            REVANCHA
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            padding: '13px 40px', borderRadius: 14,
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#FFFFFF',
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >Cerrar</button>
      </div>
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
export default function LifeCounterScreen({ onClose, onViewProfile, invite }) {
  const { profile, isOwner, isAdmin } = useAuth()
  const isAdminOrOwner = isOwner || isAdmin
  const [step,    setStep]   = useState('setup') // 'setup' | 'counter' | 'wl' | 'done'
  const [config,  setConfig] = useState(null)
  const [result,  setResult] = useState(null)

  // ── Wake lock — keep screen on during active game ──
  useEffect(() => {
    if (step !== 'counter' && step !== 'wl') return
    let lock = null
    let cancelled = false
    navigator.wakeLock?.request('screen')
      .then(l => { if (cancelled) l.release().catch(() => {}); else lock = l })
      .catch(() => {})
    return () => { cancelled = true; lock?.release().catch(() => {}) }
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

  // Asignar un usuario a un slot de oponente DESDE ADENTRO del counter/reloj
  // (PlayerPickerSheet). Actualiza config sin remontar el step (misma key),
  // así las vidas/tiempos en curso no se pierden.
  const handleUpdateOpponent = (slotIdx, user) => {
    setConfig(prev => {
      if (!prev) return prev
      const opponents = [...(prev.opponents ?? [prev.opponent])]
      opponents[slotIdx] = user
      return { ...prev, opponents, opponent: opponents[0] ?? null }
    })
  }

  const handleResult = (res) => {
    setResult(res)
    setStep('done')
  }

  // As a tab, the screen fills the main scroll area (flex child).
  // As a modal overlay (onClose provided), it covers everything absolutely.
  const isModal = !!onClose

  // Rematch — bump key so CounterStep / WLStep remount with fresh state,
  // and jump straight back into the play step keeping the same config.
  const [matchKey, setMatchKey] = useState(0)
  const handleRematch = () => {
    if (!config) return
    setResult(null)
    setMatchKey(k => k + 1)
    setStep(COUNTER_GAMES.has(config.game) ? 'counter' : 'wl')
  }

  return (
    <div style={isModal ? {
      position: 'absolute', inset: 0, zIndex: 200,
      // Translucent glass — deja ver el bg colorido del app detrás para
      // que la pantalla se sienta layered. backdrop-filter blurea los
      // posts/feed que están debajo cuando se abre como modal.
      background: 'rgba(10,10,18,0.72)',
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      animation: 'slideUp 0.22s ease',
    } : {
      // As a tab inside the nav: transparent so the app's radial
      // gradient background carries through and the cards inside read
      // as glass on top of the colored field.
      display: 'flex', flexDirection: 'column',
      background: 'transparent', minHeight: '100%',
    }}>

      {/* Header — only on setup and done. Glass bar + Sword icon, mismo
          tratamiento que el resto del redesign. */}
      {(step === 'setup' || step === 'done') && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px 12px', flexShrink: 0,
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}>
          {isModal
            ? <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 22, lineHeight: 1, padding: '0 2px' }}>‹</button>
            : <div style={{ width: 28 }} />
          }
          <div style={{
            fontSize: 17, fontWeight: 700, color: '#FFFFFF',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif',
            display: 'flex', alignItems: 'center', gap: 9,
            letterSpacing: '-0.015em',
          }}>
            <SwordIcon size={20} strokeWidth={2.2} color="#FFFFFF" />
            Life Counter
          </div>
        </div>
      )}

      {step === 'setup' && (
        <SetupStep profile={profile} invite={invite} resumeConfig={config} onStart={handleStart} />
      )}

      {step === 'counter' && config && (
        <CounterStep
          key={`counter-${matchKey}`}
          game={config.game}
          commander={config.commander}
          me={profile}
          opponents={config.opponents ?? [config.opponent]}
          playerCount={config.playerCount ?? 2}
          matchType={config.matchType}
          onResult={handleResult}
          onBack={() => setStep('setup')}
          onUpdateOpponent={handleUpdateOpponent}
        />
      )}

      {step === 'wl' && config && (
        <WLStep
          key={`wl-${matchKey}`}
          game={config.game}
          me={profile}
          opponent={config.opponent}
          matchType={config.matchType}
          onResult={handleResult}
          onBack={() => setStep('setup')}
          onUpdateOpponent={handleUpdateOpponent}
        />
      )}

      {step === 'done' && (
        <DoneScreen
          winner={result?.winner}
          me={profile}
          opponent={config?.opponent}
          onViewProfile={onViewProfile}
          onRematch={handleRematch}
          onClose={onClose ?? (() => { setStep('setup'); setConfig(null); setResult(null); setMatchKey(0) })}
        />
      )}
    </div>
  )
}
