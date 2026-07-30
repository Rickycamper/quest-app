// ─────────────────────────────────────────────
// QUEST — CafeScreen (Quest Café)
// SITIO INDEPENDIENTE de la cafetería: en el subdominio (cafe.* / questcafe*)
// o en /cafe, main.jsx monta ESTO en lugar de la app — el feed, la nav y el
// resto del site ni se ejecutan. El logo de Quest lleva al website normal.
//
// Mismo lenguaje visual que la tienda (tokens de design-tokens vía lib/ui,
// cards en grilla con foto/nombre/precio) pero solo con los productos de
// categoría 'cafe', que el equipo gestiona desde la pestaña Cafetería del
// Shop (solo admins).
//
// El pedido NO cobra online: arma el detalle (items, en tienda / para
// llevar, nombre, nota, total) y sale por WhatsApp al número del negocio.
// Sin login — el QR lo escanea cualquiera que pasa por la tienda.
// ─────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { STORE_WHATSAPP } from '../lib/constants'
import { COLOR, RADIUS, ELEVATION } from '../lib/ui'
import Spinner from '../components/Spinner'
import questLogo from '../assets/quest-logo-sm.png'

const fmt = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Mismo criterio que el shop: si hay oferta válida, vale la oferta.
const precio = (p) => {
  const base = Number(p?.price) || 0
  const sale = Number(p?.sale_price) || 0
  return (base > 0 && sale > 0 && sale < base) ? sale : base
}

// El logo lleva al website normal. En el subdominio eso es el dominio
// principal absoluto; entrando por /cafe (mismo origen, dev o preview)
// alcanza con ir a la raíz.
const urlSitioPrincipal = () =>
  window.location.pathname.replace(/\/+$/, '') === '/cafe'
    ? '/'
    : 'https://questhobbystore.com'

export default function CafeScreen() {
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
    width: '100%', boxSizing: 'border-box', background: COLOR.surface,
    border: `1px solid ${COLOR.borderStrong}`, borderRadius: 10, padding: '10px 12px',
    color: COLOR.text, fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif',
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      // Fondo de la app + un halo cálido arriba, que se note que es el café.
      background:
        'radial-gradient(ellipse 90% 50% at 50% -8%, rgba(251,146,60,0.16) 0%, transparent 60%), ' + COLOR.background,
      fontFamily: 'Inter, sans-serif',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>
      {/* Header — el logo vuelve al website normal */}
      <div style={{
        padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0, borderBottom: `1px solid ${COLOR.border}`,
        position: 'sticky', top: 0, zIndex: 5,
        background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      }}>
        <a href={urlSitioPrincipal()} aria-label="Ir al sitio de Quest" style={{ display: 'flex', alignItems: 'center' }}>
          <img src={questLogo} alt="Quest" style={{ height: 34, display: 'block' }} />
        </a>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: '"Bebas Neue", Inter, sans-serif', fontSize: 22, letterSpacing: '0.06em', color: COLOR.text, lineHeight: 1 }}>
            CAFÉ
          </div>
          <div style={{ fontSize: 11, color: COLOR.textSecondary, marginTop: 2 }}>
            Pedí acá y retiralo en la barra
          </div>
        </div>
        <a href={urlSitioPrincipal()} style={{
          fontSize: 11.5, fontWeight: 700, color: COLOR.textSecondary, textDecoration: 'none',
          padding: '8px 12px', borderRadius: 999,
          border: `1px solid ${COLOR.borderStrong}`, background: COLOR.surface,
        }}>Ir a la tienda ↗</a>
      </div>

      {/* Menú — grilla de cards como el catálogo de la tienda */}
      <div style={{ flex: 1, padding: 16, maxWidth: 860, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {loading && <div style={{ textAlign: 'center', marginTop: 60 }}><Spinner /></div>}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 80, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 26px' }}>
            <span style={{ fontSize: 36 }}>☕</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: COLOR.text }}>El menú está en preparación</span>
            <span style={{ fontSize: 13, color: COLOR.textTertiary, lineHeight: 1.6 }}>
              Muy pronto vas a poder pedir desde acá. Mientras tanto, acercate a la barra.
            </span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, paddingBottom: pedido.length ? 40 : 0 }}>
          {items.map(p => {
            const n = qty[p.id] ?? 0
            const enOferta = precio(p) < (Number(p.price) || 0)
            return (
              <div key={p.id} style={{
                background: COLOR.surface,
                borderRadius: RADIUS.lg,
                overflow: 'hidden',
                border: `1px solid ${n > 0 ? 'rgba(251,146,60,0.55)' : COLOR.border}`,
                boxShadow: `${ELEVATION.sm}, ${ELEVATION.innerLit}`,
                display: 'flex', flexDirection: 'column',
                transition: 'border-color 160ms ease',
              }}>
                <div style={{ width: '100%', aspectRatio: '1 / 1', background: COLOR.surfaceRaised, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.image_url
                    ? <img src={p.image_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <span style={{ fontSize: 34 }}>☕</span>}
                </div>
                <div style={{ padding: '10px 11px 12px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: COLOR.text, lineHeight: 1.3, flex: 1 }}>{p.name}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    {enOferta && <span style={{ color: COLOR.textTertiary, textDecoration: 'line-through', fontSize: 11 }}>{fmt(p.price)}</span>}
                    <span style={{ color: enOferta ? COLOR.green : COLOR.text, fontWeight: 800, fontSize: 14.5, fontVariantNumeric: 'tabular-nums' }}>{fmt(precio(p))}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <button onClick={() => cambiar(p.id, -1)} style={{
                      flex: 1, height: 32, borderRadius: 9, border: `1px solid ${COLOR.borderStrong}`,
                      background: COLOR.surfaceRaised, color: n > 0 ? COLOR.text : COLOR.textQuaternary,
                      fontSize: 16, cursor: 'pointer', lineHeight: 1,
                    }}>−</button>
                    <span style={{ minWidth: 20, textAlign: 'center', fontSize: 14, fontWeight: 800, color: n > 0 ? COLOR.orange : COLOR.textQuaternary, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                    <button onClick={() => cambiar(p.id, +1)} style={{
                      flex: 1, height: 32, borderRadius: 9, border: '1px solid rgba(251,146,60,0.55)',
                      background: 'rgba(251,146,60,0.14)', color: COLOR.text,
                      fontSize: 16, cursor: 'pointer', lineHeight: 1,
                    }}>+</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Barra de pedido */}
      {items.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 0, flexShrink: 0,
          padding: '12px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          borderTop: `1px solid ${COLOR.borderStrong}`,
        }}>
          <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', gap: 7 }}>
              {[
                { id: 'tienda', label: '☕ Para tomar en tienda' },
                { id: 'llevar', label: '🥡 Para llevar' },
              ].map(m => (
                <button key={m.id} onClick={() => setModo(m.id)} style={{
                  flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                  background: modo === m.id ? 'rgba(251,146,60,0.16)' : COLOR.surface,
                  border: `1px solid ${modo === m.id ? 'rgba(251,146,60,0.6)' : COLOR.borderStrong}`,
                  color: modo === m.id ? COLOR.text : COLOR.textSecondary,
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
              background: pedido.length ? '#25D366' : COLOR.surfaceRaised,
              color: pedido.length ? '#FFF' : COLOR.textQuaternary,
              fontSize: 14.5, fontWeight: 800, cursor: pedido.length ? 'pointer' : 'default',
              fontFamily: 'Inter, sans-serif',
            }}>
              {pedido.length
                ? `Pedir por WhatsApp · ${fmt(total)}`
                : 'Elegí algo del menú para pedir'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
