import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Home,
  Wallet,
  TrendingUp,
  ArrowDownRight,
  HelpCircle,
  Clock4,
} from 'lucide-react'
import supabase from '../lib/supabase'
import { getSession } from '../lib/authService'
import { formatCurrency } from '../lib/formatCurrency'
import {
  REGISTRATION_BONUS_USD,
  REGISTRATION_BONUS_ETB,
  WITHDRAWAL_MIN_USD,
  WITHDRAWAL_MIN_ETB,
  REFERRAL_BONUS_USD,
  REFERRAL_BONUS_ETB,
} from '../lib/platformConfig'
import {
  refreshUserBalancesFromAuth,
  testSupabaseConnection,
} from '../lib/supabaseData'
import {
  handleLoginSignupBonusCheck,
  dedupeTransactions,
  saveLocalTransactionsForUser,
} from '../lib/bonusHistory'
import { loadReferralStats } from '../lib/referralUtils'
import AdminLoginModal from './AdminLoginModal'
import ProfileModal from './ProfileModal'

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
const historyFilters = ['All', 'Bonuses', 'Deposits', 'Withdrawals', 'Investments', 'Claims']

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
  const [balancesLoading, setBalancesLoading] = useState(true)
  const claimCooldownMs = 24 * 60 * 60 * 1000

  const refreshBalances = useCallback(async () => {
    const session = getSession()
    const profileEmail = session?.user?.email
    const supabaseUserId = session?.user?.id
    if (!profileEmail || !supabaseUserId) {
      setBalancesLoading(false)
      return null
    }

    setBalancesLoading(true)
    try {
      await handleLoginSignupBonusCheck(supabaseUserId, profileEmail)
      const result = await refreshUserBalancesFromAuth(supabaseUserId, profileEmail)
      if (result?.fromDatabase) {
        setUsdBalance(result.usdBalance)
        setEtbBalance(result.etbBalance)
      } else {
        setUsdBalance(0)
        setEtbBalance(0)
      }
      return result
    } finally {
      setBalancesLoading(false)
    }
  }, [])

  // Load session + fetch authoritative balances from Supabase (not stale cache)
  useEffect(() => {
    async function loadUserState() {
      const session = getSession()
      const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
      const profileEmail = session?.user?.email || Object.keys(userData)[0]

      if (session?.user?.email) {
        setUserEmail(session.user.email)
        setUserFullName(session.user.fullName || 'User')
        const possible = session.user.user_metadata || {}
        if (possible.avatar_url || possible.avatar || possible.photoURL) {
          setProfileImage(possible.avatar_url || possible.avatar || possible.photoURL)
        }
      } else if (profileEmail && userData[profileEmail]) {
        setUserEmail(profileEmail)
        setUserFullName(userData[profileEmail].fullName || 'User')
        if (userData[profileEmail].profileImage || userData[profileEmail].avatar) {
          setProfileImage(userData[profileEmail].profileImage || userData[profileEmail].avatar)
        }
      }

      const supabaseUserId = session?.user?.id
      if (supabaseUserId && profileEmail) {
        await refreshBalances()
      } else {
        setBalancesLoading(false)
      }

      const investments = JSON.parse(localStorage.getItem('user_investments') || '[]')
      setMyActiveInvestmentsList(investments)
      setTransactions([])

      const referralUserId = supabaseUserId || userData[profileEmail]?.id
      if (referralUserId) {
        const referralData = loadReferralStats(referralUserId)
        setReferralLink(referralData.referralLink || '')
        setReferralCount(referralData.referralCount || 0)
        setReferralEarningsUsd(referralData.earningsUsd || 0.0)
        setReferralEarningsEtb(referralData.earningsEtb || 0.0)
      }

      const claimTs = localStorage.getItem('lastClaimTimestamp')
      if (claimTs) setClaimTimestamp(parseInt(claimTs))
    }

    loadUserState()

    testSupabaseConnection().then((result) => {
      if (!result.configured) {
        console.warn('[Supabase]', result.message)
      } else if (!result.ok) {
        console.warn('[Supabase] Connection issue:', result.message)
      }
    })
  }, [refreshBalances])

  const prevActivePage = useRef(activePage)
  useEffect(() => {
    if (prevActivePage.current === activePage) return
    prevActivePage.current = activePage
    if (activePage === 'home' || activePage === 'deposit' || activePage === 'invest') {
      refreshBalances()
    }
  }, [activePage, refreshBalances])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshBalances()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshBalances])

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'deposit', label: 'Deposit', icon: Wallet },
    { id: 'invest', label: 'Invest', icon: TrendingUp },
    { id: 'withdraw', label: 'Withdraw', icon: ArrowDownRight },
    { id: 'history', label: 'History', icon: Clock4 },
    { id: 'support', label: 'Support', icon: HelpCircle },
  ]

  const visibleNavItems = navItems

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
    const userId = getSession()?.user?.id
    const withUser = { ...entry, userId: entry.userId || userId }
    setTransactions((prev) => {
      const next = dedupeTransactions([withUser, ...prev])
      if (userId) saveLocalTransactionsForUser(userId, next)
      return next
    })
  }

  // Share context with children through render function or pass directly
  const appContext = {
    usdBalance, setUsdBalance,
    etbBalance, setEtbBalance,
    balancesLoading,
    refreshBalances,
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
    <div className="app-shell min-h-screen w-full max-w-full overflow-x-hidden bg-white text-slate-900">
      {/* Top Header */}
      <div className="fixed top-0 inset-x-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div>
            {activePage === 'home' ? null : (
              <h1 className="text-2xl font-bold text-[#84CC16]">BLACKROCK</h1>
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
      <div className="app-main-content mx-auto w-full max-w-7xl box-border px-4 pt-24">
        {children(appContext)}
      </div>

      {/* Bottom Navigation */}
      <nav className="app-bottom-nav" aria-label="Primary navigation">
        <div className="app-bottom-nav-inner mx-auto max-w-7xl">
          {visibleNavItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (id === 'support') {
                  navigate('/support')
                  return
                }
                setActivePage(id)
              }}
              className={`app-nav-btn${activePage === id ? ' app-nav-btn--active' : ''}`}
              aria-current={activePage === id ? 'page' : undefined}
            >
              <Icon size={28} strokeWidth={2.25} className="app-nav-icon" aria-hidden="true" />
              <span className="app-nav-label">{label}</span>
            </button>
          ))}
        </div>
      </nav>

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
        <div className={`app-toast fixed left-4 right-4 z-40 px-4 py-3 rounded-3xl text-white text-sm font-medium ${
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
