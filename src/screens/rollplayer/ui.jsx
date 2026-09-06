// ─────────────────────────────────────────────
// ROLL PLAYER — piezas de UI compartidas (estética D&D Beyond)
// ─────────────────────────────────────────────
// Carbón con textura, carmesí de acento, dorado envejecido en marcos,
// etiquetas condensadas en mayúsculas (Bebas Neue, ya autohospedada) y
// cajas con esquinas biseladas. Todas las pantallas consumen estos tokens.
import { useState } from 'react'

export const C = {
  bg: '#0F0E0C', card: '#191714', card2: '#221F1A', border: '#3A3226', border2: '#5A4B30',
  text: '#F2E9D6', sub: '#B9AE98', dim: '#8B816C', faint: '#5E5546',
  acc: '#C53131', acc2: '#E25252', accBg: 'rgba(197,49,49,0.13)', accBorder: 'rgba(197,49,49,0.55)',
  gold: '#D4AF5A', goldDim: '#8A7340', goldBg: 'rgba(212,175,90,0.10)',
  ok: '#4ADE80', warn: '#F2B84B', bad: '#E25252',
}
export const FONT = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
export const DISPLAY = '"Bebas Neue", "Roboto Condensed", Impact, sans-serif'
export const TEXTURA = 'radial-gradient(ellipse at 30% 0%, #1D1915 0%, #0F0E0C 55%), repeating-linear-gradient(135deg, rgba(255,255,255,0.012) 0 2px, transparent 2px 6px)'

// Esquinas biseladas (como los marcos de la hoja de D&D Beyond)
export const chamfer = (n = 8) => `polygon(${n}px 0, calc(100% - ${n}px) 0, 100% ${n}px, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, ${n}px 100%, 0 calc(100% - ${n}px), 0 ${n}px)`

export const card = { background: `linear-gradient(180deg, ${C.card2} 0%, ${C.card} 100%)`, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 2px 10px rgba(0,0,0,0.35)' }
export const label = { fontFamily: DISPLAY, fontSize: 13, fontWeight: 400, color: C.dim, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }
export const field = {
  width: '100%', padding: '10px 12px', borderRadius: 4, boxSizing: 'border-box',
  background: '#0C0B09', border: `1px solid ${C.border2}`, color: C.text, fontSize: 14,
  fontFamily: FONT, outline: 'none', colorScheme: 'dark',
}
export const btn = (kind = 'primary', extra = {}) => ({
  padding: '11px 16px', borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: DISPLAY,
  fontSize: 16, letterSpacing: '0.08em', textTransform: 'uppercase',
  ...(kind === 'primary' ? { background: 'linear-gradient(180deg, #D93A3A 0%, #A82626 100%)', color: '#FFF3E6', boxShadow: '0 4px 14px rgba(197,49,49,0.35), inset 0 1px 0 rgba(255,255,255,0.18)' }
    : kind === 'ghost' ? { background: 'transparent', color: C.sub, border: `1px solid ${C.border2}` }
    : kind === 'danger' ? { background: 'rgba(197,49,49,0.12)', color: C.acc2, border: `1px solid ${C.accBorder}` }
    : kind === 'gold' ? { background: 'linear-gradient(180deg, #E0BE68 0%, #A8853C 100%)', color: '#1A1408', boxShadow: '0 4px 12px rgba(212,175,90,0.25)' }
    : { background: C.card2, color: C.text, border: `1px solid ${C.border2}` }),
  ...extra,
})

export function Chip({ active, onClick, children, color = C.gold, small = false }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '5px 10px' : '8px 13px', borderRadius: 3, cursor: 'pointer', fontFamily: DISPLAY,
      fontSize: small ? 13 : 15, letterSpacing: '0.06em', whiteSpace: 'nowrap',
      background: active ? color : 'transparent', color: active ? '#1A1408' : C.sub,
      border: `1px solid ${active ? color : C.border2}`,
    }}>{children}</button>
  )
}

