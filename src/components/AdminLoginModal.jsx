import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, User, X } from 'lucide-react'

export default function AdminLoginModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [adminName, setAdminName] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminId, setAdminId] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const ADMIN_CREDENTIALS = {
    name: 'investment',
    password: '1q2w3e4r5t6y7@investment',
    id: '15610010',
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Simulate validation delay
    setTimeout(() => {
      if (
        adminName === ADMIN_CREDENTIALS.name &&
        adminPassword === ADMIN_CREDENTIALS.password &&
        adminId === ADMIN_CREDENTIALS.id
      ) {
        // Store admin session
        sessionStorage.setItem(
          'admin_session',
          JSON.stringify({
            name: adminName,
            id: adminId,
            loginTime: new Date().toISOString(),
          })
        )

        // Navigate to admin dashboard
        navigate('/admin-dashboard')
        onClose()
      } else {
        setError('Invalid admin credentials. Please try again.')
        setIsLoading(false)
      }
    }, 500)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-zinc-950">Admin Login</h2>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-zinc-950 transition hover:bg-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-zinc-950">Admin Name</label>
            <div className="relative mt-2">
              <User className="absolute left-3 top-3 h-5 w-5 text-blue-600" />
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Enter admin name"
                className="w-full rounded-lg border border-gray-300 bg-slate-50 pl-10 pr-4 py-3 text-zinc-950 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-zinc-950">Admin ID</label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-blue-600" />
              <input
                type="text"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="Enter admin ID"
                className="w-full rounded-lg border border-gray-300 bg-slate-50 pl-10 pr-4 py-3 text-zinc-950 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-zinc-950">Password</label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-blue-600" />
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-lg border border-gray-300 bg-slate-50 pl-10 pr-4 py-3 text-zinc-950 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Login as Admin'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          For authorized personnel only. Unauthorized access attempts are logged.
        </p>
      </div>
    </div>
  )
}
