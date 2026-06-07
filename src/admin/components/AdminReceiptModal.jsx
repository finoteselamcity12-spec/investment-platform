import { useState } from 'react'
import supabase from '../../lib/supabase'
import { formatAdminCurrency } from '../lib/adminStorage'

export default function AdminReceiptModal({ deposit, onClose, fetchDeposits }) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  if (!deposit) return null

  async function handleApprove() {
    setProcessing(true)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_approve_deposit', { p_deposit_id: deposit.id })
      if (rpcError) {
        setError(rpcError.message || 'Approve failed')
        setProcessing(false)
        return
      }

      if (data?.success) {
        if (fetchDeposits) await fetchDeposits()
        onClose()
        setProcessing(false)
        return
      }

      setError(data?.message || 'Could not approve deposit')
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setProcessing(false)
    }
  }

  async function handleReject() {
    setProcessing(true)
    setError('')
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_reject_deposit', { p_deposit_id: deposit.id })
      if (rpcError) {
        setError(rpcError.message || 'Reject failed')
        setProcessing(false)
        return
      }

      if (data?.success) {
        if (fetchDeposits) await fetchDeposits()
        onClose()
        setProcessing(false)
        return
      }

      setError(data?.message || 'Could not reject deposit')
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="admin-receipt-modal" role="dialog" aria-modal="true">
      <div className="admin-receipt-dialog">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Deposit Receipt</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>{deposit.userEmail}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={processing}>
              Close
            </button>
            <button type="button" className="admin-btn admin-btn-danger" onClick={handleReject} disabled={processing}>
              Reject
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={handleApprove} disabled={processing}>
              {processing ? 'Processing…' : 'Approve'}
            </button>
          </div>
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
        {deposit.screenshot && typeof deposit.screenshot === 'string' && (deposit.screenshot.startsWith('data:') || deposit.screenshot.startsWith('http')) ? (
          <img src={deposit.screenshot} alt="Payment receipt" />
        ) : (
          <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#94a3b8' }}>No image uploaded</p>
        )}
        {error && <p style={{ color: 'red', marginTop: '0.5rem' }}>{error}</p>}
      </div>
    </div>
  )
}
