// ─────────────────────────────────────────────
// QUEST — ProfileScreen
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getProfile, getUserPosts, getFollowCounts, toggleFollow, getFollowing, getHeadToHead, resetH2H, getMyStats, redeemPoints } from '../lib/supabase'
import { GAME_STYLES, BRANCH_STYLES } from '../lib/constants'
import Avatar from '../components/Avatar'
import { PremiumBadge, RoleBadge, MapPinIcon, PAID_ROLES } from '../components/Icons'
import GameIcon from '../components/GameIcon'
import H2HModal from '../components/H2HModal'
import Spinner from '../components/Spinner'

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
  const [showStats,    setShowStats]    = useState(false)
  const [myStats,      setMyStats]      = useState([])
  const [showRedeem,   setShowRedeem]   = useState(false)
  const [redeemAmt,    setRedeemAmt]    = useState(1000)
  const [redeemBusy,   setRedeemBusy]  = useState(false)
  const [redeemMsg,    setRedeemMsg]    = useState('')
  const [loading,      setLoading]      = useState(true)
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
      isOwn  ? getMyStats().catch(() => []) : Promise.resolve([]),
    ]).then(([prof, userPosts, cnt, followingSet, h2hData, statsData]) => {
      if (cancelled) return
      setProfile(prof)
      setPosts(userPosts)
      setCounts(cnt)
      setIsFollowing(followingSet.has(userId))
      setH2h(h2hData)
      setMyStats(statsData)
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
      <Spinner size="lg" />
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
          {PAID_ROLES.has(profile?.role) && <PremiumBadge size={14} role={profile.role} />}
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
            <Avatar url={profile?.avatar_url} size={72} role={profile?.role} isOwner={profile?.is_owner} />
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 16, flex: 1, paddingBottom: 4 }}>
            {[
              { label: 'Posts',      value: posts.length },
              { label: 'Seguidores', value: counts.followers },
              { label: 'Siguiendo',  value: counts.following },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#FFFFFF' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{s.label}</div>
              </div>
            ))}
            {/* Q Points — shown on own profile */}
            {isOwn && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#FBBF24', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
                    <path d="m14.281666666666666 6.706533333333333 -4.531466666666667 -5.809333333333333c-0.22759999999999997 -0.237 -0.5015333333333333 -0.42466666666666664 -0.8046666666666666 -0.5514666666666667 -0.30319999999999997 -0.1268 -0.6291333333333333 -0.18993333333333332 -0.9577333333333333 -0.18553333333333333 -0.32853333333333334 0.004399999999999999 -0.6527333333333333 0.07626666666666666 -0.9524 0.2112 -0.29966666666666664 0.13479999999999998 -0.5684666666666667 0.3298 -0.7895999999999999 0.5728666666666666l-4.507933333333333 5.762266666666666c-0.24953333333333333 0.38539999999999996 -0.38293333333333335 0.8344666666666667 -0.3841333333333333 1.2935999999999999 0.013066666666666666 0.4401333333333333 0.14593333333333333 0.8684 0.3841333333333333 1.2386666666666666l0.04706666666666666 0.05486666666666666 4.500066666666666 5.809333333333333c0.2215333333333333 0.23459999999999998 0.48906666666666665 0.4210666666666667 0.7857333333333334 0.5478666666666666 0.2967333333333333 0.1267333333333333 0.6163333333333333 0.19113333333333332 0.9390000000000001 0.18906666666666666 0.33359999999999995 -0.0002666666666666667 0.6635333333333333 -0.07013333333333333 0.9685333333333334 -0.2051333333333333 0.3051333333333333 -0.135 0.5786666666666667 -0.3321333333333333 0.8033333333333333 -0.5788l4.500066666666666 -5.762333333333332c0.24593333333333334 -0.38859999999999995 0.37259999999999993 -0.8408 0.36419999999999997 -1.3006 -0.0084 -0.4598 -0.15126666666666666 -0.9071333333333333 -0.41126666666666667 -1.2865333333333333h0.04706666666666666Z" fill="#FBBF24" strokeWidth="0"/>
                  </svg>
                  {profile?.q_points ?? 0}
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>Q Coins</div>
              </div>
            )}
          </div>
        </div>

        {/* Name + info */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {profile?.username}
            {profile?.verified && <span style={{ fontSize: 13, color: '#60A5FA' }}>✓</span>}
            {PAID_ROLES.has(profile?.role) && <PremiumBadge size={14} role={profile.role} />}
            <RoleBadge isOwner={profile?.is_owner} role={profile?.role} size={14} />
            {/* Season badges — 🥇🥈🥉 with rank-aware color */}
            {profile?.season_badges?.slice(0, 4).map(b => {
              const parts  = b.split('-')
              // New format S2-1-MTG-Panama, legacy S1-MTG-Panama
              const rank   = (parts.length >= 4 && /^\d+$/.test(parts[1])) ? parts[1] : '1'
              const sNum   = parts[0]
              const medals = { '1': { icon: '🥇', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
                               '2': { icon: '🥈', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.28)' },
                               '3': { icon: '🥉', color: '#B87333', bg: 'rgba(184,115,51,0.12)',  border: 'rgba(184,115,51,0.3)'  } }
              const m = medals[rank] ?? medals['1']
              return (
                <span key={b} title={b} style={{
                  fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5,
                  background: m.bg, border: `1px solid ${m.border}`, color: m.color, letterSpacing: '0.04em',
                }}>{m.icon}{sNum}</span>
              )
            })}
          </div>
          {profile?.branch && (
            <div style={{ fontSize: 12, color: BRANCH_STYLES[profile.branch]?.color ?? '#6B7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPinIcon size={11} color={BRANCH_STYLES[profile.branch]?.color ?? '#6B7280'} />
              {profile.branch}
            </div>
          )}
          {/* TCG games played */}
          {profile?.tcg_games?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {profile.tcg_games.map(g => {
                const gs = GAME_STYLES[g]
                return (
                  <span key={g} title={g} style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: '50%',
                    background: gs?.bg ?? 'rgba(255,255,255,0.05)',
                    border: `1px solid ${gs?.border ?? '#2A2A2A'}`,
                  }}>
                    <GameIcon game={g} size={14} />
                  </span>
                )
              })}
            </div>
          )}

          {/* Social links */}
          {(() => {
            const sl = profile?.social_links ?? {}
            const SOCIALS = [
              { key: 'instagram', color: '#E1306C', url: h => `https://instagram.com/${h}`,
                icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg> },
              { key: 'tiktok',    color: '#69C9D0', url: h => `https://tiktok.com/@${h}`,
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.75a4.85 4.85 0 0 1-1-.06z"/></svg> },
              { key: 'twitter',   color: '#9CA3AF', url: h => `https://x.com/${h}`,
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
              { key: 'youtube',   color: '#FF0000', url: h => `https://youtube.com/@${h}`,
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
            ]
            const active = SOCIALS.filter(s => sl[s.key]?.trim())
            if (!active.length) return null
            return (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {active.map(s => (
                  <a key={s.key} href={s.url(sl[s.key])} target="_blank" rel="noopener noreferrer"
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid #2A2A2A',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: s.color, textDecoration: 'none', flexShrink: 0,
                      transition: 'border-color 0.15s',
                    }}
                  >{s.icon}</a>
                ))}
              </div>
            )
          })()}

          {/* Contact info — only visible on own profile */}
          {isOwn && profile?.phone && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 12, color: '#4B5563' }}>📞 {profile.phone}</div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {isOwn ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            {/* Q Points redemption button — shown when user has ≥1000 pts */}
            {(profile?.q_points ?? 0) >= 1000 && (
              <button onClick={() => { setRedeemMsg(''); setShowRedeem(true) }} style={{
                width: '100%', padding: '9px 14px',
                borderRadius: 8, background: 'rgba(251,191,36,0.08)',
                border: '1.5px solid rgba(251,191,36,0.3)',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#FBBF24', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width={12} height={12} viewBox="0 0 16 16" fill="none"><path d="m14.281666666666666 6.706533333333333 -4.531466666666667 -5.809333333333333c-0.22759999999999997 -0.237 -0.5015333333333333 -0.42466666666666664 -0.8046666666666666 -0.5514666666666667 -0.30319999999999997 -0.1268 -0.6291333333333333 -0.18993333333333332 -0.9577333333333333 -0.18553333333333333 -0.32853333333333334 0.004399999999999999 -0.6527333333333333 0.07626666666666666 -0.9524 0.2112 -0.29966666666666664 0.13479999999999998 -0.5684666666666667 0.3298 -0.7895999999999999 0.5728666666666666l-4.507933333333333 5.762266666666666c-0.24953333333333333 0.38539999999999996 -0.38293333333333335 0.8344666666666667 -0.3841333333333333 1.2935999999999999 0.013066666666666666 0.4401333333333333 0.14593333333333333 0.8684 0.3841333333333333 1.2386666666666666l0.04706666666666666 0.05486666666666666 4.500066666666666 5.809333333333333c0.2215333333333333 0.23459999999999998 0.48906666666666665 0.4210666666666667 0.7857333333333334 0.5478666666666666 0.2967333333333333 0.1267333333333333 0.6163333333333333 0.19113333333333332 0.9390000000000001 0.18906666666666666 0.33359999999999995 -0.0002666666666666667 0.6635333333333333 -0.07013333333333333 0.9685333333333334 -0.2051333333333333 0.3051333333333333 -0.135 0.5786666666666667 -0.3321333333333333 0.8033333333333333 -0.5788l4.500066666666666 -5.762333333333332c0.24593333333333334 -0.38859999999999995 0.37259999999999993 -0.8408 0.36419999999999997 -1.3006 -0.0084 -0.4598 -0.15126666666666666 -0.9071333333333333 -0.41126666666666667 -1.2865333333333333h0.04706666666666666Z" fill="#FBBF24" strokeWidth="0"/></svg>
                  Canjear Q Coins
                </span>
                <span style={{ fontSize: 12, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
                  {profile.q_points} pts = ${(profile.q_points / 1000).toFixed(2)}
                </span>
              </button>
            )}

            {/* Win rate stats button */}
            {myStats.length > 0 && (
              <button onClick={() => setShowStats(true)} style={{
                width: '100%', padding: '9px 14px',
                borderRadius: 8, background: 'rgba(74,222,128,0.06)',
                border: '1.5px solid rgba(74,222,128,0.2)',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>📊 Mi récord</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  {myStats.slice(0, 3).map(s => {
                    const pct = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0
                    return (
                      <span key={s.game} style={{ fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
                        <span style={{ color: '#9CA3AF', fontWeight: 600 }}>{s.game}</span>
                        {' '}
                        <span style={{ color: pct >= 50 ? '#4ADE80' : '#F87171', fontWeight: 800 }}>{pct}%</span>
                      </span>
                    )
                  })}
                </div>
              </button>
            )}
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
                      ⚡ {post.post_likes[0].count}
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
      {/* Q Points redemption modal */}
      {showRedeem && (
        <div onClick={() => !redeemBusy && setShowRedeem(false)} style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'flex-end', zIndex: 100,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', background: '#111111',
            borderRadius: '20px 20px 0 0', padding: '20px 20px 36px',
            animation: 'slideUp 0.22s ease',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#2A2A2A', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif', marginBottom: 4 }}>Canjear Q Coins</div>
            <div style={{ fontSize: 12, color: '#6B7280', fontFamily: 'Inter, sans-serif', marginBottom: 20 }}>
              1000 Q Coins = $1.00 en crédito de tienda · Tienes {profile?.q_points ?? 0} Q Coins
            </div>

            {/* Amount selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[1000, 2000, 5000].filter(v => v <= (profile?.q_points ?? 0)).map(v => (
                <button key={v} onClick={() => setRedeemAmt(v)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10,
                  background: redeemAmt === v ? 'rgba(251,191,36,0.15)' : '#1A1A1A',
                  border: `1.5px solid ${redeemAmt === v ? 'rgba(251,191,36,0.5)' : '#2A2A2A'}`,
                  color: redeemAmt === v ? '#FBBF24' : '#6B7280',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>
                  {v}<br />
                  <span style={{ fontSize: 11, fontWeight: 600 }}>${(v / 1000).toFixed(2)}</span>
                </button>
              ))}
            </div>

            {redeemMsg && (
              <div style={{ fontSize: 12, color: redeemMsg.startsWith('✅') ? '#4ADE80' : '#F87171', textAlign: 'center', marginBottom: 12, fontFamily: 'Inter, sans-serif' }}>
                {redeemMsg}
              </div>
            )}

            <button
              disabled={redeemBusy || redeemAmt > (profile?.q_points ?? 0)}
              onClick={async () => {
                setRedeemBusy(true)
                setRedeemMsg('')
                try {
                  await redeemPoints(redeemAmt)
                  setProfile(p => ({ ...p, q_points: (p?.q_points ?? 0) - redeemAmt }))
                  setRedeemMsg(`✅ Solicitud enviada — un admin la procesará pronto`)
                  setTimeout(() => setShowRedeem(false), 2000)
                } catch (e) {
                  setRedeemMsg(e.message || 'Error al canjear')
                } finally {
                  setRedeemBusy(false)
                }
              }}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12,
                background: redeemBusy ? '#1A1A1A' : '#FBBF24',
                border: 'none', color: redeemBusy ? '#555' : '#111',
                fontSize: 14, fontWeight: 800, cursor: redeemBusy ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {redeemBusy ? 'Procesando…' : `Canjear ${redeemAmt} Q Coins → $${(redeemAmt / 1000).toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      {/* My Stats modal */}
      {showStats && (
        <div onClick={() => setShowStats(false)} style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'flex-end', zIndex: 100,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', background: '#111111',
            borderRadius: '20px 20px 0 0', padding: '20px 20px 32px',
            animation: 'slideUp 0.22s ease',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#2A2A2A', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: '#FFF', fontFamily: 'Inter, sans-serif', marginBottom: 16 }}>📊 Mi récord</div>
            {myStats.length === 0 ? (
              <div style={{ fontSize: 13, color: '#4B5563', fontFamily: 'Inter, sans-serif', textAlign: 'center', padding: '20px 0' }}>
                Aún no tienes partidas confirmadas
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myStats.map(s => {
                  const pct = s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0
                  const color = pct >= 60 ? '#4ADE80' : pct >= 40 ? '#FBBF24' : '#F87171'
                  return (
                    <div key={s.game} style={{ background: '#1A1A1A', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <GameIcon game={s.game} size={14} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#FFF', fontFamily: 'Inter, sans-serif' }}>{s.game}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, color: '#4ADE80', fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>{s.wins}V</span>
                          <span style={{ fontSize: 11, color: '#333' }}>·</span>
                          <span style={{ fontSize: 12, color: '#F87171', fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>{s.losses}D</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color, fontFamily: 'Inter, sans-serif', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </div>
                      {/* Win rate bar */}
                      <div style={{ height: 4, borderRadius: 2, background: '#2A2A2A', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  )
                })}
                <div style={{ fontSize: 11, color: '#4B5563', textAlign: 'center', fontFamily: 'Inter, sans-serif', marginTop: 4 }}>
                  Solo partidas confirmadas por ambos jugadores
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
            <Avatar url={profile?.avatar_url} size={36} role={profile?.role} isOwner={profile?.is_owner} />
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
            ⚡ {post.post_likes?.[0]?.count ?? 0}
          </span>
          <span style={{ color: '#9CA3AF', fontSize: 13 }}>
            💬 {post.post_comments?.[0]?.count ?? 0}
          </span>
        </div>
      </div>
    </div>
  )
}
