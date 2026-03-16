// ─────────────────────────────────────────────
// QUEST — Supabase client
// ─────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { RANKING_PTS, GAME_STYLES } from './constants'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Bump this version whenever the client config changes — forces HMR recreation
const CLIENT_V = 5

if (!window.__supabase || window.__supabase.__v !== CLIENT_V) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,   // needed so magic-link recovery tokens are parsed from URL
      // Bypass Web Locks API — prevents infinite queue when lock gets stuck in Chrome
      // Safe for single-tab apps
      lock: (_name, _timeout, fn) => fn(),
    },
    global: {
      // Hard timeout on every fetch — storage uploads get more time than API calls
      fetch: (url, options) => {
        const isStorage = typeof url === 'string' && url.includes('/storage/v1/')
        const ms = isStorage ? 60000 : 12000   // 60 s for uploads, 12 s for API
        const ctrl = new AbortController()
        const id = setTimeout(() => ctrl.abort(), ms)
        return fetch(url, { ...options, signal: ctrl.signal })
          .finally(() => clearTimeout(id))
      }
    }
  })
  client.__v = CLIENT_V
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
  return data
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
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
    .select('id, username, role, branch, avatar_url, points, verified, phone, email, is_owner')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export async function uploadAvatar(file) {
  const { data: { user } } = await supabase.auth.getUser()
  const ext  = file.name.split('.').pop() || 'jpg'
  const path = `${user.id}/avatar.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
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
  let query = supabase
    .from('posts')
    .select(`
      id, caption, tag, image_url, created_at,
      profiles:user_id ( id, username, avatar_url, role, verified, is_owner ),
      post_likes ( count ),
      post_comments ( count )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (game) query = query.eq('tag', game)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function uploadPostImage(file) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('No hay sesión activa')
  // Normalize extension — fallback to jpg if name has no dot
  const parts = file.name.split('.')
  const ext   = parts.length > 1 ? parts.pop() : 'jpg'
  const path  = `${session.user.id}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('posts').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw new Error(error.message || error.error || 'Error al subir la imagen')
  const { data } = supabase.storage.from('posts').getPublicUrl(path)
  return data.publicUrl
}

export async function createPost({ caption, game, imageUrl }) {
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

  const { data, error } = await supabase
    .from('posts')
    .insert({ user_id: session.user.id, caption, tag: game, image_url: imageUrl })
    .select()
    .single()
  if (error) throw new Error(error.message || error.details || 'Error al crear el post')
  return data
}

// ── ADMIN — user management ──────────────────
export async function getAdminUsers(query = '') {
  let q = supabase
    .from('profiles')
    .select('id, username, avatar_url, role, points')
    .order('username', { ascending: true })
    .limit(40)
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
  // Fetch image_url first so we can clean up storage too
  const { data: post } = await supabase
    .from('posts')
    .select('image_url')
    .eq('id', postId)
    .single()

  // Delete the DB row (cascades likes/comments)
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) throw error

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
    .single()

  if (existing) {
    await supabase.from('post_likes').delete().eq('id', existing.id)
    return false
  } else {
    await supabase.from('post_likes').insert({ post_id: postId, user_id: session.user.id })
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
    .single()

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
    .single()

  if (existing) {
    await supabase.from('follows').delete().eq('id', existing.id)
    return false
  } else {
    await supabase.from('follows').insert({ follower_id: session.user.id, following_id: targetUserId })
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
  // Per-game ranking: compute from approved claims
  if (game) {
    let q = supabase
      .from('ranking_claims')
      .select('user_id, position, profiles:user_id(id, username, avatar_url, branch, verified, role, is_owner)')
      .eq('status', 'approved')
      .eq('game', game)
    const { data, error } = await q
    if (error) throw error
    const map = {}
    for (const c of data) {
      const uid = c.user_id
      if (!map[uid]) map[uid] = { ...c.profiles, points: 0 }
      map[uid].points += RANKING_PTS[c.position] ?? 0
    }
    let entries = Object.values(map).filter(e => e.points > 0)
    if (branch) entries = entries.filter(e => e.branch === branch)
    return entries.sort((a, b) => b.points - a.points).slice(0, 50)
  }

  // Overall ranking: read from profiles.points
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

export async function getTournaments({ game = null, branch = null } = {}) {
  let query = supabase
    .from('tournaments')
    .select(`
      id, name, game, branch, date, player_count, rounds,
      tournament_results ( position, user_id, profiles:user_id ( username ) ),
      tournament_participants ( user_id )
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
  const { error } = await supabase
    .from('profiles').update({ points: newPoints }).eq('id', userId)
  if (error) throw error
  return newPoints
}

