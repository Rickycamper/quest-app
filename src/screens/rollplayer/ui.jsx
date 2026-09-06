// ─────────────────────────────────────────────
// ROLL PLAYER — piezas de UI compartidas
// ─────────────────────────────────────────────
import { useState } from 'react'

export const C = {
  bg: '#0A0A0A', card: '#111111', card2: '#161616', border: '#1F1F1F', border2: '#2A2A2A',
  text: '#FFFFFF', sub: '#9CA3AF', dim: '#6B7280', faint: '#4B5563',
  acc: '#A78BFA', acc2: '#C4B5FD', accBg: 'rgba(167,139,250,0.12)', accBorder: 'rgba(167,139,250,0.4)',
  ok: '#4ADE80', warn: '#FBBF24', bad: '#F87171', gold: '#F59E0B',
}
export const FONT = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
export const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }
export const label = { fontSize: 10.5, fontWeight: 800, color: C.dim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }
export const field = {
  width: '100%', padding: '10px 12px', borderRadius: 10, boxSizing: 'border-box',
  background: '#0D0D0D', border: `1px solid ${C.border2}`, color: C.text, fontSize: 14,
  fontFamily: FONT, outline: 'none', colorScheme: 'dark',
}
export const btn = (kind = 'primary', extra = {}) => ({
  padding: '11px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: FONT,
  fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.005em',
  ...(kind === 'primary' ? { background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)', color: '#FFF', boxShadow: '0 6px 18px rgba(124,58,237,0.35)' }
    : kind === 'ghost' ? { background: 'transparent', color: C.sub, border: `1px solid ${C.border2}` }
    : kind === 'danger' ? { background: 'rgba(239,68,68,0.12)', color: C.bad, border: '1px solid rgba(239,68,68,0.3)' }
    : { background: C.card2, color: C.text, border: `1px solid ${C.border2}` }),
  ...extra,
})

export function Chip({ active, onClick, children, color = C.acc, small = false }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '5px 10px' : '8px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
      fontSize: small ? 11.5 : 12.5, fontWeight: 700, whiteSpace: 'nowrap',
      background: active ? color : 'transparent', color: active ? '#0A0A0A' : C.sub,
      border: `1.5px solid ${active ? color : C.border2}`,
    }}>{children}</button>
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
    else if (t.startsWith('[')) parts.push(<span key={`${key}-${i++}`} style={{ color: C.acc2 }}>{m[2]}</span>)
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
        if (/^#{1,4}\s/.test(b)) return <div key={bi} style={{ fontWeight: 800, color: C.text, margin: '6px 0 4px' }}>{inline(b.replace(/^#+\s/, ''), bi)}</div>
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
    <div style={{ overflowX: 'auto', margin: '6px 0 10px' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, color: C.sub, minWidth: '100%' }}>
        {header && <thead><tr>{header.map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: `1px solid ${C.border2}`, color: C.text, fontWeight: 800, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>}
        <tbody>{rows.map((r, i) => <tr key={i}>{(Array.isArray(r) ? r : Object.values(r)).map((c, j) => <td key={j} style={{ padding: '5px 8px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' }}>{inline(String(c ?? ''), `${i}-${j}`)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export function Sheet({ title, onClose, children, wide = false }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: wide ? 720 : 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        background: C.card, borderRadius: '18px 18px 0 0', border: `1px solid ${C.border2}`, borderBottom: 'none', fontFamily: FONT,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 10px', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{title}</div>
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
        {meta && <span style={{ fontSize: 11, color: C.dim }}>{meta}</span>}
        <span style={{ color: C.faint, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ paddingBottom: 12 }}>{children}</div>}
    </div>
  )
}

export function Stat({ label: l, value, sub, accent }) {
  return (
    <div style={{ ...card, padding: '10px 8px', textAlign: 'center', borderColor: accent ? C.accBorder : C.border }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: C.dim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{l}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent ? C.acc2 : C.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: C.faint, marginTop: 1 }}>{sub}</div>}
    </div>
  )
}
