// ─────────────────────────────────────────────
// QUEST — ProfileScreen
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getProfile, getUserPosts, getFollowCounts, toggleFollow, getFollowing, getHeadToHead, resetH2H } from '../lib/supabase'
import { GAME_STYLES, BRANCH_STYLES } from '../lib/constants'
import Avatar from '../components/Avatar'
import { PremiumBadge, RoleBadge, MapPinIcon } from '../components/Icons'
import GameIcon from '../components/GameIcon'
import H2HModal from '../components/H2HModal'

const POST_TYPE_COLORS = {
  quiero: '#F59E0B',
  tengo:  '#60A5FA',
  tradeo: '#A78BFA',
  vendo:  '#4ADE80',
}

function EditIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

export default function ProfileScreen({ userId, currentUserId, onBack, onEditProfile, onMessage, onVs }) {
  const { profile: myProfile } = useAuth()
  const isPremium = myProfile?.role === 'premium' || myProfile?.role === 'admin'
  const [profile,   setProfile]   = useState(null)
  const [posts,     setPosts]     = useState([])
  const [counts,    setCounts]    = useState({ followers: 0, following: 0 })
  const [isFollowing, setIsFollowing] = useState(false)
  const [h2h,       setH2h]       = useState(null)  // { wins, losses, total, matches }
  const [showH2H,   setShowH2H]   = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')
  const [fBusy,     setFBusy]     = useState(false)
  const [selected,  setSelected]  = useState(null)  // post modal

  const isOwn = userId === currentUserId

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    Promise.all([
      getProfile(userId),
      getUserPosts(userId),
      getFollowCounts(userId),
      !isOwn ? getFollowing() : Promise.resolve(new Set()),
      !isOwn ? getHeadToHead(userId, isPremium).catch(() => null) : Promise.resolve(null),
    ]).then(([prof, userPosts, cnt, followingSet, h2hData]) => {
      if (cancelled) return
      setProfile(prof)
      setPosts(userPosts)
      setCounts(cnt)
      setIsFollowing(followingSet.has(userId))
      setH2h(h2hData)
    }).catch(e => {
      if (!cancelled) setLoadError(e?.message || 'Error al cargar el perfil')
    })
    .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId, isPremium])

  const handleFollow = async () => {
    if (fBusy) return
    setFBusy(true)
    try {
      await toggleFollow(userId)
      const now = !isFollowing
      setIsFollowing(now)
      setCounts(c => ({ ...c, followers: c.followers + (now ? 1 : -1) }))
    } catch {}
    setFBusy(false)
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A', minHeight: '100%' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  if (loadError) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A', minHeight: '100%', padding: 32, gap: 12 }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ fontSize: 14, color: '#F87171', textAlign: 'center' }}>{loadError}</div>
      <button onClick={onBack} style={{ padding: '8px 20px', borderRadius: 8, background: '#1A1A1A', border: '1px solid #333', color: '#FFF', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>← Volver</button>
    </div>
  )

  return (
    <div style={{ background: '#0A0A0A', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px 10px', gap: 12 }}>
        <button onClick={onBack} style={{
          width: 36, height: 36, borderRadius: 10,
          border: '1.5px solid #2A2A2A', background: '#1A1A1A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#FFFFFF', fontSize: 18, flexShrink: 0,
        }}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
          @{profile?.username ?? '...'}
          {profile?.role === 'premium' && <PremiumBadge size={14} />}
          <RoleBadge isOwner={profile?.is_owner} role={profile?.role} size={14} />
        </span>
        {isOwn && (
          <button onClick={onEditProfile} style={{
            width: 36, height: 36, borderRadius: 10,
            border: '1.5px solid #2A2A2A', background: '#1A1A1A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#9CA3AF', flexShrink: 0,
          }}>
            <EditIcon />
          </button>
        )}
      </div>

      {/* Profile header */}
      <div style={{ padding: '8px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 14 }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#1F1F1F', border: '2px solid #2A2A2A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, flexShrink: 0, overflow: 'hidden',
          }}>
            <Avatar url={profile?.avatar_url} size={72} />
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 20, flex: 1, paddingBottom: 4 }}>
            {[
              { label: 'Posts',    value: posts.length },
              { label: 'Seguidores', value: counts.followers },
              { label: 'Siguiendo',  value: counts.following },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#FFFFFF' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Name + info */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6 }}>
            {profile?.username}
            {profile?.verified && <span style={{ fontSize: 13, color: '#60A5FA' }}>✓</span>}
            {profile?.role === 'premium' && <PremiumBadge size={14} />}
            <RoleBadge isOwner={profile?.is_owner} role={profile?.role} size={14} />
          </div>
          {profile?.branch && (
            <div style={{ fontSize: 12, color: BRANCH_STYLES[profile.branch]?.color ?? '#6B7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPinIcon size={11} color={BRANCH_STYLES[profile.branch]?.color ?? '#6B7280'} />
              {profile.branch}
            </div>
          )}
          {/* Contact info — only visible on own profile */}
          {isOwn && (profile?.phone || profile?.email) && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {profile.phone && (
                <div style={{ fontSize: 12, color: '#4B5563' }}>📞 {profile.phone}</div>
              )}
              {profile.email && (
                <div style={{ fontSize: 12, color: '#4B5563' }}>✉️ {profile.email}</div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {isOwn ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onEditProfile} style={{
              flex: 1, padding: '9px 0',
              borderRadius: 8, background: 'transparent',
              border: '1.5px solid #2A2A2A',
              color: '#9CA3AF', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Editar perfil
            </button>
            {/* Log a duel from your own profile — search for opponent inside modal */}
            <button
              onClick={() => onVs?.()}
              style={{
                flex: 1, padding: '9px 0',
                borderRadius: 8, background: 'transparent',
                border: '1.5px solid #2A2A2A',
                color: '#FB923C', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
            >
              ⚔️ Duelo
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Follow + Message row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleFollow} disabled={fBusy} style={{
                flex: 1, padding: '9px 0',
                borderRadius: 8,
                background: isFollowing ? 'transparent' : '#FFFFFF',
                border: `1.5px solid ${isFollowing ? '#2A2A2A' : '#FFFFFF'}`,
                color: isFollowing ? '#9CA3AF' : '#111111',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
              }}>
                {isFollowing ? 'Siguiendo' : '+ Seguir'}
              </button>
              <button
                onClick={() => onMessage?.({ id: profile.id, username: profile.username, avatar_url: profile.avatar_url })}
                style={{
                  flex: 1, padding: '9px 0',
                  borderRadius: 8, background: 'transparent',
                  border: '1.5px solid #2A2A2A',
                  color: '#9CA3AF', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Mensaje
              </button>
            </div>

            {/* VS / Duel button — pre-fills this user as opponent */}
            <button
              onClick={() => onVs?.({ id: profile.id, username: profile.username })}
              style={{
                width: '100%', padding: '9px 0',
                borderRadius: 8, background: 'transparent',
                border: '1.5px solid rgba(251,146,60,0.35)',
                color: '#FB923C', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
            >
              ⚔️ Registrar duelo
            </button>

            {/* H2H stats banner — tappable to open detail modal */}
            {h2h && (
              <button onClick={() => setShowH2H(true)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.18)',
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer', width: '100%',
              }}>
                <span style={{ fontSize: 11, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>⚔️ H2H</span>
                {h2h.total > 0 ? (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#4ADE80', fontFamily: 'Inter, sans-serif' }}>{h2h.wins}V</span>
                    <span style={{ fontSize: 11, color: '#444' }}>·</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#F87171', fontFamily: 'Inter, sans-serif' }}>{h2h.losses}D</span>
                    <span style={{ fontSize: 11, color: '#444' }}>·</span>
                    <span style={{ fontSize: 11, color: '#555', fontFamily: 'Inter, sans-serif' }}>{h2h.total} total</span>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: '#555', fontFamily: 'Inter, sans-serif' }}>Sin partidas aún</span>
                )}
                <span style={{ fontSize: 11, color: '#444', marginLeft: 'auto' }}>›</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#1A1A1A' }} />

      {/* Post grid — hide private posts when viewing someone else's profile */}
      {(() => {
        const visiblePosts = isOwn ? posts : posts.filter(p => !p.caption?.includes('[PRIVADO]'))
        return visiblePosts.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🃏</div>
            <div style={{ fontSize: 14, color: '#4B5563' }}>No hay posts aún</div>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 2, padding: 2,
          }}>
            {visiblePosts.map(post => {
              const gs = GAME_STYLES[post.tag] ?? GAME_STYLES['MTG']
              return (
                <div key={post.id} onClick={() => setSelected(post)}
                  style={{
                    aspectRatio: '1', position: 'relative',
                    background: '#1A1A1A', cursor: 'pointer', overflow: 'hidden',
                  }}>
                  {post.image_url ? (
                    <img src={post.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      padding: 8,
                      background: gs.bg,
                    }}>
                      <div style={{ marginBottom: 4 }}><GameIcon game={post.tag} size={22} /></div>
                      <div style={{ fontSize: 9, color: gs.color, fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>
                        {post.caption?.slice(0, 40)}
                      </div>
                    </div>
                  )}

                  {/* Like count overlay */}
                  {(post.post_likes?.[0]?.count ?? 0) > 0 && (
                    <div style={{
                      position: 'absolute', bottom: 4, left: 4,
                      display: 'flex', alignItems: 'center', gap: 3,
                      background: 'rgba(0,0,0,0.6)', borderRadius: 4,
                      padding: '2px 5px', fontSize: 10, color: '#FFF',
                    }}>
                      ❤️ {post.post_likes[0].count}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Post detail modal */}
      {selected && (
        <PostModal post={selected} onClose={() => setSelected(null)} profile={profile} />
      )}

      {/* H2H detail modal */}
      {showH2H && h2h && (
        <H2HModal
          opponentName={profile?.username}
          opponentId={userId}
          h2h={h2h}
          isPremium={isPremium}
          onClose={() => setShowH2H(false)}
          onReset={async () => {
            await resetH2H(userId)
            const fresh = await getHeadToHead(userId, isPremium)
            setH2h(fresh)
          }}
        />
      )}
    </div>
  )
}

function PostModal({ post, profile, onClose }) {
  const gs = GAME_STYLES[post.tag] ?? GAME_STYLES['MTG']
  function timeAgo(d) {
    const m = Math.floor((Date.now() - new Date(d)) / 60000)
    if (m < 1) return 'ahora'
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
  }

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'flex-end', zIndex: 100,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#111111', borderRadius: '14px 14px 0 0',
        width: '100%', maxHeight: '85%', overflowY: 'auto', scrollbarWidth: 'none',
        padding: '20px 20px 40px',
        animation: 'slideUp 0.25s ease',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#2A2A2A', margin: '0 auto 20px' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1F1F1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, overflow: 'hidden' }}>
            <Avatar url={profile?.avatar_url} size={36} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>@{profile?.username}</div>
            <div style={{ fontSize: 11, color: '#4B5563' }}>{timeAgo(post.created_at)}</div>
          </div>
          <div style={{ padding: '3px 10px', borderRadius: 8, background: gs.bg, border: `1px solid ${gs.border}`, color: gs.color, fontSize: 11, fontWeight: 600 }}>
            <GameIcon game={post.tag} size={11} /> {post.tag}
          </div>
        </div>

        {/* Caption */}
        <p style={{ fontSize: 14, color: '#D1D5DB', lineHeight: 1.7, marginBottom: post.image_url ? 14 : 0 }}>
          {post.caption}
        </p>

        {/* Image */}
        {post.image_url && (
          <div style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: '1' }}>
            <img src={post.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
          <span style={{ color: '#9CA3AF', fontSize: 13 }}>
            ❤️ {post.post_likes?.[0]?.count ?? 0}
          </span>
          <span style={{ color: '#9CA3AF', fontSize: 13 }}>
            💬 {post.post_comments?.[0]?.count ?? 0}
          </span>
        </div>
      </div>
    </div>
  )
}
