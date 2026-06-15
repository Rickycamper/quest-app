// ─────────────────────────────────────────────
// QUEST — LiveStreamScreen
// Transmisión en vivo embebida (Twitch / YouTube).
// El equipo (staff/admin/owner) inicia/termina; todos miran.
// ─────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { X, Radio, Square } from 'lucide-react'
import { getActiveLiveStream, startLiveStream, stopLiveStream } from '../lib/supabase'

const RED = '#EF4444'
const RED_SOFT = '#F87171'

// Detecta plataforma + id/canal desde un link pegado.
export function parseStreamUrl(raw) {
  const url = (raw || '').trim()
  if (!url) return null
  // YouTube: youtu.be/ID · watch?v=ID · live/ID · embed/ID · shorts/ID
  let m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/)
  if (m) return { platform: 'youtube', channel: m[1] }
  // Twitch: twitch.tv/<canal>  (ignora /videos/, /directory, etc.)
  m = url.match(/twitch\.tv\/([A-Za-z0-9_]{3,})/)
  if (m && !['videos', 'directory', 'settings'].includes(m[1].toLowerCase())) {
    return { platform: 'twitch', channel: m[1] }
  }
  return null
}

// URL embebible para el iframe.
function embedUrl(live) {
  if (!live) return null
  if (live.platform === 'youtube') {
    return `https://www.youtube.com/embed/${live.channel}?autoplay=1&playsinline=1&rel=0`
  }
  const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  return `https://player.twitch.tv/?channel=${encodeURIComponent(live.channel)}&parent=${parent}&autoplay=true`
}

