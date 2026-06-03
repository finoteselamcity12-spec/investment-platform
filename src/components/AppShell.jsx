import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Home,
  Wallet,
  TrendingUp,
  ArrowUpCircle,
  Clock4,
  HelpCircle,
  ShieldCheck,
  Copy,
  Check,
  Gift,
  Zap,
} from 'lucide-react'
import supabase from '../lib/supabase'
import { getSession } from '../lib/authService'
import AdminLoginModal from './AdminLoginModal'
import ProfileButton from './ProfileButton'

const PRIMARY_GREEN = '#84CC16'

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
  { id: 'usd-20', amount: 20, days: 45, dailyProfit: 2.5, bonus: 2.5 },
  { id: 'usd-25', amount: 25, days: 50, dailyProfit: 3.0, bonus: 3.0 },
  { id: 'usd-30', amount: 30, days: 53, dailyProfit: 3.9, bonus: 3.5 },
  { id: 'usd-35', amount: 35, days: 56, dailyProfit: 4.0, bonus: 4.0 },
  { id: 'usd-40', amount: 40, days: 59, dailyProfit: 4.9, bonus: 4.5 },
  { id: 'usd-45', amount: 45, days: 62, dailyProfit: 5.0, bonus: 5.0 },
  { id: 'usd-50', amount: 50, days: 65, dailyProfit: 5.5, bonus: 5.5 },
  { id: 'usd-75', amount: 75, days: 70, dailyProfit: 8.0, bonus: 6.0 },
  { id: 'usd-90', amount: 90, days: 75, dailyProfit: 12.0, bonus: 6.5 },
  { id: 'usd-110', amount: 110, days: 80, dailyProfit: 15.0, bonus: 7.0 },
  { id: 'usd-150', amount: 150, days: 85, dailyProfit: 17.0, bonus: 7.5 },
  { id: 'usd-200', amount: 200, days: 90, dailyProfit: 20.0, bonus: 8.0 },
  { id: 'usd-500', amount: 500, days: 150, dailyProfit: 25.0, bonus: 8.5 },
  { id: 'usd-1000', amount: 1000, days: 209, dailyProfit: 33.0, bonus: 9.0 },
  { id: 'usd-5000', amount: 5000, days: 250, dailyProfit: 38.0, bonus: 10.0 },
]

