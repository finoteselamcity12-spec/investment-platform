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
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Header */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Welcome Back</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Smart Wealth Dashboard</h1>
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

        {/* Market Overview */}
        {marketData && marketData.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-bold text-slate-950">Market Overview</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {marketData.map((asset, idx) => (
                <div key={idx} className="rounded-2xl border-2 border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-950">{asset.title}</p>
                      <p className="text-xs text-slate-600">{asset.symbol}</p>
                    </div>
                    <TrendingUp className="h-5 w-5 text-[#84CC16]" />
                  </div>
                  <div className="mt-3">
                    <p className="font-bold text-slate-950">{asset.price}</p>
                    <p className={`text-sm font-semibold ${asset.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                      {asset.change}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Investments Table */}
        {myActiveInvestmentsList.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-bold text-slate-950">Active Investments</h2>
            <div className="overflow-x-auto rounded-2xl border-2 border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left font-bold text-slate-950">Investment</th>
                    <th className="px-4 py-3 text-center font-bold text-slate-950">Days</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-950">Profit</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-950">Deposit</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-950">Bonus</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-950">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {myActiveInvestmentsList.map((inv) => {
                    const profitAmount = inv.totalReturn || (inv.dailyProfit * inv.days) || 0
                    const depositAmount = inv.amount || 0
                    const bonusAmount = inv.bonus || 0
                    const total = (Number(profitAmount) + Number(depositAmount) + Number(bonusAmount))
                    
                    return (
                      <tr key={inv.id} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-950">{inv.tierName}</td>
                        <td className="px-4 py-3 text-center text-slate-700">{inv.days}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {inv.currency === 'USD' ? `$${(Number(profitAmount)).toFixed(2)}` : `${(Number(profitAmount)).toLocaleString()} Br`}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-950">
                          {inv.currency === 'USD' ? `$${(Number(depositAmount)).toFixed(2)}` : `${(Number(depositAmount)).toLocaleString()} Br`}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {inv.currency === 'USD' ? `$${(Number(bonusAmount)).toFixed(2)}` : `${(Number(bonusAmount)).toLocaleString()} Br`}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#84CC16] text-base">
                          {inv.currency === 'USD' ? `$${(Number(total)).toFixed(2)}` : `${(Number(total)).toLocaleString()} Br`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
