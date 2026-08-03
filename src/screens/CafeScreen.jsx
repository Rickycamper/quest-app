// ─────────────────────────────────────────────
// QUEST — CafeScreen (Quest Café · coffee.questhobbystore.com)
// SITIO INDEPENDIENTE de la cafetería: en el subdominio (cafe.*, coffee.* o
// questcafe*) o en /cafe, main.jsx monta ESTO en lugar de la app.
//
// ESTÉTICA: clara y limpia (referencia estilo app de café moderna) — fondo
// papel, tarjetas VERDE profundo con la foto del producto FLOTANDO arriba,
// esquinas muy redondeadas, sombras suaves, chips de sección, reveals al
// scrollear. El logo de Quest (blanco) vive dentro de un chip verde para
// funcionar sobre fondo claro.
//
// CLIENTES: sin login — nombre + teléfono (localStorage). EQUIPO: botón
// "Staff" → email + contraseña (signInWithPassword; sin plantillas ni
// redirects). Pedido: place_cafe_order registra C-#### (precios
// recalculados en la base) y sale por WhatsApp; si la migración no corrió,
// WhatsApp sale igual sin código.
// ─────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  supabase, getProfile,
  upsertShopProduct, updateShopProduct, deleteShopProduct, uploadPostImage,
} from '../lib/supabase'
import { STORE_WHATSAPP } from '../lib/constants'
import Spinner from '../components/Spinner'
import questLogo from '../assets/quest-logo-sm.png'

const fmt = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Mismo criterio que el shop: si hay oferta válida, vale la oferta.
const precio = (p) => {
  const base = Number(p?.price) || 0
  const sale = Number(p?.sale_price) || 0
  return (base > 0 && sale > 0 && sale < base) ? sale : base
}

const urlSitioPrincipal = () =>
  window.location.pathname.replace(/\/+$/, '') === '/cafe'
    ? '/'
    : 'https://questhobbystore.com'

// Datos de invitado recordados: pedir nombre y teléfono UNA vez por aparato.
const DATOS_KEY = 'cafe_datos'
const leerDatosGuardados = () => {
  try { return JSON.parse(localStorage.getItem(DATOS_KEY) || '{}') } catch { return {} }
}

// ── Paleta clara ─────────────────────────────────────────────────────────────
const PAPEL   = '#F5F3EE'   // fondo general
const BLANCO  = '#FFFFFF'
const TINTA   = '#222824'   // texto principal
const GRIS    = '#7A817B'   // texto secundario
const LINEA   = '#E6E2D8'   // bordes suaves
const VERDE   = '#173F2C'   // verde profundo de las cards
const VERDE2  = '#1F5238'   // verde hover/degradé
const WABTN   = '#22B85C'   // acción de WhatsApp
const BEBAS   = '"Bebas Neue", Inter, sans-serif'
const SOMBRA  = '0 18px 44px rgba(23,63,44,0.10)'

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: '#F1EEE6',
  border: `1px solid ${LINEA}`, borderRadius: 12, padding: '11px 13px',
  color: TINTA, fontSize: 13.5, outline: 'none', fontFamily: 'Inter, sans-serif',
}
const sheetWrap = {
  position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(24,32,27,0.38)',
  backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
}
const sheetBox = {
  width: '100%', maxWidth: 384, background: BLANCO,
  border: `1px solid ${LINEA}`, borderRadius: 22, padding: 20,
  display: 'flex', flexDirection: 'column', gap: 12,
  fontFamily: 'Inter, sans-serif', boxShadow: '0 30px 70px rgba(23,63,44,0.22)',
  color: TINTA,
}
const btnPrimario = (activo) => ({
  width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
  background: activo ? VERDE : '#E9E6DD',
  color: activo ? '#FFF' : '#A8ADA6',
  fontSize: 13.5, fontWeight: 800, cursor: activo ? 'pointer' : 'default',
  fontFamily: 'Inter, sans-serif',
})
const chipHeader = (solido = false) => ({
  fontSize: 11.5, fontWeight: 800, padding: '8px 12px', borderRadius: 999,
  border: solido ? 'none' : `1px solid ${LINEA}`,
  background: solido ? VERDE : BLANCO,
  color: solido ? '#FFF' : GRIS,
  cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
  boxShadow: solido ? '0 8px 20px rgba(23,63,44,0.25)' : 'none',
})

// Secciones del menú (pedidas así, con humor: el godzilla para lo caliente).
// Viven en shop_products.subcategory — columna ya existente, cero migración.
const SECCIONES_CAFE = [
  { id: 'caliente', titulo: 'CAFÉ CALIENTE', icono: '🦖🔥' },
  { id: 'frio',     titulo: 'FRÍOS',         icono: '🧊'   },
  { id: 'postre',   titulo: 'POSTRES',       icono: '🫳✨' },
  { id: 'salado',   titulo: 'SALADOS',       icono: '🧂'   },
]

