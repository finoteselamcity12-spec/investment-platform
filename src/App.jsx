import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Auth from './pages/Auth'
import DashboardRedesigned from './pages/DashboardRedesigned'
import AdminDashboard from './pages/AdminDashboard'
import Withdraw from './pages/Withdraw'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/register" element={<Auth />} />
        <Route path="/dashboard" element={<DashboardRedesigned />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/withdraw" element={<Withdraw />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
