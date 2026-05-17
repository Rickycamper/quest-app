// ─────────────────────────────────────────────
// QUEST — EditProfileScreen
// ─────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { getProfile, updateProfile, uploadAvatar, signOut, deleteAccount, linkDiscordIdentity, getMyIdentities, unlinkIdentity } from '../lib/supabase'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import { BRANCHES, GAMES, GAME_STYLES } from '../lib/constants'
import GameIcon from '../components/GameIcon'
import { CameraIcon, MailIcon as MailIconShared } from '../components/Icons'
import Spinner from '../components/Spinner'

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
  const toast = useToast()
  const confirmAction = useConfirm()
  const [username,      setUsername]      = useState('')
  const [phone,         setPhone]         = useState('')
  const [email,         setEmail]         = useState('')
  const [branch,        setBranch]        = useState('')
  const [tcgGames,      setTcgGames]      = useState([])
  const [tcgUsernames,  setTcgUsernames]  = useState({ MTG: '', Pokemon: '', Bandai: '' })
  const [socialLinks,   setSocialLinks]   = useState({ instagram: '', tiktok: '', twitter: '', youtube: '' })
  const [avatarUrl,     setAvatarUrl]     = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile,    setAvatarFile]    = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [uploadingImg,  setUploadingImg]  = useState(false)
  const [error,         setError]         = useState('')
  const [signingOut,    setSigningOut]    = useState(false)
  const [signOutStep,   setSignOutStep]   = useState(0)   // 0=idle 1=confirm
  const [identities,    setIdentities]    = useState([])  // ['email', 'discord', ...]
  const [linkingDiscord,setLinkingDiscord]= useState(false)
  const [deleteStep,    setDeleteStep]    = useState(0)   // 0=idle 1=confirm 2=deleting
  const fileRef = useRef(null)

  useEffect(() => {
    getProfile(userId)
      .then(p => {
        setUsername(p.username ?? '')
        setPhone(p.phone ?? '')
        setEmail(p.email ?? '')
        setBranch(p.branch ?? '')
        setTcgGames(p.tcg_games ?? [])
        setTcgUsernames({ MTG: '', Pokemon: '', Bandai: '', ...(p.tcg_usernames ?? {}) })
        setSocialLinks({ instagram: '', tiktok: '', twitter: '', youtube: '', ...(p.social_links ?? {}) })
        setAvatarUrl(p.avatar_url ?? null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId])

  // Load which auth providers (email, discord, etc.) are linked to this user.
  // Re-fetches whenever the tab gets focus again, so when the user returns
  // from the Discord OAuth redirect the "Conectar" button updates to "Vinculado".
  useEffect(() => {
    let cancelled = false
    const load = () => {
      getMyIdentities()
        .then(p => { if (!cancelled) setIdentities(p) })
        .catch(() => {})
    }
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { cancelled = true; window.removeEventListener('focus', onFocus) }
  }, [])

  const handleLinkDiscord = async () => {
    if (linkingDiscord) return
    setLinkingDiscord(true)
    try {
      await linkDiscordIdentity()  // browser redirects to Discord; comes back here
    } catch (e) {
      toast(e.message || 'No se pudo vincular Discord.', { type: 'error' })
      setLinkingDiscord(false)
    }
  }

  const handleUnlinkDiscord = async () => {
    const ok = await confirmAction(
      'Vas a poder seguir entrando con email después de desvincularlo.',
      { title: '¿Desvincular Discord?', confirmLabel: 'Desvincular', destructive: true }
    )
    if (!ok) return
    try {
      await unlinkIdentity('discord')
      setIdentities(prev => prev.filter(p => p !== 'discord'))
      toast('Discord desvinculado.', { type: 'success' })
    } catch (e) {
      toast(e.message || 'No se pudo desvincular.', { type: 'error' })
    }
  }

  const discordLinked = identities.includes('discord')

  const handleAvatarPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Block HEIC/HEIF — browsers can't convert them to JPEG via canvas
    const isHeic = /heic|heif/i.test(file.type) || /\.heic$|\.heif$/i.test(file.name)
    if (isHeic) {
      setError('Formato no compatible. Abre la foto en tu galería y compártela como JPG.')
      e.target.value = ''
      return
    }
    if (file.size > 30 * 1024 * 1024) {
      setError('La imagen es demasiado grande. Máximo 30 MB.')
      e.target.value = ''
      return
    }
    setError('')
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
        // Pass userId so uploadAvatar skips the /auth/v1/user round-trip
        // that can hang on slow/flaky networks and leave save stuck.
        newAvatarUrl = await uploadAvatar(avatarFile, userId)
        setUploadingImg(false)
      }
      // Strip empty per-platform IDs so the JSONB stays clean (no
      // `{"MTG": "", "Pokemon": ""}` rows when the user didn't fill them).
      const cleanTcgUsernames = Object.fromEntries(
        Object.entries(tcgUsernames).filter(([, v]) => typeof v === 'string' && v.trim())
      )
      const updated = await updateProfile(userId, {
        username:   trimmed,
        phone:      phone.trim() || null,
        email:      email.trim() || null,
        branch:     branch || null,
        avatar_url: newAvatarUrl,
        tcg_games:     tcgGames,
        tcg_usernames: cleanTcgUsernames,
        social_links:  socialLinks,
      })
      onSaved?.(updated)
      toast('Perfil actualizado', { type: 'success' })
    } catch (e) {
      setError(e.message || 'Error al guardar. Intenta de nuevo.')
      toast(e.message || 'Error al guardar', { type: 'error' })
      setUploadingImg(false)
    } finally {
      setSaving(false)
    }
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

  if (loading) {
    // Skeleton that mirrors the EditProfileScreen layout — header, avatar,
    // and form rows — so perceived load is ~2× faster than a centered spinner.
    const sk = (w, h, r = 6) => ({
      display: 'inline-block', width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, #161616 0%, #1F1F1F 50%, #161616 100%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite',
    })
    return (
      <div style={{ background: '#0A0A0A', minHeight: '100%', padding: '14px 20px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <span style={sk(28, 28, 12)} />
          <span style={sk(120, 18)} />
        </div>
        {/* Avatar circle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <span style={sk(96, 96, 48)} />
        </div>
        {/* Form fields */}
        {[80, 80, 60].map((labelW, i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            <span style={{ ...sk(labelW, 11), marginBottom: 8, display: 'block' }} />
            <span style={sk('100%', 44, 12)} />
          </div>
        ))}
        <span style={{ ...sk('100%', 44, 12), marginTop: 24, display: 'block' }} />
      </div>
    )
  }

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
        <button onClick={handleSave} disabled={saving || uploadingImg} style={{
          background: (saving || uploadingImg) ? '#1A1A1A' : '#FFFFFF',
          border: 'none', color: (saving || uploadingImg) ? '#9CA3AF' : '#111',
          fontSize: 13, fontWeight: 700, cursor: (saving || uploadingImg) ? 'default' : 'pointer',
          padding: '7px 16px', borderRadius: 8, fontFamily: 'Inter, sans-serif',
          transition: 'all 0.15s',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {(saving || uploadingImg) && <Spinner size="xs" inline />}
          {uploadingImg ? 'Subiendo' : saving ? 'Guardando' : 'Guardar'}
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
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
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

        {/* ── TCG Games ── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            🎴 JUEGOS QUE JUEGO
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GAMES.map(g => {
              const gs = GAME_STYLES[g]
              const active = tcgGames.includes(g)
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setTcgGames(prev =>
                    prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
                  )}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 20,
                    border: `1.5px solid ${active ? gs.border : '#2A2A2A'}`,
                    background: active ? gs.bg : 'transparent',
                    color: active ? gs.color : '#4B5563',
                    fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.15s',
                  }}
                >
                  <GameIcon game={g} size={14} />
                  {g}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── IDs por plataforma (MTG Arena, Pokémon Live, Bandai TCG+) ── */}
        {/* Only shown when the user has at least one TCG selected — no point
            asking for IDs they don't play. Each platform groups multiple games
            (Bandai = One Piece + Digimon + Gundam + Riftbound). */}
        {tcgGames.length > 0 && (() => {
          // Determine which platforms the user needs an ID for, based on the
          // games they marked as playing.
          const needsMTG     = tcgGames.includes('MTG')
          const needsPokemon = tcgGames.includes('Pokemon')
          const needsBandai  = tcgGames.some(g => ['One Piece','Digimon','Gundam','Riftbound'].includes(g))
          const rows = []
          if (needsMTG)     rows.push({ key: 'MTG',     label: 'MTG Arena / Companion', color: '#A78BFA', placeholder: 'Tu ID en MTG Arena' })
          if (needsPokemon) rows.push({ key: 'Pokemon', label: 'Pokémon TCG Live',      color: '#FCD34D', placeholder: 'Tu ID en Pokémon Live' })
          if (needsBandai)  rows.push({ key: 'Bandai',  label: 'Bandai TCG+',           color: '#F87171', placeholder: 'Tu ID en Bandai TCG+', hint: 'One Piece · Digimon · Gundam · Riftbound' })
          if (rows.length === 0) return null
          return (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 8 }}>
                IDS POR JUEGO ONLINE
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5, marginBottom: 10 }}>
                Tu nombre en cada plataforma online. Aparece junto a tu username de Quest cuando te inscribís en torneos.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map(({ key, label, color, placeholder, hint }) => (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center',
                    background: '#111111', border: '1px solid #222', borderRadius: 10, overflow: 'hidden',
                  }}>
                    <span style={{ padding: '0 6px 0 14px', fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {label}
                    </span>
                    <input
                      value={tcgUsernames[key] ?? ''}
                      onChange={e => setTcgUsernames(prev => ({ ...prev, [key]: e.target.value.replace(/\s/g, '') }))}
                      style={{ ...inputStyle, border: 'none', borderRadius: 0, flex: 1 }}
                      placeholder={placeholder}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                ))}
                {needsBandai && (
                  <div style={{ fontSize: 10, color: '#4B5563', lineHeight: 1.4, paddingLeft: 4 }}>
                    💡 El mismo ID de Bandai sirve para One Piece, Digimon, Gundam y Riftbound.
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── Phone ── */}
        {fieldRow(
          <PhoneIcon />, 'TELÉFONO',
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
            placeholder="+507 6000-0000"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
          />
        )}

        {/* ── Social Links ── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.08em', marginBottom: 8 }}>
            REDES SOCIALES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: 'instagram', label: 'Instagram',  placeholder: 'tu_usuario',    color: '#E1306C', prefix: '@' },
              { key: 'tiktok',    label: 'TikTok',     placeholder: 'tu_usuario',    color: '#69C9D0', prefix: '@' },
              { key: 'twitter',   label: 'X / Twitter',placeholder: 'tu_usuario',    color: '#9CA3AF', prefix: '@' },
              { key: 'youtube',   label: 'YouTube',    placeholder: 'tu_canal',      color: '#FF0000', prefix: '@' },
            ].map(({ key, label, placeholder, color, prefix }) => (
              <div key={key} style={{
                display: 'flex', alignItems: 'center',
                background: '#111111', border: '1px solid #222', borderRadius: 10, overflow: 'hidden',
              }}>
                <span style={{ padding: '0 6px 0 14px', fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {label}
                </span>
                <span style={{ color: '#4B5563', fontSize: 14, paddingRight: 2, flexShrink: 0 }}>{prefix}</span>
                <input
                  value={socialLinks[key]}
                  onChange={e => setSocialLinks(prev => ({ ...prev, [key]: e.target.value.replace(/\s/g, '').replace(/^@/, '') }))}
                  style={{ ...inputStyle, border: 'none', borderRadius: 0, flex: 1 }}
                  placeholder={placeholder}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Cuentas vinculadas ── */}
        <div style={{ marginTop: 24, marginBottom: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '0.1em', marginBottom: 10 }}>
            CUENTAS VINCULADAS
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: '#111111', border: '1px solid #222', borderRadius: 12,
            padding: '12px 14px',
          }}>
            {/* Discord brand mark */}
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#5865F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>Discord</div>
              <div style={{ fontSize: 11, color: discordLinked ? '#4ADE80' : '#6B7280', marginTop: 2 }}>
                {discordLinked ? '✓ Vinculado' : 'Vinculá Discord para entrar también con él'}
              </div>
            </div>
            {discordLinked ? (
              <button onClick={handleUnlinkDiscord} style={{
                padding: '7px 12px', borderRadius: 8,
                background: 'transparent', border: '1px solid #2A2A2A',
                color: '#9CA3AF', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                flexShrink: 0,
              }}>Desvincular</button>
            ) : (
              <button onClick={handleLinkDiscord} disabled={linkingDiscord} style={{
                padding: '7px 14px', borderRadius: 8,
                background: '#5865F2', border: 'none',
                color: '#FFFFFF', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                flexShrink: 0, opacity: linkingDiscord ? 0.5 : 1,
              }}>{linkingDiscord ? 'Abriendo…' : 'Conectar'}</button>
            )}
          </div>
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
