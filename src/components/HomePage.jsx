export default function HomePage({ ctx }) {
  const {
    myActiveInvestmentsList = [],
    usdBalance = 0,
    etbBalance = 0,
    setActivePage,
  } = ctx

  const dailyProfitUsd = myActiveInvestmentsList
    .filter((item) => item.currency === 'USD')
    .reduce((sum, item) => sum + (Number(item.dailyProfit) || 0), 0)

  const dailyProfitEtb = myActiveInvestmentsList
    .filter((item) => item.currency === 'ETB')
    .reduce((sum, item) => sum + (Number(item.dailyProfit) || 0), 0)

  const activeInvestmentUsd = myActiveInvestmentsList
    .filter((item) => item.currency === 'USD')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const activeInvestmentEtb = myActiveInvestmentsList
    .filter((item) => item.currency === 'ETB')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const totalBalance = Number(usdBalance) + Number(etbBalance)

  const actionButtons = [
    { label: 'Deposit', page: 'deposit' },
    { label: 'Invest', page: 'invest' },
    { label: 'Withdraw', page: 'withdraw' },
    { label: 'History', page: 'history' },
  ]

  const metrics = [
    {
      label: 'Daily Profit ETB',
      value: `${dailyProfitEtb.toFixed(2)} Br`,
    },
    {
      label: 'Daily Profit USD',
      value: `$${dailyProfitUsd.toFixed(2)}`,
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
    <div className="home-page min-h-screen overflow-x-hidden bg-white pb-20">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <header className="text-center">
          <h1 className="welcome-3d">Welcome to Blackrock</h1>
          <p className="home-subtitle">Your dashboard is ready for action.</p>
        </header>

        <div className="home-balance-card rounded-3xl px-5 py-5 text-white">
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

        <div className="home-metrics-grid">
          {metrics.map(({ label, value }) => (
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
