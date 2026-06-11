// ─────────────────────────────────────────────
// QUEST — LiveDrawScreen  (Sorteo EN VIVO)
// Sorteo tipo "show de TV" para definir grupos de 4.
// Cada toque = revelación dramática (ruleta → flash → confeti → cae al grupo).
// 100% client-side — no toca Supabase.
// ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, Plus, Trash2, Shuffle, RotateCcw, Dices, Download } from 'lucide-react'

// Acento One Piece (rojo pirata)
const RED = '#EF4444'
const RED_SOFT = '#F87171'
const GOLD = '#FBBF24'
const CONFETTI = ['#EF4444', '#F87171', '#FBBF24', '#FB923C', '#FFFFFF', '#F472B6']

const DEFAULT_NUM_GROUPS = 6   // configurable en pantalla
const GROUP_OPTIONS = [2, 4, 6, 8]
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const FLICKER_MS = 65          // velocidad de la ruleta
const SPIN_MS = 1700           // cuánto gira antes de fijar
const CELEBRATE_MS = 1400      // duración de la celebración antes de caer al grupo

// Capacidad final del grupo gi al repartir `total` jugadores round-robin
// entre `n` grupos (los primeros grupos reciben uno más si no es exacto).
function groupCapacity(total, n, gi) {
  return Math.floor(total / n) + (gi < total % n ? 1 : 0)
}
// Etiqueta "5" o "4–5" según si el reparto es exacto
function sizeLabel(total, n) {
  const base = Math.floor(total / n), rem = total % n
  return rem === 0 ? `${base}` : `${base}–${base + 1}`
}

