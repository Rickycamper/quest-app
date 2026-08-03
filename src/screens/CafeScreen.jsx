// ─────────────────────────────────────────────
// QUEST — CafeScreen (Quest Café)
// SITIO INDEPENDIENTE de la cafetería: en el subdominio (cafe.* / questcafe*)
// o en /cafe, main.jsx monta ESTO en lugar de la app — el feed, la nav y el
// resto del site ni se ejecutan. El logo de Quest lleva al website normal.
//
// CLIENTES: sin login, a propósito — cada fricción antes de pedir es una
// venta que se enfría. Se identifican con nombre + teléfono, que el
// aparato recuerda (localStorage). Nada más.
//
// EQUIPO: botón discreto "Staff" → email + CONTRASEÑA de la cuenta de
// Quest (signInWithPassword: funciona hoy, sin plantillas de email ni
// redirects — el login por código quedó descartado porque dependía de
// configurar el template de Supabase y trabó el acceso). Si la cuenta no
// es staff, se cierra la sesión ahí mismo: esta puerta es solo del equipo.
// El subdominio es OTRO origen: acá se ingresa una vez y queda.
//
// Staff adentro: "Órdenes" (tablero), "＋ Producto" y lápiz en cada card.
// RLS ya permite escribir shop_products al staff, desde cualquier origen.
//
// El pedido NO cobra online: sale por WhatsApp al número del negocio.
// ─────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  supabase, getProfile,
  upsertShopProduct, updateShopProduct, deleteShopProduct, uploadPostImage,
} from '../lib/supabase'
import { STORE_WHATSAPP } from '../lib/constants'
import { COLOR, RADIUS, ELEVATION } from '../lib/ui'
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

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: COLOR.surface,
  border: `1px solid ${COLOR.borderStrong}`, borderRadius: 10, padding: '10px 12px',
  color: COLOR.text, fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif',
}
const sheetWrap = {
  position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.72)',
  backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
}
const sheetBox = {
  width: '100%', maxWidth: 380, background: '#101014',
  border: `1px solid ${COLOR.borderStrong}`, borderRadius: 18, padding: 20,
  display: 'flex', flexDirection: 'column', gap: 12,
  fontFamily: 'Inter, sans-serif',
}
const btnPrimario = (activo) => ({
  width: '100%', padding: '12px 0', borderRadius: 11, border: 'none',
  background: activo ? '#FFF' : COLOR.surfaceRaised,
  color: activo ? '#111' : COLOR.textQuaternary,
  fontSize: 13.5, fontWeight: 800, cursor: activo ? 'pointer' : 'default',
  fontFamily: 'Inter, sans-serif',
})

// ── Paleta y piezas del sitio ────────────────────────────────────────────────
// Los colores cálidos que ya veníamos usando, ahora como constantes con
// nombre: el sitio entero se lee en clave café, no en clave tienda.
const CREMA    = '#F5E9DC'
const CARAMELO = '#D69E60'
const BEBAS    = '"Bebas Neue", Inter, sans-serif'
const FONDO    = 'radial-gradient(ellipse 90% 46% at 50% -6%, rgba(180,120,60,0.18) 0%, transparent 62%), #0C0907'

const chipHeader = (border, bg, color = CREMA) => ({
  fontSize: 11.5, fontWeight: 800, padding: '8px 11px', borderRadius: 999,
  border: `1px solid ${border}`, background: bg, color,
  cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
})
const btnQty = (mas, activo) => ({
  flex: 1, height: 32, borderRadius: 9, cursor: 'pointer', lineHeight: 1, fontSize: 16,
  border: `1px solid ${mas ? 'rgba(214,158,96,0.55)' : 'rgba(255,255,255,0.12)'}`,
  background: mas ? 'rgba(214,158,96,0.14)' : 'rgba(255,255,255,0.05)',
  color: activo ? CREMA : '#5A4F42',
})

