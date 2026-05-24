#!/usr/bin/env node
// ─────────────────────────────────────────────
// QUEST — Bulk import Pokemon TCG al catálogo
// ─────────────────────────────────────────────
//
// Usage (local, una sola vez):
//   SUPABASE_SERVICE_KEY="sb_secret_..." node scripts/bulk-import-pokemon.js
//
// Pipeline:
//   - Paginado de pokemontcg.io (250 cartas por página, ~80 pages para 20k cartas)
//   - Cada carta: { game: 'Pokemon', code: 'OBF-125', name, image_url, set_code, rarity }
//   - Upsert a deck_cards en batches con ON CONFLICT DO NOTHING
//   - Reporte de progreso por página
//
// Tiempo esperado: ~3-5 min para ~20k cartas.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const SUPABASE_URL = process.env.SUPABASE_URL || readEnvFile('VITE_SUPABASE_URL')
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_KEY')
  console.error('   Corré con: SUPABASE_SERVICE_KEY="sb_secret_..." node scripts/bulk-import-pokemon.js')
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

const API     = 'https://api.pokemontcg.io/v2/cards'
const FIELDS  = 'id,name,number,rarity,images,set'
const PAGE_SIZE = 250

async function fetchPage(page) {
  const url = `${API}?pageSize=${PAGE_SIZE}&page=${page}&select=${FIELDS}`
  // Rate-limit-friendly retries con backoff exponencial
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url)
    if (r.ok) return await r.json()
    if (r.status === 429 || r.status >= 500) {
      const wait = 500 * Math.pow(2, attempt)
      console.log(`   ⚠ HTTP ${r.status} on page ${page}, retrying en ${wait}ms…`)
      await new Promise(res => setTimeout(res, wait))
      continue
    }
    throw new Error(`pokemontcg.io HTTP ${r.status} on page ${page}`)
  }
  throw new Error(`pokemontcg.io: too many retries on page ${page}`)
}

function transformCard(raw) {
  if (!raw.id || !raw.name) return null
  // Preferimos ptcgoCode (lo que usa Pokemon TCG Live para export) sobre set.id
  const setCode = (raw.set?.ptcgoCode || raw.set?.id || '').toUpperCase()
  const number  = (raw.number || '').toString()
  if (!setCode || !number) return null
  const code = `${setCode}-${number}`.toUpperCase()
  return {
    game:        'Pokemon',
    code,
    name:        raw.name,
    image_url:   raw.images?.large || raw.images?.small || null,
    set_code:    setCode,
    card_number: number,
    rarity:      raw.rarity || null,
    verified:    true,
  }
}

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
      console.error(`   ✗ Batch failed:`, error.message)
      continue
    }
    inserted += data?.length ?? 0
    skipped  += chunk.length - (data?.length ?? 0)
  }
  return { inserted, skipped }
}

async function main() {
  console.log('🎴 Quest — Bulk import Pokemon TCG')
  console.log('─'.repeat(50))

  // Page 1 para obtener totalCount
  console.log('📡 Fetcheando primera página de pokemontcg.io…')
  const first = await fetchPage(1)
  const totalCount = first.totalCount
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  console.log(`   ✓ Total catálogo: ${totalCount} cartas (${totalPages} páginas)`)

  let totalInserted = 0
  let totalSkipped  = 0
  let totalIgnored  = 0
  const seen = new Set()

  // Procesar páginas en serie (más simple + amistoso con la API)
  for (let page = 1; page <= totalPages; page++) {
    const data = page === 1 ? first : await fetchPage(page)
    const transformed = (data.data || []).map(transformCard).filter(Boolean)
    // Dedupe por code dentro de esta sesión
    const unique = transformed.filter(c => {
      if (seen.has(c.code)) return false
      seen.add(c.code)
      return true
    })
    totalIgnored += transformed.length - unique.length
    if (unique.length === 0) continue

    const { inserted, skipped } = await bulkUpsert(unique)
    totalInserted += inserted
    totalSkipped  += skipped
    process.stdout.write(`\r   📥 Página ${page}/${totalPages} · ${totalInserted} nuevas · ${totalSkipped} ya existían   `)
  }

  console.log('')
  console.log('─'.repeat(50))
  console.log(`✅ Terminado: ${totalInserted} cartas nuevas, ${totalSkipped} ya estaban en la DB`)
  if (totalIgnored) console.log(`   ℹ ${totalIgnored} duplicates intra-API filtradas`)
  console.log(`   Total catálogo Pokemon: ${totalInserted + totalSkipped} cartas`)
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
