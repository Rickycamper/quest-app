// Vercel serverless — Dynamic Open Graph para posts compartidos.
//
// Cuando alguien comparte un post desde la app, el link es /p/<postId>.
// vercel.json reescribe esa ruta a /api/p?id=<postId>. Esta función
// fetcha el post de Supabase y devuelve HTML con meta tags og:image,
// og:title, og:description completos — así WhatsApp / Discord / Twitter
// / iMessage muestran un PREVIEW con la imagen del post y la caption.
//
// El HTML también incluye un redirect inmediato a /?post=<id> para
// usuarios reales (no crawlers), donde el SPA abre el overlay del post.
// Los crawlers nunca ejecutan JS — leen meta tags y se van; el redirect
// solo afecta a humanos.

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL  || process.env.SUPABASE_URL
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

function fallbackHtml(reason) {
  // Si no podemos cargar el post, devolvemos OG tags genéricos del app +
  // redirect al home. Crawlers ven el preview genérico, humanos llegan al app.
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Quest TCG</title>
<meta property="og:title" content="Quest TCG — La comunidad TCG de Panamá" />
<meta property="og:description" content="Competí en torneos, coleccioná y tradeá cartas." />
<meta property="og:image" content="https://questhobbystore.com/og-image.png" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta http-equiv="refresh" content="0; url=/" />
<script>window.location.replace('/')</script>
</head>
<body><!-- ${escapeHtml(reason)} --></body>
</html>`
}

export default async function handler(req, res) {
  const postId = (req.query.id || '').toString().trim()
  if (!postId) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(404).send(fallbackHtml('missing id'))
  }
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(500).send(fallbackHtml('missing supabase env'))
  }

  // Fetch post via Supabase REST (no SDK needed in serverless function)
  let post = null
  try {
    const url = `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(postId)}&select=id,caption,tag,image_url,images,user_id`
    const r = await fetch(url, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    })
    if (!r.ok) throw new Error(`supabase ${r.status}`)
    const rows = await r.json()
    post = rows?.[0] ?? null
  } catch (e) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(fallbackHtml(`fetch failed: ${e.message}`))
  }

  if (!post) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(fallbackHtml('post not found'))
  }

  // Author lookup (separate query — keeps each fast + cacheable)
  let author = null
  try {
    if (post.user_id) {
      const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(post.user_id)}&select=username,avatar_url`
      const r = await fetch(url, {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      })
      if (r.ok) {
        const rows = await r.json()
        author = rows?.[0] ?? null
      }
    }
  } catch { /* author optional */ }

  // Build OG card content
  const image = (post.images && post.images[0]) || post.image_url || 'https://questhobbystore.com/og-image.png'
  const captionFull = (post.caption || '').trim()
  const caption = captionFull.length > 180 ? captionFull.slice(0, 177) + '…' : captionFull
  const username = author?.username || 'Quest TCG'
  const title = `@${username}${post.tag ? ` · ${post.tag}` : ''} en Quest TCG`
  const description = caption || 'Mirá este post en Quest TCG'

  // Redirect target — el SPA detecta ?post= y abre el overlay
  const spaUrl = `/?post=${encodeURIComponent(postId)}`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Cache 5 min en CDN, 1 min en browser — preview se actualiza si el
  // post cambia, pero no fetcheamos Supabase en cada vista
  res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60')

  return res.status(200).send(`<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />

<!-- Open Graph -->
<meta property="og:type" content="article" />
<meta property="og:url" content="https://questhobbystore.com/p/${encodeURIComponent(postId)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:alt" content="${escapeHtml(`Post de @${username}`)}" />
<meta property="og:site_name" content="Quest TCG" />
<meta property="og:locale" content="es_PA" />

<!-- Twitter / X -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />

<!-- Real users get redirected to the SPA with the overlay open. Crawlers
     never run JS so they just read meta tags and bounce. The meta refresh
     fallback covers crawlers that DO follow refresh (rare). -->
<meta http-equiv="refresh" content="0; url=${escapeHtml(spaUrl)}" />
<script>window.location.replace(${JSON.stringify(spaUrl)})</script>
</head>
<body>
<p>Abriendo post de <a href="${escapeHtml(spaUrl)}">@${escapeHtml(username)}</a>…</p>
</body>
</html>`)
}
