// ─────────────────────────────────────────────
// QUEST — ShopOrdersScreen (gestión de pedidos online)
// La contracara de MyOrdersScreen: acá el EQUIPO ve los pedidos pagados con
// PayPal y los mueve de estado. Sin esta pantalla los pedidos solo se podían
// operar desde el SQL Editor de Supabase.
//
// El aviso al cliente es por WhatsApp con un click: se abre el chat con el
// mensaje ya escrito para esa persona. No es envío automático a propósito —
// la Cloud API de Meta exige número dedicado, plantillas aprobadas y pago por
// mensaje, y no puede escribir a grupos.
// ─────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { getShopOrders, updateShopOrder } from '../lib/supabase'
import Spinner from '../components/Spinner'

const BRANCH_LABEL = { david: 'David', panama: 'Panamá', chitre: 'Chitré' }

const STATUS = {
  pending:   { label: 'Pago en verificación', color: '#FBBF24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.35)' },
  paid:      { label: 'Pagado',               color: '#60A5FA', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.35)' },
  ready:     { label: 'Listo para retirar',   color: '#4ADE80', bg: 'rgba(74,222,128,0.10)', border: 'rgba(74,222,128,0.35)' },
  delivered: { label: 'Entregado',            color: '#9CA3AF', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.25)' },
  refunded:  { label: 'Reembolsado',          color: '#F87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.35)' },
}

const FILTROS = [
  { key: null,        label: 'Todos' },
  { key: 'pending',   label: 'En verificación' },
  { key: 'paid',      label: 'Por preparar' },
  { key: 'ready',     label: 'Listos' },
  { key: 'delivered', label: 'Entregados' },
]

/**
 * Teléfono a formato wa.me (E.164 sin +). El cliente lo escribe como quiere
 * ("6613-0548", "66130548", "+507 6613 0548"); wa.me necesita 50766130548.
 * Un número panameño son 8 dígitos, así que si vienen 8 se le antepone 507.
 */
function waNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '')
  if (!d) return null
  if (d.length === 8) return '507' + d              // local: 6xxx-xxxx / 2xxx-xxxx
  if (d.startsWith('507') && d.length === 11) return d
  if (d.length >= 10) return d                       // ya trae código de país
  return null                                        // demasiado corto: no arriesgamos
}

/** Mensaje sugerido según el estado. El equipo lo puede editar en WhatsApp. */
function mensajeWA(o) {
  const nombre = (o.buyer_name || '').split(' ')[0] || 'Hola'
  const suc    = BRANCH_LABEL[o.branch] ?? o.branch
  const nota   = o.pickup_note ? ` ${o.pickup_note}` : ''
  if (o.status === 'ready') {
    return `Hola ${nombre}! Tu pedido ${o.code} (${o.product_name}) ya está listo para retirar en nuestra sucursal de ${suc}.${nota} Mostranos este número cuando vengas. — Quest`
  }
  if (o.status === 'delivered') {
    return `Hola ${nombre}! Gracias por tu compra en Quest. Tu pedido ${o.code} ya fue entregado. Cualquier cosa escribinos por acá. — Quest`
  }
  if (o.status === 'pending') {
    return `Hola ${nombre}! Recibimos tu pedido ${o.code} (${o.product_name}). PayPal está terminando de verificar el pago, cosa de horas. Tu unidad ya quedó reservada en ${suc} y te avisamos en cuanto puedas retirarla. — Quest`
  }
  return `Hola ${nombre}! Confirmamos tu pedido ${o.code} (${o.product_name}) para retirar en ${suc}. Te escribimos en cuanto esté listo. — Quest`
}

