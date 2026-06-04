import { useState } from 'react'
import { Copy, Check, Users, DollarSign, Coins } from 'lucide-react'
import { REFERRAL_BONUS_USD, REFERRAL_BONUS_ETB } from '../lib/platformConfig'

export default function InvitePage({ ctx = {} }) {
  const {
    referralLink = '',
    referralCount = 0,
    referralEarningsUsd = 0,
    referralEarningsEtb = 0,
    showToast,
    setCopied,
    copied,
  } = ctx

  const [localCopied, setLocalCopied] = useState(false)
  const isCopied = copied || localCopied

  async function handleCopy() {
    if (!referralLink) {
      showToast?.('Sign in to generate your referral link.', 'error')
      return
    }
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied?.(true)
      setLocalCopied(true)
      showToast?.('Referral link copied!', 'success')
      setTimeout(() => {
        setCopied?.(false)
        setLocalCopied(false)
      }, 2000)
    } catch {
      showToast?.('Could not copy link. Please copy manually.', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-white pb-24 pt-2">
      <div className="mx-auto max-w-lg space-y-6 px-4">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#84CC16]">Invite</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Share & Earn</h1>
          <p className="mt-2 text-sm text-slate-600">
            Share your link. When a friend makes their first approved deposit, you earn{' '}
            {REFERRAL_BONUS_USD} USD or {REFERRAL_BONUS_ETB} ETB.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-500">Your referral link</p>
          <p className="mt-2 break-all text-sm font-mono text-slate-800">
            {referralLink || 'Loading…'}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!referralLink}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#84CC16] py-3 font-bold text-white shadow-lg shadow-[#84CC16]/25 transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCopied ? <Check size={18} /> : <Copy size={18} />}
            {isCopied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <Users className="mx-auto text-[#84CC16]" size={22} />
            <p className="mt-2 text-xs text-slate-500">Invites</p>
            <p className="text-lg font-bold text-slate-950">{referralCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <DollarSign className="mx-auto text-[#84CC16]" size={22} />
            <p className="mt-2 text-xs text-slate-500">USD earned</p>
            <p className="text-lg font-bold text-slate-950">${referralEarningsUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <Coins className="mx-auto" size={22} style={{ color: '#FFD700' }} />
            <p className="mt-2 text-xs text-slate-500">ETB earned</p>
            <p className="text-lg font-bold text-slate-950">{referralEarningsEtb.toLocaleString()} Br</p>
          </div>
        </div>
      </div>
    </div>
  )
}
