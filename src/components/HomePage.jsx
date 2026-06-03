import { useState } from 'react'
import { TrendingUp, Wallet, Gift, ArrowUpRight } from 'lucide-react'

const PRIMARY_GREEN = '#84CC16'

export default function HomePage({ ctx }) {
  const {
    usdBalance, etbBalance, myActiveInvestmentsList, marketData,
    showToast, claimTimestamp, claimCooldownMs, setActivePage, formatCurrency,
    setUsdBalance, setEtbBalance, addTransaction, userEmail,
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

  const usdInvestments = myActiveInvestmentsList.filter((item) => item.currency === 'USD')
  const etbInvestments = myActiveInvestmentsList.filter((item) => item.currency === 'ETB')
  const usdInvestmentsTotal = usdInvestments.reduce((sum, item) => sum + (item.total || 0), 0)
  const etbInvestmentsTotal = etbInvestments.reduce((sum, item) => sum + (item.total || 0), 0)

  const formatSafeFixed = (value, digits = 2) => {
    return typeof value === 'number' ? value.toFixed(digits) : '0.00'
  }

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

    setUsdBalance((prev) => Number((Number(prev) + Number(usdGain)).toFixed(2)))
    setEtbBalance((prev) => Number((Number(prev) + Number(etbGain)).toFixed(2)))

    if (userEmail) {
      const users = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
      if (!users[userEmail]) {
        users[userEmail] = { email: userEmail, usdBalance: 0, etbBalance: 0 }
      }
      users[userEmail].usdBalance = Number((Number(users[userEmail].usdBalance || 0) + Number(usdGain)).toFixed(2))
      users[userEmail].etbBalance = Number((Number(users[userEmail].etbBalance || 0) + Number(etbGain)).toFixed(2))
      localStorage.setItem('admin_user_data', JSON.stringify(users))
    }

    addTransaction({
      id: `claim-${Date.now()}`,
      type: 'Claim',
      category: 'Claims',
      title: 'Daily rewards claimed',
      amount: usdGain + etbGain,
      currency: usdGain > 0 ? 'USD' : 'ETB',
      status: 'Completed',
      date: new Date().toISOString(),
    })

    showToast('Daily rewards claimed successfully!', 'success')
    localStorage.setItem('lastClaimTimestamp', Date.now())
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Welcome back</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Your Dashboard</h1>
      </div>

      <section className="rounded-[2rem] bg-gradient-to-br from-emerald-500 via-emerald-600 to-slate-950 px-5 py-6 text-white shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-100/90">Total Balance</p>
            <p className="mt-4 text-4xl font-extrabold tracking-tight">${formatSafeFixed(Number(usdBalance) + Number(etbBalance))}</p>
            <p className="mt-2 text-sm text-emerald-100/80">Portfolio value across your account</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-white shadow-inner shadow-black/10">
            <TrendingUp size={28} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-[1.75rem] bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/10">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/80">USD Balance</p>
            <p className="mt-3 text-2xl font-semibold">${formatSafeFixed(usdBalance)}</p>
          </div>
          <div className="rounded-[1.75rem] bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/10">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/80">ETB Balance</p>
            <p className="mt-3 text-2xl font-semibold">{typeof etbBalance === 'number' ? etbBalance.toFixed(2) : '0.00'} Br</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setActivePage?.('deposit')}
          className="rounded-[1.75rem] border border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-50"
        >
          <Wallet size={24} className="mx-auto mb-2 text-emerald-600" />
          Deposit
        </button>
        <button
          onClick={() => setActivePage?.('invest')}
          className="rounded-[1.75rem] border border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-50"
        >
          <TrendingUp size={24} className="mx-auto mb-2 text-emerald-600" />
          Invest
        </button>
        <button
          onClick={() => setActivePage?.('history')}
          className="rounded-[1.75rem] border border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-50"
        >
          <ArrowUpRight size={24} className="mx-auto mb-2 text-emerald-600" />
          History
        </button>
        <button
          onClick={() => setActivePage?.('support')}
          className="rounded-[1.75rem] border border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-50"
        >
          <Gift size={24} className="mx-auto mb-2 text-emerald-600" />
          Support
        </button>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Daily Profit</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">${formatSafeFixed(Number(usdDailyReward) + Number(etbDailyReward))}</p>
            <p className="mt-1 text-sm text-slate-500">Projected daily earnings</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">+2.4%</span>
        </div>
        <button
          onClick={handleClaimRewards}
          disabled={!claimAvailable}
          className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {claimAvailable ? 'Claim Daily Reward' : `Available in ${claimRemainingHours}h`}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Active Plans</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{myActiveInvestmentsList.length}</p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Invested</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
            ${Number(
              myActiveInvestmentsList
                .filter((i) => i.currency === 'USD')
                .reduce((sum, i) => Number(sum) + Number(i.amount), 0)
            ).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Investment Tables</p>
            <h2 className="text-lg font-bold text-slate-950">USD and ETB Investment Summary</h2>
          </div>
            <div className="rounded-3xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            Total USD: ${formatSafeFixed(usdInvestmentsTotal)}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">USD Investments</p>
                <p className="mt-1 text-sm text-slate-600">Records with profit, bonus, and total.</p>
              </div>
              <p className="text-sm font-semibold text-slate-950">Total {formatCurrency(usdInvestmentsTotal, 'USD')}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-700">
                <thead>
                  <tr>
                    <th className="pb-3 text-slate-500">Plan</th>
                    <th className="pb-3 text-slate-500">Amount</th>
                    <th className="pb-3 text-slate-500">Profit</th>
                    <th className="pb-3 text-slate-500">Bonus</th>
                    <th className="pb-3 text-slate-500">Total</th>
                    <th className="pb-3 text-slate-500">Maturity</th>
                  </tr>
                </thead>
                <tbody>
                  {usdInvestments.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-4 text-center text-slate-500">No active USD investments yet.</td>
                    </tr>
                  ) : (
                    usdInvestments.map((item) => (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="py-3 text-slate-950">{item.tierName || item.amount}</td>
                        <td className="py-3">{formatCurrency(item.amount, 'USD')}</td>
                        <td className="py-3">{formatCurrency(item.profit || 0, 'USD')}</td>
                        <td className="py-3">{formatCurrency(item.depBonus || 0, 'USD')}</td>
                        <td className="py-3 font-semibold text-slate-950">{formatCurrency(item.total || ((item.profit || 0) + (item.depBonus || 0)), 'USD')}</td>
                        <td className="py-3 text-slate-500">{new Date(item.endDate).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">ETB Investments</p>
                <p className="mt-1 text-sm text-slate-600">Records with profit, bonus, and total.</p>
              </div>
              <p className="text-sm font-semibold text-slate-950">Total {formatCurrency(etbInvestmentsTotal, 'ETB')}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-700">
                <thead>
                  <tr>
                    <th className="pb-3 text-slate-500">Plan</th>
                    <th className="pb-3 text-slate-500">Amount</th>
                    <th className="pb-3 text-slate-500">Profit</th>
                    <th className="pb-3 text-slate-500">Bonus</th>
                    <th className="pb-3 text-slate-500">Total</th>
                    <th className="pb-3 text-slate-500">Maturity</th>
                  </tr>
                </thead>
                <tbody>
                  {etbInvestments.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-4 text-center text-slate-500">No active ETB investments yet.</td>
                    </tr>
                  ) : (
                    etbInvestments.map((item) => (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="py-3 text-slate-950">{item.tierName || item.amount}</td>
                        <td className="py-3">{formatCurrency(item.amount, 'ETB')}</td>
                        <td className="py-3">{formatCurrency(item.profit || 0, 'ETB')}</td>
                        <td className="py-3">{formatCurrency(item.depBonus || 0, 'ETB')}</td>
                        <td className="py-3 font-semibold text-slate-950">{formatCurrency(item.total || ((item.profit || 0) + (item.depBonus || 0)), 'ETB')}</td>
                        <td className="py-3 text-slate-500">{new Date(item.endDate).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {marketData && marketData.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">Market Watch</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Live</p>
          </div>
          <div className="space-y-3">
            {marketData.map((asset, idx) => (
              <div key={idx} className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{asset.title}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{asset.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-950">{asset.price}</p>
                    <p className={`mt-1 text-sm font-semibold ${asset.trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {asset.change}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
