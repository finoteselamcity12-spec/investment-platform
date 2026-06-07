import ErrorBoundary from '../components/ErrorBoundary'
import AdminDashboardApp from '../admin/AdminDashboardApp'

/**
 * Admin route entry — isolated from user dashboard.
 * Replaces legacy AdminDashboard implementation (fixes React error #310).
 */
export default function AdminDashboard() {
  return (
    <ErrorBoundary>
      <AdminDashboardApp />
    </ErrorBoundary>
  )
}
