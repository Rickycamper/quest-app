// ─────────────────────────────────────────────
// QUEST — QuestHubScreen
// Logo tap → hub con Sucursales, Subastas, Productos, Membresía
// ─────────────────────────────────────────────
import { useState } from 'react'
import questLogo from '../assets/quest-logo-sm.png'
import { BRANCH_STYLES } from '../lib/constants'

// ── Branch data ───────────────────────────────
const BRANCH_INFO = {
  Panama: {
    address: 'Ciudad de Panamá, Panamá',
    hours:   'Lun–Sáb 10am–8pm · Dom 11am–6pm',
    mapsUrl: 'https://maps.google.com/?q=Quest+Hobby+Store+Panama',
    phone:   '+507 6000-0000',
  },
  David: {
    address: 'David, Chiriquí, Panamá',
    hours:   'Lun–Sáb 10am–7pm · Dom 11am–5pm',
    mapsUrl: 'https://maps.google.com/?q=Quest+Hobby+Store+David+Panama',
    phone:   '+507 6000-0001',
  },
  Chitre: {
    address: 'Chitré, Herrera, Panamá',
    hours:   'Lun–Sáb 10am–7pm · Dom 11am–5pm',
    mapsUrl: 'https://maps.google.com/?q=Quest+Hobby+Store+Chitre+Panama',
    phone:   '+507 6000-0002',
  },
}

// ── Membership tiers ──────────────────────────
const MEMBERSHIP_TIERS = [
  {
    id:      'client',
    label:   'MEMBER',
    emoji:   '👤',
    color:   '#9CA3AF',
    bg:      'rgba(156,163,175,0.08)',
    border:  'rgba(156,163,175,0.2)',
    price:   'Gratis',
    perks: [
      'Acceso a torneos',
      'Rankings y claims',
      'Colección de cartas',
      'Chat con la comunidad',
      'Tracking de paquetes',
    ],
  },
  {
    id:      'premium',
    label:   'PREMIUM',
    emoji:   '💎',
    color:   '#A78BFA',
    bg:      'rgba(167,139,250,0.08)',
    border:  'rgba(167,139,250,0.3)',
    price:   'Consultar en tienda',
    perks: [
      'Todo lo de Member',
      'Badge exclusivo en el perfil',
      'Prioridad en subastas',
      'Acceso anticipado a eventos',
      'Descuentos en tienda',
    ],
  },
]

// ── Sucursales view ───────────────────────────
function SucursalesView({ onBack }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>
          Encuéntranos en nuestras 3 sucursales en Panamá.
        </div>
      </div>

      {['Panama', 'David', 'Chitre'].map(branch => {
        const bs   = BRANCH_STYLES[branch]
        const info = BRANCH_INFO[branch]
        return (
          <div key={branch} style={{
            background: '#111', borderRadius: 14,
            border: `1px solid ${bs.border}`,
            borderLeft: `3px solid ${bs.dot}`,
            padding: '16px 16px 14px', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: bs.dot, flexShrink: 0,
                boxShadow: `0 0 6px ${bs.dot}`,
              }} />
              <span style={{ fontSize: 15, fontWeight: 800, color: '#FFF' }}>{branch}</span>
            </div>

            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
              📍 {info.address}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
              🕐 {info.hours}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>
              📞 {info.phone}
            </div>

            <a
              href={info.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 0', borderRadius: 10, textDecoration: 'none',
                background: bs.bg, border: `1px solid ${bs.border}`,
                color: bs.color, fontSize: 12, fontWeight: 700,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              🗺️ Cómo llegar
            </a>
          </div>
        )
      })}
    </div>
  )
}

