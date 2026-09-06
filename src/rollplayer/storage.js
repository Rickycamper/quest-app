// ─────────────────────────────────────────────
// ROLL PLAYER — Guardado de personajes
// ─────────────────────────────────────────────
// Con sesión: tabla rp_characters (una fila por personaje, el personaje
// entero en `data` jsonb). Sin sesión: localStorage, para que cualquiera
// pueda probar; al iniciar sesión se pueden subir.
import { supabase } from '../lib/supabase'

const LS_KEY = 'rp_characters_v1'

export function localList() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
export function localSave(ch) {
  const all = localList().filter(x => x.id !== ch.id)
  all.unshift(ch)
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)) } catch {}
}
export function localDelete(id) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(localList().filter(x => x.id !== id))) } catch {}
}

export async function sessionUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

export async function cloudList() {
  const { data, error } = await supabase
    .from('rp_characters').select('id, data, updated_at').order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => ({ ...r.data, id: r.id, updatedAt: r.updated_at }))
}
export async function cloudSave(ch, ownerId) {
  const row = {
    id: ch.id, owner_id: ownerId, ruleset_id: ch.rulesetId, name: ch.name || 'Sin nombre',
    level: ch.level || 1, visibility: ch.visibility || 'private',
    data: { ...ch, ownerId }, updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('rp_characters').upsert(row, { onConflict: 'id' })
  if (error) throw error
}
export async function cloudDelete(id) {
  const { error } = await supabase.from('rp_characters').delete().eq('id', id)
  if (error) throw error
}

// API unificada
export async function listCharacters() {
  const uid = await sessionUserId()
  if (!uid) return { mode: 'local', uid: null, items: localList() }
  try { return { mode: 'cloud', uid, items: await cloudList(), local: localList() } }
  catch (e) { return { mode: 'local', uid, items: localList(), error: e.message } }
}
export async function saveCharacter(ch) {
  const uid = await sessionUserId()
  ch.updatedAt = new Date().toISOString()
  if (uid) { await cloudSave(ch, uid); localDelete(ch.id); return 'cloud' }
  localSave(ch); return 'local'
}
export async function deleteCharacter(id) {
  const uid = await sessionUserId()
  if (uid) { try { await cloudDelete(id) } catch {} }
  localDelete(id)
}
