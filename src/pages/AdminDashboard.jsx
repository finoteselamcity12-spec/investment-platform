import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, LogOut, Eye, Download } from 'lucide-react'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [adminUser, setAdminUser] = useState(null)
  const [deposits, setDeposits] = useState([])
  const [withdrawalRequests, setWithdrawalRequests] = useState([])
  const [users, setUsers] = useState([])
  const [registrationCount, setRegistrationCount] = useState(0)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')
  const [selectedDepositReceipt, setSelectedDepositReceipt] = useState(null)

  useEffect(() => {
    // Check if admin is logged in
    const admin = sessionStorage.getItem('admin_session')
    if (!admin) {
      navigate('/dashboard')
      return
    }
    setAdminUser(JSON.parse(admin))

    // Load pending deposits and other data
    loadAdminData()
  }, [navigate])

  function loadAdminData() {
    try {
      // Load pending deposits from localStorage
      const depositsData = JSON.parse(localStorage.getItem('admin_pending_deposits') || '[]')
      setDeposits(depositsData)

      // Load withdrawal requests from localStorage
      const withdrawals = JSON.parse(localStorage.getItem('admin_pending_withdrawals') || '[]')
      setWithdrawalRequests(withdrawals)

      // Load admin user wallet data
      const usersData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
      setUsers(Object.values(usersData))

      // Load registration count
      const registeredUsers = JSON.parse(localStorage.getItem('platform_registered_users') || '[]')
      setRegistrationCount(registeredUsers.length)
    } catch (error) {
      console.error('Failed to load admin data:', error)
    }
  }

  function showToast(message, type = 'success') {
    setToastType(type)
    setToastMessage(message)
    setTimeout(() => setToastMessage(''), 3200)
  }

  function handleApproveDeposit(depositId) {
    try {
      const deposit = deposits.find((item) => item.id === depositId)
      if (!deposit) {
        console.error(`Deposit not found: ${depositId}`)
        return
      }

      const userId = deposit.userId
      const amount = deposit.amount
      const isBonusEligible = (deposit.currency === 'ETB' && amount >= 500) || (deposit.currency === 'USDT' && amount >= 15)

      const nextUsers = users.map((user) => {
        if (user.id !== userId) return user
        return {
          ...user,
          usdBalance: deposit.currency === 'USDT' ? (user.usdBalance || 0) + amount : (user.usdBalance || 0),
          etbBalance: deposit.currency === 'ETB' ? (user.etbBalance || 0) + amount : (user.etbBalance || 0),
          bonusEligible: isBonusEligible || user.bonusEligible || false,
        }
      })

      const userExists = nextUsers.some((user) => user.id === userId)
      const finalUsers = userExists
        ? nextUsers
        : [
            ...nextUsers,
            {
              id: userId,
              email: deposit.userEmail,
              fullName: deposit.fullName || deposit.userEmail,
              usdBalance: deposit.currency === 'USDT' ? amount : 0,
              etbBalance: deposit.currency === 'ETB' ? amount : 0,
              bonusEligible: isBonusEligible,
              bonusClaimed: false,
            },
          ]

      const usersObject = Object.fromEntries(finalUsers.map((user) => [user.id, user]))
      localStorage.setItem('admin_user_data', JSON.stringify(usersObject))
      setUsers(finalUsers)

      const approvedTransactions = JSON.parse(localStorage.getItem('admin_approved_transactions') || '[]')
      if (!approvedTransactions.some((tx) => tx.id === depositId)) {
        approvedTransactions.push({
          id: depositId,
          type: 'Approved Deposit',
          userId,
          userEmail: deposit.userEmail,
          transactionId: deposit.transactionId || null,
          amount,
          currency: deposit.currency,
          status: 'Approved',
          timestamp: new Date().toISOString(),
        })
        localStorage.setItem('admin_approved_transactions', JSON.stringify(approvedTransactions))
      }

      try {
        localStorage.removeItem(`user_pending_deposit_${userId}`)
      } catch (error) {
        console.error('Failed to remove pending deposit flag:', error)
      }

      const remainingDeposits = deposits.filter((item) => item.id !== depositId)
      setDeposits(remainingDeposits)
      localStorage.setItem('admin_pending_deposits', JSON.stringify(remainingDeposits))

      showToast(`Deposit approved! Bonus eligible: ${amount >= 500}`)
    } catch (error) {
      console.error('Failed to approve deposit:', error)
    }
  }

  function handleRejectDeposit(depositId) {
    try {
      const rejectedDeposit = deposits.find((item) => item.id === depositId)
      const remainingDeposits = deposits.filter((item) => item.id !== depositId)
      setDeposits(remainingDeposits)
      localStorage.setItem('admin_pending_deposits', JSON.stringify(remainingDeposits))

      const rejected = JSON.parse(localStorage.getItem('admin_rejected_transactions') || '[]')
      rejected.push({ id: depositId, timestamp: new Date().toISOString() })
      localStorage.setItem('admin_rejected_transactions', JSON.stringify(rejected))

      try {
        localStorage.removeItem(`user_pending_deposit_${rejectedDeposit?.userId}`)
      } catch (error) {
        console.error('Failed to remove pending deposit flag:', error)
      }

      showToast('Deposit rejected and removed.', 'info')
    } catch (error) {
      console.error('Failed to reject deposit:', error)
    }
  }

  function handleApprovePayout(withdrawalId, index) {
    try {
      const updated = withdrawalRequests.filter((_, i) => i !== index)
      setWithdrawalRequests(updated)
      localStorage.setItem('admin_pending_withdrawals', JSON.stringify(updated))
      showToast('Payout approved!')
    } catch (error) {
      console.error('Failed to approve payout:', error)
    }
  }

  function deleteUser(userId) {
    try {
      const remainingUsers = users.filter((user) => user.id !== userId)
      setUsers(remainingUsers)
      const usersObject = Object.fromEntries(remainingUsers.map((user) => [user.id, user]))
      localStorage.setItem('admin_user_data', JSON.stringify(usersObject))

      const remainingDeposits = deposits.filter((deposit) => deposit.userId !== userId)
      setDeposits(remainingDeposits)
      localStorage.setItem('admin_pending_deposits', JSON.stringify(remainingDeposits))

      const approvedTransactions = JSON.parse(localStorage.getItem('admin_approved_transactions') || '[]')
      const filteredApproved = approvedTransactions.filter((tx) => tx.userId !== userId)
      localStorage.setItem('admin_approved_transactions', JSON.stringify(filteredApproved))

      try {
        localStorage.removeItem(`user_pending_deposit_${userId}`)
      } catch (error) {
        console.error('Failed to remove user pending flag:', error)
      }

      showToast('User and related deposit history deleted successfully.', 'info')
    } catch (error) {
      console.error('Failed to delete user:', error)
    }
  }

  function handleSignOut() {
    sessionStorage.removeItem('admin_session')
    navigate('/dashboard')
  }

  function handleViewReceipt(deposit) {
    setSelectedDepositReceipt(deposit)
  }

  if (!adminUser) {
    return <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">Loading admin panel...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-950">Admin Control Panel</h1>
            <p className="text-sm text-zinc-600">ID: {adminUser.id}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-bold text-white transition hover:bg-red-700"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="card-surface">
            <p className="text-sm text-zinc-600">Total Registrations</p>
            <p className="mt-2 text-3xl font-bold text-zinc-950">{registrationCount}</p>
          </div>
          <div className="card-surface">
            <p className="text-sm text-zinc-600">Pending Deposits</p>
              <p className="mt-2 text-3xl font-bold text-amber-500">{deposits.length}</p>
            </div>
            <div className="card-surface">
              <p className="text-sm text-zinc-600">Pending Withdrawals</p>
              <p className="mt-2 text-3xl font-bold text-blue-500">{withdrawalRequests.length}</p>
            </div>
          </div>
          <div className="card-surface mb-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-950">User Management</h2>
                <p className="text-sm text-zinc-600">Delete users and clear their deposit history.</p>
              </div>
            </div>
            {users.length === 0 ? (
              <p className="mt-4 text-zinc-600">No registered users found.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="table-minimal responsive-table w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-zinc-600">Name</th>
                      <th className="px-4 py-3 text-left text-zinc-600">Email</th>
                      <th className="px-4 py-3 text-left text-zinc-600">USD Balance</th>
                      <th className="px-4 py-3 text-left text-zinc-600">ETB Balance</th>
                      <th className="px-4 py-3 text-center text-zinc-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-zinc-950" data-label="Name">{user.fullName || user.email}</td>
                        <td className="px-4 py-3 text-zinc-700" data-label="Email">{user.email}</td>
                        <td className="px-4 py-3 text-zinc-700" data-label="USD Balance">${(user.usdBalance || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-zinc-700" data-label="ETB Balance">{(user.etbBalance || 0).toLocaleString()} Birr</td>
                        <td className="px-4 py-3 text-center" data-label="Action">
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card-surface mb-8">
            <h2 className="mb-4 text-xl font-bold text-zinc-950">Pending Deposits</h2>
            {deposits.length === 0 ? (
              <p className="text-zinc-600">No pending deposits.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-minimal responsive-table w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-zinc-600">User</th>
                    <th className="px-4 py-3 text-left text-zinc-600">Amount</th>
                    <th className="px-4 py-3 text-left text-zinc-600">Gateway</th>
                    <th className="px-4 py-3 text-left text-zinc-600">Transaction ID</th>
                    <th className="px-4 py-3 text-left text-zinc-600">Receipt</th>
                    <th className="px-4 py-3 text-center text-zinc-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((deposit) => (
                    <tr key={deposit.id} className="border-b border-gray-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-zinc-950" data-label="User">{deposit.userEmail}</td>
                      <td className="px-4 py-3 text-zinc-950" data-label="Amount">
                        {deposit.currency === 'USDT' ? `$${deposit.amount.toFixed(2)} USDT` : `${deposit.amount} Birr`}
                      </td>
                      <td className="px-4 py-3" data-label="Gateway">
                        <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs text-zinc-700">
                          {deposit.gateway === 'merchant' ? 'Merchant' : deposit.gateway === 'personal' ? 'Personal' : 'USDT'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700 font-mono text-xs" data-label="Transaction ID">{deposit.transactionId}</td>
                      <td className="px-4 py-3 text-center" data-label="Receipt">
                        {deposit.receiptDataUrl ? (
                          <button
                            onClick={() => handleViewReceipt(deposit)}
                            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 p-0 hover:opacity-90"
                          >
                            <img src={deposit.receiptDataUrl} alt="receipt" className="w-12 h-12 rounded-lg object-cover border border-zinc-300" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleViewReceipt(deposit)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-500"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3" data-label="Actions">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleApproveDeposit(deposit.id)}
                            className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectDeposit(deposit.id)}
                            className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-red-700"
                          >
                            <X className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Withdrawals Table */}
        <div className="card-surface mb-8">
          <h2 className="mb-4 text-xl font-bold text-zinc-950">Pending Withdrawals</h2>
          {withdrawalRequests.length === 0 ? (
            <p className="text-zinc-600">No pending withdrawals.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-minimal responsive-table w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-zinc-600">User</th>
                    <th className="px-4 py-3 text-left text-zinc-600">Amount</th>
                    <th className="px-4 py-3 text-left text-zinc-600">Method</th>
                    <th className="px-4 py-3 text-left text-zinc-600">Account</th>
                    <th className="px-4 py-3 text-center text-zinc-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawalRequests.map((withdrawal, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-zinc-950" data-label="User">{withdrawal.userName}</td>
                      <td className="px-4 py-3 text-zinc-950" data-label="Amount">
                        {withdrawal.currency === 'USD' ? `$${withdrawal.amount.toFixed(2)}` : `${withdrawal.amount} Birr`}
                      </td>
                      <td className="px-4 py-3 text-zinc-700" data-label="Method">{withdrawal.method}</td>
                      <td className="px-4 py-3 text-zinc-700 font-mono text-xs" data-label="Account">{withdrawal.account}</td>
                      <td className="px-4 py-3 text-center" data-label="Action">
                        <button
                          onClick={() => handleApprovePayout(withdrawal.id, index)}
                          className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-green-700"
                        >
                          <Check className="h-4 w-4" />
                          Approve Payout
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Toast Message */}
      {toastMessage && (
        <div
          className={`fixed bottom-4 right-4 rounded-lg px-4 py-3 font-bold text-white shadow-lg ${
            toastType === 'success'
              ? 'bg-green-600'
              : toastType === 'error'
                ? 'bg-red-600'
                : 'bg-blue-600'
          }`}
        >
          {toastMessage}
        </div>
      )}

      {/* Receipt Modal */}
      {selectedDepositReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-slate-900 p-6">
            <h3 className="mb-4 text-lg font-bold text-white">Deposit Receipt</h3>
            <div className="mb-4 rounded bg-slate-800 p-4">
              <p className="text-sm text-slate-300">
                <strong>User:</strong> {selectedDepositReceipt.userEmail}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                <strong>Amount:</strong>{' '}
                {selectedDepositReceipt.currency === 'USDT'
                  ? `$${selectedDepositReceipt.amount.toFixed(2)} USDT`
                  : `${selectedDepositReceipt.amount} Birr`}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                <strong>Gateway:</strong> {selectedDepositReceipt.gateway === 'merchant' ? 'Merchant' : selectedDepositReceipt.gateway === 'personal' ? 'Personal' : 'USDT'}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                <strong>Transaction ID:</strong> {selectedDepositReceipt.transactionId}
              </p>
              {selectedDepositReceipt.receiptDataUrl ? (
                <div className="mt-4 flex flex-col items-center gap-4">
                  <img src={selectedDepositReceipt.receiptDataUrl} alt="receipt-large" className="max-w-full max-h-[60vh] rounded-lg border border-zinc-300 object-contain" />
                  <a
                    href={selectedDepositReceipt.receiptDataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-400 underline"
                  >
                    Open full size in new tab
                  </a>
                </div>
              ) : selectedDepositReceipt.receiptFile ? (
                <p className="mt-4 text-sm text-slate-300">
                  <strong>File:</strong> {selectedDepositReceipt.receiptFile}
                </p>
              ) : null}
            </div>
            <button
              onClick={() => setSelectedDepositReceipt(null)}
              className="w-full rounded bg-slate-700 px-4 py-2 font-bold text-white transition hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
