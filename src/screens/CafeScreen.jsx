// ─────────────────────────────────────────────
// QUEST — CafeScreen (Quest Café · coffee.questhobbystore.com)
// SITIO INDEPENDIENTE de la cafetería: en el subdominio (cafe.*, coffee.* o
// questcafe*) o en /cafe, main.jsx monta ESTO en lugar de la app.
//
// ESTÉTICA: clara y limpia (referencia estilo app de café moderna) — fondo
// papel, tarjetas NARANJA profundo con la foto del producto FLOTANDO arriba,
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
  supabase, getProfile, getChatGuestIdentity,
  upsertShopProduct, updateShopProduct, deleteShopProduct, uploadPostImage,
} from '../lib/supabase'
import { STORE_WHATSAPP } from '../lib/constants'
import Spinner from '../components/Spinner'
import questLogo from '../assets/quest-logo-sm.png'

const fmt = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Cambio de leche: adicional de las bebidas que la llevan (has_milk). No son
// productos del menú — se eligen adentro de la bebida. El precio depende del
// tamaño: 8oz paga menos que los vasos grandes. Los MISMOS valores están en
// place_cafe_order(), que es quien decide el precio de verdad.
const EXTRAS_LECHE = [
  { id: 'normal',   label: 'Normal',            precio: () => 0 },
  { id: 'deslac',   label: 'Deslactosada',      precio: (t) => (t === '8oz' ? 0.50 : 0.75) },
  { id: 'vegetal',  label: 'Almendra o avena',  precio: (t) => (t === '8oz' ? 0.60 : 0.80) },
]
const extraPorId = (id) => EXTRAS_LECHE.find(e => e.id === id) ?? EXTRAS_LECHE[0]

// Tamaños. Se guardan en shop_products.variants como
// [{label:'8oz', price:2.5}, {label:'12oz', price:3}]. Si un producto no
// tiene variantes (un brownie, una empanada), se usa su precio suelto.
const variantes = (p) => Array.isArray(p?.variants) && p.variants.length ? p.variants : null
const precioVariante = (p, label) => {
  const vs = variantes(p)
  if (!vs) return precio(p)
  const v = vs.find(x => x.label === label) ?? vs[0]
  return Number(v?.price) || 0
}
// El precio "desde" que se muestra en la card: el más barato de sus tamaños.
const precioDesde = (p) => {
  const vs = variantes(p)
  return vs ? Math.min(...vs.map(v => Number(v.price) || 0)) : precio(p)
}

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
const PAPEL    = '#FAF3E7'  // fondo general
const CREMA_UI = '#FAF3E7'  // mismo crema, para texto sobre bloques oscuros
const BLANCO  = '#FFFFFF'
const TINTA   = '#2C1E15'   // texto principal
const GRIS    = '#8A7461'   // texto secundario
const LINEA   = '#EADFCB'   // bordes suaves
// Paleta de la referencia: naranja quemado + verde bosque sobre crema.
const NARANJA  = '#E8551F'  // color de marca — cards, títulos, CTA
const NARANJA2 = '#FF6E38'  // más claro, degradé de la card activa
const NARANJA3 = '#C6410F'  // extremo oscuro del degradé
const VERDE    = '#0E6B4C'  // verde bosque — acentos, textos chicos, acción
const WABTN   = '#0E6B4C'   // acción principal — el verde de la paleta
// Display del sitio: Rammetto One (Google Fonts, OFL) autohospedada en
// index.html. Redonda y pesadísima — es la que le da el carácter editorial.
const DISPLAY = '"Rammetto One", "Bebas Neue", Inter, sans-serif'
const SOMBRA  = '0 18px 44px rgba(150,60,20,0.10)'

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: '#F3EADA',
  border: `1px solid ${LINEA}`, borderRadius: 12, padding: '11px 13px',
  color: TINTA, fontSize: 13.5, outline: 'none', fontFamily: 'Inter, sans-serif',
}
const sheetWrap = {
  position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(60,32,18,0.42)',
  backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
}
const sheetBox = {
  width: '100%', maxWidth: 384, background: BLANCO,
  border: `1px solid ${LINEA}`, borderRadius: 22, padding: 20,
  display: 'flex', flexDirection: 'column', gap: 12,
  fontFamily: 'Inter, sans-serif', boxShadow: '0 30px 70px rgba(150,60,20,0.22)',
  color: TINTA,
}
const btnPrimario = (activo) => ({
  width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
  background: activo ? NARANJA : '#EADFCB',
  color: activo ? '#FFF' : '#B5A390',
  fontSize: 13.5, fontWeight: 800, cursor: activo ? 'pointer' : 'default',
  fontFamily: 'Inter, sans-serif',
})
const chipHeader = (solido = false) => ({
  fontSize: 11.5, fontWeight: 800, padding: '8px 12px', borderRadius: 999,
  border: solido ? 'none' : `1px solid ${LINEA}`,
  background: solido ? NARANJA : BLANCO,
  color: solido ? '#FFF' : GRIS,
  cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
  boxShadow: solido ? '0 8px 20px rgba(150,60,20,0.25)' : 'none',
})