// rect redondeado (fallback por si el browser no tiene ctx.roundRect)
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Genera una imagen PNG LIMPIA de los grupos (sin confeti ni animaciones)
// usando canvas, y dispara la descarga. Sin librerías externas.
function downloadGroupsImage(title, groups, numGroups, total) {
  const SCALE = 2
  const COLS = numGroups > 1 ? 2 : 1
  const rows = Math.ceil(numGroups / COLS)
  const maxPer = Math.max(1, ...groups.map(g => g.length))
  const PAD = 40, GAP = 24, cardW = 440, rowH = 58, headH = 56, hdr = 140
  const cardH = headH + maxPer * rowH + 16
  const W = PAD * 2 + COLS * cardW + (COLS - 1) * GAP
  const H = hdr + rows * cardH + (rows - 1) * GAP + PAD
  const cv = document.createElement('canvas')
  cv.width = W * SCALE; cv.height = H * SCALE
  const ctx = cv.getContext('2d')
  ctx.scale(SCALE, SCALE)
  const FONT = "-apple-system, 'Inter', sans-serif"

  // Fondo limpio con un glow rojo estático (sin animación, sin confeti)
  ctx.fillStyle = '#0A0A0A'; ctx.fillRect(0, 0, W, H)
  const gr = ctx.createRadialGradient(W * 0.3, 10, 0, W * 0.3, 10, W * 0.85)
  gr.addColorStop(0, 'rgba(239,68,68,0.13)'); gr.addColorStop(1, 'rgba(239,68,68,0)')
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)

  // Título
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
  ctx.fillStyle = '#FFFFFF'; ctx.font = `800 36px ${FONT}`
  ctx.fillText(`🏴‍☠️ ${title || 'Sorteo'}`, W / 2, 56)
  ctx.fillStyle = '#9CA3AF'; ctx.font = `600 17px ${FONT}`
  ctx.fillText(`${numGroups} grupos de ${sizeLabel(total, numGroups)} · ${total} jugadores`, W / 2, 96)

  groups.forEach((grp, gi) => {
    const col = gi % COLS, row = Math.floor(gi / COLS)
    const x = PAD + col * (cardW + GAP)
    const y = hdr + row * (cardH + GAP)
    // card
    ctx.fillStyle = 'rgba(255,255,255,0.03)'; roundRect(ctx, x, y, cardW, cardH, 18); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; roundRect(ctx, x, y, cardW, cardH, 18); ctx.stroke()
    // header pill
    ctx.fillStyle = 'rgba(239,68,68,0.14)'; roundRect(ctx, x + 16, y + 13, 138, 32, 9); ctx.fill()
    ctx.fillStyle = '#F87171'; ctx.font = `900 17px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(`GRUPO ${LETTERS[gi]}`, x + 30, y + 30)
    // players
    grp.forEach((p, pi) => {
      const py = y + headH + pi * rowH + rowH / 2
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.font = '30px sans-serif'
      ctx.fillText(p.flag || '🏴', x + 24, py)
      ctx.fillStyle = '#FFFFFF'; ctx.font = `800 22px ${FONT}`
      ctx.fillText(p.name, x + 72, py - 9)
      if (p.country) { ctx.fillStyle = '#9CA3AF'; ctx.font = `600 14px ${FONT}`; ctx.fillText(p.country, x + 72, py + 13) }
    })
  })

  cv.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'sorteo').trim().replace(/\s+/g, '_')}_grupos.png`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

// ── Lista pre-cargada (24 jugadores) ──────────
const DEFAULT_PLAYERS = [
  { name: 'Polar',         country: 'Portugal',      flag: '🇵🇹' },
  { name: 'Fredy A',       country: 'Brasil',        flag: '🇧🇷' },
  { name: 'Ninbor',        country: 'Panamá',        flag: '🇵🇦' },
  { name: 'epicliu',       country: 'Corea del Sur', flag: '🇰🇷' },
  { name: 'Marcos',        country: 'Uzbekistán',    flag: '🇺🇿' },
  { name: 'Yemil',         country: 'Irak',          flag: '🇮🇶' },
  { name: 'Rolo',          country: 'R.D. del Congo',flag: '🇨🇩' },
  { name: 'Josetel',       country: 'Japón',         flag: '🇯🇵' },
  { name: 'Pipe',          country: 'Argentina',     flag: '🇦🇷' },
  { name: 'Ricardo F',     country: 'México',        flag: '🇲🇽' },
  { name: 'Sebas',         country: 'España',        flag: '🇪🇸' },
  { name: 'Diego',         country: 'Alemania',      flag: '🇩🇪' },
  { name: '🥫',            country: 'Noruega',       flag: '🇳🇴' },
  { name: 'Profe',         country: 'Países Bajos',  flag: '🇳🇱' },
  { name: 'Omar',          country: 'Canadá',        flag: '🇨🇦' },
  { name: 'Joel',          country: 'Uruguay',       flag: '🇺🇾' },
  { name: 'Derian F',      country: 'Francia',       flag: '🇫🇷' },
  { name: 'Rey Pirata',    country: 'Rusia',         flag: '🇷🇺' },
  { name: 'Carlos',        country: 'Cabo Verde',    flag: '🇨🇻' },
  { name: 'Gabriel',       country: 'Jordania',      flag: '🇯🇴' },
  { name: 'FreezerPoint',  country: 'Inglaterra',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'Aris Mendieta', country: 'Arabia Saudí',  flag: '🇸🇦' },
  { name: 'BeamerSam',     country: 'Croacia',       flag: '🇭🇷' },
  { name: 'Gus',           country: 'Turquía',       flag: '🇹🇷' },
]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Keyframes / estilos del show ──────────────
const SHOW_CSS = `
@keyframes ld-bg     { 0%,100% { transform: scale(1) translate(0,0); opacity:.8 } 50% { transform: scale(1.15) translate(2%,-2%); opacity:1 } }
@keyframes ld-ring   { to { transform: rotate(360deg) } }
@keyframes ld-shake  { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-2px,1px)} 50%{transform:translate(2px,-1px)} 75%{transform:translate(-1px,2px)} }
@keyframes ld-pop    { 0%{transform:scale(.4);opacity:0} 55%{transform:scale(1.18);opacity:1} 78%{transform:scale(.94)} 100%{transform:scale(1)} }
@keyframes ld-flash  { 0%{opacity:0} 12%{opacity:.9} 100%{opacity:0} }
@keyframes ld-burst  { 0%{transform:translate(0,0) rotate(0);opacity:1} 100%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:0} }
@keyframes ld-fall   { 0%{transform:translateY(-10vh) rotate(0);opacity:1} 100%{transform:translateY(110vh) rotate(var(--rot));opacity:.85} }
@keyframes ld-slot   { 0%{transform:scale(.7) translateY(-8px);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1) translateY(0);opacity:1} }
@keyframes ld-glow   { 0%,100%{box-shadow:0 0 24px rgba(239,68,68,.45), inset 0 0 18px rgba(239,68,68,.25)} 50%{box-shadow:0 0 44px rgba(239,68,68,.8), inset 0 0 26px rgba(239,68,68,.4)} }
@keyframes ld-breathe{ 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
@keyframes ld-trophy { 0%{transform:scale(.3) rotate(-12deg);opacity:0} 60%{transform:scale(1.25) rotate(6deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
@keyframes ld-sheen  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
`

// ── Confeti: estallido desde el centro ────────
function Burst({ seed }) {
  const pieces = useMemo(() => Array.from({ length: 26 }, (_, i) => {
    const ang = Math.random() * Math.PI * 2
    const dist = 90 + Math.random() * 150
    return {
      dx: Math.cos(ang) * dist,
      dy: Math.sin(ang) * dist - 40,
      rot: Math.random() * 720 - 360,
      color: CONFETTI[i % CONFETTI.length],
      size: 6 + Math.random() * 7,
      delay: Math.random() * 80,
    }
  }), [seed])
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
      {pieces.map((p, i) => (
        <span key={i} style={{
          position: 'absolute', width: p.size, height: p.size * 1.4,
          background: p.color, borderRadius: 2,
          '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`,
          animation: `ld-burst 0.95s cubic-bezier(.2,.6,.3,1) ${p.delay}ms forwards`,
        }} />
      ))}
    </div>
  )
}

// ── Confeti: lluvia (final) ───────────────────
function Rain() {
  const pieces = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    left: Math.random() * 100,
    color: CONFETTI[i % CONFETTI.length],
    size: 6 + Math.random() * 8,
    delay: Math.random() * 2500,
    dur: 2600 + Math.random() * 2200,
    rot: 360 + Math.random() * 720,
  })), [])
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 5 }}>
      {pieces.map((p, i) => (
        <span key={i} style={{
          position: 'absolute', top: 0, left: `${p.left}%`,
          width: p.size, height: p.size * 1.5,
          background: p.color, borderRadius: 2,
          '--rot': `${p.rot}deg`,
          animation: `ld-fall ${p.dur}ms linear ${p.delay}ms infinite`,
        }} />
      ))}
    </div>
  )
}

