// Vercel serverless function — fetches MTG retail price from Star City Games
// Called from ShopScreen: GET /api/mtg-price?card=CARDNAME&foil=false
// Runs server-side so no CORS issues fetching from starcitygames.com

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { card, foil } = req.query
  if (!card) return res.status(400).json({ price: null })

  const isFoil = foil === 'true'

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

    let price = null

    // Strategy 1: JSON-LD structured data  <script type="application/ld+json">
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
            if (p > 0) { price = p; break }
          }
          if (price) break
        }
      } catch { /* ignore bad JSON */ }
      if (price) break
    }

    // Strategy 2: meta property="product:price:amount"
    if (!price) {
      const m = html.match(/<meta[^>]+property="product:price:amount"[^>]+content="([\d.]+)"/i)
          || html.match(/content="([\d.]+)"[^>]+property="product:price:amount"/i)
      if (m) price = parseFloat(m[1])
    }

    // Strategy 3: data-price attribute (Magento/BigCommerce style)
    if (!price) {
      const m = html.match(/data-price="([\d.]+)"/)
      if (m) price = parseFloat(m[1])
    }

    // Strategy 4: look for price next to the card name in text
    if (!price) {
      const cardEsc = card.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const m = html.match(new RegExp(cardEsc + '[\\s\\S]{0,200}?\\$(\\d+\\.\\d{2})', 'i'))
          || html.match(/class="[^"]*price[^"]*"[^>]*>\s*\$?([\d.]+)/i)
      if (m) price = parseFloat(m[1])
    }

    if (price && price > 0) {
      return res.json({ price, source: 'scg' })
    }

    return res.json({ price: null, source: null })
  } catch (err) {
    return res.status(200).json({ price: null, source: null, error: err.message })
  }
}
