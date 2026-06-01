import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Home,
  Wallet,
  Users,
  Clock4,
  User as UserIcon,
  Copy,
  Check,
  ArrowUpCircle,
  Gift,
  Activity,
} from 'lucide-react'
import supabase from '../lib/supabase'
import AdminLoginModal from '../components/AdminLoginModal'

// Premium tier naming
const premiumTierNames = {
  3: 'VIP Level 1', 5: 'VIP Level 2', 7: 'VIP Level 3', 10: 'VIP Level 4', 15: 'VIP Level 5',
  20: 'Silver Star', 25: 'Silver Elite', 30: 'Gold Starter', 35: 'Gold Premium', 40: 'Gold Executive',
  45: 'Gold Prestige', 50: 'Platinum Starter', 75: 'Platinum Plus', 90: 'Platinum Master', 110: 'Diamond Executive',
  150: 'Crown Emperor', 200: 'Apex Elite', 500: 'Apex Sovereign', 1000: 'Apex Immortal', 5000: 'Apex Legacy',
  350: 'VIP Level 1', 500: 'VIP Level 2', 700: 'VIP Level 3', 1000: 'VIP Level 4', 1500: 'Silver Star',
  5000: 'Silver Elite', 10000: 'Gold Starter', 15000: 'Gold Premium', 20000: 'Gold Executive', 25000: 'Platinum Master',
  30000: 'Diamond Executive', 35000: 'Crown Emperor', 40000: 'Apex Elite', 45000: 'Apex Sovereign', 50000: 'Apex Legacy',
}

const usdTiers = [
  { id: 'usd-3', amount: 3, days: 30, dailyProfit: 0.6, bonus: 0.6 },
  { id: 'usd-5', amount: 5, days: 33, dailyProfit: 0.9, bonus: 0.9 },
  { id: 'usd-7', amount: 7, days: 36, dailyProfit: 1.0, bonus: 1.0 },
  { id: 'usd-10', amount: 10, days: 39, dailyProfit: 1.7, bonus: 1.7 },
  { id: 'usd-15', amount: 15, days: 43, dailyProfit: 2.0, bonus: 2.0 },
  { id: 'usd-50', amount: 50, days: 65, dailyProfit: 5.5, bonus: 5.5 },
]

const etbTiers = [
  { id: 'etb-350', amount: 350, days: 30, dailyProfit: 25, bonus: 24.5 },
  { id: 'etb-500', amount: 500, days: 33, dailyProfit: 35, bonus: 35.0 },
  { id: 'etb-1000', amount: 1000, days: 42, dailyProfit: 53, bonus: 70 },
  { id: 'etb-1500', amount: 1500, days: 45, dailyProfit: 70, bonus: 105 },
]

const withdrawMethods = ['CBE', 'Dashen Bank', 'M-Pesa', 'Telebirr', 'USDT (TRC20)']
const historyFilters = ['All', 'Deposits', 'Withdrawals', 'Investments', 'Claims']

function formatCurrency(amount, currency) {
  if (currency === 'USD') return `$${amount.toFixed(2)}`
  if (currency === 'USDT') return `$${amount.toFixed(2)} USDT`
  return `${amount.toLocaleString()} Birr`
}

const marketData = [
  { title: 'Bitcoin', symbol: 'BTC', price: '$38,290', change: '+3.9%', trend: 'up' },
  { title: 'Ethereum', symbol: 'ETH', price: '$2,128', change: '+2.6%', trend: 'up' },
  { title: 'Solana', symbol: 'SOL', price: '$93.45', change: '+4.2%', trend: 'up' },
]

