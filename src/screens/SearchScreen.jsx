// ─────────────────────────────────────────────
// QUEST — SearchScreen
// Buscar usuarios, seguirlos y ver H2H directo.
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { searchUsers, toggleFollow, getFollowing } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'

export default function SearchScreen({ onViewProfile }) {
  const { profile } = useAuth()
  const [query,     setQuery]     = useState('')
  const [allUsers,  setAllUsers]  = useState([])
  const [following, setFollowing] = useState(new Set())
  const [fBusy,     setFBusy]     = useState(new Set())
  const [loading,   setLoading]   = useState(true)
  const inputRef = useRef(null)

  // Load all users + following state once
  useEffect(() => {
    Promise.all([
      searchUsers(''),
      getFollowing(),
    ]).then(([users, fwSet]) => {
      setAllUsers((users ?? []).filter(u => u.id !== profile?.id))
      setFollowing(fwSet || new Set())
    }).catch(() => {}).finally(() => setLoading(false))
  }, [profile?.id])

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  const q = query.trim().toLowerCase()
  const results = q
    ? allUsers.filter(u => u.username?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q))
    : allUsers

  const handleFollow = async (e, userId) => {
    e.stopPropagation()
    if (fBusy.has(userId)) return
    setFBusy(prev => new Set([...prev, userId]))
    const wasFollowing = following.has(userId)
    setFollowing(prev => {
      const next = new Set(prev)
      wasFollowing ? next.delete(userId) : next.add(userId)
      return next
    })
    try { await toggleFollow(userId) }
    catch { setFollowing(prev => { const next = new Set(prev); wasFollowing ? next.add(userId) : next.delete(userId); return next }) }
    finally { setFBusy(prev => { const next = new Set(prev); next.delete(userId); return next }) }
  }

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Search input */}
      <div style={{ padding: '8px 16px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#141414', border: '1.5px solid #222',
          borderRadius: 12, padding: '10px 14px',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar jugadores…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter, sans-serif',
            }}
          />
          {query.length > 0 && (
            <button onClick={() => setQuery('')} style={{
              background: 'none', border: 'none', color: '#4B5563',
              cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0,
            }}>✕</button>
          )}
        </div>
      </div>

      {/* Section header */}
      {!loading && (
        <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', padding: '0 16px 10px', fontFamily: 'Inter, sans-serif' }}>
          {q ? `${results.length} resultado${results.length !== 1 ? 's' : ''}` : `${allUsers.length} jugador${allUsers.length !== 1 ? 'es' : ''}`}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* Empty */}
      {!loading && results.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 14, color: '#4B5563', fontFamily: 'Inter, sans-serif' }}>
            {q ? `Sin resultados para "${query}"` : 'No hay jugadores aún'}
          </div>
        </div>
      )}

      {/* User list */}
      {!loading && results.length > 0 && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map(u => {
            const isFollowing = following.has(u.id)
            const busy = fBusy.has(u.id)
            return (
              <div
                key={u.id}
                onClick={() => onViewProfile?.(u.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: '#111111', border: '1px solid #1A1A1A',
                  borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onTouchStart={e => e.currentTarget.style.borderColor = '#2A2A2A'}
                onTouchEnd={e => e.currentTarget.style.borderColor = '#1A1A1A'}
              >
                {/* Avatar */}
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#1F1F1F' }}>
                  <Avatar url={u.avatar_url} size={44} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', fontFamily: 'Inter, sans-serif' }}>
                    @{u.username}
                  </div>
                  {u.full_name && (
                    <div style={{ fontSize: 12, color: '#4B5563', fontFamily: 'Inter, sans-serif', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.full_name}
                    </div>
                  )}
                </div>

                {/* Follow button */}
                <button
                  onClick={e => handleFollow(e, u.id)}
                  disabled={busy}
                  style={{
                    padding: '6px 14px', borderRadius: 8, flexShrink: 0,
                    background: isFollowing ? 'transparent' : '#FFFFFF',
                    border: isFollowing ? '1.5px solid #2A2A2A' : 'none',
                    color: isFollowing ? '#6B7280' : '#111111',
                    fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
                    fontFamily: 'Inter, sans-serif', opacity: busy ? 0.5 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {busy ? '…' : isFollowing ? 'Siguiendo' : 'Seguir'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
