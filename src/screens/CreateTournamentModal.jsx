// ─────────────────────────────────────────────
// QUEST — CreateTournamentModal (staff only)
// ─────────────────────────────────────────────
import { useState } from 'react'
import { createTournament } from '../lib/supabase'
import { GAMES, GAME_STYLES, BRANCHES } from '../lib/constants'
import GameIcon from '../components/GameIcon'

export default function CreateTournamentModal({ onClose, defaultBranch }) {
  const [name,        setName]        = useState('')
  const [game,        setGame]        = useState(GAMES[0])
  const [branch,      setBranch]      = useState(defaultBranch ?? '')
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10))
  const [playerCount, setPlayerCount] = useState('')
  const [startTime,   setStartTime]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [done,        setDone]        = useState(false)

  const handleSubmit = async () => {
    if (!name.trim())   { setError('Ingresa el nombre del torneo'); return }
    if (!branch)        { setError('Selecciona la sucursal'); return }
    if (!playerCount || isNaN(playerCount) || +playerCount < 2) { setError('Ingresa el número de jugadores'); return }

    setSaving(true); setError('')
    try {
      await createTournament({
        name: name.trim(), game, branch, date,
        playerCount: parseInt(playerCount),
        startTime: startTime || null,
      })
      setDone(true)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const inputStyle = {
    width: '100%', padding: '11px 13px',
    background: '#111', border: '1px solid #222',
    borderRadius: 10, color: '#FFF', fontSize: 14,
    fontFamily: 'Inter, sans-serif', outline: 'none',
  }
  const selectStyle = {
    ...inputStyle,
    appearance: 'none', WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%234B5563' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
    paddingRight: 32,
  }
  const labelStyle = {
    fontSize: 10, fontWeight: 700, color: '#4B5563',
    letterSpacing: '0.08em', marginBottom: 6, display: 'block',
  }

  const gs = GAME_STYLES[game] ?? GAME_STYLES['MTG']

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: '#0A0A0A',
      display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      animation: 'slideUp 0.22s ease',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '18px 18px 14px',
        borderBottom: '1px solid #1A1A1A',
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6B7280', fontSize: 20, padding: '0 4px 0 0', lineHeight: 1,
          fontFamily: 'Inter, sans-serif',
        }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#FFF' }}>Nuevo Torneo</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 24px' }}>
        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <div style={{ fontSize: 52 }}>🏆</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#4ADE80' }}>Torneo creado</div>
            <div style={{ fontSize: 13, color: '#4B5563', textAlign: 'center' }}>Ya aparece en la sección de torneos</div>
            <button onClick={onClose} style={{
              marginTop: 8, padding: '11px 32px', borderRadius: 10, border: 'none',
              background: '#FFFFFF', color: '#111', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>Cerrar</button>
          </div>
        ) : (
          <>
            {error && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, marginBottom: 14,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#F87171', fontSize: 13,
              }}>{error}</div>
            )}

            {/* Nombre */}
            <div style={{ marginBottom: 14 }}>
              <span style={labelStyle}>NOMBRE DEL TORNEO</span>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Ej: Pokémon League David #5" style={inputStyle} />
            </div>

            {/* Juego */}
            <div style={{ marginBottom: 14 }}>
              <span style={labelStyle}>JUEGO</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {GAMES.map(g => {
                  const s = GAME_STYLES[g]
                  const active = game === g
                  return (
                    <button key={g} onClick={() => setGame(g)} style={{
                      padding: '6px 12px', borderRadius: 8, flexShrink: 0,
                      border: `1px solid ${active ? s.border : '#2A2A2A'}`,
                      background: active ? s.bg : 'transparent',
                      color: active ? s.color : '#4B5563',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}>
                      <GameIcon game={g} size={12} />{g}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sucursal + Fecha */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>SUCURSAL</span>
                <select value={branch} onChange={e => setBranch(e.target.value)} disabled={!!defaultBranch} style={{ ...selectStyle, opacity: defaultBranch ? 0.6 : 1 }}>
                  <option value="" disabled>Seleccionar...</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>FECHA</span>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>

            {/* Jugadores + Hora */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>JUGADORES</span>
                <input type="number" min="2" value={playerCount} onChange={e => setPlayerCount(e.target.value)}
                  placeholder="12" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>HORA DE INICIO</span>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>

            <button onClick={handleSubmit} disabled={saving} style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: saving ? '#1A1A1A' : '#FFFFFF',
              color: saving ? '#555' : '#111',
              fontSize: 15, fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>
              {saving ? 'Creando...' : 'Crear torneo'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
