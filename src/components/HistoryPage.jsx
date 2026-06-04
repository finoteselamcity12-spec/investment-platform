import { useEffect } from 'react'
import { CheckCircle } from 'lucide-react'
import { fetchWelcomeBonusHistory } from '../lib/bonusHistory'
import { getSession } from '../lib/authService'

const PRIMARY_GREEN = '#84CC16'

export default function HistoryPage({ ctx }) {
  const { transactions, setTransactions, formatCurrency } = ctx

  useEffect(() => {
    async function loadWelcomeBonusHistory() {
      const currentUser = getSession()?.user
      const userId = currentUser?.id
      if (!userId) {
        if (setTransactions) setTransactions([])
        return
      }

      const rows = await fetchWelcomeBonusHistory(userId)
      if (setTransactions) {
        setTransactions(rows)
      }
    }

    loadWelcomeBonusHistory()
  }, [setTransactions])

  return (
    <div className="bg-white pb-2">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">Activity</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Welcome Bonus</h1>
          <p className="text-xs text-slate-500 mt-1">Your one-time registration reward</p>
        </div>

        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((tx) => (
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
                    <CheckCircle size={16} className="text-green-600" />
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                      {tx.status}
                    </span>
                  </div>
                  <span
                    className="text-xs font-semibold px-3 py-1 rounded-full border"
                    style={{
                      backgroundColor: `${PRIMARY_GREEN}15`,
                      color: PRIMARY_GREEN,
                      borderColor: `${PRIMARY_GREEN}40`,
                    }}
                  >
                    Welcome Bonus
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
            <p className="font-bold text-slate-600">No welcome bonus yet</p>
            <p className="text-xs text-slate-500 mt-2">
              Complete registration to receive your welcome bonus
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
