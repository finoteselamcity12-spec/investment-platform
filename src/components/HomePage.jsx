import { TrendingUp, Wallet } from 'lucide-react'

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
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.36em] text-[#84CC16]">BLACKROCK</p>
          <h1 className="mt-3 text-4xl font-bold text-[#84CC16] sm:text-5xl">Welcome back.</h1>
          <p className="mt-2 text-sm text-slate-500">Your dashboard is ready for action.</p>
        </div>

        <div className="rounded-3xl bg-[#84CC16] px-5 py-4 text-white shadow-2xl shadow-[#84CC16]/30">
          <p className="text-sm uppercase tracking-[0.2em] font-semibold">Total Balance</p>
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

        <div className="grid w-full grid-cols-2 gap-4">
          {actionButtons.map(({ label, page }) => (
            <button
              key={page}
              onClick={() => setActivePage?.(page)}
              className="flex aspect-square w-full min-h-[96px] items-center justify-center rounded-[15px] bg-[#84CC16] px-4 py-4 text-sm font-semibold text-white shadow-lg shadow-[#84CC16]/30 transition hover:bg-lime-500"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-full space-y-4">
          <div className="grid w-full grid-cols-2 gap-4">
            <div className="w-full rounded-[15px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
              <p className="text-sm font-semibold text-slate-500">Daily Profit</p>
              <p className="mt-4 text-2xl font-semibold text-slate-950">
                USD {usdDailyReward.toFixed(2)} / ETB {etbDailyReward.toFixed(2)}
              </p>
            </div>

            <div className="w-full rounded-[15px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
              <p className="text-sm font-semibold text-slate-500">Active Investments</p>
              <p className="mt-4 text-2xl font-semibold text-slate-950">{activeInvestmentsCount}</p>
            </div>
          </div>

          <div className="w-full rounded-[15px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-semibold text-slate-500">Total Invested</p>
            <p className="mt-4 text-2xl font-semibold text-slate-950">
              USD ${totalUsdInvested.toFixed(2)} / ETB {totalEtbInvested.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
