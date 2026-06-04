import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpCircle, Wallet } from 'lucide-react'
import { getSession } from '../lib/authService'
import { WITHDRAWAL_MIN_ETB, WITHDRAWAL_MIN_USD } from '../lib/platformConfig'

function formatCurrency(amount, currency) {
  if (currency === 'USD') return `$${Number(amount).toFixed(2)}`
  return `${Number(amount).toLocaleString()} Birr`
}

export default function Withdraw({ ctx = {}, embedded = false }) {
  const navigate = useNavigate()
  const { setUsdBalance, setEtbBalance, showToast: ctxShowToast, userEmail: ctxEmail } = ctx
  const [amount, setAmount] = useState('')
  const [bank, setBank] = useState('CBE')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState('success')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const banks = ['CBE', 'Dashen Bank', 'Telebirr', 'M-Pesa', 'USDT']

  useEffect(() => {
    const session = getSession()
    setUserEmail(ctxEmail || session?.user?.email || '')
  }, [ctxEmail])

  function showToast(msg, type = 'success') {
    if (typeof ctxShowToast === 'function') {
      ctxShowToast(msg, type)
      return
    }
    setToastType(type)
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const value = Number(amount)
    
    if (!accountName.trim() || !accountNumber.trim() || !value || value <= 0) {
      showToast('Complete every withdrawal field.', 'error')
      return
    }

    // Enforce minimum withdrawal amounts
    const currency = bank === 'USDT' ? 'USD' : 'ETB'
    if (currency === 'ETB' && value < WITHDRAWAL_MIN_ETB) {
      showToast(`Minimum withdrawal is ${WITHDRAWAL_MIN_ETB} Birr.`, 'error')
      return
    }
    if (currency === 'USD' && value < WITHDRAWAL_MIN_USD) {
      showToast(`Minimum withdrawal is $${WITHDRAWAL_MIN_USD}.`, 'error')
      return
    }

    setLoading(true)

    try {
      const currency = bank === 'USDT' ? 'USD' : 'ETB'

      // Load user balances from admin_user_data
      const users = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
      if (!users[userEmail]) users[userEmail] = { usdBalance: 0, etbBalance: 0, email: userEmail }

      const balance = currency === 'USD' ? (users[userEmail].usdBalance || 0) : (users[userEmail].etbBalance || 0)
      if (value > balance) {
        showToast(`Insufficient ${currency} balance for this withdrawal.`, 'error')
        setLoading(false)
        return
      }

      // Deduct immediately
      if (currency === 'USD') {
        users[userEmail].usdBalance = Number((users[userEmail].usdBalance || 0) - value)
      } else {
        users[userEmail].etbBalance = Number((users[userEmail].etbBalance || 0) - value)
      }
      localStorage.setItem('admin_user_data', JSON.stringify(users))
      setUsdBalance?.(users[userEmail].usdBalance)
      setEtbBalance?.(users[userEmail].etbBalance)

      // Add to admin pending withdrawals
      const pendingWithdrawals = JSON.parse(localStorage.getItem('admin_pending_withdrawals') || '[]')
      pendingWithdrawals.push({
        id: `withdrawal-${Date.now()}`,
        userName: users[userEmail].fullName || userEmail,
        userEmail: userEmail,
        amount: value,
        currency,
        bank,
        accountName,
        accountNumber,
        status: 'Pending',
        createdAt: new Date().toISOString(),
      })
      localStorage.setItem('admin_pending_withdrawals', JSON.stringify(pendingWithdrawals))

      showToast('Withdrawal request submitted successfully!', 'success')
      
      // Reset form
      setAmount('')
      setAccountName('')
      setAccountNumber('')
      setBank('CBE')
      
      if (embedded) {
        setTimeout(() => ctx.setActivePage?.('home'), 1200)
      } else {
        setTimeout(() => navigate('/dashboard'), 1500)
      }
    } catch (error) {
      showToast('Error processing withdrawal. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 pb-20">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-white border border-slate-200 p-8 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.16)]">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-2">
              <Wallet size={32} className="text-emerald-600" />
              <h1 className="text-4xl font-bold text-slate-950">Withdraw</h1>
            </div>
            <p className="mt-3 text-slate-500">Select your bank, enter account details, and submit a withdrawal request.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Amount Input */}
            <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-slate-950 mb-2">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter withdrawal amount"
                className="w-full bg-slate-100 border border-slate-200 rounded-3xl px-4 py-3 text-slate-950 placeholder-slate-400 focus:outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>

            {/* Bank Selection */}
            <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-slate-950 mb-2">Bank / Method</label>
              <select
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 rounded-3xl px-4 py-3 text-slate-950 focus:outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              >
                {banks.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Account Name */}
            <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-slate-950 mb-2">Account Name</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Full account holder name"
                className="w-full bg-slate-100 border border-slate-200 rounded-3xl px-4 py-3 text-slate-950 placeholder-slate-400 focus:outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>

            {/* Account Number */}
            <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-slate-950 mb-2">
                {bank === 'USDT' ? 'TRC20 Address' : 'Account Number'}
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={bank === 'USDT' ? 'T...' : 'Account/Phone number'}
                className="w-full bg-slate-100 border border-slate-200 rounded-3xl px-4 py-3 text-slate-950 placeholder-slate-400 focus:outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !accountName.trim() || !accountNumber.trim() || !amount || Number(amount) <= 0}
              className="w-full rounded-2xl bg-[#84CC16] px-4 py-4 font-bold text-white shadow-lg shadow-[#84CC16]/30 transition-all hover:bg-lime-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <ArrowUpCircle size={20} />
              {loading ? 'Processing...' : 'Submit Withdrawal'}
            </button>
          </form>

          {/* Info Card */}
          <div className="rounded-[1.75rem] bg-slate-50 border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-600">
              ✓ <strong>Your withdrawal will be processed within 24 hours</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-8 left-4 right-4 z-50 rounded-lg px-5 py-4 text-sm font-bold shadow-xl ${
          toastType === 'success'
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast}
        </div>
      )}
    </div>
  )
}
