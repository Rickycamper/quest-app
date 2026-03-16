// ─────────────────────────────────────────────
// QUEST — CreatePostModal
// ─────────────────────────────────────────────
import { useState, useRef } from 'react'
import { createPost, uploadPostImage, addCard } from '../lib/supabase'
import { GAMES, GAME_STYLES } from '../lib/constants'
import { CameraIcon } from '../components/Icons'
import GameIcon from '../components/GameIcon'

// Compress + resize image to keep file size small without losing visible quality
async function compressImage(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image()
    const blobUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(blobUrl)
      let { width, height } = img

      // Scale down proportionally if needed
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height / width) * maxDim)
          width  = maxDim
        } else {
          width  = Math.round((width / height) * maxDim)
          height = maxDim
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file) } // fallback
    img.src = blobUrl
  })
}

const POST_TYPES = [
  { id: 'quiero', label: 'Quiero', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)'  },
  { id: 'tengo',  label: 'Tengo',  color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)'  },
  { id: 'tradeo', label: 'Tradeo', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
  { id: 'vendo',  label: 'Vendo',  color: '#4ADE80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.25)'  },
]

export default function CreatePostModal({ onClose }) {
  const [caption,   setCaption]   = useState('')
  const [game,      setGame]      = useState('MTG')
  const [postType,  setPostType]  = useState('quiero')
  const [isPrivate, setIsPrivate] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [limitReached, setLimitReached] = useState(false)
  const [alsoSave,  setAlsoSave]  = useState(false)
  const [cardName,  setCardName]  = useState('')
  const fileRef = useRef()

  const POST_TO_STATUS = { tengo: 'have', quiero: 'want', tradeo: 'trade', vendo: 'sell' }

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Show preview immediately while compression runs in background
    setImagePreview(URL.createObjectURL(file))
    const compressed = await compressImage(file)
    setImageFile(compressed)
  }

  const handleShare = async () => {
    if (!caption.trim()) return
    setLoading(true); setError('')

    // Safety timeout — if the whole operation takes > 30 s, unblock the UI
    const safetyTimer = setTimeout(() => {
      setLoading(false)
      setError('La publicación tardó demasiado. Revisá tu conexión e intentá de nuevo.')
    }, 30000)

    try {
      const pt = POST_TYPES.find(p => p.id === postType)
      const privTag = isPrivate ? ' [PRIVADO]' : ''
      const finalCaption = `[${pt.label}]${privTag} ${caption.trim()}`

      let imageUrl = null
      if (imageFile) {
        imageUrl = await uploadPostImage(imageFile)
      }

      await createPost({ caption: finalCaption, game, imageUrl })

      // Also save to folder if toggled
      if (alsoSave && cardName.trim()) {
        try {
          await addCard({
            name: cardName.trim(), game,
            cardStatus: POST_TO_STATUS[postType] ?? 'have',
            qty: 1, price: null, note: null, imageUrl,
          })
        } catch {} // post succeeded — folder error is non-fatal
      }

      clearTimeout(safetyTimer)
      onClose()
    } catch (e) {
      clearTimeout(safetyTimer)
      console.error('Error publicando post:', e)
      if (e?.message === 'POST_LIMIT_REACHED') {
        setLimitReached(true)
      } else {
        setError(e?.message || e?.error_description || JSON.stringify(e) || 'Error al publicar. Intentá de nuevo.')
      }
      setLoading(false)
    }
  }

  const pt = POST_TYPES.find(p => p.id === postType)

  return (
    <div style={{
      position: 'absolute', inset: 0, background: '#0A0A0A',
      zIndex: 200, display: 'flex', flexDirection: 'column',
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
        <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter, sans-serif' }}>Nuevo Post</span>
        <button onClick={handleShare} disabled={!caption.trim() || loading} style={{
          background: caption.trim() ? '#FFFFFF' : '#1F1F1F',
          border: 'none', color: caption.trim() ? '#111111' : '#4B5563',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          padding: '6px 14px', borderRadius: 8, fontFamily: 'Inter, sans-serif',
        }}>
          {loading ? '...' : 'Publicar'}
        </button>
      </div>

      {error && !limitReached && (
        <div style={{ margin: '12px 16px 0', padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13, flexShrink: 0 }}>{error}</div>
      )}

      {/* Limit reached — full body replacement */}
      {limitReached && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center', gap: 14 }}>
          <div style={{ fontSize: 56 }}>🏆</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#A78BFA' }}>Alcanzaste el límite</div>
          <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>
            Los usuarios free tienen hasta <span style={{ color: '#FFF', fontWeight: 700 }}>50 posts</span>.{'\n'}
            Para publicar sin límite, activá tu membresía en la tienda.
          </div>
          <div style={{
            marginTop: 8, padding: '16px 20px', borderRadius: 14,
            background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)',
            width: '100%',
          }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 4 }}>¿Ya sos miembro?</div>
            <div style={{ fontSize: 13, color: '#A78BFA', fontWeight: 600 }}>
              Avisale a un admin para que activen tu cuenta ✨
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', display: limitReached ? 'none' : undefined }}>

        {/* Post type */}
        <div style={{ padding: '14px 16px 6px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 8 }}>TIPO DE POST</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {POST_TYPES.map(p => {
              const active = postType === p.id
              return (
                <button key={p.id} onClick={() => setPostType(p.id)} style={{
                  padding: '7px 14px', borderRadius: 8, flexShrink: 0,
                  border: `1.5px solid ${active ? p.border : '#2A2A2A'}`,
                  background: active ? p.bg : 'transparent',
                  color: active ? p.color : '#4B5563',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.15s',
                }}>{p.label}</button>
              )
            })}
          </div>
        </div>

        {/* TCG selector */}
        <div style={{ padding: '10px 16px 6px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 8 }}>JUEGO</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {GAMES.map(g => {
              const gs = GAME_STYLES[g]
              const isActive = game === g
              return (
                <button key={g} onClick={() => setGame(g)} style={{
                  padding: '6px 14px', borderRadius: 8, flexShrink: 0,
                  border: `1.5px solid ${isActive ? gs.border : '#2A2A2A'}`,
                  background: isActive ? gs.bg : 'transparent',
                  color: isActive ? gs.color : '#4B5563',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                }}><GameIcon game={g} size={13} /> {g}</button>
              )
            })}
          </div>
        </div>

        {/* Visibility */}
        <div style={{ padding: '10px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 2 }}>VISIBILIDAD</div>
            <div style={{ fontSize: 12, color: isPrivate ? '#9CA3AF' : '#FFFFFF', fontWeight: 600 }}>
              {isPrivate ? '🔒 Privado — solo vos lo ves' : '🌐 Público — aparece en el feed'}
            </div>
          </div>
          {/* Toggle */}
          <div
            onClick={() => setIsPrivate(p => !p)}
            style={{
              width: 48, height: 26, borderRadius: 13,
              background: isPrivate ? '#374151' : '#FFFFFF',
              position: 'relative', cursor: 'pointer',
              transition: 'background 0.2s', flexShrink: 0,
              border: `1.5px solid ${isPrivate ? '#4B5563' : '#E5E7EB'}`,
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: isPrivate ? 2 : 22,
              width: 18, height: 18, borderRadius: '50%',
              background: isPrivate ? '#9CA3AF' : '#111111',
              transition: 'left 0.2s',
            }} />
          </div>
        </div>

        {/* Save to folder */}
        <div style={{ padding: '10px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 2 }}>GUARDAR EN COLECCIÓN</div>
            <div style={{ fontSize: 12, color: alsoSave ? '#FFFFFF' : '#4B5563', fontWeight: 600 }}>
              {alsoSave ? '📦 Se guardará en tu folder' : 'Solo publicar en el feed'}
            </div>
          </div>
          <div
            onClick={() => setAlsoSave(p => !p)}
            style={{
              width: 48, height: 26, borderRadius: 13,
              background: alsoSave ? '#FFFFFF' : '#374151',
              position: 'relative', cursor: 'pointer',
              transition: 'background 0.2s', flexShrink: 0,
              border: `1.5px solid ${alsoSave ? '#E5E7EB' : '#4B5563'}`,
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: alsoSave ? 22 : 2,
              width: 18, height: 18, borderRadius: '50%',
              background: alsoSave ? '#111111' : '#9CA3AF',
              transition: 'left 0.2s',
            }} />
          </div>
        </div>
        {alsoSave && (
          <div style={{ padding: '4px 16px 6px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 6 }}>NOMBRE DE LA CARTA</div>
            <input
              placeholder="Ej: Black Lotus, Charizard..."
              value={cardName}
              onChange={e => setCardName(e.target.value)}
              style={{
                width: '100%', padding: '11px 14px',
                background: '#111111', border: '1.5px solid #2A2A2A',
                borderRadius: 10, color: '#FFF', fontSize: 14,
                fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Image upload */}
        <div style={{ padding: '10px 16px 4px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 8 }}>FOTO</div>
          <input
            ref={fileRef} type="file" accept="image/*"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
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
                borderRadius: 10, border: '2px dashed #2A2A2A',
                aspectRatio: '16/9', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: 'pointer', background: '#111111',
              }}
            >
              <div style={{ color: '#4B5563' }}><CameraIcon size={24} /></div>
              <div style={{ fontSize: 13, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>
                Tocar para subir foto <span style={{ color: '#374151' }}>· Opcional</span>
              </div>
            </div>
          )}
        </div>

        {/* Caption */}
        <div style={{ padding: '10px 16px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 8 }}>DESCRIPCIÓN</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '3px 8px', borderRadius: 6,
              background: pt.bg, border: `1px solid ${pt.border}`,
              color: pt.color, fontSize: 11, fontWeight: 700,
            }}>{pt.label}</span>
            {isPrivate && (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '3px 8px', borderRadius: 6,
                background: 'rgba(75,85,99,0.2)', border: '1px solid rgba(75,85,99,0.4)',
                color: '#9CA3AF', fontSize: 11, fontWeight: 700,
              }}>🔒 Privado</span>
            )}
          </div>
          <textarea
            placeholder={
              postType === 'quiero' ? '¿Qué carta o producto estás buscando?' :
              postType === 'tengo'  ? '¿Qué tenés disponible?' :
              postType === 'tradeo' ? '¿Qué ofrecés y qué buscás a cambio?' :
              '¿Qué vendés? Precio, condición, set...'
            }
            value={caption} onChange={e => setCaption(e.target.value.slice(0, 500))}
            style={{
              width: '100%', background: '#111111',
              border: '1.5px solid #2A2A2A', borderRadius: 10,
              color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter, sans-serif',
              resize: 'none', outline: 'none', lineHeight: 1.6,
              minHeight: 100, padding: '12px 14px', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <span style={{
              fontSize: 11, fontFamily: 'Inter, sans-serif',
              color: caption.length >= 490 ? '#F87171' : caption.length >= 450 ? '#F59E0B' : '#374151',
            }}>{caption.length}/500</span>
          </div>
        </div>

      </div>
    </div>
  )
}
