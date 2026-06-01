import { useState, useEffect } from 'react'
import { TrendingUp, Wallet, Gift, ArrowUpRight, UserCircle } from 'lucide-react'

const PRIMARY_GREEN = '#84CC16'

export default function HomePage({ ctx }) {
  const {
    usdBalance, etbBalance, myActiveInvestmentsList, marketData,
    showToast, claimTimestamp, claimCooldownMs, setActivePage, setUsdBalance, setEtbBalance, setClaimTimestamp, userFullName,
  } = ctx
  const [profileImage, setProfileImage] = useState('')
  const [claimedBonuses, setClaimedBonuses] = useState([])

  useEffect(() => {
    const storedImage = localStorage.getItem('user_profile_image')
    if (storedImage) {
      setProfileImage(storedImage)
    }
    const claimed = JSON.parse(localStorage.getItem('claimed_bonuses') || '[]')
    setClaimedBonuses(claimed)
  }, [])

  const usdDailyReward = myActiveInvestmentsList
    .filter((item) => item.currency === 'USD')
    .reduce((sum, item) => sum + (item.dailyProfit || 0), 0)
  
  const etbDailyReward = myActiveInvestmentsList
    .filter((item) => item.currency === 'ETB')
    .reduce((sum, item) => sum + (item.dailyProfit || 0), 0)

  const lastClaimAge = claimTimestamp ? Date.now() - claimTimestamp : null
  const claimAvailable = !claimTimestamp || lastClaimAge >= claimCooldownMs
  const claimRemainingHours = claimTimestamp
    ? Math.max(0, Math.ceil((claimCooldownMs - lastClaimAge) / 3600000))
    : 0

  const handleClaimRewards = () => {
    if (!claimAvailable) {
      showToast(`Claim available in ${claimRemainingHours} hours`, 'error')
      return
    }

    if (usdDailyReward === 0 && etbDailyReward === 0) {
      showToast('No daily profit available to claim yet.', 'info')
      return
    }

    const updatedUsdBalance = Number((usdBalance + usdDailyReward).toFixed(2))
    const updatedEtbBalance = Math.round(etbBalance + etbDailyReward)
    setUsdBalance(updatedUsdBalance)
    setEtbBalance(updatedEtbBalance)

    const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    const currentEmail = Object.keys(userData)[0]
    if (currentEmail && userData[currentEmail]) {
      userData[currentEmail].usdBalance = updatedUsdBalance
      userData[currentEmail].etbBalance = updatedEtbBalance
      localStorage.setItem('admin_user_data', JSON.stringify(userData))
    }

    const now = Date.now()
    setClaimTimestamp(now)
    localStorage.setItem('lastClaimTimestamp', now)

    showToast('Daily profit claimed and added to your account.', 'success')
  }

  const handleClaimBonus = (depositId, bonusAmount) => {
    if (claimedBonuses.includes(depositId)) {
      showToast('Bonus already claimed for this deposit.', 'info')
      return
    }

    const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
    const userEmail = Object.keys(userData)[0]
    if (userEmail && userData[userEmail]) {
      userData[userEmail].usdBalance = (userData[userEmail].usdBalance || 0) + bonusAmount
      localStorage.setItem('admin_user_data', JSON.stringify(userData))
    }

    const updated = [...claimedBonuses, depositId]
    setClaimedBonuses(updated)
    localStorage.setItem('claimed_bonuses', JSON.stringify(updated))
    showToast(`Bonus of $${bonusAmount.toFixed(2)} claimed successfully!`, 'success')
  }

  // Get approved deposits that are eligible for bonus
  const approvedDeposits = JSON.parse(localStorage.getItem('admin_approved_deposits') || '[]')
  const userEmail = Object.keys(JSON.parse(localStorage.getItem('admin_user_data') || '{}'))[0]
  const userApprovedDeposits = approvedDeposits.filter((d) => d.userEmail === userEmail && !claimedBonuses.includes(d.id))

  return (
    <div className="bg-white pb-4">
      <div className="space-y-5">
        {/* Header with Profile Picture - Mobile-First Typography */}
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
          <h1 className="mt-4 text-3xl font-bold text-slate-950">{userFullName || 'Investor'}</h1>
        </div>

        {/* Total Balance Card - Mobile optimized */}
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

        {/* Action Buttons - Large & Thumb-Friendly with bigger text */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setActivePage?.('deposit')}
            className="rounded-2xl bg-slate-100 px-4 py-6 font-bold text-slate-950 active:scale-95 transition"
            style={{
              borderLeft: `4px solid ${PRIMARY_GREEN}`,
            }}
          >
            <Wallet size={32} className="mx-auto mb-3" style={{ color: PRIMARY_GREEN }} />
            <span className="text-base">Deposit</span>
          </button>
          <button
            onClick={() => setActivePage?.('invest')}
            className="rounded-2xl bg-slate-100 px-4 py-6 font-bold text-slate-950 active:scale-95 transition"
            style={{
              borderLeft: `4px solid ${PRIMARY_GREEN}`,
            }}
          >
            <TrendingUp size={32} className="mx-auto mb-3" style={{ color: PRIMARY_GREEN }} />
            <span className="text-base">Invest</span>
          </button>
          <button
            onClick={() => setActivePage?.('history')}
            className="rounded-2xl bg-slate-100 px-4 py-6 font-bold text-slate-950 active:scale-95 transition"
            style={{
              borderLeft: `4px solid ${PRIMARY_GREEN}`,
            }}
          >
            <ArrowUpRight size={32} className="mx-auto mb-3" style={{ color: PRIMARY_GREEN }} />
            <span className="text-base">History</span>
          </button>
          <button
            onClick={() => setActivePage?.('support')}
            className="rounded-2xl bg-slate-100 px-4 py-6 font-bold text-slate-950 active:scale-95 transition"
            style={{
              borderLeft: `4px solid ${PRIMARY_GREEN}`,
            }}
          >
            <Gift size={32} className="mx-auto mb-3" style={{ color: PRIMARY_GREEN }} />
            <span className="text-base">Support</span>
          </button>
        </div>

        {/* Daily Profit & Claim - Bigger font */}
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-slate-600">USD Daily Profit</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">${usdDailyReward.toFixed(2)}</p>
            </div>
            <div className="text-right sm:text-right">
              <p className="text-sm font-semibold text-slate-600">ETB Daily Profit</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{etbDailyReward.toFixed(0)} Br</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">Claim your earnings once every 24 hours.</p>
          <button
            onClick={handleClaimRewards}
            disabled={!claimAvailable}
            className="w-full mt-5 rounded-2xl px-4 py-4 font-bold text-white active:scale-95 transition disabled:opacity-60 text-lg"
            style={{
              backgroundColor: claimAvailable ? PRIMARY_GREEN : '#CBD5E1',
              boxShadow: claimAvailable ? `0 4px 12px ${PRIMARY_GREEN}30` : 'none',
            }}
          >
            {claimAvailable ? '🎁 Claim Daily Profit' : `Available in ${claimRemainingHours}h`}
          </button>
        </div>

        {/* Deposit Bonus Section */}
        {userApprovedDeposits.length > 0 && (
          <div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-emerald-700">🎉 Bonus Available</p>
                <p className="mt-2 text-2xl font-bold text-emerald-900">Claim Your Deposit Bonus</p>
              </div>
            </div>
            <div className="space-y-3">
              {userApprovedDeposits.map((deposit) => {
                const bonusAmount = deposit.bonus || deposit.amount * 0.1
                return (
                  <div key={deposit.id} className="rounded-2xl bg-white border border-emerald-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{deposit.paymentMethod}</p>
                        <p className="text-sm text-slate-600 mt-1">Deposit: ${deposit.amount.toFixed(2)}</p>
                      </div>
                      <button
                        onClick={() => handleClaimBonus(deposit.id, bonusAmount)}
                        className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95"
                      >
                        Claim ${bonusAmount.toFixed(2)}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Quick Stats - Bigger text */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-600">Active Plans</p>
            <p className="mt-3 text-4xl font-bold text-slate-950">{myActiveInvestmentsList.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-600">Total Invested</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              ${myActiveInvestmentsList
                .filter((i) => i.currency === 'USD')
                .reduce((sum, i) => sum + i.amount, 0)
                .toFixed(2)}
            </p>
          </div>
        </div>

        {/* Market Overview - Bigger fonts */}
        {marketData && marketData.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-bold text-slate-950">Market Watch</h2>
            <div className="space-y-3">
              {marketData.map((asset, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-slate-950">{asset.symbol}</p>
                    <p className="text-sm text-slate-500 mt-1">{asset.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-950">{asset.price}</p>
                    <p className={`text-base font-semibold ${asset.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                      {asset.change}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
