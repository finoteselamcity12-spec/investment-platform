import supabase from '../../lib/supabase'
import { ADMIN_EMAIL, ADMIN_CREDENTIALS } from './adminStorage'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** RPC names must match SQL exactly (public schema) */
export const ADMIN_RPC = {
  stats: 'admin_get_dashboard_stats',
  pendingDeposits: 'admin_list_pending_deposits',
  withdrawals: 'admin_list_withdrawals',
  users: 'admin_list_users',
  approveDeposit: 'admin_approve_deposit',
  rejectDeposit: 'admin_reject_deposit',
  approveDepositManual: 'admin_approve_deposit_manual',
  approveWithdrawal: 'admin_approve_withdrawal',
  rejectWithdrawal: 'admin_reject_withdrawal',
  deleteUser: 'admin_delete_user',
}

function adminLog(step, payload) {
  console.log(`[Admin Supabase] ${step}`, payload)
}

function logAdminError(label, error) {
  const message = error?.message || error?.details || error?.hint || String(error)
  console.error(`[Admin Supabase] ${label} FAILED:`, message, error)
  return message
}

export function isSupabaseConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

export async function ensureAdminSupabaseSession(password) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env' }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const email = sessionData?.session?.user?.email
  if (email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    adminLog('auth', { status: 'existing_session', email })
    return { ok: true, email }
  }

  if (!password) {
    return {
      ok: false,
      error: `No Supabase session for ${ADMIN_EMAIL}. Sign in again at /admin-login.`,
    }
  }

  adminLog('auth', { status: 'signing_in', email: ADMIN_EMAIL })
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password,
  })

  if (error) {
    const msg = logAdminError('signInWithPassword', error)
    return {
      ok: false,
      error: `${msg} — Create this user in Supabase Auth → Users.`,
    }
  }

  adminLog('auth', { status: 'signed_in', userId: data.user?.id, email: data.user?.email })
  return { ok: true, user: data.user, email: data.user?.email }
}

/** Restore Supabase JWT for admin console (required for all RPC calls) */
export async function ensureSupabaseAdminAuth() {
  return ensureAdminSupabaseSession(ADMIN_CREDENTIALS.password)
}

function parseStatsPayload(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      adminLog('stats_parse', { warning: 'Could not parse stats JSON string', raw })
      return null
    }
  }
  return null
}

function logRpcResult(name, result) {
  if (result.error) {
    logAdminError(name, result.error)
    return
  }
  const data = result.data
  const summary = Array.isArray(data)
    ? { type: 'array', count: data.length, sample: data[0] ?? null }
    : { type: typeof data, data }
  adminLog(`rpc:${name}`, { ok: true, ...summary })
}

