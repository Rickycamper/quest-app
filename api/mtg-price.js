// Vercel serverless function — fetches MTG retail price from Star City Games
// Called from ShopScreen: GET /api/mtg-price?card=CARDNAME&foil=false
// Runs server-side so no CORS issues fetching from starcitygames.com
//
// Filtering logic:
//   SCG search returns multiple variants (different sets, foil/non-foil, NM/LP/MP/HP).
//   We collect every {name, price} pair we can find, then filter by:
//     1. card name match (case-insensitive)
//     2. foil flag match (product name contains "foil" iff isFoil === true)
//     3. prefer NM-labeled variants
//   Finally we pick the highest price from that pool (NM regular is typically
//   the highest — damaged copies are cheaper).

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { card, foil, debug } = req.query
  if (!card) return res.status(400).json({ price: null })

  const isFoil = foil === 'true'
  const wantDebug = debug === '1'

  const normalize = (s) => (s || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const cardNorm = normalize(card)

  try {
    const query = encodeURIComponent(card.trim())
    const url = `https://www.starcitygames.com/search/?search_query=${query}&filter_by=single_card`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!response.ok) throw new Error(`SCG returned ${response.status}`)
    const html = await response.text()

    // ── Collect all candidates { name, price } ──────────────
    const candidates = []

    // A) JSON-LD product offers (present on product detail pages; sometimes on
    //    search pages too). Preferred source because names + prices are paired.
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
      } catch { /* ignore bad JSON */ }
    }

    // B) Product cards on the SCG search results page.
    //    Split on product-anchor boundaries and extract the title + price
    //    within each chunk. SCG product links match /product/... or /card/...
    //    Pattern is resilient to minor markup changes.
    const blocks = html.split(/<a[^>]+href="[^"]*\/(?:product|cards?|search-products?)\/[^"]*"/i)
    for (let i = 1; i < blocks.length; i++) {
      const chunk = blocks[i].slice(0, 2500) // cap chunk so we don't spill into the next product
      // Product title — try several common patterns
      const titleM =
           chunk.match(/title="([^"]{3,200})"/)
        || chunk.match(/alt="([^"]{3,200})"/)
        || chunk.match(/<(?:h[1-6]|span|div)[^>]*class="[^"]*(?:product-title|card-title|productName|name)[^"]*"[^>]*>\s*([^<]{3,200})\s*</i)
        || chunk.match(/>\s*([A-Z][^<$\n]{2,180})\s*<\/a>/)
      // Price in this chunk
      const priceM =
           chunk.match(/data-price="?([\d]+(?:\.\d{1,2})?)"?/)
        || chunk.match(/\$\s*([\d]+(?:\.\d{2}))/)
        || chunk.match(/"price"\s*:\s*"?([\d]+(?:\.\d{1,2})?)"?/)
      if (titleM && priceM) {
        const name = titleM[1].trim().replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')
        const p = parseFloat(priceM[1])
        if (p > 0 && name) candidates.push({ name, price: p, src: 'block' })
      }
    }

    // C) Meta tag fallback (only useful if SCG redirected to a single product page)
    if (!candidates.length) {
      const m = html.match(/<meta[^>]+property="product:price:amount"[^>]+content="([\d.]+)"/i)
             || html.match(/content="([\d.]+)"[^>]+property="product:price:amount"/i)
      if (m) {
        const titleM = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
        candidates.push({ name: titleM?.[1] || card, price: parseFloat(m[1]), src: 'meta' })
      }
    }

    // ── Filter: card name match + foil match ────────────────
    // A candidate "matches foil" if its name contains "foil" AND we want foil,
    // or its name does NOT contain "foil" AND we want non-foil.
    const foilish = /\bfoil\b|\(foil\)|\s-\s*foil|•\s*foil/i
    const sameName = (name) => {
      const n = normalize(name)
      // strip decorations like "(foil)", set names in parens/brackets, etc. for matching
      const stripped = n
        .replace(/\bfoil\b/g, ' ')
        .replace(/\b(near mint|lightly played|moderately played|heavily played|damaged|nm|lp|mp|hp)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      // treat as match if the stripped name contains the card name OR vice versa
      return stripped.includes(cardNorm) || cardNorm.includes(stripped)
    }

    const byName = candidates.filter(c => sameName(c.name))
    const byFoil = byName.filter(c => foilish.test(c.name) === isFoil)

    // Choose pool: foil-matched first, then any same-name, then any candidate
    let pool = byFoil.length ? byFoil : (byName.length ? byName : candidates)

    // Prefer NM-labeled variants within the pool (damaged copies are cheaper
    // than NM; SCG lists the standard retail at NM)
    const nm = pool.filter(c => /\b(nm|near\s*mint)\b/i.test(c.name))
    if (nm.length) pool = nm

    // Pick the highest price in the pool (NM regular is the "list" price).
    // Tiebreak by shortest name (usually the base printing without extra set labels).
    pool.sort((a, b) => b.price - a.price || a.name.length - b.name.length)

    const price = pool[0]?.price ?? null

    const payload = price && price > 0
      ? { price, source: 'scg', matched: pool[0].name, foil: isFoil }
      : { price: null, source: null, foil: isFoil }

    if (wantDebug) payload.candidates = candidates.slice(0, 50)
    return res.json(payload)
  } catch (err) {
    return res.status(200).json({ price: null, source: null, error: err.message })
  }
}
