import { useState, useMemo } from 'react'
import { TrendingUp, Sparkles, ShieldCheck } from 'lucide-react'

export default function InvestPage({ ctx }) {
  const {
    usdBalance, etbBalance, myActiveInvestmentsList, setMyActiveInvestmentsList,
    usdTiers, etbTiers, premiumTierNames, formatCurrency, showToast,
    addTransaction, userEmail,
  } = ctx

  const [selectedCurrency, setSelectedCurrency] = useState('USD')
  const [selectedTier, setSelectedTier] = useState(null)

  const tiers = selectedCurrency === 'USD' ? usdTiers : etbTiers
  const balance = selectedCurrency === 'USD' ? usdBalance : etbBalance

  const handleInvest = (tier) => {
    if (balance < tier.amount) {
      showToast('Insufficient balance. Please deposit funds first.', 'error')
      return
    }

    // Create investment record
    const investment = {
      id: `inv-${Date.now()}`,
      amount: tier.amount,
      currency: selectedCurrency,
      days: tier.days,
      dailyProfit: tier.dailyProfit,
      totalReturn: tier.dailyProfit * tier.days,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + tier.days * 24 * 60 * 60 * 1000).toISOString(),
      tierName: premiumTierNames[tier.amount] || `${tier.amount} ${selectedCurrency}`,
    }

    // Update balance
    if (selectedCurrency === 'USD') {
      ctx.setUsdBalance((prev) => Number((prev - tier.amount).toFixed(2)))
    } else {
      ctx.setEtbBalance((prev) => Number((prev - tier.amount).toFixed(0)))
    }

    // Add to investments
    const newInvestments = [...myActiveInvestmentsList, investment]
    setMyActiveInvestmentsList(newInvestments)
    localStorage.setItem('user_investments', JSON.stringify(newInvestments))

    // Update user data
    const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    if (userData[userEmail]) {
      userData[userEmail][selectedCurrency === 'USD' ? 'usdBalance' : 'etbBalance'] = 
        selectedCurrency === 'USD' ? balance - tier.amount : balance - tier.amount
      localStorage.setItem('admin_user_data', JSON.stringify(userData))
    }

    // Add transaction
    addTransaction({
      id: `tx-inv-${Date.now()}`,
      type: 'Investment',
      category: 'Investments',
      title: `Investment: ${investment.tierName}`,
      amount: tier.amount,
      currency: selectedCurrency,
      status: 'Active',
      date: new Date().toISOString(),
    })

    showToast(`Investment of ${formatCurrency(tier.amount, selectedCurrency)} started!`, 'success')
    setSelectedTier(null)
  }

  return (
    <div className="space-y-6">
      {/* Currency Tabs */}
      <div className="flex gap-4">
        {['USD', 'ETB'].map((currency) => (
          <button
            key={currency}
            onClick={() => setSelectedCurrency(currency)}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              selectedCurrency === currency
                ? 'bg-gradient-to-r from-emerald-500 to-lime-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {currency}
          </button>
        ))}
      </div>

      {/* Current Balance */}
      <div className="app-card bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
        <p className="text-slate-400 text-sm">Available Balance</p>
        <p className="text-2xl font-bold text-white">
          {selectedCurrency === 'USD' ? `$${balance.toFixed(2)}` : `${balance.toLocaleString()} Br`}
        </p>
      </div>

      {/* Investment Plans */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-white">Investment Plans</h3>
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className="app-card bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-700 hover:border-emerald-500/40 p-5 rounded-3xl transition-all hover:shadow-2xl hover:shadow-emerald-500/20"
          >
            <div className="flex items-start justify-between mb-4 gap-4">
              <div>
                <p className="font-bold text-xl text-white">
                  {selectedCurrency === 'USD' ? `$${tier.amount}` : `${tier.amount.toLocaleString()} Br`}
                </p>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400 mt-1">
                  {premiumTierNames[tier.amount] || `Plan`}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                <ShieldCheck size={24} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-slate-950/50 rounded-lg p-2">
                <p className="text-xs text-slate-500">Duration</p>
                <p className="font-bold text-white">{tier.days}d</p>
              </div>
              <div className="bg-slate-950/50 rounded-lg p-2">
                <p className="text-xs text-slate-500">Daily Profit</p>
                <p className="font-bold text-green-500">
                  {selectedCurrency === 'USD' ? `$${tier.dailyProfit}` : `${tier.dailyProfit.toLocaleString()} Br`}
                </p>
              </div>
              <div className="bg-slate-950/50 rounded-lg p-2">
                <p className="text-xs text-slate-500">Total Return</p>
                <p className="font-bold text-blue-400">
                  {selectedCurrency === 'USD'
                    ? `$${(tier.dailyProfit * tier.days).toFixed(2)}`
                    : `${(tier.dailyProfit * tier.days).toLocaleString()} Br`}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleInvest(tier)}
              className="w-full bg-gradient-to-r from-sky-600 to-blue-700 hover:shadow-lg hover:shadow-sky-600/50 text-white py-3 rounded-lg font-semibold transition-all"
            >
              Invest Now
            </button>
          </div>
        ))}
      </div>

      {/* Info Card */}
      <div className="app-card bg-blue-950/30 border border-blue-900/50 p-4 rounded-xl">
        <p className="text-sm text-blue-300">
          💡 <strong>Tip:</strong> Investments are locked for the duration period. Your daily profits are added to your wallet automatically.
        </p>
      </div>
    </div>
  )
}
