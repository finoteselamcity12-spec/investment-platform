import { useState } from 'react'
import { ADMIN_EMAIL, ADMIN_CREDENTIALS } from '../lib/adminStorage'
import { ensureAdminSupabaseSession } from '../lib/adminSupabase'

export default function AdminLoginForm({ onSuccess }) {
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setLoginError('')

    if (loginEmail.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase()) {
      setLoginError(`Only ${ADMIN_EMAIL} may login to the admin console.`)
      return
    }

    if (loginPassword !== ADMIN_CREDENTIALS.password) {
      setLoginError('Invalid admin password.')
      return
    }

    const supabaseAuth = await ensureAdminSupabaseSession(loginPassword)
    if (!supabaseAuth.ok) {
      setLoginError(supabaseAuth.error)
      return
    }

    const session = {
      email: ADMIN_EMAIL,
      loginTime: new Date().toISOString(),
    }
    sessionStorage.setItem('admin_session', JSON.stringify(session))
    onSuccess(session)
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', color: '#84cc16', textTransform: 'uppercase' }}>
          Blackrock Admin
        </p>
        <h2 style={{ marginTop: '0.5rem', fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
          Operator Login
        </h2>

        <form onSubmit={handleSubmit} style={{ marginTop: '1.25rem' }}>
          <div className="admin-field">
            <label htmlFor="admin-email">Admin Email</label>
            <input
              id="admin-email"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="workinehabche@gmail.com"
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {loginError && (
            <p style={{ marginBottom: '0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: '#fca5a5' }}>{loginError}</p>
          )}
          <button type="submit" className="admin-btn admin-btn-approve" style={{ width: '100%', padding: '0.75rem' }}>
            Login to Console
          </button>
        </form>
      </div>
    </div>
  )
}
