import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpCircle, Wallet } from 'lucide-react'
import { getSession } from '../lib/authService'
import { WITHDRAWAL_MIN_ETB, WITHDRAWAL_MIN_USD } from '../lib/platformConfig'
import { submitPendingWithdrawal } from '../lib/supabaseData'

export default function Withdraw({ ctx = {}, embedded = false }) {
  const navigate = useNavigate()
  const {
    usdBalance = 0,
    etbBalance = 0,
    setUsdBalance,
    setEtbBalance,
    addTransaction,
    showToast: ctxShowToast,
    userEmail: ctxEmail,
    setActivePage,
    refreshBalances,
  } = ctx

  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('ETB')
  const [bank, setBank] = useState('CBE')
  const [paymentMethod, setPaymentMethod] = useState('Telebirr')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState('success')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const paymentMethods = ['Telebirr', 'CBE', 'Bank Transfer', 'M-Pesa', 'USDT']
  const currencies = ['ETB', 'USD']

  useEffect(() => {
    const session = getSession()
    setUserEmail(ctxEmail || session?.user?.email || '')
  }, [ctxEmail])

  useEffect(() => {
    if (paymentMethod === 'USDT') {
      setCurrency('USD')
    }
  }, [paymentMethod])

  function showToast(msg, type = 'success') {
    if (typeof ctxShowToast === 'function') {
      ctxShowToast(msg, type)
      return
    }
    setToastType(type)
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const value = Number(amount)
    const trimmedCurrency = currency.trim().toUpperCase()
    const trimmedBank = bank.trim()
    const trimmedPaymentMethod = paymentMethod.trim()
    const trimmedName = accountName.trim()
    const trimmedAccount = accountNumber.trim()

    if (!trimmedCurrency || !trimmedBank || !trimmedPaymentMethod || !trimmedName || !trimmedAccount || !value || value <= 0) {
      showToast('Complete every withdrawal field.', 'error')
      return
    }

    if (trimmedPaymentMethod === 'USDT' && trimmedCurrency !== 'USD') {
      showToast('USDT withdrawals must use USD currency.', 'error')
      return
    }

    const currencyValue = trimmedCurrency === 'USD' ? 'USD' : 'ETB'
    if (currencyValue === 'ETB' && value < WITHDRAWAL_MIN_ETB) {
      showToast(`Minimum withdrawal is ${WITHDRAWAL_MIN_ETB} Birr.`, 'error')
      return
    }
    if (currencyValue === 'USD' && value < WITHDRAWAL_MIN_USD) {
      showToast(`Minimum withdrawal is $${WITHDRAWAL_MIN_USD}.`, 'error')
      return
    }

    const available = currencyValue === 'USD' ? Number(usdBalance) : Number(etbBalance)
    if (value > available) {
      showToast(`Insufficient ${currencyValue} balance for this withdrawal.`, 'error')
      return
    }

    setLoading(true)

    try {
      const session = getSession()
      const accountDetails = {
        bank: trimmedBank,
        payment_method: trimmedPaymentMethod,
        account_name: trimmedName,
        account_number: trimmedAccount,
      }

      const result = await submitPendingWithdrawal({
        userId: session?.user?.id,
        userEmail: userEmail || session?.user?.email,
        amount: value,
        currency: currencyValue,
        bank: trimmedBank,
        paymentMethod: trimmedPaymentMethod,
        accountDetails: JSON.stringify(accountDetails),
        accountName: trimmedName,
        accountNumber: trimmedAccount,
      })

      if (!result.ok) {
        const errMsg = result.error || ''
        if (errMsg === 'insufficient_balance') showToast('Insufficient balance', 'error')
        else if (errMsg === 'min_300_etb') showToast('Minimum withdrawal is 300 ETB', 'error')
        else if (errMsg === 'min_3_usd') showToast('Minimum withdrawal is $3 USD', 'error')
        else showToast(result.error || 'Withdrawal failed: ' + errMsg, 'error')
        return
      }

      if (result.usdBalance != null) setUsdBalance?.(result.usdBalance)
      if (result.etbBalance != null) setEtbBalance?.(result.etbBalance)
      // refresh authoritative balances
      try { await refreshBalances?.() } catch (e) { /* ignore */ }

      if (typeof addTransaction === 'function') {
        try {
          addTransaction({
            id: `tx-withdrawal-${Date.now()}`,
            type: 'Withdrawal',
            category: 'Withdrawals',
              title: `Withdrawal Submitted: ${currencyValue === 'USD' ? '$' : ''}${value} ${currencyValue}`,
            amount: value,
            currency: currencyValue,
              status: 'Pending',
            date: new Date().toISOString(),
          })
        } catch (txErr) {
          console.warn('[withdrawal] local transaction log failed:', txErr)
        }
      }

      showToast('Withdrawal request submitted successfully!', 'success')

      setAmount('')
      setCurrency('ETB')
      setBank('CBE')
      setAccountName('')
      setAccountNumber('')
      setPaymentMethod('Telebirr')

      // Trigger UI refresh after successful RPC transaction
      if (result.needsRefresh) {
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else if (embedded) {
        setTimeout(() => setActivePage?.('home'), 1200)
      } else {
        setTimeout(() => navigate('/dashboard'), 1500)
      }
    } catch (error) {
      console.error('[withdrawal] submit failed:', error)
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
            <p className="mt-3 text-slate-500">Select your payment method, enter account details, and submit a withdrawal request.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-slate-950 mb-2">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 rounded-3xl px-4 py-3 text-slate-950 focus:outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              >
                {currencies.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-slate-950 mb-2">Bank</label>
              <input
                type="text"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                placeholder="Enter bank name or branch"
                className="w-full bg-slate-100 border border-slate-200 rounded-3xl px-4 py-3 text-slate-950 placeholder-slate-400 focus:outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>

            <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-slate-950 mb-2">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 rounded-3xl px-4 py-3 text-slate-950 focus:outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

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

            <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
              <label className="block text-sm font-semibold text-slate-950 mb-2">
                {paymentMethod === 'USDT' ? 'TRC20 Address' : 'Account Number'}
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={paymentMethod === 'USDT' ? 'T...' : 'Account/Phone number'}
                className="w-full bg-slate-100 border border-slate-200 rounded-3xl px-4 py-3 text-slate-950 placeholder-slate-400 focus:outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !accountName.trim() || !accountNumber.trim() || !amount || Number(amount) <= 0}
              className="w-full rounded-2xl bg-[#84CC16] px-4 py-4 font-bold text-white shadow-lg shadow-[#84CC16]/30 transition-all hover:bg-lime-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <ArrowUpCircle size={20} />
              {loading ? 'Processing...' : 'Submit Withdrawal'}
            </button>
          </form>

          <div className="rounded-[1.75rem] bg-slate-50 border border-slate-200 p-5 shadow-sm mt-6">
            <p className="text-sm text-slate-600">
              ✓ <strong>Your withdrawal will be processed within 24 hours</strong>
            </p>
          </div>
        </div>
      </div>

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
