// ─────────────────────────────────────────────
// QUEST — LogMatchModal
// Bottom-sheet to log a Casual or Final duel.
// Only Finals post to the feed.
// Includes user search so you don't need to open a profile first.
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { logMatch, searchUsers } from '../lib/supabase'
import { GAMES, GAME_STYLES } from '../lib/constants'
import Avatar from '../components/Avatar'

export default function LogMatchModal({ opponent: preselected, onClose, onLogged }) {
  const { profile } = useAuth()

  // Opponent selection
  const [opponent,    setOpponent]   = useState(preselected ?? null)
  const [query,       setQuery]      = useState(preselected ? preselected.username : '')
  const [results,     setResults]    = useState([])
  const [searching,   setSearching]  = useState(false)
  const searchTimer = useRef(null)

  // Match config
  const [matchType, setMatchType] = useState('casual')   // 'casual' | 'final'
  const [game,      setGame]      = useState(GAMES[0])
  const [winner,    setWinner]    = useState('me')        // 'me' | 'them'
  const [notes,     setNotes]     = useState('')

  // Submit
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Live user search (debounced 300 ms)
  useEffect(() => {
    if (opponent) { setResults([]); return }        // already selected
    clearTimeout(searchTimer.current)
    if (query.trim().length < 2) { setResults([]); setSearching(false); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      setError('')
      try {
        const data = await searchUsers(query.trim())
        // Exclude yourself
        setResults((data ?? []).filter(u => u.id !== profile?.id))
      } catch (e) {
        console.error('User search error:', e)
        setError('Error al buscar jugadores')
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [query, opponent, profile?.id])

  const selectOpponent = (u) => {
    setOpponent(u)
    setQuery(u.username)
    setResults([])
    setError('')
  }

  const clearOpponent = () => {
    setOpponent(null)
    setQuery('')
    setResults([])
    setError('')
  }

  const handleSubmit = async () => {
    if (!opponent) { setError('Elige un oponente primero'); return }
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const winnerId = winner === 'me' ? profile.id : opponent.id
      await logMatch(opponent.id, winnerId, game, notes.trim() || null, matchType)
      onLogged?.()
      onClose()
    } catch (e) {
      setError(e.message || 'Error al registrar partida')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 120,
        display: 'flex', alignItems: 'flex-end',
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', background: '#111111',
        borderRadius: '20px 20px 0 0',
        border: '1px solid #222222',
        padding: '20px 20px 36px',
        display: 'flex', flexDirection: 'column', gap: 16,
        animation: 'slideUp 0.22s ease',
        maxHeight: '88vh', overflowY: 'auto', scrollbarWidth: 'none',
      }}>

        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333', margin: '0 auto -4px', flexShrink: 0 }} />

        {/* Title */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#FFFFFF', fontFamily: 'Inter, sans-serif' }}>⚔️ Registrar duelo</div>
        </div>

        {/* ── Opponent picker ── */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Oponente</Label>
          {opponent ? (
            /* Selected opponent chip */
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#1A1A1F', border: '1.5px solid rgba(74,222,128,0.3)',
              borderRadius: 10, padding: '8px 12px',
            }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: '#2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Avatar url={opponent.avatar_url} size={28} />
              </div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#FFFFFF', fontFamily: 'Inter, sans-serif' }}>@{opponent.username}</span>
              <button onClick={clearOpponent} style={{
                background: 'none', border: 'none', color: '#555', cursor: 'pointer',
                fontSize: 16, padding: '0 2px', lineHeight: 1,
              }}>✕</button>
            </div>
          ) : (
            /* Search input + inline results (not absolute — avoids overflow clipping) */
            <>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar jugador…"
                autoFocus
                style={{
                  width: '100%', background: '#1A1A1F',
                  border: '1.5px solid #2A2A2A', borderRadius: 10,
                  padding: '9px 12px', color: '#FFFFFF',
                  fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif',
                  boxSizing: 'border-box',
                }}
              />
              {/* Results list — inline so the modal scrolls to show them */}
              {searching && (
                <div style={{ padding: '8px 12px', fontSize: 12, color: '#555', fontFamily: 'Inter, sans-serif' }}>Buscando…</div>
              )}
              {!searching && results.length === 0 && query.trim().length >= 2 && (
                <div style={{ padding: '8px 12px', fontSize: 12, color: '#555', fontFamily: 'Inter, sans-serif' }}>Sin resultados</div>
              )}
              {results.length > 0 && (
                <div style={{ background: '#1A1A1F', border: '1px solid #2A2A2A', borderRadius: 10, overflow: 'hidden' }}>
                  {results.map((u, i) => (
                    <button key={u.id} onClick={() => selectOpponent(u)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', background: 'none', border: 'none',
                      borderBottom: i < results.length - 1 ? '1px solid #222' : 'none',
                      cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: '#2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Avatar url={u.avatar_url} size={28} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', fontFamily: 'Inter, sans-serif' }}>@{u.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Match type: Casual / Final ── */}
        <div style={{ flexShrink: 0 }}>
          <Label>Tipo de partida</Label>
          <div style={{ display: 'flex', gap: 8 }}>
            <TypeBtn active={matchType === 'casual'} onClick={() => setMatchType('casual')}
              color="#60A5FA" label="⚔️ Casual"
              desc="Solo H2H, no va al feed" />
            <TypeBtn active={matchType === 'final'} onClick={() => setMatchType('final')}
              color="#FB923C" label="🏆 Final"
              desc="Se publica en el feed si confirma" />
          </div>
        </div>

        {/* ── Game picker ── */}
        <div style={{ flexShrink: 0 }}>
          <Label>Juego</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GAMES.map(g => {
              const gs = GAME_STYLES[g]
              const active = game === g
              return (
                <button key={g} onClick={() => setGame(g)} style={{
                  padding: '6px 11px', borderRadius: 8, cursor: 'pointer',
                  background: active ? gs.bg : 'transparent',
                  border: `1.5px solid ${active ? gs.border : '#2A2A2A'}`,
                  color: active ? gs.color : '#555',
                  fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.15s',
                }}>
                  {gs.emoji} {g}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Winner ── */}
        <div style={{ flexShrink: 0 }}>
          <Label>¿Quién ganó?</Label>
          <div style={{ display: 'flex', gap: 8 }}>
            <WinnerBtn
              active={winner === 'me'} onClick={() => setWinner('me')}
              color="#4ADE80" bg="rgba(74,222,128,0.1)" border="rgba(74,222,128,0.4)"
              icon="🏆" line1="Yo gané" line2={`@${profile?.username}`}
            />
            <WinnerBtn
              active={winner === 'them'} onClick={() => setWinner('them')}
              color="#F87171" bg="rgba(248,113,113,0.1)" border="rgba(248,113,113,0.4)"
              icon="🛡️" line1={opponent ? `@${opponent.username}` : 'Él ganó'} line2="ganó"
            />
          </div>
        </div>

        {/* ── Notes ── */}
        <div style={{ flexShrink: 0 }}>
          <Label optional>Nota</Label>
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="ej. Mejor de 3, final del torneo…"
            maxLength={100}
            style={{
              width: '100%', background: '#1A1A1F',
              border: '1px solid #2A2A2A', borderRadius: 10,
              padding: '9px 12px', color: '#FFFFFF',
              fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif',
            }}
          />
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ fontSize: 12, color: '#F87171', fontFamily: 'Inter, sans-serif', textAlign: 'center', marginTop: -4 }}>
            {error}
          </div>
        )}

        {/* ── Submit ── */}
        <button
          onClick={handleSubmit}
          disabled={loading || !opponent}
          style={{
            padding: '13px 0', borderRadius: 12, flexShrink: 0,
            background: loading || !opponent ? '#1A1A1A' : '#FFFFFF',
            border: 'none', color: loading || !opponent ? '#555' : '#111111',
            fontSize: 14, fontWeight: 800,
            cursor: loading || !opponent ? 'default' : 'pointer',
            fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
          }}
        >
          {loading ? 'Enviando…' : matchType === 'final' ? '🏆 Enviar resultado final' : '⚔️ Enviar resultado casual'}
        </button>
      </div>
    </div>
  )
}

/* ── Small sub-components ─────────────────── */

function Label({ children, optional }) {
  return (
    <div style={{ fontSize: 10, color: '#6B7280', fontFamily: 'Inter, sans-serif', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
      {children}{optional && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4, color: '#444' }}>(opcional)</span>}
    </div>
  )
}

function TypeBtn({ active, onClick, color, label, desc }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '9px 8px', borderRadius: 10, cursor: 'pointer',
      background: active ? `${color}18` : 'transparent',
      border: `1.5px solid ${active ? color + '55' : '#2A2A2A'}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      transition: 'all 0.15s',
    }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: active ? color : '#555', fontFamily: 'Inter, sans-serif' }}>{label}</span>
      <span style={{ fontSize: 10, color: active ? color + 'AA' : '#444', fontFamily: 'Inter, sans-serif', lineHeight: 1.3 }}>{desc}</span>
    </button>
  )
}

function WinnerBtn({ active, onClick, color, bg, border, icon, line1, line2 }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '11px 8px', borderRadius: 10, cursor: 'pointer',
      background: active ? bg : 'transparent',
      border: `1.5px solid ${active ? border : '#2A2A2A'}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      transition: 'all 0.15s',
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: active ? color : '#555', fontFamily: 'Inter, sans-serif' }}>
        {line1}
      </span>
      <span style={{ fontSize: 11, color: active ? color + 'AA' : '#444', fontFamily: 'Inter, sans-serif' }}>
        {line2}
      </span>
    </button>
  )
}