// Secciones del menú (pedidas así, con humor: el godzilla para lo caliente).
// Viven en shop_products.subcategory — columna ya existente, cero migración.
const SECCIONES_CAFE = [
  { id: 'caliente', titulo: 'CAFÉ CALIENTE', icono: '🦖🔥' },
  { id: 'frio',     titulo: 'FRÍOS',         icono: '🧊'   },
  { id: 'postre',   titulo: 'POSTRES',       icono: '🫳✨' },
  { id: 'salado',   titulo: 'SALADOS',       icono: '🧂'   },
]

// Ilustración de relleno mientras el equipo sube sus fotos. Es SVG propio
// (no una foto externa): transparente de verdad, nítido en cualquier tamaño
// y sin depender de que un CDN siga sirviendo la imagen. Taza para lo
// caliente, copa alta con hielo para lo frío. En cuanto un producto tiene
// image_url propia, gana la suya.
function IlustracionBebida({ tipo = 'caliente', size = 120 }) {
  const CREMA = '#FBF7F0'
  const SOMBRA_T = '#E2D9CC'
  const CAFE = '#6F4526'
  const CAFE2 = '#8C5A33'

  if (tipo === 'frio') {
    return (
      <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden
           style={{ display: 'block', filter: 'drop-shadow(0 14px 18px rgba(150,60,20,0.42))' }}>
        {/* copa alta */}
        <path d="M38 26h44l-5 66a10 10 0 0 1-10 9H53a10 10 0 0 1-10-9L38 26z"
              fill={CREMA} fillOpacity="0.92" />
        {/* bebida */}
        <path d="M41.6 44h36.8l-3.6 48a8 8 0 0 1-8 7H53.2a8 8 0 0 1-8-7L41.6 44z"
              fill={CAFE2} />
        <path d="M43 62h34l-2.6 30a8 8 0 0 1-8 7H53.6a8 8 0 0 1-8-7L43 62z"
              fill={CAFE} fillOpacity="0.55" />
        {/* hielos */}
        <rect x="48" y="49" width="15" height="14" rx="4" fill="#FFFFFF" fillOpacity="0.65" transform="rotate(-12 48 49)" />
        <rect x="63" y="61" width="13" height="12" rx="4" fill="#FFFFFF" fillOpacity="0.5" transform="rotate(14 63 61)" />
        <rect x="50" y="72" width="12" height="11" rx="3.5" fill="#FFFFFF" fillOpacity="0.42" transform="rotate(-6 50 72)" />
        {/* borde de la copa */}
        <ellipse cx="60" cy="26" rx="22" ry="6" fill={CREMA} />
        <ellipse cx="60" cy="26" rx="22" ry="6" fill="#FFFFFF" fillOpacity="0.4" />
        {/* sorbete */}
        <path d="M70 12l-6 18" stroke="#F06292" strokeWidth="5" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden
         style={{ display: 'block', filter: 'drop-shadow(0 14px 18px rgba(150,60,20,0.42))' }}>
      {/* vapor */}
      <path d="M50 26c-4-5 4-8 0-13" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M61 24c-4-6 4-9 0-14" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M72 26c-4-5 4-8 0-13" stroke="#FFFFFF" strokeOpacity="0.32" strokeWidth="3.4" strokeLinecap="round" />
      {/* plato */}
      <ellipse cx="60" cy="96" rx="35" ry="8" fill={SOMBRA_T} />
      <ellipse cx="60" cy="93" rx="35" ry="8" fill={CREMA} />
      {/* asa */}
      <path d="M88 55c11 0 15 7 15 13s-5 13-16 13" stroke={CREMA} strokeWidth="8" strokeLinecap="round" fill="none" />
      {/* taza */}
      <path d="M28 43h60l-5 36a14 14 0 0 1-14 12H47a14 14 0 0 1-14-12l-5-36z" fill={CREMA} />
      {/* café */}
      <ellipse cx="58" cy="45" rx="27" ry="7" fill={CAFE} />
      <ellipse cx="58" cy="44.4" rx="24" ry="5.6" fill={CAFE2} />
      {/* brillo */}
      <path d="M38 52c1 12 3 21 6 27" stroke="#FFFFFF" strokeOpacity="0.75" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

// Qué ilustración le toca a un producto sin foto: por su sección.
const tipoBebida = (p) => (p?.subcategory === 'frio' ? 'frio' : 'caliente')

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
@keyframes cafeMarquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes cafeFlecha { 0%,100% { transform: translateY(0) } 50% { transform: translateY(7px) } }
.cafe-marquee { animation: cafeMarquee 26s linear infinite; }
.cafe-chips { scrollbar-width: none; -ms-overflow-style: none; }
.cafe-chips::-webkit-scrollbar { display: none; }
@media (prefers-reduced-motion: reduce) {
  .cafe-rise { animation: none; opacity: 1 }
  .cafe-card, .cafe-zoom { transition: none }
  .cafe-marquee { animation: none }
}
`

// ── Piezas del lenguaje visual (vibe editorial) ─────────────────────────────
// Corte diagonal en la esquina: el triángulo que corta el bloque, como en la
// referencia. Se dibuja con un borde, sin imágenes.
function CorteEsquina({ color = TINTA, size = 74, lado = 'derecha', arriba = true }) {
  return (
    <div aria-hidden style={{
      position: 'absolute', top: arriba ? 0 : 'auto', bottom: arriba ? 'auto' : 0,
      right: lado === 'derecha' ? 0 : 'auto', left: lado === 'derecha' ? 'auto' : 0,
      width: 0, height: 0, pointerEvents: 'none',
      borderTop: arriba ? `${size}px solid ${color}` : 'none',
      borderBottom: arriba ? 'none' : `${size}px solid ${color}`,
      borderLeft: lado === 'derecha' ? `${size}px solid transparent` : 'none',
      borderRight: lado === 'derecha' ? 'none' : `${size}px solid transparent`,
    }} />
  )
}

// Texto vertical rotado al costado de una sección ("SMALL BATCH" en la
// referencia). Acá se usa para etiquetar cada bloque.
function TextoVertical({ children, color = VERDE, lado = 'derecha' }) {
  return (
    <div aria-hidden style={{
      position: 'absolute', top: 0, [lado === 'derecha' ? 'right' : 'left']: 6,
      writingMode: 'vertical-rl', textOrientation: 'mixed',
      fontSize: 11, fontWeight: 800, letterSpacing: '0.42em',
      color, opacity: 0.85, fontFamily: 'Inter, sans-serif',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {children}
    </div>
  )
}

// Cinta que se desplaza sin parar (marquee) — puro CSS, se frena con
// prefers-reduced-motion.
function Cinta({ texto, bg = TINTA, color = CREMA_UI }) {
  const items = Array(8).fill(texto)
  return (
    <div aria-hidden style={{ background: bg, overflow: 'hidden', padding: '11px 0' }}>
      <div className="cafe-marquee" style={{ display: 'flex', gap: 34, whiteSpace: 'nowrap' }}>
        {[...items, ...items].map((t, i) => (
          <span key={i} style={{
            fontFamily: DISPLAY, fontSize: 15, letterSpacing: '0.12em', color,
            display: 'inline-flex', alignItems: 'center', gap: 34,
          }}>{t}<span style={{ opacity: 0.55 }}>◆</span></span>
        ))}
      </div>
    </div>
  )
}

// ── Estrellas ────────────────────────────────────────────────────────────────
// `valor` puede ser fraccionario para MOSTRAR (4.5 → cuatro llenas y media).
// Con onRate se vuelve interactivo: tocar la enésima estrella vota n.
function Estrellas({ valor = 0, size = 15, onRate, color = '#F5A524' }) {
  const [hover, setHover] = useState(0)
  const mostrado = hover || valor
  return (
    <div style={{ display: 'inline-flex', gap: size * 0.14, alignItems: 'center' }}
         onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(i => {
        const llena = mostrado >= i - 0.25
        const media = !llena && mostrado >= i - 0.75
        const estrella = (
          <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
            <defs>
              <linearGradient id={`med${i}-${size}`}>
                <stop offset="50%" stopColor={color} />
                <stop offset="50%" stopColor="rgba(0,0,0,0.16)" />
              </linearGradient>
            </defs>
            <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95L12 2.6z"
                  fill={llena ? color : media ? `url(#med${i}-${size})` : 'rgba(0,0,0,0.16)'} />
          </svg>
        )
        return onRate ? (
          <button key={i} onClick={(e) => { e.stopPropagation(); onRate(i) }}
                  onMouseEnter={() => setHover(i)}
                  aria-label={`Puntuar con ${i} estrella${i > 1 ? 's' : ''}`}
                  style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', lineHeight: 0 }}>
            {estrella}
          </button>
        ) : <span key={i} style={{ lineHeight: 0 }}>{estrella}</span>
      })}
    </div>
  )
}

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
            background: 'rgba(150,60,20,0.4)',
            animation: `cafeVapor 1.3s ease-out ${0.35 + i * 0.22}s infinite`,
          }} />
        ))}
        <div style={{
          position: 'absolute', left: 0, bottom: 0, width: 66, height: 56,
          border: `3px solid ${NARANJA}`, borderRadius: '6px 6px 20px 20px',
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
          border: `3px solid ${NARANJA}`, borderLeft: 'none',
          borderRadius: '0 12px 12px 0',
        }} />
        <div style={{
          position: 'absolute', left: -6, bottom: -8, width: 78, height: 5,
          borderRadius: 3, background: 'rgba(150,60,20,0.18)',
        }} />
      </div>
      <div style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: '0.22em', color: NARANJA }}>
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
          <div style={{ width: 54, height: 54, borderRadius: 14, overflow: 'hidden', background: '#F3EADA', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${LINEA}` }}>
            {foto
              ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 10, color: GRIS, textAlign: 'center', lineHeight: 1.3, padding: 4 }}>sin foto<br/>(se usa una genérica)</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => fileRef.current?.click()} disabled={busy} style={{
              padding: '9px 0', borderRadius: 10, border: `1px solid ${LINEA}`,
              background: '#F3EADA', color: TINTA, fontSize: 12, fontWeight: 700,
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
                background: seccion === sc.id ? NARANJA : BLANCO,
                border: `1px solid ${seccion === sc.id ? NARANJA : LINEA}`,
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
          <span style={{ fontSize: 10.5, color: '#B5A390' }}>(menor = primero)</span>
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
function ProductoSheet({ producto, cantidadDe, rating, onVotar, onAgregar, onClose }) {
  const [miVoto, setMiVoto] = useState(() => {
    try { return Number(localStorage.getItem(`cafe_voto_${producto.id}`)) || 0 } catch { return 0 }
  })
  const vs = variantes(producto)
  const [tam, setTam] = useState(vs ? vs[0].label : null)
  const [leche, setLeche] = useState('normal')
  const [n, setN] = useState(Math.min(4, Math.max(1, cantidadDe(tam, 'normal') || 1)))
  // Al cambiar tamaño o leche, la cantidad refleja lo que ya haya de ESA
  // combinación: cada variante es una línea distinta del pedido.
  useEffect(() => { setN(Math.min(4, Math.max(1, cantidadDe(tam, leche) || 1))) }, [tam, leche])
  const recargo = producto.has_milk ? extraPorId(leche).precio(tam) : 0
  const unit = precioVariante(producto, tam) + recargo
  const enOferta = !vs && unit < (Number(producto.price) || 0)

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
          fontSize: 20, lineHeight: 1, boxShadow: '0 6px 16px rgba(150,60,20,0.08)',
        }}>‹</button>
      </div>

      {/* PNG flotando, sin recuadro */}
      <div style={{ position: 'relative', padding: '18px 24px 6px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 'min(74vw, 290px)', aspectRatio: '1 / 1' }}>
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'cafeFlotar 5.5s ease-in-out infinite',
          }}>
            {producto.image_url
              ? <img src={producto.image_url} alt="" style={{
                  width: '100%', height: '100%', objectFit: 'contain', display: 'block',
                  filter: 'drop-shadow(0 26px 38px rgba(150,60,20,0.32))',
                }} />
              : <IlustracionBebida tipo={tipoBebida(producto)} size="100%" />}
          </div>
          {/* sombra en el piso — lo despega del papel */}
          <div aria-hidden style={{
            position: 'absolute', bottom: -6, left: '18%', right: '18%', height: 16,
            borderRadius: '50%', background: 'rgba(150,60,20,0.16)', filter: 'blur(9px)',
          }} />
        </div>
      </div>

      {/* Texto */}
      <div style={{ padding: '20px 24px 0', maxWidth: 620, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <h2 style={{ margin: 0, fontSize: 'clamp(26px, 6.4vw, 34px)', fontWeight: 800, color: NARANJA, lineHeight: 1.15 }}>
          {producto.name}
        </h2>
        {/* Rating: promedio arriba y, debajo, las estrellas para votar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 10, flexWrap: 'wrap' }}>
          <Estrellas valor={rating?.promedio ?? 0} size={19} />
          <span style={{ fontSize: 14, fontWeight: 800, color: TINTA, fontVariantNumeric: 'tabular-nums' }}>
            {rating?.votos ? rating.promedio : '—'}
          </span>
          <span style={{ fontSize: 12.5, color: GRIS }}>
            {rating?.votos
              ? `${rating.votos} ${rating.votos === 1 ? 'voto' : 'votos'}`
              : 'Todavía sin puntuar'}
          </span>
        </div>

        {producto.description && (
          <p style={{ margin: '14px 0 0', fontSize: 15, color: GRIS, lineHeight: 1.65 }}>
            {producto.description}
          </p>
        )}

        {/* Votar — cualquiera puede, sin cuenta */}
        <div style={{
          marginTop: 20, padding: '14px 16px', borderRadius: 18,
          background: BLANCO, border: `1px solid ${LINEA}`,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: TINTA }}>
              {miVoto ? '¡Gracias por puntuar!' : '¿Qué te pareció?'}
            </div>
            <div style={{ fontSize: 11.5, color: GRIS, marginTop: 2 }}>
              {miVoto ? 'Podés cambiar tu voto cuando quieras.' : 'Tocá las estrellas — no hace falta cuenta.'}
            </div>
          </div>
          <Estrellas valor={miVoto} size={26} onRate={(n) => { setMiVoto(n); onVotar(n) }} />
        </div>

        {/* Tamaño — solo si el producto tiene más de uno */}
        {vs && vs.length > 1 && (
          <div style={{ marginTop: 26 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: NARANJA, marginBottom: 10 }}>Tamaño</div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {vs.map(v => {
                const activo = tam === v.label
                return (
                  <button key={v.label} onClick={() => setTam(v.label)} style={{
                    padding: '11px 18px', borderRadius: 999, cursor: 'pointer',
                    background: activo ? NARANJA : BLANCO,
                    border: `1.5px solid ${activo ? NARANJA : LINEA}`,
                    color: activo ? '#FFF' : GRIS,
                    fontFamily: DISPLAY, fontSize: 13, letterSpacing: '0.04em',
                    display: 'flex', alignItems: 'baseline', gap: 7,
                  }}>
                    {v.label}
                    <span style={{ fontSize: 11, opacity: 0.85, fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>
                      {fmt(v.price)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Cambio de leche — solo en las bebidas que la llevan */}
        {producto.has_milk && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: NARANJA, marginBottom: 10 }}>Leche</div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {EXTRAS_LECHE.map(e => {
                const activo = leche === e.id
                const rec = e.precio(tam)
                return (
                  <button key={e.id} onClick={() => setLeche(e.id)} style={{
                    padding: '11px 16px', borderRadius: 999, cursor: 'pointer',
                    background: activo ? NARANJA : BLANCO,
                    border: `1.5px solid ${activo ? NARANJA : LINEA}`,
                    color: activo ? '#FFF' : GRIS,
                    fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                    display: 'flex', alignItems: 'baseline', gap: 6,
                  }}>
                    {e.label}
                    {rec > 0 && <span style={{ fontSize: 11, opacity: 0.85 }}>+{fmt(rec)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Cantidad — 01 02 03 04 con el triangulito debajo */}
        <div style={{ marginTop: 30 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: NARANJA, marginBottom: 12 }}>Cantidad</div>
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
                    color: activo ? NARANJA : '#C6B7A4',
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                    transition: 'font-size 0.18s ease, color 0.18s ease',
                  }}>{String(v).padStart(2, '0')}</span>
                  <span aria-hidden style={{
                    fontSize: 10, color: NARANJA, lineHeight: 1,
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
            <div style={{ fontSize: 13, color: '#C6B7A4', textDecoration: 'line-through' }}>
              {fmt(Number(producto.price) * n)}
            </div>
          )}
          <div style={{ fontSize: 12.5, color: GRIS }}>
            {n} × {fmt(unit)}{tam ? ` · ${tam}` : ''}{recargo > 0 ? ` · ${extraPorId(leche).label.toLowerCase()}` : ''}
          </div>
        </div>
        <button onClick={() => { onAgregar(n, tam, leche); onClose() }} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '18px 26px', borderRadius: 22, border: 'none', cursor: 'pointer',
          background: NARANJA, color: '#FFF',
          fontSize: 18, fontWeight: 800, fontFamily: 'Inter, sans-serif',
          boxShadow: '0 16px 34px rgba(150,60,20,0.32)',
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
  entregada: { label: 'ENTREGADA', color: '#6B7280', bg: '#F3EADA', border: '#E5D8C4' },
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
            border: `1px solid ${LINEA}`, background: verTodas ? '#F3EADA' : 'transparent',
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
  const [ratings, setRatings] = useState({})     // { productId: { promedio, votos } }

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
    const extra = ', description, variants, has_milk'
    const pedir = (cols) => supabase
      .from('shop_products')
      .select(cols)
      .eq('category', 'cafe')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    // `description` puede no existir todavía (migración sin correr): si el
    // select falla por eso, se reintenta sin ella y el menú anda igual.
    // description y variants pueden no existir todavía (migración sin
    // correr): si el select falla por eso, se reintenta sin ellas.
    let { data, error } = await pedir(base + extra)
    if (error && /description|variants|has_milk/i.test(error.message || '')) {
      ({ data, error } = await pedir(base))
    }
    if (!error) setItems(data ?? [])
    setLoading(false)
  }
  useEffect(() => { cargarMenu() }, [])

  // Ratings: vista pública con SOLO el agregado. Si la migración no corrió,
  // no pasa nada — las cards simplemente no muestran estrellas.
  const cargarRatings = () => {
    supabase.from('cafe_product_ratings').select('product_id, promedio, votos')
      .then(({ data, error }) => {
        if (error || !data) return
        setRatings(Object.fromEntries(data.map(r => [r.product_id, { promedio: Number(r.promedio), votos: Number(r.votos) }])))
      })
  }
  useEffect(cargarRatings, [])

  const votar = async (productoId, estrellas) => {
    const { guestId } = getChatGuestIdentity()
    const { data, error } = await supabase.rpc('rate_cafe_product', {
      p_product_id: productoId, p_stars: estrellas, p_guest_id: guestId,
    })
    if (error) return
    const fila = Array.isArray(data) ? data[0] : data
    if (fila) setRatings(prev => ({ ...prev, [productoId]: { promedio: Number(fila.promedio), votos: Number(fila.votos) } }))
    try { localStorage.setItem(`cafe_voto_${productoId}`, String(estrellas)) } catch {}
  }

  const visibles = useMemo(
    () => esStaff ? items : items.filter(p => precioDesde(p) > 0),
    [items, esStaff])

  // Agrupado por sección; lo sin clasificar cae en 'otros'.
  const grupos = useMemo(() => {
    const por = { caliente: [], frio: [], postre: [], salado: [], otros: [] }
    for (const p of visibles) (por[p.subcategory] ?? por.otros).push(p)
    return por
  }, [visibles])

  // El carrito se indexa por producto|tamaño: un mismo café puede estar
  // pedido en 8oz y en 12oz a la vez, y son líneas distintas.
  const clave = (id, label, extra) => `${id}|${label ?? ''}|${extra ?? 'normal'}`

  const pedido = useMemo(() => {
    const out = []
    for (const [k, n] of Object.entries(qty)) {
      if (!n) continue
      const [pid, label, extraId] = k.split('|')
      const p = visibles.find(x => x.id === pid)
      if (!p) continue
      const ex = extraPorId(extraId)
      const unit = precioVariante(p, label || undefined) + (p.has_milk ? ex.precio(label) : 0)
      if (unit <= 0) continue
      out.push({
        ...p, key: k, label: label || null, n, unit, sub: unit * n,
        extraId: ex.id, extraLabel: ex.id === 'normal' ? null : ex.label,
      })
    }
    return out
  }, [visibles, qty])
  const total = pedido.reduce((a, p) => a + p.sub, 0)

  // Cuántas unidades hay en el carrito de un producto, sumando sus tamaños.
  const enCarrito = (id) => Object.entries(qty)
    .filter(([k, n]) => n > 0 && k.split('|')[0] === id)
    .reduce((a, [, n]) => a + n, 0)

  const nombreOk = nombre.trim().length >= 2
  const telOk    = tel.replace(/\D/g, '').length >= 7
  const datosOk  = nombreOk && telOk

  const armarWA = (codigo) => {
    const lineas = [
      `☕ *PEDIDO QUEST CAFÉ${codigo ? ` ${codigo}` : ''}* — ${modo === 'llevar' ? 'PARA LLEVAR 🥡' : 'PARA TOMAR EN TIENDA'}`,
      '',
      ...pedido.map(p => `· ${p.n}× ${p.name}${p.label ? ` (${p.label})` : ''}${p.extraLabel ? ` · leche ${p.extraLabel.toLowerCase()}` : ''} — ${fmt(p.sub)}`),
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
        p_items: pedido.map(p => ({ id: p.id, qty: p.n, variant: p.label, extra: p.extraId })),
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
    const n = enCarrito(p.id)
    const vs = variantes(p)
    const desde = precioDesde(p)
    const sinPrecio = desde <= 0
    const enOferta = !vs && !sinPrecio && precio(p) < (Number(p.price) || 0)
    return (
      <Reveal key={p.id} delay={Math.min(i * 55, 330)}>
        <div
          className="cafe-card"
          onClick={() => !sinPrecio && setFichaDe(p)}
          role={sinPrecio ? undefined : 'button'}
          tabIndex={sinPrecio ? undefined : 0}
          onKeyDown={(e) => { if (!sinPrecio && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setFichaDe(p) } }}
          style={{ paddingTop: 34, cursor: sinPrecio ? 'default' : 'pointer', outline: 'none' }}
        >
          <div style={{
            position: 'relative',
            background: n > 0
              ? `linear-gradient(160deg, ${NARANJA2} 0%, ${NARANJA} 100%)`
              : `linear-gradient(160deg, ${NARANJA} 0%, ${NARANJA3} 100%)`,
            borderRadius: 26,
            padding: '78px 15px 16px',
            boxShadow: n > 0 ? '0 22px 48px rgba(150,60,20,0.30)' : SOMBRA,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 3,
            minHeight: 52,
            opacity: sinPrecio ? 0.65 : 1,
          }}>
            {/* PNG flotando libre, saliéndose de la card */}
            {/* Al costado derecho y asomando poco por arriba, como la
                referencia: el nombre y el precio mandan a la izquierda. */}
            <div className="cafe-zoom" style={{
              position: 'absolute', top: -30, right: 2,
              width: 108, height: 108, pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {p.image_url
                ? <img src={p.image_url} alt="" loading="lazy" decoding="async" style={{
                    width: '100%', height: '100%', objectFit: 'contain', display: 'block',
                    filter: 'drop-shadow(0 14px 22px rgba(150,60,20,0.40))',
                  }} />
                : <IlustracionBebida tipo={tipoBebida(p)} size={108} />}
            </div>

            {/* Rating arriba a la izquierda, como la referencia */}
            <div style={{
              position: 'absolute', top: 12, left: 13,
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12.5, fontWeight: 800, color: '#FFF',
            }}>
              {ratings[p.id]?.votos
                ? <>
                    <Estrellas valor={ratings[p.id].promedio} size={13} color="#FFE9C7" />
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{ratings[p.id].promedio}</span>
                  </>
                : <span style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Sin puntuar</span>}
            </div>

            {esStaff && (
              <button onClick={(e) => { e.stopPropagation(); setEditor(p) }} aria-label={`Editar ${p.name}`} style={{
                position: 'absolute', top: 10, right: 10,
                width: 30, height: 30, borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.14)', color: '#FFF', fontSize: 13,
                cursor: 'pointer', lineHeight: 1,
              }}>✎</button>
            )}

            {/* Nombre y precio en la MISMA columna (el nombre justo arriba
                del precio) y el botón al costado. Antes el botón, más alto
                que el precio, abría 18px de hueco entre ambos. */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 800, color: '#FFF', lineHeight: 1.3,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{p.name}</div>
                {sinPrecio
                  ? <div style={{ color: '#FFD98A', fontSize: 11, fontWeight: 700, marginTop: 3 }}>Sin precio — no se publica</div>
                  : <div style={{ marginTop: 1, display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      {enOferta && <span style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'line-through', fontSize: 11.5 }}>{fmt(p.price)}</span>}
                      {vs && vs.length > 1 && <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: 700 }}>desde</span>}
                      <span style={{ color: '#FFF', fontWeight: 800, fontSize: 19, fontVariantNumeric: 'tabular-nums' }}>{fmt(desde)}</span>
                    </div>}
              </div>
              {!sinPrecio && (
                <div aria-hidden style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: '#FFF', color: NARANJA,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: n > 0 ? 16 : 21, fontWeight: 800, lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  boxShadow: '0 6px 14px rgba(0,0,0,0.18)',
                }}>{n > 0 ? n : '+'}</div>
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
          background: NARANJA, borderRadius: 999, padding: '6px 12px',
          boxShadow: '0 8px 20px rgba(150,60,20,0.22)',
        }}>
          <img src={questLogo} alt="Quest" style={{ height: 22, display: 'block' }} />
          <span style={{ fontFamily: DISPLAY, fontSize: 15, letterSpacing: '0.12em', color: '#FFF', lineHeight: 1 }}>CAFÉ</span>
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
            ...chipHeader(), color: '#B5A390', borderColor: '#EFE5D4',
          }}>Staff</button>
        )}
      </div>

      {/* ── HERO — bloque de color a sangre, tipografía gigante ── */}
      <section style={{
        position: 'relative', background: NARANJA, color: CREMA_UI,
        minHeight: 'calc(90dvh - 56px)', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '52px 22px 64px', overflow: 'hidden',
      }}>
        <CorteEsquina color={TINTA} size={76} />
        <TextoVertical color="rgba(250,243,231,0.75)">CAFÉ · TCG · PANAMÁ</TextoVertical>

        {/* granos flotando, muy sutiles */}
        {['8%', '84%', '22%', '70%'].map((left, i) => (
          <span key={i} aria-hidden style={{
            position: 'absolute', left, top: `${18 + i * 18}%`, fontSize: 20 + (i % 3) * 10,
            opacity: 0.10, animation: `cafeFlotar ${6 + i}s ease-in-out ${i * 0.7}s infinite`,
          }}>☕</span>
        ))}

        <div style={{ maxWidth: 880, width: '100%', margin: '0 auto', position: 'relative' }}>
          <div className="cafe-rise" style={{
            animationDelay: '0.05s', fontSize: 11, fontWeight: 800,
            letterSpacing: '0.38em', marginBottom: 18, opacity: 0.9,
          }}>QUEST HOBBY STORE</div>

          <h1 className="cafe-rise" style={{
            animationDelay: '0.14s', margin: 0,
            fontFamily: DISPLAY, fontWeight: 400,
            fontSize: 'clamp(46px, 13vw, 118px)', lineHeight: 0.94,
            letterSpacing: '-0.01em',
          }}>
            CAFÉ<br />
            <span style={{ WebkitTextStroke: `2px ${CREMA_UI}`, color: 'transparent' }}>PARA</span><br />
            JUGAR
          </h1>

          <p className="cafe-rise" style={{
            animationDelay: '0.3s', margin: '22px 0 30px',
            fontSize: 'clamp(14px, 2.7vw, 17px)', maxWidth: 420, lineHeight: 1.6,
            opacity: 0.92,
          }}>
            Cafeína de verdad para el día. Entre tu momento chill y birrias,
            pedí desde tu celular y seguí en lo tuyo — te avisamos cuando
            esté ready.
          </p>

          <div className="cafe-rise" style={{ animationDelay: '0.42s', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => irAlMenu('tienda')} style={{
              padding: '16px 26px', border: `2px solid ${CREMA_UI}`, cursor: 'pointer',
              background: CREMA_UI, color: NARANJA,
              fontFamily: DISPLAY, fontSize: 14, letterSpacing: '0.1em',
            }}>EN TIENDA</button>
            <button onClick={() => irAlMenu('llevar')} style={{
              padding: '16px 26px', border: `2px solid ${CREMA_UI}`, cursor: 'pointer',
              background: 'transparent', color: CREMA_UI,
              fontFamily: DISPLAY, fontSize: 14, letterSpacing: '0.1em',
            }}>PARA LLEVAR</button>
          </div>
        </div>

        {/* flecha dibujada, como el "SEE WHAT'S INSIDE" de la referencia */}
        {/* La flecha lleva al menú: era decorativa y pedía a gritos ser
            clickeable — es el único "siguiente paso" del hero. */}
        <button onClick={() => irAlMenu()} style={{
          position: 'absolute', left: 24, bottom: 22, display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 10.5, fontWeight: 800, letterSpacing: '0.24em', opacity: 0.85,
          background: 'none', border: 'none', cursor: 'pointer', color: CREMA_UI,
          fontFamily: 'Inter, sans-serif', padding: 0,
        }}>
          <svg width="26" height="34" viewBox="0 0 26 34" fill="none" style={{ animation: 'cafeFlecha 2.4s ease-in-out infinite' }}>
            <path d="M13 2c-9 6-13 14-6 22" stroke={CREMA_UI} strokeWidth="2" strokeLinecap="round" />
            <path d="M3 20l4 6 7-3" stroke={CREMA_UI} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          MIRÁ EL MENÚ
        </button>
      </section>

      <Cinta texto="RECIÉN MOLIDO" bg={TINTA} />

      {/* ── UBICACIÓN — bloque verde a sangre ── */}
      <Reveal>
        <section style={{ position: 'relative', background: VERDE, color: CREMA_UI, padding: '46px 22px 50px', overflow: 'hidden' }}>
          <CorteEsquina color={PAPEL} size={62} lado="izquierda" arriba={false} />
          <TextoVertical color="rgba(250,243,231,0.6)">DONDE ESTAMOS</TextoVertical>
          <div style={{ maxWidth: 880, margin: '0 auto' }}>
            <h2 style={{
              margin: 0, fontFamily: DISPLAY, fontWeight: 400,
              fontSize: 'clamp(34px, 9vw, 66px)', lineHeight: 0.95, letterSpacing: '-0.01em',
            }}>ENCONTRANOS</h2>
            <p style={{ margin: '14px 0 22px', fontSize: 15, lineHeight: 1.65, maxWidth: 420, opacity: 0.92 }}>
              Dentro de <strong>Quest Hobby Store</strong>. Venís por el café,
              te quedás por las cartas — o al revés.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="https://www.google.com/maps/search/Quest+Hobby+Store+Panamá" target="_blank" rel="noreferrer" style={{
                padding: '14px 22px', textDecoration: 'none', border: `2px solid ${CREMA_UI}`,
                background: CREMA_UI, color: VERDE, fontFamily: DISPLAY, fontSize: 13, letterSpacing: '0.09em',
              }}>CÓMO LLEGAR ↗</a>
              <a href={`https://wa.me/${STORE_WHATSAPP}`} target="_blank" rel="noreferrer" style={{
                padding: '14px 22px', textDecoration: 'none', border: `2px solid ${CREMA_UI}`,
                background: 'transparent', color: CREMA_UI, fontFamily: DISPLAY, fontSize: 13, letterSpacing: '0.09em',
              }}>ESCRIBINOS</a>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── MENÚ / PEDIDO ── */}
      <section id="cafe-menu" style={{ padding: '40px 18px 10px', maxWidth: 880, margin: '0 auto', width: '100%', boxSizing: 'border-box', scrollMarginTop: 64 }}>
        <Reveal>
          <div style={{ marginBottom: 18, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.2em', color: VERDE, fontVariantNumeric: 'tabular-nums' }}>01</span>
              <span style={{ flex: 1, height: 2, background: VERDE, opacity: 0.25 }} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.28em', color: VERDE }}>HAZ TU PEDIDO</span>
            </div>
            <h2 style={{
              margin: '10px 0 0', fontFamily: DISPLAY, fontWeight: 400,
              fontSize: 'clamp(40px, 11vw, 84px)', lineHeight: 0.95,
              letterSpacing: '-0.01em', color: NARANJA,
            }}>EL MENÚ</h2>
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
                  boxShadow: '0 6px 16px rgba(150,60,20,0.06)',
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
                <h3 style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 400, fontSize: 26, letterSpacing: '0.06em', color: NARANJA }}>{sec.titulo}</h3>
                <span aria-hidden style={{ flex: 1, height: 1, background: LINEA }} />
              </div>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px 14px' }}>
              {grupos[sec.id].map((p, i) => tarjeta(p, i))}
            </div>
          </div>
        ))}
      </section>

      {/* ── ASÍ LO HACEMOS ── */}
      <section style={{ padding: '36px 18px 30px', maxWidth: 880, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <Reveal>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.2em', color: VERDE, fontVariantNumeric: 'tabular-nums' }}>02</span>
              <span style={{ flex: 1, height: 2, background: VERDE, opacity: 0.25 }} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.28em', color: VERDE }}>DETRÁS DE LA BARRA</span>
            </div>
            <h2 style={{
              margin: '10px 0 0', fontFamily: DISPLAY, fontWeight: 400,
              fontSize: 'clamp(34px, 9vw, 68px)', lineHeight: 0.95,
              letterSpacing: '-0.01em', color: NARANJA,
            }}>ASÍ LO HACEMOS</h2>
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
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(38,20,12,0.82) 0%, rgba(38,20,12,0.02) 55%)' }} />
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
          background: NARANJA, borderRadius: 999, padding: '7px 14px',
        }}>
          <img src={questLogo} alt="Quest" style={{ height: 20 }} />
          <span style={{ fontFamily: DISPLAY, fontSize: 14, letterSpacing: '0.12em', color: '#FFF' }}>CAFÉ</span>
        </a>
        <div style={{ fontSize: 11.5, color: GRIS, marginTop: 10 }}>
          Parte de Quest Hobby Store — <a href={urlSitioPrincipal()} style={{ color: VERDE }}>ir a la tienda ↗</a>
        </div>
      </footer>

      {/* ── Barra de pedido (solo con carrito) ── */}
      {pedido.length > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30,
          padding: '12px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderTop: `1px solid ${LINEA}`, boxShadow: '0 -14px 40px rgba(150,60,20,0.10)',
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
                  background: modo === m.id ? NARANJA : '#F3EADA',
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
              <div style={{ textAlign: 'center', fontSize: 12.5, color: VERDE, fontWeight: 800 }}>
                ✓ Pedido {codigoOk} registrado — te llamamos por tu nombre
              </div>
            )}
            <button disabled={!datosOk || pidiendo} onClick={hacerPedido} style={{
              width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
              background: (datosOk && !pidiendo) ? WABTN : '#EADFCB',
              color: datosOk ? '#FFF' : '#B5A390',
              fontSize: 14.5, fontWeight: 800,
              cursor: (datosOk && !pidiendo) ? 'pointer' : 'default',
              fontFamily: 'Inter, sans-serif',
              boxShadow: (datosOk && !pidiendo) ? '0 12px 30px rgba(14,107,76,0.32)' : 'none',
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
          cantidadDe={(label, extra) => qty[clave(fichaDe.id, label, extra)] ?? 0}
          rating={ratings[fichaDe.id]}
          onVotar={(n) => votar(fichaDe.id, n)}
          onAgregar={(n, label, extra) => setQty(q => ({ ...q, [clave(fichaDe.id, label, extra)]: n }))}
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
