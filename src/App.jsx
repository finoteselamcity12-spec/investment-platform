import { useState, useEffect } from 'react'
import { BrowserRouter as Router } from 'react-router-dom'
import supabase from './lib/supabase'
import LoginPage from './pages/Login'
import UserDashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import ErrorBoundary from './components/ErrorBoundary'

const ADMIN_EMAIL = 'workinehabche@gmail.com'

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

  if (loading) return <div>Loading...</div>
  if (!user) {
    return (
      <Router>
        <LoginPage />
      </Router>
    )
  }

  const isAdmin = user.email === ADMIN_EMAIL

  if (isAdmin) {
    return (
      <Router>
        <AdminDashboard user={user} />
      </Router>
    )
  }

  return (
    <Router>
      <UserDashboard user={user} />
    </Router>
  )
}

export default App
