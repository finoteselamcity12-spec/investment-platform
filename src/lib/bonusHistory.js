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

  const txns = loadLocalTransactionsForUser(userId, email)
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

  if (userId) saveLocalTransactionsForUser(userId, txns)
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
  const txns = loadLocalTransactionsForUser(userId, email)
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

  if (userId) saveLocalTransactionsForUser(userId, txns)
  return txns
}

export function transactionsStorageKey(userId) {
  return userId ? `user_transactions_${userId}` : 'user_transactions'
}

export function dedupeTransactions(items) {
  const seen = new Set()
  return (items || []).filter((item) => {
    const key =
      item.id ||
      `${item.action || item.type}-${item.referenceId || item.reference_id || ''}-${item.date || item.created_at}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function loadLocalTransactionsForUser(userId, email) {
  const scopedKey = transactionsStorageKey(userId)
  let txns = []

  try {
    txns = JSON.parse(localStorage.getItem(scopedKey) || '[]')
  } catch {
    txns = []
  }

  if (txns.length === 0 && (userId || email)) {
    const legacy = JSON.parse(localStorage.getItem('user_transactions') || '[]')
    txns = legacy.filter((t) => {
      if (userId && t.userId === userId) return true
      if (email && typeof t.id === 'string' && t.id.includes(email)) return true
      return false
    })
    if (userId && txns.length > 0) {
      localStorage.setItem(scopedKey, JSON.stringify(txns))
    }
  }

  return dedupeTransactions(
    txns.filter((t) => {
      if (!userId) return true
      if (t.userId && t.userId !== userId) return false
      if (email && !t.userId && typeof t.id === 'string' && !t.id.includes(email)) return false
      return true
    })
  )
}

export function saveLocalTransactionsForUser(userId, txns) {
  const key = transactionsStorageKey(userId)
  localStorage.setItem(key, JSON.stringify(dedupeTransactions(txns)))
}

function historyRowToTransactions(row) {
  const createdAt = row.created_at || new Date().toISOString()
  const meta = row.metadata || {}

  if (row.action === 'signup_bonus' && row.currency === 'MIXED') {
    const items = []
    if (meta.etb != null) {
      items.push({
        id: `${row.id}-etb`,
        userId: row.user_id,
        action: 'signup_bonus',
        referenceId: row.reference_id,
        type: 'Bonus',
        title: 'Sign-up Bonus (ETB)',
        amount: Number(meta.etb),
        currency: 'ETB',
        status: 'Completed',
        date: createdAt,
      })
    }
    if (meta.usd != null) {
      items.push({
        id: `${row.id}-usd`,
        userId: row.user_id,
        action: 'signup_bonus',
        referenceId: row.reference_id,
        type: 'Bonus',
        title: 'Sign-up Bonus (USD)',
        amount: Number(meta.usd),
        currency: 'USD',
        status: 'Completed',
        date: createdAt,
      })
    }
    if (items.length > 0) return items
  }

  const titleByAction = {
    signup_bonus: 'Sign-up Bonus',
    deposit_bonus: 'Deposit Bonus (10%)',
    referral_bonus: 'Referral Bonus',
  }

  return [
    {
      id: row.id,
      userId: row.user_id,
      action: row.action,
      referenceId: row.reference_id,
      type: 'Bonus',
      title: titleByAction[row.action] || row.action,
      amount: Number(row.amount) || 0,
      currency: row.currency === 'MIXED' ? 'USD' : row.currency || 'USD',
      status: 'Completed',
      date: createdAt,
    },
  ]
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

/** Supabase history for current user only, merged with scoped local rows, deduped & sorted */
export async function fetchUserHistory(userId, email) {
  if (!userId) {
    return loadLocalTransactionsForUser(null, email)
  }

  const remoteRows = await fetchBonusHistory(userId)
  const fromServer = remoteRows.flatMap(historyRowToTransactions)
  const localOnly = loadLocalTransactionsForUser(userId, email).filter(
    (t) => !t.action || !fromServer.some((s) => s.id === t.id)
  )

  const merged = dedupeTransactions([...fromServer, ...localOnly])
  merged.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  return merged
}
