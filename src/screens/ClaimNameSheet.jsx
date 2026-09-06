// ─────────────────────────────────────────────
// QUEST — Reclamar tu nombre de torneo (CSV)
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { getUnclaimedNames, claimPlayerName, getMyAliases, supabase } from '../lib/supabase'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

export function ClaimNameBanner({ game, onOpen }) {
  const [logueado, setLogueado] = useState(false)
  const [hay, setHay] = useState(false)
  useEffect(() => {
    let vivo = true
    supabase.auth.getSession().then(({ data: { session } }) => { if (vivo) setLogueado(!!session?.user?.id) })
    if (game) getUnclaimedNames(game).then(l => { if (vivo) setHay(l.length > 0) }).catch(() => {})
    return () => { vivo = false }
  }, [game])
  if (!logueado || !hay) return null
  return (
    <button onClick={onOpen} style={{
      margin: '0 16px 12px', width: 'calc(100% - 32px)', textAlign: 'left', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14,
      background: 'linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(96,165,250,0.10) 100%)',
      border: '1.5px solid rgba(167,139,250,0.35)', fontFamily: 'Inter, sans-serif',
    }}>
      <span style={{ fontSize: 22 }}>🔗</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: '#FFF' }}>¿Jugaste un torneo y no aparecés?</span>
        <span style={{ display: 'block', fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>Reclamá tu nombre y tus resultados se suman al ranking.</span>
      </span>
      <span style={{ color: '#A78BFA', fontWeight: 800 }}>→</span>
    </button>
  )
}

export default function ClaimNameSheet({ game, onClose, onClaimed }) {
  const [lista,   setLista]   = useState(null)
  const [mios,    setMios]    = useState([])
  const [q,       setQ]       = useState('')
  const [confirm, setConfirm] = useState(null)   // name_norm pendiente de segundo toque
  const [busy,    setBusy]    = useState(null)
  const [ok,      setOk]      = useState(null)
  const [error,   setError]   = useState('')

  const cargar = () => Promise.all([getUnclaimedNames(game), getMyAliases()])
    .then(([l, m]) => { setLista(l); setMios(m) })
    .catch(e => { setError(e.message); setLista([]) })
  useEffect(() => { cargar() }, [game])

  const reclamar = async (n) => {
    if (confirm !== n.name_norm) { setConfirm(n.name_norm); return }
    setBusy(n.name_norm); setError('')
    try {
      const r = await claimPlayerName(game, n.name_norm)
      setOk(r); setConfirm(null)
      await cargar()
      onClaimed?.(r)
    } catch (e) {
      setError(e?.message || 'No se pudo reclamar.')
    }
    setBusy(null)
  }

  const filtrada = (lista ?? []).filter(n => !q || n.raw_name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        background: '#111', borderRadius: '18px 18px 0 0', border: '1px solid #262626', borderBottom: 'none',
        padding: '18px 18px calc(20px + env(safe-area-inset-bottom, 0px))', fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#FFF' }}>Reclamá tu nombre · {game}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5, marginBottom: 12 }}>
          Estos nombres vienen de los CSV de los torneos. Buscá el tuyo y tocá <strong style={{ color: '#FFF' }}>Este soy yo</strong>: se te suman todos sus resultados, y los próximos torneos te reconocen solos.
        </div>

        {ok && (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ADE80', fontSize: 13, marginBottom: 10 }}>
            ✓ "{ok.name}" es tuyo: {ok.results} resultado{ok.results === 1 ? '' : 's'} sumado{ok.results === 1 ? '' : 's'} al ranking.
          </div>
        )}
        {error && <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171', fontSize: 12.5, marginBottom: 10 }}>{error}</div>}

        {mios.length > 0 && (
          <div style={{ marginBottom: 10, fontSize: 11.5, color: '#9CA3AF' }}>
            Tus nombres: {mios.map(m => <span key={m.id} style={{ display: 'inline-block', margin: '2px 4px 0 0', padding: '2px 8px', borderRadius: 999, background: '#1F1F1F', color: '#D1D5DB', fontWeight: 700 }}>{m.raw_name} · {m.game}</span>)}
          </div>
        )}

        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscá tu nombre como aparece en el torneo…" style={{
          width: '100%', padding: '10px 12px', borderRadius: 10, boxSizing: 'border-box', marginBottom: 10,
          background: '#0D0D0D', border: '1px solid #2A2A2A', color: '#FFF', fontSize: 13, outline: 'none', colorScheme: 'dark',
        }} />

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 120 }}>
          {lista === null && <div style={{ color: '#6B7280', fontSize: 13, padding: 12 }}>Cargando…</div>}
          {lista !== null && filtrada.length === 0 && (
            <div style={{ color: '#6B7280', fontSize: 13, padding: 12, textAlign: 'center' }}>
              {q ? 'Ningún nombre coincide. Probá con parte del nombre.' : 'No hay nombres sin reclamar en este juego.'}
            </div>
          )}
          {filtrada.map(n => {
            const pendiente = confirm === n.name_norm
            return (
              <div key={n.name_norm} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: '#0D0D0D', border: `1px solid ${pendiente ? 'rgba(167,139,250,0.5)' : '#1F1F1F'}`, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.raw_name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    {n.results} torneo{n.results === 1 ? '' : 's'} · mejor puesto {MEDAL[n.best_position] ?? `#${n.best_position}`}
                  </div>
                </div>
                <button onClick={() => reclamar(n)} disabled={busy === n.name_norm} style={{
                  padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  background: pendiente ? '#A78BFA' : 'rgba(167,139,250,0.15)', color: pendiente ? '#111' : '#C4B5FD',
                  fontSize: 12, fontWeight: 800,
                }}>
                  {busy === n.name_norm ? '…' : pendiente ? '¿Seguro? Tocá de nuevo' : 'Este soy yo'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
