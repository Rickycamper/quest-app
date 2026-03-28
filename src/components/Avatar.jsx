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

export default function Avatar({ url, size = 36, fontSize }) {
  const [imgError, setImgError] = useState(false)
  const fs = fontSize ?? Math.round(size * 0.44)

  if (url?.startsWith('http') && !imgError) {
    return (
      <img
        src={getAvatarSrc(url, size)}
        alt=""
        onError={() => setImgError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
      />
    )
  }
  return <span style={{ fontSize: fs, lineHeight: 1 }}>👤</span>
}
