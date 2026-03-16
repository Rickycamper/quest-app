// ─────────────────────────────────────────────
// QUEST — RankingsScreen
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { getLeaderboard, getTournaments, getPendingClaims, reviewClaim, joinTournament, leaveTournament, adjustUserPoints } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { GAMES, GAME_STYLES, BRANCHES } from '../lib/constants'
// ClaimModal lives in App.jsx level — see src/screens/ClaimModal.jsx
import Avatar from '../components/Avatar'
import GameIcon from '../components/GameIcon'
import { PremiumBadge, OwnerBadge } from '../components/Icons'

const PTS = { 1: 3, 2: 2, 3: 1 }
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

function medal(rank) {
  return MEDALS[rank] ?? null
}

// ── Leaderboard ──────────────────────────────
function LeaderboardTab({ branch, game, isStaff }) {
  const [entries,    setEntries]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [editingId,  setEditingId]  = useState(null)
  const [delta,      setDelta]      = useState('')
  const [savingPts,  setSavingPts]  = useState(false)

  useEffect(() => {
    setLoading(true)
    getLeaderboard({ branch: branch || null, game: game || null })
      .then(setEntries)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [branch, game])

  const handleAdjust = async (userId, sign) => {
    const n = parseInt(delta)
    if (!n || n <= 0) return
    setSavingPts(true)
    try {
      const newPts = await adjustUserPoints(userId, sign * n)
      setEntries(prev => prev.map(e => e.id === userId ? { ...e, points: newPts } : e))
      setDelta('')
      setEditingId(null)
    } catch (e) { alert(e.message) }
    setSavingPts(false)
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
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
        const rank    = i + 1
        const m       = medal(rank)
        const editing = editingId === entry.id
        return (
          <div key={entry.id} style={{
            padding: '12px 20px',
            background: rank <= 3 ? 'rgba(255,255,255,0.02)' : 'transparent',
            borderBottom: '1px solid #111111',
            animation: 'fadeUp 0.3s ease both',
            animationDelay: `${i * 0.03}s`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
                {m
                  ? <span style={{ fontSize: 18 }}>{m}</span>
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
                <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                  @{entry.username}
                  {entry.verified && <span style={{ fontSize: 10, color: '#60A5FA' }}>✓</span>}
                  {entry.role === 'premium' && <PremiumBadge size={12} />}
                  {entry.is_owner && <OwnerBadge size={12} />}
                </div>
                {entry.branch && (
                  <div style={{ fontSize: 11, color: '#4B5563' }}>📍 {entry.branch}</div>
                )}
              </div>
              <div
                onClick={() => isStaff ? setEditingId(editing ? null : entry.id) : null}
                style={{
                  padding: '4px 12px', borderRadius: 8,
                  background: editing ? 'rgba(167,139,250,0.22)' : 'rgba(167,139,250,0.12)',
                  border: `1px solid ${editing ? 'rgba(167,139,250,0.5)' : 'rgba(167,139,250,0.25)'}`,
                  color: '#A78BFA', fontSize: 13, fontWeight: 800,
                  cursor: isStaff ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                }}>{entry.points}pts</div>
            </div>

            {/* Inline point adjuster — only for staff */}
            {editing && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingLeft: 40, animation: 'fadeUp 0.15s ease' }}>
                <input
                  type="number" min="1" placeholder="Puntos"
                  value={delta} onChange={e => setDelta(e.target.value)}
                  autoFocus
                  style={{
                    flex: 1, padding: '7px 10px', borderRadius: 8,
                    background: '#111', border: '1px solid #2A2A2A',
                    color: '#FFF', fontSize: 13, outline: 'none',
                    fontFamily: 'Inter, sans-serif',
                  }}
                />
                <button onClick={() => handleAdjust(entry.id, 1)} disabled={savingPts || !delta} style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none',
                  background: 'rgba(74,222,128,0.15)', color: '#4ADE80',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !delta ? 0.4 : 1,
                }}>+</button>
                <button onClick={() => handleAdjust(entry.id, -1)} disabled={savingPts || !delta} style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none',
                  background: 'rgba(239,68,68,0.15)', color: '#F87171',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !delta ? 0.4 : 1,
                }}>−</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Tournament Card (collapsible) ────────────
function TournamentCard({ t, index }) {
  const { profile } = useAuth()
  const [open,    setOpen]    = useState(false)
  const [joining, setJoining] = useState(false)

  const gs           = GAME_STYLES[t.game] ?? GAME_STYLES['MTG']
  const top3         = (t.tournament_results ?? []).sort((a, b) => a.position - b.position).slice(0, 3)
  const participants = t.tournament_participants ?? []
  const joinedCount  = participants.length
  const isJoined     = participants.some(p => p.user_id === profile?.id)
  const isPast       = new Date(t.date) < new Date(new Date().toDateString()) // date only comparison
  const isFull       = t.player_count > 0 && joinedCount >= t.player_count
  const dateStr      = new Date(t.date).toLocaleDateString('es', { day: '2-digit', month: 'short' })

  const handleJoin = async (e) => {
    e.stopPropagation()
    if (joining) return
    setJoining(true)
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
      alert(e.message || 'Error al actualizar inscripción')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div style={{
      margin: '0 16px 8px',
      background: '#111111', borderRadius: 10,
      border: `1px solid ${isJoined ? 'rgba(255,255,255,0.12)' : '#1F1F1F'}`,
      animation: 'fadeUp 0.3s ease both',
      animationDelay: `${index * 0.04}s`,
      overflow: 'hidden',
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
          <div style={{ fontSize: 11, color: '#4B5563', marginTop: 1 }}>
            {t.branch} · {joinedCount}/{t.player_count}p · {t.rounds}r
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

      {/* Expanded — top 3 results */}
      {open && top3.length > 0 && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid #1A1A1A', animation: 'fadeUp 0.2s ease' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', letterSpacing: '0.08em', padding: '10px 0 8px' }}>
            TOP 3
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {top3.map(r => (
              <div key={r.user_id} style={{
                flex: 1, padding: '8px 6px', borderRadius: 8,
                background: '#0A0A0A', border: '1px solid #1A1A1A', textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, marginBottom: 3 }}>{medal(r.position) || `#${r.position}`}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  @{r.profiles?.username}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {open && top3.length === 0 && (
        <div style={{ padding: '8px 14px 12px', borderTop: '1px solid #1A1A1A', fontSize: 12, color: '#374151' }}>
          Sin resultados registrados aún
        </div>
      )}
    </div>
  )
}

// ── Tournaments ──────────────────────────────
function TournamentsTab({ game, branch }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    setLoading(true)
    getTournaments({ game: game || null, branch: branch || null })
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [game, branch])

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
    </div>
  )

  if (error) return (
    <div style={{ margin: '16px 20px', padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13 }}>{error}</div>
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
      {items.map((t, i) => <TournamentCard key={t.id} t={t} index={i} />)}
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
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
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
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 18 }}>{MEDALS[c.position]}</div>
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
export default function RankingsScreen({ profile, isStaff, onReportClaim, onCreateTournament }) {
  const [tab,    setTab]    = useState('leaderboard')
  const [game,   setGame]   = useState(null)
  const [branch, setBranch] = useState(null)

  const tabs = [
    { id: 'leaderboard', label: 'Rankings' },
    { id: 'tournaments', label: 'Torneos' },
    ...(isStaff ? [{ id: 'claims', label: 'Claims' }] : []),
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
        {tab !== 'claims' && (
          <button
            onClick={tab === 'tournaments' ? onCreateTournament : onReportClaim}
            title={tab === 'tournaments' ? 'Crear torneo' : 'Reportar resultado'}
            style={{
              flexShrink: 0, width: 32, height: 32, borderRadius: 8,
              border: '1px solid #2A2A2A', background: 'transparent',
              color: '#9CA3AF', fontSize: 20, fontWeight: 300,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}>+</button>
        )}
      </div>

      {/* Filters — game + branch (shown on leaderboard & tournaments) */}
      {tab !== 'claims' && (
        <>
          <div className="filter-scroll" style={{ padding: '8px 20px 0' }}>
            {GAMES.map(g => {
              const gs = GAME_STYLES[g]
              const active = game === g
              return (
                <button key={g} onClick={() => setGame(active ? null : g)} style={{
                  padding: '5px 12px', borderRadius: 8, flexShrink: 0,
                  border: `1px solid ${active ? gs.border : '#2A2A2A'}`,
                  background: active ? gs.bg : 'transparent',
                  color: active ? gs.color : '#4B5563',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}><GameIcon game={g} size={12} />{g}</button>
              )
            })}
          </div>
          <div className="filter-scroll" style={{ padding: '6px 20px 4px' }}>
            {['', ...BRANCHES].map(b => (
              <button key={b} onClick={() => setBranch(b || null)} style={{
                padding: '5px 12px', borderRadius: 8, flexShrink: 0,
                border: `1px solid ${branch === (b || null) ? 'rgba(96,165,250,0.4)' : '#2A2A2A'}`,
                background: branch === (b || null) ? 'rgba(96,165,250,0.1)' : 'transparent',
                color: branch === (b || null) ? '#60A5FA' : '#4B5563',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>{b || 'Global'}</button>
            ))}
          </div>
        </>
      )}

      {tab === 'leaderboard' && <LeaderboardTab branch={branch} game={game} isStaff={isStaff} />}
      {tab === 'tournaments' && <TournamentsTab game={game} branch={branch} />}
      {tab === 'claims'      && <ClaimsTab isStaff={isStaff} />}
    </div>
  )
}
