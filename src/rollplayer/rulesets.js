// ─────────────────────────────────────────────
// ROLL PLAYER — Rulesets (homebrews) disponibles
// ─────────────────────────────────────────────
// Cada ruleset es una carpeta de JSON en public/rulesets/<id>/ con el formato
// que describe public/rulesets/one-piece-ddf/README.md. Nada del motor está
// cableado a One Piece: agregar otro homebrew es agregar una carpeta y una
// entrada acá.
export const RULESETS = [
  {
    id: 'one-piece-ddf',
    name: 'Dungeons and Devil Fruits',
    subtitle: 'One Piece · Player\'s Handbook (D&D 5e homebrew)',
    author: 'oneworldhd',
    version: '3.0.0',
    base: '/rulesets/one-piece-ddf/',
    emoji: '🏴‍☠️',
  },
]

// Archivos que forman el "motor" (lo que el asistente y la hoja consumen).
// reference.json (1.3 MB) NO va acá: se carga aparte cuando se abre el visor.
const ENGINE_FILES = [
  'core', 'races', 'classes', 'backgrounds', 'feats', 'haki', 'devil_fruits',
  'devil_fruit_catalog', 'weapons', 'armor', 'gear', 'crew_roles',
  'character_dreams', 'spell_lists', 'custom_spells', 'derived_rules',
  'wealth_and_expenses', 'multiclassing', 'crew_meta', 'special_equipment',
]

const cache = new Map()
const refCache = new Map()

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'force-cache' })
  if (!r.ok) throw new Error(`No se pudo cargar ${url} (${r.status})`)
  return r.json()
}

export function getRulesetMeta(id) {
  return RULESETS.find(r => r.id === id) ?? null
}

export async function loadRuleset(id) {
  if (cache.has(id)) return cache.get(id)
  const meta = getRulesetMeta(id)
  if (!meta) throw new Error(`Ruleset desconocido: ${id}`)
  const p = (async () => {
    const parts = await Promise.all(ENGINE_FILES.map(f => fetchJson(meta.base + f + '.json').catch(() => null)))
    const rs = { meta }
    ENGINE_FILES.forEach((f, i) => { rs[f] = parts[i] })
    // Índices útiles
    rs.byId = {
      race:       Object.fromEntries((rs.races ?? []).map(r => [r.id, r])),
      class:      Object.fromEntries((rs.classes ?? []).map(c => [c.id, c])),
      background: Object.fromEntries((rs.backgrounds ?? []).map(b => [b.id, b])),
      feat:       Object.fromEntries((rs.feats ?? []).map(f => [f.id, f])),
      crewRole:   Object.fromEntries((rs.crew_roles ?? []).map(c => [c.id, c])),
    }
    rs.skillsByName = Object.fromEntries((rs.core?.skills ?? []).map(s => [s.name.toLowerCase(), s.id]))
    rs.skillsById   = Object.fromEntries((rs.core?.skills ?? []).map(s => [s.id, s]))
    return rs
  })()
  cache.set(id, p)
  return p
}

export async function loadReference(id) {
  if (refCache.has(id)) return refCache.get(id)
  const meta = getRulesetMeta(id)
  const p = fetchJson(meta.base + 'reference.json')
  refCache.set(id, p)
  return p
}
