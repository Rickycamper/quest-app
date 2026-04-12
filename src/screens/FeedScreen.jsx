// ─────────────────────────────────────────────
// QUEST — FeedScreen
// ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import questLogo from '../assets/quest-logo-sm.png'
import { useGuest } from '../context/GuestContext'
import { supabase } from '../lib/supabase'
import { getFeed, getUserLikedPosts, toggleLike, toggleSave, toggleFollow, getFollowing, getComments, addComment, deletePost, updatePost, getArticles } from '../lib/supabase'
import { GAMES, GAME_STYLES } from '../lib/constants'
import Avatar from '../components/Avatar'
import { CommentIcon, BookmarkIcon, ShareIcon, PremiumBadge, RoleBadge, BoltIcon } from '../components/Icons'
import GameIcon from '../components/GameIcon'

const sk = (w, h, r = 6) => ({
  width: w, height: h, borderRadius: r, flexShrink: 0, display: 'block',
  background: 'linear-gradient(90deg,#141414 25%,#222 50%,#141414 75%)',
  backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite linear',
})

function ImageCarousel({ images }) {
  const [slide, setSlide]       = useState(0)
  const [dragX, setDragX]       = useState(0)
  const [dragging, setDragging] = useState(false)
  const trackRef    = useRef(null)
  const slideRef    = useRef(0)          // mirror of slide for use inside event closures
  const startX      = useRef(0)
  const startY      = useRef(0)
  const isHoriz     = useRef(null)       // null = undecided, true/false once determined
  const activeTouch = useRef(false)

  // Keep slideRef in sync
  useEffect(() => { slideRef.current = slide }, [slide])

  // ── Non-passive touch listeners so we can preventDefault on horizontal drags ──
  useEffect(() => {
    const el = trackRef.current
    if (!el || images.length < 2) return

    const onTouchStart = (e) => {
      startX.current     = e.touches[0].clientX
      startY.current     = e.touches[0].clientY
      isHoriz.current    = null
      activeTouch.current = true
    }

    const onTouchMove = (e) => {
      if (!activeTouch.current) return
      const dx = e.touches[0].clientX - startX.current
      const dy = e.touches[0].clientY - startY.current

      // Determine direction once we have at least 4px of movement
      if (isHoriz.current === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        isHoriz.current = Math.abs(dx) > Math.abs(dy)
      }

      if (!isHoriz.current) return   // vertical — let browser scroll normally

      e.preventDefault()             // lock vertical scroll for the rest of this gesture
      const cur     = slideRef.current
      const atStart = cur === 0 && dx > 0
      const atEnd   = cur === images.length - 1 && dx < 0
      setDragging(true)
      setDragX((atStart || atEnd) ? dx * 0.25 : dx)
    }

    const onTouchEnd = (e) => {
      if (!activeTouch.current) return
      activeTouch.current = false

      if (!isHoriz.current) return   // was a vertical scroll — nothing to do

      const dx  = e.changedTouches[0].clientX - startX.current
      const w   = el.offsetWidth
      const cur = slideRef.current
      let next  = cur
      if (dx < -w * 0.2 && next < images.length - 1) next++
      else if (dx > w * 0.2 && next > 0) next--
      setSlide(next)
      setDragging(false)
      setDragX(0)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })  // ← must be non-passive
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    el.addEventListener('touchcancel',onTouchEnd,   { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
      el.removeEventListener('touchcancel',onTouchEnd)
    }
  }, [images.length])

  // ── Pointer events for desktop mouse drag ────────────────────────
  const onPointerDown = (e) => {
    if (images.length < 2 || e.pointerType === 'touch') return
    e.currentTarget.setPointerCapture(e.pointerId)
    startX.current     = e.clientX
    slideRef.current   = slide
    setDragging(true)
    setDragX(0)
  }
  const onPointerMove = (e) => {
    if (!dragging || e.pointerType === 'touch') return
    const raw     = e.clientX - startX.current
    const atStart = slideRef.current === 0 && raw > 0
    const atEnd   = slideRef.current === images.length - 1 && raw < 0
    setDragX((atStart || atEnd) ? raw * 0.25 : raw)
  }
  const onPointerUp = (e) => {
    if (!dragging || e.pointerType === 'touch') return
    setDragging(false)
    const dx  = e.clientX - startX.current
    const w   = trackRef.current?.offsetWidth || 1
    let next  = slideRef.current
    if (dx < -w * 0.2 && next < images.length - 1) next++
    else if (dx > w * 0.2 && next > 0) next--
    setSlide(next)
    setDragX(0)
  }

  const translateX = -slide * 100
  const stripStyle = {
    display: 'flex', willChange: 'transform',
    alignItems: 'center',   // center shorter images vertically without stretching them
    transform: dragging
      ? `translateX(calc(${translateX}% + ${dragX}px))`
      : `translateX(${translateX}%)`,
    transition: dragging ? 'none' : 'transform 0.38s cubic-bezier(0.25, 1, 0.5, 1)',
  }

  return (
    <div
      ref={trackRef}
      style={{
        borderRadius: 10, overflow: 'hidden', marginBottom: 14,
        background: '#0A0A0A', position: 'relative',
        maxHeight: 450,
        userSelect: 'none', touchAction: 'pan-y',
        cursor: images.length > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* sliding strip */}
      <div style={stripStyle}>
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            draggable={false}
            style={{ width: '100%', flexShrink: 0, height: '100%', maxHeight: 450, objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
          />
        ))}
      </div>

      {/* indicator dots + counter */}
      {images.length > 1 && (
        <>
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: '3px 9px',
            fontSize: 11, color: '#FFF', fontWeight: 700, pointerEvents: 'none',
          }}>{slide + 1}/{images.length}</div>
          <div style={{
            position: 'absolute', bottom: 10, left: '50%',
            transform: 'translateX(-50%)', display: 'flex', gap: 5,
            pointerEvents: 'none',
          }}>
            {images.map((_, i) => (
              <div key={i} style={{
                width: i === slide ? 18 : 6, height: 6, borderRadius: 3,
                background: i === slide ? '#FFF' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.25s',
              }} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

const IS_VIDEO_URL = /\.(mp4|mov|webm|avi|mkv)(\?|$)/i

function VideoPlayer({ src }) {
  const vidRef              = useRef(null)
  const [playing, setPlaying]   = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Auto-play when ≥50% visible, pause when scrolled away
  useEffect(() => {
    const el = vidRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.play().then(() => setPlaying(true)).catch(() => {})
      } else {
        el.pause()
        setPlaying(false)
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Lock body scroll while expanded
  useEffect(() => {
    if (expanded) document.body.style.overflow = 'hidden'
    else          document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [expanded])

  const openExpanded = () => {
    vidRef.current?.pause()
    setPlaying(false)
    setExpanded(true)
  }
  const closeExpanded = () => setExpanded(false)

  return (
    <>
      {/* ── Feed thumbnail — muted, auto-play, no controls ── */}
      <div
        onClick={openExpanded}
        style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', marginBottom: 14, background: '#000', cursor: 'pointer' }}
      >
        <video
          ref={vidRef}
          src={src}
          muted loop playsInline preload="metadata"
          style={{ width: '100%', maxHeight: 480, display: 'block', objectFit: 'cover' }}
        />
        {/* Play icon shown only when paused */}
        {!playing && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.25)',
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: 17, marginLeft: 4 }}>▶</span>
            </div>
          </div>
        )}
        {/* Expand hint */}
        {playing && (
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'rgba(0,0,0,0.45)', borderRadius: 6, padding: '3px 8px',
            fontSize: 10, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, sans-serif',
            pointerEvents: 'none',
          }}>⤢</div>
        )}
      </div>

      {/* ── Expanded fullscreen overlay ── */}
      {expanded && (
        <div
          onClick={closeExpanded}
          style={{
            position: 'fixed', inset: 0, background: '#000', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeInFast 0.18s ease both',
          }}
        >
          <video
            src={src}
            autoPlay loop playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            onClick={e => e.stopPropagation()}
          />
          {/* Close button */}
          <button
            onClick={closeExpanded}
            style={{
              position: 'absolute',
              top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
              right: 16,
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              border: 'none', borderRadius: '50%',
              width: 36, height: 36,
              color: '#FFF', fontSize: 17, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
      )}
    </>
  )
}

function PostCard({ post, currentUserId, isStaff, following, onFollowChange, onViewProfile, onDeleted, animDelay = 0 }) {
  const { requireAuth } = useGuest()
  const [liked,          setLiked]         = useState(post.user_has_liked ?? false)
  const [likeAnim,       setLikeAnim]      = useState(false)
  const [saved,          setSaved]         = useState(false)
  const [likes,          setLikes]         = useState(post.post_likes?.[0]?.count ?? 0)
  useEffect(() => { setLiked(post.user_has_liked ?? false) }, [post.id, post.user_has_liked])
  const [likeBusy,       setLikeBusy]      = useState(false)
  const [saveBusy,       setSaveBusy]      = useState(false)
  const [fBusy,          setFBusy]         = useState(false)
  const [showComments,   setShowComments]  = useState(false)
  const [comments,       setComments]      = useState([])
  const [loadingCmts,    setLoadingCmts]   = useState(false)
  const [commentText,    setCommentText]   = useState('')
  const [sendingCmt,     setSendingCmt]    = useState(false)
  const [commentCount,   setCommentCount]  = useState(post.post_comments?.[0]?.count ?? 0)
  const [deleting,   setDeleting]  = useState(false)
  const [shared,     setShared]    = useState(false)
  const [showMenu,   setShowMenu]  = useState(false)
  const menuRef      = useRef(null)
  const sharedTimer  = useRef(null)
  const likeAnimTimer = useRef(null)
  useEffect(() => {
    if (!showMenu) return
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close) }
  }, [showMenu])
  useEffect(() => () => clearTimeout(likeAnimTimer.current), [])
  const [captionLocal,   setCaptionLocal]  = useState(post.caption)
  const [editing,        setEditing]       = useState(false)
  const [editCaption,    setEditCaption]   = useState('')
  const [editSaving,     setEditSaving]    = useState(false)

  const handleEditStart = () => { setEditCaption(captionLocal); setEditing(true) }
  const handleEditCancel = () => setEditing(false)
  const handleEditSave = async () => {
    const trimmed = editCaption.trim()
    if (!trimmed || editSaving) return
    setEditSaving(true)
    try {
      await updatePost(post.id, { caption: trimmed })
      setCaptionLocal(trimmed)
      setEditing(false)
    } catch {}
    setEditSaving(false)
  }

  const handleOpenComments = async () => {
    if (showComments) { setShowComments(false); return }
    setShowComments(true)
    if (comments.length === 0) {
      setLoadingCmts(true)
      try { setComments(await getComments(post.id)) } catch {}
      setLoadingCmts(false)
    }
  }

  const handleSendComment = async () => {
    const text = commentText.trim()
    if (!text || sendingCmt) return
    setSendingCmt(true)
    setCommentText('')
    try {
      const c = await addComment(post.id, text)
      setComments(prev => [...prev, c])
      setCommentCount(n => n + 1)
    } catch (e) {
      setCommentText(text)
      if (e?.message) alert(e.message)
    }
    setSendingCmt(false)
  }

  const handleShare = async () => {
    const text = `${post.caption}\n— @${post.profiles?.username} en Quest TCG`
    if (navigator.share) {
      try { await navigator.share({ title: 'Quest TCG', text }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(text) } catch {}
    }
    setShared(true)
    clearTimeout(sharedTimer.current)
    sharedTimer.current = setTimeout(() => setShared(false), 2000)
  }

  const handleDelete = async () => {
    if (!window.confirm(isOwnPost
      ? '¿Eliminar tu post?'
      : `¿Eliminar el post de @${post.profiles?.username ?? 'este usuario'}?`
    )) return
    setShowMenu(false)
    setDeleting(true)
    try { await deletePost(post.id); onDeleted?.(post.id) } catch {}
    setDeleting(false)
  }

  const gs = GAME_STYLES[post.tag] ?? GAME_STYLES['MTG']
  const authorId   = post.profiles?.id
  const isOwnPost  = currentUserId && authorId === currentUserId
  const canDelete  = isOwnPost || isStaff
  const isFollowed = following?.has(authorId)

  const handleLike = () => requireAuth(async () => {
    if (likeBusy) return
    setLikeBusy(true)
    const nowLiked = !liked
    setLiked(nowLiked)
    setLikes(l => nowLiked ? l + 1 : Math.max(0, l - 1))
    if (nowLiked) {
      clearTimeout(likeAnimTimer.current)
      setLikeAnim(true)
      likeAnimTimer.current = setTimeout(() => setLikeAnim(false), 500)
      navigator.vibrate?.(40)
    }
    try { await toggleLike(post.id) } catch { setLiked(!nowLiked); setLikes(l => nowLiked ? l - 1 : l + 1) }
    setLikeBusy(false)
  })

  const handleSave = async () => {
    if (saveBusy) return
    setSaveBusy(true)
    setSaved(s => !s)
    try { await toggleSave(post.id) } catch { setSaved(s => !s) }
    setSaveBusy(false)
  }

  const handleFollow = async () => {
    if (fBusy || !authorId) return
    setFBusy(true)
    try {
      await toggleFollow(authorId)
      onFollowChange(authorId, !isFollowed)
    } catch {}
    setFBusy(false)
  }

  return (
    <div style={{
      background: '#111111',
      border: '1px solid #1E1E1E',
      borderRadius: 16,
      padding: '14px 16px',
      animation: 'fadeUp 0.3s ease both',
      animationDelay: `${animDelay}ms`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div onClick={() => authorId && requireAuth(() => onViewProfile?.(authorId))} style={{
          width: 36, height: 36, borderRadius: '50%',
          background: '#1F1F1F', border: '1.5px solid #2A2A2A',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
          cursor: authorId ? 'pointer' : 'default', overflow: 'hidden',
        }}><Avatar url={post.profiles?.avatar_url} size={36} /></div>

        {/* Info col + follow + ··· */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch', gap: 8 }}>
          {/* Text block */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span onClick={() => authorId && requireAuth(() => onViewProfile?.(authorId))}
                style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', cursor: authorId ? 'pointer' : 'default', flexShrink: 0 }}>
                @{post.profiles?.username ?? 'user'}
              </span>
              {post.profiles?.verified && <span style={{ fontSize: 11, flexShrink: 0 }}>✓</span>}
              {post.profiles?.role === 'premium' && <PremiumBadge size={13} />}
              <RoleBadge isOwner={post.profiles?.is_owner} role={post.profiles?.role} size={13} />
            </div>
            <span style={{ fontSize: 11, color: '#4B5563' }}>{timeAgo(post.created_at)}</span>
          </div>

          {/* Follow button — double height, spans both rows */}
          {!isOwnPost && authorId && (
            <button onClick={handleFollow} disabled={fBusy} style={{
              alignSelf: 'stretch',
              padding: '0 10px', borderRadius: 6,
              border: `1.5px solid ${isFollowed ? '#2A2A2A' : '#FFFFFF'}`,
              background: isFollowed ? 'transparent' : '#FFFFFF',
              color: isFollowed ? '#4B5563' : '#111111',
              fontSize: 11, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontFamily: 'Inter, sans-serif',
              whiteSpace: 'nowrap',
            }}>
              {isFollowed ? 'Siguiendo' : 'Seguir'}
            </button>
          )}

          {/* ··· menu */}
          {!editing && (
            <div ref={menuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <button onClick={() => setShowMenu(m => !m)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
                color: '#4B5563', fontSize: 18, lineHeight: 1, letterSpacing: 1,
              }}>···</button>
              {showMenu && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 120,
                  background: '#1C1C1C', border: '1px solid #2A2A2A',
                  borderRadius: 12, padding: '6px 4px',
                  display: 'flex', gap: 2,
                  animation: 'fadeUp 0.15s ease',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                }}>
                  <button onClick={() => { handleSave(); setShowMenu(false) }} style={menuIconBtn}>
                    <BookmarkIcon filled={saved} size={18} />
                  </button>
                  {isOwnPost && (
                    <button onClick={() => { setShowMenu(false); handleEditStart() }} style={menuIconBtn}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={handleDelete} disabled={deleting} style={{ ...menuIconBtn, color: '#F87171' }}>
                      {deleting
                        ? <span style={{ fontSize: 13 }}>···</span>
                        : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                      }
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image / Video / carousel */}
      {(() => {
        const imgs = post.images?.length > 0 ? post.images : post.image_url ? [post.image_url] : []
        if (imgs.length === 0) return null
        if (imgs.length === 1 && IS_VIDEO_URL.test(imgs[0])) return <VideoPlayer src={imgs[0]} />
        if (imgs.length === 1) return (
          <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 12, background: '#0A0A0A', maxHeight: 450 }}>
            <img src={imgs[0]} alt="" style={{ width: '100%', height: '100%', maxHeight: 450, objectFit: 'cover', display: 'block' }} />
          </div>
        )
        return <ImageCarousel images={imgs} />
      })()}

      {/* Caption */}
      {editing ? (
        <div style={{ marginBottom: 14 }}>
          <textarea
            value={editCaption}
            onChange={e => setEditCaption(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave() } }}
            autoFocus
            style={{
              width: '100%', background: '#111', border: '1.5px solid #333',
              borderRadius: 10, color: '#FFF', fontSize: 14,
              fontFamily: 'Inter, sans-serif', resize: 'none', outline: 'none',
              lineHeight: 1.6, minHeight: 80, padding: '10px 12px', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={handleEditCancel} style={{
              flex: 1, padding: '8px', borderRadius: 8,
              background: '#1A1A1A', border: '1px solid #2A2A2A',
              color: '#9CA3AF', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 14, color: '#D1D5DB', lineHeight: 1.6, margin: 0 }}>
            {captionLocal}
          </p>
        </div>
      )}


      {/* Actions */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: showComments ? 12 : 0 }}>
        <button onClick={handleLike} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer',
          color: liked ? '#FFF' : '#4B5563', fontSize: 13, fontWeight: 600,
          fontFamily: 'Inter, sans-serif', padding: 0, transition: 'color 0.15s',
        }}>
          <BoltIcon filled={liked} size={18} pop={likeAnim} color={liked ? '#FFFFFF' : '#4B5563'} /> {likes > 0 && likes}
        </button>
        <button onClick={handleOpenComments} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer',
          color: showComments ? '#FFF' : '#4B5563', fontSize: 13, fontWeight: 600,
          fontFamily: 'Inter, sans-serif', padding: 0, transition: 'color 0.15s',
        }}>
          <CommentIcon size={18} /> {commentCount > 0 && commentCount}
        </button>

        {/* Share */}
        <button onClick={handleShare} title="Compartir" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer',
          color: shared ? '#4ADE80' : '#4B5563', fontSize: 13, fontWeight: 600,
          fontFamily: 'Inter, sans-serif', padding: 0, transition: 'color 0.15s',
        }}>
          <ShareIcon size={17} />
          {shared && <span style={{ fontSize: 11, color: '#4ADE80' }}>Copiado</span>}
        </button>

        {/* Game icon — pushed to the right */}
        {post.tag && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', opacity: 0.7 }}>
            <GameIcon game={post.tag} size={18} />
          </div>
        )}
      </div>
      {/* Comments panel */}
      {showComments && (
        <div style={{ borderTop: '1px solid #1A1A1A', paddingTop: 12, animation: 'fadeUp 0.2s ease' }}>
          {loadingCmts && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          )}
          {!loadingCmts && comments.length === 0 && (
            <div style={{ fontSize: 12, color: '#374151', textAlign: 'center', padding: '8px 0 12px' }}>Sin comentarios aún</div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1F1F1F', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Avatar url={c.profiles?.avatar_url} size={28} />
              </div>
              <div style={{ flex: 1, background: '#111', borderRadius: 8, padding: '6px 10px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#FFF', marginRight: 6 }}>@{c.profiles?.username ?? 'user'}</span>
                <span style={{ fontSize: 12, color: '#D1D5DB' }}>{c.content}</span>
              </div>
            </div>
          ))}

          {/* Input */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendComment()}
              placeholder="Escribe un comentario..."
              style={{
                flex: 1, background: '#111', border: '1px solid #222',
                borderRadius: 8, padding: '8px 12px', color: '#FFF',
                fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none',
              }}
            />
            <button onClick={handleSendComment} disabled={!commentText.trim() || sendingCmt} style={{
              background: commentText.trim() ? '#FFF' : '#1A1A1A',
              color: commentText.trim() ? '#000' : '#555',
              border: 'none', borderRadius: 8, padding: '0 14px',
              fontSize: 13, fontWeight: 700, cursor: commentText.trim() ? 'pointer' : 'default',
              fontFamily: 'Inter, sans-serif', transition: 'all 0.15s', flexShrink: 0,
            }}>
              {sendingCmt ? '...' : '→'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const menuIconBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#9CA3AF', padding: '7px 10px', borderRadius: 8,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.15s, color 0.15s',
}

const PULL_THRESHOLD = 65
const PAGE_SIZE      = 8
const cacheKey       = (g) => `q_feed_${g ?? 'all'}`

export default function FeedScreen({ profile, isStaff, isOwner, onViewProfile, onPost, refreshKey = 0 }) {
  const [posts,       setPosts]      = useState([])
  const [articles,    setArticles]   = useState([])
  const [game,        setGame]       = useState(null)
  const [loading,     setLoading]    = useState(true)
  const [bgRefresh,   setBgRefresh]  = useState(false)
  const [error,       setError]      = useState('')
  const [following,   setFollowing]  = useState(new Set())
  const [offset,      setOffset]     = useState(0)
  const [hasMore,     setHasMore]    = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pullY,       setPullY]      = useState(0)
  const [refreshing,  setRefreshing] = useState(false)
  const touchStartY  = useRef(0)
  const pulling      = useRef(false)
  const sentinelRef  = useRef(null)
  const gameRef      = useRef(game)
  const allPostsRef    = useRef([])    // in-memory "All" feed for instant client filtering
  const mountedRef     = useRef(false) // true after initial load fires
  const hasPreviewRef  = useRef(false) // true when a client-side preview is already showing
  useEffect(() => { gameRef.current = game }, [game])

  const loadFeed = useCallback((opts = {}) => {
    const { withFollowing = false } = opts
    const key = cacheKey(gameRef.current)

    // Show sessionStorage cache instantly, then refresh in background
    try {
      const cached = sessionStorage.getItem(key)
      if (cached) {
        setPosts(JSON.parse(cached))
        setLoading(false)
        setBgRefresh(true)
      } else if (hasPreviewRef.current) {
        // Client preview already showing — don't flash a spinner, just refresh silently
        hasPreviewRef.current = false
        setBgRefresh(true)
      } else {
        setLoading(true)
      }
    } catch { setLoading(true) }

    setError('')
    setOffset(0)
    setHasMore(false)  // block loadMore until this fetch completes

    const feedP      = getFeed({ game: gameRef.current, limit: PAGE_SIZE, offset: 0 })
    const followingP = withFollowing ? getFollowing().catch(() => new Set()) : null

    feedP
      .then(data => {
        setPosts(data)
        setHasMore(data.length === PAGE_SIZE)
        if (!gameRef.current) allPostsRef.current = data
        try { sessionStorage.setItem(key, JSON.stringify(data)) } catch {}
        if (followingP) followingP.then(setFollowing)
        // Load likes in background after posts are visible
        if (data.length > 0) {
          getUserLikedPosts(data.map(p => p.id)).then(likedSet => {
            setPosts(prev => prev.map(p => ({ ...p, user_has_liked: likedSet.has(p.id) })))
          }).catch(() => {})
        }
      })
      .catch(e => setError(e.message || 'Error al cargar el feed'))
      .finally(() => { setLoading(false); setBgRefresh(false) })
  }, [])

  // Game filter switch — show a client-side preview instantly, server refreshes in bg
  const handleGameSwitch = (g) => {
    if (g === game) return
    const pool = allPostsRef.current
    if (pool.length > 0) {
      const preview = g ? pool.filter(p => p.tag === g) : pool
      hasPreviewRef.current = true  // signal loadFeed to skip spinner
      setPosts(preview)
      setLoading(false)
      setHasMore(false)   // prevent sentinel from firing loadMore during transition
      setBgRefresh(true)
    }
    setGame(g)
    // Load articles for the selected game
    if (g) {
      getArticles(g).then(setArticles).catch(() => setArticles([]))
    } else {
      setArticles([])
    }
  }

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextOffset = offset + PAGE_SIZE
    getFeed({ game: gameRef.current, limit: PAGE_SIZE, offset: nextOffset })
      .then(data => {
        setPosts(prev => [...prev, ...data])
        setHasMore(data.length === PAGE_SIZE)
        setOffset(nextOffset)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [loadingMore, hasMore, offset])

  // Initial load
  useEffect(() => {
    loadFeed({ withFollowing: true })
  }, [])

  // Game filter change — skip on initial mount (handled above)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    loadFeed()
  }, [game])

  useEffect(() => { if (refreshKey > 0) loadFeed({ withFollowing: false }) }, [refreshKey])

  // Infinite scroll — IntersectionObserver on sentinel div at bottom
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  // Pull-to-refresh — attach to the parent .screen-scroll container
  useEffect(() => {
    const scroller = document.querySelector('.screen-scroll')
    if (!scroller) return

    const onTouchStart = (e) => {
      if (scroller.scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY
        pulling.current = true
      }
    }
    const onTouchMove = (e) => {
      if (!pulling.current) return
      const dy = e.touches[0].clientY - touchStartY.current
      if (dy > 0) {
        e.preventDefault()
        setPullY(Math.min(dy * 0.45, PULL_THRESHOLD))
      }
    }
    const onTouchEnd = () => {
      if (!pulling.current) return
      pulling.current = false
      setPullY(prev => {
        if (prev >= PULL_THRESHOLD) {
          setRefreshing(true)
          loadFeed()
          setTimeout(() => setRefreshing(false), 800)
        }
        return 0
      })
    }

    scroller.addEventListener('touchstart', onTouchStart, { passive: true })
    scroller.addEventListener('touchmove',  onTouchMove,  { passive: false })
    scroller.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      scroller.removeEventListener('touchstart', onTouchStart)
      scroller.removeEventListener('touchmove',  onTouchMove)
      scroller.removeEventListener('touchend',   onTouchEnd)
    }
  }, [game])

  // Realtime: new posts appear automatically
  useEffect(() => {
    const channel = supabase
      .channel('feed-posts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'posts',
      }, payload => {
        const newPost = payload.new
        // Only add if matches current game filter
        if (gameRef.current && newPost.tag !== gameRef.current) return
        // Fetch full post with profile
        getFeed({ game: gameRef.current, limit: 1, offset: 0 })
          .then(latest => {
            if (latest[0]?.id === newPost.id) {
              setPosts(prev => {
                if (prev.find(p => p.id === newPost.id)) return prev
                return [latest[0], ...prev]
              })
            }
          }).catch(() => {})
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleFollowChange = (userId, nowFollowing) => {
    setFollowing(prev => {
      const next = new Set(prev)
      if (nowFollowing) next.add(userId)
      else next.delete(userId)
      return next
    })
  }

  const handleDeleted = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  const pullProgress = pullY / PULL_THRESHOLD   // 0 → 1
  const showIndicator = pullY > 8 || refreshing

  return (
    <div style={{ minHeight: '100%', background: '#0A0A0A' }}>
      {/* Pull-to-refresh indicator */}
      {showIndicator && (
        <div style={{
          position: 'fixed', top: 56 + (refreshing ? 12 : pullY * 0.18), left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 20, padding: '6px 16px',
          fontSize: 12, fontWeight: 700, color: '#9CA3AF',
          fontFamily: 'Inter, sans-serif', zIndex: 100,
          display: 'flex', alignItems: 'center', gap: 6,
          backdropFilter: 'blur(8px)',
          opacity: refreshing ? 1 : pullProgress,
          transition: refreshing ? 'opacity 0.2s' : 'none',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#FFF',
            animation: refreshing ? 'spin 0.6s linear infinite' : 'none',
            transform: refreshing ? undefined : `rotate(${pullProgress * 540}deg)`,
          }} />
          {refreshing ? 'Actualizando…' : pullProgress >= 1 ? '↑ Soltá para recargar' : '↓ Jalá para recargar'}
        </div>
      )}
      {/* Game filter — full-width icon strip for everyone */}
      <div style={{ padding: '10px 14px 4px' }}>
        <div style={{
          background: '#111111', border: '1px solid #1E1E1E', borderRadius: 12,
          display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 6,
        }}>
          <button onClick={() => handleGameSwitch(null)} style={{
            flex: 1, height: 34, borderRadius: 8,
            border: !game ? '1.5px solid rgba(255,255,255,0.35)' : '1.5px solid transparent',
            background: !game ? 'rgba(255,255,255,0.1)' : 'transparent',
            color: !game ? '#FFFFFF' : '#4B5563',
            fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.18s, border-color 0.18s',
            animation: !game ? 'iconPop 0.28s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
          }}>ALL</button>
          <div style={{ width: 1, height: 20, background: '#2A2A2A', flexShrink: 0 }} />
          {GAMES.map(g => {
            const gs = GAME_STYLES[g]
            const active = game === g
            return (
              <button key={g} onClick={() => handleGameSwitch(active ? null : g)} title={g} style={{
                flex: 1, height: 34, borderRadius: 8,
                border: `1.5px solid ${active ? gs.border : 'transparent'}`,
                background: active ? gs.bg : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.18s, border-color 0.18s, box-shadow 0.18s',
                boxShadow: active ? `0 0 10px ${gs.border}55` : 'none',
                animation: active ? 'iconPop 0.28s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
              }}>
                <GameIcon game={g} size={18} />
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Articles strip (shown when a game is selected and articles exist) ── */}
      {articles.length > 0 && (
        <div style={{ padding: '12px 0 4px' }}>
          <div style={{ paddingLeft: 14, marginBottom: 8, fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.06em' }}>
            NOTICIAS
          </div>
          <div className="filter-scroll" style={{ padding: '0 14px', gap: 10 }}>
            {articles.map(a => {
              const gs = GAME_STYLES[a.game] ?? {}
              const ago = (() => {
                if (!a.published_at) return ''
                const d = Math.floor((Date.now() - new Date(a.published_at)) / 86400000)
                return d === 0 ? 'hoy' : d === 1 ? 'ayer' : `${d}d`
              })()
              return (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flexShrink: 0, width: 200, borderRadius: 14, overflow: 'hidden',
                    background: '#111', border: '1px solid #1E1E1E',
                    display: 'flex', flexDirection: 'column',
                    textDecoration: 'none',
                  }}
                >
                  {a.image_url ? (
                    <div style={{ width: '100%', height: 100, overflow: 'hidden', background: '#0A0A0A', flexShrink: 0 }}>
                      <img src={a.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  ) : (
                    <div style={{
                      width: '100%', height: 100, flexShrink: 0,
                      background: gs.bg ?? 'rgba(255,255,255,0.03)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <GameIcon game={a.game} size={32} />
                    </div>
                  )}
                  <div style={{ padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <p style={{
                      fontSize: 12, fontWeight: 700, color: '#E5E7EB', lineHeight: 1.4, margin: 0,
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>{a.title}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 6 }}>
                      <span style={{ fontSize: 10, color: gs.color ?? '#6B7280', fontWeight: 600 }}>{a.source_name}</span>
                      {ago && <span style={{ fontSize: 10, color: '#374151' }}>{ago}</span>}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 14px 0' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ padding: '14px 16px', background: '#111111', border: '1px solid #1E1E1E', borderRadius: 16 }}>
              {/* Avatar + name row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={sk(36, 36, 18)} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={sk('38%', 12, 5)} />
                  <span style={sk('22%', 10, 5)} />
                </div>
              </div>
              {/* Caption lines */}
              <span style={{ ...sk('90%', 12, 5), marginBottom: 6 }} />
              <span style={{ ...sk('65%', 12, 5), marginBottom: 12 }} />
              {/* Image area */}
              <span style={{ ...sk('100%', undefined, 10), aspectRatio: '4/3', marginBottom: 12 }} />
              {/* Actions */}
              <div style={{ display: 'flex', gap: 18 }}>
                <span style={sk(36, 12, 5)} />
                <span style={sk(36, 12, 5)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ margin: '16px 20px', textAlign: 'center' }}>
          <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13, marginBottom: 10 }}>{error}</div>
          <button onClick={loadFeed} style={{ padding: '8px 20px', borderRadius: 8, background: '#1A1A1A', border: '1px solid #333', color: '#FFF', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>🔄 Reintentar</button>
        </div>
      )}

      {/* Background refresh indicator */}
      {bgRefresh && !loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 0' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#6B7280', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🃏</div>
          <div style={{ fontSize: 15, color: '#4B5563' }}>No hay posts aún</div>
        </div>
      )}

      <div key={game ?? '__all'} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 14px 0' }}>
        {posts
          .filter(post => {
            if (post.caption?.includes('[PRIVADO]')) {
              return post.profiles?.id === profile?.id || isStaff
            }
            return true
          })
          .map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              animDelay={Math.min(i * 40, 240)}
              currentUserId={profile?.id}
              isStaff={isStaff}
              following={following}
              onFollowChange={handleFollowChange}
              onViewProfile={onViewProfile}
              onDeleted={handleDeleted}
            />
          ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {/* Load more indicator */}
      {loadingMore && (
        <div style={{ padding: '16px 0', textAlign: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
        </div>
      )}
      {!hasMore && posts.length > 0 && (
        <div style={{ padding: '20px 0 80px', textAlign: 'center', fontSize: 12, color: '#374151' }}>
          · · ·
        </div>
      )}
    </div>
  )
}
