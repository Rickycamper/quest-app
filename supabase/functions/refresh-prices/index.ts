// ─────────────────────────────────────────────
// QUEST — Edge Function: refresh-prices
// MTG + Pokemon:                    daily (18:00 UTC) — Scryfall / pokemontcg.io (free)
// One Piece, Digimon, Gundam, Riftbound: 1st & 15th of month — JustTCG (1000 req/month)
//   Skips: cards with price = 0 (ask-price) and cards with no stock
// ─────────────────────────────────────────────
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const JUSTTCG_KEY = Deno.env.get('JUSTTCG_API_KEY') ?? ''
const DELAY_MS    = 150

function normalizeTcgPrice(raw: number): number {
  if (!raw || raw <= 0) return 0.25
  if (raw <= 0.25) return 0.25
  if (raw <= 0.74) return 0.75
  if (raw < 1.00)  return 1.00
  return Math.ceil(raw / 0.25) * 0.25
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  // Accept ?mode=onepiece or ?mode=mtgpokemon (default = mtgpokemon)
  const url  = new URL(req.url)
  const mode = url.searchParams.get('mode') ?? 'mtgpokemon'

  try {
    let singles: any[] = []

    if (mode === 'mtgpokemon') {
      // MTG (Scryfall) + Pokemon (pokemontcg.io) — no request limit, run daily
      const { data, error } = await supabase
        .from('shop_products')
        .select('id, sku, price, name')
        .eq('category', 'single')
        .or('sku.like.SCRYFALL-%,sku.like.PKMN-%')
      if (error) throw error
      singles = data ?? []

    } else if (mode === 'justtcg') {
      // One Piece, Digimon, Gundam, Riftbound via JustTCG
      // Skip: cards with price = 0 (ask-price) and out-of-stock cards
      const { data, error } = await supabase
        .from('shop_products')
        .select('id, sku, price, name, qty_david, qty_panama, qty_chitre')
        .eq('category', 'single')
        .like('sku', 'JUSTTCG-%')
        .gt('price', 0)  // skip ask-price cards
        .or('qty_david.gt.0,qty_panama.gt.0,qty_chitre.gt.0')  // only in-stock
      if (error) throw error
      singles = data ?? []
    }

    if (!singles.length) {
      return new Response(JSON.stringify({ message: 'No singles to update', updated: 0, mode }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let updated = 0, skipped = 0, errors = 0

    for (const product of singles) {
      try {
        let newPrice: number | null = null

        if (product.sku.startsWith('SCRYFALL-')) {
          const id = product.sku.replace('SCRYFALL-', '')
          const res = await fetch(`https://api.scryfall.com/cards/${id}`)
          if (res.ok) {
            const data = await res.json()
            newPrice = data.prices?.usd ? parseFloat(data.prices.usd) : null
          }

        } else if (product.sku.startsWith('PKMN-')) {
          const id = product.sku.replace('PKMN-', '')
          const res = await fetch(`https://api.pokemontcg.io/v2/cards/${id}?select=tcgplayer`)
          if (res.ok) {
            const data = await res.json()
            const prices = data.data?.tcgplayer?.prices
            const raw = prices?.normal?.market
              ?? prices?.holofoil?.market
              ?? prices?.['1stEditionHolofoil']?.market
              ?? null
            newPrice = raw ? parseFloat(raw) : null
          }

        } else if (product.sku.startsWith('JUSTTCG-') && JUSTTCG_KEY) {
          const id = product.sku.replace('JUSTTCG-', '')
          const res = await fetch(
            `https://api.justtcg.com/v1/cards/${id}`,
            { headers: { 'X-API-Key': JUSTTCG_KEY } }
          )
          if (res.ok) {
            const data = await res.json()
            const nmVariant = data.data?.variants?.find((v: any) => v.condition === 'NM') ?? data.data?.variants?.[0]
            newPrice = nmVariant?.price ? parseFloat(nmVariant.price) : null
          }
        }

        if (newPrice && Math.abs(normalizeTcgPrice(newPrice) - Number(product.price)) >= 0.01) {
          const finalPrice = normalizeTcgPrice(newPrice)
          await supabase
            .from('shop_products')
            .update({ price: finalPrice, updated_at: new Date().toISOString() })
            .eq('id', product.id)
          updated++
        } else {
          skipped++
        }

        await sleep(DELAY_MS)
      } catch {
        errors++
      }
    }

    const result = { message: 'Price refresh complete', mode, total: singles.length, updated, skipped, errors, timestamp: new Date().toISOString() }
    console.log(JSON.stringify(result))
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })

  } catch (e) {
    console.error('refresh-prices error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
