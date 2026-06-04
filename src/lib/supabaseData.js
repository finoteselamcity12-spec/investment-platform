import supabase from './supabase'
import {
  REGISTRATION_BONUS_ETB,
  REGISTRATION_BONUS_USD,
  REFERRAL_BONUS_ETB,
  REFERRAL_BONUS_USD,
} from './platformConfig'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isSupabaseConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

export async function resolveReferrerId(referrerCode) {
  if (!referrerCode || !isSupabaseConfigured()) return null

  const code = String(referrerCode).trim()
  if (UUID_REGEX.test(code)) return code

  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', code)
    .maybeSingle()

  return data?.id || null
}

export async function syncProfileAfterSignup({
  userId,
  email,
  fullName,
  referrerCode,
}) {
  if (!userId || !isSupabaseConfigured()) return { ok: false }

  const referredBy = await resolveReferrerId(referrerCode)

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email,
      full_name: fullName || null,
      referred_by: referredBy,
    },
    { onConflict: 'id' }
  )

  if (profileError) {
    console.error('Profile upsert failed:', profileError)
    return { ok: false, error: profileError }
  }

  const { error: balanceError } = await supabase.from('balances').upsert(
    {
      user_id: userId,
      etb_balance: REGISTRATION_BONUS_ETB,
      usd_balance: REGISTRATION_BONUS_USD,
    },
    { onConflict: 'user_id', ignoreDuplicates: true }
  )

  if (balanceError) {
    console.error('Balance upsert failed:', balanceError)
  }

  return { ok: true, referredBy }
}

/**
 * Resolve the authenticated Supabase user id (RLS requires auth.uid()).
 */
export async function resolveAuthenticatedUserId(hintUserId) {
  if (!isSupabaseConfigured()) return hintUserId || null

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.warn('[balances] auth.getUser failed:', error.message)
  }
  if (user?.id) {
    if (hintUserId && hintUserId !== user.id) {
      console.warn('[balances] Using Supabase session user id (hint mismatch)')
    }
    return user.id
  }
  return hintUserId || null
}

export async function fetchUserBalances(userId) {
  if (!isSupabaseConfigured()) return null

  const resolvedUserId = await resolveAuthenticatedUserId(userId)
  if (!resolvedUserId) return null

  const { data, error } = await supabase
    .from('balances')
    .select('etb_balance, usd_balance')
    .eq('user_id', resolvedUserId)
    .maybeSingle()

  if (error) {
    console.error('[balances] fetch failed:', error.message, { userId: resolvedUserId })
    return null
  }

  if (!data) {
    return { etbBalance: 0, usdBalance: 0, fromDatabase: true, empty: true }
  }

  return {
    etbBalance: Number(data.etb_balance) || 0,
    usdBalance: Number(data.usd_balance) || 0,
    fromDatabase: true,
    empty: false,
  }
}

/** Persist authoritative DB balances to local profile cache (display only). */
export function persistUserBalances(email, balances, userId) {
  if (!email || !balances) return

  const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
  userData[email] = {
    ...(userData[email] || {}),
    id: userId || userData[email]?.id,
    email,
    usdBalance: balances.usdBalance,
    etbBalance: balances.etbBalance,
  }
  localStorage.setItem('admin_user_data', JSON.stringify(userData))
}

/**
 * Load balances from Supabase for the signed-in user (source of truth).
 */
export async function refreshUserBalancesFromAuth(hintUserId, email) {
  const userId = await resolveAuthenticatedUserId(hintUserId)
  if (!userId) return null

  const balances = await fetchUserBalances(userId)
  if (!balances?.fromDatabase) return null

  if (email) {
    persistUserBalances(email, balances, userId)
  }

  return { ...balances, userId }
}

export async function countApprovedDeposits(userId) {
  if (!userId || !isSupabaseConfigured()) return 0

  const { count, error } = await supabase
    .from('deposits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'approved')

  if (error) {
    console.error('Deposit count failed:', error)
    return 0
  }

  return count || 0
}

export async function recordDepositForReferral({ userId, currency, amount }) {
  if (!userId || !isSupabaseConfigured()) return { ok: false }

  const priorApproved = await countApprovedDeposits(userId)
  if (priorApproved > 0) {
    return { ok: true, skipped: true, reason: 'not_first_deposit' }
  }

  const normalizedCurrency =
    currency === 'USDT' || currency === 'USD' ? 'USD' : 'ETB'

  const { error } = await supabase.from('deposits').insert({
    user_id: userId,
    currency: normalizedCurrency === 'USD' ? 'USD' : 'ETB',
    amount: Number(amount),
    status: 'approved',
  })

  if (error) {
    console.error('Deposit record failed:', error)
    return { ok: false, error }
  }

  return { ok: true }
}

export async function findProfileIdByEmail(email) {
  if (!email || !isSupabaseConfigured()) return null

  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  return data?.id || null
}

export async function testSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return { ok: false, configured: false, message: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY' }
  }

  try {
    const { error } = await supabase.from('profiles').select('id').limit(1)
    if (error) {
      return { ok: false, configured: true, message: error.message }
    }
    return { ok: true, configured: true, message: 'Connected' }
  } catch (err) {
    return { ok: false, configured: true, message: String(err?.message || err) }
  }
}

export { REFERRAL_BONUS_USD, REFERRAL_BONUS_ETB }
