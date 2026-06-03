import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, User } from 'lucide-react'

const ADMIN_CREDENTIALS = {
  name: 'Admin',
  password: '1q2w3e4@',
  id: '15610010',
}

export default function AdminLogin() {
  const navigate = useNavigate()
  const [adminName, setAdminName] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminId, setAdminId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    const isAuthorized =
      adminName === ADMIN_CREDENTIALS.name &&
      adminPassword === ADMIN_CREDENTIALS.password &&
      adminId === ADMIN_CREDENTIALS.id

    if (isAuthorized) {
      sessionStorage.setItem(
        'admin_session',
        JSON.stringify({
          name: adminName,
          id: adminId,
          loginTime: new Date().toISOString(),
        })
      )
      setIsLoading(false)
      navigate('/admin-dashboard')
      return
    }

    setIsLoading(false)
    setError('Invalid admin credentials. Please check name, password, and ID.')
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16 flex items-center justify-center">
      <div className="w-full max-w-md rounded-[2rem] bg-white border border-slate-200 p-8 shadow-xl">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">Admin Access</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">Secure Operator Login</h1>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-semibold text-slate-900">Admin Name</label>
            <div className="relative mt-2">
              <User size={18} className="absolute left-4 top-3.5 text-slate-400" />
              <input
                value={adminName}
                onChange={(event) => setAdminName(event.target.value)}
                placeholder="Admin name"
                className="w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 pl-12 text-slate-950 outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900">Admin ID</label>
            <div className="relative mt-2">
              <Lock size={18} className="absolute left-4 top-3.5 text-slate-400" />
              <input
                value={adminId}
                onChange={(event) => setAdminId(event.target.value)}
                placeholder="Admin ID"
                className="w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 pl-12 text-slate-950 outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900">Password</label>
            <div className="relative mt-2">
              <Lock size={18} className="absolute left-4 top-3.5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                placeholder="Enter password"
                className="w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 pl-12 pr-12 text-slate-950 outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
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
            <div className="rounded-3xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-3xl bg-[#84CC16] px-4 py-4 text-lg font-bold text-white transition hover:bg-lime-500 disabled:opacity-60"
          >
            {isLoading ? 'Verifying...' : 'Login'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          Authorized admin access only. All login activity is monitored.
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          Use credentials: Admin / 1q2w3e4@ / 15610010
        </p>
      </div>
    </div>
  )
}
