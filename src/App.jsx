import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import supabase from './lib/supabase'
import Login from './pages/Login'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import Withdraw from './pages/Withdraw'
import SupportPage from './components/SupportPage'
import ErrorBoundary from './components/ErrorBoundary'
import { getSession } from './lib/authService'

const ADMIN_EMAIL = 'workinehabche@gmail.com'

function RequireAdmin({ children }) {
  const session = getSession()
  const adminSession = JSON.parse(sessionStorage.getItem('admin_session') || 'null')
  const isAuthorized = session?.user?.email === ADMIN_EMAIL || adminSession?.email === ADMIN_EMAIL
  const redirectTo = session ? '/dashboard' : '/login'

  if (!isAuthorized) {
    return <Navigate to={redirectTo} replace />
  }

  return children
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session check error:', error)
      }
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<Navigate to="/admin-dashboard" replace />} />
          <Route
            path="/admin-dashboard"
            element={
              <RequireAdmin>
                <AdminDashboard />
              </RequireAdmin>
            }
          />
          <Route path="/withdraw" element={user ? <Withdraw /> : <Navigate to="/login" replace />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  )
}

export default App
