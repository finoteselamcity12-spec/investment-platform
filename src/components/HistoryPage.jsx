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
    if (status.includes('Completed')) return <CheckCircle size={16} className="text-green-600" />
    return <AlertCircle size={16} className="text-red-600" />
  }

  const getStatusColor = (status) => {
    if (status.includes('Pending')) return 'bg-yellow-50 text-yellow-700 border border-yellow-200'
    if (status.includes('Completed')) return 'bg-green-50 text-green-700 border border-green-200'
    return 'bg-red-50 text-red-700 border border-red-200'
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Activity Log</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Transaction History</h1>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {historyFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setHistoryFilter(filter)}
              className={`whitespace-nowrap px-4 py-2 rounded-full font-semibold transition-all text-sm ${
                historyFilter === filter
                  ? 'bg-[#84CC16] text-white shadow-lg shadow-[#84CC16]/30'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        {filteredHistory.length > 0 ? (
          <div className="space-y-3">
            {filteredHistory.map((tx) => (
              <div
                key={tx.id}
                className="rounded-2xl border-2 border-slate-200 bg-white p-4 transition-all hover:border-[#84CC16]/50 hover:shadow-md"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-slate-950">{tx.title}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-950">
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
                  <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                    {tx.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-lg font-semibold text-slate-600">No transactions yet</p>
            <p className="text-sm text-slate-500 mt-2">Start by making a deposit or investment to see your transaction history here.</p>
          </div>
        )}

        {/* Summary */}
        {filteredHistory.length > 0 && (
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 text-center">
            <p className="text-sm font-semibold text-slate-600">
              Showing {filteredHistory.length} transaction{filteredHistory.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
