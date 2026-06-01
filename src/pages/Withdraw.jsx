import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpCircle } from 'lucide-react'
import supabase from '../lib/supabase'

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
  const [loading, setLoading] = useState(false)

  const banks = ['CBE', 'Dashen Bank', 'Telebirr', 'M-Pesa', 'USDT']

  useEffect(() => {
    const user = supabase.auth.user || { email: 'user@example.com' }
    setUserEmail(user?.email || 'user@example.com')
  }, [])

  function showToast(msg, type = 'success') {
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
      
      // Navigate back to dashboard after short delay
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (error) {
      showToast('Error processing withdrawal. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-slate-950 to-black text-slate-100 pb-32">
      <div className="pt-20 px-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Withdrawal</h1>
            <p className="text-slate-400 text-sm">Request a payout from your wallet</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount Input */}
            <div className="app-card">
              <label className="block text-sm font-semibold text-white mb-2">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter withdrawal amount"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </div>

            {/* Bank Selection */}
            <div className="app-card">
              <label className="block text-sm font-semibold text-white mb-2">Bank / Method</label>
              <select
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              >
                {banks.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Account Name */}
            <div className="app-card">
              <label className="block text-sm font-semibold text-white mb-2">Account Name</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Full account holder name"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </div>

            {/* Account Number */}
            <div className="app-card">
              <label className="block text-sm font-semibold text-white mb-2">
                {bank === 'USDT' ? 'TRC20 Address' : 'Account Number'}
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={bank === 'USDT' ? 'T...' : 'Account/Phone number'}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !accountName.trim() || !accountNumber.trim() || !amount || Number(amount) <= 0}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg hover:shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
            >
              <ArrowUpCircle size={20} />
              {loading ? 'Processing...' : 'Submit Withdrawal'}
            </button>
          </form>

          {/* Info Card */}
          <div className="app-card bg-green-950/30 border border-green-900/50 p-4 rounded-xl">
            <p className="text-sm text-green-300">
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
