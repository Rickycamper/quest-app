// ─────────────────────────────────────────────
// QUEST — Edge Function: refresh-prices
// Runs daily at 1 PM (Panama time = UTC-5 → 18:00 UTC)
// Updates TCGPlayer prices for all MTG and Pokemon singles
// ─────────────────────────────────────────────
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const DELAY_MS   = 150  // delay between requests to avoid rate limiting
const MIN_PRICE  = 0.25

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

Deno.serve(async (req) => {
  // Allow manual trigger via POST (for testing)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    // 1. Fetch all MTG and Pokemon singles
    const { data: singles, error } = await supabase
      .from('shop_products')
      .select('id, sku, price, name')
      .eq('category', 'single')
      .or('sku.like.SCRYFALL-%,sku.like.PKMN-%')

    if (error) throw error
    if (!singles?.length) {
      return new Response(JSON.stringify({ message: 'No singles to update', updated: 0 }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let updated = 0, skipped = 0, errors = 0

    for (const product of singles) {
      try {
        let newPrice: number | null = null

        if (product.sku.startsWith('SCRYFALL-')) {
          // MTG via Scryfall
          const id = product.sku.replace('SCRYFALL-', '')
          const res = await fetch(`https://api.scryfall.com/cards/${id}`)
          if (res.ok) {
            const data = await res.json()
            newPrice = data.prices?.usd ? parseFloat(data.prices.usd) : null
          }
        } else if (product.sku.startsWith('PKMN-')) {
          // Pokemon via pokemontcg.io
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
        }

        if (newPrice && Math.abs(newPrice - Number(product.price)) >= 0.01) {
          const finalPrice = Math.max(MIN_PRICE, newPrice)
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

    const result = {
      message: 'Price refresh complete',
      total: singles.length,
      updated,
      skipped,
      errors,
      timestamp: new Date().toISOString(),
    }

    console.log(JSON.stringify(result))
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (e) {
    console.error('refresh-prices error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
