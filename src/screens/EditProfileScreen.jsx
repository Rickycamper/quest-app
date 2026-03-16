// ─────────────────────────────────────────────
// QUEST — EditProfileScreen
// ─────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { getProfile, updateProfile, uploadAvatar, signOut, deleteAccount } from '../lib/supabase'
import { BRANCHES } from '../lib/constants'
import { CameraIcon, MailIcon as MailIconShared } from '../components/Icons'

function PhoneIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.59 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.32 6.32l1.13-1.14a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function MailIcon() { return <MailIconShared size={14} /> }

function BranchIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export default function EditProfileScreen({ userId, onBack, onSaved }) {
  const [username,      setUsername]      = useState('')
  const [phone,         setPhone]         = useState('')
  const [email,         setEmail]         = useState('')
  const [branch,        setBranch]        = useState('')
  const [avatarUrl,     setAvatarUrl]     = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile,    setAvatarFile]    = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [uploadingImg,  setUploadingImg]  = useState(false)
  const [error,         setError]         = useState('')
  const [signingOut,    setSigningOut]    = useState(false)
  const [signOutStep,   setSignOutStep]   = useState(0)   // 0=idle 1=confirm
  const [deleteStep,    setDeleteStep]    = useState(0)   // 0=idle 1=confirm 2=deleting
  const fileRef = useRef(null)

  useEffect(() => {
    getProfile(userId)
      .then(p => {
        setUsername(p.username ?? '')
        setPhone(p.phone ?? '')
        setEmail(p.email ?? '')
        setBranch(p.branch ?? '')
        setAvatarUrl(p.avatar_url ?? null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId])

  const handleAvatarPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (saving) return
    const trimmed = username.trim().replace(/^@/, '').replace(/\s/g, '')
    if (!trimmed) { setError('El usuario no puede estar vacío'); return }
    setSaving(true); setError('')
    try {
      let newAvatarUrl = avatarUrl
      if (avatarFile) {
        setUploadingImg(true)
        newAvatarUrl = await uploadAvatar(avatarFile)
        setUploadingImg(false)
      }
      const updated = await updateProfile(userId, {
        username:   trimmed,
        phone:      phone.trim() || null,
        email:      email.trim() || null,
        branch:     branch || null,
        avatar_url: newAvatarUrl,
      })
      onSaved?.(updated)
    } catch (e) {
      setError(e.message)
      setUploadingImg(false)
    }
    setSaving(false)
  }

  const handleSignOut = async () => {
    if (signOutStep === 0) { setSignOutStep(1); return }
    setSigningOut(true)
    try { await signOut() } catch (_) {}
    setSigningOut(false)
  }

  const handleDeleteAccount = async () => {
    if (deleteStep === 0) { setDeleteStep(1); return }
    setDeleteStep(2)
    try { await deleteAccount() } catch (e) {
      setError(e?.message || 'Error al eliminar la cuenta')
      setDeleteStep(0)
    }
  }

  const displayAvatar = avatarPreview || (avatarUrl?.startsWith('http') ? avatarUrl : null)

  const inputStyle = {
    flex: 1, padding: '11px 12px', background: '#111111',
    border: '1px solid #222', borderRadius: 10, color: '#FFFFFF',
    fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none',
    boxSizing: 'border-box', minWidth: 0,
  }

  const fieldRow = (icon, label, input) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ opacity: 0.7 }}>{icon}</span>
        {label}
      </div>
      {input}
    </div>
  )

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A', minHeight: '100%' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ background: '#0A0A0A', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #1A1A1A', flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: '#6B7280',
          fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>Cancelar</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>Editar perfil</span>
        <button onClick={handleSave} disabled={saving} style={{
          background: saving ? '#1A1A1A' : '#FFFFFF',
          border: 'none', color: saving ? '#555' : '#111',
          fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
          padding: '7px 16px', borderRadius: 8, fontFamily: 'Inter, sans-serif',
          transition: 'all 0.15s',
        }}>
          {uploadingImg ? 'Subiendo...' : saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '24px 20px 40px' }}>

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#F87171', fontSize: 13,
          }}>{error}</div>
        )}

        {/* ── Avatar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarPick} style={{ display: 'none' }} />
          <div onClick={() => fileRef.current?.click()} style={{
            width: 90, height: 90, borderRadius: '50%',
            background: '#1A1A1A', border: '2px solid #2A2A2A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 38, cursor: 'pointer', position: 'relative', overflow: 'hidden',
          }}>
            {displayAvatar
              ? <img src={displayAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span>👤</span>
            }
            {/* Camera overlay at bottom */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 30, background: 'rgba(0,0,0,0.65)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CameraIcon size={15} color="#FFF" />
            </div>
          </div>
          <span style={{ fontSize: 12, color: '#4B5563', marginTop: 8 }}>Cambiar foto</span>
        </div>

        {/* ── Username ── */}
        {fieldRow(
          <UserIcon />, 'USUARIO',
          <div style={{ display: 'flex', alignItems: 'center', background: '#111111', border: '1px solid #222', borderRadius: 10, overflow: 'hidden' }}>
            <span style={{ padding: '0 4px 0 14px', color: '#4B5563', fontSize: 15, fontWeight: 600 }}>@</span>
            <input
              value={username}
              onChange={e => setUsername(e.target.value.replace(/\s/g, ''))}
              style={{ ...inputStyle, border: 'none', borderRadius: 0 }}
              placeholder="tu_usuario"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
        )}

        {/* ── Sucursal ── */}
        {fieldRow(
          <BranchIcon />, 'SUCURSAL',
          <select value={branch} onChange={e => setBranch(e.target.value)}
            style={{
              ...inputStyle, width: '100%', padding: '11px 14px',
              appearance: 'none', WebkitAppearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234B5563' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
            }}>
            <option value="">Sin sucursal asignada</option>
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}

        {/* ── Phone ── */}
        {fieldRow(
          <PhoneIcon />, 'TELÉFONO',
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
            placeholder="+507 6000-0000"
            type="tel"
          />
        )}

        {/* ── Email ── */}
        {fieldRow(
          <MailIcon />, 'CORREO',
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
            placeholder="tu@correo.com"
            type="email"
            autoCapitalize="none"
          />
        )}

        {/* Info note */}
        <div style={{
          marginTop: 8, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(255,255,255,0.03)', border: '1px solid #1A1A1A',
        }}>
          <p style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.6 }}>
            Tu teléfono y correo solo son visibles para los admins de Quest para coordinar envíos y torneos.
          </p>
        </div>

        {/* ── Zona de cuenta ── */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 10 }}>
            CUENTA
          </div>

          {/* Log out */}
          {signOutStep === 0 ? (
            <button
              onClick={handleSignOut}
              disabled={deleteStep === 2}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                background: 'transparent', border: '1.5px solid #2A2A2A',
                color: '#9CA3AF', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginBottom: 8, transition: 'all 0.15s',
              }}
            >
              → Cerrar sesión
            </button>
          ) : (
            <div style={{
              borderRadius: 12, border: '1.5px solid #2A2A2A',
              background: 'rgba(255,255,255,0.03)', padding: '14px',
              marginBottom: 8, animation: 'fadeUp 0.2s ease',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', marginBottom: 4 }}>
                ¿Cerrar sesión?
              </div>
              <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, marginBottom: 12 }}>
                Tendrás que volver a iniciar sesión para acceder a tu cuenta.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setSignOutStep(0)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8,
                    background: '#1A1A1A', border: '1px solid #2A2A2A',
                    color: '#9CA3AF', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}>Cancelar</button>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  style={{
                    flex: 2, padding: '10px', borderRadius: 8,
                    background: '#1F1F1F', border: '1.5px solid #374151',
                    color: '#FFF', fontSize: 13, fontWeight: 700,
                    cursor: signingOut ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
                  }}>
                  {signingOut ? 'Cerrando···' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {/* Delete account */}
          {deleteStep === 0 && (
            <button
              onClick={handleDeleteAccount}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 10,
                background: 'transparent', border: '1.5px solid rgba(239,68,68,0.25)',
                color: '#F87171', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.15s',
              }}
            >
              🗑 Eliminar cuenta
            </button>
          )}

          {/* Confirmation step */}
          {deleteStep >= 1 && (
            <div style={{
              borderRadius: 12, border: '1.5px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.06)', padding: '16px',
              animation: 'fadeUp 0.2s ease',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F87171', marginBottom: 6 }}>
                ¿Estás seguro?
              </div>
              <p style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6, marginBottom: 14 }}>
                Esta acción es <strong style={{ color: '#FFFFFF' }}>permanente</strong>. Todos tus posts, cartas y datos serán eliminados para siempre y no podrán recuperarse.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setDeleteStep(0)}
                  disabled={deleteStep === 2}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8,
                    background: '#1A1A1A', border: '1px solid #2A2A2A',
                    color: '#9CA3AF', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >Cancelar</button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteStep === 2}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8,
                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                    color: '#F87171', fontSize: 13, fontWeight: 700,
                    cursor: deleteStep === 2 ? 'default' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {deleteStep === 2 ? 'Eliminando···' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
