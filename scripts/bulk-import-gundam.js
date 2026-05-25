#!/usr/bin/env node
// ─────────────────────────────────────────────
// QUEST — Bulk import Gundam Card Game al catálogo
// ─────────────────────────────────────────────
//
// Gundam TCG (también de Bandai) no tiene API pública. Scrapeamos
// el cardlist oficial: https://www.gundam-gcg.com/en/cards/
// Funciona con ?package=PACKAGE_ID, devuelve HTML con <li class="cardItem">.
//
// Pipeline:
//   1. GET /en/cards/ → parse data-val="616XXX" para listar todos
//      los packages (sets)
//   2. Para cada package: GET /en/cards/?package=XXX
//      a. Parse cada <li class="cardItem"> con cheerio
//      b. Extrae: code (de detail.php?detailSearch=CODE), name (alt),
//         image (data-src)
//   3. Dedupe por code (variantes _p1, _p2 son separadas)
//   4. Upsert a deck_cards en batches de 500
//
// Polite scrape: 300ms entre packages. ~20 packages → ~1 min total.
//
// Imágenes apuntan a CDN de Bandai (gundam-gcg.com), que tiene
// CORP=same-site. El frontend ya las pasa por /api/img-proxy.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import * as cheerio from 'cheerio'

const SUPABASE_URL = process.env.SUPABASE_URL || readEnvFile('VITE_SUPABASE_URL')
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_KEY')
  console.error('   Corré con: SUPABASE_SERVICE_KEY="sb_secret_..." node scripts/bulk-import-gundam.js')
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

const BASE = 'https://www.gundam-gcg.com'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

// ── Step 1: descubrir todos los packages ───────────────────────────
async function discoverPackages() {
  console.log('📡 Descubriendo sets disponibles en Gundam Card Game…')
  const r = await fetch(`${BASE}/en/cards/`, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`cardlist HTTP ${r.status}`)
  const html = await r.text()
  const $ = cheerio.load(html)
  const seen = new Set()
  const packages = []
  $('.js-selectBtn-package').each((_, el) => {
    const id = ($(el).attr('data-val') || '').trim()
    if (!id || !/^\d+$/.test(id) || seen.has(id)) return
    seen.add(id)
    const label = $(el).text().trim().replace(/\s+/g, ' ')
    packages.push({ id, label })
  })
  console.log(`   ✓ ${packages.length} sets encontrados`)
  return packages
}

// ── Step 2: parsea las cartas de un package ────────────────────────
async function fetchPackage(packageId, label) {
  const r = await fetch(`${BASE}/en/cards/?package=${packageId}`, {
    headers: { 'User-Agent': UA },
  })
  if (!r.ok) {
    console.warn(`\n   ✗ Package ${label} (${packageId}) HTTP ${r.status}`)
    return []
  }
  const html = await r.text()
  const $ = cheerio.load(html)
  const cards = []
  $('li.cardItem').each((_, el) => {
    const $el = $(el)
    // detail.php?detailSearch=GD01-001 → code = GD01-001
    const detailSrc = $el.find('a').first().attr('data-src') || ''
    const m = detailSrc.match(/detailSearch=([^&"]+)/)
    if (!m) return
    const code = m[1].toUpperCase()
    const $img = $el.find('img').first()
    const dataSrc = $img.attr('data-src') || ''
    // ../images/cards/card/GD01-001.webp?260515 → /images/cards/card/GD01-001.webp
    const imgPath = dataSrc.replace(/^\.\.\//, '/').split('?')[0]
    const image_url = imgPath ? `${BASE}${imgPath}` : null
    const name = ($img.attr('alt') || code).trim()
    const [setCode, number] = code.split('-')
    cards.push({
      game:        'Gundam',
      code,
      name,
      image_url,
      set_code:    setCode || null,
      card_number: number || null,
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
  console.log('🎴 Quest — Bulk import Gundam Card Game (Bandai scrape)')
  console.log('─'.repeat(50))

  const packages = await discoverPackages()
  if (packages.length === 0) {
    throw new Error('No se encontraron packages — Bandai puede haber cambiado el HTML')
  }

  const allCards = []
  for (let i = 0; i < packages.length; i++) {
    const { id, label } = packages[i]
    const short = label.length > 50 ? label.slice(0, 47) + '…' : label
    process.stdout.write(`\r   [${i + 1}/${packages.length}] ${short}   `)
    const cards = await fetchPackage(id, label)
    allCards.push(...cards)
    if (i < packages.length - 1) await sleep(300)   // polite delay
  }
  console.log('')

  // Dedupe por code
  const seen = new Set()
  const unique = allCards.filter(c => {
    if (seen.has(c.code)) return false
    seen.add(c.code)
    return true
  })
  console.log(`   ✓ ${allCards.length} cartas scrapeadas, ${unique.length} únicas`)
  if (unique.length !== allCards.length) {
    console.log(`   ℹ ${allCards.length - unique.length} duplicadas filtradas (reprints)`)
  }

  console.log('💾 Upserting a deck_cards…')
  const { inserted, skipped } = await bulkUpsert(unique)

  console.log('─'.repeat(50))
  console.log(`✅ Terminado: ${inserted} cartas nuevas, ${skipped} ya estaban en la DB`)
  console.log(`   Total catálogo Gundam: ${unique.length} cartas`)
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
