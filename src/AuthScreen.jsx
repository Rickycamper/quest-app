import { useState } from 'react'
import { supabase } from './supabase'

const GOLD = "#C9A84C"
const GOLD_LIGHT = "#E8C96A"
const BG = "#0A0A0C"
const SURFACE = "#111118"
const BORDER = "#252530"
const TEXT = "#E8E4D9"
const TEXT_DIM = "#6B6680"
const RED = "#E05252"
const GREEN = "#52C97A"

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else onAuth(data.user)
    setLoading(false)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    })
    if (error) setError(error.message)
    else setSuccess('¡Cuenta creada! Revisá tu email para confirmar.')
    setLoading(false)
  }

  const handleGoogle = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) setError(error.message)
    else setSuccess('Email de recuperación enviado.')
    setLoading(false)
  }

  return (
    <div style={styles.wrapper}>
      <style>{authCSS}</style>
      <div style={styles.phone}>

        {/* Background glow */}
        <div style={styles.bgGlow} />

        {/* Logo */}
        <div style={styles.logoArea}>
          <div style={styles.logoSymbol}>✦</div>
          <div style={styles.logoText}>QUEST</div>
          <div style={styles.logoSub}>TCG COMMUNITY</div>
        </div>

        {/* Tab switcher */}
        {mode !== 'forgot' && (
          <div style={styles.tabs}>
            <div
              style={{ ...styles.tab, ...(mode === 'login' ? styles.tabActive : {}) }}
              onClick={() => { setMode('login'); setError(''); setSuccess('') }}
            >
              INGRESAR
            </div>
            <div
              style={{ ...styles.tab, ...(mode === 'register' ? styles.tabActive : {}) }}
              onClick={() => { setMode('register'); setError(''); setSuccess('') }}
            >
              REGISTRARSE
            </div>
          </div>
        )}

        {/* Form */}
        <div style={styles.formWrap}>

          {mode === 'forgot' && (
            <div style={styles.backBtn} onClick={() => { setMode('login'); setError(''); setSuccess('') }}>
              ← Volver
            </div>
          )}

          {mode === 'forgot' && (
            <div style={styles.forgotTitle}>Recuperar contraseña</div>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleForgot}>

            {mode === 'register' && (
              <div style={styles.fieldWrap}>
                <label style={styles.label}>USUARIO</label>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="tu_nombre"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  style={styles.input}
                />
              </div>
            )}

            <div style={styles.fieldWrap}>
              <label style={styles.label}>EMAIL</label>
              <input
                className="auth-input"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={styles.input}
              />
            </div>

            {mode !== 'forgot' && (
              <div style={styles.fieldWrap}>
                <label style={styles.label}>CONTRASEÑA</label>
                <input
                  className="auth-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={styles.input}
                />
              </div>
            )}

            {error && <div style={styles.error}>{error}</div>}
            {success && <div style={styles.successMsg}>{success}</div>}

            <button
              type="submit"
              disabled={loading}
              style={{ ...styles.submitBtn, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? '...' : mode === 'login' ? 'INGRESAR' : mode === 'register' ? 'CREAR CUENTA' : 'ENVIAR EMAIL'}
            </button>
          </form>

          {mode === 'login' && (
            <div
              style={styles.forgotLink}
              onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
            >
              ¿Olvidaste tu contraseña?
            </div>
          )}

          {mode !== 'forgot' && (
            <>
              <div style={styles.divider}>
                <div style={styles.dividerLine} />
                <span style={styles.dividerText}>o</span>
                <div style={styles.dividerLine} />
              </div>

              <button
                onClick={handleGoogle}
                disabled={loading}
                style={{ ...styles.googleBtn, opacity: loading ? 0.6 : 1 }}
              >
                <span style={{ fontSize: 18 }}>G</span>
                <span>Continuar con Google</span>
              </button>
            </>
          )}
        </div>

        {/* Bottom decoration */}
        <div style={styles.bottomDeco}>
          <div style={styles.decoLine} />
          <span style={styles.decoText}>◆ PANAMÁ TCG ◆</span>
          <div style={styles.decoLine} />
        </div>
      </div>
    </div>
  )
}

const authCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');

  .auth-input::placeholder { color: ${TEXT_DIM}; opacity: 0.6; }
  .auth-input:focus {
    outline: none;
    border-color: ${GOLD} !important;
    box-shadow: 0 0 0 2px rgba(201,168,76,0.15);
  }
  .auth-input:-webkit-autofill,
  .auth-input:-webkit-autofill:hover,
  .auth-input:-webkit-autofill:focus {
    -webkit-text-fill-color: ${TEXT};
    -webkit-box-shadow: 0 0 0px 1000px ${SURFACE} inset;
    transition: background-color 5000s ease-in-out 0s;
  }
`

const styles = {
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#050507',
    padding: 20,
    fontFamily: "'Crimson Pro', serif",
  },
  phone: {
    width: 390,
    minHeight: 844,
    background: BG,
    borderRadius: 44,
    overflow: 'hidden',
    position: 'relative',
    border: '1.5px solid #2a2a35',
    boxShadow: '0 0 0 6px #0d0d0d, 0 0 80px rgba(201,168,76,0.08), 0 40px 120px rgba(0,0,0,0.9)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 28px 40px',
  },
  bgGlow: {
    position: 'absolute',
    top: -100,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 300,
    height: 300,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  logoArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
    zIndex: 1,
  },
  logoSymbol: {
    fontSize: 32,
    color: GOLD,
    marginBottom: 8,
    filter: 'drop-shadow(0 0 12px rgba(201,168,76,0.6))',
  },
  logoText: {
    fontFamily: "'Cinzel', serif",
    fontSize: 42,
    fontWeight: 900,
    letterSpacing: '0.12em',
    background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, #8A6B2C)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: 1,
  },
  logoSub: {
    fontFamily: "'Cinzel', serif",
    fontSize: 11,
    letterSpacing: '0.3em',
    color: TEXT_DIM,
    marginTop: 6,
  },
  tabs: {
    display: 'flex',
    width: '100%',
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 28,
    position: 'relative',
    zIndex: 1,
  },
  tab: {
    flex: 1,
    padding: '12px 0',
    textAlign: 'center',
    fontFamily: "'Cinzel', serif",
    fontSize: 10,
    letterSpacing: '0.12em',
    color: TEXT_DIM,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: 'rgba(201,168,76,0.1)',
    color: GOLD,
    borderBottom: `2px solid ${GOLD}`,
  },
  formWrap: {
    width: '100%',
    position: 'relative',
    zIndex: 1,
  },
  backBtn: {
    fontFamily: "'Cinzel', serif",
    fontSize: 11,
    color: TEXT_DIM,
    cursor: 'pointer',
    marginBottom: 16,
    letterSpacing: '0.06em',
  },
  forgotTitle: {
    fontFamily: "'Cinzel', serif",
    fontSize: 16,
    fontWeight: 700,
    color: TEXT,
    letterSpacing: '0.04em',
    marginBottom: 20,
  },
  fieldWrap: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontFamily: "'Cinzel', serif",
    fontSize: 9,
    letterSpacing: '0.2em',
    color: TEXT_DIM,
    marginBottom: 7,
  },
  input: {
    width: '100%',
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: '13px 16px',
    fontFamily: "'Crimson Pro', serif",
    fontSize: 15,
    color: TEXT,
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  },
  error: {
    background: 'rgba(224,82,82,0.08)',
    border: `1px solid rgba(224,82,82,0.25)`,
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: RED,
    marginBottom: 14,
    fontFamily: "'Crimson Pro', serif",
  },
  successMsg: {
    background: 'rgba(82,201,122,0.08)',
    border: `1px solid rgba(82,201,122,0.25)`,
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: GREEN,
    marginBottom: 14,
    fontFamily: "'Crimson Pro', serif",
  },
  submitBtn: {
    width: '100%',
    padding: '15px 0',
    background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
    border: 'none',
    borderRadius: 12,
    fontFamily: "'Cinzel', serif",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: '#0A0A0C',
    cursor: 'pointer',
    marginTop: 4,
    marginBottom: 12,
    transition: 'opacity 0.2s, transform 0.1s',
    boxShadow: '0 4px 20px rgba(201,168,76,0.3)',
  },
  forgotLink: {
    textAlign: 'center',
    fontSize: 12,
    color: TEXT_DIM,
    cursor: 'pointer',
    marginTop: 4,
    marginBottom: 4,
    fontFamily: "'Crimson Pro', serif",
    textDecoration: 'underline',
    textDecorationColor: 'rgba(107,102,128,0.4)',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '20px 0',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: BORDER,
  },
  dividerText: {
    fontFamily: "'Crimson Pro', serif",
    fontSize: 13,
    color: TEXT_DIM,
  },
  googleBtn: {
    width: '100%',
    padding: '13px 0',
    background: 'transparent',
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    fontFamily: "'Cinzel', serif",
    fontSize: 10,
    letterSpacing: '0.1em',
    color: TEXT,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'border-color 0.2s, background 0.2s',
  },
  bottomDeco: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 'auto',
    paddingTop: 32,
    width: '100%',
    position: 'relative',
    zIndex: 1,
  },
  decoLine: {
    flex: 1,
    height: 1,
    background: `linear-gradient(to right, transparent, ${BORDER})`,
  },
  decoText: {
    fontFamily: "'Cinzel', serif",
    fontSize: 8,
    letterSpacing: '0.2em',
    color: TEXT_DIM,
    opacity: 0.5,
  },
}
