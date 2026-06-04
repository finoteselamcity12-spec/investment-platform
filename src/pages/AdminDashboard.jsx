import { useEffect, useMemo, useState } from 'react'
import { LogOut, ShieldCheck, Hash, Database, X } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { getSession } from '../lib/authService'
import { REFERRAL_BONUS_ETB, REFERRAL_BONUS_USD } from '../lib/platformConfig'
import { recordDepositForReferral, findProfileIdByEmail } from '../lib/supabaseData'
import { loadReferralStats, updateReferralStats } from '../lib/referralUtils'

const ADMIN_CREDENTIALS = {
  name: 'Admin',
  password: '1q2w3e4@',
  id: '15610010',
}
const ADMIN_EMAIL = 'workinehabche@gmail.com'

function formatCurrency(amount, currency) {
  if (currency === 'USD' || currency === 'USDT') return `$${Number(amount).toFixed(2)}`
  return `${Number(amount).toLocaleString()} Birr`
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item?.[key] || 'Unknown'
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})
}

export default function AdminDashboard() {
  const [adminSession, setAdminSession] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [loginName, setLoginName] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginId, setLoginId] = useState('')
  const [loginError, setLoginError] = useState('')
  const [pendingDeposits, setPendingDeposits] = useState([])
  const [approvedDeposits, setApprovedDeposits] = useState([])
  const [rejectedDeposits, setRejectedDeposits] = useState([])
  const [pendingWithdrawals, setPendingWithdrawals] = useState([])
  const [approvedWithdrawals, setApprovedWithdrawals] = useState([])
  const [rejectedWithdrawals, setRejectedWithdrawals] = useState([])
  const [users, setUsers] = useState([])
  const [registrationCount, setRegistrationCount] = useState(0)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')
  const [selectedDepositReceipt, setSelectedDepositReceipt] = useState(null)

  useEffect(() => {
    const storedAdminSession = JSON.parse(sessionStorage.getItem('admin_session') || 'null')
    const mainSession = getSession()
    const isAdmin = storedAdminSession?.email === ADMIN_EMAIL || mainSession?.user?.email === ADMIN_EMAIL

    if (isAdmin) {
      setIsAuthorized(true)
      setAdminSession(
        storedAdminSession || {
          name: 'Admin',
          id: ADMIN_CREDENTIALS.id,
          email: ADMIN_EMAIL,
          loginTime: new Date().toISOString(),
        }
      )
      loadAdminData()
    } else {
      setIsAuthorized(false)
    }

    setAuthChecked(true)
  }, [])

  if (!authChecked) {
    return null
  }

  if (!isAuthorized) {
    return <Navigate to="/dashboard" replace />
  }

  function showToast(message, type = 'success') {
    setToastType(type)
    setToastMessage(message)
    setTimeout(() => setToastMessage(''), 3200)
  }

  function loadAdminData() {
    const pending = JSON.parse(localStorage.getItem('admin_pending_deposits') || '[]')
    const approved = JSON.parse(localStorage.getItem('admin_approved_deposits') || '[]')
    const rejected = JSON.parse(localStorage.getItem('admin_rejected_deposits') || '[]')
    const pendingWithdraw = JSON.parse(localStorage.getItem('admin_pending_withdrawals') || '[]')
    const approvedWithdraw = JSON.parse(localStorage.getItem('admin_approved_withdrawals') || '[]')
    const rejectedWithdraw = JSON.parse(localStorage.getItem('admin_rejected_withdrawals') || '[]')
    const usersData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    const registeredUsers = JSON.parse(localStorage.getItem('platform_registered_users') || '[]')

    setPendingDeposits(pending)
    setApprovedDeposits(approved)
    setRejectedDeposits(rejected)
    setPendingWithdrawals(pendingWithdraw)
    setApprovedWithdrawals(approvedWithdraw)
    setRejectedWithdrawals(rejectedWithdraw)
    setUsers(Object.values(usersData))
    setRegistrationCount(registeredUsers.length)
  }

  function handleAdminLogin(event) {
    event.preventDefault()
    setLoginError('')

    if (
      loginName === ADMIN_CREDENTIALS.name &&
      loginPassword === ADMIN_CREDENTIALS.password &&
      loginId === ADMIN_CREDENTIALS.id
    ) {
      const session = {
        name: loginName,
        id: loginId,
        loginTime: new Date().toISOString(),
      }
      sessionStorage.setItem('admin_session', JSON.stringify(session))
      setAdminSession(session)
      setLoginName('')
      setLoginPassword('')
      setLoginId('')
      showToast('Admin login successful.', 'success')
      loadAdminData()
      return
    }

    setLoginError('Invalid admin credentials. Please check name, password, and ID.')
  }

  function handleSignOut() {
    sessionStorage.removeItem('admin_session')
    setAdminSession(null)
    showToast('Admin signed out.', 'success')
  }

  function saveStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
  }

  async function handleApproveDeposit(depositId) {
    const deposit = pendingDeposits.find((item) => item.id === depositId)
    if (!deposit) return

    const updatedPending = pendingDeposits.filter((item) => item.id !== depositId)
    const updatedApproved = [...approvedDeposits, { ...deposit, status: 'Approved', approvedAt: new Date().toISOString() }]

    saveStorage('admin_pending_deposits', updatedPending)
    saveStorage('admin_approved_deposits', updatedApproved)
    setPendingDeposits(updatedPending)
    setApprovedDeposits(updatedApproved)

    const usersData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    const userId = deposit.userId
    const existing = usersData[userId] || {
      id: userId,
      email: deposit.userEmail,
      fullName: deposit.userEmail,
      usdBalance: 0,
      etbBalance: 0,
      bonusEligible: false,
    }

    const updatedUser = {
      ...existing,
      usdBalance: deposit.currency === 'USDT' ? (existing.usdBalance || 0) + deposit.amount : existing.usdBalance || 0,
      etbBalance: deposit.currency === 'ETB' ? (existing.etbBalance || 0) + deposit.amount : existing.etbBalance || 0,
    }

    usersData[userId] = updatedUser
    saveStorage('admin_user_data', usersData)
    setUsers(Object.values(usersData))
    showToast('Deposit approved and user wallet updated.', 'success')

    // Referral bonus on invitee's first approved deposit only
    try {
      const REFERRAL_USD = REFERRAL_BONUS_USD
      const REFERRAL_ETB = REFERRAL_BONUS_ETB
      const registered = JSON.parse(localStorage.getItem('platform_registered_users_data') || '{}')
      const depositorEmail = deposit.userEmail || userId
      const depositorRecord =
        registered[depositorEmail] ||
        Object.values(registered).find((u) => u.userId === userId || u.email === depositorEmail)
      const referrerKey = depositorRecord?.referredBy

      const priorApprovedCount = approvedDeposits.filter(
        (d) => d.userEmail === depositorEmail || d.userId === userId
      ).length
      const isFirstDeposit = priorApprovedCount === 0 && !depositorRecord?.referralRewardPaid

      if (referrerKey && isFirstDeposit) {
        const referrerRecord =
          usersData[referrerKey] ||
          usersData[registered[referrerKey]?.email] ||
          Object.values(usersData).find(
            (u) => u.id === referrerKey || u.email === referrerKey
          )

        if (referrerRecord) {
          const referrerStorageKey = referrerRecord.email || referrerKey
          const isUsdDeposit = deposit.currency === 'USDT' || deposit.currency === 'USD'
          const referrerId = referrerRecord.id || referrerKey

          if (isUsdDeposit) {
            referrerRecord.usdBalance = Number((referrerRecord.usdBalance || 0) + REFERRAL_USD)
          } else {
            referrerRecord.etbBalance = Number((referrerRecord.etbBalance || 0) + REFERRAL_ETB)
          }

          const currentStats = loadReferralStats(referrerId)
          updateReferralStats(referrerId, {
            earningsUsd: isUsdDeposit
              ? (currentStats.earningsUsd || 0) + REFERRAL_USD
              : currentStats.earningsUsd || 0,
            earningsEtb: !isUsdDeposit
              ? (currentStats.earningsEtb || 0) + REFERRAL_ETB
              : currentStats.earningsEtb || 0,
            referralCount: (currentStats.referralCount || 0) + 1,
          })

          usersData[referrerStorageKey] = referrerRecord
          saveStorage('admin_user_data', usersData)
          setUsers(Object.values(usersData))
          showToast('Referrer rewarded for first deposit.', 'success')
        }

        if (depositorRecord) {
          depositorRecord.referralRewardPaid = true
          registered[depositorEmail] = depositorRecord
          localStorage.setItem('platform_registered_users_data', JSON.stringify(registered))
        }

        const depositorProfileId =
          (await findProfileIdByEmail(depositorEmail)) ||
          depositorRecord?.userId
        if (depositorProfileId && /^[0-9a-f-]{36}$/i.test(depositorProfileId)) {
          await recordDepositForReferral({
            userId: depositorProfileId,
            currency: deposit.currency,
            amount: deposit.amount,
          })
        }
      }
    } catch (err) {
      console.error('Error rewarding referrer:', err)
    }
  }

  function handleRejectDeposit(depositId) {
    const deposit = pendingDeposits.find((item) => item.id === depositId)
    if (!deposit) return

    const updatedPending = pendingDeposits.filter((item) => item.id !== depositId)
    const updatedRejected = [...rejectedDeposits, { ...deposit, status: 'Rejected', rejectedAt: new Date().toISOString() }]

    saveStorage('admin_pending_deposits', updatedPending)
    saveStorage('admin_rejected_deposits', updatedRejected)
    setPendingDeposits(updatedPending)
    setRejectedDeposits(updatedRejected)

    showToast('Deposit rejected and removed from pending list.', 'info')
  }

  function handleApproveWithdrawal(withdrawalId) {
    const withdrawal = pendingWithdrawals.find((item) => item.id === withdrawalId)
    if (!withdrawal) return

    const updatedPending = pendingWithdrawals.filter((item) => item.id !== withdrawalId)
    const updatedApproved = [...approvedWithdrawals, { ...withdrawal, status: 'Approved', approvedAt: new Date().toISOString() }]

    saveStorage('admin_pending_withdrawals', updatedPending)
    saveStorage('admin_approved_withdrawals', updatedApproved)
    setPendingWithdrawals(updatedPending)
    setApprovedWithdrawals(updatedApproved)

    showToast('Withdrawal approved.', 'success')
  }

  function handleRejectWithdrawal(withdrawalId) {
    const withdrawal = pendingWithdrawals.find((item) => item.id === withdrawalId)
    if (!withdrawal) return

    const updatedPending = pendingWithdrawals.filter((item) => item.id !== withdrawalId)
    const updatedRejected = [...rejectedWithdrawals, { ...withdrawal, status: 'Rejected', rejectedAt: new Date().toISOString() }]

    saveStorage('admin_pending_withdrawals', updatedPending)
    saveStorage('admin_rejected_withdrawals', updatedRejected)
    setPendingWithdrawals(updatedPending)
    setRejectedWithdrawals(updatedRejected)

    showToast('Withdrawal rejected and removed from pending list.', 'info')
  }

  function deleteUser(userId) {
    const remainingUsers = users.filter((user) => user.id !== userId)
    const usersData = Object.fromEntries(remainingUsers.map((user) => [user.id, user]))
    saveStorage('admin_user_data', usersData)
    setUsers(remainingUsers)

    const updatedPendingDeposits = pendingDeposits.filter((deposit) => deposit.userId !== userId)
    saveStorage('admin_pending_deposits', updatedPendingDeposits)
    setPendingDeposits(updatedPendingDeposits)

    showToast('User deleted successfully.', 'success')
  }

  const depositBreakdown = useMemo(
    () => ({
      pending: groupBy(pendingDeposits, 'paymentMethod'),
      approved: groupBy(approvedDeposits, 'paymentMethod'),
      rejected: groupBy(rejectedDeposits, 'paymentMethod'),
    }),
    [pendingDeposits, approvedDeposits, rejectedDeposits]
  )

  const withdrawalBreakdown = useMemo(
    () => ({
      pending: groupBy(pendingWithdrawals, 'bank'),
      approved: groupBy(approvedWithdrawals, 'bank'),
      rejected: groupBy(rejectedWithdrawals, 'bank'),
    }),
    [pendingWithdrawals, approvedWithdrawals, rejectedWithdrawals]
  )

  if (!adminSession) {
    const mainSession = getSession()
    if (mainSession?.user?.email && mainSession.user.email !== ADMIN_EMAIL) {
      return <Navigate to="/dashboard" replace />
    }

    return (
      <div className="min-h-screen bg-slate-50 text-slate-950 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-[2rem] bg-white border border-slate-200 p-8 shadow-xl">
          <div className="mb-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Admin Access</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">Secure Operator Login</h1>
          </div>

          <form className="space-y-5" onSubmit={handleAdminLogin}>
            <div>
              <label className="block text-sm font-semibold text-slate-900">Admin Name</label>
              <input
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="Admin"
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-950 focus:border-[#84CC16] focus:outline-none focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900">Admin ID</label>
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="15610010"
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-950 focus:border-[#84CC16] focus:outline-none focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="1q2w3e4@"
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-950 focus:border-[#84CC16] focus:outline-none focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>

            {loginError && <div className="rounded-3xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{loginError}</div>}

            <button
              type="submit"
              className="w-full rounded-3xl bg-[#84CC16] px-4 py-3 text-white font-bold shadow-lg shadow-[#84CC16]/20 transition hover:bg-lime-500"
            >
              Login as Admin
            </button>
          </form>

        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-[2rem] bg-slate-900/90 border border-slate-700/70 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:flex sm:items-center sm:justify-between">
          <div className="space-y-4">
            <div>
              <h1
                className="text-4xl sm:text-5xl font-black text-[#84CC16] tracking-tight"
                style={{ textShadow: '2px 2px 0 rgba(16, 185, 129, 0.32), 0 14px 35px rgba(0, 0, 0, 0.35)' }}
              >
                Welcome to Blackrock
              </h1>
              <p className="mt-3 text-sm uppercase tracking-[0.18em] text-[#84CC16]">Admin Console</p>
            </div>
            <p className="max-w-2xl text-sm text-slate-300">Manage registrations, approvals, and wallet movements in a secure, enterprise-grade admin portal.</p>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-2xl shadow-emerald-500/40 transition hover:bg-emerald-400 sm:mt-0"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-[2rem] bg-white/5 border border-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-300">
                <Database size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Total Registrations</p>
                <p className="mt-3 text-3xl font-bold text-white">{registrationCount}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-400">Active users currently tracked in the system.</p>
          </div>

          <div className="rounded-[2rem] bg-white/5 border border-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-300">
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Pending Deposits</p>
                <p className="mt-3 text-3xl font-bold text-white">{pendingDeposits.length}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-400">Awaiting approval before wallet credit is applied.</p>
          </div>

          <div className="rounded-[2rem] bg-white/5 border border-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-300">
                <Hash size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Withdrawal Requests</p>
                <p className="mt-3 text-3xl font-bold text-white">{pendingWithdrawals.length}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-400">Requests waiting for payout review and clearance.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[2rem] bg-slate-900/80 border border-white/10 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-emerald-300">Deposit Breakdown</p>
                <h2 className="mt-2 text-2xl font-bold text-white">By Payment Method</h2>
              </div>
            </div>
            <div className="space-y-4">
              {['pending', 'approved', 'rejected'].map((status) => (
                <div key={status} className="rounded-3xl bg-slate-950/70 border border-slate-800 p-4">
                  <p className="text-sm font-semibold text-slate-300">{status.charAt(0).toUpperCase() + status.slice(1)}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {Object.entries(depositBreakdown[status]).map(([method, count]) => (
                      <div key={`${status}-${method}`} className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3">
                        <p className="text-sm text-slate-400">{method}</p>
                        <p className="mt-2 text-xl font-bold text-white">{count}</p>
                      </div>
                    ))}
                    {Object.keys(depositBreakdown[status]).length === 0 && (
                      <p className="text-sm text-slate-400">No {status} deposits.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] bg-slate-900/80 border border-white/10 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-emerald-300">Withdrawal Breakdown</p>
                <h2 className="mt-2 text-2xl font-bold text-white">By Bank / Method</h2>
              </div>
            </div>
            <div className="space-y-4">
              {['pending', 'approved', 'rejected'].map((status) => (
                <div key={status} className="rounded-3xl bg-slate-950/70 border border-slate-800 p-4">
                  <p className="text-sm font-semibold text-slate-300">{status.charAt(0).toUpperCase() + status.slice(1)}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {Object.entries(withdrawalBreakdown[status]).map(([bank, count]) => (
                      <div key={`${status}-${bank}`} className="rounded-2xl bg-slate-900/80 border border-slate-700 p-3">
                        <p className="text-sm text-slate-400">{bank}</p>
                        <p className="mt-2 text-xl font-bold text-white">{count}</p>
                      </div>
                    ))}
                    {Object.keys(withdrawalBreakdown[status]).length === 0 && (
                      <p className="text-sm text-slate-400">No {status} withdrawals.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] bg-white border border-slate-200 p-6 shadow-lg">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Pending Activity</h2>
              <p className="mt-2 text-sm text-slate-500">Review pending deposits and withdrawals before approval.</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-6">
              <div className="rounded-[2rem] bg-slate-50 border border-slate-200 p-5">
                <h3 className="text-base font-semibold text-slate-950 mb-4">Pending Deposits</h3>
                {pendingDeposits.length === 0 ? (
                  <p className="text-sm text-slate-500">No pending deposits at the moment.</p>
                ) : (
                  <div className="space-y-4">
                    {pendingDeposits.map((deposit) => (
                      <div key={deposit.id} className="rounded-3xl bg-white border border-slate-200 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{deposit.userEmail}</p>
                            <p className="text-sm text-slate-400">{deposit.paymentMethod}</p>
                            <p className="mt-2 text-xs text-slate-500">Transaction ID: {deposit.transactionId}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-white">{formatCurrency(deposit.amount, deposit.currency)}</p>
                            <p className="text-xs text-slate-400">{new Date(deposit.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                        {deposit.screenshot && (
                          <div className="mt-4 rounded-3xl border border-slate-700 bg-slate-950/80 p-3">
                            <div className="mb-3 flex items-center justify-between text-slate-400 text-sm">
                              <span>Receipt Preview</span>
                              <span>{deposit.screenshotName || 'Attachment'}</span>
                            </div>
                            <img src={deposit.screenshot} alt="Deposit receipt" className="w-full rounded-2xl border border-slate-700 object-cover" />
                          </div>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => handleApproveDeposit(deposit.id)}
                            className="rounded-3xl bg-[#84CC16] px-4 py-2 text-sm font-semibold text-white transition hover:bg-lime-500"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectDeposit(deposit.id)}
                            className="rounded-3xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setSelectedDepositReceipt(deposit)}
                            className="rounded-3xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900"
                          >
                            View Receipt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] bg-slate-50 border border-slate-200 p-5">
                <h3 className="text-base font-semibold text-slate-950 mb-4">Pending Withdrawals</h3>
                {pendingWithdrawals.length === 0 ? (
                  <p className="text-sm text-slate-500">No pending payouts.</p>
                ) : (
                  <div className="space-y-4">
                    {pendingWithdrawals.map((withdrawal) => (
                      <div key={withdrawal.id} className="rounded-3xl bg-white border border-slate-200 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{withdrawal.userName}</p>
                            <p className="text-sm text-slate-500">{withdrawal.bank}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-950">{formatCurrency(withdrawal.amount, withdrawal.currency)}</p>
                            <p className="text-xs text-slate-500">{new Date(withdrawal.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => handleApproveWithdrawal(withdrawal.id)}
                            className="rounded-3xl bg-[#84CC16] px-4 py-2 text-sm font-semibold text-white transition hover:bg-lime-500"
                          >
                            Approve Payout
                          </button>
                          <button
                            onClick={() => handleRejectWithdrawal(withdrawal.id)}
                            className="rounded-3xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] bg-slate-50 border border-slate-200 p-5">
              <h3 className="text-base font-semibold text-slate-950 mb-4">User Wallets</h3>
              {users.length === 0 ? (
                <p className="text-sm text-slate-500">No users stored yet.</p>
              ) : (
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.id} className="rounded-3xl bg-white border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{user.fullName || user.email}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-950">USD: ${Number(user.usdBalance || 0).toFixed(2)}</p>
                          <p className="text-sm text-slate-500">ETB: {(Number(user.etbBalance || 0)).toLocaleString()} Br</p>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="rounded-3xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                        >
                          Delete User
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-3xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold shadow-xl ${
          toastType === 'success' ? 'text-emerald-800' : 'text-red-700'
        }`}>
          {toastMessage}
        </div>
      )}

      {selectedDepositReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white border border-slate-200 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-950">Deposit Receipt</h3>
                <p className="mt-1 text-sm text-slate-500">Review the payment details before approving.</p>
              </div>
              <button
                onClick={() => setSelectedDepositReceipt(null)}
                className="rounded-full bg-slate-100 p-3 text-slate-700 transition hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 rounded-[1.75rem] bg-slate-50 border border-slate-200 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">User</p>
                  <p className="mt-2 text-base font-semibold text-slate-950">{selectedDepositReceipt.userEmail}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Amount</p>
                  <p className="mt-2 text-base font-semibold text-slate-950">{formatCurrency(selectedDepositReceipt.amount, selectedDepositReceipt.currency)}</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Method</p>
                  <p className="mt-2 text-base text-slate-950">{selectedDepositReceipt.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Transaction ID</p>
                  <p className="mt-2 font-mono text-sm text-slate-700">{selectedDepositReceipt.transactionId}</p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Receipt Details</p>
                <p className="mt-2 text-sm text-slate-700">{selectedDepositReceipt.screenshot || 'No receipt image available'}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setSelectedDepositReceipt(null)}
                className="rounded-3xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
