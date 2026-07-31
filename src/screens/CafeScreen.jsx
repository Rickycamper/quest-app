// ─────────────────────────────────────────────
// QUEST — CafeScreen (Quest Café)
// SITIO INDEPENDIENTE de la cafetería: en el subdominio (cafe.* / questcafe*)
// o en /cafe, main.jsx monta ESTO en lugar de la app — el feed, la nav y el
// resto del site ni se ejecutan. El logo de Quest lleva al website normal.
//
// Cuentas: el login es OPCIONAL y por código de email (sendOtpCode /
// verifyOtpCode, solo cuentas EXISTENTES de Quest). Se eligió OTP a
// propósito: funciona para cuentas de email Y de OAuth, y no necesita
// redirects — clave porque el subdominio es OTRO origen y no comparte la
// sesión del site principal (localStorage no cruza dominios; acá se inicia
// sesión una vez y queda). Logueado: nombre y teléfono se precargan del
// perfil. Invitado: se piden una vez y quedan en localStorage.
//
// Admins (is_owner o role staff/admin): gestionan el menú ACÁ mismo —
// agregar producto, editar precio/oferta/foto/orden, y ocultar (soft
// delete, active=false, igual que la tienda). RLS ya permite escribir
// shop_products al staff; la sesión vale desde cualquier origen.
//
// El pedido NO cobra online: sale por WhatsApp al número del negocio.
// ─────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  supabase, getProfile, sendOtpCode, verifyOtpCode,
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

