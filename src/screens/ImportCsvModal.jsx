// ─────────────────────────────────────────────
// QUEST — Importar torneo desde CSV (equipo)
// ─────────────────────────────────────────────
import { useState } from 'react'
import { parseCsv, detectColumns, rowsToPlayers } from '../lib/csv'
import { importTournamentCsv } from '../lib/supabase'
import { GAMES } from '../lib/constants'

// La región que ve el equipo. Chiriquí junta a todas las tiendas hermanas
// que mandan su CSV; por dentro se guarda como 'David' (la sucursal de
// siempre) para no tocar el ranking ni los datos existentes.
const REGIONES = [
  { value: 'David',  label: 'Chiriquí · todas las tiendas hermanas' },
  { value: 'Chitre', label: 'Chitré' },
  { value: 'Panama', label: 'Panamá' },
]

const hoy = () => new Date().toISOString().slice(0, 10)

const field = {
  width: '100%', padding: '10px 12px', borderRadius: 10, boxSizing: 'border-box',
  background: '#0D0D0D', border: '1px solid #2A2A2A', color: '#FFF', fontSize: 13,
  fontFamily: 'Inter, sans-serif', outline: 'none', colorScheme: 'dark',
}
const label = { fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', marginBottom: 5 }

export default function ImportCsvModal({ game: initialGame, branch: initialBranch, onClose, onDone }) {
  const [game,    setGame]    = useState(initialGame || GAMES[0])
  const [branch,  setBranch]  = useState(REGIONES.some(r => r.value === initialBranch) ? initialBranch : 'David')
  const [nombre,  setNombre]  = useState('')
  const [fecha,   setFecha]   = useState(hoy())
  const [rows,    setRows]    = useState(null)    // filas crudas (sin header)
  const [header,  setHeader]  = useState([])
  const [posCol,  setPosCol]  = useState('order')
  const [nameCol, setNameCol] = useState(-1)
  const [archivo, setArchivo] = useState('')
  const [modo,    setModo]    = useState('pegar')   // 'pegar' | 'archivo'
  const [pegado,  setPegado]  = useState('')
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')
  const [result,  setResult]  = useState(null)

  // Mismo camino para el archivo y para el texto pegado.
  const cargarTexto = (texto, origen) => {
    setError(''); setResult(null)
    const all = parseCsv(texto)
    if (all.length < 2) { setError('No encontré filas de jugadores. Pegá el CSV con su fila de encabezado.'); setRows(null); return }
    const h = all[0]
    const det = detectColumns(h)
    setHeader(h); setRows(all.slice(1))
    setPosCol(det.pos >= 0 ? det.pos : 'order')
    setNameCol(det.name >= 0 ? det.name : 0)
    setArchivo(origen)
    if (!nombre && origen && origen !== 'pegado') setNombre(origen.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').slice(0, 60))
  }

  const leerArchivo = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => cargarTexto(reader.result, file.name)
    reader.onerror = () => setError('No se pudo leer el archivo.')
    reader.readAsText(file)
  }

  const jugadores = rows ? rowsToPlayers(rows, posCol, nameCol) : []
  const listo = jugadores.length > 0 && nombre.trim().length >= 3 && fecha && nameCol >= 0

  const importar = async () => {
    if (!listo || busy) return
    setBusy(true); setError('')
    try {
      const r = await importTournamentCsv({ game, branch, tournamentName: nombre.trim(), playedOn: fecha, rows: jugadores })
      setResult(r)
      onDone?.(r)
    } catch (e) {
      setError(e?.message || 'No se pudo importar.')
    }
    setBusy(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto',
        background: '#111', borderRadius: '18px 18px 0 0', border: '1px solid #262626', borderBottom: 'none',
        padding: '18px 18px calc(24px + env(safe-area-inset-bottom, 0px))', fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#FFF' }}>Importar torneo (CSV)</div>
            <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>Los nombres que ya fueron reclamados suman solos. El resto queda para reclamar.</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {result ? (
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#4ADE80', marginBottom: 6 }}>✓ Torneo importado</div>
            <div style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.6 }}>
              <strong>{result.total}</strong> jugadores · <strong>{result.matched}</strong> reconocidos y sumados al ranking · <strong>{result.unmatched}</strong> esperando que reclamen su nombre.
            </div>
            <button onClick={onClose} style={{ marginTop: 12, width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#FFF', color: '#111', fontWeight: 800, cursor: 'pointer' }}>Listo</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[['pegar', '📋 Pegar el CSV'], ['archivo', '📎 Subir archivo']].map(([m, txt]) => (
                <button key={m} onClick={() => setModo(m)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  border: `1.5px solid ${modo === m ? 'rgba(167,139,250,0.6)' : '#2A2A2A'}`,
                  background: modo === m ? 'rgba(167,139,250,0.12)' : 'transparent',
                  color: modo === m ? '#C4B5FD' : '#6B7280', fontSize: 12.5, fontWeight: 800,
                }}>{txt}</button>
              ))}
            </div>

            {modo === 'pegar' ? (
              <div style={{ marginBottom: 12 }}>
                <div style={label}>PEGÁ ACÁ LO QUE TE MANDARON</div>
                <textarea value={pegado} onChange={e => setPegado(e.target.value)}
                  onBlur={() => pegado.trim() && cargarTexto(pegado, 'pegado')}
                  placeholder={'Rank,Player,Points\n1,Juan Pérez,9\n2,Ana Gómez,6\n…'}
                  rows={6} spellCheck={false}
                  style={{ ...field, resize: 'vertical', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, lineHeight: 1.5 }} />
                <button onClick={() => cargarTexto(pegado, 'pegado')} disabled={!pegado.trim()} style={{
                  marginTop: 8, padding: '9px 14px', borderRadius: 10, border: 'none', cursor: pegado.trim() ? 'pointer' : 'default',
                  background: pegado.trim() ? '#FFF' : '#1F1F1F', color: pegado.trim() ? '#111' : '#4B5563',
                  fontSize: 12.5, fontWeight: 800, fontFamily: 'Inter, sans-serif',
                }}>Leer lo pegado</button>
                {rows && archivo === 'pegado' && <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 10 }}>{jugadores.length} jugadores detectados</span>}
              </div>
            ) : (
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={label}>ARCHIVO CSV</div>
                <input type="file" accept=".csv,text/csv,text/plain" onChange={e => leerArchivo(e.target.files?.[0])} style={{ ...field, padding: 8 }} />
                {archivo && archivo !== 'pegado' && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{archivo} · {jugadores.length} jugadores</div>}
              </label>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={label}>JUEGO</div>
                <select value={game} onChange={e => setGame(e.target.value)} style={field}>
                  {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <div style={label}>REGIÓN</div>
                <select value={branch} onChange={e => setBranch(e.target.value)} style={field}>
                  {REGIONES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={label}>NOMBRE DEL TORNEO</div>
                <input value={nombre} onChange={e => setNombre(e.target.value.slice(0, 80))} placeholder="Ej. Regional One Piece — Septiembre" style={field} />
              </div>
              <div>
                <div style={label}>FECHA</div>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={field} />
              </div>
            </div>

            {rows && (
              <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: '#0D0D0D', border: '1px solid #1F1F1F' }}>
                <div style={{ ...label, marginBottom: 8 }}>¿QUÉ COLUMNA ES QUÉ?</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>Posición</div>
                    <select value={posCol} onChange={e => setPosCol(e.target.value === 'order' ? 'order' : Number(e.target.value))} style={field}>
                      <option value="order">Orden de las filas</option>
                      {header.map((h, i) => <option key={i} value={i}>{h || `columna ${i + 1}`}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>Nombre del jugador</div>
                    <select value={nameCol} onChange={e => setNameCol(Number(e.target.value))} style={field}>
                      {header.map((h, i) => <option key={i} value={i}>{h || `columna ${i + 1}`}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>Vista previa</div>
                {jugadores.slice(0, 6).map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12.5, color: '#D1D5DB', padding: '3px 0' }}>
                    <span style={{ width: 28, color: '#A78BFA', fontWeight: 800 }}>#{p.position}</span>
                    <span>{p.name}</span>
                  </div>
                ))}
                {jugadores.length > 6 && <div style={{ fontSize: 11, color: '#4B5563' }}>… y {jugadores.length - 6} más</div>}
              </div>
            )}

            {error && <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171', fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

            <button onClick={importar} disabled={!listo || busy} style={{
              width: '100%', padding: 13, borderRadius: 12, border: 'none', cursor: listo ? 'pointer' : 'default',
              background: listo ? 'linear-gradient(135deg, #FB923C 0%, #F472B6 60%, #A78BFA 130%)' : '#1F1F1F',
              color: listo ? '#FFF' : '#4B5563', fontSize: 14, fontWeight: 800,
            }}>
              {busy ? 'Importando…' : `Importar ${jugadores.length || ''} jugadores`}
            </button>
            <div style={{ fontSize: 11, color: '#4B5563', marginTop: 8, lineHeight: 1.5 }}>
              Puntos: 1° = 4 · 2° = 3 · 3° = 2 · 4° = 1 · el resto no suma. Un torneo con el mismo nombre y fecha no se importa dos veces.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
