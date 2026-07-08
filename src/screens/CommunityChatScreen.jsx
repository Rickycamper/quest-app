// ─────────────────────────────────────────────
// QUEST — CommunityChatScreen
// Chat de comunidad por TCG (estilo WhatsApp): texto, foto y nota de voz.
// Lee cualquiera; escriben usuarios logueados e invitados (nombre temporal).
// ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { GAMES, GAME_STYLES, BRANCH_STYLES } from '../lib/constants'
import GameIcon from '../components/GameIcon'
import Avatar from '../components/Avatar'
import Spinner from '../components/Spinner'
import { CameraIcon, MicIcon, SendIcon, TrashIcon, MapPinIcon } from '../components/Icons'

const CITY_LABEL = { Panama: 'Panamá', David: 'David', Chitre: 'Chitré' }
function CityChip({ city }) {
  if (!city) return null
  const bs = BRANCH_STYLES[city] || {}
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 8, background: bs.bg || 'rgba(255,255,255,0.06)', border: `1px solid ${bs.border || 'rgba(255,255,255,0.12)'}` }}>
      <MapPinIcon size={9} color={bs.dot || '#6B7280'} />
      <span style={{ fontSize: 9.5, fontWeight: 700, color: bs.color || '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>{CITY_LABEL[city] || city}</span>
    </span>
  )
}
import {
  getCommunityMessages, sendCommunityMessage, uploadChatMedia,
  subscribeToCommunityRoom, deleteCommunityMessage,
  getChatGuestIdentity, setChatGuestName,
} from '../lib/supabase'

const PAGE = 200

// Baja la resolución de una foto antes de subir (máx 1280px lado largo)
async function downscaleImage(file) {
  try {
    const bmp = await createImageBitmap(file)
    const max = 1280
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    if (scale >= 1 && file.size < 900_000) return file
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale)
    c.height = Math.round(bmp.height * scale)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85))
    return blob || file
  } catch { return file }
}

