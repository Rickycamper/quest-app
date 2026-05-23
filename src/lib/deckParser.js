// ─────────────────────────────────────────────
// QUEST — Universal deck list parser
// ─────────────────────────────────────────────
// Acepta texto pegado de:
//   - egmanevents / onepiecetopdecks (One Piece, Gundam, Digimon, etc.)
//   - MTG Arena export
//   - Pokemon TCG Live export
//   - Limitless TCG / Moxfield / Archidekt plain text
//
// Heurística: split por líneas, regex per línea para extraer qty + code + name.
// Soporta múltiples formatos en la misma lista — útil cuando el copy/paste
// arrastra basura.
//
// Output:
//   {
//     main:      [{ qty, code, name }, ...],   // mainboard
//     sideboard: [{ qty, code, name }, ...],   // si el texto tenía "Sideboard:"
//     warnings:  ['line "blah" did not parse', ...],
//     game:      'One Piece' | 'MTG' | 'Pokemon' | 'Digimon' | 'Gundam' | null,
//   }

// Patrones de código por TCG — usados para detectar qué juego es el deck
// si el usuario no lo seleccionó explícitamente.
const CODE_PATTERNS = {
  'One Piece': /^(OP|ST|EB|PRB|P)[0-9A-Z]*-\d{3}[a-z]?$/i,
  'Digimon':   /^(BT|EX|ST|P|RB)[0-9]+(?:-\d{3})?$/i,
  'Gundam':    /^(GD|ST|EB)[0-9]+-\d{3}$/i,
  'Pokemon':   /^[A-Z]{2,4}-\d{1,3}$|^\d{1,3}\/\d{1,3}$/,
  // MTG no tiene un patrón de código tan estricto — se detecta por contexto
}

// Headers comunes que separan main / sideboard / etc.
const SECTION_HEADERS = {
  sideboard: /^(sideboard|side|sb)\s*:?\s*$/i,
  // Headers que ignoramos pero confirman que es un deck (Pokemon TCG Live, MTG Arena)
  ignore:    /^(deck|mainboard|main|pok[eé]mon|trainer|energy|maybeboard|commander)\s*[:\s]?\s*$|^\d+\s*cards?$/i,
}

// ── Línea-por-línea regex patterns ─────────────────────────────────
//
// Order matters: probamos del más específico al más genérico.
const LINE_PATTERNS = [
  // "4x OP01-001 Monkey D. Luffy"  (con espacio)
  // "4 OP01-001 Monkey D. Luffy"
  // "4xST22-015"                     (sin espacio — formato onepiecetopdeck)
  // "1xOP13-002"
  {
    re: /^(\d+)\s*x?\s*([A-Z]{2,5}[A-Z0-9]*[-\.]\d{1,4}[a-z]?)\s*(.*)$/i,
    extract: (m) => ({ qty: parseInt(m[1], 10), code: m[2].toUpperCase().replace('.', '-'), name: m[3]?.trim() || null }),
  },

  // MTG Arena format: "4 Lightning Bolt (M21) 162"
  // "4 Goblin Guide (XLN) 156"
  // → extraemos qty + name. Code computado como "M21-162".
  {
    re: /^(\d+)\s+(.+?)\s+\(([A-Z0-9]{2,5})\)\s+(\d+\w?)$/i,
    extract: (m) => ({
      qty: parseInt(m[1], 10),
      name: m[2].trim(),
      code: `${m[3].toUpperCase()}-${m[4].padStart(3, '0')}`,
    }),
  },

  // Pokemon TCG Live format: "4 Charizard ex OBF 125"
  // (no parentheses around set code)
  {
    re: /^(\d+)\s+(.+?)\s+([A-Z]{2,4})\s+(\d{1,3})$/,
    extract: (m) => ({
      qty: parseInt(m[1], 10),
      name: m[2].trim(),
      code: `${m[3].toUpperCase()}-${m[4].padStart(3, '0')}`,
    }),
  },

  // onepiecetopdecks export comprimido: "4nOP15-098a4nOP15-108a..."
  // Este formato lo manejamos como CASO ESPECIAL antes del split por líneas
  // (porque viene todo en un string sin newlines). Ver parseCompactOnePiece() abajo.

  // Fallback: solo qty + name (sin código). Útil para listas legacy.
  // "4 Lightning Bolt"
  // No lo aceptamos por ahora — sin código no podemos identificar la carta única.
]

