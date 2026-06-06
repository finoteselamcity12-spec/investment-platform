import supabase from '../../lib/supabase'
import { fetchUserBalances } from '../../lib/supabaseData'
import { ADMIN_EMAIL, ADMIN_CREDENTIALS } from './adminStorage'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** RPC function names (public schema) */
export const ADMIN_RPC = {
  debug: 'admin_debug_auth',
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

/**
 * Parameter keys MUST match PostgreSQL function argument names exactly.
 * PostgREST maps: supabase.rpc('fn', { p_deposit_id: uuid }) → fn(p_deposit_id uuid)
 */
export const ADMIN_RPC_PARAMS = {
  approveDeposit: ['p_deposit_id'],
  rejectDeposit: ['p_deposit_id'],
  approveDepositManual: [
    'p_user_id',
    'p_amount',
    'p_currency',
    'p_payment_method',
    'p_transaction_id',
    'p_proof_url',
  ],
  approveWithdrawal: ['p_withdrawal_id'],
  rejectWithdrawal: ['p_withdrawal_id'],
  deleteUser: ['p_user_id'],
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
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  let urlHost
  try {
    urlHost = url ? new URL(url).host : null
  } catch {
    urlHost = 'invalid-url'
  }
  adminLog('env_check', { hasUrl: Boolean(url), hasKey: Boolean(key), urlHost })
  return Boolean(url && key)
}

export async function ensureAdminSupabaseSession(password) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env' }
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    adminLog('getSession_error', sessionError)
  }

  const email = sessionData?.session?.user?.email
  if (email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    adminLog('auth', { status: 'existing_session', email, userId: sessionData.session.user.id })
    return { ok: true, email, userId: sessionData.session.user.id }
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

  await supabase.auth.getSession()

  adminLog('auth', { status: 'signed_in', userId: data.user?.id, email: data.user?.email })
  return { ok: true, user: data.user, email: data.user?.email, userId: data.user?.id }
}

export async function ensureSupabaseAdminAuth() {
  return ensureAdminSupabaseSession(ADMIN_CREDENTIALS.password)
}

/** Normalize RPC row keys (PostgREST may vary casing) */
function pick(row, ...keys) {
  if (!row || typeof row !== 'object') return undefined
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key]
  }
  return undefined
}

function parseStatsPayload(raw) {
  adminLog('stats_raw', { type: typeof raw, raw })

  if (raw == null) return null

  let obj = raw
  if (Array.isArray(raw)) {
    obj = raw[0] ?? null
    adminLog('stats_unwrap_array', obj)
  }
  if (!obj) return null

  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj)
    } catch {
      adminLog('stats_parse_fail', { raw })
      return null
    }
  }

  if (typeof obj !== 'object') return null

  return {
    total_users: pick(obj, 'total_users', 'totalUsers') ?? 0,
    pending_deposits: pick(obj, 'pending_deposits', 'pendingDeposits') ?? 0,
    daily_transactions: pick(obj, 'daily_transactions', 'dailyTransactions') ?? 0,
    approved_deposits: pick(obj, 'approved_deposits', 'approvedDeposits') ?? 0,
    total_deposits: pick(obj, 'total_deposits', 'totalDeposits') ?? 0,
    pending_withdrawals: pick(obj, 'pending_withdrawals', 'pendingWithdrawals') ?? 0,
  }
}

function logRpcResult(name, result) {
  adminLog(`rpc_raw:${name}`, {
    hasError: Boolean(result.error),
    error: result.error ?? null,
    dataType: Array.isArray(result.data) ? 'array' : typeof result.data,
    dataLength: Array.isArray(result.data) ? result.data.length : undefined,
    data: result.data,
    status: result.status,
    statusText: result.statusText,
  })

  if (result.error) {
    logAdminError(name, result.error)
  }
}

async function runAdminDebug() {
  const { data, error } = await supabase.rpc(ADMIN_RPC.debug)
  if (error) {
    adminLog('debug_rpc_unavailable', {
      hint: 'Run supabase/migrations/007_fix_admin_auth_and_debug.sql',
      error: error.message,
    })
    return null
  }
  adminLog('debug_auth', data)
  return data
}

