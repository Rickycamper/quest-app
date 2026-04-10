// ─────────────────────────────────────────────
// QUEST — Auth Screens
// ─────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { signInWithEmail, signUpWithEmail, signInWithDiscord, supabase } from '../lib/supabase'
import { EyeIcon, DiscordIcon, MailIcon } from '../components/Icons'
import monsters    from '../assets/Asset 3-sm.png'
import questLogo   from '../assets/quest-logo-sm.png'
import skull       from '../assets/skull-sm.png'
import qLogo       from '../assets/q-logo.png'

// ── OPENING ───────────────────────────────────
export function OpeningScreen({ onSignIn, onSignUp, onGuest }) {
  return (
    <div style={{
      flex: 1, background: '#111111', display: 'flex',
      flexDirection: 'column', alignItems: 'center',
      overflow: 'hidden',
    }}>
      {/* Hero illustration */}
      <div style={{
        width: '100%', flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px 0',
      }}>
        <img src={monsters} alt=""
          style={{ width: 'min(277px, 100%)', height: 'auto', aspectRatio: '277/218', objectFit: 'contain' }}
        />
        <img src={questLogo} alt="Quest"
          style={{ width: 104, height: 48, objectFit: 'contain', marginTop: -8 }}
        />
      </div>

      {/* Text */}
      <div style={{ padding: '0 28px 32px', width: '100%' }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#FFFFFF', textAlign: 'center', marginBottom: 8, letterSpacing: '-0.02em' }}>
          Explore the app
        </div>
        <div style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 1.5, marginBottom: 28 }}>
          La comunidad TCG de Panamá — compite, colecciona y conecta.
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={signInWithDiscord} style={socialBtn}>
            <DiscordIcon size={20} /> Continue with Discord
          </button>
          <button onClick={onSignUp} style={socialBtn}>
            <MailIcon size={18} /> Continue with Email
          </button>
          <button onClick={onGuest} style={{
            ...socialBtn,
            background: 'transparent',
            border: '1px solid #2A2A2A',
            color: '#9CA3AF',
            gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>⚔️</span>
            Explorar sin cuenta
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#6B7280', marginTop: 20 }}>
          Already have an account?{' '}
          <button onClick={onSignIn} style={linkBtn}>Log in</button>
        </div>
      </div>
    </div>
  )
}

// ── SIGNUP SELECTION ─────────────────────────
export function SignupScreen({ onEmail, onLogin }) {
  return (
    <div style={{
      flex: 1, background: '#EEF0F8', display: 'flex',
      flexDirection: 'column', alignItems: 'center',
      overflow: 'hidden',
    }}>
      {/* Hero */}
      <div style={{
        width: '100%', flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px 0',
      }}>
        <img src={monsters} alt=""
          style={{ width: 'min(277px, 100%)', height: 'auto', aspectRatio: '277/218', objectFit: 'contain' }}
        />
        <img src={questLogo} alt="Quest"
          style={{ width: 104, height: 48, objectFit: 'contain', marginTop: -8 }}
        />
      </div>

      <div style={{ padding: '0 28px 40px', width: '100%' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#111111', textAlign: 'center', marginBottom: 24, letterSpacing: '-0.02em' }}>
          Create Account
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={signInWithDiscord} style={socialBtnLight}>
            <DiscordIcon size={20} color="#5865F2" /> Continue with Discord
          </button>
          <button onClick={onEmail} style={socialBtnLight}>
            <MailIcon size={18} color="#111111" /> Continue with Email
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#6B7280', marginTop: 20 }}>
          Already have an account?{' '}
          <button onClick={onLogin} style={{ ...linkBtn, color: '#111111' }}>Log in</button>
        </div>
      </div>
    </div>
  )
}

// ── EMAIL SIGNUP ─────────────────────────────
export function EmailSignupScreen({ onBack, onDone }) {
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [confirm,       setConfirm]       = useState('')
  const [showPw,        setShowPw]        = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [success,       setSuccess]       = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTerms,     setShowTerms]     = useState(false)

  const handleSignup = async () => {
    if (!termsAccepted)       { setError('Debés aceptar los Términos y Condiciones'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6)  { setError('Mínimo 6 caracteres'); return }
    setLoading(true); setError('')
    try {
      const data = await signUpWithEmail(email, password, email.split('@')[0])
      // Session returned directly = email confirmation is disabled → log in right away
      if (data?.session) {
        onDone?.()
      } else {
        // Email confirmation is enabled → show "check your inbox" screen
        setSuccess(true)
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (success) return (
    <div style={{ flex: 1, background: '#EEF0F8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <div style={{ fontSize: 60, marginBottom: 16 }}>✉️</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#111111', marginBottom: 10 }}>Revisá tu email</div>
      <div style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
        Te enviamos un link a <strong>{email}</strong>. Confirmalo para iniciar sesión.
      </div>
      <button onClick={onDone} style={btnBlack}>Ir al Login</button>
    </div>
  )

  return (
    <div style={{ flex: 1, background: '#EEF0F8', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Hero */}
      <div style={{
        width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '36px 20px 8px',
      }}>
        <img src={monsters} alt=""
          style={{ width: 'min(277px, 100%)', height: 'auto', aspectRatio: '277/218', objectFit: 'contain' }}
        />
        <img src={questLogo} alt="Quest"
          style={{ width: 104, height: 48, objectFit: 'contain', marginTop: -8 }}
        />
      </div>

      <div style={{ padding: '16px 24px 40px', flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#111111', textAlign: 'center', marginBottom: 20, letterSpacing: '-0.02em' }}>
          Create Account
        </div>

        {error && (
          <div style={errorBox}>{error}</div>
        )}

        <div style={{ marginBottom: 12 }}>
          <input type="email" placeholder="Email address" value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputLight}
          />
        </div>

        <div style={{ marginBottom: 12, position: 'relative' }}>
          <input type={showPw ? 'text' : 'password'} placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ ...inputLight, paddingRight: 44 }}
          />
          <button onClick={() => setShowPw(s => !s)} style={eyeBtn}><EyeIcon off={!showPw} /></button>
        </div>

        <div style={{ marginBottom: 20, position: 'relative' }}>
          <input type={showPw ? 'text' : 'password'} placeholder="Confirm password" value={confirm}
            onChange={e => setConfirm(e.target.value)}
            style={{ ...inputLight, paddingRight: 44 }}
          />
          <button onClick={() => setShowPw(s => !s)} style={eyeBtn}><EyeIcon off={!showPw} /></button>
        </div>

        {/* Terms checkbox */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20 }}>
          <div
            onClick={() => setTermsAccepted(v => !v)}
            style={{
              width: 20, height: 20, minWidth: 20, borderRadius: 6,
              border: `2px solid ${termsAccepted ? '#A78BFA' : '#D1D5DB'}`,
              background: termsAccepted ? '#A78BFA' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', marginTop: 1,
            }}
          >
            {termsAccepted && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
            Acepto los{' '}
            <button onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: '#A78BFA', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'Inter, sans-serif' }}>
              Términos y Condiciones
            </button>
            {' '}de Quest, incluyendo recibir comunicaciones y promociones.
          </div>
        </div>

        <button onClick={handleSignup} disabled={loading || !email || !password || !confirm || !termsAccepted}
          style={{ ...btnBlack, opacity: (!email || !password || !confirm || !termsAccepted) ? 0.4 : 1 }}>
          {loading ? 'Creando cuenta...' : 'Create account'}
        </button>

        {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

        <button onClick={onBack} style={{ marginTop: 16, background: 'none', border: 'none', color: '#6B7280', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'center', width: '100%' }}>
          ← Volver
        </button>
      </div>
    </div>
  )
}

// ── LOGIN ─────────────────────────────────────
export function LoginScreen({ onBack, onSignUp, onForgot }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleLogin = async () => {
    setLoading(true); setError('')
    try {
      await signInWithEmail(email, password)
    } catch (e) {
      const code = e.code || e.error_code || ''
      if (code === 'email_not_confirmed' || e.message?.includes('Email not confirmed')) {
        setError('Confirmá tu email primero — revisá tu bandeja de entrada.')
      } else if (e.message?.includes('Invalid login credentials') || e.message?.includes('invalid_credentials')) {
        setError('Email o contraseña incorrectos.')
      } else {
        setError(e.message || 'No se pudo iniciar sesión.')
      }
    }
    setLoading(false)
  }

  const emailValid = email.includes('@') && email.length > 4

  return (
    <div style={{ flex: 1, background: '#FFFFFF', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Skull illustration — top right */}
      <img src={skull} alt="" style={{
        position: 'absolute', top: -30, right: -40,
        width: 310, objectFit: 'contain',
        zIndex: 0, pointerEvents: 'none',
      }} />

      {/* Form */}
      <div style={{ flex: 1, padding: '110px 24px 24px', overflowY: 'auto', scrollbarWidth: 'none', position: 'relative', zIndex: 1 }}>
        <img src={qLogo} alt="Q" style={{ width: 52, objectFit: 'contain', marginBottom: 12 }} />
        <div style={{ fontSize: 28, fontWeight: 800, color: '#111111', letterSpacing: '-0.02em', marginBottom: 24 }}>
          Log in
        </div>

        {error && <div style={errorBox}>{error}</div>}

        {/* Email */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>Email address</div>
          <div style={{ position: 'relative' }}>
            <input type="email" placeholder="helloworld@gmail.com" value={email}
              onChange={e => setEmail(e.target.value)} disabled={loading}
              style={{ ...inputLight, paddingRight: 44 }}
            />
            {emailValid && (
              <div style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                width: 24, height: 24, borderRadius: '50%', background: '#111111',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2">
                  <polyline points="2 6 5 9 10 3"/>
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Password */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>Password</div>
          <div style={{ position: 'relative' }}>
            <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} disabled={loading}
              style={{ ...inputLight, paddingRight: 44 }}
            />
            <button onClick={() => setShowPw(s => !s)} style={eyeBtn}><EyeIcon off={!showPw} /></button>
          </div>
        </div>

        <div style={{ textAlign: 'right', marginBottom: 20 }}>
          <button onClick={onForgot} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Forgot password?
          </button>
        </div>

        <button onClick={handleLogin} disabled={loading || !email || !password}
          style={{ ...btnBlack, opacity: (!email || !password) ? 0.4 : 1, marginBottom: 16 }}>
          {loading ? 'Verificando...' : 'Log in'}
        </button>

        {/* Or Login with */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
          <span style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>Or Login with</span>
          <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
        </div>

        {/* Social icons row */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
          {[
            { icon: <DiscordIcon size={22} color="#fff" />, bg: '#5865F2', onClick: signInWithDiscord },
          ].map((s, i) => (
            <button key={i} onClick={s.onClick}
              style={{
                width: 56, height: 56, borderRadius: 14,
                background: s.bg ?? '#fff',
                border: `1.5px solid ${s.border ?? 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: s.color ?? 'inherit',
              }}>
              {s.icon}
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
          Don't have an account?{' '}
          <button onClick={onSignUp} style={{ ...linkBtn, color: '#111111', fontWeight: 800 }}>
            Sign up
          </button>
        </div>
      </div>
    </div>
  )
}

// ── FORGOT PASSWORD ───────────────────────────
const StarIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="#111111">
    <path d="M16 0 C16 0 15 8 12 12 C8 15 0 16 0 16 C0 16 8 17 12 20 C15 24 16 32 16 32 C16 32 17 24 20 20 C24 17 32 16 32 16 C32 16 24 15 20 12 C17 8 16 0 16 0Z"/>
  </svg>
)

const SmallStarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 32 32" fill="#111111">
    <path d="M16 0 C16 0 15 8 12 12 C8 15 0 16 0 16 C0 16 8 17 12 20 C15 24 16 32 16 32 C16 32 17 24 20 20 C24 17 32 16 32 16 C32 16 24 15 20 12 C17 8 16 0 16 0Z"/>
  </svg>
)

export function ForgotPasswordScreen({ onBack, onDone }) {
  const [step,    setStep]    = useState('email')  // email | sent
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleSend = async () => {
    if (!email) return
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      })
      if (error) throw error
      setStep('sent')
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const wrapStyle = {
    flex: 1, background: '#FFFFFF', display: 'flex',
    flexDirection: 'column', overflow: 'hidden',
    padding: '20px 24px 40px', position: 'relative',
  }

  const backHeader = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
      <button onClick={onBack}
        style={{ width: 40, height: 40, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: '#111' }}>
        ‹
      </button>
      <StarIcon />
    </div>
  )

  // ── Step: Email ──
  if (step === 'email') return (
    <div style={wrapStyle}>
      {backHeader}
      <div style={{ fontSize: 28, fontWeight: 800, color: '#111111', letterSpacing: '-0.02em', marginBottom: 8 }}>Forgot password?</div>
      <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 32 }}>
        Don't worry! Enter the email associated with your account and we'll send you a reset link.
      </div>
      {error && <div style={errorBox}>{error}</div>}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>Email address</div>
        <input type="email" placeholder="Enter your email address" value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={inputLight}
        />
      </div>
      <button onClick={handleSend} disabled={loading || !email}
        style={{ ...btnBlack, opacity: !email ? 0.4 : 1, marginTop: 8 }}>
        {loading ? 'Enviando...' : 'Send reset link'}
      </button>
      <div style={{ textAlign: 'center', fontSize: 13, color: '#6B7280', marginTop: 'auto', paddingTop: 32 }}>
        Remember password?{' '}
        <button onClick={onBack} style={{ ...linkBtn, color: '#111111', fontWeight: 800 }}>Log in</button>
      </div>
    </div>
  )

  // ── Step: Sent ──
  return (
    <div style={{ ...wrapStyle, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 60, marginBottom: 20 }}>✉️</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#111111', letterSpacing: '-0.02em', marginBottom: 10 }}>
        Revisá tu email
      </div>
      <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 40 }}>
        Te enviamos un link de recuperación a{' '}
        <strong style={{ color: '#111111' }}>{email}</strong>.
        Hacé click en el link para crear una nueva contraseña.
      </div>
      <button onClick={onDone} style={btnBlack}>Volver al login</button>
    </div>
  )
}

// ── RESET PASSWORD (shown after magic-link recovery) ──────────────────────
export function ResetPasswordScreen({ onDone, recoverySession }) {
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)

  const handleReset = async () => {
    if (newPw.length < 6)    { setError('Mínimo 6 caracteres'); return }
    if (newPw !== confirmPw) { setError('Las contraseñas no coinciden'); return }
    setLoading(true); setError('')
    try {
      const token = recoverySession?.access_token
      if (!token) throw new Error('Sesión expirada. Pedí un nuevo link de recuperación.')

      // Call Supabase REST API directly with the recovery token —
      // bypasses the JS client auth state so no re-mount side effects
      const url    = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/user`
      const res    = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ password: newPw }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.msg || json?.message || 'Error al cambiar la contraseña')
      setDone(true)
    } catch (e) {
      setError(e.message || 'Error al cambiar la contraseña. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const wrapStyle = {
    flex: 1, background: '#FFFFFF', display: 'flex',
    flexDirection: 'column', overflow: 'hidden',
    padding: '20px 24px 40px',
  }

  if (done) return (
    <div style={{ ...wrapStyle, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <StarIcon />
        <div style={{ position: 'absolute', bottom: -6, right: -14 }}><SmallStarIcon /></div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: '#111111', letterSpacing: '-0.02em', marginBottom: 10 }}>
        Password changed
      </div>
      <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 40 }}>
        Your password has been changed successfully
      </div>
      <button onClick={onDone} style={btnBlack}>Continuar</button>
    </div>
  )

  return (
    <div style={wrapStyle}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
        <StarIcon />
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#111111', letterSpacing: '-0.02em', marginBottom: 8 }}>Reset password</div>
      <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 32 }}>
        Please type something you'll remember
      </div>
      {error && <div style={errorBox}>{error}</div>}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>New password</div>
        <div style={{ position: 'relative' }}>
          <input type={showPw ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={newPw}
            onChange={e => setNewPw(e.target.value)}
            style={{ ...inputLight, paddingRight: 44 }}
          />
          <button onClick={() => setShowPw(s => !s)} style={eyeBtn}><EyeIcon off={!showPw} /></button>
        </div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>Confirm new password</div>
        <div style={{ position: 'relative' }}>
          <input type={showPw ? 'text' : 'password'} placeholder="Repetir contraseña" value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            style={{ ...inputLight, paddingRight: 44 }}
          />
          <button onClick={() => setShowPw(s => !s)} style={eyeBtn}><EyeIcon off={!showPw} /></button>
        </div>
      </div>
      <button onClick={handleReset} disabled={loading || !newPw || !confirmPw}
        style={{ ...btnBlack, opacity: (!newPw || !confirmPw) ? 0.4 : 1 }}>
        {loading ? 'Guardando...' : 'Reset password'}
      </button>
    </div>
  )
}

// ── Shared styles ─────────────────────────────
const inputLight = {
  width: '100%', padding: '14px 16px',
  background: '#FFFFFF', border: '1.5px solid #E5E7EB',
  borderRadius: 12, color: '#111111', fontSize: 15,
  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
}

const btnBlack = {
  width: '100%', padding: '15px',
  background: '#111111', border: 'none', borderRadius: 14,
  color: '#FFFFFF', fontSize: 15, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
}

const socialBtn = {
  width: '100%', padding: '14px 20px',
  background: '#FFFFFF', border: 'none', borderRadius: 14,
  fontSize: 15, fontWeight: 600, color: '#111111',
  cursor: 'pointer', display: 'flex', alignItems: 'center',
  gap: 12, fontFamily: 'Inter, sans-serif',
}

const socialBtnLight = {
  ...socialBtn,
  background: '#FFFFFF', border: '1.5px solid #E5E7EB',
}

const linkBtn = {
  background: 'none', border: 'none', color: '#FFFFFF',
  fontWeight: 700, cursor: 'pointer', fontSize: 13,
  fontFamily: 'Inter, sans-serif', textDecoration: 'underline', padding: 0,
}

const eyeBtn = {
  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0,
}

const errorBox = {
  padding: '10px 14px', borderRadius: 12, marginBottom: 14,
  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
  color: '#EF4444', fontSize: 13,
}

// ── TERMS MODAL ───────────────────────────────
export function TermsModal({ onAccept, onClose, acceptOnly = false }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: '#111111', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 480, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        border: '1px solid #2A2A2A', borderBottom: 'none',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
              Términos y Condiciones
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Quest Hobby Store — Panamá</div>
          </div>
          {!acceptOnly && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 22, cursor: 'pointer', padding: 4 }}>✕</button>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#1F1F1F', margin: '16px 0 0' }} />

        {/* Content */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1, fontSize: 13, color: '#9CA3AF', lineHeight: 1.7, scrollbarWidth: 'none' }}>

          <Section title="1. Aceptación">
            Al crear una cuenta en Quest, aceptás estos Términos y Condiciones en su totalidad. Si no estás de acuerdo, no podrás usar la plataforma.
          </Section>

          <Section title="2. Uso de la plataforma">
            Quest es una plataforma comunitaria para jugadores de cartas coleccionables (TCG). Podés publicar contenido, registrar partidas, participar en torneos y comprar/vender cartas dentro de la comunidad.
          </Section>

          <Section title="3. Derecho de admisión">
            Quest Hobby Store se reserva el derecho de suspender o eliminar cualquier cuenta que incumpla estas normas, genere contenido inapropiado, acose a otros usuarios o actúe de manera contraria al espíritu de la comunidad. Esta decisión es definitiva y no requiere justificación previa.
          </Section>

          <Section title="4. Contenido del usuario">
            Sos responsable de todo el contenido que publiques. Queda prohibido publicar contenido ofensivo, discriminatorio, ilegal o que infrinja derechos de terceros. Quest puede eliminar contenido que viole estas normas sin previo aviso.
          </Section>

          <Section title="5. Comunicaciones y promociones">
            Al registrarte, aceptás recibir comunicaciones de Quest Hobby Store, incluyendo novedades, promociones, torneos y actualizaciones de la plataforma. Podés darte de baja en cualquier momento contactándonos directamente.
          </Section>

          <Section title="6. Privacidad">
            Recopilamos tu email y datos de perfil para operar la plataforma. No vendemos tu información a terceros. Tus datos se almacenan de forma segura en Supabase con cifrado en tránsito y en reposo.
          </Section>

          <Section title="7. Compraventa de cartas">
            Quest facilita el encuentro entre compradores y vendedores pero no es parte de las transacciones. No nos hacemos responsables por disputas entre usuarios en operaciones de compraventa.
          </Section>

          <Section title="8. Propiedad intelectual">
            Los nombres, imágenes y logos de los juegos de cartas (Pokémon, Magic, One Piece, etc.) pertenecen a sus respectivos dueños. Quest no tiene afiliación oficial con ninguna de estas marcas.
          </Section>

          <Section title="9. Modificaciones">
            Quest puede actualizar estos términos en cualquier momento. Te notificaremos por email o dentro de la app. El uso continuado de la plataforma implica aceptación de los nuevos términos.
          </Section>

          <Section title="10. Ley aplicable">
            Estos términos se rigen por las leyes de la República de Panamá. Cualquier disputa se resolverá en los tribunales competentes de la Ciudad de Panamá.
          </Section>

          <div style={{ height: 8 }} />
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 32px', borderTop: '1px solid #1F1F1F' }}>
          {acceptOnly ? (
            <button onClick={onAccept} style={{ ...btnBlack, background: '#A78BFA' }}>
              Acepto los Términos y Condiciones
            </button>
          ) : (
            <button onClick={onClose} style={btnBlack}>
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', marginBottom: 4 }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}
