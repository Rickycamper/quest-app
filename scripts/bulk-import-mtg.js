#!/usr/bin/env node
// ─────────────────────────────────────────────
// QUEST — Bulk import MTG (Scryfall) al catálogo
// ─────────────────────────────────────────────
//
// Usage (local, una sola vez):
//   SUPABASE_SERVICE_KEY="sb_secret_..." node scripts/bulk-import-mtg.js
//
// Pipeline:
//   1. GET https://api.scryfall.com/bulk-data → encuentra "default_cards"
//      (una entry por cada printing único — ~85k cartas)
//   2. Download del JSON dump (~500MB) a /tmp/scryfall-default.json
//   3. Parse + transform a deck_cards shape
//   4. Upsert en batches de 500
//   5. Clean up temp file
//
// Tiempo esperado: ~10-15 min (la mayoría es el download del dump
// de 500MB y los upserts a Supabase).
//
// Memoria: pico ~1.5 GB durante el JSON.parse — usá una Mac/PC con
// 8 GB+ libre. Si te quedas corto, decime y armo una versión streaming
// que parsea línea por línea.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, createWriteStream, createReadStream, unlinkSync, statSync } from 'node:fs'
import { parser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/StreamArray.js'

const SUPABASE_URL = process.env.SUPABASE_URL || readEnvFile('VITE_SUPABASE_URL')
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_KEY')
  console.error('   Corré con: SUPABASE_SERVICE_KEY="sb_secret_..." node scripts/bulk-import-mtg.js')
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

const TMP_FILE = '/tmp/scryfall-default-cards.json'

// ── Step 1: encontrar el bulk data URL ──────────────────────────────
async function getBulkUrl() {
  console.log('📡 Consultando Scryfall bulk-data manifest…')
  const r = await fetch('https://api.scryfall.com/bulk-data')
  if (!r.ok) throw new Error(`bulk-data HTTP ${r.status}`)
  const d = await r.json()
  const def = (d.data || []).find(x => x.type === 'default_cards')
  if (!def) throw new Error('No se encontró default_cards en bulk-data')
  console.log(`   ✓ default_cards dump: ${(def.size / 1024 / 1024).toFixed(1)} MB`)
  console.log(`   ✓ Actualizado: ${new Date(def.updated_at).toLocaleString()}`)
  return def.download_uri
}

// ── Step 2: download a temp file con progress ──────────────────────
async function downloadTo(url, path) {
  console.log(`📥 Descargando dump → ${path}…`)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`download HTTP ${r.status}`)
  const total = parseInt(r.headers.get('content-length') || '0', 10)
  let received = 0
  const reader = r.body.getReader()
  const writeStream = createWriteStream(path)
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.length
    writeStream.write(value)
    if (total) {
      const pct = ((received / total) * 100).toFixed(1)
      process.stdout.write(`\r   ${(received / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB  (${pct}%)   `)
    }
  }
  writeStream.end()
  await new Promise(res => writeStream.on('close', res))
  console.log('')
  console.log(`   ✓ Download completo`)
}

// ── Step 3: transform una carta de Scryfall a deck_cards shape ──────
function transformCard(raw) {
  if (!raw?.set || !raw?.collector_number) return null
  // Skip tokens, art series, memorabilia — no son cards reales
  if (raw.layout === 'token' || raw.layout === 'art_series') return null
  const setCode = raw.set.toUpperCase()
  const number  = raw.collector_number.padStart(3, '0').toUpperCase()
  const code = `${setCode}-${number}`
  const img = raw.image_uris?.normal
    || raw.image_uris?.large
    || raw.card_faces?.[0]?.image_uris?.normal
    || null
  return {
    game:        'MTG',
    code,
    name:        raw.name || code,
    image_url:   img,
    set_code:    setCode,
    card_number: raw.collector_number,
    rarity:      raw.rarity || null,
    card_type:   raw.type_line || null,
    verified:    true,
  }
}

// ── Step 4: bulk upsert en batches ─────────────────────────────────
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
async function main() {
  console.log('🎴 Quest — Bulk import MTG (Scryfall)')
  console.log('─'.repeat(50))

  const bulkUrl = await getBulkUrl()
  await downloadTo(bulkUrl, TMP_FILE)

  const fileSize = statSync(TMP_FILE).size
  console.log(`📖 Parseando JSON via stream (${(fileSize / 1024 / 1024).toFixed(1)} MB)…`)
  console.log('   ℹ Modo streaming: no carga todo el archivo a memoria')

  // Stream-parse: leemos el array de Scryfall carta-por-carta, lo
  // transformamos y deduplicamos al vuelo. Mantenemos solo el resultado
  // final en memoria (~85k cartas livianas) en vez del JSON crudo (~1.5GB).
  const seen = new Set()
  const unique = []
  let totalRaw = 0
  let skipped = 0

  await new Promise((resolve, reject) => {
    const pipeline = createReadStream(TMP_FILE)
      .pipe(parser())
      .pipe(streamArray())

    pipeline.on('data', ({ value }) => {
      totalRaw++
      const card = transformCard(value)
      if (!card) { skipped++; return }
      if (seen.has(card.code)) { skipped++; return }
      seen.add(card.code)
      unique.push(card)
      if (totalRaw % 10000 === 0) {
        process.stdout.write(`\r   📖 Procesadas ${totalRaw} cartas · ${unique.length} únicas listas   `)
      }
    })
    pipeline.on('end', resolve)
    pipeline.on('error', reject)
  })

  console.log('')
  console.log(`   ✓ ${totalRaw} cartas en el dump`)
  console.log(`   ✓ ${unique.length} cartas únicas listas para upsert`)
  if (skipped > 0) {
    console.log(`   ℹ ${skipped} descartadas (tokens, art series o duplicadas)`)
  }

  console.log('💾 Upserting a deck_cards…')
  const { inserted, skipped } = await bulkUpsert(unique)

  // Limpieza del temp file
  try { unlinkSync(TMP_FILE) } catch {}

  console.log('─'.repeat(50))
  console.log(`✅ Terminado: ${inserted} cartas nuevas, ${skipped} ya estaban en la DB`)
  console.log(`   Total catálogo MTG: ${unique.length} cartas`)
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
