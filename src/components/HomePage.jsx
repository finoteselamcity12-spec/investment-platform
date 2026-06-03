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

        {/* Total Balance Card */}
        <div className="rounded-3xl bg-gradient-to-br from-[#84CC16] to-lime-500 p-8 text-white shadow-lg shadow-[#84CC16]/30">
          <p className="text-sm font-semibold opacity-90">Total Balance</p>
          <p className="mt-3 text-5xl font-bold">${(Number(usdBalance) + Number(etbBalance)).toFixed(2)}</p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
              <p className="text-xs font-semibold opacity-80">USD Wallet</p>
              <p className="mt-1 text-xl font-bold">${(Number(usdBalance)).toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
              <p className="text-xs font-semibold opacity-80">ETB Wallet</p>
              <p className="mt-1 text-xl font-bold">{(Number(etbBalance)).toLocaleString()} Br</p>
            </div>
          </div>
        </div>

        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => setActivePage?.('withdraw')}
            className="w-full sm:w-auto rounded-2xl bg-[#84CC16] px-4 py-3 font-bold text-white shadow-lg shadow-[#84CC16]/30 transition-all hover:bg-lime-500"
          >
            Withdrawal
          </button>
          <button
            onClick={() => setActivePage?.('history')}
            className="w-full sm:w-auto rounded-2xl bg-[#84CC16] px-4 py-3 font-bold text-white shadow-lg shadow-[#84CC16]/30 transition-all hover:bg-lime-500"
          >
            History
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