// ── Membresía view ────────────────────────────
function MembresiaView() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px' }}>
      <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 20, lineHeight: 1.5 }}>
        Únete a la comunidad TCG de Panamá. Elige el plan que va contigo.
      </div>

      {MEMBERSHIP_TIERS.map(tier => (
        <div key={tier.id} style={{
          background: tier.bg, borderRadius: 14,
          border: `1px solid ${tier.border}`,
          padding: '18px 16px', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 26 }}>{tier.emoji}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: tier.color, letterSpacing: '0.05em' }}>
                  {tier.label}
                </div>
                <div style={{ fontSize: 11, color: '#4B5563', marginTop: 1 }}>{tier.price}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {tier.perks.map((perk, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: `${tier.color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: tier.color, fontWeight: 800,
                }}>✓</div>
                <span style={{ fontSize: 12, color: '#D1D5DB' }}>{perk}</span>
              </div>
            ))}
          </div>

          {tier.id === 'premium' && (
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)',
              fontSize: 12, color: '#6B7280', textAlign: 'center', lineHeight: 1.5,
            }}>
              Consulta en cualquier sucursal para activar tu membresía Premium
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Hub tiles ─────────────────────────────────
const TILES = [
  {
    id:      'sucursales',
    emoji:   '🗺️',
    label:   'Sucursales',
    desc:    'Cómo llegar',
    color:   '#38BDF8',
    bg:      'rgba(56,189,248,0.08)',
    border:  'rgba(56,189,248,0.2)',
    enabled: true,
  },
  {
    id:      'subastas',
    emoji:   '🔨',
    label:   'Subastas',
    desc:    'Pujas en vivo',
    color:   '#FCD34D',
    bg:      'rgba(252,211,77,0.08)',
    border:  'rgba(252,211,77,0.2)',
    enabled: true,
  },
  {
    id:      'productos',
    emoji:   '📦',
    label:   'Productos',
    desc:    'Próximamente',
    color:   '#4B5563',
    bg:      'rgba(75,85,99,0.06)',
    border:  'rgba(75,85,99,0.15)',
    enabled: false,
  },
  {
    id:      'membresia',
    emoji:   '💎',
    label:   'Membresía',
    desc:    'Planes y beneficios',
    color:   '#A78BFA',
    bg:      'rgba(167,139,250,0.08)',
    border:  'rgba(167,139,250,0.2)',
    enabled: true,
  },
]

// ── Main component ────────────────────────────
export default function QuestHubScreen({ onClose, onOpenAuction }) {
  const [view, setView] = useState(null) // null | 'sucursales' | 'membresia'

  const handleTile = (tile) => {
    if (!tile.enabled) return
    if (tile.id === 'subastas') { onOpenAuction(); onClose(); return }
    setView(tile.id)
  }

  const viewTitle = view === 'sucursales' ? 'Sucursales' : view === 'membresia' ? 'Membresía' : ''

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      background: '#0A0A0A', display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      animation: 'slideDown 0.22s ease',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px 12px',
        background: '#0D0D0D', borderBottom: '1px solid #1A1A1A', flexShrink: 0,
      }}>
        {view ? (
          <button onClick={() => setView(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#6B7280', fontSize: 20, lineHeight: 1, padding: '0 2px',
          }}>←</button>
        ) : (
          <img src={questLogo} alt="Quest" style={{ width: 72, height: 'auto' }} />
        )}
        {view && (
          <span style={{ fontSize: 16, fontWeight: 800, color: '#FFF' }}>{viewTitle}</span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(255,255,255,0.05)', border: '1px solid #222',
          color: '#6B7280', fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      </div>

      {/* Sub-views */}
      {view === 'sucursales' && <SucursalesView onBack={() => setView(null)} />}
      {view === 'membresia'  && <MembresiaView />}

      {/* Main tiles grid */}
      {!view && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 32px' }}>
          <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 20 }}>
            ¿Qué querés explorar?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {TILES.map(tile => (
              <button
                key={tile.id}
                onClick={() => handleTile(tile)}
                disabled={!tile.enabled}
                style={{
                  background: tile.enabled ? tile.bg : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${tile.enabled ? tile.border : '#1A1A1A'}`,
                  borderRadius: 16, padding: '20px 16px',
                  cursor: tile.enabled ? 'pointer' : 'default',
                  textAlign: 'left', position: 'relative', overflow: 'hidden',
                  opacity: tile.enabled ? 1 : 0.45,
                  transition: 'opacity 0.15s',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <div style={{ fontSize: 30, marginBottom: 10 }}>{tile.emoji}</div>
                <div style={{
                  fontSize: 14, fontWeight: 800,
                  color: tile.enabled ? tile.color : '#374151',
                  marginBottom: 4,
                }}>{tile.label}</div>
                <div style={{ fontSize: 11, color: '#4B5563' }}>{tile.desc}</div>
                {!tile.enabled && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    fontSize: 9, fontWeight: 800, color: '#4B5563',
                    background: 'rgba(75,85,99,0.15)', border: '1px solid #222',
                    borderRadius: 6, padding: '2px 7px', letterSpacing: '0.06em',
                  }}>PRONTO</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