export default function LiveStreamScreen({ onClose, isStaff = false, onLiveChange }) {
  const [live, setLive] = useState(undefined) // undefined = cargando
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    getActiveLiveStream().then(l => setLive(l ?? null)).catch(() => setLive(null))
  }, [])
  useEffect(() => { load() }, [load])

  const parsed = parseStreamUrl(url)

  const handleStart = async () => {
    if (busy) return
    const p = parseStreamUrl(url)
    if (!p) { setError('Pegá un link válido de YouTube o Twitch.'); return }
    setBusy(true); setError('')
    try {
      const created = await startLiveStream({ platform: p.platform, url: url.trim(), channel: p.channel, title })
      setLive(created)
      onLiveChange?.(created)
      setUrl(''); setTitle('')
    } catch (e) {
      setError(e?.message || 'No se pudo iniciar la transmisión.')
    } finally { setBusy(false) }
  }

  const handleStop = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      await stopLiveStream()
      setLive(null)
      onLiveChange?.(null)
    } catch (e) {
      setError(e?.message || 'No se pudo terminar la transmisión.')
    } finally { setBusy(false) }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 240, background: '#0A0A0A',
      display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top, 0px)',
      animation: 'slideUp 0.25s ease', fontFamily: 'Inter, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 12px',
        flexShrink: 0, background: '#0D0D0D', borderBottom: '1px solid #1A1A1A',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 8,
          background: 'rgba(239,68,68,0.14)', border: `1px solid ${RED}`,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: RED, boxShadow: `0 0 8px ${RED}`, animation: 'pulse 1.1s ease-in-out infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 900, color: RED_SOFT, letterSpacing: '0.12em' }}>EN VIVO</span>
        </div>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Transmisión
        </span>
        <button onClick={onClose} aria-label="Cerrar" style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
          color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><X size={18} strokeWidth={2.2} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }}>
        {live === undefined ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7280', fontSize: 13 }}>Cargando…</div>
        ) : live ? (
          <>
            {/* Reproductor 16:9 */}
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 14, overflow: 'hidden', background: '#000', border: '1px solid #1F1F1F' }}>
              <iframe
                src={embedUrl(live)}
                title={live.title || 'Transmisión en vivo'}
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                frameBorder="0"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              />
            </div>
            {live.title && (
              <div style={{ fontSize: 15, fontWeight: 800, color: '#FFF', marginTop: 14 }}>{live.title}</div>
            )}
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, textTransform: 'capitalize' }}>
              {live.platform} · en vivo
            </div>

            {isStaff && (
              <button onClick={handleStop} disabled={busy} style={{
                width: '100%', marginTop: 20, padding: '14px 0', borderRadius: 12,
                background: busy ? '#1A1A1A' : 'rgba(239,68,68,0.12)', border: `1.5px solid ${RED}`,
                color: RED_SOFT, fontSize: 14, fontWeight: 800, cursor: busy ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Square size={15} strokeWidth={2.5} /> {busy ? 'Terminando…' : 'Terminar transmisión'}
              </button>
            )}
            {error && <div style={{ fontSize: 12, color: RED_SOFT, marginTop: 10, textAlign: 'center' }}>{error}</div>}
          </>
        ) : isStaff ? (
          // Sin transmisión activa + soy staff → formulario para iniciar
          <>
            <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6, marginBottom: 18 }}>
              Transmití por <strong style={{ color: '#FFF' }}>YouTube</strong> o <strong style={{ color: '#FFF' }}>Twitch</strong> (con OBS o el celular) y pegá acá el link en vivo. Todos verán el banner <strong style={{ color: RED_SOFT }}>EN VIVO</strong> y podrán mirar las partidas dentro de la app.
            </div>

            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em' }}>LINK DEL STREAM</label>
            <input value={url} onChange={e => { setUrl(e.target.value); setError('') }}
              placeholder="https://twitch.tv/tucanal  ·  youtube.com/watch?v=…"
              style={{ width: '100%', marginTop: 6, marginBottom: 6, padding: '12px 14px', borderRadius: 12, background: '#111', border: `1px solid ${url && !parsed ? RED : '#2A2A2A'}`, color: '#FFF', fontWeight: 600, outline: 'none' }} />
            {url && (
              <div style={{ fontSize: 11, color: parsed ? '#4ADE80' : RED_SOFT, marginBottom: 12 }}>
                {parsed ? `✓ ${parsed.platform === 'youtube' ? 'YouTube' : 'Twitch'} detectado` : 'No reconozco ese link (usá YouTube o Twitch)'}
              </div>
            )}

            <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em' }}>TÍTULO (opcional)</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Final Mundial One Piece — Grupo A"
              style={{ width: '100%', marginTop: 6, marginBottom: 18, padding: '12px 14px', borderRadius: 12, background: '#111', border: '1px solid #2A2A2A', color: '#FFF', fontWeight: 600, outline: 'none' }} />

            {error && <div style={{ fontSize: 12, color: RED_SOFT, marginBottom: 12 }}>{error}</div>}

            <button onClick={handleStart} disabled={busy || !parsed} style={{
              width: '100%', padding: '16px 0', borderRadius: 14,
              background: (busy || !parsed) ? '#1A1A1A' : `linear-gradient(135deg, ${RED} 0%, #B91C1C 100%)`,
              border: 'none', cursor: (busy || !parsed) ? 'default' : 'pointer',
              color: (busy || !parsed) ? '#555' : '#FFF', fontSize: 16, fontWeight: 900, letterSpacing: '0.03em',
              boxShadow: (busy || !parsed) ? 'none' : '0 8px 28px rgba(239,68,68,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <Radio size={19} strokeWidth={2.4} /> {busy ? 'Iniciando…' : 'Iniciar EN VIVO'}
            </button>

            <div style={{ fontSize: 11, color: '#4B5563', marginTop: 14, lineHeight: 1.6 }}>
              💡 Tip: en YouTube poné la transmisión como <strong>Pública</strong> o <strong>No listada</strong>. En Twitch, basta con tu canal en vivo.
            </div>
          </>
        ) : (
          // No staff y no hay transmisión
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📺</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#FFF' }}>No hay transmisión en vivo</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 6, lineHeight: 1.5 }}>
              Cuando el equipo esté transmitiendo, lo vas a ver acá.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
