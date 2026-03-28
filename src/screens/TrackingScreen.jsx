// ─────────────────────────────────────────────
// QUEST — TrackingScreen
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { getMyPackages, getAllPackages, createPackage, updatePackageStatus, deletePackage, searchUsers, uploadPackageImage } from '../lib/supabase'
import { PKG_STATUS, PKG_STEPS, BRANCHES } from '../lib/constants'
import { CameraIcon } from '../components/Icons'

const sk = (w, h, r = 6) => ({
  width: w, height: h, borderRadius: r, flexShrink: 0, display: 'block',
  background: 'linear-gradient(90deg,#141414 25%,#222 50%,#141414 75%)',
  backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite linear',
})

// ── Minimalist SVG icons ───────────────────────
function PkgIcon({ status, size = 16, color = 'currentColor' }) {
  const p = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (status === 'received_origin') return (
    <svg {...p}>
      <path d="M13 5.5L8 3 3 5.5v5L8 13l5-2.5v-5z" />
      <path d="M3 5.5l5 2.5 5-2.5M8 8v5" />
    </svg>
  )
  if (status === 'in_transit') return (
    <svg {...p} strokeWidth={1.4}>
      <rect x="1.5" y="5" width="8.5" height="5.5" rx="1" />
      <path d="M10 7h3.5l1 2.5V10.5H10V7z" />
      <circle cx="4.5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
    </svg>
  )
  if (status === 'pending_arrival') return (
    <svg {...p}>
      <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5S12.5 9.5 12.5 6c0-2.5-2-4.5-4.5-4.5z" />
      <circle cx="8" cy="6" r="1.5" />
      <path d="M8 9v2" strokeDasharray="1 1" />
    </svg>
  )
  if (status === 'arrived') return (
    <svg {...p}>
      <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5S12.5 9.5 12.5 6c0-2.5-2-4.5-4.5-4.5z" />
      <circle cx="8" cy="6" r="1.5" />
    </svg>
  )
  if (status === 'delivered') return (
    <svg {...p} strokeWidth={2}>
      <path d="M3 8l3.5 3.5L13 5" />
    </svg>
  )
  // Fallback: box
  return (
    <svg {...p}>
      <rect x="2" y="5" width="12" height="9" rx="1" />
      <path d="M2 5l6-3 6 3" />
    </svg>
  )
}

function BoxIcon({ size = 36, color = '#444' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M26 10L16 5 6 10v12l10 5 10-5V10z" />
      <path d="M6 10l10 5 10-5M16 15v12" />
      <path d="M11 7.5L21 12.5" />
    </svg>
  )
}


