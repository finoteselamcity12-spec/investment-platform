import AdminDashboardApp from '../admin/AdminDashboardApp'
import AdminErrorBoundary from '../admin/AdminErrorBoundary'

/**
 * Admin route entry — isolated from user dashboard.
 * Replaces legacy AdminDashboard implementation (fixes React error #310).
 */
export default function AdminDashboard() {
  return (
    <AdminErrorBoundary>
      <AdminDashboardApp />
    </AdminErrorBoundary>
  )
}
