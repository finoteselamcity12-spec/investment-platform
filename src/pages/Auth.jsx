import { useMemo, useState, useEffect } from 'react'
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import supabase from '../lib/supabase'
import { createSession, validators, sanitizeInput, updateUserProfile } from '../lib/authService'

const initialForm = { fullName: '', email: '', password: '', confirmPassword: '' }
const emailRegex = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/

function validateEmail(email) {
  return emailRegex.test(String(email).trim())
}

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
        validateEmail(form.email) &&
        form.password.length >= 8 &&
        form.password === form.confirmPassword
      )
    }
    return validateEmail(form.email) && form.password.length >= 8
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

    // Keep the tab state in sync with the current route
    if (location.pathname === '/register') {
      setIsLogin(false)
    } else if (location.pathname === '/login' || location.pathname === '/') {
      setIsLogin(true)
    }
  }, [location.pathname, location.search])

  async function handleAuth(event) {
    event.preventDefault()
    
    // Server-side input validation
    const emailValidation = validators.email(form.email)
    if (!emailValidation.valid) {
      setMessage(emailValidation.error)
      return
    }

    const passwordValidation = validators.password(form.password)
    if (!passwordValidation.valid) {
      setMessage(passwordValidation.errors?.[0] || 'Password does not meet security requirements')
      return
    }

    if (!canSubmit) {
      return setMessage('Please complete all fields correctly.')
    }

    setLoading(true)
    setMessage('')

    try {
      if (isRegister) {
        // Validate full name
        const nameValidation = validators.fullName(form.fullName)
        if (!nameValidation.valid) {
          setMessage(nameValidation.error)
          setLoading(false)
          return
        }

        // Check password match
        if (form.password !== form.confirmPassword) {
          setMessage('Passwords do not match')
          setLoading(false)
          return
        }

        // Generate a unique userId for referrals and internal mapping
        const userId = `user-${Date.now()}`
        const sanitizedName = sanitizeInput(form.fullName.trim())
        const sanitizedEmail = sanitizeInput(form.email.trim())

        let signupError = null
        try {
          const { error } = await supabase.auth.signUp({
            email: sanitizedEmail,
            password: form.password,
            options: {
              data: { full_name: sanitizedName },
            },
          })
          if (error) signupError = error
        } catch (e) {
          signupError = e
        }

        if (signupError) {
          const errorMessage = String(signupError.message || signupError || '')
          if (errorMessage.toLowerCase().includes('already')) {
            setMessage('Account already exists')
          } else {
            setMessage(errorMessage || 'Registration failed, please try again.')
          }
          setLoading(false)
          return
        }

        // Persist registration in localStorage so the app records new users (always save locally)
        const users = JSON.parse(localStorage.getItem('platform_registered_users_data') || '{}')
        users[sanitizedEmail] = {
          userId,
          fullName: sanitizedName,
          email: sanitizedEmail,
          referredBy: referrerId || null,
          createdAt: new Date().toISOString(),
        }
        localStorage.setItem('platform_registered_users_data', JSON.stringify(users))

        // Also keep a simple list for counts used elsewhere (store emails)
        const registered = JSON.parse(localStorage.getItem('platform_registered_users') || '[]')
        if (!registered.includes(sanitizedEmail)) {
          registered.push(sanitizedEmail)
          localStorage.setItem('platform_registered_users', JSON.stringify(registered))
        }

        // Initialize user wallet record used by admin tools
        const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
        if (!userData[sanitizedEmail]) {
          userData[sanitizedEmail] = {
            id: userId,
            email: sanitizedEmail,
            fullName: sanitizedName,
            usdBalance: 0,
            etbBalance: 0,
            bonusEligible: false,
            bonusClaimed: false,
            totalDeposits: 0,
            totalWithdrawals: 0,
            activeInvestments: 0,
          }
          localStorage.setItem('admin_user_data', JSON.stringify(userData))
        } else {
          if (!userData[sanitizedEmail].fullName) userData[sanitizedEmail].fullName = sanitizedName
          if (!userData[sanitizedEmail].id) userData[sanitizedEmail].id = userId
          localStorage.setItem('admin_user_data', JSON.stringify(userData))
        }

        setMessage('Registration successful. Redirecting to login...')
        setForm(initialForm)
        setIsLogin(true)
        setTimeout(() => navigate('/login'), 1500)
        return
      }

      // Login with enhanced validation
      const sanitizedEmail = sanitizeInput(form.email.trim())
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password: form.password,
      })

      if (error) throw error

      // Create secure session with JWT
      const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
      const userProfile = userData[sanitizedEmail] || { id: user?.id, fullName: user?.user_metadata?.full_name, email: sanitizedEmail }
      
      createSession({
        id: user?.id || userProfile.id,
        email: sanitizedEmail,
        fullName: user?.user_metadata?.full_name || userProfile.fullName,
        profileImage: null,
      })

      // Update last login
      userData[sanitizedEmail] = {
        ...userData[sanitizedEmail],
        lastLogin: new Date().toISOString(),
      }
      localStorage.setItem('admin_user_data', JSON.stringify(userData))

      navigate('/dashboard')
    } catch (error) {
      const errorMessage = String(error?.message || error || '')
      if (errorMessage.toLowerCase().includes('invalid')) {
        setMessage('Invalid email or password')
      } else if (errorMessage.toLowerCase().includes('already')) {
        setMessage('Account already exists')
      } else {
        setMessage(errorMessage || 'Authentication failed, please try again.')
      }
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
          <div className="auth-logo-inner flex h-24 w-24 flex-col items-center justify-center rounded-[2rem] text-white">
            <span className="text-3xl font-black tracking-[0.2em] drop-shadow-[0_2px_12px_rgba(0,0,0,0.18)]">IP</span>
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
            onClick={() => {
              setIsLogin(true)
              setMessage('')
              navigate('/login')
            }}
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
            onClick={() => {
              setIsLogin(false)
              setMessage('')
              navigate('/register')
            }}
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
            <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="name@example.com"
              className="auth-input-field w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-lime-400 focus:bg-white focus:ring-2 focus:ring-lime-400/30 transition-all"
            />
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

