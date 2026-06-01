import { useState } from 'react'
import { TrendingUp, Clock, Gift, Star, ArrowRight } from 'lucide-react'

const PRIMARY_GREEN = '#84CC16'

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
  }

  return (
    <div className="bg-white pb-4">
      <div className="space-y-5">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold text-slate-500">Investment Plans</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Choose Your Plan</h1>
        </div>

        {/* Currency Toggle */}
        <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">
          {['USD', 'ETB'].map((currency) => (
            <button
              key={currency}
              onClick={() => setSelectedCurrency(currency)}
              className={`flex-1 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                selectedCurrency === currency
                  ? 'text-white shadow-md'
                  : 'text-slate-600'
              }`}
                style={{
                backgroundColor: selectedCurrency === currency ? PRIMARY_GREEN : 'transparent',
                boxShadow: selectedCurrency === currency ? `0 2px 8px ${PRIMARY_GREEN}30` : 'none',
              }}
            >
              {currency === 'USD' ? '$ USD' : 'Br ETB'}
            </button>
          ))}
        </div>

        {/* Current Balance */}
        <div
          className="rounded-3xl p-6 text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${PRIMARY_GREEN}, #6bb01a)`,
            boxShadow: `0 8px 24px ${PRIMARY_GREEN}30`,
          }}
        >
          <p className="text-sm font-semibold opacity-90">Available Balance</p>
          <p className="mt-2 text-4xl font-bold tracking-tight">
            {selectedCurrency === 'USD' ? `$${balance.toFixed(2)}` : `${balance.toLocaleString()} Br`}
          </p>
        </div>

        {/* Investment Tiers */}
        <div className="space-y-4">
          {tiers.map((tier, idx) => (
            <div
              key={tier.id}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm hover:shadow-md transition"
            >
              {/* Tier Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p
                    className="text-2xl font-bold"
                    style={{ color: PRIMARY_GREEN }}
                  >
                    {selectedCurrency === 'USD' ? `$${tier.amount}` : `${tier.amount.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    {premiumTierNames[tier.amount] || 'Investment Plan'}
                  </p>
                </div>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  style={{
                    backgroundColor: `${PRIMARY_GREEN}20`,
                    color: PRIMARY_GREEN,
                  }}
                >
                  <TrendingUp size={24} />
                </div>
              </div>

              {/* Tier Details - Grid Layout */}
              <div className="grid grid-cols-3 gap-2 mb-5 p-3 bg-white rounded-2xl border border-slate-200">
                {/* Days */}
                <div className="text-center">
                  <Clock size={16} className="mx-auto mb-1" style={{ color: PRIMARY_GREEN }} />
                  <p className="text-xs text-slate-500 font-semibold">Days</p>
                  <p className="font-bold text-sm text-slate-950">{tier.days}</p>
                </div>

                {/* Daily Earnings */}
                <div className="text-center">
                  <Gift size={16} className="mx-auto mb-1" style={{ color: PRIMARY_GREEN }} />
                  <p className="text-xs text-slate-500 font-semibold">Daily</p>
                  <p className="font-bold text-sm text-slate-950">
                    {selectedCurrency === 'USD' ? `$${tier.dailyProfit.toFixed(1)}` : `${Math.round(tier.dailyProfit)} Br`}
                  </p>
                </div>

                {/* Total Return */}
                <div className="text-center">
                  <Star size={16} className="mx-auto mb-1" style={{ color: PRIMARY_GREEN }} />
                  <p className="text-xs text-slate-500 font-semibold">Total</p>
                  <p className="font-bold text-sm text-slate-950">
                    {selectedCurrency === 'USD'
                      ? `$${(tier.dailyProfit * tier.days).toFixed(0)}`
                      : `${Math.round(tier.dailyProfit * tier.days)} Br`}
                  </p>
                </div>
              </div>

              {/* Invest Button */}
              <button
                onClick={() => handleInvest(tier)}
                disabled={balance < tier.amount}
                className="w-full rounded-2xl px-4 py-4 font-bold text-white active:scale-95 transition disabled:opacity-60"
                style={{
                  backgroundColor: balance < tier.amount ? '#CBD5E1' : PRIMARY_GREEN,
                  boxShadow: balance >= tier.amount ? `0 4px 12px ${PRIMARY_GREEN}30` : 'none',
                }}
              >
                {balance >= tier.amount ? 'Invest Now' : 'Insufficient Balance'}
              </button>
            </div>
          ))}
        </div>

        {/* Info Banner */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs text-blue-900 font-medium">
            ✓ <strong>Secure:</strong> Daily returns guaranteed. Withdraw after completion.
          </p>
        </div>
      </div>
    </div>
  )
}
