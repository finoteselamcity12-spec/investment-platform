import { useState } from 'react'
import { TrendingUp, Clock, Gift, Star, ArrowRight } from 'lucide-react'

const PRIMARY_GREEN = '#84CC16'

export default function InvestPage({ ctx }) {
  const {
    usdBalance, etbBalance, myActiveInvestmentsList, setMyActiveInvestmentsList,
    formatCurrency, showToast, addTransaction, userEmail,
    
  } = ctx

  const [selectedCurrency, setSelectedCurrency] = useState('USD')

  const formatSafeFixed = (value, digits = 2) => {
    return typeof value === 'number' ? value.toFixed(digits) : '0.00'
  }

  // Use the exact arrays provided and compute Total = profit + bonus
  const usdPlans = [
    { inv: 3, day: 10, profit: 1.2, bonus: 2 },
    { inv: 5, day: 15, profit: 2.2, bonus: 3 },
    { inv: 7, day: 20, profit: 3, bonus: 3 },
    { inv: 10, day: 22, profit: 4, bonus: 5 },
    { inv: 15, day: 25, profit: 6, bonus: 7 },
    { inv: 20, day: 27, profit: 8, bonus: 9 },
    { inv: 25, day: 30, profit: 12, bonus: 11 },
    { inv: 30, day: 32, profit: 13, bonus: 14 },
    { inv: 35, day: 35, profit: 15, bonus: 16 },
    { inv: 40, day: 37, profit: 17, bonus: 19 },
    { inv: 45, day: 39, profit: 19, bonus: 21 },
    { inv: 50, day: 41, profit: 21, bonus: 23 },
    { inv: 75, day: 43, profit: 25, bonus: 27 },
    { inv: 90, day: 45, profit: 30, bonus: 37 },
    { inv: 110, day: 47, profit: 45, bonus: 53 },
    { inv: 150, day: 49, profit: 54, bonus: 62 },
    { inv: 200, day: 54, profit: 60, bonus: 68 },
    { inv: 500, day: 57, profit: 74, bonus: 79 },
    { inv: 1000, day: 69, profit: 155, bonus: 210 },
    { inv: 5000, day: 72, profit: 360, bonus: 407 },
  ].map(p => ({ ...p, total: Number((Number(p.profit) + Number(p.bonus)).toFixed(3)) }))

  const birrPlans = [
    { inv: 350, day: 15, profit: 101, bonus: 63 },
    { inv: 500, day: 20, profit: 142, bonus: 78 },
    { inv: 700, day: 25, profit: 185, bonus: 104 },
    { inv: 1000, day: 30, profit: 201, bonus: 268 },
    { inv: 1500, day: 35, profit: 258, bonus: 309 },
    { inv: 5000, day: 40, profit: 377, bonus: 492 },
    { inv: 10000, day: 45, profit: 452, bonus: 608 },
    { inv: 15000, day: 50, profit: 500, bonus: 702 },
    { inv: 20000, day: 55, profit: 715, bonus: 900 },
    { inv: 25000, day: 60, profit: 999, bonus: 1082 },
    { inv: 30000, day: 65, profit: 1130, bonus: 1800 },
    { inv: 35000, day: 70, profit: 1900, bonus: 3750 },
    { inv: 40000, day: 75, profit: 3999, bonus: 3600 },
    { inv: 45000, day: 80, profit: 4750, bonus: 4000 },
    { inv: 50000, day: 90, profit: 5000, bonus: 5500 },
  ].map(p => ({ ...p, total: Number((Number(p.profit) + Number(p.bonus)).toFixed(3)) }))

  const tiers = selectedCurrency === 'USD' ? usdPlans : birrPlans
  const balance = selectedCurrency === 'USD' ? usdBalance : etbBalance

  const handleInvest = (tier) => {
    if (balance < tier.inv) {
      showToast('Insufficient balance. Please deposit funds first.', 'error')
      return
    }

    // Create investment record
    const investment = {
      id: `inv-${Date.now()}`,
      amount: tier.inv,
      currency: selectedCurrency,
      days: tier.day,
      profit: tier.profit,
      depBonus: tier.bonus,
      total: Number((Number(tier.profit) + Number(tier.bonus)).toFixed(3)),
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + tier.day * 24 * 60 * 60 * 1000).toISOString(),
      tierName: `${tier.inv} ${selectedCurrency}`,
    }

    // Update balance
    if (selectedCurrency === 'USD') {
      ctx.setUsdBalance((prev) => Number((Number(prev) - Number(tier.inv)).toFixed(2)))
    } else {
      ctx.setEtbBalance((prev) => Number((Number(prev) - Number(tier.inv)).toFixed(0)))
    }

    // Add to investments
    const newInvestments = [...myActiveInvestmentsList, investment]
    setMyActiveInvestmentsList(newInvestments)
    localStorage.setItem('user_investments', JSON.stringify(newInvestments))

    // Update user data
    const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    if (userData[userEmail]) {
      userData[userEmail][selectedCurrency === 'USD' ? 'usdBalance' : 'etbBalance'] = 
        selectedCurrency === 'USD' ? balance - tier.inv : balance - tier.inv
      localStorage.setItem('admin_user_data', JSON.stringify(userData))
    }

    // Add transaction
    addTransaction({
      id: `tx-inv-${Date.now()}`,
      type: 'Investment',
      category: 'Investments',
      title: `Investment: ${investment.tierName}`,
      amount: tier.inv,
      currency: selectedCurrency,
      status: 'Active',
      date: new Date().toISOString(),
    })

    showToast(`Investment of ${formatCurrency(tier.inv, selectedCurrency)} started!`, 'success')
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
            {selectedCurrency === 'USD' ? `$${formatSafeFixed(balance)}` : `${typeof balance === 'number' ? Math.round(balance) : 0} Br`}
          </p>
        </div>

        {/* Investment Tiers */}
        <div className="space-y-4">
          {tiers.map((tier, idx) => (
            <div
              key={tier.inv || idx}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm hover:shadow-md transition"
            >
              {/* Tier Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold" style={{ color: PRIMARY_GREEN }}>
                    {selectedCurrency === 'USD' ? `$${tier.inv}` : `${tier.inv.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">{tier.tierName || `${tier.inv} ${selectedCurrency}`}</p>
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
                <div className="grid grid-cols-5 gap-2 mb-5 p-3 bg-white rounded-2xl border border-slate-200">
                  <div className="text-center">
                    <Clock size={16} className="mx-auto mb-1" style={{ color: PRIMARY_GREEN }} />
                    <p className="text-xs text-slate-500 font-semibold">Day</p>
                    <p className="font-bold text-sm text-slate-950">{tier.day}</p>
                  </div>

                  <div className="text-center">
                    <Gift size={16} className="mx-auto mb-1" style={{ color: PRIMARY_GREEN }} />
                    <p className="text-xs text-slate-500 font-semibold">Profit</p>
                    <p className="font-bold text-sm text-slate-950">
                      {selectedCurrency === 'USD' ? `$${formatSafeFixed(tier.profit)}` : `${typeof tier.profit === 'number' ? Math.round(tier.profit) : 0} Br`}
                    </p>
                  </div>

                  <div className="text-center">
                    <Star size={16} className="mx-auto mb-1" style={{ color: PRIMARY_GREEN }} />
                    <p className="text-xs text-slate-500 font-semibold">Dep Bonus</p>
                    <p className="font-bold text-sm text-slate-950">
                      {selectedCurrency === 'USD' ? `$${formatSafeFixed(tier.bonus)}` : `${typeof tier.bonus === 'number' ? Math.round(tier.bonus) : 0} Br`}
                    </p>
                  </div>

                  <div className="text-center col-span-2">
                    <p className="text-xs text-slate-500 font-semibold">Total</p>
                    <p className="font-bold text-sm text-slate-950">
                      {selectedCurrency === 'USD'
                        ? `$${formatSafeFixed(Number(tier.profit) + Number(tier.bonus))}`
                        : `${typeof tier.profit === 'number' && typeof tier.bonus === 'number' ? Math.round(tier.profit + tier.bonus) : 0} Br`}
                    </p>
                  </div>
                </div>

              {/* Invest Button */}
              <button
                onClick={() => handleInvest(tier)}
                disabled={balance < tier.inv}
                className="w-full rounded-2xl px-4 py-4 font-bold text-white active:scale-95 transition disabled:opacity-60"
                style={{
                  backgroundColor: balance < tier.inv ? '#CBD5E1' : PRIMARY_GREEN,
                  boxShadow: balance >= tier.inv ? `0 4px 12px ${PRIMARY_GREEN}30` : 'none',
                }}
              >
                {balance >= tier.inv ? 'Invest Now' : 'Insufficient Balance'}
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