export async function fetchAdminDashboard() {
  adminLog('fetch_start', {
    configured: isSupabaseConfigured(),
    rpcNames: ADMIN_RPC,
  })

  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      errors: ['Supabase env vars not set'],
      stats: null,
      pendingDeposits: [],
      pendingWithdrawals: [],
      users: [],
    }
  }

  const authResult = await ensureSupabaseAdminAuth()
  if (!authResult.ok) {
    const err = authResult.error || 'Supabase admin authentication failed'
    adminLog('fetch_abort', { reason: 'auth', err })
    return {
      configured: true,
      errors: [err],
      stats: null,
      pendingDeposits: [],
      pendingWithdrawals: [],
      users: [],
      sessionEmail: null,
    }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const sessionEmail = sessionData?.session?.user?.email || authResult.email
  const accessToken = sessionData?.session?.access_token
  adminLog('session', {
    email: sessionEmail,
    hasToken: Boolean(accessToken),
    tokenPrefix: accessToken ? `${accessToken.slice(0, 12)}…` : null,
  })

  if (sessionEmail?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    const err = `JWT email mismatch: got "${sessionEmail}", expected "${ADMIN_EMAIL}"`
    adminLog('fetch_abort', { reason: 'email_mismatch', err })
    return {
      configured: true,
      errors: [err],
      stats: null,
      pendingDeposits: [],
      pendingWithdrawals: [],
      users: [],
      sessionEmail,
    }
  }

  const errors = []

  adminLog('rpc_batch_start', Object.values(ADMIN_RPC))

  const [statsRes, depositsRes, withdrawalsRes, usersRes] = await Promise.all([
    supabase.rpc(ADMIN_RPC.stats),
    supabase.rpc(ADMIN_RPC.pendingDeposits),
    supabase.rpc(ADMIN_RPC.withdrawals),
    supabase.rpc(ADMIN_RPC.users),
  ])

  logRpcResult(ADMIN_RPC.stats, statsRes)
  logRpcResult(ADMIN_RPC.pendingDeposits, depositsRes)
  logRpcResult(ADMIN_RPC.withdrawals, withdrawalsRes)
  logRpcResult(ADMIN_RPC.users, usersRes)

  if (statsRes.error) errors.push(logAdminError(ADMIN_RPC.stats, statsRes.error))
  if (depositsRes.error) errors.push(logAdminError(ADMIN_RPC.pendingDeposits, depositsRes.error))
  if (withdrawalsRes.error) errors.push(logAdminError(ADMIN_RPC.withdrawals, withdrawalsRes.error))
  if (usersRes.error) errors.push(logAdminError(ADMIN_RPC.users, usersRes.error))

  const statsRaw = parseStatsPayload(statsRes.data)
  const stats = statsRaw
    ? {
        totalUsers: statsRaw.total_users ?? 0,
        pendingDeposits: statsRaw.pending_deposits ?? 0,
        dailyTransactions: statsRaw.daily_transactions ?? 0,
        approvedDeposits: statsRaw.approved_deposits ?? 0,
        totalDeposits: statsRaw.total_deposits ?? 0,
        pendingWithdrawals: statsRaw.pending_withdrawals ?? 0,
      }
    : null

  const pendingDeposits = (depositsRes.data || []).map((row) => ({
    id: row.id,
    supabaseId: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    fullName: row.user_full_name,
    amount: Number(row.amount),
    currency: row.currency,
    paymentMethod: row.payment_method,
    transactionId: row.transaction_id,
    screenshot: row.proof_url,
    status: row.status,
    createdAt: row.created_at,
    source: 'supabase',
  }))

  const pendingWithdrawals = (withdrawalsRes.data || []).map((row) => ({
    id: row.id,
    supabaseId: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    userName: row.user_full_name || row.user_email,
    amount: Number(row.amount),
    currency: row.currency,
    bank: row.bank ?? null,
    accountName: row.account_name ?? null,
    accountNumber: row.account_number ?? null,
    status: row.status,
    createdAt: row.created_at,
    source: 'supabase',
  }))

  const users = (usersRes.data || []).map((row) => ({
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    usdBalance: Number(row.usd_balance) || 0,
    etbBalance: Number(row.etb_balance) || 0,
    createdAt: row.created_at,
    source: 'supabase',
  }))

  const result = {
    configured: true,
    errors,
    stats,
    pendingDeposits,
    pendingWithdrawals,
    users,
    sessionEmail,
  }

  adminLog('fetch_complete', {
    errors: errors.length,
    stats,
    pendingDeposits: pendingDeposits.length,
    pendingWithdrawals: pendingWithdrawals.length,
    users: users.length,
  })

  return result
}

export async function resolveUserId(emailOrId) {
  if (!emailOrId) return null
  if (UUID_REGEX.test(emailOrId)) return emailOrId

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', emailOrId)
    .maybeSingle()

  if (error) {
    logAdminError('resolveUserId', error)
    return null
  }
  return data?.id || null
}

function truncateProof(proof) {
  if (!proof || typeof proof !== 'string') return null
  if (proof.length <= 120000) return proof
  return proof.slice(0, 120000)
}

async function requireAdminRpcSession() {
  const auth = await ensureSupabaseAdminAuth()
  if (!auth.ok) return { ok: false, error: auth.error || 'Admin Supabase session missing' }
  return { ok: true }
}

