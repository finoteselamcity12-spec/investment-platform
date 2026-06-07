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
  const [, setDeposits] = useState([])

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
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const [usersRes, pendingDepRes, pendingWithRes, todayRes] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('deposits').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('history').select('id').gte('created_at', today.toISOString()),
        ])
        if (!mounted) return
        setStats({
          totalUsers: usersRes.count || 0,
          dailyTransactions: todayRes.data?.length || todayRes.count || 0,
          pendingDeposits: pendingDepRes.count || 0,
          pendingWithdrawals: pendingWithRes.count || 0,
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
    console.log('[Admin Dashboard] fetchDeposits start')
    try {
      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        console.error('[Admin Dashboard] fetchDeposits error:', error)
      }
      console.log('Deposits loaded:', data?.length, error)
      setDeposits(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('[Admin Dashboard] fetchDeposits exception:', e)
      setDeposits([])
    }
  }

  async function approveDeposit(depositId) {
    setLoading(true)
    setBusyId(depositId)
    try {
      // Fetch deposit to get the full object
      const { data: deposit, error: depositFetchError } = await supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (depositFetchError) throw depositFetchError
      if (!deposit) throw new Error('Deposit not found')

      // 1. Update deposit status
      await supabase.from('deposits').update({ status: 'approved' }).eq('id', deposit.id)

      // 2. Fetch current balance
      const { data: balanceData, error: fetchError } = await supabase
        .from('balances')
        .select('etb_balance')
        .eq('user_id', deposit.user_id)
        .single()

      if (fetchError) throw fetchError

      // 3. Update balance
      const newBalance = (balanceData.etb_balance || 0) + deposit.amount
      await supabase
        .from('balances')
        .update({ etb_balance: newBalance })
        .eq('user_id', deposit.user_id)

      alert('Approved successfully!')
      await fetchDeposits()
    } catch (err) {
      console.error('Error:', err)
      alert('Failed to approve: ' + (err?.message || String(err)))
    } finally {
      setLoading(false)
      setBusyId(null)
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
    () =>
      safePendingDeposits.map((d) => (
        <tr key={d.supabaseId || d.id}>
          <td>
            <div style={{ fontWeight: 600 }}>{d.userEmail || '—'}</div>
            <div style={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'monospace' }}>
              {d.userId || '—'}
            </div>
            {d.source === 'local' && (
              <span className="admin-badge admin-badge-pending" style={{ marginTop: '0.25rem' }}>
                Local only
              </span>
            )}
          </td>
          <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: '10rem', wordBreak: 'break-all' }}>
            {d.transactionId || '—'}
          </td>
          <td>
            {d.screenshot &&
            typeof d.screenshot === 'string' &&
            d.screenshot.length > 0 &&
            (d.screenshot.startsWith('data:') || d.screenshot.startsWith('http')) ? (
              <button
                type="button"
                className="admin-proof-thumb"
                onClick={() => setReceiptDeposit(d)}
                aria-label="View payment proof"
              >
                <img src={d.screenshot} alt="Proof" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              </button>
            ) : (
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>No image</span>
            )}
          </td>
          <td>{formatAdminCurrency(d.amount, d.currency)}</td>
          <td style={{ fontSize: '0.75rem' }}>{d.paymentMethod || '—'}</td>
          <td style={{ fontSize: '0.75rem' }}>{new Date(d.createdAt).toLocaleString()}</td>
          <td>
            <div className="admin-actions">
              <button
                type="button"
                className="admin-btn admin-btn-approve"
                disabled={busyId === d.id || loading}
                onClick={() => approveDeposit(d.id)}
              >
                Approve
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-reject"
                disabled={busyId === d.id}
                onClick={() => handleRejectDeposit(d.id)}
              >
                Reject
              </button>
            </div>
          </td>
        </tr>
      )),
    [safePendingDeposits, busyId, loading, approveDeposit, handleRejectDeposit]
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
            <AdminDataTable
              title="Pending Deposits"
              subtitle="Approve or reject from each row"
              emptyMessage="No pending deposits."
              columns={[
                { key: 'user', label: 'User / ID' },
                { key: 'tx', label: 'Transaction ID' },
                { key: 'proof', label: 'Proof' },
                { key: 'amount', label: 'Amount' },
                { key: 'method', label: 'Method' },
                { key: 'date', label: 'Submitted' },
                { key: 'actions', label: 'Actions' },
              ]}
              rows={depositRows}
            />
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
