// ─────────────────────────────────────────────
// QUEST — Edge Function: reset-season
// Runs automatically: May 1 / Sep 1 / Jan 1 at 12:01 AM Panama (05:01 UTC)
// Only accepts POST — GET returns a safe status response, never triggers a reset.
//
// What it does:
//   1. Find the active season
//   2. Snapshot top-50 per game+branch
//   3. Award gold/silver/bronze badges to top-3 per game+branch
//   4. Notify top-3 with recognition; notify top-2 about Championship qualification
//   5. Close the old season (active = false)
//   6. Create the new season (next 4-month window, active = true)
//   7. Delete approved ranking_claims to reset the leaderboard to 0
// ─────────────────────────────────────────────
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const GAMES    = ['MTG', 'Pokemon', 'One Piece', 'Digimon', 'Riftbound', 'Gundam']
const BRANCHES = ['Panama', 'David', 'Chitre']

const MEDAL = ['🥇', '🥈', '🥉']
const MEDAL_LABEL = ['Oro', 'Plata', 'Bronce']
const MEDAL_COLOR = ['gold', 'silver', 'bronze']

function nextSeasonWindow(endDate: Date) {
  const y = endDate.getFullYear()
  const m = endDate.getMonth() + 1
  let startMonth: number, endMonth: number
  let startYear = y, endYear = y

  if (m <= 4)      { startMonth = 5; endMonth = 8 }
  else if (m <= 8) { startMonth = 9; endMonth = 12 }
  else             { startMonth = 1; endMonth = 4; startYear = y + 1; endYear = y + 1 }

  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(endYear, endMonth, 0).getDate()
  const fmtDate = (yr: number, mo: number, d: number) => `${yr}-${pad(mo)}-${pad(d)}`
  const seasonLabel = startMonth === 1 ? 1 : startMonth === 5 ? 2 : 3

  return {
    start:  fmtDate(startYear, startMonth, 1),
    end:    fmtDate(endYear,   endMonth,   lastDay),
    name:   `Temporada ${seasonLabel}`,
    label:  seasonLabel,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  // ── Guard: GET never triggers a reset ──────────────────────────────
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'reset-season is live. Send POST to trigger.' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // ── Guard: must be called by cron (service_role key) or with CRON_SECRET ──
  const authHeader  = req.headers.get('Authorization') ?? ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronSecret  = Deno.env.get('CRON_SECRET') ?? ''
  const bearer      = authHeader.replace('Bearer ', '')
  if (bearer !== serviceRole && (cronSecret && bearer !== cronSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    // ── 1. Active season ───────────────────────────────────────────────
    const { data: activeSeason, error: seasonErr } = await supabase
      .from('seasons')
      .select('*')
      .eq('active', true)
      .maybeSingle()

    if (seasonErr) throw seasonErr
    if (!activeSeason) {
      return new Response(JSON.stringify({ message: 'No active season found' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { id: seasonId, number: seasonNumber, name: seasonName } = activeSeason

    // ── 2 + 3. Snapshot + award top-3 per game×branch ─────────────────
    let snapshots = 0

    for (const game of GAMES) {
      for (const branch of [...BRANCHES, null]) {  // real branches first, then global snapshot
        const { data: rows, error } = await supabase.rpc('get_game_leaderboard', {
          p_game:   game,
          p_branch: branch,
        })
        if (error || !rows?.length) continue

        // 2. Snapshot top-50
        const snapshotRows = rows.slice(0, 50).map((r: any, i: number) => ({
          season_id: seasonId,
          user_id:   r.id,
          game,
          branch:    branch ?? null,
          points:    r.points,
          rank:      i + 1,
        }))
        const { error: snapErr } = await supabase
          .from('season_snapshots')
          .upsert(snapshotRows, { onConflict: 'season_id,user_id,game,branch' })
        if (!snapErr) snapshots += snapshotRows.length

        // 3. Award badges + notify top-3 (only per real branch, not global)
        if (branch !== null) {
          for (let rank = 0; rank < Math.min(3, rows.length); rank++) {
            const player   = rows[rank]
            const badgeKey = `S${seasonNumber}-${rank + 1}-${game}-${branch}`  // e.g. S2-1-MTG-Panama

            // Append badge (idempotent)
            await supabase.rpc('append_season_badge', {
              p_user_id: player.id,
              p_badge:   badgeKey,
            })

            // Personalised notification
            const medal = MEDAL[rank]
            const isChamp = rank === 0

            const title = isChamp
              ? `${medal} ¡Campeón de ${seasonName}!`
              : `${medal} Top ${rank + 1} de ${seasonName}`

            const body = isChamp
              ? `Terminaste #1 en ${game} – ${branch} con ${player.points} pts. Habla con el staff para reclamar tu premio. ¡Felicitaciones! 🎉`
              : `Quedaste en el puesto #${rank + 1} en ${game} – ${branch} con ${player.points} pts. ${rank < 2 ? '¡Clasificas al Season Championship! 🏆' : '¡Bien jugado! 💪'}`

            await supabase.from('notifications').insert({
              user_id: player.id,
              type:    'season_champion',
              title,
              body,
              meta:    { seasonNumber, game, branch, rank: rank + 1, badge: badgeKey, medal: MEDAL_COLOR[rank] },
            })
          }
        }
      }
    }

    // ── 5. Close current season ────────────────────────────────────────
    await supabase.from('seasons').update({ active: false }).eq('id', seasonId)

    // ── 6. Create next season ──────────────────────────────────────────
    const next = nextSeasonWindow(new Date(activeSeason.end_date))
    await supabase.from('seasons').insert({
      number:     seasonNumber + 1,
      name:       next.name,
      start_date: next.start,
      end_date:   next.end,
      active:     true,
    })

    // ── 7. Reset leaderboard — delete approved claims ──────────────────
    const { count: deletedClaims } = await supabase
      .from('ranking_claims')
      .delete({ count: 'exact' })
      .eq('status', 'approved')

    const result = {
      message:       'Season reset complete',
      season:        seasonName,
      nextSeason:    next.name,
      snapshots,
      deletedClaims: deletedClaims ?? 0,
      timestamp:     new Date().toISOString(),
    }
    console.log(JSON.stringify(result))
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (e) {
    console.error('reset-season error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})
