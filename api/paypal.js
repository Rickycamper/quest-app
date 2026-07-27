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
    // ── 1) CREAR ORDEN ─────────────────────────────────────────────
    if (action === 'create') {
      const qty = Math.floor(Number(body.qty) || 0)
      const branch = String(body.branch || '')
      if (qty < 1 || qty > 20)       return res.status(400).json({ error: 'Cantidad inválida' })
      if (!QTY_COL[branch])          return res.status(400).json({ error: 'Sucursal inválida' })

      const rows = await sb(`shop_products?id=eq.${encodeURIComponent(body.productId)}&select=id,name,price,coming_soon,${QTY_COL[branch]}`)
      const p = rows?.[0]
      if (!p)                 return res.status(404).json({ error: 'Producto no encontrado' })
      if (p.coming_soon)      return res.status(400).json({ error: 'Los pre orders no se pagan online' })

      const price = Number(p.price)
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
      if (capture?.status !== 'COMPLETED') {
        return res.status(402).json({ error: 'El pago no quedó completado' })
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
      const rows = await sb(`shop_products?id=eq.${encodeURIComponent(productId)}&select=id,price,coming_soon`)
      const p = rows?.[0]
      const expected = Number((Number(p?.price || 0) * qty).toFixed(2))
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
          }),
        })
      } catch (e) {
        // Se quedó sin stock entre el pago y el registro → devolvemos la plata.
        await refund('Sin stock disponible — reembolso automático')
        return res.status(409).json({ error: 'Se agotó el stock durante el pago. Se reembolsó tu dinero.' })
      }

      const order = Array.isArray(placed) ? placed[0] : placed
      return res.status(200).json({
        code: order?.code,
        branch: BRANCHES[branch],
        qty,
        total: paidAmount.toFixed(2),
      })
    }

    return res.status(400).json({ error: 'Acción desconocida' })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error inesperado' })
  }
}
