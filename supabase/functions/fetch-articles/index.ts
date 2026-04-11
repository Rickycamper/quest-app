// fetch-articles — pulls from RSS feeds + TCGPlayer Infinite API
import { createClient } from 'npm:@supabase/supabase-js@2'

// ── RSS sources ───────────────────────────────────────────────────
const RSS_SOURCES = [
  { game: 'MTG',       name: 'MTGGoldfish',          url: 'https://www.mtggoldfish.com/feed' },
  { game: 'MTG',       name: 'EDHREC',               url: 'https://edhrec.com/articles/feed' },
  { game: 'MTG',       name: 'MTG Arena Zone',       url: 'https://mtgazone.com/feed/' },
  { game: 'One Piece', name: 'One Piece Top Decks',  url: 'https://onepiecetopdecks.com/feed/' },
]

// ── TCGPlayer Infinite API — correct lowercase game param values ───
const TCGPLAYER_GAMES = [
  { game: 'MTG',       tcgGame: 'magic' },
  { game: 'Pokemon',   tcgGame: 'pokemon' },
  { game: 'One Piece', tcgGame: 'one piece' },
  { game: 'Digimon',   tcgGame: 'digimon card game' },
  { game: 'Riftbound', tcgGame: 'riftbound' },
  { game: 'Gundam',    tcgGame: 'gundam card game' },
]

// ── RSS parser (RSS <item> + Atom <entry>) ────────────────────────
function extract(block: string, tag: string): string {
  const cdata = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))
  if (cdata) return cdata[1].trim()
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  if (plain) return plain[1].replace(/<[^>]+>/g, '').trim()
  return ''
}
function extractRaw(block: string, tag: string): string {
  const cdata = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))
  if (cdata) return cdata[1]
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return plain ? plain[1] : ''
}
function extractAttr(block: string, tag: string, attr: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]+${attr}="([^"]+)"`))
  return m ? m[1] : ''
}
// Extract first <img src="..."> from raw HTML (for description/content:encoded)
function extractImgSrc(html: string): string | null {
  const m = html.match(/<img[^>]+src="([^"]+)"/i)
  return m ? m[1] : null
}

function parseRSS(xml: string, game: string, sourceName: string) {
  const items: object[] = []
  const isAtom = xml.includes('<entry>')
  const tag = isAtom ? 'entry' : 'item'
  const blocks = [...xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g'))]

  for (const [, block] of blocks) {
    const title = extract(block, 'title')
    const url = isAtom
      ? (extractAttr(block, 'link', 'href') || extract(block, 'url'))
      : (extract(block, 'link') || extract(block, 'guid'))
    if (!title || !url || !url.startsWith('http')) continue

    // Try explicit media tags first, then fall back to <img> inside description/content
    const image =
      extractAttr(block, 'media:content', 'url') ||
      extractAttr(block, 'media:thumbnail', 'url') ||
      extractAttr(block, 'enclosure', 'url') ||
      extractImgSrc(extractRaw(block, 'content:encoded')) ||
      extractImgSrc(extractRaw(block, 'description')) ||
      null

    const pubRaw = isAtom
      ? (extract(block, 'published') || extract(block, 'updated'))
      : (extract(block, 'pubDate') || extract(block, 'dc:date'))

    items.push({
      game, source_name: sourceName, title, url, image_url: image,
      author: isAtom ? extract(block, 'name') : (extract(block, 'dc:creator') || null),
      published_at: pubRaw ? new Date(pubRaw).toISOString() : null,
    })
  }
  return items
}

// ── TCGPlayer Infinite API fetcher ────────────────────────────────
// The API sorts oldest-first by default and ignores sort params,
// so we fetch the total count first then offset to the last page.
async function fetchTCGPlayer(game: string, tcgGame: string) {
  const base = `https://infinite-api.tcgplayer.com/content/search?contentType=article&game=${encodeURIComponent(tcgGame)}`
  const headers = { 'Accept': 'application/json', 'User-Agent': 'QuestTCGApp/1.0' }

  // Step 1 — get total count
  const countRes = await fetch(`${base}&rows=1`, { headers, signal: AbortSignal.timeout(8000) })
  if (!countRes.ok) throw new Error(`HTTP ${countRes.status}`)
  const countData = await countRes.json()
  const total: number = countData.total ?? 0
  if (total === 0) return []

  // Step 2 — fetch the last 20 (newest)
  const offset = Math.max(0, total - 20)
  const res = await fetch(`${base}&rows=20&offset=${offset}`, { headers, signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const results: any[] = (data.result ?? []).reverse() // newest first

  return results
    .filter((r: any) => r.title && r.canonicalURL)
    .map((r: any) => ({
      game,
      source_name: 'TCGPlayer Infinite',
      title: r.title,
      url: `https://infinite.tcgplayer.com${r.canonicalURL}`,
      image_url: r.imageURL || null,
      author: r.authorName || null,
      published_at: r.date ? new Date(r.date).toISOString() : null,
    }))
}

Deno.serve(async (_req) => {
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const results: object[] = []

  // ── Purge articles fetched more than 48 h ago ─────────────────────
  // Uses created_at (our fetch time) not published_at — TCGPlayer articles
  // have old publication dates but are still fresh content for us.
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  await sb.from('tcg_articles').delete().lt('created_at', cutoff)

  // ── RSS sources ───────────────────────────────────────────────────
  for (const source of RSS_SOURCES) {
    try {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'QuestTCGApp/1.0' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) { results.push({ source: source.name, error: `HTTP ${res.status}` }); continue }
      const items = parseRSS(await res.text(), source.game, source.name)
      if (!items.length) { results.push({ source: source.name, count: 0 }); continue }
      // ignoreDuplicates: false → updates image_url and other fields on re-fetch
      const { error } = await sb.from('tcg_articles').upsert(items, { onConflict: 'url' })
      results.push({ source: source.name, count: items.length, error: error?.message ?? null })
    } catch (e) {
      results.push({ source: source.name, error: (e as Error).message })
    }
  }

  // ── TCGPlayer Infinite API ────────────────────────────────────────
  for (const { game, tcgGame } of TCGPLAYER_GAMES) {
    try {
      const items = await fetchTCGPlayer(game, tcgGame)
      if (!items.length) { results.push({ source: `TCGPlayer/${game}`, count: 0 }); continue }
      const { error } = await sb.from('tcg_articles').upsert(items, { onConflict: 'url' })
      results.push({ source: `TCGPlayer/${game}`, count: items.length, error: error?.message ?? null })
    } catch (e) {
      results.push({ source: `TCGPlayer/${game}`, error: (e as Error).message })
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
})
