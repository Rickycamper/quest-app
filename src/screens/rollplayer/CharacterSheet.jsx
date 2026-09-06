// ─────────────────────────────────────────────
// ROLL PLAYER — Hoja de personaje (viva)
// ─────────────────────────────────────────────
import { useMemo, useState } from 'react'
import {
  ABILITIES, ABILITY_ES, derive, fmtMod, fmtBelly, asiLevels, subclassLevel, hitDie, mod, texto,
} from '../../rollplayer/engine'
import { C, FONT, DISPLAY, TEXTURA, card, label, field, btn, Chip, Md, Sheet, Expand, Stat, Tabs, SectionTitle, AbilityBox, Shield, Portrait, Frame } from './ui'

const TABS = [['hoja', 'Hoja'], ['rasgos', 'Rasgos'], ['poder', 'Haki & Fruta'], ['equipo', 'Equipo'], ['historia', 'Historia']]
const CONDICIONES = ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious']
const RAREZAS = ['Uncommon', 'Rare', 'Very Rare', 'Legendary']
const RCOLOR = { Uncommon: '#4ADE80', Rare: '#60A5FA', 'Very Rare': '#A78BFA', Legendary: '#F59E0B' }

export default function CharacterSheet({ rs, ch, onChange, onOpenRules, onDelete, onBack, saving }) {
  const [tab, setTab] = useState('hoja')
  const [modal, setModal] = useState(null)   // 'levelup' | 'haki' | 'fruta' | 'item' | 'confirmDelete'
  const d = useMemo(() => derive(rs, ch), [rs, ch])
  const up = (patch) => onChange({ ...ch, ...(typeof patch === 'function' ? patch(ch) : patch) })
  const cs = ch.combatState ?? {}
  const upCs = (p) => up(c => ({ combatState: { ...c.combatState, ...p } }))
  const primary = ch.classes?.[0]
  const def = d.primary

  const hpActual = cs.currentHp == null ? d.maxHp : cs.currentHp
  const setHp = (v) => upCs({ currentHp: Math.max(0, Math.min(d.maxHp, v)) })

  return (
    <div style={{ fontFamily: FONT, paddingBottom: 90, minHeight: '100%', background: TEXTURA }}>
      {/* Cabecera */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}>‹</button>
          <Portrait name={ch.name} url={ch.roleplay?.portraitUrl} size={58} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 28, lineHeight: 1, letterSpacing: '0.03em', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 13, letterSpacing: '0.1em', color: C.gold, marginTop: 3, textTransform: 'uppercase' }}>
              {d.race?.name}{d.sub ? ` · ${d.sub.name}` : ''} · {def?.name ?? '—'} {primary?.level ?? 1}
              {primary?.subclassId ? ` · ${def?.subclasses?.find(s => s.id === primary.subclassId)?.name ?? ''}` : ''}
            </div>
            <div style={{ fontSize: 10.5, color: saving ? C.warn : C.faint, marginTop: 2 }}>{saving ? 'guardando…' : 'guardado'}{ch.crew?.name ? ` · ${ch.crew.name}` : ''}</div>
          </div>
          <button onClick={onOpenRules} title="Manual" style={{ background: C.goldBg, border: `1px solid ${C.goldDim}`, borderRadius: 4, color: C.gold, cursor: 'pointer', fontFamily: DISPLAY, fontSize: 13, letterSpacing: '0.08em', padding: '7px 9px' }}>📖 REGLAS</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <Tabs items={TABS} value={tab} onChange={setTab} />
        </div>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {/* ════ HOJA ════ */}
        {tab === 'hoja' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5, marginBottom: 12 }}>
              {ABILITIES.map(a => <AbilityBox key={a} abbr={a.toUpperCase()} name={ABILITY_ES[a]} mod={fmtMod(d.mods[a])} score={d.scores[a]} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 8, marginBottom: 12, alignItems: 'stretch' }}>
              <Shield value={d.ac.value} sub={d.ac.source.split(' (')[0]} />
              <Stat label="Iniciativa" value={fmtMod(d.initiative)} />
              <Stat label="Velocidad" value={d.speed.walk ?? 30} sub={d.speed.swim ? `nado ${d.speed.swim}` : d.speed.fly ? `vuelo ${d.speed.fly}` : null} />
              <Stat label="Competencia" value={fmtMod(d.pb)} />
            </div>

            {/* PV */}
            <Frame accent={hpActual <= d.maxHp / 4 ? C.acc : C.goldDim} style={{ marginBottom: 12 }} pad={12}>
              <SectionTitle>Puntos de golpe</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center' }}>
                {[['Actual', hpActual, hpActual <= d.maxHp / 4 ? C.bad : C.text], ['Máx', d.maxHp, C.sub], ['Temp', cs.temporaryHp || 0, cs.temporaryHp > 0 ? C.ok : C.faint]].map(([l, v, col]) => (
                  <div key={l} style={{ background: '#0C0B09', border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 4px' }}>
                    <div style={{ fontFamily: DISPLAY, fontSize: 30, lineHeight: 1, color: col }}>{v}</div>
                    <div style={{ fontFamily: DISPLAY, fontSize: 10.5, letterSpacing: '0.12em', color: C.dim, marginTop: 3 }}>{l.toUpperCase()}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'center' }}>
                {[-5, -1].map(n => <button key={n} onClick={() => setHp(hpActual + n)} style={btn('danger', { padding: '7px 12px', fontSize: 14 })}>{n}</button>)}
                {[1, 5].map(n => <button key={n} onClick={() => setHp(hpActual + n)} style={btn('secondary', { padding: '7px 12px', fontSize: 14, color: C.ok })}>+{n}</button>)}
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.border2, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(hpActual / d.maxHp) * 100}%`, background: hpActual <= d.maxHp / 4 ? C.bad : hpActual <= d.maxHp / 2 ? C.warn : C.ok, transition: 'width .3s' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11.5, color: C.dim }}>PV temporales</span>
                <input type="number" min={0} value={cs.temporaryHp ?? 0} onChange={e => upCs({ temporaryHp: Math.max(0, Number(e.target.value) || 0) })} style={{ ...field, width: 70, padding: '6px 8px' }} />
                <button onClick={() => setHp(d.maxHp)} style={btn('ghost', { padding: '6px 10px', fontSize: 11.5 })}>Descanso largo</button>
                <span style={{ fontSize: 11.5, color: C.dim, marginLeft: 'auto' }}>Dados de golpe: {Object.values(cs.hitDiceRemaining ?? {}).reduce((a, b) => a + b, 0)}/{d.level} d{hitDie(def)}</span>
              </div>
              {hpActual === 0 && (
                <div style={{ marginTop: 10, display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center' }}>
                  {['successes', 'failures'].map(k => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: k === 'successes' ? C.ok : C.bad, fontWeight: 800 }}>{k === 'successes' ? 'Éxitos' : 'Fallos'}</span>
                      {[1, 2, 3].map(i => <button key={i} onClick={() => upCs({ deathSaves: { ...(cs.deathSaves ?? {}), [k]: (cs.deathSaves?.[k] ?? 0) >= i ? i - 1 : i } })} style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${k === 'successes' ? C.ok : C.bad}`, background: (cs.deathSaves?.[k] ?? 0) >= i ? (k === 'successes' ? C.ok : C.bad) : 'transparent', cursor: 'pointer' }} />)}
                    </div>
                  ))}
                </div>
              )}
            </Frame>

            {/* Condiciones */}
            <div style={{ ...card, marginBottom: 10 }}>
              <SectionTitle>Condiciones</SectionTitle>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CONDICIONES.map(cd => <Chip key={cd} small color={C.bad} active={(cs.conditions ?? []).includes(cd)} onClick={() => upCs({ conditions: (cs.conditions ?? []).includes(cd) ? cs.conditions.filter(x => x !== cd) : [...(cs.conditions ?? []), cd] })}>{cd}</Chip>)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 11.5, color: C.dim }}>Agotamiento</span>
                {[0, 1, 2, 3, 4, 5, 6].map(n => <Chip key={n} small color={C.warn} active={(cs.exhaustion ?? 0) === n} onClick={() => upCs({ exhaustion: n })}>{n}</Chip>)}
              </div>
            </div>

            {/* Salvaciones + destrezas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
              <div style={card}>
                <SectionTitle>Salvaciones</SectionTitle>
                {ABILITIES.map(a => <Row key={a} name={ABILITY_ES[a]} value={d.saves[a].value} prof={d.saves[a].proficient} />)}
                <div style={{ ...label, marginTop: 12 }}>Pasiva</div>
                <Row name="Percepción" value={d.passivePerception} raw />
                {d.spell && <><div style={{ ...label, marginTop: 12 }}>Conjuros ({ABILITY_ES[d.spell.ability].slice(0, 3)})</div><Row name="CD" value={d.spell.dc} raw /><Row name="Ataque" value={d.spell.attack} /></>}
                {d.haki.filter(h => h.unlocked).map(h => <div key={h.id}><div style={{ ...label, marginTop: 12 }}>{h.name.replace('Color of ', '')}</div><Row name="CD Haki" value={h.dc} raw /></div>)}
              </div>
              <div style={card}>
                <SectionTitle>Destrezas</SectionTitle>
                {d.skills.map(s => <Row key={s.id} name={s.name} sub={s.ability.toUpperCase()} value={s.value} prof={s.proficient} exp={s.expertise} />)}
              </div>
            </div>
          </>
        )}

        {/* ════ RASGOS ════ */}
        {tab === 'rasgos' && (
          <>
            {def && (
              <div style={{ ...card, marginBottom: 10 }}>
                <div style={label}>Tabla de {def.name} · nivel {primary.level}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {Object.entries(((def.progression ?? []).find(r => r.level === primary.level)?.columns) ?? {}).map(([k, v]) => (
                    <div key={k}><div style={{ fontSize: 10, color: C.dim }}>{k}</div><div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{v}</div></div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ ...card, paddingTop: 4, paddingBottom: 4 }}>
              {d.features.map((f, i) => (
                <Expand key={i} title={f.name} meta={`${f.source}${f.level ? ` · nv ${f.level}` : ''}`}>
                  <Md text={f.text} />
                  {(f.options ?? []).map(o => <div key={o.id ?? o.name} style={{ marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${C.border2}` }}><div style={{ fontSize: 12.5, fontWeight: 800, color: C.text, marginBottom: 3 }}>{o.name}</div><Md text={o.text} size={12} /></div>)}
                </Expand>
              ))}
            </div>
          </>
        )}

        {/* ════ HAKI & FRUTA ════ */}
        {tab === 'poder' && (
          <>
            <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 10, lineHeight: 1.5 }}>El Haki y las frutas no dependen del nivel: el DM los otorga en <strong style={{ color: C.sub }}>Spirit Surge Events</strong>. Registrá acá lo que te concedieron.</div>
            {d.haki.map(h => {
              const col = (rs.haki?.colors ?? []).find(x => x.id === h.id)
              const adv = (ch.haki?.advancements ?? []).filter(a => a.colorId === h.id)
              return (
                <div key={h.id} style={{ ...card, marginBottom: 10, borderColor: h.unlocked ? C.accBorder : C.border }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>{h.name}</div>
                      <div style={{ fontSize: 11, color: C.dim }}>{ABILITY_ES[h.ability]} · CD {h.dc}</div>
                    </div>
                    <Chip small active={h.unlocked} onClick={() => up(c => ({ haki: { ...c.haki, unlockedColors: h.unlocked ? c.haki.unlockedColors.filter(x => x !== h.id) : [...(c.haki.unlockedColors ?? []), h.id] } }))}>{h.unlocked ? 'Despertado' : 'Despertar'}</Chip>
                  </div>
                  {h.unlocked && (
                    <>
                      {adv.map((a, i) => {
                        const def2 = col?.advancements?.find(x => x.id === a.advancementId)
                        return (
                          <div key={i} style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: C.card2, border: `1px solid ${C.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: C.text }}>{def2?.name ?? a.advancementId}</span>
                              <span style={{ fontSize: 10, fontWeight: 800, color: RCOLOR[a.rarity] }}>{a.rarity}</span>
                              <button onClick={() => up(c => ({ haki: { ...c.haki, advancements: c.haki.advancements.filter(x => x !== a) } }))} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer' }}>✕</button>
                            </div>
                            {a.note && <div style={{ fontSize: 11, color: C.dim }}>{a.note}</div>}
                            <Expand title="Texto"><Md text={def2?.text} size={12} /></Expand>
                          </div>
                        )
                      })}
                      <button onClick={() => setModal({ t: 'haki', colorId: h.id })} style={btn('secondary', { marginTop: 8, width: '100%' })}>+ Agregar avance de {h.name.replace('Color of ', '')}</button>
                    </>
                  )}
                </div>
              )
            })}

            <div style={{ ...card, borderColor: ch.devilFruit ? 'rgba(245,158,11,0.45)' : C.border }}>
              <div style={label}>Fruta del diablo</div>
              {!ch.devilFruit ? (
                <button onClick={() => setModal({ t: 'fruta' })} style={btn('secondary', { width: '100%' })}>🍈 Comer una fruta</button>
              ) : (
                <>
                  <div style={{ fontSize: 17, fontWeight: 900, color: C.gold }}>{ch.devilFruit.name}</div>
                  <div style={{ fontSize: 11.5, color: C.sub }}>{ch.devilFruit.type}{ch.devilFruit.subtype ? ` · ${ch.devilFruit.subtype}` : ''}{ch.devilFruit.model ? ` · ${ch.devilFruit.model}` : ''} · <span style={{ color: RCOLOR[ch.devilFruit.rarity] }}>{ch.devilFruit.rarity}</span>{ch.devilFruit.meaning ? ` · ${ch.devilFruit.meaning}` : ''}</div>
                  {ch.devilFruit.charges?.max > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 11.5, color: C.dim }}>Cargas</span>
                      <button onClick={() => up(c => ({ devilFruit: { ...c.devilFruit, charges: { ...c.devilFruit.charges, current: Math.max(0, (c.devilFruit.charges.current ?? 0) - 1) } } }))} style={btn('ghost', { padding: '4px 10px' })}>−</button>
                      <span style={{ fontSize: 15, fontWeight: 900, color: C.text }}>{ch.devilFruit.charges.current ?? ch.devilFruit.charges.max} / {ch.devilFruit.charges.max}</span>
                      <button onClick={() => up(c => ({ devilFruit: { ...c.devilFruit, charges: { ...c.devilFruit.charges, current: Math.min(c.devilFruit.charges.max, (c.devilFruit.charges.current ?? 0) + 1) } } }))} style={btn('ghost', { padding: '4px 10px' })}>+</button>
                    </div>
                  )}
                  {(ch.devilFruit.skills ?? []).map((s, i) => <div key={i} style={{ marginTop: 8 }}><strong style={{ color: C.text, fontSize: 12.5 }}>{s.name}</strong>{s.cost != null && <span style={{ color: C.gold, fontSize: 11 }}> · {s.cost} carga(s)</span>}<div style={{ fontSize: 12, color: C.sub }}>{s.text}</div></div>)}
                  {(ch.devilFruit.weaknesses ?? []).length > 0 && <div style={{ fontSize: 11.5, color: C.bad, marginTop: 8 }}>Debilidades: {ch.devilFruit.weaknesses.join(', ')}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => setModal({ t: 'fruta' })} style={btn('secondary', { flex: 1 })}>Editar</button>
                    <button onClick={() => up({ devilFruit: null })} style={btn('danger')}>Quitar</button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ════ EQUIPO ════ */}
        {tab === 'equipo' && (
          <>
            <div style={{ ...card, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}><div style={label}>Belly</div><div style={{ fontSize: 22, fontWeight: 900, color: C.gold }}>{fmtBelly(ch.equipment?.belly)}</div></div>
              <input type="number" value={ch.equipment?.belly ?? 0} onChange={e => up(c => ({ equipment: { ...c.equipment, belly: Math.max(0, Number(e.target.value) || 0) } }))} style={{ ...field, width: 130 }} />
            </div>
            <div style={{ ...card, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={label}>Inventario</div>
                <span style={{ fontSize: 11, color: C.dim }}>Capacidad {d.carrying} lb</span>
              </div>
              {(ch.equipment?.items ?? []).length === 0 && <div style={{ fontSize: 12.5, color: C.faint, padding: '8px 0' }}>Nada todavía.</div>}
              {(ch.equipment?.items ?? []).map((it, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ''}</div>
                    {it.notes && <div style={{ fontSize: 11, color: C.dim }}>{it.notes}</div>}
                  </div>
                  {it.equippable && <Chip small active={it.equipped} onClick={() => up(c => ({ equipment: { ...c.equipment, items: c.equipment.items.map((x, j) => j === i ? { ...x, equipped: !x.equipped } : x) } }))}>{it.equipped ? 'Equipado' : 'Equipar'}</Chip>}
                  <button onClick={() => up(c => ({ equipment: { ...c.equipment, items: c.equipment.items.filter((_, j) => j !== i) } }))} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
              ))}
              <button onClick={() => setModal({ t: 'item' })} style={btn('secondary', { marginTop: 10, width: '100%' })}>+ Agregar ítem</button>
            </div>
          </>
        )}

        {/* ════ HISTORIA ════ */}
        {tab === 'historia' && (
          <>
            {[['personalityTraits', 'Rasgos de personalidad', 'personality-trait'], ['ideals', 'Ideales', 'ideal'], ['bonds', 'Vínculos', 'bond'], ['flaws', 'Defectos', 'flaw']].map(([k, t, sugKey]) => {
              const sug = rs.byId.background[ch.backgroundId]?.suggestedCharacteristics?.[sugKey] ?? []
              return (
                <div key={k} style={{ ...card, marginBottom: 10 }}>
                  <div style={label}>{t}</div>
                  <textarea value={ch.roleplay?.[k] ?? ''} onChange={e => up(c => ({ roleplay: { ...c.roleplay, [k]: e.target.value } }))} rows={2} style={{ ...field, resize: 'vertical' }} />
                  {sug.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{sug.slice(0, 6).map((s, i) => <button key={i} onClick={() => up(c => ({ roleplay: { ...c.roleplay, [k]: s } }))} style={{ ...btn('ghost', { padding: '5px 9px', fontSize: 11, fontWeight: 600, textAlign: 'left' }) }}>{s.slice(0, 70)}{s.length > 70 ? '…' : ''}</button>)}</div>}
                </div>
              )
            })}
            {[['appearance', 'Apariencia'], ['backstory', 'Historia'], ['notes', 'Notas']].map(([k, t]) => (
              <div key={k} style={{ ...card, marginBottom: 10 }}>
                <div style={label}>{t}</div>
                <textarea value={k === 'notes' ? (ch.notes ?? '') : (ch.roleplay?.[k] ?? '')} onChange={e => k === 'notes' ? up({ notes: e.target.value }) : up(c => ({ roleplay: { ...c.roleplay, [k]: e.target.value } }))} rows={4} style={{ ...field, resize: 'vertical' }} />
              </div>
            ))}
            <div style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[['age', 'Edad'], ['height', 'Altura'], ['weight', 'Peso']].map(([k, t]) => <div key={k}><div style={label}>{t}</div><input value={ch.roleplay?.[k] ?? ''} onChange={e => up(c => ({ roleplay: { ...c.roleplay, [k]: e.target.value } }))} style={field} /></div>)}
            </div>
            <button onClick={() => setModal({ t: 'confirmDelete' })} style={btn('danger', { marginTop: 14, width: '100%' })}>Borrar personaje</button>
          </>
        )}
      </div>

      {/* Barra de acciones */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 250, padding: '10px 16px calc(14px + env(safe-area-inset-bottom, 0px))', background: 'linear-gradient(180deg, rgba(10,10,10,0) 0%, #0A0A0A 30%)', display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button onClick={() => setModal({ t: 'levelup' })} style={btn('primary', { maxWidth: 420, flex: 1 })}>⬆ Subir a nivel {d.level + 1}</button>
      </div>

      {/* ═══ Modales ═══ */}
      {modal?.t === 'levelup' && <LevelUp rs={rs} ch={ch} d={d} onClose={() => setModal(null)} onApply={(patch) => { up(patch); setModal(null) }} />}
      {modal?.t === 'haki' && <HakiPicker rs={rs} colorId={modal.colorId} onClose={() => setModal(null)} onPick={(a) => { up(c => ({ haki: { ...c.haki, advancements: [...(c.haki.advancements ?? []), a] } })); setModal(null) }} />}
      {modal?.t === 'fruta' && <FruitEditor rs={rs} value={ch.devilFruit} onClose={() => setModal(null)} onSave={(f) => { up({ devilFruit: f }); setModal(null) }} />}
      {modal?.t === 'item' && <ItemPicker rs={rs} onClose={() => setModal(null)} onPick={(it) => { up(c => ({ equipment: { ...c.equipment, items: [...(c.equipment.items ?? []), it] } })); setModal(null) }} />}
      {modal?.t === 'confirmDelete' && (
        <Sheet title="¿Borrar este personaje?" onClose={() => setModal(null)}>
          <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>Se borra de tu lista. No hay vuelta atrás.</div>
          <button onClick={onDelete} style={btn('danger', { width: '100%' })}>Sí, borrar a {ch.name}</button>
        </Sheet>
      )}
    </div>
  )
}

