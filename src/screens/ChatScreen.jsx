// ─────────────────────────────────────────────
// QUEST — ChatScreen
// Direct message overlay between two users
// ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markMessagesRead,
  subscribeToMessages,
  supabase,
} from '../lib/supabase'
import Avatar from '../components/Avatar'
import Spinner from '../components/Spinner'

const PAGE = 300 // messages per page

export default function ChatScreen({ otherUser, onBack }) {
  const { profile } = useAuth()
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages]             = useState([])
  const [text, setText]                     = useState('')
  const [sending, setSending]               = useState(false)
  const [loading, setLoading]               = useState(true)
  const [loadingMore, setLoadingMore]       = useState(false)
  const [hasMore, setHasMore]               = useState(false)
  const [sendError, setSendError]           = useState('')
  const bottomRef  = useRef(null)
  const listRef    = useRef(null)
  const convIdRef  = useRef(null)

  // Load / create conversation then subscribe to new messages
  useEffect(() => {
    let channel
    let cancelled = false

    ;(async () => {
      try {
        const cid  = await getOrCreateConversation(otherUser.id)
        const msgs = await getMessages(cid, PAGE)
        if (cancelled) return
        convIdRef.current = cid
        setConversationId(cid)
        setMessages(msgs)
        setHasMore(msgs.length === PAGE)
        await markMessagesRead(cid)

        channel = subscribeToMessages(cid, (msg) => {
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
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
      if (channel) supabase.removeChannel(channel)
    }
  }, [otherUser.id])

  // Scroll to bottom only on initial load and new messages sent by me
  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load older messages (pagination)
  const handleLoadMore = useCallback(async () => {
    if (!convIdRef.current || loadingMore || !hasMore) return
    const oldest = messages[0]?.created_at
    if (!oldest) return
    setLoadingMore(true)
    try {
      const older = await getMessages(convIdRef.current, PAGE, oldest)
      if (older.length < PAGE) setHasMore(false)
      if (older.length === 0) { setHasMore(false); return }
      // Remember scroll position so it doesn't jump to top
      const list = listRef.current
      const prevScrollHeight = list?.scrollHeight ?? 0
      setMessages(prev => [...older, ...prev])
      // Restore scroll position after prepend
      requestAnimationFrame(() => {
        if (list) list.scrollTop = list.scrollHeight - prevScrollHeight
      })
    } catch (e) {
      console.error('Load more error', e)
    }
    setLoadingMore(false)
  }, [convIdRef, loadingMore, hasMore, messages])

  const handleSend = async () => {
    if (!text.trim() || !conversationId || sending) return
    const body = text.trim()
    setText('')
    setSendError('')
    setSending(true)
    try {
      const msg = await sendMessage(conversationId, body, otherUser.id)
      setMessages(prev => [...prev, msg])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
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
        <Avatar url={otherUser.avatar_url} size={32} role={otherUser.role} isOwner={otherUser.is_owner} />
        <span style={s.username}>@{otherUser.username}</span>
      </div>

      {/* ── Message list ── */}
      <div ref={listRef} style={s.messageList}>
        {/* Load more button */}
        {!loading && hasMore && (
          <div style={{ textAlign: 'center', paddingBottom: 8 }}>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid #2A2A2A',
                borderRadius: 20, padding: '6px 18px',
                color: '#9CA3AF', fontSize: 12, fontWeight: 600,
                cursor: loadingMore ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {loadingMore ? 'Cargando…' : '↑ Ver mensajes anteriores'}
            </button>
          </div>
        )}

        {loading && (
          <div style={{ marginTop: 32 }}>
            <Spinner size="md" centered />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div style={s.emptyHint}>No hay mensajes aún. ¡Empieza la conversación!</div>
        )}

        {messages.map((m, i) => {
          const isMe = m.sender_id === profile?.id
          // Show date separator when day changes
          const prev = messages[i - 1]
          const showDate = !prev || new Date(m.created_at).toDateString() !== new Date(prev.created_at).toDateString()
          const dateLabel = (() => {
            const d = new Date(m.created_at)
            const now = new Date()
            if (d.toDateString() === now.toDateString()) return 'Hoy'
            const yest = new Date(now); yest.setDate(now.getDate() - 1)
            if (d.toDateString() === yest.toDateString()) return 'Ayer'
            return d.toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
          })()

          return (
            <div key={m.id}>
              {showDate && (
                <div style={{ textAlign: 'center', margin: '8px 0 4px' }}>
                  <span style={{ fontSize: 11, color: '#4B5563', fontFamily: 'Inter, sans-serif', background: '#111', padding: '2px 10px', borderRadius: 10 }}>
                    {dateLabel}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...s.bubble, ...(isMe ? s.bubbleMe : s.bubbleThem) }}>
                  {m.body}
                </div>
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
