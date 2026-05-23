// Vercel serverless — proxy de imágenes de cartas.
//
// Algunos publishers (Bandai → Gundam, One Piece) sirven con header
// `Cross-Origin-Resource-Policy: same-site`, que el browser respeta y
// bloquea el render del <img> en nuestro dominio. La solución estándar
// es traer la imagen desde nuestro server (sin restricción CORP) y
// re-servirla con headers permisivos.
//
// GET /api/img-proxy?url=<encoded-bandai-url>
//
// Seguridad: solo proxiamos URLs de dominios trusted (whitelist).
// Cache: 30 días en el CDN de Vercel — las cartas no cambian.

const ALLOWED_HOSTS = new Set([
  'en.onepiece-cardgame.com',
  'asia-en.onepiece-cardgame.com',
  'www.gundam-gcg.com',
  'gundam-gcg.com',
  'en.gundam-gcg.com',
])

export default async function handler(req, res) {
  const target = req.query.url
  if (!target || typeof target !== 'string') {
    return res.status(400).send('missing url')
  }

  let parsed
  try {
    parsed = new URL(target)
  } catch {
    return res.status(400).send('invalid url')
  }
  if (parsed.protocol !== 'https:') {
    return res.status(400).send('https only')
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return res.status(403).send('host not allowed')
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      // Spoof a regular browser request — Bandai a veces filtra requests sin Accept
      headers: {
        'Accept': 'image/png,image/jpeg,image/webp,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (questhobbystore.com img-proxy)',
      },
    })
    if (!upstream.ok) {
      return res.status(upstream.status).send(`upstream ${upstream.status}`)
    }
    const contentType = upstream.headers.get('content-type') || 'image/png'
    const buf = Buffer.from(await upstream.arrayBuffer())

    res.setHeader('Content-Type', contentType)
    // Cache agresivo — los publishers no cambian sus URLs de cartas
    res.setHeader('Cache-Control', 'public, s-maxage=2592000, max-age=86400, immutable')
    // Permisivo CORP/CORS para que cualquier subdomain nuestro pueda usar
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).send(buf)
  } catch (e) {
    return res.status(502).send(`proxy error: ${e.message}`)
  }
}
