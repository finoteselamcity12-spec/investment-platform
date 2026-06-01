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
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 relative">
      <div className="text-center">
        <h1 className="text-white font-bold text-3xl md:text-4xl tracking-tight mb-6 drop-shadow-lg text-center">
          INVESTMENT PLATFORM
        </h1>
      </div>

      <div className="card-surface-dark w-full max-w-md p-6 md:p-8 shadow-2xl transition-all">
        <div className="mb-8 flex overflow-hidden rounded-full bg-zinc-100 p-1 shadow-inner">
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-bold transition ${
              isLogin ? 'bg-white text-blue-600 shadow' : 'text-zinc-500'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-bold transition ${
              !isLogin ? 'bg-white text-blue-600 shadow' : 'text-zinc-500'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          {isRegister && (
            <div>
              <label className="block text-sm font-bold text-slate-200 mb-2">Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                placeholder="Your full name"
                className="touch-input"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-200 mb-2">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="name@investmentplatform.com"
              className="touch-input"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-200 mb-2">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Enter your password"
              className="touch-input"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-sm font-bold text-slate-200 mb-2">Confirm Password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                placeholder="Confirm password"
                className="touch-input"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="touch-button disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Working...' : isLogin ? 'LOGIN' : 'Create Account'}
          </button>

          {message && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-slate-950">
              {message}
            </div>
          )}
        </form>
      </div>

      <div className="mt-4 w-full max-w-md">
        <button
          type="button"
          onClick={() => setShowTerms((prev) => !prev)}
          className="text-sm font-semibold text-white underline transition hover:text-slate-100"
          aria-expanded={showTerms}
        >
          Terms & Conditions
        </button>

        {showTerms && (
          <div className="mt-4 rounded-3xl border border-white/10 bg-white/95 p-5 shadow-lg text-zinc-950">
            <h2 className="text-base font-bold text-zinc-950">Platform Rules & Regulations</h2>
            <ol className="mt-4 space-y-3 text-sm text-zinc-900">
              <li>
                <span className="font-semibold">1. Eligibility:</span> Users must be 18 years or older. Only one account is permitted per person; multiple registration fraud triggers an automatic wallet lock.
              </li>
              <li>
                <span className="font-semibold">2. How to Deposit:</span>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-zinc-900">
                  <li>Select your preferred network plan asset currency (USD or ETB/Birr).</li>
                  <li>Transfer the exact amount to the displayed verified channel (Telebirr Merchant ID <span className="font-semibold">900675</span> for Amsal Aneley, Telebirr Personal <span className="font-semibold">0993855459</span> for Yohanis, or the verified USDT TRC20 address).</li>
                  <li>Enter your unique transaction reference ID string and upload a legitimate transaction receipt screenshot. Fake or reused IDs will result in a permanent ban.</li>
                </ol>
              </li>
              <li>
                <span className="font-semibold">3. How to Withdraw:</span>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-zinc-900">
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