// ── Texto que cicla (ruleta) ──────────────────
function useFlicker(pool, active) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setIdx(i => (i + 1) % Math.max(pool.length, 1)), FLICKER_MS)
    return () => clearInterval(t)
  }, [active, pool.length])
  return pool[idx % Math.max(pool.length, 1)]
}

// ── Escenario central de revelación ───────────
function Stage({ stage, pool, locked, groupLetter, seed }) {
  const spinning = stage === 'spinning'
  const flick = useFlicker(pool, spinning)
  const shown = spinning ? flick : locked

  const idle = stage === 'idle'

  return (
    <div style={{
      position: 'relative', borderRadius: 22, overflow: 'hidden',
      padding: '26px 18px 22px', marginBottom: 18,
      background: 'radial-gradient(ellipse 80% 90% at 50% 0%, rgba(239,68,68,0.16), rgba(10,10,10,0.2) 70%)',
      border: `1px solid ${idle ? 'rgba(239,68,68,0.22)' : RED}`,
      animation: spinning ? 'ld-glow 0.9s ease-in-out infinite' : (stage === 'locked' ? undefined : undefined),
      minHeight: 168,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Anillo girando detrás (solo al girar) */}
      {spinning && (
        <div style={{
          position: 'absolute', width: 230, height: 230, borderRadius: '50%',
          background: `conic-gradient(from 0deg, transparent, ${RED}, transparent 55%, ${GOLD}, transparent)`,
          opacity: 0.35, filter: 'blur(6px)', animation: 'ld-ring 1.1s linear infinite',
        }} />
      )}
      {/* Flash blanco al fijar */}
      {stage === 'locked' && (
        <div key={`f-${seed}`} style={{
          position: 'absolute', inset: 0, background: '#fff',
          animation: 'ld-flash 0.6s ease-out forwards', pointerEvents: 'none',
        }} />
      )}
      {/* Confeti estallido */}
      {stage === 'locked' && <Burst seed={seed} />}

      {idle ? (
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <div style={{ animation: 'ld-breathe 1.8s ease-in-out infinite', filter: `drop-shadow(0 0 14px ${RED})` }}>
            <Dices size={50} color={RED_SOFT} strokeWidth={1.6} />
          </div>
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: RED_SOFT, letterSpacing: '0.08em' }}>
            TOCÁ PARA REVELAR
          </div>
        </div>
      ) : (
        <div key={`p-${seed}-${stage}`} style={{
          textAlign: 'center', position: 'relative', zIndex: 2,
          animation: stage === 'locked' ? 'ld-pop 0.5s cubic-bezier(.2,.7,.3,1.4)' : 'ld-shake 0.18s linear infinite',
        }}>
          <div style={{
            fontSize: 68, lineHeight: 1,
            filter: stage === 'locked' ? `drop-shadow(0 0 22px ${GOLD})` : `drop-shadow(0 0 14px ${RED})`,
          }}>{shown?.flag ?? '🎰'}</div>
          <div style={{
            marginTop: 8, fontSize: 30, fontWeight: 900, color: '#FFF', letterSpacing: '-0.02em',
            textShadow: stage === 'locked' ? `0 0 26px rgba(251,191,36,0.6)` : `0 0 18px rgba(239,68,68,0.5)`,
          }}>{shown?.name ?? '...'}</div>
          {shown?.country && (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#D1D5DB', marginTop: 2 }}>{shown.country}</div>
          )}
          {stage === 'locked' && (
            <div style={{
              display: 'inline-block', marginTop: 12, padding: '6px 16px', borderRadius: 999,
              background: `linear-gradient(135deg, ${RED}, #B91C1C)`, color: '#FFF',
              fontSize: 14, fontWeight: 900, letterSpacing: '0.06em',
              boxShadow: `0 6px 20px rgba(239,68,68,0.5)`,
            }}>→ GRUPO {groupLetter}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Chip de jugador (grid) ────────────────────
function PlayerChip({ player, justLocked = false }) {
  if (!player) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', borderRadius: 10,
        background: 'rgba(255,255,255,0.02)',
        border: '1px dashed rgba(255,255,255,0.09)', minWidth: 0,
      }}>
        <span style={{ fontSize: 14, opacity: 0.4 }}>❔</span>
        <span style={{ fontSize: 12, color: '#374151', fontWeight: 700 }}>—</span>
      </div>
    )
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px', borderRadius: 10, minWidth: 0,
      background: justLocked ? 'rgba(251,191,36,0.12)' : 'rgba(239,68,68,0.08)',
      border: `1px solid ${justLocked ? 'rgba(251,191,36,0.5)' : 'rgba(239,68,68,0.26)'}`,
      animation: justLocked ? 'ld-slot 0.5s cubic-bezier(.2,.7,.3,1.4)' : undefined,
      transition: 'background 0.6s, border 0.6s',
    }}>
      <span style={{ fontSize: 17, lineHeight: 1, flexShrink: 0 }}>{player.flag}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 800, color: '#FFF',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{player.name}</div>
        {player.country && (
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1, fontWeight: 600 }}>{player.country}</div>
        )}
      </div>
    </div>
  )
}

