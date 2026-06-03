import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Home,
  Wallet,
  TrendingUp,
  ArrowDownRight,
  HelpCircle,
} from 'lucide-react'
import supabase from '../lib/supabase'
import { getSession } from '../lib/authService'
import { formatCurrency } from '../lib/formatCurrency'
import AdminLoginModal from './AdminLoginModal'
import ProfileModal from './ProfileModal'

const PRIMARY_GREEN = '#84CC16'
const ADMIN_SUPPORT_EMAIL = 'workinehabche@gmail.com'

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
  { id: 'usd-3', amount: 3, days: 10, dailyProfit: 0.12, deposit: 2, bonus: 2 },
  { id: 'usd-5', amount: 5, days: 15, dailyProfit: 0.146667, deposit: 3, bonus: 3 },
  { id: 'usd-7', amount: 7, days: 20, dailyProfit: 0.15, deposit: 3, bonus: 3 },
  { id: 'usd-10', amount: 10, days: 22, dailyProfit: 0.181818, deposit: 5, bonus: 5 },
  { id: 'usd-15', amount: 15, days: 25, dailyProfit: 0.24, deposit: 7, bonus: 7 },
  { id: 'usd-20', amount: 20, days: 27, dailyProfit: 0.296296, deposit: 9, bonus: 9 },
  { id: 'usd-25', amount: 25, days: 30, dailyProfit: 0.4, deposit: 11, bonus: 11 },
  { id: 'usd-30', amount: 30, days: 32, dailyProfit: 0.40625, deposit: 14, bonus: 14 },
  { id: 'usd-35', amount: 35, days: 35, dailyProfit: 0.428571, deposit: 16, bonus: 16 },
  { id: 'usd-40', amount: 40, days: 37, dailyProfit: 0.459459, deposit: 19, bonus: 19 },
  { id: 'usd-45', amount: 45, days: 39, dailyProfit: 0.487179, deposit: 21, bonus: 21 },
  { id: 'usd-50', amount: 50, days: 41, dailyProfit: 0.512195, deposit: 23, bonus: 23 },
  { id: 'usd-75', amount: 75, days: 43, dailyProfit: 0.581395, deposit: 27, bonus: 27 },
  { id: 'usd-90', amount: 90, days: 45, dailyProfit: 0.666667, deposit: 37, bonus: 37 },
  { id: 'usd-110', amount: 110, days: 47, dailyProfit: 0.957447, deposit: 53, bonus: 53 },
  { id: 'usd-150', amount: 150, days: 49, dailyProfit: 1.102041, deposit: 62, bonus: 62 },
  { id: 'usd-200', amount: 200, days: 54, dailyProfit: 1.111111, deposit: 68, bonus: 68 },
  { id: 'usd-500', amount: 500, days: 57, dailyProfit: 1.298246, deposit: 79, bonus: 79 },
  { id: 'usd-1000', amount: 1000, days: 69, dailyProfit: 2.246377, deposit: 210, bonus: 210 },
  { id: 'usd-5000', amount: 5000, days: 72, dailyProfit: 5, deposit: 407, bonus: 407 },
]

const etbTiers = [
  { id: 'etb-350', amount: 350, days: 15, dailyProfit: 6.733333, deposit: 63, bonus: 63 },
  { id: 'etb-500', amount: 500, days: 20, dailyProfit: 7.1, deposit: 78, bonus: 78 },
  { id: 'etb-700', amount: 700, days: 25, dailyProfit: 7.4, deposit: 104, bonus: 104 },
  { id: 'etb-1000', amount: 1000, days: 30, dailyProfit: 6.7, deposit: 268, bonus: 268 },
  { id: 'etb-1500', amount: 1500, days: 35, dailyProfit: 7.371429, deposit: 309, bonus: 309 },
  { id: 'etb-5000', amount: 5000, days: 40, dailyProfit: 9.425, deposit: 492, bonus: 492 },
  { id: 'etb-10000', amount: 10000, days: 45, dailyProfit: 10.044444, deposit: 608, bonus: 608 },
  { id: 'etb-15000', amount: 15000, days: 50, dailyProfit: 10, deposit: 702, bonus: 702 },
  { id: 'etb-20000', amount: 20000, days: 55, dailyProfit: 13, deposit: 9000, bonus: 9000 },
  { id: 'etb-25000', amount: 25000, days: 60, dailyProfit: 16.65, deposit: 1082, bonus: 1082 },
  { id: 'etb-30000', amount: 30000, days: 65, dailyProfit: 17.384615, deposit: 1800, bonus: 1800 },
  { id: 'etb-35000', amount: 35000, days: 70, dailyProfit: 27.142857, deposit: 3750, bonus: 3750 },
  { id: 'etb-40000', amount: 40000, days: 75, dailyProfit: 53.32, deposit: 3600, bonus: 3600 },
  { id: 'etb-45000', amount: 45000, days: 80, dailyProfit: 59.375, deposit: 4000, bonus: 4000 },
  { id: 'etb-50000', amount: 50000, days: 90, dailyProfit: 55.555556, deposit: 55000, bonus: 55000 },
]

