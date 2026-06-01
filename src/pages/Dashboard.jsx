import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, Gift, UserCircle } from 'lucide-react'

const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000

function formatCurrency(amount, currency) {
  if (currency === 'USD' || currency === 'USDT') return `$${Number(amount).toFixed(2)}`
  return `${Number(amount).toLocaleString()} Br`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [userEmail, setUserEmail] = useState('')
  const [userFullName, setUserFullName] = useState('Investor')
  const [usdBalance, setUsdBalance] = useState(0)
  const [etbBalance, setEtbBalance] = useState(0)
  const [myInvestments, setMyInvestments] = useState([])
  const [approvedDeposits, setApprovedDeposits] = useState([])
  const [claimedBonuses, setClaimedBonuses] = useState([])
  const [lastClaimTs, setLastClaimTs] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    const users = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    const email = Object.keys(users)[0] || localStorage.getItem('current_user_email') || 'user@example.com'
    setUserEmail(email)
    if (users[email]) {
      setUserFullName(users[email].fullName || email)
      setUsdBalance(Number(users[email].usdBalance || 0))
      setEtbBalance(Number(users[email].etbBalance || 0))
    }

    const inv = JSON.parse(localStorage.getItem('user_investments') || '[]')
    setMyInvestments(inv)

    const approved = JSON.parse(localStorage.getItem('admin_approved_deposits') || '[]')
    setApprovedDeposits(approved)

    const claimed = JSON.parse(localStorage.getItem('claimed_bonuses') || '[]')
    setClaimedBonuses(claimed)

    const ts = parseInt(localStorage.getItem(`lastClaimTimestamp_${email}`) || '0')
    setLastClaimTs(ts || null)
  }, [])

  useEffect(() => {
    const users = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    const email = userEmail || Object.keys(users)[0]
    if (email && users[email]) {
      setUsdBalance(Number(users[email].usdBalance || 0))
      setEtbBalance(Number(users[email].etbBalance || 0))
    }
  }, [userEmail])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function calculateDailyRewards() {
    const inv = JSON.parse(localStorage.getItem('user_investments') || '[]')
    const usd = inv.filter(i => i.currency === 'USD').reduce((s, it) => s + (it.dailyProfit || 0), 0)
    const etb = inv.filter(i => i.currency === 'ETB').reduce((s, it) => s + (it.dailyProfit || 0), 0)
    return { usd, etb }
  }

  function handleClaimDailyProfit() {
    const { usd, etb } = calculateDailyRewards()
    if (usd === 0 && etb === 0) {
      showToast('No daily profit available to claim.')
      return
    }

    const now = Date.now()
    const last = parseInt(localStorage.getItem(`lastClaimTimestamp_${userEmail}`) || '0')
    if (last && (now - last) < CLAIM_COOLDOWN_MS) {
      const remaining = Math.ceil((CLAIM_COOLDOWN_MS - (now - last)) / 3600000)
      showToast(`Claim available in ${remaining} hour(s)`)
      return
    }

    // Update balances
    const users = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    if (!users[userEmail]) users[userEmail] = { email: userEmail, usdBalance: 0, etbBalance: 0 }

    users[userEmail].usdBalance = Number((Number(users[userEmail].usdBalance || 0) + usd).toFixed(2))
    users[userEmail].etbBalance = Number((Number(users[userEmail].etbBalance || 0) + etb).toFixed(0))
    localStorage.setItem('admin_user_data', JSON.stringify(users))

    setUsdBalance(users[userEmail].usdBalance)
    setEtbBalance(users[userEmail].etbBalance)

    localStorage.setItem(`lastClaimTimestamp_${userEmail}`, String(now))
    setLastClaimTs(now)

    showToast('Daily profit claimed and added to your account.')
  }

  function claimRemainingHours() {
    const last = parseInt(localStorage.getItem(`lastClaimTimestamp_${userEmail}`) || '0')
    if (!last) return 0
    const now = Date.now()
    const remainingMs = Math.max(0, CLAIM_COOLDOWN_MS - (now - last))
    return Math.ceil(remainingMs / 3600000)
  }

  function handleClaimDepositBonus(depositId) {
    const deposits = JSON.parse(localStorage.getItem('admin_approved_deposits') || '[]')
    const deposit = deposits.find(d => d.id === depositId)
    if (!deposit) {
      showToast('Deposit not found.')
      return
    }

    if (claimedBonuses.includes(depositId)) {
      showToast('Bonus already claimed for this deposit.')
      return
    }

    const bonusAmount = deposit.bonus != null ? Number(deposit.bonus) : Number(deposit.amount || 0) * 0.1
    const users = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    if (!users[userEmail]) users[userEmail] = { email: userEmail, usdBalance: 0, etbBalance: 0 }

    const isEtb = deposit.currency === 'ETB'
    if (isEtb) {
      users[userEmail].etbBalance = Number((Number(users[userEmail].etbBalance || 0) + bonusAmount).toFixed(0))
      setEtbBalance(users[userEmail].etbBalance)
    } else {
      // Treat USDT/USD as USD wallet
      users[userEmail].usdBalance = Number((Number(users[userEmail].usdBalance || 0) + bonusAmount).toFixed(2))
      setUsdBalance(users[userEmail].usdBalance)
    }

    localStorage.setItem('admin_user_data', JSON.stringify(users))

    // Mark claimed
    const claimed = JSON.parse(localStorage.getItem('claimed_bonuses') || '[]')
    claimed.push(depositId)
    localStorage.setItem('claimed_bonuses', JSON.stringify(claimed))
    setClaimedBonuses(claimed)

    showToast(`Bonus of ${isEtb ? formatCurrency(bonusAmount, 'ETB') : formatCurrency(bonusAmount, 'USD')} claimed!`)
  }

  const { usd: usdDailyReward, etb: etbDailyReward } = calculateDailyRewards()

  const userPendingBonuses = approvedDeposits.filter(d => d.userEmail === userEmail && !claimedBonuses.includes(d.id))

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 pb-20">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] bg-white border border-slate-200 p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-slate-500">Welcome back</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">{userFullName}</h1>
              <p className="text-sm text-slate-600">{userEmail}</p>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <UserCircle size={36} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl p-5 bg-emerald-50 border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-700">USD Balance</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{formatCurrency(usdBalance, 'USD')}</p>
            </div>
            <div className="rounded-2xl p-5 bg-emerald-50 border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-700">ETB Balance</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{formatCurrency(etbBalance, 'ETB')}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-600">USD Daily Profit</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(usdDailyReward, 'USD')}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-600">ETB Daily Profit</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(etbDailyReward, 'ETB')}</p>
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={handleClaimDailyProfit}
                className="w-full rounded-2xl px-4 py-3 font-bold text-white"
                style={{ backgroundColor: '#84CC16' }}
              >
                {lastClaimTs && (Date.now() - lastClaimTs) < CLAIM_COOLDOWN_MS
                  ? `Available in ${claimRemainingHours()}h`
                  : '🎁 Claim Daily Profit'}
              </button>
            </div>
          </div>

          {userPendingBonuses.length > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-sm font-semibold text-emerald-700">🎉 Deposit Bonus Available</p>
              <div className="space-y-3 mt-4">
                {userPendingBonuses.map((d) => {
                  const bonusAmount = d.bonus != null ? Number(d.bonus) : Number(d.amount || 0) * 0.1
                  return (
                    <div key={d.id} className="rounded-2xl bg-white border border-emerald-200 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{d.paymentMethod}</p>
                        <p className="text-xs text-slate-600">Deposit: {formatCurrency(d.amount, d.currency)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleClaimDepositBonus(d.id)}
                          className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
                        >
                          {d.currency === 'ETB' ? `Claim Br${bonusAmount.toFixed(0)}` : `Claim $${bonusAmount.toFixed(2)}`}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-6 text-sm text-slate-600">&nbsp;</div>

          <div className="mt-6 flex gap-3">
            <button onClick={() => navigate('/deposit')} className="rounded-2xl px-4 py-3 bg-slate-100">Deposit</button>
            <button onClick={() => navigate('/invest')} className="rounded-2xl px-4 py-3 bg-slate-100">Invest</button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-4 right-4 z-50 rounded-lg px-5 py-4 text-sm font-bold shadow-xl bg-green-600 text-white">
          {toast}
        </div>
      )}
    </div>
  )

  function claimRemainingHours() {
    const last = parseInt(localStorage.getItem(`lastClaimTimestamp_${userEmail}`) || '0')
    if (!last) return 0
    const now = Date.now()
    const remainingMs = Math.max(0, CLAIM_COOLDOWN_MS - (now - last))
    return Math.ceil(remainingMs / 3600000)
  }
}