export async function approveDepositInSupabase(deposit) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Supabase not configured' }
  }

  const sessionCheck = await requireAdminRpcSession()
  if (!sessionCheck.ok) return sessionCheck

  if (deposit.supabaseId && UUID_REGEX.test(deposit.supabaseId)) {
    adminLog('rpc_call', { fn: ADMIN_RPC.approveDeposit, deposit_id: deposit.supabaseId })
    const { data, error } = await supabase.rpc(ADMIN_RPC.approveDeposit, {
      deposit_id: deposit.supabaseId,
    })
    if (error) {
      return { ok: false, error: logAdminError(ADMIN_RPC.approveDeposit, error) }
    }
    adminLog('rpc_ok', { fn: ADMIN_RPC.approveDeposit, data })
    return { ok: true, data }
  }

  const userId = deposit.userId && UUID_REGEX.test(deposit.userId)
    ? deposit.userId
    : await resolveUserId(deposit.userEmail || deposit.userId)

  if (!userId) {
    return {
      ok: false,
      error: `No Supabase profile for "${deposit.userEmail || deposit.userId}". User must register first.`,
    }
  }

  const currency =
    deposit.currency === 'USDT' || deposit.currency === 'USD' ? 'USD' : 'ETB'

  adminLog('rpc_call', { fn: ADMIN_RPC.approveDepositManual, userId, amount: deposit.amount })
  const { data, error } = await supabase.rpc(ADMIN_RPC.approveDepositManual, {
    p_user_id: userId,
    p_amount: Number(deposit.amount),
    p_currency: currency,
    p_payment_method: deposit.paymentMethod || null,
    p_transaction_id: deposit.transactionId || null,
    p_proof_url: truncateProof(deposit.screenshot),
  })

  if (error) {
    return { ok: false, error: logAdminError(ADMIN_RPC.approveDepositManual, error) }
  }
  adminLog('rpc_ok', { fn: ADMIN_RPC.approveDepositManual, data })
  return { ok: true, data }
}

export async function rejectDepositInSupabase(deposit) {
  if (!deposit.supabaseId || !UUID_REGEX.test(deposit.supabaseId)) {
    return { ok: true, skipped: true }
  }

  const sessionCheck = await requireAdminRpcSession()
  if (!sessionCheck.ok) return sessionCheck

  const { error } = await supabase.rpc(ADMIN_RPC.rejectDeposit, {
    deposit_id: deposit.supabaseId,
  })

  if (error) {
    return { ok: false, error: logAdminError(ADMIN_RPC.rejectDeposit, error) }
  }
  return { ok: true }
}

export async function deleteUserInSupabase(userId) {
  if (!userId || !UUID_REGEX.test(userId)) {
    return { ok: false, error: 'Invalid user ID — only Supabase UUID users can be deleted from database.' }
  }

  const sessionCheck = await requireAdminRpcSession()
  if (!sessionCheck.ok) return sessionCheck

  adminLog('rpc_call', { fn: ADMIN_RPC.deleteUser, user_id: userId })
  const { error } = await supabase.rpc(ADMIN_RPC.deleteUser, { user_id: userId })
  if (error) {
    return { ok: false, error: logAdminError(ADMIN_RPC.deleteUser, error) }
  }
  adminLog('rpc_ok', { fn: ADMIN_RPC.deleteUser })
  return { ok: true }
}

export async function approveWithdrawalInSupabase(withdrawal) {
  if (!withdrawal.supabaseId || !UUID_REGEX.test(withdrawal.supabaseId)) {
    return { ok: true, skipped: true }
  }

  const sessionCheck = await requireAdminRpcSession()
  if (!sessionCheck.ok) return sessionCheck

  const { error } = await supabase.rpc(ADMIN_RPC.approveWithdrawal, {
    withdrawal_id: withdrawal.supabaseId,
  })
  if (error) {
    return { ok: false, error: logAdminError(ADMIN_RPC.approveWithdrawal, error) }
  }
  return { ok: true }
}

export async function rejectWithdrawalInSupabase(withdrawal) {
  if (!withdrawal.supabaseId || !UUID_REGEX.test(withdrawal.supabaseId)) {
    return { ok: true, skipped: true }
  }

  const sessionCheck = await requireAdminRpcSession()
  if (!sessionCheck.ok) return sessionCheck

  const { error } = await supabase.rpc(ADMIN_RPC.rejectWithdrawal, {
    withdrawal_id: withdrawal.supabaseId,
  })
  if (error) {
    return { ok: false, error: logAdminError(ADMIN_RPC.rejectWithdrawal, error) }
  }
  return { ok: true }
}

export async function fetchAdminSupabaseStats() {
  const dash = await fetchAdminDashboard()
  return {
    configured: dash.configured,
    profileCount: dash.stats?.totalUsers ?? null,
    depositCount: dash.stats?.totalDeposits ?? null,
    error: dash.errors?.[0] || null,
    errors: dash.errors,
  }
}
