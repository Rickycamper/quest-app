// ─────────────────────────────────────────────
// QUEST — Toast notification system
// ─────────────────────────────────────────────
import { useState, useCallback, useRef, createContext, useContext } from 'react'

const ToastContext = createContext(null)

let _toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, { type = 'success', duration = 3000 } = {}) => {
    const id = ++_toastId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const colors = {
    success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', text: '#6EE7B7', icon: '✓' },
    error:   { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.3)',  text: '#FCA5A5', icon: '✕' },
    info:    { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.12)', text: '#E5E7EB', icon: 'ℹ' },
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div style={{
        position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
        zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none', width: 'calc(100% - 40px)', maxWidth: 340,
      }}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.info
          return (
            <div key={t.id} style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 12,
              padding: '11px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
              backdropFilter: 'blur(12px)',
              animation: 'toastIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: c.text, flexShrink: 0 }}>{c.icon}</span>
              <span style={{ fontSize: 13, color: c.text, fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
