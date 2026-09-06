// ─────────────────────────────────────────────
// ROLL PLAYER — piezas de UI (sistema de diseño de Quest)
// ─────────────────────────────────────────────
// Capa fina sobre src/lib/ui.js + design-tokens: mismas tarjetas, pills,
// botón blanco, Inter/SF y los íconos de components/Icons. Nada propio.
import { useState } from 'react'
import { COLOR, RADIUS, TYPE, WEIGHT, FONT_STACK, MOTION } from '../../lib/design-tokens'
import { UI, ELEVATION } from '../../lib/ui'
import Avatar from '../../components/Avatar'
import { ShieldIcon } from '../../components/Icons'

export const C = {
  bg: COLOR.background, card: COLOR.surface, card2: COLOR.surfaceRaised, border: COLOR.border, border2: COLOR.borderStrong,
  text: COLOR.text, sub: COLOR.textSecondary, dim: COLOR.textTertiary, faint: COLOR.textQuaternary,
  acc: COLOR.purple, acc2: COLOR.purple, accBg: 'rgba(167,139,250,0.10)', accBorder: 'rgba(167,139,250,0.35)',
  gold: COLOR.gold, goldDim: COLOR.amber, goldBg: 'rgba(251,191,36,0.10)',
  ok: COLOR.green, warn: COLOR.amber, bad: COLOR.red,
}
export const FONT = FONT_STACK
export const DISPLAY = FONT_STACK           // sin tipografía display propia: Inter/SF como toda la app
export const TEXTURA = 'transparent'        // el fondo lo pone el overlay de la app
export const chamfer = () => 'none'

export const card = { ...UI.card, padding: 14, overflow: 'visible' }
export const label = { ...UI.caption, fontSize: 10, fontWeight: WEIGHT.bold, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }
export const field = { ...UI.input, padding: '11px 12px', fontSize: TYPE.footnote + 1, colorScheme: 'dark' }

export const btn = (kind = 'primary', extra = {}) => ({
  ...(kind === 'primary' ? { ...UI.btnPrimary, width: 'auto', padding: '12px 18px' }
    : kind === 'ghost' ? { ...UI.btnSecondary, width: 'auto', padding: '10px 14px', background: 'transparent', color: COLOR.textSecondary }
    : kind === 'danger' ? { ...UI.btnSecondary, width: 'auto', padding: '10px 14px', background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.3)', color: COLOR.red }
    : kind === 'gold' ? { ...UI.btnSecondary, width: 'auto', padding: '10px 14px', background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.3)', color: COLOR.gold }
    : { ...UI.btnSecondary, width: 'auto', padding: '11px 16px' }),
  fontSize: TYPE.footnote + 1,
  ...extra,
})

export function Chip({ active, onClick, children, color, small = false }) {
  return (
    <button onClick={onClick} style={{
      ...UI.pill, ...(active ? UI.pillActive : {}),
      padding: small ? '5px 10px' : '7px 12px', fontSize: small ? 11.5 : 12.5, whiteSpace: 'nowrap',
      ...(active && color ? { background: color, border: `1px solid ${color}`, color: '#111111' } : {}),
    }}>{children}</button>
  )
}

// Pestañas: la misma fila de pills que usan los filtros de la app
export function Tabs({ items, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
      {items.map(([id, t]) => <Chip key={id} active={value === id} onClick={() => onChange(id)}>{t}</Chip>)}
    </div>
  )
}

export function SectionTitle({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 0 10px' }}>
      <span style={label}>{children}</span>
      {right && <span style={{ ...UI.caption }}>{right}</span>}
    </div>
  )
}

export function Frame({ children, accent, pad = 12, style = {}, inner = {} }) {
  return <div style={{ ...card, padding: pad, borderColor: accent ?? COLOR.border, ...style, ...inner }}>{children}</div>
}

