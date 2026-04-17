// ─────────────────────────────────────────────
// QUEST — ShopScreen
// 3 sections: Sealed · Singles · Accesorios
// Sub-filters: by TCG (Sealed/Singles) or type (Accesorios)
// Search bar across all sections
// ─────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react'
import { getShopProducts, updateShopProduct, upsertShopProduct, deleteShopProduct, getProductReservations, createReservation, deleteReservation, searchUsers, notifyOwnerOfShopChange } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { GAMES, GAME_STYLES } from '../lib/constants'
import GameIcon from '../components/GameIcon'

const STORE_WHATSAPP = '50766130548'
// Branch-specific WhatsApp numbers.
// Key = branch, value = E.164 without + (for wa.me). When a product is only
// stocked in a single branch, we route the customer to that branch's number.
// Fallback: STORE_WHATSAPP (used for multi-branch or out-of-stock products).
const BRANCH_WHATSAPP = {
  david:  '50762718525',
  panama: STORE_WHATSAPP,
  chitre: STORE_WHATSAPP,
}

// Decide which WhatsApp number to use for a given product.
// Rule: if the product has stock in exactly one branch, use that branch's
// number. Otherwise (multi-branch, no stock, or coming-soon), fall back to
// the main store number.
function waNumberForProduct(product) {
  const d = product?.qty_david  ?? 0
  const p = product?.qty_panama ?? 0
  const c = product?.qty_chitre ?? 0
  const branches = []
  if (d > 0) branches.push('david')
  if (p > 0) branches.push('panama')
  if (c > 0) branches.push('chitre')
  if (branches.length === 1) return BRANCH_WHATSAPP[branches[0]] ?? STORE_WHATSAPP
  return STORE_WHATSAPP
}

const BRANCHES = [
  { key: 'qty_david',  label: 'David'  },
  { key: 'qty_panama', label: 'Panamá' },
  { key: 'qty_chitre', label: 'Chitré' },
]

// ── Price normalization from TCGPlayer market price ──────────────
// < $0.25  → $0.25  (minimum)
// $0.26–$0.74 → $0.75
// $0.75–$0.99 → $1.00
// $1.00+   → keep as-is
function normalizeTcgPrice(raw) {
  if (!raw || raw <= 0) return 0.25
  if (raw <= 0.25) return 0.25
  if (raw <= 0.74) return 0.75
  if (raw < 1.00)  return 1.00
  // $1.00+ → round up to nearest $0.25 ($1.01→$1.25, $1.26→$1.50, etc.)
  return Math.ceil(raw / 0.25) * 0.25
}

const JUSTTCG_GAME_IDS = {
  'One Piece': 'one-piece-card-game',
  'Digimon':   'digimon-card-game',
  'Gundam':    'gundam-card-game',
  'Riftbound': 'riftbound-league-of-legends-tcg',
}

const CATEGORIES = [
  { id: 'sealed',    label: 'Sealed'      },
  { id: 'single',    label: 'Singles'     },
  { id: 'accessory', label: 'Accesorios'  },
]

const ACCESSORY_SUBS = [
  { id: null,       label: 'Todos'    },
  { id: 'sleeve',   label: 'Sleeves'  },
  { id: 'playmat',  label: 'Playmats' },
  { id: 'dado',     label: 'Dados'    },
  { id: 'deckbox',  label: 'Deck Box' },
  { id: 'other',    label: 'Otros'    },
]

function fmtPrice(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function totalStock(p) {
  return (p.qty_david ?? 0) + (p.qty_panama ?? 0) + (p.qty_chitre ?? 0)
}
function gameTheme(game) {
  const gs = GAME_STYLES[game]
  if (gs) return { color: gs.color, bg: gs.color + '18', border: gs.color + '30' }
  return { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.2)' }
}

// ── Product image ─────────────────────────────
// ── Product image — contain so full box is visible ───
function ProductImage({ src, game, ratio = '1/1', detail = false }) {
  const [loaded, setLoaded] = useState(false)
  const [err,    setErr]    = useState(false)
  const theme = gameTheme(game)

  const wrap = {
    width: '100%', aspectRatio: ratio,
    background: (src && !err) ? '#FFFFFF' : '#0A0A0A', position: 'relative',
    borderRadius: detail ? 12 : '10px 10px 0 0',
    overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  if (!src || err) return (
    <div style={wrap}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <GameIcon game={game} size={detail ? 40 : 28} />
        <span style={{ fontSize: 8, color: theme.color, fontWeight: 700, letterSpacing: '0.06em' }}>
          {game?.toUpperCase()}
        </span>
      </div>
    </div>
  )
  return (
    <div style={wrap}>
      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GameIcon game={game} size={24} />
        </div>
      )}
      <img src={src} alt="" onLoad={() => setLoaded(true)} onError={() => setErr(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: loaded ? 'block' : 'none', padding: detail ? '12px' : '8px', boxSizing: 'border-box' }} />
    </div>
  )
}

function stockLabel(p) {
  if (p.coming_soon) return { text: 'Próximamente', color: '#FBBF24', dot: '#FBBF24' }
  if (totalStock(p) > 0) return { text: 'En stock',      color: '#4ADE80', dot: '#4ADE80' }
  return                        { text: 'Sin stock',     color: '#6B7280', dot: '#374151' }
}

function fmtPriceOrAsk(n) {
  if (!n || Number(n) === 0) return 'Preguntar precio'
  return fmtPrice(n)
}

// ── WA icon ──────────────────────────────────
function WAIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  )
}

const BRANCHES_RES = [
  { key: 'david',  label: 'David',  color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)'  },
  { key: 'panama', label: 'Panamá', color: '#34D399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.25)'  },
  { key: 'chitre', label: 'Chitré', color: '#FB923C', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.25)'  },
]

