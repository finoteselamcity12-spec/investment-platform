import { useState } from 'react'
import { TrendingUp, Clock, Gift, Star, ArrowRight } from 'lucide-react'

export default function InvestPage({ ctx }) {
  const {
    usdBalance, etbBalance, myActiveInvestmentsList, setMyActiveInvestmentsList,
    usdTiers, etbTiers, premiumTierNames, formatCurrency, showToast,
    addTransaction, userEmail,
  } = ctx

  const [selectedCurrency, setSelectedCurrency] = useState('USD')

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
      ctx.setUsdBalance((prev) => Number((Number(prev) - tier.amount).toFixed(2)))
    } else {
      ctx.setEtbBalance((prev) => Number((Number(prev) - tier.amount).toFixed(0)))
    }

    // Add to investments
    const newInvestments = [...myActiveInvestmentsList, investment]
    setMyActiveInvestmentsList(newInvestments)
    localStorage.setItem('user_investments', JSON.stringify(newInvestments))

    // Update user data
    const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    if (userData[userEmail]) {
      userData[userEmail][selectedCurrency === 'USD' ? 'usdBalance' : 'etbBalance'] = Number(balance) - tier.amount
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
  }

  const tierColors = {
    bronze: { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', icon: 'text-amber-600', button: 'bg-amber-600 hover:bg-amber-700' },
    silver: { bg: 'from-slate-50 to-gray-50', border: 'border-slate-300', icon: 'text-slate-600', button: 'bg-slate-700 hover:bg-slate-800' },
    gold: { bg: 'from-yellow-50 to-amber-50', border: 'border-yellow-300', icon: 'text-yellow-600', button: 'bg-yellow-600 hover:bg-yellow-700' },
    platinum: { bg: 'from-cyan-50 to-blue-50', border: 'border-cyan-300', icon: 'text-cyan-600', button: 'bg-cyan-600 hover:bg-cyan-700' },
    green: { bg: 'from-green-50 to-emerald-50', border: 'border-green-300', icon: 'text-green-600', button: 'bg-[#84CC16] hover:bg-lime-500' },
  }

  const getTierColor = (amount) => {
    if (amount <= 50 || amount <= 350) return tierColors.bronze
    if (amount <= 110 || amount <= 5000) return tierColors.silver
    if (amount <= 200 || amount <= 10000) return tierColors.gold
    if (amount <= 500 || amount <= 20000) return tierColors.platinum
    return tierColors.green
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#84CC16]">Investment Plans</p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950">Choose Your Plan</h1>
          <p className="mt-2 text-slate-600">Select an investment plan and start earning consistent returns daily.</p>
        </div>

        {/* Currency Toggle */}
        <div className="mb-8 flex gap-3">
          {['USD', 'ETB'].map((currency) => (
            <button
              key={currency}
              onClick={() => setSelectedCurrency(currency)}
              className={`px-6 py-3 rounded-full font-semibold transition-all ${
                selectedCurrency === currency
                  ? 'bg-[#84CC16] text-white shadow-lg shadow-[#84CC16]/30'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {currency === 'USD' ? 'US Dollar ($)' : 'Ethiopian Birr (Br)'}
            </button>
          ))}
        </div>

        {/* Current Balance */}
        <div className="mb-8 rounded-3xl bg-gradient-to-r from-[#84CC16] to-lime-500 p-6 text-white shadow-lg shadow-[#84CC16]/30">
          <p className="text-sm font-semibold opacity-90">Available Balance</p>
          <p className="mt-2 text-3xl font-bold">
            {selectedCurrency === 'USD' ? `$${(Number(balance)).toFixed(2)}` : `${(Number(balance)).toLocaleString()} Br`}
          </p>
        </div>

        {/* Investment Tiers Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => {
            const colors = getTierColor(tier.amount)
            return (
              <div
                key={tier.id}
                className={`rounded-2xl border-2 ${colors.border} bg-gradient-to-br ${colors.bg} p-6 shadow-md transition-all hover:shadow-xl`}
              >
                {/* Tier Header */}
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <p className={`text-3xl font-bold ${colors.icon}`}>
                      {selectedCurrency === 'USD' ? `$${(Number(tier.amount)).toFixed(2)}` : `${(Number(tier.amount)).toLocaleString()}`}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-600">
                      {premiumTierNames[tier.amount] || 'Plan'}
                    </p>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors.icon} bg-opacity-10`}>
                    <TrendingUp size={24} />
                  </div>
                </div>

                {/* Tier Details */}
                <div className="mb-6 space-y-3 border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-3">
                    <Clock className={`h-5 w-5 ${colors.icon}`} />
                    <div>
                      <p className="text-xs text-slate-500">Duration</p>
                      <p className="font-bold text-slate-900">{tier.days} Days</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Gift className={`h-5 w-5 ${colors.icon}`} />
                    <div>
                      <p className="text-xs text-slate-500">Daily Earnings</p>
                      <p className="font-bold text-slate-900">
                        {selectedCurrency === 'USD' ? `$${(Number(tier.dailyProfit)).toFixed(2)}` : `${(Number(tier.dailyProfit)).toLocaleString()} Br`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Star className={`h-5 w-5 ${colors.icon}`} />
                    <div>
                      <p className="text-xs text-slate-500">Bonus Reward</p>
                      <p className="font-bold text-slate-900">
                        {selectedCurrency === 'USD' ? `$${(Number(tier.bonus)).toFixed(2)}` : `${(Number(tier.bonus)).toLocaleString()} Br`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Total Return */}
                <div className="mb-6 rounded-xl bg-slate-100 p-3 text-center">
                  <p className="text-xs text-slate-600">Total Return (All Days)</p>
                  <p className="text-lg font-bold text-slate-950">
                    {selectedCurrency === 'USD'
                      ? `$${(Number(tier.dailyProfit * tier.days)).toFixed(2)}`
                      : `${(Number(tier.dailyProfit * tier.days)).toLocaleString()} Br`}
                  </p>
                </div>

                {/* Invest Button */}
                <button
                  onClick={() => handleInvest(tier)}
                  disabled={balance < tier.amount}
                  className={`w-full rounded-full py-3 font-bold text-white transition-all flex items-center justify-center gap-2 ${
                    balance < tier.amount
                      ? 'bg-slate-300 cursor-not-allowed'
                      : `${colors.button} shadow-lg`
                  }`}
                >
                  Invest Now
                  <ArrowRight size={18} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Info Banner */}
        <div className="mt-12 rounded-2xl bg-blue-50 border border-blue-200 p-5">
          <p className="text-sm text-blue-900">
            <strong>Secure & Transparent:</strong> Daily returns guaranteed. Withdraw after completion.
          </p>
        </div>
      </div>
    </div>
  )
}