// Imágenes genéricas hasta tener material propio (img-src * las permite;
// VIDEO externo no pasaría la CSP — por eso placeholders).
const VIDEOS = [
  { titulo: 'El espresso perfecto',  img: 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=800&q=60&auto=format&fit=crop' },
  { titulo: 'Arte latte en vivo',    img: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=60&auto=format&fit=crop' },
  { titulo: 'Del grano a tu taza',   img: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=60&auto=format&fit=crop' },
]

// Keyframes reales (inline styles no pueden declararlos).
const CSS_CAFE = `
@keyframes cafeLlenar { from { height: 12% } to { height: 82% } }
@keyframes cafeVapor {
  0%   { transform: translateY(4px) scaleX(1);   opacity: 0 }
  35%  { opacity: 0.65 }
  100% { transform: translateY(-16px) scaleX(1.6); opacity: 0 }
}
@keyframes cafeIrse { to { opacity: 0; visibility: hidden } }
@keyframes cafeAparecer {
  from { opacity: 0; transform: translateY(26px) }
  to   { opacity: 1; transform: translateY(0) }
}
@keyframes cafeFlotar {
  0%, 100% { transform: translateY(0) }
  50%      { transform: translateY(-9px) }
}
@keyframes cafeSubir {
  from { transform: translateY(100%) }
  to   { transform: translateY(0) }
}
.cafe-rise { opacity: 0; animation: cafeAparecer 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
.cafe-card { transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease; }
@media (hover: hover) { .cafe-card:hover { transform: translateY(-5px) } }
.cafe-zoom { transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
@media (hover: hover) { .cafe-card:hover .cafe-zoom { transform: scale(1.05) } }
.cafe-chips { scrollbar-width: none; -ms-overflow-style: none; }
.cafe-chips::-webkit-scrollbar { display: none; }
@media (prefers-reduced-motion: reduce) {
  .cafe-rise { animation: none; opacity: 1 }
  .cafe-card, .cafe-zoom { transition: none }
}
`

// ── Splash: la taza llenándose (claro) ───────────────────────────────────────
function SplashTaza({ onFin }) {
  useEffect(() => {
    const t = setTimeout(onFin, 2050)
    return () => clearTimeout(t)
  }, [onFin])
  return (
    <div aria-hidden style={{
      position: 'fixed', inset: 0, zIndex: 100, background: PAPEL,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
      animation: 'cafeIrse 0.45s ease 1.55s both',
    }}>
      <div style={{ position: 'relative', width: 86, height: 74 }}>
        {[18, 38, 58].map((left, i) => (
          <span key={i} style={{
            position: 'absolute', top: -16, left, width: 3, height: 12, borderRadius: 3,
            background: 'rgba(23,63,44,0.4)',
            animation: `cafeVapor 1.3s ease-out ${0.35 + i * 0.22}s infinite`,
          }} />
        ))}
        <div style={{
          position: 'absolute', left: 0, bottom: 0, width: 66, height: 56,
          border: `3px solid ${VERDE}`, borderRadius: '6px 6px 20px 20px',
          overflow: 'hidden', background: BLANCO,
        }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(180deg, #8A5A28 0%, #5B3A17 100%)',
            animation: 'cafeLlenar 1.15s cubic-bezier(0.3, 0, 0.4, 1) 0.15s both',
          }} />
        </div>
        <div style={{
          position: 'absolute', right: 0, bottom: 14, width: 20, height: 26,
          border: `3px solid ${VERDE}`, borderLeft: 'none',
          borderRadius: '0 12px 12px 0',
        }} />
        <div style={{
          position: 'absolute', left: -6, bottom: -8, width: 78, height: 5,
          borderRadius: 3, background: 'rgba(23,63,44,0.18)',
        }} />
      </div>
      <div style={{ fontFamily: BEBAS, fontSize: 22, letterSpacing: '0.22em', color: VERDE }}>
        QUEST CAFÉ
      </div>
    </div>
  )
}

// ── Reveal al scrollear ──────────────────────────────────────────────────────
function Reveal({ children, delay = 0 }) {
  const ref = useRef(null)
  const [visto, setVisto] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (visto || !ref.current) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisto(true); io.disconnect() }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [visto])

  return (
    <div ref={ref} style={{
      opacity: visto ? 1 : 0,
      transform: visto ? 'translateY(0)' : 'translateY(26px)',
      transition: `opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 0.65s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

// ── Ingreso del EQUIPO (email + contraseña) ─────────────────────────────────
function StaffLoginSheet({ onClose }) {
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState('')

  const entrar = async () => {
    if (busy) return
    setBusy(true); setErr('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: pass,
      })
      if (error) throw error
      const perfil = await getProfile(data.user.id).catch(() => null)
      const esStaff = !!(perfil?.is_owner || ['staff', 'admin'].includes(perfil?.role))
      if (!esStaff) {
        await supabase.auth.signOut()
        throw new Error('Esta entrada es solo para el equipo.')
      }
      onClose()
    } catch (e) {
      const m = e?.message || ''
      setErr(/invalid login credentials/i.test(m)
        ? 'Email o contraseña incorrectos.'
        : m || 'No se pudo ingresar')
    } finally { setBusy(false) }
  }

  return (
    <div style={sheetWrap} onClick={onClose}>
      <div style={sheetBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: TINTA }}>Acceso del equipo</div>
        <div style={{ fontSize: 12.5, color: GRIS, lineHeight: 1.5 }}>
          Ingresá con el email y la contraseña de tu cuenta de Quest.
        </div>
        <input type="email" autoComplete="email" placeholder="Email" value={email}
               onChange={e => setEmail(e.target.value)} style={inputStyle}
               onKeyDown={e => e.key === 'Enter' && entrar()} />
        <input type="password" autoComplete="current-password" placeholder="Contraseña" value={pass}
               onChange={e => setPass(e.target.value)} style={inputStyle}
               onKeyDown={e => e.key === 'Enter' && entrar()} />
        {err && <div style={{ fontSize: 12, color: '#C0392B' }}>{err}</div>}
        <button onClick={entrar} disabled={busy} style={btnPrimario(!busy && email.includes('@') && pass.length >= 6)}>
          {busy ? 'Ingresando…' : 'Entrar'}
        </button>
      </div>
    </div>
  )
}

// ── Editor de producto (solo staff) ──────────────────────────────────────────
function EditorSheet({ producto, onClose, onGuardado, onBorrado }) {
  const esNuevo = !producto?.id
  const [nombre, setNombre]   = useState(producto?.name ?? '')
  const [precio_, setPrecio]  = useState(producto?.price ?? '')
  const [oferta, setOferta]   = useState(producto?.sale_price ?? '')
  const [foto, setFoto]       = useState(producto?.image_url ?? '')
  const [orden, setOrden]     = useState(producto?.sort_order ?? 0)
  const [seccion, setSeccion] = useState(producto?.subcategory ?? 'caliente')
  const [desc, setDesc]       = useState(producto?.description ?? '')
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const fileRef = useRef(null)

  const subirFoto = async (file) => {
    if (!file) return
    setBusy(true); setErr('')
    try {
      const url = await uploadPostImage(file)
      setFoto(url)
    } catch (e) { setErr(e?.message || 'No se pudo subir la foto') }
    finally { setBusy(false) }
  }

  const guardar = async () => {
    if (busy) return
    const p = parseFloat(precio_)
    if (!nombre.trim()) { setErr('Poné el nombre'); return }
    if (!p || p <= 0)   { setErr('Poné un precio mayor a 0'); return }
    setBusy(true); setErr('')
    try {
      const campos = {
        name: nombre.trim(),
        price: p,
        sale_price: parseFloat(oferta) > 0 ? parseFloat(oferta) : null,
        image_url: foto.trim() || null,
        sort_order: parseInt(orden) || 0,
        subcategory: seccion,
        description: desc.trim() || null,
      }
      const guardarCon = (c) => esNuevo
        ? upsertShopProduct({ ...c, sku: `CAFE-${Date.now()}`, category: 'cafe', game: null, active: true })
        : updateShopProduct(producto.id, c)

      let fila
      try {
        fila = await guardarCon(campos)
      } catch (e2) {
        // Migración de `description` sin correr: se guarda el resto igual.
        if (!/description/i.test(e2?.message || '')) throw e2
        const { description, ...resto } = campos
        fila = await guardarCon(resto)
      }
      onGuardado?.(fila)
      onClose()
    } catch (e) { setErr(e?.message || 'No se pudo guardar') }
    finally { setBusy(false) }
  }

  const borrar = async () => {
    if (!confirmar) { setConfirmar(true); return }
    setBusy(true); setErr('')
    try {
      await deleteShopProduct(producto.id)
      onBorrado?.(producto.id)
      onClose()
    } catch (e) { setErr(e?.message || 'No se pudo ocultar'); setBusy(false) }
  }

  return (
    <div style={sheetWrap} onClick={onClose}>
      <div style={{ ...sheetBox, maxHeight: '86dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: TINTA }}>
          {esNuevo ? 'Nuevo producto del café' : 'Editar producto'}
        </div>

        <input placeholder="Nombre (ej. Latte 12oz)" value={nombre}
               onChange={e => setNombre(e.target.value.slice(0, 120))} style={inputStyle} />

        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" min="0" step="0.25" placeholder="Precio" value={precio_}
                 onChange={e => setPrecio(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <input type="number" min="0" step="0.25" placeholder="Oferta (opcional)" value={oferta}
                 onChange={e => setOferta(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        </div>

        <textarea placeholder="Descripción (se ve al abrir el producto)" value={desc}
                  onChange={e => setDesc(e.target.value.slice(0, 400))}
                  style={{ ...inputStyle, minHeight: 74, resize: 'none', lineHeight: 1.5 }} />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, overflow: 'hidden', background: '#F1EEE6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${LINEA}` }}>
            {foto ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 20 }}>☕</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => fileRef.current?.click()} disabled={busy} style={{
              padding: '9px 0', borderRadius: 10, border: `1px solid ${LINEA}`,
              background: '#F1EEE6', color: TINTA, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>{busy ? 'Subiendo…' : '📷 Subir foto'}</button>
            <input placeholder="…o pegá una URL de imagen" value={foto}
                   onChange={e => setFoto(e.target.value)} style={{ ...inputStyle, padding: '7px 10px', fontSize: 11.5 }} />
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                 onChange={e => subirFoto(e.target.files?.[0])} />
        </div>

        {/* Sección del menú — dónde aparece la card */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: GRIS, marginBottom: 6 }}>SECCIÓN DEL MENÚ</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SECCIONES_CAFE.map(sc => (
              <button key={sc.id} onClick={() => setSeccion(sc.id)} style={{
                padding: '8px 11px', borderRadius: 999, cursor: 'pointer',
                background: seccion === sc.id ? VERDE : BLANCO,
                border: `1px solid ${seccion === sc.id ? VERDE : LINEA}`,
                color: seccion === sc.id ? '#FFF' : GRIS,
                fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
              }}>{sc.icono} {sc.titulo}</button>
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: GRIS }}>
          Orden en el menú
          <input type="number" value={orden} onChange={e => setOrden(e.target.value)}
                 style={{ ...inputStyle, width: 76, padding: '7px 10px' }} />
          <span style={{ fontSize: 10.5, color: '#A8ADA6' }}>(menor = primero)</span>
        </label>

        {err && <div style={{ fontSize: 12, color: '#C0392B' }}>{err}</div>}

        <button onClick={guardar} disabled={busy} style={btnPrimario(!busy)}>
          {busy ? 'Guardando…' : esNuevo ? 'Agregar al menú' : 'Guardar cambios'}
        </button>
        {!esNuevo && (
          <button onClick={borrar} disabled={busy} style={{
            width: '100%', padding: '10px 0', borderRadius: 12,
            border: `1px solid ${confirmar ? '#C0392B' : LINEA}`,
            background: confirmar ? 'rgba(192,57,43,0.08)' : 'transparent',
            color: confirmar ? '#C0392B' : GRIS,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            {confirmar ? '¿Seguro? Toca de nuevo para ocultarlo' : 'Ocultar del menú'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Ficha del producto (clon de la referencia) ──────────────────────────────
// Se abre al tocar una card. El PNG del producto flota GRANDE y fuera de
// todo recuadro (con una sombra elíptica abajo que lo despega del papel),
// después nombre, descripción, y el selector de cantidad 01 02 03 04 con el
// triangulito debajo del elegido. El botón verde con la bolsita muestra el
// TOTAL de esa cantidad, no el precio unitario.
function ProductoSheet({ producto, cantidadActual, onAgregar, onClose }) {
  const [n, setN] = useState(Math.min(4, Math.max(1, cantidadActual || 1)))
  const unit = precio(producto)
  const enOferta = unit < (Number(producto.price) || 0)

  // Cerrar con Escape — es una pantalla, no un popup cualquiera.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, background: PAPEL,
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
      fontFamily: 'Inter, sans-serif',
      animation: 'cafeSubir 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
    }}>
      {/* Volver */}
      <div style={{ padding: 'calc(16px + env(safe-area-inset-top, 0px)) 20px 0', flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Volver" style={{
          width: 40, height: 40, borderRadius: 14, cursor: 'pointer',
          background: BLANCO, border: `1px solid ${LINEA}`, color: TINTA,
          fontSize: 20, lineHeight: 1, boxShadow: '0 6px 16px rgba(23,63,44,0.08)',
        }}>‹</button>
      </div>

      {/* PNG flotando, sin recuadro */}
      <div style={{ position: 'relative', padding: '18px 24px 6px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 'min(74vw, 290px)', aspectRatio: '1 / 1' }}>
          {producto.image_url
            ? <img src={producto.image_url} alt="" style={{
                width: '100%', height: '100%', objectFit: 'contain', display: 'block',
                filter: 'drop-shadow(0 26px 34px rgba(23,63,44,0.28))',
                animation: 'cafeFlotar 5.5s ease-in-out infinite',
              }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 110, animation: 'cafeFlotar 5.5s ease-in-out infinite' }}>☕</div>}
          {/* sombra en el piso — lo despega del papel */}
          <div aria-hidden style={{
            position: 'absolute', bottom: -6, left: '18%', right: '18%', height: 16,
            borderRadius: '50%', background: 'rgba(23,63,44,0.16)', filter: 'blur(9px)',
          }} />
        </div>
      </div>

      {/* Texto */}
      <div style={{ padding: '20px 24px 0', maxWidth: 620, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <h2 style={{ margin: 0, fontSize: 'clamp(26px, 6.4vw, 34px)', fontWeight: 800, color: VERDE, lineHeight: 1.15 }}>
          {producto.name}
        </h2>
        {producto.description && (
          <p style={{ margin: '12px 0 0', fontSize: 15, color: GRIS, lineHeight: 1.65 }}>
            {producto.description}
          </p>
        )}

        {/* Cantidad — 01 02 03 04 con el triangulito debajo */}
        <div style={{ marginTop: 30 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: VERDE, marginBottom: 12 }}>Cantidad</div>
          <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end' }}>
            {[1, 2, 3, 4].map(v => {
              const activo = n === v
              return (
                <button key={v} onClick={() => setN(v)} aria-label={`Cantidad ${v}`} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  fontFamily: 'Inter, sans-serif',
                }}>
                  <span style={{
                    fontSize: activo ? 30 : 20,
                    fontWeight: activo ? 800 : 600,
                    color: activo ? VERDE : '#B4BDB6',
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                    transition: 'font-size 0.18s ease, color 0.18s ease',
                  }}>{String(v).padStart(2, '0')}</span>
                  <span aria-hidden style={{
                    fontSize: 10, color: VERDE, lineHeight: 1,
                    opacity: activo ? 1 : 0, transition: 'opacity 0.18s ease',
                  }}>▲</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Agregar — bolsita + total */}
      <div style={{
        marginTop: 'auto', padding: '24px 24px calc(26px + env(safe-area-inset-bottom, 0px))',
        maxWidth: 620, width: '100%', margin: '0 auto', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ flex: 1 }}>
          {enOferta && (
            <div style={{ fontSize: 13, color: '#B4BDB6', textDecoration: 'line-through' }}>
              {fmt(Number(producto.price) * n)}
            </div>
          )}
          <div style={{ fontSize: 12.5, color: GRIS }}>
            {n} × {fmt(unit)}
          </div>
        </div>
        <button onClick={() => { onAgregar(n); onClose() }} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '18px 26px', borderRadius: 22, border: 'none', cursor: 'pointer',
          background: VERDE, color: '#FFF',
          fontSize: 18, fontWeight: 800, fontFamily: 'Inter, sans-serif',
          boxShadow: '0 16px 34px rgba(23,63,44,0.32)',
        }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 8h14l-1 12H6L5 8z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          </svg>
          {fmt(unit * n)}
        </button>
      </div>
    </div>
  )
}

// ── Tablero de órdenes (solo staff) ──────────────────────────────────────────
const ESTADOS_CAFE = {
  nueva:     { label: 'NUEVA',     color: '#B45309', bg: '#FEF3E2', border: '#F5CD8F' },
  lista:     { label: 'LISTA',     color: '#166534', bg: '#E8F6EC', border: '#B7E2C3' },
  entregada: { label: 'ENTREGADA', color: '#6B7280', bg: '#F3F2EE', border: '#E0DED6' },
  cancelada: { label: 'CANCELADA', color: '#B42318', bg: '#FDEEEC', border: '#F2C4BE' },
}

function OrdersSheet({ onClose }) {
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [verTodas, setVerTodas] = useState(false)
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState(null)

  const cargar = () => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    supabase
      .from('cafe_orders')
      .select('*')
      .gte('created_at', hoy.toISOString())
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setErr(error.message)
        else { setErr(''); setOrdenes(data ?? []) }
        setLoading(false)
      })
  }
  useEffect(() => {
    cargar()
    const iv = setInterval(cargar, 20000)
    return () => clearInterval(iv)
  }, [])

  const cambiarEstado = async (o, status) => {
    if (busyId) return
    setBusyId(o.id); setErr('')
    const { error } = await supabase.from('cafe_orders').update({ status }).eq('id', o.id)
    if (error) setErr(error.message)
    else setOrdenes(prev => prev.map(x => x.id === o.id ? { ...x, status } : x))
    setBusyId(null)
  }

  const visibles = verTodas ? ordenes : ordenes.filter(o => o.status === 'nueva' || o.status === 'lista')
  const btnMini = (label, onClick, color, border, bg) => (
    <button onClick={onClick} disabled={!!busyId} style={{
      flex: 1, padding: '9px 6px', borderRadius: 10, cursor: busyId ? 'default' : 'pointer',
      border: `1px solid ${border}`, background: bg, color,
      fontSize: 11.5, fontWeight: 800, fontFamily: 'Inter, sans-serif', opacity: busyId ? 0.5 : 1,
    }}>{label}</button>
  )

  return (
    <div style={sheetWrap} onClick={onClose}>
      <div style={{ ...sheetBox, maxWidth: 440, maxHeight: '88dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15.5, fontWeight: 800, color: TINTA, flex: 1 }}>Órdenes de hoy</span>
          <button onClick={() => setVerTodas(v => !v)} style={{
            fontSize: 10.5, fontWeight: 700, padding: '6px 10px', borderRadius: 999,
            border: `1px solid ${LINEA}`, background: verTodas ? '#F1EEE6' : 'transparent',
            color: GRIS, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>{verTodas ? 'Solo activas' : 'Ver todas'}</button>
          <button onClick={onClose} aria-label="Cerrar" style={{
            background: 'none', border: 'none', color: GRIS, fontSize: 18, cursor: 'pointer', lineHeight: 1,
          }}>×</button>
        </div>

        {err && <div style={{ fontSize: 12, color: '#C0392B' }}>{err}</div>}
        {loading && <div style={{ textAlign: 'center', padding: 20 }}><Spinner /></div>}
        {!loading && visibles.length === 0 && (
          <div style={{ fontSize: 12.5, color: GRIS, textAlign: 'center', padding: '18px 0' }}>
            {verTodas ? 'Hoy todavía no hubo pedidos.' : 'Sin pedidos activos — ☕ tranquilidad.'}
          </div>
        )}

        {visibles.map(o => {
          const st = ESTADOS_CAFE[o.status] ?? ESTADOS_CAFE.nueva
          const hora = new Date(o.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
          const items = Array.isArray(o.items) ? o.items : []
          return (
            <div key={o.id} style={{
              borderRadius: 16, padding: 13, background: st.bg, border: `1px solid ${st.border}`,
              display: 'flex', flexDirection: 'column', gap: 7,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: TINTA, fontFamily: 'SF Mono, Menlo, monospace' }}>{o.code}</span>
                <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', color: st.color }}>{st.label}</span>
                <span style={{ fontSize: 10.5, color: GRIS }}>{o.modo === 'llevar' ? '🥡 llevar' : '☕ en tienda'}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: GRIS }}>{hora}</span>
              </div>

              <div style={{ fontSize: 12.5, color: TINTA, lineHeight: 1.55 }}>
                {items.map((it, i) => <div key={i}>· {it.qty}× {it.name} — {fmt(it.sub)}</div>)}
                <div style={{ fontWeight: 800, marginTop: 2 }}>Total: {fmt(o.total)}</div>
              </div>

              <div style={{ fontSize: 11.5, color: GRIS }}>
                {o.customer_name || 'Sin nombre'}{o.customer_phone ? ` · ${o.customer_phone}` : ''}
                {o.note && <span style={{ display: 'block', color: '#B45309' }}>Nota: {o.note}</span>}
              </div>

              {o.status === 'nueva' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {btnMini('Marcar LISTA', () => cambiarEstado(o, 'lista'), '#166534', '#B7E2C3', '#FFFFFF')}
                  {btnMini('Cancelar', () => cambiarEstado(o, 'cancelada'), GRIS, LINEA, 'transparent')}
                </div>
              )}
              {o.status === 'lista' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {btnMini('Entregada ✓', () => cambiarEstado(o, 'entregada'), GRIS, LINEA, '#FFFFFF')}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Pantalla principal ───────────────────────────────────────────────────────
export default function CafeScreen() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [qty, setQty]         = useState({})
  const [modo, setModo]       = useState('tienda')    // 'tienda' | 'llevar'
  const guardado = leerDatosGuardados()
  const [nombre, setNombre]   = useState(guardado.nombre ?? '')
  const [tel, setTel]         = useState(guardado.tel ?? '')
  const [nota, setNota]       = useState('')

  const [session, setSession] = useState(null)
  const [perfil, setPerfil]   = useState(null)
  const [verLogin, setVerLogin] = useState(false)
  const [editor, setEditor]   = useState(null)
  const [verOrdenes, setVerOrdenes] = useState(false)
  const [pidiendo, setPidiendo] = useState(false)
  const [codigoOk, setCodigoOk] = useState(null)
  const [fichaDe, setFichaDe] = useState(null)   // producto abierto en la ficha

  const [cargando, setCargando] = useState(() => {
    if (typeof window === 'undefined') return false
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    try { return sessionStorage.getItem('cafe_splash') !== '1' } catch { return true }
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user?.id) { setPerfil(null); return }
    getProfile(session.user.id).then(setPerfil).catch(() => setPerfil(null))
  }, [session?.user?.id])

  const esStaff = !!(perfil?.is_owner || ['staff', 'admin'].includes(perfil?.role))

  const cargarMenu = async () => {
    const base = 'id, name, price, sale_price, image_url, sort_order, active, subcategory'
    const pedir = (cols) => supabase
      .from('shop_products')
      .select(cols)
      .eq('category', 'cafe')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    // `description` puede no existir todavía (migración sin correr): si el
    // select falla por eso, se reintenta sin ella y el menú anda igual.
    let { data, error } = await pedir(base + ', description')
    if (error && /description/i.test(error.message || '')) {
      ({ data, error } = await pedir(base))
    }
    if (!error) setItems(data ?? [])
    setLoading(false)
  }
  useEffect(() => { cargarMenu() }, [])

  const visibles = useMemo(
    () => esStaff ? items : items.filter(p => precio(p) > 0),
    [items, esStaff])

  // Agrupado por sección; lo sin clasificar cae en 'otros'.
  const grupos = useMemo(() => {
    const por = { caliente: [], frio: [], postre: [], salado: [], otros: [] }
    for (const p of visibles) (por[p.subcategory] ?? por.otros).push(p)
    return por
  }, [visibles])

  const pedido = useMemo(() =>
    visibles.filter(p => (qty[p.id] ?? 0) > 0 && precio(p) > 0)
            .map(p => ({ ...p, n: qty[p.id], sub: precio(p) * qty[p.id] })),
  [visibles, qty])
  const total = pedido.reduce((a, p) => a + p.sub, 0)

  const cambiar = (id, d) =>
    setQty(q => ({ ...q, [id]: Math.max(0, Math.min(20, (q[id] ?? 0) + d)) }))

  const nombreOk = nombre.trim().length >= 2
  const telOk    = tel.replace(/\D/g, '').length >= 7
  const datosOk  = nombreOk && telOk

  const armarWA = (codigo) => {
    const lineas = [
      `☕ *PEDIDO QUEST CAFÉ${codigo ? ` ${codigo}` : ''}* — ${modo === 'llevar' ? 'PARA LLEVAR 🥡' : 'PARA TOMAR EN TIENDA'}`,
      '',
      ...pedido.map(p => `· ${p.n}× ${p.name} — ${fmt(p.sub)}`),
      '',
      `*Total: ${fmt(total)}*`,
      nombre.trim() ? `Nombre: ${nombre.trim()}` : null,
      tel.trim()    ? `Tel: ${tel.trim()}`       : null,
      nota.trim()   ? `Nota: ${nota.trim()}`     : null,
    ].filter(v => v !== null)
    return `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(lineas.join('\n'))}`
  }

  const hacerPedido = async () => {
    if (pidiendo || !pedido.length || !datosOk) return
    setPidiendo(true)
    try { localStorage.setItem(DATOS_KEY, JSON.stringify({ nombre: nombre.trim(), tel: tel.trim() })) } catch {}
    let codigo = null
    try {
      const { data, error } = await supabase.rpc('place_cafe_order', {
        p_items: pedido.map(p => ({ id: p.id, qty: p.n })),
        p_modo:  modo,
        p_name:  nombre.trim(),
        p_phone: tel.trim(),
        p_note:  nota.trim() || null,
      })
      if (!error) codigo = (Array.isArray(data) ? data[0] : data)?.code ?? null
    } catch {}
    window.open(armarWA(codigo), '_blank')
    if (codigo) {
      setCodigoOk(codigo)
      setQty({}); setNota('')
      setTimeout(() => setCodigoOk(null), 12000)
    }
    setPidiendo(false)
  }

  const irAlMenu = (m) => {
    if (m) setModo(m)
    document.getElementById('cafe-menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const irASeccion = (id) =>
    document.getElementById(`cafe-sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // ── Card estilo referencia: verde profundo, foto FLOTANDO arriba ──
  // Card estilo referencia: PNG flotando LIBRE arriba (sin recuadro), card
  // verde con nombre y precio, y botón + abajo a la derecha. Tocar la card
  // abre la ficha para elegir cantidad — no se agrega de un toque.
  const tarjeta = (p, i) => {
    const n = qty[p.id] ?? 0
    const sinPrecio = precio(p) <= 0
    const enOferta = !sinPrecio && precio(p) < (Number(p.price) || 0)
    return (
      <Reveal key={p.id} delay={Math.min(i * 55, 330)}>
        <div
          className="cafe-card"
          onClick={() => !sinPrecio && setFichaDe(p)}
          role={sinPrecio ? undefined : 'button'}
          tabIndex={sinPrecio ? undefined : 0}
          onKeyDown={(e) => { if (!sinPrecio && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setFichaDe(p) } }}
          style={{ paddingTop: 54, cursor: sinPrecio ? 'default' : 'pointer', outline: 'none' }}
        >
          <div style={{
            position: 'relative',
            background: n > 0
              ? `linear-gradient(160deg, ${VERDE2} 0%, ${VERDE} 100%)`
              : `linear-gradient(160deg, ${VERDE} 0%, #10301F 100%)`,
            borderRadius: 26,
            padding: '62px 15px 16px',
            boxShadow: n > 0 ? '0 22px 48px rgba(23,63,44,0.30)' : SOMBRA,
            display: 'flex', flexDirection: 'column', gap: 5,
            opacity: sinPrecio ? 0.65 : 1,
          }}>
            {/* PNG flotando libre, saliéndose de la card */}
            <div style={{
              position: 'absolute', top: -54, left: '50%', transform: 'translateX(-50%)',
              width: 118, height: 118, pointerEvents: 'none',
            }}>
              {p.image_url
                ? <img src={p.image_url} alt="" loading="lazy" decoding="async" className="cafe-zoom" style={{
                    width: '100%', height: '100%', objectFit: 'contain', display: 'block',
                    filter: 'drop-shadow(0 14px 20px rgba(23,63,44,0.34))',
                  }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 62 }}>☕</div>}
            </div>

            {/* Contador de lo que ya está en el pedido */}
            {n > 0 && (
              <div style={{
                position: 'absolute', top: 12, left: 12,
                background: '#FFF', color: VERDE, borderRadius: 999,
                padding: '3px 10px', fontSize: 12, fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
              }}>{n} en tu pedido</div>
            )}

            {esStaff && (
              <button onClick={(e) => { e.stopPropagation(); setEditor(p) }} aria-label={`Editar ${p.name}`} style={{
                position: 'absolute', top: 10, right: 10,
                width: 30, height: 30, borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.14)', color: '#FFF', fontSize: 13,
                cursor: 'pointer', lineHeight: 1,
              }}>✎</button>
            )}

            <div style={{ fontSize: 14, fontWeight: 800, color: '#FFF', lineHeight: 1.3, minHeight: 36 }}>{p.name}</div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {sinPrecio
                  ? <span style={{ color: '#FFD98A', fontSize: 11, fontWeight: 700 }}>Sin precio — no se publica</span>
                  : <>
                      {enOferta && <div style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'line-through', fontSize: 11.5 }}>{fmt(p.price)}</div>}
                      <div style={{ color: '#FFF', fontWeight: 800, fontSize: 19, fontVariantNumeric: 'tabular-nums' }}>{fmt(precio(p))}</div>
                    </>}
              </div>
              {!sinPrecio && (
                <div aria-hidden style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: '#FFF', color: VERDE,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 21, fontWeight: 800, lineHeight: 1,
                  boxShadow: '0 6px 14px rgba(0,0,0,0.18)',
                }}>+</div>
              )}
            </div>
          </div>
        </div>
      </Reveal>
    )
  }

  const seccionesConItems = [...SECCIONES_CAFE, { id: 'otros', titulo: 'MÁS DEL MENÚ', icono: '☕' }]
    .filter(sec => grupos[sec.id]?.length)

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      background: PAPEL, color: TINTA, fontFamily: 'Inter, sans-serif',
    }}>
      <style>{CSS_CAFE}</style>
      {cargando && <SplashTaza onFin={() => {
        try { sessionStorage.setItem('cafe_splash', '1') } catch {}
        setCargando(false)
      }} />}

      {/* ── Header ── */}
      <div style={{
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(245,243,238,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${LINEA}`,
        paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
      }}>
        {/* El logo de Quest es blanco: vive en un chip verde para leerse en claro */}
        <a href={urlSitioPrincipal()} aria-label="Ir al sitio de Quest" style={{
          display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
          background: VERDE, borderRadius: 999, padding: '6px 12px',
          boxShadow: '0 8px 20px rgba(23,63,44,0.22)',
        }}>
          <img src={questLogo} alt="Quest" style={{ height: 22, display: 'block' }} />
          <span style={{ fontFamily: BEBAS, fontSize: 15, letterSpacing: '0.12em', color: '#FFF', lineHeight: 1 }}>CAFÉ</span>
        </a>
        <span style={{ flex: 1 }} />
        {esStaff && (
          <>
            <button onClick={() => setVerOrdenes(true)} style={chipHeader(true)}>Órdenes</button>
            <button onClick={() => setEditor({})} style={chipHeader()}>＋ Producto</button>
            <button onClick={() => supabase.auth.signOut()} style={chipHeader()}>Salir</button>
          </>
        )}
        {!esStaff && (
          <button onClick={() => setVerLogin(true)} aria-label="Acceso del equipo" style={{
            ...chipHeader(), color: '#B4B9B1', borderColor: '#EDEAE1',
          }}>Staff</button>
        )}
      </div>

      {/* ── HERO ── */}
      <section style={{
        minHeight: 'calc(86dvh - 56px)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: '44px 22px 30px', position: 'relative', overflow: 'hidden',
      }}>
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(23,63,44,0.07) 0%, transparent 60%)',
        }} />
        {['10%', '80%', '26%', '66%', '90%'].map((left, i) => (
          <span key={i} aria-hidden style={{
            position: 'absolute', left, top: `${16 + i * 15}%`, fontSize: 16 + (i % 3) * 7,
            opacity: 0.09, animation: `cafeFlotar ${5.5 + i}s ease-in-out ${i * 0.8}s infinite`,
          }}>☕</span>
        ))}

        <div className="cafe-rise" style={{ animationDelay: '0.05s', fontSize: 12, fontWeight: 800, letterSpacing: '0.32em', color: '#7FA28F', marginBottom: 14 }}>
          QUEST HOBBY STORE PRESENTA
        </div>
        <h1 className="cafe-rise" style={{
          animationDelay: '0.15s', margin: 0,
          fontFamily: BEBAS, fontWeight: 400,
          fontSize: 'clamp(64px, 16vw, 150px)', lineHeight: 0.92,
          letterSpacing: '0.02em', color: VERDE,
        }}>
          QUEST<br />CAFÉ
        </h1>
        <p className="cafe-rise" style={{ animationDelay: '0.28s', margin: '18px 0 26px', fontSize: 'clamp(14px, 2.6vw, 17px)', color: GRIS, maxWidth: 430, lineHeight: 1.65 }}>
          Café de verdad, en tu tienda de siempre. Pedí desde el celular
          y te avisamos cuando esté listo.
        </p>

        <div className="cafe-rise" style={{ animationDelay: '0.4s', display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => irAlMenu('tienda')} style={{
            padding: '15px 26px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: VERDE, color: '#FFF',
            fontSize: 15, fontWeight: 800, fontFamily: 'Inter, sans-serif',
            boxShadow: '0 14px 34px rgba(23,63,44,0.30)',
          }}>☕ Para tomar en tienda</button>
          <button onClick={() => irAlMenu('llevar')} style={{
            padding: '15px 26px', borderRadius: 999, cursor: 'pointer',
            background: BLANCO, border: `1.5px solid ${VERDE}`,
            color: VERDE, fontSize: 15, fontWeight: 800, fontFamily: 'Inter, sans-serif',
          }}>🥡 Para llevar</button>
        </div>

        <div aria-hidden style={{ position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', animation: 'cafeFlotar 2.6s ease-in-out infinite', color: '#B4B9B1', fontSize: 20 }}>⌄</div>
      </section>

      {/* ── UBICACIÓN ── */}
      <Reveal>
        <section style={{ padding: '26px 20px 8px', maxWidth: 760, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <div style={{
            display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
            background: BLANCO, border: `1px solid ${LINEA}`, borderRadius: 24,
            padding: '22px 24px', boxShadow: SOMBRA,
          }}>
            <div style={{ fontSize: 38 }}>📍</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: BEBAS, fontSize: 25, letterSpacing: '0.05em', color: VERDE }}>ENCONTRANOS</div>
              <div style={{ fontSize: 13.5, color: GRIS, lineHeight: 1.6, marginTop: 4 }}>
                Dentro de <strong style={{ color: TINTA }}>Quest Hobby Store</strong> — venís por el café,
                te quedás por las cartas. Horario de la tienda.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="https://www.google.com/maps/search/Quest+Hobby+Store+Panamá" target="_blank" rel="noreferrer" style={{
                padding: '11px 16px', borderRadius: 999, textDecoration: 'none',
                background: VERDE, color: '#FFF', fontSize: 12.5, fontWeight: 800,
              }}>Cómo llegar ↗</a>
              <a href={`https://wa.me/${STORE_WHATSAPP}`} target="_blank" rel="noreferrer" style={{
                padding: '11px 16px', borderRadius: 999, textDecoration: 'none',
                background: '#E8F8EE', border: '1px solid #BEE8CD',
                color: '#15803D', fontSize: 12.5, fontWeight: 800,
              }}>Escribinos</a>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── MENÚ / PEDIDO ── */}
      <section id="cafe-menu" style={{ padding: '40px 18px 10px', maxWidth: 880, margin: '0 auto', width: '100%', boxSizing: 'border-box', scrollMarginTop: 64 }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.3em', color: '#7FA28F' }}>HAZ TU PEDIDO</div>
            <h2 style={{ margin: '6px 0 0', fontFamily: BEBAS, fontWeight: 400, fontSize: 'clamp(38px, 7vw, 56px)', letterSpacing: '0.03em', color: VERDE }}>EL MENÚ</h2>
          </div>
        </Reveal>

        {/* Chips de sección — como los tabs de la referencia */}
        {seccionesConItems.length > 1 && (
          <Reveal>
            <div className="cafe-chips" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 2px 18px', justifyContent: 'safe center' }}>
              {seccionesConItems.map(sec => (
                <button key={sec.id} onClick={() => irASeccion(sec.id)} style={{
                  padding: '9px 14px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: BLANCO, border: `1px solid ${LINEA}`, color: TINTA,
                  fontSize: 12.5, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                  boxShadow: '0 6px 16px rgba(23,63,44,0.06)',
                }}>{sec.icono} {sec.titulo}</button>
              ))}
            </div>
          </Reveal>
        )}

        {loading && <div style={{ textAlign: 'center', marginTop: 40 }}><Spinner /></div>}

        {!loading && visibles.length === 0 && (
          <div style={{ textAlign: 'center', margin: '46px 0 60px', display: 'flex', flexDirection: 'column', gap: 8, padding: '0 26px' }}>
            <span style={{ fontSize: 36 }}>☕</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: TINTA }}>El menú está en preparación</span>
            <span style={{ fontSize: 13, color: GRIS, lineHeight: 1.6 }}>
              {esStaff
                ? 'Tocá "＋ Producto" arriba para cargar el primero.'
                : 'Muy pronto vas a poder pedir desde acá. Mientras tanto, acercate a la barra.'}
            </span>
          </div>
        )}

        {seccionesConItems.map(sec => (
          <div key={sec.id} id={`cafe-sec-${sec.id}`} style={{ marginBottom: 26, scrollMarginTop: 76 }}>
            <Reveal>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '2px 2px 8px' }}>
                <span aria-hidden style={{ fontSize: 25, display: 'inline-block', animation: 'cafeFlotar 4.5s ease-in-out infinite' }}>{sec.icono}</span>
                <h3 style={{ margin: 0, fontFamily: BEBAS, fontWeight: 400, fontSize: 26, letterSpacing: '0.06em', color: VERDE }}>{sec.titulo}</h3>
                <span aria-hidden style={{ flex: 1, height: 1, background: LINEA }} />
              </div>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px 14px' }}>
              {grupos[sec.id].map((p, i) => tarjeta(p, i))}
            </div>
          </div>
        ))}
      </section>

      {/* ── ASÍ LO HACEMOS ── */}
      <section style={{ padding: '36px 18px 30px', maxWidth: 880, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.3em', color: '#7FA28F' }}>DETRÁS DE LA BARRA</div>
            <h2 style={{ margin: '6px 0 0', fontFamily: BEBAS, fontWeight: 400, fontSize: 'clamp(34px, 6vw, 48px)', letterSpacing: '0.03em', color: VERDE }}>ASÍ LO HACEMOS</h2>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
          {VIDEOS.map((v, i) => (
            <Reveal key={v.titulo} delay={i * 90}>
              <div className="cafe-card" style={{
                position: 'relative', borderRadius: 24, overflow: 'hidden',
                aspectRatio: '16 / 10', background: BLANCO,
                border: `1px solid ${LINEA}`, boxShadow: SOMBRA, cursor: 'default',
              }}>
                <img src={v.img} alt="" loading="lazy" decoding="async" className="cafe-zoom"
                     style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(13,26,19,0.82) 0%, rgba(13,26,19,0.02) 55%)' }} />
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -56%)',
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.22)', border: '1.5px solid rgba(255,255,255,0.75)',
                  backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: '#FFF', fontSize: 18, marginLeft: 3 }}>▶</span>
                </div>
                <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#FFF' }}>{v.titulo}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Video muy pronto ☕</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: '26px 22px calc(30px + env(safe-area-inset-bottom, 0px))', textAlign: 'center', borderTop: `1px solid ${LINEA}`, marginTop: 10 }}>
        <a href={urlSitioPrincipal()} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none',
          background: VERDE, borderRadius: 999, padding: '7px 14px',
        }}>
          <img src={questLogo} alt="Quest" style={{ height: 20 }} />
          <span style={{ fontFamily: BEBAS, fontSize: 14, letterSpacing: '0.12em', color: '#FFF' }}>CAFÉ</span>
        </a>
        <div style={{ fontSize: 11.5, color: GRIS, marginTop: 10 }}>
          Parte de Quest Hobby Store — <a href={urlSitioPrincipal()} style={{ color: '#4E7A62' }}>ir a la tienda ↗</a>
        </div>
      </footer>

      {/* ── Barra de pedido (solo con carrito) ── */}
      {pedido.length > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30,
          padding: '12px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderTop: `1px solid ${LINEA}`, boxShadow: '0 -14px 40px rgba(23,63,44,0.10)',
          animation: 'cafeSubir 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}>
          <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', gap: 7 }}>
              {[
                { id: 'tienda', label: '☕ Para tomar en tienda' },
                { id: 'llevar', label: '🥡 Para llevar' },
              ].map(m => (
                <button key={m.id} onClick={() => setModo(m.id)} style={{
                  flex: 1, padding: '10px 6px', borderRadius: 11, cursor: 'pointer',
                  background: modo === m.id ? VERDE : '#F1EEE6',
                  border: 'none',
                  color: modo === m.id ? '#FFF' : GRIS,
                  fontSize: 12, fontWeight: 800, fontFamily: 'Inter, sans-serif',
                }}>{m.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <input value={nombre} onChange={e => setNombre(e.target.value.slice(0, 60))}
                     placeholder="Tu nombre" autoComplete="name" style={{ ...inputStyle, flex: 1 }} />
              <input value={tel} onChange={e => setTel(e.target.value.slice(0, 40))}
                     placeholder="Teléfono" type="tel" autoComplete="tel" style={{ ...inputStyle, flex: 1 }} />
            </div>
            <input value={nota} onChange={e => setNota(e.target.value.slice(0, 120))}
                   placeholder="Nota (ej. sin azúcar)" style={inputStyle} />
            {codigoOk && (
              <div style={{ textAlign: 'center', fontSize: 12.5, color: '#15803D', fontWeight: 800 }}>
                ✓ Pedido {codigoOk} registrado — te llamamos por tu nombre
              </div>
            )}
            <button disabled={!datosOk || pidiendo} onClick={hacerPedido} style={{
              width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
              background: (datosOk && !pidiendo) ? WABTN : '#E9E6DD',
              color: datosOk ? '#FFF' : '#A8ADA6',
              fontSize: 14.5, fontWeight: 800,
              cursor: (datosOk && !pidiendo) ? 'pointer' : 'default',
              fontFamily: 'Inter, sans-serif',
              boxShadow: (datosOk && !pidiendo) ? '0 12px 30px rgba(34,184,92,0.30)' : 'none',
            }}>
              {pidiendo
                ? 'Registrando…'
                : !datosOk
                  ? `Poné ${[!nombreOk && 'tu nombre', !telOk && 'tu teléfono'].filter(Boolean).join(' y ')} para pedir`
                  : `Pedir por WhatsApp · ${pedido.reduce((a, p) => a + p.n, 0)} ítem${pedido.reduce((a, p) => a + p.n, 0) !== 1 ? 's' : ''} · ${fmt(total)}`}
            </button>
          </div>
        </div>
      )}

      {fichaDe && (
        <ProductoSheet
          producto={fichaDe}
          cantidadActual={qty[fichaDe.id] ?? 0}
          onAgregar={(n) => setQty(q => ({ ...q, [fichaDe.id]: n }))}
          onClose={() => setFichaDe(null)}
        />
      )}
      {verLogin && <StaffLoginSheet onClose={() => setVerLogin(false)} />}
      {verOrdenes && <OrdersSheet onClose={() => setVerOrdenes(false)} />}
      {editor !== null && (
        <EditorSheet
          producto={editor}
          onClose={() => setEditor(null)}
          onGuardado={(fila) => {
            if (!fila?.id) { cargarMenu(); return }
            setItems(prev => {
              const existe = prev.some(x => x.id === fila.id)
              const sig = existe ? prev.map(x => x.id === fila.id ? { ...x, ...fila } : x) : [...prev, fila]
              return sig.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name)))
            })
          }}
          onBorrado={(id) => setItems(prev => prev.filter(x => x.id !== id))}
        />
      )}
    </div>
  )
}
