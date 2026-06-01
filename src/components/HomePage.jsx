import { useState, useEffect } from 'react'
import { TrendingUp, Wallet, ArrowUpCircle, HelpCircle, UserCircle } from 'lucide-react'

const PRIMARY_GREEN = '#84CC16'

export default function HomePage({ ctx }) {
  const { usdBalance, etbBalance, setActivePage } = ctx
  const [profileImage, setProfileImage] = useState('')

  useEffect(() => {
    const storedImage = localStorage.getItem('user_profile_image')
    if (storedImage) {
      setProfileImage(storedImage)
    }
  }, [])

  return (
    <div className="bg-white pb-4">
      <div className="space-y-5">
        {/* Header with Profile Picture */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500">Welcome back</p>
          </div>
          {profileImage ? (
            <img
              src={profileImage}
              alt="Profile"
              className="h-16 w-16 rounded-full object-cover shadow-md flex-shrink-0"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-700 shadow-md flex-shrink-0">
              <UserCircle size={32} />
            </div>
          )}
        </div>

        <div>
          <h1 className="mt-4 text-3xl font-bold text-slate-950">Investment Platform</h1>
        </div>

        {/* Total Balance Card */}
        <div
          className="rounded-3xl p-6 text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${PRIMARY_GREEN}, #6bb01a)`,
            boxShadow: `0 8px 24px ${PRIMARY_GREEN}30`,
          }}
        >
          <p className="text-sm font-semibold opacity-90">Total Balance</p>
          <p className="mt-3 text-4xl font-bold tracking-tight">
            ${(usdBalance + etbBalance).toFixed(2)}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
              <p className="text-xs font-semibold opacity-80">USD</p>
              <p className="mt-2 text-lg font-bold">${usdBalance.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
              <p className="text-xs font-semibold opacity-80">ETB</p>
              <p className="mt-2 text-lg font-bold">{etbBalance.toFixed(2)} Br</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setActivePage?.('deposit')}
            className="rounded-2xl bg-slate-100 px-4 py-6 font-bold text-slate-950 active:scale-95 transition"
            style={{ borderLeft: `4px solid ${PRIMARY_GREEN}` }}
          >
            <Wallet size={32} className="mx-auto mb-3" style={{ color: PRIMARY_GREEN }} />
            <span className="text-base">Deposit</span>
          </button>
          <button
            onClick={() => setActivePage?.('withdraw')}
            className="rounded-2xl bg-slate-100 px-4 py-6 font-bold text-slate-950 active:scale-95 transition"
            style={{ borderLeft: `4px solid ${PRIMARY_GREEN}` }}
          >
            <ArrowUpCircle size={32} className="mx-auto mb-3" style={{ color: PRIMARY_GREEN }} />
            <span className="text-base">Withdraw</span>
          </button>
          <button
            onClick={() => setActivePage?.('history')}
            className="rounded-2xl bg-slate-100 px-4 py-6 font-bold text-slate-950 active:scale-95 transition"
            style={{ borderLeft: `4px solid ${PRIMARY_GREEN}` }}
          >
            <TrendingUp size={32} className="mx-auto mb-3" style={{ color: PRIMARY_GREEN }} />
            <span className="text-base">History</span>
          </button>
          <button
            onClick={() => setActivePage?.('support')}
            className="rounded-2xl bg-slate-100 px-4 py-6 font-bold text-slate-950 active:scale-95 transition"
            style={{ borderLeft: `4px solid ${PRIMARY_GREEN}` }}
          >
            <HelpCircle size={32} className="mx-auto mb-3" style={{ color: PRIMARY_GREEN }} />
            <span className="text-base">Support</span>
          </button>
        </div>

        {/* Info Card */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs text-blue-900 font-medium">
            ✓ <strong>Platform Status:</strong> Secure and fully operational.
          </p>
        </div>
      </div>
    </div>
  )
}

