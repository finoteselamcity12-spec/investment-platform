import { useState } from 'react'
import { ADMIN_CREDENTIALS } from '../lib/adminStorage'

export default function AdminLoginForm({ onSuccess }) {
  const [loginName, setLoginName] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginId, setLoginId] = useState('')
  const [loginError, setLoginError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setLoginError('')

    if (
      loginName === ADMIN_CREDENTIALS.name &&
      loginPassword === ADMIN_CREDENTIALS.password &&
      loginId === ADMIN_CREDENTIALS.id
    ) {
      const session = {
        name: loginName,
        id: loginId,
        email: 'workinehabche@gmail.com',
        loginTime: new Date().toISOString(),
      }
      sessionStorage.setItem('admin_session', JSON.stringify(session))
      onSuccess(session)
      return
    }

    setLoginError('Invalid admin credentials. Please check name, password, and ID.')
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
            <label htmlFor="admin-name">Admin Name</label>
            <input id="admin-name" value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="Admin" required />
          </div>
          <div className="admin-field">
            <label htmlFor="admin-id">Admin ID</label>
            <input id="admin-id" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="15610010" required />
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
