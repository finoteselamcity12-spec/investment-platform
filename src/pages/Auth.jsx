import { useMemo, useState, useEffect } from 'react'
import { Eye, EyeOff, Mail } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import supabase from '../lib/supabase'
import { createSession, validators, sanitizeInput } from '../lib/authService'
import {
  REGISTRATION_BONUS_ETB,
  REGISTRATION_BONUS_USD,
} from '../lib/platformConfig'
import { syncProfileAfterSignup, fetchUserBalances } from '../lib/supabaseData'
import TermsAndConditionsPanel from '../components/TermsAndConditionsPanel'

const initialForm = {
  email: '',
  password: '',
  confirmPassword: '',
}

function displayNameFromEmail(email) {
  const local = String(email).split('@')[0] || 'User'
  return local.replace(/[._-]+/g, ' ').trim() || 'User'
}
const emailRegex = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/
const ADMIN_EMAIL = 'workinehabche@gmail.com'
const ADMIN_PASSWORD = '1q2w3e4@'
const ADMIN_ID = '15610010'

function validateEmail(email) {
  return emailRegex.test(String(email).trim())
}

const PRIMARY_GREEN = '#84CC16'

const inputWithIconClass =
  'auth-input-field w-full rounded-xl border-2 border-gray-200 bg-gray-50 py-3 pr-4 pl-12 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-[#84CC16] focus:bg-white focus:ring-2 focus:ring-[#84CC16]/25 transition-all'