export default function DashboardRedesigned() {
  const navigate = useNavigate()
  const [activePage, setActivePage] = useState('home')
  const [usdBalance, setUsdBalance] = useState(0.0)
  const [etbBalance, setEtbBalance] = useState(0.0)
  const [myActiveInvestmentsList, setMyActiveInvestmentsList] = useState([])
  const [transactions, setTransactions] = useState([])
  const [historyFilter, setHistoryFilter] = useState('All')
  const [userFullName, setUserFullName] = useState('Account')
  const [userEmail, setUserEmail] = useState('')
  const [referralLink, setReferralLink] = useState('')
  const [referralCount, setReferralCount] = useState(0)
  const [referralEarningsUsd, setReferralEarningsUsd] = useState(0.0)
  const [referralEarningsEtb, setReferralEarningsEtb] = useState(0.0)
  const [copied, setCopied] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [claimTimestamp, setClaimTimestamp] = useState(null)
  const [toastMessage, setToastMessage] = useState('')
  const claimCooldownMs = 24 * 60 * 60 * 1000

  const usdDailyReward = useMemo(
    () => myActiveInvestmentsList.filter((item) => item.currency === 'USD').reduce((sum, item) => sum + item.dailyProfit, 0),
    [myActiveInvestmentsList]
  )
  const etbDailyReward = useMemo(
    () => myActiveInvestmentsList.filter((item) => item.currency === 'ETB').reduce((sum, item) => sum + item.dailyProfit, 0),
    [myActiveInvestmentsList]
  )

  const lastClaimAge = claimTimestamp ? Date.now() - claimTimestamp : null
  const claimAvailable = !claimTimestamp || lastClaimAge >= claimCooldownMs
  const claimRemainingMinutes = claimTimestamp ? Math.max(0, Math.ceil((claimCooldownMs - lastClaimAge) / 60000)) : 0

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'All') return transactions
    if (historyFilter === 'Deposits') return transactions.filter((item) => item.type === 'Deposit')
    if (historyFilter === 'Withdrawals') return transactions.filter((item) => item.type === 'Withdrawal')
    if (historyFilter === 'Investments') return transactions.filter((item) => item.type === 'Investment')
    if (historyFilter === 'Claims') return transactions.filter((item) => item.type === 'Claim')
    return transactions
  }, [historyFilter, transactions])

  useEffect(() => {
    const user = supabase.auth.user || { email: 'user@example.com' }
    setUserEmail(user?.email || 'user@example.com')

    const adminData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    const full = (adminData[user?.email] && adminData[user?.email].fullName) || 'Account'
    setUserFullName(full)

    const registeredUsers = JSON.parse(localStorage.getItem('platform_registered_users') || '[]')
    if (!registeredUsers.includes(user?.email)) {
      registeredUsers.push(user?.email)
      localStorage.setItem('platform_registered_users', JSON.stringify(registeredUsers))
    }

    const regDataAll = JSON.parse(localStorage.getItem('platform_registered_users_data') || '{}')
    const currentId = (adminData[user?.email] && adminData[user?.email].id) || (regDataAll[user?.email] && regDataAll[user?.email].userId) || user?.email
    try {
      const origin = window?.location?.origin || 'http://localhost:5173'
      setReferralLink(`${origin}/register?ref=${encodeURIComponent(currentId)}`)
    } catch (e) {
      setReferralLink(`http://localhost:5173/register?ref=${encodeURIComponent(currentId)}`)
    }

    // Load balances
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}')
    if (userData[user?.email]) {
      setUsdBalance(userData[user?.email].usdBalance || 0)
      setEtbBalance(userData[user?.email].etbBalance || 0)
    }

    // Load investments
    const investmentsData = JSON.parse(localStorage.getItem('user_investments') || '{}')
    if (investmentsData[user?.email]) {
      setMyActiveInvestmentsList(investmentsData[user?.email])
    }

    // Load transactions
    const txData = JSON.parse(localStorage.getItem('user_transactions') || '{}')
    if (txData[user?.email]) {
      setTransactions(txData[user?.email])
    }

    // Load referral data
    const referralData = JSON.parse(localStorage.getItem('referral_data') || '{}')
    if (referralData[user?.email]) {
      setReferralCount(referralData[user?.email].count || 0)
      setReferralEarningsUsd(referralData[user?.email].earningsUsd || 0)
      setReferralEarningsEtb(referralData[user?.email].earningsEtb || 0)
    }

    const claimTs = localStorage.getItem(`claim_timestamp_${user?.email}`)
    if (claimTs) setClaimTimestamp(parseInt(claimTs))
  }, [])

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(''), 3200)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      navigate('/auth')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const handleClaimRewards = () => {
    if (!claimAvailable) return
    const newBalance = usdBalance + usdDailyReward
    setUsdBalance(newBalance)
    setClaimTimestamp(Date.now())
    localStorage.setItem(`claim_timestamp_${userEmail}`, Date.now().toString())

    const userData = JSON.parse(localStorage.getItem('user_data') || '{}')
    if (!userData[userEmail]) userData[userEmail] = {}
    userData[userEmail].usdBalance = newBalance
    localStorage.setItem('user_data', JSON.stringify(userData))

    setToastMessage('Rewards claimed successfully!')
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const navItems = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'wallet', label: 'Wallet', icon: Wallet },
    { key: 'invite', label: 'Invite', icon: Users },
    { key: 'history', label: 'History', icon: Clock4 },
    { key: 'profile', label: 'Profile', icon: UserIcon },
  ]

  return (
    <div className="dashboard-shell">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-white">Astra Wealth</h1>
          <button
            onClick={() => setShowAdminLogin(true)}
            className="h-12 w-12 rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            <UserIcon className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-32 px-4 pt-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {activePage === 'home' && (
            <>
              {/* Total Balance Card */}
              <section className="dashboard-card-gradient rounded-[2rem]">
                <div className="dashboard-total-card">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Total Balance</p>
                  <p className="mt-4 text-5xl font-extrabold text-white sm:text-6xl">${(usdBalance + etbBalance / 100).toFixed(2)}</p>
                  <p className="mt-3 text-sm text-slate-300">Portfolio value across all accounts</p>
                  <div className="dashboard-chart-placeholder mt-8">
                    <div className="dashboard-chart-line" />
                    <div className="dashboard-chart-line short" />
                    <div className="dashboard-chart-line longer" />
                    <div className="dashboard-chart-line medium" />
                  </div>
                </div>
              </section>

              {/* Action Buttons */}
              <div className="grid gap-4 grid-cols-2">
                <button
                  onClick={() => setActivePage('wallet')}
                  className="dashboard-action-button dashboard-action-primary"
                >
                  Deposit
                </button>
                <button
                  onClick={() => setActivePage('wallet')}
                  className="dashboard-action-button dashboard-action-secondary"
                >
                  Withdraw
                </button>
              </div>

              {/* Daily Profit Card */}
              <section className="dashboard-profit-card">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Daily Profit</p>
                  <p className="mt-2 text-3xl font-extrabold text-white">${(usdDailyReward + etbDailyReward / 100).toFixed(2)}</p>
                  <p className="mt-2 text-sm text-slate-300">Projected earnings over 24 hours</p>
                </div>
                <div className="dashboard-profit-pill">+2.4%</div>
              </section>

              {/* Market Overview */}
              <section className="dashboard-market-section">
                <div className="dashboard-section-header">
                  <div>
                    <p className="dashboard-section-title">Market Overview</p>
                    <p className="dashboard-section-subtitle">Real-time asset tracking</p>
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

              {/* Quick Stats */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="dashboard-card-surface-sm">
                  <p className="text-xs uppercase tracking-tight text-slate-400">USD Wallet</p>
                  <p className="mt-3 text-2xl font-bold text-white">${usdBalance.toFixed(2)}</p>
                </div>
                <div className="dashboard-card-surface-sm">
                  <p className="text-xs uppercase tracking-tight text-slate-400">ETB Wallet</p>
                  <p className="mt-3 text-2xl font-bold text-white">{etbBalance.toLocaleString()} Br</p>
                </div>
                <div className="dashboard-card-surface-sm">
                  <p className="text-xs uppercase tracking-tight text-slate-400">Active Nodes</p>
                  <p className="mt-3 text-2xl font-bold text-white">{myActiveInvestmentsList.length}</p>
                </div>
              </div>

              {/* Claim Rewards */}
              <button
                onClick={handleClaimRewards}
                disabled={!claimAvailable}
                className="w-full rounded-[2rem] px-6 py-4 text-base font-semibold transition duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-lg hover:from-sky-600 hover:to-cyan-600"
              >
                <ArrowUpCircle className="inline-block mr-2 h-5 w-5" />
                {claimAvailable ? 'Claim 24h Earnings' : `Claim again in ${claimRemainingMinutes}m`}
              </button>
            </>
          )}

          {activePage === 'wallet' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Wallet & Investments</h2>
              <p className="text-slate-300">Manage your deposits, withdrawals, and active investment tiers here.</p>
            </div>
          )}

          {activePage === 'invite' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Referral Program</h2>
              <div className="dashboard-card-surface">
                <p className="text-slate-300 mb-4">Share your link and earn rewards</p>
                <div className="flex items-center gap-2 rounded-3xl border border-slate-700 bg-slate-900/80 px-4 py-3">
                  <input
                    type="text"
                    readOnly
                    value={referralLink}
                    className="w-full bg-transparent text-sm font-bold text-slate-100 focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex h-11 items-center justify-center rounded-3xl bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-sky-600"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="dashboard-card-surface-sm">
                    <p className="text-xs uppercase tracking-tight text-slate-400">Total Referrals</p>
                    <p className="mt-3 text-2xl font-bold text-white">{referralCount}</p>
                  </div>
                  <div className="dashboard-card-surface-sm">
                    <p className="text-xs uppercase tracking-tight text-slate-400">USD Earnings</p>
                    <p className="mt-3 text-2xl font-bold text-white">${referralEarningsUsd.toFixed(2)}</p>
                  </div>
                  <div className="dashboard-card-surface-sm">
                    <p className="text-xs uppercase tracking-tight text-slate-400">ETB Earnings</p>
                    <p className="mt-3 text-2xl font-bold text-white">{referralEarningsEtb.toLocaleString()} Br</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activePage === 'history' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Transaction History</h2>
              <div className="dashboard-switch-group">
                {historyFilters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    className={`dashboard-filter-button ${historyFilter === filter ? 'active' : ''}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <div className="card-panel-compact overflow-hidden bg-slate-950/95 border border-slate-800">
                <table className="dashboard-table responsive-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Details</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="dashboard-table-cell dashboard-table-empty py-8">
                          No transactions found.
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((item) => (
                        <tr key={item.id} className="dashboard-table-row">
                          <td className="dashboard-table-cell font-bold">{item.type}</td>
                          <td className="dashboard-table-cell">{item.title}</td>
                          <td className="dashboard-table-cell">{formatCurrency(item.amount, item.currency)}</td>
                          <td className="dashboard-table-cell">
                            <span className={`dashboard-status-pill ${item.status === 'Success' ? 'success' : item.status === 'Active' ? 'active' : 'pending'}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="dashboard-table-cell">{new Date(item.date).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Account Settings</h2>
              <div className="dashboard-card-surface">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-16 w-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-2xl">
                    <UserIcon className="h-8 w-8 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Logged in as</p>
                    <p className="text-xl font-bold text-white">{userFullName}</p>
                    <p className="text-sm text-slate-400">{userEmail}</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full rounded-3xl bg-red-600/20 text-red-300 px-6 py-3 text-base font-semibold hover:bg-red-600/30 transition"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="dashboard-bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              onClick={() => setActivePage(item.key)}
              className={`dashboard-nav-item ${activePage === item.key ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} />}
      {toastMessage && (
        <div className="fixed bottom-24 left-4 right-4 max-w-sm mx-auto rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
