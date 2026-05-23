// ─────────────────────────────────────────────
// QUEST — Card image fetcher
// ─────────────────────────────────────────────
// Para cada TCG con API pública (MTG → Scryfall, Pokemon → pokemontcg.io,
// Digimon → digimoncard.io) hacemos lookup por código y devolvemos
// image_url + metadata. Llamado desde hydrateDeckList cuando una carta
// del deck no tiene imagen guardada todavía.
//
// El RPC set_deck_card_image valida que la URL venga de un dominio
// trusted antes de escribirla al catálogo.

const SCRYFALL = 'https://api.scryfall.com'
const POKEMONTCG = 'https://api.pokemontcg.io/v2'

/**
 * Fetch image + metadata para una carta. Retorna `null` si:
 *   - El TCG no tiene API soportada (Gundam, One Piece, etc.)
 *   - El código no se pudo parsear
 *   - La API devolvió error o no encontró la carta
 *
 * @param {string} game   'MTG' | 'Pokemon' | 'Digimon' | etc.
 * @param {string} code   código tipo 'M21-162' | 'OBF-125' | 'BT1-010'
 * @param {string} [name] nombre opcional para fallback fuzzy search
 * @returns {Promise<{image_url, set_code, card_number, rarity, name} | null>}
 */
export async function fetchCardImage(game, code, name) {
  try {
    if (game === 'MTG')     return await fetchScryfall(code, name)
    if (game === 'Pokemon') return await fetchPokemonTCG(code, name)
    if (game === 'Digimon') return await fetchDigimonCard(code)
    return null
  } catch (e) {
    console.warn(`[cardImages] ${game} ${code} failed:`, e.message)
    return null
  }
}

// ── Scryfall (MTG) ─────────────────────────────────────────────────
// Endpoint: /cards/{set}/{collector_number}
// Image: data.image_uris.normal (~488×680)
async function fetchScryfall(code, name) {
  const m = code.match(/^([A-Z0-9]{2,5})-(\d+\w?)$/i)
  if (!m) {
    // Si el código no parsea como SET-### probamos por nombre
    if (!name) return null
    return await fetchScryfallByName(name)
  }
  const [, setCode, num] = m
  const cleanNum = num.replace(/^0+/, '') || '0'
  const r = await fetch(`${SCRYFALL}/cards/${setCode.toLowerCase()}/${cleanNum}`)
  if (!r.ok) {
    // Si 404, probamos por nombre como fallback
    if (r.status === 404 && name) return await fetchScryfallByName(name)
    return null
  }
  const d = await r.json()
  const img = d.image_uris?.normal || d.image_uris?.large || d.card_faces?.[0]?.image_uris?.normal
  if (!img) return null
  return {
    image_url:   img,
    set_code:    d.set?.toUpperCase() || setCode.toUpperCase(),
    card_number: d.collector_number || cleanNum,
    rarity:      d.rarity || null,
    name:        d.name || name || null,
  }
}

async function fetchScryfallByName(name) {
  if (!name) return null
  const url = `${SCRYFALL}/cards/named?fuzzy=${encodeURIComponent(name)}`
  const r = await fetch(url)
  if (!r.ok) return null
  const d = await r.json()
  const img = d.image_uris?.normal || d.image_uris?.large || d.card_faces?.[0]?.image_uris?.normal
  if (!img) return null
  return {
    image_url:   img,
    set_code:    d.set?.toUpperCase() || null,
    card_number: d.collector_number || null,
    rarity:      d.rarity || null,
    name:        d.name || name,
  }
}

// ── Pokemon TCG ────────────────────────────────────────────────────
// Endpoint: /cards?q=... (usa Lucene-like syntax)
// Image: data[0].images.large
async function fetchPokemonTCG(code, name) {
  const m = code.match(/^([A-Z]{2,5})-(\d+\w?)$/i)
  let query
  if (m) {
    const [, setCode, num] = m
    const cleanNum = num.replace(/^0+/, '') || '0'
    // ptcgoCode + number: ej. OBF-125 → set.ptcgoCode:OBF number:125
    query = `set.ptcgoCode:${setCode.toUpperCase()} number:${cleanNum}`
  } else if (name) {
    query = `name:"${name.replace(/"/g, '\\"')}"`
  } else {
    return null
  }
  const url = `${POKEMONTCG}/cards?q=${encodeURIComponent(query)}&pageSize=1`
  const r = await fetch(url)
  if (!r.ok) return null
  const d = await r.json()
  const card = d.data?.[0]
  if (!card) {
    // fallback por nombre
    if (m && name) {
      const fallback = `name:"${name.replace(/"/g, '\\"')}"`
      const r2 = await fetch(`${POKEMONTCG}/cards?q=${encodeURIComponent(fallback)}&pageSize=1`)
      if (!r2.ok) return null
      const d2 = await r2.json()
      const card2 = d2.data?.[0]
      if (!card2) return null
      return mapPokemonCard(card2)
    }
    return null
  }
  return mapPokemonCard(card)
}

function mapPokemonCard(card) {
  return {
    image_url:   card.images?.large || card.images?.small || null,
    set_code:    card.set?.ptcgoCode || card.set?.id?.toUpperCase() || null,
    card_number: card.number || null,
    rarity:      card.rarity || null,
    name:        card.name || null,
  }
}

// ── Digimon ────────────────────────────────────────────────────────
// Las imágenes oficiales del card game viven en digimoncard.io con un
// patrón estable: https://images.digimoncard.io/images/cards/{CODE}.jpg
//
// No hace falta API call — el código de la carta YA es la URL. Lo
// validamos con HEAD para no escribir URLs muertas al catálogo.
async function fetchDigimonCard(code) {
  if (!code) return null
  const upperCode = code.toUpperCase()
  const url = `https://images.digimoncard.io/images/cards/${upperCode}.jpg`
  try {
    const r = await fetch(url, { method: 'HEAD' })
    if (!r.ok) return null
    return { image_url: url, set_code: upperCode.split('-')[0], card_number: upperCode.split('-')[1] || null }
  } catch {
    // CORS HEAD a veces falla — confiamos en el URL y dejamos que el
    // browser maneje el 404 al renderizar el <img>
    return { image_url: url, set_code: upperCode.split('-')[0], card_number: upperCode.split('-')[1] || null }
  }
}
