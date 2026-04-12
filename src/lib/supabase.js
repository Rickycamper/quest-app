// ─────────────────────────────────────────────
// QUEST — Supabase client
// ─────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { RANKING_PTS, GAME_STYLES } from './constants'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const _CLIENT_V = 7

if (!window.__supabase || window.__supabase.__v !== _CLIENT_V) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      lock: (_name, _timeout, fn) => fn(),
    },
    global: {
      fetch: (url, options) => {
        const isStorage = typeof url === 'string' && url.includes('/storage/v1/')
        const ms = isStorage ? 60000 : 30000
        const ctrl = new AbortController()
        const id = setTimeout(() => ctrl.abort(), ms)
        return fetch(url, { ...options, signal: ctrl.signal })
          .finally(() => clearTimeout(id))
      }
    }
  })
  client.__v = _CLIENT_V
  window.__supabase = client
}

export const supabase = window.__supabase

// ── AUTH ────────────────────────────────────
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithEmail(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { username },
      emailRedirectTo: window.location.origin,
    }
  })
  if (error) throw error
  // Save terms acceptance immediately if session exists (email confirm disabled)
  if (data?.session?.user?.id) {
    await supabase.from('profiles').update({ terms_accepted_at: new Date().toISOString() }).eq('id', data.session.user.id)
  }
  return data
}

export async function acceptTerms() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) return
  await supabase.from('profiles').update({ terms_accepted_at: new Date().toISOString() }).eq('id', session.user.id)
}

export async function signInWithTwitch() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'twitch',
    options: { redirectTo: window.location.origin }
  })
  if (error) throw error
}

export async function signInWithDiscord() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: window.location.origin }
  })
  if (error) throw error
}

export async function signInWithFacebook() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo: window.location.origin }
  })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function deleteAccount() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('No hay sesión activa')
  const uid = session.user.id

  // Remove post images from Storage first (best-effort)
  try {
    const { data: posts } = await supabase.from('posts').select('image_url').eq('user_id', uid)
    const paths = (posts ?? [])
      .filter(p => p.image_url)
      .map(p => {
        try {
          const url = new URL(p.image_url)
          const m = url.pathname.match(/\/public\/posts\/(.+)$/)
          return m ? decodeURIComponent(m[1]) : null
        } catch { return null }
      })
      .filter(Boolean)
    if (paths.length) await supabase.storage.from('posts').remove(paths)
  } catch (_) {}

  // Delete user data — parallelize independent tables, profiles last (FK dep)
  await Promise.all([
    supabase.from('cards').delete().eq('user_id', uid),
    supabase.from('post_saves').delete().eq('user_id', uid),
    supabase.from('post_likes').delete().eq('user_id', uid),
    supabase.from('post_comments').delete().eq('user_id', uid),
    supabase.from('posts').delete().eq('user_id', uid),
    supabase.from('follows').delete().or(`follower_id.eq.${uid},following_id.eq.${uid}`),
    supabase.from('notifications').delete().eq('user_id', uid),
  ])
  await supabase.from('profiles').delete().eq('id', uid)

  // Sign out — auth state change in AuthContext will route to login
  await supabase.auth.signOut()
}

// ── PROFILE ─────────────────────────────────
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, role, branch, avatar_url, points, verified, phone, email, is_owner, terms_accepted_at, tcg_games, social_links')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

// Compress + resize an image file to max 600×600px JPEG before uploading.
// Phone camera photos are often 10-20 MB — this drops them to ~100-300 KB.
// Includes a 10 s timeout so HEIC / unsupported formats never hang forever.
function compressImage(file, { maxSize = 600, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    // Safety timeout — if the image never loads (e.g. HEIC on Android/Chrome),
    // reject after 10 s instead of hanging forever.
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url)
      reject(new Error(
        'No se pudo procesar la imagen. Usa una foto en formato JPG o PNG.'
      ))
    }, 10_000)

    img.onload = () => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas no disponible')); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('No se pudo comprimir la imagen')); return }
        resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }
    img.onerror = () => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen. Usa una foto en formato JPG o PNG.'))
    }
    img.src = url
  })
}

// Re-encode a video at lower resolution + bitrate using canvas + MediaRecorder.
// Falls back to original file if the browser doesn't support the APIs.
// Note: encoding runs in real-time (a 30-s clip takes ~30 s to compress).
function compressVideo(file, { maxWidth = 1280, bitrate = 2_500_000 } = {}) {
  return new Promise((resolve) => {
    if (file.size < 5 * 1024 * 1024) { resolve(file); return } // < 5 MB — skip

    const src = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true; video.playsInline = true; video.src = src

    const fallback = () => { URL.revokeObjectURL(src); resolve(file) }
    video.onerror = fallback

    video.onloadedmetadata = () => {
      // Scale down to maxWidth if needed
      let w = video.videoWidth, h = video.videoHeight
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth }

      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')

      if (!canvas.captureStream || !window.MediaRecorder) { fallback(); return }

      // Pick the best supported MIME type
      const mimeType = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm']
        .find(t => MediaRecorder.isTypeSupported(t))
      if (!mimeType) { fallback(); return }

      let recorder
      try {
        recorder = new MediaRecorder(canvas.captureStream(30), {
          mimeType, videoBitsPerSecond: bitrate,
        })
      } catch { fallback(); return }

      const chunks = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => {
        URL.revokeObjectURL(src)
        const blob = new Blob(chunks, { type: mimeType })
        resolve(blob.size < file.size ? blob : file) // only use if actually smaller
      }
      recorder.onerror = fallback

      const draw = () => {
        if (video.ended || video.paused) return
        ctx.drawImage(video, 0, 0, w, h)
        requestAnimationFrame(draw)
      }
      video.onended = () => { if (recorder.state === 'recording') recorder.stop() }
      recorder.start(100)
      video.play().then(draw).catch(fallback)
    }
  })
}

