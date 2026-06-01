import { useState } from 'react'
import { Upload, Wallet, Copy, Check } from 'lucide-react'

export default function DepositPage({ ctx }) {
  const { setUsdBalance, setEtbBalance, addTransaction, showToast, userEmail } = ctx

  const [currency, setCurrency] = useState('ETB')
  const [paymentMethod, setPaymentMethod] = useState('Telebirr (Merchant)')
  const [amount, setAmount] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedField, setCopiedField] = useState('')

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

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(''), 2000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!amount || !transactionId || !screenshot) {
      showToast('Please fill all fields and upload a receipt', 'error')
      return
    }

    setIsSubmitting(true)

    try {
      // Create pending deposit record
      const pendingDeposit = {
        id: `deposit-${Date.now()}`,
        userId: userEmail,
        amount: parseFloat(amount),
        currency,
        paymentMethod: selectedPaymentData.label,
        transactionId,
        screenshot: screenshot.name,
        status: 'Pending',
        createdAt: new Date().toISOString(),
      }

      // Store in admin pending deposits
      const pendingDeposits = JSON.parse(localStorage.getItem('admin_pending_deposits') || '[]')
      pendingDeposits.push(pendingDeposit)
      localStorage.setItem('admin_pending_deposits', JSON.stringify(pendingDeposits))

      // Add transaction record
      addTransaction({
        id: `tx-${Date.now()}`,
        type: 'Deposit',
        category: 'Deposits',
        title: `Deposit Submitted: ${currency === 'USD' ? '$' : ''}${amount} ${currency}`,
        amount: parseFloat(amount),
        currency,
        status: 'Pending Admin Approval',
        date: new Date().toISOString(),
      })

      showToast('Deposit submitted! Waiting for admin approval.', 'success')
      
      // Reset form
      setAmount('')
      setTransactionId('')
      setScreenshot(null)
      
      // Store pending state
      localStorage.setItem(`user_pending_deposit_${userEmail}`, pendingDeposit.id)
    } catch (error) {
      showToast('Error submitting deposit. Please try again.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <div className="app-card bg-green-950/30 border border-green-900/50 p-4 rounded-xl">
        <p className="text-sm text-green-300">
          📌 <strong>Important:</strong> Send your payment first, then provide proof of transaction below. Admin approval required.
        </p>
      </div>

      {/* Deposit Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Currency Selection */}
        <div className="app-card">
          <label className="block text-sm font-semibold text-white mb-3">Currency</label>
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
        <div className="app-card">
          <label className="block text-sm font-semibold text-white mb-2">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
          >
            {currentMethods.map((method) => (
              <option key={method.label} value={method.label}>
                {method.label}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Details Card */}
        <div className="app-card bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
          <h3 className="text-sm font-bold text-white mb-3">Payment Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center p-2 bg-slate-950 rounded">
              <div>
                <p className="text-slate-400 text-xs">Name</p>
                <p className="text-white font-semibold">{selectedPaymentData.name}</p>
              </div>
            </div>
            <div className="flex justify-between items-center p-2 bg-slate-950 rounded">
              <div>
                <p className="text-slate-400 text-xs">{currency === 'USD' ? 'TRC20 Address' : 'Account ID'}</p>
                <p className="text-green-400 font-mono text-xs break-all">{selectedPaymentData.id}</p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(selectedPaymentData.id, 'payment')}
                className="ml-2 p-2 hover:bg-slate-800 rounded transition-all"
              >
                {copiedField === 'payment' ? (
                  <Check size={16} className="text-green-500" />
                ) : (
                  <Copy size={16} className="text-slate-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="app-card">
          <label className="block text-sm font-semibold text-slate-200 mb-2">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          >
            {paymentOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <div className="mt-3 rounded-3xl bg-slate-950/80 border border-slate-800 p-4 text-sm text-slate-300">
            <p className="text-slate-200 font-semibold">Selected:</p>
            {paymentOptions.filter((opt) => opt.id === paymentMethod).map((option) => (
              <div key={option.id} className="space-y-1">
                <p>{option.name}</p>
                <p className="text-slate-400">{option.details}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Amount Input */}
        <div className="app-card">
          <label className="block text-sm font-semibold text-slate-200 mb-2">Amount</label>
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
              className="w-full bg-slate-800 border border-slate-700 rounded-3xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
        </div>

        {/* Transaction ID Input */}
        <div className="app-card">
          <label className="block text-sm font-semibold text-white mb-2">Transaction ID</label>
          <input
            type="text"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="e.g., TX123456 or Telebirr TX ID"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
        </div>

        {/* File Upload */}
        <div className="app-card">
          <label className="block text-sm font-semibold text-white mb-3">Upload Receipt</label>
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
              className="hidden"
              id="receipt-upload"
            />
            <label
              htmlFor="receipt-upload"
              className="flex items-center justify-center gap-3 border-2 border-dashed border-slate-600 rounded-lg p-6 cursor-pointer hover:border-green-500 hover:bg-slate-900/50 transition-all"
            >
              <Upload size={24} className="text-slate-400" />
              <div>
                <p className="text-white font-semibold">{screenshot?.name || 'Click to upload'}</p>
                <p className="text-xs text-slate-400">JPG, PNG up to 5MB</p>
              </div>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg hover:shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-lg font-bold transition-all"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Deposit'}
        </button>
      </form>
    </div>
  )
}
