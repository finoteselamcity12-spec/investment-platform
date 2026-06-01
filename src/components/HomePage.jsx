import { useState } from 'react'
import { TrendingUp, Wallet, Gift, ArrowUpRight } from 'lucide-react'

const PRIMARY_BLUE = '#0066CC'

export default function HomePage({ ctx }) {
  const {
    usdBalance, etbBalance, myActiveInvestmentsList, marketData,
    showToast, claimTimestamp, claimCooldownMs, setActivePage,
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
    <div className="bg-white pb-4">
      <div className="space-y-5">
        {/* Header - Mobile-First Typography */}
        <div>
          <p className="text-xs font-semibold text-slate-500">Welcome back</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Your Dashboard</h1>
        </div>

        {/* Total Balance Card - Mobile optimized */}
        <div
          className="rounded-3xl p-6 text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${PRIMARY_BLUE}, #005BB3)`,
            boxShadow: `0 8px 24px ${PRIMARY_BLUE}30`,
          }}
        >
          <p className="text-sm font-semibold opacity-90">Total Balance</p>
          <p className="mt-3 text-4xl font-bold tracking-tight">
            ${(usdBalance + etbBalance).toFixed(2)}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
              <p className="text-xs font-semibold opacity-80">USD</p>
              <p className="mt-2 text-lg font-bold">${usdBalance.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
              <p className="text-xs font-semibold opacity-80">ETB</p>
              <p className="mt-2 text-lg font-bold">{etbBalance.toLocaleString()} Br</p>
            </div>
          </div>
        </div>

        {/* Action Buttons - Large & Thumb-Friendly */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setActivePage?.('deposit')}
            className="rounded-2xl bg-slate-100 px-4 py-5 font-bold text-slate-950 active:scale-95 transition"
            style={{
              borderLeft: `4px solid ${PRIMARY_BLUE}`,
            }}
          >
            <Wallet size={28} className="mx-auto mb-2" style={{ color: PRIMARY_BLUE }} />
            <span className="text-sm">Deposit</span>
          </button>
          <button
            onClick={() => setActivePage?.('invest')}
            className="rounded-2xl bg-slate-100 px-4 py-5 font-bold text-slate-950 active:scale-95 transition"
            style={{
              borderLeft: `4px solid ${PRIMARY_BLUE}`,
            }}
          >
            <TrendingUp size={28} className="mx-auto mb-2" style={{ color: PRIMARY_BLUE }} />
            <span className="text-sm">Invest</span>
          </button>
          <button
            onClick={() => setActivePage?.('history')}
            className="rounded-2xl bg-slate-100 px-4 py-5 font-bold text-slate-950 active:scale-95 transition"
            style={{
              borderLeft: `4px solid ${PRIMARY_BLUE}`,
            }}
          >
            <ArrowUpRight size={28} className="mx-auto mb-2" style={{ color: PRIMARY_BLUE }} />
            <span className="text-sm">History</span>
          </button>
          <button
            onClick={() => setActivePage?.('support')}
            className="rounded-2xl bg-slate-100 px-4 py-5 font-bold text-slate-950 active:scale-95 transition"
            style={{
              borderLeft: `4px solid ${PRIMARY_BLUE}`,
            }}
          >
            <Gift size={28} className="mx-auto mb-2" style={{ color: PRIMARY_BLUE }} />
            <span className="text-sm">Support</span>
          </button>
        </div>

        {/* Daily Profit & Claim */}
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-600">Daily Profit</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">
                ${(usdDailyReward + etbDailyReward).toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-slate-500">From your investments</p>
            </div>
          </div>
          <button
            onClick={handleClaimRewards}
            disabled={!claimAvailable}
            className="w-full mt-4 rounded-2xl px-4 py-3 font-bold text-white active:scale-95 transition disabled:opacity-60"
            style={{
              backgroundColor: claimAvailable ? PRIMARY_BLUE : '#CBD5E1',
              boxShadow: claimAvailable ? `0 4px 12px ${PRIMARY_BLUE}30` : 'none',
            }}
          >
            {claimAvailable ? '🎁 Claim Daily Reward' : `Available in ${claimRemainingHours}h`}
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Active Plans</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{myActiveInvestmentsList.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Total Invested</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              ${myActiveInvestmentsList
                .filter((i) => i.currency === 'USD')
                .reduce((sum, i) => sum + i.amount, 0)
                .toFixed(2)}
            </p>
          </div>
        </div>

        {/* Market Overview */}
        {marketData && marketData.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-bold text-slate-950">Market Watch</h2>
            <div className="space-y-3">
              {marketData.map((asset, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-950">{asset.symbol}</p>
                    <p className="text-xs text-slate-500 mt-1">{asset.title}</p>
                  </div>
                  <div className="text-right">
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
      </div>
    </div>
  )
}