export async function uploadAvatar(file) {
  const { data: { user } } = await supabase.auth.getUser()
  // Always compress to JPEG — drastically reduces upload size and time
  const compressed = await compressImage(file)
  const path = `${user.id}/avatar.jpg`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // Cache-bust so React re-renders the new photo
  return data.publicUrl + '?t=' + Date.now()
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── FEED ────────────────────────────────────
export async function getFeed({ game = null, limit = 20, offset = 0 } = {}) {
  let postsQuery = supabase
    .from('posts')
    .select(`
      id, caption, tag, image_url, images, created_at,
      profiles:user_id ( id, username, avatar_url, role, verified, is_owner ),
      post_likes ( count ),
      post_comments ( count )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (game) postsQuery = postsQuery.eq('tag', game)

  const { data, error } = await postsQuery
  if (error) throw error
  return (data ?? []).map(p => ({ ...p, user_has_liked: false }))
}

// Fetch which post IDs the user has liked — called after posts render so it
// doesn't block the initial paint. Returns a Set of liked post IDs.
export async function getUserLikedPosts(postIds) {
  if (!postIds?.length) return new Set()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) return new Set()
  const { data } = await supabase
    .from('post_likes').select('post_id')
    .eq('user_id', session.user.id).in('post_id', postIds)
  return new Set((data ?? []).map(l => l.post_id))
}

export async function uploadPostImage(file) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('No hay sesión activa')

  const isVideo = file.type?.startsWith('video/')
  const uid = Math.random().toString(36).slice(2, 8)

  let uploadFile, contentType, ext
  if (isVideo) {
    // Compress video (canvas re-encode) then upload
    const compressed = await compressVideo(file, { maxWidth: 1280, bitrate: 2_500_000 })
    uploadFile = compressed
    // MediaRecorder output is webm or mp4 (a Blob, not a File)
    contentType = compressed.type || file.type || 'video/mp4'
    ext = contentType.includes('webm') ? 'webm' : (file.name?.match(/\.(\w+)$/)?.[1] ?? 'mp4')
  } else {
    // Compress images before upload (max 1200px wide, 0.85 quality)
    uploadFile = await compressImage(file, { maxSize: 1200, quality: 0.85 })
    contentType = 'image/jpeg'
    ext = 'jpg'
  }

  const path = `${session.user.id}/${Date.now()}_${uid}.${ext}`
  const { error } = await supabase.storage.from('posts').upload(path, uploadFile, { contentType })
  if (error) {
    const msg = error.message || error.error || ''
    if (msg.toLowerCase().includes('load failed') || msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network'))
      throw new Error('Error de red al subir el archivo. Revisá tu conexión e intentá de nuevo.')
    throw new Error(`Error al subir archivo: ${msg || JSON.stringify(error)}`)
  }
  const { data } = supabase.storage.from('posts').getPublicUrl(path)
  return data.publicUrl
}

export async function createPost({ caption, game, imageUrls = [] }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('No hay sesión activa')

  // Check post limit (unlimited for staff / admin / premium)
  const { data: prof } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single()
  const unlimited = prof?.role === 'staff' || prof?.role === 'admin' || prof?.role === 'premium'
  if (!unlimited) {
    const { count } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
    if ((count ?? 0) >= 50) throw new Error('POST_LIMIT_REACHED')
  }

  // Duplicate guard: same caption posted in the last 3 minutes
  const { data: recent } = await supabase
    .from('posts')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('caption', caption)
    .gte('created_at', new Date(Date.now() - 3 * 60 * 1000).toISOString())
    .limit(1)
  if (recent?.length > 0) throw new Error('Ya publicaste este contenido hace menos de 3 minutos')

  const image_url = imageUrls[0] ?? null
  const insertData = { user_id: session.user.id, caption, tag: game, image_url }
  if (imageUrls.length > 0) insertData.images = imageUrls

  const { data, error } = await supabase
    .from('posts')
    .insert(insertData)
    .select()
    .single()
  if (error) throw new Error(error.message || error.details || 'Error al crear el post')
  awardPoints(session.user.id, 10, 'post_created') // +10 pts, max 5 posts/day
  return data
}

// ── ADMIN — user management ──────────────────
export async function getAdminUsers(query = '', branch = null) {
  let q = supabase
    .from('profiles')
    .select('id, username, avatar_url, role, points')
    .order('username', { ascending: true })
    .limit(40)
  if (branch) q = q.eq('branch', branch)
  if (query.trim()) q = q.ilike('username', `%${query.trim()}%`)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function setUserPremium(userId, premium) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: premium ? 'premium' : 'client' })
    .eq('id', userId)
    .select('id, role')
    .single()
  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('coerce') || error.message?.includes('single'))
      throw new Error('Sin permisos para cambiar roles. Ejecuta la política RLS de profiles en Supabase.')
    throw error
  }
  if (!data) throw new Error('Usuario no encontrado.')
  return data
}

export async function deletePost(postId) {
  // Fetch image_url + user_id first so we can clean up storage and deduct points
  const { data: post } = await supabase
    .from('posts')
    .select('image_url, user_id')
    .eq('id', postId)
    .single()

  // Delete the DB row (cascades likes/comments)
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) throw error

  // Deduct Q Coins for deleted post
  if (post?.user_id) awardPoints(post.user_id, -10, 'post_deleted')

  // Delete image from Storage if present
  if (post?.image_url) {
    try {
      // Public URL format: .../storage/v1/object/public/posts/USER_ID/FILENAME
      const url = new URL(post.image_url)
      // path after /public/posts/ is the storage object path
      const match = url.pathname.match(/\/public\/posts\/(.+)$/)
      if (match) {
        await supabase.storage.from('posts').remove([decodeURIComponent(match[1])])
      }
    } catch (_) {
      // Non-fatal — row already deleted, don't block the UI
    }
  }
}

export async function updatePost(postId, { caption }) {
  const { data, error } = await supabase
    .from('posts')
    .update({ caption })
    .eq('id', postId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getComments(postId) {
  const { data, error } = await supabase
    .from('post_comments')
    .select('id, content, created_at, profiles:user_id(id, username, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(50)
  if (error) throw error
  return data
}

export async function addComment(postId, content) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('No hay sesión activa')
  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, user_id: session.user.id, content })
    .select('id, content, created_at, profiles:user_id(id, username, avatar_url)')
    .single()
  if (error) throw error
  return data
}

export async function toggleLike(postId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('No hay sesión activa')
  const { data: existing } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (existing) {
    const { error: delErr } = await supabase.from('post_likes').delete().eq('id', existing.id)
    if (delErr) throw delErr
    // Deduct 1 Q Coin from post owner when like is removed
    try {
      const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).single()
      if (post?.user_id && post.user_id !== session.user.id) {
        awardPoints(post.user_id, -1, 'like_removed')
      }
    } catch { /* non-critical */ }
    return false
  } else {
    const { error: insErr } = await supabase.from('post_likes').insert({ post_id: postId, user_id: session.user.id })
    if (insErr) throw insErr
    // Notify the post owner (skip if liking own post)
    try {
      const [{ data: liker }, { data: post }] = await Promise.all([
        supabase.from('profiles').select('username').eq('id', session.user.id).single(),
        supabase.from('posts').select('user_id, caption').eq('id', postId).single(),
      ])
      if (post?.user_id && post.user_id !== session.user.id) {
        const preview = post.caption ? post.caption.slice(0, 40) + (post.caption.length > 40 ? '…' : '') : 'tu post'
        await createNotification(
          post.user_id,
          'like',
          '❤️ Nuevo like',
          `@${liker?.username ?? 'Alguien'} le dio like a: ${preview}`,
          { postId, userId: session.user.id }
        )
        awardPoints(post.user_id, 1, 'like_received') // +1 pt to post owner
      }
    } catch { /* non-critical */ }
    return true
  }
}

export async function toggleSave(postId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('No hay sesión activa')
  const { data: existing } = await supabase
    .from('post_saves')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (existing) {
    await supabase.from('post_saves').delete().eq('id', existing.id)
    return false
  } else {
    await supabase.from('post_saves').insert({ post_id: postId, user_id: session.user.id })
    return true
  }
}

export async function toggleFollow(targetUserId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('No hay sesión activa')
  const { data: existing } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', session.user.id)
    .eq('following_id', targetUserId)
    .maybeSingle()

  if (existing) {
    const { error: delErr } = await supabase.from('follows').delete().eq('id', existing.id)
    if (delErr) throw delErr
    return false
  } else {
    const { error: insErr } = await supabase.from('follows').insert({ follower_id: session.user.id, following_id: targetUserId })
    if (insErr) throw insErr
    // Notify the followed user
    try {
      const { data: follower } = await supabase
        .from('profiles').select('username').eq('id', session.user.id).single()
      await createNotification(
        targetUserId,
        'follow',
        '👤 Nuevo seguidor',
        `@${follower?.username ?? 'Alguien'} comenzó a seguirte`,
        { userId: session.user.id }
      )
      // no points for following
    } catch { /* non-critical */ }
    return true
  }
}

export async function getFollowing() {
  const { data: { session } } = await supabase.auth.getSession()
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', session.user.id)
  return new Set((data ?? []).map(r => r.following_id))
}

export async function getUserPosts(userId, { limit = 30 } = {}) {
  const { data, error } = await supabase
    .from('posts')
    .select('id, caption, tag, image_url, created_at, post_likes(count), post_comments(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getFollowCounts(userId) {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  return { followers: followers ?? 0, following: following ?? 0 }
}

export async function reportPost(postId, reason) {
  const { data: { session } } = await supabase.auth.getSession()
  const { error } = await supabase
    .from('post_reports')
    .insert({ post_id: postId, reported_by: session.user.id, reason })
  if (error) throw error
}

// ── RANKINGS ────────────────────────────────
export async function getLeaderboard({ branch = null, game = null } = {}) {
  // ── Per-game: use DB RPC (single query, server-side aggregation) ──
  if (game) {
    const { data, error } = await supabase.rpc('get_game_leaderboard', {
      p_game:   game,
      p_branch: branch ?? null,
    })
    if (error) throw error
    return (data ?? []).map(r => ({ ...r, points: Number(r.points) }))
  }

  // ── Global (no game): read profiles.points directly ──
  let query = supabase
    .from('profiles')
    .select('id, username, avatar_url, branch, verified, role, points, is_owner')
    .gt('points', 0)
    .order('points', { ascending: false })
    .limit(50)

  if (branch) query = query.eq('branch', branch)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getActiveSeason() {
  const { data, error } = await supabase
    .from('ranking_seasons')
    .select('*')
    .eq('active', true)
    .single()
  if (error) throw error
  return data
}

export async function searchTournamentsByName(query) {
  if (!query || query.trim().length < 2) return []
  const { data, error } = await supabase
    .from('tournaments')
    .select('id, name, game, branch, date')
    .ilike('name', `%${query.trim()}%`)
    .order('date', { ascending: false })
    .limit(6)
  if (error) throw error
  return data ?? []
}

export async function getTournaments({ game = null, branch = null } = {}) {
  let query = supabase
    .from('tournaments')
    .select(`
      id, name, game, branch, date, player_count, start_time,
      tournament_results ( position, user_id, profiles:user_id ( username ) ),
      tournament_participants ( user_id, profiles:user_id ( id, username, avatar_url ) )
    `)
    .order('date', { ascending: false })
    .limit(20)

  if (game)   query = query.eq('game', game)
  if (branch) query = query.eq('branch', branch)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function joinTournament(tournamentId) {
  const { data: { session } } = await supabase.auth.getSession()
  const { error } = await supabase
    .from('tournament_participants')
    .insert({ tournament_id: tournamentId, user_id: session.user.id })
  if (error) throw error
}

export async function leaveTournament(tournamentId) {
  const { data: { session } } = await supabase.auth.getSession()
  const { error } = await supabase
    .from('tournament_participants')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('user_id', session.user.id)
  if (error) throw error
}

export async function deleteTournament(id) {
  const { error } = await supabase.from('tournaments').delete().eq('id', id)
  if (error) throw error
}

export async function adjustUserPoints(userId, delta) {
  const { data: prof, error: fetchErr } = await supabase
    .from('profiles').select('points').eq('id', userId).single()
  if (fetchErr) throw fetchErr
  const newPoints = Math.max(0, (prof?.points ?? 0) + delta)
  return setUserPoints(userId, newPoints)
}

export async function setUserPoints(userId, points) {
  const newPoints = Math.max(0, Math.round(Number(points) || 0))
  // Use direct update (same pattern as setUserPremium) — RPC had silent RLS failures
  const { data, error } = await supabase
    .from('profiles')
    .update({ points: newPoints })
    .eq('id', userId)
    .select('id, points')
    .single()
  if (error) throw error
  if (!data) throw new Error('Usuario no encontrado.')
  return data.points
}

// Reject all approved claims for a user in a specific game.
// Used by admin to zero out a player's TCG ranking — since points now derive
// from ranking_claims, this is the only way to truly remove their points.
export async function rejectUserGameClaims(userId, game) {
  const { error } = await supabase
    .from('ranking_claims')
    .update({ status: 'rejected' })
    .eq('user_id', userId)
    .eq('game', game)
    .eq('status', 'approved')
  if (error) throw error
}

export async function updateTournament(id, { date, startTime, playerCount }) {
  const { error } = await supabase
    .from('tournaments')
    .update({ date, start_time: startTime || null, player_count: parseInt(playerCount) })
    .eq('id', id)
  if (error) throw error
}

export async function createTournament({ name, game, branch, date, playerCount, startTime }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('No hay sesión activa')
  const { data, error } = await supabase
    .from('tournaments')
    .insert({ name, game, branch, date, player_count: playerCount, start_time: startTime || null, created_by: session.user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Invite a user to a tournament — sends them a one-click join notification */
export async function inviteTournament(tournamentId, tournamentName, userId) {
  await createNotification(
    userId,
    'tournament_invite',
    '🏆 ¡Te invitaron a un torneo!',
    `Fuiste invitado a "${tournamentName}". Un click para inscribirte.`,
    { tournamentId, tournamentName }
  )
}

export async function submitClaim({ tournamentName, tournamentId = null, game, branch, position, notes, autoApprove = false }) {
  const { data: { session } } = await supabase.auth.getSession()

  // Check if user was a registered participant (for admin visibility)
  let verified_participant = false
  if (tournamentId) {
    const { data: p } = await supabase
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', session.user.id)
      .maybeSingle()
    verified_participant = !!p
  }

  const status = autoApprove ? 'approved' : 'pending'

  // Build insert row — only include optional FK columns when they have a value
  // to avoid schema errors if those columns don't exist yet in the DB
  const insertRow = {
    user_id: session.user.id,
    tournament_name: tournamentName,
    game, branch, position, notes, status,
  }
  if (tournamentId)          insertRow.tournament_id        = tournamentId
  if (verified_participant)  insertRow.verified_participant = true

  const { data, error } = await supabase
    .from('ranking_claims')
    .insert(insertRow)
    .select()
    .single()
  if (error) throw error

  // If auto-approved (staff), add points immediately — use atomic adjustUserPoints
  if (autoApprove && data) {
    const pts = RANKING_PTS[position] ?? 1
    await adjustUserPoints(session.user.id, pts)
  }

  // Notify all staff/admin users about the new pending claim
  if (!autoApprove) {
    const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }
    const medal  = MEDALS[position] ?? `#${position}`
    try {
      const { data: submitter } = await supabase
        .from('profiles').select('username').eq('id', session.user.id).single()
      const { data: staffUsers } = await supabase
        .from('profiles').select('id').in('role', ['staff', 'admin'])
      if (staffUsers?.length) {
        await Promise.all(staffUsers.map(s =>
          createNotification(
            s.id,
            'claim_pending',
            '📋 Nuevo claim pendiente',
            `${medal} @${submitter?.username ?? 'Usuario'} reportó un resultado en ${tournamentName}. Revisalo en Rankings → Claims.`,
            { claimId: data.id }
          )
        ))
      }
    } catch { /* non-critical — claim was saved, notification is best-effort */ }
  }

  return data
}

export async function getPendingClaims(branch = null) {
  let q = supabase
    .from('ranking_claims')
    .select(`
      id, position, tournament_name, tournament_id, game, branch, notes, evidence_url,
      verified_participant, created_at,
      profiles:user_id ( id, username, avatar_url )
    `)
    .eq('status', 'pending')
  if (branch) q = q.eq('branch', branch)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function reviewClaim(claimId, status) {
  // Fetch session + claim data in parallel
  const [{ data: { session } }, { data: claim }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from('ranking_claims')
      .select('user_id, position, tournament_name, game')
      .eq('id', claimId).single(),
  ])

  // Update claim status + adjust points in parallel (independent operations)
  const updateClaim = supabase
    .from('ranking_claims')
    .update({ status, reviewed_by: session?.user?.id, reviewed_at: new Date().toISOString() })
    .eq('id', claimId)

  const updatePoints = (status === 'approved' && claim)
    ? adjustUserPoints(claim.user_id, RANKING_PTS[claim.position] ?? 1)
    : Promise.resolve()

  const [{ error }] = await Promise.all([updateClaim, updatePoints])

  if (error) {
    const isSchemaError = error.code === 'PGRST204' || error.message?.includes('reviewed_by') || error.message?.includes('reviewed_at')
    if (isSchemaError) {
      const fallback = await supabase.from('ranking_claims').update({ status }).eq('id', claimId)
      if (fallback.error) throw fallback.error
    } else {
      throw error
    }
  }

  // Notify fire-and-forget — doesn't block the UI
  if (claim) {
    const pts = RANKING_PTS[claim.position] ?? 1
    const isApproved = status === 'approved'
    createNotification(
      claim.user_id,
      isApproved ? 'claim_approved' : 'claim_rejected',
      isApproved ? '✅ Claim aprobado' : '❌ Claim rechazado',
      isApproved
        ? `Tu claim de ${claim.tournament_name} fue aprobado. +${pts} punto${pts !== 1 ? 's' : ''} sumados a tu perfil.`
        : `Tu claim de ${claim.tournament_name} fue revisado y no pudo ser aprobado esta vez.`,
      { claimId }
    )
  }
}

// ── FOLDER / CARDS ───────────────────────────
export async function getCards(userId) {
  const { data, error } = await supabase
    .from('cards')
    .select('id, name, game, status, set_code, estimated_value, notes, image_url, folder, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addCard({ name, game, cardStatus, qty, price, note, imageUrl, folder }) {
  const { data: { session } } = await supabase.auth.getSession()

  // Check card limit (unlimited for staff / admin / premium)
  const { data: prof } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single()
  const unlimited = prof?.role === 'staff' || prof?.role === 'admin' || prof?.role === 'premium'
  if (!unlimited) {
    const { count } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
    if ((count ?? 0) >= 50) throw new Error('CARD_LIMIT_REACHED')
  }

  const { data, error } = await supabase
    .from('cards')
    .insert({ user_id: session.user.id, name: name || null, game, status: cardStatus, qty: qty || 1, estimated_value: price, notes: note, image_url: imageUrl, folder: folder || null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCard(cardId, updates) {
  const { data, error } = await supabase
    .from('cards')
    .update(updates)
    .eq('id', cardId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCard(cardId) {
  const { error } = await supabase.from('cards').delete().eq('id', cardId)
  if (error) throw error
}

// ── TRACKING ─────────────────────────────────
export async function getMyPackages() {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('packages')
    .select(`
      id, tracking_code, status, origin_branch, destination_branch,
      created_at, notes, image_url,
      sender:sender_id ( id, username ),
      recipient:recipient_id ( id, username ),
      package_items ( * ),
      package_events ( * )
    `)
    .or(`sender_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getAllPackages() {
  const { data, error } = await supabase
    .from('packages')
    .select(`
      id, tracking_code, status, origin_branch, destination_branch,
      created_at, notes, image_url,
      sender:sender_id ( id, username ),
      recipient:recipient_id ( id, username ),
      package_items ( * ),
      package_events ( * )
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function uploadPackageImage(file) {
  const { data: { session } } = await supabase.auth.getSession()
  const ext  = file.name.split('.').pop()
  const path = `${session.user.id}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('packages').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('packages').getPublicUrl(path)
  return data.publicUrl
}

export async function searchUsers(query) {
  let req = supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .order('username', { ascending: true })
    .limit(200)  // increased so no user gets cut off
  if (query && query.length > 0) {
    req = req.ilike('username', `%${query}%`)
  }
  const { data, error } = await req
  if (error) throw error
  return data ?? []
}

export async function createNotification(userId, type, title, body, meta = {}) {
  // Uses SECURITY DEFINER RPC — prevents open INSERT policy on notifications table
  await supabase.rpc('create_notification', {
    p_user_id: userId,
    p_type:    type,
    p_title:   title,
    p_body:    body,
    p_meta:    meta,
  })
  // Fire-and-forget Web Push to all registered devices for this user
  supabase.functions.invoke('send-push', {
    body: { userId, title, body, data: { type, ...meta } },
  }).catch(() => {})
}

// ── Notify owner when a staff/admin makes a shop change ───────────────────────
export async function notifyOwnerOfShopChange(action, productName, adminUsername) {
  try {
    // Get owner's user ID
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_owner', true)
      .single()
    if (!data?.id) return
    await createNotification(
      data.id,
      'shop_admin_action',
      '🛒 Cambio en el Shop',
      `@${adminUsername} ${action}: "${productName}"`,
      { action, productName, adminUsername }
    )
  } catch {
    // Silent fail — don't block the save
  }
}

// ── PUSH SUBSCRIPTIONS ────────────────────────

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

/** Request permission + register device + save to DB. Call once on login. */
export async function subscribeToPush(userId) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
      })
    }
    const { endpoint, keys } = sub.toJSON()
    await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'user_id,endpoint' }
    )
  } catch (e) {
    console.warn('Push subscription failed:', e)
  }
}

export async function createPackage({ originBranch, destinationBranch, recipientId, notes, items, imageUrl }) {
  // Use SECURITY DEFINER RPC to bypass RLS on insert
  const { data: newId, error: rpcErr } = await supabase.rpc('create_package_as_user', {
    p_origin_branch: originBranch,
    p_destination_branch: destinationBranch,
    p_recipient_id: recipientId || null,
    p_notes: notes,
    p_image_url: imageUrl || null,
  })
  if (rpcErr) throw rpcErr

  // Fetch the full package with joins
  const { data: pkg, error: fetchErr } = await supabase
    .from('packages')
    .select(`
      id, tracking_code, status, origin_branch, destination_branch, created_at, notes,
      sender:sender_id ( id, username ),
      recipient:recipient_id ( id, username ),
      package_items ( * ),
      package_events ( * )
    `)
    .eq('id', newId)
    .single()
  if (fetchErr) throw fetchErr

  await Promise.all([
    items?.length
      ? supabase.from('package_items').insert(items.map(i => ({ package_id: pkg.id, name: i.name, qty: i.qty })))
      : Promise.resolve(),
    recipientId
      ? createNotification(
          recipientId,
          'new_package',
          `📦 Nuevo envío en camino`,
          `${pkg.sender?.username ?? 'Alguien'} te envió un paquete #${pkg.tracking_code} desde ${originBranch} → ${destinationBranch}.`,
          { packageId: pkg.id }
        )
      : Promise.resolve(),
  ])
  return pkg
}

const PKG_NOTIFS = {
  received_origin: {
    type: 'new_package',
    title: '📦 Paquete recibido en tienda',
    body:  (code) => `Tu paquete #${code} fue recibido y confirmado en la sucursal origen.`,
  },
  in_transit: {
    type: 'new_package',
    title: '🚚 Paquete en tránsito',
    body:  (code) => `El paquete #${code} salió de la sucursal origen y está en camino.`,
  },
  pending_arrival: {
    type: 'new_package',
    title: '📍 Paquete llegó a sucursal destino',
    body:  (code) => `El paquete #${code} llegó a la sucursal destino. Pendiente de confirmación del admin.`,
  },
  arrived: {
    type: 'package_arrived',
    title: '✅ Paquete confirmado en sucursal',
    body:  (code) => `El paquete #${code} fue confirmado en la sucursal destino. ¡Ya podés retirarlo!`,
  },
  delivered: {
    type: 'package_arrived',
    title: '🎉 Paquete retirado',
    body:  (code) => `El paquete #${code} fue retirado exitosamente. ¡Todo listo!`,
  },
}

export async function updatePackageStatus(packageId, status, notes = '') {
  const [{ data: { session } }, { data: pkg, error: pkgErr }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from('packages').select('sender_id, recipient_id, tracking_code, origin_branch, destination_branch').eq('id', packageId).single(),
  ])
  if (pkgErr) throw pkgErr
  if (!pkg) throw new Error('Paquete no encontrado')

  const { error } = await supabase.from('packages').update({ status }).eq('id', packageId)
  if (error) throw error

  const targets = [pkg.sender_id, pkg.recipient_id].filter(Boolean)
  const notif   = PKG_NOTIFS[status]

  await Promise.all([
    supabase.from('package_events').insert({
      package_id: packageId, status, notes, created_by: session.user.id,
    }),
    ...(notif ? targets.map(uid =>
      createNotification(uid, notif.type, notif.title, notif.body(pkg.tracking_code), { packageId })
    ) : []),
  ])

  if (status === 'delivered') {
    // Record a lightweight stat before deleting (for monthly reports)
    await supabase.from('package_stats').insert({
      origin_branch: pkg.origin_branch,
      dest_branch:   pkg.destination_branch,
    }).then(() => {}, () => {}) // non-fatal

    // Non-fatal: UI will filter it out; if this fails the user can dismiss manually
    await supabase.from('packages').delete().eq('id', packageId).then(() => {}, () => {})
  }
}

/** Returns delivery counts grouped by month for the last N months */
export async function getPackageStats(months = 6) {
  const since = new Date()
  since.setMonth(since.getMonth() - months)

  const { data, error } = await supabase
    .from('package_stats')
    .select('origin_branch, dest_branch, delivered_at')
    .gte('delivered_at', since.toISOString())
    .order('delivered_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

/** Delete a package permanently (user can only delete their own delivered ones; staff can delete any) */
export async function deletePackage(packageId) {
  const { error } = await supabase.from('packages').delete().eq('id', packageId)
  if (error) throw error
}

export async function getPendingArrivalPackages(branch = null) {
  let q = supabase
    .from('packages')
    .select(`
      id, tracking_code, status, origin_branch, destination_branch, created_at, notes,
      sender:sender_id ( id, username ),
      recipient:recipient_id ( id, username )
    `)
    .eq('status', 'pending_arrival')
  if (branch) q = q.eq('destination_branch', branch)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function confirmPackageArrival(packageId, notes = '') {
  // Fetch session + package data in parallel (both needed, neither depends on the other)
  const [{ data: { session } }, { data: pkg, error: fetchErr }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from('packages').select('sender_id, recipient_id, tracking_code').eq('id', packageId).single(),
  ])
  if (fetchErr) throw fetchErr
  if (!pkg) throw new Error('Paquete no encontrado')

  // Move to arrived
  const { error } = await supabase
    .from('packages')
    .update({ status: 'arrived' })
    .eq('id', packageId)
  if (error) throw error

  // Log event + send notifications in parallel
  await Promise.all([
    supabase.from('package_events').insert({
      package_id: packageId, status: 'arrived',
      notes: notes || 'Llegada confirmada por admin',
      created_by: session.user.id,
    }),
    ...[pkg.sender_id, pkg.recipient_id].filter(Boolean).map(uid =>
      createNotification(uid, 'package_arrived',
        '📍 Paquete llegó a sucursal',
        `Tu paquete #${pkg.tracking_code} llegó a la sucursal destino y fue confirmado. ¡Listo para retirar!`,
        { packageId }
      )
    ),
    // +5 Q Points to recipient when shipment confirmed by admin
    pkg.recipient_id ? supabase.rpc('award_points', { p_user_id: pkg.recipient_id, p_amount: 10, p_reason: 'shipment_confirmed' }).catch(() => {}) : Promise.resolve(),
  ])
}

export async function rejectPackageArrival(packageId, reason = '') {
  const [{ data: { session } }, { data: pkg }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from('packages').select('sender_id, recipient_id, tracking_code').eq('id', packageId).single(),
  ])
  if (!pkg) throw new Error('Paquete no encontrado')

  const { error } = await supabase.from('packages').update({ status: 'in_transit' }).eq('id', packageId)
  if (error) throw error

  await Promise.all([
    supabase.from('package_events').insert({
      package_id: packageId, status: 'in_transit',
      notes: reason || 'Llegada rechazada por admin — devuelto a tránsito',
      created_by: session.user.id,
    }),
    ...[pkg.sender_id, pkg.recipient_id].filter(Boolean).map(uid =>
      createNotification(uid, 'new_package',
        '⚠️ Llegada no confirmada',
        `La llegada del paquete #${pkg.tracking_code} no fue confirmada. Contacta a la tienda para más info.`,
        { packageId }
      )
    ),
  ])
}

// ── NOTIFICATIONS ────────────────────────────
export async function getNotifications() {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return data
}

export async function markNotificationRead(id) {
  await supabase.from('notifications').update({ read: true }).eq('id', id)
}

export async function markAllNotificationsRead() {
  const { data: { session } } = await supabase.auth.getSession()
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', session.user.id)
    .eq('read', false)
}

/**
 * Persist the responded status in the notification's meta so it
 * survives a page refresh (prevents PENDIENTE buttons from reappearing).
 */
export async function markNotificationResponded(notifId, status) {
  // Fetch current meta first to merge (can't do partial jsonb update in JS client easily)
  const { data } = await supabase
    .from('notifications').select('meta').eq('id', notifId).single()
  const updatedMeta = { ...(data?.meta || {}), status }
  await supabase
    .from('notifications')
    .update({ meta: updatedMeta, read: true })
    .eq('id', notifId)
}

// ── CHAT ─────────────────────────────────────

/** Returns existing conversation id or creates one (canonical ordering: smaller uuid first) */
export async function getOrCreateConversation(otherUserId) {
  const { data: { session } } = await supabase.auth.getSession()
  const me = session.user.id
  const [user_a, user_b] = [me, otherUserId].sort()

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_a', user_a)
    .eq('user_b', user_b)
    .maybeSingle()

  if (existing) return existing.id

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_a, user_b })
    .select('id')
    .single()

  // 23505 = unique_violation — race condition where both clients tried to create simultaneously
  if (error?.code === '23505') {
    const { data: race } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_a', user_a)
      .eq('user_b', user_b)
      .single()
    if (race) return race.id
  }

  if (error) throw error
  return data.id
}

/** Fetch last N messages for a conversation, oldest first */
export async function getMessages(conversationId, limit = 300, before = null) {
  let q = supabase
    .from('messages')
    .select('id, sender_id, body, read, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }) // newest first so LIMIT grabs the right end
    .limit(limit)

  if (before) q = q.lt('created_at', before) // pagination: load older messages

  const { data, error } = await q
  if (error) throw error
  // Reverse so they render oldest → newest in UI
  return (data ?? []).reverse()
}

/** Send a message and fire a notification to the recipient */
export async function sendMessage(conversationId, body, recipientId) {
  const { data: { session } } = await supabase.auth.getSession()

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: session.user.id, body })
    .select('id, sender_id, body, read, created_at')
    .single()

  if (error) throw error

  // Fetch sender username so the recipient can open the chat directly from the notification
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', session.user.id)
    .single()

  // Notify recipient — fire and forget
  createNotification(
    recipientId,
    'new_message',
    '💬 Nuevo mensaje',
    body.length > 60 ? body.slice(0, 60) + '…' : body,
    { conversationId, senderId: session.user.id, senderUsername: senderProfile?.username ?? '' }
  )

  return data
}

/** Mark messages in a conversation as read (only those not sent by current user) */
export async function markMessagesRead(conversationId) {
  const { data: { session } } = await supabase.auth.getSession()
  await supabase
    .from('messages')
    .update({ read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', session.user.id)
    .eq('read', false)
}

/** Realtime subscription for new messages in a conversation */
export function subscribeToMessages(conversationId, callback) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload) => callback(payload.new))
    .subscribe()
}

// ── MATCHES ───────────────────────────────────

/**
 * Propose a duel result — creates a PENDING match waiting for opponent to confirm.
 * Feed post is only created after the opponent accepts a 'final' match.
 */
export async function logMatch(opponentId, winnerId, game, notes = null, matchType = 'casual') {
  const { data: { session } } = await supabase.auth.getSession()
  const me = session.user.id

  const { data: players } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', [me, opponentId])

  const myProfile  = players?.find(p => p.id === me)
  const oppProfile = players?.find(p => p.id === opponentId)
  const winnerName = winnerId === me ? myProfile?.username : oppProfile?.username
  const loserName  = winnerId === me ? oppProfile?.username : myProfile?.username

  const [player_a, player_b] = [me, opponentId].sort()

  // Both casual and final require opponent confirmation to keep results accurate
  const initialStatus = 'pending'

  // Generate UUID ourselves so matchId is always known even if RLS blocks the SELECT after insert
  const matchId = crypto.randomUUID()

  const { error: mErr } = await supabase
    .from('matches')
    .insert({ id: matchId, player_a, player_b, winner_id: winnerId, game, notes, logged_by: me, match_type: matchType, status: initialStatus })

  if (mErr) {
    if (mErr.code === '42P01') throw new Error('Tabla "matches" no encontrada. Ejecuta el SQL en Supabase primero.')
    throw new Error(mErr.message || 'Error al registrar la partida')
  }

  const iWon = winnerId === me
  const typeLabel = matchType === 'final' ? '🏆 Final' : '⚔️ Casual'

  // Notify opponent to confirm — same flow for both casual and final
  createNotification(
    opponentId,
    'match_result',
    iWon
      ? `⚔️ @${myProfile?.username} dice que te venció en ${game}`
      : `🏆 @${myProfile?.username} registró tu victoria en ${game}`,
    `${typeLabel}${notes ? ` · ${notes}` : ''} — ¿confirmás el resultado?`,
    { matchId, status: 'pending', game, matchType, winnerName, loserName }
  )

  return { id: matchId }
}

/**
 * Opponent accepts or rejects a pending match.
 * On accept: status → confirmed; if Final → creates feed post + notifies logger.
 * On reject: status → rejected; notifies logger.
 */
export async function respondToMatch(matchId, accept) {
  const { data: { session } } = await supabase.auth.getSession()
  const me = session.user.id
  const newStatus = accept ? 'confirmed' : 'rejected'

  // Fetch match details (also gets current status)
  const { data: match, error: fetchErr } = await supabase
    .from('matches')
    .select('player_a, player_b, winner_id, game, match_type, notes, logged_by, status')
    .eq('id', matchId)
    .single()
  if (fetchErr) throw new Error(fetchErr.message || 'No se encontró la partida')

  if (match.status !== 'pending') return { status: 'already_responded' }

  // Use RPC to bypass enum type issues in the direct UPDATE policy
  const { error: rpcErr } = await supabase.rpc('respond_to_match', {
    p_match_id: matchId,
    p_accept: accept,
  })
  if (rpcErr) throw new Error(rpcErr.message || 'Error al responder')

  // Fetch responder's username for the notification back to logger
  const { data: respProf } = await supabase
    .from('profiles').select('username').eq('id', me).single()

  if (accept && match.match_type === 'final') {
    // Create the feed post now that both parties agreed
    const { data: players } = await supabase
      .from('profiles').select('id, username').in('id', [match.player_a, match.player_b])
    const winner = players?.find(p => p.id === match.winner_id)
    const loser  = players?.find(p => p.id !== match.winner_id)
    const gs = GAME_STYLES[match.game] ?? {}
    const caption = `🏆 FINAL ${gs.emoji ?? ''} ${match.game} · @${winner?.username} venció a @${loser?.username}${match.notes ? ` · ${match.notes}` : ''} [VS]`
    const koUrl = `${window.location.origin}/ko-banner.png`
    await supabase.from('posts').insert({
      user_id: match.logged_by,
      caption,
      tag: match.game,
      image_url: koUrl,
    })
  }

  // Award 1 Q point to match winner when confirmed
  if (accept) awardPoints(match.winner_id, 1, 'match_won')

  // Notify the logger of the outcome
  createNotification(
    match.logged_by,
    'match_result',
    accept
      ? `✅ @${respProf?.username} confirmó tu resultado en ${match.game}`
      : `❌ @${respProf?.username} rechazó tu resultado en ${match.game}`,
    match.notes || match.game,
    { matchId, status: newStatus }
  )

  return { status: newStatus }
}

/**
 * Get head-to-head record between the current user and another user.
 * - Non-premium: rolling 7-day window (auto-resets every 7 days).
 * - Premium / admin: all matches after the last manual reset (or all time if never reset).
 * Returns { wins, losses, total, matches[], myId, cutoff, nextReset }.
 */
export async function getHeadToHead(opponentId, isPremium = false) {
  const { data: { session } } = await supabase.auth.getSession()
  const me = session.user.id
  const [pa, pb] = [me, opponentId].sort()

  // Determine the cutoff date
  let cutoff = null
  let nextReset = null
  if (isPremium) {
    // Premium/admin: use the latest manual reset between these two players (either side)
    const { data: resets } = await supabase
      .from('h2h_resets')
      .select('reset_at')
      .or(`and(initiator_id.eq.${me},opponent_id.eq.${opponentId}),and(initiator_id.eq.${opponentId},opponent_id.eq.${me})`)
      .order('reset_at', { ascending: false })
      .limit(1)
    cutoff = resets?.[0]?.reset_at ?? null   // null = no manual reset, show all time
  } else {
    // Free users: rolling 7-day window
    const now = new Date()
    cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    nextReset = new Date(now.getTime() + (7 - (now.getDay() || 7)) * 24 * 60 * 60 * 1000)
    // Simpler: exact 7 days from cutoff — we just store the cutoff, next reset = cutoff + 14d
    // Actually: show time remaining until the "oldest match" drops off naturally
    nextReset = null  // computed in UI from oldest match date
  }

  let query = supabase
    .from('matches')
    .select('id, winner_id, game, match_type, notes, created_at')
    .eq('player_a', pa)
    .eq('player_b', pb)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })

  if (cutoff) query = query.gte('created_at', cutoff)

  const { data, error } = await query
  if (error) throw error
  const matches = data ?? []
  const wins    = matches.filter(m => m.winner_id === me).length
  const losses  = matches.filter(m => m.winner_id === opponentId).length
  return { wins, losses, total: wins + losses, matches, myId: me, cutoff, isPremium }
}

