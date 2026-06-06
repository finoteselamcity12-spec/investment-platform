/**
 * Frontend Integration: process_transaction Caller
 * 
 * This module provides clean, typed functions to call the unified
 * process_transaction backend function and handle all transaction types.
 */

import supabase from './supabase'

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

/**
 * Resolve the authenticated user ID
 */
export async function resolveAuthenticatedUserId(hintUserId = null) {
  if (!isSupabaseConfigured()) return hintUserId ?? null

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.warn('[auth] getUser failed:', error.message)
  }
  if (user?.id) {
    return user.id
  }
  return hintUserId ?? null
}

/**
 * Call process_transaction backend function
 * Universal handler for deposits, withdrawals, investments, and bonuses
 * 
 * Signature: process_transaction(
 *   p_user_id UUID DEFAULT NULL,
 *   p_type TEXT,
 *   p_amount NUMERIC,
 *   p_currency TEXT,
 *   p_reference_id UUID DEFAULT NULL,
 *   p_bank TEXT DEFAULT NULL,
 *   p_account_name TEXT DEFAULT NULL,
 *   p_account_number TEXT DEFAULT NULL,
 *   p_payment_method TEXT DEFAULT NULL,
 *   p_account_details TEXT DEFAULT NULL
 * )
 */
export async function processTransaction({
  type,
  amount,
  currency,
  referenceId = null,
  bank = null,
  accountName = null,
  accountNumber = null,
  paymentMethod = null,
  accountDetails = null,
  userId = null,
}) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'supabase_not_configured' }
  }

  const transactionAmount = Number(amount)
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    return { ok: false, error: 'invalid_amount' }
  }

  // Call with exact parameter order: (p_user_id, p_type, p_amount, p_currency, p_reference_id, ...)
  const params = {
    p_user_id: userId || null,
    p_type: type,
    p_amount: transactionAmount,
    p_currency: currency,
    p_reference_id: referenceId,
    p_bank: bank,
    p_account_name: accountName,
    p_account_number: accountNumber,
    p_payment_method: paymentMethod,
    p_account_details: accountDetails,
  }

  const { data, error } = await supabase.rpc('process_transaction', params)

  if (error) {
    console.error('[process_transaction] rpc failed:', error.message)
    return { ok: false, error: error.message || 'transaction_failed' }
  }

  if (!data || data.ok === false) {
    return {
      ok: false,
      error: data?.error || 'transaction_failed',
      detail: data?.detail,
    }
  }

  return { ok: true, ...data }
}

/**
 * Fetch user balances from database
 */
export async function fetchUserBalances(userId) {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase
    .from('balances')
    .select('etb_balance, usd_balance, etb_wallet, usd_wallet')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[balances] fetch failed:', error.message)
    return null
  }

  if (!data) {
    return { etbBalance: 0, usdBalance: 0, fromDatabase: true, empty: true }
  }

  return {
    etbBalance: Number(data.etb_balance) || 0,
    usdBalance: Number(data.usd_balance) || 0,
    etbWallet: Number(data.etb_wallet) || 0,
    usdWallet: Number(data.usd_wallet) || 0,
    fromDatabase: true,
    empty: false,
  }
}

/**
 * Refresh balances from authenticated user
 */
export async function refreshUserBalancesFromAuth(userId = null) {
  const resolvedUserId = userId || (await resolveAuthenticatedUserId())
  if (!resolvedUserId) return null

  const balances = await fetchUserBalances(resolvedUserId)
  if (!balances?.fromDatabase) return null

  return { ...balances, userId: resolvedUserId }
}

// ============================================================================
// TRANSACTION HELPERS
// ============================================================================

/**
 * Process a deposit approval (admin only)
 */
export async function approveDeposit({
  amount,
  currency,
  depositId = null,
  paymentMethod = null,
  userId = null,
}) {
  return processTransaction({
    type: 'deposit',
    amount,
    currency,
    referenceId: depositId,
    paymentMethod,
    userId,
  })
}

/**
 * Process a withdrawal request
 */
export async function submitWithdrawal({
  amount,
  currency,
  bank,
  accountName,
  accountNumber,
  paymentMethod,
  accountDetails = null,
  userId = null,
}) {
  const transactionAccountDetails =
    accountDetails ||
    JSON.stringify({
      bank,
      account_name: accountName,
      account_number: accountNumber,
      payment_method: paymentMethod,
    })

  return processTransaction({
    type: 'withdrawal',
    amount,
    currency,
    bank,
    accountName,
    accountNumber,
    paymentMethod,
    accountDetails: transactionAccountDetails,
    userId,
  })
}

