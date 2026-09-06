// ─────────────────────────────────────────────
// ROLL PLAYER — Asistente de creación de personaje
// ─────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { RULESETS } from '../../rollplayer/rulesets'
import {
  ABILITIES, ABILITY_ES, POINT_BUY_COST, POINT_BUY_TOTAL, STANDARD_ARRAY,
  mod, fmtMod, skillId, abilityId, finalScores, derive, newCharacter, rollWealth, fmtBelly, hitDie, texto,
} from '../../rollplayer/engine'
import { C, FONT, DISPLAY, TEXTURA, card, label, field, btn, Chip, Md } from './ui'

const PASOS = ['Ruleset', 'Identidad', 'Clase', 'Puntuaciones', 'Trasfondo', 'Equipo', 'Resumen']

export default function CharacterWizard({ rs, onSave, onClose }) {
  const [paso, setPaso] = useState(1)
  const [ch, setCh] = useState(() => newCharacter(rs.meta.id, rs.meta.version))
  const [modo, setModo] = useState('pointbuy')   // pointbuy | array | manual
  const [err, setErr] = useState('')
  const up = (patch) => setCh(c => ({ ...c, ...(typeof patch === 'function' ? patch(c) : patch) }))

  const race = rs.byId.race[ch.race.id]
  const sub  = race?.subraces?.find(s => s.id === ch.race.subraceId)
  const clase = rs.byId.class[ch.classes[0]?.id]
  const bg = rs.byId.background[ch.backgroundId]
  const esVariant = ch.race.subraceId === 'human-variant'

  // Validación por paso
  const ok = useMemo(() => {
    if (paso === 1) return ch.name.trim().length >= 2 && !!ch.race.id && (!esVariant || (Object.keys(ch.race.choices?.asi ?? {}).length === 2 && ch.race.choices?.skill))
    if (paso === 2) return !!clase && (ch.proficiencies.skills.length >= (clase.proficiencies?.skills?.choose ?? 0) + (esVariant ? 1 : 0))
    if (paso === 3) return modo !== 'pointbuy' || pointsUsed() <= POINT_BUY_TOTAL
    if (paso === 4) return !!ch.backgroundId
    return true
  }, [paso, ch, modo, clase, esVariant])

  function pointsUsed() { return ABILITIES.reduce((s, a) => s + (POINT_BUY_COST[ch.abilityScores[a]] ?? 99), 0) }

  const elegirClase = (def) => up(c => ({
    classes: [{ id: def.id, level: 1, subclassId: null, isPrimary: true, choices: {} }],
    proficiencies: { ...c.proficiencies, skills: c.race.choices?.skill ? [c.race.choices.skill] : [] },
  }))
  const toggleSkill = (id, max) => up(c => {
    const s = new Set(c.proficiencies.skills)
    if (s.has(id)) s.delete(id); else if (s.size < max) s.add(id)
    return { proficiencies: { ...c.proficiencies, skills: [...s] } }
  })

  const guardar = () => {
    setErr('')
    const d = derive(rs, ch)
    const final = {
      ...ch, name: ch.name.trim(), level: 1,
      combatState: { ...ch.combatState, currentHp: d.maxHp, hitDiceRemaining: { [clase.id]: 1 } },
      proficiencies: { ...ch.proficiencies, skills: [...new Set([...ch.proficiencies.skills, ...bgSkills(rs, bg)])] },
    }
    onSave(final)
  }

  const scores = finalScores(rs, ch)

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 300, background: TEXTURA, display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      {/* Cabecera con progreso */}
      <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={paso > 1 ? () => setPaso(p => p - 1) : onClose} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 12, letterSpacing: '0.16em', color: C.gold }}>PASO {paso} DE {PASOS.length - 1}</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 26, lineHeight: 1, letterSpacing: '0.03em', color: C.text }}>{PASOS[paso]}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          {PASOS.slice(1).map((_, i) => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i + 1 <= paso ? C.acc : C.border2 }} />)}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 110px' }}>
        {/* ── 1 · Identidad: nombre + raza ── */}
        {paso === 1 && (
          <>
            <div style={{ ...card, marginBottom: 12, borderColor: C.accBorder, background: C.accBg }}>
              <div style={{ fontSize: 11, color: C.acc2, fontWeight: 800 }}>{rs.meta.emoji} {rs.meta.name}</div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{rs.meta.subtitle} · por {rs.meta.author} · v{rs.meta.version}</div>
            </div>
            <div style={label}>Nombre del personaje</div>
            <input value={ch.name} onChange={e => up({ name: e.target.value.slice(0, 40) })} placeholder="Ej. Roronoa D. Quest" style={{ ...field, marginBottom: 16 }} />
            <div style={label}>Raza</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(rs.races ?? []).map(r => {
                const on = ch.race.id === r.id
                const asi = Object.entries(r.abilityScoreIncrease ?? {}).map(([k, v]) => `${ABILITY_ES[k].slice(0, 3)} +${v}`).join(' · ')
                return (
                  <button key={r.id} onClick={() => up({ race: { id: r.id, subraceId: null, choices: {} } })} style={{ ...card, textAlign: 'left', cursor: 'pointer', borderColor: on ? C.accBorder : C.border, background: on ? C.accBg : C.card, fontFamily: FONT }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: DISPLAY, fontSize: 20, letterSpacing: '0.04em', color: C.text }}>{r.name}{r.optional && <span style={{ fontSize: 11, color: C.warn, marginLeft: 8 }}>OPCIONAL</span>}</span>
                      <span style={{ fontSize: 11, color: C.dim }}>{r.size} · {Object.entries(r.speed ?? {}).map(([k, v]) => `${k} ${v}`).join(' / ')}</span>
                    </div>
                    <div style={{ fontFamily: DISPLAY, fontSize: 12.5, letterSpacing: '0.08em', color: C.gold, marginTop: 4 }}>{asi || 'Bonos según subraza'}</div>
                    {on && <div style={{ marginTop: 8 }}><Md text={texto(r.description).split('\n\n')[0]} size={12} /></div>}
                  </button>
                )
              })}
            </div>
            {race?.subraces?.length > 0 && (
              <>
                <div style={{ ...label, marginTop: 16 }}>Subraza</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Chip active={!ch.race.subraceId} onClick={() => up({ race: { ...ch.race, subraceId: null, choices: {} } })}>Ninguna</Chip>
                  {race.subraces.map(s => <Chip key={s.id} active={ch.race.subraceId === s.id} onClick={() => up({ race: { ...ch.race, subraceId: s.id, choices: {} } })}>{s.name}</Chip>)}
                </div>
                {sub && (
                  <div style={{ ...card, marginTop: 10 }}>
                    <Md text={texto(sub.description)} size={12} />
                    {(sub.traits ?? []).map(t => <div key={t.name} style={{ marginTop: 6 }}><strong style={{ color: C.text, fontSize: 12.5 }}>{t.name}.</strong> <span style={{ fontSize: 12, color: C.sub }}>{t.text}</span></div>)}
                  </div>
                )}
                {esVariant && (
                  <div style={{ ...card, marginTop: 10, borderColor: C.accBorder }}>
                    <div style={label}>Human Variant · dos habilidades +1</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {ABILITIES.map(a => {
                        const sel = !!ch.race.choices?.asi?.[a]
                        return <Chip key={a} small active={sel} onClick={() => up(c => { const asi = { ...(c.race.choices?.asi ?? {}) }; if (asi[a]) delete asi[a]; else if (Object.keys(asi).length < 2) asi[a] = 1; return { race: { ...c.race, choices: { ...c.race.choices, asi } } } })}>{ABILITY_ES[a]}</Chip>
                      })}
                    </div>
                    <div style={label}>Una destreza extra</div>
                    <select value={ch.race.choices?.skill ?? ''} onChange={e => up(c => ({ race: { ...c.race, choices: { ...c.race.choices, skill: e.target.value || null } } }))} style={field}>
                      <option value="">Elegí una…</option>
                      {(rs.core?.skills ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <div style={{ ...label, marginTop: 10 }}>Un feat</div>
                    <select value={ch.race.choices?.featId ?? ''} onChange={e => up(c => ({ race: { ...c.race, choices: { ...c.race.choices, featId: e.target.value || null } }, featIds: e.target.value ? [e.target.value] : [] }))} style={field}>
                      <option value="">Elegí uno…</option>
                      {(rs.feats ?? []).map(f => <option key={f.id} value={f.id}>{f.name}{f.prerequisite ? ` (req: ${f.prerequisite})` : ''}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
            {race && (race.traits ?? []).length > 0 && !sub && (
              <div style={{ ...card, marginTop: 12 }}>
                <div style={label}>Rasgos raciales</div>
                {race.traits.map(t => <div key={t.name} style={{ marginBottom: 6 }}><strong style={{ color: C.text, fontSize: 12.5 }}>{t.name}.</strong> <span style={{ fontSize: 12, color: C.sub }}>{t.text}</span></div>)}
              </div>
            )}
          </>
        )}

        {/* ── 2 · Clase + destrezas ── */}
        {paso === 2 && (
          <>
            <div style={label}>Clase</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(rs.classes ?? []).map(k => {
                const on = clase?.id === k.id
                return (
                  <button key={k.id} onClick={() => elegirClase(k)} style={{ ...card, textAlign: 'left', cursor: 'pointer', borderColor: on ? C.accBorder : C.border, background: on ? C.accBg : C.card, fontFamily: FONT }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: DISPLAY, fontSize: 20, letterSpacing: '0.04em', color: C.text }}>{k.name}</span>
                      <span style={{ fontSize: 11, color: C.dim }}>d{hitDie(k)} · {(k.proficiencies?.savingThrows ?? []).map(s => ABILITY_ES[abilityId(s)]?.slice(0, 3) ?? s).join(' + ')}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>{(texto(k.flavor) || texto(k.description)).split('\n')[0].slice(0, 160)}…</div>
                  </button>
                )
              })}
            </div>
            {clase && (
              <div style={{ ...card, marginTop: 12 }}>
                <div style={label}>Competencias</div>
                <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6 }}>
                  <div><strong style={{ color: C.text }}>Armadura:</strong> {clase.proficiencies?.armor}</div>
                  <div><strong style={{ color: C.text }}>Armas:</strong> {clase.proficiencies?.weapons}</div>
                  <div><strong style={{ color: C.text }}>Herramientas:</strong> {clase.proficiencies?.tools}</div>
                </div>
                <div style={{ ...label, marginTop: 12 }}>Destrezas · elegí {clase.proficiencies?.skills?.choose ?? 0}{esVariant ? ' (+1 de Human Variant)' : ''}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(clase.proficiencies?.skills?.from ?? []).map(n => {
                    const id = skillId(rs, n)
                    const max = (clase.proficiencies?.skills?.choose ?? 0) + (esVariant ? 1 : 0)
                    return <Chip key={id} small active={ch.proficiencies.skills.includes(id)} onClick={() => toggleSkill(id, max)}>{n}</Chip>
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── 3 · Puntuaciones ── */}
        {paso === 3 && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[['pointbuy', 'Point buy (27)'], ['array', 'Array estándar'], ['manual', 'Manual']].map(([m, t]) => <Chip key={m} active={modo === m} onClick={() => { setModo(m); if (m === 'array') up({ abilityScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } }); if (m === 'pointbuy') up({ abilityScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 } }) }}>{t}</Chip>)}
            </div>
            {modo === 'pointbuy' && (
              <div style={{ ...card, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, color: C.sub }}>Puntos usados</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: pointsUsed() > POINT_BUY_TOTAL ? C.bad : C.acc2 }}>{pointsUsed()} / {POINT_BUY_TOTAL}</span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ABILITIES.map(a => {
                const base = ch.abilityScores[a]
                const fin = scores[a]
                const bonus = fin - base
                return (
                  <div key={a} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{ABILITY_ES[a]}</div>
                      <div style={{ fontSize: 11, color: C.dim }}>{bonus > 0 ? `base ${base} + raza ${bonus} = ` : ''}<strong style={{ color: C.acc2 }}>{fin}</strong> · mod {fmtMod(mod(fin))}</div>
                    </div>
                    {modo === 'pointbuy' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => up(c => ({ abilityScores: { ...c.abilityScores, [a]: Math.max(8, base - 1) } }))} style={btn('ghost', { padding: '6px 12px' })}>−</button>
                        <span style={{ width: 24, textAlign: 'center', fontSize: 16, fontWeight: 900, color: C.text }}>{base}</span>
                        <button onClick={() => up(c => ({ abilityScores: { ...c.abilityScores, [a]: Math.min(15, base + 1) } }))} style={btn('ghost', { padding: '6px 12px' })}>+</button>
                      </div>
                    )}
                    {modo === 'array' && (
                      <select value={base} onChange={e => up(c => ({ abilityScores: { ...c.abilityScores, [a]: Number(e.target.value) } }))} style={{ ...field, width: 84 }}>
                        {STANDARD_ARRAY.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    )}
                    {modo === 'manual' && (
                      <input type="number" min={1} max={20} value={base} onChange={e => up(c => ({ abilityScores: { ...c.abilityScores, [a]: Math.max(1, Math.min(20, Number(e.target.value) || 1)) } }))} style={{ ...field, width: 84, textAlign: 'center' }} />
                    )}
                  </div>
                )
              })}
            </div>
            {modo === 'array' && <div style={{ fontSize: 11.5, color: C.dim, marginTop: 8 }}>Repartí 15, 14, 13, 12, 10 y 8 — uno por habilidad.</div>}
          </>
        )}

        {/* ── 4 · Trasfondo + tripulación ── */}
        {paso === 4 && (
          <>
            <div style={label}>Trasfondo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(rs.backgrounds ?? []).map(b => {
                const on = ch.backgroundId === b.id
                return (
                  <button key={b.id} onClick={() => up({ backgroundId: b.id })} style={{ ...card, textAlign: 'left', cursor: 'pointer', borderColor: on ? C.accBorder : C.border, background: on ? C.accBg : C.card, fontFamily: FONT }}>
                    <div style={{ fontFamily: DISPLAY, fontSize: 19, letterSpacing: '0.04em', color: C.text }}>{b.name}</div>
                    <div style={{ fontSize: 11.5, color: C.acc2, marginTop: 2 }}>{b.skillProficiencies}{b.feature?.name ? ` · ${b.feature.name}` : ''}</div>
                    {on && <div style={{ marginTop: 8 }}><Md text={texto(b.feature?.text)} size={12} /></div>}
                  </button>
                )
              })}
            </div>
            <div style={{ ...label, marginTop: 16 }}>Rol en la tripulación</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(rs.crew_roles ?? []).map(r => <Chip key={r.id} small active={ch.crewRoleId === r.id} onClick={() => up({ crewRoleId: ch.crewRoleId === r.id ? null : r.id })}>{r.name}</Chip>)}
            </div>
            <div style={{ ...label, marginTop: 16 }}>Facción</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['pirate', '🏴‍☠️ Pirata'], ['marine', '⚓ Marine'], ['revolutionary', '✊ Revolucionario'], ['other', 'Otra']].map(([v, t]) => <Chip key={v} small active={ch.crew.faction === v} onClick={() => up(c => ({ crew: { ...c.crew, faction: v } }))}>{t}</Chip>)}
            </div>
            <div style={{ ...label, marginTop: 16 }}>Nombre de la tripulación</div>
            <input value={ch.crew.name ?? ''} onChange={e => up(c => ({ crew: { ...c.crew, name: e.target.value.slice(0, 40) } }))} placeholder="Opcional" style={field} />
            <div style={{ ...label, marginTop: 12 }}>Sueño</div>
            <select value={ch.crew.dream ?? ''} onChange={e => up(c => ({ crew: { ...c.crew, dream: e.target.value || null } }))} style={field}>
              <option value="">Elegí uno (o escribilo abajo)…</option>
              {(rs.character_dreams ?? []).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input value={(rs.character_dreams ?? []).includes(ch.crew.dream) ? '' : (ch.crew.dream ?? '')} onChange={e => up(c => ({ crew: { ...c.crew, dream: e.target.value || null } }))} placeholder="…o tu propio sueño" style={{ ...field, marginTop: 8 }} />
          </>
        )}

        {/* ── 5 · Equipo inicial ── */}
        {paso === 5 && (
          <>
            <div style={card}>
              <div style={label}>Equipo inicial de {clase?.name}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: C.sub, lineHeight: 1.6 }}>
                {(clase?.startingEquipment ?? []).filter(l => /^\(a\)|^\(b\)|pack|weapon|armor|tool|set|kit|any /i.test(l) && l.length < 160).map((l, i) => <li key={i}>{l}</li>)}
              </ul>
              {bg?.equipment && <><div style={{ ...label, marginTop: 12 }}>Equipo del trasfondo</div><div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6 }}>{bg.equipment}</div></>}
              <div style={{ fontSize: 11, color: C.faint, marginTop: 10 }}>Podés cargar cada ítem en la pestaña Equipo de la hoja.</div>
            </div>
            <div style={{ ...card, marginTop: 12 }}>
              <div style={label}>Belly inicial</div>
              {(() => {
                const row = (rs.wealth_and_expenses?.startingWealthByClass?.[0]?.rows ?? []).find(r => r[0]?.toLowerCase() === clase?.name?.toLowerCase())
                const expr = row?.[1]
                return (
                  <>
                    {expr && <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 8 }}>Tirada de la clase: <strong style={{ color: C.text }}>{expr}</strong></div>}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {expr && <button onClick={() => up(c => ({ equipment: { ...c.equipment, belly: rollWealth(expr) ?? 0 } }))} style={btn('secondary')}>🎲 Tirar</button>}
                      <input type="number" min={0} value={ch.equipment.belly || ''} onChange={e => up(c => ({ equipment: { ...c.equipment, belly: Math.max(0, Number(e.target.value) || 0) } }))} placeholder="o escribí el monto" style={{ ...field, flex: 1 }} />
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: C.gold, marginTop: 10 }}>{fmtBelly(ch.equipment.belly)}</div>
                  </>
                )
              })()}
            </div>
          </>
        )}

        {/* ── 6 · Resumen ── */}
        {paso === 6 && (() => {
          const d = derive(rs, ch)
          return (
            <>
              <div style={{ ...card, borderColor: C.accBorder, background: C.accBg, marginBottom: 12 }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 32, lineHeight: 1, letterSpacing: '0.03em', color: C.text }}>{ch.name}</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 13, letterSpacing: '0.1em', color: C.gold, marginTop: 4, textTransform: 'uppercase' }}>{race?.name}{sub ? ` (${sub.name})` : ''} · {clase?.name} nivel 1 · {bg?.name}</div>
                {ch.crew.name && <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{ch.crew.name}{ch.crewRoleId ? ` · ${rs.byId.crewRole[ch.crewRoleId]?.name}` : ''}</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                {[['PV', d.maxHp], ['CA', d.ac.value], ['Iniciativa', fmtMod(d.initiative)], ['Bono comp.', fmtMod(d.pb)], ['Velocidad', `${d.speed.walk ?? 30}`], ['Belly', fmtBelly(ch.equipment.belly)]].map(([l, v]) => (
                  <div key={l} style={{ ...card, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: C.dim, letterSpacing: '0.1em' }}>{l.toUpperCase()}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 12 }}>
                {ABILITIES.map(a => <div key={a} style={{ ...card, padding: '8px 4px', textAlign: 'center' }}><div style={{ fontSize: 9.5, fontWeight: 800, color: C.dim }}>{a.toUpperCase()}</div><div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{d.scores[a]}</div><div style={{ fontSize: 11, color: C.acc2 }}>{fmtMod(d.mods[a])}</div></div>)}
              </div>
              <div style={{ ...card }}>
                <div style={label}>Destrezas competentes</div>
                <div style={{ fontSize: 12.5, color: C.sub }}>{[...new Set([...ch.proficiencies.skills, ...bgSkills(rs, bg)])].map(id => rs.skillsById[id]?.name ?? id).join(' · ') || '—'}</div>
              </div>
              {err && <div style={{ marginTop: 10, color: C.bad, fontSize: 12.5 }}>{err}</div>}
            </>
          )
        })()}
      </div>

      {/* Pie fijo */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 16px calc(14px + env(safe-area-inset-bottom, 0px))', background: 'linear-gradient(180deg, rgba(10,10,10,0) 0%, #0A0A0A 30%)', display: 'flex', gap: 8 }}>
        {paso > 1 && <button onClick={() => setPaso(p => p - 1)} style={btn('ghost', { flex: '0 0 auto' })}>Atrás</button>}
        {paso < 6
          ? <button onClick={() => ok && setPaso(p => p + 1)} disabled={!ok} style={btn('primary', { flex: 1, opacity: ok ? 1 : 0.45 })}>Siguiente →</button>
          : <button onClick={guardar} style={btn('primary', { flex: 1 })}>✓ Crear personaje</button>}
      </div>
    </div>
  )
}

function bgSkills(rs, bg) {
  return String(bg?.skillProficiencies ?? '').split(',').map(s => s.trim()).filter(s => s && !/choice/i.test(s)).map(n => skillId(rs, n))
}