export default function ShopOrdersScreen({ onClose }) {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState(null)
  const [busyId, setBusyId]   = useState(null)
  const [err, setErr]         = useState('')
  const [notaId, setNotaId]   = useState(null)   // pedido con el campo de nota abierto
  const [nota, setNota]       = useState('')

  const cargar = useCallback(() => {
    setLoading(true); setErr('')
    getShopOrders({ status: filtro })
      .then(setOrders)
      .catch(e => setErr(e?.message || 'No se pudieron cargar los pedidos'))
      .finally(() => setLoading(false))
  }, [filtro])

  useEffect(() => { cargar() }, [cargar])

  const cambiar = async (o, status, pickupNote) => {
    if (busyId) return
    setBusyId(o.id); setErr('')
    try {
      const upd = await updateShopOrder(o.id, { status, pickupNote })
      // Se actualiza en memoria en vez de recargar todo: si hay un filtro
      // activo, recargar haría desaparecer la fila de golpe y el equipo pierde
      // de vista lo que acaba de tocar.
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, ...upd } : x))
      setNotaId(null); setNota('')
    } catch (e) {
      setErr(e?.message || 'No se pudo actualizar el pedido')
    } finally { setBusyId(null) }
  }

  const abrirWA = (o) => {
    const num = waNumber(o.buyer_phone)
    if (!num) { setErr(`${o.code}: el teléfono guardado no sirve para WhatsApp (${o.buyer_phone || 'vacío'})`); return }
    const texto = encodeURIComponent(mensajeWA(o))

    // En escritorio se manda a WhatsApp Web, que usa la sesión LOGUEADA —
    // la del número de la tienda. Un link wa.me abre el WhatsApp que el
    // dispositivo tenga por defecto, y si el admin tiene su cuenta personal
    // ahí, el mensaje al cliente sale desde su número privado.
    // Varios admins pueden estar logueados a la vez con el mismo número
    // (WhatsApp Business admite dispositivos vinculados).
    const esEscritorio = typeof window !== 'undefined'
      && window.matchMedia('(min-width: 1024px)').matches
    const url = esEscritorio
      ? `https://web.whatsapp.com/send?phone=${num}&text=${texto}`
      : `https://wa.me/${num}?text=${texto}`
    window.open(url, '_blank')
  }

  const btn = (label, onClick, { color = '#FFF', bg = '#1A1A1A', border = '#2A2A2A' } = {}) => (
    <button onClick={onClick} disabled={!!busyId} style={{
      flex: 1, minWidth: 0, padding: '9px 8px', borderRadius: 10,
      background: bg, border: `1px solid ${border}`, color,
      fontSize: 11.5, fontWeight: 700, fontFamily: 'Inter, sans-serif',
      cursor: busyId ? 'default' : 'pointer', opacity: busyId ? 0.5 : 1,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>{label}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 12px', flexShrink: 0, borderBottom: '1px solid rgba(96,165,250,0.15)' }}>
        <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>‹</button>
        <span style={{ color: '#FFF', fontWeight: 800, fontSize: 16, fontFamily: 'Inter, sans-serif' }}>Pedidos online</span>
        <span style={{ flex: 1 }} />
        {!loading && <span style={{ fontSize: 12, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>{orders.length}</span>}
      </div>

      {/* Filtros por estado */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
        {FILTROS.map(f => (
          <button key={f.label} onClick={() => setFiltro(f.key)} style={{
            padding: '7px 12px', borderRadius: 999, whiteSpace: 'nowrap',
            background: filtro === f.key ? 'rgba(96,165,250,0.16)' : '#111',
            border: `1px solid ${filtro === f.key ? 'rgba(96,165,250,0.6)' : '#2A2A2A'}`,
            color: filtro === f.key ? '#FFF' : '#9CA3AF',
            fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif', cursor: 'pointer',
          }}>{f.label}</button>
        ))}
      </div>

      {err && (
        <div style={{ margin: '0 16px 10px', padding: '9px 12px', borderRadius: 10, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', fontSize: 12, color: '#FCA5A5', fontFamily: 'Inter, sans-serif' }}>
          {err}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'none' }}>
        {loading && <div style={{ textAlign: 'center', marginTop: 40 }}><Spinner /></div>}

        {!loading && orders.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 60, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 24px' }}>
            <span style={{ fontSize: 34 }}>🧾</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif' }}>
              {filtro ? 'Nada en este estado' : 'Todavía no hay pedidos online'}
            </span>
            <span style={{ fontSize: 13, color: '#6B7280', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
              Acá van a aparecer las compras pagadas con PayPal desde la Tienda.
            </span>
          </div>
        )}

        {orders.map(o => {
          const st = STATUS[o.status] ?? STATUS.paid
          const fecha = new Date(o.created_at).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          return (
            <div key={o.id} style={{
              borderRadius: 14, padding: 14, background: st.bg, border: `1px solid ${st.border}`,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#FFF', fontFamily: 'SF Mono, Menlo, monospace', letterSpacing: '0.03em' }}>{o.code}</span>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: st.color, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>{st.label}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>{fecha}</span>
              </div>

              <div style={{ fontSize: 13, color: '#E5E7EB', fontFamily: 'Inter, sans-serif', lineHeight: 1.45 }}>
                {o.product_name}
                <span style={{ display: 'block', fontSize: 12, color: '#9CA3AF' }}>
                  {o.qty} u. · ${o.total} · retira en <strong style={{ color: '#E5E7EB' }}>{BRANCH_LABEL[o.branch] ?? o.branch}</strong>
                </span>
              </div>

              {/* Contacto — es el motivo por el que pedimos estos datos al pagar */}
              <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter, sans-serif', lineHeight: 1.5, paddingTop: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {o.buyer_name || 'Sin nombre'}
                {o.buyer_phone && <> · {o.buyer_phone}</>}
                {o.buyer_email && <span style={{ display: 'block', fontSize: 11, color: '#6B7280', wordBreak: 'break-all' }}>{o.buyer_email}</span>}
              </div>

              {o.pickup_note && (
                <div style={{ fontSize: 12, color: '#BBF7D0', fontFamily: 'Inter, sans-serif', background: 'rgba(74,222,128,0.08)', borderRadius: 8, padding: '7px 10px' }}>
                  {o.pickup_note}
                </div>
              )}

              {/* Campo de observación al marcar listo */}
              {notaId === o.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <input
                    value={nota}
                    autoFocus
                    placeholder="Observación (ej. mañana a partir de las 3pm)"
                    onChange={e => setNota(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: '#111',
                      border: '1px solid #2A2A2A', borderRadius: 10, padding: '10px 12px',
                      color: '#FFF', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 7 }}>
                    {btn('Cancelar', () => { setNotaId(null); setNota('') })}
                    {btn('Marcar listo', () => cambiar(o, 'ready', nota),
                      { color: '#4ADE80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.45)' })}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {o.status === 'pending' && btn('Confirmar pago', () => cambiar(o, 'paid'),
                    { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.45)' })}
                  {(o.status === 'paid' || o.status === 'pending') && btn('Listo para retirar', () => { setNotaId(o.id); setNota(o.pickup_note || '') },
                    { color: '#4ADE80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.45)' })}
                  {o.status === 'ready' && btn('Registrar entrega', () => cambiar(o, 'delivered'))}
                  {o.buyer_phone && btn('WhatsApp', () => abrirWA(o),
                    { color: '#25D366', bg: 'rgba(37,211,102,0.12)', border: 'rgba(37,211,102,0.45)' })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