// ── Reservations section (owner only) ────────
function ReservationsSection({ product, onQtyChange }) {
  const [reservations, setReservations] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState([])
  const [selected,     setSelected]     = useState(null)
  const [qty,          setQty]          = useState('1')
  const [paidPct,      setPaidPct]      = useState(50)
  const [branch,       setBranch]       = useState('david')
  const [notes,        setNotes]        = useState('')
  const [saving,       setSaving]       = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    getProductReservations(product.id)
      .then(setReservations).catch(() => {}).finally(() => setLoading(false))
  }, [product.id])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(() => {
      searchUsers(query).then(r => setResults(r.slice(0, 6))).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const handleCreate = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const { reservation, qtyUpdate } = await createReservation({
        productId: product.id, userId: selected.id,
        qty: parseInt(qty) || 1, paidPct, branch, notes,
        productName: product.name,
      })
      setReservations(prev => [reservation, ...prev])
      onQtyChange?.(qtyUpdate)
      setShowForm(false); setQuery(''); setSelected(null); setQty('1'); setNotes(''); setPaidPct(50); setBranch('david')
    } catch (e) { alert('Error: ' + (e?.message || 'intentá de nuevo')) }
    setSaving(false)
  }

  const handleDelete = async (r) => {
    try {
      const { qtyUpdate } = await deleteReservation(r)
      setReservations(prev => prev.filter(x => x.id !== r.id))
      onQtyChange?.(qtyUpdate)
    } catch (e) { alert('Error al eliminar') }
  }

  const totalReserved = reservations.reduce((s, r) => s + (r.qty || 0), 0)

  return (
    <div style={{ borderTop: '1px solid #1A1A1A', marginTop: 4, paddingTop: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em' }}>RESERVAS</div>
          {totalReserved > 0 && (
            <span style={{ fontSize: 9, fontWeight: 800, color: '#A78BFA', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 10, padding: '2px 7px' }}>
              {totalReserved} uds
            </span>
          )}
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{
          padding: '4px 10px', borderRadius: 7, border: '1px solid #2A2A2A',
          background: showForm ? '#A78BFA' : 'transparent',
          color: showForm ? '#FFF' : '#A78BFA',
          fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>{showForm ? '✕ Cancelar' : '+ Reserva'}</button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 12, padding: 12, marginBottom: 12 }}>

          {/* User search */}
          <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 5 }}>CLIENTE</div>
          {selected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 9, marginBottom: 10 }}>
              {selected.avatar_url
                ? <img src={selected.avatar_url} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>👤</div>
              }
              <span style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA', flex: 1 }}>@{selected.username}</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          ) : (
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Buscar usuario..."
                style={{ width: '100%', padding: '9px 12px', background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 9, color: '#FFF', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }} />
              {results.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 9, zIndex: 10, overflow: 'hidden', marginTop: 3 }}>
                  {results.map(u => (
                    <div key={u.id} onClick={() => { setSelected(u); setQuery(''); setResults([]) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #222' }}>
                      {u.avatar_url ? <img src={u.avatar_url} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                        : <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#2A2A2A' }} />}
                      <span style={{ fontSize: 13, color: '#FFF', fontWeight: 600 }}>@{u.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sucursal */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 5 }}>SUCURSAL</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {BRANCHES_RES.map(b => (
                <button key={b.key} onClick={() => setBranch(b.key)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: `1.5px solid ${branch === b.key ? b.border : '#2A2A2A'}`,
                  background: branch === b.key ? b.bg : 'transparent',
                  color: branch === b.key ? b.color : '#6B7280',
                  fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>{b.label}</button>
              ))}
            </div>
          </div>

          {/* Qty + Pago */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 5 }}>CANTIDAD</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setQty(v => String(Math.max(1, (parseInt(v)||1) - 1)))} style={{ width: 28, height: 28, borderRadius: 7, background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#9CA3AF', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} style={{ width: 44, textAlign: 'center', background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 7, color: '#FFF', fontSize: 14, fontWeight: 700, padding: '5px 0', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                <button onClick={() => setQty(v => String((parseInt(v)||1) + 1))} style={{ width: 28, height: 28, borderRadius: 7, background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#9CA3AF', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 5 }}>PAGO</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {[50, 100].map(p => (
                  <button key={p} onClick={() => setPaidPct(p)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 7, border: 'none',
                    background: paidPct === p ? (p === 100 ? '#4ADE80' : '#FBBF24') : '#1A1A1A',
                    color: paidPct === p ? '#111' : '#6B7280',
                    fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}>{p}%</button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 5 }}>NOTAS (opcional)</div>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="ej: pagó en efectivo, busca el viernes..."
              style={{ width: '100%', padding: '9px 12px', background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 9, color: '#FFF', fontSize: 12, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }} />
          </div>

          <button onClick={handleCreate} disabled={!selected || saving} style={{
            width: '100%', padding: '11px 0', borderRadius: 9, border: 'none',
            background: selected ? '#A78BFA' : '#1A1A1A',
            color: selected ? '#FFF' : '#374151',
            fontSize: 13, fontWeight: 800, cursor: selected ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif',
          }}>{saving ? 'Creando…' : '📦 Confirmar reserva y notificar'}</button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ fontSize: 11, color: '#374151', textAlign: 'center', padding: '10px 0' }}>Cargando…</div>
      ) : reservations.length === 0 ? (
        <div style={{ fontSize: 11, color: '#374151', textAlign: 'center', padding: '10px 0' }}>Sin reservas todavía</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {reservations.map(r => {
            const u = r.profiles
            const br = BRANCHES_RES.find(b => b.key === r.branch)
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', background: '#111', border: '1px solid #1A1A1A', borderRadius: 10 }}>
                {u?.avatar_url
                  ? <img src={u.avatar_url} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2A2A2A', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>👤</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF' }}>@{u?.username ?? '—'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                    {br && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: br.bg, color: br.color, border: `1px solid ${br.border}` }}>{br.label}</span>
                    )}
                    {r.notes && <span style={{ fontSize: 10, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{r.notes}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#FFF' }}>{r.qty}u</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                    background: r.paid_pct === 100 ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
                    color: r.paid_pct === 100 ? '#4ADE80' : '#FBBF24',
                    border: `1px solid ${r.paid_pct === 100 ? 'rgba(74,222,128,0.25)' : 'rgba(251,191,36,0.25)'}` }}>{r.paid_pct}%</span>
                  <button onClick={() => handleDelete(r)} style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Product detail sheet (customers read / owners edit inline) ──
function ProductDetailSheet({ product, onClose, isOwner = false, onSave, onDelete }) {
  const { profile } = useAuth()
  const [name,       setName]       = useState(product.name ?? '')
  const [david,      setDavid]      = useState(String(product.qty_david  ?? 0))
  const [panama,     setPanama]     = useState(String(product.qty_panama ?? 0))
  const [chitre,     setChitre]     = useState(String(product.qty_chitre ?? 0))
  const [price,      setPrice]      = useState(String(product.price ?? 0))
  const [askPrice,   setAskPrice]   = useState(!product.price || Number(product.price) === 0)
  const [comingSoon, setComingSoon] = useState(!!product.coming_soon)
  const [imageUrl,   setImageUrl]   = useState(product.image_url ?? '')
  const [imgError,   setImgError]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)

  // ── Swipe-to-dismiss ─────────────────────────────────────────────
  const sheetRef   = useRef(null)
  const dragRef    = useRef({ startY: 0, dragging: false })
  const [dragY,    setDragY]    = useState(0)

  const onTouchStart = (e) => {
    const sheet = sheetRef.current
    // Only start drag if sheet is scrolled to top
    if (sheet && sheet.scrollTop > 2) return
    dragRef.current = { startY: e.touches[0].clientY, dragging: true }
  }
  const onTouchMove = (e) => {
    if (!dragRef.current.dragging) return
    const sheet = sheetRef.current
    if (sheet && sheet.scrollTop > 2) { dragRef.current.dragging = false; setDragY(0); return }
    const dy = Math.max(0, e.touches[0].clientY - dragRef.current.startY)
    setDragY(dy)
    if (dy > 5) e.preventDefault()
  }
  const onTouchEnd = () => {
    if (!dragRef.current.dragging) return
    dragRef.current.dragging = false
    if (dragY > 80) { setDragY(0); onClose() }
    else setDragY(0)
  }

  const theme = gameTheme(product.game)

  // Live computed values for owner mode
  const liveQty = (parseInt(david) || 0) + (parseInt(panama) || 0) + (parseInt(chitre) || 0)
  const liveProduct = isOwner
    ? { ...product, qty_david: parseInt(david)||0, qty_panama: parseInt(panama)||0, qty_chitre: parseInt(chitre)||0, price: askPrice ? 0 : (parseFloat(price)||0), coming_soon: comingSoon, image_url: imageUrl || product.image_url }
    : product
  const sl = stockLabel(liveProduct)

  const isDirty = isOwner && (
    name.trim() !== (product.name ?? '') ||
    david       !== String(product.qty_david  ?? 0) ||
    panama      !== String(product.qty_panama ?? 0) ||
    chitre      !== String(product.qty_chitre ?? 0) ||
    (askPrice ? 0 : parseFloat(price)||0) !== Number(product.price ?? 0) ||
    comingSoon  !== !!product.coming_soon ||
    imageUrl.trim() !== (product.image_url ?? '')
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave?.(product.id, {
        name: name.trim() || product.name,
        qty_david:  parseInt(david)  || 0,
        qty_panama: parseInt(panama) || 0,
        qty_chitre: parseInt(chitre) || 0,
        price: askPrice ? 0 : (parseFloat(price) || 0),
        coming_soon: comingSoon,
        image_url: imageUrl.trim() || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (e) {
      console.error('Error guardando producto:', e)
      const msg = e?.name === 'AbortError'
        ? 'Tiempo de espera agotado. Verificá tu conexión e intentá de nuevo.'
        : (e?.message || 'Error al guardar, intentá de nuevo.')
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!delConfirm) { setDelConfirm(true); setTimeout(() => setDelConfirm(false), 3000); return }
    await onDelete?.(product.id)
    onClose()
  }

  const userTag = profile?.username ? ` — soy @${profile.username} en Quest` : ''

  const handleAsk = (e) => {
    e.stopPropagation()
    const priceStr = (!product.price || Number(product.price) === 0) ? '' : ` (${fmtPrice(product.price)})`
    const text = `Hola! Me interesa: *${product.name}*${priceStr}. ¿Está disponible?${userTag}`
    window.open(`https://wa.me/${waNumberForProduct(product)}?text=${encodeURIComponent(text)}`, '_blank')
  }

  const step = (setter, delta) => setter(v => String(Math.max(0, (parseInt(v) || 0) + delta)))

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          width: '100%', maxWidth: 390,
          background: '#0F0F0F', borderRadius: '20px 20px 0 0',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          animation: dragY > 0 ? 'none' : 'slideUp 0.25s ease',
          maxHeight: '92vh', overflowY: 'auto',
          transform: dragY > 0 ? `translateY(${dragY}px)` : 'none',
          transition: dragY > 0 ? 'none' : 'transform 0.25s ease',
          touchAction: 'pan-y',
        }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', cursor: 'grab' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: dragY > 40 ? '#6B7280' : '#2A2A2A', transition: 'background 0.15s' }} />
        </div>

        {/* Image */}
        <div style={{ margin: '0 16px', borderRadius: 14, overflow: 'hidden', background: '#FFFFFF', position: 'relative' }}>
          <ProductImage src={imageUrl || product.image_url} game={product.game} ratio="4/3" detail />
          {isOwner && (
            <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
              <button
                onClick={() => {
                  const url = window.prompt('URL de la imagen:', imageUrl || product.image_url || '')
                  if (url !== null) { setImageUrl(url.trim()); setImgError(false) }
                }}
                style={{
                  background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8, padding: '6px 10px', color: '#FFF', fontSize: 11,
                  fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(6px)',
                  fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                📷 Cambiar imagen
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 16px 0' }}>
          {/* Game badge */}
          {product.game && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: theme.bg, border: `1px solid ${theme.border}`,
              borderRadius: 6, padding: '3px 8px', marginBottom: 8,
            }}>
              <GameIcon game={product.game} size={10} />
              <span style={{ fontSize: 9, fontWeight: 800, color: theme.color, letterSpacing: '0.06em' }}>{product.game}</span>
            </div>
          )}

          {isOwner ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 5 }}>NOMBRE</div>
              <textarea
                value={name}
                onChange={e => setName(e.target.value)}
                rows={2}
                style={{
                  width: '100%', background: '#111', border: '1px solid #2A2A2A',
                  borderRadius: 10, color: '#FFF', fontSize: 15, fontWeight: 800,
                  lineHeight: 1.35, padding: '10px 12px', outline: 'none',
                  fontFamily: 'Inter, sans-serif', resize: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          ) : (
            <div style={{ fontSize: 17, fontWeight: 800, color: '#FFF', lineHeight: 1.35, marginBottom: 12 }}>
              {product.name}
            </div>
          )}

          {/* ── Price ── */}
          {isOwner ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, letterSpacing: '0.08em' }}>PRECIO (USD)</div>
                  {/* Refresh from SCG (MTG) or TCGPlayer (Pokemon) */}
                  {(product.sku?.startsWith('SCRYFALL-') || product.sku?.startsWith('PKMN-')) && (
                    <button onClick={async () => {
                      try {
                        let newPrice = null
                        if (product.sku.startsWith('SCRYFALL-')) {
                          // Extract card name (before set/foil suffix)
                          const cardName = (product.name || '').replace(' · Foil', '').replace(/\s*\([^)]+\)\s*$/, '').trim()
                          const isFoil = product.sku.endsWith('-FOIL')
                          // Pass scryfall_id so the server can hit SCG's exact product URL
                          const scryId = product.sku.replace('SCRYFALL-', '').replace('-FOIL', '')
                          const r = await fetch(`/api/mtg-price?card=${encodeURIComponent(cardName)}&foil=${isFoil}&scryfall_id=${scryId}`)
                          const d = await r.json()
                          newPrice = d.price ?? null
                        } else {
                          const id = product.sku.replace('PKMN-', '')
                          const r = await fetch(`https://api.pokemontcg.io/v2/cards/${id}?select=tcgplayer`)
                          const d = await r.json()
                          newPrice = d.data?.tcgplayer?.prices?.normal?.market ?? d.data?.tcgplayer?.prices?.holofoil?.market
                        }
                        if (newPrice) { setPrice(String(normalizeTcgPrice(parseFloat(newPrice)))); setAskPrice(false) }
                        else alert('No se encontró precio en SCG')
                      } catch { alert('Error al actualizar precio') }
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 700, color: '#4ADE80', padding: 0 }}>
                      🔄 {product.sku?.startsWith('SCRYFALL-') ? 'SCG' : 'TCGPlayer'}
                    </button>
                  )}
                </div>
                <button onClick={() => setAskPrice(v => !v)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 10, fontWeight: 700, color: askPrice ? '#A78BFA' : '#4B5563',
                }}>{askPrice ? '✓ Preguntar por precio' : 'Preguntar por precio'}</button>
              </div>
              {!askPrice ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#111', border: '1px solid #2A2A2A', borderRadius: 10, padding: '0 12px' }}>
                  <span style={{ color: '#4B5563', fontSize: 16 }}>$</span>
                  <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00"
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#FFF', fontSize: 18, fontWeight: 800, padding: '11px 4px', fontFamily: 'Inter, sans-serif' }} />
                </div>
              ) : (
                <div style={{ padding: '10px 12px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, fontSize: 12, color: '#A78BFA', fontWeight: 700 }}>
                  Se mostrará "Preguntar precio"
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#FFF', fontVariantNumeric: 'tabular-nums' }}>
                {fmtPriceOrAsk(product.price)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: sl.dot }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: sl.color }}>{sl.text}</span>
              </div>
            </div>
          )}

          {/* ── Coming Soon toggle (owner only) ── */}
          {isOwner && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#111', border: '1px solid #2A2A2A', borderRadius: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#FFF' }}>Próximamente</div>
                <div style={{ fontSize: 10, color: '#6B7280' }}>Oculta disponibilidad hasta que llegue</div>
              </div>
              <button onClick={() => setComingSoon(v => !v)} style={{
                width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: comingSoon ? '#FBBF24' : '#2A2A2A', position: 'relative', transition: 'background 0.2s',
              }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#FFF', position: 'absolute', top: 3, transition: 'left 0.2s', left: comingSoon ? 21 : 3 }} />
              </button>
            </div>
          )}

          {/* ── Branch rows ── */}
          <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 10 }}>
                {isOwner ? 'INVENTARIO POR SUCURSAL' : comingSoon ? 'UNIDADES EN CAMINO' : 'DISPONIBILIDAD'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[['qty_david','David',david,setDavid],['qty_panama','Panamá',panama,setPanama],['qty_chitre','Chitré',chitre,setChitre]].map(([key, label, val, set]) => {
                  const qty = isOwner ? (parseInt(val)||0) : (product[key] ?? 0)
                  const ok  = qty > 0
                  return isOwner ? (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 10,
                      background: ok ? 'rgba(74,222,128,0.06)' : '#111',
                      border: `1px solid ${ok ? 'rgba(74,222,128,0.18)' : '#1A1A1A'}`,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: ok ? '#FFF' : '#4B5563' }}>{label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => step(set, -1)} style={{
                          width: 30, height: 30, borderRadius: 8, background: '#1A1A1A', border: '1px solid #2A2A2A',
                          color: '#9CA3AF', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>−</button>
                        <input type="number" min="0" value={val} onChange={e => set(e.target.value)}
                          style={{ width: 44, textAlign: 'center', background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8, color: '#FFF', fontSize: 15, fontWeight: 800, padding: '5px 0', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                        <button onClick={() => step(set, +1)} style={{
                          width: 30, height: 30, borderRadius: 8, background: '#1A1A1A', border: '1px solid #2A2A2A',
                          color: '#9CA3AF', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>+</button>
                      </div>
                    </div>
                  ) : (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 10,
                      background: ok ? 'rgba(74,222,128,0.06)' : '#111',
                      border: `1px solid ${ok ? 'rgba(74,222,128,0.18)' : '#1A1A1A'}`,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: ok ? '#FFF' : '#4B5563' }}>{label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? '#4ADE80' : '#374151' }} />
                        <span style={{ fontSize: 13, fontWeight: 800, color: ok ? '#4ADE80' : '#4B5563' }}>
                          {ok ? `${qty} en stock` : 'Sin stock'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          {/* ── Owner: live status + total ── */}
          {isOwner && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: '8px 12px', background: '#111', borderRadius: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: sl.dot }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: sl.color }}>{sl.text}</span>
              <span style={{ fontSize: 12, color: '#4B5563', marginLeft: 4 }}>· Total: {liveQty} uds</span>
            </div>
          )}

          {/* ── Reservations ── */}
          {isOwner && (
            <ReservationsSection
              product={product}
              onQtyChange={(fields) => {
                // Update owner's live qty display
                if (fields.qty_david  !== undefined) setDavid(String(fields.qty_david))
                if (fields.qty_panama !== undefined) setPanama(String(fields.qty_panama))
                if (fields.qty_chitre !== undefined) setChitre(String(fields.qty_chitre))
                // Propagate to parent ShopScreen state
                onSave?.(product.id, fields)
              }}
            />
          )}

          {/* ── Owner: save + delete ── */}
          {isOwner && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={handleSave} disabled={!isDirty || saving} style={{
                flex: 1, padding: '13px 0', borderRadius: 11, border: 'none',
                background: saved ? '#4ADE80' : isDirty ? '#FFFFFF' : '#1A1A1A',
                color: saved ? '#000' : isDirty ? '#111' : '#374151',
                fontSize: 14, fontWeight: 800, cursor: isDirty ? 'pointer' : 'default',
                fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
              }}>{saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios'}</button>
              <button onClick={handleDelete} style={{
                padding: '13px 16px', borderRadius: 11,
                background: delConfirm ? 'rgba(127,29,29,0.4)' : 'transparent',
                border: `1.5px solid ${delConfirm ? '#EF4444' : '#2A2A2A'}`,
                color: '#EF4444', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
              }}>{delConfirm ? '¿Eliminar?' : '🗑'}</button>
            </div>
          )}

          {/* ── Customer CTAs ── */}
          {!isOwner && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Reserve now — only when coming soon */}
              {comingSoon && (
                <button onClick={(e) => {
                  e.stopPropagation()
                  const text = `Hola! Quiero reservar: *${product.name}*. ¿Cuándo llega y cómo aparto uno?${userTag}`
                  window.open(`https://wa.me/${waNumberForProduct(product)}?text=${encodeURIComponent(text)}`, '_blank')
                }} style={{
                  width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #FBBF24, #F59E0B)',
                  color: '#111', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <WAIcon size={15} /> Reservar ahora
                </button>
              )}
              {/* Ask / buy — always shown, disabled only if coming soon */}
              <button onClick={handleAsk} disabled={comingSoon} style={{
                width: '100%', padding: '14px 0', borderRadius: 12,
                border: comingSoon ? '1px solid #1F1F1F' : 'none',
                background: !comingSoon ? '#25D366' : '#111',
                color: !comingSoon ? '#FFF' : '#374151',
                fontSize: 14, fontWeight: 800, cursor: !comingSoon ? 'pointer' : 'default',
                fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <WAIcon size={15} /> {comingSoon ? 'Disponible próximamente' : 'Preguntar por WhatsApp'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Product card ─────────────────────────────
function ProductCard({ product, isOwner, onSave, onDelete }) {
  const [showDetail, setShowDetail] = useState(false)
  const sl = stockLabel(product)

  return (
    <>
      <div onClick={() => setShowDetail(true)} style={{
        background: '#111', borderRadius: 12, overflow: 'hidden',
        border: '1px solid #1F1F1F', display: 'flex', flexDirection: 'column', cursor: 'pointer',
      }}>
        <ProductImage src={product.image_url} game={product.game} ratio="1/1" />
        <div style={{ padding: '10px 10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#FFF', lineHeight: 1.35, flex: 1 }}>
            {product.name}
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#FFF', fontVariantNumeric: 'tabular-nums' }}>
            {fmtPriceOrAsk(product.price)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: sl.dot, flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: sl.color }}>{sl.text}</span>
          </div>
        </div>
      </div>
      {showDetail && (
        <ProductDetailSheet
          product={product}
          onClose={() => setShowDetail(false)}
          isOwner={isOwner}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </>
  )
}

// ── Add Product Modal ─────────────────────────
function AddProductModal({ onClose, onAdded, defaultCategory }) {
  const [sku,      setSku]      = useState('')
  const [name,     setName]     = useState('')
  const [category, setCategory] = useState(defaultCategory ?? 'sealed')
  const [game,     setGame]     = useState('MTG')
  const [subcat,   setSubcat]   = useState('sleeve')
  const [price,       setPrice]       = useState('')
  const [askPrice,    setAskPrice]    = useState(false)
  const [comingSoon,  setComingSoon]  = useState(false)
  const [david,       setDavid]       = useState('0')
  const [panama,      setPanama]      = useState('0')
  const [chitre,      setChitre]      = useState('0')
  const [imageUrl,    setImageUrl]    = useState('')
  const [cardSearch,     setCardSearch]     = useState('')
  const [cardResults,    setCardResults]    = useState([]) // MTG + Pokemon results
  const [priceFromTcg,   setPriceFromTcg]  = useState(false) // price was auto-fetched
  const [fetching,    setFetching]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState('')

  const isSingle = category === 'single'

  // Coqui fetch (sealed)
  const handleFetch = async () => {
    if (!sku.trim()) return
    setFetching(true)
    try {
      const res = await fetch(`https://api.coquihobby.com/api/Product/GetProduct?id=${encodeURIComponent(sku.trim())}`)
      if (res.ok) {
        const data = await res.json()
        if (data?.name && !name) setName(data.name)
        const img = data?.images?.[0]?.small ?? data?.images?.[0]?.medium
        if (img) setImageUrl(img)
      }
    } catch {}
    setFetching(false)
  }

  // Scryfall fetch (MTG singles) → all prints including foil variants
  const handleScryfallSearch = async () => {
    if (!cardSearch.trim()) return
    setFetching(true); setCardResults([])
    try {
      const res = await fetch(`https://api.scryfall.com/cards/search?q=name:${encodeURIComponent(cardSearch.trim())}&unique=prints&order=released&dir=desc`)
      const data = await res.json()
      if (data.object === 'list' && data.data?.length) {
        const entries = []
        data.data.forEach(c => {
          const image = c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal
          const usd = c.prices?.usd ? parseFloat(c.prices.usd) : null
          const usdFoil = c.prices?.usd_foil ? parseFloat(c.prices.usd_foil) : null
          // Non-foil version (or base if no foil)
          if (usd !== null || usdFoil === null) {
            entries.push({
              id: `${c.id}-nf`,
              name: c.name,
              set: c.set_name,
              foil: false,
              image,
              price: usd,
              sku: `SCRYFALL-${c.id}`,
              game: 'MTG',
            })
          }
          // Foil version (if price available)
          if (usdFoil !== null) {
            entries.push({
              id: `${c.id}-foil`,
              name: c.name,
              set: c.set_name,
              foil: true,
              image,
              price: usdFoil,
              sku: `SCRYFALL-${c.id}-FOIL`,
              game: 'MTG',
            })
          }
        })
        setCardResults(entries)
      } else {
        alert('Carta no encontrada en Scryfall')
      }
    } catch { alert('Error al buscar en Scryfall') }
    setFetching(false)
  }

  // Pokemon TCG API (singles) → multiple results
  const handlePokemonSearch = async () => {
    if (!cardSearch.trim()) return
    setFetching(true); setCardResults([])
    try {
      const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cardSearch.trim())}"&pageSize=20&select=id,name,images,tcgplayer,set`)
      const data = await res.json()
      if (data.data?.length) {
        setCardResults(data.data.map(c => {
          const mkt = c.tcgplayer?.prices?.normal?.market
            ?? c.tcgplayer?.prices?.holofoil?.market
            ?? c.tcgplayer?.prices?.['1stEditionHolofoil']?.market
            ?? null
          return {
            id: c.id,
            name: `${c.name}`,
            set: c.set?.name,
            image: c.images?.small,
            price: mkt,
            sku: `PKMN-${c.id}`,
            game: 'Pokemon',
          }
        }))
      } else {
        alert('Carta no encontrada')
      }
    } catch { alert('Error al buscar Pokémon') }
    setFetching(false)
  }

  // JustTCG fetch (One Piece, Digimon, Gundam, Riftbound) → USD prices
  const handleJustTcgSearch = async () => {
    if (!cardSearch.trim()) return
    const gameId = JUSTTCG_GAME_IDS[game]
    if (!gameId) return
    setFetching(true); setCardResults([])
    try {
      const res = await fetch(
        `https://api.justtcg.com/v1/cards?q=${encodeURIComponent(cardSearch.trim())}&game=${gameId}&condition=NM`,
        { headers: { 'X-API-Key': import.meta.env.VITE_JUSTTCG_API_KEY } }
      )
      const data = await res.json()
      if (data.data?.length) {
        setCardResults(data.data.slice(0, 20).map(c => {
          const nmVariant = c.variants?.find(v => v.condition === 'NM') ?? c.variants?.[0]
          return {
            id: c.id,
            name: c.name,
            set: c.set_name ?? c.set,
            image: c.image_url ?? c.image ?? null,
            price: nmVariant?.price ? parseFloat(nmVariant.price) : null,
            sku: `JUSTTCG-${c.id}`,
            game,
          }
        }))
      } else {
        alert('Carta no encontrada en JustTCG')
      }
    } catch { alert('Error al buscar carta') }
    setFetching(false)
  }

  const selectCard = async (card) => {
    const foilSuffix = card.foil ? ' · Foil' : ''
    setName(card.set ? `${card.name} (${card.set})${foilSuffix}` : `${card.name}${foilSuffix}`)
    if (card.image) setImageUrl(card.image)
    // Set initial price from Scryfall (TCGPlayer) while SCG loads
    const fallbackPrice = card.price != null ? normalizeTcgPrice(card.price) : null
    if (fallbackPrice != null) {
      setPrice(String(fallbackPrice.toFixed(2)))
      setAskPrice(false)
      setPriceFromTcg(true)
    } else {
      setPriceFromTcg(false)
    }
    setSku(card.sku)
    setCardResults([])
    setCardSearch('')
    // Fetch SCG price asynchronously for MTG singles
    if (card.sku?.startsWith('SCRYFALL-')) {
      try {
        const r = await fetch(`/api/mtg-price?card=${encodeURIComponent(card.name)}&foil=${card.foil ?? false}`)
        const data = await r.json()
        if (data.price && data.price > 0) {
          setPrice(String(normalizeTcgPrice(data.price).toFixed(2)))
          setAskPrice(false)
          setPriceFromTcg(true)
        }
      } catch { /* keep Scryfall price */ }
    }
  }

  const handleAdd = async () => {
    if (!name.trim()) { setErr('Completa el nombre'); return }
    const rawPrice = parseFloat(price) || 0
    const finalPrice = (!askPrice && rawPrice > 0) ? normalizeTcgPrice(rawPrice) : rawPrice
    setSaving(true); setErr('')
    try {
      const prod = await upsertShopProduct({
        sku: sku.trim() || `MANUAL-${Date.now()}`,
        name: name.trim(), category,
        game: category !== 'accessory' ? game : null,
        subcategory: category === 'accessory' ? subcat : null,
        price: askPrice ? 0 : finalPrice,
        coming_soon: comingSoon,
        image_url: imageUrl || null,
        qty_david:  parseInt(david)  || 0,
        qty_panama: parseInt(panama) || 0,
        qty_chitre: parseInt(chitre) || 0,
        active: true, sort_order: 99,
      })
      onAdded(prod); onClose()
    } catch (e) { setErr(e.message || 'Error al guardar') }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{
        width: '100%', background: '#0D0D0D', borderRadius: '20px 20px 0 0',
        border: '1px solid #1F1F1F', padding: '20px 20px calc(env(safe-area-inset-bottom,0px) + 20px)',
        display: 'flex', flexDirection: 'column', gap: 12,
        maxHeight: '92vh', overflowY: 'auto', animation: 'slideUp 0.22s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#FFF' }}>Agregar Producto</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Category */}
        <div>
          <FL>Categoría</FL>
          <div style={{ display: 'flex', gap: 6 }}>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8,
                background: category === c.id ? '#FFF' : '#1A1A1A',
                border: `1px solid ${category === c.id ? '#FFF' : '#2A2A2A'}`,
                color: category === c.id ? '#111' : '#9CA3AF',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>{c.label}</button>
            ))}
          </div>
        </div>

        {/* Game (sealed/single) or subcategory (accessory) */}
        {category !== 'accessory' ? (
          <div>
            <FL>Juego</FL>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {GAMES.map(g => (
                <button key={g} onClick={() => setGame(g)} style={{
                  padding: '6px 10px', borderRadius: 7,
                  background: game === g ? '#FFF' : '#1A1A1A',
                  border: `1px solid ${game === g ? '#FFF' : '#2A2A2A'}`,
                  color: game === g ? '#111' : '#9CA3AF',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <GameIcon game={g} size={12} />{g}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <FL>Tipo de accesorio</FL>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {ACCESSORY_SUBS.filter(s => s.id).map(s => (
                <button key={s.id} onClick={() => setSubcat(s.id)} style={{
                  padding: '6px 12px', borderRadius: 7,
                  background: subcat === s.id ? '#A78BFA' : '#1A1A1A',
                  border: `1px solid ${subcat === s.id ? '#A78BFA' : '#2A2A2A'}`,
                  color: subcat === s.id ? '#FFF' : '#9CA3AF',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>{s.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Smart search: Coqui for sealed, Scryfall/Pokemon for singles */}
        {!isSingle ? (
          <div>
            <FL>SKU Coqui (opcional — auto-busca imagen y nombre)</FL>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={sku} onChange={e => setSku(e.target.value.toUpperCase())}
                placeholder="ej: WOCD5168SP" style={inp} />
              <button onClick={handleFetch} disabled={!sku.trim() || fetching} style={{
                padding: '10px 12px', borderRadius: 10, border: '1px solid #2A2A2A',
                background: '#1A1A1A', color: '#A78BFA', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
              }}>{fetching ? '…' : '🔍 Buscar'}</button>
            </div>
          </div>
        ) : (
          <div>
            <FL>
              {game === 'MTG'     ? 'Nombre de carta (TCGPlayer via Scryfall)' :
               game === 'Pokemon' ? 'Nombre de carta (TCGPlayer via PokémonTCG)' :
               'Buscar carta (opcional)'}
            </FL>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: cardResults.length ? 0 : undefined }}>
                <input value={cardSearch} onChange={e => setCardSearch(e.target.value)}
                  placeholder={game === 'MTG' ? 'ej: Lightning Bolt' : game === 'Pokemon' ? 'ej: Charizard' : game === 'One Piece' ? 'ej: Monkey D. Luffy' : game === 'Digimon' ? 'ej: Agumon' : 'Nombre de carta'}
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return
                    if (game === 'MTG') handleScryfallSearch()
                    else if (game === 'Pokemon') handlePokemonSearch()
                    else if (JUSTTCG_GAME_IDS[game]) handleJustTcgSearch()
                  }}
                  style={inp} />
                <button
                  onClick={game === 'MTG' ? handleScryfallSearch : game === 'Pokemon' ? handlePokemonSearch : JUSTTCG_GAME_IDS[game] ? handleJustTcgSearch : undefined}
                  disabled={!cardSearch.trim() || fetching || !['MTG','Pokemon','One Piece','Digimon','Gundam','Riftbound'].includes(game)}
                  style={{
                    padding: '10px 12px', borderRadius: 10, border: '1px solid #2A2A2A',
                    background: '#1A1A1A', color: '#4ADE80', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
                  }}>{fetching ? '…' : JUSTTCG_GAME_IDS[game] ? '💰 JustTCG' : game === 'MTG' ? '🔍 Buscar' : '💰 TCGPlayer'}</button>
              </div>
              {/* Card results picker — MTG + Pokemon */}
              {cardResults.length > 0 && (
                <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 12, overflow: 'hidden', marginTop: 6, maxHeight: 380, overflowY: 'auto' }}>
                  {cardResults.map(c => (
                    <div key={c.id} onClick={() => selectCard(c)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #1F1F1F', transition: 'background 0.1s' }}
                      onTouchStart={e => e.currentTarget.style.background = '#222'}
                      onTouchEnd={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {c.image
                        ? <img src={c.image} style={{ width: 44, height: 62, objectFit: 'contain', borderRadius: 4, flexShrink: 0, background: '#111' }} />
                        : <div style={{ width: 44, height: 62, borderRadius: 4, background: '#111', flexShrink: 0 }} />
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        {c.set && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{c.set}</div>}
                        {c.foil && <div style={{ marginTop: 4, display: 'inline-block', fontSize: 10, fontWeight: 700, color: '#A78BFA', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 4, padding: '1px 6px' }}>✦ FOIL</div>}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        {c.price != null
                          ? <span style={{ fontSize: 13, fontWeight: 800, color: '#4ADE80' }}>${normalizeTcgPrice(c.price).toFixed(2)}</span>
                          : <span style={{ fontSize: 11, color: '#4B5563' }}>Sin precio</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <FL>Nombre *</FL>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Nombre del producto" style={inp} />
        </div>

        {/* Price or ask */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <FL>Precio (USD)</FL>
            <button onClick={() => { setAskPrice(v => !v); setPriceFromTcg(false) }} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: 10, fontWeight: 700, color: askPrice ? '#A78BFA' : '#4B5563',
            }}>
              {askPrice ? '✓ Preguntar por precio' : 'Preguntar por precio'}
            </button>
          </div>
          {!askPrice && priceFromTcg && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10 }}>
              <span style={{ fontSize: 12, color: '#4ADE80', fontWeight: 700 }}>💰 Desde {sku?.startsWith('SCRYFALL-') ? 'SCG' : 'TCGPlayer'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#FFF' }}>${parseFloat(price).toFixed(2)}</span>
                <button onClick={() => setPriceFromTcg(false)} style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 11, padding: 0 }}>editar</button>
              </div>
            </div>
          )}
          {!askPrice && !priceFromTcg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#111', border: '1px solid #2A2A2A', borderRadius: 10, padding: '0 10px' }}>
              <span style={{ color: '#4B5563', fontSize: 14 }}>$</span>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                placeholder="0.00" min="0.25" step="0.01" style={{ ...inp, border: 'none', background: 'none', padding: '10px 4px' }} />
            </div>
          )}
          {askPrice && (
            <div style={{ padding: '10px 12px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, fontSize: 12, color: '#A78BFA', fontWeight: 700 }}>
              Se mostrará "Preguntar precio"
            </div>
          )}
        </div>

        {/* Coming soon toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#111', border: '1px solid #2A2A2A', borderRadius: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#FFF' }}>Próximamente</div>
            <div style={{ fontSize: 10, color: '#6B7280' }}>Muestra el badge "Coming Soon"</div>
          </div>
          <button onClick={() => setComingSoon(v => !v)} style={{
            width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: comingSoon ? '#FBBF24' : '#2A2A2A', position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', background: '#FFF',
              position: 'absolute', top: 3, transition: 'left 0.2s',
              left: comingSoon ? 21 : 3,
            }} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {[['David', david, setDavid], ['Panamá', panama, setPanama], ['Chitré', chitre, setChitre]].map(([l, v, s]) => (
            <div key={l} style={{ flex: 1 }}>
              <FL>{l}</FL>
              <input type="number" min="0" value={v} onChange={e => s(e.target.value)} style={inp} />
            </div>
          ))}
        </div>

        <div>
          <FL>URL imagen (opcional)</FL>
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
            placeholder="https://..." style={inp} />
        </div>

        {err && <div style={{ fontSize: 12, color: '#F87171', textAlign: 'center' }}>{err}</div>}

        <button onClick={handleAdd} disabled={saving} style={{
          padding: '14px 0', borderRadius: 12, border: 'none',
          background: saving ? '#1A1A1A' : '#FFF',
          color: saving ? '#555' : '#111',
          fontSize: 14, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif', marginTop: 4,
        }}>{saving ? 'Guardando…' : '+ Agregar producto'}</button>
      </div>
    </div>
  )
}

const inp = {
  width: '100%', padding: '10px 12px', background: '#111',
  border: '1px solid #2A2A2A', borderRadius: 10, color: '#FFF',
  fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
}
function FL({ children }) {
  return <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>{children}</div>
}

// ── Game filter strip (same as Feed) ──────────
function GameFilter({ value, onChange }) {
  return (
    <div style={{ background: '#111111', border: '1px solid #1E1E1E', borderRadius: 12, display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 6 }}>
      <button onClick={() => onChange(null)} style={{
        flex: 1, height: 34, borderRadius: 8,
        border: !value ? '1.5px solid rgba(255,255,255,0.35)' : '1.5px solid transparent',
        background: !value ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: !value ? '#FFF' : '#4B5563',
        fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.18s, border-color 0.18s',
        animation: !value ? 'iconPop 0.28s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
      }}>ALL</button>
      <div style={{ width: 1, height: 20, background: '#2A2A2A', flexShrink: 0 }} />
      {GAMES.map(g => {
        const gs = GAME_STYLES[g]
        const active = value === g
        return (
          <button key={g} onClick={() => onChange(active ? null : g)} title={g} style={{
            flex: 1, height: 34, borderRadius: 8,
            border: `1.5px solid ${active ? gs.border : 'transparent'}`,
            background: active ? gs.bg : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.18s, border-color 0.18s, box-shadow 0.18s',
            boxShadow: active ? `0 0 10px ${gs.border}55` : 'none',
            animation: active ? 'iconPop 0.28s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
          }}>
            <GameIcon game={g} size={18} />
          </button>
        )
      })}
    </div>
  )
}

// ── Accessory sub-filter chips ────────────────
function AccessoryFilter({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
      {ACCESSORY_SUBS.map(s => {
        const active = value === s.id
        return (
          <button key={String(s.id)} onClick={() => onChange(s.id)} style={{
            flexShrink: 0, padding: '7px 14px', borderRadius: 20,
            border: `1.5px solid ${active ? '#A78BFA' : '#2A2A2A'}`,
            background: active ? 'rgba(167,139,250,0.12)' : 'transparent',
            color: active ? '#A78BFA' : '#6B7280',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            transition: 'all 0.15s',
          }}>{s.label}</button>
        )
      })}
    </div>
  )
}

// ── Main screen ───────────────────────────────
export default function ShopScreen({ isOwner, isStaff }) {
  const { profile } = useAuth()
  const canEdit = isOwner || isStaff
  const [products,   setProducts]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshLog, setRefreshLog] = useState(null) // { updated, skipped, errors }
  const [showAdd,    setShowAdd]    = useState(false)
  const [category,   setCategory]   = useState('sealed')
  const [gameFilter, setGameFilter] = useState(null)
  const [subFilter,  setSubFilter]  = useState(null)
  const [search,     setSearch]     = useState('')
  const [sortBy,     setSortBy]     = useState('relevance')
  const searchRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    getShopProducts()
      .then(setProducts).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Reset sub-filters when switching category.
  // Singles default to "Más reciente" — they turn over constantly (new cards
  // get uploaded daily), so newest-first is what users actually want to see.
  // Sealed / Accesorios keep the hand-curated sort_order (Relevancia).
  const handleCategory = (c) => {
    setCategory(c); setGameFilter(null); setSubFilter(null); setSearch('')
    setSortBy(c === 'single' ? 'newest' : 'relevance')
  }

  const filtered = products.filter(p => {
    const pCat = p.category || 'sealed'
    if (pCat !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.game?.toLowerCase().includes(q)
    }
    if (category === 'accessory') return subFilter ? p.subcategory === subFilter : true
    return gameFilter ? p.game === gameFilter : true
  }).sort((a, b) => {
    if (sortBy === 'price_asc')  return (a.price || 0) - (b.price || 0)
    if (sortBy === 'price_desc') return (b.price || 0) - (a.price || 0)
    if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    if (sortBy === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0)
    return (a.sort_order || 0) - (b.sort_order || 0)
  })

  const handleSave = useCallback(async (id, fields) => {
    const tryUpdate = async (f) => {
      const updated = await updateShopProduct(id, f)
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...f, ...updated } : p))
      return updated
    }
    let updated
    try {
      updated = await tryUpdate(fields)
    } catch (e) {
      const msg = e?.message ?? ''
      if (msg.includes('coming_soon') || msg.includes('column')) {
        const { coming_soon, ...rest } = fields
        updated = await tryUpdate(rest)
      } else {
        throw e
      }
    }
    // If a staff member (not owner) made the change, notify the owner
    if (!isOwner && isStaff && profile?.username) {
      const product = products.find(p => p.id === id)
      const productName = updated?.name ?? product?.name ?? 'producto'
      notifyOwnerOfShopChange('editó', productName, profile.username).catch(() => {})
    }
  }, [isOwner, isStaff, profile?.username, products])

  const handleDelete = useCallback(async (id) => {
    const product = products.find(p => p.id === id)
    await deleteShopProduct(id)
    setProducts(prev => prev.filter(p => p.id !== id))
    if (!isOwner && isStaff && profile?.username && product?.name) {
      notifyOwnerOfShopChange('eliminó', product.name, profile.username).catch(() => {})
    }
  }, [isOwner, isStaff, profile?.username, products])

  const handleAdded = useCallback((prod) => setProducts(prev => [...prev, prod]), [])

  // Bulk price refresh: MTG from SCG (via /api/mtg-price), Pokemon from pokemontcg.io
  const handleRefreshPrices = async () => {
    const singles = products.filter(p =>
      (p.category || 'sealed') === 'single' &&
      (p.sku?.startsWith('SCRYFALL-') || p.sku?.startsWith('PKMN-'))
    )
    if (!singles.length) { alert('No hay singles de MTG o Pokémon para actualizar.'); return }
    setRefreshing(true)
    setRefreshLog(null)
    let updated = 0, skipped = 0, errors = 0
    for (const p of singles) {
      try {
        let newPrice = null
        if (p.sku.startsWith('SCRYFALL-')) {
          // SCG price via Vercel function — pass scryfall_id so server can
          // hit the exact product URL (set/cn/foil-specific) rather than
          // a name-only search that returns ambiguous variants.
          const cardName = (p.name || '').replace(' · Foil', '').replace(/\s*\([^)]+\)\s*$/, '').trim()
          const isFoil = p.sku.endsWith('-FOIL')
          const scryId = p.sku.replace('SCRYFALL-', '').replace('-FOIL', '')
          const r = await fetch(`/api/mtg-price?card=${encodeURIComponent(cardName)}&foil=${isFoil}&scryfall_id=${scryId}`)
          const d = await r.json()
          newPrice = d.price ?? null
          // Fallback to Scryfall/TCGPlayer if SCG didn't return a price
          if (!newPrice) {
            const id = p.sku.replace('SCRYFALL-', '').replace('-FOIL', '')
            const rf = await fetch(`https://api.scryfall.com/cards/${id}`)
            const df = await rf.json()
            newPrice = isFoil
              ? (df.prices?.usd_foil ? parseFloat(df.prices.usd_foil) : null)
              : (df.prices?.usd ? parseFloat(df.prices.usd) : null)
          }
        } else {
          const id = p.sku.replace('PKMN-', '')
          const r = await fetch(`https://api.pokemontcg.io/v2/cards/${id}?select=tcgplayer`)
          const d = await r.json()
          const prices = d.data?.tcgplayer?.prices
          newPrice = prices?.normal?.market ?? prices?.holofoil?.market ?? prices?.['1stEditionHolofoil']?.market ?? null
          if (newPrice) newPrice = parseFloat(newPrice)
        }
        if (newPrice && newPrice !== Number(p.price)) {
          const finalPrice = normalizeTcgPrice(newPrice)
          await updateShopProduct(p.id, { price: finalPrice })
          setProducts(prev => prev.map(x => x.id === p.id ? { ...x, price: finalPrice } : x))
          updated++
        } else {
          skipped++
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 120))
      } catch { errors++ }
    }
    setRefreshing(false)
    setRefreshLog({ updated, skipped, errors, total: singles.length })
  }

  const catCounts = {
    sealed:    products.filter(p => (p.category || 'sealed') === 'sealed').length,
    single:    products.filter(p => (p.category || 'sealed') === 'single').length,
    accessory: products.filter(p => (p.category || 'sealed') === 'accessory').length,
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', paddingBottom: 100 }}>

      {/* ── Search + owner controls ── */}
      <div style={{ padding: '10px 16px 0', marginBottom: 12 }}>
        {canEdit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={handleRefreshPrices} disabled={refreshing} style={{
                padding: '7px 12px', borderRadius: 10, background: 'transparent',
                border: '1px solid #2A2A2A', color: refreshing ? '#4B5563' : '#4ADE80',
                fontSize: 12, fontWeight: 700, cursor: refreshing ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {refreshing ? '⏳ Actualizando…' : '🔄 Actualizar precios'}
              </button>
              <button onClick={() => setShowAdd(true)} style={{
                padding: '7px 14px', borderRadius: 10, background: '#A78BFA',
                border: 'none', color: '#FFF', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>+ Agregar producto</button>
            </div>
            {refreshLog && (
              <div style={{ textAlign: 'right', fontSize: 11, color: '#6B7280' }}>
                ✅ {refreshLog.updated} actualizados · ⏭️ {refreshLog.skipped} sin cambios
                {refreshLog.errors > 0 && ` · ⚠️ ${refreshLog.errors} errores`}
                {' '}de {refreshLog.total} singles
              </div>
            )}
          </div>
        )}
        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#111', border: '1px solid #1E1E1E', borderRadius: 12,
          padding: '11px 14px',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar carta o producto..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#FFF', fontSize: 14, fontFamily: 'Inter, sans-serif',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>✕</button>
          )}
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div style={{ padding: '0 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', background: '#111', border: '1px solid #1E1E1E', borderRadius: 12, padding: 4, gap: 4 }}>
          {CATEGORIES.map(c => {
            const active = category === c.id
            return (
              <button key={c.id} onClick={() => handleCategory(c.id)} style={{
                flex: 1, padding: '9px 0', borderRadius: 9, border: 'none',
                background: active ? '#FFF' : 'transparent',
                color: active ? '#111' : '#6B7280',
                fontSize: 12, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              }}>
                {c.label}
                <span style={{ fontSize: 8, fontWeight: 600, opacity: 0.6 }}>{catCounts[c.id]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Sub-filter ── */}
      {!search && (
        <div style={{ padding: '0 16px', marginBottom: 10 }}>
          {category !== 'accessory'
            ? <GameFilter value={gameFilter} onChange={setGameFilter} />
            : <AccessoryFilter value={subFilter} onChange={setSubFilter} />
          }
        </div>
      )}

      {/* ── Sort dropdown ── */}
      <div style={{ padding: '0 16px', marginBottom: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ position: 'relative' }}>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              appearance: 'none', WebkitAppearance: 'none',
              background: '#111', border: '1px solid #2A2A2A',
              borderRadius: 10, color: '#FFF', fontSize: 12, fontWeight: 700,
              padding: '7px 30px 7px 12px', outline: 'none',
              fontFamily: 'Inter, sans-serif', cursor: 'pointer',
            }}
          >
            <option value="relevance">Relevancia</option>
            <option value="newest">Más reciente</option>
            <option value="oldest">Más viejo</option>
            <option value="price_asc">Precio ↑</option>
            <option value="price_desc">Precio ↓</option>
          </select>
          <svg style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5L5 7L8 3.5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* ── Grid ── */}
      <div style={{ padding: '0 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 48, color: '#4B5563', fontSize: 13 }}>
            Cargando productos…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#374151' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>
              {search ? '🔍' : category === 'accessory' ? '🎲' : '📦'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>
              {search ? `Sin resultados para "${search}"` : 'Sin productos aquí todavía'}
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} isOwner={canEdit} onSave={handleSave} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddProductModal
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
          defaultCategory={category}
        />
      )}
    </div>
  )
}