// ── Setup ─────────────────────────────────────
function SetupView({ title, setTitle, players, setPlayers, groupsWanted, setGroupsWanted, onStart }) {
  const [name, setName] = useState('')
  const [flag, setFlag] = useState('')
  const add = () => {
    const n = name.trim(); if (!n) return
    setPlayers(p => [...p, { name: n, country: '', flag: flag.trim() || '🏴‍☠️' }])
    setName(''); setFlag('')
  }
  const remove = (i) => setPlayers(p => p.filter((_, idx) => idx !== i))
  const canStart = players.length >= 2
  const numGroups = Math.min(groupsWanted, players.length) || 1

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px', fontFamily: 'Inter, sans-serif' }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em' }}>EVENTO</label>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Mundial One Piece"
        style={{ width: '100%', marginTop: 6, marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: '#111', border: '1px solid #2A2A2A', color: '#FFF', fontWeight: 700, outline: 'none' }} />

      {/* Selector de cantidad de grupos */}
      <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em' }}>GRUPOS</label>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 14 }}>
        {GROUP_OPTIONS.map(n => (
          <button key={n} onClick={() => setGroupsWanted(n)} disabled={n > players.length} style={{
            flex: 1, padding: '10px 0', borderRadius: 10,
            cursor: n > players.length ? 'default' : 'pointer',
            opacity: n > players.length ? 0.35 : 1,
            background: groupsWanted === n ? 'rgba(239,68,68,0.12)' : '#111',
            border: `1.5px solid ${groupsWanted === n ? RED : '#2A2A2A'}`,
            color: groupsWanted === n ? RED_SOFT : '#9CA3AF', fontWeight: 800, fontSize: 14,
            fontFamily: 'Inter, sans-serif',
          }}>{n}</button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <span style={{ fontSize: 20 }}>🏴‍☠️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: RED_SOFT }}>{numGroups} grupo{numGroups !== 1 ? 's' : ''} de {sizeLabel(players.length, numGroups)}</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>Sorteo manual — tocás para revelar cada jugador</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em' }}>PARTICIPANTES</label>
        <span style={{ fontSize: 11, fontWeight: 800, color: RED_SOFT }}>{players.length}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={flag} onChange={e => setFlag(e.target.value)} placeholder="🏴" maxLength={4}
          style={{ width: 54, textAlign: 'center', padding: '11px 0', borderRadius: 10, background: '#111', border: '1px solid #2A2A2A', color: '#FFF', outline: 'none' }} />
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="Nombre del jugador"
          style={{ flex: 1, padding: '11px 14px', borderRadius: 10, background: '#111', border: '1px solid #2A2A2A', color: '#FFF', fontWeight: 600, outline: 'none' }} />
        <button onClick={add} style={{ width: 46, borderRadius: 10, background: RED, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Plus size={20} color="#FFF" strokeWidth={2.6} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {players.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: '#111', border: '1px solid #1E1E1E' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#374151', width: 18, textAlign: 'right' }}>{i + 1}</span>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{p.flag}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#FFF' }}>{p.name}</span>
              {p.country && <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 6 }}>{p.country}</span>}
            </div>
            <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px calc(14px + env(safe-area-inset-bottom, 0px))', background: 'linear-gradient(to top, #0A0A0A 70%, transparent)' }}>
        <button onClick={onStart} disabled={!canStart} style={{
          width: '100%', padding: '16px 0', borderRadius: 14,
          background: canStart ? `linear-gradient(135deg, ${RED} 0%, #B91C1C 100%)` : '#1A1A1A',
          border: 'none', cursor: canStart ? 'pointer' : 'default', color: canStart ? '#FFF' : '#555',
          fontSize: 16, fontWeight: 900, letterSpacing: '0.04em', fontFamily: 'Inter, sans-serif',
          boxShadow: canStart ? '0 8px 28px rgba(239,68,68,0.35)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <Shuffle size={20} strokeWidth={2.6} /> INICIAR SORTEO EN VIVO
        </button>
      </div>
    </div>
  )
}

// ── Grid de grupos ────────────────────────────
function GroupsGrid({ committed, numGroups, total, nextGroupIdx, lastLockedIdx }) {
  const groups = Array.from({ length: numGroups }, () => [])
  committed.forEach((p, i) => { groups[i % numGroups].push({ player: p, idx: i }) })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: numGroups > 1 ? '1fr 1fr' : '1fr', gap: 10 }}>
      {groups.map((g, gi) => {
        const isNext = gi === nextGroupIdx
        const slotsLeft = groupCapacity(total, numGroups, gi) - g.length
        return (
          <div key={gi} style={{
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${isNext ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 14, padding: '10px 12px', transition: 'border 0.3s, box-shadow 0.3s',
            boxShadow: isNext ? '0 0 20px rgba(239,68,68,0.22)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 900, color: RED_SOFT, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>GRUPO {LETTERS[gi]}</span>
              {isNext && <span style={{ fontSize: 9, fontWeight: 800, color: RED_SOFT, letterSpacing: '0.08em', animation: 'pulse 1s ease-in-out infinite' }}>SIGUIENTE</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {g.map(({ player, idx }) => <PlayerChip key={idx} player={player} justLocked={idx === lastLockedIdx} />)}
              {Array.from({ length: Math.max(slotsLeft, 0) }).map((_, k) => <PlayerChip key={`e${k}`} player={null} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Componente principal ──────────────────────
export default function LiveDrawScreen({ onClose }) {
  const [phase, setPhase] = useState('setup')   // 'setup' | 'drawing' | 'done'
  const [title, setTitle] = useState('Mundial One Piece')
  const [players, setPlayers] = useState(DEFAULT_PLAYERS)
  const [groupsWanted, setGroupsWanted] = useState(DEFAULT_NUM_GROUPS)

  const [order, setOrder] = useState([])
  const [revealCount, setRevealCount] = useState(0)  // commiteados al grid
  const [stage, setStage] = useState('idle')         // 'idle' | 'spinning' | 'locked'
  const [lastLocked, setLastLocked] = useState(-1)
  const timers = useRef([])

  // Durante el sorteo usamos la cantidad de grupos elegida, acotada a la
  // cantidad de jugadores (no puede haber más grupos que jugadores).
  const numGroups = Math.min(groupsWanted, order.length) || 1
  const finished = phase === 'done'

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => () => clearTimers(), [])

  const start = useCallback(() => {
    setOrder(shuffle(players)); setRevealCount(0); setStage('idle'); setLastLocked(-1); setPhase('drawing')
  }, [players])

  // Un toque = ruleta → fija → confeti → cae al grupo
  const revealNext = useCallback(() => {
    if (stage !== 'idle' || revealCount >= order.length) return
    setLastLocked(-1)
    setStage('spinning')
    const t1 = setTimeout(() => setStage('locked'), SPIN_MS)
    const t2 = setTimeout(() => {
      const next = revealCount + 1
      setLastLocked(revealCount)
      setRevealCount(next)
      setStage('idle')
      if (next >= order.length) {
        const t3 = setTimeout(() => setPhase('done'), 500)
        timers.current.push(t3)
      }
    }, SPIN_MS + CELEBRATE_MS)
    timers.current.push(t1, t2)
  }, [stage, revealCount, order.length])

  const reset = () => {
    clearTimers(); setPhase('setup'); setOrder([]); setRevealCount(0); setStage('idle'); setLastLocked(-1)
  }

  const committed = order.slice(0, revealCount)
  const pool = order.slice(revealCount)                       // candidatos restantes (ruleta)
  const lockedPlayer = order[revealCount] ?? null             // el que se está revelando
  const nextGroupIdx = revealCount < order.length ? revealCount % numGroups : -1
  const remaining = order.length - revealCount

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 240, overflow: 'hidden',
      background: '#08070A', display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)', animation: 'slideUp 0.25s ease',
    }}>
      <style>{SHOW_CSS}</style>

      {/* Fondo animado (glow piratas) */}
      {phase !== 'setup' && (
        <div style={{
          position: 'absolute', inset: -40, pointerEvents: 'none', zIndex: 0,
          background: `radial-gradient(ellipse 60% 40% at 25% 15%, rgba(239,68,68,0.14), transparent 70%), radial-gradient(ellipse 50% 40% at 80% 30%, rgba(251,191,36,0.10), transparent 70%), radial-gradient(ellipse 70% 45% at 50% 110%, rgba(239,68,68,0.10), transparent 70%)`,
          animation: 'ld-bg 7s ease-in-out infinite',
        }} />
      )}

      {/* Lluvia de confeti al terminar */}
      {finished && <Rain />}

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 12px', flexShrink: 0, background: 'rgba(13,13,13,0.6)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1A1A1A' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 8, background: 'rgba(239,68,68,0.14)', border: `1px solid ${RED}` }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: RED, boxShadow: `0 0 8px ${RED}`, animation: 'pulse 1.1s ease-in-out infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 900, color: RED_SOFT, letterSpacing: '0.12em' }}>LIVE</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {phase === 'setup' ? 'Sorteo en vivo' : (title || 'Sorteo')}
          </div>
        </div>
        {phase !== 'setup' && (
          <button onClick={reset} aria-label="Reiniciar" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RotateCcw size={16} />
          </button>
        )}
        <button onClick={onClose} aria-label="Cerrar" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>

      {/* SETUP */}
      {phase === 'setup' && (
        <SetupView title={title} setTitle={setTitle} players={players} setPlayers={setPlayers} groupsWanted={groupsWanted} setGroupsWanted={setGroupsWanted} onStart={start} />
      )}

      {/* DRAWING / DONE */}
      {phase !== 'setup' && (
        <>
          <div style={{ position: 'relative', zIndex: 2, flex: 1, overflowY: 'auto', padding: '16px 16px 24px', fontFamily: 'Inter, sans-serif' }}>
            {!finished ? (
              <>
                {/* Progreso */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(revealCount / order.length) * 100}%`, borderRadius: 4, background: `linear-gradient(90deg, ${RED}, ${GOLD})`, transition: 'width 0.5s ease' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: RED_SOFT, fontVariantNumeric: 'tabular-nums' }}>{revealCount}/{order.length}</span>
                </div>

                <Stage stage={stage} pool={pool} locked={lockedPlayer} groupLetter={LETTERS[nextGroupIdx] ?? ''} seed={revealCount} />

                <GroupsGrid committed={committed} numGroups={numGroups} total={order.length} nextGroupIdx={stage === 'idle' ? nextGroupIdx : -1} lastLockedIdx={lastLocked} />
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', margin: '6px 0 20px' }}>
                  <div style={{ fontSize: 56, animation: 'ld-trophy 0.7s cubic-bezier(.2,.7,.3,1.4)', filter: `drop-shadow(0 0 22px ${GOLD})` }}>🏆</div>
                  <div style={{ fontSize: 19, color: '#FFF', fontWeight: 900, marginTop: 6, letterSpacing: '-0.01em' }}>¡Sorteo completado!</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{numGroups} grupos de {sizeLabel(order.length, numGroups)} · {order.length} jugadores</div>
                </div>
                <GroupsGrid committed={committed} numGroups={numGroups} total={order.length} nextGroupIdx={-1} lastLockedIdx={-1} />
                <button
                  onClick={() => {
                    const groups = Array.from({ length: numGroups }, () => [])
                    committed.forEach((p, i) => groups[i % numGroups].push(p))
                    downloadGroupsImage(title, groups, numGroups, order.length)
                  }}
                  style={{ width: '100%', marginTop: 20, padding: '15px 0', borderRadius: 14, background: `linear-gradient(135deg, ${RED} 0%, #B91C1C 100%)`, border: 'none', color: '#FFF', fontSize: 15, fontWeight: 900, letterSpacing: '0.02em', cursor: 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 8px 24px rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                  <Download size={18} strokeWidth={2.4} /> Descargar imagen
                </button>
                <button onClick={reset} style={{ width: '100%', marginTop: 10, padding: '14px 0', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Shuffle size={17} /> Sortear de nuevo
                </button>
              </>
            )}
          </div>

          {/* Botón gigante de revelar */}
          {!finished && (
            <div style={{ position: 'relative', zIndex: 10, flexShrink: 0, padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid #1A1A1A', background: 'rgba(13,13,13,0.7)', backdropFilter: 'blur(8px)' }}>
              <button onClick={revealNext} disabled={stage !== 'idle'} style={{
                width: '100%', padding: '18px 0', borderRadius: 16,
                background: stage !== 'idle' ? '#161616' : `linear-gradient(135deg, ${RED} 0%, #B91C1C 100%)`,
                border: 'none', cursor: stage !== 'idle' ? 'default' : 'pointer',
                color: stage !== 'idle' ? '#777' : '#FFF', fontSize: 17, fontWeight: 900,
                letterSpacing: '0.04em', fontFamily: 'Inter, sans-serif',
                boxShadow: stage !== 'idle' ? 'none' : '0 8px 30px rgba(239,68,68,0.45)',
                animation: stage === 'idle' ? 'ld-breathe 1.8s ease-in-out infinite' : undefined,
                transition: 'background 0.15s',
              }}>
                {stage === 'spinning' ? '🎰 Sorteando…'
                  : stage === 'locked' ? '✨ ¡Ahí va!'
                  : revealCount === 0 ? '🎲 Revelar primer jugador'
                  : `Revelar siguiente · faltan ${remaining}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
