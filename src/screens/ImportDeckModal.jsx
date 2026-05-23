// ─────────────────────────────────────────────
// QUEST — ImportDeckModal
// ─────────────────────────────────────────────
// Modal full-screen para importar un deck pasteando texto desde
// egmanevents, onepiecetopdecks, MTG Arena, Pokemon TCG Live, etc.
//
// Flow:
//   1. User pega el texto en el textarea
//   2. Parser detecta el formato + extrae cartas
//   3. Preview muestra qty + código + nombre por carta
//   4. User pone nombre al deck + (opcional) formato
//   5. Save → createDeck() → DB + redirect a "Mis Decks"
//
import { useState, useMemo } from 'react'
import { parseDeck, deckCardCount } from '../lib/deckParser'
import { createDeck } from '../lib/supabase'
import { GAMES, GAME_STYLES } from '../lib/constants'
import { useToast } from '../components/Toast'
import GameIcon from '../components/GameIcon'
import Spinner from '../components/Spinner'
import { X } from 'lucide-react'

export default function ImportDeckModal({ onClose, onCreated }) {
  const toast = useToast()
  const [step, setStep]       = useState('paste')   // 'paste' | 'preview'
  const [game, setGame]       = useState(null)      // user-selected o auto-detected
  const [raw, setRaw]         = useState('')
  const [deckName, setDeckName] = useState('')
  const [format, setFormat]   = useState('')
  const [saving, setSaving]   = useState(false)

  const parsed = useMemo(() => raw.trim() ? parseDeck(raw, game) : null, [raw, game])
  const detectedGame = parsed?.game
  const finalGame = game || detectedGame
  const totalMain = parsed ? deckCardCount(parsed) : 0
  const totalSide = parsed ? parsed.sideboard.reduce((s, c) => s + c.qty, 0) : 0

  const canPreview  = raw.trim().length > 10 && parsed?.main.length > 0
  const canSave     = step === 'preview' && finalGame && deckName.trim() && parsed?.main.length > 0 && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const list = [
        ...parsed.main.map(c => ({ code: c.code, qty: c.qty, name: c.name || c.code })),
        ...parsed.sideboard.map(c => ({ code: c.code, qty: c.qty, name: c.name || c.code, sideboard: true })),
      ]
      const deck = await createDeck({
        game: finalGame,
        name: deckName.trim(),
        format: format.trim() || null,
        list,
        visibility: 'private',
      })
      toast?.('Deck guardado', { type: 'success' })
      onCreated?.(deck)
      onClose?.()
    } catch (e) {
      toast?.(e?.message || 'Error al guardar el deck', { type: 'error' })
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
        display: 'flex', alignItems: 'center', gap: 12,
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
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif',
          letterSpacing: '-0.015em',
        }}>
          {step === 'paste' ? 'Importar deck' : 'Confirmar deck'}
        </div>
        {step === 'paste' && (
          <button onClick={() => setStep('preview')} disabled={!canPreview} className={canPreview ? 'pressable' : ''} style={{
            background: canPreview
              ? 'linear-gradient(135deg, #FB923C 0%, #F472B6 60%, #A78BFA 130%)'
              : 'rgba(255,255,255,0.04)',
            border: 'none', color: canPreview ? '#FFFFFF' : '#555',
            padding: '8px 16px', borderRadius: 10,
            fontSize: 13, fontWeight: 800, cursor: canPreview ? 'pointer' : 'default',
            fontFamily: 'Inter, sans-serif',
            boxShadow: canPreview ? '0 4px 14px rgba(251,146,60,0.30), inset 0 1px 0 rgba(255,255,255,0.20)' : 'none',
            textShadow: canPreview ? '0 1px 0 rgba(0,0,0,0.18)' : 'none',
          }}>Siguiente</button>
        )}
        {step === 'preview' && (
          <button onClick={handleSave} disabled={!canSave} className={canSave ? 'pressable' : ''} style={{
            background: canSave
              ? 'linear-gradient(135deg, #4ADE80 0%, #22D3EE 100%)'
              : 'rgba(255,255,255,0.04)',
            border: 'none', color: canSave ? '#062013' : '#555',
            padding: '8px 16px', borderRadius: 10,
            fontSize: 13, fontWeight: 800, cursor: canSave ? 'pointer' : 'default',
            fontFamily: 'Inter, sans-serif',
            boxShadow: canSave ? '0 4px 14px rgba(74,222,128,0.30), inset 0 1px 0 rgba(255,255,255,0.30)' : 'none',
          }}>{saving ? 'Guardando…' : '✓ Guardar'}</button>
        )}
      </div>

      {/* Body — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '18px 16px 40px' }}>
        {step === 'paste' && (
          <>
            {/* Hint card */}
            <div style={{
              padding: '12px 14px', borderRadius: 12, marginBottom: 16,
              background: 'rgba(167,139,250,0.08)',
              border: '1px solid rgba(167,139,250,0.25)',
              fontFamily: 'Inter, sans-serif',
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#A78BFA', letterSpacing: '-0.005em', marginBottom: 4 }}>
                💡 Cómo importar
              </div>
              <div style={{ fontSize: 12, color: '#C4B5FD', lineHeight: 1.45 }}>
                Pegá el deck list desde egmanevents, onepiecetopdecks, MTG Arena o
                Pokemon TCG Live. Formatos soportados:
                {' '}<code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>4 OP01-001</code>,
                {' '}<code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>4x OP01-001 Luffy</code>,
                {' '}<code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>4 Lightning Bolt (M21) 162</code>.
              </div>
            </div>

            {/* Game picker (optional pre-hint) */}
            <SectionLabel>TCG (opcional — auto-detectamos)</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              {GAMES.map(g => {
                const gs = GAME_STYLES[g] ?? {}
                const active = game === g
                return (
                  <button
                    key={g}
                    onClick={() => setGame(active ? null : g)}
                    style={{
                      padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                      background: active ? gs.bg : 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(18px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                      border: `1px solid ${active ? gs.border : 'rgba(255,255,255,0.08)'}`,
                      color: active ? gs.color : '#9CA3AF',
                      fontSize: 11, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all 0.2s',
                    }}
                  >
                    <GameIcon game={g} size={14} />{g}
                  </button>
                )
              })}
            </div>

            <SectionLabel>Pegá el deck list</SectionLabel>
            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              placeholder="Pegá tu deck list aquí…&#10;&#10;Ejemplo:&#10;4 OP01-001 Monkey D. Luffy&#10;4 OP01-013 Roronoa Zoro&#10;2 OP01-006 Nami"
              rows={14}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(18px) saturate(180%)',
                WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 12, padding: '12px 14px',
                color: '#FFFFFF', fontSize: 14, lineHeight: 1.5,
                fontFamily: 'Menlo, Monaco, "SF Mono", monospace',
                resize: 'vertical', minHeight: 220,
                outline: 'none', boxSizing: 'border-box',
              }}
            />

            {parsed && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                fontFamily: 'Inter, sans-serif',
              }}>
                <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5 }}>
                  Detectado: <strong style={{ color: detectedGame ? '#4ADE80' : '#F87171' }}>
                    {detectedGame ?? 'no se pudo auto-detectar'}
                  </strong>
                  {' · '}<strong style={{ color: '#FFFFFF' }}>{totalMain}</strong> cartas mainboard
                  {totalSide > 0 && <> · <strong>{totalSide}</strong> sideboard</>}
                  {parsed.warnings?.length > 0 && (
                    <> · <span style={{ color: '#FBBF24' }}>{parsed.warnings.length} línea(s) ignorada(s)</span></>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {step === 'preview' && parsed && (
          <>
            {/* Deck metadata */}
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

            {/* Game info */}
            <div style={{
              padding: '10px 12px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: 'Inter, sans-serif',
            }}>
              {finalGame ? <GameIcon game={finalGame} size={20} /> : <span>❓</span>}
              <div style={{ flex: 1, fontSize: 13, color: '#FFFFFF', fontWeight: 700 }}>
                {finalGame ?? 'TCG no detectado'} · <span style={{ color: '#9CA3AF', fontWeight: 600 }}>
                  {totalMain} cartas{totalSide > 0 && ` + ${totalSide} side`}
                </span>
              </div>
            </div>

            {/* Mainboard list */}
            <SectionLabel>Mainboard ({totalMain})</SectionLabel>
            <CardList cards={parsed.main} accent={finalGame ? GAME_STYLES[finalGame] : null} />

            {totalSide > 0 && (
              <>
                <SectionLabel>Sideboard ({totalSide})</SectionLabel>
                <CardList cards={parsed.sideboard} accent={finalGame ? GAME_STYLES[finalGame] : null} />
              </>
            )}

            {parsed.warnings?.length > 0 && (
              <>
                <SectionLabel>Líneas no parseables ({parsed.warnings.length})</SectionLabel>
                <div style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: 'rgba(251,191,36,0.06)',
                  border: '1px solid rgba(251,191,36,0.20)',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {parsed.warnings.slice(0, 8).map((w, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#FBBF24', marginBottom: 2 }}>· {w}</div>
                  ))}
                  {parsed.warnings.length > 8 && (
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                      + {parsed.warnings.length - 8} más…
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Back button */}
            <button
              onClick={() => setStep('paste')}
              style={{
                marginTop: 24, width: '100%', padding: '12px 0',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 12, color: '#9CA3AF',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >← Volver a editar</button>
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
      fontFamily: 'Inter, sans-serif', marginBottom: 8, marginTop: 6,
    }}>{children}</div>
  )
}

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.03)',
  backdropFilter: 'blur(18px) saturate(180%)',
  WebkitBackdropFilter: 'blur(18px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '11px 13px',
  color: '#FFFFFF', fontSize: 14,
  fontFamily: 'Inter, sans-serif',
  outline: 'none', marginBottom: 14, boxSizing: 'border-box',
}

function CardList({ cards, accent }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      marginBottom: 16,
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.06)',
      padding: '6px 8px',
    }}>
      {cards.map((c, i) => (
        <div key={`${c.code}-${i}`} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '7px 8px', borderRadius: 7,
          background: i % 2 ? 'transparent' : 'rgba(255,255,255,0.02)',
          fontFamily: 'Inter, sans-serif',
        }}>
          {/* Qty chip */}
          <div style={{
            minWidth: 28, height: 22, borderRadius: 6,
            background: accent?.bg || 'rgba(255,255,255,0.08)',
            border: `1px solid ${accent?.border || 'rgba(255,255,255,0.15)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accent?.color || '#FFFFFF',
            fontSize: 11, fontWeight: 800, letterSpacing: '-0.005em',
            flexShrink: 0,
          }}>×{c.qty}</div>

          {/* Code */}
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#9CA3AF',
            fontFamily: 'Menlo, Monaco, "SF Mono", monospace',
            minWidth: 86,
            flexShrink: 0,
          }}>{c.code}</div>

          {/* Name */}
          <div style={{
            flex: 1, minWidth: 0,
            fontSize: 13, color: '#E5E7EB',
            fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{c.name || <span style={{ color: '#4B5563', fontStyle: 'italic' }}>sin nombre</span>}</div>
        </div>
      ))}
    </div>
  )
}
