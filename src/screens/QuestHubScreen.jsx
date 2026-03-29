// ─────────────────────────────────────────────
// QUEST — QuestHubScreen
// Logo tap → hub con Sucursales, Subastas, Productos, Membresía
// ─────────────────────────────────────────────
import { useState } from 'react'
import questLogo from '../assets/quest-logo-sm.png'
import { BRANCH_STYLES } from '../lib/constants'

// ── Minimal SVG icons ─────────────────────────
function Icon({ id, size = 24, color = 'currentColor' }) {
  const s = { width: size, height: size, display: 'block' }
  const p = { fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (id === 'map-pin') return (
    <svg style={s} viewBox="0 0 24 24" {...p}>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
  if (id === 'gavel') return (
    <svg style={s} viewBox="0 0 24 24" {...p}>
      <path d="m14.5 12.5-8 8a2.12 2.12 0 0 1-3-3l8-8"/>
      <path d="m16 16 6-6"/>
      <path d="m8 8 6-6"/>
      <path d="m9 7 8 8"/>
    </svg>
  )
  if (id === 'package') return (
    <svg style={s} viewBox="0 0 24 24" {...p}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
  if (id === 'gem') return (
    <svg style={s} viewBox="0 0 24 24" {...p}>
      <path d="M6 3h12l4 6-10 13L2 9Z"/>
      <path d="M11 3 8 9l4 13 4-13-3-6"/>
      <path d="M2 9h20"/>
    </svg>
  )
  if (id === 'user') return (
    <svg style={s} viewBox="0 0 24 24" {...p}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
  if (id === 'pin') return (
    <svg style={s} viewBox="0 0 24 24" {...p}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
  if (id === 'clock') return (
    <svg style={s} viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
  if (id === 'phone') return (
    <svg style={s} viewBox="0 0 24 24" {...p}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
  if (id === 'navigate') return (
    <svg style={s} viewBox="0 0 24 24" {...p}>
      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
    </svg>
  )
  return null
}

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
    icon:    'user',
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
    icon:    'gem',
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

            {[
              { icon: 'pin',      text: info.address },
              { icon: 'clock',    text: info.hours },
              { icon: 'phone',    text: info.phone },
            ].map(({ icon, text }) => (
              <div key={icon} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon id={icon} size={13} color="#4B5563" />
                <span style={{ fontSize: 12, color: '#6B7280' }}>{text}</span>
              </div>
            ))}

            <a
              href={info.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '9px 0', borderRadius: 10, textDecoration: 'none',
                background: bs.bg, border: `1px solid ${bs.border}`,
                color: bs.color, fontSize: 12, fontWeight: 700,
                fontFamily: 'Inter, sans-serif', marginTop: 8,
              }}
            >
              <Icon id="navigate" size={13} color={bs.color} /> Cómo llegar
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
              <Icon id={tier.icon} size={24} color={tier.color} />
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
    icon:    'map-pin',
    label:   'Sucursales',
    desc:    'Cómo llegar',
    color:   '#38BDF8',
    bg:      'rgba(56,189,248,0.08)',
    border:  'rgba(56,189,248,0.2)',
    enabled: true,
  },
  {
    id:      'subastas',
    icon:    'gavel',
    label:   'Subastas',
    desc:    'Pujas en vivo',
    color:   '#FCD34D',
    bg:      'rgba(252,211,77,0.08)',
    border:  'rgba(252,211,77,0.2)',
    enabled: true,
  },
  {
    id:      'productos',
    icon:    'package',
    label:   'Productos',
    desc:    'Próximamente',
    color:   '#4B5563',
    bg:      'rgba(75,85,99,0.06)',
    border:  'rgba(75,85,99,0.15)',
    enabled: false,
  },
  {
    id:      'membresia',
    icon:    'gem',
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
                <div style={{ marginBottom: 12 }}>
                  <Icon id={tile.icon} size={26} color={tile.enabled ? tile.color : '#374151'} />
                </div>
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
