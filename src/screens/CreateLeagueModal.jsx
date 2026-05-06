// ─────────────────────────────────────────────
// QUEST — CreateLeagueModal (staff only)
// ─────────────────────────────────────────────
import { useState } from 'react'
import { createLeague } from '../lib/supabase'
import { GAMES, GAME_STYLES, BRANCHES } from '../lib/constants'
import GameIcon from '../components/GameIcon'

export default function CreateLeagueModal({ onClose, defaultBranch }) {
  const [name,        setName]        = useState('')
  const [game,        setGame]        = useState(GAMES[0])
  const [branch,      setBranch]      = useState(defaultBranch ?? '')
  const [entryFee,    setEntryFee]    = useState('')
  const [maxPlayers,  setMaxPlayers]  = useState('')
  const [description, setDescription] = useState('')
  // fechas: each { date, start_time }
  const [fechas,      setFechas]      = useState([{ date: '', start_time: '' }])
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [done,        setDone]        = useState(false)

  const addFecha = () => setFechas(prev => [...prev, { date: '', start_time: '' }])
  const removeFecha = (i) => setFechas(prev => prev.filter((_, idx) => idx !== i))
  const updateFecha = (i, field, val) =>
    setFechas(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: val } : f))

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Ingresa el nombre de la liga'); return }
    if (!branch)      { setError('Seleccioná la sucursal'); return }

    setSaving(true); setError('')
    try {
      await createLeague({
        name: name.trim(),
        game,
        branch,
        entryFee: entryFee !== '' ? parseFloat(entryFee) : 0,
        maxPlayers: maxPlayers !== '' ? parseInt(maxPlayers) : 0,
        description: description.trim(),
        fechas: fechas.filter(f => f.date || f.start_time),
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
        <span style={{ fontSize: 16, fontWeight: 800, color: '#FFF' }}>Nueva Liga</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 32px' }}>
        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <div style={{ fontSize: 52 }}>🏅</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#4ADE80' }}>Liga creada</div>
            <div style={{ fontSize: 13, color: '#4B5563', textAlign: 'center' }}>Ya aparece en la sección de Ligas</div>
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
              <span style={labelStyle}>NOMBRE DE LA LIGA</span>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Ej: Liga Pokémon Temporada 1" style={inputStyle} />
            </div>

            {/* Descripción */}
            <div style={{ marginBottom: 14 }}>
              <span style={labelStyle}>DESCRIPCIÓN (opcional)</span>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Info adicional de la liga..."
                rows={2}
                style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
              />
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

            {/* Sucursal + Costo */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 2 }}>
                <span style={labelStyle}>SUCURSAL</span>
                <select value={branch} onChange={e => setBranch(e.target.value)} disabled={!!defaultBranch}
                  style={{ ...selectStyle, opacity: defaultBranch ? 0.6 : 1 }}>
                  <option value="" disabled>Seleccionar...</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>COSTO $</span>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                    color: '#4B5563', fontSize: 14, fontWeight: 600, pointerEvents: 'none',
                  }}>$</span>
                  <input type="number" min="0" step="0.01" value={entryFee}
                    onChange={e => setEntryFee(e.target.value)}
                    placeholder="0" style={{ ...inputStyle, paddingLeft: 26 }} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>MÁX.</span>
                <input type="number" min="2" value={maxPlayers}
                  onChange={e => setMaxPlayers(e.target.value)}
                  placeholder="∞" style={inputStyle} />
              </div>
            </div>

            {/* Fechas */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                <span style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>FECHAS</span>
                <button onClick={addFecha} style={{
                  fontSize: 11, fontWeight: 700, color: '#A78BFA',
                  background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)',
                  borderRadius: 7, padding: '3px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>+ Agregar</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fechas.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: '#1A1A1A', border: '1px solid #2A2A2A',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: '#6B7280', flexShrink: 0,
                    }}>{i + 1}</div>
                    <input type="date" value={f.date}
                      onChange={e => updateFecha(i, 'date', e.target.value)}
                      style={{ ...inputStyle, flex: 1.5, colorScheme: 'dark' }} />
                    <input type="time" value={f.start_time}
                      onChange={e => updateFecha(i, 'start_time', e.target.value)}
                      style={{ ...inputStyle, flex: 1, colorScheme: 'dark' }} />
                    {fechas.length > 1 && (
                      <button onClick={() => removeFecha(i)} style={{
                        background: 'none', border: 'none', color: '#4B5563',
                        fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
                        flexShrink: 0,
                      }}>×</button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#374151', marginTop: 6 }}>
                Podés agregar más fechas después desde la liga.
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
              {saving ? 'Creando...' : 'Crear liga'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
