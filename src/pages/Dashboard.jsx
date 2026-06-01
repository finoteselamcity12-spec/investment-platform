import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Coins,
  Gem,
  Crown,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRight,
  CreditCard,
  History,
  Wallet,
  User,
  Menu,
  Copy,
  Check,
  Gift,
  Shield,
} from 'lucide-react'
import supabase from '../lib/supabase'
import AdminLoginModal from '../components/AdminLoginModal'

// Premium tier naming system
const premiumTierNames = {
  // USD tiers
  3: 'VIP Level 1',
  5: 'VIP Level 2',
  7: 'VIP Level 3',
  10: 'VIP Level 4',
  15: 'VIP Level 5',
  20: 'Silver Star',
  25: 'Silver Elite',
  30: 'Gold Starter',
  35: 'Gold Premium',
  40: 'Gold Executive',
  45: 'Gold Prestige',
  50: 'Platinum Starter',
  75: 'Platinum Plus',
  90: 'Platinum Master',
  110: 'Diamond Executive',
  150: 'Crown Emperor',
  200: 'Apex Elite',
  500: 'Apex Sovereign',
  1000: 'Apex Immortal',
  5000: 'Apex Legacy',
  // ETB tiers
  350: 'VIP Level 1',
  500: 'VIP Level 2',
  700: 'VIP Level 3',
  1000: 'VIP Level 4',
  1500: 'Silver Star',
  5000: 'Silver Elite',
  10000: 'Gold Starter',
  15000: 'Gold Premium',
  20000: 'Gold Executive',
  25000: 'Platinum Master',
  30000: 'Diamond Executive',
  35000: 'Crown Emperor',
  40000: 'Apex Elite',
  45000: 'Apex Sovereign',
  50000: 'Apex Legacy',
}