function AuthIconField({ label, required, icon: Icon, valid, children }) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-700">
        <span>{label}</span>
        {required && <span className="text-xs font-semibold text-[#84CC16]">(Required)</span>}
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${PRIMARY_GREEN}18`, color: PRIMARY_GREEN }}
          aria-hidden="true"
        >
          <Icon size={18} />
        </span>
        {children}
      </div>
      {required && valid && (
        <p className="mt-1.5 text-xs font-medium text-[#2e7d32]">Valid</p>
      )}
    </div>
  )
}

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isLogin, setIsLogin] = useState(true)
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [referrerId, setReferrerId] = useState('')

  const isRegister = !isLogin
  const isEmailValid = validateEmail(form.email)

  const canSubmit = useMemo(() => {
    if (isRegister) {
      return (
        isEmailValid &&
        form.password.length >= 8 &&
        form.password === form.confirmPassword
      )
    }
    return isEmailValid && form.password.length >= 8
  }, [form, isRegister, isEmailValid])

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search)
      const ref = params.get('ref') || ''
      if (ref) setReferrerId(ref)
    } catch {
      // ignore
    }

    if (location.pathname === '/register') {
      setIsLogin(false)
    } else if (location.pathname === '/login' || location.pathname === '/') {
      setIsLogin(true)
    }
  }, [location.pathname, location.search])

  async function handleAuth(event) {
    event.preventDefault()

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
        if (form.password !== form.confirmPassword) {
          setMessage('Passwords do not match')
          setLoading(false)
          return
        }

        const userId = `user-${Date.now()}`
        const sanitizedEmail = sanitizeInput(form.email.trim())
        const sanitizedName = displayNameFromEmail(sanitizedEmail)

        let signupError = null
        let authUserId = null
        try {
          const { data, error } = await supabase.auth.signUp({
            email: sanitizedEmail,
            password: form.password,
            options: {
              data: {
                full_name: sanitizedName,
                referred_by: referrerId || null,
              },
            },
          })
          if (error) signupError = error
          authUserId = data?.user?.id || null
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

        if (authUserId) {
          await syncProfileAfterSignup({
            userId: authUserId,
            email: sanitizedEmail,
            fullName: sanitizedName,
            referrerCode: referrerId,
          })
        }

        const users = JSON.parse(localStorage.getItem('platform_registered_users_data') || '{}')
        users[sanitizedEmail] = {
          userId: authUserId || userId,
          fullName: sanitizedName,
          email: sanitizedEmail,
          referredBy: referrerId || null,
          createdAt: new Date().toISOString(),
        }
        localStorage.setItem('platform_registered_users_data', JSON.stringify(users))

        const registered = JSON.parse(localStorage.getItem('platform_registered_users') || '[]')
        if (!registered.includes(sanitizedEmail)) {
          registered.push(sanitizedEmail)
          localStorage.setItem('platform_registered_users', JSON.stringify(registered))
        }

        const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')

        if (!userData[sanitizedEmail]) {
          userData[sanitizedEmail] = {
            id: authUserId || userId,
            email: sanitizedEmail,
            fullName: sanitizedName,
            usdBalance: REGISTRATION_BONUS_USD,
            etbBalance: REGISTRATION_BONUS_ETB,
            bonusEligible: true,
            bonusClaimed: true,
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

      const sanitizedEmail = sanitizeInput(form.email.trim())

      if (sanitizedEmail === ADMIN_EMAIL && form.password === ADMIN_PASSWORD) {
        createSession({
          id: ADMIN_ID,
          email: ADMIN_EMAIL,
          fullName: 'Admin Operator',
          profileImage: null,
        })

        sessionStorage.setItem(
          'admin_session',
          JSON.stringify({
            name: 'Admin',
            id: ADMIN_ID,
            email: ADMIN_EMAIL,
            loginTime: new Date().toISOString(),
          })
        )

        navigate('/admin-dashboard')
        return
      }

      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password: form.password,
      })

      if (error) throw error

      const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
      const userProfile = userData[sanitizedEmail] || {
        id: user?.id,
        fullName: user?.user_metadata?.full_name,
        email: sanitizedEmail,
        usdBalance: REGISTRATION_BONUS_USD,
        etbBalance: REGISTRATION_BONUS_ETB,
      }

      if (user?.id) {
        const remoteBalances = await fetchUserBalances(user.id)
        if (remoteBalances) {
          userProfile.usdBalance = remoteBalances.usdBalance
          userProfile.etbBalance = remoteBalances.etbBalance
        }
      }

      createSession({
        id: user?.id || userProfile.id,
        email: sanitizedEmail,
        fullName: user?.user_metadata?.full_name || userProfile.fullName,
        profileImage: null,
      })

      userData[sanitizedEmail] = {
        ...userProfile,
        ...userData[sanitizedEmail],
        id: user?.id || userProfile.id,
        usdBalance: userProfile.usdBalance ?? REGISTRATION_BONUS_USD,
        etbBalance: userProfile.etbBalance ?? REGISTRATION_BONUS_ETB,
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
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.8),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.4),transparent_50%)]" />

      <h1 className="blackrock-3d-text" data-text="BLACKROCK">BLACKROCK</h1>

      <div
        className={`auth-container w-full bg-white rounded-3xl rounded-b-3xl p-8 md:p-10 shadow-2xl transition-all relative z-10 ${
          isRegister ? 'max-w-md' : 'max-w-md'
        }`}
        style={{
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.8)',
        }}
      >
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

        {isRegister && referrerId && (
          <p className="mb-4 rounded-xl border border-lime-200 bg-lime-50 px-4 py-2 text-center text-xs font-semibold text-lime-800">
            You were invited by a friend. Your referral will be linked after sign-up.
          </p>
        )}

        <form
          onSubmit={handleAuth}
          className={`space-y-5 ${isRegister ? 'mx-auto w-full max-w-sm' : ''}`}
        >
          <AuthIconField
            label="Email Address"
            required={isRegister}
            icon={Mail}
            valid={isEmailValid}
          >
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="name@example.com"
              required
              autoComplete="email"
              className={`${inputWithIconClass} ${isRegister && isEmailValid ? 'border-[#84CC16]/60' : ''}`}
            />
          </AuthIconField>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
            <div className="relative">
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

          {isRegister && !canSubmit && form.email && (
            <p className="text-center text-xs text-gray-500">
              Enter a valid email and matching passwords (8+ characters) to register.
            </p>
          )}

          {isLogin && (
            <div className="mt-4 text-right">
              <a href="/support" className="text-sm font-semibold text-slate-900 hover:text-slate-700">
                Forgot password?
              </a>
            </div>
          )}

          {message && (
            <div className="rounded-xl border-l-4 border-lime-400 bg-lime-50 px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm mt-4">
              {message}
            </div>
          )}

          <div className="mt-6 border-t border-gray-200 pt-5">
            <button
              type="button"
              onClick={() => setShowTerms((prev) => !prev)}
              className="w-full text-center text-sm font-bold text-lime-700 underline decoration-lime-400/60 underline-offset-4 transition hover:text-lime-800"
              aria-expanded={showTerms}
            >
              Terms and Conditions
            </button>
            {showTerms && (
              <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-lime-200 bg-lime-50/90 px-4 py-4">
                <TermsAndConditionsPanel />
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
