// ─────────────────────────────────────────────
// QUEST — CreatePostModal
// ─────────────────────────────────────────────
import { useState, useRef, useCallback } from 'react'
import { createPost, uploadPostImage, addCard } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { GAMES, GAME_STYLES } from '../lib/constants'
import { CameraIcon } from '../components/Icons'
import GameIcon from '../components/GameIcon'

const TARGET_RATIO = 4 / 5  // width / height — portrait, great for TCG cards

// Crop to 4:5 at the given position (0-100%) then compress
// fitMode=true → letterbox (full image + black bg). fitMode=false → crop to fill.
async function compressAndCrop(file, cropX, cropY, targetRatio = null, fitMode = false, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const blobUrl = URL.createObjectURL(file)

    // Safety: if the image never loads (e.g. HEIC on Android), reject after 10 s
    const timer = setTimeout(() => {
      URL.revokeObjectURL(blobUrl)
      reject(new Error('No se pudo procesar la imagen. Usa una foto en formato JPG o PNG.'))
    }, 10_000)

    img.onload = () => {
      clearTimeout(timer)
      URL.revokeObjectURL(blobUrl)
      const W = img.naturalWidth
      const H = img.naturalHeight
      const naturalRatio = W / H
      const TR = targetRatio ?? Math.max(naturalRatio, TARGET_RATIO)

      let canvasW, canvasH, drawX, drawY, drawW, drawH

      if (fitMode) {
        // Letterbox: canvas at target ratio, image scaled to fit inside centered
        if (naturalRatio >= TR) {
          canvasW = Math.min(W, maxDim)
          canvasH = Math.round(canvasW / TR)
        } else {
          canvasH = Math.min(H, maxDim)
          canvasW = Math.round(canvasH * TR)
        }
        const scale = Math.min(canvasW / W, canvasH / H)
        drawW = Math.round(W * scale)
        drawH = Math.round(H * scale)
        drawX = Math.round((canvasW - drawW) / 2)
        drawY = Math.round((canvasH - drawH) / 2)
      } else {
        // Crop to fill target ratio
        let srcX, srcY, srcW, srcH
        if (Math.abs(naturalRatio - TR) < 0.02) {
          srcX = 0; srcY = 0; srcW = W; srcH = H
        } else if (naturalRatio > TR) {
          srcH = H; srcW = Math.round(H * TR); srcY = 0
          srcX = Math.round((W - srcW) * (cropX / 100))
        } else {
          srcW = W; srcH = Math.round(W / TR); srcX = 0
          srcY = Math.round((H - srcH) * (cropY / 100))
        }
        canvasW = srcW; canvasH = srcH
        if (canvasW > maxDim || canvasH > maxDim) {
          const scale = maxDim / Math.max(canvasW, canvasH)
          canvasW = Math.round(canvasW * scale)
          canvasH = Math.round(canvasH * scale)
        }
        drawX = 0; drawY = 0; drawW = canvasW; drawH = canvasH

        const canvas = document.createElement('canvas')
        canvas.width = canvasW; canvas.height = canvasH
        canvas.getContext('2d').drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvasW, canvasH)
        canvas.toBlob(
          blob => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
          'image/jpeg', quality,
        )
        return
      }

      if (canvasW > maxDim || canvasH > maxDim) {
        const scale = maxDim / Math.max(canvasW, canvasH)
        canvasW = Math.round(canvasW * scale); canvasH = Math.round(canvasH * scale)
        drawW = Math.round(drawW * scale); drawH = Math.round(drawH * scale)
        drawX = Math.round(drawX * scale); drawY = Math.round(drawY * scale)
      }

      const canvas = document.createElement('canvas')
      canvas.width = canvasW; canvas.height = canvasH
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, canvasW, canvasH)
      ctx.drawImage(img, 0, 0, W, H, drawX, drawY, drawW, drawH)
      canvas.toBlob(
        blob => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', quality,
      )
    }
    img.onerror = () => {
      clearTimeout(timer)
      URL.revokeObjectURL(blobUrl)
      reject(new Error('No se pudo leer la imagen. Usa una foto en formato JPG o PNG.'))
    }
    img.src = blobUrl
  })
}

