// Shared avatar component — renders img if URL, emoji/fallback otherwise
import { useState } from 'react'

export default function Avatar({ url, size = 36, fontSize }) {
  const [imgError, setImgError] = useState(false)
  const fs = fontSize ?? Math.round(size * 0.44)

  if (url?.startsWith('http') && !imgError) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setImgError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
      />
    )
  }
  return <span style={{ fontSize: fs, lineHeight: 1 }}>👤</span>
}