// ── Progress stepper ──────────────────────────
function ProgressBar({ status }) {
  const step = PKG_STATUS[status]?.step ?? 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
      {PKG_STEPS.map((s, i) => {
        const cs   = PKG_STATUS[s]
        const done = i <= step
        const lineColor = done ? 'rgba(255,255,255,0.2)' : '#1A1A1A'
        return (
          <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <div style={{ flex: 1, height: 1, background: lineColor, transition: 'background 0.4s' }} />
            )}
            <div title={cs.label} style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: done ? 'rgba(255,255,255,0.08)' : '#0D0D0D',
              border: `1.5px solid ${done ? 'rgba(255,255,255,0.22)' : '#1F1F1F'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.4s',
            }}>
              <PkgIcon status={s} size={11} color={done ? '#FFFFFF' : '#2A2A2A'} />
            </div>
            {i < PKG_STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: i < step ? 'rgba(255,255,255,0.2)' : '#1A1A1A', transition: 'background 0.4s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step labels ───────────────────────────────
const STEP_LABELS = {
  pending_confirmation: 'Pendiente de aprobación',
  received_origin:      'Recibido en tienda',
  in_transit:           'En tránsito a sucursal',
  pending_arrival:      'Pendiente de confirmación',
  arrived:              'Llegó a sucursal destino',
  delivered:            'Retirado',
}

// ── Package card ──────────────────────────────
function PackageCard({ pkg, isStaff, onStatusUpdate, onDismiss, onDelete, currentUserId }) {
  const [expanded,   setExpanded]   = useState(false)
  const [advancing,  setAdvancing]  = useState(false)
  const [notes,      setNotes]      = useState('')
  const [showNotes,  setShowNotes]  = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [cardErr,    setCardErr]    = useState('')

  const handleAdminDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    setDeleting(true)
    setCardErr('')
    try {
      await deletePackage(pkg.id)
      onDelete?.(pkg.id)
    } catch (e) {
      setCardErr('Error al borrar: ' + (e.message || 'error desconocido'))
    }
    setDeleting(false)
    setConfirmDel(false)
  }

  const cs      = PKG_STATUS[pkg.status] ?? PKG_STATUS.pending_confirmation
  const nextKey = cs.adminNext
  const nextCs  = nextKey ? PKG_STATUS[nextKey] : null

  const isSender    = pkg.sender?.id    === currentUserId || pkg.sender_id    === currentUserId
  const isRecipient = pkg.recipient?.id === currentUserId || pkg.recipient_id === currentUserId

  const handleAdvance = async () => {
    if (!nextKey || advancing) return
    setAdvancing(true)
    setCardErr('')
    try {
      await onStatusUpdate(pkg.id, nextKey, notes)
      setNotes('')
      setShowNotes(false)
    } catch (e) {
      setCardErr(e.message || 'Error al actualizar el estado')
    }
    setAdvancing(false)
  }

  // Notify badge for arrived/delivered when you're sender or recipient
  const showAlert = (pkg.status === 'arrived' || pkg.status === 'delivered') && (isSender || isRecipient)

  return (
    <div style={{
      margin: '0 16px 12px',
      background: '#111111', borderRadius: 8,
      border: `1px solid ${showAlert ? cs.border : '#1F1F1F'}`,
      animation: 'fadeUp 0.3s ease both',
      overflow: 'hidden',
    }}>
      {/* Alert banner */}
      {showAlert && (
        <div style={{
          padding: '8px 16px',
          background: cs.bg,
          borderBottom: `1px solid ${cs.border}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <PkgIcon status={pkg.status} size={14} color={cs.color} />
          <span style={{ fontSize: 12, fontWeight: 700, color: cs.color, flex: 1 }}>
            {pkg.status === 'arrived'
              ? (isRecipient ? '¡Tu paquete llegó! Podés retirarlo.' : 'Paquete llegó a sucursal destino.')
              : '¡Paquete retirado exitosamente!'}
          </span>
          {pkg.status === 'delivered' && onDismiss && (
            <button
              onClick={async () => {
                onDismiss(pkg.id)
                // Best-effort DB delete for the user's own package
                deletePackage(pkg.id).catch(() => {})
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: cs.color, opacity: 0.7, fontSize: 16, lineHeight: 1,
                padding: '0 2px', flexShrink: 0,
              }}
              title="Cerrar"
            >✕</button>
          )}
        </div>
      )}

      {/* Card header */}
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '14px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PkgIcon status={pkg.status} size={18} color={cs.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.05em' }}>
                #{pkg.tracking_code}
              </span>
              <span style={{
                padding: '2px 8px', borderRadius: 6,
                background: cs.bg, border: `1px solid ${cs.border}`,
                color: cs.color, fontSize: 10, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <PkgIcon status={pkg.status} size={9} color={cs.color} />
                {cs.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
              {pkg.origin_branch} → {pkg.destination_branch}
            </div>
            <div style={{ fontSize: 11, color: '#374151' }}>
              De: <span style={{ color: '#9CA3AF' }}>@{pkg.sender?.username ?? '—'}</span>
              {'  ·  '}
              Para: <span style={{ color: '#9CA3AF' }}>@{pkg.recipient?.username ?? '—'}</span>
            </div>
          </div>
          <span style={{ color: '#374151', fontSize: 11, flexShrink: 0, marginTop: 2 }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
        <ProgressBar status={pkg.status} />
        {/* Step label row */}
        <div style={{ display: 'flex', marginTop: 6 }}>
          {PKG_STEPS.map((s, i) => {
            const done = i <= (cs.step ?? 0)
            return (
              <div key={s} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: done ? 'rgba(255,255,255,0.5)' : '#2A2A2A', fontWeight: 600, lineHeight: 1.2, padding: '0 2px' }}>
                {(STEP_LABELS[s] ?? s).split(' ').slice(0, 2).join(' ')}
              </div>
            )
          })}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #1A1A1A', padding: '12px 16px' }}>

          {/* Package photo */}
          {pkg.image_url && (
            <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', background: '#0A0A0A' }}>
              <img src={pkg.image_url} alt="Contenido del paquete"
                style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
            </div>
          )}

          {/* Items */}
          {pkg.package_items?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 6 }}>CONTENIDO</div>
              {pkg.package_items.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, color: '#9CA3AF', padding: '5px 0',
                  borderBottom: '1px solid #1A1A1A',
                }}>
                  <span>{item.item_name ?? item.name ?? item.description ?? '—'}</span>
                  <span style={{ color: '#4B5563' }}>× {item.quantity ?? item.qty ?? 1}</span>
                </div>
              ))}
            </div>
          )}

          {/* Timeline */}
          {pkg.package_events?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 8 }}>HISTORIAL</div>
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                {/* vertical line */}
                <div style={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 1, background: '#1F1F1F' }} />
                {[...pkg.package_events].reverse().map((ev, i) => {
                  const evCs = PKG_STATUS[ev.status] ?? PKG_STATUS.pending_confirmation
                  return (
                    <div key={i} style={{ position: 'relative', marginBottom: 10 }}>
                      <div style={{
                        position: 'absolute', left: -20, top: 3,
                        width: 14, height: 14, borderRadius: 4,
                        background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.15)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <PkgIcon status={ev.status} size={8} color={evCs.color} />
                      </div>
                      <div style={{ fontSize: 12, color: evCs.color, fontWeight: 700 }}>{evCs.label}</div>
                      {ev.notes && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{ev.notes}</div>}
                      <div style={{ fontSize: 10, color: '#374151', marginTop: 1 }}>
                        {new Date(ev.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Admin delete */}
          {isStaff && onDelete && (
            <div style={{ marginTop: nextKey ? 8 : 0, paddingTop: nextKey ? 8 : 0, borderTop: nextKey ? '1px solid #1A1A1A' : 'none' }}>
              <button
                onClick={handleAdminDelete}
                disabled={deleting}
                style={{
                  width: '100%', padding: '9px',
                  borderRadius: 8, border: `1px solid ${confirmDel ? 'rgba(239,68,68,0.4)' : '#2A2A2A'}`,
                  background: confirmDel ? 'rgba(239,68,68,0.1)' : 'transparent',
                  color: confirmDel ? '#F87171' : '#4B5563',
                  fontSize: 12, fontWeight: 700, cursor: deleting ? 'default' : 'pointer',
                  fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
                onBlur={() => setConfirmDel(false)}
              >
                {deleting ? '...' : confirmDel ? '¿Confirmar borrado?' : '🗑 Borrar paquete'}
              </button>
            </div>
          )}

          {/* Inline error */}
          {cardErr && (
            <div style={{ fontSize: 12, color: '#F87171', padding: '7px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', marginBottom: 8 }}>
              {cardErr}
            </div>
          )}

          {/* Admin action */}
          {isStaff && nextKey && nextCs && (
            <div>
              {showNotes ? (
                <div style={{ marginBottom: 8 }}>
                  <input
                    placeholder="Nota (opcional)..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8,
                      background: '#0A0A0A', border: '1px solid #2A2A2A',
                      color: '#FFF', fontSize: 12, fontFamily: 'Inter, sans-serif',
                      outline: 'none', boxSizing: 'border-box', marginBottom: 8,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowNotes(false)}
                      style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'transparent', border: '1px solid #2A2A2A', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      Cancelar
                    </button>
                    <button onClick={handleAdvance} disabled={advancing}
                      style={{ flex: 2, padding: '9px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: '#FFFFFF', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <PkgIcon status={nextKey} size={13} color="#FFF" />
                      {advancing ? '...' : cs.adminLabel}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowNotes(true)} style={{
                  width: '100%', padding: '11px',
                  borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.13)',
                  color: '#FFFFFF', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}>
                  <PkgIcon status={nextKey} size={14} color="#FFFFFF" />
                  {cs.adminLabel}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Image compressor (client-side, canvas) ────
function compressImage(file, { maxW = 1200, quality = 0.78 } = {}) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.naturalWidth, h = img.naturalHeight
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        if (blob) {
          resolve(new File([blob], (file.name || 'package').replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        } else {
          resolve(file)
        }
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ── Create package modal ──────────────────────
export function CreatePackageModal({ onClose, onCreated, currentUserId }) {
  const [origin,       setOrigin]      = useState('Panama')
  const [dest,         setDest]        = useState('David')
  const [recipQuery,   setRecipQuery]  = useState('')
  const [recipResult,  setRecipResult] = useState([])
  const [recipient,    setRecipient]   = useState(null)
  const [notes,        setNotes]       = useState('')
  const [items,        setItems]       = useState([{ name: '', qty: 1 }])
  const [imageFile,    setImageFile]   = useState(null)
  const [imagePreview, setImagePreview]= useState(null)
  const [uploading,    setUploading]   = useState(false)
  const [loading,      setLoading]     = useState(false)
  const [searching,    setSearching]   = useState(false)
  const [error,        setError]       = useState('')
  const searchTimer = useRef(null)
  const fileRef     = useRef(null)
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const handleImagePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImagePreview(URL.createObjectURL(file))
    setImageFile(file)
  }

  const handleRecipInput = (val) => {
    setRecipQuery(val)
    setRecipient(null)
    clearTimeout(searchTimer.current)
    if (val.length < 2) { setRecipResult([]); setSearching(false); return }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchUsers(val.replace('@', ''))
        setRecipResult((results ?? []).filter(u => u.id !== currentUserId))
      } catch { setRecipResult([]) }
      setSearching(false)
    }, 350)
  }

  const handleCreate = async () => {
    const validItems = items.filter(i => i.name.trim())
    setLoading(true); setError('')
    try {
      let imageUrl = null
      if (imageFile) {
        setUploading(true)
        const compressed = await compressImage(imageFile, { maxW: 1200, quality: 0.78 })
        imageUrl = await uploadPackageImage(compressed)
        setUploading(false)
      }
      const pkg = await createPackage({
        originBranch: origin,
        destinationBranch: dest,
        recipientId: recipient?.id ?? null,
        notes,
        items: validItems,
        imageUrl,
      })
      onCreated(pkg)
      onClose()
    } catch (e) { setError(e.message); setUploading(false) }
    setLoading(false)
  }

  const canCreate = recipient && notes.trim() && imageFile

  const inputStyle = {
    width: '100%', padding: '11px 14px', background: '#111111',
    border: '1.5px solid #2A2A2A', borderRadius: 10, color: '#FFFFFF',
    fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none',
    boxSizing: 'border-box',
  }
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: '#4B5563',
    letterSpacing: '0.08em', marginBottom: 8, display: 'block',
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, background: '#0A0A0A',
      zIndex: 200, display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      animation: 'slideUp 0.3s ease both',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #1F1F1F', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 15, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          Cancelar
        </button>
        <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter, sans-serif' }}>📦 Nuevo Envío</span>
        <button onClick={handleCreate} disabled={loading || !canCreate} style={{
          background: canCreate ? '#FFFFFF' : '#1F1F1F',
          border: 'none', color: canCreate ? '#111111' : '#4B5563',
          fontSize: 13, fontWeight: 700, cursor: canCreate ? 'pointer' : 'default',
          padding: '6px 14px', borderRadius: 8, fontFamily: 'Inter, sans-serif',
          transition: 'all 0.15s',
        }}>
          {uploading ? '...' : loading ? '...' : 'Crear'}
        </button>
      </div>

      {error && (
        <div style={{ margin: '12px 16px 0', padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13, flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>

        {/* ── FOTO (protagonista) ── */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={labelStyle}>
            FOTO DEL CONTENIDO <span style={{ color: '#EF4444' }}>*</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImagePick} style={{ display: 'none' }} />
          {imagePreview ? (
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '16/9' }}>
              <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null) }}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6,
                  color: '#FFFFFF', fontSize: 12, fontWeight: 700,
                  padding: '4px 8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>✕ Quitar</button>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                borderRadius: 10, border: '2px dashed rgba(239,68,68,0.35)',
                aspectRatio: '16/9', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
                cursor: 'pointer', background: 'rgba(239,68,68,0.04)',
              }}
            >
              <div style={{ color: '#EF4444' }}><CameraIcon size={28} /></div>
              <div style={{ fontSize: 13, color: '#EF4444', fontFamily: 'Inter, sans-serif' }}>
                Tocar para subir foto <span style={{ color: '#6B7280' }}>· Requerida</span>
              </div>
            </div>
          )}
        </div>

        {/* ── RUTA: origen → destino ── */}
        <div style={{ padding: '14px 16px 0', display: 'flex', gap: 8 }}>
          {[{ label: 'ORIGEN', val: origin, set: setOrigin }, { label: 'DESTINO', val: dest, set: setDest }].map(f => (
            <div key={f.label} style={{ flex: 1 }}>
              <div style={labelStyle}>{f.label}</div>
              <select value={f.val} onChange={e => f.set(e.target.value)}
                style={{ ...inputStyle, padding: '11px 10px' }}>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* ── DESTINATARIO ── */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={labelStyle}>DESTINATARIO <span style={{ color: '#EF4444' }}>*</span></div>
          {recipient ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#111111', border: '1.5px solid #2A2A2A', borderRadius: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1F1F1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>👤</div>
              <span style={{ flex: 1, fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>@{recipient.username}</span>
              <button onClick={() => { setRecipient(null); setRecipQuery('') }}
                style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <input
                  autoFocus
                  placeholder="Buscar @usuario..."
                  value={recipQuery}
                  onChange={e => handleRecipInput(e.target.value)}
                  style={inputStyle}
                />
                {searching && (
                  <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite' }} />
                  </div>
                )}
              </div>
              {recipResult.length > 0 && (
                <div style={{ background: '#111111', border: '1.5px solid #2A2A2A', borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
                  {recipResult.map(u => (
                    <button key={u.id}
                      onClick={() => { setRecipient(u); setRecipQuery(''); setRecipResult([]) }}
                      style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #1A1A1A', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1F1F1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>👤</div>
                      <span style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>@{u.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── OBSERVACIONES ── */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={labelStyle}>OBSERVACIONES <span style={{ color: '#EF4444' }}>*</span></div>
          <textarea
            placeholder="Descripción del contenido, condición, valor declarado..."
            value={notes}
            onChange={e => setNotes(e.target.value.slice(0, 400))}
            style={{
              ...inputStyle, resize: 'none', minHeight: 90,
              lineHeight: 1.5, padding: '12px 14px',
              borderColor: notes.trim() ? '#2A2A2A' : 'rgba(239,68,68,0.3)',
            }}
          />
        </div>

        {/* ── CARTAS / ITEMS (opcional) ── */}
        <div style={{ padding: '14px 16px 24px' }}>
          <div style={labelStyle}>CARTAS / ITEMS <span style={{ color: '#374151', fontWeight: 400, fontSize: 10 }}>(opcional)</span></div>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <input
                placeholder={`Carta o item ${i + 1}`}
                value={item.name}
                onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="number" min="1" value={item.qty}
                onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, qty: parseInt(e.target.value) || 1 } : x))}
                style={{ ...inputStyle, width: 52, padding: '11px 6px', textAlign: 'center' }}
              />
              {items.length > 1 && (
                <button onClick={() => setItems(p => p.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
              )}
            </div>
          ))}
          <button onClick={() => setItems(p => [...p, { name: '', qty: 1 }])}
            style={{ width: '100%', background: 'none', border: '1.5px dashed #2A2A2A', borderRadius: 10, color: '#4B5563', fontSize: 13, cursor: 'pointer', padding: '10px', fontFamily: 'Inter, sans-serif' }}>
            + Agregar item
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────
export default function TrackingScreen({ profile, isStaff, onNewPackage, refreshKey }) {
  const [packages,    setPackages]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [activeTab,   setActiveTab]   = useState('mine') // mine | all (staff)
  const dismissedIds = useRef(new Set())

  const load = () => {
    setLoading(true)
    const fn = (isStaff && activeTab === 'all') ? getAllPackages : getMyPackages
    fn()
      .then(data => setPackages(data.filter(p => !dismissedIds.current.has(p.id))))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [isStaff, activeTab, refreshKey])

  const handleStatusUpdate = async (pkgId, status, notes) => {
    await updatePackageStatus(pkgId, status, notes)
    if (status === 'delivered') {
      // Remove from list — data was deleted in DB
      setPackages(prev => prev.filter(p => p.id !== pkgId))
    } else {
      setPackages(prev => prev.map(p =>
        p.id !== pkgId ? p : {
          ...p,
          status,
          package_events: [
            ...(p.package_events || []),
            { status, created_at: new Date().toISOString(), notes, profiles: { username: profile?.username } },
          ],
        }
      ))
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Tabs (staff only) */}
        {isStaff ? (
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ id: 'mine', label: 'Mis paquetes' }, { id: 'all', label: 'Todos' }].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: activeTab === t.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: `1.5px solid ${activeTab === t.id ? 'rgba(255,255,255,0.2)' : '#2A2A2A'}`,
                color: activeTab === t.id ? '#FFFFFF' : '#4B5563',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>{t.label}</button>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: '#4B5563', fontWeight: 600 }}>
            {packages.length} paquete{packages.length !== 1 ? 's' : ''}
          </span>
        )}

        <button onClick={() => onNewPackage?.()} style={{
          padding: '7px 14px', background: '#FFFFFF', border: 'none',
          borderRadius: 8, color: '#111111', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>+ Nuevo</button>
      </div>

      {/* How it works banner */}
      <div style={{ margin: '0 16px 12px', padding: '10px 14px', background: '#111111', borderRadius: 8, border: '1px solid #1F1F1F' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 6 }}>CÓMO FUNCIONA</div>
        <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          {PKG_STEPS.map((s, i) => {
            const cs = PKG_STATUS[s]
            return (
              <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                {i > 0 && <div style={{ flex: 1, height: 1, background: '#1F1F1F' }} />}
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <PkgIcon status={s} size={16} color="#555555" />
                  </div>
                  <div style={{ fontSize: 8, color: '#4B5563', marginTop: 3, lineHeight: 1.2 }}>{STEP_LABELS[s].split(' ').slice(0,2).join(' ')}</div>
                </div>
                {i < PKG_STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: '#1F1F1F' }} />}
              </div>
            )
          })}
        </div>
      </div>

      {loading && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ borderRadius: 14, background: '#111', border: '1px solid #1A1A1A', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={sk(38, 38, 10)} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={sk('65%', 13, 5)} />
                  <span style={sk('80%', 11, 5)} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <span style={sk(68, 22, 5)} />
                    <span style={sk(90, 22, 5)} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ margin: '12px 16px', padding: '12px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && packages.length === 0 && (
        <div style={{ padding: '50px 20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <BoxIcon size={44} color="#333" />
          </div>
          <div style={{ fontSize: 15, color: '#4B5563', marginBottom: 6 }}>No hay paquetes activos</div>
          <div style={{ fontSize: 12, color: '#374151' }}>Tocá "+ Nuevo" para enviar cartas a otra sucursal</div>
        </div>
      )}

      {packages.map(pkg => (
        <PackageCard
          key={pkg.id}
          pkg={pkg}
          isStaff={isStaff}
          currentUserId={profile?.id}
          onStatusUpdate={handleStatusUpdate}
          onDismiss={(id) => {
            dismissedIds.current.add(id)
            setPackages(prev => prev.filter(p => p.id !== id))
          }}
          onDelete={isStaff ? (id) => {
            dismissedIds.current.add(id)
            setPackages(prev => prev.filter(p => p.id !== id))
          } : undefined}
        />
      ))}
    </div>
  )
}
