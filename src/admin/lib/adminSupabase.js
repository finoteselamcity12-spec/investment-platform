import supabase from '../../lib/supabase'
import { ADMIN_EMAIL } from './adminStorage'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isSupabaseConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

function logAdminError(label, error) {
  const message = error?.message || error?.details || String(error)
  console.error(`[Admin Supabase] ${label}:`, message, error)
  return message
}

export async function ensureAdminSupabaseSession(password) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env' }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const email = sessionData?.session?.user?.email
  if (email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return { ok: true }
  }

  if (!password) {
    return {
      ok: false,
      error: `No Supabase session for ${ADMIN_EMAIL}. Sign in again with admin password.`,
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password,
  })

  if (error) {
    const msg = logAdminError('signInWithPassword', error)
    return {
      ok: false,
      error: `${msg} — Create this user in Supabase Auth → Users with the same password.`,
    }
  }

  return { ok: true, user: data.user }
}

export async function fetchAdminDashboard() {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      errors: ['Supabase env vars not set'],
      stats: null,
      pendingDeposits: [],
      users: [],
    }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const sessionEmail = sessionData?.session?.user?.email
  if (sessionEmail?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    const err =
      'Admin not signed into Supabase. Log out and sign in at /admin-login (uses Supabase Auth for workinehabche@gmail.com).'
    console.error('[Admin Supabase]', err)
    return {
      configured: true,
      errors: [err],
      stats: null,
      pendingDeposits: [],
      users: [],
      sessionEmail: sessionEmail || null,
    }
  }

  const errors = []

  const [statsRes, depositsRes, usersRes] = await Promise.all([
    supabase.rpc('admin_get_dashboard_stats'),
    supabase.rpc('admin_list_pending_deposits'),
    supabase.rpc('admin_list_users'),
  ])

  if (statsRes.error) {
    errors.push(logAdminError('admin_get_dashboard_stats', statsRes.error))
  }
  if (depositsRes.error) {
    errors.push(logAdminError('admin_list_pending_deposits', depositsRes.error))
  }
  if (usersRes.error) {
    errors.push(logAdminError('admin_list_users', usersRes.error))
  }

  const stats = statsRes.data || null

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

  const users = (usersRes.data || []).map((row) => ({
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    usdBalance: Number(row.usd_balance) || 0,
    etbBalance: Number(row.etb_balance) || 0,
    createdAt: row.created_at,
    source: 'supabase',
  }))

  return {
    configured: true,
    errors,
    stats: stats
      ? {
          totalUsers: stats.total_users ?? 0,
          pendingDeposits: stats.pending_deposits ?? 0,
          dailyTransactions: stats.daily_transactions ?? 0,
          approvedDeposits: stats.approved_deposits ?? 0,
          totalDeposits: stats.total_deposits ?? 0,
        }
      : null,
    pendingDeposits,
    users,
    sessionEmail,
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

function truncateProof(proof) {
  if (!proof || typeof proof !== 'string') return null
  if (proof.length <= 120000) return proof
  return proof.slice(0, 120000)
}

export async function approveDepositInSupabase(deposit) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Supabase not configured' }
  }

  const session = await supabase.auth.getSession()
  if (session.data?.session?.user?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return { ok: false, error: 'Admin Supabase session missing' }
  }

  if (deposit.supabaseId && UUID_REGEX.test(deposit.supabaseId)) {
    const { data, error } = await supabase.rpc('admin_approve_deposit', {
      p_deposit_id: deposit.supabaseId,
    })
    if (error) {
      return { ok: false, error: logAdminError('admin_approve_deposit', error) }
    }
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

  const { data, error } = await supabase.rpc('admin_approve_deposit_manual', {
    p_user_id: userId,
    p_amount: Number(deposit.amount),
    p_currency: currency,
    p_payment_method: deposit.paymentMethod || null,
    p_transaction_id: deposit.transactionId || null,
    p_proof_url: truncateProof(deposit.screenshot),
  })

  if (error) {
    return { ok: false, error: logAdminError('admin_approve_deposit_manual', error) }
  }
  return { ok: true, data }
}

export async function rejectDepositInSupabase(deposit) {
  if (!deposit.supabaseId || !UUID_REGEX.test(deposit.supabaseId)) {
    return { ok: true, skipped: true }
  }

  const { error } = await supabase.rpc('admin_reject_deposit', {
    p_deposit_id: deposit.supabaseId,
  })

  if (error) {
    return { ok: false, error: logAdminError('admin_reject_deposit', error) }
  }
  return { ok: true }
}

export async function deleteUserInSupabase(userId) {
  if (!userId || !UUID_REGEX.test(userId)) {
    return { ok: false, error: 'Invalid user ID — only Supabase UUID users can be deleted from database.' }
  }

  const session = await supabase.auth.getSession()
  if (session.data?.session?.user?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return { ok: false, error: 'Admin Supabase session missing' }
  }

  const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId })
  if (error) {
    return { ok: false, error: logAdminError('admin_delete_user', error) }
  }
  return { ok: true }
}

/** Legacy count fallback when RPC not deployed */
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
