// Vercel serverless function — fetches MTG retail price from Star City Games
// Called from ShopScreen:
//   GET /api/mtg-price?card=CARDNAME&foil=false&scryfall_id=<uuid>
//
// Strategy (in order):
//   1. If scryfall_id is provided → look up set + collector_number on
//      Scryfall (authoritative) and hit the SCG product page URL directly:
//        https://starcitygames.com/{slug}-sgl-mtg-{set}-{cn}-{enn|enf}/
//      This matches the exact variant the user picked — no search ambiguity.
//   2. Fallback: search SCG by card name, collect all {name, price}, filter
//      by name + foil match, prefer NM, pick the highest price.
//
// Set/foil encoding in SCG URL slug:
//   "enn" = English Non-Foil, "enf" = English Foil
//   e.g. Zombify (Shadows over Avacyn #036) non-foil:
//     /zombify-sgl-mtg-soa-036-enn/
//        foil:
//     /zombify-sgl-mtg-soa-036-enf/

const SCG_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
}

function slugify(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[''`]/g, '')           // strip apostrophes
    .replace(/[^a-z0-9]+/g, '-')      // non-alnum → hyphen
    .replace(/^-+|-+$/g, '')          // trim hyphens
}

// Extract a single price from a SCG product detail page. Product pages
// reliably expose JSON-LD or og:product meta. Returns number or null.
function extractPriceFromProductPage(html) {
  // JSON-LD first
  const ldBlocks = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  for (const block of ldBlocks) {
    try {
      const json = JSON.parse(block[1])
      const items = Array.isArray(json) ? json : [json]
      for (const item of items) {
        const offers = item.offers ?? item.Offers
        if (!offers) continue
        const offerList = Array.isArray(offers) ? offers : [offers]
        for (const offer of offerList) {
          const p = parseFloat(offer.price ?? offer.Price)
          if (p > 0) return p
        }
      }
    } catch { /* ignore */ }
  }
  // og:product / product:price:amount
  const m = html.match(/<meta[^>]+property="product:price:amount"[^>]+content="([\d.]+)"/i)
         || html.match(/content="([\d.]+)"[^>]+property="product:price:amount"/i)
         || html.match(/<meta[^>]+itemprop="price"[^>]+content="([\d.]+)"/i)
  if (m) {
    const p = parseFloat(m[1])
    if (p > 0) return p
  }
  // data-price fallback
  const dp = html.match(/data-product-price="([\d.]+)"/)
          || html.match(/data-price="([\d.]+)"/)
  if (dp) {
    const p = parseFloat(dp[1])
    if (p > 0) return p
  }
  return null
}

// Legacy search-based fallback (when we don't have set+cn, or the direct URL
// 404s). Same logic as before: collect candidates, filter by name+foil,
// prefer NM, pick highest.
async function fetchPriceBySearch(card, isFoil) {
  const normalize = (s) => (s || '').toString().toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const cardNorm = normalize(card)

  const url = `https://www.starcitygames.com/search/?search_query=${encodeURIComponent(card.trim())}&filter_by=single_card`
  const response = await fetch(url, { headers: SCG_HEADERS })
  if (!response.ok) throw new Error(`SCG search returned ${response.status}`)
  const html = await response.text()

  const candidates = []

  // JSON-LD
  const ldBlocks = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  for (const block of ldBlocks) {
    try {
      const json = JSON.parse(block[1])
      const items = Array.isArray(json) ? json : [json]
      for (const item of items) {
        const name = (item.name || item.Name || '').toString()
        const offers = item.offers ?? item.Offers
        if (!offers) continue
        const offerList = Array.isArray(offers) ? offers : [offers]
        for (const offer of offerList) {
          const p = parseFloat(offer.price ?? offer.Price)
          if (p > 0 && name) candidates.push({ name, price: p, src: 'ld' })
        }
      }
    } catch { /* ignore */ }
  }

  // Product card blocks in search results
  const blocks = html.split(/<a[^>]+href="[^"]*\/(?:product|cards?|search-products?)\/[^"]*"/i)
  for (let i = 1; i < blocks.length; i++) {
    const chunk = blocks[i].slice(0, 2500)
    const titleM =
         chunk.match(/title="([^"]{3,200})"/)
      || chunk.match(/alt="([^"]{3,200})"/)
      || chunk.match(/<(?:h[1-6]|span|div)[^>]*class="[^"]*(?:product-title|card-title|productName|name)[^"]*"[^>]*>\s*([^<]{3,200})\s*</i)
      || chunk.match(/>\s*([A-Z][^<$\n]{2,180})\s*<\/a>/)
    const priceM =
         chunk.match(/data-price="?([\d]+(?:\.\d{1,2})?)"?/)
      || chunk.match(/\$\s*([\d]+(?:\.\d{2}))/)
      || chunk.match(/"price"\s*:\s*"?([\d]+(?:\.\d{1,2})?)"?/)
    if (titleM && priceM) {
      const name = titleM[1].trim()
        .replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')
      const p = parseFloat(priceM[1])
      if (p > 0 && name) candidates.push({ name, price: p, src: 'block' })
    }
  }

  const foilish = /\bfoil\b|\(foil\)|\s-\s*foil|•\s*foil/i
  const sameName = (name) => {
    const n = normalize(name)
    const stripped = n
      .replace(/\bfoil\b/g, ' ')
      .replace(/\b(near mint|lightly played|moderately played|heavily played|damaged|nm|lp|mp|hp)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return stripped.includes(cardNorm) || cardNorm.includes(stripped)
  }

  const byName = candidates.filter(c => sameName(c.name))
  const byFoil = byName.filter(c => foilish.test(c.name) === isFoil)
  let pool = byFoil.length ? byFoil : (byName.length ? byName : candidates)

  const nm = pool.filter(c => /\b(nm|near\s*mint)\b/i.test(c.name))
  if (nm.length) pool = nm

  pool.sort((a, b) => b.price - a.price || a.name.length - b.name.length)

  return { price: pool[0]?.price ?? null, matched: pool[0]?.name ?? null, candidates }
}

