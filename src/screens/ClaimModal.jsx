// ─────────────────────────────────────────────
// QUEST — ClaimModal  (tournament result claim)
// Full-screen slide-up modal
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { submitClaim, getTournaments } from '../lib/supabase'
import { GAME_STYLES } from '../lib/constants'
import GameIcon from '../components/GameIcon'

const PTS    = { 1: 3, 2: 2, 3: 1 }
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function ClaimModal({ onClose, isStaff = false }) {
  // Step 1: pick tournament  |  Step 2: pick position
  const [step,       setStep]      = useState('pick')   // 'pick' | 'confirm'
  const [tournaments, setTournaments] = useState([])
  const [loadingT,   setLoadingT]  = useState(true)
  const [selected,   setSelected]  = useState(null)   // tournament object
  const [position,   setPosition]  = useState(1)
  const [notes,      setNotes]     = useState('')
  const [saving,     setSaving]    = useState(false)
  const [error,      setError]     = useState('')
  const [done,       setDone]      = useState(false)

  const pts = PTS[position]

  // Load past tournaments on mount — filter out ones with top 3 already filled
  useEffect(() => {
    getTournaments()
      .then(data => {
        const now = new Date()
        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
        const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000)
        const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`
        // Only past tournaments within 72h window + not yet fully claimed (< 3 approved results)
        const available = data.filter(t =>
          t.date <= todayStr &&
          t.date >= cutoffStr &&
          (t.tournament_results ?? []).length < 3
        )
        setTournaments(available)
      })
      .catch(() => {})
      .finally(() => setLoadingT(false))
  }, [])

  const handleSelect = (t) => {
    setSelected(t)
    setStep('confirm')
    setError('')
  }

  const handleBack = () => {
    setStep('pick')
    setSelected(null)
    setError('')
  }

  const handleSubmit = async () => {
    setSaving(true); setError('')
    try {
      await submitClaim({
        tournamentName: selected.name,
        tournamentId:   selected.id,
        game:           selected.game,
        branch:         selected.branch,
        position,
        notes: notes.trim() || null,
        autoApprove:    isStaff,
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
    boxSizing: 'border-box',
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
        <button
          onClick={step === 'confirm' ? handleBack : onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#6B7280', fontSize: 20, padding: '0 4px 0 0', lineHeight: 1,
            fontFamily: 'Inter, sans-serif',
          }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#FFF' }}>
          {step === 'pick' ? 'Torneos' : 'Reportar resultado'}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 24px' }}>
        {done ? (
          /* ── Success ── */
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

        ) : step === 'pick' ? (
          /* ── Step 1: pick tournament ── */
          <>
            {loadingT ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite' }} />
              </div>
            ) : tournaments.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🏆</div>
                <div style={{ fontSize: 15, color: '#4B5563' }}>No hay torneos disponibles</div>
                <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>Todos los torneos pasados ya tienen su top 3 registrado</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 13, color: '#4B5563', margin: '0 0 4px', fontFamily: 'Inter, sans-serif' }}>
                  Seleccioná el torneo en el que participaste:
                </p>
                {tournaments.map((t, i) => {
                  const gs = GAME_STYLES[t.game] ?? GAME_STYLES['MTG']
                  const dateStr = new Date(t.date + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
                  const resultCount = (t.tournament_results ?? []).length
                  const spotsLeft = 3 - resultCount

                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelect(t)}
                      style={{
                        width: '100%', padding: '14px', borderRadius: 12,
                        background: '#111', border: '1px solid #1F1F1F',
                        cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 12,
                        animation: 'fadeUp 0.2s ease both',
                        animationDelay: `${i * 0.04}s`,
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      {/* Game icon */}
                      <div style={{
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        background: gs.bg, border: `1px solid ${gs.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <GameIcon game={t.game} size={18} />
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 14, fontWeight: 700, color: '#FFF',
                          fontFamily: 'Inter, sans-serif',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{t.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <span style={{ fontSize: 11, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>{t.branch}</span>
                          <span style={{ fontSize: 10, color: '#374151' }}>·</span>
                          <span style={{ fontSize: 11, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>{dateStr}</span>
                        </div>
                      </div>

                      {/* Spots left badge */}
                      <div style={{
                        fontSize: 10, fontWeight: 700, flexShrink: 0,
                        padding: '3px 8px', borderRadius: 20,
                        background: spotsLeft === 3 ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
                        border: `1px solid ${spotsLeft === 3 ? 'rgba(74,222,128,0.25)' : 'rgba(251,191,36,0.25)'}`,
                        color: spotsLeft === 3 ? '#4ADE80' : '#FBB724',
                        fontFamily: 'Inter, sans-serif',
                      }}>
                        {spotsLeft === 3 ? '3 lugares' : `${spotsLeft} libre${spotsLeft !== 1 ? 's' : ''}`}
                      </div>

                      <span style={{ color: '#374151', fontSize: 14 }}>›</span>
                    </button>
                  )
                })}
              </div>
            )}
          </>

        ) : (
          /* ── Step 2: pick position + submit ── */
          <>
            {/* Selected tournament summary */}
            {selected && (() => {
              const gs = GAME_STYLES[selected.game] ?? GAME_STYLES['MTG']
              const takenPositions = (selected.tournament_results ?? []).map(r => r.position)
              const dateStr = new Date(selected.date + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
              return (
                <>
                  {/* Tournament recap pill */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10, marginBottom: 20,
                    background: '#111', border: `1px solid ${gs.border}`,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: gs.bg, border: `1px solid ${gs.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <GameIcon game={selected.game} size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</div>
                      <div style={{ fontSize: 11, color: '#4B5563', fontFamily: 'Inter, sans-serif', marginTop: 1 }}>{selected.branch} · {dateStr}</div>
                    </div>
                  </div>

                  {error && (
                    <div style={{
                      padding: '8px 12px', borderRadius: 8, marginBottom: 14,
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      color: '#F87171', fontSize: 13, fontFamily: 'Inter, sans-serif',
                    }}>{error}</div>
                  )}

                  {/* Position selector — disable already taken spots */}
                  <div style={{ marginBottom: 14 }}>
                    <span style={labelStyle}>TU POSICIÓN</span>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[1, 2, 3].map(p => {
                        const taken = takenPositions.includes(p)
                        const active = position === p && !taken
                        return (
                          <button key={p} onClick={() => !taken && setPosition(p)} style={{
                            flex: 1, padding: '12px 6px', borderRadius: 10,
                            cursor: taken ? 'default' : 'pointer',
                            fontFamily: 'Inter, sans-serif', textAlign: 'center',
                            border: `1.5px solid ${active ? 'rgba(255,255,255,0.25)' : taken ? '#1A1A1A' : '#1F1F1F'}`,
                            background: active ? 'rgba(255,255,255,0.07)' : taken ? 'rgba(255,255,255,0.02)' : '#111',
                            color: active ? '#FFF' : taken ? '#2A2A2A' : '#4B5563',
                            opacity: taken ? 0.5 : 1,
                            transition: 'all 0.15s',
                            position: 'relative',
                          }}>
                            <div style={{ fontSize: 22 }}>{taken ? '✗' : MEDALS[p]}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                              {p === 1 ? '1er' : p === 2 ? '2do' : '3ro'}
                            </div>
                            <div style={{ fontSize: 11, marginTop: 2, color: active ? '#A78BFA' : taken ? '#2A2A2A' : '#374151' }}>
                              {taken ? 'Tomado' : `+${PTS[p]} pts`}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Evidencia */}
                  <div style={{ marginBottom: 24 }}>
                    <span style={labelStyle}>EVIDENCIA <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional)</span></span>
                    <input value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Link de foto, bracket, etc." style={inputStyle} />
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={saving || takenPositions.includes(position)}
                    style={{
                      width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                      background: saving ? '#1A1A1A' : '#FFFFFF',
                      color: saving ? '#555' : '#111',
                      fontSize: 15, fontWeight: 700,
                      cursor: (saving || takenPositions.includes(position)) ? 'default' : 'pointer',
                      fontFamily: 'Inter, sans-serif',
                    }}>
                    {saving ? 'Enviando...' : isStaff ? `Registrar torneo (+${pts} pts)` : `Enviar claim (+${pts} pts pendientes)`}
                  </button>
                </>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}
