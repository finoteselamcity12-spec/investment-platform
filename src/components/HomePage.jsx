import { useState } from 'react'
import { TrendingUp, Wallet, Gift, ArrowDownRight, Users } from 'lucide-react'
import { getSession } from '../lib/authService'

export default function HomePage({ ctx }) {
  const {
    usdBalance = 0,
    etbBalance = 0,
    setUsdBalance,
    setEtbBalance,
    myActiveInvestmentsList = [],
    showToast,
    claimTimestamp,
    claimCooldownMs,
    setClaimTimestamp,
    setActivePage,
    userEmail,
  } = ctx

  const usdDailyReward = myActiveInvestmentsList
    .filter((item) => item.currency === 'USD')
    .reduce((sum, item) => sum + (Number(item.dailyProfit) || 0), 0)

  const etbDailyReward = myActiveInvestmentsList
    .filter((item) => item.currency === 'ETB')
    .reduce((sum, item) => sum + (Number(item.dailyProfit) || 0), 0)

  const lastClaimAge = claimTimestamp ? Date.now() - claimTimestamp : null
  const claimAvailable = !claimTimestamp || lastClaimAge >= claimCooldownMs
  const claimRemainingHours = claimTimestamp
    ? Math.max(0, Math.ceil((claimCooldownMs - lastClaimAge) / 3600000))
    : 0

  const [claiming, setClaiming] = useState(false)

  function persistBalances(nextUsd, nextEtb) {
    const session = getSession()
    const email = userEmail || session?.user?.email
    if (!email) return

    const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    userData[email] = {
      ...(userData[email] || {}),
      email,
      usdBalance: nextUsd,
      etbBalance: nextEtb,
    }
    localStorage.setItem('admin_user_data', JSON.stringify(userData))
  }

  function handleClaimRewards() {
    if (!claimAvailable) {
      showToast?.(`Claim available in ${claimRemainingHours} hours`, 'error')
      return
    }

    const totalReward = usdDailyReward + etbDailyReward
    if (totalReward <= 0) {
      showToast?.('No daily profit to claim. Start an investment first.', 'error')
      return
    }

    setClaiming(true)
    const nextUsd = Number(usdBalance) + usdDailyReward
    const nextEtb = Number(etbBalance) + etbDailyReward

    setUsdBalance?.(nextUsd)
    setEtbBalance?.(nextEtb)
    persistBalances(nextUsd, nextEtb)

    const ts = Date.now()
    localStorage.setItem('lastClaimTimestamp', String(ts))
    setClaimTimestamp?.(ts)

    const txns = JSON.parse(localStorage.getItem('user_transactions') || '[]')
    txns.unshift({
      id: `claim-${ts}`,
      type: 'Claim',
      category: 'Claims',
      title: `Daily claim: $${usdDailyReward.toFixed(2)} + ${etbDailyReward.toFixed(2)} Br`,
      amount: totalReward,
      status: 'Completed',
      date: new Date().toISOString(),
    })
    localStorage.setItem('user_transactions', JSON.stringify(txns))

    showToast?.('Daily rewards claimed successfully!', 'success')
    setClaiming(false)
  }

  const actionButtons = [
    { label: 'Deposit', page: 'deposit', icon: Wallet },
    { label: 'Invest', page: 'invest', icon: TrendingUp },
    { label: 'Withdraw', page: 'withdraw', icon: ArrowDownRight },
    { label: 'Invite', page: 'invite', icon: Users },
  ]

  return (
    <div className="home-page min-h-screen overflow-x-hidden bg-white pb-20">
      <div className="home-dashboard-stack w-full px-3 py-6">
        <header className="text-center">
          <h1 className="welcome-3d">Welcome to Blackrock</h1>
        </header>

        <div className="home-balance-card rounded-3xl text-white">
          <p className="home-balance-title">Total Balance</p>
          <p className="home-balance-total">
            ${(Number(usdBalance) + Number(etbBalance)).toFixed(2)}
          </p>
          <div className="home-wallet-grid">
            <div className="home-wallet-card">
              <p className="home-wallet-label">USD Wallet</p>
              <p className="home-wallet-value">${Number(usdBalance).toFixed(2)}</p>
            </div>
            <div className="home-wallet-card">
              <p className="home-wallet-label">ETB Wallet</p>
              <p className="home-wallet-value">
                {Number(etbBalance).toLocaleString()} Br
              </p>
            </div>
          </div>
        </div>

        <div className="home-action-grid grid grid-cols-2 gap-3 sm:grid-cols-4">
          {actionButtons.map(({ label, page, icon: Icon }) => (
            <button
              key={page}
              type="button"
              onClick={() => setActivePage?.(page)}
              className="home-action-btn flex flex-col items-center justify-center gap-1"
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-600">Daily Profit</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">
                ${(usdDailyReward + etbDailyReward).toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                USD ${usdDailyReward.toFixed(2)} · ETB {etbDailyReward.toFixed(2)} Br
              </p>
            </div>
            <button
              type="button"
              onClick={handleClaimRewards}
              disabled={!claimAvailable || claiming}
              className={`inline-flex items-center gap-2 rounded-full px-6 py-3 font-bold transition-all ${
                claimAvailable && !claiming
                  ? 'bg-[#84CC16] text-white shadow-lg shadow-[#84CC16]/30 hover:bg-lime-500'
                  : 'cursor-not-allowed bg-slate-200 text-slate-500'
              }`}
            >
              <Gift size={18} />
              {claimAvailable ? (claiming ? 'Claiming…' : 'Claim') : `${claimRemainingHours}h`}
            </button>
          </div>
        </div>

        <div className="home-metrics-grid">
          <div className="home-metric-card">
            <p className="home-metric-label">Active Plans</p>
            <p className="home-metric-value">{myActiveInvestmentsList.length}</p>
          </div>
          <div className="home-metric-card">
            <p className="home-metric-label">Sign-up Bonus</p>
            <p className="home-metric-value text-sm">150 Br + $1.7</p>
          </div>
        </div>
      </div>
    </div>
  )
}