/**
 * Decodifica el formato comprimido de onepiecetopdecks:
 * "4nOP15-098a4nOP15-108a4nOP05-106…"
 *   - `qty` n `code` separated by `a`
 * Si el input matchea ese patrón, lo expande a líneas legibles antes del
 * parseo normal.
 */
function expandCompactOnePiece(text) {
  // Heurística: si no contiene saltos de línea Y contiene varios "nXX##-###a"
  // entonces es el formato comprimido
  if (text.includes('\n')) return text
  const matches = text.match(/\d+n[A-Z0-9]+-\d+/gi)
  if (!matches || matches.length < 3) return text
  return matches
    .map(chunk => {
      const m = chunk.match(/^(\d+)n([A-Z0-9-]+)/i)
      return m ? `${m[1]} ${m[2].toUpperCase()}` : null
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * Detecta el TCG del deck mirando los códigos parseados.
 * Si la mayoría matchea el patrón de un juego, retorna ese juego.
 */
function detectGame(cards) {
  const counts = { 'One Piece': 0, 'Digimon': 0, 'Gundam': 0, 'Pokemon': 0, 'MTG': 0 }
  for (const c of cards) {
    for (const [game, pattern] of Object.entries(CODE_PATTERNS)) {
      if (pattern.test(c.code)) counts[game]++
    }
    // MTG: códigos suelen ser SET-### con set code de 3-4 chars
    if (/^[A-Z0-9]{2,5}-\d{1,4}$/.test(c.code) && !CODE_PATTERNS['One Piece'].test(c.code)) {
      counts['MTG']++
    }
  }
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a)
  // Solo confirmamos si hay un ganador claro (al menos 50% de los códigos)
  const [topGame, topCount] = sorted[0]
  if (topCount === 0) return null
  if (topCount / cards.length >= 0.5) return topGame
  return null
}

/**
 * Parse el texto completo a una estructura de deck.
 *
 * @param {string} raw  Texto pegado por el usuario
 * @param {string} [hintedGame]  Si el usuario seleccionó un TCG en el UI,
 *                               se usa como fallback si auto-detect falla.
 */
export function parseDeck(raw, hintedGame = null) {
  if (!raw || typeof raw !== 'string') {
    return { main: [], sideboard: [], warnings: ['No hay texto para parsear'], game: hintedGame ?? null }
  }

  // Expandir el formato comprimido de onepiecetopdecks (si aplica)
  const text = expandCompactOnePiece(raw)

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const main = []
  const sideboard = []
  const warnings = []
  let inSideboard = false

  for (const line of lines) {
    // Comentarios / headers que ignoramos
    if (line.startsWith('//') || line.startsWith('#')) continue

    if (SECTION_HEADERS.sideboard.test(line)) { inSideboard = true; continue }
    if (SECTION_HEADERS.ignore.test(line))    { continue }

    // Probar los patrones en orden
    let parsed = null
    for (const p of LINE_PATTERNS) {
      const m = line.match(p.re)
      if (m) { parsed = p.extract(m); break }
    }

    if (!parsed) {
      warnings.push(`No se pudo parsear: "${line.slice(0, 60)}"`)
      continue
    }
    if (parsed.qty < 1 || parsed.qty > 99) {
      warnings.push(`Cantidad inválida en "${line.slice(0, 60)}"`)
      continue
    }

    // Mergear duplicados (mismo código → sumar qty)
    const bucket = inSideboard ? sideboard : main
    const existing = bucket.find(c => c.code === parsed.code)
    if (existing) {
      existing.qty += parsed.qty
      if (!existing.name && parsed.name) existing.name = parsed.name
    } else {
      bucket.push({ qty: parsed.qty, code: parsed.code, name: parsed.name || null })
    }
  }

  const game = detectGame([...main, ...sideboard]) ?? hintedGame ?? null

  return { main, sideboard, warnings, game }
}

/**
 * Cuenta de cartas total (excluyendo sideboard).
 */
export function deckCardCount(deck) {
  return (deck.main ?? []).reduce((sum, c) => sum + c.qty, 0)
}
