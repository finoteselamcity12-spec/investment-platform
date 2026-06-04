import { TrendingUp, Wallet, ArrowDownRight, Users } from 'lucide-react'
import {
  REGISTRATION_BONUS_USD,
  REGISTRATION_BONUS_ETB,
} from '../lib/platformConfig'

export default function HomePage({ ctx }) {
  const {
    usdBalance = 0,
    etbBalance = 0,
    myActiveInvestmentsList = [],
    setActivePage,
    referralEarningsUsd = 0,
    referralEarningsEtb = 0,
  } = ctx

  const spendableUsd = Math.max(0, Number(usdBalance) - REGISTRATION_BONUS_USD)
  const spendableEtb = Math.max(0, Number(etbBalance) - REGISTRATION_BONUS_ETB)
  const totalBalance = spendableUsd + spendableEtb

  const usdDailyProfit = myActiveInvestmentsList
    .filter((item) => item.currency === 'USD')
    .reduce((sum, item) => sum + (Number(item.dailyProfit) || 0), 0)

  const etbDailyProfit = myActiveInvestmentsList
    .filter((item) => item.currency === 'ETB')
    .reduce((sum, item) => sum + (Number(item.dailyProfit) || 0), 0)

  const activeInvestmentUsd = myActiveInvestmentsList
    .filter((item) => item.currency === 'USD')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const activeInvestmentEtb = myActiveInvestmentsList
    .filter((item) => item.currency === 'ETB')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const actionButtons = [
    { label: 'Deposit', page: 'deposit', icon: Wallet },
    { label: 'Invest', page: 'invest', icon: TrendingUp },
    { label: 'Withdraw', page: 'withdraw', icon: ArrowDownRight },
    { label: 'Invite', page: 'invite', icon: Users },
  ]

  const statCards = [
    {
      label: 'Daily ETB Profit',
      value: `${etbDailyProfit.toFixed(2)} Br`,
    },
    {
      label: 'Daily USD Profit',
      value: `$${usdDailyProfit.toFixed(2)}`,
    },
    {
      label: 'Active Investment ETB',
      value: `${activeInvestmentEtb.toLocaleString()} Br`,
    },
    {
      label: 'Active Investment USD',
      value: `$${activeInvestmentUsd.toFixed(2)}`,
    },
  ]

  return (
    <div className="home-page min-h-0 w-full max-w-full overflow-x-hidden bg-white">
      <div className="home-dashboard-stack mx-auto w-full max-w-lg">
        <header className="text-center">
          <h1 className="welcome-3d">Welcome to Blackrock</h1>
        </header>

        <div className="home-balance-card rounded-3xl text-white">
          <p className="home-balance-title">Total Balance</p>
          <p className="home-balance-total">${totalBalance.toFixed(2)}</p>
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
          <div className="home-referral-grid">
            <div className="home-referral-card">
              <p className="home-referral-label">USD Referral Bonus</p>
              <p className="home-referral-value">
                ${Number(referralEarningsUsd).toFixed(2)}
              </p>
            </div>
            <div className="home-referral-card">
              <p className="home-referral-label">ETB Referral Bonus</p>
              <p className="home-referral-value">
                {Number(referralEarningsEtb).toLocaleString()} Br
              </p>
            </div>
          </div>
        </div>

        <div className="home-action-grid">
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

        <div className="home-metrics-grid">
          {statCards.map(({ label, value }) => (
            <div key={label} className="home-metric-card">
              <p className="home-metric-label">{label}</p>
              <p className="home-metric-value">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