function Row({ name, sub, value, prof, exp, raw }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: exp ? C.gold : prof ? C.acc : 'transparent', border: `1.5px solid ${exp ? C.gold : prof ? C.acc : C.border2}`, flexShrink: 0, boxShadow: prof ? `0 0 6px ${exp ? C.gold : C.acc}66` : 'none' }} />
      <span style={{ flex: 1, fontSize: 12, color: prof ? C.text : C.sub, fontWeight: prof ? 700 : 500 }}>{name}{sub && <span style={{ fontFamily: DISPLAY, color: C.faint, fontSize: 10, letterSpacing: '0.08em', marginLeft: 5 }}>{sub}</span>}</span>
      <span style={{ minWidth: 30, textAlign: 'center', padding: '1px 5px', borderRadius: 3, background: '#0C0B09', border: `1px solid ${C.border}`, fontFamily: DISPLAY, fontSize: 14, color: C.text }}>{raw ? value : fmtMod(value)}</span>
    </div>
  )
}

// ── Subir de nivel: PV, subclase y ASI/feat cuando toca ──
function LevelUp({ rs, ch, d, onClose, onApply }) {
  const primary = ch.classes[0]; const def = rs.byId.class[primary.id]
  const nuevo = primary.level + 1
  const necesitaSub = !primary.subclassId && nuevo >= subclassLevel(def) && (def.subclasses ?? []).length > 0
  const esAsi = asiLevels(def).includes(nuevo)
  const [subId, setSubId] = useState('')
  const [asiKind, setAsiKind] = useState('abilityScore')
  const [inc, setInc] = useState({})
  const [featId, setFeatId] = useState('')
  const [featChoice, setFeatChoice] = useState(null)
  const feat = rs.byId.feat[featId]
  const totalInc = Object.values(inc).reduce((a, b) => a + b, 0)
  const ok = nuevo <= 20 && (!necesitaSub || subId) && (!esAsi || (asiKind === 'abilityScore' ? totalInc === 2 : (featId && (!feat?.abilityScoreIncrease?.choiceFrom || featChoice))))
  const row = (def.progression ?? []).find(r => r.level === nuevo)
  const hpGanado = Math.floor(hitDie(def) / 2) + 1 + d.mods.con

  const aplicar = () => onApply(c => {
    const classes = c.classes.map((k, i) => i === 0 ? { ...k, level: nuevo, subclassId: subId || k.subclassId } : k)
    const asis = [...(c.abilityScoreImprovements ?? [])]
    const featIds = [...(c.featIds ?? [])]; const featChoices = { ...(c.featChoices ?? {}) }
    if (esAsi) {
      if (asiKind === 'abilityScore') asis.push({ classId: def.id, level: nuevo, kind: 'abilityScore', increases: inc, featId: null })
      else { asis.push({ classId: def.id, level: nuevo, kind: 'feat', increases: {}, featId }); featIds.push(featId); if (featChoice) featChoices[featId] = { [featChoice]: feat.abilityScoreIncrease.choiceFrom.amount ?? 1 } }
    }
    const hd = { ...(c.combatState?.hitDiceRemaining ?? {}) }; hd[def.id] = (hd[def.id] ?? primary.level) + 1
    return { level: nuevo, classes, abilityScoreImprovements: asis, featIds, featChoices,
      combatState: { ...c.combatState, currentHp: (c.combatState?.currentHp ?? d.maxHp) + Math.max(1, hpGanado), hitDiceRemaining: hd } }
  })

  return (
    <Sheet title={`Nivel ${nuevo} de ${def.name}`} onClose={onClose}>
      <div style={{ ...card, marginBottom: 10 }}>
        <div style={label}>Ganás</div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
          <div>+{Math.max(1, hpGanado)} PV (promedio d{hitDie(def)} + CON)</div>
          {(row?.features ?? []).map(f => <div key={f}>• {f}</div>)}
        </div>
      </div>
      {necesitaSub && (
        <div style={{ ...card, marginBottom: 10, borderColor: C.accBorder }}>
          <div style={label}>Elegí tu {def.subclassLabel || 'subclase'}</div>
          {(def.subclasses ?? []).map(s => (
            <button key={s.id} onClick={() => setSubId(s.id)} style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 6, borderColor: subId === s.id ? C.accBorder : C.border, background: subId === s.id ? C.accBg : C.card2, fontFamily: FONT }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{s.name}</div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>{texto(s.description).slice(0, 140)}…</div>
            </button>
          ))}
        </div>
      )}
      {esAsi && (
        <div style={{ ...card, marginBottom: 10, borderColor: C.accBorder }}>
          <div style={label}>Mejora de característica</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <Chip active={asiKind === 'abilityScore'} onClick={() => setAsiKind('abilityScore')}>+2 / +1 +1</Chip>
            <Chip active={asiKind === 'feat'} onClick={() => setAsiKind('feat')}>Feat</Chip>
          </div>
          {asiKind === 'abilityScore' ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ABILITIES.map(a => <Chip key={a} small active={!!inc[a]} onClick={() => setInc(p => { const n = { ...p }; if (n[a] === 2) delete n[a]; else if (n[a] === 1) { if (totalInc < 2) n[a] = 2; else delete n[a] } else if (totalInc < 2) n[a] = 1; return n })}>{ABILITY_ES[a]}{inc[a] ? ` +${inc[a]}` : ''}</Chip>)}
            </div>
          ) : (
            <>
              <select value={featId} onChange={e => { setFeatId(e.target.value); setFeatChoice(null) }} style={field}>
                <option value="">Elegí un feat…</option>
                {(rs.feats ?? []).filter(f => !ch.featIds?.includes(f.id)).map(f => <option key={f.id} value={f.id}>{f.name}{f.prerequisite ? ` (req: ${f.prerequisite})` : ''}</option>)}
              </select>
              {feat && <div style={{ marginTop: 8 }}><Md text={feat.text} size={12} /></div>}
              {feat?.abilityScoreIncrease?.choiceFrom && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {feat.abilityScoreIncrease.choiceFrom.options.map(a => <Chip key={a} small active={featChoice === a} onClick={() => setFeatChoice(a)}>{ABILITY_ES[a]} +{feat.abilityScoreIncrease.choiceFrom.amount ?? 1}</Chip>)}
                </div>
              )}
            </>
          )}
        </div>
      )}
      <button onClick={aplicar} disabled={!ok} style={btn('primary', { width: '100%', opacity: ok ? 1 : 0.45, marginBottom: 8 })}>Subir a nivel {nuevo}</button>
    </Sheet>
  )
}

