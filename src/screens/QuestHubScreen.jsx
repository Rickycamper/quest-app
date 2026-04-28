// ─────────────────────────────────────────────
// QUEST — QuestHubScreen
// Logo tap → hub con Sucursales, Subastas, Productos, Membresía
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import questLogo from '../assets/quest-logo-sm.png'
import { BRANCH_STYLES } from '../lib/constants'
import { getPointsHistory, redeemPoints, getMembershipUsageSummary } from '../lib/supabase'
import { SAWizardHat, SAGem, SACrown, SATruck, SALock, SABolt, SAGavel, SAFlag, SACircleCheck, SAFire, SADungeon } from '../components/Icons'
import Avatar from '../components/Avatar'

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
    <svg style={{ ...s, fill: color }} viewBox="0 0 16 16" fill={color}>
      <path d="M9.9165625 0.44855625c-0.3827 -0.3827 -1.00420625 -0.3827 -1.38690625 0L4.855734375 4.12248125c-0.3827 0.3827 -0.3827 1.004203125 0 1.38690625l0.48985625 0.48985625c0.3827 0.3827 1.00420625 0.3827 1.38690625 0l0.1224625 -0.122465625 3.26979375 3.26673125 -0.122465625 0.1224625c-0.3827 0.3827 -0.3827 1.00420625 0 1.38690625l0.48985625 0.48985625c0.3827 0.382703125 1.00420625 0.382703125 1.38690625 0L15.552975 7.4688125c0.3827 -0.3827 0.3827 -1.00420625 0 -1.38690625l-0.48985625 -0.48985625c-0.3827 -0.3827 -1.00420625 -0.3827 -1.38690625 0l-0.122465625 0.1224625L10.28395625 2.444721875l0.1224625 -0.122465625c0.3827 -0.3827 0.3827 -1.00420625 0 -1.38690625L9.9165625 0.44549375ZM5.262928125 9.265971875c-0.382703125 -0.3827 -1.00420625 -0.3827 -1.38690625 0L0.447025 12.69496875c-0.3827 0.3827 -0.3827 1.00420625 0 1.38690625l1.46956875 1.46956875c0.3827 0.3827 1.00420625 0.3827 1.38690625 0l3.428996875 -3.42899375c0.3827 -0.382703125 0.3827 -1.00420625 0 -1.38690625l-0.0428625 -0.0428625 1.800221875 -1.7971625 -1.38690625 -1.38690625 -1.7971625 1.7971625 -0.0428625 -0.0428625Z" strokeWidth="0"/>
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
    <svg style={{ ...s, fill: color }} viewBox="0 0 16 16" fill={color}>
      <path d="M3.73444375 1.316059375c0.137815625 -0.1868125 0.358315625 -0.300125 0.591065625 -0.300125h7.3500375c0.23275 0 0.453253125 0.11025 0.591065625 0.300125l3.430015625 4.655025c0.20825 0.28175 0.1868125 0.670690625 -0.0459375 0.931003125L8.54565625 14.742128125c-0.1378125 0.153125 -0.336878125 0.2419375 -0.545128125 0.2419375s-0.404253125 -0.0888125 -0.545128125 -0.2419375L0.350365625 6.9020875c-0.235815625 -0.2603125 -0.254190625 -0.649253125 -0.0459375 -0.931003125L3.73444375 1.316059375Zm1.17906875 1.21888125c-0.1010625 0.0765625 -0.128625 0.214378125 -0.0643125 0.321565625l1.757884375 2.9277625L2.0990625 6.160959375c-0.1255625 0.0091875 -0.223565625 0.116375 -0.223565625 0.245003125s0.098003125 0.23275 0.223565625 0.245l5.880028125 0.490003125h0.0398125l5.88003125 -0.490003125c0.1255625 -0.0091875 0.2235625 -0.116375 0.2235625 -0.245s-0.098 -0.232753125 -0.2235625 -0.245003125l-4.5049625 -0.373625 1.757884375 -2.927765625c0.0643125 -0.1071875 0.03675 -0.2480625 -0.0643125 -0.321565625s-0.2419375 -0.06125 -0.3276875 0.030625l-2.759328125 2.985953125 -2.759325 -2.989015625c-0.08575 -0.091875 -0.226628125 -0.104125 -0.327690625 -0.030625Z" strokeWidth="0"/>
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
  if (id === 'diamond') return (
    <svg style={s} viewBox="0 0 16 16" fill="none">
      <path d="m14.281666666666666 6.706533333333333 -4.531466666666667 -5.809333333333333c-0.22759999999999997 -0.237 -0.5015333333333333 -0.42466666666666664 -0.8046666666666666 -0.5514666666666667 -0.30319999999999997 -0.1268 -0.6291333333333333 -0.18993333333333332 -0.9577333333333333 -0.18553333333333333 -0.32853333333333334 0.004399999999999999 -0.6527333333333333 0.07626666666666666 -0.9524 0.2112 -0.29966666666666664 0.13479999999999998 -0.5684666666666667 0.3298 -0.7895999999999999 0.5728666666666666l-4.507933333333333 5.762266666666666c-0.24953333333333333 0.38539999999999996 -0.38293333333333335 0.8344666666666667 -0.3841333333333333 1.2935999999999999 0.013066666666666666 0.4401333333333333 0.14593333333333333 0.8684 0.3841333333333333 1.2386666666666666l0.04706666666666666 0.05486666666666666 4.500066666666666 5.809333333333333c0.2215333333333333 0.23459999999999998 0.48906666666666665 0.4210666666666667 0.7857333333333334 0.5478666666666666 0.2967333333333333 0.1267333333333333 0.6163333333333333 0.19113333333333332 0.9390000000000001 0.18906666666666666 0.33359999999999995 -0.0002666666666666667 0.6635333333333333 -0.07013333333333333 0.9685333333333334 -0.2051333333333333 0.3051333333333333 -0.135 0.5786666666666667 -0.3321333333333333 0.8033333333333333 -0.5788l4.500066666666666 -5.762333333333332c0.24593333333333334 -0.38859999999999995 0.37259999999999993 -0.8408 0.36419999999999997 -1.3006 -0.0084 -0.4598 -0.15126666666666666 -0.9071333333333333 -0.41126666666666667 -1.2865333333333333h0.04706666666666666Z" fill={color} strokeWidth="0"/>
    </svg>
  )
  if (id === 'edit') return (
    <svg style={s} viewBox="0 0 24 24" {...p}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
  if (id === 'zap') return (
    <svg style={s} viewBox="0 0 24 24" {...p}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
  if (id === 'coin') return (
    <svg style={{ ...s, fill: color }} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill={color} opacity="0.9"/>
      <text x="12" y="17" textAnchor="middle" fontSize="12" fontWeight="800" fill="#111" fontFamily="Inter,sans-serif">Q</text>
    </svg>
  )
  if (id === 'folder') return (
    <svg style={s} viewBox="0 0 24 24" {...p}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )
  if (id === 'heart') return (
    <svg style={{ ...s, fill: color }} viewBox="0 0 24 24">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
  if (id === 'shop') return (
    <svg style={s} viewBox="0 0 24 24" {...p}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
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
    id: 'wizard', rank: 'RANK 1', name: 'WIZARD', price: '$20', color: '#60A5FA',
    bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.28)', popular: false,
    Icon: SAWizardHat,
    store: [
      { icon: 'fire',  text: '1 booster gratis al mes — cualquier TCG, standard set' },
      { icon: 'flag',  text: '1 inscripción de torneo regular gratis al mes' },
      { icon: 'gem',   text: 'Tarjeta de acceso Quest' },
      { icon: 'bolt',  text: '10% de descuento en tu cumpleaños' },
      { icon: 'bolt',  text: 'Ofertas exclusivas para miembros' },
      { icon: 'truck', text: 'Envío gratis Quest a Quest' },
    ],
    app: [
      { icon: 'gavel',   text: 'Poder subastar' },
      { icon: 'fire',    text: 'Posts ilimitados' },
      { icon: 'bolt',    text: 'Reset de versus manual' },
      { icon: 'bolt',    text: 'Q Coins ×2' },
    ],
  },
  {
    id: 'mage', rank: 'RANK 2', name: 'MAGE', price: '$30', color: '#A78BFA',
    bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.38)', popular: true,
    Icon: SAGem,
    store: [
      { icon: 'fire',  text: '2 boosters gratis al mes — cualquier TCG, standard set' },
      { icon: 'flag',  text: '2 inscripciones a torneos regulares gratis al mes' },
      { icon: 'gem',   text: 'Tarjeta de acceso Quest' },
      { icon: 'truck', text: 'Envío gratis Quest a Quest' },
      { icon: 'bolt',  text: '20% de descuento en tu cumpleaños' },
      { icon: 'bolt',  text: 'Ofertas exclusivas para miembros' },
      { icon: 'lock',  text: 'Locker gratis' },
    ],
    app: [
      { icon: 'gavel',   text: 'Poder subastar' },
      { icon: 'fire',    text: 'Posts ilimitados' },
      { icon: 'bolt',    text: 'Reset de versus manual' },
      { icon: 'bolt',    text: 'Q Coins ×3' },
      { icon: 'dungeon', text: 'Acceso a pre-sale, singles y Sealed antes que al público' },
    ],
  },
  {
    id: 'archmage', rank: 'RANK 3', name: 'ARCHMAGE', price: '$40', color: '#FBBF24',
    bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.32)', popular: false,
    Icon: SACrown,
    store: [
      { icon: 'fire',  text: '3 boosters gratis al mes — cualquier TCG, standard set' },
      { icon: 'flag',  text: '3 inscripciones a torneos regulares gratis al mes' },
      { icon: 'gem',   text: 'Tarjeta de acceso Quest' },
      { icon: 'truck', text: 'Envío gratis Quest a Quest' },
      { icon: 'bolt',  text: '30% de descuento en tu cumpleaños' },
      { icon: 'bolt',  text: 'Ofertas exclusivas para miembros' },
      { icon: 'lock',  text: 'Locker gratis' },
    ],
    app: [
      { icon: 'gavel',   text: 'Poder subastar' },
      { icon: 'fire',    text: 'Posts ilimitados' },
      { icon: 'bolt',    text: 'Reset de versus manual' },
      { icon: 'bolt',    text: 'Q Coins ×4' },
      { icon: 'dungeon', text: 'Acceso a pre-sale, singles y Sealed antes que al público' },
    ],
  },
]

