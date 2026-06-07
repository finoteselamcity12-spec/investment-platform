import { useEffect, useState } from 'react'
import { Upload, Copy, Check } from 'lucide-react'
import { getSession } from '../lib/authService'
import supabase from '../lib/supabase'
import {
  DEPOSIT_RECEIPT_MAX_BYTES,
  submitPendingDeposit,
} from '../lib/supabaseData'

export default function DepositPage({ ctx = {} }) {
  const { 
    setUsdBalance, 
    setEtbBalance, 
    addTransaction, 
    showToast, 
    userEmail,
    WITHDRAWAL_MIN_USD,
    WITHDRAWAL_MIN_ETB,
  } = ctx

  const [currency, setCurrency] = useState('ETB')
  const [paymentMethod, setPaymentMethod] = useState('Telebirr (Merchant)')
  const [amount, setAmount] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [screenshot, setScreenshot] = useState({ name: '', preview: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [copiedField, setCopiedField] = useState('')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState('success')

  const paymentMethods = {
    ETB: [
      { label: 'Telebirr (Merchant)', id: '900675', name: 'Amsale Aneley' },
      { label: 'Telebirr (Personal)', id: '0993855459', name: 'Yohanis' },
    ],
    USD: [
      { label: 'USDT (TRC20)', id: 'TQjEAMhuezFdqKww9o5NWFBJhNKTgTpLMU', name: 'USDT Address' },
    ],
  }

  const currentMethods = paymentMethods[currency]
  const selectedPaymentData = currentMethods.find(m => m.label === paymentMethod) || currentMethods[0]
  const activeUserEmail = userEmail || currentUserEmail || 'user@example.com'

  useEffect(() => {
    let isMounted = true

    async function loadCurrentUserEmail() {
      const { data: authData, error } = await supabase.auth.getUser()
      if (isMounted && authData?.user?.email) {
        setCurrentUserEmail(authData.user.email)
      }
      if (error) {
        console.warn('[DepositPage] auth.getUser failed:', error)
      }
    }

    loadCurrentUserEmail()
    return () => {
      isMounted = false
    }
  }, [])

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(''), 2000)
  }

  const handleReceiptChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      setReceiptFile(null)
      setScreenshot({ name: '', preview: '' })
      return
    }

    if (!file.type.startsWith('image/')) {
      displayToast('Please upload a JPG or PNG image.', 'error')
      e.target.value = ''
      return
    }

    if (file.size > DEPOSIT_RECEIPT_MAX_BYTES) {
      displayToast('Receipt must be 5MB or smaller.', 'error')
      e.target.value = ''
      return
    }

    setReceiptFile(file)

    const reader = new FileReader()
    reader.onload = () => {
      setScreenshot({ name: file.name, preview: reader.result })
    }
    reader.onerror = () => {
      displayToast('Could not read the receipt file.', 'error')
      setReceiptFile(null)
      setScreenshot({ name: '', preview: '' })
    }
    reader.readAsDataURL(file)
  }

  function displayToast(message, type = 'success') {
    if (typeof showToast === 'function') {
      showToast(message, type)
      return
    }
    setToastType(type)
    setToast(message)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleDepositSubmit(e) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError || !authData?.user) {
      setError('Please log in again')
      setIsSubmitting(false)
      return
    }

    const currentUser = authData.user
    console.log('Depositing for user:', currentUser.id, currentUser.email)

    const depositData = {
      user_id: currentUser.id,
      amount_etb: currency === 'ETB' ? Number(amount) : 0,
      amount_usd: currency === 'USD' ? Number(amount) : 0,
      amount: Number(amount),
      currency: currency,
      payment_method: paymentMethod || 'manual',
      transaction_id: transactionId || '',
      status: 'pending'
    }

    console.log('Inserting deposit:', depositData)

    const { data, error } = await supabase
      .from('deposits')
      .insert(depositData)
      .select()

    console.log('Deposit insert:', data, error)

    if (error) {
      setError('Failed: ' + error.message)
      setIsSubmitting(false)
      return
    }

    setSuccess('Deposit submitted! Waiting for admin approval.')
    setAmount('')
    setTransactionId('')
    setIsSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 pb-20">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Info Card */}
          <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-xl">
            <p className="text-sm text-slate-700">
              📌 <strong>Important:</strong> Send your payment first, then provide proof of transaction below. Admin approval required.
            </p>
          </div>

          {success && (
            <div className="rounded-3xl bg-emerald-600 px-5 py-4 text-white shadow-lg shadow-emerald-600/20">
              ✅ {success}
            </div>
          )}
          {error && (
            <div className="rounded-3xl bg-red-600 px-5 py-4 text-white shadow-lg shadow-red-600/20">
              ❌ {error}
            </div>
          )}

      {/* Deposit Form */}
      <form onSubmit={handleDepositSubmit} className="space-y-4">
        {/* Currency Selection */}
        <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
          <label className="block text-sm font-semibold text-slate-950 mb-3">Currency</label>
          <div className="flex gap-3">
            {['ETB', 'USD'].map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => {
                  setCurrency(curr)
                  setPaymentMethod(paymentMethods[curr][0].label)
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  currency === curr
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/50'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Method Dropdown */}
        <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
          <label className="block text-sm font-semibold text-slate-950 mb-2">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full bg-slate-100 border border-slate-200 rounded-3xl px-4 py-3 text-slate-950 focus:outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
          >
            {currentMethods.map((method) => (
              <option key={method.label} value={method.label}>
                {method.label}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Details Card */}
        <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-950 mb-3">Payment Details</h3>
          <div className="space-y-2 text-sm">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-slate-500 text-xs">Name</p>
              <p className="mt-2 text-slate-950 font-semibold">{selectedPaymentData.name}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-slate-500 text-xs">{currency === 'USD' ? 'TRC20 Address' : 'Account ID'}</p>
              <p className="mt-2 text-slate-950 font-semibold font-mono text-xs break-all">{selectedPaymentData.id}</p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(selectedPaymentData.id, 'payment')}
              className="rounded-full bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200"
            >
              {copiedField === 'payment' ? (
                <Check size={16} className="text-green-500" />
              ) : (
                <Copy size={16} className="text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-slate-950">Amount</label>
            <span className="text-xs text-slate-500">
              Min: {currency === 'USD' ? `$${WITHDRAWAL_MIN_USD || 3}` : `${WITHDRAWAL_MIN_ETB || 300} Br`}
            </span>
          </div>
          {/* Quick suggestions starting from 350 Birr / $3 */}
          <div className="flex gap-2 mb-3">
            {(currency === 'ETB' ? [350, 500, 1000] : [3, 5, 10]).map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmount(String(amt))}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 transition"
              >
                {currency === 'ETB' ? `Br ${amt}` : `$${amt}`}
              </button>
            ))}
            <div className="ml-2 text-xs text-slate-400 flex items-center">Custom</div>
          </div>

          <div className="relative">
            <span className="absolute left-4 top-3.5 text-slate-400">
              {currency === 'USD' ? '$' : 'Br'}
            </span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full bg-slate-100 border border-slate-200 rounded-3xl pl-10 pr-4 py-3 text-slate-950 placeholder-slate-400 focus:outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20 transition-all"
            />
          </div>
        </div>

        {/* Transaction ID Input */}
        <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
          <label className="block text-sm font-semibold text-slate-950 mb-2">Transaction ID</label>
          <input
            type="text"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="e.g., TX123456 or Telebirr TX ID"
            className="w-full bg-slate-100 border border-slate-200 rounded-3xl px-4 py-3 text-slate-950 placeholder-slate-400 focus:outline-none focus:border-[#84CC16] focus:ring-2 focus:ring-[#84CC16]/20"
          />
        </div>

        {/* File Upload */}
        <div className="rounded-[1.75rem] bg-white border border-slate-200 p-5 shadow-sm">
          <label className="block text-sm font-semibold text-slate-950 mb-3">Upload Receipt</label>
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleReceiptChange}
              className="hidden"
              id="receipt-upload"
            />
            <label
              htmlFor="receipt-upload"
              className="flex items-center justify-center gap-3 border-2 border-dashed border-slate-300 rounded-3xl p-6 cursor-pointer hover:border-[#84CC16] hover:bg-slate-100 transition-all"
            >
              <Upload size={24} className="text-slate-400" />
              <div>
                <p className="text-slate-950 font-semibold">{screenshot.name || 'Click to upload'}</p>
                <p className="text-xs text-slate-400">JPG, PNG up to 5MB</p>
              </div>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !receiptFile || !transactionId.trim() || !amount}
          className="w-full rounded-2xl bg-[#84CC16] px-4 py-4 font-bold text-white shadow-lg shadow-[#84CC16]/30 transition-all hover:bg-lime-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Deposit'}
        </button>
      </form>

      {toast && (
        <div
          className={
            'fixed bottom-8 left-4 right-4 z-50 rounded-3xl px-5 py-4 text-sm font-semibold shadow-xl ' +
            (toastType === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white')
          }
        >
          {toast}
        </div>
      )}
        </div>
      </div>
    </div>
  )
}
