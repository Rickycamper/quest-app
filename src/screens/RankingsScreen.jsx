// ─────────────────────────────────────────────
// QUEST — RankingsScreen
// ─────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { getLeaderboard, getTournaments, getPendingClaims, reviewClaim, joinTournament, leaveTournament, setUserPoints, rejectUserGameClaims, updateTournament } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { GAMES, GAME_STYLES, BRANCHES, BRANCH_STYLES } from '../lib/constants'
// ClaimModal lives in App.jsx level — see src/screens/ClaimModal.jsx
import Avatar from '../components/Avatar'
import GameIcon from '../components/GameIcon'
import { PremiumBadge, RoleBadge } from '../components/Icons'

const PTS = { 1: 3, 2: 2, 3: 1 }
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

function medal(rank) { return MEDALS[rank] ?? null }

// ── Skeleton shimmer helper ───────────────────
const sk = (w, h, r = 6) => ({
  width: w, height: h, borderRadius: r, flexShrink: 0, display: 'block',
  background: 'linear-gradient(90deg,#141414 25%,#222 50%,#141414 75%)',
  backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite linear',
})

// ── Leaderboard ──────────────────────────────
function LeaderboardTab({ branch, game, isAdmin }) {
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
      .catch(e => setError(e.message))
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

  // No TCG selected yet — Global means all branches, not all games
  if (!game) return (
    <div style={{ padding: '64px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 38, marginBottom: 14 }}>🎮</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#6B7280' }}>Selecciona un TCG</div>
      <div style={{ fontSize: 12, color: '#374151', marginTop: 6, lineHeight: 1.5 }}>
        Elige un juego arriba para ver el ranking{branch ? ` de ${branch}` : ' global'}
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
                  <RoleBadge isOwner={entry.is_owner} role={entry.role} size={12} />
                </div>
                {entry.branch && (
                  <div style={{ fontSize: 11, color: '#4B5563' }}>📍 {entry.branch}</div>
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

  const gs           = GAME_STYLES[t.game] ?? GAME_STYLES['MTG']
  const bs           = BRANCH_STYLES[t.branch] ?? { color: '#6B7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.25)', dot: '#6B7280' }
  const top3         = (t.tournament_results ?? []).sort((a, b) => a.position - b.position).slice(0, 3)
  const participants = t.tournament_participants ?? []
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
                    <div style={{ fontSize: 16, marginBottom: 3 }}>{medal(r.position) || `#${r.position}`}</div>
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

          {/* Admin — edit schedule */}
          {isAdmin && (
            <div style={{ padding: '10px 14px 12px', borderTop: '1px solid #161616', marginTop: 4 }}>
              {!editingSched ? (
                <button onClick={openEdit} style={{
                  fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8,
                  background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)',
                  color: '#A78BFA', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>✏️ Editar horario / cupos</button>
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
                      flex: 1, padding: '7px', borderRadius: 8, border: 'none',
                      background: 'rgba(74,222,128,0.12)', color: '#4ADE80',
                      fontSize: 12, fontWeight: 700, cursor: savingSched ? 'default' : 'pointer',
                      opacity: savingSched ? 0.5 : 1, fontFamily: 'Inter, sans-serif',
                    }}>{savingSched ? 'Guardando…' : '✓ Guardar'}</button>
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

  useEffect(() => {
    setLoading(true)
    getTournaments({ game: game || null, branch: branch || null })
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [game, branch])

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
export default function RankingsScreen({ profile, isStaff, onReportClaim, onCreateTournament, onViewProfile }) {
  const [tab,       setTab]      = useState('leaderboard')
  const [game,      setGame]     = useState(null)
  const [branch,    setBranch]   = useState(null)
  const [pulsing,   setPulsing]  = useState(true)  // pulse hint on first view
  const pulseTimer = useRef(null)

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
        {tab !== 'claims' && (tab !== 'tournaments' || isStaff) && (
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
            {['', ...BRANCHES].map(b => {
              const bStyle = b ? BRANCH_STYLES[b] : null
              const active = branch === (b || null)
              return (
                <button key={b} onClick={() => setBranch(b || null)} style={{
                  padding: '5px 12px', borderRadius: 8, flexShrink: 0,
                  border: `1px solid ${active ? (bStyle?.border ?? 'rgba(255,255,255,0.2)') : '#2A2A2A'}`,
                  background: active ? (bStyle?.bg ?? 'rgba(255,255,255,0.07)') : 'transparent',
                  color: active ? (bStyle?.color ?? '#FFFFFF') : '#4B5563',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  {bStyle && <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? bStyle.dot : '#374151', flexShrink: 0, transition: 'background 0.15s' }} />}
                  {b || 'Global'}
                </button>
              )
            })}
          </div>
        </>
      )}

      {['leaderboard', 'tournaments', 'claims'].map(t => (
        <div key={t} style={{ display: t === tab ? 'block' : 'none' }}>
          {t === 'leaderboard' && <LeaderboardTab branch={branch} game={game} isAdmin={profile?.role === 'admin'} />}
          {t === 'tournaments' && <TournamentsTab game={game} branch={branch} onViewProfile={onViewProfile} isAdmin={profile?.role === 'admin'} />}
          {t === 'claims'      && <ClaimsTab isStaff={isStaff} />}
        </div>
      ))}
    </div>
  )
}
