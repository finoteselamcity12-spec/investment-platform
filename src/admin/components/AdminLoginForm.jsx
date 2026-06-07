import { useState } from 'react'
import { ensureAdminSupabaseSession } from '../lib/adminSupabase'

const ADMIN_EMAIL = 'workinehabche@gmail.com'

export default function AdminLoginForm({ onSuccess }) {
  const [activeTab, setActiveTab] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const normalizedEmail = email.trim().toLowerCase()
    if (normalizedEmail !== ADMIN_EMAIL) {
      setError(`Only ${ADMIN_EMAIL} is allowed to access this page.`)
      return
    }

    if (!password) {
      setError('Please enter your password.')
      return
    }

    const supabaseAuth = await ensureAdminSupabaseSession(password)
    if (!supabaseAuth.ok) {
      setError(supabaseAuth.error || 'Unable to login. Please check your password.')
      return
    }

    sessionStorage.setItem(
      'admin_session',
      JSON.stringify({ email: ADMIN_EMAIL, loginTime: new Date().toISOString() })
    )
    onSuccess()
  }

  const canSubmit = email.trim().length > 0 && password.length > 0
  const cardStyle = {
    width: '100%',
    maxWidth: '420px',
    background: '#ffffff',
    borderRadius: '26px',
    padding: '32px',
    boxShadow: '0 28px 80px rgba(0, 0, 0, 0.14)',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#7DC400',
        padding: '24px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '12px' }}>🪙🪙🪙🪙🪙</div>
        <div style={{ fontSize: '2.65rem', fontWeight: 900, color: '#F5A623', letterSpacing: '0.18em' }}>
          BLACKROCK
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', background: '#f4f5f7', borderRadius: '999px', padding: '4px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('signin')}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: '999px',
              padding: '12px 0',
              fontWeight: 700,
              color: activeTab === 'signin' ? '#ffffff' : '#334155',
              background: activeTab === 'signin' ? '#22A400' : 'transparent',
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: '999px',
              padding: '12px 0',
              fontWeight: 700,
              color: activeTab === 'register' ? '#334155' : '#334155',
              background: activeTab === 'register' ? '#e2e8f0' : 'transparent',
              cursor: 'pointer',
            }}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label htmlFor="admin-email" style={{ display: 'block', marginBottom: '8px', color: '#111827', fontWeight: 600 }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#16a34a',
                  fontSize: '1.05rem',
                }}
              >
                ✉️
              </span>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={{
                  width: '100%',
                  borderRadius: '18px',
                  border: '1px solid #d1d5db',
                  padding: '14px 16px 14px 44px',
                  fontSize: '1rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="admin-password" style={{ display: 'block', marginBottom: '8px', color: '#111827', fontWeight: 600 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  borderRadius: '18px',
                  border: '1px solid #d1d5db',
                  padding: '14px 48px 14px 16px',
                  fontSize: '1rem',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  color: '#64748b',
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: '16px', color: '#b91c1c', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              borderRadius: '18px',
              border: 'none',
              padding: '14px',
              fontSize: '1rem',
              fontWeight: 700,
              color: '#ffffff',
              background: canSubmit ? '#22A400' : '#9ca3af',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s ease',
            }}
            disabled={!canSubmit}
          >
            Sign In
          </button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              type="button"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#15803d',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setError('Please contact support to reset your admin password.')}
            >
              Forgot password?
            </button>
          </div>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '18px' }}>
          <button
            type="button"
            style={{
              border: 'none',
              background: 'transparent',
              color: '#F5A623',
              fontWeight: 700,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
            onClick={() => setError('Please review the terms and conditions with the administrator.')}
          >
            Terms and Conditions
          </button>
        </div>
      </div>
    </div>
  )
}