const BENEFIT_ICON = {
  fire:    (c) => <SAFire    size={13} color={c} />,
  flag:    (c) => <SAFlag    size={13} color={c} />,
  gem:     (c) => <SAGem     size={13} color={c} />,
  bolt:    (c) => <SABolt    size={13} color={c} />,
  truck:   (c) => <SATruck   size={13} color={c} />,
  lock:    (c) => <SALock    size={13} color={c} />,
  gavel:   (c) => <SAGavel   size={13} color={c} />,
  dungeon: (c) => <SADungeon size={13} color={c} />,
}

const MEMBERSHIP_WA = '50766130548'

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

// ── Tier config (mirrors AdminScreen) ─────────
const TIER_CONFIG_HUB = {
  wizard:   { label: 'Wizard',   color: '#60A5FA', booster: 1, tournament: 1 },
  mage:     { label: 'Mage',     color: '#A78BFA', booster: 2, tournament: 2 },
  archmage: { label: 'Archmage', color: '#FBBF24', booster: 3, tournament: 3 },
  premium:  { label: 'Premium',  color: '#F97316', booster: 1, tournament: 1 },
}
const HUB_PAID = new Set(['wizard', 'mage', 'archmage', 'premium'])

function MiniBar({ label, used, allowed, color }) {
  const pct = allowed > 0 ? Math.min(used / allowed, 1) : 0
  const full = used >= allowed
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: full ? '#F87171' : color }}>
          {used}/{allowed}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 4, background: '#1F1F1F', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${pct * 100}%`, background: full ? '#F87171' : color, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ fontSize: 10, color: full ? '#F87171' : '#4B5563', marginTop: 3 }}>
        {full ? 'Agotado' : `${allowed - used} disponible${(allowed - used) !== 1 ? 's' : ''}`}
      </div>
    </div>
  )
}

// ── Membresía view ────────────────────────────
function MembresiaView({ profile }) {
  const [open,    setOpen]    = useState({})
  const [usage,   setUsage]   = useState(null)
  const toggle = (key) => setOpen(p => ({ ...p, [key]: !p[key] }))

  const isPaid = HUB_PAID.has(profile?.role)
  const myTier = TIER_CONFIG_HUB[profile?.role]

  useEffect(() => {
    if (!isPaid || !profile?.id) return
    getMembershipUsageSummary(profile.id)
      .then(setUsage)
      .catch(() => setUsage([]))
  }, [profile?.id, profile?.role])

  const getU = (benefit) => {
    const row = usage?.find(u => u.benefit === benefit)
    return { used: row?.used ?? 0, allowed: row?.allowed ?? myTier?.[benefit] ?? 0 }
  }

  const monthName = new Date().toLocaleDateString('es', { month: 'long', year: 'numeric' })

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 40px' }}>

      {/* ── My plan card (only when member) ── */}
      {isPaid && myTier && (
        <div style={{
          background: `${myTier.color}0D`,
          border: `1.5px solid ${myTier.color}35`,
          borderRadius: 16, padding: '16px 18px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: `${myTier.color}99`, letterSpacing: '0.12em', marginBottom: 3 }}>TU PLAN</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: myTier.color }}>{myTier.label.toUpperCase()}</div>
            </div>
            <div style={{ fontSize: 11, color: '#4B5563', textAlign: 'right' }}>
              <div style={{ fontWeight: 700, color: '#9CA3AF', textTransform: 'capitalize' }}>{monthName}</div>
              <div style={{ marginTop: 2 }}>Uso mensual</div>
            </div>
          </div>

          {usage === null ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${myTier.color}40`, borderTopColor: myTier.color, animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16 }}>
              <MiniBar label="🎴 Boosters"  {...getU('booster')}    color={myTier.color} />
              <MiniBar label="🏆 Torneos"   {...getU('tournament')} color={myTier.color} />
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, color: '#4B5563', marginBottom: 12, lineHeight: 1.6 }}>
        {isPaid ? 'Tus beneficios incluidos en el plan.' : 'Elige tu rango y actívalo en cualquier sucursal Quest.'}
      </div>

      {/* National coverage note */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)',
        borderRadius: 12, padding: '10px 14px', marginBottom: 20,
      }}>
        <SAFlag size={14} color="#34D399" />
        <span style={{ fontSize: 12, color: '#34D399', fontWeight: 600, lineHeight: 1.5 }}>
          Tus beneficios de tienda aplican en cualquier sucursal Quest a nivel nacional.
        </span>
      </div>

      {MEMBERSHIP_TIERS.map(tier => {
        const { Icon } = tier
        const waText = encodeURIComponent(`Hola Quest! Me interesa la membresía ${tier.name} ($${tier.price.replace('$','')}/mes). ¿Cómo la activo?`)
        return (
        <div key={tier.id} style={{
          background: tier.bg,
          borderRadius: 20,
          border: `1.5px solid ${tier.border}`,
          marginBottom: 18,
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* popular strip */}
          {tier.popular && (
            <div style={{
              background: `linear-gradient(90deg, ${tier.color}CC, ${tier.color}88)`,
              padding: '5px 0', textAlign: 'center',
              fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#000',
            }}>★ MÁS POPULAR</div>
          )}

          {/* ── Header ── */}
          <div style={{ padding: '22px 20px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Tier icon with glow */}
            <div style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: `${tier.color}18`,
              border: `1.5px solid ${tier.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 18px ${tier.color}40`,
            }}>
              <Icon size={28} color={tier.color} />
            </div>
            {/* Name + price */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: `${tier.color}99`, letterSpacing: '0.14em', marginBottom: 2 }}>
                {tier.rank}
              </div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 34, lineHeight: 1, color: tier.color,
                textShadow: `0 0 24px ${tier.color}70`,
                letterSpacing: '0.04em',
              }}>
                {tier.name}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, color: '#FFF', lineHeight: 1 }}>
                {tier.price}
              </div>
              <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>/mes</div>
            </div>
          </div>

          {/* ── Store benefits ── */}
          <div style={{ height: 1, background: `${tier.color}18` }} />
          <button onClick={() => toggle(`${tier.id}-store`)} style={{
            width: '100%', padding: '13px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SATruck size={14} color={tier.color} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#D1D5DB' }}>Tienda</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: tier.color, background: `${tier.color}22`, borderRadius: 10, padding: '2px 7px' }}>
                {tier.store.length}
              </span>
            </div>
            <span style={{ fontSize: 11, color: '#4B5563', display: 'inline-block', transform: open[`${tier.id}-store`] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
          </button>
          {open[`${tier.id}-store`] && (
            <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tier.store.map((perk, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 8, flexShrink: 0,
                    background: `${tier.color}18`, border: `1px solid ${tier.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {BENEFIT_ICON[perk.icon]?.(tier.color)}
                  </div>
                  <span style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6, paddingTop: 3 }}>{perk.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── App benefits ── */}
          <div style={{ height: 1, background: `${tier.color}12` }} />
          <button onClick={() => toggle(`${tier.id}-app`)} style={{
            width: '100%', padding: '13px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SABolt size={14} color={tier.color} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#D1D5DB' }}>App</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: tier.color, background: `${tier.color}22`, borderRadius: 10, padding: '2px 7px' }}>
                {tier.app.length}
              </span>
            </div>
            <span style={{ fontSize: 11, color: '#4B5563', display: 'inline-block', transform: open[`${tier.id}-app`] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
          </button>
          {open[`${tier.id}-app`] && (
            <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tier.app.map((perk, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 8, flexShrink: 0,
                    background: `${tier.color}18`, border: `1px solid ${tier.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {BENEFIT_ICON[perk.icon]?.(tier.color)}
                  </div>
                  <span style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6, paddingTop: 3 }}>{perk.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── WhatsApp CTA ── */}
          <div style={{ padding: '0 16px 16px' }}>
            <a
              href={`https://wa.me/${MEMBERSHIP_WA}?text=${waText}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                padding: '13px 0', borderRadius: 12, textDecoration: 'none',
                background: `linear-gradient(135deg, ${tier.color}22, ${tier.color}0D)`,
                border: `1.5px solid ${tier.color}50`,
                color: tier.color, fontFamily: 'Inter, sans-serif',
                fontSize: 13, fontWeight: 800,
                boxShadow: `0 4px 20px ${tier.color}25`,
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill={tier.color}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              Activar {tier.name}
            </a>
          </div>
        </div>
        )
      })}
    </div>
  )
}

// ── Reason → readable label + emoji ──────────
const REASON_LABEL = {
  post_created:        { label: 'Creaste un post',           emoji: '📝' },
  like_received:       { label: 'Recibiste un like',          emoji: '⚡' },
  match_won:           { label: 'Ganaste una partida',        emoji: '⚔️' },
  shipment_confirmed:  { label: 'Envío confirmado',           emoji: '📦' },
  'Ganaste una subasta':{ label: 'Ganaste una subasta',       emoji: '🏆' },
  'Canje solicitado':  { label: 'Canje solicitado',           emoji: '💎' },
  'Reembolso — canje rechazado': { label: 'Canje rechazado — reembolso', emoji: '🔄' },
}
function reasonLabel(r) {
  const m = REASON_LABEL[r]
  return m ? `${m.emoji} ${m.label}` : r
}

function timeAgo(d) {
  const m = Math.floor((Date.now() - new Date(d)) / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ── Q Points view ─────────────────────────────
function QPointsView({ profile, onRedeemed }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [redeemAmt,  setRedeemAmt]  = useState(1000)
  const [redeemBusy, setRedeemBusy] = useState(false)
  const [redeemMsg,  setRedeemMsg]  = useState('')
  const [balance, setBalance]       = useState(profile?.q_points ?? 0)

  // Sync balance with profile.q_points — realtime channel (AuthContext) pushes
  // new totals after award_points/redeem_points RPCs fire. Without this the
  // big balance card would stay frozen at its mount-time value.
  useEffect(() => {
    if (typeof profile?.q_points === 'number') setBalance(profile.q_points)
  }, [profile?.q_points])

  useEffect(() => {
    getPointsHistory()
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const canRedeem = balance >= 1000

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 40px' }}>
      {/* Balance card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.04))',
        border: '1.5px solid rgba(251,191,36,0.25)',
        borderRadius: 16, padding: '20px 20px 18px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Icon id="diamond" size={13} color="#FBBF24" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E', letterSpacing: '0.08em' }}>TUS Q COINS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 48, fontWeight: 800, color: '#FBBF24', fontFamily: 'Inter, sans-serif', lineHeight: 1 }}>
            {balance.toLocaleString()}
          </span>
          <span style={{ fontSize: 14, color: '#92400E', fontWeight: 700 }}>Q Coins</span>
        </div>
        <div style={{ fontSize: 12, color: '#92400E', marginTop: 4 }}>
          ≈ ${(balance / 1000).toFixed(2)} en crédito de tienda
        </div>
      </div>

      {/* Redeem section */}
      {canRedeem && (
        <div style={{
          background: '#111', border: '1px solid #2A2A2A',
          borderRadius: 14, padding: '14px 14px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon id="diamond" size={12} color="#FBBF24" />
            Canjear Q Coins
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[1000, 2000, 5000].filter(v => v <= balance).map(v => (
              <button key={v} onClick={() => setRedeemAmt(v)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8,
                background: redeemAmt === v ? 'rgba(251,191,36,0.15)' : '#1A1A1A',
                border: `1.5px solid ${redeemAmt === v ? 'rgba(251,191,36,0.5)' : '#2A2A2A'}`,
                color: redeemAmt === v ? '#FBBF24' : '#6B7280',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
                {v.toLocaleString()}<br/>
                <span style={{ fontSize: 10 }}>${(v / 1000).toFixed(2)}</span>
              </button>
            ))}
          </div>
          {redeemMsg && (
            <div style={{ fontSize: 12, color: redeemMsg.startsWith('✅') ? '#4ADE80' : '#F87171', marginBottom: 10, fontFamily: 'Inter, sans-serif' }}>
              {redeemMsg}
            </div>
          )}
          <button
            disabled={redeemBusy}
            onClick={async () => {
              setRedeemBusy(true); setRedeemMsg('')
              try {
                await redeemPoints(redeemAmt)
                setBalance(b => b - redeemAmt)
                setHistory(h => [{ amount: -redeemAmt, reason: 'Canje solicitado', created_at: new Date().toISOString() }, ...h])
                setRedeemMsg('✅ Solicitud enviada — un admin la procesará pronto')
                onRedeemed?.()
              } catch (e) { setRedeemMsg(e.message || 'Error al canjear') }
              setRedeemBusy(false)
            }}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10,
              background: redeemBusy ? '#1A1A1A' : '#FBBF24',
              border: 'none', color: redeemBusy ? '#555' : '#111',
              fontSize: 14, fontWeight: 800, cursor: redeemBusy ? 'default' : 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {redeemBusy ? 'Procesando…' : `Canjear ${redeemAmt.toLocaleString()} Q Coins → $${(redeemAmt / 1000).toFixed(2)}`}
          </button>
        </div>
      )}

      {/* How to earn */}
      <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 14, padding: '14px 14px 8px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#4B5563', marginBottom: 10 }}>Cómo ganar Q Coins</div>
        {[
          ['edit',    'Crear un post',              '+10', 'máx 5/día'],
          ['heart',   'Recibir un like',             '+1',  ''],
          ['zap',     'Ganar partida confirmada',    '+1',  'máx 5/día'],
          ['package', 'Envío confirmado',            '+10', ''],
          ['gavel',   'Ganar una subasta',           '+10', ''],
        ].map(([iconId, label, coins, cap]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #1A1A1A' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon id={iconId} size={14} color="#6B7280" />
              <span style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>{label}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#FBBF24', fontFamily: 'Inter, sans-serif' }}>{coins}</span>
              {cap && <div style={{ fontSize: 9, color: '#4B5563' }}>{cap}</div>}
            </div>
          </div>
        ))}
        <div style={{ fontSize: 10, color: '#374151', marginTop: 8, textAlign: 'center' }}>1000 Q Coins = $1.00 en tienda</div>
      </div>

      {/* Premium upsell */}
      {profile?.role !== 'premium' && profile?.role !== 'admin' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(167,139,250,0.04))',
          border: '1.5px solid rgba(167,139,250,0.25)',
          borderRadius: 14, padding: '14px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Icon id="diamond" size={22} color="#A78BFA" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#A78BFA', marginBottom: 2 }}>Hazte Premium</div>
            <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.4 }}>
              Multiplica tus Q Coins <span style={{ color: '#A78BFA', fontWeight: 700 }}>×2</span> en cada acción que realices
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#4B5563', marginBottom: 10 }}>Historial</div>
      {loading && <div style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FBBF24', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
      </div>}
      {!loading && history.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: '#4B5563', fontSize: 13 }}>
          Aún no hay movimientos — ¡empieza a ganar Q Coins!
        </div>
      )}
      {history.map((h, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0', borderBottom: '1px solid #111',
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#D1D5DB', fontFamily: 'Inter, sans-serif' }}>{reasonLabel(h.reason)}</div>
            <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>{timeAgo(h.created_at)}</div>
          </div>
          <span style={{
            fontSize: 14, fontWeight: 800, fontFamily: 'Inter, sans-serif',
            color: h.amount > 0 ? '#4ADE80' : '#F87171',
          }}>
            {h.amount > 0 ? '+' : ''}{h.amount}
          </span>
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
    id:      'tracking',
    icon:    'package',
    label:   'Tracking',
    desc:    'Mis paquetes',
    color:   '#FB923C',
    bg:      'rgba(251,146,60,0.08)',
    border:  'rgba(251,146,60,0.2)',
    enabled: true,
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
  {
    id:      'folder',
    icon:    'folder',
    label:   'Folder',
    desc:    'Tu colección',
    color:   '#34D399',
    bg:      'rgba(52,211,153,0.08)',
    border:  'rgba(52,211,153,0.2)',
    enabled: true,
  },
]

// ── Main component ────────────────────────────
export default function QuestHubScreen({ onClose, onOpenAuction, onOpenLifeCounter, onOpenFolder, onOpenProfile, onOpenTracking, onOpenShop, profile, initialView = null }) {
  const [view, setView] = useState(initialView) // null | 'sucursales' | 'membresia' | 'qpoints'

  const handleTile = (tile) => {
    if (!tile.enabled) return
    if (tile.id === 'subastas')    { onOpenAuction(); onClose(); return }
    if (tile.id === 'lifecounter') { onOpenLifeCounter(); onClose(); return }
    if (tile.id === 'folder')      { onOpenFolder?.(); onClose(); return }
    if (tile.id === 'tracking')    { onOpenTracking?.(); onClose(); return }
    if (tile.id === 'shop')        { onOpenShop?.(); onClose(); return }
    setView(tile.id)
  }

  const viewTitle = view === 'sucursales' ? 'Sucursales' : view === 'membresia' ? 'Membresía' : view === 'qpoints' ? 'Q Coins' : ''

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
      {view === 'membresia'  && <MembresiaView profile={profile} />}
      {view === 'qpoints'    && <QPointsView profile={profile} />}

      {/* Main tiles grid */}
      {!view && (
        <>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 32px' }}>
          {/* Search bar */}
          <button
            onClick={() => { onClose(); setTimeout(() => window.__questOpenSearch?.(), 80) }}
            style={{
              width: '100%', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', borderRadius: 12,
              background: '#111', border: '1px solid #1E1E1E',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif',
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span style={{ fontSize: 13, color: '#4B5563' }}>Buscar jugadores, cartas...</span>
          </button>

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

        {/* Profile row — fixed footer */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid #1A1A1A',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          background: '#0D0D0D', flexShrink: 0,
        }}>
          <button
            onClick={() => { onOpenProfile?.(); onClose() }}
            style={{
              width: '100%', padding: '12px 16px',
              background: '#111', border: '1px solid #1E1E1E', borderRadius: 16,
              display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif',
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
              <Avatar url={profile?.avatar_url} size={36} role={profile?.role} isOwner={profile?.is_owner} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>
                {profile?.username ?? 'Mi perfil'}
              </div>
              <div style={{ fontSize: 11, color: '#4B5563', marginTop: 1 }}>Ver tu perfil</div>
            </div>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
        </>
      )}
    </div>
  )
}
