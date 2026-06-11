// ─────────────────────────────────────────────
// QUEST — Auth Screens
// ─────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { signInWithEmail, signUpWithEmail, signInWithDiscord, sendOtpCode, verifyOtpCode, supabase } from '../lib/supabase'
import { EyeIcon, DiscordIcon, MailIcon } from '../components/Icons'

// Map raw Supabase OAuth error strings to friendly Spanish messages.
// The "Ya existe una cuenta con ese email" branch is the most common — 235
// users signed up with email before Quest had Discord OAuth, so when they
// try Discord today Supabase rejects (email conflict). The message tells
// them the exact path to fix it: log in with email first, then connect
// Discord from their profile (the linkIdentity flow we built).
export function friendlyOAuthError(raw) {
  if (!raw) return null
  if (/user already registered|email.*already|already.*email|already been registered/i.test(raw))
    return 'Tu email ya está registrado en Quest. Iniciá sesión con email y contraseña, después podés vincular Discord desde tu perfil → "Cuentas Vinculadas".'
  if (/database error|saving new user/i.test(raw))
    return 'Hubo un problema al conectar con Discord. Intentá de nuevo.'
  if (/access.?denied|canceled|cancelled/i.test(raw))
    return 'Acceso cancelado. Podés intentar de nuevo con Discord o usar email.'
  if (/email.*not confirmed|unconfirmed/i.test(raw))
    return 'Tu email no ha sido confirmado aún. Iniciá sesión con email y reenviá el email de confirmación.'
  if (/identity.*already/i.test(raw))
    return 'Esta cuenta de Discord ya está vinculada a otro usuario.'
  return `Error al conectar: ${raw}`
}
import monsters    from '../assets/Asset 3-sm.png'
import questLogo   from '../assets/quest-logo-sm.png'
import skull       from '../assets/skull-sm.png'
import qLogo       from '../assets/q-logo.png'

// ── OPENING ───────────────────────────────────
// Detect in-app browsers (WhatsApp, Instagram, Facebook, TikTok, etc.)
// that use an isolated webview — Discord OAuth opens in the system browser,
// causing the PKCE verifier to be lost when returning to the app.
function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|Instagram|WhatsApp|TikTok|Line\/|Twitter\/|Snapchat|Pinterest|LinkedInApp/i.test(ua)
}

