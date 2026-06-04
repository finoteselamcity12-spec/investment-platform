import supabase from './supabase'
import { isSupabaseConfigured } from './supabaseData'
import {
  REGISTRATION_BONUS_ETB,
  REGISTRATION_BONUS_USD,
  DEPOSIT_BONUS_RATE,
} from './platformConfig'

const SIGNUP_BONUS_ETB_ID = 'signup-bonus-etb'
const SIGNUP_BONUS_USD_ID = 'signup-bonus-usd'

export async function hasBonusHistoryAction(userId, action, referenceId = null) {
  if (!userId || !isSupabaseConfigured()) return false

  let query = supabase
    .from('bonus_history')
    .select('id')
    .eq('user_id', userId)
    .eq('action', action)
    .limit(1)

  if (referenceId) {
    query = query.eq('reference_id', referenceId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.warn('[bonus_history] lookup failed:', error.message)
    return false
  }
  return Boolean(data?.id)
}

/**
 * Login/signup guard: never grant signup bonus if history row exists.
 */
export async function handleLoginSignupBonusCheck(userId, email) {
  if (!userId) return { skipped: true, reason: 'no_user_id' }

  const historyExists = await hasBonusHistoryAction(userId, 'signup_bonus')
  if (historyExists) {
    mirrorSignupBonusToLocalHistory(email, userId)
    return { skipped: true, reason: 'history_exists' }
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
    .from('bonus_history')
    .select('id, action, currency, amount, reference_id, metadata, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[bonus_history] fetch failed:', error.message)
    return []
  }
  return data || []
}