/**
 * Manually reset the H2H counter against an opponent (premium / admin only).
 * Inserts a reset record — future getHeadToHead calls will only count matches after this.
 */
export async function resetH2H(opponentId) {
  const { data: { session } } = await supabase.auth.getSession()
  const { error } = await supabase
    .from('h2h_resets')
    .insert({ initiator_id: session.user.id, opponent_id: opponentId })
  if (error) throw error
}

// ── Q POINTS ─────────────────────────────────

/** Fire-and-forget: award Q points to a user */
function awardPoints(userId, amount, reason) {
  supabase.rpc('award_points', { p_user_id: userId, p_amount: amount, p_reason: reason })
    .then(() => {}).catch(() => {})
}

/** Request to redeem points for store credit (min 1000 = $1) */
export async function redeemPoints(points) {
  const { data, error } = await supabase.rpc('redeem_points', { p_points: points })
  if (error) throw new Error(error.message)
  return data
}

/** Admin: fetch all pending redemptions */
export async function getPendingRedemptions() {
  const { data, error } = await supabase
    .from('q_redemptions')
    .select('id, points, created_at, status, user_id, profiles(username, avatar_url)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Admin: approve a redemption */
export async function approveRedemption(id) {
  const { error } = await supabase.rpc('approve_redemption', { p_id: id })
  if (error) throw error
}

/** User's full Q Points history (newest first) */
// ── TCG Articles ─────────────────────────────
export async function getArticles(game = null, limit = 12) {
  let q = supabase
    .from('tcg_articles')
    .select('id, game, source_name, title, url, image_url, published_at')
    .order('published_at', { ascending: false })
    .limit(limit)
  if (game) q = q.eq('game', game)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getPointsHistory(limit = 80) {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('q_points_log')
    .select('amount, reason, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/** Admin: reject a redemption and refund points */
export async function rejectRedemption(id, note = '') {
  const { error } = await supabase.rpc('reject_redemption', { p_id: id, p_note: note })
  if (error) throw error
}

/** Returns W/L record grouped by game for the current user (confirmed matches only) */
export async function getMyStats() {
  const { data: { session } } = await supabase.auth.getSession()
  const me = session.user.id
  const { data, error } = await supabase
    .from('matches')
    .select('game, winner_id')
    .or(`player_a.eq.${me},player_b.eq.${me}`)
    .eq('status', 'confirmed')
  if (error) throw error
  const map = {}
  for (const m of data ?? []) {
    if (!map[m.game]) map[m.game] = { wins: 0, losses: 0 }
    if (m.winner_id === me) map[m.game].wins++
    else map[m.game].losses++
  }
  return Object.entries(map)
    .map(([game, { wins, losses }]) => ({ game, wins, losses, total: wins + losses }))
    .sort((a, b) => b.total - a.total)
}

// ── REALTIME ─────────────────────────────────
export function subscribeToNotifications(userId, callback) {
  return supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, callback)
    .subscribe()
}

export function subscribeToPackage(packageId, callback) {
  return supabase
    .channel(`package:${packageId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'packages',
      filter: `id=eq.${packageId}`
    }, callback)
    .subscribe()
}

// ── AUCTIONS ─────────────────────────────────

export async function getAuctions() {
  const { data, error } = await supabase
    .from('auctions')
    .select(`
      id, title, game, image_url, min_bid, start_time, duration_seconds,
      status, winner_id, winning_amount, created_at,
      auction_bids ( id, user_id, amount ),
      auction_watches ( user_id )
    `)
    .order('start_time', { ascending: false })
    .limit(40)
  if (error) throw error
  return data
}

export async function createAuction({ title, game, imageUrl, minBid, startTime }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('No hay sesión activa')
  const { data, error } = await supabase
    .from('auctions')
    .insert({
      title, game, image_url: imageUrl,
      min_bid: minBid, start_time: startTime,
      duration_seconds: 300,
      status: 'pending',
      created_by: session.user.id,
    })
    .select().single()
  if (error) throw error
  return data
}

export async function uploadAuctionImage(file, userId) {
  const ext  = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('auctions').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('auctions').getPublicUrl(path)
  return data.publicUrl
}

export async function placeBid(auctionId, amount) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('No hay sesión activa')
  const { data, error } = await supabase.rpc('place_bid', {
    p_auction_id: auctionId,
    p_user_id:    session.user.id,
    p_amount:     amount,
  })
  if (error) throw new Error(error.message.replace('ERROR: ', '').split('\n')[0])
  return data
}

export async function endAuction(auctionId) {
  const { error } = await supabase.rpc('end_auction', { p_auction_id: auctionId })
  if (error) console.warn('[end_auction]', error.message)
}

export async function notifyAuctionWatchers(auctionId) {
  const { error } = await supabase.rpc('notify_auction_watchers', { p_auction_id: auctionId })
  if (error) console.warn('[notify_watchers]', error.message)
}

export async function deleteAuction(auctionId) {
  const { error } = await supabase.from('auctions').delete().eq('id', auctionId)
  if (error) throw error
}

export async function toggleAuctionWatch(auctionId, watching) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) return
  if (watching) {
    await supabase.from('auction_watches')
      .upsert({ auction_id: auctionId, user_id: session.user.id })
  } else {
    await supabase.from('auction_watches')
      .delete()
      .eq('auction_id', auctionId)
      .eq('user_id', session.user.id)
  }
}

// helper: fetch profiles map for a list of user ids
async function fetchProfilesMap(userIds) {
  if (!userIds.length) return {}
  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds)
  return Object.fromEntries((data || []).map(p => [p.id, p]))
}

export async function getAuctionBids(auctionId) {
  const { data, error } = await supabase
    .from('auction_bids')
    .select('id, amount, created_at, user_id')
    .eq('auction_id', auctionId)
    .order('amount', { ascending: false })
    .limit(50)
  if (error) throw error
  const pMap = await fetchProfilesMap([...new Set((data || []).map(b => b.user_id))])
  return (data || []).map(b => ({ ...b, profiles: pMap[b.user_id] ?? null }))
}

export async function getAuctionChat(auctionId) {
  const { data, error } = await supabase
    .from('auction_chat')
    .select('id, message, created_at, user_id')
    .eq('auction_id', auctionId)
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) throw error
  const pMap = await fetchProfilesMap([...new Set((data || []).map(m => m.user_id))])
  return (data || []).map(m => ({ ...m, profiles: pMap[m.user_id] ?? null }))
}

export async function sendAuctionChat(auctionId, message) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('No hay sesión activa')
  const { data, error } = await supabase
    .from('auction_chat')
    .insert({ auction_id: auctionId, user_id: session.user.id, message: message.trim() })
    .select('id, message, created_at, user_id')
    .single()
  if (error) throw error
  return data  // caller adds profiles from context
}

export function subscribeToAuctionBids(auctionId, callback) {
  return supabase.channel(`auction-bids-${auctionId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'auction_bids',
      filter: `auction_id=eq.${auctionId}`,
    }, callback)
    .subscribe()
}

export function subscribeToAuctionChat(auctionId, callback) {
  return supabase.channel(`auction-chat-${auctionId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'auction_chat',
      filter: `auction_id=eq.${auctionId}`,
    }, callback)
    .subscribe()
}

// ─────────────────────────────────────────────
// SHOP — Product catalog
// ─────────────────────────────────────────────

// Fetch image URL from Coqui Hobby API by SKU
export async function fetchCoquiImage(sku) {
  try {
    const res = await fetch(`https://api.coquihobby.com/api/Product/GetProduct?id=${encodeURIComponent(sku)}`)
    if (!res.ok) return null
    const data = await res.json()
    return data?.images?.[0]?.small ?? data?.images?.[0]?.medium ?? null
  } catch { return null }
}

export async function getShopProducts() {
  const { data, error } = await supabase
    .from('shop_products')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertShopProduct(product) {
  const { data, error } = await supabase
    .from('shop_products')
    .upsert(product, { onConflict: 'sku' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateShopProduct(id, fields) {
  const { data, error } = await supabase
    .from('shop_products')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteShopProduct(id) {
  const { error } = await supabase
    .from('shop_products')
    .update({ active: false })
    .eq('id', id)
  if (error) throw error
}

// ── Shop Reservations ─────────────────────────

const BRANCH_QTY_COL = { david: 'qty_david', panama: 'qty_panama', chitre: 'qty_chitre' }
const BRANCH_LABEL   = { david: 'David',     panama: 'Panamá',     chitre: 'Chitré'   }

export async function getProductReservations(productId) {
  const { data, error } = await supabase
    .from('shop_reservations')
    .select('id, qty, paid_pct, branch, notes, created_at, user_id, product_id, profiles:user_id(id, username, avatar_url)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createReservation({ productId, userId, qty, paidPct, branch, notes, productName }) {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('shop_reservations')
    .insert({ product_id: productId, user_id: userId, qty, paid_pct: paidPct, branch, notes: notes || null, created_by: session?.user?.id })
    .select('id, qty, paid_pct, branch, notes, created_at, user_id, product_id, profiles:user_id(id, username, avatar_url)')
    .single()
  if (error) throw error

  // Decrement branch inventory
  const qtyCol = BRANCH_QTY_COL[branch]
  let qtyUpdate = {}
  if (qtyCol) {
    const { data: cur } = await supabase.from('shop_products').select(`id, ${qtyCol}`).eq('id', productId).single()
    const newQty = Math.max(0, (cur?.[qtyCol] ?? 0) - qty)
    await supabase.from('shop_products').update({ [qtyCol]: newQty }).eq('id', productId)
    qtyUpdate = { [qtyCol]: newQty }
  }

  // Notify customer
  const paidLabel = paidPct === 100 ? '100% pagado ✅' : '50% de depósito recibido'
  createNotification(
    userId, 'shop_reservation', '📦 Pre-order confirmado',
    `Tu reserva de ${qty > 1 ? `${qty}x ` : ''}*${productName}* en ${BRANCH_LABEL[branch] ?? branch} está registrada — ${paidLabel}. Te avisamos cuando esté listo.`,
    { productId }
  )
  return { reservation: data, qtyUpdate }
}

export async function deleteReservation(reservation) {
  const { error } = await supabase.from('shop_reservations').delete().eq('id', reservation.id)
  if (error) throw error

  // Restore branch inventory
  const qtyCol = BRANCH_QTY_COL[reservation.branch]
  let qtyUpdate = {}
  if (qtyCol && reservation.product_id) {
    const { data: cur } = await supabase.from('shop_products').select(`id, ${qtyCol}`).eq('id', reservation.product_id).single()
    const newQty = (cur?.[qtyCol] ?? 0) + reservation.qty
    await supabase.from('shop_products').update({ [qtyCol]: newQty }).eq('id', reservation.product_id)
    qtyUpdate = { [qtyCol]: newQty }
  }
  return { qtyUpdate }
}
