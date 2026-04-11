// ─────────────────────────────────────────────
// QUEST — CreateAuctionModal (staff/admin only)
// ─────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { createAuction, uploadAuctionImage, getAuctions } from '../lib/supabase'
import { GAMES, GAME_STYLES } from '../lib/constants'
import GameIcon from '../components/GameIcon'
import { useAuth } from '../context/AuthContext'

// ── Helpers ────────────────────────────────────
function snapTo5(time) {
  if (!time) return time
  const [h, m] = time.split(':').map(Number)
  const snapped = Math.round(m / 5) * 5
  if (snapped >= 60) return `${String(h + 1).padStart(2, '0')}:00`
  return `${String(h).padStart(2, '0')}:${String(snapped).padStart(2, '0')}`
}

function isSameSlot(isoA, isoB) {
  if (!isoA || !isoB) return false
  const a = new Date(isoA), b = new Date(isoB)
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()     &&
    a.getHours()    === b.getHours()    &&
    a.getMinutes()  === b.getMinutes()
}

function findNextFreeSlot(date, time, auctions) {
  if (!date || !time) return null
  let [h, m] = time.split(':').map(Number)
  // Start one slot ahead
  m += 5; if (m >= 60) { h += 1; m = 0 }
  for (let i = 0; i < 96; i++) {  // max 8 hours ahead
    const t = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    const iso = new Date(`${date}T${t}`).toISOString()
    const taken = auctions.some(a => a.status !== 'ended' && a.status !== 'cancelled' && isSameSlot(a.start_time, iso))
    if (!taken) return t
    m += 5; if (m >= 60) { h += 1; m = 0 }
    if (h >= 24) break
  }
  return null
}

function fmt12(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function CreateAuctionModal({ onClose, onCreated }) {
  const { profile } = useAuth()
  const [title,        setTitle]        = useState('')
  const [game,         setGame]         = useState(GAMES[0])
  const [minBid,       setMinBid]       = useState('')
  const [startDate,    setStartDate]    = useState(new Date().toISOString().slice(0, 10))
  const [startTime,    setStartTime]    = useState('')
  const [imageFile,    setImageFile]    = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [done,         setDone]         = useState(false)
  const [auctions,     setAuctions]     = useState([])
  const [conflict,     setConflict]     = useState(null)   // null | { nextFree: '8:05' | null }
  const fileRef = useRef()

  // Load existing auctions once for conflict detection
  useEffect(() => {
    getAuctions().then(setAuctions).catch(() => {})
  }, [])

  // Check conflict whenever date or time changes
  useEffect(() => {
    if (!startDate || !startTime) { setConflict(null); return }
    const iso = new Date(`${startDate}T${startTime}`).toISOString()
    const taken = auctions.some(a =>
      a.status !== 'ended' && a.status !== 'cancelled' && isSameSlot(a.start_time, iso)
    )
    if (taken) {
      setConflict({ nextFree: findNextFreeSlot(startDate, startTime, auctions) })
    } else {
      setConflict(null)
    }
  }, [startDate, startTime, auctions])

  const handleTimeChange = (raw) => {
    const snapped = snapTo5(raw)
    setStartTime(snapped)
  }

  const useNextFree = () => {
    if (conflict?.nextFree) setStartTime(conflict.nextFree)
  }

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
    if (conflict)                  { setError('Ese horario ya está ocupado'); return }

    const startISO = new Date(`${startDate}T${startTime}`).toISOString()
    if (new Date(startISO) <= new Date()) { setError('La hora de inicio debe ser en el futuro'); return }

    // Final minutes validation — must be multiple of 5
    const mins = new Date(startISO).getMinutes()
    if (mins % 5 !== 0) { setError('La hora debe ser en intervalos de 5 minutos'); return }

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
        {/* 5-min indicator */}
        <div style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)',
          borderRadius: 8, padding: '3px 9px',
        }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="#FB923C" strokeWidth="0">
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm.75 2.75v3.69l2.53 2.53-1.06 1.06-2.72-2.72V4.25h1.25z"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#FB923C' }}>Intervalos de 5 min</span>
        </div>
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

            {/* Start date + time — compact row */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Date */}
                <div style={{ flex: 1.1 }}>
                  <span style={labelStyle}>FECHA</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                      background: '#111', border: '1px solid #222', borderRadius: 10,
                      color: '#FFF', fontSize: 13, fontFamily: 'Inter, sans-serif',
                      outline: 'none', colorScheme: 'dark',
                    }}
                  />
                </div>
                {/* Time */}
                <div style={{ flex: 1 }}>
                  <span style={labelStyle}>HORA · 5 min</span>
                  <input
                    type="time"
                    step="300"
                    value={startTime}
                    onChange={e => handleTimeChange(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                      background: '#111', borderRadius: 10, colorScheme: 'dark',
                      color: '#FFF', fontSize: 13, fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                      border: conflict
                        ? '1.5px solid rgba(239,68,68,0.55)'
                        : startTime
                          ? '1.5px solid rgba(74,222,128,0.4)'
                          : '1px solid #222',
                      transition: 'border-color 0.15s',
                    }}
                  />
                </div>
              </div>

              {/* Status area — fixed height so layout never shifts */}
              <div style={{ minHeight: 28, marginTop: 6, display: 'flex', alignItems: 'center' }}>
                {conflict ? (
                  <div style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 8,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="#F87171" strokeWidth="0" style={{ flexShrink: 0 }}>
                      <path d="M5.55 4.57v1.47h4.9V4.57C10.45 3.22 9.35 2.12 8 2.12S5.55 3.22 5.55 4.57Zm-1.96 1.47V4.57C3.59 2.14 5.57.16 8 .16s4.41 1.98 4.41 4.41v1.47h.49c1.08 0 1.96.88 1.96 1.96v5.88c0 1.08-.88 1.96-1.96 1.96H3.1c-1.08 0-1.96-.88-1.96-1.96V8c0-1.08.88-1.96 1.96-1.96h.49Z"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#F87171', fontFamily: 'Inter, sans-serif' }}>
                      {fmt12(startTime)} ocupado
                      {conflict.nextFree ? ` · libre: ${fmt12(conflict.nextFree)}` : ''}
                    </span>
                    {conflict.nextFree && (
                      <button onClick={useNextFree} style={{
                        flexShrink: 0, padding: '3px 9px', borderRadius: 6, border: 'none',
                        background: 'rgba(74,222,128,0.12)', color: '#4ADE80',
                        fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      }}>
                        Usar {fmt12(conflict.nextFree)}
                      </button>
                    )}
                  </div>
                ) : startTime ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 2 }}>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="#4ADE80" strokeWidth="0">
                      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
                    </svg>
                    <span style={{ fontSize: 11, color: '#4ADE80', fontFamily: 'Inter, sans-serif' }}>
                      Disponible — {fmt12(startTime)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <button onClick={handleSubmit} disabled={saving || !!conflict} style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: (saving || conflict) ? '#1A1A1A' : '#FFFFFF',
              color: (saving || conflict) ? '#555' : '#111',
              fontSize: 15, fontWeight: 700,
              cursor: (saving || conflict) ? 'default' : 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>
              {saving ? 'Subiendo...' : conflict ? 'Elige otro horario' : '🔨 Programar subasta'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
