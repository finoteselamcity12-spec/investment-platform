import supabase from './supabase'
import { isSupabaseConfigured } from './supabaseData'
import {
  REGISTRATION_BONUS_ETB,
  REGISTRATION_BONUS_USD,
  DEPOSIT_BONUS_RATE,
  WELCOME_BONUS_ACTION,
} from './platformConfig'

/** Supabase table for bonus audit (user-created public.history) */
export const HISTORY_TABLE = 'history'

/** Columns loaded for the history page (no select *) */
export const HISTORY_DISPLAY_COLUMNS =
  'id,user_id,action,currency,amount,reference_id,metadata,created_at'

const LEGACY_SIGNUP_ACTION = 'signup_bonus'

const WELCOME_BONUS_ACTION_FILTER = `action.eq.${WELCOME_BONUS_ACTION},action.eq.${LEGACY_SIGNUP_ACTION}`

const SIGNUP_BONUS_ETB_ID = 'signup-bonus-etb'
const SIGNUP_BONUS_USD_ID = 'signup-bonus-usd'

/**
 * Equivalent to:
 * SELECT count(*) FROM public.history WHERE user_id = ? AND action = ?
 */
export async function countWelcomeBonusHistory(userId) {
  if (!userId || !isSupabaseConfigured()) return 0

  const { count, error } = await supabase
    .from(HISTORY_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .or(WELCOME_BONUS_ACTION_FILTER)

  if (error) {
    console.warn(`[${HISTORY_TABLE}] welcome_bonus count failed:`, error.message)
    return 0
  }
  return count ?? 0
}

export async function countHistoryByAction(userId, action, referenceId = null) {
  if (!userId || !isSupabaseConfigured()) return 0

  let query = supabase
    .from(HISTORY_TABLE)
    .select('id', { count: 'exact', head: true })
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
 * One-time signup bonus history record — call ONLY after registration, never on login.
 */
export async function ensureSignupBonusHistoryOnce(userId, email) {
  if (!userId) return { skipped: true, reason: 'no_user_id' }

  const signupCount = await countWelcomeBonusHistory(userId)
  if (signupCount > 0) {
    mirrorSignupBonusToLocalHistory(email, userId)
    return { skipped: true, reason: 'history_exists', count: signupCount }
  }

  if (!isSupabaseConfigured()) {
    mirrorSignupBonusToLocalHistory(email, userId)
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

/** @deprecated Use ensureSignupBonusHistoryOnce on signup only — not on login. */
export async function handleLoginSignupBonusCheck(userId, email) {
  return ensureSignupBonusHistoryOnce(userId, email)
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
      (t.action === WELCOME_BONUS_ACTION || t.action === LEGACY_SIGNUP_ACTION) &&
      (t.userId === userId || t.id === `signup-bonus-${userId}`)
  )
  const hasEtb = txns.some(
    (t) =>
      t.id === `${SIGNUP_BONUS_ETB_ID}-${email}` ||
      ((t.action === WELCOME_BONUS_ACTION || t.action === LEGACY_SIGNUP_ACTION) &&
        t.currency === 'ETB' &&
        t.userId === userId)
  )
  const hasUsd = txns.some(
    (t) =>
      t.id === `${SIGNUP_BONUS_USD_ID}-${email}` ||
      ((t.action === WELCOME_BONUS_ACTION || t.action === LEGACY_SIGNUP_ACTION) &&
        t.currency === 'USD' &&
        t.userId === userId)
  )

  if (hasSignupAction && hasEtb && hasUsd) return txns

  const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
  const user = userData[email]
  const createdAt = user?.createdAt || new Date().toISOString()

  if (!hasEtb) {
    txns.unshift({
      id: `${SIGNUP_BONUS_ETB_ID}-${email}`,
      userId,
      action: WELCOME_BONUS_ACTION,
      type: 'Bonus',
      category: 'Deposits',
      title: 'Welcome Bonus (ETB)',
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
      action: WELCOME_BONUS_ACTION,
      type: 'Bonus',
      category: 'Deposits',
      title: 'Welcome Bonus (USD)',
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

  const isWelcome =
    row.action === WELCOME_BONUS_ACTION || row.action === LEGACY_SIGNUP_ACTION

  if (isWelcome && row.currency === 'MIXED') {
    const items = []
    if (meta.etb != null) {
      items.push({
        id: `${row.id}-etb`,
        userId: row.user_id,
        action: WELCOME_BONUS_ACTION,
        referenceId: row.reference_id,
        type: 'Bonus',
        title: 'Welcome Bonus (ETB)',
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
        action: WELCOME_BONUS_ACTION,
        referenceId: row.reference_id,
        type: 'Bonus',
        title: 'Welcome Bonus (USD)',
        amount: Number(meta.usd),
        currency: 'USD',
        status: 'Completed',
        date: createdAt,
      })
    }
    if (items.length > 0) return items
  }

  const currency = row.currency === 'USDT' ? 'USD' : row.currency || 'ETB'

  if (row.action === 'withdrawal') {
    const status =
      meta.status === 'approved' || meta.status === 'successful' || meta.status === 'success'
        ? 'Completed'
        : meta.status === 'rejected'
          ? 'Rejected'
          : 'Pending Admin Approval'
    return [
      {
        id: row.id,
        userId: row.user_id,
        action: row.action,
        referenceId: row.reference_id,
        type: 'Withdrawal',
        category: 'Withdrawals',
        title: `Withdrawal (${currency})`,
        amount: Number(row.amount) || 0,
        currency,
        status,
        date: createdAt,
      },
    ]
  }

  if (row.action === 'deposit') {
    const status =
      meta.status === 'successful' || meta.status === 'approved' || meta.status === 'success'
        ? 'Completed'
        : meta.status === 'rejected'
          ? 'Rejected'
          : 'Pending Admin Approval'
    return [
      {
        id: row.id,
        userId: row.user_id,
        action: row.action,
        referenceId: row.reference_id,
        type: 'Deposit',
        category: 'Deposits',
        title: `Deposit (${currency})`,
        amount: Number(row.amount) || 0,
        currency,
        status,
        date: createdAt,
      },
    ]
  }

  const titleByAction = {
    [WELCOME_BONUS_ACTION]: 'Welcome Bonus',
    [LEGACY_SIGNUP_ACTION]: 'Welcome Bonus',
    deposit_bonus: 'Deposit Bonus (10%)',
    referral_bonus: 'Referral Bonus',
    invite_bonus: 'Referral Bonus',
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

/** All bonus/history rows for one user — .eq('user_id', userId) only */
export async function fetchBonusHistory(userId) {
  if (!userId || !isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select(HISTORY_DISPLAY_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn(`[${HISTORY_TABLE}] fetch failed:`, error.message)
    return []
  }

  return data || []
}

/**
 * History page: current user only, welcome_bonus rows only.
 * .eq('user_id', userId).eq('action', 'welcome_bonus')
 */
export async function fetchWelcomeBonusHistory(userId) {
  if (!userId || !isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select(HISTORY_DISPLAY_COLUMNS)
    .eq('user_id', userId)
    .eq('action', WELCOME_BONUS_ACTION)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn(`[${HISTORY_TABLE}] welcome_bonus fetch failed:`, error.message)
    return []
  }

  return dedupeTransactions((data || []).flatMap(historyRowToTransactions))
}

function depositWithdrawalStatusLabel(status) {
  if (status === 'approved' || status === 'successful' || status === 'success') return 'Completed'
  if (status === 'pending') return 'Pending Admin Approval'
  if (status === 'rejected') return 'Rejected'
  return status || 'Pending'
}

async function fetchUserDepositsAndWithdrawals(userId) {
  if (!userId || !isSupabaseConfigured()) return []

  const [depositsRes, withdrawalsRes] = await Promise.all([
    supabase
      .from('deposits')
      .select('id, currency, amount_etb, amount_usd, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('withdrawals')
      .select('id, currency, amount_etb, amount_usd, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  if (depositsRes.error) {
    console.warn('[deposits] user fetch failed:', depositsRes.error.message)
  }
  if (withdrawalsRes.error) {
    console.warn('[withdrawals] user fetch failed:', withdrawalsRes.error.message)
  }

  const items = []

  for (const row of depositsRes.data || []) {
    const currency = row.currency === 'USDT' ? 'USD' : row.currency || 'ETB'
    items.push({
      id: `deposit-${row.id}`,
      userId,
      type: 'Deposit',
      category: 'Deposits',
      title: `Deposit (${currency})`,
      amount: Number(row.amount_usd ?? row.amount_etb ?? row.amount) || 0,
      currency,
      status: depositWithdrawalStatusLabel(row.status),
      date: row.created_at,
    })
  }

  for (const row of withdrawalsRes.data || []) {
    const currency = row.currency === 'USDT' ? 'USD' : row.currency || 'ETB'
    items.push({
      id: `withdrawal-${row.id}`,
      userId,
      type: 'Withdrawal',
      category: 'Withdrawals',
      title: `Withdrawal (${currency})`,
      amount: Number(row.amount_usd ?? row.amount_etb ?? row.amount) || 0,
      currency,
      status: depositWithdrawalStatusLabel(row.status),
      date: row.created_at,
    })
  }

  return items
}

/**
 * Personal transaction history for the signed-in user only.
 * Supabase: history, deposits, withdrawals — all filtered with .eq('user_id', userId).
 */
export async function fetchUserHistory(userId, email) {
  if (!userId) {
    return loadLocalTransactionsForUser(null, email)
  }

  if (email) {
    mirrorSignupBonusToLocalHistory(email, userId)
  }

  const [remoteRows, depositWithdrawalRows] = await Promise.all([
    fetchBonusHistory(userId),
    fetchUserDepositsAndWithdrawals(userId),
  ])

  const fromServer = remoteRows.flatMap(historyRowToTransactions)
  const historyWithdrawalRefs = new Set(
    remoteRows
      .filter((r) => r.action === 'withdrawal' && r.reference_id)
      .map((r) => String(r.reference_id))
  )
  const historyDepositRefs = new Set(
    remoteRows
      .filter((r) => r.action === 'deposit' && r.reference_id)
      .map((r) => String(r.reference_id))
  )
  const dedupedDepositWithdrawalRows = depositWithdrawalRows.filter((t) => {
    if (t.type === 'Withdrawal') {
      const ref = String(t.id).replace(/^withdrawal-/, '')
      return !historyWithdrawalRefs.has(ref)
    }
    if (t.type === 'Deposit') {
      const ref = String(t.id).replace(/^deposit-/, '')
      return !historyDepositRefs.has(ref)
    }
    return true
  })
  const serverIds = new Set([
    ...fromServer.map((t) => t.id),
    ...dedupedDepositWithdrawalRows.map((t) => t.id),
  ])

  const localTxns = loadLocalTransactionsForUser(userId, email).filter((t) => {
    if (t.userId && t.userId !== userId) return false
    if (serverIds.has(t.id)) return false
    const refKey = t.referenceId || t.reference_id
    if (refKey && fromServer.some((s) => s.referenceId === refKey && s.action === t.action)) {
      return false
    }
    return true
  })

  const merged = dedupeTransactions([...fromServer, ...dedupedDepositWithdrawalRows, ...localTxns])
  merged.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  return merged
}