const etbTiers = [
  { id: 'etb-350', amount: 350, days: 30, dailyProfit: 25, bonus: 24.5 },
  { id: 'etb-500', amount: 500, days: 33, dailyProfit: 35, bonus: 35.0 },
  { id: 'etb-700', amount: 700, days: 35, dailyProfit: 40, bonus: 49.0 },
  { id: 'etb-1000', amount: 1000, days: 42, dailyProfit: 53, bonus: 70 },
  { id: 'etb-1500', amount: 1500, days: 45, dailyProfit: 70, bonus: 105 },
  { id: 'etb-5000', amount: 5000, days: 75, dailyProfit: 110, bonus: 350 },
  { id: 'etb-10000', amount: 10000, days: 90, dailyProfit: 152, bonus: 700 },
  { id: 'etb-15000', amount: 15000, days: 120, dailyProfit: 194, bonus: 1050 },
  { id: 'etb-20000', amount: 20000, days: 150, dailyProfit: 240, bonus: 1400 },
  { id: 'etb-25000', amount: 25000, days: 180, dailyProfit: 280, bonus: 1750 },
  { id: 'etb-30000', amount: 30000, days: 210, dailyProfit: 324, bonus: 2100 },
  { id: 'etb-35000', amount: 35000, days: 270, dailyProfit: 354, bonus: 2450 },
  { id: 'etb-40000', amount: 40000, days: 300, dailyProfit: 3999, bonus: 2800 },
  { id: 'etb-45000', amount: 45000, days: 315, dailyProfit: 450, bonus: 3150 },
  { id: 'etb-50000', amount: 50000, days: 330, dailyProfit: 490, bonus: 3500 },
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

export default function AppShell({ children, activePage, setActivePage }) {
  const navigate = useNavigate()
  const [usdBalance, setUsdBalance] = useState(0.0)
  const [etbBalance, setEtbBalance] = useState(0.0)
  const [myActiveInvestmentsList, setMyActiveInvestmentsList] = useState([])
  const [transactions, setTransactions] = useState([])
  const [userFullName, setUserFullName] = useState('Account')
  const [userEmail, setUserEmail] = useState('')
  const [referralLink, setReferralLink] = useState('')
  const [referralCount, setReferralCount] = useState(0)
  const [referralEarningsUsd, setReferralEarningsUsd] = useState(0.0)
  const [referralEarningsEtb, setReferralEarningsEtb] = useState(0.0)
  const [copied, setCopied] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')
  const [claimTimestamp, setClaimTimestamp] = useState(null)
  const [historyFilter, setHistoryFilter] = useState('All')
  const claimCooldownMs = 24 * 60 * 60 * 1000

  // Load current session and saved data on mount
  useEffect(() => {
    const session = getSession()
    if (session?.user?.email) {
      setUserEmail(session.user.email)
      setUserFullName(session.user.fullName || 'User')
    } else {
      const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
      const savedEmail = Object.keys(userData)[0]
      if (savedEmail) {
        setUserEmail(savedEmail)
        setUserFullName(userData[savedEmail].fullName || 'User')
      }
    }

    const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    const profileEmail = session?.user?.email || Object.keys(userData)[0]
    if (profileEmail && userData[profileEmail]) {
      setUsdBalance(userData[profileEmail].usdBalance || 0.0)
      setEtbBalance(userData[profileEmail].etbBalance || 0.0)
    }

    const investments = JSON.parse(localStorage.getItem('user_investments') || '[]')
    setMyActiveInvestmentsList(investments)

    const txns = JSON.parse(localStorage.getItem('user_transactions') || '[]')
    setTransactions(txns)

    const referralData = JSON.parse(localStorage.getItem('referral_data') || '{}')
    setReferralLink(referralData.referralLink || '')
    setReferralCount(referralData.referralCount || 0)
    setReferralEarningsUsd(referralData.earningsUsd || 0.0)
    setReferralEarningsEtb(referralData.earningsEtb || 0.0)

    const claimTs = localStorage.getItem('lastClaimTimestamp')
    if (claimTs) setClaimTimestamp(parseInt(claimTs))
  }, [])

  const navItemsBase = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'invest', label: 'Invest', icon: TrendingUp },
    { id: 'deposit', label: 'Deposit', icon: Wallet },
    { id: 'withdraw', label: 'Withdraw', icon: ArrowUpCircle },
    { id: 'support', label: 'Support', icon: HelpCircle },
  ]

  const navItems = useMemo(() => {
    const items = [...navItemsBase]
    if (userEmail === 'workinehabche@gmail.com') {
      items.push({ id: 'admin', label: 'Admin', icon: ShieldCheck })
    }
    return items
  }, [userEmail])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  function showToast(message, type = 'success') {
    setToastType(type)
    setToastMessage(message)
    setTimeout(() => setToastMessage(''), 3000)
  }

  function addTransaction(entry) {
    setTransactions((prev) => [entry, ...prev])
    const txns = JSON.parse(localStorage.getItem('user_transactions') || '[]')
    txns.unshift(entry)
    localStorage.setItem('user_transactions', JSON.stringify(txns))
  }

  // Share context with children through render function or pass directly
  const appContext = {
    usdBalance, setUsdBalance,
    etbBalance, setEtbBalance,
    myActiveInvestmentsList, setMyActiveInvestmentsList,
    transactions, setTransactions,
    userFullName, userEmail,
    referralLink, referralCount, referralEarningsUsd, referralEarningsEtb,
    copied, setCopied,
    toastMessage, setToastMessage,
    toastType,
    claimTimestamp, setClaimTimestamp,
    historyFilter, setHistoryFilter,
    showToast, addTransaction, handleSignOut,
    usdTiers, etbTiers, withdrawMethods, historyFilters, formatCurrency, marketData,
    premiumTierNames, claimCooldownMs,
    setActivePage,
    setShowAdminLogin,
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col justify-between px-0">
        <div className="fixed inset-x-0 top-0 z-40 flex justify-center px-4">
          <div className="w-full max-w-[460px] rounded-b-[2rem] border border-slate-200 border-t-0 bg-white/95 px-4 py-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Investment Platform</p>
                <h1 className="text-xl font-semibold text-slate-950">Dashboard</h1>
              </div>
              <div className="flex items-center gap-3">
                <ProfileButton showToast={showToast} />
                {userEmail === 'workinehabche@gmail.com' && (
                  <button
                    onClick={() => setShowAdminLogin(true)}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
                    aria-label="Admin Access"
                  >
                    <ShieldCheck size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <main className="pt-24 px-4 pb-28">
          {children(appContext)}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
        <div className="w-full max-w-[460px] rounded-[2rem] border border-slate-200 bg-white/95 px-3 py-3 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setActivePage(id)
                  if (id === 'admin') {
                    setShowAdminLogin(true)
                  }
                }}
                className={`flex flex-1 flex-col items-center justify-center rounded-3xl px-2 py-2 text-[0.68rem] font-semibold transition-all ${
                  activePage === id
                    ? 'bg-emerald-600 text-white shadow-[0_16px_50px_rgba(16,185,129,0.24)]'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <AdminLoginModal
          isOpen={showAdminLogin}
          onClose={() => setShowAdminLogin(false)}
          userEmail={userEmail}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-36 left-4 right-4 z-40 px-4 py-3 rounded-3xl text-white text-sm font-medium ${
          toastType === 'success'
            ? 'bg-green-600 shadow-lg shadow-green-600/40'
            : 'bg-red-600 shadow-lg shadow-red-600/40'
        }`}>
          {toastMessage}
        </div>
      )}
    </div>
  )
}
