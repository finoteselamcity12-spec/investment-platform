import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, User, X } from 'lucide-react'

const PRIMARY_GREEN = '#84CC16'
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
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 px-4 py-4 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animation-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Admin Access</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Operator Login</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-950 transition active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-900">Name</label>
            <div className="relative mt-2">
              <User size={18} className="absolute left-4 top-3.5 text-slate-400" />
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Admin name"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-12 text-base text-slate-950 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900">Admin ID</label>
            <div className="relative mt-2">
              <Lock size={18} className="absolute left-4 top-3.5 text-slate-400" />
              <input
                type="text"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="Admin ID"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-12 text-base text-slate-950 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900">Password</label>
            <div className="relative mt-2">
              <Lock size={18} className="absolute left-4 top-3.5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-12 pr-12 text-base text-slate-950 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl px-4 py-4 text-base font-bold text-white transition active:scale-95 disabled:opacity-60"
            style={{
              backgroundColor: PRIMARY_GREEN,
              boxShadow: `0 4px 12px ${PRIMARY_GREEN}30`,
            }}
          >
            {isLoading ? 'Verifying...' : 'Login'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Authorized admin only. All login attempts are recorded.
        </p>
      </div>
    </div>
  )
}
