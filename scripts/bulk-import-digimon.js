#!/usr/bin/env node
// ─────────────────────────────────────────────
// QUEST — Bulk import Digimon cards al catálogo
// ─────────────────────────────────────────────
//
// Usage (local, una sola vez):
//   SUPABASE_SERVICE_KEY="eyJ..." node scripts/bulk-import-digimon.js
//
// Cómo obtener el service_role key:
//   1. https://supabase.com/dashboard/project/qattyrdmlbolocnzczos/settings/api
//   2. Copy → "service_role" key (NO la "anon" — esta tiene permisos elevados)
//   3. NO lo pongas en archivos. Solo en el env var del comando arriba.
//
// Qué hace:
//   - Fetcha el catálogo entero de digimoncard.io (~3k cartas) en una sola request
//   - Para cada carta: construye la URL de imagen oficial digimoncard.io
//   - Upsert a deck_cards en batches de 500 (rápido + tolerante a duplicates)
//   - Reporta progreso por consola
//
// Si una carta ya existe en deck_cards (game='Digimon' + code='BT1-001') se
// IGNORA via ON CONFLICT DO NOTHING. Nunca sobreescribe — si vos editaste
// una carta manualmente, tu edit se respeta.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// ── Config ─────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || readEnvFile('VITE_SUPABASE_URL')
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_KEY')
  console.error('   Corré con: SUPABASE_SERVICE_KEY="eyJ..." node scripts/bulk-import-digimon.js')
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

// ── Fetch + transform ──────────────────────────────────────────────
async function fetchDigimonCatalog() {
  console.log('📡 Fetcheando catálogo de digimoncard.io…')
  const r = await fetch('https://digimoncard.io/api-public/getAllCards.php', {
    redirect: 'follow',
  })
  if (!r.ok) throw new Error(`digimoncard.io HTTP ${r.status}`)
  const data = await r.json()
  if (!Array.isArray(data)) throw new Error('Response no es un array')
  console.log(`   ✓ ${data.length} cartas recibidas`)
  return data
}

function transformCard(raw) {
  // raw shape: { name, cardnumber }
  const code = (raw.cardnumber || '').toUpperCase().trim()
  if (!code) return null
  const [setCode, number] = code.split('-')
  return {
    game:        'Digimon',
    code,
    name:        raw.name || code,
    image_url:   `https://images.digimoncard.io/images/cards/${code}.jpg`,
    set_code:    setCode || null,
    card_number: number || null,
    verified:    true,        // viene del publisher oficial → confiable
  }
}

// ── Upsert en batches ──────────────────────────────────────────────
const BATCH = 500
async function bulkUpsert(cards) {
  let inserted = 0
  let skipped = 0
  for (let i = 0; i < cards.length; i += BATCH) {
    const chunk = cards.slice(i, i + BATCH)
    const { data, error } = await supabase
      .from('deck_cards')
      .upsert(chunk, {
        onConflict: 'game,code',
        ignoreDuplicates: true,        // no sobreescribe rows existentes
      })
      .select('id')
    if (error) {
      console.error(`   ✗ Batch ${i}-${i + chunk.length} failed:`, error.message)
      continue
    }
    inserted += data?.length ?? 0
    skipped  += chunk.length - (data?.length ?? 0)
    process.stdout.write(`\r   📥 ${i + chunk.length}/${cards.length}  (${inserted} nuevas, ${skipped} ya existían)   `)
  }
  console.log('')
  return { inserted, skipped }
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('🎴 Quest — Bulk import Digimon')
  console.log('─'.repeat(50))

  const raw = await fetchDigimonCatalog()
  const cards = raw.map(transformCard).filter(Boolean)
  // Dedupe por código (la API a veces tiene duplicates con suffix)
  const seen = new Set()
  const unique = cards.filter(c => {
    if (seen.has(c.code)) return false
    seen.add(c.code)
    return true
  })
  console.log(`   ✓ ${unique.length} cartas únicas listas para upsert`)
  if (unique.length !== cards.length) {
    console.log(`   ℹ ${cards.length - unique.length} duplicadas en la API filtradas`)
  }

  console.log('💾 Upserting a deck_cards…')
  const { inserted, skipped } = await bulkUpsert(unique)

  console.log('─'.repeat(50))
  console.log(`✅ Terminado: ${inserted} cartas nuevas, ${skipped} ya estaban en la DB`)
  console.log(`   Total catálogo Digimon: ${unique.length} cartas`)
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
