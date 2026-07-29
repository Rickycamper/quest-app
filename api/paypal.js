// Vercel serverless — Checkout de PayPal para productos EN STOCK.
//
// Dos acciones en un solo endpoint (POST /api/paypal):
//   { action: 'create',  productId, qty, branch }  → crea la orden en PayPal
//   { action: 'capture', paypalOrderId }           → cobra y registra el pedido
//
// SEGURIDAD (esto maneja plata, así que nada se confía del cliente):
//   · El PRECIO sale de la base, nunca del navegador.
//   · El STOCK se valida antes de crear y otra vez al cobrar (en la RPC,
//     con la fila bloqueada, así no hay sobreventa).
//   · Se verifica que el monto cobrado coincida con el esperado.
//   · Si el cobro entra pero no hay stock, se REEMBOLSA automáticamente.
//   · Idempotente: reintentar el capture no descuenta stock dos veces.
//
// Config (env vars en Vercel):
//   PAYPAL_CLIENT_ID / PAYPAL_SECRET — credenciales de tu app PayPal
//   PAYPAL_ENV                      — 'sandbox' (pruebas) o 'live' (real)
//   PAYPAL_CURRENCY                 — default 'USD'
//   SUPABASE_URL / SUPABASE_SERVICE_KEY

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY
const CLIENT_ID    = process.env.PAYPAL_CLIENT_ID
const SECRET       = process.env.PAYPAL_SECRET
const CURRENCY     = process.env.PAYPAL_CURRENCY || 'USD'
const PP_BASE = (process.env.PAYPAL_ENV || 'sandbox') === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

const BRANCHES = { david: 'David', panama: 'Panamá', chitre: 'Chitré' }

// Precio efectivo: si hay OFERTA válida (sale_price > 0 y MENOR al normal)
// se cobra la oferta. Nunca se confía en lo que manda el navegador.
function effectivePrice(p) {
  const base = Number(p?.price) || 0
  const sale = Number(p?.sale_price) || 0
  return (base > 0 && sale > 0 && sale < base) ? sale : base
}
const QTY_COL  = { david: 'qty_david', panama: 'qty_panama', chitre: 'qty_chitre' }

