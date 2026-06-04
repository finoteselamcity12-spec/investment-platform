import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLoginForm from '../admin/components/AdminLoginForm'
import '../admin/admin.css'

export default function AdminLogin() {
  const navigate = useNavigate()

  useEffect(() => {
    const stored = JSON.parse(sessionStorage.getItem('admin_session') || 'null')
    if (stored?.name === 'Admin') {
      navigate('/admin-dashboard', { replace: true })
    }
  }, [navigate])

  return (
    <AdminLoginForm
      onSuccess={() => {
        navigate('/admin-dashboard')
      }}
    />
  )
}
