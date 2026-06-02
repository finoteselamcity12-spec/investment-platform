import { useState, useEffect } from 'react'
import { TrendingUp, Wallet, ArrowUpCircle, HelpCircle, UserCircle, Gift, Shield } from 'lucide-react'
import { getSession, getUserProfile } from '../lib/authService'

const PRIMARY_GREEN = '#84CC16'

export default function HomePage({ ctx }) {
  const { usdBalance, etbBalance, setActivePage, showToast } = ctx
  const [profileImage, setProfileImage] = useState('')
  // bonus feature disabled for stability
  const [bonusData, setBonusData] = useState(null)
  const session = getSession()

  useEffect(() => {
    loadUserData()
  }, [])

  function loadUserData() {
    if (session?.user?.email) {
      const storedImage = localStorage.getItem(`user_profile_image_${session.user.email}`)
      if (storedImage) {
        setProfileImage(storedImage)
      }

      // Bonus feature currently disabled; do not populate bonus state
      // (Reserved for server-side implementation)
    }
  }

  // handleClaimBonus removed for stability

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white pb-24 pt-4">
      <div className="px-4 space-y-5">
        {/* Header with Profile Picture - Glassmorphism */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/40 bg-white/30 backdrop-blur-xl p-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Welcome back</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">{session?.user?.fullName || 'Investor'}</p>
          </div>
          {profileImage ? (
            <img
              src={profileImage}
              alt="Profile"
              className="h-16 w-16 rounded-full object-cover shadow-lg ring-2 ring-lime-300/50 flex-shrink-0"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-lime-100 to-lime-200 text-lime-700 shadow-lg ring-2 ring-lime-300/50 flex-shrink-0">
              <UserCircle size={32} />
            </div>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">Investment Platform</h1>
        </div>

        {/* Total Balance Card - Glassmorphism */}
        <div
          className="rounded-3xl border border-white/60 p-8 text-white shadow-2xl overflow-hidden relative"
          style={{
            background: `linear-gradient(135deg, ${PRIMARY_GREEN}, #65a007)`,
            boxShadow: `0 20px 40px ${PRIMARY_GREEN}40, 0 0 1px rgba(255,255,255,0.6)`,
          }}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl -ml-16 -mb-16" />
          
          <div className="relative z-10">
            <p className="text-sm font-semibold opacity-90 uppercase tracking-wide">Total Balance</p>
            <p className="mt-3 text-5xl font-black tracking-tight">
              ${(usdBalance + etbBalance).toFixed(2)}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 p-4">
                <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">USD Balance</p>
                <p className="mt-2 text-2xl font-bold">${usdBalance.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 p-4">
                <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">ETB Balance</p>
                <p className="mt-2 text-2xl font-bold">{etbBalance.toFixed(2)} Br</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bonus Card - Only show if eligible */}
        {/* Bonus feature temporarily disabled for stability */}

        {/* Action Buttons - Glassmorphism */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setActivePage?.('deposit')}
            className="rounded-2xl border border-white/40 bg-white/40 backdrop-blur-md hover:bg-white/60 active:scale-95 px-4 py-6 font-bold text-slate-950 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <Wallet size={32} className="mx-auto mb-3" style={{ color: PRIMARY_GREEN }} />
            <span className="text-sm">Deposit</span>
          </button>
          <button
            onClick={() => setActivePage?.('invest')}
            className="rounded-2xl border border-white/40 bg-white/40 backdrop-blur-md hover:bg-white/60 active:scale-95 px-4 py-6 font-bold text-slate-950 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <TrendingUp size={32} className="mx-auto mb-3" style={{ color: PRIMARY_GREEN }} />
            <span className="text-sm">Invest</span>
          </button>
          <button
            onClick={() => setActivePage?.('history')}
            className="rounded-2xl border border-white/40 bg-white/40 backdrop-blur-md hover:bg-white/60 active:scale-95 px-4 py-6 font-bold text-slate-950 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <ArrowUpCircle size={32} className="mx-auto mb-3" style={{ color: PRIMARY_GREEN }} />
            <span className="text-sm">History</span>
          </button>
          <button
            onClick={() => setActivePage?.('support')}
            className="rounded-2xl border border-white/40 bg-white/40 backdrop-blur-md hover:bg-white/60 active:scale-95 px-4 py-6 font-bold text-slate-950 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <HelpCircle size={32} className="mx-auto mb-3" style={{ color: PRIMARY_GREEN }} />
            <span className="text-sm">Support</span>
          </button>
        </div>

        {/* Security Info Card - Glassmorphism */}
      </div>
    </div>
  )
}

