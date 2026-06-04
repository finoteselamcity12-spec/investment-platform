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
  phone,
  fullName,
  referrerCode,
}) {
  if (!userId || !isSupabaseConfigured()) return { ok: false }

  const referredBy = await resolveReferrerId(referrerCode)

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email,
      phone,
      full_name: fullName,
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
    { onConflict: 'user_id' }
  )

  if (balanceError) {
    console.error('Balance upsert failed:', balanceError)
  }

  return { ok: true, referredBy }
}

export async function fetchUserBalances(userId) {
  if (!userId || !isSupabaseConfigured()) return null

  const { data, error } = await supabase
    .from('balances')
    .select('etb_balance, usd_balance')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null

  return {
    etbBalance: Number(data.etb_balance) || 0,
    usdBalance: Number(data.usd_balance) || 0,
  }
}

export async function recordDepositForReferral({ userId, currency, amount }) {
  if (!userId || !isSupabaseConfigured()) return { ok: false }

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

export { REFERRAL_BONUS_USD, REFERRAL_BONUS_ETB }
