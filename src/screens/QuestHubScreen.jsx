// ─────────────────────────────────────────────
// QUEST — QuestHubScreen
// Logo tap → hub con Sucursales, Subastas, Productos, Membresía
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import questLogo from '../assets/quest-logo-sm.png'
import { BRANCH_STYLES, GAME_STYLES } from '../lib/constants'
import { getPointsHistory, redeemPoints, getMembershipUsageSummary, getMyStats, getMyMatchHistory, resetMyMatches } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import { RotateCcw, Swords } from 'lucide-react'
import { SAWizardHat, SAGem, SACrown, SATruck, SALock, SABolt, SAGavel, SAFlag, SACircleCheck, SAFire, SADungeon } from '../components/Icons'
import GameIcon from '../components/GameIcon'
import Avatar from '../components/Avatar'
import ImportDeckModal from './ImportDeckModal'
import CreateDeckBuilder from './CreateDeckBuilder'
import DeckCardGrid from '../components/DeckCardGrid'
import { proxyIfNeeded } from '../lib/cardImages'

// ── Icons (Lucide) ────────────────────────────
// One small lookup so all the inline string-ids ('map-pin', 'gavel',
// etc.) keep working without rewriting every call site.
import {
  MapPin, Gavel, Package, Gem, User, Clock, Phone, Navigation,
  Pencil, Zap, Folder, BarChart3, Heart, ShoppingBag, Layers,
  ChevronLeft, X,
} from 'lucide-react'

const HUB_ICON_MAP = {
  'map-pin':  MapPin,
  'pin':      MapPin,
  'gavel':    Gavel,
  'package':  Package,
  'gem':      Gem,
  'user':     User,
  'clock':    Clock,
  'phone':    Phone,
  'navigate': Navigation,
  'diamond':  Gem,
  'edit':     Pencil,
  'zap':      Zap,
  'folder':   Folder,
  'chart':    BarChart3,
  'heart':    Heart,
  'shop':     ShoppingBag,
  'deck':     Layers,
}

