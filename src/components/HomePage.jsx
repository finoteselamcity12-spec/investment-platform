const PRIMARY_GREEN = '#84CC16'

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

  const buttonClass =
    'h-[72px] w-full min-w-0 rounded-[15px] border-2 bg-white px-3 py-3 text-left text-sm font-semibold shadow-sm transition hover:bg-[#84CC16]/5 sm:px-4'

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 pb-20">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {/* Header — 3D styled */}
        <header className="text-center">
          <h1 className="welcome-3d">Welcome to Blackrock</h1>
          <p className="text-sm text-slate-500">Your dashboard is ready for action.</p>
        </header>

        {/* Balance card — vibrant green #84CC16 */}
        <div className="home-balance-card rounded-3xl px-5 py-4 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em]">Total Balance</p>
          <div className="mt-3 space-y-2">
            <p className="text-base">
              <span className="font-medium">Balance ETB: </span>
              <span className="text-xl font-bold">{Number(etbBalance).toFixed(2)}</span>
            </p>
            <p className="text-base">
              <span className="font-medium">Balance USD: </span>
              <span className="text-xl font-bold">{Number(usdBalance).toFixed(2)}</span>
            </p>
          </div>
        </div>

        {/* Action buttons — 2x2 grid, white + green border */}
        <div
          className="w-full"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}
        >
          <button
            type="button"
            onClick={() => setActivePage?.('withdraw')}
            className={buttonClass}
            style={{ borderColor: PRIMARY_GREEN, color: PRIMARY_GREEN }}
          >
            Withdrawal
          </button>
          <button
            type="button"
            onClick={() => setActivePage?.('history')}
            className={buttonClass}
            style={{ borderColor: PRIMARY_GREEN, color: PRIMARY_GREEN }}
          >
            History
          </button>
          <button
            type="button"
            onClick={() => setActivePage?.('deposit')}
            className={buttonClass}
            style={{ borderColor: PRIMARY_GREEN, color: PRIMARY_GREEN }}
          >
            Deposit
          </button>
          <button
            type="button"
            onClick={() => setActivePage?.('invest')}
            className={buttonClass}
            style={{ borderColor: PRIMARY_GREEN, color: PRIMARY_GREEN }}
          >
            Invest
          </button>
        </div>

        <div className="w-full space-y-[10px]">
          <div
            className="w-full"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}
          >
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
