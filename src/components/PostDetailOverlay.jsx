// ─────────────────────────────────────────────
// QUEST — PostDetailOverlay
// ─────────────────────────────────────────────
// Cuando llegás por un link `?post=<id>`, se abre este overlay encima
// del feed con el post específico que te compartieron. Tap "Ver perfil"
// para ir al autor, tap fondo o ✕ para cerrar.
//
// Simple deliberadamente — un single-card view con caption + carrusel
// de imágenes + meta. Likes/comments se pueden hacer abriendo el perfil
// del autor → grid de posts. Mantenerlo focused = mejor share UX.
//
import { useEffect, useState } from 'react'
import { getPostById } from '../lib/supabase'
import Avatar from './Avatar'
import Spinner from './Spinner'
import { X, ArrowRight } from 'lucide-react'

export default function PostDetailOverlay({ postId, onClose, onViewProfile }) {
  const [post,    setPost]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [imgIdx,  setImgIdx]  = useState(0)

  useEffect(() => {
    if (!postId) return
    let cancelled = false
    setLoading(true)
    setError('')
    getPostById(postId)
      .then(p => {
        if (cancelled) return
        if (!p) setError('No encontramos este post')
        else setPost(p)
      })
      .catch(e => { if (!cancelled) setError(e?.message || 'No se pudo cargar el post') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [postId])

  // Esc para cerrar
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!postId) return null

  const images = post?.images?.length ? post.images : (post?.image_url ? [post.image_url] : [])
  const author = post?.profiles
  const likeCount = post?.post_likes?.[0]?.count ?? 0
  const cmtCount  = post?.post_comments?.[0]?.count ?? 0

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(18px) saturate(140%)',
        WebkitBackdropFilter: 'blur(18px) saturate(140%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'env(safe-area-inset-top, 0px) 14px 14px',
        animation: 'postDetailBgIn 220ms ease',
        cursor: 'pointer',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', cursor: 'default',
          width: '100%', maxWidth: 420,
          maxHeight: 'calc(100vh - 32px)',
          background: 'rgba(20,20,30,0.85)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'postDetailIn 320ms cubic-bezier(0.34, 1.45, 0.64, 1)',
        }}
      >
        {/* Close button — top right, always visible */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 5,
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={16} strokeWidth={2.5} />
        </button>

        {/* Body */}
        {loading && (
          <div style={{ padding: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner />
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 700, marginBottom: 6 }}>{error}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>
              Puede que el autor lo haya borrado.
            </div>
          </div>
        )}

        {post && !loading && (
          <>
            {/* Author header */}
            <button
              onClick={() => { onViewProfile?.(author?.id); onClose?.() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 14px 10px',
                background: 'transparent', border: 'none',
                cursor: author?.id ? 'pointer' : 'default',
                width: '100%', textAlign: 'left',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: '50%', overflow: 'hidden',
                border: '1.5px solid rgba(255,255,255,0.18)',
                flexShrink: 0, background: '#111',
              }}>
                <Avatar url={author?.avatar_url} size={38} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 800, color: '#FFFFFF',
                  letterSpacing: '-0.005em',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  @{author?.username ?? 'usuario'}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  {post.tag && <span style={{ color: '#A78BFA' }}>{post.tag}</span>}
                  {post.tag && ' · '}
                  Tap para ver perfil
                </div>
              </div>
              <ArrowRight size={16} color="#9CA3AF" strokeWidth={2.2} />
            </button>

            {/* Image carousel */}
            {images.length > 0 && (
              <div style={{ position: 'relative', width: '100%', background: '#0A0A0F' }}>
                <img
                  src={images[imgIdx]}
                  alt=""
                  style={{
                    width: '100%', display: 'block',
                    maxHeight: '55vh', objectFit: 'contain',
                  }}
                />
                {images.length > 1 && (
                  <>
                    {/* Dots */}
                    <div style={{
                      position: 'absolute', bottom: 10, left: 0, right: 0,
                      display: 'flex', justifyContent: 'center', gap: 5,
                    }}>
                      {images.map((_, i) => (
                        <span key={i} style={{
                          width: i === imgIdx ? 16 : 5, height: 5, borderRadius: 3,
                          background: i === imgIdx ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                          transition: 'all 200ms ease',
                        }} />
                      ))}
                    </div>
                    {/* Click halves */}
                    <button
                      onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                      aria-label="Anterior"
                      style={{
                        position: 'absolute', top: 0, left: 0,
                        width: '30%', height: '100%',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                      }}
                    />
                    <button
                      onClick={() => setImgIdx(i => (i + 1) % images.length)}
                      aria-label="Siguiente"
                      style={{
                        position: 'absolute', top: 0, right: 0,
                        width: '30%', height: '100%',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                      }}
                    />
                  </>
                )}
              </div>
            )}

            {/* Caption + meta */}
            <div style={{
              padding: '12px 16px 16px',
              fontFamily: 'Inter, sans-serif',
              maxHeight: 200, overflowY: 'auto',
            }}>
              {post.caption && (
                <div style={{
                  fontSize: 13.5, color: '#E5E7EB', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  marginBottom: 8,
                }}>
                  {post.caption}
                </div>
              )}
              <div style={{
                fontSize: 11, color: '#6B7280', fontWeight: 600,
                display: 'flex', gap: 12,
              }}>
                <span>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>
                <span>{cmtCount} {cmtCount === 1 ? 'comentario' : 'comentarios'}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes postDetailBgIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes postDetailIn {
          0%   { opacity: 0; transform: scale(0.92) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
