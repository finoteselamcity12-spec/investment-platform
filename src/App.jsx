import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
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
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin-dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  )
}

export default App
