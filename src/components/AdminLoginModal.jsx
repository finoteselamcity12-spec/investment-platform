import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, User, X } from 'lucide-react'

const ADMIN_CREDENTIALS = {
  name: 'investment',
  password: '1q2w3e4r5t6y7@investment',
  id: '15610010',
}

export default function AdminLoginModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [adminName, setAdminName] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminId, setAdminId] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    setTimeout(() => {
      if (
        adminName === ADMIN_CREDENTIALS.name &&
        adminPassword === ADMIN_CREDENTIALS.password &&
        adminId === ADMIN_CREDENTIALS.id
      ) {
        sessionStorage.setItem(
          'admin_session',
          JSON.stringify({
            name: adminName,
            id: adminId,
            loginTime: new Date().toISOString(),
          })
        )

        navigate('/admin-dashboard')
        onClose()
      } else {
        setError('Invalid admin credentials. Please try again.')
        setIsLoading(false)
      }
    }, 400)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl shadow-slate-900/10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">Admin Access</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Secure Operator Login</h2>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-950 transition hover:bg-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-900">Admin Name</label>
            <div className="relative mt-2">
              <User className="absolute left-3 top-3 h-5 w-5 text-emerald-600" />
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="investment"
                className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-12 py-3 text-slate-950 outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900">Admin ID</label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-emerald-600" />
              <input
                type="text"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="15610010"
                className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-12 py-3 text-slate-950 outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900">Password</label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-emerald-600" />
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="1q2w3e4r5t6y7@investment"
                className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-12 py-3 text-slate-950 outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>
          </div>

          {error && <div className="rounded-3xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-3xl bg-[#84CC16] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#84CC16]/20 transition hover:bg-lime-500 disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Login as Admin'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Authorized admin only. All login attempts are recorded.
        </p>
      </div>
    </div>
  )
}
