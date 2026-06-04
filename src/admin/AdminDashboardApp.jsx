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
  mergeUsers,
  approveDeposit,
  rejectDeposit,
  approveWithdrawal,
  rejectWithdrawal,
  deleteUser,
  formatAdminCurrency,
} from './lib/adminStorage'
import { fetchAdminDashboard } from './lib/adminSupabase'
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
  const [fetchErrors, setFetchErrors] = useState([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [section, setSection] = useState('overview')
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [receiptDeposit, setReceiptDeposit] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    const t = setTimeout(() => setToast({ message: '', type }), 3200)
    return () => clearTimeout(t)
  }, [])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    const local = loadAdminSnapshot()
    try {
      const remote = await fetchAdminDashboard()
      setFetchErrors(remote.errors || [])
      setRemoteStats(remote.stats)

      const pendingDeposits = mergePendingDeposits(
        local.pendingDepositsLocal || local.pendingDeposits,
        remote.pendingDeposits
      )
      const users = mergeUsers(remote.users, local.users)

      setSnapshot({
        ...local,
        pendingDeposits,
        users,
        registrationCount: remote.stats?.totalUsers ?? local.registrationCount,
        dailyTransactions: remote.stats?.dailyTransactions ?? local.dailyTransactions,
      })
    } catch (err) {
      const msg = err?.message || String(err)
      console.error('[Admin] refresh failed:', err)
      setFetchErrors([msg])
      setSnapshot(local)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

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
  }, [refresh])

  useEffect(() => {
    if (!isAuthorized || !adminSession) return
    refresh()
  }, [isAuthorized, adminSession, refresh])

  const metrics = useMemo(
    () => [
      {
        label: 'Total Users',
        value: remoteStats?.totalUsers ?? snapshot.registrationCount ?? 0,
      },
      {
        label: 'Daily Transactions',
        value: remoteStats?.dailyTransactions ?? snapshot.dailyTransactions ?? 0,
      },
      {
        label: 'Active Investments',
        value: snapshot.activeInvestments ?? 0,
      },
      {
        label: 'Pending Deposits',
        value: remoteStats?.pendingDeposits ?? snapshot.pendingDeposits.length ?? 0,
      },
    ],
    [snapshot, remoteStats]
  )

  const handleApproveDeposit = useCallback(
    async (id) => {
      setBusyId(id)
      try {
        const next = await approveDeposit(id, snapshot)
        setSnapshot(next)
        await refresh()
        showToast('Deposit approved — Supabase balance updated.', 'success')
      } catch (e) {
        showToast(e?.message || 'Approve failed', 'error')
      } finally {
        setBusyId(null)
      }
    },
    [snapshot, showToast, refresh]
  )

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
    (id) => {
      setSnapshot(approveWithdrawal(id, snapshot))
      showToast('Withdrawal approved.', 'success')
    },
    [snapshot, showToast]
  )

  const handleRejectWithdrawal = useCallback(
    (id) => {
      setSnapshot(rejectWithdrawal(id, snapshot))
      showToast('Withdrawal rejected.', 'info')
    },
    [snapshot, showToast]
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
      snapshot.pendingDeposits.map((d) => (
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
            {d.screenshot ? (
              <button
                type="button"
                className="admin-proof-thumb"
                onClick={() => setReceiptDeposit(d)}
                aria-label="View payment proof"
              >
                <img src={d.screenshot} alt="Proof" />
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
                disabled={busyId === d.id}
                onClick={() => handleApproveDeposit(d.id)}
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
    [snapshot.pendingDeposits, busyId, handleApproveDeposit, handleRejectDeposit]
  )

  const withdrawalRows = useMemo(
    () =>
      snapshot.pendingWithdrawals.map((w) => (
        <tr key={w.id}>
          <td>
            <div style={{ fontWeight: 600 }}>{w.userName || w.userEmail}</div>
            <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{w.bank}</div>
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
    [snapshot.pendingWithdrawals, handleApproveWithdrawal, handleRejectWithdrawal]
  )

  const userRows = useMemo(
    () =>
      snapshot.users.map((u) => (
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
    [snapshot.users, handleDeleteUser]
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
                  ? `Supabase · ${remoteStats.totalUsers ?? 0} users · ${remoteStats.pendingDeposits ?? 0} pending in DB`
                  : 'Loading Supabase stats…'}
              </p>
            </div>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={refresh} disabled={isRefreshing}>
              {isRefreshing ? 'Refreshing…' : 'Refresh data'}
            </button>
          </header>

          {fetchErrors.length > 0 && (
            <div className="admin-error-banner" role="alert">
              <strong>Supabase error (check F12 → Console / Network):</strong>
              <ul>
                {fetchErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                Run <code>supabase/migrations/005_admin_dashboard_backend.sql</code> in SQL Editor and sign in at
                /admin-login with Supabase Auth user <strong>{ADMIN_EMAIL}</strong>.
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
                Pending withdrawals: <strong style={{ color: '#e2e8f0' }}>{snapshot.pendingWithdrawals.length}</strong>
                {' · '}
                Approved deposits: <strong style={{ color: '#e2e8f0' }}>{snapshot.approvedDeposits.length}</strong>
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