export async function fetchAdminDashboard() {
  adminLog('fetch_start', { rpcNames: ADMIN_RPC })

  if (!isSupabaseConfigured()) {
    return emptyDashboard(['Supabase env vars not set'])
  }

  const authResult = await ensureSupabaseAdminAuth()
  if (!authResult.ok) {
    return emptyDashboard([authResult.error || 'Supabase admin authentication failed'])
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const sessionEmail = sessionData?.session?.user?.email || authResult.email
  adminLog('session', {
    email: sessionEmail,
    userId: sessionData?.session?.user?.id,
    hasToken: Boolean(sessionData?.session?.access_token),
  })

  if (sessionEmail?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return emptyDashboard([
      `JWT email mismatch: got "${sessionEmail}", expected "${ADMIN_EMAIL}"`,
    ])
  }

  await runAdminDebug()

  const errors = []

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

  // Fallback: if RPCs failed or returned no rows, attempt direct queries as admin
  if (errors.length > 0 || (!statsRes.data && (!depositsRes.data || !usersRes.data))) {
    try {
      console.log('[Admin Supabase] falling back to direct queries for stats')
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [usersCountRes, pendingDepRes, pendingWithRes, dailyRes, depositRowsRes, allUsersRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('deposits').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('history').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('deposits').select('*, profiles!inner(email, full_name)').order('created_at', { ascending: false }).eq('status', 'pending'),
        supabase.from('profiles').select('*, balances(etb_balance, usd_balance)').order('created_at', { ascending: false }),
      ])

      if (!statsRes.data) {
        statsRes.data = [{
          total_users: usersCountRes.count ?? 0,
          pending_deposits: pendingDepRes.count ?? 0,
          pending_withdrawals: pendingWithRes.count ?? 0,
          daily_transactions: dailyRes.count ?? 0,
        }]
      }

      if ((!depositsRes.data || depositsRes.data.length === 0) && depositRowsRes.data) {
        depositsRes.data = depositRowsRes.data
      }

      if ((!usersRes.data || usersRes.data.length === 0) && allUsersRes.data) {
        usersRes.data = allUsersRes.data
      }
    } catch (fallbackErr) {
      console.warn('[Admin Supabase] direct queries fallback failed:', fallbackErr)
    }
  }

  const statsParsed = parseStatsPayload(statsRes.data)
  const stats = statsParsed
    ? {
        totalUsers: Number(statsParsed.total_users) || 0,
        pendingDeposits: Number(statsParsed.pending_deposits) || 0,
        dailyTransactions: Number(statsParsed.daily_transactions) || 0,
        approvedDeposits: Number(statsParsed.approved_deposits) || 0,
        totalDeposits: Number(statsParsed.total_deposits) || 0,
        pendingWithdrawals: Number(statsParsed.pending_withdrawals) || 0,
      }
    : statsRes.error
      ? null
      : {
          totalUsers: 0,
          pendingDeposits: 0,
          dailyTransactions: 0,
          approvedDeposits: 0,
          totalDeposits: 0,
          pendingWithdrawals: 0,
        }

  const depositRows = Array.isArray(depositsRes.data) ? depositsRes.data : []
  const withdrawalRows = Array.isArray(withdrawalsRes.data) ? withdrawalsRes.data : []
  const userRows = Array.isArray(usersRes.data) ? usersRes.data : []

  if (!depositsRes.error && depositRows.length === 0) {
    adminLog('deposits_empty', 'RPC ok but 0 pending rows (status=pending in DB?)')
  }
  if (!usersRes.error && userRows.length === 0) {
    adminLog('users_empty', 'RPC ok but 0 profiles — check public.profiles table has rows')
  }

  const pendingDeposits = depositRows.map((row) => ({
    id: pick(row, 'id'),
    supabaseId: pick(row, 'id'),
    userId: pick(row, 'user_id', 'userId'),
    userEmail: pick(row, 'user_email', 'userEmail'),
    fullName: pick(row, 'user_full_name', 'userFullName'),
    amount: Number(pick(row, 'amount_usd', 'amount_etb', 'amount')) || 0,
    currency: pick(row, 'currency'),
    paymentMethodId: pick(row, 'payment_method_id', 'paymentMethodId', 'payment_method', 'paymentMethod'),
    transactionId: pick(row, 'transaction_id', 'transactionId'),
    screenshot: pick(row, 'proof_url', 'proofUrl', 'screenshot_url', 'screenshotUrl') || null,
    status: pick(row, 'status'),
    createdAt: pick(row, 'created_at', 'createdAt'),
    source: 'supabase',
  }))

  const pendingWithdrawals = withdrawalRows.map((row) => ({
    id: pick(row, 'id'),
    supabaseId: pick(row, 'id'),
    userId: pick(row, 'user_id', 'userId'),
    userEmail: pick(row, 'user_email', 'userEmail'),
    userName: pick(row, 'user_full_name', 'userFullName') || pick(row, 'user_email', 'userEmail'),
    amount: Number(pick(row, 'amount_usd', 'amount_etb', 'amount')) || 0,
    currency: pick(row, 'currency'),
    bank: pick(row, 'bank') ?? null,
    accountName: pick(row, 'account_name', 'accountName') ?? null,
    accountNumber: pick(row, 'account_number', 'accountNumber') ?? null,
    status: pick(row, 'status'),
    createdAt: pick(row, 'created_at', 'createdAt'),
    source: 'supabase',
  }))

  const users = userRows.map((row) => ({
    id: pick(row, 'user_id', 'userId', 'id'),
    email: pick(row, 'email'),
    fullName: pick(row, 'full_name', 'fullName'),
    usdBalance: Number(pick(row, 'usd_wallet', 'usdBalance')) || 0,
    etbBalance: Number(pick(row, 'etb_wallet', 'etbBalance')) || 0,
    createdAt: pick(row, 'created_at', 'createdAt'),
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
    _debug: {
      statsResOk: !statsRes.error,
      usersCount: users.length,
      depositsCount: pendingDeposits.length,
    },
  }

  adminLog('fetch_complete', result)

  return result
}

function emptyDashboard(errors) {
  adminLog('fetch_abort', { errors })
  return {
    configured: true,
    errors,
    stats: null,
    pendingDeposits: [],
    pendingWithdrawals: [],
    users: [],
    sessionEmail: null,
  }
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

/**
 * Proof for DB must be plain TEXT — never base64/data URLs (breaks JSONB columns).
 */
function proofForRpc(screenshot) {
  if (screenshot == null || screenshot === '') return null
  if (typeof screenshot !== 'string') return null

  const trimmed = screenshot.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('data:')) {
    adminLog('proof_skipped', { reason: 'data_url_not_stored_in_db', length: trimmed.length })
    return null
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed)
      return trimmed
    } catch {
      adminLog('proof_skipped', { reason: 'invalid_json_string' })
      return null
    }
  }

  if (trimmed.length > 8000) {
    adminLog('proof_skipped', { reason: 'too_long', length: trimmed.length })
    return null
  }

  return trimmed
}

