// ─────────────────────────────────────────────
// QUEST — RankingsScreen
// ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { getLeaderboard, getTournaments, getPendingClaims, reviewClaim, joinTournament, leaveTournament, setUserPoints, rejectUserGameClaims, updateTournament, searchUsers, inviteTournament, setTournamentPayment, getActiveSeason, staffAwardRankingPoints, staffSetGamePoints, getLeagues, getLeagueDetails, joinLeague, leaveLeague, updateLeagueStatus, updateFechaStatus, upsertLeagueResult, recalcFechaPoints, submitMyResult, addLeagueFecha, addLeagueParticipant, setLeaguePayment, setParticipantTier, deleteLeague } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { GAMES, GAME_STYLES, BRANCHES, BRANCH_STYLES, getGameUsername } from '../lib/constants'
// ClaimModal lives in App.jsx level — see src/screens/ClaimModal.jsx
import Avatar from '../components/Avatar'
import GameIcon from '../components/GameIcon'
import { PremiumBadge, RoleBadge, MapPinIcon, SearchIcon, ShareIcon, PAID_ROLES, SACalendar, SAClock, SAUsers } from '../components/Icons'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { shareOrCopy } from '../lib/share'
import { COLOR, RADIUS, TYPE, WEIGHT, MOTION, FONT_STACK, ELEVATION } from '../lib/ui'

// ── Inline icons (16×16, fill, strokeWidth 0) ─────────
const UserPlusIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} strokeWidth="0">
    <path d="M6 8c2.21 0 4-1.79 4-4S8.21 0 6 0 2 1.79 2 4s1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm9-4v-2h-2V2h-2V0h2V-2h2v2h2v2h-2z" />
  </svg>
)
const CheckIcon = ({ size = 12, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} strokeWidth="0">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
  </svg>
)
const PencilIcon = ({ size = 12, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} strokeWidth="0">
    <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086zM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.249.249 0 0 0 .108-.064l6.286-6.286z"/>
  </svg>
)

const PTS = { 1: 3, 2: 2, 3: 1 }

// Parse a Supabase date field safely: handles full ISO strings, plain dates, stale years.
// Returns a corrected YYYY-MM-DD string (advances year if date is clearly in the past).
function safeDate(raw, fallback) {
  try {
    const s = String(raw ?? fallback ?? '').slice(0, 10)
    if (!s || s.length < 10) return fallback ?? '2026-04-30'
    let d = new Date(s + 'T12:00:00')
    if (isNaN(d)) return fallback ?? '2026-04-30'
    const now = new Date()
    // If the date is more than 6 months in the past, advance year(s) until it isn't
    const threshold = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    while (d < threshold) d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().slice(0, 10)
  } catch { return fallback ?? '2026-04-30' }
}

// ── Season Banner ─────────────────────────────
function SeasonBanner({ season }) {
  if (!season) return null

  const endStr   = safeDate(season.end_date,   '2026-04-30')
  const startStr = safeDate(season.start_date, '2026-01-01')
  const end      = new Date(endStr   + 'T23:59:59')
  const start    = new Date(startStr + 'T00:00:00')
  const now      = new Date()
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86_400_000))
  const pct      = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
  const monthFmt = (d) => (!d || isNaN(d)) ? '?' : d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
  const rangeStr = `${monthFmt(start)} – ${monthFmt(end)}`

  return (
    <div style={{
      margin: '6px 14px 0',
      padding: '9px 12px',
      borderRadius: 12,
      background: '#F59E0B08',
      border: '1px solid #F59E0B22',
      display: 'flex', flexDirection: 'column', gap: 6,
      animation: 'slideDown 0.22s cubic-bezier(0.34,1.3,0.64,1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="#F59E0B" strokeWidth="0">
          <path d={HAND_MIDDLE_PATH} />
        </svg>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#F59E0B' }}>
            {season.name}
          </span>
          <span style={{ fontSize: 10, color: '#4B5563', marginLeft: 6 }}>{rangeStr}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: daysLeft <= 7 ? '#F87171' : '#6B7280' }}>
            {daysLeft === 0 ? '¡hoy!' : `${daysLeft}d`}
          </span>
          <div style={{
            fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 5,
            background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)',
            color: '#4ADE80', letterSpacing: '0.05em',
          }}>ACTIVA</div>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: '#F59E0B60', transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

const HAND_MIDDLE_PATH = "M8 0.16c-0.6769464285714285 0 -1.2252392857142855 0.5482964285714286 -1.2252392857142855 1.2252392857142855v5.0296071428571425c-0.26036428571428566 -0.23279642857142857 -0.6034321428571429 -0.37369642857142854 -0.9801928571428571 -0.37369642857142854 -0.8117214285714286 0 -1.4702857142857142 0.6585642857142857 -1.4702857142857142 1.4702857142857142v2.450478571428571c0 0.26955357142857145 -0.22054285714285715 0.49009642857142854 -0.49009642857142854 0.49009642857142854s-0.49009642857142854 -0.22054285714285715 -0.49009642857142854 -0.49009642857142854v-1.7061464285714285c-0.061260714285714286 0.042885714285714284 -0.11946071428571428 0.09189285714285714 -0.17765714285714285 0.13783928571428572l-0.5881178571428571 0.49009642857142854c-0.4472107142857143 0.3737 -0.7045107142857142 0.9250571428571428 -0.7045107142857142 1.5070464285714285v1.1639749999999998c0 1.1639785714285713 0.5176642857142857 2.266692857142857 1.4120892857142857 3.011025l0.16540714285714286 0.13783928571428572c0.8821714285714286 0.7351464285714285 1.9910142857142854 1.1364107142857143 3.1366107142857143 1.1364107142857143h3.617521428571428c2.1656071428571426 0 3.9207642857142857 -1.7551535714285713 3.9207642857142857 -3.9207642857142857v-2.9375142857142853c0 -0.8117178571428572 -0.6585678571428571 -1.4702857142857142 -1.4702857142857142 -1.4702857142857142 -0.37982499999999997 0 -0.7228928571428571 0.14396428571428568 -0.9832571428571427 0.3767607142857143 -0.058196428571428566 -0.7596464285714285 -0.6922607142857142 -1.3569535714285714 -1.4672214285714285 -1.3569535714285714 -0.3767642857142857 0 -0.7198285714285714 0.14090357142857143 -0.9801928571428571 0.3737V1.3852392857142857C9.225239285714284 0.7082964285714285 8.676942857142857 0.16 8 0.16Z"
const HAND_PEACE_PATH = "M7.509965625 0.16c0.5420625 0 0.98 0.4379375 0.98 0.98v6.37h-1.96V1.14c0 -0.5420625 0.4379375 -0.98 0.98 -0.98Zm2.94 4.9c0.5420625 0 0.98 0.4379375 0.98 0.98V8c0 0.5420625 -0.4379375 0.98 -0.98 0.98s-0.98 -0.4379375 -0.98 -0.98v-1.96c0 -0.5420625 0.4379375 -0.98 0.98 -0.98Zm1.96 1.96c0 -0.5420625 0.4379375 -0.98 0.98 -0.98s0.98 0.4379375 0.98 0.98v1.96c0 0.5420625 -0.4379375 0.98 -0.98 0.98s-0.98 -0.4379375 -0.98 -0.98v-1.96ZM3.507278125 1.728l2.529625 5.782h-2.137625L1.712653125 2.512c-0.2174375 -0.496125 0.0091875 -1.071875 0.5053125 -1.2893125s1.0749375 0.0091875 1.2893125 0.5053125Zm0.826875 6.7773125 -0.006125 -0.0153125h2.9369375c0.6768125 0 1.225 0.5481875 1.225 1.225s-0.5481875 1.225 -1.225 1.225h-1.715c-0.2695 0 -0.49 0.2205 -0.49 0.49s0.2205 0.49 0.49 0.49h1.715c1.218875 0 2.205 -0.986125 2.205 -2.205v-0.018375c0.287875 0.165375 0.6216875 0.263375 0.98 0.263375 0.40425 0 0.777875 -0.1225 1.09025 -0.33075 0.2664375 0.7625625 0.9953125 1.31075 1.84975 1.31075 0.3583125 0 0.692125 -0.0949375 0.98 -0.263375v0.263375c0 2.70725 -2.19275 4.9 -4.9 4.9h-1.8895625c-1.2985 0 -2.5449375 -0.5175625 -3.4636875 -1.4363125l-0.35525 -0.35525c-0.7380625 -0.735 -1.1515 -1.733375 -1.1515 -2.7715625V10.45c0 -1.0014375 0.753375 -1.8283125 1.7241875 -1.9446875Z"
const HAND_SPOCK_PATH = "M6.743416666666667 0.886136111111111c-0.1408722222222222 -0.5236777777777777 -0.6767972222222222 -0.8329833333333333 -1.200475 -0.6921111111111111S4.709961111111111 0.8708222222222222 4.850833333333333 1.3944999999999999l1.6200277777777776 6.048305555555555c0.07656111111111111 0.2817444444444444 -0.1378111111111111 0.5573638888888889 -0.42874166666666663 0.5573638888888889 -0.19599444444444442 0 -0.3674916666666666 -0.12862222222222222 -0.42567777777777777 -0.3154305555555555l-1.3321583333333333 -4.379280555555555c-0.1561861111111111 -0.51755 -0.7043611111111111 -0.8084833333333332 -1.221911111111111 -0.6522972222222222S2.2538888888888886 3.3575194444444443 2.4100722222222224 3.8750722222222223l1.9232083333333332 6.320863888888888c0.0735 0.24193055555555554 -0.22049444444444444 0.42261388888888884 -0.4042416666666666 0.24805555555555553L2.2324527777777776 8.827027777777777c-0.4899888888888889 -0.46549166666666664 -1.264786111111111 -0.4471166666666666 -1.7333388888888888 0.04287222222222222s-0.44711388888888887 1.264786111111111 0.042875 1.7333388888888888l3.4421749999999998 3.2768027777777777c1.3199083333333332 1.258661111111111 3.074683333333333 1.959958333333333 4.899894444444444 1.959958333333333h0.584925c0.0030638888888888886 0 0.0030638888888888886 -0.0030611111111111112 0.0030638888888888886 -0.0030611111111111112l0.0030611111111111112 -0.0030638888888888886c1.7853999999999999 -0.1071861111111111 3.3258027777777777 -1.3229722222222222 3.8372305555555553 -3.0532472222222222l2.4866944444444443 -8.421691666666666c0.15312222222222222 -0.5175527777777778 -0.14393333333333333 -1.0626638888888889 -0.6614833333333333 -1.21885s-1.0626666666666666 0.1439361111111111 -1.21885 0.6614861111111111l-1.154536111111111 3.9260416666666664c-0.048999999999999995 0.1623083333333333 -0.1959972222222222 0.27255555555555555 -0.3674944444444444 0.27255555555555555 -0.24193055555555554 0 -0.42261388888888884 -0.2235583333333333 -0.37361666666666665 -0.46242777777777777L13.125530555555555 2.3224166666666664c0.11330833333333334 -0.5298 -0.22661944444444446 -1.050413888888889 -0.7564222222222222 -1.160661111111111s-1.050413888888889 0.22661944444444446 -1.160661111111111 0.7564194444444444L10.056972222222221 7.3601222222222225c-0.07962499999999999 0.37361666666666665 -0.40730555555555553 0.6400472222222221 -0.7901083333333333 0.6400472222222221 -0.36443055555555554 0 -0.6859861111111111 -0.24499444444444446 -0.7778583333333333 -0.597175L6.743416666666667 0.886136111111111Z"
const HAND_PATH = "M9.470775 1.14c0 -0.5420625 -0.4379375 -0.98 -0.98 -0.98s-0.98 0.4379375 -0.98 0.98v6.37c0 0.2695 -0.2205 0.49 -0.49 0.49s-0.49 -0.2205 -0.49 -0.49V2.12c0 -0.5420625 -0.4379375 -0.98 -0.98 -0.98s-0.98 0.4379375 -0.98 0.98V10.45c0 0.0459375 0 0.0949375 0.0030625 0.140875l-1.8528125 -1.764c-0.49 -0.4655 -1.2648125 -0.447125 -1.733375 0.042875s-0.447125 1.2648125 0.042875 1.733375l3.44225 3.276875c1.3199375 1.2586875 3.07475 1.96 4.9 1.96h0.588c2.97675 0 5.39 -2.41325 5.39 -5.39V4.08c0 -0.5420625 -0.4379375 -0.98 -0.98 -0.98s-0.98 0.4379375 -0.98 0.98v3.43c0 0.2695 -0.2205 0.49 -0.49 0.49s-0.49 -0.2205 -0.49 -0.49V2.12c0 -0.5420625 -0.4379375 -0.98 -0.98 -0.98s-0.98 0.4379375 -0.98 0.98v5.39c0 0.2695 -0.2205 0.49 -0.49 0.49s-0.49 -0.2205 -0.49 -0.49V1.14Z"
const HAMSA_PATH = "M1.08,9h1.42c.28,0,.5-.23.5-.5V2.25c0-.69.56-1.25,1.25-1.25s1.25.56,1.25,1.25v4.12c0,.34.28.62.62.62s.62-.28.62-.62V1.25c0-.69.56-1.25,1.25-1.25s1.25.56,1.25,1.25v5.12c0,.34.28.62.62.62s.62-.28.62-.62V2.25c0-.69.56-1.25,1.25-1.25s1.25.56,1.25,1.25v6.25c0,.27.23.5.5.5h1.42c.6,0,1.08.48,1.08,1.08,0,.27-.1.53-.28.73l-2.7,2.97c-1.28,1.41-3.11,2.22-5.02,2.22s-3.73-.81-5.02-2.22L.28,10.81c-.18-.2-.28-.46-.28-.73,0-.6.48-1.08,1.08-1.08ZM8,10c.55,0,1,.45,1,1s-.45,1-1,1-1-.45-1-1,.45-1,1-1Z"

function RankIcon({ rank, size = 18 }) {
  if (rank === 1) return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="#F59E0B" strokeWidth="0">
      <path d={HAND_MIDDLE_PATH} />
    </svg>
  )
  if (rank === 2) return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="#9CA3AF" strokeWidth="0">
      <path d={HAND_PEACE_PATH} />
    </svg>
  )
  if (rank === 3) return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="#B87333" strokeWidth="0">
      <path d={HAMSA_PATH} />
    </svg>
  )
  if (rank === 4) return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="#6366F1" strokeWidth="0">
      <path d={HAND_SPOCK_PATH} />
    </svg>
  )
  if (rank === 5) return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="#4B5563" strokeWidth="0">
      <path d={HAND_PATH} />
    </svg>
  )
  return null
}

function medal(rank) { return rank <= 5 }

// ── Skeleton shimmer helper ───────────────────
const sk = (w, h, r = 6) => ({
  width: w, height: h, borderRadius: r, flexShrink: 0, display: 'block',
  background: 'linear-gradient(90deg,#141414 25%,#222 50%,#141414 75%)',
  backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite linear',
})