const fmtDur = (ms) => {
  const s = Math.round((ms || 0) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function CommunityChatScreen({ onClose }) {
  const [room, setRoom] = useState(null)   // null = lista de salas
  return room
    ? <Room game={room} onBack={() => setRoom(null)} onClose={onClose} />
    : <RoomList onPick={setRoom} onClose={onClose} />
}

// ── Lista de salas (una por TCG) ───────────────
function RoomList({ onPick, onClose }) {
  return (
    <div style={s.root}>
      <div style={s.header}>
        <button onClick={onClose} style={s.backBtn} aria-label="Cerrar">✕</button>
        <span style={s.title}>Chat de la comunidad</span>
      </div>
      <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, color: '#6B7280', fontFamily: 'Inter, sans-serif', marginBottom: 2 }}>
          Elegí una sala para chatear con toda la comunidad
        </div>
        {GAMES.map(g => {
          const gs = GAME_STYLES[g] || {}
          return (
            <button key={g} onClick={() => onPick(g)} style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%',
              padding: 14, borderRadius: 16, cursor: 'pointer', textAlign: 'left',
              background: gs.bg || 'rgba(255,255,255,0.04)',
              border: `1px solid ${gs.border || 'rgba(255,255,255,0.08)'}`,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.3)',
              }}>
                <GameIcon game={g} size={28} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif' }}>{g}</span>
                <span style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>Sala de {g}</span>
              </div>
              <span style={{ fontSize: 20, color: gs.color || '#6B7280' }}>›</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Sala de chat ───────────────────────────────
function Room({ game, onBack, onClose }) {
  const { profile } = useAuth()
  const gs = GAME_STYLES[game] || {}
  const isStaff = !!(profile?.is_owner || profile?.role === 'staff' || profile?.role === 'admin')

  const [messages, setMessages] = useState([])
  const [loading, setLoading]   = useState(true)
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)
  const [err, setErr]           = useState('')
  const [viewImg, setViewImg]   = useState(null)      // foto en pantalla completa

  // Identidad de invitado (si no hay sesión)
  const [guestName, setGuestNameState] = useState(() => getChatGuestIdentity().name)
  const [askName, setAskName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const bottomRef = useRef(null)
  const fileRef   = useRef(null)

  const authorInfo = () => profile
    ? { name: profile.username, avatar: profile.avatar_url, city: profile.branch || null }
    : { name: guestName || 'Invitado', avatar: null, city: null }

  // Carga inicial + realtime
  useEffect(() => {
    let channel, cancelled = false
    ;(async () => {
      try {
        const msgs = await getCommunityMessages(game, PAGE)
        if (cancelled) return
        setMessages(msgs)
        channel = subscribeToCommunityRoom(
          game,
          (m) => setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]),
          (old) => setMessages(prev => prev.filter(x => x.id !== old.id)),
        )
      } catch (e) {
        if (!cancelled) setErr('No se pudo cargar el chat')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true; if (channel) channel.unsubscribe() }
  }, [game])

  // Auto-scroll al fondo cuando llegan mensajes
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }) }, [messages.length])

  const pushSent = (row) => setMessages(prev => prev.some(x => x.id === row.id) ? prev : [...prev, row])

  // ── Enviar texto ──
  const handleSendText = async () => {
    const body = text.trim()
    if (!body || sending) return
    // Invitado sin nombre → pedirlo primero
    if (!profile && !guestName) { setAskName(true); return }
    setSending(true); setErr('')
    try {
      const row = await sendCommunityMessage({ game, kind: 'text', body, author: authorInfo() })
      pushSent(row); setText('')
    } catch (e) { setErr('No se pudo enviar') }
    finally { setSending(false) }
  }

  // ── Enviar foto ──
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!profile && !guestName) { setAskName(true); return }
    setSending(true); setErr('')
    try {
      const blob = await downscaleImage(file)
      const url  = await uploadChatMedia(blob, game, 'image')
      const row  = await sendCommunityMessage({ game, kind: 'image', mediaUrl: url, author: authorInfo() })
      pushSent(row)
    } catch (e) { setErr('No se pudo subir la foto') }
    finally { setSending(false) }
  }

  // ── Nota de voz (mantener para grabar) ──
  const recRef   = useRef(null)
  const chunksRef = useRef([])
  const startTsRef = useRef(0)
  const streamRef = useRef(null)
  const cancelRef = useRef(false)
  const [recording, setRecording] = useState(false)
  const [recMs, setRecMs] = useState(0)
  const recTimer = useRef(null)

  const startRec = async () => {
    if (recording || sending) return
    if (!profile && !guestName) { setAskName(true); return }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setErr('Tu navegador no permite grabar audio'); return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) || ''
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      cancelRef.current = false
      rec.ondataavailable = (ev) => { if (ev.data?.size) chunksRef.current.push(ev.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const dur = Date.now() - startTsRef.current
        clearInterval(recTimer.current); setRecMs(0); setRecording(false)
        if (cancelRef.current || dur < 700) return   // cancelado o muy corto
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        setSending(true); setErr('')
        try {
          const url = await uploadChatMedia(blob, game, 'voice')
          const row = await sendCommunityMessage({ game, kind: 'voice', mediaUrl: url, durationMs: dur, author: authorInfo() })
          pushSent(row)
        } catch (e) { setErr('No se pudo enviar la nota de voz') }
        finally { setSending(false) }
      }
      recRef.current = rec
      startTsRef.current = Date.now()
      rec.start()
      setRecording(true); setRecMs(0)
      recTimer.current = setInterval(() => setRecMs(Date.now() - startTsRef.current), 100)
      // Al soltar el dedo (aunque el botón del mic ya se haya desmontado porque
      // la barra cambió al modo grabación) se envía. Se escucha en window.
      const onUp = () => stopRec(false)
      upHandlerRef.current = onUp
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    } catch (e) {
      setErr('Permití el micrófono para grabar')
    }
  }
  const upHandlerRef = useRef(null)
  const stopRec = (cancel = false) => {
    if (upHandlerRef.current) {
      window.removeEventListener('pointerup', upHandlerRef.current)
      window.removeEventListener('pointercancel', upHandlerRef.current)
      upHandlerRef.current = null
    }
    if (!recRef.current) return
    cancelRef.current = cancel
    try { recRef.current.stop() } catch {}
    recRef.current = null
  }
  useEffect(() => () => { // cleanup al desmontar
    clearInterval(recTimer.current)
    try { recRef.current?.stop() } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  const saveGuestName = () => {
    const n = nameDraft.trim().slice(0, 24)
    if (!n) return
    setChatGuestName(n); setGuestNameState(n); setAskName(false); setNameDraft('')
  }
  const openChangeName = () => { setNameDraft(guestName || ''); setAskName(true) }

  return (
    <div style={s.root}>
      {/* Header de la sala */}
      <div style={{ ...s.header, borderBottom: `1px solid ${gs.border || '#1A1A1A'}` }}>
        <button onClick={onBack} style={s.backBtn} aria-label="Volver">‹</button>
        <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
          <GameIcon game={game} size={20} />
        </div>
        <span style={s.title}>{game}</span>
        <span style={{ flex: 1 }} />
        <button onClick={onClose} style={s.backBtn} aria-label="Cerrar">✕</button>
      </div>

      {/* Lista de mensajes */}
      <div style={s.messageList}>
        {loading && <div style={{ textAlign: 'center', marginTop: 40 }}><Spinner /></div>}
        {!loading && messages.length === 0 && (
          <div style={s.emptyHint}>Todavía no hay mensajes en {game}.<br />¡Escribí el primero! 👋</div>
        )}
        {messages.map((m, i) => {
          const mine = profile ? m.user_id === profile.id : (!m.user_id && m.guest_id === getChatGuestIdentity().guestId)
          const prev = messages[i - 1]
          const showDate = !prev || new Date(m.created_at).toDateString() !== new Date(prev.created_at).toDateString()
          return (
            <div key={m.id}>
              {showDate && (
                <div style={{ textAlign: 'center', margin: '10px 0 6px' }}>
                  <span style={{ fontSize: 11, color: '#6B7280', background: '#111', padding: '2px 10px', borderRadius: 10, fontFamily: 'Inter, sans-serif' }}>
                    {dateLabel(m.created_at)}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                {!mine && (
                  <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                    <Avatar url={m.author_avatar} size={26} />
                  </div>
                )}
                <div style={{ maxWidth: '74%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  {!mine && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '0 0 2px 6px' }}>
                      <span style={{ fontSize: 11, color: gs.color || '#9CA3AF', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>{m.author_name}</span>
                      <CityChip city={m.author_city} />
                    </span>
                  )}
                  <div style={{ ...s.bubble, ...(mine ? s.bubbleMe : s.bubbleThem), ...(m.kind !== 'text' ? { padding: m.kind === 'image' ? 4 : '8px 10px' } : {}) }}>
                    {m.kind === 'text' && m.body}
                    {m.kind === 'image' && (
                      <img src={m.media_url} alt="foto" onClick={() => setViewImg(m.media_url)}
                        style={{ maxWidth: 220, maxHeight: 280, borderRadius: 12, display: 'block', cursor: 'pointer', objectFit: 'cover' }} />
                    )}
                    {m.kind === 'voice' && <VoiceBubble url={m.media_url} durationMs={m.duration_ms} mine={mine} />}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '2px 6px 0' }}>
                    <span style={{ fontSize: 10, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>
                      {new Date(m.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {(mine || isStaff) && (
                      <button onClick={async () => { try { await deleteCommunityMessage(m.id); setMessages(p => p.filter(x => x.id !== m.id)) } catch {} }}
                        style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif' }}>
                        borrar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {err && <div style={{ padding: '6px 16px', background: 'rgba(239,68,68,0.1)', borderTop: '1px solid rgba(239,68,68,0.2)', fontSize: 12, color: '#F87171', fontFamily: 'Inter, sans-serif' }}>{err}</div>}

      {/* Invitado: nombre editable (los logueados usan su usuario del perfil) */}
      {!profile && guestName && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 0', background: '#0F0F0F' }}>
          <button onClick={openChangeName} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
            Escribís como <span style={{ color: '#9CA3AF', fontWeight: 700 }}>{guestName}</span> · cambiar
          </button>
        </div>
      )}

      {/* Barra de escritura */}
      {recording ? (
        <div style={{ ...s.inputBar, alignItems: 'center', gap: 12 }}>
          <button onClick={() => stopRec(true)} style={{ ...s.iconBtn, color: '#F87171' }} aria-label="Cancelar"><TrashIcon size={20} color="#F87171" /></button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1s infinite', display: 'inline-block' }} />
            <span style={{ color: '#FFF', fontFamily: 'Inter, sans-serif', fontVariantNumeric: 'tabular-nums', fontSize: 15, fontWeight: 700 }}>{fmtDur(recMs)}</span>
            <span style={{ color: '#6B7280', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>· soltá para enviar</span>
          </div>
          <button onClick={() => stopRec(false)} style={{ ...s.sendBtn, background: gs.color || '#FFF' }} aria-label="Enviar"><SendIcon size={19} color="#111" /></button>
        </div>
      ) : (
        <div style={s.inputBar}>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
          {/* Foto + voz juntas a un costado, con los iconos de la app */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <button onClick={() => fileRef.current?.click()} disabled={sending} style={s.iconBtn} aria-label="Foto">
              <CameraIcon size={22} color="#9CA3AF" />
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); startRec() }}
              disabled={sending}
              style={{ ...s.iconBtn, touchAction: 'none' }}
              aria-label="Mantené para grabar nota de voz"
              title="Mantené para grabar"
            >
              <MicIcon size={21} color="#9CA3AF" />
            </button>
          </div>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText() } }}
            placeholder={`Mensaje a ${game}…`}
            maxLength={2000}
            enterKeyHint="send"
            style={s.input}
          />
          {text.trim() && (
            <button onClick={handleSendText} disabled={sending} style={{ ...s.sendBtn, background: gs.color || '#FFF', opacity: sending ? 0.5 : 1 }} aria-label="Enviar">
              <SendIcon size={19} color="#111" />
            </button>
          )}
        </div>
      )}

      {/* Prompt de nombre para invitados */}
      {askName && (
        <div style={s.modalWrap} onClick={() => setAskName(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif' }}>¿Cómo te llamás?</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>Se muestra junto a tus mensajes en el chat.</div>
            <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveGuestName() }}
              placeholder="Tu nombre" maxLength={24} style={{ ...s.input, width: '100%' }} />
            <button onClick={saveGuestName} disabled={!nameDraft.trim()} style={{ ...s.sendBtn, width: '100%', padding: '11px 0', opacity: nameDraft.trim() ? 1 : 0.5 }}>Empezar a chatear</button>
          </div>
        </div>
      )}

      {/* Visor de foto */}
      {viewImg && (
        <div style={{ ...s.modalWrap, background: 'rgba(0,0,0,0.92)' }} onClick={() => setViewImg(null)}>
          <img src={viewImg} alt="foto" style={{ maxWidth: '94%', maxHeight: '88%', borderRadius: 12 }} />
        </div>
      )}
    </div>
  )
}

// ── Burbuja de nota de voz ─────────────────────
function VoiceBubble({ url, durationMs, mine }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [pct, setPct] = useState(0)
  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause() } else { a.play().catch(() => {}) }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 150 }}>
      <audio ref={audioRef} src={url} preload="none"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setPct(0) }}
        onTimeUpdate={e => { const a = e.currentTarget; if (a.duration) setPct(a.currentTime / a.duration) }} />
      <button onClick={toggle} style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', border: 'none',
        background: mine ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.12)',
        color: mine ? '#111' : '#FFF', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{playing ? '❚❚' : '▶'}</button>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: mine ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.18)', position: 'relative', minWidth: 70 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, background: mine ? '#111' : '#FFF', borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, opacity: 0.7, fontFamily: 'Inter, sans-serif', fontVariantNumeric: 'tabular-nums' }}>{fmtDur(durationMs)}</span>
    </div>
  )
}

function dateLabel(ts) {
  const d = new Date(ts), now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Hoy'
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short' })
}

const s = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A' },
  header: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 12px', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 },
  title: { color: '#FFFFFF', fontWeight: 800, fontSize: 16, fontFamily: 'Inter, sans-serif' },
  messageList: { flex: 1, overflowY: 'auto', padding: '10px 14px 16px', display: 'flex', flexDirection: 'column', gap: 6, scrollbarWidth: 'none' },
  emptyHint: { color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40, fontFamily: 'Inter, sans-serif', lineHeight: 1.6 },
  bubble: { padding: '9px 13px', fontSize: 14, lineHeight: 1.45, fontFamily: 'Inter, sans-serif', wordBreak: 'break-word' },
  bubbleMe:   { borderRadius: '16px 16px 4px 16px', background: '#FFFFFF', color: '#111111' },
  bubbleThem: { borderRadius: '16px 16px 16px 4px', background: '#1A1A1F', color: '#E5E5E5' },
  inputBar: { display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px calc(env(safe-area-inset-bottom,0px) + 12px)', borderTop: '1px solid #1A1A1F', background: '#0F0F0F', flexShrink: 0 },
  input: { flex: 1, background: '#1A1A1F', border: '1px solid #2A2A2A', borderRadius: 20, padding: '10px 14px', color: '#FFFFFF', fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif' },
  iconBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '4px 6px', lineHeight: 1 },
  sendBtn: { minWidth: 42, height: 42, borderRadius: '50%', background: '#FFFFFF', border: 'none', fontWeight: 800, fontSize: 18, color: '#111111', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalWrap: { position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 320, background: '#141418', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 },
}
