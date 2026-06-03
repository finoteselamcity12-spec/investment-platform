import { TrendingUp, Wallet } from 'lucide-react'

export default function HomePage({ ctx }) {
  const {
    myActiveInvestmentsList = [],
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

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.36em] text-slate-500">BLACKROCK</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">Welcome back.</h1>
          <p className="mt-2 text-sm text-slate-500">Your dashboard is ready for action.</p>
        </div>

        <div className="rounded-3xl bg-slate-950 p-7 text-white shadow-2xl shadow-slate-900/20">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Total Balance</p>
          <p className="mt-4 text-5xl font-semibold">$0.00</p>
          <p className="mt-3 text-sm text-slate-400">Displayed until your first deposit or investment.</p>
        </div>

        <div
          className="grid gap-4"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}
        >
          <button
            onClick={() => setActivePage?.('withdraw')}
            className="min-h-[96px] rounded-[15px] border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition hover:border-slate-300"
          >
            Withdrawal
          </button>
          <button
            onClick={() => setActivePage?.('history')}
            className="min-h-[96px] rounded-[15px] border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition hover:border-slate-300"
          >
            History
          </button>
          <button
            onClick={() => setActivePage?.('deposit')}
            className="min-h-[96px] rounded-[15px] border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition hover:border-slate-300"
          >
            Deposit
          </button>
          <button
            onClick={() => setActivePage?.('invest')}
            className="min-h-[96px] rounded-[15px] border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition hover:border-slate-300"
          >
            Invest
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-[15px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-semibold text-slate-500">Daily Profit</p>
            <p className="mt-4 text-2xl font-semibold text-slate-950">USD 24</p>
          </div>

          <div className="rounded-[15px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-semibold text-slate-500">Active Investments</p>
            <p className="mt-4 text-2xl font-semibold text-slate-950">{activeInvestmentsCount}</p>
          </div>

          <div className="rounded-[15px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-semibold text-slate-500">Total Invested</p>
            <p className="mt-4 text-2xl font-semibold text-slate-950">USD $0.00 / ETB 0.00</p>
          </div>
        </div>
      </div>
    </div>
  )
}