function normalizeRpcUuid(value, label) {
  if (value == null || value === '') {
    adminLog('rpc_uuid_invalid', { label, value, reason: 'empty' })
    return null
  }
  const str = String(value).trim()
  if (!UUID_REGEX.test(str)) {
    adminLog('rpc_uuid_invalid', { label, value: str, reason: 'not_uuid' })
    return null
  }
  return str
}

function parseRpcJsonData(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch (err) {
      adminLog('rpc_parse_json_failed', { data, error: err?.message })
    }
  }
  return data
}

async function callAdminRpc(fnName, params = {}) {
  if (typeof params === 'string') {
    console.error('[Admin Supabase] INVALID RPC PAYLOAD — must be object, not string:', params)
    throw new Error('RPC payload must be a plain object, not JSON.stringify() output')
  }
  if (Array.isArray(params)) {
    console.error('[Admin Supabase] INVALID RPC PAYLOAD — must be object, not array:', params)
    throw new Error('RPC payload must be a plain object, not an array')
  }

  const cleanParams = {}
  Object.entries(params).forEach(([key, val]) => {
    if (val === undefined) return
    cleanParams[key] = val
  })

  console.log(`[Admin Supabase] >>> RPC CALL: ${fnName}`)
  console.log('[Admin Supabase] PAYLOAD (plain object):', cleanParams)
  console.log('[Admin Supabase] PAYLOAD (JSON.stringify):', JSON.stringify(cleanParams))
  console.log('[Admin Supabase] PAYLOAD types:', Object.fromEntries(
    Object.entries(cleanParams).map(([k, v]) => [k, v === null ? 'null' : typeof v])
  ))

  adminLog(`rpc_send:${fnName}`, { params: cleanParams })

  const result = await supabase.rpc(fnName, cleanParams)

  adminLog(`rpc_recv:${fnName}`, {
    error: result.error?.message ?? null,
    data: result.data,
    status: result.status,
  })

  return result
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

  const depositUuid = normalizeRpcUuid(deposit.supabaseId, 'p_deposit_id')

  if (depositUuid) {
    const approvePayload = { p_deposit_id: depositUuid }
    const { data, error } = await callAdminRpc(ADMIN_RPC.approveDeposit, approvePayload)
    if (error) {
      console.error('Approve error:', error)
      return { ok: false, error: logAdminError(ADMIN_RPC.approveDeposit, error) }
    }
    console.log('Approved:', data)
    const parsedData = parseRpcJsonData(data)
    const rpcUserId = normalizeRpcUuid(parsedData?.user_id ?? parsedData?.userId, 'user_id')
    const requestUserId = normalizeRpcUuid(deposit.userId, 'user_id')
    const resolvedUserId = rpcUserId || requestUserId || (await resolveUserId(deposit.userEmail || deposit.userId))
    const balances = resolvedUserId ? await fetchUserBalances(resolvedUserId) : null
    return { ok: true, data: parsedData, userId: resolvedUserId, balances }
  }

  const userId =
    normalizeRpcUuid(deposit.userId, 'user_id') ||
    (await resolveUserId(deposit.userEmail || deposit.userId))

  if (!userId) {
    return {
      ok: false,
      error: `No Supabase profile for "${deposit.userEmail || deposit.userId}". User must register first.`,
    }
  }

  const currency =
    deposit.currency === 'USDT' || deposit.currency === 'USD' ? 'USD' : 'ETB'

  const manualParams = {
    p_user_id: userId,
    p_amount: Number(deposit.amount),
    p_currency: String(currency),
    p_payment_method: deposit.paymentMethod ? String(deposit.paymentMethod) : null,
    p_transaction_id: deposit.transactionId ? String(deposit.transactionId) : null,
    p_proof_url: proofForRpc(deposit.screenshot),
  }

  const { data, error } = await callAdminRpc(ADMIN_RPC.approveDepositManual, manualParams)

  if (error) {
    console.error('Approve error:', error)
    return { ok: false, error: logAdminError(ADMIN_RPC.approveDepositManual, error) }
  }
  console.log('Approved:', data)
  const parsedData = parseRpcJsonData(data)
  const rpcUserId = normalizeRpcUuid(parsedData?.user_id ?? parsedData?.userId, 'user_id')
  const resolvedUserId = rpcUserId || userId
  const balances = resolvedUserId ? await fetchUserBalances(resolvedUserId) : null
  return { ok: true, data: parsedData, userId: resolvedUserId, balances }
}

