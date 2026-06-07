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
        <div className="admin-login-header">
          <span className="admin-login-subtitle">BLACKROCK OPERATOR</span>
          <h1>Admin Console Login</h1>
          <p className="admin-login-description">Secure access for the platform operator. Login with the authorized admin email to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-field">
            <label htmlFor="admin-email" className="admin-label">
              Admin Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="workinehabche@gmail.com"
              className="admin-input"
              required
            />
          </div>

          <div className="admin-field">
            <label htmlFor="admin-password" className="admin-label">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="••••••••"
              className="admin-input"
              required
            />
          </div>

          {loginError && <p className="admin-message">{loginError}</p>}

          <button type="submit" className="admin-btn admin-login-button">
            Login to Console
          </button>
        </form>

        <p className="admin-login-foot">
          Only <strong>{ADMIN_EMAIL}</strong> can access the admin console.
        </p>
      </div>
    </div>
  )
}
