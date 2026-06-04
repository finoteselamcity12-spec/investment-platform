import { useState } from 'react'
import { TrendingUp, Wallet, ArrowDownRight, Users, Copy, Check } from 'lucide-react'
import {
  REGISTRATION_BONUS_USD,
  REGISTRATION_BONUS_ETB,
} from '../lib/platformConfig'

export default function HomePage({ ctx }) {
  const {
    usdBalance = 0,
    etbBalance = 0,
    myActiveInvestmentsList = [],
    setActivePage,
    referralLink = '',
    referralEarningsUsd = 0,
    referralEarningsEtb = 0,
    showToast,
    copied,
    setCopied,
  } = ctx

  const spendableUsd = Math.max(0, Number(usdBalance) - REGISTRATION_BONUS_USD)
  const spendableEtb = Math.max(0, Number(etbBalance) - REGISTRATION_BONUS_ETB)
  const totalBalance = spendableUsd + spendableEtb

  const [linkCopied, setLinkCopied] = useState(false)

  const usdDailyProfit = myActiveInvestmentsList
    .filter((item) => item.currency === 'USD')
    .reduce((sum, item) => sum + (Number(item.dailyProfit) || 0), 0)

  const etbDailyProfit = myActiveInvestmentsList
    .filter((item) => item.currency === 'ETB')
    .reduce((sum, item) => sum + (Number(item.dailyProfit) || 0), 0)

  const activeInvestmentUsd = myActiveInvestmentsList
    .filter((item) => item.currency === 'USD')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const activeInvestmentEtb = myActiveInvestmentsList
    .filter((item) => item.currency === 'ETB')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const actionButtons = [
    { label: 'Deposit', page: 'deposit', icon: Wallet },
    { label: 'Invest', page: 'invest', icon: TrendingUp },
    { label: 'Withdraw', page: 'withdraw', icon: ArrowDownRight },
    { label: 'Invite', page: 'invite', icon: Users },
  ]

  async function handleCopyInviteLink() {
    if (!referralLink) {
      showToast?.('Invite link is loading. Please try again.', 'error')
      return
    }
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied?.(true)
      setLinkCopied(true)
      showToast?.('Invite link copied!', 'success')
      setTimeout(() => {
        setCopied?.(false)
        setLinkCopied(false)
      }, 2000)
    } catch {
      showToast?.('Could not copy. Please copy the link manually.', 'error')
    }
  }

  const isCopied = copied || linkCopied

  const statCards = [
    {
      label: 'Daily ETB Profit',
      value: `${etbDailyProfit.toFixed(2)} Br`,
    },
    {
      label: 'Daily USD Profit',
      value: `$${usdDailyProfit.toFixed(2)}`,
    },
    {
      label: 'Active Investment ETB',
      value: `${activeInvestmentEtb.toLocaleString()} Br`,
    },
    {
      label: 'Active Investment USD',
      value: `$${activeInvestmentUsd.toFixed(2)}`,
    },
  ]

  return (
    <div className="home-page min-h-screen overflow-x-hidden bg-white pb-20">
      <div className="home-dashboard-stack w-full px-3 py-6">
        <header className="text-center">
          <h1 className="welcome-3d">Welcome to Blackrock</h1>
        </header>

        <div className="home-balance-card rounded-3xl text-white">
          <p className="home-balance-title">Total Balance</p>
          <p className="home-balance-total">${totalBalance.toFixed(2)}</p>
          <div className="home-wallet-grid">
            <div className="home-wallet-card">
              <p className="home-wallet-label">USD Wallet</p>
              <p className="home-wallet-value">${Number(usdBalance).toFixed(2)}</p>
            </div>
            <div className="home-wallet-card">
              <p className="home-wallet-label">ETB Wallet</p>
              <p className="home-wallet-value">
                {Number(etbBalance).toLocaleString()} Br
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/25 pt-4">
            <div className="rounded-xl bg-white/15 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-xs font-semibold text-white/85">USD Referral Bonus</p>
              <p className="mt-1 text-lg font-bold text-white">
                ${Number(referralEarningsUsd).toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl bg-white/15 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-xs font-semibold text-white/85">ETB Referral Bonus</p>
              <p className="mt-1 text-lg font-bold text-white">
                {Number(referralEarningsEtb).toLocaleString()} Br
              </p>
            </div>
          </div>
        </div>

        <div className="home-action-grid grid grid-cols-2 gap-3 sm:grid-cols-4">
          {actionButtons.map(({ label, page, icon: Icon }) => (
            <button
              key={page}
              type="button"
              onClick={() => setActivePage?.(page)}
              className="home-action-btn flex flex-col items-center justify-center gap-1"
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="home-metrics-grid">
          {statCards.map(({ label, value }) => (
            <div key={label} className="home-metric-card">
              <p className="home-metric-label">{label}</p>
              <p className="home-metric-value">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-800">Your Invite Link</p>
          <p className="mt-1 text-xs text-slate-500">
            Share this link to invite friends and earn referral rewards.
          </p>
          <p className="mt-3 break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-800">
            {referralLink || 'Loading invite link…'}
          </p>
          <button
            type="button"
            onClick={handleCopyInviteLink}
            disabled={!referralLink}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#84CC16] py-3 text-sm font-bold text-white shadow-md transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCopied ? <Check size={18} /> : <Copy size={18} />}
            {isCopied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  )
}
