import { useMemo, useState, useEffect } from 'react'
import { Eye, EyeOff, Mail, User } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import supabase from '../lib/supabase'
import { createSession, validators, sanitizeInput } from '../lib/authService'
import {
  REGISTRATION_BONUS_ETB,
  REGISTRATION_BONUS_USD,
} from '../lib/platformConfig'
import { syncProfileAfterSignup, fetchUserBalances } from '../lib/supabaseData'
import { handleLoginSignupBonusCheck } from '../lib/bonusHistory'
import TermsAndConditionsPanel from '../components/TermsAndConditionsPanel'

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/
const ADMIN_EMAIL = 'workinehabche@gmail.com'
const ADMIN_PASSWORD = '1q2w3e4@'
const ADMIN_ID = '15610010'

function validateEmail(email) {
  return emailRegex.test(String(email).trim())
}

function validateFullName(name) {
  return validators.fullName(name).valid
}

const PRIMARY_GREEN = '#84CC16'

const inputBaseClass =
  'auth-input-field w-full rounded-xl border-2 border-gray-200 bg-gray-50 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-[#84CC16] focus:bg-white focus:ring-2 focus:ring-[#84CC16]/25 transition-all'

const inputWithIconClass = `${inputBaseClass} pr-4 pl-12`

function AuthIconField({ label, required, icon: Icon, valid, hint, children }) {
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
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      {required && valid && (
        <p className="mt-1.5 text-xs font-medium text-[#2e7d32]">Looks good</p>
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
  const [messageType, setMessageType] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [referrerId, setReferrerId] = useState('')

  const isRegister = !isLogin
  const isFullNameValid = validateFullName(form.fullName)
  const isEmailValid = validateEmail(form.email)
  const passwordsMatch =
    form.password.length > 0 &&
    form.confirmPassword.length > 0 &&
    form.password === form.confirmPassword
  const passwordMismatch =
    isRegister &&
    form.confirmPassword.length > 0 &&
    form.password !== form.confirmPassword

  const canSubmit = useMemo(() => {
    if (isRegister) {
      return (
        isFullNameValid &&
        isEmailValid &&
        form.password.length >= 8 &&
        passwordsMatch
      )
    }
    return isEmailValid && form.password.length >= 8
  }, [form, isRegister, isFullNameValid, isEmailValid, passwordsMatch])

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

  function setFeedback(text, type = '') {
    setMessage(text)
    setMessageType(type)
  }

  async function handleAuth(event) {
    event.preventDefault()

    const emailValidation = validators.email(form.email)
    if (!emailValidation.valid) {
      setFeedback(emailValidation.error, 'error')
      return
    }

    const passwordValidation = validators.password(form.password)
    if (!passwordValidation.valid) {
      setFeedback(
        passwordValidation.errors?.[0] || 'Password does not meet security requirements',
        'error'
      )
      return
    }

    if (isRegister) {
      const nameValidation = validators.fullName(form.fullName)
      if (!nameValidation.valid) {
        setFeedback(nameValidation.error, 'error')
        return
      }

      if (form.password !== form.confirmPassword) {
        setFeedback('Password and Confirm Password must match exactly.', 'error')
        return
      }
    }

    if (!canSubmit) {
      setFeedback('Please complete all required fields correctly.', 'error')
      return
    }

    setLoading(true)
    setFeedback('', '')

    try {
      if (isRegister) {
        const userId = `user-${Date.now()}`
        const sanitizedName = sanitizeInput(form.fullName.trim())
        const sanitizedEmail = sanitizeInput(form.email.trim())

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
          const status = signupError.status || signupError.code
          if (errorMessage.toLowerCase().includes('already')) {
            setFeedback('An account with this email already exists. Please sign in.', 'error')
          } else if (status === 500 || errorMessage.includes('500')) {
            setFeedback(
              'Server error during sign-up. Run migration 004_fix_registration_trigger.sql in Supabase, then try again.',
              'error'
            )
          } else {
            setFeedback(errorMessage || 'Registration failed. Please try again.', 'error')
          }
          setLoading(false)
          return
        }

        if (!authUserId) {
          setFeedback(
            'Account may have been created. Check your email to confirm, then sign in.',
            'success'
          )
          setLoading(false)
          return
        }

        const profileResult = await syncProfileAfterSignup({
          userId: authUserId,
          email: sanitizedEmail,
          fullName: sanitizedName,
          referrerCode: referrerId,
        })
        if (profileResult?.error) {
          console.error('Profile sync warning:', profileResult.error)
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
          userData[sanitizedEmail].fullName = sanitizedName
          if (!userData[sanitizedEmail].id) userData[sanitizedEmail].id = authUserId || userId
          localStorage.setItem('admin_user_data', JSON.stringify(userData))
        }

        if (authUserId) {
          await handleLoginSignupBonusCheck(authUserId, sanitizedEmail)
        }

        setFeedback(
          `Welcome, ${sanitizedName}! Registration successful. Redirecting to login…`,
          'success'
        )
        setForm(initialForm)
        setIsLogin(true)
        setTimeout(() => navigate('/login'), 2000)
        return
      }

      const sanitizedEmail = sanitizeInput(form.email.trim())

      if (sanitizedEmail === ADMIN_EMAIL && form.password === ADMIN_PASSWORD) {
        const { error: adminSupabaseError } = await supabase.auth.signInWithPassword({
          email: ADMIN_EMAIL,
          password: form.password,
        })
        if (adminSupabaseError) {
          setFeedback(`Admin Supabase login failed: ${adminSupabaseError.message}`, 'error')
          return
        }

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
        usdBalance: 0,
        etbBalance: 0,
      }

      if (user?.id) {
        const bonusCheck = await handleLoginSignupBonusCheck(user.id, sanitizedEmail)
        console.log('[Auth] signup bonus check:', bonusCheck)

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
        usdBalance: userProfile.usdBalance ?? 0,
        etbBalance: userProfile.etbBalance ?? 0,
        lastLogin: new Date().toISOString(),
      }
      localStorage.setItem('admin_user_data', JSON.stringify(userData))

      navigate('/dashboard')
    } catch (error) {
      const errorMessage = String(error?.message || error || '')
      if (errorMessage.toLowerCase().includes('invalid')) {
        setFeedback('Invalid email or password. Please try again.', 'error')
      } else if (errorMessage.toLowerCase().includes('already')) {
        setFeedback('Account already exists. Please sign in.', 'error')
      } else {
        setFeedback(errorMessage || 'Authentication failed. Please try again.', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const messageStyles =
    messageType === 'success'
      ? 'border-green-500 bg-green-50 text-green-900'
      : messageType === 'error'
        ? 'border-red-500 bg-red-50 text-red-900'
        : 'border-lime-400 bg-lime-50 text-gray-800'

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-lime-400 to-lime-500 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.8),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.4),transparent_50%)]" />

      <h1 className="blackrock-3d-text" data-text="BLACKROCK">BLACKROCK</h1>

      <div
        className="auth-container relative z-10 w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl md:p-10"
        style={{
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.8)',
        }}
      >
        <div className="mb-6 flex overflow-hidden rounded-full border border-gray-200 bg-gray-100 p-1 shadow-md">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true)
              setFeedback('', '')
              setForm(initialForm)
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
              setFeedback('', '')
              navigate('/register')
            }}
            className={`flex-1 rounded-full px-5 py-3 text-sm font-bold transition-all duration-300 ${
              !isLogin
                ? 'bg-gradient-to-r from-lime-400 to-lime-500 text-white shadow-lg'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Register
          </button>
        </div>

        {isRegister && (
          <p className="mb-5 text-center text-sm text-gray-600">
            Create your account with the details below.
          </p>
        )}

        {isRegister && referrerId && (
          <p className="mb-4 rounded-xl border border-lime-200 bg-lime-50 px-4 py-2 text-center text-xs font-semibold text-lime-800">
            You were invited by a friend. Your referral will be linked after sign-up.
          </p>
        )}

        <form onSubmit={handleAuth} className="mx-auto w-full max-w-sm space-y-4">
          {isRegister && (
            <AuthIconField
              label="Full Name"
              required
              icon={User}
              valid={isFullNameValid}
            >
              <input
                type="text"
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                placeholder="Enter your full name"
                required
                autoComplete="name"
                className={`${inputWithIconClass} ${isFullNameValid ? 'border-[#84CC16]/60' : ''}`}
              />
            </AuthIconField>
          )}

          <AuthIconField
            label="Email Address"
            required={isRegister}
            icon={Mail}
            valid={isEmailValid}
            hint={isRegister ? 'Use a valid email you can access.' : undefined}
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
            <label className="mb-2 block text-sm font-bold text-gray-700">
              Password
              {isRegister && (
                <span className="ml-2 text-xs font-semibold text-[#84CC16]">(Required, 8+ characters)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Enter your password"
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className={`${inputBaseClass} px-4 pr-12`}
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
              <label className="mb-2 block text-sm font-bold text-gray-700">
                Confirm Password
                <span className="ml-2 text-xs font-semibold text-[#84CC16]">(Required)</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                  placeholder="Re-enter your password"
                  required
                  autoComplete="new-password"
                  className={`${inputBaseClass} px-4 pr-12 ${
                    passwordsMatch
                      ? 'border-[#84CC16]/60'
                      : passwordMismatch
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                        : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordMismatch && (
                <p className="mt-1.5 text-xs font-medium text-red-600">
                  Passwords do not match.
                </p>
              )}
              {passwordsMatch && (
                <p className="mt-1.5 text-xs font-medium text-[#2e7d32]">Passwords match.</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full rounded-xl bg-gradient-to-r from-lime-400 to-lime-500 py-3 text-base font-black tracking-wide text-white shadow-lg transition-all duration-300 hover:from-lime-500 hover:to-lime-600 hover:shadow-xl disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-md"
          >
            {loading ? 'Processing…' : isLogin ? 'Sign In' : 'Register'}
          </button>

          {isRegister && !canSubmit && (form.fullName || form.email) && (
            <p className="text-center text-xs text-gray-500">
              Complete all fields: full name, valid email, and matching passwords (8+ characters).
            </p>
          )}

          {isLogin && (
            <div className="text-right">
              <a href="/support" className="text-sm font-semibold text-slate-900 hover:text-slate-700">
                Forgot password?
              </a>
            </div>
          )}

          {message && (
            <div
              role="alert"
              className={`mt-2 rounded-xl border-l-4 px-4 py-3 text-sm font-semibold shadow-sm ${messageStyles}`}
            >
              {message}
            </div>
          )}

          <div className="mt-4 border-t border-gray-200 pt-4">
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
