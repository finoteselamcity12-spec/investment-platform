import { useState } from 'react'
import { Upload, Wallet } from 'lucide-react'

export default function DepositPage({ ctx }) {
  const { setUsdBalance, setEtbBalance, addTransaction, showToast, userEmail } = ctx

  const [currency, setCurrency] = useState('ETB')
  const [amount, setAmount] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const depositMethods = {
    ETB: ['CBE', 'Dashen Bank', 'Telebirr'],
    USD: ['USDT (TRC20)', 'Bank Transfer'],
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
      <div className="app-card bg-blue-950/30 border border-blue-900/50 p-4 rounded-xl">
        <p className="text-sm text-blue-300">
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
                onClick={() => setCurrency(curr)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  currency === curr
                    ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-lg shadow-sky-600/50'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Input */}
        <div className="app-card">
          <label className="block text-sm font-semibold text-white mb-2">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-slate-400">
              {currency === 'USD' ? '$' : '₿'}
            </span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
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
            placeholder="e.g., TX123456 or Telebirr ID"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
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
              className="flex items-center justify-center gap-3 border-2 border-dashed border-slate-600 rounded-lg p-6 cursor-pointer hover:border-sky-500 hover:bg-slate-900/50 transition-all"
            >
              <Upload size={24} className="text-slate-400" />
              <div>
                <p className="text-white font-semibold">{screenshot?.name || 'Click to upload'}</p>
                <p className="text-xs text-slate-400">JPG, PNG up to 5MB</p>
              </div>
            </label>
          </div>
        </div>

        {/* Payment Methods Info */}
        <div className="app-card bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
          <p className="text-sm font-semibold text-white mb-3">Accepted Methods:</p>
          <div className="space-y-2">
            {depositMethods[currency].map((method) => (
              <div key={method} className="flex items-center gap-2">
                <Wallet size={16} className="text-sky-400" />
                <span className="text-sm text-slate-300">{method}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-sky-600 to-blue-700 hover:shadow-lg hover:shadow-sky-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-lg font-bold transition-all"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Deposit'}
        </button>
      </form>
    </div>
  )
}
