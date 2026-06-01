import { useMemo, useState, useEffect } from 'react'
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
  const [showTerms, setShowTerms] = useState(false)
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

      <div className="text-center relative z-10">
        <div className="mb-2 inline-block">
          <div className="inline-block px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
            <span className="text-xs font-bold text-white tracking-widest uppercase">Premium Investment</span>
          </div>
        </div>
        <h1 className="text-white font-black text-4xl md:text-5xl tracking-tight mb-2 drop-shadow-2xl">
          Investment Platform
        </h1>
        <p className="text-white/90 text-sm md:text-base font-semibold mb-8 drop-shadow-lg">
          Advanced wealth management at your fingertips
        </p>
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
            <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="name@example.com"
              className="auth-input-field w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-lime-400 focus:bg-white focus:ring-2 focus:ring-lime-400/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Enter your password"
              className="auth-input-field w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-lime-400 focus:bg-white focus:ring-2 focus:ring-lime-400/30 transition-all"
            />
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

      <div className="mt-6 w-full max-w-md relative z-10">
        <button
          type="button"
          onClick={() => setShowTerms((prev) => !prev)}
          className="text-sm font-bold text-white underline transition hover:text-white/80 drop-shadow-lg"
          aria-expanded={showTerms}
        >
          Terms & Conditions
        </button>

        {showTerms && (
          <div className="mt-4 rounded-2xl bg-white/95 p-5 shadow-xl border border-white/50 backdrop-blur-sm">
            <h2 className="text-base font-bold text-gray-900">Platform Rules & Regulations</h2>
            <ol className="mt-4 space-y-3 text-sm text-gray-800">
              <li>
                <span className="font-semibold">1. Eligibility:</span> Users must be 18 years or older. Only one account is permitted per person; multiple registration fraud triggers an automatic wallet lock.
              </li>
              <li>
                <span className="font-semibold">2. How to Deposit:</span>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-gray-800">
                  <li>Select your preferred network plan asset currency (USD or ETB/Birr).</li>
                  <li>Transfer the exact amount to the displayed verified channel (Telebirr Merchant ID <span className="font-semibold">900675</span> for Amsal Aneley, Telebirr Personal <span className="font-semibold">0993855459</span> for Yohanis, or the verified USDT TRC20 address).</li>
                  <li>Enter your unique transaction reference ID string and upload a legitimate transaction receipt screenshot. Fake or reused IDs will result in a permanent ban.</li>
                </ol>
              </li>
              <li>
                <span className="font-semibold">3. How to Withdraw:</span>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-gray-800">
                  <li>Access the Withdrawal panel and ensure your account balance meets the minimum payout threshold.</li>
                  <li>Provide your precise destination mobile number or wallet address.</li>
                  <li>Backend administrative processing executes shortly after verification.</li>
                </ol>
              </li>
              <li>
                <span className="font-semibold">4. Referral Commission Rule:</span> Commissions are only unlocked after the referred peer completes a successful verified deposit. Payouts are $3.00 USD for USD tiers and 93 Birr for ETB tiers.
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}

