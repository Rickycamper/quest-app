// ─────────────────────────────────────────────
// QUEST — Parser de CSV de resultados de torneos
// ─────────────────────────────────────────────
// Los exports de Bandai TCG+, MTG Companion, Pokémon, etc. cambian de
// separador (coma / punto y coma / tab), de comillas y de nombres de
// columna. Acá se detecta todo eso y se ofrece un mapeo que el equipo
// confirma antes de importar. Sin librerías.

export function parseCsv(text) {
  const t = String(text ?? '').replace(/^﻿/, '')
  const first = t.split(/\r?\n/)[0] ?? ''
  const delim = [',', ';', '\t']
    .map(d => ({ d, n: first.split(d).length - 1 }))
    .sort((a, b) => b.n - a.n)[0].d

  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += c
    } else if (c === '"') q = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c === '\r') { /* nada */ }
    else cell += c
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row) }
  return rows.map(r => r.map(x => x.trim())).filter(r => r.some(x => x))
}

// Adivina qué columna es la posición y cuál el nombre. -1 = no encontrada.
export function detectColumns(header) {
  const h = (header ?? []).map(x => String(x).toLowerCase().trim())
  const find = (patterns) => {
    for (const re of patterns) { const i = h.findIndex(x => re.test(x)); if (i >= 0) return i }
    return -1
  }
  return {
    pos:  find([/^(rank|ranking|pos|posici[oó]n|puesto|place|placement|#|standing|lugar|final rank)$/, /rank|puesto|posici|place|lugar/]),
    name: find([/^(name|nombre|player|jugador|participante|player name|nombre del jugador|usuario|user|display name)$/, /nombre|jugador|player|name|user/]),
  }
}

// Convierte filas crudas en [{position, name}]. posCol === 'order' usa el
// orden de las filas (algunos exports vienen ordenados y sin columna de rank).
export function rowsToPlayers(rows, posCol, nameCol) {
  const out = []
  rows.forEach((r, i) => {
    const name = (r[nameCol] ?? '').trim()
    if (!name) return
    let position = i + 1
    if (posCol !== 'order') {
      const n = parseInt(String(r[posCol] ?? '').replace(/\D/g, ''), 10)
      if (n >= 1) position = n
    }
    out.push({ position, name })
  })
  return out
}
