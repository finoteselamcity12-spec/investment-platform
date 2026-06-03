import { Activity, Clock4, Home, Users, Wallet } from 'lucide-react'

const marketData = [
  { title: 'Bitcoin', symbol: 'BTC', price: '$38,290', change: '+3.9%', trend: 'up' },
  { title: 'Ethereum', symbol: 'ETH', price: '$2,128', change: '+2.6%', trend: 'up' },
  { title: 'Solana', symbol: 'SOL', price: '$93.45', change: '+4.2%', trend: 'up' },
]

export default function DashboardView() {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <p className="dashboard-label">Main Dashboard</p>
          <h1 className="dashboard-title">BLACKROCK</h1>
        </div>
        <span className="dashboard-badge">Live</span>
      </div>

      <section className="dashboard-card-gradient">
        <div className="dashboard-total-card">
          <div className="dashboard-total-label">Total Balance</div>
          <div className="dashboard-total-value">$24,860.50</div>
          <div className="dashboard-total-note">Portfolio value across your investment accounts</div>
          <div className="dashboard-chart-placeholder" aria-hidden="true">
            <div className="dashboard-chart-line" />
            <div className="dashboard-chart-line short" />
            <div className="dashboard-chart-line longer" />
            <div className="dashboard-chart-line medium" />
          </div>
        </div>
      </section>

      <div className="dashboard-actions">
        <button className="dashboard-action-button dashboard-action-primary">Deposit</button>
        <button className="dashboard-action-button dashboard-action-secondary">Withdraw</button>
      </div>

      <section className="dashboard-profit-card">
        <div>
          <p className="dashboard-profit-label">Daily Profit</p>
          <p className="dashboard-profit-amount">$184.20</p>
          <p className="dashboard-profit-description">Projected profit over the next 24 hours</p>
        </div>
        <div className="dashboard-profit-pill">+2.4%</div>
      </section>

      <section className="dashboard-market-section">
        <div className="dashboard-section-header">
          <div>
            <p className="dashboard-section-title">Market Overview</p>
            <p className="dashboard-section-subtitle">Track the assets that matter most</p>
          </div>
        </div>

        <div className="market-grid">
          {marketData.map((asset) => (
            <article key={asset.symbol} className="market-card">
              <div className="market-card-top">
                <div>
                  <p className="market-card-title">{asset.title}</p>
                  <p className="market-card-symbol">{asset.symbol}</p>
                </div>
                <span className={`market-card-change ${asset.trend === 'up' ? 'positive' : 'negative'}`}>
                  {asset.change}
                </span>
              </div>
              <div className="market-card-price">{asset.price}</div>
              <div className="market-card-footer">
                <span className="market-card-caption">24h change</span>
                <span className="market-card-status">{asset.trend === 'up' ? 'Rising' : 'Falling'}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <nav className="dashboard-bottom-nav" aria-label="Primary navigation">
        <button className="dashboard-nav-item active">
          <Home size={20} />
          <span>Home</span>
        </button>
        <button className="dashboard-nav-item">
          <Clock4 size={20} />
          <span>History</span>
        </button>
        <button className="dashboard-nav-item">
          <Users size={20} />
          <span>Invite</span>
        </button>
        <button className="dashboard-nav-item">
          <Activity size={20} />
          <span>Activity</span>
        </button>
        <button className="dashboard-nav-item">
          <Wallet size={20} />
          <span>Profile</span>
        </button>
      </nav>
    </div>
  )
}
