import { useMemo, useEffect } from 'react'
import { CheckCircle, Clock, AlertCircle } from 'lucide-react'
import {
  mirrorSignupBonusToLocalHistory,
  fetchUserHistory,
} from '../lib/bonusHistory'
import { getSession } from '../lib/authService'

const PRIMARY_GREEN = '#84CC16'

export default function HistoryPage({ ctx }) {
  const {
    transactions,
    setTransactions,
    historyFilter,
    setHistoryFilter,
    historyFilters,
    formatCurrency,
    userEmail,
  } = ctx

  useEffect(() => {
    async function syncHistoryDisplay() {
      const currentUser = getSession()?.user
      const userId = currentUser?.id
      if (!userId) {
        if (setTransactions) setTransactions([])
        return
      }

      if (userEmail) {
        mirrorSignupBonusToLocalHistory(userEmail, userId)
      }

      const rows = await fetchUserHistory(userId, userEmail)
      if (setTransactions) {
        setTransactions(rows)
      }
    }

    syncHistoryDisplay()
  }, [userEmail, setTransactions])

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'All') return transactions
    if (historyFilter === 'Bonuses') {
      return transactions.filter((item) => item.type === 'Bonus')
    }
    return transactions.filter((item) => item.type === historyFilter.slice(0, -1))
  }, [historyFilter, transactions])

  const getStatusIcon = (status) => {
    if (status === 'Pending') return <Clock size={16} className="text-yellow-500" />
    if (status === 'Approved') return <CheckCircle size={16} className="text-green-600" />
    return <AlertCircle size={16} className="text-red-600" />
  }

  const getStatusColor = (status) => {
    if (status === 'Pending') return 'bg-yellow-50 text-yellow-700 border border-yellow-200'
    if (status === 'Approved') return 'bg-green-50 text-green-700 border border-green-200'
    return 'bg-red-50 text-red-700 border border-red-200'
  }

  return (
    <div className="bg-white pb-2">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">Activity</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Transaction History</h1>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {historyFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setHistoryFilter(filter)}
              className="whitespace-nowrap px-4 py-2 rounded-full font-semibold text-sm transition-all active:scale-95"
              style={{
                backgroundColor: historyFilter === filter ? PRIMARY_GREEN : '#F3F4F6',
                color: historyFilter === filter ? '#FFFFFF' : '#4B5563',
                boxShadow: historyFilter === filter ? `0 2px 8px ${PRIMARY_GREEN}30` : 'none',
              }}
            >
              {filter}
            </button>
          ))}
        </div>

        {filteredHistory.length > 0 ? (
          <div className="space-y-3">
            {filteredHistory.map((tx) => (
              <div
                key={tx.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-slate-950 text-sm">{tx.title}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {new Date(tx.date).toLocaleDateString()} ·{' '}
                      {new Date(tx.date).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-bold text-slate-950 text-sm">
                      {formatCurrency(tx.amount, tx.currency)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 gap-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(tx.status)}
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(tx.status)}`}
                    >
                      {tx.status}
                    </span>
                  </div>
                  <span className="text-xs font-semibold bg-white text-slate-600 px-3 py-1 rounded-full border border-slate-200">
                    {tx.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
            <p className="font-bold text-slate-600">No transactions</p>
            <p className="text-xs text-slate-500 mt-2">Start depositing to see activity</p>
          </div>
        )}

        {filteredHistory.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
            <p className="text-xs font-semibold text-slate-600">
              {filteredHistory.length} transaction{filteredHistory.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
