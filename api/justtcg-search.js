// Vercel serverless — proxies JustTCG card search so the API key stays server-side
// GET /api/justtcg-search?q=CARDNAME&game=GAMEID

const ALLOWED_ORIGINS = [
  'https://questpanama.com',
  'https://www.questpanama.com',
].filter(Boolean)

const RATE = new Map() // ip:minute → count

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/quest-app[\w-]*\.vercel\.app$/.test(origin)
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0])
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Vary', 'Origin')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Per-IP rate limit: 30 req/min
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? 'unknown'
  const bucket = `${ip}:${Math.floor(Date.now() / 60000)}`
  const count = (RATE.get(bucket) ?? 0) + 1
  RATE.set(bucket, count)
  if (RATE.size > 5000) RATE.clear() // prevent memory leak
  if (count > 30) return res.status(429).json({ error: 'Too many requests' })

  const { q, game } = req.query
  if (!q || !game) return res.status(400).json({ error: 'Missing q or game' })

  const apiKey = process.env.JUSTTCG_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  try {
    const upstream = await fetch(
      `https://api.justtcg.com/v1/cards?q=${encodeURIComponent(q.trim())}&game=${encodeURIComponent(game)}&condition=NM`,
      { headers: { 'X-API-Key': apiKey } }
    )
    const data = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch (err) {
    return res.status(502).json({ error: err.message })
  }
}
