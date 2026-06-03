import { useState } from 'react'
import { Clock, Gift, Star, TrendingUp } from 'lucide-react'

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

  // Get VIP level based on amount
  const getVipLevel = (amount) => {
    if (currency === 'USD') {
      if (amount <= 10) return 'Bronze'
      if (amount <= 50) return 'Silver'
      if (amount <= 200) return 'Gold'
      if (amount <= 500) return 'Platinum'
      return 'Diamond'
    } else {
      if (amount <= 1000) return 'Bronze'
      if (amount <= 5000) return 'Silver'
      if (amount <= 15000) return 'Gold'
      if (amount <= 30000) return 'Platinum'
      return 'Diamond'
    }
  }

  function renderCards() {
    const plans = currency === 'USD' ? usdPlans : etbPlans
    const isUSD = currency === 'USD'

    return (
      <div className="invest-cards-grid grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan, idx) => {
          const dailyEarnings = Number(plan.profit) || 0
          const bonusAmount = Number(plan.bonus) || 0
          const totalReturnAllDays = (dailyEarnings * Number(plan.days)) + bonusAmount
          
          return (
            <div
              key={idx}
              className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 overflow-hidden shadow-md hover:shadow-lg transition-shadow"
            >
              {/* Card Header */}
              <div className="bg-gradient-to-r from-amber-100 to-orange-100 px-5 py-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-2xl font-bold text-slate-950">
                      {isUSD ? `$${(Number(plan.amount)).toFixed(2)}` : `${(Number(plan.amount)).toLocaleString()} Br`}
                    </p>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mt-1">
                      {getVipLevel(plan.amount)} Tier
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/10">
                    <TrendingUp size={20} className="text-amber-700" />
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="px-5 py-4 space-y-3 border-b border-amber-200">
                {/* Duration */}
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                    <Clock size={16} className="text-amber-700" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Duration</p>
                    <p className="font-semibold text-slate-900">{plan.days} Days</p>
                  </div>
                </div>

                {/* Daily Earnings */}
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                    <Gift size={16} className="text-green-700" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Daily Earnings</p>
                    <p className="font-semibold text-slate-900">
                      {isUSD ? `$${(Number(dailyEarnings)).toFixed(2)}` : `${(Number(dailyEarnings)).toLocaleString()} Br`}
                    </p>
                  </div>
                </div>

                {/* Bonus Reward */}
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                    <Star size={16} className="text-blue-700" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Bonus Reward</p>
                    <p className="font-semibold text-slate-900">
                      {isUSD ? `$${(Number(bonusAmount)).toFixed(2)}` : `${(Number(bonusAmount)).toLocaleString()} Br`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Return Section */}
              <div className="bg-slate-100 px-5 py-3 text-center mb-4 mx-5 mt-4 rounded-xl">
                <p className="text-xs text-slate-600 font-medium">Total Return (All Days)</p>
                <p className="text-lg font-bold text-slate-950 mt-1">
                  {isUSD ? `$${(Number(totalReturnAllDays)).toFixed(2)}` : `${(Number(totalReturnAllDays)).toLocaleString()} Br`}
                </p>
              </div>

              {/* Invest Button */}
              <div className="px-5 pb-5">
                <button className="w-full py-3 bg-[#84CC16] hover:bg-lime-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-[#84CC16]/30 flex items-center justify-center gap-2">
                  <span>Invest Now</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-950">Investment Plans</h1>
          <p className="text-sm text-slate-600 mt-1">Select your investment tier and start earning daily returns</p>
        </div>

        {/* Currency Toggle */}
        <div className="flex gap-2 mb-8">
          <button 
            onClick={() => setCurrency('USD')} 
            className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${currency === 'USD' ? 'bg-[#84CC16] text-white shadow-lg shadow-[#84CC16]/30' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
          >
            USD ($)
          </button>
          <button 
            onClick={() => setCurrency('ETB')} 
            className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${currency === 'ETB' ? 'bg-[#84CC16] text-white shadow-lg shadow-[#84CC16]/30' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
          >
            ETB (Br)
          </button>
        </div>

        {/* Cards Grid */}
        {renderCards()}
      </div>
    </div>
  )
}
