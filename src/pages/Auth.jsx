import { useMemo, useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import supabase from '../lib/supabase'

const initialForm = { fullName: '', email: '', password: '', confirmPassword: '' }

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isLogin, setIsLogin] = useState(true)
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [referrerId, setReferrerId] = useState('')

  const isRegister = !isLogin
  const canSubmit = useMemo(() => {
    if (isRegister) {
      return (
        form.fullName.trim().length > 1 &&
        form.email.trim().length > 0 &&
        form.password.length >= 8 &&
        form.password === form.confirmPassword
      )
    }
    return form.email.trim().length > 0 && form.password.length >= 8
  }, [form, isRegister])

  useEffect(() => {
    // Capture referral id from query param if present
    try {
      const params = new URLSearchParams(location.search)
      const ref = params.get('ref') || ''
      if (ref) setReferrerId(ref)
    } catch (e) {
      // ignore
    }
  }, [location.search])

  async function handleAuth(event) {
    event.preventDefault()
    if (!canSubmit) {
      return setMessage('Please complete all fields correctly.')
    }

    setLoading(true)
    setMessage('')

    try {
      if (isRegister) {
        // Generate a unique userId for referrals and internal mapping
        const userId = `user-${Date.now()}`

        let signupError = null
        try {
          const { error } = await supabase.auth.signUp({
            email: form.email,
            password: form.password,
            options: {
              data: { full_name: form.fullName },
            },
          })
          if (error) signupError = error
        } catch (e) {
          signupError = e
        }

        // Persist registration in localStorage so the app records new users (always save locally)
        const users = JSON.parse(localStorage.getItem('platform_registered_users_data') || '{}')
        users[form.email] = {
          userId,
          fullName: form.fullName,
          email: form.email,
          referredBy: referrerId || null,
          createdAt: new Date().toISOString(),
        }
        localStorage.setItem('platform_registered_users_data', JSON.stringify(users))

        // Also keep a simple list for counts used elsewhere (store emails)
        const registered = JSON.parse(localStorage.getItem('platform_registered_users') || '[]')
        if (!registered.includes(form.email)) {
          registered.push(form.email)
          localStorage.setItem('platform_registered_users', JSON.stringify(registered))
        }

        // Initialize user wallet record used by admin tools
        const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
        if (!userData[form.email]) {
          userData[form.email] = {
            id: userId,
            email: form.email,
            fullName: form.fullName,
            usdBalance: 0,
            etbBalance: 0,
            bonusEligible: false,
            bonusClaimed: false,
          }
          localStorage.setItem('admin_user_data', JSON.stringify(userData))
        } else {
          // Ensure fullName and id are synced if missing
          if (!userData[form.email].fullName) userData[form.email].fullName = form.fullName
          if (!userData[form.email].id) userData[form.email].id = userId
          localStorage.setItem('admin_user_data', JSON.stringify(userData))
        }

        // Redirect to login page after successful registration
        if (signupError) {
          setMessage(`Account saved locally, but sign-up returned an issue: ${signupError.message || signupError}. You can still login.`)
        } else {
          setMessage('Account created successfully. Redirecting to login...')
        }
        navigate('/login')
        return
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (error) throw error
      navigate('/dashboard')
    } catch (error) {
      // Show a clear error alert if registration fails
      setMessage(error?.message || 'Registration failed, please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-lime-400 to-lime-500 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle animated background gradient overlay */}
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.8),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.4),transparent_50%)]" />

      <div className="text-center relative z-10 mb-8">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[2.5rem] bg-white/90 shadow-[0_28px_60px_rgba(16,185,129,0.18)] ring-1 ring-white/60">
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-[2rem] bg-gradient-to-br from-lime-400 to-emerald-600 text-white shadow-lg shadow-emerald-700/30">
            <span className="text-3xl font-black tracking-[0.2em]">IP</span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.35em] font-semibold">Investment Platform</span>
          </div>
        </div>
      </div>

      <div className="auth-container w-full max-w-md bg-white rounded-3xl rounded-b-3xl p-8 md:p-10 shadow-2xl transition-all relative z-10" style={{
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.8)'
      }}>
        <div className="mb-8 flex overflow-hidden rounded-full bg-gray-100 p-1 shadow-md border border-gray-200">
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            className={`flex-1 rounded-full px-5 py-3 text-sm font-bold transition-all duration-300 ${
              isLogin 
                ? 'bg-gradient-to-r from-lime-400 to-lime-500 text-white shadow-lg' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            className={`flex-1 rounded-full px-5 py-3 text-sm font-bold transition-all duration-300 ${
              !isLogin 
                ? 'bg-gradient-to-r from-lime-400 to-lime-500 text-white shadow-lg' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          {isRegister && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                placeholder="Enter your full name"
                className="auth-input-field w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-lime-400 focus:bg-white focus:ring-2 focus:ring-lime-400/30 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Mobile Number</label>
            <div className="flex overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 focus-within:ring-2 focus-within:ring-lime-400">
              <span className="inline-flex items-center bg-lime-50 px-4 text-sm font-semibold text-slate-700">
                (+251)
              </span>
              <input
                type="tel"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="912 345 678"
                className="min-w-0 flex-1 border-none bg-transparent px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="relative">
            <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Enter your password"
              className="auth-input-field w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-lime-400 focus:bg-white focus:ring-2 focus:ring-lime-400/30 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {isRegister && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Confirm Password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                placeholder="Confirm your password"
                className="auth-input-field w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-lime-400 focus:bg-white focus:ring-2 focus:ring-lime-400/30 transition-all"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full bg-gradient-to-r from-lime-400 to-lime-500 hover:from-lime-500 hover:to-lime-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:shadow-md text-base tracking-wide"
          >
            {loading ? 'Processing...' : isLogin ? 'LOGIN' : 'CREATE ACCOUNT'}
          </button>

          {message && (
            <div className="rounded-xl border-l-4 border-lime-400 bg-lime-50 px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm">
              {message}
            </div>
          )}
        </form>
      </div>

    </div>
  )
}

