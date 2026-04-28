// Shared avatar component — renders img if URL, emoji/fallback otherwise
import { useState } from 'react'

/**
 * Supabase Pro Storage Transform — converts a full-size public URL to a
 * server-resized thumbnail. Saves bandwidth on every avatar load.
 * Only activates for Supabase Storage URLs (/storage/v1/object/public/).
 */
function getAvatarSrc(url, size) {
  if (!url?.startsWith('http')) return url
  if (url.includes('/storage/v1/object/public/')) {
    const px = size * 2 // 2× for retina displays
    const base = url.split('?')[0] // strip any ?t= cache-bust params
    return base.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
      + `?width=${px}&height=${px}&resize=cover&quality=80`
  }
  return url
}

// Premium ring colors per role. Owner > admin > premium.
function getRingGradient({ isOwner, role }) {
  if (isOwner)         return 'conic-gradient(from 0deg, #FBBF24, #F59E0B, #FBBF24, #FCD34D, #FBBF24)'
  if (role === 'admin')   return 'conic-gradient(from 0deg, #F59E0B, #FB923C, #F59E0B)'
  if (role === 'premium') return 'conic-gradient(from 0deg, #A78BFA, #8B5CF6, #A78BFA, #C4B5FD, #A78BFA)'
  if (role === 'staff')   return 'linear-gradient(135deg, #4ADE80, #22C55E)'
  return null
}

export default function Avatar({ url, size = 36, fontSize, role, isOwner }) {
  const [imgError, setImgError] = useState(false)
  const fs = fontSize ?? Math.round(size * 0.44)

  const ring = getRingGradient({ isOwner, role })

  const inner = (url?.startsWith('http') && !imgError) ? (
    <img
      src={getAvatarSrc(url, size)}
      alt=""
      onError={() => setImgError(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
    />
  ) : (
    <span style={{ fontSize: fs, lineHeight: 1 }}>👤</span>
  )

  // No ring → return content directly (parent controls size)
  if (!ring) return inner

  // With ring: wrap in a gradient halo. Parent already sets the size box,
  // so we fill it and use a 1.5px ring (slightly more for larger avatars).
  const ringWidth = size >= 60 ? 2 : 1.5
  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: '50%',
      background: ring,
      padding: ringWidth,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: isOwner || role === 'admin'
        ? '0 0 8px rgba(245,158,11,0.35)'
        : role === 'premium' ? '0 0 8px rgba(167,139,250,0.3)'
        : 'none',
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%',
        background: '#1F1F1F', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {inner}
      </div>
    </div>
  )
}
