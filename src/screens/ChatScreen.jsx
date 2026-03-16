// ─────────────────────────────────────────────
// QUEST — ChatScreen
// Direct message overlay between two users
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markMessagesRead,
  subscribeToMessages,
} from '../lib/supabase'
import Avatar from '../components/Avatar'

export default function ChatScreen({ otherUser, onBack }) {
  const { profile } = useAuth()
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages]             = useState([])
  const [text, setText]                     = useState('')
  const [sending, setSending]               = useState(false)
  const [loading, setLoading]               = useState(true)
  const [sendError, setSendError]           = useState('')
  const bottomRef = useRef(null)

  // Load / create conversation then subscribe to new messages
  useEffect(() => {
    let channel
    let cancelled = false

    ;(async () => {
      try {
        const cid  = await getOrCreateConversation(otherUser.id)
        const msgs = await getMessages(cid)
        if (cancelled) return
        setConversationId(cid)
        setMessages(msgs)
        await markMessagesRead(cid)

        channel = subscribeToMessages(cid, (msg) => {
          setMessages(prev => [...prev, msg])
          markMessagesRead(cid)
        })
      } catch (e) {
        if (!cancelled) console.error('Chat load error', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      channel?.unsubscribe()
    }
  }, [otherUser.id])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!text.trim() || !conversationId || sending) return
    const body = text.trim()
    setText('')
    setSendError('')
    setSending(true)
    try {
      const msg = await sendMessage(conversationId, body, otherUser.id)
      setMessages(prev => [...prev, msg])
    } catch (e) {
      setText(body) // restore on failure
      setSendError(e.message || 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={s.root}>
      {/* ── Header ── */}
      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>←</button>
        <Avatar userId={otherUser.id} size={32} />
        <span style={s.username}>@{otherUser.username}</span>
      </div>

      {/* ── Message list ── */}
      <div style={s.messageList}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div style={s.emptyHint}>No hay mensajes aún. ¡Empieza la conversación!</div>
        )}
        {messages.map(m => {
          const isMe = m.sender_id === profile?.id
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ ...s.bubble, ...(isMe ? s.bubbleMe : s.bubbleThem) }}>
                {m.body}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Send error ── */}
      {sendError && (
        <div style={{ padding: '6px 16px', background: 'rgba(239,68,68,0.1)', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
          <span style={{ fontSize: 12, color: '#F87171', fontFamily: 'Inter, sans-serif' }}>{sendError}</span>
        </div>
      )}

      {/* ── Input bar ── */}
      <div style={s.inputBar}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Escribe un mensaje…"
          maxLength={1000}
          style={s.input}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          style={{ ...s.sendBtn, opacity: (!text.trim() || sending) ? 0.4 : 1 }}
        >
          →
        </button>
      </div>
    </div>
  )
}

const s = {
  root: {
    display: 'flex', flexDirection: 'column',
    height: '100%', background: '#0A0A0A',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 16px 12px',
    borderBottom: '1px solid #1A1A1A',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none', border: 'none',
    color: '#9CA3AF', cursor: 'pointer',
    fontSize: 20, padding: 0, lineHeight: 1,
  },
  username: {
    color: '#FFFFFF', fontWeight: 700,
    fontSize: 15, fontFamily: 'Inter, sans-serif',
  },
  messageList: {
    flex: 1, overflowY: 'auto',
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
    scrollbarWidth: 'none',
  },
  emptyHint: {
    color: '#555', fontSize: 13,
    textAlign: 'center', marginTop: 32,
    fontFamily: 'Inter, sans-serif',
  },
  bubble: {
    maxWidth: '72%', padding: '9px 13px',
    fontSize: 14, lineHeight: 1.45,
    fontFamily: 'Inter, sans-serif',
    wordBreak: 'break-word',
  },
  bubbleMe: {
    borderRadius: '16px 16px 4px 16px',
    background: '#FFFFFF', color: '#111111',
  },
  bubbleThem: {
    borderRadius: '16px 16px 16px 4px',
    background: '#1A1A1F', color: '#E5E5E5',
  },
  inputBar: {
    display: 'flex', gap: 8,
    padding: '10px 16px 14px',
    borderTop: '1px solid #1A1A1F',
    background: '#0F0F0F',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: '#1A1A1F',
    border: '1px solid #2A2A2A',
    borderRadius: 20,
    padding: '9px 14px',
    color: '#FFFFFF',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
  },
  sendBtn: {
    background: '#FFFFFF', border: 'none',
    borderRadius: 20, padding: '9px 18px',
    fontWeight: 700, fontSize: 15,
    color: '#111111', cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
}