async function ppToken() {
  const r = await fetch(`${PP_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error_description || 'PayPal auth falló')
  return d.access_token
}

async function sb(path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await r.text()
  const data = text ? JSON.parse(text) : null
  if (!r.ok) throw new Error(data?.message || `Supabase ${r.status}`)
  return data
}

/** Usuario logueado (opcional): valida el token del cliente contra Supabase */
async function userFromAuth(req) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: auth },
    })
    if (!r.ok) return null
    const u = await r.json()
    return u?.id ? u : null
  } catch { return null }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!CLIENT_ID || !SECRET) return res.status(503).json({ error: 'PayPal no está configurado' })
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(503).json({ error: 'Base de datos no configurada' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const { action } = body

  try {
    // ── 0) DIAGNÓSTICO ─────────────────────────────────────────────
    // Comprueba que SUPABASE_SERVICE_KEY sea de verdad la key secreta y no
    // la publicable. order_counter tiene REVOKE ALL para anon/authenticated,
    // así que solo el service_role puede leerla: si esto falla, la key está
    // mal y el checkout va a romper recién DESPUÉS de cobrarle al cliente.
    // Devuelve solo booleanos — ningún secreto sale de acá.
    if (action === 'diag') {
      let leeOrderCounter = false, detalle = null
      try {
        await sb('order_counter?select=n&limit=1')
        leeOrderCounter = true
      } catch (e) { detalle = (e?.message || '').slice(0, 200) }
      return res.status(200).json({
        paypal_configurado: true,          // si no, no habríamos llegado acá
        entorno_paypal: process.env.PAYPAL_ENV || 'sandbox',
        service_key_es_secreta: leeOrderCounter,
        detalle,
      })
    }

    // ── 1) CREAR ORDEN ─────────────────────────────────────────────
    if (action === 'create') {
      const qty = Math.floor(Number(body.qty) || 0)
      const branch = String(body.branch || '')
      if (qty < 1 || qty > 20)       return res.status(400).json({ error: 'Cantidad inválida' })
      if (!QTY_COL[branch])          return res.status(400).json({ error: 'Sucursal inválida' })

      const rows = await sb(`shop_products?id=eq.${encodeURIComponent(body.productId)}&select=id,name,price,sale_price,coming_soon,${QTY_COL[branch]}`)
      const p = rows?.[0]
      if (!p)                 return res.status(404).json({ error: 'Producto no encontrado' })
      if (p.coming_soon)      return res.status(400).json({ error: 'Los pre orders no se pagan online' })

      const price = effectivePrice(p)
      if (!price || price <= 0) return res.status(400).json({ error: 'Este producto no tiene precio publicado' })
      const stock = Number(p[QTY_COL[branch]] ?? 0)
      if (stock < qty)          return res.status(409).json({ error: `Solo quedan ${stock} en ${BRANCHES[branch]}` })

      const total = (price * qty).toFixed(2)
      const token = await ppToken()
      const r = await fetch(`${PP_BASE}/v2/checkout/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: {
              currency_code: CURRENCY,
              value: total,
              breakdown: { item_total: { currency_code: CURRENCY, value: total } },
            },
            items: [{
              name: String(p.name).slice(0, 127),
              quantity: String(qty),
              unit_amount: { currency_code: CURRENCY, value: price.toFixed(2) },
            }],
            description: `Retiro en ${BRANCHES[branch]}`,
            // Guardamos qué se compró: al cobrar leemos ESTO, no al cliente.
            custom_id: `${p.id}|${qty}|${branch}`,
          }],
          application_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' },
        }),
      })
      const d = await r.json()
      if (!r.ok) return res.status(502).json({ error: d.message || 'No se pudo crear la orden en PayPal' })
      return res.status(200).json({ id: d.id })
    }

    // ── 2) COBRAR + REGISTRAR ──────────────────────────────────────
    if (action === 'capture') {
      const paypalOrderId = String(body.paypalOrderId || '')
      if (!paypalOrderId) return res.status(400).json({ error: 'Falta la orden de PayPal' })

      const token = await ppToken()
      const r = await fetch(`${PP_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const cap = await r.json()
      // Si ya se había capturado, seguimos: la RPC es idempotente.
      const alreadyCaptured = cap?.details?.[0]?.issue === 'ORDER_ALREADY_CAPTURED'
      if (!r.ok && !alreadyCaptured) {
        return res.status(502).json({ error: cap.message || 'El cobro no se completó' })
      }

      // Releemos la orden desde PayPal: la fuente de verdad del monto real.
      const vr = await fetch(`${PP_BASE}/v2/checkout/orders/${paypalOrderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const ord = await vr.json()
      if (!vr.ok) return res.status(502).json({ error: 'No se pudo verificar el pago' })

      const unit    = ord?.purchase_units?.[0]
      const capture = unit?.payments?.captures?.[0]
      const capStatus = capture?.status

      // PENDING no es un fallo: PayPal ya tomó la plata pero la retiene un
      // rato (revisión de seguridad, eCheck, cuenta de vendedor nueva). Antes
      // se rechazaba acá y el cliente quedaba pagado, sin pedido y sin
      // reembolso — la plata se perdía en el limbo. Ahora se registra el
      // pedido como 'pending' y el equipo no entrega hasta que PayPal libere.
      const cobroTomado = capStatus === 'COMPLETED' || capStatus === 'PENDING'
      if (!cobroTomado) {
        // El status va en el mensaje: sin esto, diagnosticar un rechazo real
        // era adivinar (nos pasó con PENDING).
        return res.status(402).json({
          error: `El pago no quedó completado (estado: ${capStatus || 'sin captura'})`,
        })
      }

      const [productId, qtyStr, branch] = String(unit?.custom_id || '').split('|')
      const qty = Math.floor(Number(qtyStr) || 0)
      if (!productId || qty < 1 || !QTY_COL[branch]) {
        return res.status(400).json({ error: 'Orden inconsistente' })
      }

      const paidAmount = Number(capture.amount?.value || 0)
      const paidCurr   = capture.amount?.currency_code

      // El precio vuelve a salir de la base: si cambió o alguien manipuló el
      // monto, no despachamos.
      const rows = await sb(`shop_products?id=eq.${encodeURIComponent(productId)}&select=id,price,sale_price,coming_soon`)
      const p = rows?.[0]
      const expected = Number((effectivePrice(p) * qty).toFixed(2))
      const amountOk = p && !p.coming_soon && paidCurr === CURRENCY && Math.abs(paidAmount - expected) < 0.01

      const refund = async (reason) => {
        try {
          await fetch(`${PP_BASE}/v2/payments/captures/${capture.id}/refund`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ note_to_payer: reason.slice(0, 255) }),
          })
        } catch {}
      }

      if (!amountOk) {
        await refund('Monto no coincide — reembolso automático')
        return res.status(409).json({ error: 'El monto no coincide. Se reembolsó el pago.' })
      }

      const user  = await userFromAuth(req)
      const payer = ord?.payer

      // Descuenta stock + numera el pedido, todo atómico.
      let placed
      try {
        placed = await sb('rpc/place_paid_order', {
          method: 'POST',
          body: JSON.stringify({
            p_product_id: productId,
            p_qty: qty,
            p_branch: branch,
            p_total: paidAmount,
            p_paypal_order_id: paypalOrderId,
            p_user_id: user?.id ?? null,
            p_buyer_name: [payer?.name?.given_name, payer?.name?.surname].filter(Boolean).join(' ') || null,
            p_buyer_email: payer?.email_address ?? null,
            p_status: capStatus === 'PENDING' ? 'pending' : 'paid',
          }),
        })
      } catch (e) {
        // OJO: acá cae CUALQUIER error de la base, no solo el de stock.
        // Antes se reportaban todos como "se agotó el stock", lo que mandó a
        // buscar un problema de inventario cuando en realidad era de permisos.
        const msg = e?.message || ''
        const esFaltaDeStock = /stock/i.test(msg)

        // El reembolso va igual: el cobro entró y no hay pedido, así que el
        // cliente no puede quedar pagando. Lo que cambia es el diagnóstico.
        await refund(esFaltaDeStock
          ? 'Sin stock disponible — reembolso automático'
          : 'No se pudo registrar el pedido — reembolso automático')

        return res.status(409).json({
          error: esFaltaDeStock
            ? 'Se agotó el stock durante el pago. Se reembolsó tu dinero.'
            : 'No se pudo registrar tu pedido. Se reembolsó el pago, no te cobramos.',
          // El motivo real, para que el equipo no tenga que adivinar.
          detalle: msg.slice(0, 300),
        })
      }

      const order = Array.isArray(placed) ? placed[0] : placed
      return res.status(200).json({
        code: order?.code,
        branch: BRANCHES[branch],
        qty,
        total: paidAmount.toFixed(2),
        // El front avisa que PayPal todavía no liberó el pago, así el cliente
        // no se presenta a retirar antes de tiempo.
        pending: capStatus === 'PENDING',
      })
    }

    return res.status(400).json({ error: 'Acción desconocida' })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error inesperado' })
  }
}
