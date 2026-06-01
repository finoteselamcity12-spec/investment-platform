import { useEffect, useMemo, useState } from 'react'
import { Check, Eye, LogOut, X } from 'lucide-react'

const ADMIN_CREDENTIALS = {
  name: 'investment',
  password: '1q2w3e4r5t6y7@investment',
  id: '15610010',
}

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
    const session = sessionStorage.getItem('admin_session')
    if (session) {
      setAdminSession(JSON.parse(session))
    }
    loadAdminData()
  }, [])

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

  function handleApproveDeposit(depositId) {
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
    return (
      <div className="min-h-screen bg-slate-50 text-slate-950 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-[2rem] bg-white border border-slate-200 p-8 shadow-xl">
          <div className="mb-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Admin Access</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">Secure Admin Login</h1>
            <p className="mt-2 text-sm text-slate-500">Enter your official credentials to manage deposits and withdrawals.</p>
          </div>

          <form className="space-y-5" onSubmit={handleAdminLogin}>
            <div>
              <label className="block text-sm font-semibold text-slate-900">Admin Name</label>
              <input
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="Admin name"
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-950 focus:border-[#84CC16] focus:outline-none focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900">Admin ID</label>
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Admin ID"
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-950 focus:border-[#84CC16] focus:outline-none focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-950 focus:border-[#84CC16] focus:outline-none focus:ring-2 focus:ring-[#84CC16]/20"
              />
            </div>

            {loginError && <div className="rounded-3xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{loginError}</div>}

            <button
              type="submit"
              className="w-full rounded-3xl bg-[#84CC16] px-4 py-4 text-white font-bold text-lg shadow-lg shadow-[#84CC16]/20 transition hover:bg-lime-500 active:scale-95"
            >
              Login as Admin
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">Credentials: investment / 1q2w3e4r5t6y7@investment / 15610010</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-[2rem] bg-white border border-emerald-200 p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between"
             style={{
               background: `linear-gradient(135deg, #f0fdf4, white)`,
               borderColor: '#84CC16'
             }}>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#84CC16]">Admin Console</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Investment Platform Operations</h1>
            <p className="mt-2 text-slate-600">Monitor deposits, withdrawals, user activity, and support in one dashboard.</p>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-3xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 active:scale-95"
            style={{
              backgroundColor: '#84CC16'
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-[2rem] bg-white border border-emerald-200 p-6 shadow-lg"
               style={{
                 borderColor: '#84CC16'
               }}>
            <p className="text-sm font-semibold text-[#84CC16]">Pending Deposits</p>
            <p className="mt-4 text-4xl font-bold text-slate-950">{pendingDeposits.length}</p>
            <p className="mt-2 text-sm text-slate-600">Awaiting admin approval.</p>
          </div>
          <div className="rounded-[2rem] bg-white border border-emerald-200 p-6 shadow-lg"
               style={{
                 borderColor: '#84CC16'
               }}>
            <p className="text-sm font-semibold text-[#84CC16]">Approved Withdrawals</p>
            <p className="mt-4 text-4xl font-bold text-slate-950">{approvedWithdrawals.length}</p>
            <p className="mt-2 text-sm text-slate-600">Settled payouts.</p>
          </div>
          <div className="rounded-[2rem] bg-white border border-emerald-200 p-6 shadow-lg"
               style={{
                 borderColor: '#84CC16'
               }}>
            <p className="text-sm font-semibold text-[#84CC16]">Rejected Requests</p>
            <p className="mt-4 text-4xl font-bold text-slate-950">{rejectedDeposits.length + rejectedWithdrawals.length}</p>
            <p className="mt-2 text-sm text-slate-600">Failed or cancelled requests.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-lg">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-[#84CC16] font-semibold">Deposit Breakdown</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">By Payment Method</h2>
              </div>
            </div>
            <div className="space-y-4">
              {['pending', 'approved', 'rejected'].map((status) => (
                <div key={status} className="rounded-3xl bg-slate-50 border border-slate-200 p-4">
                  <p className="text-base font-semibold text-slate-900">{status.charAt(0).toUpperCase() + status.slice(1)}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {Object.entries(depositBreakdown[status]).map(([method, count]) => (
                      <div key={`${status}-${method}`} className="rounded-2xl bg-white border border-slate-200 p-3">
                        <p className="text-sm text-slate-600">{method}</p>
                        <p className="mt-2 text-xl font-bold text-slate-950">{count}</p>
                      </div>
                    ))}
                    {Object.keys(depositBreakdown[status]).length === 0 && (
                      <p className="text-sm text-slate-600">No {status} deposits.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] bg-white border border-slate-200 p-6 shadow-lg">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-[#84CC16] font-semibold">Withdrawal Breakdown</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">By Bank / Method</h2>
              </div>
            </div>
            <div className="space-y-4">
              {['pending', 'approved', 'rejected'].map((status) => (
                <div key={status} className="rounded-3xl bg-slate-50 border border-slate-200 p-4">
                  <p className="text-base font-semibold text-slate-900">{status.charAt(0).toUpperCase() + status.slice(1)}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {Object.entries(withdrawalBreakdown[status]).map(([bank, count]) => (
                      <div key={`${status}-${bank}`} className="rounded-2xl bg-white border border-slate-200 p-3">
                        <p className="text-sm text-slate-600">{bank}</p>
                        <p className="mt-2 text-xl font-bold text-slate-950">{count}</p>
                      </div>
                    ))}
                    {Object.keys(withdrawalBreakdown[status]).length === 0 && (
                      <p className="text-sm text-slate-600">No {status} withdrawals.</p>
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
              <p className="mt-2 text-sm text-slate-600">Review pending deposits and withdrawals before approval.</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-6">
              <div className="rounded-[2rem] bg-slate-50 border border-slate-200 p-5">
                <h3 className="text-lg font-semibold text-slate-950 mb-4">Pending Deposits</h3>
                {pendingDeposits.length === 0 ? (
                  <p className="text-sm text-slate-600">No pending deposits at the moment.</p>
                ) : (
                  <div className="space-y-4">
                    {pendingDeposits.map((deposit) => (
                      <div key={deposit.id} className="rounded-3xl bg-white border border-slate-200 p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-base font-semibold text-slate-950">{deposit.userEmail}</p>
                            <p className="text-sm text-slate-600 mt-1">{deposit.paymentMethod}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-slate-950">{formatCurrency(deposit.amount, deposit.currency)}</p>
                            <p className="text-xs text-slate-600">{new Date(deposit.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => handleApproveDeposit(deposit.id)}
                            className="rounded-3xl bg-[#84CC16] px-5 py-3 text-base font-semibold text-white transition hover:bg-lime-500 active:scale-95"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectDeposit(deposit.id)}
                            className="rounded-3xl bg-slate-900 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-700 active:scale-95"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setSelectedDepositReceipt(deposit)}
                            className="rounded-3xl border-2 border-slate-300 px-5 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-95"
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
                <h3 className="text-lg font-semibold text-slate-950 mb-4">Pending Withdrawals</h3>
                {pendingWithdrawals.length === 0 ? (
                  <p className="text-sm text-slate-600">No pending payouts.</p>
                ) : (
                  <div className="space-y-4">
                    {pendingWithdrawals.map((withdrawal) => (
                      <div key={withdrawal.id} className="rounded-3xl bg-white border border-slate-200 p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-base font-semibold text-slate-950">{withdrawal.userName}</p>
                            <p className="text-sm text-slate-600 mt-1">{withdrawal.bank}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-slate-950">{formatCurrency(withdrawal.amount, withdrawal.currency)}</p>
                            <p className="text-xs text-slate-600">{new Date(withdrawal.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => handleApproveWithdrawal(withdrawal.id)}
                            className="rounded-3xl bg-[#84CC16] px-5 py-3 text-base font-semibold text-white transition hover:bg-lime-500 active:scale-95"
                          >
                            Approve Payout
                          </button>
                          <button
                            onClick={() => handleRejectWithdrawal(withdrawal.id)}
                            className="rounded-3xl bg-slate-900 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-700 active:scale-95"
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
              <h3 className="text-lg font-semibold text-slate-950 mb-5">User Wallets</h3>
              {users.length === 0 ? (
                <p className="text-sm text-slate-600">No users stored yet.</p>
              ) : (
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.id} className="rounded-3xl bg-white border border-slate-200 p-5 hover:shadow-md transition">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-grow">
                          <p className="text-base font-semibold text-slate-950">{user.fullName || user.email}</p>
                          <p className="text-sm text-slate-600 mt-1">{user.email}</p>
                          <div className="mt-3 space-y-1">
                            <p className="text-sm font-semibold text-slate-900">USD: <span className="text-[#84CC16]">${Number(user.usdBalance || 0).toFixed(2)}</span></p>
                            <p className="text-sm font-semibold text-slate-900">ETB: <span className="text-[#84CC16]">{(Number(user.etbBalance || 0)).toFixed(2)} Br</span></p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="rounded-3xl bg-red-600 px-5 py-2 text-base font-semibold text-white transition hover:bg-red-700 active:scale-95"
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
