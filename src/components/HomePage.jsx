import { TrendingUp, Wallet, ArrowDownRight, Users, Coins } from 'lucide-react'

const GOLD = '#FFD700'

export default function HomePage({ ctx }) {
  const {
    usdBalance = 0,
    etbBalance = 0,
    myActiveInvestmentsList = [],
    setActivePage,
    referralEarningsUsd = 0,
    referralEarningsEtb = 0,
  } = ctx

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
    { label: 'Daily ETB Profit', value: `${etbDailyProfit.toFixed(2)} Br` },
    { label: 'Daily USD Profit', value: `$${usdDailyProfit.toFixed(2)}` },
    { label: 'Active Investment ETB', value: `${activeInvestmentEtb.toLocaleString()} Br` },
    { label: 'Active Investment USD', value: `$${activeInvestmentUsd.toFixed(2)}` },
  ]

  return (
    <div className="home-page home-page--premium box-border min-h-0 w-full max-w-full overflow-x-hidden">
      <div className="home-dashboard-stack mx-auto flex w-[95%] max-w-lg flex-col">
        <header className="home-header-premium">
          <p className="home-header-eyebrow">Your portfolio</p>
          <h1 className="welcome-premium">Welcome to Blackrock</h1>
        </header>

        <section className="home-wallets-panel" aria-label="Wallet balances">
          <div className="home-wallet-grid">
            <article className="home-wallet-card home-glass-card">
              <div className="home-wallet-header">
                <span className="home-icon-orb home-icon-orb--gold" aria-hidden="true">
                  <Coins size={20} strokeWidth={2.25} style={{ color: GOLD }} />
                </span>
                <p className="home-wallet-label">USD Wallet</p>
              </div>
              <p className="home-wallet-value">${Number(usdBalance).toFixed(2)}</p>
            </article>
            <article className="home-wallet-card home-glass-card">
              <div className="home-wallet-header">
                <span className="home-icon-orb home-icon-orb--gold" aria-hidden="true">
                  <Coins size={20} strokeWidth={2.25} style={{ color: GOLD }} />
                </span>
                <p className="home-wallet-label">ETB Wallet</p>
              </div>
              <p className="home-wallet-value">{Number(etbBalance).toLocaleString()} Br</p>
            </article>
          </div>
          <div className="home-referral-grid">
            <article className="home-referral-card home-glass-card home-glass-card--subtle">
              <p className="home-referral-label">USD Referral Bonus</p>
              <p className="home-referral-value">${Number(referralEarningsUsd).toFixed(2)}</p>
            </article>
            <article className="home-referral-card home-glass-card home-glass-card--subtle">
              <p className="home-referral-label">ETB Referral Bonus</p>
              <p className="home-referral-value">{Number(referralEarningsEtb).toLocaleString()} Br</p>
            </article>
          </div>
        </section>

        <nav className="home-action-grid" aria-label="Quick actions">
          {actionButtons.map(({ label, page, icon: Icon }) => (
            <button
              key={page}
              type="button"
              onClick={() => setActivePage?.(page)}
              className="home-action-btn home-action-btn--premium"
            >
              <span className="home-icon-orb home-icon-orb--action" aria-hidden="true">
                <Icon size={20} strokeWidth={2.25} />
              </span>
              <span className="home-action-label">{label}</span>
            </button>
          ))}
        </nav>

        <section className="home-metrics-grid" aria-label="Investment metrics">
          {statCards.map(({ label, value }) => (
            <article key={label} className="home-metric-card home-metric-card--premium">
              <p className="home-metric-label">{label}</p>
              <p className="home-metric-value">{value}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
