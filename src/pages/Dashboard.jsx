import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, ArrowUpCircle, HelpCircle } from 'lucide-react'
import { getSession } from '../lib/authService'

function formatAmount(amount) {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [balances, setBalances] = useState({ usd: 0, etb: 0 })

  useEffect(() => {
    const session = getSession()
    if (!session) {
      navigate('/login', { replace: true })
      return
    }

    const email = session.user?.email
    const storedData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    const userRecord = email ? storedData[email] || {} : {}

    setBalances({
      usd: Number(userRecord.usdBalance) || 0,
      etb: Number(userRecord.etbBalance) || 0,
    })
  }, [navigate])

  const totalBalance = balances.usd + balances.etb

  const navItems = [
    { label: 'Dashboard', icon: Home, path: '/dashboard' },
    { label: 'Withdraw', icon: ArrowUpCircle, path: '/withdraw' },
    { label: 'Support', icon: HelpCircle, path: '/support' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-16 pb-28">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Investment Platform</h1>
        </div>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Total Balance</p>
          <p className="mt-4 text-5xl font-black text-slate-950">${formatAmount(totalBalance)}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">USD Balance</p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">${formatAmount(balances.usd)}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">ETB Balance</p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">{formatAmount(balances.etb)} Br</p>
            </div>
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.path)}
                className="flex flex-1 flex-col items-center gap-1 rounded-3xl bg-slate-100 px-3 py-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
