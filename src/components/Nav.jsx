// ─────────────────────────────────────────────
// QUEST — BottomNav + NotifBell
// ─────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
// Lucide icons — single library across the whole app. ~3 k stroke-only
// glyphs, ISC license, tree-shaken so only the imports below ship.
// We use stroke-weight + color to imply "active" since Lucide is
// stroke-only (no fill weight like Phosphor).
import {
  Home, ShoppingBag, Trophy, Heart, Bell,        // regular-user nav
  Castle, PiggyBank, Crown, Swords,              // admin/owner medieval nav
} from 'lucide-react'
import Avatar from './Avatar'
import { HAPTIC } from '../lib/design-tokens'

// ── Owner nav: Feed · Shop · [+ POST] · Rank · Vida ──
// Center slot is reserved for a primary action (create post) — visually
// distinct from the others so 'crear' reads as the hero affordance.
function OwnerBottomNav({ active, hidden, tabs }) {
  const [tapped, setTapped] = useState(null)
  const tapTimer = useRef(null)
  useEffect(() => () => clearTimeout(tapTimer.current), [])

  const handleTap = (id, action) => {
    HAPTIC.tap()
    clearTimeout(tapTimer.current)
    setTapped(id)
    tapTimer.current = setTimeout(() => setTapped(null), 420)
    action()
  }

  // Scroll-edge effect (iOS-style): when the screen-scroll container has
  // been scrolled at all, the nav material darkens / saturates so icons
  // stay readable even when bright content (a white image, etc.) is
  // blurred behind the bar. Listens directly to the scroll container so
  // we don't need to drill the value down from App.jsx.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const scroller = document.querySelector('.screen-scroll')
    if (!scroller) return
    const onScroll = () => setScrolled(scroller.scrollTop > 16)
    onScroll()  // sync immediately in case we mount while already scrolled
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 'calc(52px + env(safe-area-inset-bottom, 0px))',
      // Bg + filter ramp up when scrolled so icons keep contrast even
      // over bright content (post images, etc.) behind the glass.
      background: scrolled ? 'rgba(8,8,11,0.94)' : 'rgba(10,10,10,0.82)',
      backdropFilter: scrolled
        ? 'saturate(200%) blur(32px) brightness(95%)'
        : 'saturate(180%) blur(24px)',
      WebkitBackdropFilter: scrolled
        ? 'saturate(200%) blur(32px) brightness(95%)'
        : 'saturate(180%) blur(24px)',
      borderTop: `1px solid ${scrolled ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)'}`,
      boxShadow: scrolled
        ? '0 -10px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)'
        : '0 -8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
      display: 'flex', alignItems: 'center',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 100,
      transform: hidden ? 'translateY(100%)' : 'translateY(0)',
      transition: 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1), background 250ms ease, backdrop-filter 250ms ease, border-color 250ms ease',
      willChange: 'transform',
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.id
        const isPrimary = tab.variant === 'primary'

        // PRIMARY (post) — bigger, filled white pill embedded in the bar
        if (isPrimary) {
          return (
            <button
              key={tab.id}
              onClick={() => handleTap(tab.id, tab.action)}
              aria-label={tab.label}
              title={tab.label}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', cursor: 'pointer', background: 'none', border: 'none', padding: 0,
              }}
            >
              <div style={{
                width: 44, height: 36, borderRadius: 12,
                background: 'linear-gradient(135deg, #FFFFFF 0%, #E8E8E8 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.6)',
                animation: tapped === tab.id ? 'tabBounce 0.42s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
                transform: tapped === tab.id ? 'scale(0.92)' : 'scale(1)',
                transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="#111" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              </div>
            </button>
          )
        }

        // STANDARD tab — icon only, scale up when active
        return (
          <button
            key={tab.id}
            onClick={() => handleTap(tab.id, tab.action)}
            aria-label={tab.label}
            title={tab.label}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', cursor: 'pointer', background: 'none', border: 'none',
              padding: 0,
              transition: 'opacity 200ms cubic-bezier(0.2, 0, 0.38, 0.9)',
            }}
          >
            <div style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: tapped === tab.id ? 'tabBounce 0.42s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
              transform: isActive ? 'scale(1.12)' : 'scale(1)',
              transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              opacity: isActive ? 1 : 0.65,
            }}>
              {tab.icon(isActive)}
              {tab.badge > 0 && (
                <div style={{
                  position: 'absolute', top: -3, right: -6,
                  minWidth: 16, height: 16, borderRadius: 8,
                  background: '#EF4444', border: '1.5px solid #0A0A0A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: '#FFF', padding: '0 3px',
                }}>{tab.badge > 9 ? '9+' : tab.badge}</div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Unified nav for everyone ─────────────────────────────────────────────
// Medieval vocab + center post button. Per-icon optical sizing so the
// bar feels balanced (Castle/Crown/Swords are tall outlines; PiggyBank
// needs the extra px because it has more internal detail).
// Notifications: accessed via the bell icon in the profile header.
export function BottomNav({
  active, hidden, onTab, onLifeCounter, onPost, onNotifs,
  unreadCount, isAdminOrOwner, isOwner,
}) {
  const Lu = (Icon, size = 24) => (a) => (
    <div style={{
      width: 28, height: 28,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon
        size={size}
        strokeWidth={a ? 2.5 : 1.75}
        color={a ? '#FFFFFF' : 'rgba(255,255,255,0.65)'}
      />
    </div>
  )

  // Shop (Tienda) solo se muestra al owner — precios no listos / no exponer.
  const tabs = [
    { id: 'feed',  label: 'Feed',     icon: Lu(Castle,    22), action: () => onTab('feed') },
    ...(isOwner ? [{ id: 'shop', label: 'Tienda', icon: Lu(PiggyBank, 27), action: () => onTab('shop') }] : []),
    { id: 'post',  label: 'Crear',    icon: null,              action: onPost, variant: 'primary' },
    { id: 'ranks', label: 'Ranking',  icon: Lu(Crown,     24), action: () => onTab('ranks') },
    { id: 'life',  label: 'Vida',     icon: Lu(Swords,    24), action: onLifeCounter },
  ]
  return <OwnerBottomNav active={active} hidden={hidden} tabs={tabs} />
}

export function NotifBell({ count, onClick }) {
  return (
    <button onClick={onClick} style={{
      position: 'relative', background: 'none', border: 'none',
      color: '#6B7280', cursor: 'pointer', padding: 4,
    }}>
      <BellIcon />
      {count > 0 && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          minWidth: 16, height: 16, borderRadius: 8,
          background: '#EF4444', border: '2px solid #0A0A0A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800, color: '#FFFFFF', padding: '0 3px',
        }}>{count > 9 ? '9+' : count}</div>
      )}
    </button>
  )
}

export function StatusBar() {
  const now = new Date()
  const time = now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <div style={{
      padding: '14px 24px 0', display: 'flex', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 50,
      background: 'linear-gradient(to bottom, #0A0A0A 70%, transparent)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{time}</span>
      <span style={{ color: '#FFFFFF', fontSize: 12 }}>▲▲▲ 🔋</span>
    </div>
  )
}
