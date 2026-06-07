import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import supabase from './lib/supabase'
import Auth from './pages/Auth'
import UserDashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import ErrorBoundary from './components/ErrorBoundary'

const ADMIN_EMAIL = 'workinehabche@gmail.com'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  if (loading) return null

  const isAdmin = user?.email === ADMIN_EMAIL

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route
            path="/"
            element={
              !user ? <Auth /> :
              isAdmin ? <Navigate to="/admin-dashboard" replace /> :
              <Navigate to="/dashboard" replace />
            }
          />
          <Route
            path="/login"
            element={
              !user ? <Auth /> :
              isAdmin ? <Navigate to="/admin-dashboard" replace /> :
              <Navigate to="/dashboard" replace />
            }
          />
          <Route
            path="/register"
            element={
              !user ? <Auth /> :
              isAdmin ? <Navigate to="/admin-dashboard" replace /> :
              <Navigate to="/dashboard" replace />
            }
          />
          <Route
            path="/dashboard"
            element={
              !user ? <Navigate to="/login" replace /> :
              isAdmin ? <Navigate to="/admin-dashboard" replace /> :
              <UserDashboard user={user} />
            }
          />
          <Route
            path="/dashboard/*"
            element={
              !user ? <Navigate to="/login" replace /> :
              isAdmin ? <Navigate to="/admin-dashboard" replace /> :
              <UserDashboard user={user} />
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              !user ? <Navigate to="/login" replace /> :
              !isAdmin ? <Navigate to="/dashboard" replace /> :
              <AdminDashboard user={user} />
            }
          />
          <Route
            path="/admin-dashboard/*"
            element={
              !user ? <Navigate to="/login" replace /> :
              !isAdmin ? <Navigate to="/dashboard" replace /> :
              <AdminDashboard user={user} />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  )
}

export default App
