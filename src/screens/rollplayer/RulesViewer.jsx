// ─────────────────────────────────────────────
// ROLL PLAYER — Visor del manual (reference.json)
// ─────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { loadReference } from '../../rollplayer/rulesets'
import { C, FONT, card, label, field, Md, Table, Sheet } from './ui'

function aplanar(nodos, out = [], camino = []) {
  for (const n of (nodos ?? [])) {
    const c = [...camino, n.name]
    out.push({ id: n.id, name: n.name, level: n.level, text: n.text, tables: n.tables ?? [], camino: c, children: n.children ?? [] })
    aplanar(n.children, out, c)
  }
  return out
}

export default function RulesViewer({ rulesetId, onClose, initialQuery = '' }) {
  const [tree, setTree] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState(initialQuery)
  const [sel, setSel] = useState(null)
  useEffect(() => { loadReference(rulesetId).then(setTree).catch(e => setErr(e.message)) }, [rulesetId])
  const plano = useMemo(() => tree ? aplanar(tree) : [], [tree])
  const res = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return plano.filter(n => n.name.toLowerCase().includes(s) || (n.text || '').toLowerCase().includes(s)).slice(0, 40)
  }, [q, plano])

  return (
    <Sheet title="📖 Manual" onClose={onClose} wide>
      {err && <div style={{ color: C.bad, fontSize: 12.5 }}>{err}</div>}
      {!tree && !err && <div style={{ color: C.dim, fontSize: 13, padding: 12 }}>Cargando el manual (1 MB)…</div>}
      {tree && !sel && (
        <>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar en el manual: haki, fury, cutlass…" style={{ ...field, marginBottom: 10 }} autoFocus />
          {q ? res.map(n => (
            <button key={n.id} onClick={() => setSel(n)} style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 6, background: C.card2, fontFamily: FONT }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{n.name}</div>
              <div style={{ fontSize: 10.5, color: C.faint }}>{n.camino.slice(0, -1).join(' › ')}</div>
            </button>
          )) : tree.map(ch => (
            <div key={ch.id} style={{ ...card, marginBottom: 8 }}>
              <button onClick={() => setSel({ ...ch, camino: [ch.name] })} style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, padding: 0, width: '100%' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{ch.name}</div>
                <div style={{ fontSize: 11, color: C.dim }}>{(ch.children ?? []).length} secciones</div>
              </button>
            </div>
          ))}
          {q && res.length === 0 && <div style={{ color: C.dim, fontSize: 13, padding: 12 }}>Nada con "{q}".</div>}
        </>
      )}
      {sel && (
        <>
          <button onClick={() => setSel(null)} style={{ background: 'none', border: 'none', color: C.acc2, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, padding: '0 0 8px' }}>‹ {q ? 'Resultados' : 'Índice'}</button>
          <div style={{ fontSize: 10.5, color: C.faint }}>{sel.camino.slice(0, -1).join(' › ')}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text, margin: '2px 0 10px' }}>{sel.name}</div>
          <Md text={sel.text} />
          {(sel.tables ?? []).map((t, i) => <Table key={i} t={t} />)}
          {(sel.children ?? []).length > 0 && (
            <>
              <div style={{ ...label, marginTop: 12 }}>Secciones</div>
              {sel.children.map(c => (
                <button key={c.id} onClick={() => setSel({ ...c, camino: [...sel.camino, c.name] })} style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 6, background: C.card2, fontFamily: FONT }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{c.name}</div>
                </button>
              ))}
            </>
          )}
          <div style={{ height: 12 }} />
        </>
      )}
    </Sheet>
  )
}