const ALLOWED_ORIGINS = [
  'https://questpanama.com',
  'https://www.questpanama.com',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.VITE_APP_URL ?? null,
].filter(Boolean)

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const allowed = ALLOWED_ORIGINS.includes(origin)
    || /^https:\/\/quest-app[\w-]*\.vercel\.app$/.test(origin)
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0])
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Vary', 'Origin')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { card, foil, scryfall_id, debug } = req.query
  if (!card && !scryfall_id) return res.status(400).json({ price: null })

  const isFoil = foil === 'true'
  const wantDebug = debug === '1'

  let cardName = (card || '').trim()
  let scgSet = ''
  let scgCn = ''

  // Step 1: resolve authoritative set + collector_number via Scryfall
  if (scryfall_id) {
    try {
      const sr = await fetch(`https://api.scryfall.com/cards/${scryfall_id}`)
      if (sr.ok) {
        const sd = await sr.json()
        cardName = sd.name || cardName
        scgSet = (sd.set || '').toLowerCase()
        // SCG pads collector numbers to 3 digits (036, 241, etc.)
        const rawCn = (sd.collector_number || '').toString()
        // preserve letter suffixes (e.g. "50a", "★") — just pad the leading digits
        const digitMatch = rawCn.match(/^(\d+)(.*)$/)
        scgCn = digitMatch ? digitMatch[1].padStart(3, '0') + digitMatch[2] : rawCn
      }
    } catch { /* fall through to name search */ }
  }

  // Step 2: try direct SCG product page
  if (scgSet && scgCn && cardName) {
    const slug = slugify(cardName)
    const variant = isFoil ? 'enf' : 'enn'
    const directUrl = `https://starcitygames.com/${slug}-sgl-mtg-${scgSet}-${scgCn}-${variant}/`
    try {
      const r = await fetch(directUrl, { headers: SCG_HEADERS, redirect: 'follow' })
      if (r.ok) {
        const html = await r.text()
        const price = extractPriceFromProductPage(html)
        if (price) {
          const payload = { price, source: 'scg-direct', url: directUrl, foil: isFoil, matched: cardName }
          return res.json(payload)
        }
      }
      // If 404 and we asked for foil, try non-foil URL (and vice versa) as a
      // sanity fallback — some cards simply don't have one variant. We don't
      // switch the foil flag though; we just bail to search.
    } catch { /* fall through */ }
  }

  // Step 3: fallback to name-based search
  try {
    const { price, matched, candidates } = await fetchPriceBySearch(cardName, isFoil)
    const payload = price
      ? { price, source: 'scg-search', matched, foil: isFoil }
      : { price: null, source: null, foil: isFoil }
    if (wantDebug) payload.candidates = candidates.slice(0, 50)
    return res.json(payload)
  } catch (err) {
    return res.status(200).json({ price: null, source: null, error: err.message })
  }
}
