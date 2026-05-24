// ─────────────────────────────────────────────
// QUEST — DeckCardGrid (shared)
// ─────────────────────────────────────────────
// Vista visual de un deck: grid 3 columnas con cada carta full-bleed,
// qty badge arriba a la derecha. Tap → modal de zoom full-screen.
// En modo `editing`, controles +/-/🗑 aparecen como overlay abajo.
//
// Usado por:
//   - DeckDetailOverlay (vista 'cards' de un deck guardado)
//   - CreateDeckBuilder (preview del deck que estás armando)
//
import { useState } from 'react'
import { proxyIfNeeded } from '../lib/cardImages'

const qtyBtnStyle = {
  width: 22, height: 22, borderRadius: 5,
  background: 'rgba(255,255,255,0.18)',
  border: '1px solid rgba(255,255,255,0.25)',
  color: '#FFF', fontSize: 14, fontWeight: 800,
  cursor: 'pointer', padding: 0, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'Inter, sans-serif',
}

export default function DeckCardGrid({ cards, accent, editing = false, columns = 3, onMinus, onPlus, onRemove }) {
  const [zoomCard, setZoomCard] = useState(null)
  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 8,
      }}>
        {cards.map((c, i) => {
          const url = proxyIfNeeded(c.image_url)
          return (
            <div
              key={`g-${c.code}-${i}`}
              style={{
                position: 'relative',
                aspectRatio: '5 / 7',
                borderRadius: 8,
                overflow: 'hidden',
                background: '#0A0A0F',
                border: `1px solid ${accent?.border || 'rgba(255,255,255,0.12)'}`,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                transition: 'transform 200ms cubic-bezier(0.34,1.45,0.64,1)',
              }}
              className="pressable"
              onClick={() => url && setZoomCard(c)}
            >
              {url ? (
                <img
                  src={url}
                  alt={c.name}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: '100%',
                  padding: 8, textAlign: 'center',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', fontFamily: 'Menlo, monospace', marginBottom: 4 }}>
                    {c.code}
                  </div>
                  <div style={{ fontSize: 10, color: '#E5E7EB', fontWeight: 600, lineHeight: 1.25 }}>
                    {c.name}
                  </div>
                </div>
              )}

              {/* Qty badge — arriba a la derecha */}
              <div style={{
                position: 'absolute', top: 4, right: 4,
                minWidth: 26, height: 26, borderRadius: 7,
                background: 'rgba(0,0,0,0.78)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                border: `1.5px solid ${accent?.border || 'rgba(255,255,255,0.30)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#FFFFFF', fontSize: 13, fontWeight: 900,
                letterSpacing: '-0.005em',
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                pointerEvents: 'none',
              }}>×{c.qty}</div>

              {/* Edit controls — overlay abajo */}
              {editing && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', bottom: 4, left: 4, right: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                    padding: '4px 6px', borderRadius: 6,
                    background: 'rgba(0,0,0,0.78)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                  }}
                >
                  <button onClick={() => onMinus?.(c.code)} style={qtyBtnStyle}>−</button>
                  <button onClick={() => onPlus?.(c.code)}  style={qtyBtnStyle}>+</button>
                  <button onClick={() => onRemove?.(c.code)} style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: '#F87171', padding: '0 4px', fontSize: 14,
                  }}>🗑</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Zoom modal — full screen image preview */}
      {zoomCard && (
        <div
          onClick={() => setZoomCard(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, cursor: 'zoom-out',
            animation: 'fadeUp 180ms ease',
          }}
        >
          <img
            src={proxyIfNeeded(zoomCard.image_url)}
            alt={zoomCard.name}
            style={{
              maxWidth: '100%', maxHeight: '100%',
              objectFit: 'contain', borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          />
        </div>
      )}
    </>
  )
}