function HakiPicker({ rs, colorId, onClose, onPick }) {
  const col = (rs.haki?.colors ?? []).find(c => c.id === colorId)
  const [rareza, setRareza] = useState('Uncommon')
  const [note, setNote] = useState('')
  const lista = (col?.advancements ?? []).filter(a => a.rarity === rareza)
  return (
    <Sheet title={`Avance · ${col?.name}`} onClose={onClose}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>{RAREZAS.map(r => <Chip key={r} small color={RCOLOR[r]} active={rareza === r} onClick={() => setRareza(r)}>{r}</Chip>)}</div>
      <input value={note} onChange={e => setNote(e.target.value.slice(0, 120))} placeholder="Nota: en qué Spirit Surge lo ganaste (opcional)" style={{ ...field, marginBottom: 10 }} />
      {lista.map(a => (
        <div key={a.id} style={{ ...card, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{a.name}</div>{a.prerequisite && <div style={{ fontSize: 11, color: C.warn }}>Req: {a.prerequisite}</div>}</div>
            <button onClick={() => onPick({ colorId, advancementId: a.id, rarity: a.rarity, grantedAt: new Date().toISOString(), grantedBy: null, note: note || null })} style={btn('secondary', { padding: '7px 12px' })}>Tomar</button>
          </div>
          <Expand title="Texto"><Md text={a.text} size={12} /></Expand>
        </div>
      ))}
    </Sheet>
  )
}

function FruitEditor({ rs, value, onClose, onSave }) {
  const [f, setF] = useState(value ?? { catalogId: null, name: '', meaning: '', type: 'Paramecia', subtype: '', model: '', rarity: 'Uncommon', appearance: '', damageType: '', resistances: [], immunities: [], weaknesses: ['Sea water', 'Seastone'], spellcastingAbility: null, charges: { max: 0, current: 0, recharge: 'long-rest' }, skills: [], spells: [], advancements: [], awakening: null, zoanForms: [] })
  const [q, setQ] = useState('')
  const set = (p) => setF(x => ({ ...x, ...p }))
  const cat = (rs.devil_fruit_catalog ?? []).filter(x => !q || x.name.toLowerCase().includes(q.toLowerCase()) || (x.meaning || '').toLowerCase().includes(q.toLowerCase())).slice(0, 12)
  return (
    <Sheet title="Fruta del diablo" onClose={onClose} wide>
      <div style={label}>Del catálogo (224) — o escribila abajo</div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar: gomu, hie, fuego…" style={{ ...field, marginBottom: 8 }} />
      {q && cat.map(x => <button key={x.id} onClick={() => { set({ catalogId: x.id, name: x.name, meaning: x.meaning, type: x.type, model: x.model, rarity: x.rarity }); setQ('') }} style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 6, background: C.card2, fontFamily: FONT }}><span style={{ fontWeight: 800, color: C.text }}>{x.name}</span> <span style={{ color: C.sub, fontSize: 12 }}>· {x.type} · {x.meaning}{x.model ? ` · ${x.model}` : ''} · <span style={{ color: RCOLOR[x.rarity] }}>{x.rarity}</span></span></button>)}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <div style={{ gridColumn: '1 / -1' }}><div style={label}>Nombre</div><input value={f.name} onChange={e => set({ name: e.target.value })} style={field} /></div>
        <div><div style={label}>Tipo</div><select value={f.type} onChange={e => set({ type: e.target.value })} style={field}>{['Paramecia', 'Zoan', 'Logia'].map(t => <option key={t}>{t}</option>)}</select></div>
        <div><div style={label}>Rareza</div><select value={f.rarity} onChange={e => set({ rarity: e.target.value })} style={field}>{RAREZAS.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><div style={label}>Significado</div><input value={f.meaning ?? ''} onChange={e => set({ meaning: e.target.value })} style={field} /></div>
        <div><div style={label}>{f.type === 'Zoan' ? 'Modelo' : 'Subtipo'}</div><input value={(f.type === 'Zoan' ? f.model : f.subtype) ?? ''} onChange={e => set(f.type === 'Zoan' ? { model: e.target.value } : { subtype: e.target.value })} style={field} /></div>
        <div><div style={label}>Tipo de daño</div><input value={f.damageType ?? ''} onChange={e => set({ damageType: e.target.value })} style={field} /></div>
        <div><div style={label}>Habilidad de conjuro</div><select value={f.spellcastingAbility ?? ''} onChange={e => set({ spellcastingAbility: e.target.value || null })} style={field}><option value="">—</option>{ABILITIES.map(a => <option key={a} value={a}>{ABILITY_ES[a]}</option>)}</select></div>
        <div><div style={label}>Cargas máx.</div><input type="number" min={0} value={f.charges?.max ?? 0} onChange={e => set({ charges: { ...(f.charges ?? {}), max: Number(e.target.value) || 0, current: Number(e.target.value) || 0 } })} style={field} /></div>
        <div><div style={label}>Recarga</div><select value={f.charges?.recharge ?? 'long-rest'} onChange={e => set({ charges: { ...(f.charges ?? {}), recharge: e.target.value } })} style={field}><option value="short-rest">Descanso corto</option><option value="long-rest">Descanso largo</option><option value="dawn">Amanecer</option></select></div>
        <div style={{ gridColumn: '1 / -1' }}><div style={label}>Apariencia</div><input value={f.appearance ?? ''} onChange={e => set({ appearance: e.target.value })} style={field} /></div>
        <div style={{ gridColumn: '1 / -1' }}><div style={label}>Debilidades (coma)</div><input value={(f.weaknesses ?? []).join(', ')} onChange={e => set({ weaknesses: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={field} /></div>
      </div>
      <div style={{ ...label, marginTop: 12 }}>Habilidades de la fruta</div>
      {(f.skills ?? []).map((s, i) => (
        <div key={i} style={{ ...card, marginBottom: 6, background: C.card2 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={s.name} onChange={e => set({ skills: f.skills.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} placeholder="Nombre" style={{ ...field, flex: 1 }} />
            <input type="number" min={0} value={s.cost ?? ''} onChange={e => set({ skills: f.skills.map((x, j) => j === i ? { ...x, cost: e.target.value === '' ? null : Number(e.target.value) } : x) })} placeholder="cargas" style={{ ...field, width: 80 }} />
            <button onClick={() => set({ skills: f.skills.filter((_, j) => j !== i) })} style={btn('ghost', { padding: '6px 10px' })}>✕</button>
          </div>
          <textarea value={s.text} onChange={e => set({ skills: f.skills.map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} rows={2} placeholder="Qué hace" style={{ ...field, marginTop: 6, resize: 'vertical' }} />
        </div>
      ))}
      <button onClick={() => set({ skills: [...(f.skills ?? []), { name: '', text: '', cost: null }] })} style={btn('ghost', { width: '100%', marginBottom: 12 })}>+ Habilidad</button>
      <button onClick={() => f.name.trim() && onSave(f)} disabled={!f.name.trim()} style={btn('primary', { width: '100%', opacity: f.name.trim() ? 1 : 0.45, marginBottom: 8 })}>Guardar fruta</button>
    </Sheet>
  )
}

function ItemPicker({ rs, onClose, onPick }) {
  const [q, setQ] = useState('')
  const [custom, setCustom] = useState('')
  const all = [
    ...(rs.weapons ?? []).map(w => ({ name: w.name, cat: w.category, extra: `${w.damage} · ${w.cost}`, equippable: true })),
    ...(rs.armor ?? []).map(a => ({ name: a.armor, cat: a.category, extra: `CA ${a['armor-class-ac']} · ${a.cost}`, equippable: true })),
    ...(rs.gear ?? []).map(g => ({ name: g.item, cat: g.section, extra: `${g.cost} · ${g.weight}`, equippable: false })),
  ]
  const lista = q ? all.filter(x => x.name.toLowerCase().includes(q.toLowerCase())).slice(0, 25) : []
  const add = (x) => onPick({ refId: x.name, name: x.name, quantity: 1, equipped: false, attuned: false, notes: x.extra, equippable: x.equippable })
  return (
    <Sheet title="Agregar ítem" onClose={onClose}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar arma, armadura o equipo…" style={{ ...field, marginBottom: 8 }} autoFocus />
      {lista.map((x, i) => <button key={i} onClick={() => add(x)} style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 6, background: C.card2, fontFamily: FONT }}><div style={{ fontWeight: 800, color: C.text, fontSize: 13.5 }}>{x.name}</div><div style={{ fontSize: 11.5, color: C.sub }}>{x.cat} · {x.extra}</div></button>)}
      <div style={{ ...label, marginTop: 12 }}>O un ítem propio</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Nombre" style={{ ...field, flex: 1 }} />
        <button onClick={() => custom.trim() && onPick({ refId: null, name: custom.trim(), quantity: 1, equipped: false, attuned: false, notes: null, equippable: false })} style={btn('secondary')}>Agregar</button>
      </div>
    </Sheet>
  )
}
