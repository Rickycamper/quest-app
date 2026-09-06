// ─────────────────────────────────────────────
// ROLL PLAYER — Motor de reglas
// ─────────────────────────────────────────────
// Implementa las fórmulas de derived_rules.json. El personaje guarda SOLO
// elecciones y estado vivo; acá se cruza con el ruleset para sacar
// modificadores, CA, PV, salvaciones, destrezas y rasgos activos.

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
export const ABILITY_ES = { str: 'Fuerza', dex: 'Destreza', con: 'Constitución', int: 'Inteligencia', wis: 'Sabiduría', cha: 'Carisma' }
export const ABILITY_EN = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
const EN_TO_ID = Object.fromEntries(Object.entries(ABILITY_EN).map(([k, v]) => [v.toLowerCase(), k]))

// 5e estándar: qué habilidad usa cada destreza (core.skills no lo trae).
export const SKILL_ABILITY = {
  'acrobatics': 'dex', 'animal-handling': 'wis', 'arcana': 'int', 'athletics': 'str',
  'deception': 'cha', 'history': 'int', 'insight': 'wis', 'intimidation': 'cha',
  'investigation': 'int', 'medicine': 'wis', 'nature': 'int', 'perception': 'wis',
  'performance': 'cha', 'persuasion': 'cha', 'religion': 'int', 'sleight-of-hand': 'dex',
  'stealth': 'dex', 'survival': 'wis',
}

export const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
export const POINT_BUY_TOTAL = 27
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

// Algunos campos del manual vienen como array (párrafos) u objeto en vez de
// string. Esto los aplana a texto plano sin romper.
export function texto(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(texto).filter(Boolean).join('\n\n')
  if (typeof v === 'object') return texto(v.text ?? v.description ?? Object.values(v))
  return String(v)
}

