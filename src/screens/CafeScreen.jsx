// ─────────────────────────────────────────────
// QUEST — CafeScreen (Quest Café)
// Menú de la cafetería. NO aparece en la navegación: se entra por QR o URL
// directa (/cafe, o un dominio tipo questcafe apuntado al mismo proyecto —
// App.jsx detecta ambos). El público de la tienda no lo ve; el equipo
// gestiona los productos desde la pestaña Cafetería del Shop (solo admins).
//
// El pedido NO cobra online: arma el detalle (items, en tienda / para
// llevar, nombre, nota, total) y lo manda por WhatsApp al número del
// negocio, que es donde el equipo ya trabaja. Invitados bienvenidos —
// el QR lo escanea cualquiera que pasa por la tienda.
// ─────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { STORE_WHATSAPP } from '../lib/constants'
import Spinner from '../components/Spinner'

const fmt = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Mismo criterio que el shop: si hay oferta válida, vale la oferta.
const precio = (p) => {
  const base = Number(p?.price) || 0
  const sale = Number(p?.sale_price) || 0
  return (base > 0 && sale > 0 && sale < base) ? sale : base
}

export default function CafeScreen({ onClose }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [qty, setQty]         = useState({})          // { productId: n }
  const [modo, setModo]       = useState('tienda')    // 'tienda' | 'llevar'
  const [nombre, setNombre]   = useState('')
  const [nota, setNota]       = useState('')

  useEffect(() => {
    supabase
      .from('shop_products')
      .select('id, name, price, sale_price, image_url, sort_order')
      .eq('category', 'cafe')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        // Sin stock ni pre-order: un café no se inventaría por sucursal.
        // Se muestra todo lo que tenga precio publicado.
        if (!error) setItems((data ?? []).filter(p => precio(p) > 0))
        setLoading(false)
      })
  }, [])

  const pedido = useMemo(() =>
    items.filter(p => (qty[p.id] ?? 0) > 0)
         .map(p => ({ ...p, n: qty[p.id], sub: precio(p) * qty[p.id] })),
  [items, qty])
  const total = pedido.reduce((a, p) => a + p.sub, 0)

  const cambiar = (id, d) =>
    setQty(q => ({ ...q, [id]: Math.max(0, Math.min(20, (q[id] ?? 0) + d)) }))

  const pedirPorWA = () => {
    const lineas = [
      `☕ *PEDIDO QUEST CAFÉ* — ${modo === 'llevar' ? 'PARA LLEVAR 🥡' : 'PARA TOMAR EN TIENDA'}`,
      '',
      ...pedido.map(p => `· ${p.n}× ${p.name} — ${fmt(p.sub)}`),
      '',
      `*Total: ${fmt(total)}*`,
      nombre.trim() ? `Nombre: ${nombre.trim()}` : null,
      nota.trim()   ? `Nota: ${nota.trim()}`     : null,
    ].filter(v => v !== null)
    window.open(`https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(lineas.join('\n'))}`, '_blank')
  }

  const input = {
    width: '100%', boxSizing: 'border-box', background: '#141210',
    border: '1px solid #2E2A25', borderRadius: 10, padding: '10px 12px',
    color: '#FFF', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif',
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      // Paleta propia, cálida — que se sienta cafetería, no tienda de cartas.
      background:
        'radial-gradient(ellipse 90% 55% at 50% -10%, rgba(180,120,60,0.22) 0%, transparent 60%), #0C0A08',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 18px 10px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: '"Bebas Neue", Inter, sans-serif', fontSize: 30, letterSpacing: '0.04em', color: '#F5E9DC', lineHeight: 1 }}>
            QUEST CAFÉ
          </div>
          <div style={{ fontSize: 11.5, color: '#A78B6F', marginTop: 3 }}>
            Pedí acá y retiralo en la barra ☕
          </div>
        </div>
        <button onClick={onClose} aria-label="Cerrar" style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#C9B8A6', borderRadius: 10, width: 34, height: 34,
          fontSize: 17, cursor: 'pointer', lineHeight: 1,
        }}>×</button>
      </div>

      {/* Menú */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, scrollbarWidth: 'none' }}>
        {loading && <div style={{ textAlign: 'center', marginTop: 50 }}><Spinner /></div>}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 70, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 26px' }}>
            <span style={{ fontSize: 36 }}>☕</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#F5E9DC' }}>El menú está en preparación</span>
            <span style={{ fontSize: 13, color: '#A78B6F', lineHeight: 1.6 }}>
              Muy pronto vas a poder pedir desde acá. Mientras tanto, acercate a la barra.
            </span>
          </div>
        )}

        {items.map(p => {
          const n = qty[p.id] ?? 0
          const enOferta = precio(p) < (Number(p.price) || 0)
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 10,
              background: n > 0 ? 'rgba(180,120,60,0.10)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${n > 0 ? 'rgba(214,158,96,0.45)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 14, transition: 'background 160ms ease, border-color 160ms ease',
            }}>
              <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', background: '#1A1613', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.image_url
                  ? <img src={p.image_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <span style={{ fontSize: 22 }}>☕</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#F5E9DC', lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ fontSize: 12.5, marginTop: 2, display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  {enOferta && <span style={{ color: '#6B5B4A', textDecoration: 'line-through', fontSize: 11 }}>{fmt(p.price)}</span>}
                  <span style={{ color: '#D69E60', fontWeight: 800 }}>{fmt(precio(p))}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button onClick={() => cambiar(p.id, -1)} style={{
                  width: 30, height: 30, borderRadius: 9, border: '1px solid #3A332C',
                  background: '#1A1613', color: n > 0 ? '#F5E9DC' : '#4A4238',
                  fontSize: 16, cursor: 'pointer', lineHeight: 1,
                }}>−</button>
                <span style={{ minWidth: 18, textAlign: 'center', fontSize: 14, fontWeight: 800, color: n > 0 ? '#F5E9DC' : '#4A4238', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                <button onClick={() => cambiar(p.id, +1)} style={{
                  width: 30, height: 30, borderRadius: 9, border: '1px solid rgba(214,158,96,0.5)',
                  background: 'rgba(180,120,60,0.16)', color: '#F5E9DC',
                  fontSize: 16, cursor: 'pointer', lineHeight: 1,
                }}>+</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Barra de pedido */}
      {items.length > 0 && (
        <div style={{
          flexShrink: 0, padding: '12px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(12,10,8,0.9)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          borderTop: '1px solid rgba(214,158,96,0.25)',
          display: 'flex', flexDirection: 'column', gap: 9,
        }}>
          {/* En tienda / Para llevar */}
          <div style={{ display: 'flex', gap: 7 }}>
            {[
              { id: 'tienda', label: '☕ Para tomar en tienda' },
              { id: 'llevar', label: '🥡 Para llevar' },
            ].map(m => (
              <button key={m.id} onClick={() => setModo(m.id)} style={{
                flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                background: modo === m.id ? 'rgba(214,158,96,0.18)' : '#171310',
                border: `1px solid ${modo === m.id ? 'rgba(214,158,96,0.65)' : '#2E2A25'}`,
                color: modo === m.id ? '#F5E9DC' : '#8A7660',
                fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
              }}>{m.label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 7 }}>
            <input value={nombre} onChange={e => setNombre(e.target.value.slice(0, 60))}
                   placeholder="Tu nombre" style={{ ...input, flex: 1 }} />
            <input value={nota} onChange={e => setNota(e.target.value.slice(0, 120))}
                   placeholder="Nota (ej. sin azúcar)" style={{ ...input, flex: 1.4 }} />
          </div>

          <button disabled={pedido.length === 0} onClick={pedirPorWA} style={{
            width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
            background: pedido.length ? '#25D366' : '#1E1A16',
            color: pedido.length ? '#FFF' : '#5A4F42',
            fontSize: 14.5, fontWeight: 800, cursor: pedido.length ? 'pointer' : 'default',
            fontFamily: 'Inter, sans-serif',
          }}>
            {pedido.length
              ? `Pedir por WhatsApp · ${fmt(total)}`
              : 'Elegí algo del menú para pedir'}
          </button>
        </div>
      )}
    </div>
  )
}
