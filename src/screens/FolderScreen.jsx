// ─────────────────────────────────────────────
// QUEST — FolderScreen (card collection + decks)
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { getCards, addCard, deleteCard, updateCard, createPost, uploadPostImage } from '../lib/supabase'
import { GAMES, GAME_STYLES, CARD_STATUS } from '../lib/constants'
import { CameraIcon } from '../components/Icons'
import GameIcon from '../components/GameIcon'

const sk = (w, h, r = 6) => ({
  width: w, height: h, borderRadius: r, flexShrink: 0, display: 'block',
  background: 'linear-gradient(90deg,#141414 25%,#222 50%,#141414 75%)',
  backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite linear',
})

const CONDITIONS = [
  { id: 'NM',  full: 'Near Mint'        },
  { id: 'LP',  full: 'Lightly Played'   },
  { id: 'MP',  full: 'Moderately Played'},
  { id: 'HP',  full: 'Heavily Played'   },
  { id: 'DMG', full: 'Damaged'          },
]

async function compressCardImage(file, maxDim = 1080, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image()
    const blobUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(blobUrl)
      const W = img.naturalWidth, H = img.naturalHeight
      // Preserve natural ratio — no crop, just resize
      let outW = W, outH = H
      if (outW > maxDim || outH > maxDim) {
        const s = maxDim / Math.max(outW, outH)
        outW = Math.round(outW * s); outH = Math.round(outH * s)
      }
      const canvas = document.createElement('canvas')
      canvas.width = outW; canvas.height = outH
      canvas.getContext('2d').drawImage(img, 0, 0, W, H, 0, 0, outW, outH)
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file) }
    img.src = blobUrl
  })
}

