import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Home,
  Wallet,
  TrendingUp,
  ArrowUpCircle,
  Clock4,
  HelpCircle,
  Copy,
  Check,
  Gift,
  User,
  Zap,
} from 'lucide-react'
import supabase from '../lib/supabase'
import { getSession } from '../lib/authService'

const PRIMARY_GOLD = '#F5B700'

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

const exchangeRate = 174

const usdTiers = [
  { id: 'usd-5', amount: 5, days: 3, dailyProfit: 1.67, bonus: 0 },
  { id: 'usd-10', amount: 10, days: 4, dailyProfit: 2.5, bonus: 0 },
  { id: 'usd-20', amount: 20, days: 4, dailyProfit: 5.0, bonus: 0 },
  { id: 'usd-50', amount: 50, days: 4, dailyProfit: 12.5, bonus: 0 },
  { id: 'usd-100', amount: 100, days: 4, dailyProfit: 25.0, bonus: 0 },
  { id: 'usd-250', amount: 250, days: 4, dailyProfit: 62.5, bonus: 0 },
  { id: 'usd-500', amount: 500, days: 4, dailyProfit: 125.0, bonus: 0 },
  { id: 'usd-1000', amount: 1000, days: 4, dailyProfit: 250.0, bonus: 0 },
]

const etbTiers = [
  { id: 'etb-870', amount: 870, days: 3, dailyProfit: 290, bonus: 0 },
  { id: 'etb-1740', amount: 1740, days: 4, dailyProfit: 435, bonus: 0 },
  { id: 'etb-3480', amount: 3480, days: 4, dailyProfit: 870, bonus: 0 },
  { id: 'etb-8700', amount: 8700, days: 4, dailyProfit: 2175, bonus: 0 },
  { id: 'etb-17400', amount: 17400, days: 4, dailyProfit: 4350, bonus: 0 },
  { id: 'etb-43500', amount: 43500, days: 4, dailyProfit: 10875, bonus: 0 },
  { id: 'etb-87000', amount: 87000, days: 4, dailyProfit: 21750, bonus: 0 },
  { id: 'etb-174000', amount: 174000, days: 4, dailyProfit: 43500, bonus: 0 },
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
  const [profileImage, setProfileImage] = useState('')
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [referralLink, setReferralLink] = useState('')
  const [referralCount, setReferralCount] = useState(0)
  const [referralEarningsUsd, setReferralEarningsUsd] = useState(0.0)
  const [referralEarningsEtb, setReferralEarningsEtb] = useState(0.0)
  const [copied, setCopied] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')
  const [claimTimestamp, setClaimTimestamp] = useState(null)
  const [historyFilter, setHistoryFilter] = useState('All')
  const claimCooldownMs = 24 * 60 * 60 * 1000

  // Load session and stored profile on mount
  useEffect(() => {
    const session = getSession()
    const email = session?.user?.email || ''
    const name = session?.user?.fullName || 'BlackRock Client'

    if (email) {
      setUserEmail(email)
      setUserFullName(name)
      setIsAdminUser(email.toLowerCase() === 'workinehabche@gmail.com')
      const storedImage = localStorage.getItem(`user_profile_image_${email}`)
      if (storedImage) setProfileImage(storedImage)
    }

    const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    const userRecord = email ? userData[email] : null
    if (userRecord) {
      setUsdBalance(userRecord.usdBalance || 0.0)
      setEtbBalance(userRecord.etbBalance || 0.0)
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

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'invest', label: 'Invest', icon: TrendingUp },
    { id: 'deposit', label: 'Deposit', icon: Wallet },
    { id: 'withdraw', label: 'Withdraw', icon: ArrowUpCircle },
    { id: 'support', label: 'Support', icon: HelpCircle },
  ]

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
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-32">
      {/* Mobile-First Top Header - Clean & Minimal */}
      <div className="fixed top-0 inset-x-0 z-40 bg-white border-b border-slate-100 px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-3">
            <div className="relative rounded-full bg-slate-900 px-4 py-2 shadow-lg shadow-slate-900/10">
              <span className="text-2xl font-extrabold tracking-tight text-white" style={{ textShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
                BlackRock
              </span>
            </div>
          </div>
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-500">Global Investment Management</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActivePage('profile')}
            className="relative h-12 w-12 rounded-full border border-slate-200 bg-slate-950 text-white shadow-lg transition hover:ring-2 hover:ring-slate-300"
            aria-label="Open profile"
          >
            {profileImage ? (
              <img
                src={profileImage}
                alt="Profile"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <User size={22} />
            )}
          </button>
        </div>
      </div>

      {/* Page Content - Mobile optimized padding */}
      <div className="pt-20 px-4 pb-24">
        {children(appContext)}
      </div>

      {/* Bottom Navigation - Mobile-First Design */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white border-t border-slate-100 px-2 py-2 shadow-2xl">
        <div className="flex items-center justify-between gap-1 max-w-lg mx-auto">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setActivePage(id)
                if (id === 'admin') {
                  navigate('/admin-dashboard')
                }
              }}
              className={`relative flex-1 rounded-2xl px-2 py-3 text-center text-xs font-semibold transition-all ${
                activePage === id
                  ? 'text-white'
                  : 'text-slate-600'
              }`}
              style={{
                backgroundColor: activePage === id ? PRIMARY_GOLD : '#F3F4F6',
                boxShadow: activePage === id ? `0 4px 12px ${PRIMARY_GOLD}30` : 'none',
              }}
            >
              <Icon size={24} className="mx-auto mb-1" />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>

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
