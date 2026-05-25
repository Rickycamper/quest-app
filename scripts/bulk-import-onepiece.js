#!/usr/bin/env node
// ─────────────────────────────────────────────
// QUEST — Bulk import One Piece cards al catálogo
// ─────────────────────────────────────────────
//
// One Piece TCG no tiene API oficial. Scrapeamos el cardlist oficial
// de Bandai (en.onepiece-cardgame.com), que renderiza todas las cartas
// de un set en una sola página HTML.
//
// Pipeline:
//   1. GET /cardlist/ → parse el dropdown <select> para obtener todos
//      los series IDs (booster packs, starter decks, extras, premium…)
//   2. Para cada series ID:
//      a. GET /cardlist/?series=XXX
//      b. Parse cada <dl class="modalCol" id="CODE"> con cheerio
//      c. Extrae: code, name, image, rarity, type
//   3. Dedupe por code (las variantes _p1, _p2 se mantienen como cartas
//      separadas porque son arte alternativo).
//   4. Upsert a deck_cards en batches de 500
//
// Polite scraping: 300ms entre series para no martillar a Bandai.
// Tiempo total estimado: ~2 min para los ~60 sets.
//
// Las imágenes apuntan al CDN de Bandai (en.onepiece-cardgame.com).
// Como ese host tiene CORP=same-site, el frontend ya las pasa por
// /api/img-proxy automáticamente.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import * as cheerio from 'cheerio'

const SUPABASE_URL = process.env.SUPABASE_URL || readEnvFile('VITE_SUPABASE_URL')
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_KEY')
  console.error('   Corré con: SUPABASE_SERVICE_KEY="sb_secret_..." node scripts/bulk-import-onepiece.js')
  process.exit(1)
}

function readEnvFile(key) {
  try {
    const env = readFileSync('.env.local', 'utf-8')
    const m = env.match(new RegExp(`^${key}=[\"']?(.+?)[\"']?$`, 'm'))
    return m ? m[1] : null
  } catch { return null }
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

const BASE = 'https://en.onepiece-cardgame.com'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

// ── Step 1: descubrir todos los series IDs ─────────────────────────
async function discoverSeries() {
  console.log('📡 Descubriendo sets disponibles en Bandai…')
  const r = await fetch(`${BASE}/cardlist/`, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`cardlist HTTP ${r.status}`)
  const html = await r.text()
  const $ = cheerio.load(html)
  const series = []
  $('select[name="series"] option, #series option').each((_, el) => {
    const id = $(el).attr('value')
    if (!id || !/^\d+$/.test(id)) return
    // Limpia el label HTML (saca <br>, llaves, etc.)
    const label = $(el).text().trim().replace(/\s+/g, ' ')
    series.push({ id, label })
  })
  console.log(`   ✓ ${series.length} sets encontrados`)
  return series
}

// ── Step 2: parsea las cartas de un set ────────────────────────────
async function fetchSeries(seriesId, label) {
  const r = await fetch(`${BASE}/cardlist/?series=${seriesId}`, {
    headers: { 'User-Agent': UA },
  })
  if (!r.ok) {
    console.warn(`\n   ✗ Set ${label} (${seriesId}) HTTP ${r.status}`)
    return []
  }
  const html = await r.text()
  const $ = cheerio.load(html)
  const cards = []
  $('dl.modalCol').each((_, el) => {
    const $el = $(el)
    const code = ($el.attr('id') || '').trim().toUpperCase()
    if (!code) return
    // infoCol: <span>CODE</span> | <span>RARITY</span> | <span>TYPE</span>
    const spans = $el.find('.infoCol span').map((_, s) => $(s).text().trim()).get()
    const rarity   = spans[1] || null
    const cardType = spans[2] || null
    const name = $el.find('.cardName').first().text().trim() || code
    // Image: data-src="../images/cardlist/card/EB01-001.png?260518"
    const dataSrc = $el.find('.frontCol img').first().attr('data-src') || ''
    const imgPath = dataSrc.replace(/^\.\.\//, '/').split('?')[0]
    const image_url = imgPath ? `${BASE}${imgPath}` : null
    // setCode: parte antes del guion (EB01-001 → EB01, ST09-005 → ST09)
    const [setCode, number] = code.split('-')
    cards.push({
      game:        'One Piece',
      code,
      name,
      image_url,
      set_code:    setCode || null,
      card_number: number || null,
      rarity,
      card_type:   cardType,
      verified:    true,
    })
  })
  return cards
}

// ── Step 3: upsert en batches ──────────────────────────────────────
const BATCH = 500
async function bulkUpsert(cards) {
  let inserted = 0
  let skipped  = 0
  for (let i = 0; i < cards.length; i += BATCH) {
    const chunk = cards.slice(i, i + BATCH)
    const { data, error } = await supabase
      .from('deck_cards')
      .upsert(chunk, { onConflict: 'game,code', ignoreDuplicates: true })
      .select('id')
    if (error) {
      console.error(`\n   ✗ Batch ${i}-${i + chunk.length} failed:`, error.message)
      continue
    }
    inserted += data?.length ?? 0
    skipped  += chunk.length - (data?.length ?? 0)
    process.stdout.write(`\r   📥 ${i + chunk.length}/${cards.length} · ${inserted} nuevas · ${skipped} ya existían   `)
  }
  console.log('')
  return { inserted, skipped }
}

// ── Main ───────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  console.log('🎴 Quest — Bulk import One Piece (Bandai scrape)')
  console.log('─'.repeat(50))

  const series = await discoverSeries()
  if (series.length === 0) {
    throw new Error('No se encontraron sets — Bandai puede haber cambiado el HTML')
  }

  const allCards = []
  for (let i = 0; i < series.length; i++) {
    const { id, label } = series[i]
    const short = label.length > 50 ? label.slice(0, 47) + '…' : label
    process.stdout.write(`\r   [${i + 1}/${series.length}] ${short}   `)
    const cards = await fetchSeries(id, label)
    allCards.push(...cards)
    if (i < series.length - 1) await sleep(300)   // polite delay
  }
  console.log('')

  // Dedupe por code (un mismo CODE puede aparecer en varios sets como
  // reprint; nos quedamos con la primera ocurrencia)
  const seen = new Set()
  const unique = allCards.filter(c => {
    if (seen.has(c.code)) return false
    seen.add(c.code)
    return true
  })
  console.log(`   ✓ ${allCards.length} cartas scrapeadas, ${unique.length} únicas`)
  if (unique.length !== allCards.length) {
    console.log(`   ℹ ${allCards.length - unique.length} duplicadas filtradas (reprints entre sets)`)
  }

  console.log('💾 Upserting a deck_cards…')
  const { inserted, skipped } = await bulkUpsert(unique)

  console.log('─'.repeat(50))
  console.log(`✅ Terminado: ${inserted} cartas nuevas, ${skipped} ya estaban en la DB`)
  console.log(`   Total catálogo One Piece: ${unique.length} cartas`)
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