function Icon({ id, size = 24, color = 'currentColor' }) {
  // Special-case: the branded 'coin' badge — stays a custom Q so it
  // reads like Quest currency, not a generic Lucide coin.
  if (id === 'coin') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
        <circle cx="12" cy="12" r="10" fill={color} opacity="0.9" />
        <text x="12" y="17" textAnchor="middle" fontSize="12" fontWeight="800" fill="#111" fontFamily="Inter,sans-serif">Q</text>
      </svg>
    )
  }
  // 'live' — punto rojo con ondas de transmisión (badge en vivo)
  if (id === 'live') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" style={{ display: 'block' }}>
        <circle cx="12" cy="12" r="2.5" fill={color} stroke="none" />
        <path d="M8 8a5.5 5.5 0 0 0 0 8M16 8a5.5 5.5 0 0 1 0 8" />
        <path d="M5 5a9 9 0 0 0 0 14M19 5a9 9 0 0 1 0 14" opacity="0.55" />
      </svg>
    )
  }
  const Lucide = HUB_ICON_MAP[id]
  if (!Lucide) return null
  return <Lucide size={size} color={color} strokeWidth={1.8} />
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
// ── Battle Stats — match history + per-TCG volume chart + Battle Now ──
// Premium / admin / owner users can reset their visible record (drops a
// localStorage cutoff so anything older stops counting in their view).
// ── DecksView — Mis Decks ────────────────────────────────────────
// Lista de decks guardados del usuario + acceso al import modal.
// Tap un deck → muestra el list completo en una mini-vista.
function DecksView() {
  const toast = useToast()
  const [decks, setDecks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [showBuilder, setShowBuilder] = useState(false)
  const [selectedDeck, setSelectedDeck] = useState(null)

  const reload = () => {
    setLoading(true)
    import('../lib/supabase').then(m => m.getMyDecks())
      .then(rows => setDecks(rows ?? []))
      .catch(() => setDecks([]))
      .finally(() => setLoading(false))
  }
  useEffect(() => { reload() }, [])

  const handleDelete = async (deck) => {
    if (!confirm(`¿Borrar el deck "${deck.name}"?`)) return
    try {
      const { deleteDeck } = await import('../lib/supabase')
      await deleteDeck(deck.id)
      setDecks(prev => prev.filter(d => d.id !== deck.id))
      toast?.('Deck borrado', { type: 'success' })
    } catch (e) {
      toast?.(e?.message || 'No se pudo borrar', { type: 'error' })
    }
  }

  return (
    <div style={{ padding: '12px 16px 32px', fontFamily: 'Inter, sans-serif' }}>
      {/* CTAs: Crear desde cero (con buscador) + Importar deck (paste) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => setShowBuilder(true)}
          className="pressable"
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '12px 12px', borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(18px) saturate(180%)',
            WebkitBackdropFilter: 'blur(18px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.10)',
            cursor: 'pointer',
            color: '#E5E7EB', fontSize: 13, fontWeight: 800,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.005em',
          }}
        >
          🔍 CREAR
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="pressable"
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '12px 12px', borderRadius: 12,
            background: 'linear-gradient(135deg, #FB923C 0%, #F472B6 60%, #A78BFA 130%)',
            border: 'none', cursor: 'pointer',
            color: '#FFFFFF', fontSize: 13, fontWeight: 800,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.005em',
            boxShadow: '0 6px 18px rgba(251,146,60,0.22), 0 2px 6px rgba(167,139,250,0.14), inset 0 1px 0 rgba(255,255,255,0.28)',
            textShadow: '0 1px 0 rgba(0,0,0,0.18)',
          }}
        ><Layers size={16} strokeWidth={2.3} />
          IMPORTAR
        </button>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>Cargando…</div>
      )}

      {!loading && decks.length === 0 && (
        <div style={{
          padding: '32px 16px', textAlign: 'center',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14,
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 800, marginBottom: 6 }}>
            Aún no tenés decks
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
            Importá tu primero pegando un deck list de egmanevents,<br/>
            onepiecetopdecks, MTG Arena o Pokemon TCG Live.
          </div>
        </div>
      )}

      {!loading && decks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {decks.map(d => {
            const gs = GAME_STYLES[d.game] ?? {}
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDeck(d)}
                className="pressable"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(18px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                  border: `1px solid ${gs.border || 'rgba(255,255,255,0.10)'}`,
                  cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                  background: gs.bg || 'rgba(255,255,255,0.06)',
                  border: `1px solid ${gs.border || 'rgba(255,255,255,0.12)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <GameIcon game={d.game} size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 800, color: '#FFFFFF',
                    letterSpacing: '-0.005em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{d.name}</div>
                  <div style={{
                    fontSize: 11, color: '#9CA3AF', marginTop: 2,
                    fontWeight: 600,
                  }}>
                    {d.card_count} cartas · {d.game}
                    {d.format && <> · <span style={{ color: gs.color || '#9CA3AF' }}>{d.format}</span></>}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(d) }}
                  aria-label="Borrar"
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: '#6B7280', padding: 6, fontSize: 16,
                  }}
                >🗑</button>
              </button>
            )
          })}
        </div>
      )}

      {showImport && (
        <ImportDeckModal
          onClose={() => setShowImport(false)}
          onCreated={(deck) => {
            setDecks(prev => [deck, ...prev])
            setShowImport(false)
          }}
        />
      )}

      {showBuilder && (
        <CreateDeckBuilder
          onClose={() => setShowBuilder(false)}
          onCreated={(deck) => {
            setDecks(prev => [deck, ...prev])
            setShowBuilder(false)
          }}
        />
      )}

      {selectedDeck && (
        <DeckDetailOverlay deck={selectedDeck} onClose={() => setSelectedDeck(null)} />
      )}
    </div>
  )
}

// ── DeckDetailOverlay — vista completa de un deck guardado ──
function DeckDetailOverlay({ deck, onClose, onUpdated }) {
  const toast = useToast()
  const [hydrated, setHydrated] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [editList, setEditList] = useState([])
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching,     setSearching]     = useState(false)
  // Vista: 'list' (compacta) o 'cards' (grid de imágenes). Persistimos
  // en localStorage para que tu última preferencia se mantenga.
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('quest_deck_view') || 'cards' } catch { return 'cards' }
  })
  useEffect(() => {
    try { localStorage.setItem('quest_deck_view', viewMode) } catch {}
  }, [viewMode])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const { getDeckById, hydrateDeckList, enrichDeckCardsImages } = await import('../lib/supabase')
        const full = await getDeckById(deck.id)
        if (cancelled || !full) return
        const hydratedList = await hydrateDeckList(full.game, full.list)
        if (cancelled) return
        setHydrated({ ...full, list: hydratedList })
        setEditList(hydratedList)

        // Background: para cartas sin imagen, fetcheamos de las APIs
        // públicas (Scryfall, pokemontcg.io, digimoncard.io). No bloquea
        // el render — las thumbnails aparecen progresivamente.
        const updates = await enrichDeckCardsImages(full.game, hydratedList)
        if (cancelled || !updates || Object.keys(updates).length === 0) return
        const apply = (lst) => lst.map(c => updates[c.code]
          ? { ...c, image_url: updates[c.code].image_url || c.image_url, rarity: updates[c.code].rarity || c.rarity }
          : c)
        setHydrated(prev => prev ? { ...prev, list: apply(prev.list) } : prev)
        setEditList(prev => apply(prev))
      } catch { /* leave loading */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [deck.id])

  // Búsqueda debounced cuando el usuario tipea en modo edición
  useEffect(() => {
    if (!editing) { setSearchResults([]); return }
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]); return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const { searchDeckCards } = await import('../lib/supabase')
        const rows = await searchDeckCards(deck.game, searchQuery.trim(), 12)
        if (!cancelled) setSearchResults(rows)
      } catch { if (!cancelled) setSearchResults([]) }
      finally { if (!cancelled) setSearching(false) }
    }, 220)
    return () => { cancelled = true; clearTimeout(t) }
  }, [searchQuery, editing, deck.game])

  const visibleList = editing ? editList : (hydrated?.list ?? [])
  const main = visibleList.filter(c => !c.sideboard)
  const side = visibleList.filter(c => c.sideboard)
  const totalMain = main.reduce((s, c) => s + (c.qty || 0), 0)
  const gs = GAME_STYLES[deck.game] ?? {}

  const adjustQty = (code, delta) => {
    setEditList(prev => prev.flatMap(c => {
      if (c.code !== code) return [c]
      const newQty = (c.qty || 0) + delta
      if (newQty <= 0) return []
      return [{ ...c, qty: newQty }]
    }))
  }
  const removeCard = (code) => setEditList(prev => prev.filter(c => c.code !== code))
  const addSearchedCard = (card) => {
    setEditList(prev => {
      const existing = prev.find(c => c.code === card.code && !c.sideboard)
      if (existing) {
        return prev.map(c => c.code === card.code && !c.sideboard ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, { code: card.code, name: card.name, qty: 1, image_url: card.image_url }]
    })
    setSearchQuery('')
    setSearchResults([])
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const { updateDeck } = await import('../lib/supabase')
      const updated = await updateDeck(deck.id, { list: editList })
      setHydrated(prev => ({ ...prev, ...updated, list: editList }))
      setEditing(false)
      toast?.('Deck actualizado', { type: 'success' })
      onUpdated?.(updated)
    } catch (e) {
      toast?.(e?.message || 'No se pudo guardar', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditList(hydrated?.list ?? [])
    setSearchQuery('')
    setSearchResults([])
    setEditing(false)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 250,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(18px) saturate(140%)',
      WebkitBackdropFilter: 'blur(18px) saturate(140%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 14px 14px',
      animation: 'fadeUp 220ms ease',
    }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          maxHeight: 'calc(100vh - 32px)',
          background: 'rgba(20,20,30,0.92)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 18,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 14px 12px', display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: gs.bg || 'rgba(255,255,255,0.06)',
            border: `1px solid ${gs.border || 'rgba(255,255,255,0.12)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <GameIcon game={deck.game} size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#FFF', letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {deck.name}
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
              {totalMain} cartas · {deck.game}{deck.format ? ` · ${deck.format}` : ''}
            </div>
          </div>
          {!editing ? (
            <>
              {/* Toggle vista lista / cartas */}
              <button
                onClick={() => setViewMode(v => v === 'list' ? 'cards' : 'list')}
                aria-label={viewMode === 'list' ? 'Vista de cartas' : 'Vista de lista'}
                title={viewMode === 'list' ? 'Vista de cartas' : 'Vista de lista'}
                style={headerBtnStyle}
              >
                {viewMode === 'list' ? '▦' : '☰'}
              </button>
              <button onClick={() => setEditing(true)} aria-label="Editar" style={headerBtnStyle}>✎</button>
              <button onClick={onClose} aria-label="Cerrar" style={headerBtnStyle}>
                <X size={14} strokeWidth={2.5} />
              </button>
            </>
          ) : (
            <>
              <button onClick={handleCancelEdit} disabled={saving} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: '#9CA3AF', padding: '7px 12px', borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{
                background: saving
                  ? 'rgba(255,255,255,0.04)'
                  : 'linear-gradient(135deg, #4ADE80 0%, #22D3EE 100%)',
                border: 'none', color: saving ? '#555' : '#062013',
                padding: '7px 12px', borderRadius: 8,
                fontSize: 11, fontWeight: 800, cursor: saving ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                boxShadow: saving ? 'none' : '0 4px 12px rgba(74,222,128,0.28), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}>{saving ? '...' : '✓ Guardar'}</button>
            </>
          )}
        </div>

        {/* Search bar — solo en modo edición */}
        {editing && (
          <div style={{ padding: '10px 12px 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}>
              <span style={{ fontSize: 13, color: '#9CA3AF' }}>🔍</span>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar carta para agregar…"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#FFF', fontFamily: 'Inter, sans-serif',
                }}
              />
              {searching && <span style={{ fontSize: 11, color: '#6B7280' }}>…</span>}
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{
                  background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 14, padding: 0,
                }}>✕</button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div style={{
                marginTop: 6, maxHeight: 320, overflowY: 'auto',
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
              }}>
                {searchResults.map(r => (
                  <SearchResultRow
                    key={r.code}
                    result={r}
                    accent={gs}
                    onPick={() => addSearchedCard(r)}
                  />
                ))}
              </div>
            )}
            {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
              <div style={{ marginTop: 6, padding: '8px 12px', fontSize: 11, color: '#6B7280' }}>
                Sin resultados. Solo aparecen cartas que ya fueron importadas alguna vez.
              </div>
            )}
          </div>
        )}

        {/* List o Cards view (toggle desde header) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 16px' }}>
          {loading && <div style={{ padding: 30, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>Cargando…</div>}
          {!loading && main.length === 0 && (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
              Sin cartas — usá el buscador arriba para agregar.
            </div>
          )}
          {!loading && main.length > 0 && viewMode === 'list' && (
            <>
              {main.map((c, i) => (
                <DeckCardRow
                  key={`m-${c.code}-${i}`}
                  card={c}
                  accent={gs}
                  editing={editing}
                  onMinus={() => adjustQty(c.code, -1)}
                  onPlus={()  => adjustQty(c.code, +1)}
                  onRemove={() => removeCard(c.code)}
                />
              ))}
              {side.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '12px 6px 6px' }}>Sideboard</div>
                  {side.map((c, i) => (
                    <DeckCardRow
                      key={`s-${c.code}-${i}`}
                      card={c}
                      accent={gs}
                      editing={editing}
                      onMinus={() => adjustQty(c.code, -1)}
                      onPlus={()  => adjustQty(c.code, +1)}
                      onRemove={() => removeCard(c.code)}
                    />
                  ))}
                </>
              )}
            </>
          )}
          {!loading && main.length > 0 && viewMode === 'cards' && (
            <>
              <DeckCardGrid
                cards={main}
                accent={gs}
                editing={editing}
                onMinus={code => adjustQty(code, -1)}
                onPlus={code  => adjustQty(code, +1)}
                onRemove={code => removeCard(code)}
              />
              {side.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '12px 4px 8px' }}>Sideboard</div>
                  <DeckCardGrid
                    cards={side}
                    accent={gs}
                    editing={editing}
                    onMinus={code => adjustQty(code, -1)}
                    onPlus={code  => adjustQty(code, +1)}
                    onRemove={code => removeCard(code)}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const headerBtnStyle = {
  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.10)',
  color: '#FFF', width: 30, height: 30, borderRadius: 8,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', flexShrink: 0,
  fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700,
}

const qtyBtnStyle = {
  width: 22, height: 22, borderRadius: 5,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#FFF', fontSize: 13, fontWeight: 800,
  cursor: 'pointer', padding: 0, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'Inter, sans-serif',
}

function DeckCardRow({ card, accent, editing = false, onMinus, onPlus, onRemove }) {
  const [showZoom, setShowZoom] = useState(false)
  const [imgError, setImgError] = useState(false)
  const hasImage = card.image_url && !imgError
  const renderedImageUrl = proxyIfNeeded(card.image_url)

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 8px', borderRadius: 7,
        fontFamily: 'Inter, sans-serif',
      }}>
        {!editing ? (
          <div style={{
            minWidth: 28, height: 22, borderRadius: 6,
            background: accent?.bg || 'rgba(255,255,255,0.08)',
            border: `1px solid ${accent?.border || 'rgba(255,255,255,0.15)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accent?.color || '#FFFFFF', fontSize: 11, fontWeight: 800,
            flexShrink: 0,
          }}>×{card.qty}</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button onClick={onMinus} aria-label="-1" style={qtyBtnStyle}>−</button>
            <div style={{
              minWidth: 26, height: 22, borderRadius: 6,
              background: accent?.bg || 'rgba(255,255,255,0.08)',
              border: `1px solid ${accent?.border || 'rgba(255,255,255,0.15)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: accent?.color || '#FFFFFF', fontSize: 11, fontWeight: 800,
            }}>{card.qty}</div>
            <button onClick={onPlus} aria-label="+1" style={qtyBtnStyle}>+</button>
          </div>
        )}

        {/* Thumbnail (si tenemos imagen). Tap → zoom modal. */}
        {hasImage && (
          <button
            onClick={() => setShowZoom(true)}
            aria-label="Ver carta grande"
            style={{
              width: 26, height: 36, borderRadius: 4,
              padding: 0, border: '1px solid rgba(255,255,255,0.10)',
              background: '#000',
              flexShrink: 0, cursor: 'pointer', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <img
              src={renderedImageUrl}
              alt=""
              onError={() => setImgError(true)}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </button>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', fontFamily: 'Menlo, Monaco, monospace', minWidth: 86, flexShrink: 0 }}>
          {card.code}
        </div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#E5E7EB', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.name}
        </div>
        {editing && (
          <button onClick={onRemove} aria-label="Eliminar carta" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#F87171', padding: 4, flexShrink: 0, fontSize: 13,
          }}>🗑</button>
        )}
      </div>

      {/* Zoom modal — full screen image preview */}
      {showZoom && hasImage && (
        <div
          onClick={() => setShowZoom(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, cursor: 'zoom-out',
            animation: 'fadeUp 180ms ease',
          }}
        >
          <img
            src={card.image_url}
            alt={card.name}
            style={{
              maxWidth: '100%', maxHeight: '100%',
              objectFit: 'contain', borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
            onError={() => { setImgError(true); setShowZoom(false) }}
          />
        </div>
      )}
    </>
  )
}


// ── SearchResultRow — usado en el buscador del edit mode y del builder
//    desde cero. Muestra thumbnail + código + nombre. Si hay varias
//    versiones de la misma carta, el thumb permite distinguirlas
//    visualmente.
export function SearchResultRow({ result, accent, onPick, sourceLabel }) {
  const [imgErr, setImgErr] = useState(false)
  const url = !imgErr && result.image_url ? proxyIfNeeded(result.image_url) : null
  return (
    <button onClick={onPick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', background: 'transparent', border: 'none',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      cursor: 'pointer', textAlign: 'left',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Thumbnail — si hay imagen. Más grande para distinguir versiones */}
      <div style={{
        width: 52, height: 72, borderRadius: 6,
        background: '#0A0A0F',
        border: '1px solid rgba(255,255,255,0.10)',
        overflow: 'hidden', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        {url ? (
          <img
            src={url}
            alt=""
            loading="lazy"
            onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 14, color: '#374151' }}>🎴</span>
        )}
      </div>

      {/* Code (o fuente Scryfall) */}
      {result.code ? (
        <span style={{
          fontSize: 11, color: '#9CA3AF', fontFamily: 'Menlo, monospace',
          minWidth: 80, flexShrink: 0,
        }}>{result.code}</span>
      ) : (
        <span style={{
          fontSize: 9, color: '#60A5FA', fontWeight: 800,
          minWidth: 80, flexShrink: 0,
          letterSpacing: '0.06em',
        }}>{sourceLabel || 'SCRYFALL'}</span>
      )}

      {/* Name */}
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 13, color: '#E5E7EB', fontWeight: 600,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{result.name}</span>

      <span style={{
        fontSize: 11, color: accent?.color || '#FB923C', fontWeight: 800,
        flexShrink: 0,
      }}>+</span>
    </button>
  )
}

function RecordView({ onBattleNow }) {
  const { isPremium } = useAuth()
  const confirm = useConfirm()
  const toast   = useToast()
  const [stats,    setStats]    = useState([])
  const [matches,  setMatches]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  // Tapping a TCG card filters the matches list to just that game.
  const [selectedGame, setSelectedGame] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      getMyStats().catch(() => []),
      getMyMatchHistory(50).catch(() => []),
    ]).then(([s, m]) => {
      if (cancelled) return
      setStats(s ?? [])
      setMatches(m ?? [])
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refreshKey])

  const handleReset = async () => {
    const ok = await confirm(
      '¿Reiniciar tu récord? Las partidas anteriores dejarán de contar en tu vista. (La info original sigue en la base de datos — solo se oculta de tu perfil.)',
      { confirmLabel: 'Reiniciar', destructive: true }
    )
    if (!ok) return
    try {
      await resetMyMatches()
      toast?.('Récord reiniciado', { type: 'success' })
      setRefreshKey(k => k + 1)
    } catch (e) {
      toast?.(e.message || 'No se pudo reiniciar', { type: 'error' })
    }
  }

  if (loading) return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#4B5563', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
      Cargando…
    </div>
  )

  // Totals across all games (uses already-filtered stats)
  const totalWins   = stats.reduce((s, r) => s + (r.wins   || 0), 0)
  const totalLosses = stats.reduce((s, r) => s + (r.losses || 0), 0)
  const totalGames  = totalWins + totalLosses
  const overallPct  = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0
  const overallColor = overallPct >= 60 ? '#4ADE80' : overallPct >= 40 ? '#FBBF24' : '#F87171'

  if (stats.length === 0 && matches.length === 0) return (
    <div style={{ padding: '60px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 44 }}>📊</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
        Sin partidas confirmadas
      </div>
      <div style={{ fontSize: 12.5, color: '#4B5563', fontFamily: 'Inter, sans-serif', lineHeight: 1.5, maxWidth: 280 }}>
        Una vez que vos y tu rival confirmen una partida, va a aparecer acá con su % de victoria.
      </div>
    </div>
  )

  // Friendly relative date (e.g. "hace 3d", "ayer", "hoy")
  const fmtAgo = (iso) => {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
    if (d <= 0) return 'hoy'
    if (d === 1) return 'ayer'
    if (d < 7)  return `hace ${d}d`
    if (d < 30) return `hace ${Math.floor(d / 7)}sem`
    if (d < 365) return `hace ${Math.floor(d / 30)}mes`
    return `hace ${Math.floor(d / 365)}a`
  }

  // Filtered list — when selectedGame is set, only show those matches.
  const visibleMatches = selectedGame
    ? matches.filter(m => m.game === selectedGame)
    : matches

  // Max total games across TCGs — for scaling the volume bars.
  const maxGames = Math.max(1, ...stats.map(s => s.total))

  return (
    <div style={{ padding: '12px 16px 32px', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Battle Now CTA ─────────────────────────────────────────────
          Top of the view. Closes Quest Hub and opens the LogMatch /
          opponent-picker modal so the user can start a new battle. */}
      {onBattleNow && (
        <button
          onClick={onBattleNow}
          className="pressable"
          style={{
            width: '100%', marginBottom: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 16px', borderRadius: 14,
            background: 'linear-gradient(135deg, #FB923C 0%, #F472B6 60%, #A78BFA 130%)',
            border: 'none', cursor: 'pointer',
            color: '#FFFFFF', fontSize: 14, fontWeight: 800,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.01em',
            boxShadow: '0 10px 28px rgba(251,146,60,0.25), 0 4px 10px rgba(167,139,250,0.18), inset 0 1px 0 rgba(255,255,255,0.3)',
            textShadow: '0 1px 0 rgba(0,0,0,0.18)',
            transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <Swords size={18} strokeWidth={2.3} />
          BATTLE NOW
        </button>
      )}

      {/* Summary card — overall record */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(74,222,128,0.08) 0%, rgba(167,139,250,0.05) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: '16px 18px', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.12em' }}>RÉCORD GLOBAL</div>
          <div style={{ fontSize: 14, color: '#E5E7EB', marginTop: 6, fontWeight: 600 }}>
            <span style={{ color: '#4ADE80' }}>{totalWins}V</span>
            <span style={{ color: '#374151', margin: '0 7px' }}>·</span>
            <span style={{ color: '#F87171' }}>{totalLosses}D</span>
            <span style={{ color: '#4B5563', marginLeft: 7, fontSize: 12 }}>en {totalGames} {totalGames === 1 ? 'partida' : 'partidas'}</span>
          </div>
        </div>
        <div style={{
          fontSize: 26, fontWeight: 800, color: overallColor, fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em', lineHeight: 1,
        }}>
          {overallPct}<span style={{ fontSize: 14, color: '#6B7280', marginLeft: 1 }}>%</span>
        </div>
      </div>

      {/* ── POR JUEGO — informative volume chart, tap to filter list ───
          Bars scale by total games per TCG so you can see at a glance
          which game you grind the most. Tap a card → filters the
          'Mis partidas' list below to that TCG. Tap again → clears. */}
      {stats.length > 0 && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.12em' }}>
              POR JUEGO
              <span style={{ color: '#374151', marginLeft: 6, letterSpacing: 0, fontWeight: 600 }}>
                · tap para filtrar
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {stats.map(s => {
              const pct = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0
              const volumePct = Math.round((s.total / maxGames) * 100)
              const winColor = pct >= 60 ? '#4ADE80' : pct >= 40 ? '#FBBF24' : '#F87171'
              const gs = GAME_STYLES[s.game] ?? {}
              const isSel = selectedGame === s.game
              return (
                <button
                  key={s.game}
                  onClick={() => setSelectedGame(isSel ? null : s.game)}
                  className="pressable"
                  style={{
                    background: isSel
                      ? `linear-gradient(135deg, ${gs.bg ?? 'rgba(74,222,128,0.10)'} 0%, transparent 70%)`
                      : '#1A1A1A',
                    borderRadius: 12, padding: '12px 14px',
                    border: `1px solid ${isSel ? (gs.border ?? 'rgba(74,222,128,0.45)') : '#1F1F1F'}`,
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 220ms cubic-bezier(0.34,1.56,0.64,1)',
                    boxShadow: isSel ? `0 0 14px ${gs.border ?? 'rgba(74,222,128,0.25)'}` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <GameIcon game={s.game} size={16} />
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: isSel ? (gs.color ?? '#FFFFFF') : '#FFFFFF',
                      }}>{s.game}</span>
                      <span style={{
                        fontSize: 10.5, color: '#6B7280', fontWeight: 600, marginLeft: 4,
                      }}>{s.total} {s.total === 1 ? 'partida' : 'partidas'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ fontSize: 12, color: '#4ADE80', fontWeight: 800 }}>{s.wins}V</span>
                      <span style={{ fontSize: 11, color: '#333' }}>·</span>
                      <span style={{ fontSize: 12, color: '#F87171', fontWeight: 800 }}>{s.losses}D</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: winColor, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
                    </div>
                  </div>
                  {/* Volume bar — width = share of total games (NOT win rate).
                      Tells the user 'this is how much you play this TCG'. */}
                  <div style={{ height: 6, borderRadius: 3, background: '#2A2A2A', overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      height: '100%',
                      width: `${volumePct}%`,
                      background: `linear-gradient(90deg, ${gs.border ?? '#888'} 0%, ${gs.color ?? '#fff'} 100%)`,
                      borderRadius: 3,
                      boxShadow: `0 0 8px ${gs.color ?? '#fff'}55`,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* ── MIS PARTIDAS — filtered when a TCG card above is selected ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.12em',
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          MIS PARTIDAS
          {selectedGame ? (
            // Active-filter pill — shows which TCG is being filtered
            // and offers a clear-x to drop the filter.
            <button
              onClick={() => setSelectedGame(null)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: (GAME_STYLES[selectedGame]?.bg) ?? 'rgba(255,255,255,0.08)',
                border: `1px solid ${(GAME_STYLES[selectedGame]?.border) ?? '#2A2A2A'}`,
                color: (GAME_STYLES[selectedGame]?.color) ?? '#FFFFFF',
                padding: '2px 8px', borderRadius: 9999,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              {selectedGame}
              <span style={{ marginLeft: 1, opacity: 0.8 }}>×</span>
            </button>
          ) : matches.length > 0 ? (
            <span style={{ color: '#374151', letterSpacing: 0, fontWeight: 600 }}>
              · últimas {matches.length}
            </span>
          ) : null}
        </div>
        {isPremium && (totalGames > 0 || matches.length > 0) && (
          <button
            onClick={handleReset}
            aria-label="Reiniciar récord"
            title="Reiniciar récord (premium/admin)"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 9px', borderRadius: 8,
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.22)',
              color: '#F87171', cursor: 'pointer',
              fontSize: 10.5, fontWeight: 700, fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.04em',
            }}
          >
            <RotateCcw size={11} strokeWidth={2.2} />
            REINICIAR
          </button>
        )}
      </div>

      {visibleMatches.length === 0 ? (
        <div style={{
          background: '#0F0F0F', borderRadius: 12, padding: '20px 16px',
          fontSize: 12, color: '#4B5563', textAlign: 'center',
          border: '1px solid #1A1A1A', marginBottom: 16,
        }}>
          {selectedGame
            ? `Sin partidas de ${selectedGame} en tu historial.`
            : 'Sin partidas en el historial reciente.'}
        </div>
      ) : (
        // Match list scrolls inside its own ~4-row window so the chart
        // above stays accessible without scrolling past 50 rows.
        <div style={{
          position: 'relative',
          marginBottom: 18,
          borderRadius: 12,
        }}>
          <div
            className="record-match-scroll"
            style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              maxHeight: 280,
              overflowY: 'auto',
              paddingRight: 2,
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
            }}
          >
            {visibleMatches.map(m => {
              const gs = GAME_STYLES[m.game] ?? {}
              return (
                <div key={m.id} style={{
                  background: '#1A1A1A', borderRadius: 10,
                  border: `1px solid ${m.isWin ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)'}`,
                  padding: '9px 11px',
                  display: 'flex', alignItems: 'center', gap: 9,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: '#0F0F0F', border: '1px solid #2A2A2A',
                    overflow: 'hidden', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Avatar url={m.opponent?.avatar_url} size={30} role={m.opponent?.role} isOwner={m.opponent?.is_owner} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{
                      fontSize: 12.5, fontWeight: 700, color: '#E5E7EB',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      vs {m.opponent?.username ?? '—'}
                    </span>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 10.5, color: '#6B7280',
                    }}>
                      <GameIcon game={m.game} size={10} />
                      <span style={{ color: gs.color ?? '#6B7280', fontWeight: 600 }}>{m.game}</span>
                      <span style={{ color: '#333' }}>·</span>
                      <span>{fmtAgo(m.createdAt)}</span>
                    </div>
                  </div>
                  <span style={{
                    flexShrink: 0,
                    fontSize: 11, fontWeight: 800,
                    padding: '4px 9px', borderRadius: 6,
                    background: m.isWin ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.10)',
                    border: `1px solid ${m.isWin ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.28)'}`,
                    color: m.isWin ? '#4ADE80' : '#F87171',
                    letterSpacing: '0.04em',
                  }}>
                    {m.isWin ? 'V' : 'D'}
                  </span>
                </div>
              )
            })}
          </div>
          {visibleMatches.length > 4 && (
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0, height: 28,
              pointerEvents: 'none',
              background: 'linear-gradient(180deg, transparent 0%, rgba(8,8,12,0.85) 100%)',
              borderRadius: '0 0 12px 12px',
            }} />
          )}
        </div>
      )}

      <div style={{ fontSize: 11, color: '#4B5563', textAlign: 'center', marginTop: 14 }}>
        Solo cuenta partidas confirmadas por ambos jugadores
      </div>
    </div>
  )
}

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
  {
    id:      'record',
    icon:    'chart',
    label:   'Battle Stats',
    desc:    'Tus partidas · W/L',
    color:   '#4ADE80',
    bg:      'rgba(74,222,128,0.08)',
    border:  'rgba(74,222,128,0.2)',
    enabled: true,
  },
  {
    id:      'decks',
    icon:    'deck',
    label:   'Mis Decks',
    desc:    'Guardá tus decks',
    color:   '#FB923C',
    bg:      'rgba(251,146,60,0.08)',
    border:  'rgba(251,146,60,0.2)',
    enabled: true,
  },
]