// ── Season badge pill ─────────────────────────
// Badge key format: S{seasonNum}-{rank}-{game}-{branch}  e.g. "S2-1-MTG-Panama"
// Legacy format (rank-1 only):   S{seasonNum}-{game}-{branch}   e.g. "S1-MTG-Panama"
const BADGE_MEDAL = {
  '1': { icon: '🥇', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
  '2': { icon: '🥈', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)' },
  '3': { icon: '🥉', color: '#B87333', bg: 'rgba(184,115,51,0.12)', border: 'rgba(184,115,51,0.3)' },
}

function parseBadge(b) {
  // Defensive: Supabase can return nulls, numbers, or unexpected shapes on older rows.
  // We don't want one malformed badge to crash the whole leaderboard render.
  if (typeof b !== 'string' || !b) return null
  // New format: S2-1-MTG-Panama → { sNum:'S2', rank:'1', game:'MTG', branch:'Panama' }
  const parts = b.split('-')
  if (parts.length >= 4 && /^\d+$/.test(parts[1])) {
    const sNum   = parts[0]
    const rank   = parts[1]
    const branch = parts[parts.length - 1]
    const game   = parts.slice(2, -1).join('-')
    return { sNum, rank, game, branch }
  }
  // Legacy format: S1-MTG-Panama
  if (parts.length >= 3) {
    const sNum   = parts[0]
    const branch = parts[parts.length - 1]
    const game   = parts.slice(1, -1).join('-')
    return { sNum, rank: '1', game, branch }
  }
  return null
}

function SeasonBadgePill({ badges, game, branch }) {
  if (!badges?.length || !game) return null

  const matching = badges
    .map(parseBadge)
    .filter(p => p && p.game === game && (!branch || p.branch === branch))
    .sort((a, b) => parseInt(a.rank) - parseInt(b.rank)) // best rank first

  if (!matching.length) return null

  return (
    <>
      {matching.slice(0, 2).map((p, i) => {
        const m = BADGE_MEDAL[p.rank] ?? BADGE_MEDAL['1']
        return (
          <span key={i} title={`${p.sNum} · Puesto #${p.rank} · ${p.game} ${p.branch}`} style={{
            fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 5,
            background: m.bg, border: `1px solid ${m.border}`,
            color: m.color, letterSpacing: '0.04em', flexShrink: 0,
          }}>{m.icon}{p.sNum}</span>
        )
      })}
    </>
  )
}

// ── Tiny count-up hook ────────────────────────
// Animates a number from 0 → target over `duration` ms using rAF.
// Used in the Rankings overview so big point totals "feel earned."
function useCountUp(target, duration = 1200, startWhen = true) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!startWhen) return
    let raf
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      // ease-out cubic — fast start, slow finish (feels like settling)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, startWhen])
  return value
}

