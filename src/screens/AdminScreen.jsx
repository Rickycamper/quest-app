// ─────────────────────────────────────────────
// QUEST — AdminScreen
// Staff/Admin panel: review & approve claims
// ─────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react'
import { getPendingClaims, reviewClaim, getAdminUsers, setUserPremium, getPendingArrivalPackages, confirmPackageArrival, rejectPackageArrival, updatePackageStatus, getTournaments, deleteTournament, setUserPoints, getPackageStats } from '../lib/supabase'
import { GAME_STYLES } from '../lib/constants'
import Avatar from '../components/Avatar'
import GameIcon from '../components/GameIcon'

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }
const PTS    = { 1: 3, 2: 2, 3: 1 }

function ClaimCard({ claim, onReviewed }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null) // 'approved' | 'rejected'
  const gs = GAME_STYLES[claim.game] ?? GAME_STYLES['MTG']

  const handle = async (status) => {
    setBusy(true)
    try {
      await reviewClaim(claim.id, status)
      setDone(status)
      setTimeout(() => onReviewed(claim.id), 800)
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setBusy(false)
  }

  return (
    <div style={{
      background: '#111', border: '1px solid #1F1F1F', borderRadius: 12,
      padding: '14px 16px', marginBottom: 10,
      opacity: done ? 0.5 : 1, transition: 'opacity 0.3s',
    }}>
      {/* User row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: '#1F1F1F', overflow: 'hidden', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Avatar url={claim.profiles?.avatar_url} size={36} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF' }}>
            {claim.profiles?.username ?? 'Usuario'}
          </div>
          <div style={{ fontSize: 11, color: '#4B5563' }}>
            {new Date(claim.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
        {/* Status badge if already reviewed */}
        {done && (
          <div style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
            background: done === 'approved' ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
            color: done === 'approved' ? '#4ADE80' : '#F87171',
          }}>
            {done === 'approved' ? '✓ Aprobado' : '✗ Rechazado'}
          </div>
        )}
      </div>

      {/* Claim details */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {/* Tournament */}
        <div style={{
          flex: 1, minWidth: 0,
          background: '#0A0A0A', borderRadius: 8, padding: '8px 10px',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#4B5563', letterSpacing: '0.06em', marginBottom: 2 }}>TORNEO</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {claim.tournament_name ?? '—'}
          </div>
        </div>

        {/* Position */}
        <div style={{
          background: '#0A0A0A', borderRadius: 8, padding: '8px 12px', textAlign: 'center', flexShrink: 0,
        }}>
          <div style={{ fontSize: 18 }}>{MEDALS[claim.position] ?? '🏅'}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA', marginTop: 1 }}>+{PTS[claim.position] ?? 1} pts</div>
        </div>
      </div>

      {/* Tags row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: claim.notes ? 8 : 12, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
          background: gs.bg, color: gs.color, border: `1px solid ${gs.border}`,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}><GameIcon game={claim.game} size={12} />{claim.game}</span>
        {claim.branch && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
            background: 'rgba(255,255,255,0.06)', color: '#9CA3AF',
          }}>📍 {claim.branch}</span>
        )}
        {/* Participant verification badge */}
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
          background: claim.verified_participant ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
          color: claim.verified_participant ? '#4ADE80' : '#FCD34D',
          border: `1px solid ${claim.verified_participant ? 'rgba(74,222,128,0.25)' : 'rgba(251,191,36,0.25)'}`,
        }}>
          {claim.verified_participant ? '✓ Participante verificado' : '⚠ No se inscribió'}
        </span>
      </div>

      {/* Evidence */}
      {claim.notes && (
        <div style={{
          fontSize: 12, color: '#6B7280', marginBottom: 12,
          padding: '6px 10px', background: '#0A0A0A', borderRadius: 8,
          wordBreak: 'break-all',
        }}>
          🔗 {claim.notes}
        </div>
      )}

      {/* Action buttons */}
      {!done && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => handle('rejected')} disabled={busy} style={{
            flex: 1, padding: '10px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.08)', color: '#F87171',
            fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>
            ✗ Rechazar
          </button>
          <button onClick={() => handle('approved')} disabled={busy} style={{
            flex: 1, padding: '10px', borderRadius: 9, border: 'none',
            background: busy ? '#1A1A1A' : '#4ADE80',
            color: busy ? '#555' : '#000',
            fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>
            ✓ Aprobar
          </button>
        </div>
      )}
    </div>
  )
}

// ── User card for the Usuarios tab ─────────────
function UserCard({ user, onToggle, onPointsChange }) {
  const [busy,      setBusy]      = useState(false)
  const [editPts,   setEditPts]   = useState(false)
  const [ptsVal,    setPtsVal]    = useState(String(user.points ?? 0))
  const [ptsBusy,   setPtsBusy]   = useState(false)
  const isPremium = user.role === 'premium'
  const isStaff   = user.role === 'staff' || user.role === 'admin'

  const handleToggle = async () => {
    if (isStaff) return
    setBusy(true)
    try {
      await setUserPremium(user.id, !isPremium)
      onToggle(user.id, !isPremium)
    } catch (e) { alert('Error: ' + e.message) }
    setBusy(false)
  }

  const openEdit = () => {
    setPtsVal(String(user.points ?? 0))
    setEditPts(true)
  }

  const savePts = async () => {
    const n = Math.max(0, Math.round(Number(ptsVal) || 0))
    if (n === (user.points ?? 0)) { setEditPts(false); return }
    setPtsBusy(true)
    try {
      await setUserPoints(user.id, n)
      onPointsChange(user.id, n)
      setEditPts(false)
    } catch (e) { alert('Error: ' + e.message) }
    setPtsBusy(false)
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #1A1A1A' }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1F1F1F', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Avatar url={user.avatar_url} size={36} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.username}
          </div>
          <div style={{ fontSize: 11, color: '#4B5563', marginTop: 1 }}>
            {isStaff ? 'Staff' : isPremium ? 'Premium' : 'Free'} · <span style={{ color: '#A78BFA' }}>{user.points ?? 0} pts</span>
          </div>
        </div>
        {/* Points edit button */}
        <button onClick={openEdit} style={{
          padding: '5px 9px', borderRadius: 7,
          border: '1px solid #2A2A2A', background: 'rgba(167,139,250,0.08)',
          color: '#A78BFA', fontSize: 11, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0,
        }}>✏️ pts</button>
        {!isStaff && (
          <button onClick={handleToggle} disabled={busy} style={{
            padding: '6px 12px', borderRadius: 8,
            border: `1px solid ${isPremium ? 'rgba(167,139,250,0.3)' : '#2A2A2A'}`,
            background: isPremium ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.06)',
            color: isPremium ? '#A78BFA' : '#6B7280',
            fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
            fontFamily: 'Inter, sans-serif', flexShrink: 0,
          }}>
            {busy ? '...' : isPremium ? '★ Premium' : 'Activar'}
          </button>
        )}
      </div>
      {/* Inline points editor */}
      {editPts && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <input
            type="number" min="0"
            value={ptsVal}
            onChange={e => setPtsVal(e.target.value)}
            onFocus={e => e.target.select()}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: 8,
              background: '#1A1A1F', border: '1px solid #A78BFA44',
              color: '#FFF', fontSize: 13, outline: 'none',
              fontFamily: 'Inter, sans-serif',
            }}
          />
          <button onClick={savePts} disabled={ptsBusy} style={{
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: ptsBusy ? '#2A2A2A' : '#A78BFA',
            color: '#111', fontSize: 12, fontWeight: 800,
            cursor: ptsBusy ? 'default' : 'pointer', flexShrink: 0,
          }}>{ptsBusy ? '…' : '✓'}</button>
          <button onClick={() => setEditPts(false)} style={{
            padding: '7px 10px', borderRadius: 8,
            border: '1px solid #2A2A2A', background: 'none',
            color: '#6B7280', fontSize: 12, cursor: 'pointer', flexShrink: 0,
          }}>✕</button>
        </div>
      )}
    </div>
  )
}