export function OpeningScreen({ onSignIn, onSignUp, onGuest, oauthError }) {
  // oauthError is already translated by App.jsx before being passed here
  const errMsg = oauthError ?? null
  const inApp  = isInAppBrowser()

  // ── Email OTP code fallback ───────────────────────────────────────────
  // Shown inline INSIDE the Discord-error banner. Two phases:
  //   1) user types email → we send a 6-digit code
  //   2) user types the code → we verify, session is created instantly
  // Bypasses PKCE/OAuth entirely so users stuck in Discord-PKCE-hell get in.
  const [mlEmail,    setMlEmail]    = useState('')
  const [mlCode,     setMlCode]     = useState('')
  const [mlSending,  setMlSending]  = useState(false)
  const [mlVerifying,setMlVerifying]= useState(false)
  const [mlSent,     setMlSent]     = useState(false)  // entered phase 2
  const [mlError,    setMlError]    = useState('')

  const handleSendOtpCode = async () => {
    if (!mlEmail.trim()) { setMlError('Escribí tu email primero.'); return }
    setMlSending(true); setMlError('')
    try {
      await sendOtpCode(mlEmail)
      setMlSent(true)
    } catch (e) {
      setMlError(e.message || 'No se pudo enviar el código.')
    }
    setMlSending(false)
  }

  const handleVerifyOtpCode = async () => {
    if (!mlCode.trim()) { setMlError('Escribí el código que recibiste.'); return }
    setMlVerifying(true); setMlError('')
    try {
      await verifyOtpCode(mlEmail, mlCode)
      // onAuthStateChange will pick up SIGNED_IN and move the user into the app.
      // We don't need to navigate manually — App.jsx handles routing on session.
    } catch (e) {
      setMlError(e.message || 'No se pudo verificar el código.')
    }
    setMlVerifying(false)
  }

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
        <div style={{
          fontSize: 28, fontWeight: 800, color: '#FFFFFF',
          textAlign: 'center', marginBottom: 10,
          letterSpacing: '-0.025em',
          lineHeight: 1.15,
        }}>
          Entrá a Quest
        </div>
        <div style={{
          fontSize: 14.5, color: '#9CA3AF', textAlign: 'center',
          lineHeight: 1.5, marginBottom: 30,
          fontWeight: 400, letterSpacing: '-0.005em',
        }}>
          La comunidad TCG de Panamá — competí, coleccioná y conectá.
        </div>

        {/* In-app browser warning (WhatsApp, Instagram, etc.) */}
        {inApp && !errMsg && (
          <div style={{
            marginBottom: 14, padding: '10px 14px', borderRadius: 12,
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
            color: '#FCD34D', fontSize: 12, lineHeight: 1.5,
          }}>
            💡 Estás en un navegador integrado. Para conectarte con Discord abrí esta página en <strong>Safari o Chrome</strong> primero.
          </div>
        )}

        {/* OAuth error banner — now bundles the magic-link recovery flow.
            The most common Discord failure is a PKCE exchange that never
            recovers (in-app browser context switch, iOS Safari ITP, etc.).
            Retrying Discord usually fails the same way. Magic link bypasses
            OAuth entirely so users who are stuck can get back in. */}
        {errMsg && (
          <div style={{
            marginBottom: 14, padding: '12px 14px 12px', borderRadius: 12,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#FCA5A5', fontSize: 13, lineHeight: 1.5,
          }}>
            ⚠️ {errMsg}

            {/* Phase 1 — request a 6-digit code by email */}
            {!mlSent && (
              <div style={{
                marginTop: 12, paddingTop: 12,
                borderTop: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{ fontSize: 12, color: '#FED7D7', fontWeight: 600, marginBottom: 8 }}>
                  Recibí un código de 6 dígitos al email:
                </div>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={mlEmail}
                  onChange={e => setMlEmail(e.target.value)}
                  placeholder="tu@email.com"
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    background: '#1A1A1A', border: '1px solid #2A2A2A',
                    color: '#FFF', fontSize: 13,
                    outline: 'none', boxSizing: 'border-box',
                    marginBottom: 8,
                  }}
                />
                {mlError && (
                  <div style={{ fontSize: 11, color: '#FCA5A5', marginBottom: 8 }}>
                    {mlError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={handleSendOtpCode}
                    disabled={mlSending || !mlEmail.trim()}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                      background: (mlSending || !mlEmail.trim()) ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                      color: (mlSending || !mlEmail.trim()) ? '#6B7280' : '#111111',
                      fontSize: 12, fontWeight: 800,
                      cursor: (mlSending || !mlEmail.trim()) ? 'default' : 'pointer',
                    }}
                  >
                    {mlSending ? 'Enviando…' : '📩 Enviar código'}
                  </button>
                  <button
                    onClick={signInWithDiscord}
                    style={{
                      padding: '8px 12px', borderRadius: 8, border: 'none',
                      background: 'rgba(88,101,242,0.18)', color: '#A5B4FC',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            )}

            {/* Phase 2 — user types the 6-digit code they received */}
            {mlSent && (
              <div style={{
                marginTop: 12, paddingTop: 12,
                borderTop: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{ fontSize: 12, color: '#FED7D7', fontWeight: 600, marginBottom: 6 }}>
                  Te enviamos un código a <strong style={{ color: '#FFF' }}>{mlEmail}</strong>
                </div>
                <div style={{ fontSize: 10.5, color: '#9CA3AF', lineHeight: 1.5, marginBottom: 10 }}>
                  Revisá tu email (también spam) — escribilo acá:
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={mlCode}
                  onChange={e => setMlCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    background: '#1A1A1A', border: '1px solid #2A2A2A',
                    color: '#FFF', fontSize: 18, fontWeight: 800,
                    letterSpacing: '0.4em', textAlign: 'center',
                    fontFamily: 'monospace',
                    outline: 'none', boxSizing: 'border-box',
                    marginBottom: 8,
                  }}
                />
                {mlError && (
                  <div style={{ fontSize: 11, color: '#FCA5A5', marginBottom: 8 }}>
                    {mlError}
                  </div>
                )}
                <button
                  onClick={handleVerifyOtpCode}
                  disabled={mlVerifying || mlCode.length !== 6}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                    background: (mlVerifying || mlCode.length !== 6) ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                    color: (mlVerifying || mlCode.length !== 6) ? '#6B7280' : '#111111',
                    fontSize: 13, fontWeight: 800,
                    cursor: (mlVerifying || mlCode.length !== 6) ? 'default' : 'pointer',
                    marginBottom: 6,
                  }}
                >
                  {mlVerifying ? 'Verificando…' : 'Entrar →'}
                </button>
                <button
                  onClick={() => { setMlSent(false); setMlCode(''); setMlError('') }}
                  style={{
                    width: '100%', padding: '7px', borderRadius: 8,
                    background: 'transparent', border: 'none',
                    color: '#9CA3AF', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  No me llegó — enviar de nuevo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={signInWithDiscord} className="pressable" style={{
            ...socialBtn,
            boxShadow: '0 4px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.4)',
            transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <DiscordIcon size={20} /> Continuar con Discord
          </button>
          <button onClick={onSignUp} className="pressable" style={{
            ...socialBtn,
            boxShadow: '0 4px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.4)',
            transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <MailIcon size={18} /> Continuar con Email
          </button>
          <button onClick={onGuest} className="pressable" style={{
            ...socialBtn,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#E5E7EB',
            gap: 8,
            boxShadow: 'none',
            transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <span style={{ fontSize: 16 }}>⚔️</span>
            Explorar sin cuenta
          </button>
        </div>

        <div style={{
          textAlign: 'center', fontSize: 13.5,
          color: '#9CA3AF', marginTop: 22,
          letterSpacing: '-0.005em',
        }}>
          ¿Ya tenés cuenta?{' '}
          <button onClick={onSignIn} style={linkBtn}>Iniciar sesión</button>
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
    if (password.length < 8)  { setError('Mínimo 8 caracteres'); return }
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
      if (e?.isNetworkError || e?.name === 'AbortError' || /fetch|network|load failed/i.test(e?.message)) {
        setError('Sin conexión. Verificá tu internet e intentá de nuevo.')
      } else if (/already registered|user_already_exists|already exists/i.test(e?.message || e?.code || '')) {
        setError('Ya tenés una cuenta con ese email. Iniciá sesión en vez de registrarte.')
      } else {
        setError(e.message || 'No se pudo crear la cuenta. Intentá de nuevo.')
      }
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
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={inputLight}
          />
        </div>

        <div style={{ marginBottom: 12, position: 'relative' }}>
          <input type={showPw ? 'text' : 'password'} placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            style={{ ...inputLight, paddingRight: 44 }}
          />
          <button onClick={() => setShowPw(s => !s)} style={eyeBtn}><EyeIcon off={!showPw} /></button>
        </div>

        <div style={{ marginBottom: 20, position: 'relative' }}>
          <input type={showPw ? 'text' : 'password'} placeholder="Confirm password" value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
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
export function LoginScreen({ onBack, onSignUp, onForgot, oauthError }) {
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [showPw,        setShowPw]        = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [errorType,     setErrorType]     = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent,    setResendSent]    = useState(false)
  // Email OTP code fallback — for users whose Discord OAuth keeps failing.
  // Two-phase: send a code → user types the 6-digit code → verifyOtp creates
  // the session directly (no PKCE, no redirect, no link to click).
  const [magicMode,      setMagicMode]      = useState(false)
  const [magicSending,   setMagicSending]   = useState(false)
  const [magicVerifying, setMagicVerifying] = useState(false)
  const [magicSent,      setMagicSent]      = useState(false)
  const [magicCode,      setMagicCode]      = useState('')
  const [magicError,     setMagicError]     = useState('')

  const handleSendOtpCode = async () => {
    if (!email.trim()) { setMagicError('Ingresá tu email primero.'); return }
    setMagicSending(true); setMagicError('')
    try {
      await sendOtpCode(email)
      setMagicSent(true)
    } catch (e) {
      setMagicError(e.message || 'No se pudo enviar el código. Intentá de nuevo.')
    }
    setMagicSending(false)
  }

  const handleVerifyOtpCode = async () => {
    if (!magicCode.trim()) { setMagicError('Escribí el código recibido.'); return }
    setMagicVerifying(true); setMagicError('')
    try {
      await verifyOtpCode(email, magicCode)
      // onAuthStateChange handles SIGNED_IN — App.jsx will route into the app.
    } catch (e) {
      setMagicError(e.message || 'No se pudo verificar el código.')
    }
    setMagicVerifying(false)
  }

  const oauthErrMsg = friendlyOAuthError(oauthError)

  const handleLogin = async () => {
    setLoading(true); setError(''); setErrorType('')
    try {
      await signInWithEmail(email, password)
    } catch (e) {
      const code = e.code || e.error_code || ''
      if (e?.isNetworkError || e?.name === 'AbortError' || /fetch|network|load failed/i.test(e?.message)) {
        setError('Sin conexión. Verificá tu internet e intentá de nuevo.')
      } else if (code === 'email_not_confirmed' || e.message?.includes('Email not confirmed')) {
        setError('Confirmá tu email primero — revisá tu bandeja de entrada.')
        setErrorType('email_not_confirmed')
      } else if (e.message?.includes('Invalid login credentials') || e.message?.includes('invalid_credentials')) {
        // ── Discord-only users have no password — when they try email login
        // they hit this branch. Instead of just showing "wrong credentials"
        // (confusing, they're sure their email is correct), we *automatically*
        // send them a 6-digit code so they can get in without setting up a
        // password. Reduces support load: the recovery path is one tap.
        if (email.trim()) {
          try {
            await sendOtpCode(email)
            setMagicSent(true)
            setMagicMode(true)
            setError('')
            setErrorType('')
          } catch (otpErr) {
            // OTP failed too (e.g. user genuinely doesn't exist) — fall
            // back to the original "invalid credentials" message.
            setError(otpErr.message?.includes('No encontramos')
              ? 'No existe una cuenta con ese email.'
              : 'Email o contraseña incorrectos.')
          }
        } else {
          setError('Email o contraseña incorrectos.')
        }
      } else {
        setError(e.message || 'No se pudo iniciar sesión.')
      }
    }
    setLoading(false)
  }

  const handleResend = async () => {
    if (!email || resendLoading) return
    setResendLoading(true)
    try {
      const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
      if (resendErr) throw resendErr
      setResendSent(true)
      setError('Email de confirmación reenviado. Revisá tu bandeja de entrada.')
      setErrorType('')
    } catch {
      setError('No se pudo reenviar. Verificá el email e intentá de nuevo.')
    }
    setResendLoading(false)
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
        <img src={qLogo} alt="Q" style={{ width: 52, objectFit: 'contain', marginBottom: 14 }} />
        <div style={{
          fontSize: 30, fontWeight: 800, color: '#111111',
          letterSpacing: '-0.025em', marginBottom: 6, lineHeight: 1.1,
        }}>
          Iniciar sesión
        </div>
        <div style={{
          fontSize: 14, color: '#6B7280',
          letterSpacing: '-0.005em', marginBottom: 24, lineHeight: 1.5,
        }}>
          Volvé a tu cuenta de Quest para seguir compitiendo.
        </div>

        {/* OAuth error banner (passed from failed Discord redirect) */}
        {oauthErrMsg && !error && (
          <div style={{ ...errorBox, marginBottom: 14 }}>⚠️ {oauthErrMsg}</div>
        )}

        {error && (
          <div style={{ ...errorBox, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span>{error}</span>
            {errorType === 'email_not_confirmed' && !resendSent && (
              <button
                onClick={handleResend}
                disabled={resendLoading || !email}
                style={{
                  alignSelf: 'flex-start', padding: '6px 12px',
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 8, color: '#F87171', fontSize: 12, fontWeight: 700,
                  cursor: (!email || resendLoading) ? 'default' : 'pointer',
                  fontFamily: 'Inter, sans-serif', opacity: (!email || resendLoading) ? 0.5 : 1,
                }}
              >
                {resendLoading ? 'Enviando...' : '↩ Reenviar email de confirmación'}
              </button>
            )}
          </div>
        )}

        {/* Email */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>Email address</div>
          <div style={{ position: 'relative' }}>
            <input type="email" placeholder="helloworld@gmail.com" value={email}
              onChange={e => setEmail(e.target.value)} disabled={loading}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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
              autoComplete="current-password"
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
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 10 }}>
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

        {/* Discord onboarding tip — most existing users signed up with email
            before Discord OAuth existed. Without this hint they'd hit a
            cryptic "email already registered" error trying Discord directly.
            The path is: login with email first → connect Discord from profile. */}
        <div style={{
          fontSize: 11, color: '#6B7280', textAlign: 'center',
          lineHeight: 1.5, marginBottom: 14, padding: '0 8px',
        }}>
          ¿Ya tenés cuenta con email? Entrá primero con tu email y vinculá Discord desde tu perfil.
        </div>

        {/* Magic link fallback — for users whose Discord OAuth keeps failing
            (PKCE flow can break in WhatsApp/Instagram in-app browsers, iOS
            Safari ITP, etc.). They receive a clickable link in their email
            that logs them in directly, bypassing OAuth entirely.            */}
        {/* Code-by-email entry — promoted from a small text link to a real
            CTA card so users actually notice it. Most "I can't log in" cases
            are solved with this; we want it discoverable. */}
        {!magicMode && !magicSent && (
          <button
            onClick={() => { setMagicMode(true); setMagicError('') }}
            style={{
              width: '100%', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(167,139,250,0.10) 0%, rgba(96,165,250,0.10) 100%)',
              border: '1.5px solid rgba(167,139,250,0.35)',
              cursor: 'pointer', textAlign: 'left',
              transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms',
              boxShadow: '0 4px 14px -4px rgba(167,139,250,0.18)',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(167,139,250,0.28)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 14px -4px rgba(167,139,250,0.18)'}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp  ={e => e.currentTarget.style.transform = 'scale(1)'}
            onTouchStart={e => e.currentTarget.style.transform = 'scale(0.98)'}
            onTouchEnd  ={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{
              width: 42, height: 42, borderRadius: 11,
              background: 'linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
              boxShadow: '0 4px 12px -2px rgba(167,139,250,0.5)',
            }}>⚡</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111111', marginBottom: 2 }}>
                Entrar sin contraseña
              </div>
              <div style={{ fontSize: 11.5, color: '#4B5563', lineHeight: 1.4 }}>
                Te mandamos un código al email y entrás en 5 segundos.
              </div>
            </div>
            <span style={{ fontSize: 16, color: '#A78BFA', fontWeight: 700, flexShrink: 0 }}>→</span>
          </button>
        )}

        {/* Phase 1 — request 6-digit code (expanded card after CTA tap). */}
        {magicMode && !magicSent && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(167,139,250,0.10) 0%, rgba(96,165,250,0.10) 100%)',
            border: '1.5px solid rgba(167,139,250,0.35)',
            borderRadius: 14, padding: '16px',
            marginBottom: 16, animation: 'fadeUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 4px 14px -4px rgba(167,139,250,0.18)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
                boxShadow: '0 4px 10px -2px rgba(167,139,250,0.5)',
              }}>⚡</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111111' }}>
                  Entrar sin contraseña
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4 }}>
                  {email ? `Te mandamos un código a tu email` : 'Escribí tu email arriba primero'}
                </div>
              </div>
            </div>
            {magicError && (
              <div style={{
                fontSize: 11.5, color: '#B91C1C',
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.22)',
                borderRadius: 9, padding: '8px 11px', marginBottom: 10,
              }}>
                ⚠️ {magicError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleSendOtpCode}
                disabled={magicSending || !email}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                  background: (magicSending || !email)
                    ? '#E5E7EB'
                    : 'linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)',
                  color: (magicSending || !email) ? '#9CA3AF' : '#FFFFFF',
                  fontSize: 13, fontWeight: 800,
                  cursor: (magicSending || !email) ? 'default' : 'pointer',
                  boxShadow: (magicSending || !email)
                    ? 'none'
                    : '0 4px 12px -2px rgba(167,139,250,0.5)',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {magicSending ? 'Enviando…' : '📩 Enviame el código'}
              </button>
              <button
                onClick={() => { setMagicMode(false); setMagicError('') }}
                style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'transparent', border: '1px solid #E5E7EB',
                  color: '#6B7280', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Phase 2 — user types the 6-digit code, we verify */}
        {magicSent && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(74,222,128,0.12) 0%, rgba(96,165,250,0.10) 100%)',
            border: '1.5px solid rgba(74,222,128,0.35)',
            borderRadius: 14, padding: '18px 16px 14px',
            marginBottom: 16,
            animation: 'fadeUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 6px 18px -4px rgba(74,222,128,0.22)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: 'linear-gradient(135deg, #4ADE80 0%, #60A5FA 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0,
                boxShadow: '0 4px 12px -2px rgba(74,222,128,0.5)',
              }}>📩</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#065F46' }}>
                  ¡Código enviado!
                </div>
                <div style={{ fontSize: 11, color: '#047857', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Revisá <strong>{email}</strong> (también spam)
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: '#065F46', letterSpacing: '0.08em', marginBottom: 6 }}>
              ESCRIBÍ EL CÓDIGO DE 6 DÍGITOS:
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={magicCode}
              onChange={e => setMagicCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="• • • • • •"
              autoFocus
              style={{
                width: '100%', padding: '14px', borderRadius: 12,
                background: '#FFFFFF', border: '2px solid rgba(74,222,128,0.4)',
                color: '#111', fontSize: 26, fontWeight: 900,
                letterSpacing: '0.5em', textAlign: 'center',
                fontFamily: 'monospace',
                outline: 'none', boxSizing: 'border-box',
                marginBottom: 10,
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
              }}
            />
            {magicError && (
              <div style={{
                fontSize: 11.5, color: '#B91C1C',
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.22)',
                borderRadius: 9, padding: '8px 11px', marginBottom: 10,
              }}>
                ⚠️ {magicError}
              </div>
            )}
            <button
              onClick={handleVerifyOtpCode}
              disabled={magicVerifying || magicCode.length !== 6}
              style={{
                width: '100%', padding: '13px', borderRadius: 11, border: 'none',
                background: (magicVerifying || magicCode.length !== 6)
                  ? '#E5E7EB'
                  : 'linear-gradient(135deg, #4ADE80 0%, #60A5FA 100%)',
                color: (magicVerifying || magicCode.length !== 6) ? '#9CA3AF' : '#FFFFFF',
                fontSize: 15, fontWeight: 800,
                cursor: (magicVerifying || magicCode.length !== 6) ? 'default' : 'pointer',
                boxShadow: (magicVerifying || magicCode.length !== 6)
                  ? 'none'
                  : '0 4px 14px -2px rgba(74,222,128,0.5)',
                marginBottom: 6,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {magicVerifying ? 'Entrando…' : 'Entrar →'}
            </button>
            <button
              onClick={() => { setMagicSent(false); setMagicCode(''); setMagicError('') }}
              style={{
                width: '100%', padding: '8px',
                background: 'transparent', border: 'none',
                color: '#059669', fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              No me llegó — enviar de nuevo
            </button>
          </div>
        )}

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
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/`,
      })
      if (error) throw error
      setStep('sent')
    } catch (e) {
      if (e?.isNetworkError || e?.name === 'AbortError' || /fetch|network|load failed/i.test(e?.message)) {
        setError('Sin conexión. Verificá tu internet e intentá de nuevo.')
      } else {
        setError(e.message || 'No se pudo enviar el email. Intentá de nuevo.')
      }
    }
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
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
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
    if (newPw.length < 8)    { setError('Mínimo 8 caracteres'); return }
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
          <input type={showPw ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={newPw}
            onChange={e => setNewPw(e.target.value)}
            autoComplete="new-password"
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
            autoComplete="new-password"
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
