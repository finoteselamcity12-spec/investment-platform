import { useState, useEffect } from 'react'
import { TrendingUp, Wallet, ArrowUpCircle, HelpCircle, UserCircle, Gift, Shield } from 'lucide-react'
import { getSession, getUserProfile } from '../lib/authService'

const PRIMARY_GREEN = '#84CC16'

export default function HomePage({ ctx }) {
  const { usdBalance, etbBalance, setActivePage, showToast } = ctx
  const [profileImage, setProfileImage] = useState('')
  const [bonusData, setBonusData] = useState(null)
  const [claimedBonus, setClaimedBonus] = useState(false)
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

      // Load bonus data
      const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
      const userRecord = userData[session.user.email]
      if (userRecord) {
        setBonusData({
          bonusEligible: userRecord.bonusEligible || false,
          bonusClaimed: userRecord.bonusClaimed || false,
          totalDeposits: userRecord.totalDeposits || 0,
          totalBonus: (userRecord.totalDeposits || 0) * 0.05,
        })
        setClaimedBonus(userRecord.bonusClaimed || false)
      }
    }
  }

  const handleClaimBonus = () => {
    if (!bonusData?.bonusEligible) {
      showToast?.('Bonus not approved by admin yet', 'error')
      return
    }

    if (claimedBonus) {
      showToast?.('Bonus already claimed', 'info')
      return
    }

    // Claim bonus
    const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    if (userData[session.user.email]) {
      userData[session.user.email].bonusClaimed = true
      userData[session.user.email].usdBalance = (userData[session.user.email].usdBalance || 0) + (bonusData.totalBonus || 0)
      localStorage.setItem('admin_user_data', JSON.stringify(userData))
      setClaimedBonus(true)
      showToast?.(`Bonus of $${bonusData.totalBonus.toFixed(2)} claimed successfully!`, 'success')
      loadUserData()
    }
  }

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
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">Smart Investment Platform</h1>
          <p className="text-sm text-slate-500 mt-2">Enterprise-grade security • Real-time tracking • 24/7 support</p>
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
        {bonusData?.bonusEligible && (
          <div className="rounded-3xl border border-white/60 bg-gradient-to-br from-amber-50/60 to-orange-50/40 backdrop-blur-xl p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <Gift size={24} className="text-amber-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-bold text-amber-950">Deposit Bonus Available!</p>
                  <p className="text-sm text-amber-900 mt-1">5% bonus on deposit: <span className="font-bold">${bonusData.totalBonus.toFixed(2)}</span></p>
                </div>
              </div>
            </div>
            <button
              onClick={handleClaimBonus}
              disabled={claimedBonus}
              className={`w-full mt-4 px-4 py-3 rounded-xl font-bold transition-all duration-200 ${
                claimedBonus
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-lg hover:scale-105 active:scale-95'
              }`}
            >
              {claimedBonus ? '✓ Bonus Claimed' : 'Claim Bonus Now'}
            </button>
          </div>
        )}

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
        <div className="rounded-2xl border border-white/60 bg-gradient-to-r from-blue-50/60 to-cyan-50/40 backdrop-blur-xl p-4 shadow-md">
          <div className="flex items-start gap-3">
            <Shield size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-blue-900 font-bold uppercase tracking-wider">Enterprise Security</p>
              <p className="text-xs text-blue-800 mt-1">✓ JWT authenticated • ✓ SSL encrypted • ✓ Session protected</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