// ── New Folder modal ──────────────────────────
function NewFolderModal({ existing, onClose, onCreate }) {
  const [name, setName] = useState('')
  const err = existing.includes(name.trim()) ? 'Ya existe un folder con ese nombre' : ''
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', background: '#111111', borderRadius: '20px 20px 0 0', border: '1px solid #222', padding: '20px 20px 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333', margin: '0 auto -4px' }} />
        <div style={{ fontSize: 15, fontWeight: 800, color: '#FFF', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>Nuevo Folder</div>
        <input
          autoFocus placeholder="Nombre del folder (ej: Deck Principal, Tradeo...)"
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim() && !err) onCreate(name.trim()) }}
          style={{ width: '100%', padding: '13px 14px', background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 12, color: '#FFF', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
        />
        {err && <div style={{ fontSize: 12, color: '#F87171', fontFamily: 'Inter, sans-serif' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'transparent', border: '1px solid #2A2A2A', color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancelar</button>
          <button onClick={() => name.trim() && !err && onCreate(name.trim())} disabled={!name.trim() || !!err} style={{ flex: 2, padding: '12px', borderRadius: 10, background: name.trim() && !err ? '#FFF' : '#1F1F1F', border: 'none', color: name.trim() && !err ? '#111' : '#4B5563', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Crear Folder</button>
        </div>
      </div>
    </div>
  )
}

// ── Add card modal ────────────────────────────
function AddCardModal({ onClose, onAdded, folders }) {
  const [name,       setName]       = useState('')
  const [game,       setGame]       = useState('MTG')
  const [status,     setStatus]     = useState('have')
  const [qty,        setQty]        = useState(1)
  const [price,      setPrice]      = useState('')
  const [condition,  setCondition]  = useState('')
  const [note,       setNote]       = useState('')
  const [folder,     setFolder]     = useState('')
  const [newFolder,  setNewFolder]  = useState('')
  const [addingFolder, setAddingFolder] = useState(false)
  const [imageFile,  setImageFile]  = useState(null)
  const [imgPreview, setImgPreview] = useState(null)
  const [uploading,  setUploading]  = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [limitReached, setLimitReached] = useState(false)
  const [alsoPost,   setAlsoPost]   = useState(false)
  const [postCaption,setPostCaption]= useState('')
  const fileRef = useRef()

  const STATUS_TO_POST = { have: 'Tengo', want: 'Compro', trade: 'Tradeo', sell: 'Vendo' }
  const isSell = status === 'sell'

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setImgPreview(URL.createObjectURL(file)); setUploading(true)
    setImageFile(await compressCardImage(file)); setUploading(false)
  }

  const handleAdd = async () => {
    setLoading(true); setError('')
    try {
      const noteStr  = [condition, note.trim()].filter(Boolean).join(' — ') || null
      const finalFolder = addingFolder ? newFolder.trim() || null : folder || null
      let imageUrl = null
      if (imageFile) imageUrl = await uploadPostImage(imageFile)

      const card = await addCard({
        name: name.trim(), game, cardStatus: status,
        qty, price: isSell && price ? parseFloat(price) : null,
        note: noteStr, imageUrl, folder: finalFolder,
      })

      if (alsoPost) {
        const label    = STATUS_TO_POST[status] ?? 'Tengo'
        const priceStr = isSell && price ? ` · $${price}` : ''
        const condStr  = condition ? ` · ${condition}` : ''
        const caption  = `[${label}] ${postCaption.trim() || name.trim()}${condStr}${priceStr}`
        try { await createPost({ caption, game, imageUrls: imageUrl ? [imageUrl] : [] }) } catch {}
      }

      onAdded(card); onClose()
    } catch (e) {
      if (e.message === 'CARD_LIMIT_REACHED') setLimitReached(true)
      else setError(e.message)
    }
    setLoading(false)
  }

  const inputStyle = { width: '100%', padding: '13px 14px', background: '#111111', border: '1px solid #2A2A2A', borderRadius: 12, color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0A0A0A', zIndex: 200, display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top, 0px)', animation: 'slideUp 0.3s ease both' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1F1F1F' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 15, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancelar</button>
        <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter, sans-serif' }}>Agregar Carta</span>
        <button onClick={handleAdd} disabled={loading || limitReached || uploading} style={{ background: !limitReached ? '#FFFFFF' : '#1F1F1F', border: 'none', color: !limitReached ? '#111111' : '#4B5563', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '6px 14px', borderRadius: 8, fontFamily: 'Inter, sans-serif' }}>
          {loading ? '...' : 'Guardar'}
        </button>
      </div>

      {limitReached && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center', gap: 14 }}>
          <div style={{ fontSize: 56 }}>📦</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#A78BFA' }}>Colección al límite</div>
          <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>Los usuarios free tienen hasta <span style={{ color: '#FFF', fontWeight: 700 }}>50 cartas</span>.</div>
          <div style={{ marginTop: 8, padding: '16px 20px', borderRadius: 14, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', width: '100%' }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 4 }}>¿Ya sos miembro?</div>
            <div style={{ fontSize: 13, color: '#A78BFA', fontWeight: 600 }}>Avisale a un admin para que activen tu cuenta ✨</div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto', scrollbarWidth: 'none', display: limitReached ? 'none' : undefined }}>
        {error && <div style={{ padding: '10px 14px', borderRadius: 6, marginBottom: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13 }}>{error}</div>}

        {/* Photo */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 8 }}>FOTO <span style={{ color: '#374151', fontWeight: 500 }}>· Opcional</span></div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
          {imgPreview ? (
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
              <img src={imgPreview} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
              {uploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite' }} /></div>}
              <button onClick={() => { setImageFile(null); setImgPreview(null) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6, color: '#FFFFFF', fontSize: 12, fontWeight: 700, padding: '4px 8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>✕ Quitar</button>
            </div>
          ) : (
            <div onClick={() => fileRef.current?.click()} style={{ borderRadius: 10, border: '2px dashed #2A2A2A', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', background: '#111111' }}>
              <div style={{ color: '#4B5563' }}><CameraIcon size={20} /></div>
              <div style={{ fontSize: 13, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>Foto de la carta <span style={{ color: '#374151' }}>· Opcional</span></div>
            </div>
          )}
        </div>

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 6 }}>NOMBRE</div>
          <input placeholder="Nombre de la carta · Opcional" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </div>

        {/* Folder */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 8 }}>FOLDER / DECK <span style={{ color: '#374151', fontWeight: 500 }}>· Opcional</span></div>
          {!addingFolder ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setFolder('')} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${!folder ? 'rgba(255,255,255,0.3)' : '#2A2A2A'}`, background: !folder ? 'rgba(255,255,255,0.08)' : 'transparent', color: !folder ? '#FFF' : '#4B5563', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Sin folder</button>
              {folders.map(f => (
                <button key={f} onClick={() => setFolder(f)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${folder === f ? 'rgba(167,139,250,0.4)' : '#2A2A2A'}`, background: folder === f ? 'rgba(167,139,250,0.12)' : 'transparent', color: folder === f ? '#A78BFA' : '#4B5563', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{f}</button>
              ))}
              <button onClick={() => setAddingFolder(true)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px dashed #2A2A2A', background: 'transparent', color: '#4B5563', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>+ Nuevo</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input autoFocus placeholder="Nombre del folder..." value={newFolder} onChange={e => setNewFolder(e.target.value)}
                style={{ ...inputStyle, flex: 1, padding: '10px 12px', borderRadius: 10 }} />
              <button onClick={() => { setAddingFolder(false); setNewFolder('') }} style={{ padding: '10px 12px', borderRadius: 10, background: 'transparent', border: '1px solid #2A2A2A', color: '#6B7280', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>✕</button>
            </div>
          )}
        </div>

        {/* Game */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 8 }}>JUEGO</div>
          <div className="filter-scroll">
            {GAMES.map(g => {
              const gs = GAME_STYLES[g]; const active = game === g
              return <button key={g} onClick={() => setGame(g)} style={{ padding: '6px 12px', borderRadius: 8, flexShrink: 0, border: `1px solid ${active ? gs.border : '#2A2A2A'}`, background: active ? gs.bg : 'transparent', color: active ? gs.color : '#4B5563', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}><GameIcon game={g} size={13} /> {g}</button>
            })}
          </div>
        </div>

        {/* Status */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 8 }}>ESTADO</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(CARD_STATUS).map(([key, cs]) => (
              <button key={key} onClick={() => setStatus(key)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${status === key ? cs.border : '#2A2A2A'}`, background: status === key ? cs.bg : 'transparent', color: status === key ? cs.color : '#4B5563', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{cs.label}</button>
            ))}
          </div>
        </div>

        {/* Condition */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 8 }}>CONDICIÓN <span style={{ color: '#374151', fontWeight: 500 }}>· Opcional</span></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CONDITIONS.map(c => (
              <button key={c.id} onClick={() => setCondition(prev => prev === c.id ? '' : c.id)} title={c.full} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${condition === c.id ? 'rgba(96,165,250,0.4)' : '#2A2A2A'}`, background: condition === c.id ? 'rgba(96,165,250,0.12)' : 'transparent', color: condition === c.id ? '#60A5FA' : '#4B5563', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{c.id}</button>
            ))}
          </div>
        </div>

        {/* Qty + Price */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 6 }}>CANTIDAD</div>
            <div style={{ display: 'flex', alignItems: 'center', background: '#111111', border: '1px solid #2A2A2A', borderRadius: 12, overflow: 'hidden', height: 48 }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 48, height: '100%', background: 'none', border: 'none', color: '#9CA3AF', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <span style={{ flex: 1, textAlign: 'center', color: '#FFFFFF', fontSize: 16, fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>{qty}</span>
              <button onClick={() => setQty(q => q + 1)} style={{ width: 48, height: '100%', background: 'none', border: 'none', color: '#9CA3AF', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
          </div>
          {isSell && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4ADE80', letterSpacing: '0.1em', marginBottom: 6 }}>PRECIO (USD) <span style={{ color: '#374151', fontWeight: 500 }}>· Opc.</span></div>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} style={{ ...inputStyle, border: '1px solid rgba(74,222,128,0.25)' }} />
            </div>
          )}
        </div>

        {/* Note */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 6 }}>NOTA <span style={{ color: '#374151', fontWeight: 500 }}>· Opcional</span></div>
          <input placeholder="Set, foil, firmada..." value={note} onChange={e => setNote(e.target.value)} style={inputStyle} />
        </div>

        {/* Publish to feed */}
        <div style={{ marginBottom: alsoPost ? 10 : 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 2 }}>PUBLICAR EN EL FEED</div>
            <div style={{ fontSize: 12, color: alsoPost ? '#FFFFFF' : '#4B5563', fontWeight: 600 }}>{alsoPost ? '📢 También aparecerá en el feed' : 'Solo guardar en colección'}</div>
          </div>
          <div onClick={() => setAlsoPost(p => !p)} style={{ width: 48, height: 26, borderRadius: 13, background: alsoPost ? '#FFFFFF' : '#374151', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0, border: `1.5px solid ${alsoPost ? '#E5E7EB' : '#4B5563'}` }}>
            <div style={{ position: 'absolute', top: 2, left: alsoPost ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: alsoPost ? '#111111' : '#9CA3AF', transition: 'left 0.2s' }} />
          </div>
        </div>
        {alsoPost && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 6 }}>DESCRIPCIÓN DEL POST <span style={{ color: '#374151', fontWeight: 500 }}>· Opcional</span></div>
            <textarea placeholder={`Contá algo sobre ${name.trim() || 'la carta'}...`} value={postCaption} onChange={e => setPostCaption(e.target.value.slice(0, 500))}
              style={{ width: '100%', padding: '11px 14px', background: '#111111', border: '1px solid #2A2A2A', borderRadius: 10, color: '#FFF', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'none', minHeight: 72, lineHeight: 1.5, boxSizing: 'border-box' }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Image viewer (swipeable) ──────────────────
function ImageViewer({ cards, initialIndex, onClose }) {
  const [idx, setIdx]       = useState(initialIndex)
  const [offset, setOffset] = useState(0)
  const touchX = useRef(null)
  const card = cards[idx]
  const cs   = CARD_STATUS[card?.status] ?? CARD_STATUS.have

  const go = (dir) => {
    const next = idx + dir
    if (next < 0 || next >= cards.length) return
    setIdx(next); setOffset(0)
  }

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX }
  const onTouchMove  = (e) => {
    if (touchX.current === null) return
    setOffset(e.touches[0].clientX - touchX.current)
  }
  const onTouchEnd = () => {
    if (offset < -60)       go(1)
    else if (offset > 60)   go(-1)
    else                    setOffset(0)
    touchX.current = null
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: '#0A0A0A', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '56px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 15, cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: 0 }}>✕ Cerrar</button>
        <span style={{ color: '#4B5563', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>{idx + 1} / {cards.length}</span>
      </div>

      {/* Card image — swipeable */}
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', overflow: 'hidden' }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      >
        {card?.image_url ? (
          <img
            src={card.image_url} alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 14, transform: `translateX(${offset}px)`, transition: offset === 0 ? 'transform 0.25s ease' : 'none', userSelect: 'none', pointerEvents: 'none' }}
          />
        ) : (
          <div style={{ width: 220, height: 308, borderRadius: 14, background: '#111', border: '1px solid #2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `translateX(${offset}px)`, transition: offset === 0 ? 'transform 0.25s ease' : 'none' }}>
            <GameIcon game={card?.game} size={48} />
          </div>
        )}
      </div>

      {/* Card info */}
      <div style={{ padding: '16px 24px 48px' }}>
        <div style={{ background: '#111111', borderRadius: 16, padding: '16px 18px', border: '1px solid #1F1F1F' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF', marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>
            {card?.name || <span style={{ color: '#374151' }}>Sin nombre</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ padding: '3px 9px', borderRadius: 6, background: cs.bg, border: `1px solid ${cs.border}`, color: cs.color, fontSize: 11, fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>{cs.label}</span>
            {card?.game && <span style={{ padding: '3px 9px', borderRadius: 6, background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#9CA3AF', fontSize: 11, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>{card.game}</span>}
            {(card?.qty ?? 1) > 1 && <span style={{ color: '#6B7280', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>x{card.qty}</span>}
            {card?.estimated_value > 0 && <span style={{ color: '#4ADE80', fontWeight: 700, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>${parseFloat(card.estimated_value).toFixed(2)}</span>}
          </div>
          {card?.notes && <div style={{ marginTop: 8, fontSize: 12, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>{card.notes}</div>}
        </div>

        {/* Prev / Next arrows */}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={() => go(-1)} disabled={idx === 0} style={{ flex: 1, padding: '12px', background: '#111', border: '1px solid #2A2A2A', borderRadius: 12, color: idx === 0 ? '#2A2A2A' : '#9CA3AF', fontSize: 20, cursor: idx === 0 ? 'default' : 'pointer' }}>‹</button>
          <button onClick={() => go(1)} disabled={idx === cards.length - 1} style={{ flex: 1, padding: '12px', background: '#111', border: '1px solid #2A2A2A', borderRadius: 12, color: idx === cards.length - 1 ? '#2A2A2A' : '#9CA3AF', fontSize: 20, cursor: idx === cards.length - 1 ? 'default' : 'pointer' }}>›</button>
        </div>
      </div>
    </div>
  )
}

// ── Card item ─────────────────────────────────
function GridCardItem({ card, onDelete, onUpdated, onViewImage }) {
  const gs = GAME_STYLES[card.game] ?? GAME_STYLES['MTG']
  const [confirm,    setConfirm]    = useState(false)
  const [editing,    setEditing]    = useState(false)
  const [editQty,    setEditQty]    = useState(card.qty ?? 1)
  const [editPrice,  setEditPrice]  = useState(card.estimated_value ?? '')
  const [editStatus, setEditStatus] = useState(card.status ?? 'have')
  const [saving,     setSaving]     = useState(false)
  const timerRef = useRef(null)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const cs     = CARD_STATUS[editStatus] ?? CARD_STATUS.have
  const isSell = editStatus === 'sell'
  const condMatch = card.notes ? CONDITIONS.find(c => card.notes.startsWith(c.id)) : null

  const handleDelete = () => {
    if (!confirm) { setConfirm(true); timerRef.current = setTimeout(() => setConfirm(false), 3000); return }
    clearTimeout(timerRef.current); onDelete(card.id)
  }

  const handleEditSave = async () => {
    if (saving) return; setSaving(true)
    try {
      const updated = await updateCard(card.id, { status: editStatus, qty: parseInt(editQty) || 1, estimated_value: isSell && editPrice ? parseFloat(editPrice) : null })
      onUpdated?.(updated); setEditing(false)
    } catch {}
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', animation: 'fadeUp 0.25s ease both' }}>
      {/* Card visual — same style as AuctionCard */}
      <div style={{ background: '#111', borderRadius: 14, border: '1px solid #1F1F1F', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Image */}
        <div
          onClick={() => onViewImage?.()}
          style={{ position: 'relative', background: '#0A0A0A', cursor: card.image_url ? 'pointer' : 'default' }}
        >
          {card.image_url ? (
            <img src={card.image_url} alt={card.name} style={{ display: 'block', width: '100%', aspectRatio: '3/4', objectFit: 'cover', objectPosition: 'center' }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '3/4', background: gs.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GameIcon game={card.game} size={32} />
            </div>
          )}
          {/* Status badge — bottom left */}
          <div style={{ position: 'absolute', bottom: 6, left: 6, padding: '2px 7px', borderRadius: 6, background: cs.bg, border: `1px solid ${cs.border}`, color: cs.color, fontSize: 9, fontWeight: 700 }}>{cs.label}</div>
          {/* Qty badge — top right */}
          {(parseInt(editQty) || 1) > 1 && (
            <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.72)', borderRadius: 6, padding: '2px 7px', fontSize: 9, color: '#FFF', fontWeight: 700 }}>x{parseInt(editQty)}</div>
          )}
          {/* Condition badge — top left */}
          {condMatch && (
            <div style={{ position: 'absolute', top: 6, left: 6, padding: '2px 6px', borderRadius: 5, background: 'rgba(96,165,250,0.2)', border: '1px solid rgba(96,165,250,0.3)', color: '#60A5FA', fontSize: 9, fontWeight: 700 }}>{condMatch.id}</div>
          )}
        </div>

        {/* Info strip */}
        <div style={{ padding: '7px 9px 9px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            {editPrice && isSell
              ? <span style={{ fontSize: 10, color: '#4ADE80', fontWeight: 700 }}>${parseFloat(editPrice).toFixed(2)}</span>
              : <span style={{ fontSize: 9, fontWeight: 700, color: gs.color, background: gs.bg, border: `1px solid ${gs.border}`, borderRadius: 4, padding: '1px 5px' }}>{card.game}</span>
            }
            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {!editing && (
                <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: 12, padding: '2px 3px', lineHeight: 1 }}>✏</button>
              )}
              <button onClick={handleDelete} style={{ background: 'none', border: 'none', color: confirm ? '#F87171' : '#374151', cursor: 'pointer', fontSize: confirm ? 9 : 13, fontWeight: confirm ? 700 : 400, fontFamily: 'Inter, sans-serif', padding: '2px 3px', lineHeight: 1 }}>{confirm ? '?' : '✕'}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit panel — expands below card */}
      {editing && (
        <div style={{ marginTop: 6, background: '#111', borderRadius: 12, border: '1px solid #1F1F1F', padding: 10, animation: 'fadeUp 0.15s ease' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {Object.entries(CARD_STATUS).map(([key, s]) => (
              <button key={key} onClick={() => setEditStatus(key)} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${editStatus === key ? s.border : '#2A2A2A'}`, background: editStatus === key ? s.bg : 'transparent', color: editStatus === key ? s.color : '#4B5563', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{s.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 3 }}>CANT.</div>
              <div style={{ display: 'flex', alignItems: 'center', background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: 7, overflow: 'hidden', height: 32 }}>
                <button onClick={() => setEditQty(q => Math.max(1, parseInt(q) - 1))} style={{ width: 30, height: '100%', background: 'none', border: 'none', color: '#9CA3AF', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <span style={{ flex: 1, textAlign: 'center', color: '#FFF', fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>{parseInt(editQty) || 1}</span>
                <button onClick={() => setEditQty(q => parseInt(q) + 1)} style={{ width: 30, height: '100%', background: 'none', border: 'none', color: '#9CA3AF', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            </div>
            {isSell && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#4ADE80', letterSpacing: '0.08em', marginBottom: 3 }}>PRECIO</div>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                  style={{ width: '100%', padding: '7px 8px', background: '#0A0A0A', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 7, color: '#FFF', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '7px', borderRadius: 7, background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#9CA3AF', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancelar</button>
            <button onClick={handleEditSave} disabled={saving} style={{ flex: 2, padding: '7px', borderRadius: 7, background: '#FFF', border: 'none', color: '#111', fontSize: 11, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif' }}>{saving ? '...' : 'Guardar'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main screen ───────────────────────────────
export default function FolderScreen({ profile }) {
  const [cards,      setCards]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [showAdd,    setShowAdd]    = useState(false)
  const [viewImgIdx, setViewImgIdx] = useState(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [activeFolder, setActiveFolder]  = useState(null)  // null = Todos
  const [filterG,    setFilterG]    = useState(null)
  const [filterS,    setFilterS]    = useState(null)
  const [search,     setSearch]     = useState('')

  const isUnlimited = profile?.role === 'staff' || profile?.role === 'admin' || profile?.role === 'premium'
  const cardLimit   = 50
  const atLimit     = !isUnlimited && cards.length >= cardLimit
  const overLimit   = !isUnlimited && cards.length > cardLimit

  // Derive folder list from cards
  const folders = [...new Set(cards.map(c => c.folder).filter(Boolean))].sort()

  useEffect(() => {
    if (!profile?.id) return
    getCards(profile.id).then(setCards).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [profile?.id])

  const handleDelete  = async (id) => { setCards(c => c.filter(x => x.id !== id)); try { await deleteCard(id) } catch {} }
  const handleUpdated = (updated)  => setCards(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))

  const handleCreateFolder = (name) => {
    setShowNewFolder(false)
    setActiveFolder(name)
  }

  const q = search.trim().toLowerCase()
  const filtered = cards.filter(c =>
    (activeFolder === null ? true : c.folder === activeFolder) &&
    (!filterG || c.game === filterG) &&
    (!filterS || c.status === filterS) &&
    (!q || c.name?.toLowerCase().includes(q))
  )

  const folderCardCount = (f) => cards.filter(c => c.folder === f).length
  const counts = { total: cards.length, value: cards.reduce((s, c) => s + (c.estimated_value || 0), 0) }

  return (
    <div style={{ position: 'relative' }}>
      {showAdd && <AddCardModal onClose={() => setShowAdd(false)} onAdded={card => setCards(prev => [card, ...prev])} folders={folders} />}
      {showNewFolder && <NewFolderModal existing={folders} onClose={() => setShowNewFolder(false)} onCreate={handleCreateFolder} />}

      {/* Stats bar */}
      <div style={{ padding: '12px 20px 0', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, background: '#111111', borderRadius: 12, padding: '10px 14px', border: `1px solid ${atLimit ? 'rgba(167,139,250,0.3)' : '#1F1F1F'}` }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: atLimit ? '#A78BFA' : '#FFFFFF' }}>
            {counts.total}{!isUnlimited && <span style={{ fontSize: 12, fontWeight: 500, color: '#4B5563' }}>/{cardLimit}</span>}
          </div>
          <div style={{ fontSize: 10, color: '#4B5563', fontWeight: 600 }}>CARTAS</div>
        </div>
        <div style={{ flex: 1, background: '#111111', borderRadius: 12, padding: '10px 14px', border: '1px solid #1F1F1F' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#4ADE80' }}>${counts.value.toFixed(0)}</div>
          <div style={{ fontSize: 10, color: '#4B5563', fontWeight: 600 }}>VALOR EST.</div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ width: 44, height: 44, borderRadius: 12, background: atLimit ? 'rgba(167,139,250,0.12)' : '#FFFFFF', border: atLimit ? '1px solid rgba(167,139,250,0.3)' : 'none', color: atLimit ? '#A78BFA' : '#111111', fontSize: atLimit ? 16 : 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {atLimit ? '✨' : '+'}
        </button>
      </div>

      {overLimit && (
        <div style={{ margin: '10px 20px 0', padding: '10px 14px', borderRadius: 10, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA', marginBottom: 1 }}>Tenés {cards.length} cartas — límite free: {cardLimit}</div>
            <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4 }}>Tus cartas están seguras. Para agregar más, volvé a premium.</div>
          </div>
        </div>
      )}

      {/* Folder tabs */}
      <div className="filter-scroll" style={{ padding: '10px 20px 2px', gap: 6 }}>
        <button onClick={() => setActiveFolder(null)} style={{ padding: '6px 14px', borderRadius: 20, flexShrink: 0, border: `1px solid ${activeFolder === null ? 'rgba(255,255,255,0.3)' : '#2A2A2A'}`, background: activeFolder === null ? 'rgba(255,255,255,0.08)' : 'transparent', color: activeFolder === null ? '#FFFFFF' : '#4B5563', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          📦 Todos <span style={{ color: '#4B5563', fontWeight: 400 }}>({cards.length})</span>
        </button>
        {folders.map(f => (
          <button key={f} onClick={() => setActiveFolder(activeFolder === f ? null : f)} style={{ padding: '6px 14px', borderRadius: 20, flexShrink: 0, border: `1px solid ${activeFolder === f ? 'rgba(167,139,250,0.4)' : '#2A2A2A'}`, background: activeFolder === f ? 'rgba(167,139,250,0.12)' : 'transparent', color: activeFolder === f ? '#A78BFA' : '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
            🗂 {f} <span style={{ color: '#4B5563', fontWeight: 400 }}>({folderCardCount(f)})</span>
          </button>
        ))}
        <button onClick={() => setShowNewFolder(true)} style={{ padding: '6px 14px', borderRadius: 20, flexShrink: 0, border: '1px dashed #2A2A2A', background: 'transparent', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
          + Nuevo folder
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '6px 20px 2px' }}>
        <div style={{ position: 'relative' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={activeFolder ? `Buscar en ${activeFolder}...` : 'Buscar carta...'}
            style={{ width: '100%', padding: '9px 12px 9px 36px', background: '#111', border: '1px solid #222', borderRadius: 10, color: '#FFF', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#4B5563', pointerEvents: 'none' }}>🔍</span>
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>}
        </div>
      </div>

      {/* Game filter */}
      <div className="filter-scroll" style={{ padding: '4px 20px 2px' }}>
        <button onClick={() => setFilterG(null)} style={{ padding: '5px 12px', borderRadius: 8, flexShrink: 0, border: `1px solid ${!filterG ? 'rgba(255,255,255,0.3)' : '#2A2A2A'}`, background: !filterG ? 'rgba(255,255,255,0.08)' : 'transparent', color: !filterG ? '#FFFFFF' : '#4B5563', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Todo</button>
        {GAMES.map(g => {
          const gs = GAME_STYLES[g]; const active = filterG === g
          return <button key={g} onClick={() => setFilterG(active ? null : g)} style={{ padding: '5px 12px', borderRadius: 8, flexShrink: 0, border: `1px solid ${active ? gs.border : '#2A2A2A'}`, background: active ? gs.bg : 'transparent', color: active ? gs.color : '#4B5563', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}><GameIcon game={g} size={12} /> {g}</button>
        })}
      </div>

      {/* Status filter */}
      <div className="filter-scroll" style={{ padding: '4px 20px 6px' }}>
        <button onClick={() => setFilterS(null)} style={{ padding: '5px 12px', borderRadius: 8, flexShrink: 0, border: `1px solid ${!filterS ? 'rgba(255,255,255,0.2)' : '#2A2A2A'}`, background: !filterS ? 'rgba(255,255,255,0.05)' : 'transparent', color: !filterS ? '#9CA3AF' : '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Todos</button>
        {Object.entries(CARD_STATUS).map(([key, cs]) => (
          <button key={key} onClick={() => setFilterS(filterS === key ? null : key)} style={{ padding: '5px 12px', borderRadius: 8, flexShrink: 0, border: `1px solid ${filterS === key ? cs.border : '#2A2A2A'}`, background: filterS === key ? cs.bg : 'transparent', color: filterS === key ? cs.color : '#4B5563', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{cs.label}</button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '4px 16px' }}>
          {[...Array(9)].map((_, i) => (
            <span key={i} style={{ ...sk('100%', undefined, 10), aspectRatio: '2/3', display: 'block' }} />
          ))}
        </div>
      )}
      {error && <div style={{ margin: '12px 20px', padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13 }}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{activeFolder ? '🗂' : '📦'}</div>
          <div style={{ fontSize: 15, color: '#4B5563', marginBottom: 16 }}>
            {activeFolder ? `No hay cartas en "${activeFolder}"` : cards.length === 0 ? 'Tu colección está vacía' : 'No hay cartas con ese filtro'}
          </div>
          {(cards.length === 0 || activeFolder) && (
            <button onClick={() => setShowAdd(true)} style={{ padding: '12px 24px', background: '#FFFFFF', border: 'none', borderRadius: 12, color: '#111111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>+ Agregar carta</button>
          )}
        </div>
      )}

      {viewImgIdx !== null && <ImageViewer cards={filtered} initialIndex={viewImgIdx} onClose={() => setViewImgIdx(null)} />}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '4px 14px 16px' }}>
          {filtered.map((card, i) => (
            <GridCardItem key={card.id} card={card} onDelete={handleDelete} onUpdated={handleUpdated} onViewImage={() => setViewImgIdx(i)} />
          ))}
        </div>
      )}
    </div>
  )
}
