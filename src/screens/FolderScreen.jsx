// ─────────────────────────────────────────────
// QUEST — FolderScreen (card collection)
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { getCards, addCard, deleteCard, updateCard, createPost } from '../lib/supabase'
import { GAMES, GAME_STYLES, CARD_STATUS } from '../lib/constants'
import GameIcon from '../components/GameIcon'

function AddCardModal({ onClose, onAdded }) {
  const [name,   setName]   = useState('')
  const [game,   setGame]   = useState('MTG')
  const [status, setStatus] = useState('have')
  const [qty,    setQty]    = useState(1)
  const [price,  setPrice]  = useState('')
  const [note,   setNote]   = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [limitReached, setLimitReached] = useState(false)
  const [alsoPost,     setAlsoPost]     = useState(false)
  const [postCaption,  setPostCaption]  = useState('')

  const STATUS_TO_POST = { have: 'Tengo', want: 'Quiero', trade: 'Tradeo', sell: 'Vendo' }

  const handleAdd = async () => {
    if (!name.trim()) return
    setLoading(true); setError('')
    try {
      const card = await addCard({
        name: name.trim(), game, cardStatus: status,
        qty, price: price ? parseFloat(price) : null,
        note: note.trim() || null, imageUrl: null,
      })

      // Also create a feed post if toggled
      if (alsoPost) {
        const label = STATUS_TO_POST[status] ?? 'Tengo'
        const caption = `[${label}] ${postCaption.trim() || name.trim()}`
        try { await createPost({ caption, game, imageUrl: null }) } catch {}
      }

      onAdded(card)
      onClose()
    } catch (e) {
      if (e.message === 'CARD_LIMIT_REACHED') {
        setLimitReached(true)
      } else {
        setError(e.message)
      }
    }
    setLoading(false)
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, background: '#0A0A0A',
      zIndex: 200, display: 'flex', flexDirection: 'column',
      animation: 'slideUp 0.3s ease both',
    }}>
      <div style={{
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #1F1F1F',
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 15, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          Cancelar
        </button>
        <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter, sans-serif' }}>Agregar Carta</span>
        <button onClick={handleAdd} disabled={!name.trim() || loading || limitReached} style={{
          background: name.trim() && !limitReached ? '#FFFFFF' : '#1F1F1F',
          border: 'none', color: name.trim() && !limitReached ? '#111111' : '#4B5563',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          padding: '6px 14px', borderRadius: 8, fontFamily: 'Inter, sans-serif',
        }}>{loading ? '...' : 'Guardar'}</button>
      </div>

      {/* Limit reached — full body replacement */}
      {limitReached && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center', gap: 14 }}>
          <div style={{ fontSize: 56 }}>📦</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#A78BFA' }}>Colección al límite</div>
          <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>
            Los usuarios free tienen hasta <span style={{ color: '#FFF', fontWeight: 700 }}>50 cartas</span> en su colección.{'\n'}
            Para agregar más, activá tu membresía en la tienda.
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

      <div style={{ flex: 1, padding: '20px 20px', overflowY: 'auto', scrollbarWidth: 'none', display: limitReached ? 'none' : undefined }}>
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 6, marginBottom: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13 }}>{error}</div>
        )}

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 6 }}>NOMBRE</div>
          <input
            placeholder="Nombre de la carta"
            value={name} onChange={e => setName(e.target.value)}
            style={{ width: '100%', padding: '13px 14px', background: '#111111', border: '1px solid #2A2A2A', borderRadius: 12, color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 8 }}>JUEGO</div>
          <div className="filter-scroll">
            {GAMES.map(g => {
              const gs = GAME_STYLES[g]
              const active = game === g
              return (
                <button key={g} onClick={() => setGame(g)} style={{
                  padding: '6px 12px', borderRadius: 8, flexShrink: 0,
                  border: `1px solid ${active ? gs.border : '#2A2A2A'}`,
                  background: active ? gs.bg : 'transparent',
                  color: active ? gs.color : '#4B5563',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}><GameIcon game={g} size={13} /> {g}</button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 8 }}>ESTADO</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(CARD_STATUS).map(([key, cs]) => (
              <button key={key} onClick={() => setStatus(key)} style={{
                padding: '7px 14px', borderRadius: 8,
                border: `1px solid ${status === key ? cs.border : '#2A2A2A'}`,
                background: status === key ? cs.bg : 'transparent',
                color: status === key ? cs.color : '#4B5563',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>{cs.label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 6 }}>CANTIDAD</div>
            <input
              type="number" min="1" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)}
              style={{ width: '100%', padding: '13px 14px', background: '#111111', border: '1px solid #2A2A2A', borderRadius: 12, color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 6 }}>PRECIO (USD)</div>
            <input
              type="number" min="0" step="0.01" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)}
              style={{ width: '100%', padding: '13px 14px', background: '#111111', border: '1px solid #2A2A2A', borderRadius: 12, color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 6 }}>NOTA</div>
          <input
            placeholder="Condición, set, foil..."
            value={note} onChange={e => setNote(e.target.value)}
            style={{ width: '100%', padding: '13px 14px', background: '#111111', border: '1px solid #2A2A2A', borderRadius: 12, color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Publish to feed */}
        <div style={{ marginBottom: alsoPost ? 10 : 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 2 }}>PUBLICAR EN EL FEED</div>
            <div style={{ fontSize: 12, color: alsoPost ? '#FFFFFF' : '#4B5563', fontWeight: 600 }}>
              {alsoPost ? '📢 También aparecerá en el feed' : 'Solo guardar en colección'}
            </div>
          </div>
          <div
            onClick={() => setAlsoPost(p => !p)}
            style={{
              width: 48, height: 26, borderRadius: 13,
              background: alsoPost ? '#FFFFFF' : '#374151',
              position: 'relative', cursor: 'pointer',
              transition: 'background 0.2s', flexShrink: 0,
              border: `1.5px solid ${alsoPost ? '#E5E7EB' : '#4B5563'}`,
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: alsoPost ? 22 : 2,
              width: 18, height: 18, borderRadius: '50%',
              background: alsoPost ? '#111111' : '#9CA3AF',
              transition: 'left 0.2s',
            }} />
          </div>
        </div>
        {alsoPost && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 6 }}>DESCRIPCIÓN DEL POST <span style={{ color: '#374151', fontWeight: 500 }}>· Opcional</span></div>
            <textarea
              placeholder={`Contá algo sobre ${name.trim() || 'la carta'}...`}
              value={postCaption}
              onChange={e => setPostCaption(e.target.value.slice(0, 500))}
              style={{
                width: '100%', padding: '11px 14px',
                background: '#111111', border: '1px solid #2A2A2A',
                borderRadius: 10, color: '#FFF', fontSize: 14,
                fontFamily: 'Inter, sans-serif', outline: 'none',
                resize: 'none', minHeight: 72, lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function CardItem({ card, onDelete, onUpdated }) {
  const gs = GAME_STYLES[card.game] ?? GAME_STYLES['MTG']
  const [confirm,  setConfirm]  = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [editQty,  setEditQty]  = useState(card.qty ?? 1)
  const [editPrice,setEditPrice]= useState(card.estimated_value ?? '')
  const [editStatus,setEditStatus]=useState(card.status ?? 'have')
  const [saving,   setSaving]   = useState(false)
  const timerRef = useRef(null)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const cs = CARD_STATUS[editStatus] ?? CARD_STATUS.have

  const handleDelete = () => {
    if (!confirm) {
      setConfirm(true)
      timerRef.current = setTimeout(() => setConfirm(false), 3000)
      return
    }
    clearTimeout(timerRef.current)
    onDelete(card.id)
  }

  const handleEditSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const updated = await updateCard(card.id, {
        status: editStatus,
        qty: parseInt(editQty) || 1,
        estimated_value: editPrice ? parseFloat(editPrice) : null,
      })
      onUpdated?.(updated)
      setEditing(false)
    } catch {}
    setSaving(false)
  }

  return (
    <div style={{
      padding: '12px 20px', borderBottom: '1px solid #111111',
      animation: 'fadeUp 0.25s ease both',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 6, flexShrink: 0,
          background: gs.bg, border: `1px solid ${gs.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><GameIcon game={card.game} size={22} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {card.name}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              padding: '2px 8px', borderRadius: 6,
              background: cs.bg, border: `1px solid ${cs.border}`,
              color: cs.color, fontSize: 10, fontWeight: 700,
            }}>{cs.label}</span>
            {(parseInt(editQty) || 1) > 1 && <span style={{ fontSize: 11, color: '#4B5563' }}>x{parseInt(editQty)}</span>}
            {editPrice ? <span style={{ fontSize: 11, color: '#9CA3AF' }}>${editPrice}</span> : null}
            {card.notes && <span style={{ fontSize: 11, color: '#4B5563' }}>{card.notes}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {!editing && (
            <button onClick={() => setEditing(true)} title="Editar" style={{
              background: 'none', border: 'none', color: '#374151',
              cursor: 'pointer', fontSize: 15, padding: 4, transition: 'color 0.15s',
            }}>✏</button>
          )}
          <button
            onClick={handleDelete}
            title={confirm ? 'Tocá de nuevo para confirmar' : 'Eliminar'}
            style={{
              background: 'none', border: 'none',
              color: confirm ? '#F87171' : '#374151',
              cursor: 'pointer', fontSize: confirm ? 12 : 16,
              fontWeight: confirm ? 700 : 400,
              fontFamily: 'Inter, sans-serif',
              padding: 4, transition: 'color 0.15s',
            }}
          >{confirm ? 'Borrar?' : '✕'}</button>
        </div>
      </div>

      {/* Inline edit form */}
      {editing && (
        <div style={{ marginTop: 12, animation: 'fadeUp 0.15s ease' }}>
          {/* Status chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {Object.entries(CARD_STATUS).map(([key, s]) => (
              <button key={key} onClick={() => setEditStatus(key)} style={{
                padding: '5px 10px', borderRadius: 7,
                border: `1px solid ${editStatus === key ? s.border : '#2A2A2A'}`,
                background: editStatus === key ? s.bg : 'transparent',
                color: editStatus === key ? s.color : '#4B5563',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>{s.label}</button>
            ))}
          </div>
          {/* Qty + Price */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 4 }}>CANTIDAD</div>
              <input type="number" min="1" value={editQty} onChange={e => setEditQty(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: '#111', border: '1px solid #2A2A2A', borderRadius: 8, color: '#FFF', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 4 }}>PRECIO (USD)</div>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: '#111', border: '1px solid #2A2A2A', borderRadius: 8, color: '#FFF', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)} style={{
              flex: 1, padding: '9px', borderRadius: 8,
              background: '#1A1A1A', border: '1px solid #2A2A2A',
              color: '#9CA3AF', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>Cancelar</button>
            <button onClick={handleEditSave} disabled={saving} style={{
              flex: 2, padding: '9px', borderRadius: 8,
              background: '#FFF', border: 'none',
              color: '#111', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
            }}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FolderScreen({ profile }) {
  const [cards,    setCards]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [showAdd,  setShowAdd]  = useState(false)
  const [filterG,  setFilterG]  = useState(null)
  const [filterS,  setFilterS]  = useState(null)
  const [search,   setSearch]   = useState('')

  const isUnlimited  = profile?.role === 'staff' || profile?.role === 'admin' || profile?.role === 'premium'
  const cardLimit    = 50
  const atLimit      = !isUnlimited && cards.length >= cardLimit
  // True when user was premium and had more cards than the free limit (grandfathered)
  const overLimit    = !isUnlimited && cards.length > cardLimit

  useEffect(() => {
    if (!profile?.id) return
    getCards(profile.id)
      .then(setCards)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [profile?.id])

  const handleDelete = async (id) => {
    setCards(c => c.filter(x => x.id !== id))
    try { await deleteCard(id) } catch { /* silently ignore */ }
  }

  const handleUpdated = (updated) => {
    setCards(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
  }

  const q = search.trim().toLowerCase()
  const filtered = cards.filter(c =>
    (!filterG || c.game === filterG) &&
    (!filterS || c.status === filterS) &&
    (!q || c.name?.toLowerCase().includes(q))
  )

  const counts = { total: cards.length, value: cards.reduce((s, c) => s + (c.estimated_value || 0), 0) }

  return (
    <div>
      {showAdd && (
        <AddCardModal
          onClose={() => setShowAdd(false)}
          onAdded={card => setCards(prev => [card, ...prev])}
        />
      )}

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
        <button onClick={() => setShowAdd(true)} style={{
          width: 44, height: 44, borderRadius: 12,
          background: atLimit ? 'rgba(167,139,250,0.12)' : '#FFFFFF',
          border: atLimit ? '1px solid rgba(167,139,250,0.3)' : 'none',
          color: atLimit ? '#A78BFA' : '#111111',
          fontSize: atLimit ? 16 : 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>{atLimit ? '✨' : '+'}</button>
      </div>

      {/* Over-limit banner — shown when downgraded from premium */}
      {overLimit && (
        <div style={{
          margin: '10px 20px 0',
          padding: '10px 14px', borderRadius: 10,
          background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA', marginBottom: 1 }}>
              Tenés {cards.length} cartas — límite free: {cardLimit}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4 }}>
              Tus cartas están seguras. Para agregar más, volvé a premium.
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '10px 20px 2px' }}>
        <div style={{ position: 'relative' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar carta..."
            style={{
              width: '100%', padding: '9px 12px 9px 36px',
              background: '#111', border: '1px solid #222',
              borderRadius: 10, color: '#FFF', fontSize: 13,
              fontFamily: 'Inter, sans-serif', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span style={{
            position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
            fontSize: 14, color: '#4B5563', pointerEvents: 'none', lineHeight: 1,
          }}>🔍</span>
          {search && (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer',
              fontSize: 14, padding: 0, lineHeight: 1,
            }}>✕</button>
          )}
        </div>
      </div>

      {/* Game filter */}
      <div className="filter-scroll" style={{ padding: '6px 20px 2px' }}>
        <button onClick={() => setFilterG(null)} style={{
          padding: '5px 12px', borderRadius: 8, flexShrink: 0,
          border: `1px solid ${!filterG ? 'rgba(255,255,255,0.3)' : '#2A2A2A'}`,
          background: !filterG ? 'rgba(255,255,255,0.08)' : 'transparent',
          color: !filterG ? '#FFFFFF' : '#4B5563',
          fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>Todo</button>
        {GAMES.map(g => {
          const gs = GAME_STYLES[g]
          const active = filterG === g
          return (
            <button key={g} onClick={() => setFilterG(active ? null : g)} style={{
              padding: '5px 12px', borderRadius: 8, flexShrink: 0,
              border: `1px solid ${active ? gs.border : '#2A2A2A'}`,
              background: active ? gs.bg : 'transparent',
              color: active ? gs.color : '#4B5563',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', gap: 5,
            }}><GameIcon game={g} size={12} /> {g}</button>
          )
        })}
      </div>

      {/* Status filter */}
      <div className="filter-scroll" style={{ padding: '4px 20px 6px' }}>
        <button onClick={() => setFilterS(null)} style={{
          padding: '5px 12px', borderRadius: 8, flexShrink: 0,
          border: `1px solid ${!filterS ? 'rgba(255,255,255,0.2)' : '#2A2A2A'}`,
          background: !filterS ? 'rgba(255,255,255,0.05)' : 'transparent',
          color: !filterS ? '#9CA3AF' : '#374151',
          fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>Todos</button>
        {Object.entries(CARD_STATUS).map(([key, cs]) => (
          <button key={key} onClick={() => setFilterS(filterS === key ? null : key)} style={{
            padding: '5px 12px', borderRadius: 8, flexShrink: 0,
            border: `1px solid ${filterS === key ? cs.border : '#2A2A2A'}`,
            background: filterS === key ? cs.bg : 'transparent',
            color: filterS === key ? cs.color : '#4B5563',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>{cs.label}</button>
        ))}
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
        </div>
      )}

      {error && (
        <div style={{ margin: '12px 20px', padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <div style={{ fontSize: 15, color: '#4B5563', marginBottom: 16 }}>
            {cards.length === 0 ? 'Tu colección está vacía' : 'No hay cartas con ese filtro'}
          </div>
          {cards.length === 0 && (
            <button onClick={() => setShowAdd(true)} style={{
              padding: '12px 24px', background: '#FFFFFF', border: 'none',
              borderRadius: 12, color: '#111111', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>+ Agregar carta</button>
          )}
        </div>
      )}

      {filtered.map(card => (
        <CardItem key={card.id} card={card} onDelete={handleDelete} onUpdated={handleUpdated} />
      ))}
    </div>
  )
}