const withdrawMethods = ['CBE', 'Dashen Bank', 'M-Pesa', 'Telebirr', 'USDT (TRC20)']
const historyFilters = ['All', 'Deposits', 'Withdrawals', 'Investments', 'Claims']

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
  const [referralLink, setReferralLink] = useState('')
  const [referralCount, setReferralCount] = useState(0)
  const [referralEarningsUsd, setReferralEarningsUsd] = useState(0.0)
  const [referralEarningsEtb, setReferralEarningsEtb] = useState(0.0)
  const [copied, setCopied] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')
  const [claimTimestamp, setClaimTimestamp] = useState(null)
  const [historyFilter, setHistoryFilter] = useState('All')
  const claimCooldownMs = 24 * 60 * 60 * 1000
  
  // System settings
  const REGISTRATION_BONUS_USD = 1.5
  const REGISTRATION_BONUS_ETB = 150
  const WITHDRAWAL_MIN_USD = 3
  const WITHDRAWAL_MIN_ETB = 300
  const REFERRAL_BONUS_USD = 2
  const REFERRAL_BONUS_ETB = 135

  // Load current session and saved data on mount
  useEffect(() => {
    const session = getSession()
    if (session?.user?.email) {
      setUserEmail(session.user.email)
      setUserFullName(session.user.fullName || 'User')
      // try session user metadata for avatar
      const possible = session.user.user_metadata || {}
      if (possible.avatar_url || possible.avatar || possible.photoURL) {
        setProfileImage(possible.avatar_url || possible.avatar || possible.photoURL)
      }
    } else {
      const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
      const savedEmail = Object.keys(userData)[0]
      if (savedEmail) {
        setUserEmail(savedEmail)
        setUserFullName(userData[savedEmail].fullName || 'User')
        // load stored avatar if present
        if (userData[savedEmail].profileImage || userData[savedEmail].avatar) {
          setProfileImage(userData[savedEmail].profileImage || userData[savedEmail].avatar)
        }
      }
    }

    const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    const profileEmail = session?.user?.email || Object.keys(userData)[0]
    if (profileEmail && userData[profileEmail]) {
      setUsdBalance(userData[profileEmail].usdBalance || 0.0)
      setEtbBalance(userData[profileEmail].etbBalance || 0.0)
      // also ensure profile image loads for existing local users
      if (!profileImage && (userData[profileEmail].profileImage || userData[profileEmail].avatar)) {
        setProfileImage(userData[profileEmail].profileImage || userData[profileEmail].avatar)
      }
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
    { id: 'deposit', label: 'Deposit', icon: Wallet },
    { id: 'invest', label: 'Invest', icon: TrendingUp },
    { id: 'withdraw', label: 'Withdraw', icon: ArrowDownRight },
    { id: 'support', label: 'Support', icon: HelpCircle },
  ]

  const visibleNavItems = navItems.filter(
    (item) => item.id !== 'support' || userEmail === ADMIN_SUPPORT_EMAIL
  )

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
    setShowProfileModal,
    REGISTRATION_BONUS_USD,
    REGISTRATION_BONUS_ETB,
    WITHDRAWAL_MIN_USD,
    WITHDRAWAL_MIN_ETB,
    REFERRAL_BONUS_USD,
    REFERRAL_BONUS_ETB,
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-28">
      {/* Top Header */}
      <div className="fixed top-0 inset-x-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div>
            {activePage === 'home' ? null : (
              <>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Investment Platform</p>
                <h1 className="text-2xl font-bold text-[#84CC16]">BLACKROCK</h1>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Profile Button */}
            <button
              onClick={() => setShowProfileModal(true)}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm shadow-sm transition hover:bg-slate-200 overflow-hidden border border-slate-200"
              title="Profile"
            >
              {profileImage ? (
                <img src={profileImage} alt={userFullName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm">{userFullName.charAt(0).toUpperCase()}</span>
              )}
            </button>
            {/* Admin Button - Only for workinehabche@gmail.com */}
            {userEmail === 'workinehabche@gmail.com' && (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="w-10 h-10 rounded-full bg-[#84CC16] flex items-center justify-center text-white font-semibold text-sm shadow-lg shadow-[#84CC16]/30 transition hover:bg-lime-500"
                title="Admin"
              >
                A
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="mx-auto max-w-7xl pt-24 px-4 pb-36">
        {children(appContext)}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white border-t border-slate-200 shadow-xl">
        <div className="mx-auto max-w-7xl px-3 py-3 flex items-center justify-between gap-2">
          {visibleNavItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                if (id === 'support') {
                  navigate('/admin-dashboard')
                  return
                }
                setActivePage(id)
              }}
              className={`relative flex-1 rounded-3xl border border-slate-200 px-3 py-3 text-center text-xs font-semibold transition-all ${
                activePage === id
                  ? 'bg-[#84CC16] text-white shadow-lg shadow-[#84CC16]/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <Icon size={22} className="mx-auto mb-1" />
              <span>{label}</span>
            </button>
          ))}
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

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          showToast={showToast}
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
