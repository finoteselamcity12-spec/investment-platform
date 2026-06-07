import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  LogOut,
} from 'lucide-react'
import { getSession } from '../lib/authService'
import AdminLoginForm from './components/AdminLoginForm'
import AdminDataTable from './components/AdminDataTable'
import AdminReceiptModal from './components/AdminReceiptModal'
import {
  ADMIN_EMAIL,
  loadAdminSnapshot,
  mergePendingDeposits,
  mergePendingWithdrawals,
  mergeUsers,
  rejectDeposit,
  approveWithdrawal,
  rejectWithdrawal,
  deleteUser,
  formatAdminCurrency,
} from './lib/adminStorage'
import { fetchAdminDashboard, ensureSupabaseAdminAuth } from './lib/adminSupabase'
import supabase from '../lib/supabase'
import './admin.css'

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'deposits', label: 'Deposits', icon: ArrowDownToLine },
  { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
  { id: 'users', label: 'Users', icon: Users },
]

export default function AdminDashboardApp() {
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [adminSession, setAdminSession] = useState(null)
  const [snapshot, setSnapshot] = useState(() => loadAdminSnapshot())
  const [remoteStats, setRemoteStats] = useState(null)
  const [stats, setStats] = useState({
    totalUsers: 0,
    dailyTransactions: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
  })
  const [fetchErrors, setFetchErrors] = useState([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [section, setSection] = useState('overview')
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [receiptDeposit, setReceiptDeposit] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [deposits, setDeposits] = useState([])
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 20

  const emptySnapshot = {
    users: [],
    usersByKey: {},
    pendingDeposits: [],
    pendingDepositsLocal: [],
    approvedDeposits: [],
    rejectedDeposits: [],
    pendingWithdrawals: [],
    approvedWithdrawals: [],
    rejectedWithdrawals: [],
    registrationCount: 0,
    activeInvestments: 0,
    dailyTransactions: 0,
  }

  const safeSnapshot = snapshot || emptySnapshot
  const safePendingDeposits = Array.isArray(safeSnapshot.pendingDeposits) ? safeSnapshot.pendingDeposits : []
  const safePendingWithdrawals = Array.isArray(safeSnapshot.pendingWithdrawals) ? safeSnapshot.pendingWithdrawals : []
  const safeUsers = Array.isArray(safeSnapshot.users) ? safeSnapshot.users : []
  const safeApprovedDeposits = Array.isArray(safeSnapshot.approvedDeposits) ? safeSnapshot.approvedDeposits : []
  const safeFetchErrors = Array.isArray(fetchErrors) ? fetchErrors : []

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    const t = setTimeout(() => setToast({ message: '', type }), 3200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    let mounted = true
    async function fetchStats() {
      try {
        const dash = await fetchAdminDashboard()
        if (!mounted) return
        setStats({
          totalUsers: dash.stats?.totalUsers ?? 0,
          dailyTransactions: dash.stats?.dailyTransactions ?? 0,
          pendingDeposits: dash.stats?.pendingDeposits ?? 0,
          pendingWithdrawals: dash.stats?.pendingWithdrawals ?? 0,
        })
      } catch (err) {
        console.error('[AdminDashboard] fetchStats failed:', err)
      }
    }
    fetchStats()
    return () => { mounted = false }
  }, [])

  async function refresh() {
    setIsRefreshing(true)
    const local = loadAdminSnapshot()
    console.log('[Admin Dashboard] refresh start', { localUsers: local.users?.length })

    try {
      const auth = await ensureSupabaseAdminAuth()
      console.log('[Admin Dashboard] supabase auth', auth)

      // Load raw deposits from Supabase
      await fetchDeposits()

      const remote = await fetchAdminDashboard()
      console.log('[Admin Dashboard] remote payload', {
        errors: remote.errors,
        stats: remote.stats,
        deposits: remote.pendingDeposits?.length,
        withdrawals: remote.pendingWithdrawals?.length,
        users: remote.users?.length,
        sessionEmail: remote.sessionEmail,
      })

      setFetchErrors(remote.errors || [])
      setRemoteStats(remote.stats)

      const pendingDeposits = mergePendingDeposits(
        local.pendingDepositsLocal || local.pendingDeposits,
        remote.pendingDeposits
      )
      const pendingWithdrawals = mergePendingWithdrawals(
        local.pendingWithdrawals,
        remote.pendingWithdrawals
      )
      const users = mergeUsers(remote.users, local.users)

      setSnapshot({
        ...local,
        pendingDeposits,
        pendingWithdrawals,
        users,
        registrationCount: remote.stats?.totalUsers ?? local.registrationCount,
        dailyTransactions: remote.stats?.dailyTransactions ?? local.dailyTransactions,
      })

      console.log('[Admin Dashboard] snapshot updated', {
        users: users.length,
        pendingDeposits: pendingDeposits.length,
        pendingWithdrawals: pendingWithdrawals.length,
      })
    } catch (err) {
      const msg = err?.message || String(err)
      console.error('[Admin Dashboard] refresh failed:', err)
      setFetchErrors([msg])
      setSnapshot(local)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    const stored = JSON.parse(sessionStorage.getItem('admin_session') || 'null')
    const mainSession = getSession()
    const isAdmin =
      stored?.email === ADMIN_EMAIL ||
      mainSession?.user?.email === ADMIN_EMAIL ||
      (stored?.name === 'Admin' && stored?.id)

    if (isAdmin) {
      setIsAuthorized(true)
      setAdminSession(
        stored || {
          name: 'Admin',
          id: '15610010',
          email: ADMIN_EMAIL,
          loginTime: new Date().toISOString(),
        }
      )
      refresh()
    }
    setAuthChecked(true)
  }, [])

  const metrics = useMemo(
    () => [
      {
        label: 'Total Users',
        value: stats.totalUsers ?? remoteStats?.totalUsers ?? safeSnapshot.registrationCount ?? 0,
      },
      {
        label: 'Daily Transactions',
        value: stats.dailyTransactions ?? remoteStats?.dailyTransactions ?? safeSnapshot.dailyTransactions ?? 0,
      },
      {
        label: 'Active Investments',
        value: safeSnapshot.activeInvestments ?? 0,
      },
      {
        label: 'Pending Deposits',
        value: stats.pendingDeposits ?? remoteStats?.pendingDeposits ?? safePendingDeposits.length,
      },
    ],
    [safeSnapshot, safePendingDeposits, remoteStats, stats]
  )

  async function fetchDeposits() {
    const { data, error } = await supabase.rpc('admin_list_pending_deposits')
    const deposits = Array.isArray(data) ? data : []
    console.log('raw deposits (rpc):', JSON.stringify(deposits?.[0]))
    setDeposits(deposits)
  }

  const getAmount = (deposit) => {
    if (deposit.currency === 'USD') return `$${Number(deposit.amount_usd || 0).toFixed(2)}`
    return `${Number(deposit.amount_etb || 0).toLocaleString()} ETB`
  }

  async function approveDeposit(deposit) {
    console.log('Approving deposit:', deposit.id, 'for user:', deposit.user_id)
    
    const { data, error } = await supabase.rpc('admin_approve_deposit', {
      p_deposit_id: deposit.id
    })
    
    console.log('Approve result:', JSON.stringify(data), JSON.stringify(error))
    
    if (error) {
      alert('Error: ' + error.message)
      return
    }
    
    if (data?.ok && !data?.already_approved) {
      alert(`✅ Approved! ${data.total_credit} ${data.currency} added to user balance.`)
      // update UI immediately
      setDeposits((prev) => prev.map((d) => (d.id === deposit.id ? { ...d, status: 'successful' } : d)))
    } else if (data?.already_approved) {
      alert('Already approved before!')
      setDeposits((prev) => prev.map((d) => (d.id === deposit.id ? { ...d, status: 'successful' } : d)))
    } else {
      alert('Failed: ' + JSON.stringify(data))
    }
    
    // Refresh deposits list in background
    fetchDeposits().catch((e) => console.warn('fetchDeposits after approve failed', e))
  }

  async function rejectDepositRpc(deposit) {
    console.log('Rejecting deposit:', deposit.id)
    try {
      const { data, error } = await supabase.rpc('admin_reject_deposit', { p_deposit_id: deposit.id })
      console.log('Reject result:', JSON.stringify(data), JSON.stringify(error))
      if (error) {
        alert('Error: ' + error.message)
        return
      }
      alert('Deposit rejected.')
      setDeposits((prev) => prev.map((d) => (d.id === deposit.id ? { ...d, status: 'rejected' } : d)))
      fetchDeposits().catch((e) => console.warn('fetchDeposits after reject failed', e))
    } catch (e) {
      console.error('rejectDepositRpc exception', e)
      alert('Reject failed: ' + (e?.message || String(e)))
    }
  }

  const handleRejectDeposit = useCallback(
    async (id) => {
      setBusyId(id)
      try {
        const next = await rejectDeposit(id, snapshot)
        setSnapshot(next)
        await refresh()
        showToast('Deposit rejected.', 'info')
      } catch (e) {
        showToast(e?.message || 'Reject failed', 'error')
      } finally {
        setBusyId(null)
      }
    },
    [snapshot, showToast, refresh]
  )

  const handleApproveWithdrawal = useCallback(
    async (id) => {
      setBusyId(id)
      try {
        const next = await approveWithdrawal(id, snapshot)
        setSnapshot(next)
        await refresh()
        showToast('Withdrawal approved.', 'success')
      } catch (e) {
        showToast(e?.message || 'Withdrawal approve failed', 'error')
      } finally {
        setBusyId(null)
      }
    },
    [snapshot, showToast, refresh]
  )

  const handleRejectWithdrawal = useCallback(
    async (id) => {
      setBusyId(id)
      try {
        const next = await rejectWithdrawal(id, snapshot)
        setSnapshot(next)
        await refresh()
        showToast('Withdrawal rejected (balance refunded if in DB).', 'info')
      } catch (e) {
        showToast(e?.message || 'Withdrawal reject failed', 'error')
      } finally {
        setBusyId(null)
      }
    },
    [snapshot, showToast, refresh]
  )

  const handleDeleteUser = useCallback(
    async (id) => {
      if (!window.confirm('Delete this user from the database? This cannot be undone.')) return
      try {
        const next = await deleteUser(id, snapshot)
        setSnapshot(next)
        await refresh()
        showToast('User deleted from database.', 'success')
      } catch (e) {
        showToast(e?.message || 'Delete failed', 'error')
      }
    },
    [snapshot, showToast, refresh]
  )

  const handleSignOut = useCallback(() => {
    sessionStorage.removeItem('admin_session')
    setAdminSession(null)
    showToast('Signed out.', 'info')
  }, [showToast])

  const depositRows = useMemo(
    () => {
      const paginatedDeposits = deposits.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
      return paginatedDeposits.map((d) => (
        <tr key={d.id}>
            <td>
              <div style={{ fontWeight: 600 }}>{d.email || d.profiles?.email || d.user_id || '—'}</div>
              <div style={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'monospace' }}>
                {d.user_id || '—'}
              </div>
            </td>
          <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: '10rem', wordBreak: 'break-all' }}>
            {d.transaction_id || '—'}
          </td>
          <td>
            {d.proof_url &&
            typeof d.proof_url === 'string' &&
            d.proof_url.length > 0 &&
            (d.proof_url.startsWith('data:') || d.proof_url.startsWith('http')) ? (
              <button
                type="button"
                className="admin-proof-thumb"
                onClick={() => setReceiptDeposit(d)}
                aria-label="View payment proof"
              >
                <img src={d.proof_url} alt="Proof" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              </button>
            ) : (
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>No image</span>
            )}
          </td>
          <td>{getAmount(d)}</td>
          <td>
            {d.status === 'pending' && <span className="admin-badge admin-badge-pending">Pending</span>}
            {d.status === 'successful' && <span className="admin-badge admin-badge-success">Approved</span>}
            {d.status === 'rejected' && <span className="admin-badge admin-badge-rejected">Rejected</span>}
          </td>
          <td style={{ fontSize: '0.75rem' }}>{d.payment_method || '—'}</td>
          <td style={{ fontSize: '0.75rem' }}>{new Date(d.created_at).toLocaleString()}</td>
          <td>
            <div className="admin-actions">
              {d.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    className="admin-btn admin-btn-approve"
                    disabled={busyId === d.id || loading}
                    onClick={() => approveDeposit(d)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-reject"
                    disabled={busyId === d.id}
                    onClick={() => rejectDepositRpc(d)}
                  >
                    Reject
                  </button>
                </>
              ) : (
                d.status === 'successful' ? <span style={{ color: 'green' }}>✅ Approved</span> : <span style={{ color: 'red' }}>❌ Rejected</span>
              )}
            </div>
          </td>
        </tr>
      ))
    },
    [deposits, page, busyId, loading, approveDeposit]
  )

  const withdrawalRows = useMemo(
    () =>
      safePendingWithdrawals.map((w) => (
        <tr key={w.id}>
          <td>
            <div style={{ fontWeight: 600 }}>{w.userName || w.userEmail}</div>
            <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{w.bank || '—'}</div>
          </td>
          <td>{formatAdminCurrency(w.amount, w.currency)}</td>
          <td style={{ fontSize: '0.75rem' }}>{w.accountNumber}</td>
          <td>
            <div className="admin-actions">
              <button type="button" className="admin-btn admin-btn-approve" onClick={() => handleApproveWithdrawal(w.id)}>
                Approve
              </button>
              <button type="button" className="admin-btn admin-btn-reject" onClick={() => handleRejectWithdrawal(w.id)}>
                Reject
              </button>
            </div>
          </td>
        </tr>
      )),
    [safePendingWithdrawals, handleApproveWithdrawal, handleRejectWithdrawal]
  )

  const userRows = useMemo(
    () =>
      safeUsers.map((u) => (
        <tr key={u.id || u.email}>
          <td>
            <div style={{ fontWeight: 600 }}>{u.fullName || '—'}</div>
            <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{u.email || u.id}</div>
          </td>
          <td>${Number(u.usdBalance || 0).toFixed(2)}</td>
          <td>{Number(u.etbBalance || 0).toLocaleString()} Br</td>
          <td>
            <button type="button" className="admin-btn admin-btn-danger" onClick={() => handleDeleteUser(u.id || u.email)}>
              Delete
            </button>
          </td>
        </tr>
      )),
    [safeUsers, handleDeleteUser]
  )

  if (!authChecked) {
    return <div className="admin-loading">Loading admin console…</div>
  }

  if (!isAuthorized) {
    return <Navigate to="/admin-login" replace />
  }

  if (!adminSession) {
    return <AdminLoginForm onSuccess={(session) => { setAdminSession(session); refresh() }} />
  }

  const sectionTitle = NAV.find((n) => n.id === section)?.label || 'Overview'

  return (
    <div className="admin-root">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <h1>BLACKROCK</h1>
            <p>Admin Console</p>
          </div>
          <nav className="admin-nav" aria-label="Admin navigation">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`admin-nav-btn ${section === id ? 'is-active' : ''}`}
                onClick={() => setSection(id)}
              >
                <Icon size={18} aria-hidden />
                <span className="nav-label">{label}</span>
              </button>
            ))}
          </nav>
          <div className="admin-sidebar-footer">
            <button type="button" className="admin-signout" onClick={handleSignOut}>
              <LogOut size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Sign out
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <header className="admin-header">
            <div>
              <h2>{sectionTitle}</h2>
              <p>
                {remoteStats
                  ? `Supabase · ${remoteStats.totalUsers ?? 0} users · ${remoteStats.pendingDeposits ?? 0} pending deposits`
                  : safeFetchErrors.length
                    ? 'Supabase stats unavailable — see error below'
                    : 'Loading Supabase stats…'}
              </p>
            </div>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={refresh} disabled={isRefreshing}>
              {isRefreshing ? 'Refreshing…' : 'Refresh data'}
            </button>
          </header>

          {safeFetchErrors.length > 0 && (
            <div className="admin-error-banner" role="alert">
              <strong>Supabase error (check F12 → Console / Network):</strong>
              <ul>
                {safeFetchErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                If you see <code>not_admin</code>, run{' '}
                <code>supabase/migrations/007_fix_admin_auth_and_debug.sql</code> then sign in at /admin-login as{' '}
                <strong>{ADMIN_EMAIL}</strong>.
              </p>
            </div>
          )}

          {safeFetchErrors.length === 0 && remoteStats?.totalUsers === 0 && safeUsers.length === 0 && (
            <div className="admin-error-banner" role="alert" style={{ borderColor: '#b45309', background: '#451a03', color: '#fde68a' }}>
              <strong>Connected but no data returned.</strong>
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                Open F12 Console and look for <code>[Admin Supabase] debug_auth</code> — if{' '}
                <code>is_admin: false</code>, run migration 007. If <code>profiles_count: 0</code>, users exist only in
                Auth but not in <code>public.profiles</code> (re-run signup trigger SQL).
              </p>
            </div>
          )}

          {section === 'overview' && (
            <>
              <div className="admin-metrics">
                {metrics.map((m) => (
                  <div key={m.label} className="admin-metric-card">
                    <p className="admin-metric-label">{m.label}</p>
                    <p className="admin-metric-value">{m.value}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                Pending withdrawals: <strong style={{ color: '#e2e8f0' }}>{remoteStats?.pendingWithdrawals ?? safePendingWithdrawals.length}</strong>
                {' · '}
                Approved deposits: <strong style={{ color: '#e2e8f0' }}>{safeApprovedDeposits.length}</strong>
              </p>
            </>
          )}

          {section === 'deposits' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Deposits</h3>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Showing all deposits (pending, successful, rejected)</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                  <span>Page {page} of {Math.max(1, Math.ceil(deposits.length / ITEMS_PER_PAGE))}</span>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page * ITEMS_PER_PAGE >= deposits.length}>Next</button>
                </div>
              </div>
              <AdminDataTable
                title="Deposits"
                subtitle="Approve or reject from each row"
                emptyMessage="No deposits."
                columns={[
                  { key: 'user', label: 'User / ID' },
                  { key: 'tx', label: 'Transaction ID' },
                  { key: 'proof', label: 'Proof' },
                  { key: 'amount', label: 'Amount' },
                  { key: 'status', label: 'Status' },
                  { key: 'method', label: 'Method' },
                  { key: 'date', label: 'Submitted' },
                  { key: 'actions', label: 'Actions' },
                ]}
                rows={depositRows}
              />
            </>
          )}

          {section === 'withdrawals' && (
            <AdminDataTable
              title="Pending Withdrawals"
              subtitle="Payout requests awaiting review"
              emptyMessage="No pending withdrawals."
              columns={[
                { key: 'user', label: 'User' },
                { key: 'amount', label: 'Amount' },
                { key: 'account', label: 'Account' },
                { key: 'actions', label: 'Actions' },
              ]}
              rows={withdrawalRows}
            />
          )}

          {section === 'users' && (
            <AdminDataTable
              title="User Management"
              subtitle="Wallet balances from local records"
              emptyMessage="No users in storage yet."
              columns={[
                { key: 'name', label: 'User' },
                { key: 'usd', label: 'USD' },
                { key: 'etb', label: 'ETB' },
                { key: 'actions', label: 'Actions' },
              ]}
              rows={userRows}
            />
          )}
        </main>
      </div>

      {toast.message && (
        <div className={`admin-toast admin-toast-${toast.type}`}>{toast.message}</div>
      )}

      <AdminReceiptModal deposit={receiptDeposit} onClose={() => setReceiptDeposit(null)} />
    </div>
  )
}
