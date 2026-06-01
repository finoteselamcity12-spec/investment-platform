import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import supabase from '../lib/supabase'

function formatCurrency(amount, currency) {
  if (currency === 'USD') return `$${Number(amount).toFixed(2)}`
  return `${Number(amount).toLocaleString()} Birr`
}

export default function Withdraw() {
  const navigate = useNavigate()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Telebirr')
  const [account, setAccount] = useState('')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState('success')
  const [userEmail, setUserEmail] = useState('')
  const [accountValid, setAccountValid] = useState(true)

  useEffect(() => {
    const user = supabase.auth.user || { email: 'user@example.com' }
    setUserEmail(user?.email || 'user@example.com')
  }, [])

  const TRC20_REGEX = /^T[a-zA-Z0-9]{33}$/
  const TELEBIRR_ACCOUNT_REGEX = /^\d{8,12}$/

  function showToast(msg, type = 'success') {
    setToastType(type)
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const value = Number(amount)
    if (!account.trim() || !value || value <= 0) {
      showToast('Complete every withdrawal field.', 'error')
      return
    }

    if (!accountValid) {
      showToast('Format Error: Invalid account/wallet address.', 'error')
      return
    }

    const currency = method === 'USDT' ? 'USD' : 'ETB'

    // Load user balances from admin_user_data
    const users = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    if (!users[userEmail]) users[userEmail] = { usdBalance: 0, etbBalance: 0, email: userEmail }

    const balance = currency === 'USD' ? (users[userEmail].usdBalance || 0) : (users[userEmail].etbBalance || 0)
    if (value > balance) {
      showToast(`Insufficient ${currency} balance for this withdrawal.`, 'error')
      return
    }

    // Deduct immediately (keeps behavior consistent with previous UX)
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
      method,
      account,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem('admin_pending_withdrawals', JSON.stringify(pendingWithdrawals))

    // Add to a simple transactions log used by the dashboard (optional)
    const tx = JSON.parse(localStorage.getItem('platform_global_tx_ledger') || '[]')
    tx.push(`WD:${userEmail}:${Date.now()}`)
    localStorage.setItem('platform_global_tx_ledger', JSON.stringify(tx))

    showToast('Cashout request submitted successfully.')
    // Navigate back to dashboard after short delay
    setTimeout(() => navigate('/dashboard'), 900)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-950">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="card-surface-dark">
          <h1 className="text-2xl font-bold text-white">Withdrawal</h1>
          <p className="mt-2 text-sm text-slate-300">Request a payout from your wallet. Requests appear in the Admin pending payouts queue.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-950">Amount to Withdraw</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="touch-input"
                placeholder="Enter amount"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-950">Withdrawal Method</label>
              <select
                value={method}
                onChange={(e) => {
                  const m = e.target.value
                  setMethod(m)
                  // re-validate current account value for the new method
                  if (m === 'USDT') setAccountValid(TRC20_REGEX.test(account.trim()))
                  else setAccountValid(TELEBIRR_ACCOUNT_REGEX.test(account.trim()))
                }}
                className="touch-input"
              >
                <option>Telebirr</option>
                <option>USDT</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-950">Account / Wallet Address</label>
              <input
                type="text"
                value={account}
                onChange={(e) => {
                  const v = e.target.value.trim()
                  setAccount(v)
                  if (method === 'USDT') {
                    setAccountValid(TRC20_REGEX.test(v))
                  } else {
                    setAccountValid(TELEBIRR_ACCOUNT_REGEX.test(v))
                  }
                }}
                className="touch-input"
                placeholder="Recipient number or wallet address"
              />
              {!accountValid && (
                <p className="mt-2 text-xs text-red-600">Format Error: Please enter a valid account or USDT (TRC20) address starting with 'T'.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!accountValid || !amount || Number(amount) <= 0}
              className="touch-button disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Wallet className="h-4 w-4" />
              Submit Request
            </button>
          </form>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-3xl px-5 py-4 text-sm font-bold shadow-xl ${toastType === 'success' ? 'bg-blue-600 text-white' : 'bg-rose-500 text-white'}`}>
          {toast}
        </div>
      )}
    </div>
  )
}
