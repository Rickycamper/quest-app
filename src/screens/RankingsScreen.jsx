// ─────────────────────────────────────────────
// QUEST — RankingsScreen
// ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { getLeaderboard, getTournaments, getPendingClaims, reviewClaim, joinTournament, leaveTournament, setUserPoints, rejectUserGameClaims, updateTournament, searchUsers, inviteTournament, getActiveSeason } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { GAMES, GAME_STYLES, BRANCHES, BRANCH_STYLES } from '../lib/constants'
// ClaimModal lives in App.jsx level — see src/screens/ClaimModal.jsx
import Avatar from '../components/Avatar'
import GameIcon from '../components/GameIcon'
import { PremiumBadge, RoleBadge, MapPinIcon, SearchIcon } from '../components/Icons'

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
  // isTest: today is still within this season (before it ends)
  const isTest   = now <= end
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86_400_000))
  const pct      = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))

  // Next season start = day after this season ends
  const nextStart = (() => { const d = new Date(end); d.setDate(d.getDate() + 1); return d })()

  const accentColor = isTest ? '#FB923C' : '#F59E0B'
  const label       = isTest ? 'PRUEBA' : 'ACTIVA'
  const labelBg     = isTest ? 'rgba(251,146,60,0.12)' : 'rgba(74,222,128,0.12)'
  const labelBorder = isTest ? 'rgba(251,146,60,0.3)'  : 'rgba(74,222,128,0.25)'
  const labelColor  = isTest ? '#FB923C'               : '#4ADE80'
  const monthFmt    = (d) => (!d || isNaN(d)) ? '?' : d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
  const rangeStr    = `${monthFmt(start)} – ${monthFmt(end)}`

  return (
    <div style={{
      margin: '6px 14px 0',
      padding: '9px 12px',
      borderRadius: 12,
      background: `${accentColor}08`,
      border: `1px solid ${accentColor}22`,
      display: 'flex', flexDirection: 'column', gap: 6,
      animation: 'slideDown 0.22s cubic-bezier(0.34,1.3,0.64,1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Icon */}
        <svg width="13" height="13" viewBox="0 0 16 16" fill={accentColor} strokeWidth="0">
          {isTest
            ? <path d="M2 1.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-1v1a4.5 4.5 0 0 1-2.557 4.06c-.29.139-.443.377-.443.59v.7c0 .213.154.451.443.59A4.5 4.5 0 0 1 12.5 13v1h1a.5.5 0 0 1 0 1h-11a.5.5 0 1 1 0-1h1v-1a4.5 4.5 0 0 1 2.557-4.06c.29-.139.443-.377.443-.59v-.7c0-.213-.154-.451-.443-.59A4.5 4.5 0 0 1 3.5 3V2h-1a.5.5 0 0 1-.5-.5z"/>
            : <path d={HAND_MIDDLE_PATH} />
          }
        </svg>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: accentColor }}>
            {isTest ? 'Temporada de Prueba' : season.name}
          </span>
          <span style={{ fontSize: 10, color: '#4B5563', marginLeft: 6 }}>{rangeStr}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: daysLeft <= 7 ? '#F87171' : '#6B7280' }}>
            {daysLeft === 0 ? '¡hoy!' : `${daysLeft}d`}
          </span>
          <div style={{
            fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 5,
            background: labelBg, border: `1px solid ${labelBorder}`, color: labelColor, letterSpacing: '0.05em',
          }}>{label}</div>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: `${accentColor}60`, transition: 'width 0.6s ease' }} />
      </div>
      {/* Next season strip — only during test season, dates derived dynamically */}
      {isTest && nextStart && (
        <div style={{
          marginTop: 2,
          padding: '7px 10px',
          borderRadius: 8,
          background: 'rgba(245,158,11,0.07)',
          border: '1px solid rgba(245,158,11,0.2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="#F59E0B" strokeWidth="0">
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
          </svg>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#F59E0B' }}>
              Temporada 2 — comienza el {nextStart.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <div style={{ fontSize: 9, color: '#78716C', marginTop: 1 }}>Esos puntos sí cuentan para el Season Championship</div>
          </div>
        </div>
      )}
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

// ── Leaderboard ──────────────────────────────
function LeaderboardTab({ branch, game, isAdmin, activeSeason }) {
  const [showRules, setShowRules] = useState(false)
  const [entries,   setEntries]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  // Editing state — admin only, available in all tabs
  const [editingId, setEditingId] = useState(null)
  const [ptsVal,    setPtsVal]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [editErr,   setEditErr]   = useState('')

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
      if (n === 0 && game) {
        // Reject all approved claims for this user+game so they disappear from ranking
        await rejectUserGameClaims(userId, game)
        setEntries(prev => prev.filter(e => e.id !== userId))
      } else {
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

  // No TCG selected yet — show season info + rules
  if (!game) return (
    <div style={{ padding: '12px 14px 32px', display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeUp 0.25s ease' }}>

      {/* ── Season announcement — adapts to current season ── */}
      {(() => {
        const endStr    = safeDate(activeSeason?.end_date,   '2026-04-30')
        const startStr  = safeDate(activeSeason?.start_date, '2026-01-01')
        const endDate   = new Date(endStr   + 'T23:59:59')
        const startDate = new Date(startStr + 'T00:00:00')
        const now       = new Date()
        const daysLeft  = Math.max(0, Math.ceil((endDate - now) / 86_400_000))
        // isTest: still within S1 (today hasn't passed the end date)
        const isTest    = !activeSeason || now <= endDate
        // Derive next season dates: starts the day after current ends, lasts 4 months
        const nextStart = isNaN(endDate) ? null : (() => { const d = new Date(endDate); d.setDate(d.getDate() + 1); return d })()
        const fmt = (d, opts) => (!d || isNaN(d)) ? '?' : d.toLocaleDateString('es', opts)
        const endFmt  = fmt(endDate,  { day: 'numeric', month: 'long', year: 'numeric' })
        const nextFmt = nextStart ? fmt(nextStart, { day: 'numeric', month: 'long', year: 'numeric' }) : '?'

        if (isTest) {
          // S1 still active — show "ending soon + next season coming" card
          return (
            <div style={{
              borderRadius: 14, overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(251,146,60,0.10) 0%, rgba(245,158,11,0.05) 100%)',
              border: '1px solid rgba(251,146,60,0.25)',
            }}>
              <div style={{
                padding: '10px 14px 8px',
                borderBottom: '1px solid rgba(251,146,60,0.12)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                {/* Hourglass SVG */}
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="#FB923C" strokeWidth="0">
                    <path d="M2 1.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-1v1a4.5 4.5 0 0 1-2.557 4.06c-.29.139-.443.377-.443.59v.7c0 .213.154.451.443.59A4.5 4.5 0 0 1 12.5 13v1h1a.5.5 0 0 1 0 1h-11a.5.5 0 1 1 0-1h1v-1a4.5 4.5 0 0 1 2.557-4.06c.29-.139.443-.377.443-.59v-.7c0-.213-.154-.451-.443-.59A4.5 4.5 0 0 1 3.5 3V2h-1a.5.5 0 0 1-.5-.5z"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#FB923C', letterSpacing: '-0.01em' }}>
                    Temporada de Prueba — en curso
                  </div>
                  <div style={{ fontSize: 10, color: '#78716C', marginTop: 1 }}>
                    Termina el {endFmt} · {daysLeft}d restantes
                  </div>
                </div>
                <div style={{
                  fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                  background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.3)',
                  color: '#FB923C', letterSpacing: '0.05em', flexShrink: 0,
                }}>PRUEBA</div>
              </div>
              <div style={{ padding: '10px 14px 0' }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#D1D5DB', lineHeight: 1.55 }}>
                  Estamos en la temporada de prueba. Los puntos de esta temporada <strong style={{ color: '#FB923C' }}>no cuentan para el ranking final</strong> — es para que todos aprendan cómo funciona el sistema.
                </p>
              </div>
              {/* Next season coming soon strip */}
              {nextStart && (
                <div style={{
                  margin: '0 14px 12px',
                  padding: '9px 12px',
                  borderRadius: 10,
                  background: 'rgba(245,158,11,0.07)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="#F59E0B" strokeWidth="0">
                    <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                  </svg>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#F59E0B' }}>Temporada 2 oficial — comienza el {nextFmt}</span>
                    <div style={{ fontSize: 10, color: '#78716C', marginTop: 1 }}>Esos puntos sí cuentan para el Season Championship</div>
                  </div>
                </div>
              )}
            </div>
          )
        }

        // S2+ active — show official season card
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
                  {fmt(startDate, { day: 'numeric', month: 'long' })} – {fmt(endDate, { day: 'numeric', month: 'long', year: 'numeric' })} · {daysLeft}d restantes
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
                La temporada de prueba terminó. La <strong style={{ color: '#F59E0B' }}>{activeSeason?.name ?? 'Temporada 2'} es oficial</strong> — los puntos que acumules <strong style={{ color: '#FFFFFF' }}>cuentan para el ranking final</strong> y el Season Championship.
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

  if (!entries.length) return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
      <div style={{ fontSize: 15, color: '#4B5563' }}>No hay rankings aún</div>
      <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>Reporta tus resultados de torneo para aparecer aquí</div>
    </div>
  )

  return (
    <div style={{ padding: '8px 0' }}>
      {entries.map((entry, i) => {
        const rank = i + 1
        const m    = medal(rank)
        return (
          <div key={entry.id} style={{
            padding: '12px 20px',
            background: rank <= 3 ? 'rgba(255,255,255,0.02)' : 'transparent',
            borderBottom: '1px solid #111111',
            animation: 'fadeUp 0.3s ease both',
            animationDelay: `${i * 0.03}s`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 28, textAlign: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {m
                  ? <RankIcon rank={rank} size={18} />
                  : <span style={{ fontSize: 13, fontWeight: 700, color: '#4B5563' }}>#{rank}</span>
                }
              </div>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: '#1F1F1F', border: '1.5px solid #2A2A2A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0, overflow: 'hidden',
              }}><Avatar url={entry.avatar_url} size={34} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  @{entry.username}
                  {entry.verified && <span style={{ fontSize: 10, color: '#60A5FA' }}>✓</span>}
                  {entry.role === 'premium' && <PremiumBadge size={12} />}
                  <RoleBadge isOwner={entry.is_owner} role={entry.role} size={12} />
                  <SeasonBadgePill badges={entry.season_badges} game={game} branch={branch} />
                </div>
                {entry.branch && (
                  <div style={{ fontSize: 11, color: BRANCH_STYLES[entry.branch]?.color ?? '#4B5563', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <MapPinIcon size={10} color={BRANCH_STYLES[entry.branch]?.color ?? '#4B5563'} />
                    {entry.branch}
                  </div>
                )}
              </div>
              <div
                onClick={() => canEdit && !editingId ? openEdit(entry) : null}
                style={{
                  padding: '4px 12px', borderRadius: 8,
                  background: editingId === entry.id ? 'rgba(167,139,250,0.22)' : 'rgba(167,139,250,0.12)',
                  border: `1px solid ${editingId === entry.id ? 'rgba(167,139,250,0.5)' : 'rgba(167,139,250,0.25)'}`,
                  color: '#A78BFA', fontSize: 13, fontWeight: 800,
                  cursor: canEdit ? 'pointer' : 'default',
                  transition: 'all 0.15s',
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

// ── Tournament Card (collapsible) ────────────
function TournamentCard({ t, index, onViewProfile, isAdmin }) {
  const { profile } = useAuth()
  const [open,    setOpen]    = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinErr, setJoinErr] = useState('')

  // Editable local state (updated after admin saves)
  const [curDate,  setCurDate]  = useState(t.date)
  const [curTime,  setCurTime]  = useState(t.start_time?.slice(0, 5) ?? '')
  const [curCount, setCurCount] = useState(t.player_count)

  // Edit mode state
  const [editingSched, setEditingSched] = useState(false)
  const [editDate,     setEditDate]     = useState('')
  const [editTime,     setEditTime]     = useState('')
  const [editCount,    setEditCount]    = useState('')
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
    setSchedErr('')
    setEditingSched(true)
  }

  const saveSchedule = async () => {
    if (!editDate) { setSchedErr('Fecha requerida'); return }
    if (!editCount || isNaN(editCount) || +editCount < 2) { setSchedErr('Jugadores debe ser ≥ 2'); return }
    setSavingSched(true); setSchedErr('')
    try {
      await updateTournament(t.id, { date: editDate, startTime: editTime || null, playerCount: parseInt(editCount) })
      setCurDate(editDate)
      setCurTime(editTime)
      setCurCount(parseInt(editCount))
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
      } else {
        await joinTournament(t.id)
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
    } finally {
      setJoining(false)
    }
  }

  return (
    <div style={{
      margin: '0 16px 8px',
      background: '#111111', borderRadius: 10,
      border: `1px solid ${isJoined ? bs.border : '#1F1F1F'}`,
      animation: 'fadeUp 0.3s ease both',
      animationDelay: `${index * 0.04}s`,
      overflow: 'hidden',
      // Left accent bar using branch color
      borderLeft: `3px solid ${bs.dot}`,
    }}>
      {/* Collapsed row — always visible */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
      >
        {/* Game icon */}
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: gs.bg, border: `1px solid ${gs.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <GameIcon game={t.game} size={16} />
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
            {/* Branch pill */}
            <span style={{
              fontSize: 10, fontWeight: 700, fontFamily: 'Inter, sans-serif',
              padding: '2px 7px', borderRadius: 6,
              background: bs.bg, border: `1px solid ${bs.border}`, color: bs.color,
            }}>{t.branch}</span>
            <span style={{ fontSize: 10, color: '#374151' }}>·</span>
            <span style={{ fontSize: 10, color: '#4B5563' }}>{joinedCount}/{curCount}p</span>
            {timeStr && <><span style={{ fontSize: 10, color: '#374151' }}>·</span><span style={{ fontSize: 10, color: '#4B5563' }}>🕐 {timeStr}</span></>}
          </div>
        </div>

        {/* Join button + date + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!isPast && (
            <button
              onClick={handleJoin}
              disabled={joining || (!isJoined && isFull)}
              style={{
                fontSize: 11, fontWeight: 700,
                padding: '4px 10px', borderRadius: 20,
                border: isJoined ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.15)',
                background: isJoined ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: isJoined ? '#E5E5E5' : '#9CA3AF',
                cursor: (joining || (!isJoined && isFull)) ? 'default' : 'pointer',
                opacity: joining ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              {joining ? '…' : isJoined ? '✓ Inscripto' : isFull ? 'Lleno' : 'Unirse'}
            </button>
          )}
          <span style={{ fontSize: 11, color: '#374151' }}>{dateStr}</span>
          <span style={{
            fontSize: 10, color: '#374151',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s', display: 'inline-block',
          }}>▼</span>
        </div>
      </div>

      {joinErr && (
        <div style={{ padding: '6px 14px', fontSize: 12, color: '#F87171', background: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.15)' }}>
          {joinErr}
        </div>
      )}

      {/* Expanded — participants + top 3 results */}
      {open && (
        <div style={{ borderTop: '1px solid #1A1A1A', animation: 'fadeUp 0.2s ease' }}>

          {/* Participants list */}
          <div style={{ padding: '10px 14px 0' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              INSCRIPTOS
              <span style={{ background: 'rgba(255,255,255,0.07)', color: '#6B7280', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>
                {joinedCount}/{curCount}
              </span>
            </div>

            {participants.length === 0 ? (
              <div style={{ fontSize: 12, color: '#374151', paddingBottom: 10 }}>Nadie inscripto aún</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {participants.map((p, idx) => {
                  const prof = p.profiles
                  if (!prof) return null
                  const playerMedal = top3.find(r => r.user_id === p.user_id)
                  return (
                    <div
                      key={p.user_id}
                      onClick={() => onViewProfile?.(p.user_id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '7px 0',
                        borderBottom: idx < participants.length - 1 ? '1px solid #161616' : 'none',
                        cursor: onViewProfile ? 'pointer' : 'default',
                        borderRadius: 8,
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { if (onViewProfile) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: '#1F1F1F', border: '1px solid #2A2A2A',
                        overflow: 'hidden', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12,
                      }}>
                        <Avatar url={prof.avatar_url} size={28} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#D1D5DB', fontFamily: 'Inter, sans-serif', flex: 1 }}>
                        @{prof.username}
                      </span>
                      {playerMedal && (
                        <span style={{ fontSize: 14 }}>
                          {medal(playerMedal.position)}
                        </span>
                      )}
                      {onViewProfile && (
                        <span style={{ fontSize: 11, color: '#374151', marginLeft: playerMedal ? 4 : 'auto' }}>›</span>
                      )}
                    </div>
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
                      @{r.profiles?.username}
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
                            @{user.username}
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
    </div>
  )
}

// ── Tournaments ──────────────────────────────
function TournamentsTab({ game, branch, onViewProfile, isAdmin }) {
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
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>🎮</div>
      <div style={{ fontSize: 14, color: '#4B5563' }}>No hay torneos registrados</div>
      <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>Tocá + para reportar tu resultado</div>
    </div>
  )

  return (
    <div style={{ padding: '8px 0' }}>
      {items.map((t, i) => <TournamentCard key={t.id} t={t} index={i} onViewProfile={onViewProfile} isAdmin={isAdmin} />)}
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
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 15, color: '#4B5563' }}>No hay claims pendientes</div>
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
                <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>@{c.profiles?.username}</div>
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
export default function RankingsScreen({ profile, isStaff, onReportClaim, onCreateTournament, onViewProfile }) {
  const [tab,           setTab]          = useState('leaderboard')
  const [game,          setGame]         = useState(null)
  const [branch,        setBranch]       = useState(null)
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
    else onReportClaim()
  }

  const tabs = [
    { id: 'leaderboard', label: 'Rankings' },
    { id: 'tournaments', label: 'Torneos' },
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
        {tab === 'leaderboard' || (tab === 'tournaments' && isStaff) ? (
          <button
            onClick={handlePlusClick}
            title={tab === 'tournaments' ? 'Crear torneo' : 'Reportar resultado'}
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
                    transition: 'background 0.22s ease, border-color 0.22s ease, color 0.22s ease, transform 0.15s ease',
                    transform: active ? 'scale(1.04)' : 'scale(1)',
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

      {['leaderboard', 'tournaments'].map(t => (
        <div key={t} style={{ display: t === tab ? 'block' : 'none' }}>
          {t === 'leaderboard' && <LeaderboardTab key={`${game}-${branch}`} branch={branch} game={game} isAdmin={profile?.role === 'admin'} activeSeason={activeSeason} />}
          {t === 'tournaments' && <TournamentsTab game={game} branch={branch} onViewProfile={onViewProfile} isAdmin={profile?.role === 'admin'} />}
        </div>
      ))}
    </div>
  )
}