/**
 * Process an investment deduction
 */
export async function submitInvestment({
  amount,
  currency,
  userId = null,
}) {
  return processTransaction({
    type: 'invest',
    amount,
    currency,
    userId,
  })
}

/**
 * Award referral bonus (admin only)
 */
export async function awardReferralBonus({
  userId,
  amount,
  currency,
}) {
  return processTransaction({
    type: 'referral_bonus',
    amount,
    currency,
    userId,
  })
}

// ============================================================================
// DEPOSIT SUBMISSION (insert pending deposit record)
// ============================================================================

export const DEPOSIT_RECEIPT_MAX_BYTES = 5 * 1024 * 1024
export const DEPOSIT_PROOFS_BUCKET = 'deposit-proofs'

/**
 * Upload deposit receipt to storage
 */
async function uploadDepositProof(authUserId, receiptFile) {
  const safeExt = (receiptFile.name?.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg'
  const path = `${authUserId}/${Date.now()}-receipt.${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from(DEPOSIT_PROOFS_BUCKET)
    .upload(path, receiptFile, {
      contentType: receiptFile.type || 'image/jpeg',
      upsert: false,
    })

  if (uploadError) {
    console.warn('[deposit] proof upload failed:', uploadError.message)
    return null
  }

  const { data: urlData } = supabase.storage.from(DEPOSIT_PROOFS_BUCKET).getPublicUrl(path)
  return urlData?.publicUrl || null
}

/**
 * Submit pending deposit for admin approval
 */
export async function submitPendingDeposit({
  amount,
  currency,
  transactionId,
  receiptFile,
  paymentMethod = null,
}) {
  if (!transactionId?.trim()) {
    return { ok: false, error: 'Transaction ID is required.' }
  }

  if (!receiptFile || !(receiptFile instanceof File)) {
    return { ok: false, error: 'Receipt image is required.' }
  }

  if (receiptFile.size > DEPOSIT_RECEIPT_MAX_BYTES) {
    return { ok: false, error: 'Receipt must be 5MB or smaller.' }
  }

  const depositAmount = Number(amount)
  if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
    return { ok: false, error: 'Enter a valid deposit amount.' }
  }

  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Supabase not configured. Cannot submit deposit.' }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  let authUser = sessionData?.session?.user ?? null

  if (!authUser) {
    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData?.user?.id) {
      return {
        ok: false,
        error: 'Please sign in again to submit a deposit.',
      }
    }
    authUser = userData.user
  }

  const authUserId = authUser.id
  const proofUrl = await uploadDepositProof(authUserId, receiptFile)

  if (!proofUrl) {
    return { ok: false, error: 'Could not upload receipt. Please try again.' }
  }

  const normCurrency = currency === 'USD' || currency === 'USDT' ? 'USD' : 'ETB'
  const insertPayload = {
    user_id: authUserId,
    amount_etb: normCurrency === 'ETB' ? depositAmount : null,
    amount_usd: normCurrency === 'USD' ? depositAmount : null,
    currency: normCurrency,
    proof_url: proofUrl,
    transaction_id: transactionId.trim(),
    status: 'pending',
    payment_method: paymentMethod,
  }

  const { data, error } = await supabase
    .from('deposits')
    .insert([insertPayload])
    .select()

  if (error) {
    console.error('[deposit] insert failed:', error.message)
    return { ok: false, error: error.message || 'Could not save deposit.' }
  }

  const insertedRow = Array.isArray(data) ? data[0] : data

  return { ok: true, depositId: insertedRow?.id, proofUrl }
}

// ============================================================================
// UTILITY: Test connection
// ============================================================================

export async function testSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return { ok: false, configured: false, message: 'Missing Supabase config' }
  }

  try {
    const { error } = await supabase.from('balances').select('user_id').limit(1)
    if (error) {
      return { ok: false, configured: true, message: error.message }
    }
    return { ok: true, configured: true, message: 'Connected' }
  } catch (err) {
    return { ok: false, configured: true, message: String(err?.message || err) }
  }
}
