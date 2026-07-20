// ─────────────────────────────────────────────
// QUEST — MyOrdersScreen ("Mis Pedidos")
// El cliente ve sus pre orders y reservas con su número de orden (TCG-####)
// y puede descargar el ticket de cada una — su propio control.
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { getMyOrders } from '../lib/supabase'
import { downloadTicket } from '../lib/ticket'
import { BRANCH_STYLES } from '../lib/constants'
import Spinner from '../components/Spinner'

const BRANCH_LABEL = { david: 'David', panama: 'Panamá', chitre: 'Chitré' }

export default function MyOrdersScreen({ onClose }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)

  useEffect(() => {
    getMyOrders().then(setOrders).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleDownload = async (o) => {
    if (downloadingId) return
    setDownloadingId(o.id)
    try {
      await downloadTicket({
        code: o.code || 'PEDIDO', name: o.name, qty: o.qty, price: o.price,
        paidPct: o.paidPct, branch: o.branch ? (BRANCH_LABEL[o.branch] ?? o.branch) : null,
        dateStr: new Date(o.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }),
      })
    } finally { setDownloadingId(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 12px', flexShrink: 0, borderBottom: '1px solid rgba(251,191,36,0.15)' }}>
        <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>‹</button>
        <span style={{ color: '#FFF', fontWeight: 800, fontSize: 16, fontFamily: 'Inter, sans-serif' }}>Mis Pedidos</span>
        <span style={{ flex: 1 }} />
        {!loading && <span style={{ fontSize: 12, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>{orders.length} pedido{orders.length !== 1 ? 's' : ''}</span>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'none' }}>
        {loading && <div style={{ textAlign: 'center', marginTop: 40 }}><Spinner /></div>}

        {!loading && orders.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 60, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 24px' }}>
            <span style={{ fontSize: 34 }}>📦</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif' }}>Todavía no tenés pedidos</span>
            <span style={{ fontSize: 13, color: '#6B7280', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
              Cuando hagas un pre order en la Tienda (o el equipo registre tu reserva), va a aparecer acá con tu número de orden.
            </span>
          </div>
        )}

        {orders.map(o => {
          const bs = o.branch ? (BRANCH_STYLES[BRANCH_LABEL[o.branch]] ?? null) : null
          return (
            <div key={`${o.kind}-${o.id}`} style={{
              borderRadius: 16, padding: 14,
              background: 'rgba(251,191,36,0.05)',
              border: '1px solid rgba(251,191,36,0.22)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Número de orden — protagonista */}
                <span style={{
                  fontSize: 17, fontWeight: 900, color: '#FFF',
                  fontFamily: 'SF Mono, Menlo, monospace', letterSpacing: '0.03em',
                  padding: '5px 12px', borderRadius: 9, flexShrink: 0,
                  border: '1.5px solid rgba(251,191,36,0.5)', background: 'rgba(251,191,36,0.08)',
                }}>{o.code ?? 'S/N'}</span>
                <span style={{ flex: 1 }} />
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                  color: o.kind === 'reservation' ? '#4ADE80' : '#FBBF24',
                  fontFamily: 'Inter, sans-serif', textAlign: 'right',
                }}>
                  {o.kind === 'reservation'
                    ? (o.paidPct === 100 ? 'CONFIRMADO · 100% PAGADO' : `CONFIRMADO · ${o.paidPct ?? 50}% ABONADO`)
                    : 'SOLICITUD ENVIADA'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif', lineHeight: 1.35 }}>{o.name}</span>
                <span style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
                  Cantidad: {o.qty}
                  {o.price > 0 ? ` · $${Number(o.price).toFixed(2)} c/u` : ''}
                  {bs ? ` · ` : ''}
                  {bs && <span style={{ color: bs.color, fontWeight: 700 }}>{BRANCH_LABEL[o.branch]}</span>}
                </span>
                <span style={{ fontSize: 11, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
                  {new Date(o.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <button onClick={() => handleDownload(o)} disabled={downloadingId === o.id} style={{
                width: '100%', padding: '11px 0', borderRadius: 11,
                border: '1px solid rgba(251,191,36,0.45)', background: 'rgba(251,191,36,0.1)',
                color: '#FBBF24', fontSize: 13, fontWeight: 800,
                cursor: downloadingId === o.id ? 'default' : 'pointer',
                opacity: downloadingId === o.id ? 0.6 : 1,
                fontFamily: 'Inter, sans-serif',
              }}>
                {downloadingId === o.id ? 'Generando…' : '⬇ Descargar ticket'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
