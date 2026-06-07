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
      (event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#84CC16',color:'white',fontSize:'1.5rem'}}>Loading...</div>

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={!user ? <Auth /> : <Navigate to={user.email === ADMIN_EMAIL ? '/admin-dashboard' : '/dashboard'} />} />
          <Route path="/register" element={!user ? <Auth /> : <Navigate to={user.email === ADMIN_EMAIL ? '/admin-dashboard' : '/dashboard'} />} />
          <Route path="/" element={!user ? <Auth /> : <Navigate to={user.email === ADMIN_EMAIL ? '/admin-dashboard' : '/dashboard'} />} />

          {/* User dashboard */}
          <Route path="/dashboard" element={user && user.email !== ADMIN_EMAIL ? <UserDashboard user={user} /> : <Navigate to="/login" />} />

          {/* Admin dashboard */}
          <Route path="/admin-dashboard" element={user && user.email === ADMIN_EMAIL ? <AdminDashboard user={user} /> : <Navigate to="/login" />} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  )
}

export default App
