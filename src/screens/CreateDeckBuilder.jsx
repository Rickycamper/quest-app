// ─────────────────────────────────────────────
// QUEST — CreateDeckBuilder
// ─────────────────────────────────────────────
// Crear un deck desde cero con un buscador live. Sin pegar texto.
//
// Flow:
//   1. Elegís TCG → cargás el buscador
//   2. Tipeás nombre de carta → resultados combinados:
//        - de deck_cards (cartas ya en la DB de la comunidad)
//        - de Scryfall live (solo MTG) — cartas que la DB todavía no
//          tiene, se resuelven on-demand al tocar el resultado
//   3. Tap un resultado → agrega al list (qty=1, repeat = +1)
//   4. +/-/🗑 para ajustar
//   5. Nombre + formato → Guardar
//
import { useEffect, useMemo, useState } from 'react'
import { searchDeckCards, createDeck } from '../lib/supabase'
import { proxyIfNeeded } from '../lib/cardImages'
import { GAMES, GAME_STYLES } from '../lib/constants'
import { useToast } from '../components/Toast'
import GameIcon from '../components/GameIcon'
import Spinner from '../components/Spinner'
import DeckCardGrid from '../components/DeckCardGrid'
import { X } from 'lucide-react'

const SCRYFALL = 'https://api.scryfall.com'