export async function setUserPoints(userId, points) {
  const newPoints = Math.max(0, Math.round(Number(points) || 0))
  const { error } = await supabase
    .from('profiles').update({ points: newPoints }).eq('id', userId)
  if (error) throw error
  return newPoints
}

export async function createTournament({ name, game, branch, date, playerCount, rounds }) {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({ name, game, branch, date, player_count: playerCount, rounds })
    .select()
    .single()
  if (error) throw error
  return data
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

  // If auto-approved (staff), add points immediately to profile
  if (autoApprove && data) {
    const pts = RANKING_PTS[position] ?? 1
    const { data: prof } = await supabase
      .from('profiles').select('points').eq('id', session.user.id).single()
    await supabase
      .from('profiles')
      .update({ points: (prof?.points ?? 0) + pts })
      .eq('id', session.user.id)
  }

  return data
}

export async function getPendingClaims() {
  const { data, error } = await supabase
    .from('ranking_claims')
    .select(`
      id, position, tournament_name, game, notes, evidence_url, created_at,
      profiles:user_id ( id, username, avatar_url )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function reviewClaim(claimId, status) {
  const { data: { session } } = await supabase.auth.getSession()

  // Fetch claim data (needed for points + notification)
  const { data: claim } = await supabase
    .from('ranking_claims')
    .select('user_id, position, tournament_name, game')
    .eq('id', claimId)
    .single()

  // If approving, add points to the user's profile
  if (status === 'approved' && claim) {
    const pts = RANKING_PTS[claim.position] ?? 1
    const { data: prof } = await supabase
      .from('profiles').select('points').eq('id', claim.user_id).single()
    await supabase
      .from('profiles')
      .update({ points: (prof?.points ?? 0) + pts })
      .eq('id', claim.user_id)
  }

  // Try full update first; fall back to status-only if optional audit columns don't exist yet
  let { error } = await supabase
    .from('ranking_claims')
    .update({ status, reviewed_by: session.user.id, reviewed_at: new Date().toISOString() })
    .eq('id', claimId)
  if (error) {
    const isSchemaError = error.code === 'PGRST204' || error.message?.includes('reviewed_by') || error.message?.includes('reviewed_at')
    if (isSchemaError) {
      const fallback = await supabase.from('ranking_claims').update({ status }).eq('id', claimId)
      if (fallback.error) throw fallback.error
    } else {
      throw error
    }
  }

  // Notify the user about the result
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
    .select('id, name, game, status, set_code, estimated_value, notes, image_url, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addCard({ name, game, cardStatus, qty, price, note, imageUrl }) {
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
    .insert({ user_id: session.user.id, name, game, status: cardStatus, estimated_value: price, notes: note, image_url: imageUrl })
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
  if (!query || query.length < 2) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .ilike('username', `%${query}%`)
    .limit(8)
  if (error) throw error
  return data ?? []
}

export async function createNotification(userId, type, title, body, meta = {}) {
  await supabase.from('notifications').insert({
    user_id: userId, type, title, body, meta, read: false
  })
}

export async function createPackage({ originBranch, destinationBranch, recipientId, notes, items, imageUrl }) {
  const { data: { session } } = await supabase.auth.getSession()

  const { data: pkg, error } = await supabase
    .from('packages')
    .insert({
      status: 'pending_confirmation',
      sender_id: session.user.id,
      created_by: session.user.id,
      recipient_id: recipientId || null,
      origin_branch: originBranch,
      destination_branch: destinationBranch,
      notes,
      image_url: imageUrl || null,
    })
    .select(`
      id, tracking_code, status, origin_branch, destination_branch, created_at, notes,
      sender:sender_id ( id, username ),
      recipient:recipient_id ( id, username ),
      package_items ( * ),
      package_events ( * )
    `)
    .single()
  if (error) throw error

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

export async function getPendingArrivalPackages() {
  const { data, error } = await supabase
    .from('packages')
    .select(`
      id, tracking_code, status, origin_branch, destination_branch, created_at, notes,
      sender:sender_id ( id, username ),
      recipient:recipient_id ( id, username )
    `)
    .eq('status', 'pending_arrival')
    .order('created_at', { ascending: false })
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

  if (error) throw error
  return data.id
}

/** Fetch last N messages for a conversation, oldest first */
export async function getMessages(conversationId, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, body, read, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data ?? []
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

  // Notify recipient — fire and forget
  createNotification(
    recipientId,
    'new_message',
    '💬 Nuevo mensaje',
    body.length > 60 ? body.slice(0, 60) + '…' : body,
    { conversationId }
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

  const { data: match, error: mErr } = await supabase
    .from('matches')
    .insert({ player_a, player_b, winner_id: winnerId, game, notes, logged_by: me, match_type: matchType, status: 'pending' })
    .select('id')
    .single()

  if (mErr) {
    if (mErr.code === '42P01') throw new Error('Tabla "matches" no encontrada. Ejecuta el SQL en Supabase primero.')
    throw new Error(mErr.message || 'Error al registrar la partida')
  }

  // Notify opponent to confirm — they'll see Accept/Reject buttons in their notif panel
  const iWon = winnerId === me
  const typeLabel = matchType === 'final' ? '🏆 Final' : '⚔️ Casual'
  createNotification(
    opponentId,
    'match_result',
    iWon
      ? `⚔️ @${myProfile?.username} dice que te venció en ${game}`
      : `🏆 @${myProfile?.username} registró tu victoria en ${game}`,
    `${typeLabel}${notes ? ` · ${notes}` : ''} — ¿confirmás el resultado?`,
    { matchId: match.id, status: 'pending', game, matchType, winnerName, loserName }
  )

  return match
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

  // Fetch match details
  const { data: match, error: fetchErr } = await supabase
    .from('matches')
    .select('player_a, player_b, winner_id, game, match_type, notes, logged_by')
    .eq('id', matchId)
    .single()
  if (fetchErr) throw new Error(fetchErr.message || 'No se encontró la partida')

  // Update status (RLS only allows the opponent, not the logger)
  // Use .select() so we can detect if 0 rows were updated (match already responded to)
  const { data: updated, error: updErr } = await supabase
    .from('matches')
    .update({ status: newStatus })
    .eq('id', matchId)
    .eq('status', 'pending')
    .select('id')
  if (updErr) throw new Error(updErr.message || 'Error al responder')
  if (!updated || updated.length === 0) {
    // Match was already confirmed/rejected — nothing left to do
    return { status: 'already_responded' }
  }

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
    const caption = `🏆 FINAL · @${winner?.username} venció a @${loser?.username} en ${gs.emoji ?? ''} ${match.game}${match.notes ? ` · ${match.notes}` : ''} [VS]`
    await supabase.from('posts').insert({ user_id: match.logged_by, caption, tag: match.game })
  }

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
 * Returns { wins, losses, total }.
 */
export async function getHeadToHead(opponentId) {
  const { data: { session } } = await supabase.auth.getSession()
  const me = session.user.id
  const [pa, pb] = [me, opponentId].sort()

  const { data, error } = await supabase
    .from('matches')
    .select('winner_id')
    .eq('player_a', pa)
    .eq('player_b', pb)
    .eq('status', 'confirmed')

  if (error) throw error
  const wins   = (data ?? []).filter(m => m.winner_id === me).length
  const losses = (data ?? []).filter(m => m.winner_id === opponentId).length
  return { wins, losses, total: wins + losses }
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