function getPremiumIcon(amount) {
  if (amount <= 15 || (amount >= 350 && amount <= 1500)) {
    return Coins
  }

  if ((amount > 15 && amount < 110) || (amount > 1500 && amount < 20000)) {
    return amount % 2 === 0 ? ArrowUpCircle : ArrowDownCircle
  }

  const sequence = [Gem, Crown, Gem, Crown, Gem, Crown]
  const highUsd = [110, 150, 200, 500, 1000, 5000]
  const highEtb = [20000, 25000, 30000, 35000, 40000, 45000, 50000]
  const allHigh = [...highUsd, ...highEtb]
  const index = allHigh.indexOf(amount)
  return index >= 0 ? sequence[index % sequence.length] : Gem
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

function badgeLabel(type) {
  switch (type) {
    case 'USD':
      return 'USD'
    case 'ETB':
      return 'ETB'
    default:
      return type
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [activePage, setActivePage] = useState('dashboard')
  const [investTab, setInvestTab] = useState('USD')
  const [depositChannel, setDepositChannel] = useState('merchant')
  const [usdBalance, setUsdBalance] = useState(0.0)
  const [etbBalance, setEtbBalance] = useState(0.0)
  const [myActiveInvestmentsList, setMyActiveInvestmentsList] = useState([])
  const [transactions, setTransactions] = useState([])
  // Unified deposit form state
  const [depositForm, setDepositForm] = useState({ amount: '', currency: 'ETB', transactionId: '', screenshot: null })
  const [depositError, setDepositError] = useState('')
  const [depositIdValid, setDepositIdValid] = useState(false)
  const [isVerifyingDeposit, setIsVerifyingDeposit] = useState(false)
  const [submittedTransactionIds, setSubmittedTransactionIds] = useState([])
  const [transactionProofMap, setTransactionProofMap] = useState({})
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [copiedText, setCopiedText] = useState('')
  const [withdrawName, setWithdrawName] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState('CBE')
  const [withdrawAccount, setWithdrawAccount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [claimTimestamp, setClaimTimestamp] = useState(null)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')
  const [historyFilter, setHistoryFilter] = useState('All')
  const [referralCount, setReferralCount] = useState(0)
  const [referralEarningsUsd, setReferralEarningsUsd] = useState(0.0)
  const [referralEarningsEtb, setReferralEarningsEtb] = useState(0.0)
  const [copied, setCopied] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [depositWaiting, setDepositWaiting] = useState(false)
  const [pendingDepositId, setPendingDepositId] = useState(null)
  const [bonusEligible, setBonusEligible] = useState(false)
  const [bonusClaimed, setBonusClaimed] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userFullName, setUserFullName] = useState('')

  const [referralLink, setReferralLink] = useState('')
  const claimCooldownMs = 24 * 60 * 60 * 1000

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'All') return transactions
    if (historyFilter === 'Deposits') return transactions.filter((item) => item.type === 'Deposit')
    if (historyFilter === 'Withdrawals') return transactions.filter((item) => item.type === 'Withdrawal')
    if (historyFilter === 'Investments') return transactions.filter((item) => item.type === 'Investment')
    if (historyFilter === 'Claims') return transactions.filter((item) => item.type === 'Claim')
    return transactions
  }, [historyFilter, transactions])

  const activeInvestmentsCount = myActiveInvestmentsList.length
  const usdDailyReward = useMemo(
    () =>
      myActiveInvestmentsList
        .filter((item) => item.currency === 'USD')
        .reduce((sum, item) => sum + item.dailyProfit, 0),
    [myActiveInvestmentsList]
  )
  const etbDailyReward = useMemo(
    () =>
      myActiveInvestmentsList
        .filter((item) => item.currency === 'ETB')
        .reduce((sum, item) => sum + item.dailyProfit, 0),
    [myActiveInvestmentsList]
  )

  const lastClaimAge = claimTimestamp ? Date.now() - claimTimestamp : null
  const claimAvailable = !claimTimestamp || lastClaimAge >= claimCooldownMs
  const claimRemainingMinutes = claimTimestamp ? Math.max(0, Math.ceil((claimCooldownMs - lastClaimAge) / 60000)) : 0

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(''), 3200)
    return () => clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    // Load user data and bonus eligibility on component mount
    const user = supabase.auth.user || { email: 'user@example.com' }
    const userEmail = user?.email || 'user@example.com'
    setUserEmail(userEmail)

    // Load user's full name from admin_user_data or platform_registered_users_data
    const adminData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    const regData = JSON.parse(localStorage.getItem('platform_registered_users_data') || '{}')
    const full = (adminData[userEmail] && adminData[userEmail].fullName) || (regData[userEmail] && regData[userEmail].fullName) || ''
    if (full) setUserFullName(full)

    // Register user if not already registered
    const registeredUsers = JSON.parse(localStorage.getItem('platform_registered_users') || '[]')
    if (!registeredUsers.includes(userEmail)) {
      registeredUsers.push(userEmail)
      localStorage.setItem('platform_registered_users', JSON.stringify(registeredUsers))
    }

    // Load user bonus data
    const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    if (userData[userEmail]) {
      setBonusEligible(userData[userEmail].bonusEligible || false)
      setBonusClaimed(userData[userEmail].bonusClaimed || false)
    }

    // Build dynamic referral link using stored userId if available
    const regDataAll = JSON.parse(localStorage.getItem('platform_registered_users_data') || '{}')
    const currentId = (userData[userEmail] && userData[userEmail].id) || (regDataAll[userEmail] && regDataAll[userEmail].userId) || userEmail
    try {
      const origin = window?.location?.origin || 'http://localhost:5173'
      setReferralLink(`${origin}/register?ref=${encodeURIComponent(currentId)}`)
    } catch (e) {
      setReferralLink(`http://localhost:5173/register?ref=${encodeURIComponent(currentId)}`)
    }

    // If user has a pending deposit, enter waiting state
    const pendingKey = `user_pending_deposit_${userEmail}`
    const pendingId = localStorage.getItem(pendingKey)
    if (pendingId) {
      setDepositWaiting(true)
      setPendingDepositId(pendingId)
    }
  }, [])

  // Poll for deposit approval/rejection status while waiting
  useEffect(() => {
    if (!depositWaiting || !pendingDepositId) return
    const interval = setInterval(() => {
      // Check if pending deposit still exists
      const pendingDeposits = JSON.parse(localStorage.getItem('admin_pending_deposits') || '[]')
      const found = pendingDeposits.find((d) => d.id === pendingDepositId)
      if (found) return // still pending

      // If it's not in pending list, check approved or rejected logs
      const approved = JSON.parse(localStorage.getItem('admin_approved_transactions') || '[]')
      const rejected = JSON.parse(localStorage.getItem('admin_rejected_transactions') || '[]')

      const wasApproved = approved.find((a) => a.id === pendingDepositId)
      const wasRejected = rejected.find((r) => r.id === pendingDepositId)

      if (wasApproved) {
        // Refresh user balances from admin_user_data
        const users = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
        const u = users[userEmail]
        if (u) {
          setUsdBalance(u.usdBalance || 0)
          setEtbBalance(u.etbBalance || 0)
          setBonusEligible(u.bonusEligible || false)
          setBonusClaimed(u.bonusClaimed || false)
        }
        setDepositWaiting(false)
        setPendingDepositId(null)
        localStorage.removeItem(`user_pending_deposit_${userEmail}`)
        showToast('Your deposit was approved and your wallet has been updated.')
        clearInterval(interval)
        return
      }

      if (wasRejected) {
        setDepositWaiting(false)
        setPendingDepositId(null)
        localStorage.removeItem(`user_pending_deposit_${userEmail}`)
        showToast('Your deposit was rejected. Please contact support.', 'error')
        clearInterval(interval)
        return
      }
    }, 1200)
    return () => clearInterval(interval)
  }, [depositWaiting, pendingDepositId, userEmail])

  function showToast(message, type = 'success') {
    setToastType(type)
    setToastMessage(message)
  }

  function handleClaimBonus() {
    if (!bonusEligible) {
      showToast('You are not eligible for bonus claim yet.', 'error')
      return
    }

    if (bonusClaimed) {
      showToast('You have already claimed your bonus.', 'error')
      return
    }

    // Add 35 bonus to user wallet (USD)
    const bonusAmount = 35
    setUsdBalance((prev) => Number((prev + bonusAmount).toFixed(2)))

    // Update user data - mark bonus as claimed
    const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    if (userData[userEmail]) {
      userData[userEmail].bonusEligible = false
      userData[userEmail].bonusClaimed = true
    }
    localStorage.setItem('admin_user_data', JSON.stringify(userData))

    setBonusEligible(false)
    setBonusClaimed(true)

    // Add transaction record
    addTransaction({
      id: `tx-bonus-${Date.now()}`,
      type: 'Claim',
      category: 'Claims',
      title: `Bonus Claimed: +$${bonusAmount}`,
      amount: bonusAmount,
      currency: 'USD',
      status: 'Completed',
      date: new Date().toISOString(),
    })

    showToast(`Bonus claimed! +$${bonusAmount} added to your wallet.`)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  function addTransaction(entry) {
    setTransactions((prev) => [entry, ...prev])
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleCopyText(textToCopy, label) {
    navigator.clipboard.writeText(textToCopy)
    setCopiedText(label)
    showToast('Copied to clipboard!')
    setTimeout(() => setCopiedText(''), 2000)
  }

  // Telebirr ID pattern: common prefixes (T,TB,TR,TX) followed by at least 8 alphanumeric chars -> total min 10
  const TELEBIRR_REGEX = /^(?:T|TB|TR|TX)[A-Z0-9]{8,}$/i
  const USDT_TRANSACTION_REGEX = /^(?:0x)?[A-Za-z0-9]{10,}$/i

  function validateDepositTransactionId(value, currency) {
    if (!value) return false
    const normalized = value.trim().replace(/\s+/g, '')
    return currency === 'USDT' ? USDT_TRANSACTION_REGEX.test(normalized) : TELEBIRR_REGEX.test(normalized)
  }

  function handleInvest(tier) {
    const balance = tier.currency === 'USD' ? usdBalance : etbBalance
    if (balance < tier.amount) {
      showToast('Insufficient funds. Please visit the Deposit page to add money.', 'error')
      return
    }

    if (tier.currency === 'USD') {
      setUsdBalance((prev) => Number((prev - tier.amount).toFixed(2)))
    } else {
      setEtbBalance((prev) => Number((prev - tier.amount).toFixed(0)))
    }

    const premiumName = premiumTierNames[tier.amount] || `Tier ${tier.amount}`
    const investment = {
      id: `${tier.id}-${Date.now()}`,
      title: premiumName,
      currency: tier.currency,
      amount: tier.amount,
      days: tier.days,
      dailyProfit: tier.dailyProfit,
      bonus: tier.bonus,
      activatedAt: new Date().toISOString(),
      status: 'Active',
    }

    setMyActiveInvestmentsList((prev) => [investment, ...prev])
    addTransaction({
      id: `tx-${Date.now()}`,
      type: 'Investment',
      category: 'Investments',
      title: `Plan Activated: ${tier.amount} ${tier.currency}`,
      amount: tier.amount,
      currency: tier.currency,
      status: 'Active',
      date: new Date().toISOString(),
    })
    showToast('Investment activated successfully!')
  }

  async function handleDepositSubmit(event) {
    event.preventDefault()
    const amountValue = Number(depositForm.amount)
    const txIdValue = depositForm.transactionId.trim()
    const normalizedTxId = txIdValue.replace(/\s+/g, '').toUpperCase()
    const txIdProvided = normalizedTxId.length > 0
    const invalidTransactionIDs = /^(123456|ABC|ABCDEF|000000|111111|222222|123123|ABC123)$/

    setDepositError('')

    // Validate gateway is one of the 3 official channels
    const validGateways = ['merchant', 'personal', 'usdt']
    if (!validGateways.includes(depositChannel)) {
      setDepositError('Invalid Payment Gateway. Deposits can only be made to the official platform channels.')
      return
    }

    if (txIdProvided && (!validateDepositTransactionId(txIdValue, depositForm.currency) || invalidTransactionIDs.test(normalizedTxId))) {
      setDepositError('Invalid Transaction ID format. Please ensure you copied the correct code from your payment receipt.')
      return
    }

    // Automated duplicate scanner: check global transaction ledger
    const globalLedger = JSON.parse(localStorage.getItem('platform_global_tx_ledger') || '[]')
    if (txIdProvided && globalLedger.includes(normalizedTxId)) {
      setDepositError('Transaction ID already claimed.')
      return
    }

    // Check local session history
    const isDuplicateId = txIdProvided && (submittedTransactionIds.includes(normalizedTxId) ||
      transactions.some((tx) =>
        tx.transactionId?.toUpperCase().replace(/\s+/g, '') === normalizedTxId
      ))

    if (isDuplicateId) {
      setDepositError('Error: This Transaction ID has already been submitted or processed!')
      return
    }

    if (!amountValue || amountValue <= 0) {
      setDepositError('Enter a valid deposit amount.')
      return
    }
    if (!txIdProvided) {
      setDepositError('Please enter your transaction ID for verification.')
      return
    }
    if (!depositForm.screenshot) {
      setDepositError('Screenshot of payment receipt is required for verification.')
      return
    }

    // Currency comes from depositForm and must be 'ETB' or 'USDT'
    const currency = depositForm.currency
    if (!currency) {
      setDepositError('Select a currency for this deposit.')
      return
    }
    if (!validateDepositTransactionId(txIdValue, currency) || invalidTransactionIDs.test(normalizedTxId)) {
      setDepositError('The transaction reference does not match the selected currency format.')
      return
    }

    const formData = {
      amount: amountValue,
      currency,
      transactionId: txIdProvided ? normalizedTxId : null,
      gateway: depositChannel,
      receiptFile: depositForm.screenshot,
    }
    console.log('Deposit submitted:', formData)

    setIsVerifyingDeposit(true)

    // Create pending deposit record - DO NOT ADD FUNDS YET
    let receiptDataUrl = null
    let receiptFileName = depositForm.screenshot?.name || null
    if (depositForm.screenshot && typeof File !== 'undefined' && depositForm.screenshot instanceof File) {
      // Read file as data URL so admin can preview it
      receiptDataUrl = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(depositForm.screenshot)
      })
    }

    const pendingDeposit = {
      id: `deposit-${Date.now()}`,
      userId: userEmail,
      userEmail: userEmail,
      amount: amountValue,
      currency: currency,
      gateway: depositChannel,
      transactionId: txIdProvided ? normalizedTxId : null,
      receiptFile: receiptFileName || 'receipt.jpg',
      receiptDataUrl: receiptDataUrl,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    }

    // Store in admin pending deposits
    const pendingDeposits = JSON.parse(localStorage.getItem('admin_pending_deposits') || '[]')
    pendingDeposits.push(pendingDeposit)
    localStorage.setItem('admin_pending_deposits', JSON.stringify(pendingDeposits))

    // Store deposit history for debugging and audit
    const depositHistory = JSON.parse(localStorage.getItem('depositHistory') || '[]')
    depositHistory.push({
      ...pendingDeposit,
      savedAt: new Date().toISOString(),
      form: { amount: amountValue, currency: currency, transactionId: txIdProvided ? normalizedTxId : null, screenshot: depositForm.screenshot }
    })
    localStorage.setItem('depositHistory', JSON.stringify(depositHistory))

    const transactionReference = {
      id: `tx-${Date.now()}`,
      type: 'Deposit',
      category: 'Deposits',
      title: `Deposit Submitted: ${formatCurrency(amountValue, currency)} (Awaiting Approval)`,
      amount: amountValue,
      currency,
      status: 'Pending Admin Approval',
      date: new Date().toISOString(),
      transactionId: txIdProvided ? normalizedTxId : null,
      receiptFile: depositForm.screenshot,
    }

    addTransaction(transactionReference)
    if (txIdProvided) {
      setSubmittedTransactionIds((prev) => [...prev, normalizedTxId])
      // Add Transaction ID to global platform ledger after successful verification
      globalLedger.push(normalizedTxId)
      localStorage.setItem('platform_global_tx_ledger', JSON.stringify(globalLedger))

      setTransactionProofMap((prev) => ({
        ...prev,
        [normalizedTxId]: {
          fileName: receiptFileName,
          size: depositForm.screenshot?.size,
          lastModified: depositForm.screenshot?.lastModified,
          dataUrl: receiptDataUrl,
        },
      }))
    }

    // Mark this user's pending deposit so the UI can stay in waiting state
    localStorage.setItem(`user_pending_deposit_${userEmail}`, pendingDeposit.id)
    setDepositWaiting(true)
    setPendingDepositId(pendingDeposit.id)

    // Clear form inputs but keep waiting state
    setDepositForm({ amount: '', currency: 'ETB', transactionId: '', screenshot: null })
    setIsVerifyingDeposit(false)
    alert('Deposit request submitted successfully! Pending admin approval.')
    showToast('Deposit submitted. Please wait while we verify your payment.')
  }

  function handleWithdrawSubmit(event) {
    event.preventDefault()
    const amountValue = Number(withdrawAmount)
    const method = withdrawMethod
    const currency = method === 'USDT (TRC20)' ? 'USD' : 'ETB'
    const balance = currency === 'USD' ? usdBalance : etbBalance

    if (!withdrawName.trim() || !withdrawAccount.trim() || !amountValue || amountValue <= 0) {
      showToast('Complete every withdrawal field.', 'error')
      return
    }

    if (amountValue > balance) {
      showToast(`Insufficient ${currency} balance for this withdrawal.`, 'error')
      return
    }

    if (currency === 'USD') {
      setUsdBalance((prev) => Number((prev - amountValue).toFixed(2)))
    } else {
      setEtbBalance((prev) => Number((prev - amountValue).toFixed(0)))
    }

    // Add to admin pending withdrawals
    const pendingWithdrawals = JSON.parse(localStorage.getItem('admin_pending_withdrawals') || '[]')
    pendingWithdrawals.push({
      id: `withdrawal-${Date.now()}`,
      userName: withdrawName,
      userEmail: userEmail,
      amount: amountValue,
      currency,
      method: method,
      account: withdrawAccount,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem('admin_pending_withdrawals', JSON.stringify(pendingWithdrawals))

    addTransaction({
      id: `tx-${Date.now()}`,
      type: 'Withdrawal',
      category: 'Withdrawals',
      title: `${method} cashout requested`,
      amount: amountValue,
      currency,
      status: 'Pending Approval',
      date: new Date().toISOString(),
    })

    setWithdrawName('')
    setWithdrawMethod('CBE')
    setWithdrawAccount('')
    setWithdrawAmount('')
    showToast('Cashout request submitted successfully.')
  }

  function handleClaimRewards() {
    if (!claimAvailable) {
      showToast('Claim is only available once every 24 hours.', 'error')
      return
    }

    if (!activeInvestmentsCount) {
      showToast('No active investments to claim rewards from.', 'error')
      return
    }

    const usdReward = usdDailyReward
    const etbReward = etbDailyReward

    if (usdReward) {
      setUsdBalance((prev) => Number((prev + usdReward).toFixed(2)))
      addTransaction({
        id: `tx-${Date.now()}-usd`,
        type: 'Claim',
        category: 'Claims',
        title: `Daily Income Claimed: +$${usdReward.toFixed(2)} USD`,
        amount: usdReward,
        currency: 'USD',
        status: 'Success',
        date: new Date().toISOString(),
      })
    }

    if (etbReward) {
      setEtbBalance((prev) => Number((prev + etbReward).toFixed(0)))
      addTransaction({
        id: `tx-${Date.now()}-etb`,
        type: 'Claim',
        category: 'Claims',
        title: `Daily Income Claimed: +${etbReward.toLocaleString()} Birr`,
        amount: etbReward,
        currency: 'ETB',
        status: 'Success',
        date: new Date().toISOString(),
      })
    }

    setClaimTimestamp(Date.now())
    showToast('Success! Your daily earnings have been moved to your wallet.')
  }

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate daily earnings accumulation for active investments
      setMyActiveInvestmentsList((prev) =>
        prev.map((inv) => {
          const dailyReward = inv.dailyProfit
          if (inv.currency === 'USD') {
            // Could accumulate pending rewards here if desired
          } else {
            // Could accumulate pending rewards here if desired
          }
          return inv
        })
      )
    }, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [])

  const pageCards = [
    { key: 'dashboard', label: 'Dashboard', icon: Coins },
    { key: 'invest', label: 'Invest', icon: Gem },
    { key: 'deposit', label: 'Deposit', icon: Wallet },
    { key: 'withdraw', label: 'Withdraw', icon: ArrowDownCircle },
    { key: 'history', label: 'History', icon: History },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8">
          <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[280px] max-w-full bg-white border-r border-gray-200 flex flex-col p-4">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {!avatarFailed ? (
                  <img
                    src="https://images.unsplash.com/photo-1603415526960-f7e0328c90c0?auto=format&fit=crop&w=256&q=80"
                    alt={`${userFullName || 'Account'} profile`}
                    onError={() => setAvatarFailed(true)}
                    className="h-16 w-16 rounded-full border-2 border-[#1d4ed8] object-cover shadow-md"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white bg-[#1d4ed8] text-white shadow-inner">
                    <User className="h-7 w-7" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold uppercase tracking-tight text-zinc-950">Account</p>
                  <p className="mt-2 text-lg font-bold text-zinc-900">{userFullName || 'Account'}</p>
                </div>
              </div>
              <div className="rounded-3xl bg-[#1d4ed8]/10 p-3 text-[#1d4ed8] shadow-sm">
                <Wallet className="h-5 w-5" />
              </div>
            </div>

            <nav className="flex-1 space-y-2">
              {pageCards.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActivePage(item.key)}
                    className={`flex w-full items-center gap-3 rounded-3xl px-4 py-3 text-left text-sm font-bold transition ${
                      activePage === item.key ? 'bg-[#1d4ed8] text-white shadow' : 'bg-slate-50 text-zinc-950 hover:bg-slate-100'
                    }`}
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-3xl bg-slate-100 text-[#1d4ed8]">
                      <Icon className="h-5 w-5" />
                    </span>
                    {item.label}
                  </button>
                )
              })}
            </nav>

            <div className="mt-auto space-y-2 pt-4 border-t border-gray-100">
              <a
                href="https://t.me/investment_platform_3"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600"
              >
                Support
              </a>

              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af]"
              >
                Sign Out
              </button>

              <button
                type="button"
                onClick={() => setShowAdminLogin(true)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-slate-50"
              >
                Admin Operator
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 md:ml-[280px]">
          <div className="space-y-6">
            <div className="md:hidden">
              <div className="mb-4 flex items-center justify-between gap-3 rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                  className="inline-flex h-11 min-w-[3rem] items-center justify-center rounded-3xl bg-[#1d4ed8] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#1d4ed8]"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-tight text-zinc-950">Dashboard</p>
                  <p className="mt-1 text-base font-bold text-zinc-950">{userFullName || 'Account'}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex h-11 items-center justify-center rounded-3xl bg-slate-100 px-4 text-sm font-bold text-zinc-950 transition hover:bg-slate-200"
                >
                  Sign Out
                </button>
              </div>
              {isMobileMenuOpen && (
                <div className="mb-4 rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="grid gap-2">
                    {pageCards.map((item) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setActivePage(item.key)
                            setIsMobileMenuOpen(false)
                          }}
                          className={`w-full rounded-3xl px-4 py-3 text-left text-sm font-bold transition ${
                            activePage === item.key ? 'bg-[#1d4ed8] text-white shadow' : 'bg-slate-50 text-zinc-950 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-3xl bg-slate-100 text-[#1d4ed8]">
                              <Icon className="h-5 w-5" />
                            </span>
                            {item.label}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            {activePage === 'dashboard' && (
              <section className="card-surface space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-tight text-zinc-950">Main overview</p>
                    <h1 className="mt-2 text-2xl font-bold text-zinc-950">Dashboard & Daily Earnings</h1>
                  </div>
                  <div className="rounded-3xl bg-[#1d4ed8]/10 p-4 text-white shadow-sm sm:text-right">
                    <p className="text-xs uppercase tracking-tight text-zinc-950">24h Earnings Pool</p>
                    <p className="mt-2 text-xl font-bold text-zinc-950">{`${formatCurrency(usdDailyReward, 'USD')} + ${formatCurrency(etbDailyReward, 'ETB')}`}</p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  <div className="card-surface">
                    <p className="text-xs uppercase tracking-tight text-zinc-950">USD Wallet (🇺🇸)</p>
                    <p className="mt-4 text-2xl font-extrabold text-zinc-900">${usdBalance.toFixed(2)}</p>
                  </div>
                  <div className="card-surface">
                    <p className="text-xs uppercase tracking-tight text-zinc-950">ETB Wallet (🇪🇹)</p>
                    <p className="mt-4 text-2xl font-extrabold text-zinc-900">{etbBalance.toLocaleString()} Birr</p>
                  </div>
                  <div className="card-surface">
                    <p className="text-xs uppercase tracking-tight text-zinc-950">Active Investments</p>
                    <p className="mt-4 text-2xl font-extrabold text-zinc-900">{activeInvestmentsCount}</p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
                  <div className="card-surface">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-tight text-zinc-950">Mining Nodes / Daily Claim Pool</p>
                        <h2 className="mt-3 text-2xl font-extrabold text-zinc-950">{activeInvestmentsCount} Active Nodes</h2>
                      </div>
                      <div className="inline-flex items-center rounded-3xl bg-[#1d4ed8]/10 px-4 py-3 text-sm font-bold text-[#1d4ed8]">{myActiveInvestmentsList.length} active tiers</div>
                    </div>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-3xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-tight text-zinc-950">USD daily reward</p>
                        <p className="mt-2 text-2xl font-bold text-zinc-950">${usdDailyReward.toFixed(2)}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-tight text-zinc-950">ETB daily reward</p>
                        <p className="mt-2 text-2xl font-bold text-zinc-950">{etbDailyReward.toLocaleString()} Birr</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClaimRewards}
                      disabled={!claimAvailable}
                      className="mt-6 inline-flex items-center justify-center gap-2 rounded-3xl bg-[#1d4ed8] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                      {claimAvailable ? 'Claim 24h Earnings' : `Claim again in ${claimRemainingMinutes}m`}
                    </button>

                    {bonusEligible && !bonusClaimed && (
                      <button
                        type="button"
                        onClick={handleClaimBonus}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600"
                      >
                        <Gift className="h-4 w-4" />
                        Claim Bonus: +$35
                      </button>
                    )}
                  </div>

                  <div className="card-surface">
                    <p className="text-sm uppercase tracking-tight text-zinc-950">Referral Portal</p>
                    <h2 className="mt-3 text-2xl font-bold text-zinc-950">Invite investors & earn rewards</h2>
                    <div className="mt-6 space-y-4">
                      <div className="rounded-3xl border border-gray-200 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-tight text-zinc-950">Referral Link</p>
                        <div className="mt-2 flex items-center gap-2 rounded-3xl border border-gray-200 bg-white px-4 py-3">
                          <input
                            type="text"
                            readOnly
                            value={referralLink}
                            className="w-full bg-transparent pr-2 text-sm font-bold text-zinc-950 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleCopyLink}
                            className="inline-flex h-11 items-center justify-center rounded-3xl bg-[#1d4ed8] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#1d4ed8]"
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-3xl bg-white p-4 shadow-sm">
                          <p className="text-xs uppercase tracking-tight text-zinc-950">USD referral reward</p>
                          <p className="mt-2 text-lg font-bold text-zinc-950">$3 / user</p>
                          <p className="mt-1 text-sm font-bold text-zinc-950">Total: ${referralEarningsUsd}</p>
                        </div>
                        <div className="rounded-3xl bg-white p-4 shadow-sm">
                          <p className="text-xs uppercase tracking-tight text-zinc-950">ETB referral reward</p>
                          <p className="mt-2 text-lg font-bold text-zinc-950">93 Birr / user</p>
                          <p className="mt-1 text-sm font-bold text-zinc-950">Total: {referralEarningsEtb.toLocaleString()} Birr</p>
                        </div>
                      </div>
                      <div className="rounded-3xl bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-tight text-zinc-950">Referrals</p>
                        <p className="mt-2 text-base font-bold text-zinc-950">{referralCount} total invites</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activePage === 'invest' && (
              <section className="card-surface space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-tight text-zinc-950">Investment tiers</p>
                    <h1 className="mt-2 text-2xl font-bold text-zinc-950">Choose your USD or Birr plan</h1>
                  </div>
                  <div className="inline-flex rounded-3xl bg-slate-50 p-2">
                    {['USD', 'ETB'].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setInvestTab(tab)}
                        className={`rounded-3xl px-5 py-3 text-sm font-bold transition ${
                          investTab === tab ? 'bg-[#1d4ed8] text-white shadow' : 'text-zinc-950 hover:bg-slate-100'
                        }`}
                      >
                        {tab === 'USD' ? 'USD' : 'ETB'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
                  {(investTab === 'USD' ? usdTiers : etbTiers).map((tier) => {
                    const PremiumIcon = getPremiumIcon(tier.amount)
                    const premiumName = premiumTierNames[tier.amount] || tier.title
                    return (
                      <div key={tier.id} className="card-surface">
                        <div className="flex items-center justify-between gap-4">
                          <div className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-[#1d4ed8]/10 text-[#1d4ed8]">
                            <PremiumIcon className="h-7 w-7" />
                          </div>
                          <div className="rounded-3xl bg-black px-3 py-2 text-xs font-extrabold uppercase tracking-tight text-white">{badgeLabel(investTab)}</div>
                        </div>
                        <div className="mt-4 space-y-3">
                          <div>
                            <p className="text-zinc-950 font-bold text-lg uppercase tracking-tight">{formatCurrency(tier.amount, investTab)}</p>
                            <h2 className="mt-2 text-lg font-semibold text-zinc-950 tracking-tight">{premiumName}</h2>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="rounded-2xl bg-[#1d4ed8] px-2 py-2 text-center">
                              <p className="text-xs font-bold uppercase tracking-wide text-white">Days</p>
                              <p className="mt-1 text-base font-bold text-white">{tier.days}</p>
                            </div>
                            <div className="rounded-2xl bg-[#1d4ed8] px-2 py-2 text-center">
                              <p className="text-xs font-bold uppercase tracking-wide text-white">Daily</p>
                              <p className="mt-1 text-base font-bold text-white">{formatCurrency(tier.dailyProfit, investTab)}</p>
                            </div>
                            <div className="rounded-2xl bg-[#1d4ed8] px-2 py-2 text-center">
                              <p className="text-xs font-bold uppercase tracking-wide text-white">Bonus</p>
                              <p className="mt-1 text-base font-bold text-white">{formatCurrency(tier.bonus, investTab)}</p>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleInvest({ ...tier, currency: investTab })}
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-[#1d4ed8] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1e40af]"
                        >
                          Invest Now
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {activePage === 'deposit' && (
              <section className="card-surface space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-tight text-zinc-950">Funding channels</p>
                    <h1 className="mt-2 text-2xl font-bold text-zinc-950">Deposit via Merchant, Personal or USDT</h1>
                    <p className="mt-3 max-w-2xl text-sm text-zinc-950">Choose your preferred gateway and submit the ticket with a screenshot proof.</p>
                  </div>
                  <div className="w-full rounded-3xl bg-slate-50 p-4 shadow-sm">
                    <label className="block text-sm uppercase tracking-tight text-zinc-950">Payment Method</label>
                    <select
                      value={depositChannel}
                      onChange={(event) => setDepositChannel(event.target.value)}
                      className="touch-input"
                    >
                      <option value="merchant">Merchant</option>
                      <option value="personal">Personal</option>
                      <option value="usdt">USDT (TRC20)</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
                  <div className="card-surface bg-slate-50">
                    <p className="text-sm uppercase tracking-tight text-zinc-950">Channel details</p>
                    <div className="mt-6 space-y-4">
                      {depositChannel === 'merchant' ? (
                        <div className="rounded-3xl bg-white p-4 shadow-sm">
                          <p className="text-xs uppercase tracking-tight text-zinc-950">Merchant Channel</p>
                          <div className="mt-4 space-y-2">
                            <div>
                              <p className="text-xs uppercase tracking-tight text-zinc-950">Merchant ID</p>
                              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-base font-bold text-black">900675</p>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText('900675', 'Merchant id')}
                                  className="inline-flex items-center justify-center rounded-3xl bg-[#1d4ed8] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#1d4ed8]"
                                >
                                  {copiedText === 'Merchant id' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-tight text-zinc-950">Account Name</p>
                              <p className="mt-2 text-base font-bold text-black">Amsal Aneley</p>
                            </div>
                          </div>
                        </div>
                      ) : depositChannel === 'personal' ? (
                        <div className="rounded-3xl bg-white p-4 shadow-sm">
                          <p className="text-xs uppercase tracking-tight text-zinc-950">Personal Channel</p>
                          <div className="mt-4 space-y-2">
                            <div>
                              <p className="text-xs uppercase tracking-tight text-zinc-950">Account Number</p>
                              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-base font-bold text-black">0993855459</p>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText('0993855459', 'Personal number')}
                                  className="inline-flex items-center justify-center rounded-3xl bg-[#1d4ed8] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#1d4ed8]"
                                >
                                  {copiedText === 'Personal number' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-tight text-zinc-950">Account Name</p>
                              <p className="mt-2 text-base font-bold text-black">Yohanis</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="rounded-3xl bg-white p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-tight text-zinc-950">Crypto Network</p>
                            <p className="mt-2 text-lg font-bold text-zinc-950">USDT TRC20</p>
                          </div>
                          <div className="rounded-3xl bg-white p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-tight text-zinc-950">Wallet Address</p>
                            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <p className="break-all text-lg font-bold text-zinc-950">TQjEAMhuezFdqKww9o5NWFBJhNKTgTpLMU</p>
                              <button
                                type="button"
                                onClick={() => handleCopyText('TQjEAMhuezFdqKww9o5NWFBJhNKTgTpLMU', 'USDT address')}
                                className="inline-flex items-center justify-center rounded-3xl bg-[#1d4ed8] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#1d4ed8]"
                              >
                                {copiedText === 'USDT address' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                    <div className="card-surface">
                    <p className="text-sm uppercase tracking-tight text-zinc-950">Submit deposit ticket</p>
                    {depositWaiting ? (
                      <div className="mt-6 flex items-center justify-center">
                        <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-slate-50 p-8 text-center">
                          <h3 className="text-lg font-bold text-zinc-950">Please wait...</h3>
                          <p className="mt-3 text-sm text-zinc-700">Your payment is being processed. Our team will verify it on the terminal shortly.</p>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleDepositSubmit} className="mt-6 space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-zinc-950">Transaction ID</label>
                        <input
                          type="text"
                          value={depositForm.transactionId}
                          onChange={(event) => {
                            const v = event.target.value
                            setDepositForm((prev) => ({ ...prev, transactionId: v }))
                            setDepositIdValid(validateDepositTransactionId(v, depositForm.currency))
                            if (depositError) setDepositError('')
                          }}
                          placeholder="e.g., DEU9H517C7"
                          className="touch-input"
                        />
                        {depositForm.transactionId && (
                          <p className={`mt-2 text-xs ${depositIdValid ? 'text-emerald-700' : 'text-red-600'}`}>
                            {depositIdValid
                              ? 'Looks like a valid transaction reference.'
                              : 'This does not match expected receipt code format.'}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-zinc-950">Currency</label>
                        <select
                          required
                          value={depositForm.currency}
                          onChange={(event) => {
                            const newCurrency = event.target.value
                            setDepositForm((prev) => ({ ...prev, currency: newCurrency }))
                            setDepositIdValid(validateDepositTransactionId(depositForm.transactionId, newCurrency))
                          }}
                          onBlur={(event) => setDepositIdValid(validateDepositTransactionId(depositForm.transactionId, event.target.value))}
                          className="touch-input"
                        >
                          <option value="ETB">ETB (Birr)</option>
                          <option value="USDT">USDT (TRC20)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-zinc-950">Amount</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={depositForm.amount}
                          onChange={(event) => setDepositForm((prev) => ({ ...prev, amount: event.target.value }))}
                          placeholder="Enter amount"
                          className="touch-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-zinc-950">Transaction screenshot</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            setDepositForm((prev) => ({ ...prev, screenshot: file || null }))
                          }}
                          className="mt-2 w-full rounded-3xl border border-gray-200 bg-slate-50 px-4 py-3 text-zinc-950"
                        />
                        {depositForm.screenshot && (
                          <p className="mt-2 text-sm text-zinc-950">Selected file: {depositForm.screenshot.name}</p>
                        )}
                      </div>
                      {depositError && (
                        <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600 tracking-tight">
                          {depositError}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={isVerifyingDeposit || depositWaiting}
                        className="touch-button disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CreditCard className="h-4 w-4" />
                        {isVerifyingDeposit ? 'Verifying Receipt...' : 'Submit Deposit Ticket'}
                      </button>
                    </form>
                    )}
                  </div>
                </div>
              </section>
            )}

            {activePage === 'withdraw' && (
              <section className="card-surface space-y-6">
                <div>
                  <p className="text-sm uppercase tracking-tight text-zinc-950">Cashout request</p>
                  <h1 className="mt-2 text-2xl font-bold text-zinc-950">Withdrawal</h1>
                  <p className="mt-3 max-w-2xl text-sm text-zinc-950">Choose local or crypto cashout and submit your secure payout instructions.</p>
                </div>
                <div className="grid gap-6 md:grid-cols-[1.15fr_0.85fr]">
                  <div className="card-surface bg-slate-50">
                    <p className="text-sm uppercase tracking-tight text-zinc-950">Available methods</p>
                    <div className="mt-5 space-y-3">
                      {withdrawMethods.map((method) => (
                        <div key={method} className="rounded-3xl bg-white p-4 shadow-sm">
                          <p className="text-sm font-bold text-zinc-950">{method}</p>
                          <p className="mt-2 text-sm text-zinc-950">{method === 'USDT (TRC20)' ? 'Withdraw from USD or crypto wallet.' : 'Withdraw to local bank / mobile wallet.'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card-surface">
                    <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-zinc-950">Full Name</label>
                        <input
                          type="text"
                          value={withdrawName}
                          onChange={(event) => setWithdrawName(event.target.value)}
                          placeholder="Your full name"
                          className="touch-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-zinc-950">Payment Method</label>
                        <select
                          value={withdrawMethod}
                          onChange={(event) => setWithdrawMethod(event.target.value)}
                          className="touch-input"
                        >
                          {withdrawMethods.map((method) => (
                            <option key={method} value={method}>{method}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-zinc-950">Account Number / Wallet Address</label>
                        <input
                          type="text"
                          value={withdrawAccount}
                          onChange={(event) => setWithdrawAccount(event.target.value)}
                          placeholder="Enter account or wallet address"
                          className="touch-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-zinc-950">Amount</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={withdrawAmount}
                          onChange={(event) => setWithdrawAmount(event.target.value)}
                          placeholder="Enter payout amount"
                          className="touch-input"
                        />
                      </div>
                      <button
                        type="submit"
                        className="touch-button"
                      >
                        <Wallet className="h-4 w-4" />
                        Request Cashout
                      </button>
                    </form>
                  </div>
                </div>
              </section>
            )}

            {activePage === 'history' && (
              <section className="card-surface space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-tight text-zinc-950">Transaction history</p>
                    <h1 className="mt-2 text-2xl font-bold text-zinc-950">All records & payouts</h1>
                    <p className="mt-3 max-w-2xl text-sm text-zinc-950">Filter deposits, withdrawals, investments and claims with clear status badges.</p>
                  </div>
                  <div className="inline-flex rounded-3xl bg-slate-50 p-2">
                    {historyFilters.map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setHistoryFilter(filter)}
                        className={`rounded-3xl px-4 py-3 text-sm font-bold transition ${
                          historyFilter === filter ? 'bg-[#1d4ed8] text-white shadow' : 'text-zinc-950 hover:bg-slate-100'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.75rem] border border-gray-200 shadow-sm">
                  <table className="table-minimal responsive-table min-w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 font-bold text-zinc-950">Type</th>
                        <th className="px-6 py-4 font-bold text-zinc-950">Details</th>
                        <th className="px-6 py-4 font-bold text-zinc-950">Amount</th>
                        <th className="px-6 py-4 font-bold text-zinc-950">Status</th>
                        <th className="px-6 py-4 font-bold text-zinc-950">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredHistory.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-6 py-8 text-center text-sm text-zinc-950">No transactions match this filter.</td>
                        </tr>
                      ) : (
                        filteredHistory.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 font-bold text-zinc-950" data-label="Type">{item.type}</td>
                            <td className="px-6 py-4 text-zinc-950" data-label="Details">{item.title}</td>
                            <td className="px-6 py-4 text-zinc-950" data-label="Amount">{formatCurrency(item.amount, item.currency)}</td>
                            <td className="px-6 py-4" data-label="Status">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-tight ${
                                item.status === 'Success' ? 'bg-emerald-100 text-emerald-700' : item.status === 'Active' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-zinc-950" data-label="Date">{new Date(item.date).toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-3xl px-5 py-4 text-sm font-bold shadow-xl ${toastType === 'success' ? 'bg-[#1d4ed8] text-white' : 'bg-rose-500 text-white'}`}>
          {toastMessage}
        </div>
      )}

      <AdminLoginModal isOpen={showAdminLogin} onClose={() => setShowAdminLogin(false)} />
    </div>
  )
}

