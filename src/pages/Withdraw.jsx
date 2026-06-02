import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpCircle, Wallet, AlertCircle } from 'lucide-react'
import supabase from '../lib/supabase'
import { getSession, validators, sanitizeInput } from '../lib/authService'

function formatCurrency(amount, currency) {
  if (currency === 'USD') return `$${Number(amount).toFixed(2)}`
  return `${Number(amount).toLocaleString()} Birr`
}

export default function Withdraw() {
  const navigate = useNavigate()
  const [amount, setAmount] = useState('')
  const [bank, setBank] = useState('CBE')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState('success')
  const [userEmail, setUserEmail] = useState('')
  const [userBalance, setUserBalance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const session = getSession()

  const banks = ['CBE', 'Dashen Bank', 'Telebirr', 'M-Pesa', 'USDT']

  useEffect(() => {
    if (session?.user?.email) {
      setUserEmail(session.user.email)
      loadUserBalance()
    } else {
      navigate('/login')
    }
  }, [navigate, session])

  function loadUserBalance() {
    const users = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    if (users[session.user.email]) {
      const balance = bank === 'USDT' ? (users[session.user.email].usdBalance || 0) : (users[session.user.email].etbBalance || 0)
      setUserBalance(balance)
    }
  }

  function showToast(msg, type = 'success') {
    setToastType(type)
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function validateForm() {
    const newErrors = {}
    const value = Number(amount)

    // Validate amount
    if (!amount || value <= 0) {
      newErrors.amount = 'Amount must be greater than 0'
    } else {
      const amountValidation = validators.amount(amount)
      if (!amountValidation.valid) {
        newErrors.amount = amountValidation.error
      }
    }

    // Validate account name
    const nameValidation = validators.bankAccount(accountName)
    if (!nameValidation.valid) {
      newErrors.accountName = nameValidation.error
    }

    // Validate account number
    const accountValidation = validators.bankAccount(accountNumber)
    if (!accountValidation.valid) {
      newErrors.accountNumber = accountValidation.error
    }

    // Check balance
    if (value > userBalance) {
      const currency = bank === 'USDT' ? 'USD' : 'ETB'
      newErrors.balance = `Insufficient ${currency} balance`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    
    if (!validateForm()) {
      showToast('Please fix the errors and try again', 'error')
      return
    }

    setLoading(true)

    try {
      const value = Number(amount)
      const currency = bank === 'USDT' ? 'USD' : 'ETB'
      const sanitizedName = sanitizeInput(accountName.trim())
      const sanitizedNumber = sanitizeInput(accountNumber.trim())

      // Load user balances from admin_user_data
      const users = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
      if (!users[userEmail]) users[userEmail] = { usdBalance: 0, etbBalance: 0, email: userEmail }

      const balance = currency === 'USD' ? (users[userEmail].usdBalance || 0) : (users[userEmail].etbBalance || 0)
      
      if (value > balance) {
        showToast(`Insufficient ${currency} balance for this withdrawal.`, 'error')
        setLoading(false)
        return
      }

      // Deduct immediately and mark as Pending
      if (currency === 'USD') {
        users[userEmail].usdBalance = Number((users[userEmail].usdBalance || 0) - value)
      } else {
        users[userEmail].etbBalance = Number((users[userEmail].etbBalance || 0) - value)
      }
      localStorage.setItem('admin_user_data', JSON.stringify(users))

      // Add to admin pending withdrawals with "Pending" status
      const pendingWithdrawals = JSON.parse(localStorage.getItem('admin_pending_withdrawals') || '[]')
      pendingWithdrawals.push({
        id: `withdrawal-${Date.now()}`,
        userName: users[userEmail].fullName || userEmail,
        userEmail: userEmail,
        amount: value,
        currency,
        bank,
        accountName: sanitizedName,
        accountNumber: sanitizedNumber,
        status: 'Pending', // Set to Pending, admin can approve/reject
        createdAt: new Date().toISOString(),
      })
      localStorage.setItem('admin_pending_withdrawals', JSON.stringify(pendingWithdrawals))

      showToast('Withdrawal request submitted successfully! Status: Pending', 'success')
      
      // Reset form
      setAmount('')
      setAccountName('')
      setAccountNumber('')
      setBank('CBE')
      setErrors({})
      
      // Navigate back to dashboard after short delay
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (error) {
      showToast('Error processing withdrawal. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white text-slate-950 pb-20">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl p-8 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.16)]">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-lime-100 to-lime-200">
                <Wallet size={32} className="text-lime-700" />
              </div>
            </div>
            <h1 className="text-4xl font-black text-slate-950">Withdraw Funds</h1>
            <p className="mt-3 text-slate-500">Select your bank and enter account details to submit a withdrawal request.</p>
          </div>

          {/* Balance Display */}
          <div className="rounded-2xl border border-white/40 bg-gradient-to-r from-blue-50/60 to-cyan-50/40 p-4 mb-6">
            <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Available Balance</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{formatCurrency(userBalance, bank === 'USDT' ? 'USD' : 'ETB')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Amount Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-950 mb-2">Withdrawal Amount *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter withdrawal amount"
                className={`w-full bg-slate-100/60 border-2 rounded-2xl px-4 py-3 text-slate-950 placeholder-slate-400 focus:outline-none transition-all ${
                  errors.amount ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-400/30' : 'border-slate-200 focus:border-lime-400 focus:ring-2 focus:ring-lime-400/30'
                }`}
              />
              {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount}</p>}
            </div>

            {/* Bank Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-950 mb-2">Bank / Payment Method *</label>
              <select
                value={bank}
                onChange={(e) => {
                  setBank(e.target.value)
                  loadUserBalance()
                }}
                className="w-full bg-slate-100/60 border-2 border-slate-200 rounded-2xl px-4 py-3 text-slate-950 focus:outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/30 transition-all"
              >
                {banks.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Account Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-950 mb-2">Account Holder Name *</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Full account holder name"
                className={`w-full bg-slate-100/60 border-2 rounded-2xl px-4 py-3 text-slate-950 placeholder-slate-400 focus:outline-none transition-all ${
                  errors.accountName ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-400/30' : 'border-slate-200 focus:border-lime-400 focus:ring-2 focus:ring-lime-400/30'
                }`}
              />
              {errors.accountName && <p className="text-xs text-red-600 mt-1">{errors.accountName}</p>}
            </div>

            {/* Account Number */}
            <div>
              <label className="block text-sm font-semibold text-slate-950 mb-2">
                {bank === 'USDT' ? 'TRC20 Wallet Address *' : 'Account Number *'}
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={bank === 'USDT' ? 'T...' : 'Account/Phone number'}
                className={`w-full bg-slate-100/60 border-2 rounded-2xl px-4 py-3 text-slate-950 placeholder-slate-400 focus:outline-none transition-all ${
                  errors.accountNumber ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-400/30' : 'border-slate-200 focus:border-lime-400 focus:ring-2 focus:ring-lime-400/30'
                }`}
              />
              {errors.accountNumber && <p className="text-xs text-red-600 mt-1">{errors.accountNumber}</p>}
            </div>

            {/* Balance Error */}
            {errors.balance && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-red-900">{errors.balance}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !accountName.trim() || !accountNumber.trim() || !amount || Number(amount) <= 0}
              className="w-full bg-gradient-to-r from-lime-400 to-lime-500 hover:shadow-lg hover:shadow-lime-400/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
            >
              <ArrowUpCircle size={20} />
              {loading ? 'Processing...' : 'Submit Withdrawal Request'}
            </button>
          </form>

          {/* Info Card */}
          <div className="rounded-2xl border border-white/40 bg-gradient-to-r from-amber-50/60 to-orange-50/40 p-4 mt-6">
            <p className="text-xs text-amber-900 font-semibold flex items-start gap-2">
              <span className="mt-1">ℹ</span>
              <span><strong>Status: Pending</strong> — Your withdrawal will be reviewed by admin within 24 hours. Balance deducted immediately.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-8 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 rounded-2xl px-5 py-4 text-sm font-bold shadow-xl ${
          toastType === 'success'
            ? 'bg-green-50 text-green-900 border border-green-200'
            : 'bg-red-50 text-red-900 border border-red-200'
        }`}>
          {toast}
        </div>
      )}
    </div>
  )
}