// ── Users tab ────────────────────────────────
function UsersTab() {
  const [users,   setUsers]   = useState([])
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const searchTimer = useRef(null)
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const load = useCallback((q = query) => {
    setLoading(true); setError('')
    getAdminUsers(q)
      .then(setUsers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [query])

  useEffect(() => { load('') }, [])

  const handleSearch = (e) => {
    const v = e.target.value
    setQuery(v)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(v), 400)
  }

  const handleToggle = (userId, nowPremium) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: nowPremium ? 'premium' : 'client' } : u))
  }

  const handlePointsChange = (userId, newPoints) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, points: newPoints } : u))
  }

  return (
    <div>
      <input
        value={query} onChange={handleSearch}
        placeholder="Buscar usuario..."
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: '#111', border: '1px solid #222',
          color: '#FFF', fontSize: 13, outline: 'none',
          fontFamily: 'Inter, sans-serif', marginBottom: 12,
        }}
      />
      {loading && (
        <div style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
        </div>
      )}
      {error && <div style={{ color: '#F87171', fontSize: 13 }}>{error}</div>}
      {!loading && users.map(u => (
        <UserCard key={u.id} user={u} onToggle={handleToggle} onPointsChange={handlePointsChange} />
      ))}
      {!loading && users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#4B5563', fontSize: 13 }}>Sin resultados</div>
      )}
    </div>
  )
}