// Imágenes genéricas hasta tener material propio (img-src * en la CSP las
// permite; los VIDEOS externos no pasarían — por eso son placeholders).
const VIDEOS = [
  { titulo: 'El espresso perfecto',  img: 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=800&q=60&auto=format&fit=crop' },
  { titulo: 'Arte latte en vivo',    img: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=60&auto=format&fit=crop' },
  { titulo: 'Del grano a tu taza',   img: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=60&auto=format&fit=crop' },
]

// Keyframes reales (inline styles no pueden declararlos). Un solo <style>.
const CSS_CAFE = `
@keyframes cafeLlenar { from { height: 12% } to { height: 82% } }
@keyframes cafeVapor {
  0%   { transform: translateY(4px) scaleX(1);   opacity: 0 }
  35%  { opacity: 0.7 }
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
.cafe-card { transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease, border-color 0.2s ease; }
@media (hover: hover) { .cafe-card:hover { transform: translateY(-4px) } }
.cafe-zoom { transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
@media (hover: hover) { .cafe-card:hover .cafe-zoom { transform: scale(1.06) } }
@media (prefers-reduced-motion: reduce) {
  .cafe-rise { animation: none; opacity: 1 }
  .cafe-card, .cafe-zoom { transition: none }
}
`

// ── Splash: la taza llenándose ───────────────────────────────────────────────
// Puro CSS (nada que descargar): taza dibujada con bordes, "café" que sube
// con cafeLlenar, vapor, y el overlay entero se desvanece solo. onFin
// desmonta y marca la sesión para no repetirlo en cada vista.
function SplashTaza({ onFin }) {
  useEffect(() => {
    const t = setTimeout(onFin, 2050)
    return () => clearTimeout(t)
  }, [onFin])
  return (
    <div aria-hidden style={{
      position: 'fixed', inset: 0, zIndex: 100, background: '#0C0907',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
      animation: 'cafeIrse 0.45s ease 1.55s both',
    }}>
      <div style={{ position: 'relative', width: 86, height: 74 }}>
        {/* vapor */}
        {[18, 38, 58].map((left, i) => (
          <span key={i} style={{
            position: 'absolute', top: -16, left, width: 3, height: 12, borderRadius: 3,
            background: 'rgba(245,233,220,0.5)',
            animation: `cafeVapor 1.3s ease-out ${0.35 + i * 0.22}s infinite`,
          }} />
        ))}
        {/* taza */}
        <div style={{
          position: 'absolute', left: 0, bottom: 0, width: 66, height: 56,
          border: `3px solid ${CREMA}`, borderRadius: '6px 6px 20px 20px',
          overflow: 'hidden', background: 'rgba(255,255,255,0.03)',
        }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            background: `linear-gradient(180deg, ${CARAMELO} 0%, #8A5A28 100%)`,
            animation: 'cafeLlenar 1.15s cubic-bezier(0.3, 0, 0.4, 1) 0.15s both',
          }} />
        </div>
        {/* asa */}
        <div style={{
          position: 'absolute', right: 0, bottom: 14, width: 20, height: 26,
          border: `3px solid ${CREMA}`, borderLeft: 'none',
          borderRadius: '0 12px 12px 0',
        }} />
        {/* plato */}
        <div style={{
          position: 'absolute', left: -6, bottom: -8, width: 78, height: 5,
          borderRadius: 3, background: 'rgba(245,233,220,0.35)',
        }} />
      </div>
      <div style={{ fontFamily: BEBAS, fontSize: 22, letterSpacing: '0.22em', color: CREMA, opacity: 0.9 }}>
        QUEST CAFÉ
      </div>
    </div>
  )
}

// ── Reveal al scrollear ──────────────────────────────────────────────────────
// IntersectionObserver: cada sección/card entra con fade+subida la primera
// vez que asoma. Con prefers-reduced-motion se muestra directo.
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
// Sin códigos ni links: signInWithPassword no depende de plantillas de email
// ni de redirects, así que funciona en el subdominio sin tocar el panel.
// Si la cuenta no es staff, se cierra la sesión al instante — esta puerta
// no le sirve (ni aparece) a los clientes.
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
        <div style={{ fontSize: 15, fontWeight: 800, color: COLOR.text }}>Acceso del equipo</div>
        <div style={{ fontSize: 12.5, color: COLOR.textSecondary, lineHeight: 1.5 }}>
          Ingresá con el email y la contraseña de tu cuenta de Quest.
        </div>
        <input type="email" autoComplete="email" placeholder="Email" value={email}
               onChange={e => setEmail(e.target.value)} style={inputStyle}
               onKeyDown={e => e.key === 'Enter' && entrar()} />
        <input type="password" autoComplete="current-password" placeholder="Contraseña" value={pass}
               onChange={e => setPass(e.target.value)} style={inputStyle}
               onKeyDown={e => e.key === 'Enter' && entrar()} />
        {err && <div style={{ fontSize: 12, color: COLOR.red }}>{err}</div>}
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
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const fileRef = useRef(null)

  const subirFoto = async (file) => {
    if (!file) return
    setBusy(true); setErr('')
    try {
      // Reusa el pipeline de imágenes del feed: comprime y devuelve URL
      // pública. Mismo bucket que ven los invitados en el feed.
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
      }
      const fila = esNuevo
        ? await upsertShopProduct({
            ...campos,
            sku: `CAFE-${Date.now()}`,
            category: 'cafe', game: null, subcategory: null, active: true,
          })
        : await updateShopProduct(producto.id, campos)
      onGuardado?.(fila)
      onClose()
    } catch (e) { setErr(e?.message || 'No se pudo guardar') }
    finally { setBusy(false) }
  }

  const borrar = async () => {
    if (!confirmar) { setConfirmar(true); return }
    setBusy(true); setErr('')
    try {
      // Soft delete, igual que la tienda: active=false. No borra la fila.
      await deleteShopProduct(producto.id)
      onBorrado?.(producto.id)
      onClose()
    } catch (e) { setErr(e?.message || 'No se pudo ocultar'); setBusy(false) }
  }

  return (
    <div style={sheetWrap} onClick={onClose}>
      <div style={{ ...sheetBox, maxHeight: '86dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, color: COLOR.text }}>
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

        {/* Foto: subir archivo o pegar URL — la card es imagen-primero */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 54, height: 54, borderRadius: 10, overflow: 'hidden', background: COLOR.surfaceRaised, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {foto ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 20 }}>☕</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => fileRef.current?.click()} disabled={busy} style={{
              padding: '9px 0', borderRadius: 9, border: `1px solid ${COLOR.borderStrong}`,
              background: COLOR.surfaceRaised, color: COLOR.text, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>{busy ? 'Subiendo…' : '📷 Subir foto'}</button>
            <input placeholder="…o pegá una URL de imagen" value={foto}
                   onChange={e => setFoto(e.target.value)} style={{ ...inputStyle, padding: '7px 10px', fontSize: 11.5 }} />
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                 onChange={e => subirFoto(e.target.files?.[0])} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: COLOR.textSecondary }}>
          Orden en el menú
          <input type="number" value={orden} onChange={e => setOrden(e.target.value)}
                 style={{ ...inputStyle, width: 76, padding: '7px 10px' }} />
          <span style={{ fontSize: 10.5, color: COLOR.textQuaternary }}>(menor = primero)</span>
        </label>

        {err && <div style={{ fontSize: 12, color: COLOR.red }}>{err}</div>}

        <button onClick={guardar} disabled={busy} style={btnPrimario(!busy)}>
          {busy ? 'Guardando…' : esNuevo ? 'Agregar al menú' : 'Guardar cambios'}
        </button>
        {!esNuevo && (
          <button onClick={borrar} disabled={busy} style={{
            width: '100%', padding: '10px 0', borderRadius: 10,
            border: `1px solid ${confirmar ? COLOR.red : COLOR.borderStrong}`,
            background: confirmar ? 'rgba(248,113,113,0.12)' : 'transparent',
            color: confirmar ? COLOR.red : COLOR.textTertiary,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>
            {confirmar ? '¿Seguro? Toca de nuevo para ocultarlo' : 'Ocultar del menú'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Tablero de órdenes (solo staff) ──────────────────────────────────────────
// Vive del registro en cafe_orders (RLS: solo staff lee todo). Se refresca
// solo cada 20 s mientras está abierto — suficiente para una barra, sin
// depender de que la tabla esté en la publicación de realtime.
const ESTADOS_CAFE = {
  nueva:     { label: 'NUEVA',     color: COLOR.gold,          bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.4)'  },
  lista:     { label: 'LISTA',     color: COLOR.green,         bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.4)'  },
  entregada: { label: 'ENTREGADA', color: COLOR.textSecondary, bg: 'rgba(156,163,175,0.07)', border: 'rgba(156,163,175,0.25)' },
  cancelada: { label: 'CANCELADA', color: COLOR.red,           bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)'  },
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
      flex: 1, padding: '8px 6px', borderRadius: 9, cursor: busyId ? 'default' : 'pointer',
      border: `1px solid ${border}`, background: bg, color,
      fontSize: 11.5, fontWeight: 800, fontFamily: 'Inter, sans-serif', opacity: busyId ? 0.5 : 1,
    }}>{label}</button>
  )

  return (
    <div style={sheetWrap} onClick={onClose}>
      <div style={{ ...sheetBox, maxWidth: 430, maxHeight: '88dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: COLOR.text, flex: 1 }}>Órdenes de hoy</span>
          <button onClick={() => setVerTodas(v => !v)} style={{
            fontSize: 10.5, fontWeight: 700, padding: '6px 10px', borderRadius: 999,
            border: `1px solid ${COLOR.borderStrong}`, background: verTodas ? COLOR.surfaceRaised : 'transparent',
            color: COLOR.textSecondary, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>{verTodas ? 'Solo activas' : 'Ver todas'}</button>
          <button onClick={onClose} aria-label="Cerrar" style={{
            background: 'none', border: 'none', color: COLOR.textTertiary, fontSize: 18, cursor: 'pointer', lineHeight: 1,
          }}>×</button>
        </div>

        {err && <div style={{ fontSize: 12, color: COLOR.red }}>{err}</div>}
        {loading && <div style={{ textAlign: 'center', padding: 20 }}><Spinner /></div>}
        {!loading && visibles.length === 0 && (
          <div style={{ fontSize: 12.5, color: COLOR.textTertiary, textAlign: 'center', padding: '18px 0' }}>
            {verTodas ? 'Hoy todavía no hubo pedidos.' : 'Sin pedidos activos — ☕ tranquilidad.'}
          </div>
        )}

        {visibles.map(o => {
          const st = ESTADOS_CAFE[o.status] ?? ESTADOS_CAFE.nueva
          const hora = new Date(o.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
          const items = Array.isArray(o.items) ? o.items : []
          return (
            <div key={o.id} style={{
              borderRadius: 13, padding: 12, background: st.bg, border: `1px solid ${st.border}`,
              display: 'flex', flexDirection: 'column', gap: 7,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: COLOR.text, fontFamily: 'SF Mono, Menlo, monospace' }}>{o.code}</span>
                <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', color: st.color }}>{st.label}</span>
                <span style={{ fontSize: 10.5, color: COLOR.textTertiary }}>{o.modo === 'llevar' ? '🥡 llevar' : '☕ en tienda'}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: COLOR.textTertiary }}>{hora}</span>
              </div>

              <div style={{ fontSize: 12.5, color: COLOR.text, lineHeight: 1.55 }}>
                {items.map((it, i) => <div key={i}>· {it.qty}× {it.name} — {fmt(it.sub)}</div>)}
                <div style={{ fontWeight: 800, marginTop: 2 }}>Total: {fmt(o.total)}</div>
              </div>

              <div style={{ fontSize: 11.5, color: COLOR.textSecondary }}>
                {o.customer_name || 'Sin nombre'}{o.customer_phone ? ` · ${o.customer_phone}` : ''}
                {o.note && <span style={{ display: 'block', color: COLOR.gold }}>Nota: {o.note}</span>}
              </div>

              {o.status === 'nueva' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {btnMini('Marcar LISTA', () => cambiarEstado(o, 'lista'), COLOR.green, 'rgba(74,222,128,0.45)', 'rgba(74,222,128,0.12)')}
                  {btnMini('Cancelar', () => cambiarEstado(o, 'cancelada'), COLOR.textSecondary, COLOR.borderStrong, 'transparent')}
                </div>
              )}
              {o.status === 'lista' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {btnMini('Entregada ✓', () => cambiarEstado(o, 'entregada'), COLOR.textSecondary, COLOR.borderStrong, COLOR.surfaceRaised)}
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

  // Sesión propia (sin AuthContext: acá no corre la app)
  const [session, setSession] = useState(null)
  const [perfil, setPerfil]   = useState(null)
  const [verLogin, setVerLogin] = useState(false)
  const [editor, setEditor]   = useState(null)        // null | {} (nuevo) | producto
  const [verOrdenes, setVerOrdenes] = useState(false)
  const [pidiendo, setPidiendo] = useState(false)
  const [codigoOk, setCodigoOk] = useState(null)

  // Splash de entrada: la taza llenándose. Una vez por sesión de navegador —
  // en el segundo pageview ya molestaría en vez de gustar.
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

  const cargarMenu = () => {
    supabase
      .from('shop_products')
      .select('id, name, price, sale_price, image_url, sort_order, active')
      .eq('category', 'cafe')
      .eq('active', true)   // sin esto, los "ocultados" (soft delete) seguirían saliendo
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setItems(data ?? [])
        setLoading(false)
      })
  }
  useEffect(cargarMenu, [])

  const visibles = useMemo(
    () => esStaff ? items : items.filter(p => precio(p) > 0),
    [items, esStaff])

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
      // Si falló (migración sin correr), el pedido igual sale por WhatsApp.
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

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      background: FONDO,
      fontFamily: 'Inter, sans-serif',
      color: CREMA,
    }}>
      <style>{CSS_CAFE}</style>
      {cargando && <SplashTaza onFin={() => {
        try { sessionStorage.setItem('cafe_splash', '1') } catch {}
        setCargando(false)
      }} />}

      {/* ── Header fijo ── */}
      <div style={{
        padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(12,9,7,0.78)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(214,158,96,0.14)',
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
      }}>
        <a href={urlSitioPrincipal()} aria-label="Ir al sitio de Quest" style={{ display: 'flex', alignItems: 'center' }}>
          <img src={questLogo} alt="Quest" style={{ height: 30, display: 'block' }} />
        </a>
        <span style={{ fontFamily: BEBAS, fontSize: 19, letterSpacing: '0.1em', color: CREMA, lineHeight: 1 }}>CAFÉ</span>
        <span style={{ flex: 1 }} />
        {esStaff && (
          <>
            <button onClick={() => setVerOrdenes(true)} style={chipHeader('rgba(96,165,250,0.5)', 'rgba(96,165,250,0.12)')}>Órdenes</button>
            <button onClick={() => setEditor({})} style={chipHeader('rgba(214,158,96,0.55)', 'rgba(214,158,96,0.13)')}>＋ Producto</button>
            <button onClick={() => supabase.auth.signOut()} style={chipHeader('rgba(255,255,255,0.14)', 'transparent', '#8A7660')}>Salir</button>
          </>
        )}
        {!esStaff && (
          <button onClick={() => setVerLogin(true)} aria-label="Acceso del equipo"
                  style={chipHeader('rgba(255,255,255,0.10)', 'transparent', '#5A4F42')}>Staff</button>
        )}
      </div>

      {/* ── HERO ── */}
      <section style={{
        minHeight: 'calc(88dvh - 60px)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: '40px 22px 30px', position: 'relative', overflow: 'hidden',
      }}>
        {/* halo cálido + granos flotando */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 75% 55% at 50% 8%, rgba(214,158,96,0.20) 0%, transparent 62%)',
        }} />
        {['12%', '78%', '30%', '64%', '88%'].map((left, i) => (
          <span key={i} aria-hidden style={{
            position: 'absolute', left, top: `${18 + i * 14}%`, fontSize: 15 + (i % 3) * 6,
            opacity: 0.13, animation: `cafeFlotar ${5.5 + i}s ease-in-out ${i * 0.8}s infinite`,
          }}>☕</span>
        ))}

        <div className="cafe-rise" style={{ animationDelay: '0.05s', fontSize: 12, fontWeight: 700, letterSpacing: '0.32em', color: CARAMELO, marginBottom: 14 }}>
          QUEST HOBBY STORE PRESENTA
        </div>
        <h1 className="cafe-rise" style={{
          animationDelay: '0.15s', margin: 0,
          fontFamily: BEBAS, fontWeight: 400,
          fontSize: 'clamp(64px, 16vw, 150px)', lineHeight: 0.92,
          letterSpacing: '0.02em', color: CREMA,
          textShadow: '0 10px 60px rgba(214,158,96,0.25)',
        }}>
          QUEST<br />CAFÉ
        </h1>
        <p className="cafe-rise" style={{ animationDelay: '0.28s', margin: '18px 0 26px', fontSize: 'clamp(14px, 2.6vw, 17px)', color: '#B99F84', maxWidth: 430, lineHeight: 1.65 }}>
          Café de verdad, en tu tienda de siempre. Pedí desde el celular
          y te avisamos cuando esté listo.
        </p>

        {/* Directo al pedido: elegís cómo y bajás al menú */}
        <div className="cafe-rise" style={{ animationDelay: '0.4s', display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => irAlMenu('tienda')} style={{
            padding: '15px 26px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${CARAMELO} 0%, #B4783C 100%)`,
            color: '#1A0F06', fontSize: 15, fontWeight: 800, fontFamily: 'Inter, sans-serif',
            boxShadow: '0 12px 34px rgba(214,158,96,0.35)',
          }}>☕ Para tomar en tienda</button>
          <button onClick={() => irAlMenu('llevar')} style={{
            padding: '15px 26px', borderRadius: 999, cursor: 'pointer',
            background: 'rgba(214,158,96,0.10)', border: `1.5px solid rgba(214,158,96,0.55)`,
            color: CREMA, fontSize: 15, fontWeight: 800, fontFamily: 'Inter, sans-serif',
          }}>🥡 Para llevar</button>
        </div>

        <div aria-hidden style={{ position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', animation: 'cafeFlotar 2.6s ease-in-out infinite', color: '#6B5B4A', fontSize: 20 }}>⌄</div>
      </section>

      {/* ── UBICACIÓN ── */}
      <Reveal>
        <section style={{ padding: '30px 22px 10px', maxWidth: 760, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <div style={{
            display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
            background: 'linear-gradient(140deg, rgba(214,158,96,0.10) 0%, rgba(214,158,96,0.03) 100%)',
            border: '1px solid rgba(214,158,96,0.25)', borderRadius: 22, padding: '22px 24px',
          }}>
            <div style={{ fontSize: 40 }}>📍</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: BEBAS, fontSize: 26, letterSpacing: '0.05em', color: CREMA }}>ENCONTRANOS</div>
              <div style={{ fontSize: 13.5, color: '#B99F84', lineHeight: 1.6, marginTop: 4 }}>
                Dentro de <strong style={{ color: CREMA }}>Quest Hobby Store</strong> — venís por el café,
                te quedás por las cartas. Horario de la tienda.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="https://www.google.com/maps/search/Quest+Hobby+Store+Panamá" target="_blank" rel="noreferrer" style={{
                padding: '11px 16px', borderRadius: 999, textDecoration: 'none',
                background: 'rgba(214,158,96,0.14)', border: '1px solid rgba(214,158,96,0.5)',
                color: CREMA, fontSize: 12.5, fontWeight: 800,
              }}>Cómo llegar ↗</a>
              <a href={`https://wa.me/${STORE_WHATSAPP}`} target="_blank" rel="noreferrer" style={{
                padding: '11px 16px', borderRadius: 999, textDecoration: 'none',
                background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.45)',
                color: '#7CE3A5', fontSize: 12.5, fontWeight: 800,
              }}>Escribinos</a>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── MENÚ / PEDIDO ── */}
      <section id="cafe-menu" style={{ padding: '44px 18px 10px', maxWidth: 860, margin: '0 auto', width: '100%', boxSizing: 'border-box', scrollMarginTop: 70 }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', color: CARAMELO }}>HAZ TU PEDIDO</div>
            <h2 style={{ margin: '6px 0 0', fontFamily: BEBAS, fontWeight: 400, fontSize: 'clamp(38px, 7vw, 56px)', letterSpacing: '0.03em', color: CREMA }}>EL MENÚ</h2>
          </div>
        </Reveal>

        {loading && <div style={{ textAlign: 'center', marginTop: 40 }}><Spinner /></div>}

        {!loading && visibles.length === 0 && (
          <div style={{ textAlign: 'center', margin: '46px 0 60px', display: 'flex', flexDirection: 'column', gap: 8, padding: '0 26px' }}>
            <span style={{ fontSize: 36 }}>☕</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: CREMA }}>El menú está en preparación</span>
            <span style={{ fontSize: 13, color: '#8A7660', lineHeight: 1.6 }}>
              {esStaff
                ? 'Tocá "＋ Producto" arriba para cargar el primero.'
                : 'Muy pronto vas a poder pedir desde acá. Mientras tanto, acercate a la barra.'}
            </span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 13, paddingBottom: 26 }}>
          {visibles.map((p, i) => {
            const n = qty[p.id] ?? 0
            const sinPrecio = precio(p) <= 0
            const enOferta = !sinPrecio && precio(p) < (Number(p.price) || 0)
            return (
              <Reveal key={p.id} delay={Math.min(i * 55, 330)}>
                <div className="cafe-card" style={{
                  background: 'rgba(255,255,255,0.035)',
                  borderRadius: 18, overflow: 'hidden',
                  border: `1px solid ${n > 0 ? 'rgba(214,158,96,0.65)' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: n > 0 ? '0 10px 34px rgba(214,158,96,0.16)' : '0 6px 22px rgba(0,0,0,0.35)',
                  display: 'flex', flexDirection: 'column', position: 'relative',
                  opacity: sinPrecio ? 0.6 : 1,
                }}>
                  {esStaff && (
                    <button onClick={() => setEditor(p)} aria-label={`Editar ${p.name}`} style={{
                      position: 'absolute', top: 8, right: 8, zIndex: 2,
                      width: 30, height: 30, borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)',
                      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                      color: '#FFF', fontSize: 13, cursor: 'pointer', lineHeight: 1,
                    }}>✎</button>
                  )}
                  <div style={{ width: '100%', aspectRatio: '1 / 1', background: '#1B140E', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {p.image_url
                      ? <img src={p.image_url} alt="" loading="lazy" decoding="async" className="cafe-zoom" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <span style={{ fontSize: 36 }}>☕</span>}
                  </div>
                  <div style={{ padding: '11px 12px 13px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: CREMA, lineHeight: 1.3, flex: 1 }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      {sinPrecio
                        ? <span style={{ color: '#D6A560', fontSize: 11, fontWeight: 700 }}>Sin precio — no se publica</span>
                        : <>
                            {enOferta && <span style={{ color: '#6B5B4A', textDecoration: 'line-through', fontSize: 11 }}>{fmt(p.price)}</span>}
                            <span style={{ color: CARAMELO, fontWeight: 800, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{fmt(precio(p))}</span>
                          </>}
                    </div>
                    {!sinPrecio && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <button onClick={() => cambiar(p.id, -1)} style={btnQty(false, n > 0)}>−</button>
                        <span style={{ minWidth: 20, textAlign: 'center', fontSize: 14, fontWeight: 800, color: n > 0 ? CARAMELO : '#5A4F42', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                        <button onClick={() => cambiar(p.id, +1)} style={btnQty(true, true)}>+</button>
                      </div>
                    )}
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* ── ASÍ LO HACEMOS (placeholders de video) ── */}
      <section style={{ padding: '40px 18px 30px', maxWidth: 860, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', color: CARAMELO }}>DETRÁS DE LA BARRA</div>
            <h2 style={{ margin: '6px 0 0', fontFamily: BEBAS, fontWeight: 400, fontSize: 'clamp(34px, 6vw, 48px)', letterSpacing: '0.03em', color: CREMA }}>ASÍ LO HACEMOS</h2>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 13 }}>
          {VIDEOS.map((v, i) => (
            <Reveal key={v.titulo} delay={i * 90}>
              <div className="cafe-card" style={{
                position: 'relative', borderRadius: 18, overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.09)', aspectRatio: '16 / 10',
                background: '#1B140E', cursor: 'default',
              }}>
                {/* Imagen genérica hasta que haya videos propios */}
                <img src={v.img} alt="" loading="lazy" decoding="async" className="cafe-zoom"
                     style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,7,5,0.88) 0%, rgba(10,7,5,0.05) 55%)' }} />
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -56%)',
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(214,158,96,0.22)', border: '1.5px solid rgba(245,233,220,0.65)',
                  backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: CREMA, fontSize: 18, marginLeft: 3 }}>▶</span>
                </div>
                <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: CREMA }}>{v.titulo}</div>
                  <div style={{ fontSize: 11, color: '#B99F84', marginTop: 2 }}>Video muy pronto ☕</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: '26px 22px calc(30px + env(safe-area-inset-bottom, 0px))', textAlign: 'center', borderTop: '1px solid rgba(214,158,96,0.12)', marginTop: 10 }}>
        <a href={urlSitioPrincipal()} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src={questLogo} alt="Quest" style={{ height: 26 }} />
          <span style={{ fontFamily: BEBAS, fontSize: 16, letterSpacing: '0.1em', color: '#8A7660' }}>CAFÉ</span>
        </a>
        <div style={{ fontSize: 11.5, color: '#5A4F42', marginTop: 8 }}>
          Parte de Quest Hobby Store — <a href={urlSitioPrincipal()} style={{ color: '#8A7660' }}>ir a la tienda ↗</a>
        </div>
      </footer>

      {/* ── Barra de pedido: aparece recién cuando hay algo en el carrito ── */}
      {pedido.length > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30,
          padding: '12px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(12,9,7,0.94)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(214,158,96,0.3)',
          animation: 'cafeSubir 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}>
          <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', gap: 7 }}>
              {[
                { id: 'tienda', label: '☕ Para tomar en tienda' },
                { id: 'llevar', label: '🥡 Para llevar' },
              ].map(m => (
                <button key={m.id} onClick={() => setModo(m.id)} style={{
                  flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                  background: modo === m.id ? 'rgba(214,158,96,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${modo === m.id ? 'rgba(214,158,96,0.65)' : 'rgba(255,255,255,0.10)'}`,
                  color: modo === m.id ? CREMA : '#8A7660',
                  fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
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
              <div style={{ textAlign: 'center', fontSize: 12.5, color: '#7CE3A5', fontWeight: 800 }}>
                ✓ Pedido {codigoOk} registrado — te llamamos por tu nombre
              </div>
            )}
            <button disabled={!datosOk || pidiendo} onClick={hacerPedido} style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              background: (datosOk && !pidiendo) ? '#25D366' : 'rgba(255,255,255,0.06)',
              color: datosOk ? '#FFF' : '#5A4F42',
              fontSize: 14.5, fontWeight: 800,
              cursor: (datosOk && !pidiendo) ? 'pointer' : 'default',
              fontFamily: 'Inter, sans-serif',
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
