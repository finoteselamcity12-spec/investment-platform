import { useState } from 'react'
import { TrendingUp, Wallet, Gift, ArrowUpRight } from 'lucide-react'

export default function HomePage({ ctx }) {
  const {
    usdBalance, etbBalance, myActiveInvestmentsList, marketData,
    showToast, claimTimestamp, claimCooldownMs, setActivePage, userEmail,
  } = ctx

  const usdDailyReward = myActiveInvestmentsList
    .filter((item) => item.currency === 'USD')
    .reduce((sum, item) => sum + (item.dailyProfit || 0), 0)

  const etbDailyReward = myActiveInvestmentsList
    .filter((item) => item.currency === 'ETB')
    .reduce((sum, item) => sum + (item.dailyProfit || 0), 0)

  const lastClaimAge = claimTimestamp ? Date.now() - claimTimestamp : null
  const claimAvailable = !claimTimestamp || lastClaimAge >= claimCooldownMs
  const claimRemainingHours = claimTimestamp
    ? Math.max(0, Math.ceil((claimCooldownMs - lastClaimAge) / 3600000))
    : 0

  const handleClaimRewards = () => {
    if (!claimAvailable) {
      showToast(`Claim available in ${claimRemainingHours} hours`, 'error')
      return
    }

    const usdGain = usdDailyReward
    const etbGain = etbDailyReward

    if (usdGain === 0 && etbGain === 0) {
      showToast('No rewards available to claim yet.', 'error')
      return
    }

    showToast('Daily rewards claimed successfully!', 'success')
    localStorage.setItem('lastClaimTimestamp', Date.now())
  }

  const totalUsdInvested = myActiveInvestmentsList
    .filter((i) => i.currency === 'USD')
    .reduce((sum, i) => sum + parseNumber(i.amount), 0)

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* 3D Welcome Text */}
        <div className="w-full text-center">
          <h2 className="welcome-3d">WELCOME TO BLACKROCK</h2>
        </div>

        {/* Total Balance Card removed per request */}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <button
            onClick={() => setActivePage?.('deposit')}
            className="rounded-2xl bg-[#84CC16] px-4 py-4 font-bold text-white shadow-lg shadow-[#84CC16]/30 transition-all hover:bg-lime-500 flex flex-col items-center gap-2"
          >
            <Wallet size={24} />
            <span>Deposit</span>
          </button>
          <button
            onClick={() => setActivePage?.('invest')}
            className="rounded-2xl bg-[#84CC16] px-4 py-4 font-bold text-white shadow-lg shadow-[#84CC16]/30 transition-all hover:bg-lime-500 flex flex-col items-center gap-2"
          >
            <TrendingUp size={24} />
            <span>Invest</span>
          </button>
          <button
            onClick={() => setActivePage?.('history')}
            className="rounded-2xl border-2 border-[#84CC16] bg-white px-4 py-4 font-bold text-[#84CC16] transition-all hover:bg-[#84CC16] hover:text-white flex flex-col items-center gap-2 col-span-2 md:col-span-1"
          >
            <ArrowUpRight size={24} />
            <span>History</span>
          </button>
        </div>

        {/* Daily Profit Card */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-600">Daily Profit</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">${(Number(usdDailyReward) + Number(etbDailyReward)).toFixed(2)}</p>
              <p className="mt-1 text-xs text-slate-500">From active investments</p>
            </div>
            <button
              onClick={handleClaimRewards}
              disabled={!claimAvailable}
              className={`rounded-full px-6 py-3 font-bold transition-all ${
                claimAvailable
                  ? 'bg-[#84CC16] text-white shadow-lg shadow-[#84CC16]/30 hover:bg-lime-500'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              {claimAvailable ? 'Claim Daily Reward' : `${claimRemainingHours}h`}
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-slate-600">Active Investments</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">{myActiveInvestmentsList.length}</p>
          </div>
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-slate-600">Total Invested</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              ${(Number(myActiveInvestmentsList
                .filter((i) => i.currency === 'USD')
                .reduce((sum, i) => sum + (i.amount || 0), 0))).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Removed Market Overview and Active Investments sections to simplify Home Page per request */}
      </div>
    </div>
  )
}