// ── Login por código de email ────────────────────────────────────────────────
function LoginSheet({ onClose, onListo }) {
  const [email, setEmail]   = useState('')
  const [codigo, setCodigo] = useState('')
  const [paso, setPaso]     = useState('email')   // 'email' | 'codigo'
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState('')

  const mandarCodigo = async () => {
    if (busy) return
    setBusy(true); setErr('')
    try { await sendOtpCode(email); setPaso('codigo') }
    catch (e) { setErr(e?.message || 'No se pudo mandar el código') }
    finally { setBusy(false) }
  }
  const verificar = async () => {
    if (busy) return
    setBusy(true); setErr('')
    try { await verifyOtpCode(email, codigo.trim()); onListo?.(); onClose() }
    catch (e) { setErr(e?.message || 'Código incorrecto') }
    finally { setBusy(false) }
  }

  return (
    <div style={sheetWrap} onClick={onClose}>
      <div style={sheetBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, color: COLOR.text }}>Ingresá con tu cuenta de Quest</div>
        {paso === 'email' ? (
          <>
            <div style={{ fontSize: 12.5, color: COLOR.textSecondary, lineHeight: 1.5 }}>
              Te mandamos un código de 6 dígitos al email de tu cuenta. Sirve
              también si entrás con Discord o Twitch.
            </div>
            <input type="email" autoComplete="email" placeholder="tu@email.com" value={email}
                   onChange={e => setEmail(e.target.value)} style={inputStyle}
                   onKeyDown={e => e.key === 'Enter' && mandarCodigo()} />
            {err && <div style={{ fontSize: 12, color: COLOR.red }}>{err}</div>}
            <button onClick={mandarCodigo} disabled={busy} style={btnPrimario(!busy && email.includes('@'))}>
              {busy ? 'Mandando…' : 'Mandar código'}
            </button>
            <a href={urlSitioPrincipal()} style={{ fontSize: 11.5, color: COLOR.textTertiary, textAlign: 'center', textDecoration: 'none' }}>
              ¿No tenés cuenta? Creala en questhobbystore.com ↗
            </a>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: COLOR.textSecondary, lineHeight: 1.5 }}>
              Código enviado a <strong style={{ color: COLOR.text }}>{email}</strong>. Revisá spam si no llega.
            </div>
            <input inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={codigo}
                   onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                   style={{ ...inputStyle, textAlign: 'center', fontSize: 20, letterSpacing: '0.35em', fontVariantNumeric: 'tabular-nums' }}
                   onKeyDown={e => e.key === 'Enter' && verificar()} autoFocus />
            {err && <div style={{ fontSize: 12, color: COLOR.red }}>{err}</div>}
            <button onClick={verificar} disabled={busy} style={btnPrimario(!busy && codigo.length === 6)}>
              {busy ? 'Verificando…' : 'Entrar'}
            </button>
            <button onClick={() => { setPaso('email'); setCodigo(''); setErr('') }}
                    style={{ background: 'none', border: 'none', color: COLOR.textTertiary, fontSize: 11.5, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Cambiar email
            </button>
          </>
        )}
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user?.id) { setPerfil(null); return }
    getProfile(session.user.id).then(setPerfil).catch(() => setPerfil(null))
  }, [session?.user?.id])

  // Con perfil: precargar SOLO lo vacío — no pisar lo que la persona escribió
  useEffect(() => {
    if (perfil?.username) setNombre(n => n || perfil.username)
    if (perfil?.phone)    setTel(t => t || perfil.phone)
  }, [perfil?.username, perfil?.phone])

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
        // El staff ve también lo que no tiene precio (para terminar de cargarlo);
        // el público solo lo publicable.
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

  const pedirPorWA = () => {
    // Recordar los datos del aparato para el próximo pedido
    try { localStorage.setItem(DATOS_KEY, JSON.stringify({ nombre: nombre.trim(), tel: tel.trim() })) } catch {}
    const lineas = [
      `☕ *PEDIDO QUEST CAFÉ* — ${modo === 'llevar' ? 'PARA LLEVAR 🥡' : 'PARA TOMAR EN TIENDA'}`,
      '',
      ...pedido.map(p => `· ${p.n}× ${p.name} — ${fmt(p.sub)}`),
      '',
      `*Total: ${fmt(total)}*`,
      nombre.trim() ? `Nombre: ${nombre.trim()}` : null,
      tel.trim()    ? `Tel: ${tel.trim()}`       : null,
      perfil?.username ? `Cuenta: @${perfil.username}` : null,
      nota.trim()   ? `Nota: ${nota.trim()}`     : null,
    ].filter(v => v !== null)
    window.open(`https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(lineas.join('\n'))}`, '_blank')
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      background:
        'radial-gradient(ellipse 90% 50% at 50% -8%, rgba(251,146,60,0.16) 0%, transparent 60%), ' + COLOR.background,
      fontFamily: 'Inter, sans-serif',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>
      {/* Header — el logo vuelve al website normal */}
      <div style={{
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0, borderBottom: `1px solid ${COLOR.border}`,
        position: 'sticky', top: 0, zIndex: 5,
        background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      }}>
        <a href={urlSitioPrincipal()} aria-label="Ir al sitio de Quest" style={{ display: 'flex', alignItems: 'center' }}>
          <img src={questLogo} alt="Quest" style={{ height: 32, display: 'block' }} />
        </a>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: '"Bebas Neue", Inter, sans-serif', fontSize: 21, letterSpacing: '0.06em', color: COLOR.text, lineHeight: 1 }}>
            CAFÉ
          </div>
          <div style={{ fontSize: 10.5, color: COLOR.textSecondary, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {perfil?.username ? `Hola, @${perfil.username}` : 'Pedí acá y retiralo en la barra'}
          </div>
        </div>

        {esStaff && (
          <button onClick={() => setEditor({})} style={{
            fontSize: 11.5, fontWeight: 800, padding: '8px 11px', borderRadius: 999,
            border: '1px solid rgba(251,146,60,0.55)', background: 'rgba(251,146,60,0.14)',
            color: COLOR.text, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
          }}>＋ Producto</button>
        )}
        {session ? (
          <button onClick={() => supabase.auth.signOut()} style={{
            fontSize: 11.5, fontWeight: 700, padding: '8px 11px', borderRadius: 999,
            border: `1px solid ${COLOR.borderStrong}`, background: COLOR.surface,
            color: COLOR.textSecondary, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>Salir</button>
        ) : (
          <button onClick={() => setVerLogin(true)} style={{
            fontSize: 11.5, fontWeight: 800, padding: '8px 12px', borderRadius: 999,
            border: 'none', background: '#FFF', color: '#111',
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}>Ingresar</button>
        )}
      </div>

      {/* Menú — grilla de cards como el catálogo de la tienda */}
      <div style={{ flex: 1, padding: 16, maxWidth: 860, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {loading && <div style={{ textAlign: 'center', marginTop: 60 }}><Spinner /></div>}

        {!loading && visibles.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 80, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 26px' }}>
            <span style={{ fontSize: 36 }}>☕</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: COLOR.text }}>El menú está en preparación</span>
            <span style={{ fontSize: 13, color: COLOR.textTertiary, lineHeight: 1.6 }}>
              {esStaff
                ? 'Tocá "＋ Producto" arriba para cargar el primero.'
                : 'Muy pronto vas a poder pedir desde acá. Mientras tanto, acercate a la barra.'}
            </span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, paddingBottom: pedido.length ? 40 : 0 }}>
          {visibles.map(p => {
            const n = qty[p.id] ?? 0
            const sinPrecio = precio(p) <= 0
            const enOferta = !sinPrecio && precio(p) < (Number(p.price) || 0)
            return (
              <div key={p.id} style={{
                background: COLOR.surface,
                borderRadius: RADIUS.lg,
                overflow: 'hidden',
                border: `1px solid ${n > 0 ? 'rgba(251,146,60,0.55)' : COLOR.border}`,
                boxShadow: `${ELEVATION.sm}, ${ELEVATION.innerLit}`,
                display: 'flex', flexDirection: 'column',
                transition: 'border-color 160ms ease',
                position: 'relative',
                opacity: sinPrecio ? 0.6 : 1,
              }}>
                {esStaff && (
                  <button onClick={() => setEditor(p)} aria-label={`Editar ${p.name}`} style={{
                    position: 'absolute', top: 7, right: 7, zIndex: 2,
                    width: 30, height: 30, borderRadius: 9, border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                    color: '#FFF', fontSize: 13, cursor: 'pointer', lineHeight: 1,
                  }}>✎</button>
                )}
                <div style={{ width: '100%', aspectRatio: '1 / 1', background: COLOR.surfaceRaised, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.image_url
                    ? <img src={p.image_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <span style={{ fontSize: 34 }}>☕</span>}
                </div>
                <div style={{ padding: '10px 11px 12px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: COLOR.text, lineHeight: 1.3, flex: 1 }}>{p.name}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    {sinPrecio
                      ? <span style={{ color: COLOR.amber, fontSize: 11, fontWeight: 700 }}>Sin precio — no se publica</span>
                      : <>
                          {enOferta && <span style={{ color: COLOR.textTertiary, textDecoration: 'line-through', fontSize: 11 }}>{fmt(p.price)}</span>}
                          <span style={{ color: enOferta ? COLOR.green : COLOR.text, fontWeight: 800, fontSize: 14.5, fontVariantNumeric: 'tabular-nums' }}>{fmt(precio(p))}</span>
                        </>}
                  </div>
                  {!sinPrecio && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <button onClick={() => cambiar(p.id, -1)} style={{
                        flex: 1, height: 32, borderRadius: 9, border: `1px solid ${COLOR.borderStrong}`,
                        background: COLOR.surfaceRaised, color: n > 0 ? COLOR.text : COLOR.textQuaternary,
                        fontSize: 16, cursor: 'pointer', lineHeight: 1,
                      }}>−</button>
                      <span style={{ minWidth: 20, textAlign: 'center', fontSize: 14, fontWeight: 800, color: n > 0 ? COLOR.orange : COLOR.textQuaternary, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                      <button onClick={() => cambiar(p.id, +1)} style={{
                        flex: 1, height: 32, borderRadius: 9, border: '1px solid rgba(251,146,60,0.55)',
                        background: 'rgba(251,146,60,0.14)', color: COLOR.text,
                        fontSize: 16, cursor: 'pointer', lineHeight: 1,
                      }}>+</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Barra de pedido */}
      {visibles.some(p => precio(p) > 0) && (
        <div style={{
          position: 'sticky', bottom: 0, flexShrink: 0,
          padding: '12px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          borderTop: `1px solid ${COLOR.borderStrong}`,
        }}>
          <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', gap: 7 }}>
              {[
                { id: 'tienda', label: '☕ Para tomar en tienda' },
                { id: 'llevar', label: '🥡 Para llevar' },
              ].map(m => (
                <button key={m.id} onClick={() => setModo(m.id)} style={{
                  flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                  background: modo === m.id ? 'rgba(251,146,60,0.16)' : COLOR.surface,
                  border: `1px solid ${modo === m.id ? 'rgba(251,146,60,0.6)' : COLOR.borderStrong}`,
                  color: modo === m.id ? COLOR.text : COLOR.textSecondary,
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

            <button disabled={pedido.length === 0} onClick={pedirPorWA} style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              background: pedido.length ? '#25D366' : COLOR.surfaceRaised,
              color: pedido.length ? '#FFF' : COLOR.textQuaternary,
              fontSize: 14.5, fontWeight: 800, cursor: pedido.length ? 'pointer' : 'default',
              fontFamily: 'Inter, sans-serif',
            }}>
              {pedido.length
                ? `Pedir por WhatsApp · ${fmt(total)}`
                : 'Elegí algo del menú para pedir'}
            </button>
          </div>
        </div>
      )}

      {verLogin && <LoginSheet onClose={() => setVerLogin(false)} />}
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