export const mod = (score) => Math.floor(((Number(score) || 10) - 10) / 2)
export const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`)
export const skillId = (rs, name) => rs.skillsByName?.[String(name).toLowerCase()] ?? String(name).toLowerCase().replace(/\s+/g, '-')
export const abilityId = (name) => EN_TO_ID[String(name).toLowerCase()] ?? (ABILITIES.includes(name) ? name : null)

export const totalLevel = (c) => (c.classes ?? []).reduce((s, k) => s + (Number(k.level) || 0), 0) || Number(c.level) || 1

export function proficiencyBonus(rs, c) {
  const lvl = totalLevel(c)
  const row = (rs.core?.advancement ?? []).find(a => a.level === lvl)
  return row?.proficiencyBonus ?? (2 + Math.floor((lvl - 1) / 4))
}

export const primaryClass = (rs, c) => {
  const k = (c.classes ?? []).find(x => x.isPrimary) ?? (c.classes ?? [])[0]
  return k ? { entry: k, def: rs.byId.class[k.id] ?? null } : { entry: null, def: null }
}

// Puntuaciones finales: base + raza + subraza + ASI + feats. Tope 20.
export function finalScores(rs, c) {
  const out = {}
  const race = rs.byId.race[c.race?.id] ?? null
  const sub  = race?.subraces?.find(s => s.id === c.race?.subraceId) ?? null
  for (const a of ABILITIES) {
    let v = Number(c.abilityScores?.[a]) || 10
    if (race && !(sub?.replacesBaseAbilityScoreIncrease)) v += Number(race.abilityScoreIncrease?.[a]) || 0
    if (sub) v += Number(sub.abilityScoreIncrease?.[a]) || 0
    v += Number(c.race?.choices?.asi?.[a]) || 0
    for (const asi of (c.abilityScoreImprovements ?? [])) {
      if (asi.kind === 'abilityScore') v += Number(asi.increases?.[a]) || 0
    }
    for (const fid of (c.featIds ?? [])) {
      const f = rs.byId.feat[fid]
      const inc = f?.abilityScoreIncrease
      if (inc && !inc.choiceFrom) v += Number(inc[a]) || 0
      v += Number(c.featChoices?.[fid]?.[a]) || 0
    }
    out[a] = Math.min(20, v)
  }
  return out
}

export function hitDie(def) {
  const m = /d(\d+)/.exec(def?.hitDice ?? '')
  return m ? Number(m[1]) : 8
}

export function maxHp(rs, c, scores) {
  if (c.combatState?.maxHpOverride) return Number(c.combatState.maxHpOverride)
  const conMod = mod(scores.con)
  let hp = 0, first = true
  for (const k of (c.classes ?? [])) {
    const def = rs.byId.class[k.id]; const d = hitDie(def)
    for (let i = 0; i < (Number(k.level) || 0); i++) {
      hp += (first ? d : Math.floor(d / 2) + 1) + conMod
      first = false
    }
  }
  if (first) hp = 8 + conMod
  if ((c.featIds ?? []).includes('tough')) hp += 2 * totalLevel(c)
  return Math.max(1, hp)
}

// CA: el MAYOR entre 10+DES, armadura equipada y las Unarmored Defense.
export function armorClass(rs, c, scores) {
  const dex = mod(scores.dex)
  const opciones = [{ label: 'Sin armadura', value: 10 + dex }]
  let shield = 0
  for (const it of (c.equipment?.items ?? [])) {
    if (!it.equipped) continue
    const a = (rs.armor ?? []).find(x => x.armor === it.name || x.armor === it.refId)
    if (!a) continue
    if (/shield/i.test(a.category ?? '')) { shield += 2; continue }
    const f = String(a['armor-class-ac'] ?? '')
    const base = Number((/^\s*(\d+)/.exec(f) ?? [])[1]) || 10
    let v = base
    if (/dex/i.test(f)) {
      const cap = /max\s*(\d+)/i.exec(f)
      v += cap ? Math.min(dex, Number(cap[1])) : dex
    }
    opciones.push({ label: a.armor, value: v })
  }
  for (const k of (c.classes ?? [])) {
    const ud = (rs.derived_rules?.unarmoredDefense ?? []).find(u => u.classId === k.id)
    if (ud) {
      const parts = ud.formula.split('+').map(s => s.trim()).slice(1)
      const v = 10 + parts.reduce((s, p) => s + (ABILITIES.includes(p) ? mod(scores[p]) : 0), 0)
      opciones.push({ label: `Defensa sin armadura (${rs.byId.class[k.id]?.name ?? k.id})`, value: v })
    }
  }
  const soul = (c.haki?.advancements ?? []).some(a => /soul-armor/i.test(a.advancementId ?? ''))
  if (soul) opciones.push({ label: 'Soul Armor (Haki)', value: 13 + mod(scores.con) })
  const best = opciones.reduce((m, o) => (o.value > m.value ? o : m), opciones[0])
  return { value: best.value + shield, source: best.label + (shield ? ' + escudo' : ''), opciones }
}

export function savingThrows(rs, c, scores) {
  const pb = proficiencyBonus(rs, c)
  const { def } = primaryClass(rs, c)
  const prof = new Set([...(def?.proficiencies?.savingThrows ?? []).map(abilityId), ...(c.proficiencies?.savingThrowOverrides ?? [])])
  return Object.fromEntries(ABILITIES.map(a => [a, { value: mod(scores[a]) + (prof.has(a) ? pb : 0), proficient: prof.has(a) }]))
}

export function skills(rs, c, scores) {
  const pb = proficiencyBonus(rs, c)
  const prof = new Set(c.proficiencies?.skills ?? [])
  const exp  = new Set(c.proficiencies?.expertise ?? [])
  return (rs.core?.skills ?? []).map(s => {
    const ab = SKILL_ABILITY[s.id] ?? 'int'
    const value = mod(scores[ab]) + (prof.has(s.id) ? pb : 0) + (exp.has(s.id) ? pb : 0)
    return { id: s.id, name: s.name, ability: ab, value, proficient: prof.has(s.id), expertise: exp.has(s.id) }
  })
}

// Rasgos activos: raza, subraza, clase (nivel ≤ nivel de clase), subclase, trasfondo, feats
export function activeFeatures(rs, c) {
  const out = []
  const race = rs.byId.race[c.race?.id]
  for (const t of (race?.traits ?? [])) out.push({ source: race.name, name: t.name, text: t.text })
  const sub = race?.subraces?.find(s => s.id === c.race?.subraceId)
  for (const t of (sub?.traits ?? [])) out.push({ source: sub.name, name: t.name, text: t.text })
  for (const k of (c.classes ?? [])) {
    const def = rs.byId.class[k.id]; if (!def) continue
    for (const f of (def.features ?? [])) {
      if (f.level == null || f.level <= k.level) out.push({ source: def.name, name: f.name, level: f.level, text: f.text, options: f.options ?? [] })
    }
    const sc = def.subclasses?.find(s => s.id === k.subclassId)
    for (const f of (sc?.features ?? [])) {
      if (f.level == null || f.level <= k.level) out.push({ source: sc.name, name: f.name, level: f.level, text: f.text })
    }
  }
  const bg = rs.byId.background[c.backgroundId]
  if (bg?.feature) out.push({ source: bg.name, name: bg.feature.name, text: bg.feature.text })
  for (const fid of (c.featIds ?? [])) { const f = rs.byId.feat[fid]; if (f) out.push({ source: 'Feat', name: f.name, text: f.text }) }
  return out
}

// Nivel en el que una clase elige subclase = el menor nivel de sus features
export function subclassLevel(def) {
  const lv = (def?.subclasses ?? []).flatMap(s => (s.features ?? []).map(f => f.level)).filter(n => n != null)
  return lv.length ? Math.min(...lv) : 3
}
// Niveles con Ability Score Improvement según la tabla de progresión
export function asiLevels(def) {
  return (def?.progression ?? []).filter(r => (r.features ?? []).some(f => /ability score improvement/i.test(f))).map(r => r.level)
}
export function spellcastingAbility(def) {
  const txt = (def?.features ?? []).map(f => f.text + ' ' + (f.options ?? []).map(o => o.text).join(' ')).join(' ')
  // El manual lo dice de dos formas: "Wisdom is your spellcasting ability" o
  // "your spellcasting ability is Wisdom" (a veces con "for your priest spells").
  const m = /(Intelligence|Wisdom|Charisma|Constitution)\s+is\s+your\s+spellcasting\s+ability/i.exec(txt)
        || /spellcasting\s+ability\s+(?:for\s+your\s+[\w\s]+?\s+)?is\s+(Intelligence|Wisdom|Charisma|Constitution)/i.exec(txt)
        || /use\s+your\s+(Intelligence|Wisdom|Charisma|Constitution)\s+whenever\s+[^.]{0,60}?refers\s+to\s+your\s+spellcasting\s+ability/i.exec(txt)
  return m ? abilityId(m[1]) : null
}
export function progressionRow(def, level) {
  return (def?.progression ?? []).find(r => r.level === level) ?? null
}

// Todo junto, para la hoja
export function derive(rs, c) {
  const scores = finalScores(rs, c)
  const pb = proficiencyBonus(rs, c)
  const { def } = primaryClass(rs, c)
  const hp = maxHp(rs, c, scores)
  const ac = armorClass(rs, c, scores)
  const race = rs.byId.race[c.race?.id]
  const sub = race?.subraces?.find(s => s.id === c.race?.subraceId)
  const speed = { ...(race?.speed ?? { walk: 30 }), ...(sub?.speed ?? {}) }
  const sca = def ? spellcastingAbility(def) : null
  const haki = (rs.haki?.colors ?? []).map(col => ({
    id: col.id, name: col.name, ability: col.spellcastingAbility,
    dc: 8 + pb + mod(scores[col.spellcastingAbility] ?? 10),
    unlocked: (c.haki?.unlockedColors ?? []).includes(col.id),
  }))
  return {
    scores, mods: Object.fromEntries(ABILITIES.map(a => [a, mod(scores[a])])),
    level: totalLevel(c), pb, maxHp: hp,
    currentHp: c.combatState?.currentHp ?? hp,
    ac, speed, initiative: mod(scores.dex),
    saves: savingThrows(rs, c, scores),
    skills: skills(rs, c, scores),
    passivePerception: 10 + (skills(rs, c, scores).find(s => s.id === 'perception')?.value ?? 0),
    features: activeFeatures(rs, c),
    spell: sca ? { ability: sca, dc: 8 + pb + mod(scores[sca]), attack: pb + mod(scores[sca]) } : null,
    haki, carrying: (scores.str || 10) * 15,
    race, sub, primary: def,
  }
}

// Personaje nuevo, vacío pero válido según character.schema.json
export function newCharacter(rulesetId, rulesetVersion) {
  const now = new Date().toISOString()
  return {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
    schemaVersion: 1, rulesetId, rulesetVersion,
    name: '', level: 1, experiencePoints: 0, alignment: null, inspirationOrPrestige: 0,
    race: { id: null, subraceId: null, choices: {} },
    classes: [], backgroundId: null, crewRoleId: null,
    crew: { name: null, faction: null, bounty: null, dream: null },
    abilityScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    abilityScoreImprovements: [],
    proficiencies: { skills: [], expertise: [], tools: [], languages: [], savingThrowOverrides: [] },
    featIds: [], featChoices: {},
    haki: { unlockedColors: [], advancements: [] },
    devilFruit: null,
    equipment: { items: [], belly: 0, meito: [], dials: [] },
    combatState: { currentHp: null, temporaryHp: 0, maxHpOverride: null, hitDiceRemaining: {}, deathSaves: { successes: 0, failures: 0 }, conditions: [], exhaustion: 0, resources: {}, concentratingOn: null },
    spellcasting: { preparedSpellIds: [], knownSpellIds: [], slotsExpended: {} },
    roleplay: { personalityTraits: '', ideals: '', bonds: '', flaws: '', backstory: '', appearance: '', portraitUrl: null, age: null, height: null, weight: null },
    notes: '', createdAt: now, updatedAt: now,
  }
}

// Tirada "2d4 x ฿100,000"
export function rollWealth(expr) {
  const m = /(\d+)d(\d+)\s*x\s*฿?([\d,]+)/i.exec(expr ?? '')
  if (!m) return null
  const n = Number(m[1]), d = Number(m[2]), mult = Number(m[3].replace(/,/g, ''))
  let total = 0
  for (let i = 0; i < n; i++) total += 1 + Math.floor(Math.random() * d)
  return total * mult
}
export const fmtBelly = (n) => '฿' + (Number(n) || 0).toLocaleString('en-US')