export async function rejectDepositInSupabase(deposit) {
  const depositUuid = normalizeRpcUuid(deposit.supabaseId, 'p_deposit_id')
  if (!depositUuid) {
    adminLog('reject_skipped', { reason: 'local_only_deposit', id: deposit.id })
    return { ok: true, skipped: true }
  }

  const sessionCheck = await requireAdminRpcSession()
  if (!sessionCheck.ok) return sessionCheck

  const rejectPayload = { p_deposit_id: depositUuid }
  const { error } = await callAdminRpc(ADMIN_RPC.rejectDeposit, rejectPayload)

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

  const deletePayload = { p_user_id: userId }
  const { error } = await callAdminRpc(ADMIN_RPC.deleteUser, deletePayload)
  if (error) {
    return { ok: false, error: logAdminError(ADMIN_RPC.deleteUser, error) }
  }
  return { ok: true }
}

export async function approveWithdrawalInSupabase(withdrawal) {
  if (!withdrawal.supabaseId || !UUID_REGEX.test(withdrawal.supabaseId)) {
    return { ok: true, skipped: true }
  }

  const sessionCheck = await requireAdminRpcSession()
  if (!sessionCheck.ok) return sessionCheck

  const wid = normalizeRpcUuid(withdrawal.supabaseId, 'p_withdrawal_id')
  if (!wid) return { ok: true, skipped: true }

  const { error } = await callAdminRpc(ADMIN_RPC.approveWithdrawal, {
    p_withdrawal_id: wid,
  })
  if (error) {
    console.error('Approve withdrawal error:', error)
    return { ok: false, error: logAdminError(ADMIN_RPC.approveWithdrawal, error) }
  }
  console.log('Approved withdrawal:', wid)
  return { ok: true }
}

export async function rejectWithdrawalInSupabase(withdrawal) {
  if (!withdrawal.supabaseId || !UUID_REGEX.test(withdrawal.supabaseId)) {
    return { ok: true, skipped: true }
  }

  const sessionCheck = await requireAdminRpcSession()
  if (!sessionCheck.ok) return sessionCheck

  const wid = normalizeRpcUuid(withdrawal.supabaseId, 'p_withdrawal_id')
  if (!wid) return { ok: true, skipped: true }

  // Refund the user's balance first by calling process_transaction as a deposit
  try {
    const refundAmount = withdrawal.amount_etb ?? withdrawal.amount_usd ?? withdrawal.amount
    if (refundAmount && Number(refundAmount) > 0) {
      console.log('[Admin Supabase] refunding withdrawal before reject', { withdrawalId: wid, refundAmount, currency: withdrawal.currency })
      const refundRes = await supabase.rpc('process_transaction', {
        p_user_id: withdrawal.user_id,
        p_type: 'deposit',
        p_amount: Number(refundAmount),
        p_currency: withdrawal.currency,
        p_reference_id: null,
      })
      console.log('[Admin Supabase] refund RPC result:', refundRes)
      if (refundRes?.error) {
        // Log and continue to reject — admin may retry refund separately
        logAdminError('refund_before_reject', refundRes.error)
      }
    }
  } catch (err) {
    console.error('[Admin Supabase] refund failed:', err)
  }

  const { error } = await callAdminRpc(ADMIN_RPC.rejectWithdrawal, {
    p_withdrawal_id: wid,
  })
  if (error) {
    return { ok: false, error: logAdminError(ADMIN_RPC.rejectWithdrawal, error) }
  }
  console.log('Rejected withdrawal:', wid)
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