// Pestañas estilo DDB: mayúsculas condensadas con subrayado carmesí
export function Tabs({ items, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, overflowX: 'auto', borderBottom: `1px solid ${C.border}`, scrollbarWidth: 'none' }}>
      {items.map(([id, t]) => {
        const on = value === id
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: DISPLAY, fontSize: 17, letterSpacing: '0.1em',
            padding: '8px 12px 7px', color: on ? C.text : C.dim, whiteSpace: 'nowrap',
            borderBottom: `3px solid ${on ? C.acc : 'transparent'}`, marginBottom: -1,
          }}>{t}</button>
        )
      })}
    </div>
  )
}

// Título de sección con filete carmesí
export function SectionTitle({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 10px' }}>
      <span style={{ fontFamily: DISPLAY, fontSize: 16, letterSpacing: '0.14em', color: C.gold, textTransform: 'uppercase' }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${C.acc} 0%, ${C.border} 60%, transparent 100%)` }} />
      {right && <span style={{ fontSize: 11, color: C.dim }}>{right}</span>}
    </div>
  )}

// Marco biselado con borde dorado (dos capas con el mismo clip-path)
export function Frame({ children, accent = C.goldDim, pad = 10, style = {}, inner = {} }) {
  return (
    <div style={{ background: accent, clipPath: chamfer(9), padding: 1, ...style }}>
      <div style={{ background: `linear-gradient(180deg, ${C.card2} 0%, ${C.card} 100%)`, clipPath: chamfer(8), padding: pad, height: '100%', boxSizing: 'border-box', ...inner }}>{children}</div>
    </div>
  )
}

// Caja de característica como en DDB: etiqueta arriba, modificador grande, puntaje en píldora abajo
export function AbilityBox({ abbr, name, mod, score }) {
  return (
    <div style={{ position: 'relative', paddingBottom: 12 }}>
      <Frame pad={0} inner={{ textAlign: 'center', padding: '8px 4px 16px' }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 12, letterSpacing: '0.12em', color: C.dim }} title={name}>{abbr}</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 30, lineHeight: 1, color: C.text, marginTop: 2 }}>{mod}</div>
      </Frame>
      <div style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', minWidth: 30, padding: '2px 8px', borderRadius: 999, background: '#0C0B09', border: `1px solid ${C.goldDim}`, fontFamily: DISPLAY, fontSize: 13, color: C.gold, textAlign: 'center' }}>{score}</div>
    </div>
  )
}

// Escudo de Clase de Armadura
export function Shield({ value, sub }) {
  const shape = 'polygon(50% 0, 100% 12%, 100% 55%, 50% 100%, 0 55%, 0 12%)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 66, height: 76, background: C.gold, clipPath: shape, padding: 2 }}>
        <div style={{ width: '100%', height: '100%', background: `linear-gradient(180deg, ${C.card2} 0%, ${C.card} 100%)`, clipPath: shape, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 30, lineHeight: 1, color: C.text }}>{value}</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 9.5, letterSpacing: '0.12em', color: C.dim, marginTop: 2 }}>CA</div>
        </div>
      </div>
      {sub && <div style={{ fontSize: 9.5, color: C.faint, marginTop: 3, textAlign: 'center', maxWidth: 90, lineHeight: 1.2 }}>{sub}</div>}
    </div>
  )
}

export function Stat({ label: l, value, sub, accent }) {
  return (
    <Frame accent={accent ? C.acc : C.goldDim} inner={{ textAlign: 'center', padding: '8px 4px' }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 24, lineHeight: 1, color: accent ? C.acc2 : C.text }}>{value}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 10.5, letterSpacing: '0.12em', color: C.dim, marginTop: 4, textTransform: 'uppercase' }}>{l}</div>
      {sub && <div style={{ fontSize: 9.5, color: C.faint, marginTop: 1 }}>{sub}</div>}
    </Frame>
  )
}

// Retrato circular con aro dorado; iniciales si no hay imagen
export function Portrait({ name, url, size = 64 }) {
  const ini = (name || '?').split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', padding: 3, background: `conic-gradient(from 180deg, ${C.gold}, ${C.goldDim}, ${C.gold})`, flexShrink: 0, boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}>
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: `radial-gradient(circle at 40% 35%, #2A241C 0%, #15120E 70%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid #0F0E0C' }}>
        {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontFamily: DISPLAY, fontSize: size * 0.42, color: C.gold, letterSpacing: '0.04em' }}>{ini}</span>}
      </div>
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
    if (t.startsWith('**')) parts.push(<strong key={`${key}-${i++}`} style={{ color: C.text }}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('[')) parts.push(<span key={`${key}-${i++}`} style={{ color: C.gold }}>{m[2]}</span>)
    else parts.push(<em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < s.length) parts.push(s.slice(last))
  return parts
}
export function Md({ text, size = 13, color = C.sub }) {
  if (!text) return null
  const plano = typeof text === 'string' ? text : Array.isArray(text) ? text.map(x => typeof x === 'string' ? x : (x?.text ?? '')).join('\n\n') : (text?.text ?? String(text))
  const blocks = plano.split(/\n{2,}/)
  return (
    <div style={{ fontSize: size, color, lineHeight: 1.6, fontFamily: FONT }}>
      {blocks.map((b, bi) => {
        const lines = b.split('\n')
        const isList = lines.every(l => /^\s*([*\-•]|\d+\.)\s+/.test(l) || !l.trim())
        if (isList) return (
          <ul key={bi} style={{ margin: '0 0 8px', paddingLeft: 18 }}>
            {lines.filter(l => l.trim()).map((l, li) => <li key={li} style={{ marginBottom: 3 }}>{inline(l.replace(/^\s*([*\-•]|\d+\.)\s+/, ''), `${bi}-${li}`)}</li>)}
          </ul>
        )
        if (/^#{1,4}\s/.test(b)) return <div key={bi} style={{ fontFamily: DISPLAY, fontSize: size + 4, letterSpacing: '0.08em', color: C.gold, margin: '8px 0 4px' }}>{inline(b.replace(/^#+\s/, ''), bi)}</div>
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
    <div style={{ overflowX: 'auto', margin: '6px 0 10px', border: `1px solid ${C.border}`, borderRadius: 4 }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, color: C.sub, minWidth: '100%' }}>
        {header && <thead><tr style={{ background: C.accBg }}>{header.map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '7px 9px', borderBottom: `1px solid ${C.border2}`, color: C.gold, fontFamily: DISPLAY, fontSize: 13, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>}
        <tbody>{rows.map((r, i) => <tr key={i} style={{ background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>{(Array.isArray(r) ? r : Object.values(r)).map((c, j) => <td key={j} style={{ padding: '5px 9px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' }}>{inline(String(c ?? ''), `${i}-${j}`)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export function Sheet({ title, onClose, children, wide = false }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: wide ? 720 : 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        background: TEXTURA, borderTop: `3px solid ${C.acc}`, border: `1px solid ${C.border2}`, borderBottom: 'none', borderRadius: '8px 8px 0 0', fontFamily: FONT,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 8px', flexShrink: 0 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: '0.08em', color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 18px calc(20px + env(safe-area-inset-bottom, 0px))' }}>{children}</div>
      </div>
    </div>
  )
}

export function Expand({ title, meta, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: C.text }}>{title}</span>
        {meta && <span style={{ fontFamily: DISPLAY, fontSize: 11.5, letterSpacing: '0.08em', color: C.goldDim }}>{meta}</span>}
        <span style={{ color: C.faint, fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ paddingBottom: 12 }}>{children}</div>}
    </div>
  )
}
