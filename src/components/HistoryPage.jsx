import { useMemo } from 'react'
import { CheckCircle, Clock, AlertCircle } from 'lucide-react'

export default function HistoryPage({ ctx }) {
  const { transactions, historyFilter, setHistoryFilter, historyFilters, formatCurrency } = ctx

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'All') return transactions
    return transactions.filter((item) => item.type === historyFilter.slice(0, -1))
  }, [historyFilter, transactions])

  const getStatusIcon = (status) => {
    if (status.includes('Pending')) return <Clock size={16} className="text-yellow-500" />
    if (status.includes('Completed')) return <CheckCircle size={16} className="text-green-500" />
    return <AlertCircle size={16} className="text-red-500" />
  }

  const getStatusColor = (status) => {
    if (status.includes('Pending')) return 'bg-yellow-900/30 text-yellow-300'
    if (status.includes('Completed')) return 'bg-green-900/30 text-green-300'
    return 'bg-red-900/30 text-red-300'
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {historyFilters.map((filter) => (
          <button
            key={filter}
            onClick={() => setHistoryFilter(filter)}
            className={`whitespace-nowrap px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
              historyFilter === filter
                ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-lg shadow-sky-600/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Transaction Table */}
      {filteredHistory.length > 0 ? (
        <div className="space-y-3">
          {filteredHistory.map((tx) => (
            <div
              key={tx.id}
              className="app-card bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 p-4 rounded-xl hover:border-sky-500/50 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-white">{tx.title}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">
                    {tx.currency === 'USD' ? '+' : ''}
                    {formatCurrency(tx.amount, tx.currency)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(tx.status)}
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(tx.status)}`}>
                    {tx.status}
                  </span>
                </div>
                <span className="text-xs bg-slate-950/50 text-slate-400 px-2 py-1 rounded">
                  {tx.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="app-card bg-slate-900/50 border border-slate-800 p-8 rounded-xl text-center">
          <p className="text-slate-400 text-lg font-semibold">No transactions yet</p>
          <p className="text-slate-500 text-sm mt-2">Start by making a deposit or investment</p>
        </div>
      )}

      {/* Summary Card */}
      {filteredHistory.length > 0 && (
        <div className="app-card bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
          <p className="text-slate-400 text-sm">
            Showing {filteredHistory.length} transaction{filteredHistory.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
