// ─────────────────────────────────────────────
// QUEST — CreateAuctionModal (staff/admin only)
// ─────────────────────────────────────────────
import { useState, useRef } from 'react'
import { createAuction, uploadAuctionImage } from '../lib/supabase'
import { GAMES, GAME_STYLES } from '../lib/constants'
import GameIcon from '../components/GameIcon'
import { useAuth } from '../context/AuthContext'

export default function CreateAuctionModal({ onClose, onCreated }) {
  const { profile } = useAuth()
  const [title,      setTitle]      = useState('')
  const [game,       setGame]       = useState(GAMES[0])
  const [minBid,     setMinBid]     = useState('')
  const [startDate,  setStartDate]  = useState(new Date().toISOString().slice(0, 10))
  const [startTime,  setStartTime]  = useState('')
  const [imageFile,  setImageFile]  = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [done,       setDone]       = useState(false)
  const fileRef = useRef()

  const handleImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!title.trim())             { setError('Ingresa un título'); return }
    if (!imageFile)                { setError('Sube una imagen'); return }
    if (!minBid || +minBid < 1)   { setError('Bid mínimo debe ser al menos $1'); return }
    if (!startDate || !startTime) { setError('Ingresa la fecha y hora de inicio'); return }

    const startISO = new Date(`${startDate}T${startTime}`).toISOString()
    if (new Date(startISO) <= new Date()) { setError('La hora de inicio debe ser en el futuro'); return }

    setSaving(true); setError('')
    try {
      const imageUrl = await uploadAuctionImage(imageFile, profile.id)
      await createAuction({ title: title.trim(), game, imageUrl, minBid: parseFloat(minBid), startTime: startISO })
      setDone(true)
    } catch (e) {
      setError(e.message || 'Error al crear la subasta')
    }
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
      position: 'absolute', inset: 0, zIndex: 200,
      background: '#0A0A0A', display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      animation: 'slideUp 0.22s ease',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '18px 18px 14px', borderBottom: '1px solid #1A1A1A', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6B7280', fontSize: 20, padding: '0 4px 0 0', lineHeight: 1,
        }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#FFF' }}>Nueva Subasta</span>
        <span style={{ fontSize: 12, color: '#4B5563', marginLeft: 'auto' }}>⏱ 5 min fijos</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 32px' }}>
        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 52 }}>🔨</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#4ADE80' }}>Subasta creada</div>
            <div style={{ fontSize: 13, color: '#4B5563' }}>Aparecerá en la lista de subastas</div>
            <button onClick={() => { onCreated?.(); onClose() }} style={{
              marginTop: 8, padding: '11px 32px', borderRadius: 10, border: 'none',
              background: '#FFFFFF', color: '#111', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>Cerrar</button>
          </div>
        ) : (
          <>
            {error && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, marginBottom: 16,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#F87171', fontSize: 13,
              }}>{error}</div>
            )}

            {/* Image upload */}
            <div style={{ marginBottom: 16 }}>
              <span style={labelStyle}>FOTO DE LA CARTA</span>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%', aspectRatio: '3/4', maxHeight: 220,
                  borderRadius: 12, border: `2px dashed ${imagePreview ? '#2A2A2A' : '#222'}`,
                  background: imagePreview ? 'transparent' : '#111',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', overflow: 'hidden', position: 'relative',
                }}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                    <div style={{ fontSize: 12, color: '#4B5563' }}>Toca para subir imagen</div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
            </div>

            {/* Title */}
            <div style={{ marginBottom: 14 }}>
              <span style={labelStyle}>NOMBRE DE LA CARTA / ITEM</span>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Ej: Black Lotus Unlimited" style={inputStyle} />
            </div>

            {/* TCG */}
            <div style={{ marginBottom: 14 }}>
              <span style={labelStyle}>TCG</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {GAMES.map(g => {
                  const s = GAME_STYLES[g]
                  const active = game === g
                  return (
                    <button key={g} onClick={() => setGame(g)} style={{
                      padding: '6px 12px', borderRadius: 8,
                      border: `1px solid ${active ? s.border : '#2A2A2A'}`,
                      background: active ? s.bg : 'transparent',
                      color: active ? s.color : '#4B5563',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}>
                      <GameIcon game={g} size={12} />{g}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Min bid */}
            <div style={{ marginBottom: 14 }}>
              <span style={labelStyle}>BID MÍNIMO (USD)</span>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                  color: '#4B5563', fontSize: 14, fontWeight: 700,
                }}>$</span>
                <input type="number" min="1" step="0.01" value={minBid}
                  onChange={e => setMinBid(e.target.value)}
                  placeholder="25.00"
                  style={{ ...inputStyle, paddingLeft: 26 }} />
              </div>
            </div>

            {/* Start date + time */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>FECHA DE INICIO</span>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>HORA DE INICIO</span>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>

            <button onClick={handleSubmit} disabled={saving} style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: saving ? '#1A1A1A' : '#FFFFFF',
              color: saving ? '#555' : '#111',
              fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>
              {saving ? 'Subiendo...' : '🔨 Programar subasta'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
