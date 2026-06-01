import { useState } from 'react'
import { ArrowUpCircle, Gift } from 'lucide-react'

export default function HomePage({ ctx }) {
  const {
    usdBalance, etbBalance, myActiveInvestmentsList, marketData,
    showToast, claimTimestamp, claimCooldownMs,
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
    showToast('Daily rewards claimed successfully!', 'success')
    localStorage.setItem('lastClaimTimestamp', Date.now())
  }

  return (
    <div className="space-y-6">
      {/* Total Balance Card */}
      <div className="app-card bg-gradient-to-br from-slate-800 to-slate-950 border-2 border-sky-500/50 p-6 rounded-2xl">
        <p className="text-slate-400 text-sm mb-2">Total Balance</p>
        <div className="text-4xl font-bold text-white mb-4">
          ${(usdBalance + etbBalance).toFixed(2)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800">
            <p className="text-slate-400 text-xs">USD Wallet</p>
            <p className="text-lg font-bold text-sky-400">${usdBalance.toFixed(2)}</p>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800">
            <p className="text-slate-400 text-xs">ETB Wallet</p>
            <p className="text-lg font-bold text-amber-400">{etbBalance.toLocaleString()} Br</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => ctx.setActivePage?.('deposit')}
          className="app-card bg-gradient-to-br from-sky-600 to-blue-700 hover:shadow-lg hover:shadow-sky-600/50 text-white p-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
        >
          <ArrowUpCircle size={20} />
          Deposit
        </button>
        <button
          onClick={() => ctx.setActivePage?.('invest')}
          className="app-card bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-white p-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
        >
          <ArrowUpCircle size={20} />
          Invest
        </button>
      </div>

      {/* Daily Profit Section */}
      <div className="app-card bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Daily Profit</p>
            <p className="text-2xl font-bold text-white">${(usdDailyReward + etbDailyReward).toFixed(2)}</p>
          </div>
          <button
            onClick={handleClaimRewards}
            disabled={!claimAvailable}
            className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all ${
              claimAvailable
                ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white hover:shadow-lg hover:shadow-green-600/50'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Gift size={16} />
            {claimAvailable ? 'Claim' : `${claimRemainingHours}h`}
          </button>
        </div>
      </div>

      {/* Market Overview */}
      <div className="app-card">
        <h3 className="text-lg font-bold text-white mb-4">Market Overview</h3>
        <div className="grid grid-cols-1 gap-3">
          {marketData.map((asset, idx) => (
            <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{asset.title}</p>
                  <p className="text-sm text-slate-400">{asset.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">{asset.price}</p>
                  <p className={`text-sm ${asset.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                    {asset.change}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="app-card">
        <h3 className="text-lg font-bold text-white mb-4">Quick Stats</h3>
        <div className="space-y-3">
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <p className="text-slate-400 text-sm">Active Investments</p>
              <p className="font-bold text-sky-400">{myActiveInvestmentsList.length}</p>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <p className="text-slate-400 text-sm">Total Invested</p>
              <p className="font-bold text-amber-400">
                ${myActiveInvestmentsList
                  .filter((i) => i.currency === 'USD')
                  .reduce((sum, i) => sum + i.amount, 0)
                  .toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