const POST_TYPES = [
  { id: 'quiero', label: 'Compro', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)'  },
  { id: 'tengo',  label: 'Tengo',  color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)'  },
  { id: 'tradeo', label: 'Tradeo', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
  { id: 'vendo',  label: 'Vendo',  color: '#4ADE80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.25)'  },
]

const VIDEO_EXTS = /\.(mp4|mov|webm|avi|mkv)$/i
const isVideoFile = (f) => f.type?.startsWith('video/') || VIDEO_EXTS.test(f.name)
const MAX_VIDEO_MB = 100

export default function CreatePostModal({ onClose }) {
  const toast = useToast()
  const [caption,      setCaption]      = useState('')
  const [game,         setGame]         = useState(null)
  const [postType,     setPostType]     = useState(null)
  const [isPrivate,    setIsPrivate]    = useState(false)
  const [images,       setImages]       = useState([])  // [{ file, preview, cropPos, nW, nH }]
  const [video,        setVideo]        = useState(null) // { file, preview } — mutually exclusive with images
  const [activeImg,    setActiveImg]    = useState(0)
  const [showHint,     setShowHint]     = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [limitReached, setLimitReached] = useState(false)
  const [alsoSave,     setAlsoSave]     = useState(false)
  const [cardName,     setCardName]     = useState('')

  const fileRef  = useRef()
  const videoRef = useRef()
  const cropRef  = useRef()
  const lastDrag = useRef(null)

  const POST_TO_STATUS = { tengo: 'have', quiero: 'want', tradeo: 'trade', vendo: 'sell' }

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    // Block HEIC/HEIF — canvas can't convert them on most browsers
    const heic = files.find(f => /heic|heif/i.test(f.type) || /\.heic$|\.heif$/i.test(f.name))
    if (heic) {
      setError('Formato no compatible. Abre la foto en tu galería y compártela como JPG.')
      e.target.value = ''
      return
    }
    const remaining = 10 - images.length
    const toAdd = files.slice(0, remaining)
    const newImgs = toAdd.map(file => ({ file, preview: URL.createObjectURL(file), cropPos: { x: 50, y: 50 }, nW: 1, nH: 1, targetRatio: TARGET_RATIO, fitMode: false }))
    const startIdx = images.length
    setImages(prev => [...prev, ...newImgs])
    setActiveImg(startIdx)
    setShowHint(true)
    e.target.value = ''
  }

  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`El video supera los ${MAX_VIDEO_MB} MB. Subí un video más corto.`)
      e.target.value = ''
      return
    }
    setError('')
    setImages([])   // videos y fotos son mutuamente exclusivos
    setVideo({ file, preview: URL.createObjectURL(file) })
    e.target.value = ''
  }

  const removeVideo = () => {
    if (video?.preview) URL.revokeObjectURL(video.preview)
    setVideo(null)
  }

  const handleImgLoad = (e) => {
    const nW = e.target.naturalWidth
    const nH = e.target.naturalHeight
    // Portrait (cartas, ratio < 0.85) → ratio natural sin crop | todo lo demás → 1:1
    const naturalRatio = nW / nH
    const targetRatio = naturalRatio < 0.85 ? naturalRatio : 1
    setImages(prev => prev.map((img, i) => i === activeImg ? { ...img, nW, nH, targetRatio } : img))
  }

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index))
    setActiveImg(prev => Math.min(prev, Math.max(0, images.length - 2)))
  }

  // Drag handlers — move the crop window
  const startDrag = (e) => {
    setShowHint(false)
    const touch = e.touches?.[0] ?? e
    lastDrag.current = { x: touch.clientX, y: touch.clientY }
  }

  const moveDrag = (e) => {
    if (!lastDrag.current) return
    e.preventDefault()
    const touch = e.touches?.[0] ?? e
    const dx = touch.clientX - lastDrag.current.x
    const dy = touch.clientY - lastDrag.current.y
    lastDrag.current = { x: touch.clientX, y: touch.clientY }

    const container = cropRef.current
    if (!container) return
    const cW = container.offsetWidth
    const cH = container.offsetHeight

    setImages(prev => prev.map((img, i) => {
      if (i !== activeImg) return img
      const imgRatio = img.nW / img.nH
      const pos = img.cropPos
      if (imgRatio > TARGET_RATIO) {
        const overflow = cH * imgRatio - cW
        if (overflow <= 0) return img
        return { ...img, cropPos: { x: Math.max(0, Math.min(100, pos.x - (dx / overflow) * 100)), y: pos.y } }
      } else {
        const overflow = (cW / imgRatio) - cH
        if (overflow <= 0) return img
        return { ...img, cropPos: { x: pos.x, y: Math.max(0, Math.min(100, pos.y - (dy / overflow) * 100)) } }
      }
    }))
  }

  const endDrag = () => { lastDrag.current = null }

  const handleShare = async () => {
    if (!caption.trim()) return
    setLoading(true); setError('')

    const safetyTimer = setTimeout(() => {
      setLoading(false)
      setError('La publicación tardó demasiado. Revisá tu conexión e intentá de nuevo.')
    }, 30000)

    try {
      const pt = POST_TYPES.find(p => p.id === postType)
      const typePrefix = pt ? `[${pt.label}] ` : ''
      const privTag = isPrivate ? '[PRIVADO] ' : ''
      const finalCaption = `${typePrefix}${privTag}${caption.trim()}`

      let imageUrls = []
      if (video) {
        // Upload video directly — no compression
        imageUrls = [await uploadPostImage(video.file)]
      } else if (images.length > 0) {
        const croppedFiles = await Promise.all(
          images.map(img => compressAndCrop(img.file, img.cropPos.x, img.cropPos.y, img.targetRatio, img.fitMode))
        )
        imageUrls = await Promise.all(croppedFiles.map(f => uploadPostImage(f)))
      }

      await createPost({ caption: finalCaption, game: game ?? null, imageUrls })

      if (alsoSave && cardName.trim()) {
        try {
          await addCard({
            name: cardName.trim(), game,
            cardStatus: POST_TO_STATUS[postType] ?? 'have',
            qty: 1, price: null, note: null, imageUrl: imageUrls[0] ?? null,
          })
        } catch {}
      }

      clearTimeout(safetyTimer)
      toast('¡Publicación creada!', { type: 'success' })
      onClose()
    } catch (e) {
      clearTimeout(safetyTimer)
      if (e?.message === 'POST_LIMIT_REACHED') {
        setLimitReached(true)
      } else {
        setError(e?.message || 'Error al publicar. Intentá de nuevo.')
        toast(e?.message || 'Error al publicar', { type: 'error' })
      }
      setLoading(false)
    }
  }

  const pt = POST_TYPES.find(p => p.id === postType)

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

      {limitReached && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center', gap: 14 }}>
          <div style={{ fontSize: 56 }}>🏆</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#A78BFA' }}>Alcanzaste el límite</div>
          <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>
            Los usuarios free tienen hasta <span style={{ color: '#FFF', fontWeight: 700 }}>50 posts</span>.{'\n'}
            Para publicar sin límite, activá tu membresía en la tienda.
          </div>
          <div style={{ marginTop: 8, padding: '16px 20px', borderRadius: 14, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', width: '100%' }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 4 }}>¿Ya sos miembro?</div>
            <div style={{ fontSize: 13, color: '#A78BFA', fontWeight: 600 }}>Avisale a un admin para que activen tu cuenta ✨</div>
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
                <button key={p.id}
                  onClick={() => setPostType(prev => prev === p.id ? null : p.id)}
                  style={{
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
                <button key={g} onClick={() => setGame(prev => prev === g ? null : g)} style={{
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
          <div onClick={() => setIsPrivate(p => !p)} style={{
            width: 48, height: 26, borderRadius: 13,
            background: isPrivate ? '#374151' : '#FFFFFF',
            position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
            border: `1.5px solid ${isPrivate ? '#4B5563' : '#E5E7EB'}`,
          }}>
            <div style={{ position: 'absolute', top: 2, left: isPrivate ? 2 : 22, width: 18, height: 18, borderRadius: '50%', background: isPrivate ? '#9CA3AF' : '#111111', transition: 'left 0.2s' }} />
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
          <div onClick={() => setAlsoSave(p => !p)} style={{
            width: 48, height: 26, borderRadius: 13,
            background: alsoSave ? '#FFFFFF' : '#374151',
            position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
            border: `1.5px solid ${alsoSave ? '#E5E7EB' : '#4B5563'}`,
          }}>
            <div style={{ position: 'absolute', top: 2, left: alsoSave ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: alsoSave ? '#111111' : '#9CA3AF', transition: 'left 0.2s' }} />
          </div>
        </div>
        {alsoSave && (
          <div style={{ padding: '4px 16px 6px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 6 }}>NOMBRE DE LA CARTA</div>
            <input
              placeholder="Ej: Black Lotus, Charizard..."
              value={cardName} onChange={e => setCardName(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', background: '#111111', border: '1.5px solid #2A2A2A', borderRadius: 10, color: '#FFF', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        )}

        {/* Image / Video upload */}
        <div style={{ padding: '10px 16px 4px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              {video ? 'VIDEO' : 'FOTOS'}
              {images.length > 0 && <span style={{ color: '#374151', fontWeight: 400 }}> ({images.length}/10)</span>}
            </span>
            {/* Toggle between foto/video mode when nothing selected */}
            {!video && images.length === 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => fileRef.current?.click()} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: '1px solid #2A2A2A', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>📷 Foto</button>
                <button onClick={() => videoRef.current?.click()} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: '1px solid #2A2A2A', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>🎬 Video</button>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: 'none' }} />
          <input ref={videoRef} type="file" accept="video/*" onChange={handleVideoSelect} style={{ display: 'none' }} />

          {video ? (
            /* ── Video preview ── */
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
              <video
                src={video.preview}
                controls
                playsInline
                style={{ width: '100%', maxHeight: 420, display: 'block', objectFit: 'contain' }}
              />
              <button
                onClick={removeVideo}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
                  width: 28, height: 28, color: '#FFF', fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              <div style={{
                position: 'absolute', bottom: 8, left: 8,
                background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '3px 10px',
                fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter, sans-serif',
              }}>
                {(video.file.size / (1024 * 1024)).toFixed(1)} MB
              </div>
            </div>
          ) : images.length > 0 ? (
            <div>
              {/* 4:5 crop preview for active image */}
              <div
                ref={cropRef}
                style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: String(images[activeImg]?.targetRatio ?? TARGET_RATIO), touchAction: 'none', cursor: 'grab' }}
                onMouseDown={startDrag}
                onMouseMove={moveDrag}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
                onTouchStart={startDrag}
                onTouchMove={moveDrag}
                onTouchEnd={endDrag}
              >
                <img
                  key={activeImg}
                  src={images[activeImg]?.preview} alt=""
                  onLoad={handleImgLoad}
                  style={{
                    width: '100%', height: '100%', pointerEvents: 'none', userSelect: 'none',
                    objectFit: images[activeImg]?.fitMode ? 'contain' : 'cover',
                    objectPosition: images[activeImg]?.fitMode ? 'center' : `${images[activeImg]?.cropPos.x ?? 50}% ${images[activeImg]?.cropPos.y ?? 50}%`,
                    background: images[activeImg]?.fitMode ? '#000' : 'transparent',
                  }}
                />
                {/* Fit / Fill toggle */}
                <button
                  onClick={e => { e.stopPropagation(); setImages(prev => prev.map((im, i) => i === activeImg ? { ...im, fitMode: !im.fitMode } : im)) }}
                  style={{
                    position: 'absolute', bottom: 10, left: 10,
                    background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 20,
                    color: '#FFF', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    padding: '5px 11px', fontFamily: 'Inter, sans-serif',
                  }}>
                  {images[activeImg]?.fitMode ? '⊞ Llenar' : '⊡ Ajustar'}
                </button>
                {showHint && !images[activeImg]?.fitMode && (
                  <div style={{
                    position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.65)', borderRadius: 20, padding: '5px 12px',
                    fontSize: 11, color: '#E5E7EB', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}>
                    ✥ Arrastrá para ajustar
                  </div>
                )}
                {/* Slide counter */}
                {images.length > 1 && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: '3px 9px',
                    fontSize: 11, color: '#FFF', fontWeight: 700, fontFamily: 'Inter, sans-serif',
                  }}>{activeImg + 1}/{images.length}</div>
                )}
              </div>

              {/* Thumbnail strip */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {images.map((img, i) => (
                  <div key={i} onClick={() => setActiveImg(i)} style={{
                    position: 'relative', flexShrink: 0, width: 58, aspectRatio: '4/5',
                    borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                    outline: `2px solid ${i === activeImg ? '#FFFFFF' : 'transparent'}`,
                    outlineOffset: 1,
                  }}>
                    <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${img.cropPos.x}% ${img.cropPos.y}%`, pointerEvents: 'none' }} />
                    <button
                      onClick={e => { e.stopPropagation(); removeImage(i) }}
                      style={{
                        position: 'absolute', top: 3, right: 3,
                        background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
                        width: 17, height: 17, color: '#FFF', fontSize: 9, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>✕</button>
                  </div>
                ))}
                {images.length < 10 && (
                  <div onClick={() => fileRef.current?.click()} style={{
                    flexShrink: 0, width: 58, aspectRatio: '4/5', borderRadius: 8,
                    border: '2px dashed #2A2A2A', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', background: '#111',
                  }}>
                    <span style={{ color: '#4B5563', fontSize: 22, lineHeight: 1 }}>+</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  flex: 1, borderRadius: 10, border: '2px dashed #2A2A2A',
                  aspectRatio: '1/1', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 6,
                  cursor: 'pointer', background: '#111111',
                }}
              >
                <div style={{ color: '#4B5563' }}><CameraIcon size={22} /></div>
                <div style={{ fontSize: 12, color: '#4B5563', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>Fotos</div>
              </div>
              <div
                onClick={() => videoRef.current?.click()}
                style={{
                  flex: 1, borderRadius: 10, border: '2px dashed #2A2A2A',
                  aspectRatio: '1/1', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 6,
                  cursor: 'pointer', background: '#111111',
                }}
              >
                <div style={{ fontSize: 22 }}>🎬</div>
                <div style={{ fontSize: 12, color: '#4B5563', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>Video</div>
              </div>
            </div>
          )}
        </div>

        {/* Caption */}
        <div style={{ padding: '10px 16px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 8 }}>DESCRIPCIÓN</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {pt && (
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 6, background: pt.bg, border: `1px solid ${pt.border}`, color: pt.color, fontSize: 11, fontWeight: 700 }}>{pt.label}</span>
            )}
            {isPrivate && (
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 6, background: 'rgba(75,85,99,0.2)', border: '1px solid rgba(75,85,99,0.4)', color: '#9CA3AF', fontSize: 11, fontWeight: 700 }}>🔒 Privado</span>
            )}
          </div>
          <textarea
            placeholder={
              postType === 'quiero' ? '¿Qué carta o producto estás buscando?' :
              postType === 'tengo'  ? '¿Qué tenés disponible?' :
              postType === 'tradeo' ? '¿Qué ofrecés y qué buscás a cambio?' :
              postType === 'vendo'  ? '¿Qué vendés? Precio, condición, set...' :
              'Escribí tu publicación...'
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
            <span style={{ fontSize: 11, fontFamily: 'Inter, sans-serif', color: caption.length >= 490 ? '#F87171' : caption.length >= 450 ? '#F59E0B' : '#374151' }}>{caption.length}/500</span>
          </div>
        </div>

      </div>
    </div>
  )
}