// ── Rankings Overview (chart-style dashboard) ──────────────────────────────
// Shown when the user is on Global × [TCG] — instead of the flat list, gives
// them a "where do I stand?" view: top-3 podium + per-branch totals as
// animated bars. Tap a branch → drills into its filtered ranking list.
function RankingsOverview({ entries, game, onSelectBranch }) {
  // Aggregate by branch: total points + player count + best (lowest) rank
  const byBranch = (() => {
    const map = {}
    for (const b of BRANCHES) map[b] = { branch: b, totalPts: 0, players: 0, topRank: null }
    entries.forEach((e, i) => {
      if (!e.branch || !map[e.branch]) return
      map[e.branch].totalPts += e.points || 0
      map[e.branch].players  += 1
      const rank = i + 1
      if (map[e.branch].topRank === null || rank < map[e.branch].topRank) {
        map[e.branch].topRank = rank
      }
    })
    return Object.values(map).sort((a, b) => b.totalPts - a.totalPts)
  })()

  const top3 = entries.slice(0, 3)
  const maxPts = Math.max(1, ...byBranch.map(b => b.totalPts))
  const gs = GAME_STYLES[game] ?? GAME_STYLES['MTG']

  // Stagger entry: kick everything off ~50 ms after mount so the bars and
  // numbers start from 0 even on prefetched data.
  const [animateIn, setAnimateIn] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnimateIn(true), 50)
    return () => clearTimeout(t)
  }, [game])

  return (
    <div style={{ padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Game header with badge ────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 2px 2px',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: RADIUS.sm,
          background: gs.bg, border: `1px solid ${gs.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 14px ${gs.border}, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}>
          <GameIcon game={game} size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 9.5, fontWeight: WEIGHT.bold,
            color: COLOR.textTertiary, letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            Temporada activa
          </div>
          <div style={{
            fontSize: 17, fontWeight: WEIGHT.bold, color: COLOR.text,
            letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2,
          }}>
            Ranking {game} · Global
          </div>
        </div>
      </div>

      {/* ── Top 3 podium ─────────────────────────────────────────────── */}
      {top3.length > 0 && (
        <div style={{
          background: COLOR.surface,
          border: `1px solid ${COLOR.border}`,
          borderRadius: RADIUS.lg,
          padding: '14px 14px 16px',
          boxShadow: `${ELEVATION.md}, ${ELEVATION.innerLit}`,
        }}>
          <div style={{
            fontSize: 10, fontWeight: WEIGHT.bold, color: COLOR.textTertiary,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            🏆 Top 3 global
          </div>

          {/* Podium layout — 2nd | 1st | 3rd, columns of different height for that "podium" feel */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
            gap: 8, minHeight: 150,
          }}>
            {[1, 0, 2].map((podiumIdx, layoutIdx) => {  // 2nd, 1st, 3rd visual order
              const e = top3[podiumIdx]
              if (!e) return <div key={podiumIdx} style={{ flex: 1 }} />
              const rank = podiumIdx + 1
              const heights = { 0: 130, 1: 100, 2: 85 }  // 1st tallest
              const medals = { 0: '🥇', 1: '🥈', 2: '🥉' }
              const colors = {
                0: { glow: '#F59E0B', text: '#FCD34D', border: 'rgba(245,158,11,0.5)' },
                1: { glow: '#9CA3AF', text: '#E5E7EB', border: 'rgba(156,163,175,0.45)' },
                2: { glow: '#B87333', text: '#D97706', border: 'rgba(184,115,51,0.45)' },
              }
              const c = colors[podiumIdx]
              const bs = BRANCH_STYLES[e.branch] ?? {}
              const delay = layoutIdx === 1 ? 0 : layoutIdx === 0 ? 220 : 340
              return (
                <div key={e.id} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  opacity: animateIn ? 1 : 0,
                  transform: animateIn ? 'translateY(0)' : 'translateY(12px)',
                  transition: `opacity 500ms ease ${delay}ms, transform 600ms cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
                }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{medals[podiumIdx]}</div>
                  <div style={{
                    width: 50, height: 50, borderRadius: '50%',
                    background: COLOR.surfaceRaised,
                    border: `2px solid ${c.border}`,
                    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 16px ${c.glow}55, inset 0 1px 0 rgba(255,255,255,0.06)`,
                    marginBottom: 6,
                  }}>
                    <Avatar url={e.avatar_url} size={50} role={e.role} isOwner={e.is_owner} />
                  </div>
                  <div style={{
                    fontSize: 11.5, fontWeight: WEIGHT.semibold, color: COLOR.text,
                    maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    letterSpacing: '-0.005em', textAlign: 'center',
                  }}>
                    {e.username}
                  </div>
                  {e.branch && (
                    <div style={{
                      fontSize: 9.5, color: bs.color ?? COLOR.textTertiary,
                      fontWeight: WEIGHT.bold, letterSpacing: '0.04em',
                      marginTop: 1,
                    }}>
                      {e.branch}
                    </div>
                  )}
                  {/* Podium block underneath — width 100%, height varies by rank */}
                  <div style={{
                    width: '88%',
                    height: animateIn ? heights[podiumIdx] * 0.55 : 0,
                    marginTop: 8,
                    borderRadius: `${RADIUS.sm}px ${RADIUS.sm}px 0 0`,
                    background: `linear-gradient(180deg, ${c.glow}26 0%, ${c.glow}0d 100%)`,
                    border: `1px solid ${c.border}`,
                    borderBottom: 'none',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                    paddingTop: 6,
                    transition: `height 700ms cubic-bezier(0.34,1.56,0.64,1) ${delay + 100}ms`,
                    overflow: 'hidden',
                  }}>
                    <span style={{
                      fontSize: 14, fontWeight: WEIGHT.bold, color: c.text,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.01em',
                    }}>
                      <CountUpNum value={e.points} startWhen={animateIn} delay={delay + 200} />pts
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Branches breakdown ───────────────────────────────────────── */}
      <div style={{
        background: COLOR.surface,
        border: `1px solid ${COLOR.border}`,
        borderRadius: RADIUS.lg,
        padding: '14px 14px 8px',
        boxShadow: `${ELEVATION.md}, ${ELEVATION.innerLit}`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <div style={{
            fontSize: 10, fontWeight: WEIGHT.bold, color: COLOR.textTertiary,
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            Sucursales
          </div>
          <div style={{
            fontSize: 10, color: COLOR.textQuaternary, fontWeight: WEIGHT.medium,
            letterSpacing: '0.02em',
          }}>
            Tap para ver ranking →
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {byBranch.map((b, i) => {
            const bs = BRANCH_STYLES[b.branch] ?? {}
            const pct = (b.totalPts / maxPts) * 100
            const hasTop3 = b.topRank !== null && b.topRank <= 3
            const delay = i * 110

            return (
              <button
                key={b.branch}
                onClick={() => onSelectBranch?.(b.branch)}
                className="pressable"
                style={{
                  display: 'flex', flexDirection: 'column', gap: 7,
                  padding: '10px 12px',
                  background: hasTop3
                    ? `linear-gradient(135deg, ${bs.bg} 0%, transparent 70%)`
                    : COLOR.background,
                  border: `1px solid ${hasTop3 ? bs.border : COLOR.border}`,
                  borderRadius: RADIUS.md,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: FONT_STACK,
                  transition: MOTION.springTransition,
                  opacity: animateIn ? 1 : 0,
                  transform: animateIn ? 'translateX(0)' : 'translateX(-8px)',
                  boxShadow: hasTop3 ? `0 0 12px ${bs.border}` : 'none',
                }}
              >
                {/* Top row — branch name + dot + crown if top-3 + total pts */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: bs.dot ?? COLOR.textTertiary,
                    flexShrink: 0,
                    boxShadow: `0 0 8px ${bs.dot}`,
                  }} />
                  <span style={{
                    fontSize: 14, fontWeight: WEIGHT.bold,
                    color: bs.color ?? COLOR.text,
                    letterSpacing: '-0.01em',
                    flex: 1,
                  }}>
                    {b.branch}
                  </span>
                  {hasTop3 && (
                    <span style={{
                      fontSize: 9.5, fontWeight: WEIGHT.bold,
                      padding: '2px 7px', borderRadius: RADIUS.full,
                      background: 'rgba(245,158,11,0.18)',
                      border: '1px solid rgba(245,158,11,0.45)',
                      color: COLOR.gold,
                      letterSpacing: '0.04em',
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}>
                      👑 TOP {b.topRank}
                    </span>
                  )}
                  <span style={{
                    fontSize: 15, fontWeight: WEIGHT.bold,
                    color: COLOR.text,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.01em',
                    minWidth: 50, textAlign: 'right',
                  }}>
                    <CountUpNum value={b.totalPts} startWhen={animateIn} delay={delay + 150} duration={1100} />
                    <span style={{ fontSize: 10.5, color: COLOR.textTertiary, fontWeight: WEIGHT.medium, marginLeft: 2 }}>pts</span>
                  </span>
                </div>

                {/* Bar */}
                <div style={{
                  width: '100%', height: 8, borderRadius: 4,
                  background: COLOR.surfaceRaised,
                  overflow: 'hidden', position: 'relative',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                }}>
                  <div style={{
                    height: '100%',
                    width: animateIn ? `${pct}%` : '0%',
                    background: hasTop3
                      ? `linear-gradient(90deg, ${bs.dot} 0%, ${bs.color} 100%)`
                      : `linear-gradient(90deg, ${bs.dot}aa 0%, ${bs.dot} 100%)`,
                    borderRadius: 4,
                    boxShadow: `0 0 8px ${bs.dot}88`,
                    transition: `width 1100ms cubic-bezier(0.34,1.56,0.64,1) ${delay + 80}ms`,
                  }} />
                </div>

                {/* Subtle metadata */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: 10.5, color: COLOR.textTertiary, fontWeight: WEIGHT.medium,
                  letterSpacing: '0.005em',
                }}>
                  <span>{b.players} {b.players === 1 ? 'jugador' : 'jugadores'}</span>
                  {b.topRank !== null && (
                    <span style={{ color: hasTop3 ? COLOR.gold : COLOR.textTertiary }}>
                      Mejor: #{b.topRank}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Footer hint — explicit affordance to drill in ────────────── */}
      <div style={{
        textAlign: 'center', padding: '4px 0 0',
        fontSize: 11.5, color: COLOR.textQuaternary,
        fontWeight: WEIGHT.medium, letterSpacing: '-0.005em',
      }}>
        Tap una sucursal para ver el ranking completo
      </div>
    </div>
  )
}

// Wrapper that uses the count-up hook — needed because hooks can't run
// conditionally inside the map callback above.
function CountUpNum({ value, startWhen, delay = 0, duration = 1200 }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!startWhen) { setReady(false); return }
    const t = setTimeout(() => setReady(true), delay)
    return () => clearTimeout(t)
  }, [startWhen, delay])
  const n = useCountUp(value, duration, ready)
  return <>{n}</>
}

// ── Leaderboard ──────────────────────────────
function LeaderboardTab({ branch, game, isAdmin, activeSeason, onSelectBranch }) {
  const toast = useToast()
  const [showRules, setShowRules] = useState(false)
  const [entries,   setEntries]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  // Editing state — admin only, available in all tabs
  const [editingId, setEditingId] = useState(null)
  const [ptsVal,    setPtsVal]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [editErr,   setEditErr]   = useState('')
  // Staff: award points panel
  const [showAward,      setShowAward]      = useState(false)
  const [awardQuery,     setAwardQuery]     = useState('')
  const [awardResults,   setAwardResults]   = useState([])
  const [awardLoading,   setAwardLoading]   = useState(false)
  const [awardUser,      setAwardUser]      = useState(null)   // selected user
  const [awardPosition,  setAwardPosition]  = useState(1)
  const [awardTournament,setAwardTournament]= useState('')
  const [awardSaving,    setAwardSaving]    = useState(false)
  const [awardErr,       setAwardErr]       = useState('')

  useEffect(() => {
    // A TCG must always be selected — Global means all branches, not all games
    if (!game) { setEntries([]); setLoading(false); setError(''); return }
    setEditingId(null)
    setLoading(true)
    setError('')
    getLeaderboard({ branch: branch || null, game })
      .then(setEntries)
      .catch(e => { if (e?.name !== 'AbortError') setError(e.message || 'Error de conexión.') })
      .finally(() => setLoading(false))
  }, [branch, game])

  const openEdit = (entry) => {
    setEditingId(entry.id)
    setPtsVal(String(entry.points ?? 0))
    setEditErr('')
  }

  const savePts = async (userId) => {
    const n = Math.max(0, Math.round(Number(ptsVal) || 0))
    setSaving(true)
    setEditErr('')
    try {
      if (game) {
        // Game-specific view: use override table so edits survive refresh
        if (n === 0) {
          await rejectUserGameClaims(userId, game)
          setEntries(prev => prev.filter(e => e.id !== userId))
        } else {
          const saved = await staffSetGamePoints(userId, game, branch, n)
          setEntries(prev => prev.map(e => e.id === userId ? { ...e, points: saved } : e))
        }
      } else {
        // Overall ranking: update profiles.points directly
        const saved = await setUserPoints(userId, n)
        setEntries(prev => prev.map(e => e.id === userId ? { ...e, points: saved } : e))
      }
      setEditingId(null)
    } catch (e) {
      setEditErr(e.message || 'Error al guardar puntos')
    }
    setSaving(false)
  }

  const canEdit = isAdmin

  // Staff award panel: search users
  useEffect(() => {
    if (!showAward || !isAdmin) return
    const t = setTimeout(async () => {
      setAwardLoading(true)
      try { setAwardResults(await searchUsers(awardQuery)) }
      catch { setAwardResults([]) }
      setAwardLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [awardQuery, showAward, isAdmin])

  const handleAwardPoints = async () => {
    if (!awardUser || !game) return
    setAwardSaving(true); setAwardErr('')
    try {
      const { ptsAdded } = await staffAwardRankingPoints(awardUser.id, {
        game,
        branch: branch ?? null,
        position: awardPosition,
        tournamentName: awardTournament.trim() || 'Asignado por staff',
      })
      toast?.(`+${ptsAdded}pts agregado a @${awardUser.username}`, { type: 'success' })
      // Refresh leaderboard
      const fresh = await getLeaderboard({ branch: branch || null, game })
      setEntries(fresh)
      // Reset panel
      setAwardUser(null); setAwardQuery(''); setAwardResults([]); setAwardTournament(''); setAwardPosition(1)
      setShowAward(false)
    } catch (e) {
      setAwardErr(e.message || 'Error al asignar puntos')
    }
    setAwardSaving(false)
  }

  // No TCG selected yet — show season info + rules
  if (!game) return (
    <div style={{ padding: '12px 14px 32px', display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeUp 0.25s ease' }}>

      {/* ── Season announcement — adapts to current season ── */}
      {(() => {
        const endStr    = safeDate(activeSeason?.end_date,   '2026-08-31')
        const startStr  = safeDate(activeSeason?.start_date, '2026-05-01')
        const endDate   = new Date(endStr   + 'T23:59:59')
        const startDate = new Date(startStr + 'T00:00:00')
        const now       = new Date()
        const daysLeft  = Math.max(0, Math.ceil((endDate - now) / 86_400_000))
        // isTest: still within S1 (today hasn't passed the end date)
        const fmt = (d, opts) => (!d || isNaN(d)) ? '?' : d.toLocaleDateString('es', opts)
        const endFmt = fmt(endDate, { day: 'numeric', month: 'long', year: 'numeric' })

        return (
          <div style={{
            borderRadius: 14, overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(251,191,36,0.06) 100%)',
            border: '1px solid rgba(245,158,11,0.25)',
          }}>
            <div style={{
              padding: '10px 14px 8px',
              borderBottom: '1px solid rgba(245,158,11,0.15)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="#F59E0B" strokeWidth="0">
                  <path d={HAND_MIDDLE_PATH} />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#F59E0B', letterSpacing: '-0.01em' }}>
                  {activeSeason?.name ?? 'Temporada 2'} — Oficial
                </div>
                <div style={{ fontSize: 10, color: '#78716C', marginTop: 1 }}>
                  {fmt(startDate, { day: 'numeric', month: 'long' })} – {endFmt} · {daysLeft}d restantes
                </div>
              </div>
              <div style={{
                fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)',
                color: '#4ADE80', letterSpacing: '0.05em', flexShrink: 0,
              }}>ACTIVA</div>
            </div>
            <div style={{ padding: '10px 14px 12px' }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: '#D1D5DB', lineHeight: 1.55 }}>
                La <strong style={{ color: '#F59E0B' }}>{activeSeason?.name ?? 'Temporada 2'} es oficial</strong> — los puntos que acumules <strong style={{ color: '#FFFFFF' }}>cuentan para el ranking final</strong> y el Season Championship.
              </p>
              <p style={{ margin: 0, fontSize: 11, color: '#6B7280', lineHeight: 1.5 }}>
                Top 2 por ciudad clasifica al Season Championship.
              </p>
            </div>
          </div>
        )
      })()}

      {/* ── Rules card (collapsible) ── */}
      <div style={{
        borderRadius: 14,
        background: '#111111',
        border: '1px solid #1E1E1E',
        overflow: 'hidden',
      }}>
        {/* Toggle header */}
        <button
          onClick={() => setShowRules(r => !r)}
          style={{
            width: '100%', padding: '12px 14px',
            background: 'none', border: 'none',
            borderBottom: showRules ? '1px solid #1A1A1A' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 800, color: '#6B7280', letterSpacing: '0.08em' }}>
            CÓMO FUNCIONAN LOS PUNTOS
          </span>
          <svg
            width="13" height="13" viewBox="0 0 16 16" fill="#4B5563" strokeWidth="0"
            style={{ transform: showRules ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
          >
            <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
          </svg>
        </button>
        {/* Collapsed hint */}
        {!showRules && (
          <div style={{ padding: '0 14px 10px', fontSize: 11, color: '#374151', lineHeight: 1.4 }}>
            Inscripción previa · 72h para reclamar · mín. +6/+8 jugadores · 1°=3pts 2°=2pts 3°=1pt
          </div>
        )}

        {showRules && [{
            icon: (
              // Clipboard / registration icon
              <svg width="15" height="15" viewBox="0 0 16 16" fill="#A78BFA" strokeWidth="0">
                <path d="M10.5 0a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-5A.5.5 0 0 1 5 1.5v-1A.5.5 0 0 1 5.5 0h5zm-5 1h5V.5a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.5V1zM3 2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H3zm1.5 4.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5z"/>
              </svg>
            ),
            color: '#A78BFA',
            title: 'Inscríbete en el torneo',
            body: 'Debes estar registrado dentro del app en el torneo antes de jugarlo. Sin inscripción previa no podrás hacer el claim de tus puntos.',
          },
          {
            icon: (
              // Clock icon
              <svg width="15" height="15" viewBox="0 0 16 16" fill="#FCD34D" strokeWidth="0">
                <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
              </svg>
            ),
            color: '#FCD34D',
            title: '72 horas para reclamar',
            body: 'Los torneos se eliminan automáticamente 3 días después de realizados. Reporta tu resultado antes de que desaparezca.',
          },
          {
            icon: (
              // People / group icon
              <svg width="15" height="15" viewBox="0 0 16 16" fill="#4ADE80" strokeWidth="0">
                <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
                <path fillRule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"/>
                <path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
              </svg>
            ),
            color: '#4ADE80',
            title: 'Mínimo de jugadores',
            body: null,
            custom: (
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {[
                  { branch: 'Panama', min: 8, color: '#38BDF8' },
                  { branch: 'David',  min: 6, color: '#FB923C' },
                  { branch: 'Chitre', min: 6, color: '#A78BFA' },
                ].map(({ branch: b, min, color }) => (
                  <div key={b} style={{
                    flex: 1, padding: '7px 6px', borderRadius: 10, textAlign: 'center',
                    background: `${color}0D`, border: `1px solid ${color}30`,
                  }}>
                    <div style={{ fontSize: 17, fontWeight: 900, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>+{min}</div>
                    <div style={{ fontSize: 9, color: '#6B7280', marginTop: 3, fontWeight: 700, letterSpacing: '0.06em' }}>{b.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            icon: (
              // Trophy / rank icon — uses our app's rank-1 hand SVG
              <svg width="15" height="15" viewBox="0 0 16 16" fill="#F59E0B" strokeWidth="0">
                <path d={HAND_MIDDLE_PATH} />
              </svg>
            ),
            color: '#F59E0B',
            title: 'Sistema de puntos',
            body: null,
            custom: (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {[
                  { rank: 1, pts: 3, path: HAND_MIDDLE_PATH, color: '#F59E0B' },
                  { rank: 2, pts: 2, path: HAND_PEACE_PATH,  color: '#9CA3AF' },
                  { rank: 3, pts: 1, path: HAMSA_PATH,        color: '#B87333' },
                ].map(({ rank, pts, path, color }) => (
                  <div key={rank} style={{
                    flex: 1, padding: '7px 6px', borderRadius: 10, textAlign: 'center',
                    background: `${color}0D`, border: `1px solid ${color}30`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill={color} strokeWidth="0">
                      <path d={path} />
                    </svg>
                    <div style={{ fontSize: 13, fontWeight: 800, color, lineHeight: 1 }}>{pts}pts</div>
                    <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, letterSpacing: '0.06em' }}>#{rank} LUGAR</div>
                  </div>
                ))}
              </div>
            ),
          },
        ].map((rule, i, arr) => (
          <div key={i} style={{
            padding: '11px 14px',
            borderBottom: i < arr.length - 1 ? '1px solid #161616' : 'none',
            display: 'flex', gap: 11, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
              background: `${rule.color}12`, border: `1px solid ${rule.color}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{rule.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#E5E5E5', marginBottom: 3 }}>{rule.title}</div>
              {rule.body && (
                <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.55 }}>{rule.body}</div>
              )}
              {rule.custom}
            </div>
          </div>
        ))}
      </div>

      {/* ── Pick a game prompt ── */}
      <div style={{ textAlign: 'center', paddingTop: 4 }}>
        <div style={{ fontSize: 12, color: '#374151' }}>
          Elige un TCG arriba para ver el ranking{branch ? ` de ${branch}` : ' global'} ↑
        </div>
      </div>
    </div>
  )

  if (loading) return (
    <div style={{ padding: '8px 0' }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #111' }}>
          <span style={sk(28, 14, 4)} />
          <span style={sk(34, 34, 17)} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={sk('55%', 12, 5)} />
            <span style={sk('35%', 10, 5)} />
          </div>
          <span style={sk(48, 22, 6)} />
        </div>
      ))}
    </div>
  )

  if (error) return (
    <div style={{ margin: '16px 20px', padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13 }}>{error}</div>
  )

  const PTS_MAP = { 1: 3, 2: 2, 3: 1 }

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Staff: award points panel */}
      {isAdmin && game && (
        <div style={{ margin: '0 16px 10px', borderRadius: 10, overflow: 'hidden', border: '1px solid #1F1F1F' }}>
          <button
            onClick={() => { setShowAward(o => !o); setAwardErr('') }}
            style={{
              width: '100%', padding: '9px 14px',
              background: showAward ? 'rgba(167,139,250,0.08)' : '#111111',
              border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: showAward ? '1px solid #1F1F1F' : 'none',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="#A78BFA" strokeWidth="0">
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
            </svg>
            <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#A78BFA', textAlign: 'left', letterSpacing: '0.04em' }}>
              ASIGNAR PUNTOS A JUGADOR
            </span>
            <span style={{ fontSize: 14, color: '#4B5563' }}>{showAward ? '▲' : '▼'}</span>
          </button>
          {showAward && (
            <div style={{ padding: '12px 14px 14px', background: '#0D0D0D', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Step 1: search user */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.07em', marginBottom: 6 }}>
                  1. BUSCAR JUGADOR
                </div>
                {awardUser ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'rgba(167,139,250,0.08)', borderRadius: 8, border: '1px solid rgba(167,139,250,0.25)' }}>
                    <Avatar url={awardUser.avatar_url} size={26} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#E5E5E5' }}>{awardUser.username}</span>
                    <button onClick={() => { setAwardUser(null); setAwardQuery('') }} style={{
                      background: 'none', border: 'none', color: '#4B5563', fontSize: 18, cursor: 'pointer', lineHeight: 1,
                    }}>×</button>
                  </div>
                ) : (
                  <>
                    <input
                      value={awardQuery}
                      onChange={e => setAwardQuery(e.target.value)}
                      placeholder="@usuario..."
                      style={{
                        width: '100%', padding: '8px 11px',
                        background: '#111', border: '1px solid #222', borderRadius: 8,
                        color: '#FFF', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none',
                      }}
                    />
                    {awardLoading && <div style={{ fontSize: 11, color: '#4B5563', marginTop: 4 }}>Buscando...</div>}
                    {!awardLoading && awardResults.slice(0, 5).map(u => (
                      <div key={u.id} onClick={() => { setAwardUser(u); setAwardResults([]) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                          cursor: 'pointer', borderBottom: '1px solid #161616',
                          borderRadius: 6, marginTop: 2,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Avatar url={u.avatar_url} size={24} />
                        <span style={{ fontSize: 12, color: '#E5E5E5' }}>{u.username}</span>
                        {u.branch && <span style={{ fontSize: 10, color: '#4B5563', marginLeft: 'auto' }}>{u.branch}</span>}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Step 2: position */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.07em', marginBottom: 6 }}>
                  2. POSICIÓN
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3].map(pos => {
                    const pts = PTS_MAP[pos]
                    const active = awardPosition === pos
                    const colors = { 1: '#F59E0B', 2: '#9CA3AF', 3: '#B87333' }
                    const c = colors[pos]
                    return (
                      <button key={pos} onClick={() => setAwardPosition(pos)} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${active ? `${c}55` : '#2A2A2A'}`,
                        background: active ? `${c}12` : 'transparent',
                        fontFamily: 'Inter, sans-serif',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      }}>
                        <RankIcon rank={pos} size={16} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: active ? c : '#4B5563' }}>{pts}pts</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Step 3: tournament name (optional) */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.07em', marginBottom: 6 }}>
                  3. TORNEO (opcional)
                </div>
                <input
                  value={awardTournament}
                  onChange={e => setAwardTournament(e.target.value)}
                  placeholder="Nombre del torneo..."
                  style={{
                    width: '100%', padding: '8px 11px',
                    background: '#111', border: '1px solid #222', borderRadius: 8,
                    color: '#FFF', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none',
                  }}
                />
              </div>

              {awardErr && (
                <div style={{ fontSize: 11, color: '#F87171', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>{awardErr}</div>
              )}

              <button
                onClick={handleAwardPoints}
                disabled={!awardUser || awardSaving}
                style={{
                  width: '100%', padding: '10px', borderRadius: 9, border: 'none',
                  background: (!awardUser || awardSaving) ? '#1A1A1A' : '#A78BFA',
                  color: (!awardUser || awardSaving) ? '#4B5563' : '#111',
                  fontSize: 13, fontWeight: 700, cursor: (!awardUser || awardSaving) ? 'default' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {awardSaving ? 'Guardando...' : `Asignar +${PTS_MAP[awardPosition]}pts${awardUser ? ` a @${awardUser.username}` : ''}`}
              </button>
            </div>
          )}
        </div>
      )}

      {!entries.length ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)',
          }}>
            <svg width="26" height="26" viewBox="0 0 16 16" fill="#F59E0B" strokeWidth="0">
              <path d={HAND_MIDDLE_PATH} />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#4B5563' }}>No hay rankings aún</div>
          <div style={{ fontSize: 12, color: '#374151' }}>Reporta tus resultados de torneo para aparecer aquí</div>
        </div>
      ) : !branch ? (
        // Global view (no specific branch) — show animated overview chart
        // instead of the flat list. Lets the user pick a branch to drill in.
        <RankingsOverview entries={entries} game={game} onSelectBranch={onSelectBranch} />
      ) : entries.map((entry, i) => {
        const rank = i + 1
        const m    = medal(rank)
        const isTop3 = rank <= 3
        return (
          <div key={entry.id} style={{
            padding: '13px 20px',
            background: isTop3
              ? 'linear-gradient(90deg, rgba(245,158,11,0.04) 0%, transparent 60%)'
              : 'transparent',
            borderBottom: `1px solid ${COLOR.border}`,
            animation: 'fadeUp 0.3s ease both',
            animationDelay: `${i * 0.03}s`,
            transition: MOTION.quickTransition,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 30, textAlign: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {m
                  ? <RankIcon rank={rank} size={19} />
                  : <span style={{
                      fontSize: 13, fontWeight: WEIGHT.bold,
                      color: COLOR.textQuaternary,
                      fontVariantNumeric: 'tabular-nums',
                    }}>#{rank}</span>
                }
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: COLOR.surfaceRaised,
                border: `1px solid ${isTop3 ? 'rgba(245,158,11,0.35)' : COLOR.borderStrong}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0, overflow: 'hidden',
                boxShadow: isTop3 ? '0 0 12px rgba(245,158,11,0.18)' : 'none',
              }}><Avatar url={entry.avatar_url} size={36} role={entry.role} isOwner={entry.is_owner} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: WEIGHT.semibold, color: COLOR.text,
                  display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                  letterSpacing: '-0.01em',
                }}>
                  {entry.username}
                  {entry.verified && <span style={{ fontSize: 10, color: COLOR.blue }}>✓</span>}
                  {PAID_ROLES.has(entry.role) && <PremiumBadge size={12} role={entry.role} />}
                  <RoleBadge isOwner={entry.is_owner} role={entry.role} size={12} />
                  <SeasonBadgePill badges={entry.season_badges} game={game} branch={branch} />
                </div>
                {entry.branch && (
                  <div style={{
                    fontSize: 11, color: BRANCH_STYLES[entry.branch]?.color ?? COLOR.textTertiary,
                    display: 'flex', alignItems: 'center', gap: 4, marginTop: 2,
                    fontWeight: WEIGHT.medium, letterSpacing: '0.005em',
                  }}>
                    <MapPinIcon size={10} color={BRANCH_STYLES[entry.branch]?.color ?? COLOR.textTertiary} />
                    {entry.branch}
                  </div>
                )}
              </div>
              <div
                onClick={() => canEdit && !editingId ? openEdit(entry) : null}
                className={canEdit ? 'pressable' : ''}
                style={{
                  padding: '6px 14px', borderRadius: RADIUS.md,
                  background: editingId === entry.id ? 'rgba(167,139,250,0.26)' : 'rgba(167,139,250,0.12)',
                  border: `1px solid ${editingId === entry.id ? 'rgba(167,139,250,0.55)' : 'rgba(167,139,250,0.28)'}`,
                  color: COLOR.purple, fontSize: 13, fontWeight: WEIGHT.bold,
                  cursor: canEdit ? 'pointer' : 'default',
                  transition: MOTION.springTransition,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.005em',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                }}>{entry.points}pts</div>
            </div>

            {/* Inline editor — admin + overall only */}
            {editingId === entry.id && (
              <div style={{ marginTop: 10, paddingLeft: 40, animation: 'fadeUp 0.15s ease' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="number" min="0" value={ptsVal}
                    onChange={e => setPtsVal(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') savePts(entry.id); if (e.key === 'Escape') setEditingId(null) }}
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: 8,
                      background: '#111', border: '1px solid #2A2A2A',
                      color: '#FFF', fontSize: 13, outline: 'none',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  />
                  <button onClick={() => savePts(entry.id)} disabled={saving} style={{
                    padding: '7px 14px', borderRadius: 8, border: 'none',
                    background: 'rgba(74,222,128,0.15)', color: '#4ADE80',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>✓</button>
                  <button onClick={() => setEditingId(null)} disabled={saving} style={{
                    padding: '7px 14px', borderRadius: 8, border: 'none',
                    background: 'rgba(239,68,68,0.1)', color: '#F87171',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>✕</button>
                </div>
                {editErr && (
                  <div style={{ fontSize: 11, color: '#F87171', marginTop: 4 }}>{editErr}</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Participant row with pay toggle (admin only) ──
function ParticipantRow({ p, prof, idx, total, playerMedal, tournamentId, tournamentName, tournamentGame, isAdmin, onViewProfile }) {
  const [paid,    setPaid]    = useState(!!p.paid)
  const [toggling,setToggling]= useState(false)

  const handlePayToggle = async (e) => {
    e.stopPropagation()
    if (toggling) return
    setToggling(true)
    const next = !paid
    try {
      await setTournamentPayment(tournamentId, tournamentName, p.user_id, next)
      setPaid(next)
    } catch {}
    setToggling(false)
  }

  return (
    <div
      onClick={() => onViewProfile?.(p.user_id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '8px 4px',
        borderBottom: idx < total - 1 ? `1px solid ${COLOR.border}` : 'none',
        cursor: onViewProfile ? 'pointer' : 'default',
        borderRadius: RADIUS.sm,
        transition: MOTION.quickTransition,
      }}
      onMouseEnter={e => { if (onViewProfile) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: COLOR.surfaceRaised, border: `1px solid ${COLOR.borderStrong}`,
        overflow: 'hidden', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
      }}>
        <Avatar url={prof.avatar_url} size={30} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 12.5, fontWeight: WEIGHT.semibold, color: '#D1D5DB',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '-0.005em',
        }}>
          {prof.username}
        </span>
        {/* Per-platform game ID (e.g. their Bandai TCG+ name for an OPTCG
            tournament). Only renders when they actually have it set, so the
            row stays single-line for the common case. */}
        {(() => {
          const gameId = getGameUsername(prof, tournamentGame)
          if (!gameId) return null
          return (
            <span style={{
              fontSize: 10.5, color: COLOR.textTertiary,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginTop: 1, fontWeight: WEIGHT.medium,
            }}>
              🎮 {gameId}
            </span>
          )
        })()}
      </div>
      {playerMedal && <span style={{ fontSize: 15 }}>{medal(playerMedal.position)}</span>}

      {/* Payment status */}
      {isAdmin ? (
        <button
          onClick={handlePayToggle}
          disabled={toggling}
          className="pressable"
          style={{
            flexShrink: 0,
            padding: '4px 10px', borderRadius: RADIUS.sm,
            fontSize: 10, fontWeight: WEIGHT.bold, letterSpacing: '0.02em',
            fontFamily: FONT_STACK, cursor: toggling ? 'default' : 'pointer',
            border: paid ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(251,191,36,0.25)',
            background: paid ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.10)',
            color: paid ? COLOR.green : COLOR.gold,
            transition: MOTION.springTransition,
          }}
        >
          {toggling ? '…' : paid ? '✓ Pagó' : 'Pendiente'}
        </button>
      ) : (
        paid && (
          <span style={{
            flexShrink: 0, fontSize: 10, fontWeight: WEIGHT.bold,
            color: COLOR.green, background: 'rgba(74,222,128,0.1)',
            borderRadius: RADIUS.sm, padding: '4px 9px',
            border: '1px solid rgba(74,222,128,0.22)',
            letterSpacing: '0.02em',
          }}>✓ Pagó</span>
        )
      )}

      {onViewProfile && (
        <span style={{ fontSize: 12, color: COLOR.textQuaternary, marginLeft: 2 }}>›</span>
      )}
    </div>
  )
}

// ── Tournament Card (collapsible) ────────────
function TournamentCard({ t, index, onViewProfile, isAdmin, autoOpen }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [open,    setOpen]    = useState(!!autoOpen)
  const [joining, setJoining] = useState(false)
  const [joinErr, setJoinErr] = useState('')
  const [copied,  setCopied]  = useState(false)
  const [showExternalLink, setShowExternalLink] = useState(false)
  const cardRef = useRef(null)

  // Scroll into view when opened via deep link
  useEffect(() => {
    if (!autoOpen || !cardRef.current) return
    const t = setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500)
    return () => clearTimeout(t)
  }, [autoOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleShare = async (e) => {
    e.stopPropagation()
    const url = `${window.location.origin}/?tournament=${t.id}`
    // Robust 3-tier fallback so WhatsApp/Instagram in-app browsers + old
    // Safari can still copy when the modern clipboard API is unavailable.
    const res = await shareOrCopy({ title: t.name, text: `¡Unite al torneo! ${t.name}`, url })
    if ((res.method === 'clipboard' || res.method === 'legacy') && res.ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Editable local state (updated after admin saves)
  const [curDate,  setCurDate]  = useState(t.date)
  const [curTime,  setCurTime]  = useState(t.start_time?.slice(0, 5) ?? '')
  const [curCount, setCurCount] = useState(t.player_count)
  const [curFee,   setCurFee]   = useState(t.entry_fee ?? 0)

  // Edit mode state
  const [editingSched, setEditingSched] = useState(false)
  const [editDate,     setEditDate]     = useState('')
  const [editTime,     setEditTime]     = useState('')
  const [editCount,    setEditCount]    = useState('')
  const [editFee,      setEditFee]      = useState('')
  const [savingSched,  setSavingSched]  = useState(false)
  const [schedErr,     setSchedErr]     = useState('')

  // Derived values — declared first so hooks below can depend on them
  const gs           = GAME_STYLES[t.game] ?? GAME_STYLES['MTG']
  const bs           = BRANCH_STYLES[t.branch] ?? { color: '#6B7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.25)', dot: '#6B7280' }
  const top3         = (t.tournament_results ?? []).sort((a, b) => a.position - b.position).slice(0, 3)
  const participants = t.tournament_participants ?? []

  // ── Invite panel ──────────────────────────────
  const [showInvite,   setShowInvite]   = useState(false)
  const [inviteQuery,  setInviteQuery]  = useState('')
  const [inviteList,   setInviteList]   = useState([])
  const [inviteLoading,setInviteLoading]= useState(false)
  const [invitedIds,   setInvitedIds]   = useState({}) // userId → true
  const inviteRef = useRef(null)

  const doInviteSearch = useCallback(async (q) => {
    setInviteLoading(true)
    try {
      const all = await searchUsers(q)
      const enrolledSet = new Set(participants.map(p => p.user_id))
      setInviteList(all.filter(u => !enrolledSet.has(u.id)))
    } catch { setInviteList([]) }
    setInviteLoading(false)
  }, [participants])

  useEffect(() => {
    if (!showInvite) return
    const timer = setTimeout(() => doInviteSearch(inviteQuery), 250)
    return () => clearTimeout(timer)
  }, [inviteQuery, showInvite, doInviteSearch])

  const handleInvite = async (user) => {
    if (invitedIds[user.id]) return
    setInvitedIds(prev => ({ ...prev, [user.id]: 'sending' }))
    try {
      await inviteTournament(t.id, t.name, user.id)
      setInvitedIds(prev => ({ ...prev, [user.id]: 'sent' }))
    } catch {
      setInvitedIds(prev => ({ ...prev, [user.id]: false }))
    }
  }
  const joinedCount  = participants.length
  const isJoined     = participants.some(p => p.user_id === profile?.id)
  const now          = new Date()
  const todayStr     = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const isPast       = curDate < todayStr
  const isFull       = curCount > 0 && joinedCount >= curCount
  const dateStr      = new Date(curDate + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' })
  const timeStr      = curTime || null

  const openEdit = () => {
    setEditDate(curDate)
    setEditTime(curTime)
    setEditCount(String(curCount))
    setEditFee(curFee > 0 ? String(curFee) : '')
    setSchedErr('')
    setEditingSched(true)
  }

  const saveSchedule = async () => {
    if (!editDate) { setSchedErr('Fecha requerida'); return }
    if (!editCount || isNaN(editCount) || +editCount < 2) { setSchedErr('Jugadores debe ser ≥ 2'); return }
    setSavingSched(true); setSchedErr('')
    try {
      await updateTournament(t.id, {
        date: editDate,
        startTime: editTime || null,
        playerCount: parseInt(editCount),
        entryFee: editFee !== '' ? parseFloat(editFee) : 0,
      })
      setCurDate(editDate)
      setCurTime(editTime)
      setCurCount(parseInt(editCount))
      setCurFee(editFee !== '' ? parseFloat(editFee) : 0)
      setEditingSched(false)
    } catch (e) {
      setSchedErr(e.message || 'Error al guardar')
    }
    setSavingSched(false)
  }

  const handleJoin = async (e) => {
    e.stopPropagation()
    if (joining) return
    setJoining(true)
    setJoinErr('')
    try {
      if (isJoined) {
        await leaveTournament(t.id)
        toast?.('Te diste de baja del torneo', { type: 'info' })
      } else {
        await joinTournament(t.id)
        toast?.(`¡Inscripto en ${t.name}!`, { type: 'success' })
        navigator.vibrate?.(20)
        // If the organizer added an external registration link, surface it
        // RIGHT AFTER the join so the user remembers to also sign up on the
        // official platform (Bandai TCG+, MTG Companion, etc.).
        if (t.external_url) setShowExternalLink(true)
      }
      // Optimistic update — parent will refetch on next mount, for now flip locally
      const uid = profile?.id
      if (isJoined) {
        t.tournament_participants = participants.filter(p => p.user_id !== uid)
      } else {
        t.tournament_participants = [...participants, { user_id: uid }]
      }
    } catch (e) {
      setJoinErr(e.message || 'Error al actualizar inscripción')
      toast?.(e.message || 'Error al actualizar inscripción', { type: 'error' })
    } finally {
      setJoining(false)
    }
  }

  return (
    <div ref={cardRef} style={{
      margin: '0 16px 10px',
      background: COLOR.surface,
      borderRadius: RADIUS.md,
      border: `1px solid ${isJoined ? bs.border : COLOR.border}`,
      animation: 'fadeUp 0.3s ease both',
      animationDelay: `${index * 0.04}s`,
      overflow: 'hidden',
      boxShadow: `${ELEVATION.sm}, ${ELEVATION.innerLit}`,
      // Left accent bar using branch color
      borderLeft: `3px solid ${bs.dot}`,
      transition: MOTION.springTransition,
    }}>
      {/* Collapsed — 2-row layout */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '12px 15px 10px', cursor: 'pointer' }}
      >
        {/* ── Row 1: logo · name · join · chevron ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          {/* Game icon */}
          <div style={{
            width: 34, height: 34, borderRadius: RADIUS.sm, flexShrink: 0,
            background: gs.bg, border: `1px solid ${gs.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}>
            <GameIcon game={t.game} size={17} />
          </div>

          {/* Tournament name */}
          <div style={{
            flex: 1, minWidth: 0,
            fontSize: 13.5, fontWeight: WEIGHT.semibold, color: COLOR.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}>
            {t.name}
          </div>

          {/* Join button — refined pill */}
          {!isPast && (
            <button
              onClick={handleJoin}
              disabled={joining || (!isJoined && isFull)}
              className="pressable"
              style={{
                fontSize: 11.5, fontWeight: WEIGHT.bold, flexShrink: 0,
                padding: '6px 12px', borderRadius: RADIUS.full,
                minWidth: 82, fontFamily: FONT_STACK,
                letterSpacing: '-0.005em',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                border: isJoined
                  ? '1px solid rgba(34,197,94,0.55)'
                  : `1px solid ${COLOR.borderStrong}`,
                background: isJoined
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.22) 0%, rgba(34,197,94,0.10) 100%)'
                  : COLOR.surfaceRaised,
                color: isJoined ? '#86EFAC' : COLOR.textSecondary,
                boxShadow: isJoined
                  ? '0 0 10px rgba(34,197,94,0.18), inset 0 1px 0 rgba(255,255,255,0.05)'
                  : ELEVATION.sm,
                cursor: (joining || (!isJoined && isFull)) ? 'default' : 'pointer',
                transition: MOTION.springTransition,
              }}
            >
              {joining ? (
                <span style={{
                  width: 11, height: 11, borderRadius: '50%',
                  border: '1.5px solid rgba(255,255,255,0.2)',
                  borderTopColor: '#FFF',
                  animation: 'spin 0.7s linear infinite', display: 'inline-block',
                }} />
              ) : isJoined ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span>Inscripto</span>
                </>
              ) : isFull ? 'Lleno' : 'Unirse'}
            </button>
          )}

          {/* Chevron */}
          <span style={{
            fontSize: 10, color: COLOR.textQuaternary, flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: MOTION.springTransition, display: 'inline-block',
          }}>▼</span>
        </div>

        {/* ── Row 2: count · date · time · share ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          {/* Participants */}
          <SAUsers size={10.5} color={COLOR.textTertiary} />
          <span style={{ fontSize: 10.5, color: COLOR.textTertiary, fontWeight: WEIGHT.semibold, letterSpacing: '0.005em' }}>{joinedCount}/{curCount} inscritos</span>

          {curDate && (
            <>
              <span style={{ fontSize: 10, color: COLOR.borderStrong }}>·</span>
              <SACalendar size={10.5} color={COLOR.textTertiary} />
              <span style={{ fontSize: 10.5, color: COLOR.textTertiary, fontWeight: WEIGHT.medium }}>{dateStr}</span>
            </>
          )}

          {timeStr && (
            <>
              <span style={{ fontSize: 10, color: COLOR.borderStrong }}>·</span>
              <SAClock size={10.5} color={COLOR.textTertiary} />
              <span style={{ fontSize: 10.5, color: COLOR.textTertiary, fontWeight: WEIGHT.medium }}>{timeStr}</span>
            </>
          )}

          {curFee > 0 && (
            <>
              <span style={{ fontSize: 10, color: COLOR.borderStrong }}>·</span>
              <span style={{ fontSize: 10.5, color: COLOR.gold, fontWeight: WEIGHT.bold }}>${curFee % 1 === 0 ? curFee : curFee.toFixed(2)}</span>
            </>
          )}

          {/* Share — pushed to the right */}
          <div style={{ flex: 1 }} />
          <button
            onClick={handleShare}
            title="Compartir torneo"
            className="pressable"
            style={{
              background: 'none', border: 'none', padding: '4px 6px',
              borderRadius: RADIUS.sm,
              cursor: 'pointer', color: copied ? COLOR.green : COLOR.textTertiary,
              fontSize: copied ? 10.5 : 13, fontWeight: copied ? WEIGHT.bold : WEIGHT.regular,
              fontFamily: FONT_STACK, lineHeight: 1,
              transition: MOTION.springTransition, flexShrink: 0,
            }}
          >
            {copied ? '✓ copiado' : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {joinErr && (
        <div style={{ padding: '6px 14px', fontSize: 12, color: '#F87171', background: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.15)' }}>
          {joinErr}
        </div>
      )}

      {/* External registration link (always visible in the expanded card so
          users can re-access it after dismissing the post-join modal). */}
      {open && t.external_url && (
        <a
          href={t.external_url}
          target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px',
            background: 'rgba(167,139,250,0.06)',
            borderTop: '1px solid rgba(167,139,250,0.18)',
            color: '#A78BFA', textDecoration: 'none',
            fontSize: 12, fontWeight: 700,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <span style={{ flex: 1 }}>Inscripción en plataforma oficial</span>
          <span style={{ color: '#6B7280', fontSize: 11 }}>Abrir →</span>
        </a>
      )}

      {/* Expanded — participants + top 3 results */}
      {open && (
        <div style={{ borderTop: '1px solid #1A1A1A', animation: 'fadeUp 0.2s ease' }}>

          {/* Participants list */}
          <div style={{ padding: '12px 15px 0' }}>
            <div style={{
              fontSize: 10, fontWeight: WEIGHT.bold, color: COLOR.textTertiary,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Inscriptos
              <span style={{
                background: COLOR.surfaceRaised, color: COLOR.textSecondary,
                fontSize: 9.5, fontWeight: WEIGHT.bold,
                padding: '2px 7px', borderRadius: RADIUS.full,
                letterSpacing: 0,
                border: `1px solid ${COLOR.border}`,
              }}>
                {joinedCount}/{curCount}
              </span>
            </div>

            {participants.length === 0 ? (
              <div style={{ fontSize: 12.5, color: COLOR.textQuaternary, paddingBottom: 12, fontWeight: WEIGHT.medium }}>Nadie inscripto aún</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {participants.map((p, idx) => {
                  const prof = p.profiles
                  if (!prof) return null
                  const playerMedal = top3.find(r => r.user_id === p.user_id)
                  return (
                    <ParticipantRow
                      key={p.user_id}
                      p={p}
                      prof={prof}
                      idx={idx}
                      total={participants.length}
                      playerMedal={playerMedal}
                      tournamentId={t.id}
                      tournamentName={t.name}
                      tournamentGame={t.game}
                      isAdmin={isAdmin}
                      onViewProfile={onViewProfile}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {/* Top 3 results (only if past tournament) */}
          {top3.length > 0 && (
            <div style={{ padding: '10px 14px 12px', borderTop: '1px solid #161616', marginTop: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', letterSpacing: '0.08em', marginBottom: 8 }}>TOP 3</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {top3.map(r => (
                  <div
                    key={r.user_id}
                    onClick={() => onViewProfile?.(r.user_id)}
                    style={{
                      flex: 1, padding: '8px 6px', borderRadius: 8,
                      background: '#0A0A0A', border: '1px solid #1A1A1A', textAlign: 'center',
                      cursor: onViewProfile ? 'pointer' : 'default',
                      transition: 'border-color 0.12s',
                    }}
                    onMouseEnter={e => { if (onViewProfile) e.currentTarget.style.borderColor = '#2A2A2A' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#1A1A1A' }}
                  >
                    <div style={{ fontSize: 16, marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {r.position <= 3 ? <RankIcon rank={r.position} size={16} /> : `#${r.position}`}
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.profiles?.username}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {top3.length === 0 && isPast && (
            <div style={{ padding: '6px 14px 12px', borderTop: '1px solid #161616', marginTop: 4, fontSize: 12, color: '#374151' }}>
              Sin resultados registrados
            </div>
          )}

          {/* ── Invite panel — visible to ALL users on upcoming tournaments ── */}
          {!isPast && (
            <div style={{ borderTop: '1px solid #161616', padding: '8px 14px 10px' }}>
              {/* Toggle button */}
              <button
                onClick={() => { setShowInvite(v => !v); setInviteQuery(''); setInvitedIds({}) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8,
                  background: showInvite ? 'rgba(52,211,153,0.12)' : 'rgba(52,211,153,0.06)',
                  border: `1px solid ${showInvite ? 'rgba(52,211,153,0.35)' : 'rgba(52,211,153,0.15)'}`,
                  color: '#34D399', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.15s',
                }}
              >
                <UserPlusIcon size={13} color="#34D399" />
                Invitar jugadores
              </button>

              {/* Search + results */}
              {showInvite && (
                <div style={{ marginTop: 8, animation: 'fadeUp 0.15s ease' }}>
                  {/* Search input with icon */}
                  <div style={{ position: 'relative', marginBottom: 6 }}>
                    <div style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.4 }}>
                      <SearchIcon size={13} color="#9CA3AF" />
                    </div>
                    <input
                      ref={inviteRef}
                      value={inviteQuery}
                      onChange={e => setInviteQuery(e.target.value)}
                      placeholder="Buscar jugador…"
                      autoFocus
                      style={{
                        width: '100%', padding: '7px 10px 7px 28px', borderRadius: 8, boxSizing: 'border-box',
                        background: '#0A0A0A', border: '1px solid #222', color: '#FFF',
                        fontSize: 12, outline: 'none', fontFamily: 'Inter, sans-serif',
                      }}
                    />
                  </div>

                  {inviteLoading && (
                    <div style={{ fontSize: 11, color: '#4B5563', padding: '4px 2px', fontFamily: 'Inter, sans-serif' }}>Buscando…</div>
                  )}
                  {!inviteLoading && inviteList.length === 0 && (
                    <div style={{ fontSize: 11, color: '#374151', padding: '4px 2px', fontFamily: 'Inter, sans-serif' }}>
                      {inviteQuery ? 'Sin resultados' : 'Escribe para buscar'}
                    </div>
                  )}

                  <div style={{ maxHeight: 190, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {inviteList.slice(0, 20).map(user => {
                      const state = invitedIds[user.id]
                      return (
                        <div key={user.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 4px', borderRadius: 8,
                        }}>
                          {/* Avatar */}
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1F1F1F', overflow: 'hidden', flexShrink: 0, border: '1px solid #2A2A2A' }}>
                            <Avatar url={user.avatar_url} size={28} />
                          </div>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#D1D5DB', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.username}
                          </span>
                          {/* Invite button */}
                          <button
                            onClick={() => handleInvite(user)}
                            disabled={!!state}
                            style={{
                              flexShrink: 0,
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '4px 10px', borderRadius: 6,
                              border: `1px solid ${state === 'sent' ? 'rgba(52,211,153,0.3)' : state === 'sending' ? '#222' : 'rgba(52,211,153,0.2)'}`,
                              background: state === 'sent' ? 'rgba(52,211,153,0.1)' : state === 'sending' ? 'transparent' : 'rgba(52,211,153,0.08)',
                              color: state === 'sent' ? '#34D399' : state === 'sending' ? '#4B5563' : '#34D399',
                              fontSize: 10, fontWeight: 700, cursor: state ? 'default' : 'pointer',
                              fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                            }}
                          >
                            {state === 'sent'
                              ? <><CheckIcon size={10} color="#34D399" /> Enviado</>
                              : state === 'sending' ? '…'
                              : <><UserPlusIcon size={10} color="#34D399" /> Invitar</>}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Admin — edit schedule only ── */}
          {isAdmin && (
            <div style={{ padding: '8px 14px 12px', borderTop: '1px solid #161616' }}>
              {!editingSched ? (
                <button onClick={openEdit} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8,
                  background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)',
                  color: '#A78BFA', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>
                  <PencilIcon size={11} color="#A78BFA" />
                  Editar horario / cupos
                </button>
              ) : (
                <div style={{ animation: 'fadeUp 0.15s ease' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 4 }}>FECHA</div>
                      <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                        style={{ width: '100%', padding: '7px 9px', background: '#111', border: '1px solid #2A2A2A', borderRadius: 8, color: '#FFF', fontSize: 12, outline: 'none', colorScheme: 'dark', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 4 }}>HORA</div>
                      <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                        style={{ width: '100%', padding: '7px 9px', background: '#111', border: '1px solid #2A2A2A', borderRadius: 8, color: '#FFF', fontSize: 12, outline: 'none', colorScheme: 'dark', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 4 }}>CUPOS</div>
                      <input type="number" min="2" value={editCount} onChange={e => setEditCount(e.target.value)}
                        style={{ width: '100%', padding: '7px 9px', background: '#111', border: '1px solid #2A2A2A', borderRadius: 8, color: '#FFF', fontSize: 12, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 4 }}>COSTO $</div>
                      <input type="number" min="0" step="0.01" value={editFee} onChange={e => setEditFee(e.target.value)}
                        placeholder="0" style={{ width: '100%', padding: '7px 9px', background: '#111', border: '1px solid #2A2A2A', borderRadius: 8, color: '#FFF', fontSize: 12, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  {schedErr && <div style={{ fontSize: 11, color: '#F87171', marginBottom: 6 }}>{schedErr}</div>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={saveSchedule} disabled={savingSched} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '7px', borderRadius: 8, border: 'none',
                      background: 'rgba(74,222,128,0.12)', color: '#4ADE80',
                      fontSize: 12, fontWeight: 700, cursor: savingSched ? 'default' : 'pointer',
                      opacity: savingSched ? 0.5 : 1, fontFamily: 'Inter, sans-serif',
                    }}>
                      {savingSched ? '…' : <><CheckIcon size={11} color="#4ADE80" /> Guardar</>}
                    </button>
                    <button onClick={() => setEditingSched(false)} disabled={savingSched} style={{
                      padding: '7px 14px', borderRadius: 8, border: 'none',
                      background: 'rgba(239,68,68,0.08)', color: '#F87171',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    }}>✕</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Post-join modal — shown right after a successful Quest registration
          when the tournament has an external_url. Reminds the user to also
          register on the official platform (Bandai TCG+, MTG Companion, etc.).
          Dismissible — the link also remains visible in the expanded card. */}
      {showExternalLink && t.external_url && (
        <div
          onClick={() => setShowExternalLink(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
            animation: 'fadeInFast 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 340,
              background: '#111111', border: '1px solid #2A2A2A',
              borderRadius: 16, padding: '22px 20px 18px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
              animation: 'slideUp 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'rgba(74,222,128,0.12)',
              border: '1px solid rgba(74,222,128,0.25)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, marginBottom: 14,
            }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#FFF', marginBottom: 6 }}>
              ¡Inscrito en Quest!
            </div>
            <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.5, marginBottom: 18 }}>
              Ahora completá tu inscripción en el sistema oficial del torneo:
            </div>
            <a
              href={t.external_url}
              target="_blank" rel="noopener noreferrer"
              onClick={() => setShowExternalLink(false)}
              style={{
                display: 'block', padding: '13px 0', borderRadius: 12,
                background: '#A78BFA', color: '#111',
                fontSize: 14, fontWeight: 800, textDecoration: 'none',
                marginBottom: 8,
              }}
            >
              🔗 Abrir inscripción oficial
            </a>
            <button
              onClick={() => setShowExternalLink(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#6B7280', fontSize: 12, fontWeight: 600,
                padding: 8,
              }}
            >
              Lo abro después
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tournaments ──────────────────────────────
function TournamentsTab({ game, branch, onViewProfile, isAdmin, openTournamentId }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getTournaments({ game: game || null, branch: branch || null })
      .then(data => { if (!cancelled) setItems(data) })
      .catch(e => {
        if (cancelled) return
        // AbortError = signal was already cancelled (e.g. component unmounted
        // mid-request, or Safari threw "load failed" — see supabase.js wrapper).
        // Treat it silently; the component will retry or unmount cleanly.
        if (e?.name === 'AbortError') return
        setError(e.message || 'Error de conexión. Verificá tu internet.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [game, branch, retryKey])

  if (loading) return (
    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ borderRadius: 14, background: '#111', border: '1px solid #1F1F1F', padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span style={sk('70%', 15, 6)} />
            <span style={sk('45%', 12, 5)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <span style={sk(72, 26, 7)} />
              <span style={sk(56, 26, 7)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  if (error) return (
    <div style={{ margin: '16px 20px', padding: '14px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ color: '#F87171', fontSize: 13 }}>
        {/aborted|load failed|network|fetch/i.test(error)
          ? 'Error de conexión. Verificá tu internet e intentá de nuevo.'
          : error}
      </div>
      <button
        onClick={() => setRetryKey(k => k + 1)}
        style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#F87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
      >Reintentar</button>
    </div>
  )

  if (!items.length) return (
    <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.18)',
      }}>
        <svg width="26" height="26" viewBox="0 0 16 16" fill="#A78BFA" strokeWidth="0">
          <path d="M2.5.5A.5.5 0 0 1 3 0h10a.5.5 0 0 1 .5.5c0 .538-.012 1.05-.034 1.536a3 3 0 1 1-1.133 5.89c-.79 1.865-1.878 2.777-2.833 3.011v2.173l1.54.54c.478.167.542.718.27.99A.5.5 0 0 1 11 15H5a.5.5 0 0 1-.35-.85l1.54-.54V10.44c-.955-.234-2.043-1.146-2.833-3.012a3 3 0 1 1-1.132-5.89A33.076 33.076 0 0 1 2.5.5zm.099 2.54a2 2 0 0 0 .72 3.935c-.333-1.05-.588-2.346-.72-3.935zm10.083 3.935a2 2 0 0 0 .72-3.935c-.133 1.59-.388 2.885-.72 3.935z"/>
        </svg>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#4B5563' }}>No hay torneos registrados</div>
      <div style={{ fontSize: 12, color: '#374151' }}>Tocá + para reportar tu resultado</div>
    </div>
  )

  return (
    <div style={{ padding: '8px 0' }}>
      {items.map((t, i) => <TournamentCard key={t.id} t={t} index={i} onViewProfile={onViewProfile} isAdmin={isAdmin} autoOpen={t.id === openTournamentId} />)}
    </div>
  )
}

// ── Liga ─────────────────────────────────────

const STATUS_STYLES = {
  upcoming: { label: 'Próxima',   bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)', color: '#A78BFA' },
  active:   { label: 'Activa',    bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',  color: '#4ADE80' },
  finished: { label: 'Finalizada',bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', color: '#6B7280' },
}

const TIER_STYLE = {
  A: { color: '#FBB924', bg: 'rgba(251,185,36,0.12)', border: 'rgba(251,185,36,0.3)' },
  B: { color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  C: { color: '#22D3EE', bg: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.3)' },
}

function LeagueCard({ league, profile, isStaff, onViewProfile, index, defaultOpen = false }) {
  const toast  = useToast()
  const confirmAction = useConfirm()
  const cardRef = useRef(null)
  const [open,        setOpen]        = useState(defaultOpen)
  const [details,     setDetails]     = useState(null)   // { participants, results }
  const [loadingDet,  setLoadingDet]  = useState(false)
  const [detErr,      setDetErr]      = useState('')
  const [joining,     setJoining]     = useState(false)

  // Scroll into view when opened via deep link
  useEffect(() => {
    if (!defaultOpen || !cardRef.current) return
    const t = setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500)
    return () => clearTimeout(t)
  }, [defaultOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Local mutable copies
  const [curStatus,   setCurStatus]   = useState(league.status)
  const [enrolled,    setEnrolled]    = useState(league.enrolled)
  const [partCount,   setPartCount]   = useState(Number(league.participant_count))

  const [copied, setCopied] = useState(false)

  const handleShare = async (e) => {
    e.stopPropagation()
    const url = `${window.location.origin}/?tab=ranks&liga=${league.id}`
    const res = await shareOrCopy({ title: league.name, text: `¡Unite a la liga! ${league.name}`, url })
    if ((res.method === 'clipboard' || res.method === 'legacy') && res.ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Staff panels
  const [activeFechaId, setActiveFechaId] = useState(null)   // fecha open for positions entry
  const [positionMap,   setPositionMap]   = useState({})      // userId → position string
  const [savingPts,     setSavingPts]     = useState(false)
  const [ptsErr,        setPtsErr]        = useState('')
  const [addingFecha,   setAddingFecha]   = useState(false)
  const [newFechaDate,  setNewFechaDate]  = useState('')
  const [newFechaTime,  setNewFechaTime]  = useState('')
  const [savingFecha,   setSavingFecha]   = useState(false)
  const [showAllFechas,  setShowAllFechas]  = useState(false)
  const [showResultados, setShowResultados] = useState(false)
  // Search + add participant
  const [showSearch,    setShowSearch]    = useState(false)
  const [searchQ,       setSearchQ]       = useState('')
  const [searchRes,     setSearchRes]     = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [addedIds,      setAddedIds]      = useState({})
  const [addTier,       setAddTier]       = useState({})      // userId → 'A'|'B'|'C'
  // Guest (no-account) add mode
  const [guestMode,     setGuestMode]     = useState(false)   // toggle between registered / guest
  const [guestInput,    setGuestInput]    = useState('')
  const [guestTier,     setGuestTier]     = useState('')
  const [addingGuest,   setAddingGuest]   = useState(false)
  // Player self-report
  const [selfPosInput,  setSelfPosInput]  = useState('')
  const [selfSubmitting,setSelfSubmitting]= useState(false)
  // Standings view
  const [standingsTab,  setStandingsTab]  = useState('general') // 'general'|'A'|'B'|'C'

  const gs = league.game ? (GAME_STYLES[league.game] ?? GAME_STYLES['MTG']) : null
  const bs = league.branch ? (BRANCH_STYLES[league.branch] ?? null) : null
  const ss = STATUS_STYLES[curStatus] ?? STATUS_STYLES.upcoming

  const fechas = league.fechas ?? []

  // Load details on open
  useEffect(() => {
    if (!open) return
    setLoadingDet(true); setDetErr('')
    getLeagueDetails(league.id)
      .then(d => {
        setDetails(d)
        // Pre-fill positionMap from existing results for the active fecha
        // Key = participant.id (works for both registered users and guests)
        if (activeFechaId) {
          const m = {}
          d.results.filter(r => r.fecha_id === activeFechaId).forEach(r => {
            const part = d.participants.find(p => p.user_id === r.user_id)
            if (part) m[part.id] = String(r.position ?? '')
          })
          setPositionMap(m)
        }
      })
      .catch(e => setDetErr(e.message))
      .finally(() => setLoadingDet(false))
  }, [open, league.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // When switching active fecha, pre-fill positions from loaded results
  useEffect(() => {
    if (!details || !activeFechaId) return
    const m = {}
    details.results.filter(r => r.fecha_id === activeFechaId).forEach(r => {
      const part = details.participants.find(p => p.user_id === r.user_id)
      if (part) m[part.id] = String(r.position ?? '')
    })
    setPositionMap(m)
  }, [activeFechaId, details])

  // Search users debounced
  useEffect(() => {
    if (!showSearch) return
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const all = await searchUsers(searchQ)
        const enrolledSet = new Set((details?.participants ?? []).map(p => p.user_id))
        setSearchRes(all.filter(u => !enrolledSet.has(u.id)))
      } catch { setSearchRes([]) }
      setSearchLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [searchQ, showSearch, details])

  const handleJoin = async (e) => {
    e.stopPropagation()
    if (joining) return
    setJoining(true)
    try {
      if (enrolled) {
        await leaveLeague(league.id)
        setEnrolled(false)
        setPartCount(c => c - 1)
        toast?.('Te diste de baja de la liga', { type: 'info' })
      } else {
        await joinLeague(league.id)
        setEnrolled(true)
        setPartCount(c => c + 1)
        toast?.(`¡Inscripto en ${league.name}!`, { type: 'success' })
        navigator.vibrate?.(20)
      }
    } catch (e) {
      toast?.(e.message || 'Error al actualizar inscripción', { type: 'error' })
    } finally {
      setJoining(false)
    }
  }

  const handleStatusChange = async (newStatus) => {
    try {
      await updateLeagueStatus(league.id, newStatus)
      setCurStatus(newStatus)
      toast?.('Estado actualizado', { type: 'success' })
    } catch (e) {
      toast?.(e.message || 'Error al cambiar estado', { type: 'error' })
    }
  }

  const handleSavePoints = async () => {
    if (!activeFechaId || !details) return
    setSavingPts(true); setPtsErr('')
    try {
      // Save ALL participants with a position (registered + guests)
      // Guests get 0 pts but their positions are needed for correct tier ranking
      const toSave = details.participants.filter(p =>
        positionMap[p.id] && parseInt(positionMap[p.id]) > 0
      )
      if (toSave.length === 0) { setPtsErr('Ingresá al menos una posición'); setSavingPts(false); return }
      // Block if any player has no tier assigned — would corrupt point calculations
      const missingTier = toSave.filter(p => !p.tier)
      if (missingTier.length > 0) {
        setPtsErr(`Sin tier asignado: ${missingTier.map(p => p.profiles?.username || p.guest_name || 'jugador').join(', ')}`)
        setSavingPts(false); return
      }
      await Promise.all(
        toSave.map(p => upsertLeagueResult({
          fechaId: activeFechaId, leagueId: league.id,
          userId: p.user_id || null,
          participantId: p.id,
          tier: p.tier,
          position: parseInt(positionMap[p.id]),
        }))
      )
      // Recalculate all points for this fecha using cross-row tier rules
      await recalcFechaPoints(activeFechaId)
      const d = await getLeagueDetails(league.id)
      setDetails(d)
      toast?.('Posiciones guardadas ✓', { type: 'success' })
    } catch (e) {
      setPtsErr(e.message || 'Error al guardar posiciones')
    }
    setSavingPts(false)
  }

  const handleAddFecha = async () => {
    setSavingFecha(true)
    try {
      await addLeagueFecha(league.id, {
        number: fechas.length + 1,
        date: newFechaDate,
        startTime: newFechaTime,
      })
      // Reload league (optimistic update)
      league.fechas = [...fechas, { id: `tmp-${Date.now()}`, number: fechas.length + 1, date: newFechaDate, start_time: newFechaTime, status: 'upcoming' }]
      setAddingFecha(false)
      setNewFechaDate('')
      setNewFechaTime('')
      toast?.('Fecha agregada', { type: 'success' })
    } catch (e) {
      toast?.(e.message || 'Error al agregar fecha', { type: 'error' })
    }
    setSavingFecha(false)
  }

  const handleAddParticipant = async (user) => {
    if (addedIds[user.id]) return
    setAddedIds(prev => ({ ...prev, [user.id]: 'adding' }))
    try {
      await addLeagueParticipant(league.id, user.id, addTier[user.id] || null)
      setAddedIds(prev => ({ ...prev, [user.id]: 'added' }))
      setPartCount(c => c + 1)
      const d = await getLeagueDetails(league.id)
      setDetails(d)
    } catch {
      setAddedIds(prev => ({ ...prev, [user.id]: false }))
    }
  }

  const handleAddGuest = async () => {
    const name = guestInput.trim()
    if (!name || addingGuest) return
    setAddingGuest(true)
    try {
      await addLeagueParticipant(league.id, null, guestTier || null, name)
      setPartCount(c => c + 1)
      const d = await getLeagueDetails(league.id)
      setDetails(d)
      setGuestInput('')
      setGuestTier('')
      toast?.(`${name} agregado`, { type: 'success' })
    } catch (e) {
      toast?.(e.message || 'Error al agregar invitado', { type: 'error' })
    }
    setAddingGuest(false)
  }

  // Build overall standings from results
  const standings = (() => {
    if (!details) return []
    const totals = {}
    details.results.forEach(r => {
      if (r.user_id) totals[r.user_id] = (totals[r.user_id] ?? 0) + r.points
    })
    return details.participants
      .map(p => ({
        ...(p.profiles ?? {}),
        participantId: p.id,          // row PK — used for tier/paid updates
        userId:    p.user_id,
        guestName: p.guest_name,      // non-null for guest participants
        paid:      p.paid,
        tier:      p.tier,
        total:     p.user_id ? (totals[p.user_id] ?? 0) : 0,
      }))
      .sort((a, b) => b.total - a.total)
  })()

  const canJoin = curStatus === 'upcoming' && !isStaff
  const entryFee = Number(league.entry_fee ?? 0)
  const maxPlayers = Number(league.max_players ?? 0)
  const isFull = maxPlayers > 0 && partCount >= maxPlayers

  const inputSm = {
    background: '#0F0F0F', border: '1px solid #222', borderRadius: 8,
    color: '#FFF', fontSize: 13, fontFamily: 'Inter, sans-serif',
    outline: 'none', padding: '7px 10px',
  }

  return (
    <div ref={cardRef} style={{
      margin: '0 16px 10px',
      background: '#111111', borderRadius: 14,
      border: `1px solid ${enrolled ? (bs?.border ?? 'rgba(167,139,250,0.3)') : '#1F1F1F'}`,
      animation: 'fadeUp 0.3s ease both',
      animationDelay: `${index * 0.04}s`,
      overflow: 'hidden',
      boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
      borderLeft: `3px solid ${bs?.dot ?? '#374151'}`,
    }}>
      {/* Collapsed row */}
      <div onClick={() => setOpen(o => !o)} style={{ padding: '16px 16px 14px', cursor: 'pointer' }}>
        {/* Row 1: name + status + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          {gs && (
            <span style={{
              padding: '3px 8px', borderRadius: 6, flexShrink: 0,
              background: gs.bg, border: `1px solid ${gs.border}`,
              color: gs.color, fontSize: 11, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}><GameIcon game={league.game} size={11} />{league.game}</span>
          )}
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {league.name}
          </span>
          {/* Share league */}
          <button
            onClick={handleShare}
            title="Compartir liga"
            style={{
              background: 'none', border: 'none', padding: '2px 0px',
              cursor: 'pointer', color: copied ? '#4ADE80' : '#6B7280',
              fontSize: copied ? 10 : 13, fontWeight: copied ? 700 : 400,
              fontFamily: 'Inter, sans-serif', lineHeight: 1,
              transition: 'color 0.2s', flexShrink: 0,
            }}
          >
            {copied ? '✓ copiado' : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            )}
          </button>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 6, flexShrink: 0,
            background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color,
          }}>{ss.label}</span>
          <span style={{ color: '#4B5563', fontSize: 14, marginLeft: 2, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
        </div>
        {/* Row 2: branch · fechas count · participants · entry fee */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {league.branch && bs && (
            <span style={{ fontSize: 11, color: bs.color, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: bs.dot, display: 'inline-block' }} />{league.branch}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 4 }}>
            <SACalendar size={11} /> {fechas.length} fecha{fechas.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 11, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 4 }}>
            <SAUsers size={11} /> {partCount}{maxPlayers > 0 ? `/${maxPlayers}` : ''}
          </span>
          {entryFee > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>${entryFee}</span>
          )}
          {/* Join button */}
          {profile && (canJoin || enrolled) && (
            <button
              onClick={handleJoin}
              disabled={joining || (isFull && !enrolled)}
              style={{
                marginLeft: 'auto', padding: '7px 16px', borderRadius: 9,
                border: `1px solid ${enrolled ? 'rgba(239,68,68,0.35)' : 'rgba(167,139,250,0.4)'}`,
                background: enrolled ? 'rgba(239,68,68,0.08)' : 'rgba(167,139,250,0.1)',
                color: enrolled ? '#F87171' : '#A78BFA',
                fontSize: 12, fontWeight: 700, cursor: joining ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif', flexShrink: 0,
              }}
            >
              {joining ? '...' : enrolled ? 'Salir' : isFull ? 'Lleno' : 'Inscribirme'}
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div style={{ borderTop: '1px solid #1A1A1A' }}>
          {loadingDet && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(3)].map((_, i) => <span key={i} style={sk('80%', 12, 5)} />)}
            </div>
          )}
          {detErr && (
            <div style={{ padding: '10px 14px', color: '#F87171', fontSize: 12 }}>{detErr}</div>
          )}
          {details && !loadingDet && (
            <>
              {/* Description */}
              {league.description && (
                <div style={{ padding: '10px 14px 0', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                  {league.description}
                </div>
              )}

              {/* Fechas list */}
              <div style={{ padding: '14px 16px 6px' }}>
                <div
                  onClick={() => fechas.length > 1 && setShowAllFechas(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 10, cursor: fechas.length > 1 ? 'pointer' : 'default',
                  }}
                >
                  {fechas.length > 1 ? (
                    <span style={{ fontSize: 10, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {showAllFechas ? `▲ ver menos` : `▼ ver todas (${fechas.length})`}
                    </span>
                  ) : <span />}
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.07em' }}>FECHAS</span>
                </div>
                {/* Compute visible fechas inline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(showAllFechas
                    ? fechas
                    : (() => {
                        const nf =
                          fechas.find(f => f.status === 'active') ??
                          fechas.find(f => f.status === 'upcoming') ??
                          fechas[fechas.length - 1]
                        return nf ? [nf] : fechas
                      })()
                  ).map(f => {
                    const fs = STATUS_STYLES[f.status] ?? STATUS_STYLES.upcoming
                    const isActive = activeFechaId === f.id
                    const dateStr = f.date ? new Date(f.date + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' }) : null
                    return (
                      <div key={f.id}
                        onClick={() => isStaff && setActiveFechaId(isActive ? null : f.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                          borderRadius: 11, background: isActive ? 'rgba(167,139,250,0.06)' : '#141414',
                          border: `1px solid ${isActive ? 'rgba(167,139,250,0.3)' : '#1F1F1F'}`,
                          cursor: isStaff ? 'pointer' : 'default',
                        }}
                      >
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: '#1A1A1A', border: '1px solid #2A2A2A',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, color: '#6B7280', flexShrink: 0,
                        }}>{f.number}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#E5E5E5' }}>
                            Fecha {f.number}
                          </span>
                          {dateStr && (
                            <span style={{ fontSize: 11, color: '#4B5563', marginLeft: 8 }}>{dateStr}{f.start_time ? ` · ${f.start_time.slice(0, 5)}` : ''}</span>
                          )}
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                          background: fs.bg, border: `1px solid ${fs.border}`, color: fs.color,
                        }}>{fs.label}</span>
                        {/* Staff: status changer */}
                        {isStaff && isActive && (
                          <select
                            value={f.status}
                            onClick={e => e.stopPropagation()}
                            onChange={async e => {
                              const s = e.target.value
                              try {
                                await updateFechaStatus(f.id, s)
                                f.status = s
                                toast?.('Estado de fecha actualizado', { type: 'success' })
                                setActiveFechaId(f.id) // force re-render
                              } catch(ex) { toast?.(ex.message, { type: 'error' }) }
                            }}
                            style={{
                              ...inputSm, fontSize: 10, padding: '3px 6px',
                              flexShrink: 0, maxWidth: 80,
                            }}
                          >
                            <option value="upcoming">Próxima</option>
                            <option value="active">Activa</option>
                            <option value="finished">Fin.</option>
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Staff: add new fecha */}
                {isStaff && (
                  <div style={{ marginTop: 6 }}>
                    {addingFecha ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="date" value={newFechaDate} onChange={e => setNewFechaDate(e.target.value)}
                          style={{ ...inputSm, flex: 1.5, colorScheme: 'dark' }} />
                        <input type="time" value={newFechaTime} onChange={e => setNewFechaTime(e.target.value)}
                          style={{ ...inputSm, flex: 1, colorScheme: 'dark' }} />
                        <button onClick={handleAddFecha} disabled={savingFecha} style={{
                          padding: '7px 10px', borderRadius: 7, border: 'none',
                          background: '#FFFFFF', color: '#111', fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0,
                        }}>{savingFecha ? '...' : 'OK'}</button>
                        <button onClick={() => setAddingFecha(false)} style={{
                          background: 'none', border: 'none', color: '#4B5563',
                          fontSize: 18, cursor: 'pointer', lineHeight: 1, flexShrink: 0,
                        }}>×</button>
                      </div>
                    ) : (
                      <button onClick={() => setAddingFecha(true)} style={{
                        fontSize: 10, fontWeight: 700, color: '#6B7280',
                        background: 'transparent', border: '1px dashed #2A2A2A',
                        borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif', width: '100%', marginTop: 2,
                      }}>+ Nueva fecha</button>
                    )}
                  </div>
                )}
              </div>

              {/* Standings — tabbed: General / Tier A / Tier B / Tier C */}
              {standings.length > 0 && (() => {
                const TABS = [
                  { key: 'general', label: 'General' },
                  { key: 'A', label: 'Tier A', color: TIER_STYLE.A?.color ?? '#F59E0B' },
                  { key: 'B', label: 'Tier B', color: TIER_STYLE.B?.color ?? '#A78BFA' },
                  { key: 'C', label: 'Tier C', color: TIER_STYLE.C?.color ?? '#34D399' },
                ]
                const filtered = standingsTab === 'general'
                  ? standings
                  : standings.filter(s => s.tier === standingsTab)
                const tabColor = TABS.find(t => t.key === standingsTab)?.color ?? '#6B7280'

                const StandingRow = ({ s, i }) => (
                  <div key={s.participantId ?? s.userId ?? `g_${s.guestName}`} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                    borderRadius: 10,
                    background: i === 0 ? 'rgba(245,158,11,0.06)' : i === 1 ? 'rgba(156,163,175,0.04)' : i === 2 ? 'rgba(184,115,51,0.04)' : 'transparent',
                    border: `1px solid ${i === 0 ? 'rgba(245,158,11,0.15)' : i === 1 ? 'rgba(156,163,175,0.08)' : i === 2 ? 'rgba(184,115,51,0.08)' : 'transparent'}`,
                  }}>
                    <span style={{
                      width: 18, fontSize: 11, fontWeight: 800, textAlign: 'center', flexShrink: 0,
                      color: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#B87333' : '#374151',
                    }}>{i + 1}</span>
                    {s.guestName ? (
                      <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: '#1A1A1A', border: '1px dashed #2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>👤</div>
                    ) : (
                      <Avatar url={s.avatar_url} size={26} />
                    )}
                    {isStaff ? (
                      <select value={s.tier ?? ''} onClick={e => e.stopPropagation()}
                        onChange={async e => {
                          try { await setParticipantTier(s.participantId, e.target.value || null); const d = await getLeagueDetails(league.id); setDetails(d) }
                          catch(ex) { toast?.(ex.message, { type: 'error' }) }
                        }}
                        style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 6, color: s.tier ? TIER_STYLE[s.tier]?.color ?? '#6B7280' : '#4B5563', fontSize: 10, fontWeight: 700, padding: '2px 5px', fontFamily: 'Inter, sans-serif', cursor: 'pointer', colorScheme: 'dark', flexShrink: 0 }}
                      >
                        <option value="">—</option>
                        <option value="A">T·A</option>
                        <option value="B">T·B</option>
                        <option value="C">T·C</option>
                      </select>
                    ) : (
                      <TierBadge tier={s.tier} />
                    )}
                    {s.guestName ? (
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.guestName}</span>
                    ) : (
                      <span onClick={() => onViewProfile && onViewProfile(s.userId)}
                        style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#E5E5E5', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.username}
                      </span>
                    )}
                    {isStaff && (
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: s.paid ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${s.paid ? 'rgba(74,222,128,0.25)' : 'rgba(239,68,68,0.25)'}`, color: s.paid ? '#4ADE80' : '#F87171', cursor: 'pointer', flexShrink: 0 }}
                        onClick={async e => { e.stopPropagation(); try { await setLeaguePayment(s.participantId, !s.paid); const d = await getLeagueDetails(league.id); setDetails(d) } catch(ex) { toast?.(ex.message, { type: 'error' }) } }}
                      >{s.paid ? '✓ Pagó' : 'Pend.'}</span>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 800, color: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#B87333' : '#6B7280', flexShrink: 0 }}>
                      {s.total}<span style={{ fontSize: 10, fontWeight: 600, color: '#4B5563', marginLeft: 2 }}>pts</span>
                    </span>
                  </div>
                )

                return (
                  <div style={{ padding: '12px 16px 16px' }}>
                    {/* Tab bar */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                      {TABS.map(tab => (
                        <button key={tab.key} onClick={() => setStandingsTab(tab.key)}
                          style={{
                            flex: 1, padding: '5px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                            fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700,
                            background: standingsTab === tab.key ? (tab.color ?? '#E5E5E5') : '#1A1A1A',
                            color: standingsTab === tab.key ? '#111' : '#4B5563',
                            transition: 'background 0.15s, color 0.15s',
                          }}
                        >{tab.label}</button>
                      ))}
                    </div>

                    {/* Scrollable list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 340, overflowY: 'auto', paddingRight: 2 }}>
                      {filtered.map((s, i) => <StandingRow key={s.participantId ?? s.userId ?? `g_${s.guestName}_${i}`} s={s} i={i} />)}
                      {filtered.length === 0 && (
                        <div style={{ fontSize: 11, color: '#374151', textAlign: 'center', padding: '16px 0' }}>Sin datos aún</div>
                      )}
                    </div>
                  </div>
                )
              })()}
              {standings.length === 0 && details.participants.length === 0 && (
                <div style={{ padding: '12px 14px', fontSize: 12, color: '#374151', textAlign: 'center' }}>
                  Aún no hay participantes inscriptos.
                </div>
              )}

              {/* ── RESULTADOS section ── */}
              {fechas.length > 0 && (
                <div style={{ borderTop: '1px solid #1A1A1A', padding: '14px 16px 16px' }}>
                  {/* Header toggle */}
                  <div
                    onClick={() => setShowResultados(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showResultados ? 12 : 0, cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 10, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {showResultados ? '▲ ocultar' : `▼ ver resultados`}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.07em' }}>RESULTADOS</span>
                  </div>
                  {showResultados && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {fechas.map(f => {
                      const fss = STATUS_STYLES[f.status] ?? STATUS_STYLES.upcoming
                      const isStaffOpen = activeFechaId === f.id
                      const fechaResults = details.results
                        .filter(r => r.fecha_id === f.id)
                        .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
                      const myResult = profile ? fechaResults.find(r => r.user_id === profile.id) : null
                      const canSelfReport = !isStaff && enrolled && f.status === 'active' && !myResult
                      const hasContent = fechaResults.length > 0 || canSelfReport || isStaffOpen
                      const dateStr = f.date ? new Date(f.date + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' }) : null

                      return (
                        <div key={f.id} style={{
                          background: '#0D0D0D', borderRadius: 12,
                          border: `1px solid ${isStaffOpen ? 'rgba(167,139,250,0.3)' : f.status === 'active' ? 'rgba(74,222,128,0.2)' : '#1A1A1A'}`,
                          overflow: 'hidden',
                        }}>
                          {/* Fecha header — staff can tap to toggle position entry */}
                          <div
                            onClick={() => isStaff && setActiveFechaId(isStaffOpen ? null : f.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '11px 14px',
                              borderBottom: hasContent ? '1px solid #1A1A1A' : 'none',
                              cursor: isStaff ? 'pointer' : 'default',
                            }}
                          >
                            <div style={{
                              width: 26, height: 26, borderRadius: '50%',
                              background: '#1A1A1A', border: '1px solid #2A2A2A',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 800, color: '#6B7280', flexShrink: 0,
                            }}>{f.number}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#E5E5E5' }}>Fecha {f.number}</span>
                              {dateStr && <span style={{ fontSize: 11, color: '#4B5563', marginLeft: 8 }}>{dateStr}</span>}
                            </div>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                              background: fss.bg, border: `1px solid ${fss.border}`, color: fss.color,
                            }}>{fss.label}</span>
                            {isStaff && (
                              <span style={{ fontSize: 11, color: '#4B5563', marginLeft: 2 }}>{isStaffOpen ? '▲' : '▼'}</span>
                            )}
                          </div>

                          {/* Staff: inline position entry */}
                          {isStaff && isStaffOpen && details.participants.length > 0 && (
                            <div style={{ padding: '12px 14px', borderBottom: fechaResults.length > 0 ? '1px solid #1A1A1A' : 'none' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#A78BFA', letterSpacing: '0.07em', marginBottom: 10 }}>
                                INGRESAR POSICIONES
                                <span style={{ fontWeight: 400, color: '#374151', marginLeft: 6 }}>· puntos se calculan solos</span>
                              </div>
                              {(() => {
                                // Positions already assigned to OTHER players — block them in each dropdown
                                const totalSlots = Math.max(maxPlayers > 0 ? maxPlayers : 0, details.participants.length, 24)
                                const usedPositions = new Set(Object.values(positionMap).filter(v => v !== ''))
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {details.participants.map(p => {
                                      const myPos = positionMap[p.id] ?? ''
                                      const hasPos = myPos !== ''
                                      return (
                                        <div key={p.id} style={{
                                          display: 'flex', alignItems: 'center', gap: 10,
                                          background: hasPos ? 'rgba(167,139,250,0.06)' : 'transparent',
                                          borderRadius: 8, padding: hasPos ? '3px 6px' : '0',
                                          transition: 'background 0.15s',
                                        }}>
                                          {p.user_id
                                            ? <Avatar url={p.profiles?.avatar_url} size={26} />
                                            : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>👤</div>
                                          }
                                          <TierBadge tier={p.tier} />
                                          <span style={{ flex: 1, fontSize: 12, color: hasPos ? '#E5E5E5' : '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {p.user_id ? `@${p.profiles?.username}` : p.guest_name}
                                          </span>
                                          <select
                                            value={myPos}
                                            onChange={e => setPositionMap(prev => ({ ...prev, [p.id]: e.target.value }))}
                                            style={{
                                              ...inputSm, width: 72, textAlign: 'center', colorScheme: 'dark',
                                              borderColor: hasPos ? '#A78BFA' : undefined,
                                              color: hasPos ? '#A78BFA' : undefined,
                                              fontWeight: hasPos ? 700 : 400,
                                            }}
                                          >
                                            <option value="">—</option>
                                            {Array.from({ length: totalSlots }, (_, i) => i + 1).map(n => {
                                              const taken = usedPositions.has(String(n)) && myPos !== String(n)
                                              return (
                                                <option key={n} value={n} disabled={taken}>
                                                  {n}°{taken ? ' ✕' : ''}
                                                </option>
                                              )
                                            })}
                                          </select>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )
                              })()}
                              {ptsErr && <div style={{ fontSize: 11, color: '#F87171', marginTop: 8 }}>{ptsErr}</div>}
                              <button onClick={handleSavePoints} disabled={savingPts} style={{
                                marginTop: 10, width: '100%', padding: '9px', borderRadius: 9, border: 'none',
                                background: savingPts ? '#1A1A1A' : '#A78BFA',
                                color: savingPts ? '#555' : '#111',
                                fontSize: 12, fontWeight: 700, cursor: savingPts ? 'default' : 'pointer',
                                fontFamily: 'Inter, sans-serif',
                              }}>{savingPts ? 'Guardando...' : 'Guardar posiciones'}</button>
                            </div>
                          )}

                          {/* Player self-report grid (active fecha only) */}
                          {canSelfReport && (
                            <div style={{ padding: '12px 14px', borderBottom: fechaResults.length > 0 ? '1px solid #1A1A1A' : 'none' }}>
                              <div style={{ fontSize: 11, color: '#4ADE80', fontWeight: 700, marginBottom: 10 }}>
                                ¿En qué posición terminaste?
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                                {Array.from({ length: Math.max(maxPlayers > 0 ? maxPlayers : 0, details.participants.length, 24) }, (_, i) => i + 1).map(pos => (
                                  <button
                                    key={pos}
                                    disabled={selfSubmitting}
                                    onClick={async () => {
                                      setSelfSubmitting(true)
                                      setSelfPosInput(String(pos))
                                      try {
                                        await submitMyResult({ fechaId: f.id, leagueId: league.id, position: pos })
                                        setSelfPosInput('')
                                        const d = await getLeagueDetails(league.id)
                                        setDetails(d)
                                        toast?.('Posición reportada ✓', { type: 'success' })
                                      } catch(e) { toast?.(e.message, { type: 'error' }) }
                                      setSelfSubmitting(false)
                                    }}
                                    style={{
                                      padding: '10px 4px', borderRadius: 8, border: '1px solid #2A2A2A',
                                      background: selfSubmitting && selfPosInput === String(pos) ? '#4ADE80' : '#141414',
                                      color: selfSubmitting && selfPosInput === String(pos) ? '#111' : '#E5E5E5',
                                      fontSize: 13, fontWeight: 700, cursor: selfSubmitting ? 'default' : 'pointer',
                                      fontFamily: 'Inter, sans-serif', textAlign: 'center',
                                      opacity: selfSubmitting && selfPosInput !== String(pos) ? 0.4 : 1,
                                      transition: 'background 0.15s',
                                    }}
                                  >{pos}</button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Results list */}
                          {fechaResults.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              {fechaResults.map((r, idx) => {
                                const participant = details.participants.find(p => p.user_id === r.user_id)
                                const isGuest = !r.user_id
                                const displayName = isGuest
                                  ? (participant?.guest_name ?? '—')
                                  : (participant?.profiles?.username ?? '—')
                                const avatarUrl = participant?.profiles?.avatar_url
                                const isMe = profile?.id === r.user_id
                                const posColor = r.position === 1 ? '#F59E0B' : r.position === 2 ? '#9CA3AF' : r.position === 3 ? '#B87333' : '#4B5563'
                                return (
                                  <div key={r.id ?? `${r.user_id}-${idx}`} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '9px 14px',
                                    borderTop: idx > 0 ? '1px solid #141414' : 'none',
                                    background: isMe ? 'rgba(74,222,128,0.04)' : 'transparent',
                                  }}>
                                    <span style={{ width: 24, fontSize: 12, fontWeight: 800, color: posColor, textAlign: 'center', flexShrink: 0 }}>
                                      {r.position}°
                                    </span>
                                    {isGuest
                                      ? <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>👤</div>
                                      : <Avatar url={avatarUrl} size={26} />
                                    }
                                    <TierBadge tier={r.tier} />
                                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: isMe ? '#E5E5E5' : '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {isGuest ? displayName : `@${displayName}`}{isMe ? ' (yo)' : ''}
                                    </span>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: '#4ADE80', flexShrink: 0 }}>
                                      {r.points}<span style={{ fontSize: 10, color: '#374151', marginLeft: 2 }}>pts</span>
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Empty state */}
                          {!hasContent && (
                            <div style={{ padding: '11px 14px', fontSize: 11, color: '#2A2A2A', textAlign: 'center' }}>
                              Sin resultados aún
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>}
                </div>
              )}

              {/* Staff: add participants */}
              {isStaff && (
                <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                  {/* ── Registered user search ── */}
                  {!showSearch ? (
                    <button onClick={() => setShowSearch(true)} style={{
                      fontSize: 11, fontWeight: 700, color: '#A78BFA',
                      background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)',
                      borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif', width: '100%',
                    }}>+ Agregar participante</button>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                          placeholder="Buscar usuario..." style={{ ...inputSm, flex: 1 }} />
                        <button onClick={() => { setShowSearch(false); setSearchQ(''); setSearchRes([]) }} style={{
                          background: 'none', border: 'none', color: '#4B5563',
                          fontSize: 18, cursor: 'pointer', lineHeight: 1,
                        }}>×</button>
                      </div>
                      {searchLoading && <div style={{ fontSize: 11, color: '#4B5563', padding: '4px 0' }}>Buscando...</div>}
                      {searchRes.map(u => (
                        <div key={u.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                          borderBottom: '1px solid #1A1A1A',
                        }}>
                          <Avatar url={u.avatar_url} size={26} />
                          <span style={{ flex: 1, fontSize: 12, color: '#E5E5E5' }}>{u.username}</span>
                          {addedIds[u.id] !== 'added' && (
                            <select
                              value={addTier[u.id] ?? ''}
                              onChange={e => setAddTier(prev => ({ ...prev, [u.id]: e.target.value }))}
                              style={{ ...inputSm, fontSize: 10, padding: '3px 6px', width: 62, flexShrink: 0 }}
                            >
                              <option value="">Tier</option>
                              <option value="A">Tier A</option>
                              <option value="B">Tier B</option>
                              <option value="C">Tier C</option>
                            </select>
                          )}
                          <button
                            onClick={() => handleAddParticipant(u)}
                            disabled={addedIds[u.id] === 'adding' || addedIds[u.id] === 'added'}
                            style={{
                              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                              background: addedIds[u.id] === 'added' ? 'rgba(74,222,128,0.15)' : '#2A2A2A',
                              color: addedIds[u.id] === 'added' ? '#4ADE80' : '#9CA3AF',
                              fontSize: 11, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                            }}
                          >
                            {addedIds[u.id] === 'adding' ? '...' : addedIds[u.id] === 'added' ? '✓' : 'Agregar'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Guest (no account) ── */}
                  {!guestMode ? (
                    <button onClick={() => setGuestMode(true)} style={{
                      fontSize: 11, fontWeight: 700, color: '#6B7280',
                      background: 'transparent', border: '1px solid #2A2A2A',
                      borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif', width: '100%',
                    }}>+ Agregar sin ID</button>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        value={guestInput}
                        onChange={e => setGuestInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddGuest()}
                        placeholder="Nombre del jugador..."
                        style={{ ...inputSm, flex: 1 }}
                        autoFocus
                      />
                      <select
                        value={guestTier}
                        onChange={e => setGuestTier(e.target.value)}
                        style={{ ...inputSm, fontSize: 10, padding: '3px 6px', width: 62, flexShrink: 0 }}
                      >
                        <option value="">Tier</option>
                        <option value="A">Tier A</option>
                        <option value="B">Tier B</option>
                        <option value="C">Tier C</option>
                      </select>
                      <button
                        onClick={handleAddGuest}
                        disabled={!guestInput.trim() || addingGuest}
                        style={{
                          padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: guestInput.trim() ? 'rgba(167,139,250,0.15)' : '#1A1A1A',
                          color: guestInput.trim() ? '#A78BFA' : '#374151',
                          fontSize: 11, fontWeight: 700, fontFamily: 'Inter, sans-serif', flexShrink: 0,
                        }}
                      >{addingGuest ? '...' : 'Agregar'}</button>
                      <button onClick={() => { setGuestMode(false); setGuestInput(''); setGuestTier('') }} style={{
                        background: 'none', border: 'none', color: '#4B5563',
                        fontSize: 18, cursor: 'pointer', lineHeight: 1,
                      }}>×</button>
                    </div>
                  )}

                </div>
              )}

              {/* Staff: league status + delete */}
              {isStaff && (
                <div style={{ padding: '0 14px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.07em' }}>ESTADO LIGA</div>
                  {['upcoming', 'active', 'finished'].map(s => {
                    const ss2 = STATUS_STYLES[s]
                    return (
                      <button key={s} onClick={() => handleStatusChange(s)} style={{
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${curStatus === s ? ss2.border : '#2A2A2A'}`,
                        background: curStatus === s ? ss2.bg : 'transparent',
                        color: curStatus === s ? ss2.color : '#4B5563',
                        fontSize: 10, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                      }}>{ss2.label}</button>
                    )
                  })}
                  <button onClick={async () => {
                    const ok = await confirmAction(
                      `Esta acción no se puede deshacer. Se eliminará "${league.name}" junto con todas sus fechas y resultados.`,
                      { title: '¿Eliminar liga?', confirmLabel: 'Eliminar', destructive: true }
                    )
                    if (!ok) return
                    try {
                      await deleteLeague(league.id)
                      toast?.('Liga eliminada', { type: 'info' })
                      // Parent re-fetch is needed; simple page reload as fallback
                      window.dispatchEvent(new CustomEvent('league-deleted', { detail: league.id }))
                    } catch(e) { toast?.(e.message, { type: 'error' }) }
                  }} style={{
                    padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid rgba(239,68,68,0.25)',
                    background: 'rgba(239,68,68,0.06)',
                    color: '#F87171', fontSize: 11, fontWeight: 700,
                    fontFamily: 'Inter, sans-serif', flexShrink: 0,
                  }}>✗</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TierBadge({ tier }) {
  if (!tier) return null
  const s = TIER_STYLE[tier] ?? {}
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      letterSpacing: '0.05em', flexShrink: 0,
    }}>T{tier}</span>
  )
}

function LeagueTab({ game, branch, profile, isStaff, onViewProfile, onCreateLeague, openLeagueId }) {
  const [leagues,  setLeagues]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    getLeagues({ game, branch })
      .then(setLeagues)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [game, branch])

  useEffect(() => { load() }, [load])

  // Listen for delete events to refresh list
  useEffect(() => {
    const handler = () => load()
    window.addEventListener('league-deleted', handler)
    return () => window.removeEventListener('league-deleted', handler)
  }, [load])

  if (loading) return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[...Array(2)].map((_, i) => (
        <div key={i} style={{ borderRadius: 10, background: '#111', border: '1px solid #1F1F1F', padding: '12px 14px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span style={sk(50, 16, 5)} /><span style={sk('50%', 16, 5)} />
          </div>
          <span style={sk('70%', 12, 5)} />
        </div>
      ))}
    </div>
  )

  if (error) return (
    <div style={{ padding: '20px 16px', color: '#F87171', fontSize: 13 }}>{error}</div>
  )

  if (!leagues.length) return (
    <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.18)',
        fontSize: 28,
      }}>🏅</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#4B5563' }}>No hay ligas{game ? ` de ${game}` : ''}</div>
      {isStaff && (
        <button onClick={onCreateLeague} style={{
          marginTop: 8, padding: '10px 24px', borderRadius: 10, border: 'none',
          background: '#FFFFFF', color: '#111', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>Crear primera liga</button>
      )}
    </div>
  )

  return (
    <div style={{ paddingTop: 4, paddingBottom: 8 }}>
      {leagues.map((l, i) => (
        <LeagueCard
          key={l.id}
          league={l}
          profile={profile}
          isStaff={isStaff}
          onViewProfile={onViewProfile}
          index={i}
          defaultOpen={l.id === openLeagueId}
        />
      ))}
    </div>
  )
}

// ── Claims (staff) ───────────────────────────
function ClaimsTab({ isStaff }) {
  const [claims,  setClaims]  = useState([])
  const [loading, setLoading] = useState(true)
  const [busy,    setBusy]    = useState(null)
  const [error,   setError]   = useState('')

  useEffect(() => {
    getPendingClaims().then(setClaims).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const handleReview = async (id, status) => {
    setBusy(id); setError('')
    try {
      await reviewClaim(id, status)
      setClaims(c => c.filter(x => x.id !== id))
    } catch (e) {
      setError(e?.message || 'Error al procesar el claim. Intentá de nuevo.')
    }
    setBusy(null)
  }

  if (loading) return (
    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ borderRadius: 12, background: '#111', border: '1px solid #1F1F1F', padding: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={sk('60%', 13, 5)} />
            <span style={sk('40%', 11, 5)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <span style={sk(80, 30, 7)} />
              <span style={sk(80, 30, 7)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  if (!claims.length) return (
    <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.18)',
      }}>
        <svg width="24" height="24" viewBox="0 0 16 16" fill="#4ADE80" strokeWidth="0">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
        </svg>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#4B5563' }}>No hay claims pendientes</div>
    </div>
  )

  return (
    <div style={{ padding: '8px 16px' }}>
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13 }}>{error}</div>
      )}
      {claims.map(c => {
        const gs = c.game ? (GAME_STYLES[c.game] ?? GAME_STYLES['MTG']) : null
        const pts = PTS[c.position]
        return (
          <div key={c.id} style={{
            background: '#111111', borderRadius: 8,
            border: '1px solid #1F1F1F', padding: '14px 16px', marginBottom: 10,
          }}>
            {/* User + tournament */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#1F1F1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, overflow: 'hidden', flexShrink: 0 }}>
                <Avatar url={c.profiles?.avatar_url} size={34} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{c.profiles?.username}</div>
                <div style={{ fontSize: 11, color: '#4B5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.tournament_name || 'Torneo sin nombre'}
                </div>
                {/* Verified participant badge */}
                <div style={{ marginTop: 4 }}>
                  {c.verified_participant ? (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                      background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
                      color: '#4ADE80',
                    }}>✓ Inscripto al torneo</span>
                  ) : c.tournament_id ? (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                      background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
                      color: '#FBB724',
                    }}>⚠ No estaba inscripto</span>
                  ) : null}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}><RankIcon rank={c.position} size={18} /></div>
                <div style={{ fontSize: 10, color: '#A78BFA', fontWeight: 700 }}>+{pts}pts</div>
              </div>
            </div>

            {/* Game tag */}
            {gs && (
              <div style={{ marginBottom: 8 }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 6,
                  background: gs.bg, border: `1px solid ${gs.border}`,
                  color: gs.color, fontSize: 11, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}><GameIcon game={c.game} size={12} />{c.game}</span>
              </div>
            )}

            {c.notes && (
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10, lineHeight: 1.5, wordBreak: 'break-all' }}>{c.notes}</div>
            )}

            {isStaff && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleReview(c.id, 'approved')} disabled={busy === c.id} style={{
                  flex: 1, padding: '8px', borderRadius: 6, border: '1px solid rgba(74,222,128,0.3)',
                  background: 'rgba(74,222,128,0.08)', color: '#4ADE80',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>✓ Aprobar (+{pts}pts)</button>
                <button onClick={() => handleReview(c.id, 'rejected')} disabled={busy === c.id} style={{
                  flex: 1, padding: '8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.08)', color: '#F87171',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>✗ Rechazar</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main screen ──────────────────────────────
export default function RankingsScreen({ profile, isStaff, onReportClaim, onCreateTournament, onCreateLeague, onViewProfile, openTournamentId, openLeagueId }) {
  // Start on the right tab when arriving via a deep link
  const [tab,           setTab]          = useState(openTournamentId ? 'tournaments' : openLeagueId ? 'liga' : 'leaderboard')
  const [game,          setGame]         = useState(null)
  // Reset branch to Global when arriving via a league deep link so the card is always visible
  const [branch,        setBranch]       = useState(openLeagueId ? null : null)
  const [pulsing,       setPulsing]      = useState(true)  // pulse hint on first view
  const [activeSeason,  setActiveSeason] = useState(null)
  const pulseTimer = useRef(null)

  // Load active season once on mount
  useEffect(() => {
    getActiveSeason().then(setActiveSeason).catch(() => {})
  }, [])

  // Auto-stop pulsing after 3 s; restart brief pulse on tab change
  useEffect(() => {
    setPulsing(true)
    clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setPulsing(false), 3000)
    return () => clearTimeout(pulseTimer.current)
  }, [tab])

  const handlePlusClick = () => {
    setPulsing(false)
    clearTimeout(pulseTimer.current)
    if (tab === 'tournaments') onCreateTournament()
    else if (tab === 'liga') onCreateLeague?.()
    else onReportClaim()
  }

  const tabs = [
    { id: 'leaderboard', label: 'Rankings' },
    { id: 'tournaments', label: 'Torneos' },
    { id: 'liga',        label: 'Liga' },
  ]

  return (
    <div>
      {/* Tabs */}
      <div style={{ padding: '12px 20px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="filter-scroll" style={{ flex: 1, gap: 6 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '7px 14px', borderRadius: 8, flexShrink: 0,
              border: `1px solid ${tab === t.id ? 'rgba(255,255,255,0.3)' : '#2A2A2A'}`,
              background: tab === t.id ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: tab === t.id ? '#FFFFFF' : '#4B5563',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>{t.label}</button>
          ))}
        </div>
        {tab === 'leaderboard' || (tab === 'tournaments' && isStaff) || (tab === 'liga' && isStaff) ? (
          <button
            onClick={handlePlusClick}
            title={tab === 'tournaments' ? 'Crear torneo' : tab === 'liga' ? 'Crear liga' : 'Reportar resultado'}
            style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: 9,
              border: `1.5px solid ${pulsing ? 'rgba(167,139,250,0.6)' : '#2A2A2A'}`,
              background: pulsing ? 'rgba(167,139,250,0.1)' : 'transparent',
              color: pulsing ? '#A78BFA' : '#9CA3AF',
              fontSize: 22, fontWeight: 300,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
              animation: pulsing ? 'ringPulse 1.4s ease-out infinite' : 'none',
              transition: 'border-color 0.3s, background 0.3s, color 0.3s',
            }}>+</button>
        ) : null}
      </div>

      {/* Filters — game + branch */}
      {true && (
        <>
          <div style={{ padding: '8px 14px 0' }}>
            <div style={{
              background: '#111111', border: '1px solid #1E1E1E', borderRadius: 12,
              display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 6,
            }}>
              <button onClick={() => setGame(null)} style={{
                flex: 1, height: 34, borderRadius: 8,
                border: !game ? '1.5px solid rgba(255,255,255,0.35)' : '1.5px solid transparent',
                background: !game ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: !game ? '#FFFFFF' : '#4B5563',
                fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>ALL</button>
              <div style={{ width: 1, height: 20, background: '#2A2A2A', flexShrink: 0 }} />
              {GAMES.map(g => {
                const gs = GAME_STYLES[g]
                const active = game === g
                return (
                  <button key={g} onClick={() => setGame(active ? null : g)} title={g} style={{
                    flex: 1, height: 34, borderRadius: 8,
                    border: `1.5px solid ${active ? gs.border : 'transparent'}`,
                    background: active ? gs.bg : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.22s ease, border-color 0.22s ease, transform 0.15s ease, box-shadow 0.22s ease',
                    boxShadow: active ? `0 0 12px ${gs.border}66` : 'none',
                    transform: active ? 'scale(1.08)' : 'scale(1)',
                  }}>
                    <GameIcon game={g} size={18} />
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ padding: '6px 14px 4px' }}>
            <div style={{
              background: '#111111', border: '1px solid #1E1E1E', borderRadius: 12,
              display: 'flex', alignItems: 'center', padding: '6px 8px', gap: 4,
            }}>
              {['', ...BRANCHES].map(b => {
                const bStyle = b ? BRANCH_STYLES[b] : null
                const active = branch === (b || null)
                return (
                  <button key={b} onClick={() => setBranch(b || null)} style={{
                    flex: 1, height: 32, borderRadius: 8,
                    border: `1.5px solid ${active ? (bStyle?.border ?? 'rgba(255,255,255,0.35)') : 'transparent'}`,
                    background: active ? (bStyle?.bg ?? 'rgba(255,255,255,0.1)') : 'transparent',
                    color: active ? (bStyle?.color ?? '#FFFFFF') : '#4B5563',
                    fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    transition: 'background 0.22s ease, border-color 0.22s ease, color 0.22s ease, transform 0.15s ease, box-shadow 0.22s ease',
                    transform: active ? 'scale(1.04)' : 'scale(1)',
                    boxShadow: active && bStyle ? `0 0 12px ${bStyle.border}66` : 'none',
                  }}>
                    {bStyle && <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? bStyle.dot : '#374151', flexShrink: 0, transition: 'background 0.2s ease' }} />}
                    {b || 'Global'}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Season banner — compact version, only when a game is selected (empty state has its own full version) */}
      {tab === 'leaderboard' && game && <SeasonBanner season={activeSeason} />}

      {['leaderboard', 'tournaments', 'liga'].map(t => (
        <div key={t} style={{ display: t === tab ? 'block' : 'none' }}>
          {t === 'leaderboard' && <LeaderboardTab key={`${game}-${branch}`} branch={branch} game={game} isAdmin={profile?.role === 'admin'} activeSeason={activeSeason} onSelectBranch={setBranch} />}
          {t === 'tournaments' && <TournamentsTab game={game} branch={branch} onViewProfile={onViewProfile} isAdmin={profile?.role === 'admin'} openTournamentId={openTournamentId} />}
          {t === 'liga' && <LeagueTab key={`${game}-${branch}`} game={game} branch={branch} profile={profile} isStaff={isStaff} onViewProfile={onViewProfile} onCreateLeague={onCreateLeague} openLeagueId={openLeagueId} />}
        </div>
      ))}
    </div>
  )
}
