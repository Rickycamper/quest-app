// ─────────────────────────────────────────────
// QUEST — Roll Player: personajes de rol (homebrew)
// ─────────────────────────────────────────────
// Lista de personajes → asistente de creación → hoja viva. Los rulesets
// (homebrews) viven en public/rulesets/; ver src/rollplayer/rulesets.js.
import { useEffect, useRef, useState } from 'react'
import { RULESETS, loadRuleset, getRulesetMeta } from '../rollplayer/rulesets'
import { listCharacters, saveCharacter, deleteCharacter, localList, sessionUserId, cloudSave, localDelete } from '../rollplayer/storage'
import { derive } from '../rollplayer/engine'
import CharacterWizard from './rollplayer/CharacterWizard'
import CharacterSheet from './rollplayer/CharacterSheet'
import RulesViewer from './rollplayer/RulesViewer'
import { Dices } from 'lucide-react'
import { C, FONT, card, label, btn } from './rollplayer/ui'

// Cada clase tinta su tarjeta, como los tiles del Q Hub tintan cada sección.
const CLASS_COLOR = {
  bruiser: '#FB923C', chemist: '#4ADE80', devilforged: '#A78BFA', hybrid: '#F472B6', marksman: '#FBBF24',
  'martial-artist': '#60A5FA', priest: '#FCD34D', rogue: '#9CA3AF', skald: '#F87171', tinkerer: '#34D399', warrior: '#FB7185',
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})` }

export default function RollPlayerScreen({ onClose }) {
  const [estado, setEstado] = useState(null)          // { mode, uid, items, local }
  const [rs, setRs] = useState(null)
  const [rsErr, setRsErr] = useState('')
  const [vista, setVista] = useState('lista')          // lista | nuevo | hoja
  const [actual, setActual] = useState(null)
  const [reglas, setReglas] = useState(false)
  const [saving, setSaving] = useState(false)
  const timer = useRef(null)

  const recargar = () => listCharacters().then(setEstado).catch(e => setEstado({ mode: 'local', items: localList(), error: e.message }))
  useEffect(() => { recargar() }, [])
  useEffect(() => { loadRuleset(RULESETS[0].id).then(setRs).catch(e => setRsErr(e.message)) }, [])

  // Guardado con debounce: cada cambio en la hoja persiste solo
  const onChange = (ch) => {
    setActual(ch); setSaving(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => { try { await saveCharacter(ch) } catch {} setSaving(false); recargar() }, 800)
  }
  const crear = async (ch) => { await saveCharacter(ch); setActual(ch); setVista('hoja'); recargar() }
  const borrar = async () => { if (!actual) return; await deleteCharacter(actual.id); setActual(null); setVista('lista'); recargar() }
  const subirLocales = async () => {
    const uid = await sessionUserId(); if (!uid) return
    for (const ch of localList()) { try { await cloudSave(ch, uid); localDelete(ch.id) } catch {} }
    recargar()
  }

  if (vista === 'nuevo' && rs) return <CharacterWizard rs={rs} onSave={crear} onClose={() => setVista('lista')} />
  if (vista === 'hoja' && rs && actual) return (
    <>
      <CharacterSheet rs={rs} ch={actual} saving={saving} onChange={onChange} onBack={() => { setVista('lista'); recargar() }} onDelete={borrar} onOpenRules={() => setReglas(true)} />
      {reglas && <RulesViewer rulesetId={actual.rulesetId} onClose={() => setReglas(false)} />}
    </>
  )

  const items = estado?.items ?? []
  return (
    <div style={{ fontFamily: FONT, padding: '14px 16px 40px' }}>
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: C.text }}>Tus personajes</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>Crea y lleva tu hoja de personaje de los homebrews de Quest. Puntos de vida, condiciones, Haki, fruta, equipo — todo en el celular, en la mesa.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={() => rs && setVista('nuevo')} disabled={!rs} style={btn('primary', { opacity: rs ? 1 : 0.5 })}>+ Nuevo personaje</button>
          <button onClick={() => setReglas(true)} disabled={!rs} style={btn('secondary')}>Leer el manual</button>
        </div>
        {rsErr && <div style={{ color: C.bad, fontSize: 12, marginTop: 8 }}>{rsErr}</div>}
      </div>

      {estado?.mode === 'local' && (
        <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 12, lineHeight: 1.5 }}>
          {estado.uid ? 'No se pudo leer la nube; mostrando lo guardado en este dispositivo.' : 'Sin sesión: tus personajes se guardan solo en este dispositivo. Inicia sesión para tenerlos en tu cuenta.'}
        </div>
      )}
      {estado?.mode === 'cloud' && (estado.local ?? []).length > 0 && (
        <button onClick={subirLocales} style={btn('secondary', { width: '100%', marginBottom: 12 })}>Subir {estado.local.length} personaje(s) de este dispositivo a tu cuenta</button>
      )}

      {estado && items.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Todavía no tienes personajes</div>
          <div style={{ fontSize: 12.5, color: C.dim, marginTop: 4 }}>Crea el primero en seis pasos.</div>
        </div>
      )}
      {items.map(ch => {
        const meta = getRulesetMeta(ch.rulesetId)
        const col = CLASS_COLOR[ch.classes?.[0]?.id] ?? C.acc
        let resumen = ''
        try { if (rs && ch.rulesetId === rs.meta.id) { const d = derive(rs, ch); resumen = `${d.race?.name ?? ''} · ${d.primary?.name ?? ''} ${d.level} · PV ${d.currentHp}/${d.maxHp} · CA ${d.ac.value}` } } catch {}
        return (
          <button key={ch.id} onClick={() => { setActual(ch); setVista('hoja') }} className="pressable" style={{
            ...card, width: '100%', minHeight: 72, textAlign: 'left', cursor: 'pointer', marginBottom: 10, fontFamily: FONT,
            display: 'flex', alignItems: 'center', gap: 12,
            background: rgba(col, 0.08), borderColor: rgba(col, 0.2),
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: rgba(col, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Dices size={22} color={col} strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: col, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name || 'Sin nombre'}</div>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{resumen || meta?.name}</div>
            </div>
            <span aria-hidden style={{ color: C.faint, fontSize: 18 }}>›</span>
          </button>
        )
      })}

      {reglas && rs && <RulesViewer rulesetId={rs.meta.id} onClose={() => setReglas(false)} />}
    </div>
  )
}
