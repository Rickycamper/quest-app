// ─────────────────────────────────────────────
// QUEST — Confirm dialog (replaces native window.confirm)
//
// Promise-based API that matches the imperative shape of window.confirm
// so we can replace it one-for-one without restructuring callsites:
//
//   const confirm = useConfirm()
//   const ok = await confirm('¿Borrar este post?', { destructive: true })
//   if (ok) doDelete()
//
// Why: native window.confirm() renders as a system dialog (looks like
// "questhobbystore.com says..." on iOS) — ugly, blocking, and breaks the
// app's design language. This in-app version uses the same animation,
// blur, and motion system as the rest of the UI.
// ─────────────────────────────────────────────
import { createContext, useContext, useState, useRef, useCallback } from 'react'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)   // { message, options, resolve } | null
  const resolveRef = useRef(null)

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setState({
        message,
        confirmLabel: options.confirmLabel ?? 'Aceptar',
        cancelLabel:  options.cancelLabel  ?? 'Cancelar',
        destructive:  !!options.destructive,
        title:        options.title ?? null,
      })
    })
  }, [])

  const close = (value) => {
    setState(null)
    resolveRef.current?.(value)
    resolveRef.current = null
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => close(false)}   // tap backdrop = cancel
          style={{
            position: 'fixed', inset: 0, zIndex: 99998,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
            animation: 'fadeInFast 0.18s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 320,
              background: '#111111', border: '1px solid #2A2A2A',
              borderRadius: 16, padding: '20px 18px 14px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
              animation: 'slideUp 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {state.title && (
              <div style={{
                fontSize: 15, fontWeight: 800, color: '#FFFFFF',
                marginBottom: 6, lineHeight: 1.3,
              }}>{state.title}</div>
            )}
            <div style={{
              fontSize: 13.5, color: '#D1D5DB',
              lineHeight: 1.55, marginBottom: 18,
            }}>{state.message}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => close(false)}
                style={{
                  flex: 1, padding: '11px 0',
                  background: 'transparent', border: '1px solid #2A2A2A',
                  borderRadius: 10,
                  color: '#9CA3AF', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onTouchStart={e => e.currentTarget.style.transform = 'scale(0.96)'}
                onTouchEnd  ={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                onMouseUp  ={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {state.cancelLabel}
              </button>
              <button
                onClick={() => close(true)}
                autoFocus
                style={{
                  flex: 1, padding: '11px 0',
                  background: state.destructive ? '#EF4444' : '#FFFFFF',
                  border: 'none', borderRadius: 10,
                  color: state.destructive ? '#FFFFFF' : '#111111',
                  fontSize: 13, fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onTouchStart={e => e.currentTarget.style.transform = 'scale(0.96)'}
                onTouchEnd  ={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                onMouseUp  ={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  return useContext(ConfirmContext)
}