// ── Pending arrival card ──────────────────────
function ArrivalCard({ pkg, onConfirmed, onRejected }) {
  const [busy,      setBusy]      = useState(false)
  const [done,      setDone]      = useState(null) // 'confirmed' | 'rejected'
  const [notes,     setNotes]     = useState('')
  const [showNotes, setShowNotes] = useState(false)

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await confirmPackageArrival(pkg.id, notes.trim() || '')
      setDone('confirmed')
      setTimeout(() => onConfirmed(pkg.id), 800)
    } catch (e) { alert('Error: ' + e.message) }
    setBusy(false)
  }

  const handleReject = async () => {
    setBusy(true)
    try {
      await rejectPackageArrival(pkg.id, notes.trim() || '')
      setDone('rejected')
      setTimeout(() => onRejected(pkg.id), 800)
    } catch (e) { alert('Error: ' + e.message) }
    setBusy(false)
  }

  return (
    <div style={{
      background: '#111', borderRadius: 12, padding: '14px 16px', marginBottom: 10,
      border: done === 'confirmed' ? '1px solid rgba(74,222,128,0.3)'
            : done === 'rejected'  ? '1px solid rgba(239,68,68,0.3)'
            : '1px solid rgba(245,158,11,0.25)',
      opacity: done ? 0.5 : 1, transition: 'opacity 0.3s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>📦</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#F59E0B' }}>
            #{pkg.tracking_code}
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
            {pkg.origin_branch} → {pkg.destination_branch}
          </div>
        </div>
        {done && (
          <div style={{
            fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
            background: done === 'confirmed' ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
            color: done === 'confirmed' ? '#4ADE80' : '#F87171',
          }}>
            {done === 'confirmed' ? '✓ Confirmado' : '✗ Rechazado'}
          </div>
        )}
      </div>

      {/* Users */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 12,
        padding: '8px 10px', background: '#0A0A0A', borderRadius: 8,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#4B5563', letterSpacing: '0.06em', marginBottom: 2 }}>REMITENTE</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}>@{pkg.sender?.username ?? '—'}</div>
        </div>
        <div style={{ width: 1, background: '#1A1A1A' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#4B5563', letterSpacing: '0.06em', marginBottom: 2 }}>DESTINATARIO</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}>@{pkg.recipient?.username ?? '—'}</div>
        </div>
      </div>

      {/* Actions */}
      {!done && (
        showNotes ? (
          <div>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Nota opcional..."
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8, marginBottom: 8,
                background: '#0A0A0A', border: '1px solid #2A2A2A',
                color: '#FFF', fontSize: 12, fontFamily: 'Inter, sans-serif',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowNotes(false)} style={{
                flex: 1, padding: '10px', borderRadius: 9,
                border: '1px solid #2A2A2A', background: 'transparent',
                color: '#6B7280', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>Cancelar</button>
              <button onClick={handleReject} disabled={busy} style={{
                flex: 1, padding: '10px', borderRadius: 9,
                border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
                color: '#F87171', fontSize: 12, fontWeight: 700,
                cursor: busy ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
              }}>✗ Rechazar</button>
              <button onClick={handleConfirm} disabled={busy} style={{
                flex: 1, padding: '10px', borderRadius: 9,
                border: 'none', background: busy ? '#1A1A1A' : '#4ADE80',
                color: busy ? '#555' : '#000', fontSize: 12, fontWeight: 700,
                cursor: busy ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
              }}>✓ Confirmar</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowNotes(true)} style={{
              flex: 1, padding: '10px', borderRadius: 9,
              border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
              color: '#F87171', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>✗ Rechazar</button>
            <button onClick={handleConfirm} disabled={busy} style={{
              flex: 2, padding: '10px', borderRadius: 9,
              border: 'none', background: busy ? '#1A1A1A' : '#4ADE80',
              color: busy ? '#555' : '#000', fontSize: 13, fontWeight: 700,
              cursor: busy ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
            }}>
              {busy ? '...' : '✓ Confirmar llegada'}
            </button>
          </div>
        )
      )}
    </div>
  )
}

// ── Packages tab ──────────────────────────────
function PackagesTab() {
  const [packages, setPackages] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const load = () => {
    setLoading(true); setError('')
    getPendingArrivalPackages()
      .then(setPackages)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleConfirmed = (id) => setPackages(prev => prev.filter(p => p.id !== id))
  const handleRejected  = (id) => setPackages(prev => prev.filter(p => p.id !== id))

  return (
    <div>
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
        </div>
      )}
      {error && <div style={{ color: '#F87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {!loading && !error && packages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <div style={{ fontSize: 15, color: '#4B5563', fontWeight: 600 }}>Sin paquetes pendientes</div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>No hay llegadas por confirmar</div>
        </div>
      )}
      {packages.map(pkg => (
        <ArrivalCard key={pkg.id} pkg={pkg} onConfirmed={handleConfirmed} onRejected={handleRejected} />
      ))}
    </div>
  )
}

// ── Tournaments admin tab ──────────────────────
function TournamentsAdminTab() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null) // id to confirm delete

  useEffect(() => {
    getTournaments()
      .then(setItems)
      .catch(e => alert(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id) => {
    if (confirm !== id) { setConfirm(id); return }
    setConfirm(null)
    try {
      await deleteTournament(id)
      setItems(prev => prev.filter(t => t.id !== id))
    } catch (e) { alert('Error: ' + e.message) }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 30 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
    </div>
  )
  if (!items.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>🎮</div>
      <div style={{ fontSize: 14, color: '#4B5563' }}>No hay torneos</div>
    </div>
  )

  return (
    <div>
      {items.map(t => {
        const dateStr  = new Date(t.date).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })
        const isDel    = confirm === t.id
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 0', borderBottom: '1px solid #1A1A1A',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.name}
              </div>
              <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>
                {t.branch} · {t.game} · {dateStr} · {t.player_count}p
              </div>
            </div>
            <button
              onClick={() => handleDelete(t.id)}
              style={{
                padding: '5px 10px', borderRadius: 8, border: 'none', flexShrink: 0,
                background: isDel ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                color: isDel ? '#F87171' : '#4B5563',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
              }}
            >{isDel ? 'Confirmar' : '✕'}</button>
          </div>
        )
      })}
    </div>
  )
}

// ── Shipping stats tab ─────────────────────────
function StatsTab() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [months,  setMonths]  = useState(6)

  useEffect(() => {
    setLoading(true); setError('')
    getPackageStats(months)
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [months])

  // Group by "YYYY-MM" label
  const grouped = rows.reduce((acc, r) => {
    const d     = new Date(r.delivered_at)
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es', { month: 'long', year: 'numeric' })
    if (!acc[key]) acc[key] = { label, total: 0, routes: {} }
    acc[key].total += 1
    const route = `${r.origin_branch} → ${r.dest_branch}`
    acc[key].routes[route] = (acc[key].routes[route] ?? 0) + 1
    return acc
  }, {})

  const sortedKeys = Object.keys(grouped).sort().reverse()
  const totalAll   = rows.length

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[3, 6, 12].map(m => (
          <button key={m} onClick={() => setMonths(m)} style={{
            padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: months === m ? '#FFF' : 'rgba(255,255,255,0.06)',
            color:      months === m ? '#111' : '#6B7280',
            fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
          }}>{m} meses</button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#4B5563', alignSelf: 'center' }}>
          Total: <span style={{ color: '#FFF', fontWeight: 700 }}>{totalAll}</span>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
        </div>
      )}
      {error && <div style={{ color: '#F87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {!loading && !error && sortedKeys.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
          <div style={{ fontSize: 14, color: '#4B5563' }}>Sin envíos en este período</div>
        </div>
      )}

      {!loading && sortedKeys.map(key => {
        const { label, total, routes } = grouped[key]
        return (
          <div key={key} style={{
            background: '#111', border: '1px solid #1F1F1F',
            borderRadius: 12, padding: '12px 14px', marginBottom: 10,
          }}>
            {/* Month header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', textTransform: 'capitalize' }}>
                {label}
              </div>
              <div style={{
                background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 8, padding: '2px 10px', fontSize: 13, fontWeight: 800, color: '#F59E0B',
              }}>
                {total} envío{total !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Per-route breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(routes).sort((a, b) => b[1] - a[1]).map(([route, count]) => (
                <div key={route} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '5px 8px', background: '#0A0A0A', borderRadius: 7,
                }}>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>{route}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AdminScreen({ onClose }) {
  const [tab,     setTab]     = useState('claims')
  const [claims,  setClaims]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    getPendingClaims()
      .then(setClaims)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleReviewed = (id) => {
    setClaims(prev => prev.filter(c => c.id !== id))
  }

  const tabStyle = (t) => ({
    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
    background: tab === t ? '#1F1F1F' : 'transparent',
    color: tab === t ? '#FFF' : '#4B5563',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
  })

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: '#0A0A0A',
      display: 'flex', flexDirection: 'column',
      animation: 'slideUp 0.22s ease',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '18px 18px 14px',
        borderBottom: '1px solid #1A1A1A',
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6B7280', fontSize: 20, padding: '0 4px 0 0', lineHeight: 1,
        }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#FFF' }}>Panel Admin</span>
        {tab === 'claims' && claims.length > 0 && (
          <div style={{
            marginLeft: 'auto', background: '#EF4444', color: '#FFF',
            borderRadius: 10, fontSize: 11, fontWeight: 800,
            padding: '2px 8px', minWidth: 22, textAlign: 'center',
          }}>{claims.length}</div>
        )}
        {tab === 'claims' && (
          <button onClick={load} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#4B5563', fontSize: 16, marginLeft: claims.length > 0 ? 0 : 'auto',
          }}>🔄</button>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 16px 0', flexShrink: 0 }}>
        <button style={tabStyle('claims')} onClick={() => setTab('claims')}>
          Claims {claims.length > 0 ? `(${claims.length})` : ''}
        </button>
        <button style={tabStyle('packages')} onClick={() => setTab('packages')}>
          Envíos
        </button>
        <button style={tabStyle('users')} onClick={() => setTab('users')}>
          Usuarios
        </button>
        <button style={tabStyle('torneos')} onClick={() => setTab('torneos')}>
          Torneos
        </button>
        <button style={tabStyle('stats')} onClick={() => setTab('stats')}>
          Stats
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {/* ── Claims tab ── */}
        {tab === 'claims' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 12 }}>
              CLAIMS PENDIENTES
            </div>
            {loading && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
              </div>
            )}
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}
            {!loading && !error && claims.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 15, color: '#4B5563', fontWeight: 600 }}>Sin claims pendientes</div>
                <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>Todo al día</div>
              </div>
            )}
            {claims.map(c => (
              <ClaimCard key={c.id} claim={c} onReviewed={handleReviewed} />
            ))}
          </>
        )}

        {/* ── Packages tab ── */}
        {tab === 'packages' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 12 }}>
              LLEGADAS PENDIENTES DE CONFIRMACIÓN
            </div>
            <PackagesTab />
          </>
        )}

        {/* ── Users tab ── */}
        {tab === 'users' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 12 }}>
              MEMBRESÍAS Y PUNTOS
            </div>
            <UsersTab />
          </>
        )}

        {/* ── Torneos tab ── */}
        {tab === 'torneos' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 12 }}>
              TORNEOS
            </div>
            <TournamentsAdminTab />
          </>
        )}

        {/* ── Stats tab ── */}
        {tab === 'stats' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 12 }}>
              ESTADÍSTICAS DE ENVÍOS
            </div>
            <StatsTab />
          </>
        )}

      </div>
    </div>
  )
}
