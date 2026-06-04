import { formatAdminCurrency } from '../lib/adminStorage'

export default function AdminReceiptModal({ deposit, onClose }) {
  if (!deposit) return null

  return (
    <div className="admin-receipt-modal" role="dialog" aria-modal="true">
      <div className="admin-receipt-dialog">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Deposit Receipt</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>{deposit.userEmail}</p>
          </div>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem' }}>
          <strong>User ID:</strong> <span style={{ fontFamily: 'monospace' }}>{deposit.userId || '—'}</span>
        </p>
        <p style={{ fontSize: '0.8125rem' }}>
          <strong>Email:</strong> {deposit.userEmail || '—'}
        </p>
        <p style={{ fontSize: '0.8125rem' }}>
          <strong>Amount:</strong> {formatAdminCurrency(deposit.amount, deposit.currency)}
        </p>
        <p style={{ fontSize: '0.8125rem' }}>
          <strong>Method:</strong> {deposit.paymentMethod || '—'}
        </p>
        <p style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>
          <strong>Transaction ID:</strong> {deposit.transactionId || '—'}
        </p>
        {deposit.screenshot &&
        typeof deposit.screenshot === 'string' &&
        (deposit.screenshot.startsWith('data:') || deposit.screenshot.startsWith('http')) ? (
          <img src={deposit.screenshot} alt="Payment receipt" />
        ) : (
          <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#94a3b8' }}>No image uploaded</p>
        )}
      </div>
    </div>
  )
}