export default function CreateDeckBuilder({ onClose, onCreated, initialGame = null }) {
  const toast = useToast()
  const [step, setStep] = useState(initialGame ? 'build' : 'game') // 'game' | 'build' | 'save'
  const [game, setGame] = useState(initialGame)
  const [list, setList] = useState([])  // [{ code, qty, name, image_url? }]
  const [deckName, setDeckName] = useState('')
  const [format, setFormat] = useState('')
  const [saving, setSaving] = useState(false)
  // Vista: 'cards' (visual, default) o 'list' (compacta texto). Persiste
  // en localStorage compartido con DeckDetailOverlay.
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('quest_deck_view') || 'cards' } catch { return 'cards' }
  })
  useEffect(() => {
    try { localStorage.setItem('quest_deck_view', viewMode) } catch {}
  }, [viewMode])

  // Search state
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [results, setResults] = useState([])  // mixed: { code, name, image_url, source: 'db' | 'scryfall' }
  const [searching, setSearching] = useState(false)

  const totalCards = list.reduce((s, c) => s + (c.qty || 0), 0)
  const gs = game ? GAME_STYLES[game] : {}

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 220)
    return () => clearTimeout(t)
  }, [query])

  // Search runner — combina DB + Scryfall (si es MTG)
  useEffect(() => {
    if (!game || step !== 'build') { setResults([]); return }
    if (debouncedQ.length < 2)     { setResults([]); return }
    let cancelled = false
    setSearching(true)
    ;(async () => {
      try {
        // 1. Buscar primero en nuestra DB
        const dbRows = await searchDeckCards(game, debouncedQ, 12).catch(() => [])
        if (cancelled) return
        const dbResults = dbRows.map(r => ({ ...r, source: 'db' }))

        let merged = dbResults

        // 2. MTG: también pegamos Scryfall autocomplete para sugerir cartas
        //    que la DB no tiene (se resuelven on-demand al tap).
        if (game === 'MTG' && dbResults.length < 6) {
          try {
            const acRes = await fetch(`${SCRYFALL}/cards/autocomplete?q=${encodeURIComponent(debouncedQ)}`)
            if (acRes.ok) {
              const ac = await acRes.json()
              const names = ac.data ?? []
              // Filtrar nombres que ya están en dbResults (case-insensitive)
              const dbNames = new Set(dbResults.map(r => r.name.toLowerCase()))
              const newOnes = names
                .filter(n => !dbNames.has(n.toLowerCase()))
                .slice(0, 8 - dbResults.length)
                .map(name => ({ name, code: null, source: 'scryfall' }))
              merged = [...dbResults, ...newOnes]
            }
          } catch { /* silent */ }
        }
        if (!cancelled) setResults(merged)
      } finally {
        if (!cancelled) setSearching(false)
      }
    })()
    return () => { cancelled = true }
  }, [debouncedQ, game, step])

  const handlePickGame = (g) => { setGame(g); setStep('build') }

  const addCardFromResult = async (result) => {
    let card = result
    // Si viene de Scryfall sin código, resolvemos por nombre exact
    if (result.source === 'scryfall' && !result.code) {
      try {
        const r = await fetch(`${SCRYFALL}/cards/named?exact=${encodeURIComponent(result.name)}`)
        if (!r.ok) throw new Error('Scryfall no encontró la carta')
        const d = await r.json()
        const img = d.image_uris?.normal || d.image_uris?.large || d.card_faces?.[0]?.image_uris?.normal
        card = {
          code: `${d.set?.toUpperCase()}-${(d.collector_number || '').padStart(3, '0')}`,
          name: d.name,
          image_url: img,
          source: 'scryfall',
        }
      } catch (e) {
        toast?.(e.message || 'No se pudo resolver la carta', { type: 'error' })
        return
      }
    }
    setList(prev => {
      const existing = prev.find(c => c.code === card.code)
      if (existing) {
        return prev.map(c => c.code === card.code ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, { code: card.code, name: card.name, qty: 1, image_url: card.image_url }]
    })
    // Limpiar el search para agregar otra
    setQuery(''); setResults([])
  }

  const adjustQty = (code, delta) => {
    setList(prev => prev.flatMap(c => {
      if (c.code !== code) return [c]
      const newQty = c.qty + delta
      if (newQty <= 0) return []
      return [{ ...c, qty: newQty }]
    }))
  }
  const removeCard = (code) => setList(prev => prev.filter(c => c.code !== code))

  const canSave = step === 'save' && deckName.trim() && list.length > 0 && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const deck = await createDeck({
        game,
        name: deckName.trim(),
        format: format.trim() || null,
        list,
        visibility: 'private',
      })
      toast?.('Deck guardado', { type: 'success' })
      onCreated?.(deck)
      onClose?.()
    } catch (e) {
      toast?.(e?.message || 'No se pudo guardar', { type: 'error' })
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      background: 'rgba(10,10,18,0.72)',
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      animation: 'slideUp 0.22s ease',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px 12px', flexShrink: 0,
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
      }}>
        <button onClick={onClose} aria-label="Cerrar" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#9CA3AF', padding: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={22} strokeWidth={2.2} />
        </button>
        <div style={{
          flex: 1, fontSize: 17, fontWeight: 700, color: '#FFFFFF',
          fontFamily: 'Inter, sans-serif', letterSpacing: '-0.015em',
        }}>
          {step === 'game' ? 'Nuevo deck' : step === 'build' ? `Armar deck · ${totalCards} cartas` : 'Guardar deck'}
        </div>
        {step === 'build' && (
          <button onClick={() => setStep('save')} disabled={list.length === 0} className={list.length ? 'pressable' : ''} style={{
            background: list.length
              ? 'linear-gradient(135deg, #FB923C 0%, #F472B6 60%, #A78BFA 130%)'
              : 'rgba(255,255,255,0.04)',
            border: 'none', color: list.length ? '#FFFFFF' : '#555',
            padding: '8px 16px', borderRadius: 10,
            fontSize: 13, fontWeight: 800, cursor: list.length ? 'pointer' : 'default',
            fontFamily: 'Inter, sans-serif',
            boxShadow: list.length ? '0 4px 14px rgba(251,146,60,0.30), inset 0 1px 0 rgba(255,255,255,0.20)' : 'none',
          }}>Siguiente</button>
        )}
        {step === 'save' && (
          <button onClick={handleSave} disabled={!canSave} className={canSave ? 'pressable' : ''} style={{
            background: canSave
              ? 'linear-gradient(135deg, #4ADE80 0%, #22D3EE 100%)'
              : 'rgba(255,255,255,0.04)',
            border: 'none', color: canSave ? '#062013' : '#555',
            padding: '8px 16px', borderRadius: 10,
            fontSize: 13, fontWeight: 800, cursor: canSave ? 'pointer' : 'default',
            fontFamily: 'Inter, sans-serif',
            boxShadow: canSave ? '0 4px 14px rgba(74,222,128,0.30), inset 0 1px 0 rgba(255,255,255,0.30)' : 'none',
          }}>{saving ? '…' : '✓ Guardar'}</button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 32px' }}>
        {/* STEP: game picker */}
        {step === 'game' && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', marginBottom: 14, fontFamily: 'Inter, sans-serif' }}>
              ¿Para qué TCG?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {GAMES.map(g => {
                const gsX = GAME_STYLES[g] ?? {}
                return (
                  <button
                    key={g}
                    onClick={() => handlePickGame(g)}
                    className="pressable"
                    style={{
                      padding: '16px 14px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(18px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                      border: `1px solid ${gsX.border || 'rgba(255,255,255,0.10)'}`,
                      cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 12,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 9,
                      background: gsX.bg || 'rgba(255,255,255,0.06)',
                      border: `1px solid ${gsX.border || 'rgba(255,255,255,0.12)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <GameIcon game={g} size={18} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFF' }}>{g}</div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* STEP: build */}
        {step === 'build' && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 14px', borderRadius: 12, marginBottom: 12,
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(18px) saturate(180%)',
              WebkitBackdropFilter: 'blur(18px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}>
              <span style={{ fontSize: 14, color: '#9CA3AF' }}>🔍</span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={game === 'MTG' ? 'Buscar carta (DB + Scryfall)…' : 'Buscar carta en el catálogo…'}
                autoFocus
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#FFFFFF', fontFamily: 'Inter, sans-serif',
                }}
              />
              {searching && <span style={{ fontSize: 11, color: '#6B7280' }}>…</span>}
              {query && (
                <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 14 }}>✕</button>
              )}
            </div>

            {results.length > 0 && (
              <div style={{
                marginBottom: 12,
                maxHeight: 360, overflowY: 'auto',
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                fontFamily: 'Inter, sans-serif',
              }}>
                {results.map((r, i) => (
                  <BuilderSearchResultRow
                    key={`${r.source}-${r.code || r.name}-${i}`}
                    result={r}
                    accent={gs}
                    onPick={() => addCardFromResult(r)}
                  />
                ))}
              </div>
            )}

            {debouncedQ.length >= 2 && !searching && results.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 11, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
                Sin resultados. Probá otro nombre o importá un deck list primero para poblar la DB.
              </div>
            )}

            {/* Current list */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              margin: '14px 4px 8px',
              fontFamily: 'Inter, sans-serif',
            }}>
              <div style={{
                fontSize: 10, color: '#6B7280', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>Tu deck ({totalCards})</div>
              {list.length > 0 && (
                <button
                  onClick={() => setViewMode(v => v === 'cards' ? 'list' : 'cards')}
                  aria-label={viewMode === 'cards' ? 'Ver como lista' : 'Ver como cartas'}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: '#FFFFFF',
                    width: 28, height: 28, borderRadius: 7,
                    cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontFamily: 'Inter, sans-serif',
                  }}
                >{viewMode === 'cards' ? '☰' : '▦'}</button>
              )}
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, padding: viewMode === 'cards' ? 8 : '6px 8px',
              minHeight: 80,
            }}>
              {list.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: '#6B7280', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
                  Buscá y agregá cartas arriba ↑
                </div>
              ) : viewMode === 'cards' ? (
                <DeckCardGrid
                  cards={list}
                  accent={gs}
                  editing
                  columns={3}
                  onMinus={code => adjustQty(code, -1)}
                  onPlus={code => adjustQty(code, +1)}
                  onRemove={code => removeCard(code)}
                />
              ) : (
                list.map((c, i) => (
                  <BuilderCardRow
                    key={`${c.code}-${i}`}
                    card={c}
                    accent={gs}
                    onMinus={() => adjustQty(c.code, -1)}
                    onPlus={() => adjustQty(c.code, +1)}
                    onRemove={() => removeCard(c.code)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* STEP: save */}
        {step === 'save' && (
          <>
            <SectionLabel>Nombre del deck</SectionLabel>
            <input
              value={deckName}
              onChange={e => setDeckName(e.target.value.slice(0, 60))}
              placeholder="ej. Luffy Red Aggro"
              autoFocus
              style={inputStyle}
            />
            <SectionLabel>Formato (opcional)</SectionLabel>
            <input
              value={format}
              onChange={e => setFormat(e.target.value.slice(0, 40))}
              placeholder="ej. Standard, OP01-OP15, Commander"
              style={{ ...inputStyle, marginBottom: 18 }}
            />
            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: 'Inter, sans-serif',
            }}>
              <GameIcon game={game} size={20} />
              <div style={{ flex: 1, fontSize: 13, color: '#FFFFFF', fontWeight: 700 }}>
                {game} · <span style={{ color: '#9CA3AF', fontWeight: 600 }}>{totalCards} cartas</span>
              </div>
            </div>
            <button
              onClick={() => setStep('build')}
              style={{
                marginTop: 16, width: '100%', padding: '11px 0',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 12, color: '#9CA3AF',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >← Volver al builder</button>
          </>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, color: '#6B7280', fontWeight: 700,
      letterSpacing: '0.10em', textTransform: 'uppercase',
      fontFamily: 'Inter, sans-serif', marginBottom: 8,
    }}>{children}</div>
  )
}

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.03)',
  backdropFilter: 'blur(18px) saturate(180%)',
  WebkitBackdropFilter: 'blur(18px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '11px 13px',
  color: '#FFFFFF',
  fontFamily: 'Inter, sans-serif',
  outline: 'none', marginBottom: 14, boxSizing: 'border-box',
}

const qtyBtnStyle = {
  width: 22, height: 22, borderRadius: 5,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#FFF', fontSize: 13, fontWeight: 800,
  cursor: 'pointer', padding: 0, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'Inter, sans-serif',
}

// Resultado del buscador del builder. Muestra thumbnail + código (o
// fuente Scryfall si la carta todavía no está en deck_cards) + nombre.
// El thumbnail es clave cuando hay varias versiones de la misma carta
// (ej. Greymon en BT1, BT5, EX1 con arte distinto).
function BuilderSearchResultRow({ result, accent, onPick }) {
  const [imgErr, setImgErr] = useState(false)
  const url = !imgErr && result.image_url ? proxyIfNeeded(result.image_url) : null
  return (
    <button onClick={onPick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', background: 'transparent', border: 'none',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      cursor: 'pointer', textAlign: 'left',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        width: 52, height: 72, borderRadius: 6,
        background: '#0A0A0F',
        border: '1px solid rgba(255,255,255,0.10)',
        overflow: 'hidden', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        {url ? (
          <img
            src={url}
            alt=""
            loading="lazy"
            onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 18, color: '#374151' }}>🎴</span>
        )}
      </div>
      {result.code ? (
        <span style={{
          fontSize: 11, color: '#9CA3AF', fontFamily: 'Menlo, monospace',
          minWidth: 80, flexShrink: 0,
        }}>{result.code}</span>
      ) : (
        <span style={{
          fontSize: 9, color: '#60A5FA', fontWeight: 800,
          letterSpacing: '0.06em',
          minWidth: 80, flexShrink: 0,
        }}>SCRYFALL</span>
      )}
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 13, color: '#E5E7EB', fontWeight: 600,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{result.name}</span>
      <span style={{
        fontSize: 11, color: accent?.color || '#FB923C', fontWeight: 800,
        flexShrink: 0,
      }}>+</span>
    </button>
  )
}

function BuilderCardRow({ card, accent, onMinus, onPlus, onRemove }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 8px', borderRadius: 7,
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <button onClick={onMinus} style={qtyBtnStyle}>−</button>
        <div style={{
          minWidth: 26, height: 22, borderRadius: 6,
          background: accent?.bg || 'rgba(255,255,255,0.08)',
          border: `1px solid ${accent?.border || 'rgba(255,255,255,0.15)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent?.color || '#FFFFFF', fontSize: 11, fontWeight: 800,
        }}>{card.qty}</div>
        <button onClick={onPlus} style={qtyBtnStyle}>+</button>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', fontFamily: 'Menlo, monospace', minWidth: 86, flexShrink: 0 }}>
        {card.code}
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#E5E7EB', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {card.name}
      </div>
      <button onClick={onRemove} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: '#F87171', padding: 4, fontSize: 13,
      }}>🗑</button>
    </div>
  )
}
