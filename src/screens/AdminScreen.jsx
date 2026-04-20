// ─────────────────────────────────────────────
// QUEST — AdminScreen
// Staff/Admin panel: review & approve claims
// ─────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getPendingClaims, reviewClaim, getAdminUsers, setUserPremium, setUserRole, logMembershipUsage, undoMembershipUsage, getMembershipUsageSummary, getPendingArrivalPackages, confirmPackageArrival, rejectPackageArrival, updatePackageStatus, getTournaments, deleteTournament, getPackageStats, getPendingRedemptions, approveRedemption, rejectRedemption } from '../lib/supabase'
import { GAME_STYLES } from '../lib/constants'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import GameIcon from '../components/GameIcon'
import EmailMarketingScreen from './EmailMarketingScreen'

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }
const PTS    = { 1: 3, 2: 2, 3: 1 }

function ClaimCard({ claim, onReviewed }) {
  const [busy,  setBusy]  = useState(false)
  const [done,  setDone]  = useState(null) // 'approved' | 'rejected'
  const [err,   setErr]   = useState('')
  const timerRef = useRef(null)
  const gs = GAME_STYLES[claim.game] ?? GAME_STYLES['MTG']

  // Clean up pending dismiss timer if card unmounts before it fires
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const handle = async (status) => {
    setBusy(true)
    setErr('')
    try {
      await reviewClaim(claim.id, status)
      setDone(status)
      timerRef.current = setTimeout(() => onReviewed(claim.id), 800)
    } catch (e) {
      setErr(e.message || 'Error al procesar el claim')
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

      {/* Inline error */}
      {err && (
        <div style={{ fontSize: 12, color: '#F87171', marginBottom: 8, padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
          {err}
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
// ── Tier config ───────────────────────────────
const TIER_CONFIG = {
  wizard:   { label: 'Wizard',   color: '#60A5FA', booster: 1, tournament: 1 },
  mage:     { label: 'Mage',     color: '#A78BFA', booster: 2, tournament: 2 },
  archmage: { label: 'Archmage', color: '#FBBF24', booster: 3, tournament: 3 },
  premium:  { label: 'Premium',  color: '#F97316', booster: 1, tournament: 1 },
}
const PAID_ROLES = new Set(['wizard', 'mage', 'archmage', 'premium'])
const TIER_ORDER = ['wizard', 'mage', 'archmage']

function UsageBar({ label, used, allowed, color }) {
  const pct = allowed > 0 ? Math.min(used / allowed, 1) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: used >= allowed ? '#F87171' : '#9CA3AF' }}>
          {used}/{allowed}
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: '#1F1F1F', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${pct * 100}%`,
          background: used >= allowed ? '#F87171' : color,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

function UserCard({ user, onRoleChange, adminBranch, currentIsOwner, currentIsAdmin }) {
  const [expanded,   setExpanded]   = useState(false)
  const [usage,      setUsage]      = useState(null)   // [{ benefit, used, allowed }]
  const [loadingU,   setLoadingU]   = useState(false)
  const [roleChanging, setRoleChanging] = useState(false)
  const [logBusy,    setLogBusy]    = useState({})     // { booster: bool, tournament: bool }
  const [err,        setErr]        = useState('')

  const isPaid     = PAID_ROLES.has(user.role)
  const isStaff    = user.role === 'staff' || user.role === 'admin'
  const isOwnerAcc = user.is_owner === true
  const canModify  = (currentIsOwner || currentIsAdmin) && (!isOwnerAcc || currentIsOwner)
  const tier       = TIER_CONFIG[user.role]

  const roleColor  = isOwnerAcc ? '#F59E0B'
                   : isStaff    ? '#3B82F6'
                   : tier       ? tier.color
                   : '#4B5563'
  const roleLabel  = isOwnerAcc ? '👑 Owner'
                   : isStaff    ? 'Admin'
                   : tier       ? tier.label
                   : 'Free'

  // Load usage when expanded
  useEffect(() => {
    if (!expanded || !isPaid || usage !== null) return
    setLoadingU(true)
    getMembershipUsageSummary(user.id)
      .then(setUsage)
      .catch(() => setUsage([]))
      .finally(() => setLoadingU(false))
  }, [expanded])

  const handleSetRole = async (newRole) => {
    if (!canModify) return
    setRoleChanging(true); setErr('')
    try {
      await setUserRole(user.id, newRole)
      onRoleChange(user.id, newRole)
      setUsage(null) // reset usage so it reloads for new tier
    } catch (e) { setErr(e.message || 'Error al actualizar') }
    setRoleChanging(false)
  }

  const handleLog = async (benefit, delta) => {
    setLogBusy(b => ({ ...b, [benefit]: true })); setErr('')
    try {
      if (delta > 0) await logMembershipUsage({ userId: user.id, benefit, branch: adminBranch })
      else           await undoMembershipUsage({ userId: user.id, benefit })
      // Refresh usage
      const fresh = await getMembershipUsageSummary(user.id)
      setUsage(fresh)
    } catch (e) { setErr(e.message || 'Error') }
    setLogBusy(b => ({ ...b, [benefit]: false }))
  }

  const getUsage = (benefit) => usage?.find(u => u.benefit === benefit) ?? { used: 0, allowed: 0 }

  return (
    <div style={{ borderBottom: '1px solid #1A1A1A' }}>
      {/* ── Main row ── */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', cursor: isPaid && canModify ? 'pointer' : 'default' }}
        onClick={() => { if (isPaid && canModify) setExpanded(e => !e) }}
      >
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1F1F1F', overflow: 'hidden', flexShrink: 0 }}>
          <Avatar url={user.avatar_url} size={36} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.username}
          </div>
          <div style={{ fontSize: 11, color: roleColor, fontWeight: 600, marginTop: 1 }}>{roleLabel}</div>
        </div>

        {/* Tier selector pill — non-staff paid members */}
        {!isStaff && !isOwnerAcc && canModify && (
          <div style={{ display: 'flex', gap: 4 }}>
            {TIER_ORDER.map(t => (
              <button key={t} onClick={e => { e.stopPropagation(); handleSetRole(user.role === t ? 'client' : t) }}
                disabled={roleChanging}
                style={{
                  padding: '4px 8px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: user.role === t ? `${TIER_CONFIG[t].color}25` : 'rgba(255,255,255,0.05)',
                  color: user.role === t ? TIER_CONFIG[t].color : '#4B5563',
                  fontSize: 10, fontWeight: 800, fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.15s',
                }}>
                {TIER_CONFIG[t].label.slice(0, 4).toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {isPaid && canModify && (
          <span style={{ fontSize: 12, color: '#4B5563', marginLeft: 2 }}>{expanded ? '▲' : '▼'}</span>
        )}
        {isOwnerAcc && !currentIsOwner && (
          <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700 }}>🔒</span>
        )}
      </div>

      {/* ── Expanded usage panel ── */}
      {expanded && isPaid && (
        <div style={{ paddingBottom: 14 }}>
          {err && <div style={{ fontSize: 11, color: '#F87171', marginBottom: 8 }}>{err}</div>}

          {loadingU ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: tier?.color ?? '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          ) : (
            <div style={{ background: '#111', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em' }}>USO ESTE MES</div>

              {/* Boosters */}
              {(() => { const u = getUsage('booster'); return (
                <div>
                  <UsageBar label="🎴 Boosters" used={u.used} allowed={u.allowed || tier?.booster || 0} color={tier?.color ?? '#A78BFA'} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={() => handleLog('booster', -1)} disabled={logBusy.booster || u.used === 0}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #2A2A2A', background: 'transparent', color: '#6B7280', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      − Deshacer
                    </button>
                    <button onClick={() => handleLog('booster', 1)} disabled={logBusy.booster || u.used >= (u.allowed || tier?.booster || 0)}
                      style={{ flex: 2, padding: '7px 0', borderRadius: 8, border: 'none', background: u.used >= (u.allowed || tier?.booster || 0) ? '#1A1A1A' : (tier?.color ?? '#A78BFA'), color: u.used >= (u.allowed || tier?.booster || 0) ? '#4B5563' : '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      {logBusy.booster ? '...' : '+ Registrar booster'}
                    </button>
                  </div>
                </div>
              )})()}

              {/* Tournaments */}
              {(() => { const u = getUsage('tournament'); return (
                <div>
                  <UsageBar label="🏆 Torneos" used={u.used} allowed={u.allowed || tier?.tournament || 0} color={tier?.color ?? '#A78BFA'} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={() => handleLog('tournament', -1)} disabled={logBusy.tournament || u.used === 0}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #2A2A2A', background: 'transparent', color: '#6B7280', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      − Deshacer
                    </button>
                    <button onClick={() => handleLog('tournament', 1)} disabled={logBusy.tournament || u.used >= (u.allowed || tier?.tournament || 0)}
                      style={{ flex: 2, padding: '7px 0', borderRadius: 8, border: 'none', background: u.used >= (u.allowed || tier?.tournament || 0) ? '#1A1A1A' : (tier?.color ?? '#A78BFA'), color: u.used >= (u.allowed || tier?.tournament || 0) ? '#4B5563' : '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                      {logBusy.tournament ? '...' : '+ Registrar torneo'}
                    </button>
                  </div>
                </div>
              )})()}
            </div>
          )}
        </div>
      )}

      {!expanded && err && <div style={{ fontSize: 11, color: '#F87171', paddingBottom: 6 }}>{err}</div>}
    </div>
  )
}

// ── Users tab ────────────────────────────────
function UsersTab({ currentIsOwner, currentIsAdmin, adminBranch }) {
  const [users,   setUsers]   = useState([])
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const searchTimer = useRef(null)
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const load = useCallback((q = query) => {
    setLoading(true); setError('')
    getAdminUsers(q, adminBranch)
      .then(setUsers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [query, adminBranch])

  useEffect(() => { load('') }, [])

  const handleSearch = (e) => {
    const v = e.target.value
    setQuery(v)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(v), 400)
  }

  const handleRoleChange = (userId, newRole) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
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
        <UserCard
          key={u.id} user={u}
          onRoleChange={handleRoleChange}
          adminBranch={adminBranch}
          currentIsOwner={currentIsOwner}
          currentIsAdmin={currentIsAdmin}
        />
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
  const [err,       setErr]       = useState('')
  const timerRef = useRef(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const handleConfirm = async () => {
    setBusy(true)
    setErr('')
    try {
      await confirmPackageArrival(pkg.id, notes.trim() || '')
      setDone('confirmed')
      timerRef.current = setTimeout(() => onConfirmed(pkg.id), 800)
    } catch (e) {
      setErr(e.message || 'Error al confirmar')
    }
    setBusy(false)
  }

  const handleReject = async () => {
    setBusy(true)
    setErr('')
    try {
      await rejectPackageArrival(pkg.id, notes.trim() || '')
      setDone('rejected')
      timerRef.current = setTimeout(() => onRejected(pkg.id), 800)
    } catch (e) {
      setErr(e.message || 'Error al rechazar')
    }
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

      {/* Inline error */}
      {err && (
        <div style={{ fontSize: 12, color: '#F87171', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', marginBottom: 8 }}>
          {err}
        </div>
      )}

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
function PackagesTab({ adminBranch }) {
  const [packages, setPackages] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const load = () => {
    setLoading(true); setError('')
    getPendingArrivalPackages(adminBranch)
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
function TournamentsAdminTab({ adminBranch }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null) // id to confirm delete
  const [error,   setError]   = useState('')

  useEffect(() => {
    getTournaments({ branch: adminBranch })
      .then(setItems)
      .catch(e => setError(e.message || 'Error al cargar torneos'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id) => {
    if (confirm !== id) { setConfirm(id); return }
    setConfirm(null)
    setError('')
    try {
      await deleteTournament(id)
      setItems(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      setError(e.message || 'Error al borrar torneo')
    }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 30 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
    </div>
  )
  if (!items.length && !error) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>🎮</div>
      <div style={{ fontSize: 14, color: '#4B5563' }}>No hay torneos</div>
    </div>
  )

  return (
    <div>
      {error && (
        <div style={{ margin: '8px 0 12px', padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13 }}>
          {error}
        </div>
      )}
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
// ── Q Points tab ───────────────────────────────
function QPointsTab() {
  const [redemptions, setRedemptions] = useState([])
  const [loading, setLoading]         = useState(true)
  const [busy, setBusy]               = useState({})

  const load = () => {
    setLoading(true)
    getPendingRedemptions()
      .then(setRedemptions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handle = async (id, approve, note = '') => {
    setBusy(b => ({ ...b, [id]: true }))
    try {
      if (approve) await approveRedemption(id)
      else await rejectRedemption(id, note)
      setRedemptions(r => r.filter(x => x.id !== id))
    } catch {}
    setBusy(b => ({ ...b, [id]: false }))
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
    </div>
  )

  if (redemptions.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🪙</div>
      <div style={{ fontSize: 15, color: '#4B5563', fontWeight: 600 }}>Sin canjes pendientes</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 4 }}>
        CANJES PENDIENTES ({redemptions.length})
      </div>
      {redemptions.map(r => (
        <div key={r.id} style={{ background: '#1A1A1A', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: '#2A2A2A', flexShrink: 0 }}>
              <Avatar url={r.profiles?.avatar_url} size={36} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', fontFamily: 'Inter, sans-serif' }}>@{r.profiles?.username}</div>
              <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
                {new Date(r.created_at).toLocaleDateString('es-PA')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#FBBF24', fontFamily: 'Inter, sans-serif' }}>🪙 {r.points}</div>
              <div style={{ fontSize: 12, color: '#4ADE80', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>${(r.points / 1000).toFixed(2)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              disabled={busy[r.id]}
              onClick={() => handle(r.id, true)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, background: '#4ADE80', border: 'none', color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              ✓ Aprobar
            </button>
            <button
              disabled={busy[r.id]}
              onClick={() => handle(r.id, false, 'Rechazado por admin')}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, background: 'transparent', border: '1.5px solid #374151', color: '#9CA3AF', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              ✕ Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

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

// ── Section definitions ──────────────────────
const ADMIN_SECTIONS = [
  { id: 'claims',   label: 'Claims',    desc: 'Resultados de torneos',    color: '#F87171', icon: '⚔️' },
  { id: 'packages', label: 'Envíos',    desc: 'Llegadas por confirmar',   color: '#F59E0B', icon: '📦' },
  { id: 'users',    label: 'Miembros',  desc: 'Roles y beneficios',       color: '#60A5FA', icon: '👥' },
  { id: 'torneos',  label: 'Torneos',   desc: 'Gestión de torneos',       color: '#4ADE80', icon: '🏆' },
  { id: 'qpoints',  label: 'Q Coins',   desc: 'Canjes pendientes',        color: '#FBBF24', icon: '🪙' },
  { id: 'stats',    label: 'Stats',     desc: 'Estadísticas de envíos',   color: '#A78BFA', icon: '📊' },
  { id: 'articles', label: 'RSS',       desc: 'Artículos TCG',            color: '#6B7280', icon: '📰' },
  { id: 'email',    label: 'Email',     desc: 'Campañas de marketing',    color: '#EC4899', icon: '📧', ownerOnly: true },
]

export default function AdminScreen({ onClose }) {
  const { isOwner: currentIsOwner, isAdmin: currentIsAdmin, profile } = useAuth()
  const adminBranch = (currentIsOwner || currentIsAdmin) ? null : (profile?.branch ?? null)
  const [tab,    setTab]    = useState('home')
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = () => {
    setLoading(true); setError('')
    getPendingClaims(adminBranch)
      .then(setClaims)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  const handleReviewed = (id) => setClaims(prev => prev.filter(c => c.id !== id))

  const sections = ADMIN_SECTIONS.filter(s => !s.ownerOnly || currentIsOwner)
  const current  = sections.find(s => s.id === tab)

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: '#0A0A0A', display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      animation: 'slideUp 0.22s ease',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '18px 18px 14px', borderBottom: '1px solid #1A1A1A', flexShrink: 0,
      }}>
        <button onClick={tab === 'home' ? onClose : () => setTab('home')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6B7280', fontSize: 20, padding: '0 4px 0 0', lineHeight: 1,
        }}>←</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {tab === 'home' ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#FFF' }}>Panel Admin</div>
              {adminBranch && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{adminBranch}</div>}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{current?.icon}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#FFF' }}>{current?.label}</span>
            </div>
          )}
        </div>

        {tab === 'claims' && claims.length > 0 && (
          <div style={{ background: '#EF4444', color: '#FFF', borderRadius: 10, fontSize: 11, fontWeight: 800, padding: '2px 8px' }}>
            {claims.length}
          </div>
        )}
        {tab === 'claims' && (
          <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563', fontSize: 16, marginLeft: 4 }}>🔄</button>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {/* ── Dashboard home ── */}
        {tab === 'home' && (
          <>
            {/* Alert banner if claims pending */}
            {!loading && claims.length > 0 && (
              <button onClick={() => setTab('claims')} style={{
                width: '100%', marginBottom: 14,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                borderLeft: '3px solid #EF4444',
                borderRadius: 12, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', flexShrink: 0, boxShadow: '0 0 6px #EF4444' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#F87171', flex: 1, textAlign: 'left' }}>
                  {claims.length} claim{claims.length !== 1 ? 's' : ''} pendiente{claims.length !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: 13, color: '#F87171' }}>→</span>
              </button>
            )}

            {/* Section grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {sections.map(s => (
                <button key={s.id} onClick={() => setTab(s.id)} style={{
                  background: '#0F0F0F',
                  border: '1px solid #1A1A1A',
                  borderTop: `3px solid ${s.color}`,
                  borderRadius: 14, padding: '18px 16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif',
                  transition: 'background 0.15s',
                  position: 'relative',
                }}>
                  <span style={{ fontSize: 26 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#FFF' }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: '#4B5563', marginTop: 3, lineHeight: 1.4 }}>{s.desc}</div>
                  </div>
                  {s.id === 'claims' && claims.length > 0 && (
                    <div style={{
                      position: 'absolute', top: 12, right: 12,
                      background: '#EF4444', color: '#FFF',
                      borderRadius: 8, fontSize: 10, fontWeight: 800, padding: '2px 7px',
                    }}>{claims.length}</div>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Section content ── */}
        {tab === 'claims' && (
          <>
            {loading && <div style={{ textAlign: 'center', padding: 40 }}><div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} /></div>}
            {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            {!loading && !error && claims.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 15, color: '#4B5563', fontWeight: 600 }}>Sin claims pendientes</div>
                <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>Todo al día</div>
              </div>
            )}
            {claims.map(c => <ClaimCard key={c.id} claim={c} onReviewed={handleReviewed} />)}
          </>
        )}

        {tab === 'packages'  && <PackagesTab adminBranch={adminBranch} />}
        {tab === 'users'     && <UsersTab currentIsOwner={currentIsOwner} currentIsAdmin={currentIsAdmin} adminBranch={adminBranch} />}
        {tab === 'torneos'   && <TournamentsAdminTab adminBranch={adminBranch} />}
        {tab === 'qpoints'   && <QPointsTab />}
        {tab === 'stats'     && (adminBranch
          ? <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4B5563', fontSize: 13 }}>Solo disponible para administradores globales</div>
          : <StatsTab />
        )}
        {tab === 'articles'  && <ArticlesTab />}
        {tab === 'email'     && currentIsOwner && <EmailMarketingScreen />}

      </div>
    </div>
  )
}

function ArticlesTab() {
  const [busy,   setBusy]   = useState(false)
  const [result, setResult] = useState(null)
  const [error,  setError]  = useState('')

  const refresh = async () => {
    setBusy(true); setError(''); setResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('fetch-articles', { body: {} })
      if (error) throw error
      setResult(data?.results ?? [])
    } catch (e) {
      setError(e?.message ?? String(e))
    }
    setBusy(false)
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 14 }}>
        ARTÍCULOS RSS
      </div>
      <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 16 }}>
        Carga artículos de MTGGoldfish, Wizards, PokeBeach y más. Aparecen en el feed cuando filtrás por juego.
      </p>
      <button
        onClick={refresh}
        disabled={busy}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 10,
          background: busy ? '#1A1A1A' : '#FFFFFF',
          border: 'none', color: busy ? '#555' : '#111',
          fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
          fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {busy
          ? <><div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #333', borderTopColor: '#666', animation: 'spin 0.7s linear infinite' }} /> Cargando artículos...</>
          : '🔄 Actualizar artículos ahora'
        }
      </button>
      {error && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', fontSize: 13 }}>
          {error}
        </div>
      )}
      {result && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {result.map((r, i) => (
            <div key={i} style={{
              padding: '10px 12px', borderRadius: 10,
              background: r.error ? 'rgba(239,68,68,0.05)' : 'rgba(74,222,128,0.05)',
              border: `1px solid ${r.error ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)'}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: r.error ? '#F87171' : '#4ADE80' }}>
                {r.source}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                {r.error ? `Error: ${r.error}` : `${r.count} artículos importados`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
