export default function HomePage({ ctx }) {
  const {
    myActiveInvestmentsList = [],
    usdBalance = 0,
    etbBalance = 0,
    setActivePage,
  } = ctx

  const activeInvestmentsCount = myActiveInvestmentsList.length
  const usdDailyReward = myActiveInvestmentsList
    .filter((item) => item.currency === 'USD')
    .reduce((sum, item) => sum + (Number(item.dailyProfit) || 0), 0)
  const etbDailyReward = myActiveInvestmentsList
    .filter((item) => item.currency === 'ETB')
    .reduce((sum, item) => sum + (Number(item.dailyProfit) || 0), 0)

  const totalUsdInvested = myActiveInvestmentsList
    .filter((item) => item.currency === 'USD')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const totalEtbInvested = myActiveInvestmentsList
    .filter((item) => item.currency === 'ETB')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const actionButtons = [
    { label: 'Withdrawal', page: 'withdraw' },
    { label: 'History', page: 'history' },
    { label: 'Deposit', page: 'deposit' },
    { label: 'Invest', page: 'invest' },
  ]

  return (
    <div className="home-page min-h-screen overflow-x-hidden bg-slate-50 pb-20">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <header className="text-center">
          <h1 className="welcome-3d">Welcome to Blackrock</h1>
          <p className="text-sm text-slate-500">Your dashboard is ready for action.</p>
        </header>

        <div className="home-balance-card rounded-3xl px-5 py-5 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em]">Total Balance</p>
          <div className="home-balance-rows">
            <div className="home-balance-row">
              <span className="home-balance-label">Balance ETB:</span>
              <span className="home-balance-value">{Number(etbBalance).toFixed(2)}</span>
            </div>
            <div className="home-balance-row">
              <span className="home-balance-label">Balance USD:</span>
              <span className="home-balance-value">{Number(usdBalance).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="home-action-grid">
          {actionButtons.map(({ label, page }) => (
            <button
              key={page}
              type="button"
              onClick={() => setActivePage?.(page)}
              className="home-action-btn"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-full space-y-[10px]">
          <div className="home-action-grid">
            <div className="min-w-0 w-full rounded-[15px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:p-5">
              <p className="text-sm font-semibold text-slate-500">Daily Profit</p>
              <p className="mt-3 text-lg font-semibold text-[#1a1a1a] sm:mt-4 sm:text-2xl">
                USD {usdDailyReward.toFixed(2)} / ETB {etbDailyReward.toFixed(2)}
              </p>
            </div>

            <div className="min-w-0 w-full rounded-[15px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:p-5">
              <p className="text-sm font-semibold text-slate-500">Active Investments</p>
              <p className="mt-3 text-lg font-semibold text-[#1a1a1a] sm:mt-4 sm:text-2xl">
                {activeInvestmentsCount}
              </p>
            </div>
          </div>

          <div className="w-full rounded-[15px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:p-5">
            <p className="text-sm font-semibold text-slate-500">Total Invested</p>
            <p className="mt-3 text-lg font-semibold text-[#1a1a1a] sm:mt-4 sm:text-2xl">
              USD ${totalUsdInvested.toFixed(2)} / ETB {totalEtbInvested.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