// ── Main component ────────────────────────────
export default function QuestHubScreen({ onClose, onOpenAuction, onOpenLifeCounter, onOpenFolder, onOpenProfile, onOpenTracking, onOpenShop, onOpenLive, onBattleNow, profile, canLive = false, initialView = null }) {
  const [view, setView] = useState(initialView) // null | 'sucursales' | 'membresia' | 'qpoints'

  // Tile LIVE — sorteo en vivo. Por ahora solo visible para owner/staff
  // (lo estamos probando primero). Va primero en el grid para destacar.
  const LIVE_TILE = {
    id: 'live', icon: 'live', label: 'LIVE', desc: 'Sorteo en vivo',
    color: '#F87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.22)', enabled: true,
  }
  const tiles = canLive ? [LIVE_TILE, ...TILES] : TILES

  const handleTile = (tile) => {
    if (!tile.enabled) return
    if (tile.id === 'live')        { onOpenLive?.(); onClose(); return }
    if (tile.id === 'subastas')    { onOpenAuction(); onClose(); return }
    if (tile.id === 'lifecounter') { onOpenLifeCounter(); onClose(); return }
    if (tile.id === 'folder')      { onOpenFolder?.(); onClose(); return }
    if (tile.id === 'tracking')    { onOpenTracking?.(); onClose(); return }
    if (tile.id === 'shop')        { onOpenShop?.(); onClose(); return }
    setView(tile.id)
  }

  const viewTitle =
    view === 'sucursales' ? 'Sucursales'
    : view === 'membresia' ? 'Membresía'
    : view === 'qpoints'   ? 'Q Coins'
    : view === 'record'    ? 'Battle Stats'
    : view === 'decks'     ? 'Mis Decks'
    : ''

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
          // Clearer back affordance — circled chevron with proper hit
          // target. The old plain '←' was easy to miss.
          <button
            onClick={() => setView(null)}
            aria-label="Volver"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: '#FFFFFF', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, flexShrink: 0,
              transition: 'background 180ms ease',
            }}
          >
            <ChevronLeft size={20} strokeWidth={2.2} />
          </button>
        ) : (
          <img src={questLogo} alt="Quest" style={{ width: 72, height: 'auto' }} />
        )}
        {view && (
          <span style={{
            fontSize: 16, fontWeight: 800, color: '#FFF',
            letterSpacing: '-0.01em',
          }}>{viewTitle}</span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#FFFFFF', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0,
            transition: 'background 180ms ease',
          }}
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>

      {/* Sub-views — wrap in a scroll container so they can grow past
          viewport height. Without this, the only scroll was on the
          main tiles grid; sub-views (Mi récord etc.) had no way to
          reach content below the fold. */}
      {view && (
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {view === 'sucursales' && <SucursalesView onBack={() => setView(null)} />}
          {view === 'membresia'  && <MembresiaView profile={profile} />}
          {view === 'qpoints'    && <QPointsView profile={profile} />}
          {view === 'record'     && <RecordView onBattleNow={onBattleNow} />}
          {view === 'decks'      && <DecksView />}
        </div>
      )}

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
            {tiles.map(tile => (
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
