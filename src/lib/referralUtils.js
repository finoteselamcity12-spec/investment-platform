/** Per-user referral link and stats (localStorage + share URL). */

export function buildReferralLink(userId) {
  if (!userId) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/register?ref=${encodeURIComponent(userId)}`
}

export function getReferralStorageKey(userId) {
  return `referral_data_${userId}`
}

export function loadReferralStats(userId) {
  if (!userId) {
    return {
      referralLink: '',
      referralCount: 0,
      earningsUsd: 0,
      earningsEtb: 0,
    }
  }

  const key = getReferralStorageKey(userId)
  const stored = JSON.parse(localStorage.getItem(key) || '{}')
  const referralLink = buildReferralLink(userId)
  const data = {
    referralCount: 0,
    earningsUsd: 0,
    earningsEtb: 0,
    ...stored,
    referralLink,
  }
  localStorage.setItem(key, JSON.stringify(data))
  return data
}

export function updateReferralStats(userId, patch) {
  if (!userId) return
  const key = getReferralStorageKey(userId)
  const current = loadReferralStats(userId)
  const next = { ...current, ...patch, referralLink: buildReferralLink(userId) }
  localStorage.setItem(key, JSON.stringify(next))
  return next
}