// Tile de característica: como los stat tiles del resto de la app
export function AbilityBox({ abbr, name, mod, score }) {
  return (
    <div style={{ ...card, padding: '10px 4px', textAlign: 'center' }} title={name}>
      <div style={{ ...UI.caption, fontSize: 10, fontWeight: WEIGHT.bold, letterSpacing: '0.08em' }}>{abbr}</div>
      <div style={{ fontSize: 22, fontWeight: WEIGHT.bold, color: COLOR.text, lineHeight: 1.1, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{mod}</div>
      <div style={{ ...UI.caption, fontSize: 11, marginTop: 1 }}>{score}</div>
    </div>
  )
}

export function Shield({ value, sub }) {
  return (
    <div style={{ ...card, padding: '10px 6px', textAlign: 'center', borderColor: 'rgba(167,139,250,0.35)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, color: COLOR.purple }}>
        <ShieldIcon size={13} />
        <span style={{ ...UI.caption, fontSize: 10, fontWeight: WEIGHT.bold, letterSpacing: '0.08em', color: COLOR.purple }}>CA</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: WEIGHT.bold, color: COLOR.text, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ ...UI.caption, fontSize: 10, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  )
}

export function Stat({ label: l, value, sub, accent }) {
  return (
    <div style={{ ...card, padding: '10px 6px', textAlign: 'center', borderColor: accent ? 'rgba(167,139,250,0.35)' : COLOR.border }}>
      <div style={{ ...UI.caption, fontSize: 10, fontWeight: WEIGHT.bold, letterSpacing: '0.08em', color: accent ? COLOR.purple : COLOR.textTertiary }}>{l}</div>
      <div style={{ fontSize: 22, fontWeight: WEIGHT.bold, color: COLOR.text, lineHeight: 1.1, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ ...UI.caption, fontSize: 10, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  )
}

// Retrato: el Avatar de la app si hay imagen; si no, iniciales en un tile
export function Portrait({ name, url, size = 56 }) {
  if (url) return <Avatar url={url} size={size} />
  const ini = (name || '?').split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: RADIUS.md, background: COLOR.surfaceRaised, border: `1px solid ${COLOR.borderStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.36, fontWeight: WEIGHT.bold, color: COLOR.textSecondary, fontFamily: FONT_STACK, letterSpacing: '-0.02em' }}>{ini}</span>
    </div>
  )
}

// Texto del manual: **negrita**, *cursiva*, viñetas "* " y párrafos. Sin HTML crudo.
function inline(s, key) {
  const parts = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(([^)]+)\))/g
  let last = 0, m, i = 0
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index))
    const t = m[0]
    if (t.startsWith('**')) parts.push(<strong key={`${key}-${i++}`} style={{ color: COLOR.text, fontWeight: WEIGHT.semibold }}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('[')) parts.push(<span key={`${key}-${i++}`} style={{ color: COLOR.purple }}>{m[2]}</span>)
    else parts.push(<em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < s.length) parts.push(s.slice(last))
  return parts
}
export function Md({ text, size = 13, color = COLOR.textSecondary }) {
  if (!text) return null
  const plano = typeof text === 'string' ? text : Array.isArray(text) ? text.map(x => typeof x === 'string' ? x : (x?.text ?? '')).join('\n\n') : (text?.text ?? String(text))
  const blocks = plano.split(/\n{2,}/)
  return (
    <div style={{ fontSize: size, color, lineHeight: 1.55, fontFamily: FONT_STACK }}>
      {blocks.map((b, bi) => {
        const lines = b.split('\n')
        const isList = lines.every(l => /^\s*([*\-•]|\d+\.)\s+/.test(l) || !l.trim())
        if (isList) return (
          <ul key={bi} style={{ margin: '0 0 8px', paddingLeft: 18 }}>
            {lines.filter(l => l.trim()).map((l, li) => <li key={li} style={{ marginBottom: 3 }}>{inline(l.replace(/^\s*([*\-•]|\d+\.)\s+/, ''), `${bi}-${li}`)}</li>)}
          </ul>
        )
        if (/^#{1,4}\s/.test(b)) return <div key={bi} style={{ ...UI.title3, fontSize: size + 2, margin: '8px 0 4px' }}>{inline(b.replace(/^#+\s/, ''), bi)}</div>
        return <p key={bi} style={{ margin: '0 0 8px' }}>{lines.map((l, li) => <span key={li}>{inline(l, `${bi}-${li}`)}{li < lines.length - 1 && <br />}</span>)}</p>
      })}
    </div>
  )
}
export function Table({ t }) {
  if (!t) return null
  const header = t.header ?? t.columns ?? null
  const rows = t.rows ?? []
  return (
    <div style={{ overflowX: 'auto', margin: '6px 0 10px', border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, color: COLOR.textSecondary, minWidth: '100%' }}>
        {header && <thead><tr>{header.map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '7px 9px', borderBottom: `1px solid ${COLOR.borderStrong}`, color: COLOR.text, fontWeight: WEIGHT.semibold, fontSize: 12, whiteSpace: 'nowrap', background: COLOR.surfaceRaised }}>{h}</th>)}</tr></thead>}
        <tbody>{rows.map((r, i) => <tr key={i}>{(Array.isArray(r) ? r : Object.values(r)).map((c, j) => <td key={j} style={{ padding: '5px 9px', borderBottom: `1px solid ${COLOR.border}`, verticalAlign: 'top' }}>{inline(String(c ?? ''), `${i}-${j}`)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export function Sheet({ title, onClose, children, wide = false }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: wide ? 720 : 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        background: COLOR.surface, borderRadius: '20px 20px 0 0', border: `1px solid ${COLOR.borderStrong}`, borderBottom: 'none', fontFamily: FONT_STACK, boxShadow: ELEVATION.xl,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 10px', flexShrink: 0 }}>
          <div style={UI.title3}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: COLOR.textTertiary, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 18px calc(20px + env(safe-area-inset-bottom, 0px))' }}>{children}</div>
      </div>
    </div>
  )
}

export function Expand({ title, meta, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: `1px solid ${COLOR.border}` }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT_STACK }}>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: WEIGHT.semibold, color: COLOR.text }}>{title}</span>
        {meta && <span style={{ ...UI.caption }}>{meta}</span>}
        <span style={{ color: COLOR.textQuaternary, fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ paddingBottom: 12 }}>{children}</div>}
    </div>
  )
}
