import { useState } from 'react'

export default function InvestPage({ ctx = {} }) {
  const { usdBalance, etbBalance } = ctx
  const [currency, setCurrency] = useState('USD')

  // Hardcoded USD plans (strict replacement)
  const usdPlans = [
    { amount: 3, days: 10, profit: 1.2, deposit: 2, bonus: 2 },
    { amount: 5, days: 15, profit: 2.2, deposit: 3, bonus: 3 },
    { amount: 7, days: 20, profit: 3, deposit: 3, bonus: 3 },
    { amount: 10, days: 22, profit: 4, deposit: 5, bonus: 5 },
    { amount: 15, days: 25, profit: 6, deposit: 7, bonus: 7 },
    { amount: 20, days: 27, profit: 8, deposit: 9, bonus: 9 },
    { amount: 25, days: 30, profit: 12, deposit: 11, bonus: 11 },
    { amount: 30, days: 32, profit: 13, deposit: 14, bonus: 14 },
    { amount: 35, days: 35, profit: 15, deposit: 16, bonus: 16 },
    { amount: 40, days: 37, profit: 17, deposit: 19, bonus: 19 },
    { amount: 45, days: 39, profit: 19, deposit: 21, bonus: 21 },
    { amount: 50, days: 41, profit: 21, deposit: 23, bonus: 23 },
    { amount: 75, days: 43, profit: 25, deposit: 27, bonus: 27 },
    { amount: 90, days: 45, profit: 30, deposit: 37, bonus: 37 },
    { amount: 110, days: 47, profit: 45, deposit: 53, bonus: 53 },
    { amount: 150, days: 49, profit: 54, deposit: 62, bonus: 62 },
    { amount: 200, days: 54, profit: 60, deposit: 68, bonus: 68 },
    { amount: 500, days: 57, profit: 74, deposit: 79, bonus: 79 },
    { amount: 1000, days: 69, profit: 155, deposit: 210, bonus: 210 },
    { amount: 5000, days: 72, profit: 360, deposit: 407, bonus: 407 },
  ]

  // Hardcoded ETB plans (strict replacement)
  const etbPlans = [
    { amount: 350, days: 15, profit: 101, deposit: 63, bonus: 63 },
    { amount: 500, days: 20, profit: 142, deposit: 78, bonus: 78 },
    { amount: 700, days: 25, profit: 185, deposit: 104, bonus: 104 },
    { amount: 1000, days: 30, profit: 201, deposit: 268, bonus: 268 },
    { amount: 1500, days: 35, profit: 258, deposit: 309, bonus: 309 },
    { amount: 5000, days: 40, profit: 377, deposit: 492, bonus: 492 },
    { amount: 10000, days: 45, profit: 452, deposit: 608, bonus: 608 },
    { amount: 15000, days: 50, profit: 500, deposit: 702, bonus: 702 },
    { amount: 20000, days: 55, profit: 715, deposit: 9000, bonus: 9000 },
    { amount: 25000, days: 60, profit: 999, deposit: 1082, bonus: 1082 },
    { amount: 30000, days: 65, profit: 1130, deposit: 1800, bonus: 1800 },
    { amount: 35000, days: 70, profit: 1900, deposit: 3750, bonus: 3750 },
    { amount: 40000, days: 75, profit: 3999, deposit: 3600, bonus: 3600 },
    { amount: 45000, days: 80, profit: 4750, deposit: 4000, bonus: 4000 },
    { amount: 50000, days: 90, profit: 5000, deposit: 55000, bonus: 55000 },
  ]

  function renderUsdTable() {
    return (
      <div>
        <h2 className="mb-4 text-xl font-bold text-slate-950">USD Plans</h2>
        <div className="overflow-x-auto rounded-2xl border-2 border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-bold text-slate-950">Amount</th>
                <th className="px-4 py-3 text-center font-bold text-slate-950">Days</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Profit</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Deposit</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Bonus</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Total</th>
              </tr>
            </thead>
            <tbody>
              {usdPlans.map((p, idx) => {
                const profit = Number(p.profit) || 0
                const deposit = Number(p.deposit) || 0
                const bonus = Number(p.bonus) || 0
                const total = Number(profit) + Number(deposit) + Number(bonus)
                return (
                  <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-950">${(Number(p.amount)).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{p.days}</td>
                    <td className="px-4 py-3 text-right text-slate-700">${(Number(profit)).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-950">${(Number(deposit)).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">${(Number(bonus)).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#84CC16] text-base">${(Number(total)).toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderEtbTable() {
    return (
      <div>
        <h2 className="mb-4 text-xl font-bold text-slate-950">ETB Plans</h2>
        <div className="overflow-x-auto rounded-2xl border-2 border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-bold text-slate-950">Amount</th>
                <th className="px-4 py-3 text-center font-bold text-slate-950">Days</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Profit</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Deposit</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Bonus</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Total</th>
              </tr>
            </thead>
            <tbody>
              {etbPlans.map((p, idx) => {
                const profit = Number(p.profit) || 0
                const deposit = Number(p.deposit) || 0
                const bonus = Number(p.bonus) || 0
                const total = Number(profit) + Number(deposit) + Number(bonus)
                return (
                  <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-950">{(Number(p.amount)).toLocaleString()} Br</td>
                    <td className="px-4 py-3 text-center text-slate-700">{p.days}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{(Number(profit)).toLocaleString()} Br</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-950">{(Number(deposit)).toLocaleString()} Br</td>
                    <td className="px-4 py-3 text-right text-slate-700">{(Number(bonus)).toLocaleString()} Br</td>
                    <td className="px-4 py-3 text-right font-bold text-[#84CC16] text-base">{(Number(total)).toLocaleString()} Br</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-slate-950 pb-20">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Investment Plans</h1>
          <div className="space-x-2">
            <button onClick={() => setCurrency('USD')} className={`px-3 py-1 rounded-full ${currency === 'USD' ? 'bg-[#84CC16] text-white' : 'bg-slate-100 text-slate-700'}`}>USD</button>
            <button onClick={() => setCurrency('ETB')} className={`px-3 py-1 rounded-full ${currency === 'ETB' ? 'bg-[#84CC16] text-white' : 'bg-slate-100 text-slate-700'}`}>ETB</button>
          </div>
        </div>

        {currency === 'USD' ? renderUsdTable() : renderEtbTable()}
      </div>
    </div>
  )
}
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
