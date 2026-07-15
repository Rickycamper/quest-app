// ─────────────────────────────────────────────
// QUEST — FeedScreen
// ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, useLayoutEffect, memo } from 'react'
import questLogo from '../assets/quest-logo-sm.png'
import { useGuest } from '../context/GuestContext'
import { supabase } from '../lib/supabase'
import { getFeed, getUserLikedPosts, toggleLike, toggleSave, toggleFollow, getFollowing, getComments, addComment, deletePost, updatePost, getArticles, getLatestArticlePerGame } from '../lib/supabase'
import { GAMES, GAME_STYLES } from '../lib/constants'
import { shareOrCopy } from '../lib/share'
import { useConfirm } from '../components/Confirm'
import Avatar from '../components/Avatar'
import { CommentIcon, BookmarkIcon, ShareIcon, PremiumBadge, RoleBadge, BoltIcon, PAID_ROLES, HomeIcon } from '../components/Icons'
import GameIcon from '../components/GameIcon'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { COLOR, RADIUS, SPACING, TYPE, WEIGHT, MOTION, FONT_STACK, ELEVATION } from '../lib/ui'
import { Handshake, HandMetal, MessageCircle, Send } from 'lucide-react'
import { useFollowSuccess } from '../components/FollowSuccess'

const sk = (w, h, r = 6) => ({
  width: w, height: h, borderRadius: r, flexShrink: 0, display: 'block',
  background: 'linear-gradient(90deg,#111 0%,#1F1F1F 50%,#111 100%)',
  backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite ease-in-out',
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
            // Eager-load only the first image (so it's visible immediately on
            // the post above the fold); lazy-load the rest as the user swipes.
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
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

// Wrapped in memo at the bottom of the file. Receives `isFollowed` boolean
// (not the whole `following` Set) so a follow toggle invalidates only the
// affected card instead of every card in the feed.
function PostCardImpl({ post, currentUserId, isStaff, isFollowed, onFollowChange, onViewProfile, onDeleted, animDelay = 0 }) {
  const { requireAuth } = useGuest()
  const confirmAction   = useConfirm()
  const showFollowSuccess = useFollowSuccess()
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
  const [captionExpanded, setCaptionExpanded] = useState(false)  // "más" / IG-style truncation
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
      try { if (navigator?.vibrate) navigator.vibrate(8) } catch {}  // tap haptic on send success
    } catch (e) {
      setCommentText(text)
      if (e?.message) alert(e.message)
    }
    setSendingCmt(false)
  }

  const handleShare = async () => {
    // /p/<id> → serverless function /api/p devuelve HTML con OG tags
    // dinámicos (imagen del post, caption, autor). Cuando alguien lo
    // pega en WhatsApp/Discord/Twitter, el crawler scrappea y se ve
    // un PREVIEW con la foto del post. Usuarios reales son redirigidos
    // automáticamente a /?post=<id> donde el SPA abre el overlay.
    const authorUsername = post.profiles?.username
    const url  = `${window.location.origin}/p/${encodeURIComponent(post.id)}`
    const text = `${post.caption}\n— @${authorUsername ?? 'user'} en Quest TCG`
    const res = await shareOrCopy({ title: 'Quest TCG', text, url })
    if (res.ok && res.method !== 'cancelled') {
      setShared(true)
      clearTimeout(sharedTimer.current)
      sharedTimer.current = setTimeout(() => setShared(false), 2000)
    }
  }

  const handleDelete = async () => {
    const ok = await confirmAction(
      isOwnPost
        ? '¿Eliminar tu post? Esta acción no se puede deshacer.'
        : `¿Eliminar el post de ${post.profiles?.username ?? 'este usuario'}?`,
      { confirmLabel: 'Eliminar', destructive: true }
    )
    if (!ok) return
    setShowMenu(false)
    setDeleting(true)
    try { await deletePost(post.id); onDeleted?.(post.id) } catch {}
    setDeleting(false)
  }

  const gs = GAME_STYLES[post.tag] ?? GAME_STYLES['MTG']
  const authorId   = post.profiles?.id
  const isOwnPost  = currentUserId && authorId === currentUserId
  const canDelete  = isOwnPost || isStaff
  // isFollowed now comes as a prop (boolean) — no Set lookup inside the card

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
    try { if (navigator?.vibrate) navigator.vibrate(8) } catch {}  // tap haptic
    try {
      await toggleFollow(authorId)
      const nowFollowing = !isFollowed
      onFollowChange(authorId, nowFollowing)
      // Popup celebratorio solo al EMPEZAR a seguir
      if (nowFollowing && post.profiles?.username) {
        showFollowSuccess?.(post.profiles)
      }
    } catch {}
    setFBusy(false)
  }

  return (
    <div style={{
      background: COLOR.surface,
      border: `1px solid ${COLOR.border}`,
      borderRadius: RADIUS.lg,
      padding: '16px 18px',
      boxShadow: `${ELEVATION.md}, ${ELEVATION.innerLit}`,
      animation: animDelay > 0 ? 'fadeUp 0.3s ease both' : 'none',
      animationDelay: `${animDelay}ms`,
      // CSS containment — tells the browser this card is independent so it
      // skips re-layout/paint of *other* cards when this one changes (like
      // animations, image decoded, comments expanded, etc.). Single biggest
      // browser-level scroll perf win for a feed of N cards.
      contain: 'layout style paint',
      // content-visibility skips rendering work for off-screen cards entirely.
      // contain-intrinsic-size reserves space so the scroll position stays
      // correct while not-yet-rendered cards have no measured height.
      contentVisibility: 'auto',
      containIntrinsicSize: '0 480px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
        <div onClick={() => authorId && requireAuth(() => onViewProfile?.(authorId))} style={{
          width: 38, height: 38, borderRadius: '50%',
          background: COLOR.surfaceRaised, border: `1px solid ${COLOR.borderStrong}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
          cursor: authorId ? 'pointer' : 'default', overflow: 'hidden',
          transition: MOTION.springTransition,
        }}><Avatar url={post.profiles?.avatar_url} size={38} role={post.profiles?.role} isOwner={post.profiles?.is_owner} /></div>

        {/* Info col + follow + ··· */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch', gap: 8 }}>
          {/* Text block */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span onClick={() => authorId && requireAuth(() => onViewProfile?.(authorId))}
                style={{
                  fontSize: 14, fontWeight: WEIGHT.semibold, color: COLOR.text,
                  cursor: authorId ? 'pointer' : 'default', flexShrink: 0,
                  letterSpacing: '-0.01em',
                }}>
                {post.profiles?.username ?? 'user'}
              </span>
              {post.profiles?.verified && <span style={{ fontSize: 11, flexShrink: 0 }}>✓</span>}
              {PAID_ROLES.has(post.profiles?.role) && <PremiumBadge size={13} role={post.profiles.role} />}
              <RoleBadge isOwner={post.profiles?.is_owner} role={post.profiles?.role} size={13} />
            </div>
            <span style={{ fontSize: 11.5, color: COLOR.textQuaternary, fontWeight: WEIGHT.medium }}>{timeAgo(post.created_at)}</span>
          </div>

          {/* Follow button — handshake icon replaces 'Seguir' / 'Siguiendo'
              text. Filled white circle = not following yet (action available).
              Outlined dim = already following (mutual pact, no action needed). */}
          {!isOwnPost && authorId && (
            <button
              onClick={handleFollow}
              disabled={fBusy}
              aria-label={isFollowed ? 'Dejar de seguir' : 'Seguir'}
              title={isFollowed ? 'Siguiendo' : 'Seguir'}
              style={{
                alignSelf: 'center',
                width: 34, height: 34, borderRadius: '50%',
                border: `1px solid ${isFollowed ? COLOR.borderStrong : '#FFFFFF'}`,
                background: isFollowed ? 'transparent' : '#FFFFFF',
                color: isFollowed ? COLOR.textSecondary : '#0A0A0A',
                cursor: 'pointer',
                transition: MOTION.springTransition,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, padding: 0,
              }}
            >
              <Handshake size={17} strokeWidth={isFollowed ? 1.75 : 2.2} />
            </button>
          )}

          {/* ··· menu */}
          {!editing && (
            <div ref={menuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <button onClick={() => setShowMenu(m => !m)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 4px', borderRadius: RADIUS.sm,
                color: COLOR.textQuaternary, fontSize: 18, lineHeight: 1, letterSpacing: 1,
                transition: MOTION.quickTransition,
              }} aria-label="Más opciones">···</button>
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
          <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', marginBottom: 12, background: '#0A0A0A', maxHeight: 450 }}>
            <img src={imgs[0]} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', maxHeight: 450, objectFit: 'cover', display: 'block' }} />
            {/* Subtle bottom fade — image blends with card */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
              background: 'linear-gradient(to bottom, transparent 0%, rgba(17,17,17,0.4) 100%)',
              pointerEvents: 'none',
            }} />
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
      ) : null}

      {/* Actions row — sits above the caption so engagement affordances
          stay visible right under the image (Instagram-style) even for
          long posts. Tactile press: each button scales 0.92 on press via
          .pressable class (registered in lib/ui keyframes). */}
      <div style={{ display: 'flex', gap: 22, alignItems: 'center', marginBottom: 10 }}>
        <button onClick={handleLike} className="pressable" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: liked ? COLOR.text : COLOR.textQuaternary,
          fontSize: 13.5, fontWeight: WEIGHT.semibold,
          fontFamily: FONT_STACK, padding: '2px 0',
          transition: MOTION.springTransition,
          letterSpacing: '-0.005em',
        }} aria-label={liked ? 'Quitar like' : 'Like'} aria-pressed={liked}>
          <HandMetal
            size={20}
            strokeWidth={liked ? 2.4 : 1.75}
            color={liked ? '#FFFFFF' : COLOR.textQuaternary}
            style={{
              transition: 'transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
              animation: likeAnim ? 'pop 0.42s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
            }}
          /> {likes > 0 && likes}
        </button>
        <button onClick={handleOpenComments} className="pressable" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: showComments ? COLOR.text : COLOR.textQuaternary,
          fontSize: 13.5, fontWeight: WEIGHT.semibold,
          fontFamily: FONT_STACK, padding: '2px 0',
          transition: MOTION.springTransition,
          letterSpacing: '-0.005em',
        }} aria-label="Comentarios">
          <MessageCircle size={19} strokeWidth={showComments ? 2.4 : 1.75} /> {commentCount > 0 && commentCount}
        </button>

        {/* Share */}
        <button onClick={handleShare} className="pressable" title="Compartir" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: shared ? COLOR.green : COLOR.textQuaternary,
          fontSize: 13.5, fontWeight: WEIGHT.semibold,
          fontFamily: FONT_STACK, padding: '2px 0',
          transition: MOTION.springTransition,
        }} aria-label="Compartir">
          <Send size={18} strokeWidth={shared ? 2.4 : 1.75} />
          {shared && <span style={{ fontSize: 11.5, color: COLOR.green, fontWeight: WEIGHT.semibold }}>Copiado</span>}
        </button>

        {/* Game icon — pushed to the right */}
        {post.tag && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', opacity: 0.75 }}>
            <GameIcon game={post.tag} size={18} />
          </div>
        )}
      </div>

      {/* Caption text — now sits below the actions row, so engagement
          affordances are always reachable without scrolling past long copy.
          Instagram-style truncation: clip at ~100 chars + inline "más" link
          that expands the full text. Trims to last whitespace so we don't cut
          a word in half. Once expanded, stays expanded for the session. */}
      {!editing && captionLocal && (() => {
        const TRUNCATE_AT = 40
        const text = captionLocal
        const shouldTruncate = !captionExpanded && text.length > TRUNCATE_AT
        // Trim trailing whitespace + any partial word so the ellipsis lands cleanly
        const displayed = shouldTruncate
          ? text.slice(0, TRUNCATE_AT).replace(/\s+\S*$/, '').trimEnd()
          : text
        return (
          <div style={{ marginBottom: showComments ? 14 : 0 }}>
            <p style={{
              fontSize: 14.5, color: '#E5E7EB',
              lineHeight: 1.55, margin: 0,
              fontWeight: WEIGHT.regular,
              letterSpacing: '-0.005em',
            }}>
              {displayed}
              {shouldTruncate && (
                <>
                  {'… '}
                  <button
                    onClick={() => setCaptionExpanded(true)}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      color: COLOR.textTertiary, fontSize: 14.5, fontWeight: WEIGHT.semibold,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    más
                  </button>
                </>
              )}
            </p>
          </div>
        )
      })()}

      {/* Comments panel */}
      {showComments && (
        <div style={{ borderTop: `1px solid ${COLOR.border}`, paddingTop: 14, marginTop: 4, animation: 'fadeUp 0.2s ease' }}>
          {loadingCmts && (
            <div style={{ padding: '10px 0' }}>
              <Spinner size="sm" centered />
            </div>
          )}
          {!loadingCmts && comments.length === 0 && (
            <div style={{
              fontSize: 12.5, color: COLOR.textQuaternary, textAlign: 'center',
              padding: '8px 0 14px', fontWeight: WEIGHT.medium,
            }}>Sin comentarios aún</div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: COLOR.surfaceRaised, overflow: 'hidden', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Avatar url={c.profiles?.avatar_url} size={28} role={c.profiles?.role} isOwner={c.profiles?.is_owner} />
              </div>
              <div style={{
                flex: 1, background: COLOR.surfaceRaised,
                borderRadius: RADIUS.md, padding: '7px 12px',
                border: `1px solid ${COLOR.border}`,
              }}>
                <span style={{
                  fontSize: 12.5, fontWeight: WEIGHT.semibold, color: COLOR.text,
                  marginRight: 6, letterSpacing: '-0.005em',
                }}>{c.profiles?.username ?? 'user'}</span>
                <span style={{ fontSize: 12.5, color: '#D1D5DB', lineHeight: 1.45 }}>{c.content}</span>
              </div>
            </div>
          ))}

          {/* Input */}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendComment()}
              placeholder="Escribe un comentario..."
              enterKeyHint="send"
              maxLength={2000}
              style={{
                flex: 1, background: COLOR.background,
                border: `1px solid ${COLOR.borderStrong}`,
                borderRadius: RADIUS.md, padding: '9px 13px',
                color: COLOR.text,
                fontSize: 13.5, fontFamily: FONT_STACK, outline: 'none',
                transition: MOTION.quickTransition,
              }}
              onFocus={e => e.currentTarget.style.borderColor = COLOR.textTertiary}
              onBlur ={e => e.currentTarget.style.borderColor = COLOR.borderStrong}
            />
            <button onClick={handleSendComment} disabled={!commentText.trim() || sendingCmt} className="pressable" style={{
              background: commentText.trim() ? '#FFFFFF' : COLOR.surfaceRaised,
              color: commentText.trim() ? '#0A0A0A' : '#555',
              border: 'none', borderRadius: RADIUS.md, padding: '0 15px',
              fontSize: 14, fontWeight: WEIGHT.bold,
              cursor: commentText.trim() ? 'pointer' : 'default',
              fontFamily: FONT_STACK, transition: MOTION.springTransition, flexShrink: 0,
              minWidth: 44,
            }}>
              {sendingCmt ? '…' : '→'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Memoize the card so a parent re-render (scroll, header hide, etc.) doesn't
// repaint every visible card. Custom comparator skips the prop dive on the
// post object — posts are immutable from our side; if it changes identity,
// it's a new post.
const PostCard = memo(PostCardImpl, (prev, next) => (
  prev.post === next.post &&
  prev.currentUserId === next.currentUserId &&
  prev.isStaff === next.isStaff &&
  prev.isFollowed === next.isFollowed &&
  prev.onFollowChange === next.onFollowChange &&
  prev.onViewProfile === next.onViewProfile &&
  prev.onDeleted === next.onDeleted &&
  prev.animDelay === next.animDelay
))

const menuIconBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#9CA3AF', padding: '7px 10px', borderRadius: 8,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.15s, color 0.15s',
}

const PULL_THRESHOLD = 65
const PAGE_SIZE      = 8
const cacheKey       = (g) => `q_feed_${g ?? 'all'}`

// ── TCG news (RSS) auto-refresh ──────────────────────────────────────────────
// Used to require the owner to hit "Actualizar artículos" in the admin panel
// every time. Now it runs automatically whenever someone opens the feed and
// the latest article is older than STALE_HOURS. Throttled to ≤1 check per
// browser session per hour so we never spam the edge function.
const RSS_STALE_HOURS         = 4
const RSS_CHECK_THROTTLE_MS   = 60 * 60 * 1000
const RSS_LAST_CHECK_KEY      = 'quest_rss_last_auto_check'

function maybeAutoRefreshArticles() {
  try {
    const lastCheck = parseInt(localStorage.getItem(RSS_LAST_CHECK_KEY) || '0', 10)
    if (Date.now() - lastCheck < RSS_CHECK_THROTTLE_MS) return
    localStorage.setItem(RSS_LAST_CHECK_KEY, String(Date.now()))
  } catch { return }

  supabase
    .from('tcg_articles')
    .select('published_at')
    .order('published_at', { ascending: false })
    .limit(1)
    .then(({ data }) => {
      const latest = data?.[0]?.published_at
      // If the table is empty (latest === null) we still trigger — first run.
      if (latest) {
        const ageMs = Date.now() - new Date(latest).getTime()
        if (ageMs < RSS_STALE_HOURS * 60 * 60 * 1000) return    // still fresh
      }
      // Fire-and-forget: the edge function takes 10-30 s but the new
      // articles will appear in the feed next time it's opened.
      supabase.functions.invoke('fetch-articles', { body: {} }).catch(() => {})
    })
    .catch(() => {})
}

export default function FeedScreen({ profile, isStaff, isOwner, onViewProfile, onPost, refreshKey = 0, mode = 'feed' }) {
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

  // Sliding bubble indicator for the TCG filter row — measures the
  // active button and animates a single bubble between TCGs.
  const tcgRowRef = useRef(null)
  const tcgBtnRefs = useRef({})
  const [tcgIndicator, setTcgIndicator] = useState({ left: 0, width: 0, visible: false })
  useLayoutEffect(() => {
    const measure = () => {
      const row = tcgRowRef.current
      if (!row) return
      const key = game ?? 'ALL'
      const btn = tcgBtnRefs.current[key]
      if (!btn) { setTcgIndicator(p => ({ ...p, visible: false })); return }
      const r1 = btn.getBoundingClientRect()
      const r2 = row.getBoundingClientRect()
      setTcgIndicator({ left: r1.left - r2.left, width: r1.width, visible: true })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [game])
  const hasPreviewRef  = useRef(false) // true when a client-side preview is already showing
  useEffect(() => { gameRef.current = game }, [game])

  // One throttled check per feed mount. The function itself no-ops if it
  // already ran in the last hour, so this is always safe to call.
  useEffect(() => { maybeAutoRefreshArticles() }, [])

  // En la vista 'ALL' (no TCG seleccionado), pre-cargamos la noticia más
  // reciente de cada TCG así el usuario abre el app y de una sabe que
  // hay novedades. Si filtra a un TCG, se reemplaza con el log completo
  // de ese juego (handleGameSwitch).
  useEffect(() => {
    if (game || mode === 'market') return
    getLatestArticlePerGame()
      .then(rows => { if (!gameRef.current) setArticles(rows) })
      .catch(() => {})
  }, [game, mode])

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

    const feedP      = getFeed({ game: gameRef.current, limit: PAGE_SIZE, offset: 0, type: mode })
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
    // Articles: cuando hay TCG seleccionado, traer TODO el feed de ese
    // juego. Cuando es 'ALL', mostrar SOLO la noticia más reciente de
    // cada TCG (6 ítems) para que el usuario sepa que hay novedades sin
    // tener que entrar a cada juego.
    if (mode === 'market') {
      setArticles([])   // Trade y Ventas no muestra noticias
    } else if (g) {
      getArticles(g).then(setArticles).catch(() => setArticles([]))
    } else {
      getLatestArticlePerGame().then(setArticles).catch(() => setArticles([]))
    }
  }

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextOffset = offset + PAGE_SIZE
    getFeed({ game: gameRef.current, limit: PAGE_SIZE, offset: nextOffset, type: mode })
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
      .channel(`feed-posts-${mode}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'posts',
      }, payload => {
        const newPost = payload.new
        // Only add if matches current game filter
        if (gameRef.current && newPost.tag !== gameRef.current) return
        // Y solo si corresponde a esta vista (feed = sin tipo / market = con tipo)
        if (mode === 'market' ? !newPost.post_type : !!newPost.post_type) return
        // Fetch full post with profile
        getFeed({ game: gameRef.current, limit: 1, offset: 0, type: mode })
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

  // useCallback so PostCard's React.memo can keep cards from re-rendering when
  // the parent's state changes (scroll, header hide, etc.) — without it the
  // handler is a new reference each render and breaks memoization.
  const handleFollowChange = useCallback((userId, nowFollowing) => {
    setFollowing(prev => {
      const next = new Set(prev)
      if (nowFollowing) next.add(userId)
      else next.delete(userId)
      return next
    })
  }, [])

  const handleDeleted = useCallback((postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
  }, [])

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
      {/* Game filter — true glass: translucent so the colorful app bg
          shows through and refracts. Sliding bubble indicator marca el
          TCG activo con su color, deslizándose entre opciones. */}
      {(() => {
        const activeStyle = game ? GAME_STYLES[game] : null
        const indBg     = activeStyle ? activeStyle.bg     : 'rgba(255,255,255,0.12)'
        const indBorder = activeStyle ? activeStyle.border : 'rgba(255,255,255,0.40)'
        const indGlow   = activeStyle ? activeStyle.border : 'rgba(255,255,255,0.25)'
        return (
          <div style={{ padding: '10px 14px 4px' }}>
            <div
              ref={tcgRowRef}
              style={{
                position: 'relative',
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'saturate(180%) blur(20px)',
                WebkitBackdropFilter: 'saturate(180%) blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: RADIUS.md,
                boxShadow: `${ELEVATION.sm}, inset 0 1px 0 rgba(255,255,255,0.04)`,
                display: 'flex', alignItems: 'center', padding: '7px 9px', gap: 6,
              }}
            >
              {/* Sliding indicator */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '50%', left: 9,
                  transform: `translate(${tcgIndicator.left - 9}px, -50%)`,
                  width: tcgIndicator.width,
                  height: 36,
                  borderRadius: RADIUS.sm,
                  background: indBg,
                  border: `1px solid ${indBorder}`,
                  boxShadow: `0 0 14px ${indGlow}66, inset 0 1px 0 rgba(255,255,255,0.06)`,
                  opacity: tcgIndicator.visible ? 1 : 0,
                  pointerEvents: 'none',
                  transition: tcgIndicator.visible
                    ? 'transform 380ms cubic-bezier(0.34,1.45,0.64,1), width 380ms cubic-bezier(0.34,1.45,0.64,1), background 280ms ease, border-color 280ms ease, box-shadow 280ms ease, opacity 200ms ease'
                    : 'opacity 150ms ease',
                  zIndex: 0,
                }}
              />
              <button
                ref={el => { tcgBtnRefs.current['ALL'] = el }}
                onClick={() => handleGameSwitch(null)} className="pressable"
                style={{
                  position: 'relative', zIndex: 1,
                  flex: 1, height: 36, borderRadius: RADIUS.sm,
                  border: '1px solid transparent', background: 'transparent',
                  color: !game ? COLOR.text : COLOR.textTertiary,
                  fontSize: 10.5, fontWeight: WEIGHT.bold,
                  cursor: 'pointer', fontFamily: FONT_STACK,
                  letterSpacing: '0.06em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 220ms ease',
                }}
              >ALL</button>
              <div style={{ width: 1, height: 18, background: COLOR.borderStrong, flexShrink: 0, opacity: 0.7 }} />
              {GAMES.map(g => {
                const active = game === g
                return (
                  <button
                    key={g}
                    ref={el => { tcgBtnRefs.current[g] = el }}
                    onClick={() => handleGameSwitch(active ? null : g)}
                    title={g} className="pressable"
                    style={{
                      position: 'relative', zIndex: 1,
                      flex: 1, height: 36, borderRadius: RADIUS.sm,
                      border: '1px solid transparent', background: 'transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'transform 280ms cubic-bezier(0.34,1.45,0.64,1)',
                      transform: active ? 'scale(1.08)' : 'scale(1)',
                    }}
                  >
                    <GameIcon game={g} size={18} />
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Articles strip (solo en el Feed, no en Trade y Ventas) ── */}
      {mode !== 'market' && articles.length > 0 && (
        <div style={{ padding: '14px 0 4px' }}>
          <div style={{
            paddingLeft: 14, marginBottom: 10,
            fontSize: 10.5, fontWeight: WEIGHT.bold,
            color: COLOR.textTertiary, letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Noticias
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
                  className="lift"
                  style={{
                    flexShrink: 0, width: 210, borderRadius: RADIUS.lg, overflow: 'hidden',
                    background: COLOR.surface,
                    border: `1px solid ${COLOR.border}`,
                    boxShadow: `${ELEVATION.sm}, ${ELEVATION.innerLit}`,
                    display: 'flex', flexDirection: 'column',
                    textDecoration: 'none',
                    transition: MOTION.springTransition,
                  }}
                >
                  {a.image_url ? (
                    <div style={{ width: '100%', height: 100, overflow: 'hidden', background: '#0A0A0A', flexShrink: 0 }}>
                      <img src={a.image_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
                  <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <p style={{
                      fontSize: 12.5, fontWeight: WEIGHT.semibold, color: '#E5E7EB',
                      lineHeight: 1.4, margin: 0, letterSpacing: '-0.005em',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>{a.title}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8 }}>
                      <span style={{
                        fontSize: 10.5, color: gs.color ?? COLOR.textTertiary,
                        fontWeight: WEIGHT.bold, letterSpacing: '0.02em',
                      }}>{a.source_name}</span>
                      {ago && <span style={{ fontSize: 10.5, color: COLOR.textQuaternary, fontWeight: WEIGHT.medium }}>{ago}</span>}
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
            <div key={i} style={{
              padding: '16px 18px',
              background: COLOR.surface,
              border: `1px solid ${COLOR.border}`,
              borderRadius: RADIUS.lg,
              boxShadow: `${ELEVATION.sm}, ${ELEVATION.innerLit}`,
            }}>
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
          <div style={{
            padding: '13px 16px', borderRadius: RADIUS.md,
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.22)',
            color: COLOR.red, fontSize: 13.5,
            fontWeight: WEIGHT.medium,
            marginBottom: 12, letterSpacing: '-0.005em',
          }}>{error}</div>
          <button onClick={loadFeed} className="pressable" style={{
            padding: '10px 22px', borderRadius: RADIUS.md,
            background: COLOR.surfaceRaised,
            border: `1px solid ${COLOR.borderStrong}`,
            color: COLOR.text, fontSize: 13.5, fontWeight: WEIGHT.semibold,
            cursor: 'pointer', fontFamily: FONT_STACK,
            transition: MOTION.springTransition,
          }}>Reintentar</button>
        </div>
      )}

      {/* Background refresh indicator */}
      {bgRefresh && !loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 0' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#6B7280', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <EmptyState
          icon={<HomeIcon active />}
          title={mode === 'market' ? 'Todavía no hay trade ni ventas' : 'Aún nadie publicó nada'}
          subtitle={mode === 'market'
            ? 'Publicá lo que vendés, buscás o querés tradear. Elegí Compro / Vendo / Tradeo / Tengo al crear tu post.'
            : 'Sé el primero en compartir un mazo, una colección o tu última partida.'}
          ctaLabel={onPost ? (mode === 'market' ? 'Publicar en Trade y Ventas' : 'Crear mi primer post') : undefined}
          onCta={onPost}
        />
      )}

      <div key={game ?? '__all'} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 14px 0' }}>
        {posts
          .filter(post => {
            if (post.caption?.includes('[PRIVADO]')) {
              return post.profiles?.id === profile?.id || isStaff
            }
            return true
          })
          .map((post, i) => {
            const authorId = post.profiles?.id ?? post.user_id
            // Pass boolean instead of the Set — keeps PostCard's memo intact
            // when *other* users get followed/unfollowed.
            const isFollowed = authorId ? following.has(authorId) : false
            return (
              <PostCard
                key={post.id}
                post={post}
                animDelay={i < 6 ? Math.min(i * 40, 200) : 0}  // skip stagger past fold
                currentUserId={profile?.id}
                isStaff={isStaff}
                isFollowed={isFollowed}
                onFollowChange={handleFollowChange}
                onViewProfile={onViewProfile}
                onDeleted={handleDeleted}
              />
            )
          })}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {/* Load more indicator */}
      {loadingMore && <Spinner size="md" centered />}
      {!hasMore && posts.length > 0 && (
        <div style={{ padding: '20px 0 80px', textAlign: 'center', fontSize: 12, color: '#374151' }}>
          · · ·
        </div>
      )}
    </div>
  )
}
