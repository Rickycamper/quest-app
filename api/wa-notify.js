// Vercel serverless — Notificaciones de WhatsApp para envíos.
//
// La base de datos (triggers pg_net) llama a este endpoint cuando:
//   - se crea un envío           → body { event: 'created',  package_id }
//   - el paquete llega a sucursal → body { event: 'arrived',  package_id }
//
// Esta función busca el teléfono del destinatario (service role, así ve el
// PII) y le manda la plantilla de WhatsApp vía la Cloud API oficial de Meta.
//
// Config (env vars en Vercel):
//   WA_TOKEN            — token permanente de la WhatsApp Cloud API
//   WA_PHONE_ID         — Phone Number ID de tu WhatsApp Business
//   WA_TEMPLATE_CREATED — nombre de la plantilla "envío creado"
//   WA_TEMPLATE_ARRIVED — nombre de la plantilla "llegó a sucursal"
//   WA_LANG             — código de idioma de las plantillas (default 'es')
//   WA_WEBHOOK_SECRET   — secreto compartido con el trigger de la DB
//   SUPABASE_URL / SUPABASE_SERVICE_KEY — para leer el paquete + teléfono
//
// Si falta config, responde 200 sin hacer nada (no rompe el trigger).

const SUPABASE_URL  = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY
const WA_TOKEN      = process.env.WA_TOKEN
const WA_PHONE_ID   = process.env.WA_PHONE_ID
const WA_LANG       = process.env.WA_LANG || 'es'
const WA_SECRET     = process.env.WA_WEBHOOK_SECRET
const TEMPLATES = {
  created: process.env.WA_TEMPLATE_CREATED,
  arrived: process.env.WA_TEMPLATE_ARRIVED,
}

const BRANCH_LABEL = { david: 'David', panama: 'Panamá', chitre: 'Chitré' }
function branchLabel(b) {
  if (!b) return 'la sucursal'
  return BRANCH_LABEL[String(b).toLowerCase()] || b
}

// Normaliza a formato WhatsApp: solo dígitos, con código de país.
// Panamá = 507. Si ya trae código de país (>= 10 dígitos) se respeta.
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (!d) return null
  d = d.replace(/^0+/, '')            // saca ceros iniciales
  if (d.length <= 8) d = '507' + d    // número local panameño → +507
  return d
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  // Verificación del secreto compartido con el trigger de la base.
  if (WA_SECRET && req.headers['x-wa-secret'] !== WA_SECRET) {
    return res.status(401).json({ error: 'bad secret' })
  }

  // Body (pg_net manda JSON; Vercel lo parsea a req.body)
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const event = body?.event
  const packageId = body?.package_id
  if (!event || !packageId || !TEMPLATES[event]) {
    return res.status(200).json({ ok: false, reason: 'invalid event or template not set' })
  }

  // Config incompleta → no-op silencioso (no rompe el trigger)
  if (!SUPABASE_URL || !SERVICE_KEY || !WA_TOKEN || !WA_PHONE_ID) {
    return res.status(200).json({ ok: false, reason: 'wa not configured' })
  }

  try {
    // 1) Traer el paquete + destinatario (service role bypassa RLS/PII)
    const url = `${SUPABASE_URL}/rest/v1/packages?id=eq.${encodeURIComponent(packageId)}`
      + `&select=tracking_code,destination_branch,recipient:recipient_id(username,full_name,phone)`
    const r = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    })
    if (!r.ok) return res.status(200).json({ ok: false, reason: `supabase ${r.status}` })
    const rows = await r.json()
    const pkg = Array.isArray(rows) ? rows[0] : null
    if (!pkg) return res.status(200).json({ ok: false, reason: 'package not found' })

    const rec = pkg.recipient || {}
    const phone = normalizePhone(rec.phone)
    if (!phone) return res.status(200).json({ ok: false, reason: 'recipient has no phone' })

    const name    = (rec.full_name || rec.username || 'Cliente').trim()
    const tracking = pkg.tracking_code || '—'
    const branch   = branchLabel(pkg.destination_branch)

    // 2) Mandar la plantilla de WhatsApp
    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: TEMPLATES[event],
        language: { code: WA_LANG },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: name },
            { type: 'text', text: tracking },
            { type: 'text', text: branch },
          ],
        }],
      },
    }

    const waRes = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const waJson = await waRes.json().catch(() => ({}))
    if (!waRes.ok) {
      console.error('[wa-notify] WhatsApp API error', waRes.status, JSON.stringify(waJson))
      return res.status(200).json({ ok: false, reason: 'whatsapp api error', detail: waJson?.error?.message })
    }

    return res.status(200).json({ ok: true, event, to: phone, id: waJson?.messages?.[0]?.id })
  } catch (e) {
    console.error('[wa-notify] error', e?.message)
    return res.status(200).json({ ok: false, reason: e?.message || 'error' })
  }
}
