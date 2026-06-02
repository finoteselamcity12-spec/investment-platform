import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LogOut, X, ClipboardList, ShieldCheck, UserCircle, Layers } from 'lucide-react'
import { getSession } from '../lib/authService'

const ADMIN_SESSION_KEY = 'admin_session'

const AUTHORIZED_ADMIN_EMAIL = 'workinehabche@gmail.com'

function formatCurrency(amount, currency) {
  const value = Number(amount || 0)
  if (currency === 'USD' || currency === 'USDT') return `$${value.toFixed(2)}`
  return `${value.toLocaleString()} Br`
}

function safeParse(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

function getCategory(method) {
  if (!method) return 'Other'
  if (method.includes('Merchant')) return 'Merchant'
  if (method.includes('Personal')) return 'Personal'
  if (method.includes('USDT')) return 'USDT'
  return 'Other'
}

function calculateReward(deposit) {
  const rate = deposit.rewardPercent || 0.05
  return Number((deposit.amount * rate).toFixed(2))
}

export default function AdminDashboard() {
  const [adminSession, setAdminSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingDeposits, setPendingDeposits] = useState([])
  const [approvedDeposits, setApprovedDeposits] = useState([])
  const [pendingWithdrawals, setPendingWithdrawals] = useState([])
  const [approvedWithdrawals, setApprovedWithdrawals] = useState([])
  const [users, setUsers] = useState([])
  const [registeredEmails, setRegisteredEmails] = useState([])
  const [selectedDeposit, setSelectedDeposit] = useState(null)
  const [toast, setToast] = useState({ message: '', type: 'success' })

  useEffect(() => {
    const session = safeParse(ADMIN_SESSION_KEY, null)
    setAdminSession(session)
    loadData()
    setIsLoading(false)

    const listener = (event) => {
      if (['admin_pending_deposits', 'admin_approved_deposits', 'admin_user_data', 'platform_registered_users'].includes(event.key)) {
        loadData()
      }
    }

    window.addEventListener('storage', listener)
    return () => window.removeEventListener('storage', listener)
  }, [])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    window.setTimeout(() => setToast({ message: '', type }), 3200)
  }

  function loadData() {
    const pending = safeParse('admin_pending_deposits', [])
    const approved = safeParse('admin_approved_deposits', [])
    const pendingW = safeParse('admin_pending_withdrawals', [])
    const approvedW = safeParse('admin_approved_withdrawals', [])
    const usersData = safeParse('admin_user_data', {})
    const registered = safeParse('platform_registered_users', [])

    setPendingDeposits(pending)
    setApprovedDeposits(approved)
    setPendingWithdrawals(pendingW)
    setApprovedWithdrawals(approvedW)
    setUsers(Object.values(usersData))
    setRegisteredEmails(Array.from(new Set([...registered, ...Object.keys(usersData)])))
  }

  function saveStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
  }

  function handleSignOut() {
    localStorage.removeItem(ADMIN_SESSION_KEY)
    sessionStorage.removeItem(ADMIN_SESSION_KEY)
    setAdminSession(null)
    showToast('Signed out successfully.', 'success')
  }

  function approveDeposit(depositId) {
    const deposit = pendingDeposits.find((item) => item.id === depositId)
    if (!deposit) return

    const userEmail = deposit.userEmail || deposit.userId || 'unknown@example.com'
    const rewardAmount = calculateReward(deposit)
    const approvedRecord = {
      ...deposit,
      status: 'Approved',
      approvedAt: new Date().toISOString(),
      rewardAmount,
    }

    const updatedPending = pendingDeposits.filter((item) => item.id !== depositId)
    const updatedApproved = [approvedRecord, ...approvedDeposits]
    saveStorage('admin_pending_deposits', updatedPending)
    saveStorage('admin_approved_deposits', updatedApproved)
    setPendingDeposits(updatedPending)
    setApprovedDeposits(updatedApproved)

    const usersData = safeParse('admin_user_data', {})
    const existing = usersData[userEmail] || {
      id: userEmail,
      email: userEmail,
      fullName: userEmail,
      usdBalance: 0,
      etbBalance: 0,
      totalDeposits: 0,
      totalRewards: 0,
      activeInvestments: 0,
    }

    const currencyField = deposit.currency === 'USDT' ? 'usdBalance' : 'etbBalance'
    const depositAmount = Number(deposit.amount || 0)
    const updatedUser = {
      ...existing,
      [currencyField]: Number(existing[currencyField] || 0) + depositAmount + rewardAmount,
      totalDeposits: Number(existing.totalDeposits || 0) + depositAmount,
      totalRewards: Number(existing.totalRewards || 0) + rewardAmount,
    }

    usersData[userEmail] = updatedUser
    saveStorage('admin_user_data', usersData)
    setUsers(Object.values(usersData))
    showToast(`Deposit approved. ${formatCurrency(rewardAmount, deposit.currency)} reward credited.`, 'success')
  }

  function rejectDeposit(depositId) {
    const deposit = pendingDeposits.find((item) => item.id === depositId)
    if (!deposit) return

    const updatedPending = pendingDeposits.filter((item) => item.id !== depositId)
    const updatedRejected = [{ ...deposit, status: 'Rejected', rejectedAt: new Date().toISOString() }, ...safeParse('admin_rejected_deposits', [])]
    saveStorage('admin_pending_deposits', updatedPending)
    saveStorage('admin_rejected_deposits', updatedRejected)
    setPendingDeposits(updatedPending)
    showToast('Deposit rejected and archived.', 'info')
  }

  function approveWithdrawal(withdrawalId) {
    const withdrawal = pendingWithdrawals.find((item) => item.id === withdrawalId)
    if (!withdrawal) return

    const updatedPending = pendingWithdrawals.filter((item) => item.id !== withdrawalId)
    const updatedApproved = [{ ...withdrawal, status: 'Approved', approvedAt: new Date().toISOString() }, ...approvedWithdrawals]
    saveStorage('admin_pending_withdrawals', updatedPending)
    saveStorage('admin_approved_withdrawals', updatedApproved)
    setPendingWithdrawals(updatedPending)
    setApprovedWithdrawals(updatedApproved)
    showToast('Withdrawal approved.', 'success')
  }

  function rejectWithdrawal(withdrawalId) {
    const withdrawal = pendingWithdrawals.find((item) => item.id === withdrawalId)
    if (!withdrawal) return

    const updatedPending = pendingWithdrawals.filter((item) => item.id !== withdrawalId)
    const updatedRejected = [{ ...withdrawal, status: 'Rejected', rejectedAt: new Date().toISOString() }, ...safeParse('admin_rejected_withdrawals', [])]
    saveStorage('admin_pending_withdrawals', updatedPending)
    saveStorage('admin_rejected_withdrawals', updatedRejected)
    setPendingWithdrawals(updatedPending)
    showToast('Withdrawal rejected.', 'info')
  }

  const currentUserSession = getSession()
  const authorizedByEmail = currentUserSession?.user?.email?.toLowerCase() === AUTHORIZED_ADMIN_EMAIL

  const stats = useMemo(() => {
    const totalDeposits = approvedDeposits.reduce((sum, deposit) => sum + Number(deposit.amount || 0), 0)
    const totalWithdrawals = approvedWithdrawals.reduce((sum, withdrawal) => sum + Number(withdrawal.amount || 0), 0)
    const totalActiveInvestments = users.reduce((sum, user) => sum + Number(user.activeInvestments || 0), 0)
    const totalUserWallets = users.reduce((sum, user) => sum + Number(user.usdBalance || 0) + Number(user.etbBalance || 0), 0)

    return {
      totalUsers: registeredEmails.length,
      totalDeposits,
      totalWithdrawals,
      totalActiveInvestments,
      totalUserWallets,
      pendingApprovals: pendingDeposits.length + pendingWithdrawals.length,
    }
  }, [approvedDeposits, approvedWithdrawals, users, registeredEmails.length, pendingDeposits.length, pendingWithdrawals.length])

  const depositSegments = useMemo(() => {
    const categories = ['Merchant', 'Personal', 'USDT']
    return categories.reduce((acc, category) => {
      const byMethod = pendingDeposits.filter((deposit) => getCategory(deposit.paymentMethod) === category)
      const byApproved = approvedDeposits.filter((deposit) => getCategory(deposit.paymentMethod) === category)
      return {
        ...acc,
        [category]: {
          pending: byMethod.length,
          approved: byApproved.length,
          amount: byApproved.reduce((sum, deposit) => sum + Number(deposit.amount || 0), 0),
        },
      }
    }, {})
  }, [pendingDeposits, approvedDeposits])

  const withdrawalSummary = useMemo(() => ({
    pending: pendingWithdrawals.length,
    approved: approvedWithdrawals.length,
  }), [pendingWithdrawals.length, approvedWithdrawals.length])

  if (isLoading) {
    return null
  }

  if (!adminSession && !authorizedByEmail) {
    return <Navigate to="/admin-login" replace />
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[2rem] bg-white p-6 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Admin Dashboard</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight">Operations Center</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">Approve deposits, monitor live wallet balances, and review registered investors.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-4">
          <div className="rounded-[2rem] bg-white p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-600 font-semibold">Total Users</p>
            <p className="mt-4 text-4xl font-bold">{stats.totalUsers}</p>
            <p className="mt-2 text-sm text-slate-500">Registered investor emails</p>
          </div>
          <div className="rounded-[2rem] bg-white p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-600 font-semibold">Total Deposits</p>
            <p className="mt-4 text-4xl font-bold">${stats.totalDeposits.toFixed(2)}</p>
            <p className="mt-2 text-sm text-slate-500">Approved deposit volume</p>
          </div>
          <div className="rounded-[2rem] bg-white p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-600 font-semibold">Total Withdrawals</p>
            <p className="mt-4 text-4xl font-bold">${stats.totalWithdrawals.toFixed(2)}</p>
            <p className="mt-2 text-sm text-slate-500">Approved payout volume</p>
          </div>
          <div className="rounded-[2rem] bg-white p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-600 font-semibold">Pending Approvals</p>
            <p className="mt-4 text-4xl font-bold">{stats.pendingApprovals}</p>
            <p className="mt-2 text-sm text-slate-500">Awaiting review</p>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[2rem] bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-600 font-semibold">Deposit Segments</p>
                <h2 className="mt-2 text-2xl font-bold">Merchant / Personal / USDT</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Live update</div>
            </div>
            <div className="space-y-4">
              {Object.entries(depositSegments).map(([segment, data]) => (
                <div key={segment} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{segment}</p>
                      <p className="mt-1 text-sm text-slate-500">Approved volume ${data.amount.toFixed(2)}</p>
                    </div>
                    <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">Approved {data.approved}</div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                      Pending: <span className="font-bold text-slate-950">{data.pending}</span>
                    </div>
                    <div className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                      Approved: <span className="font-bold text-slate-950">{data.approved}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-600 font-semibold">Wallet Health</p>
                <h2 className="mt-2 text-2xl font-bold">User Balances</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Total ${stats.totalUserWallets.toFixed(2)}</div>
            </div>
            <div className="space-y-3">
              {users.slice(0, 6).map((user) => (
                <div key={user.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{user.fullName || user.email}</p>
                      <p className="text-xs text-slate-500 mt-1 break-all">{user.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-600">USD: <span className="font-semibold text-slate-950">${Number(user.usdBalance || 0).toFixed(2)}</span></p>
                      <p className="text-sm text-slate-600">ETB: <span className="font-semibold text-slate-950">{Number(user.etbBalance || 0).toFixed(2)} Br</span></p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Registered email preview</p>
              <div className="mt-3 max-h-40 overflow-y-auto rounded-3xl bg-white p-4 text-xs text-slate-600 shadow-inner">
                {registeredEmails.length === 0 ? (
                  <p>No registered emails found.</p>
                ) : (
                  <ul className="space-y-2">
                    {registeredEmails.slice(0, 12).map((email) => (
                      <li key={email} className="truncate">{email}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-[2rem] bg-white p-6 shadow-lg">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-600 font-semibold">Pending deposits</p>
                <h2 className="mt-2 text-2xl font-bold">Approval queue</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">{pendingDeposits.length} pending</div>
            </div>
            {pendingDeposits.length === 0 ? (
              <p className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">No deposit approvals pending right now.</p>
            ) : (
              <div className="space-y-4">
                {pendingDeposits.map((deposit) => (
                  <div key={deposit.id} className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                      <div>
                        <p className="text-base font-semibold text-slate-950">{deposit.userEmail || deposit.userId}</p>
                        <p className="mt-2 text-sm text-slate-600">{deposit.paymentMethod} • {formatCurrency(deposit.amount, deposit.currency)}</p>
                        <p className="mt-2 text-sm text-slate-500">{new Date(deposit.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="space-y-3 text-right">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reward</p>
                        <p className="text-lg font-semibold text-emerald-700">{formatCurrency(calculateReward(deposit), deposit.currency)}</p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => approveDeposit(deposit.id)}
                        className="rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      >
                        Approve deposit
                      </button>
                      <button
                        onClick={() => setSelectedDeposit(deposit)}
                        className="rounded-3xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                      >
                        View receipt
                      </button>
                      <button
                        onClick={() => rejectDeposit(deposit.id)}
                        className="rounded-3xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] bg-white p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-emerald-600 font-semibold">Wallet updates</p>
                  <h2 className="mt-2 text-2xl font-bold">Approved transactions</h2>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">Total approved deposits</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">${approvedDeposits.reduce((sum, deposit) => sum + Number(deposit.amount || 0), 0).toFixed(2)}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">Total approved withdrawals</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">${approvedWithdrawals.reduce((sum, withdrawal) => sum + Number(withdrawal.amount || 0), 0).toFixed(2)}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">Reward payouts</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-700">${approvedDeposits.reduce((sum, deposit) => sum + Number(deposit.rewardAmount || calculateReward(deposit)), 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] bg-white p-6 shadow-lg">
              <div className="mb-4 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-slate-950">Platform Security</h3>
              </div>
              <p className="text-sm text-slate-600">JWT authentication is enforced for all sessions. All approval actions are recorded locally and ready for backend integration with SSL and secure token validation.</p>
            </div>
          </div>
        </section>

        {selectedDeposit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-600">Receipt review</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">Deposit receipt</h2>
                </div>
                <button
                  onClick={() => setSelectedDeposit(null)}
                  className="rounded-full bg-slate-100 p-3 text-slate-700 transition hover:bg-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-6 lg:grid-cols-[0.65fr_0.35fr] px-6 py-6">
                <div className="rounded-[1.75rem] bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-900">User</p>
                  <p className="mt-2 text-base text-slate-700">{selectedDeposit.userEmail || selectedDeposit.userId}</p>
                  <p className="mt-4 text-sm font-semibold text-slate-900">Amount</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{formatCurrency(selectedDeposit.amount, selectedDeposit.currency)}</p>
                  <p className="mt-4 text-sm font-semibold text-slate-900">Transaction</p>
                  <p className="mt-1 text-sm text-slate-700 font-mono break-all">{selectedDeposit.transactionId}</p>
                  <p className="mt-4 text-sm font-semibold text-slate-900">Payment method</p>
                  <p className="mt-1 text-sm text-slate-700">{selectedDeposit.paymentMethod}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => approveDeposit(selectedDeposit.id)}
                      className="rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Approve deposit
                    </button>
                    <button
                      onClick={() => rejectDeposit(selectedDeposit.id)}
                      className="rounded-3xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Reject deposit
                    </button>
                  </div>
                </div>
                <div className="rounded-[1.75rem] bg-slate-900 p-5 text-white">
                  {selectedDeposit.screenshot ? (
                    <a href={selectedDeposit.screenshot} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[1.5rem] border border-white/10">
                      <img src={selectedDeposit.screenshot} alt="Receipt" className="h-[420px] w-full object-cover" />
                    </a>
                  ) : (
                    <p className="text-sm text-slate-300">No receipt image available for this deposit.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast.message && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-3xl border border-slate-200 bg-white px-5 py-3 shadow-xl ${toast.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
