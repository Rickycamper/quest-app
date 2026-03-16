// ─────────────────────────────────────────────
// QUEST — ClaimModal  (tournament result claim)
// Full-screen slide-up modal
// ─────────────────────────────────────────────
import { useState } from 'react'
import { submitClaim } from '../lib/supabase'
import { GAMES, GAME_STYLES, BRANCHES } from '../lib/constants'

const PTS    = { 1: 3, 2: 2, 3: 1 }
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function ClaimModal({ onClose, isStaff = false }) {
  const [tournamentName, setTournamentName] = useState('')
  const [game,           setGame]           = useState(GAMES[0])
  const [branch,         setBranch]         = useState('')
  const [position,       setPosition]       = useState(1)
  const [notes,          setNotes]          = useState('')
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')
  const [done,           setDone]           = useState(false)

  const pts = PTS[position]

  const handleSubmit = async () => {
    if (!tournamentName.trim()) { setError('Ingresa el nombre del torneo'); return }
    if (!branch)                { setError('Selecciona la sucursal del torneo'); return }
    setSaving(true); setError('')
    try {
      await submitClaim({ tournamentName: tournamentName.trim(), game, branch, position, notes: notes.trim() || null, autoApprove: isStaff })
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
    backgroundColorOnHack: '#111',
    paddingRight: 32,
  }
  const labelStyle = {
    fontSize: 10, fontWeight: 700, color: '#4B5563',
    letterSpacing: '0.08em', marginBottom: 6, display: 'block',
  }

  return (
    // Full-screen overlay — covers entire phone
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: '#0A0A0A',
      display: 'flex', flexDirection: 'column',
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
        <span style={{ fontSize: 16, fontWeight: 800, color: '#FFF' }}>Reportar resultado</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 24px' }}>
        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <div style={{ fontSize: 52 }}>{isStaff ? '🏆' : '✅'}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#4ADE80' }}>
              {isStaff ? 'Torneo registrado' : 'Claim enviado'}
            </div>
            <div style={{ fontSize: 13, color: '#4B5563', textAlign: 'center' }}>
              {isStaff ? 'Puntos acreditados automáticamente' : 'Los admins lo revisarán pronto y los puntos se acreditarán'}
            </div>
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

            {/* Torneo */}
            <div style={{ marginBottom: 14 }}>
              <span style={labelStyle}>TORNEO</span>
              <input value={tournamentName} onChange={e => setTournamentName(e.target.value)}
                placeholder="Nombre del torneo" style={inputStyle} />
            </div>

            {/* Sucursal + Juego */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>SUCURSAL</span>
                <select value={branch} onChange={e => setBranch(e.target.value)} style={selectStyle}>
                  <option value="" disabled>Seleccionar...</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>JUEGO</span>
                <select value={game} onChange={e => setGame(e.target.value)} style={selectStyle}>
                  {GAMES.map(g => <option key={g} value={g}>{GAME_STYLES[g].emoji} {g}</option>)}
                </select>
              </div>
            </div>

            {/* Posición */}
            <div style={{ marginBottom: 14 }}>
              <span style={labelStyle}>POSICIÓN</span>
              <div style={{ display: 'flex', gap: 10 }}>
                {[1, 2, 3].map(p => (
                  <button key={p} onClick={() => setPosition(p)} style={{
                    flex: 1, padding: '12px 6px', borderRadius: 10, cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', textAlign: 'center',
                    border: `1.5px solid ${position === p ? 'rgba(255,255,255,0.25)' : '#1F1F1F'}`,
                    background: position === p ? 'rgba(255,255,255,0.07)' : '#111',
                    color: position === p ? '#FFF' : '#4B5563',
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ fontSize: 22 }}>{MEDALS[p]}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                      {p === 1 ? '1er' : p === 2 ? '2do' : '3ro'}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 2, color: position === p ? '#A78BFA' : '#374151' }}>
                      +{PTS[p]} pts
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Evidencia */}
            <div style={{ marginBottom: 24 }}>
              <span style={labelStyle}>EVIDENCIA <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional)</span></span>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Link de foto, bracket, etc." style={inputStyle} />
            </div>

            <button onClick={handleSubmit} disabled={saving} style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: saving ? '#1A1A1A' : '#FFFFFF',
              color: saving ? '#555' : '#111',
              fontSize: 15, fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>
              {saving ? 'Enviando...' : isStaff ? `Registrar torneo (+${pts} pts)` : `Enviar claim (+${pts} pts pendientes)`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
