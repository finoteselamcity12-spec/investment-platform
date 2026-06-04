import supabase from './supabase'
import { isSupabaseConfigured } from './supabaseData'
import {
  REGISTRATION_BONUS_ETB,
  REGISTRATION_BONUS_USD,
  DEPOSIT_BONUS_RATE,
} from './platformConfig'

/** Supabase table for bonus audit (user-created public.history) */
export const HISTORY_TABLE = 'history'

const SIGNUP_BONUS_ETB_ID = 'signup-bonus-etb'
const SIGNUP_BONUS_USD_ID = 'signup-bonus-usd'

/**
 * Equivalent to:
 * SELECT count(*) FROM public.history WHERE user_id = ? AND action = ?
 */
export async function countHistoryByAction(userId, action, referenceId = null) {
  if (!userId || !isSupabaseConfigured()) return 0

  let query = supabase
    .from(HISTORY_TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)

  if (referenceId) {
    query = query.eq('reference_id', referenceId)
  }

  const { count, error } = await query
  if (error) {
    console.warn(`[${HISTORY_TABLE}] count failed:`, error.message)
    return 0
  }
  return count ?? 0
}

export async function hasBonusHistoryAction(userId, action, referenceId = null) {
  const total = await countHistoryByAction(userId, action, referenceId)
  return total > 0
}

/**
 * Login guard: if signup_bonus count > 0, do not grant again.
 */
export async function handleLoginSignupBonusCheck(userId, email) {
  if (!userId) return { skipped: true, reason: 'no_user_id' }

  const signupCount = await countHistoryByAction(userId, 'signup_bonus')
  if (signupCount > 0) {
    console.log('[Auth] signup_bonus history count:', signupCount, '— skipping grant')
    mirrorSignupBonusToLocalHistory(email, userId)
    return { skipped: true, reason: 'history_exists', count: signupCount }
  }

  if (!isSupabaseConfigured()) {
    return { skipped: true, reason: 'supabase_not_configured' }
  }

  const { data, error } = await supabase.rpc('grant_signup_bonus_if_missing', {
    p_user_id: userId,
  })

  if (error) {
    console.warn('[signup_bonus] grant RPC failed:', error.message)
    return { skipped: true, reason: 'rpc_error', error }
  }

  const skipped = Boolean(data?.skipped)
  if (!skipped) {
    mirrorSignupBonusToLocalHistory(email, userId)
  }

  return { skipped, granted: !skipped, data }
}

export async function hasDepositBonusForDeposit(userId, depositId) {
  if (!userId || !depositId) return false
  const count = await countHistoryByAction(userId, 'deposit_bonus', depositId)
  return count > 0
}

export function mirrorSignupBonusToLocalHistory(email, userId) {
  if (!email) return

  const txns = JSON.parse(localStorage.getItem('user_transactions') || '[]')
  const hasSignupAction = txns.some(
    (t) =>
      t.action === 'signup_bonus' &&
      (t.userId === userId || t.id === `signup-bonus-${userId}`)
  )
  const hasEtb = txns.some(
    (t) =>
      t.id === `${SIGNUP_BONUS_ETB_ID}-${email}` ||
      (t.action === 'signup_bonus' && t.currency === 'ETB' && t.userId === userId)
  )
  const hasUsd = txns.some(
    (t) =>
      t.id === `${SIGNUP_BONUS_USD_ID}-${email}` ||
      (t.action === 'signup_bonus' && t.currency === 'USD' && t.userId === userId)
  )

  if (hasSignupAction && hasEtb && hasUsd) return txns

  const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
  const user = userData[email]
  const createdAt = user?.createdAt || new Date().toISOString()

  if (!hasEtb) {
    txns.unshift({
      id: `${SIGNUP_BONUS_ETB_ID}-${email}`,
      userId,
      action: 'signup_bonus',
      type: 'Bonus',
      category: 'Deposits',
      title: 'Sign-up Bonus (ETB)',
      amount: REGISTRATION_BONUS_ETB,
      currency: 'ETB',
      status: 'Completed',
      date: createdAt,
    })
  }

  if (!hasUsd) {
    txns.unshift({
      id: `${SIGNUP_BONUS_USD_ID}-${email}`,
      userId,
      action: 'signup_bonus',
      type: 'Bonus',
      category: 'Deposits',
      title: 'Sign-up Bonus (USD)',
      amount: REGISTRATION_BONUS_USD,
      currency: 'USD',
      status: 'Completed',
      date: createdAt,
    })
  }

  localStorage.setItem('user_transactions', JSON.stringify(txns))
  return txns
}

export function recordDepositBonusLocal({
  userId,
  email,
  depositId,
  depositAmount,
  currency,
  bonusAmount,
}) {
  const bonus =
    bonusAmount ?? Math.round(Number(depositAmount) * DEPOSIT_BONUS_RATE * 100) / 100
  const txns = JSON.parse(localStorage.getItem('user_transactions') || '[]')
  const entryId = `deposit-bonus-${depositId || `${Date.now()}`}`

  if (txns.some((t) => t.action === 'deposit_bonus' && t.referenceId === depositId)) {
    return txns
  }
  if (txns.some((t) => t.id === entryId)) return txns

  txns.unshift({
    id: entryId,
    userId,
    action: 'deposit_bonus',
    referenceId: depositId,
    type: 'Bonus',
    category: 'Deposits',
    title: `Deposit Bonus (${Math.round(DEPOSIT_BONUS_RATE * 100)}%)`,
    amount: bonus,
    currency: currency === 'USDT' ? 'USD' : currency,
    status: 'Completed',
    date: new Date().toISOString(),
  })

  localStorage.setItem('user_transactions', JSON.stringify(txns))
  return txns
}

export async function fetchBonusHistory(userId) {
  if (!userId || !isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select('id, action, currency, amount, reference_id, metadata, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn(`[${HISTORY_TABLE}] fetch failed:`, error.message)
    return []
  }
  return data || []
}
