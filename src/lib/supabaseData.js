import supabase from './supabase'
import {
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

  return { ok: true, referredBy }
}

/**
 * Resolve the authenticated Supabase user id (RLS requires auth.uid()).
 */
export async function resolveAuthenticatedUserId(hintUserId) {
  if (!isSupabaseConfigured()) return hintUserId ?? null

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.warn('[balances] auth.getUser failed:', error.message)
  }
  if (user?.id) {
    if (hintUserId != null && hintUserId !== user.id) {
      console.warn('[balances] Using Supabase session user id (hint mismatch)')
    }
    return user.id
  }
  return hintUserId ?? null
}

export async function fetchUserBalances(userId) {
  if (!isSupabaseConfigured()) return null

  const resolvedUserId = await resolveAuthenticatedUserId(userId)
  if (!resolvedUserId) return null

  // Ensure auth session is active
  await supabase.auth.getSession()

  const { data, error } = await supabase
    .from('balances')
    .select('etb_wallet, usd_wallet, etb_balance, usd_balance')
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
    etbBalance: Number(data.etb_wallet || data.etb_balance) || 0,
    usdBalance: Number(data.usd_wallet || data.usd_balance) || 0,
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

/**
 * Process a unified transaction through the backend RPC.
 * 
 * Signature: process_transaction(
 *   p_user_id UUID,
 *   p_type TEXT,
 *   p_amount NUMERIC,
 *   p_currency TEXT DEFAULT 'ETB',
 *   p_reference_id UUID DEFAULT NULL
 * )
 */
export async function processTransaction({
  type,
  amount,
  currency = 'ETB',
  referenceId = null,
  userId = null,
}) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured' }
  }

  const transactionAmount = Number(amount)
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    return { ok: false, error: 'invalid_amount' }
  }

  // Call with exact parameter names in the SQL function signature.
  const params = {
    p_user_id: userId || null,
    p_type: type,
    p_amount: transactionAmount,
    p_currency: currency,
    p_reference_id: referenceId,
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

export async function deductBalanceForInvestment(userId, currency, amount) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured' }
  }

  const resolvedUserId = await resolveAuthenticatedUserId(userId)
  if (!resolvedUserId) {
    return { ok: false, error: 'not_authenticated' }
  }

  // Call RPC function with exact parameters
  const result = await processTransaction({
    type: 'invest',
    amount,
    currency,
    referenceId: null,
    userId: resolvedUserId,
  })

  if (!result.ok) {
    if (result.error === 'insufficient_balance') {
      const balances = await fetchUserBalances(resolvedUserId)
      return {
        ok: false,
        error: 'insufficient',
        currentBalance: currency === 'USD' ? balances?.usdBalance ?? 0 : balances?.etbBalance ?? 0,
        requiredAmount: Number(amount),
        usdBalance: balances?.usdBalance,
        etbBalance: balances?.etbBalance,
      }
    }
    return { ok: false, error: result.error || 'transaction_failed' }
  }

  // Return with needsRefresh flag for component to trigger UI update
  return {
    ok: true,
    needsRefresh: true,
    usdBalance: Number(result.balance_usd || 0),
    etbBalance: Number(result.balance_etb || 0),
    userId: resolvedUserId,
  }
}

export async function countApprovedDeposits(userId) {
  if (!userId || !isSupabaseConfigured()) return 0

  const { count, error } = await supabase
    .from('deposits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['successful', 'approved'])

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

  const result = await processTransaction({
    type: 'referral_bonus',
    amount,
    currency: normalizedCurrency,
    referenceId: null,
    userId,
  })

  if (!result.ok) {
    console.error('Referral deposit bonus failed:', result.error)
    return { ok: false, error: result.error }
  }

  return { ok: true, data: result }
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

export const DEPOSIT_RECEIPT_MAX_BYTES = 5 * 1024 * 1024
export const DEPOSIT_PROOFS_BUCKET = 'deposit-proofs'

/**
 * Compress receipt images so localStorage fallback stays under quota.
 */
export async function compressReceiptImage(file, maxBytes = 350_000) {
  if (!file?.type?.startsWith('image/')) return file
  if (file.size <= maxBytes) return file

  const bitmap = await createImageBitmap(file)
  const maxDim = 1280
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let quality = 0.82
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  while (blob && blob.size > maxBytes && quality > 0.35) {
    quality -= 0.12
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  }

  if (!blob) return file
  const baseName = (file.name || 'receipt').replace(/\.[^.]+$/, '')
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
}

function normalizeDepositCurrency(currency) {
  const c = String(currency || '').toUpperCase()
  return c === 'USD' || c === 'USDT' ? 'USD' : 'ETB'
}

function appendLocalPendingDeposit(record) {
  const pendingDeposits = JSON.parse(localStorage.getItem('admin_pending_deposits') || '[]')
  pendingDeposits.push(record)
  localStorage.setItem('admin_pending_deposits', JSON.stringify(pendingDeposits))
}

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
 * Submit a pending deposit (user-facing).
 * 1. Uploads receipt proof to Storage
 * 2. Inserts pending deposit record into deposits table
 * 3. Awaits admin approval to credit balance
 */
export async function submitPendingDeposit({
  user_id,
  userEmail,
  amount,
  amount_usd,
  amount_etb,
  currency,
  paymentMethod,
  transaction_id,
  receiptFile,
}) {
  const txId = String(transaction_id || '').trim()
  if (!txId) {
    return { ok: false, error: 'Transaction ID is required.' }
  }
  if (!receiptFile || !(receiptFile instanceof File)) {
    return { ok: false, error: 'Receipt image is required.' }
  }
  if (receiptFile.size > DEPOSIT_RECEIPT_MAX_BYTES) {
    return { ok: false, error: 'Receipt must be 5MB or smaller.' }
  }

  const depositAmount = Number(amount_usd ?? amount_etb ?? amount)
  if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
    return { ok: false, error: 'Enter a valid deposit amount.' }
  }

  const normCurrency = normalizeDepositCurrency(currency)
  const compressedFile = await compressReceiptImage(receiptFile)

  if (!isSupabaseConfigured()) {
    return submitPendingDepositLocal({
      userId: user_id || userEmail,
      userEmail,
      amount: depositAmount,
      amount_usd,
      amount_etb,
      currency: normCurrency,
      paymentMethod,
      transactionId: txId,
      receiptFile: compressedFile,
    })
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  let authUser = sessionData?.session?.user ?? null

  if (!authUser) {
    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData?.user?.id) {
      const detail = sessionError?.message || authError?.message
      return {
        ok: false,
        error: detail
          ? `Please sign in again to submit a deposit. (${detail})`
          : 'Please sign in again to submit a deposit.',
      }
    }
    authUser = userData.user
  }

  const authUserId = authUser.id

  // Upload proof to Storage (optional - for audit trail)
  let proofUrl = await uploadDepositProof(authUserId, compressedFile)
  if (!proofUrl) proofUrl = 'pending'

  // Validate provided user_id (if any) matches authenticated user
  if (user_id && String(user_id) !== authUserId) {
    console.warn('[deposit] user_id mismatch:', user_id, 'authUserId:', authUserId)
    return { ok: false, error: 'Authenticated user does not match payload user_id.' }
  }

  // Insert pending deposit record directly (user cannot approve, only insert pending)
  const { data: insertedData, error: insertError } = await supabase
    .from('deposits')
    .insert({
      user_id: authUserId,
      amount: depositAmount,
      amount_etb: normCurrency === 'ETB' ? depositAmount : null,
      amount_usd: normCurrency === 'USD' ? depositAmount : null,
      currency: normCurrency,
      payment_method: paymentMethod || 'manual',
      transaction_id: txId,
      status: 'pending',
      proof_url: proofUrl,
    })
    .select()

  if (insertError) {
    console.error('[deposit] insert failed:', insertError.message)
    return { ok: false, error: 'Failed to submit deposit: ' + insertError.message }
  }

  const localRecord = {
    id: txId,
    supabaseId: insertedData?.[0]?.id || txId,
    userId: authUserId,
    userEmail: userEmail || authUser?.email,
    amount: depositAmount,
    currency: normCurrency,
    transactionId: txId,
    screenshot: proofUrl,
    proofUrl,
    status: 'Pending',
    createdAt: new Date().toISOString(),
    source: 'supabase',
  }

  try {
    appendLocalPendingDeposit(localRecord)
  } catch (storageErr) {
    console.warn('[deposit] local cache skipped:', storageErr?.message || storageErr)
  }

  // Return success - admin approval will update balances later
  return {
    ok: true,
    depositId: insertedData?.[0]?.id || txId,
    proofUrl,
    message: 'Your deposit request has been submitted. Admin will approve shortly.',
  }
}

async function submitPendingDepositLocal({
  userId,
  userEmail,
  amount,
  amount_usd,
  amount_etb,
  currency,
  paymentMethod,
  transactionId,
  receiptFile,
}) {
  const previewValue = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(receiptFile)
  }).catch(() => null)

  const proofPreview =
    typeof previewValue === 'string' && previewValue.length > 120_000 ? null : previewValue

  const pendingDeposit = {
    id: `deposit-${Date.now()}`,
    userId: userId || userEmail,
    userEmail: userEmail || userId,
    amount: Number(amount_usd ?? amount_etb ?? amount),
    currency,
    paymentMethod,
    transactionId,
    screenshot: proofPreview,
    screenshotName: receiptFile.name,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  }

  try {
    appendLocalPendingDeposit(pendingDeposit)
  } catch (err) {
    const isQuota =
      err?.name === 'QuotaExceededError' ||
      String(err?.message || '').toLowerCase().includes('quota')
    return {
      ok: false,
      error: isQuota
        ? 'Storage is full. Clear browser data or connect Supabase to submit deposits.'
        : 'Could not save deposit locally.',
    }
  }

  return { ok: true, depositId: pendingDeposit.id, proofUrl: proofPreview }
}

async function resolveSupabaseAuthUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionData?.session?.user) {
    return { user: sessionData.session.user, error: null }
  }

  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (userData?.user) {
    return { user: userData.user, error: null }
  }

  return { user: null, error: sessionError || authError }
}

function appendLocalPendingWithdrawal(record) {
  const pending = JSON.parse(localStorage.getItem('admin_pending_withdrawals') || '[]')
  pending.push(record)
  localStorage.setItem('admin_pending_withdrawals', JSON.stringify(pending))
}

/**
 * Submit a pending withdrawal using RPC function.
 * Calls process_transaction RPC with type='withdrawal'.
 * Returns result with needsRefresh flag for UI.
 */
export async function submitPendingWithdrawal({
  userId,
  userEmail,
  amount,
  currency,
  bank,
  paymentMethod,
  accountName,
  accountNumber,
  accountDetails,
}) {
  const withdrawAmount = Number(amount)
  if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
    return { ok: false, error: 'Enter a valid withdrawal amount.' }
  }

  const normCurrency = normalizeDepositCurrency(currency)
  const trimmedBank = String(bank || '').trim()
  const trimmedPaymentMethod = String(paymentMethod || '').trim()
  const trimmedName = String(accountName || '').trim()
  const trimmedAccount = String(accountNumber || '').trim()
  const providedAccountDetails = accountDetails || null

  if (!trimmedBank || !trimmedPaymentMethod || !trimmedName || !trimmedAccount) {
    return { ok: false, error: 'Bank, payment method, account name, and account number are required.' }
  }

  if (!isSupabaseConfigured()) {
    return submitPendingWithdrawalLocal({
      userId: userId || userEmail,
      userEmail,
      amount: withdrawAmount,
      currency: normCurrency,
      bank: trimmedBank,
      paymentMethod: trimmedPaymentMethod,
      accountName: trimmedName,
      accountNumber: trimmedAccount,
      accountDetails: providedAccountDetails,
    })
  }

  // Get fresh authenticated user with session token
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
  if (!authUser?.id) {
    const detail = authError?.message
    return {
      ok: false,
      error: detail
        ? `Please sign in again to withdraw. (${detail})`
        : 'Please sign in again to withdraw.',
    }
  }

  // Call process_transaction directly with explicit user_id
  const result = await supabase.rpc('process_transaction', {
    p_user_id: authUser.id,
    p_type: 'withdrawal',
    p_amount: withdrawAmount,
    p_currency: normCurrency,
    p_reference_id: null,
  })

  if (result.error) {
    console.error('[withdrawal] RPC error:', result.error.message, result.error)
    if (result.error.message?.includes('insufficient_balance')) {
      return { ok: false, error: `Insufficient ${normCurrency} balance for this withdrawal.` }
    }
    return { ok: false, error: result.error.message || 'Could not submit withdrawal.' }
  }

  const rpcData = result.data
  console.log('[withdrawal] RPC success:', rpcData)

  if (!rpcData || rpcData.ok === false) {
    if (rpcData?.error === 'insufficient_balance') {
      return { ok: false, error: `Insufficient ${normCurrency} balance for this withdrawal.` }
    }
    return { ok: false, error: rpcData?.error || 'Could not submit withdrawal.' }
  }

  const withdrawalId = rpcData.withdrawal_id || rpcData.reference_id
  const localRecord = {
    id: withdrawalId || `withdrawal-${Date.now()}`,
    supabaseId: withdrawalId,
    userId: authUser.id,
    userEmail: userEmail || authUser.email,
    amount: withdrawAmount,
    currency: normCurrency,
    bank: trimmedBank,
    paymentMethod: trimmedPaymentMethod,
    accountDetails: accountDetailsJson,
    accountName: trimmedName,
    accountNumber: trimmedAccount,
    status: 'Pending',
    createdAt: new Date().toISOString(),
    source: 'supabase',
  }

  try {
    appendLocalPendingWithdrawal(localRecord)
  } catch (storageErr) {
    console.warn('[withdrawal] local cache skipped:', storageErr?.message || storageErr)
  }

  // Return with needsRefresh flag for component to trigger UI update
  return {
    ok: true,
    withdrawalId,
    needsRefresh: true,
    usdBalance: Number(result.balance_usd || 0),
    etbBalance: Number(result.balance_etb || 0),
  }
}


function submitPendingWithdrawalLocal({
  userId,
  userEmail,
  amount,
  currency,
  bank,
  paymentMethod,
  accountName,
  accountNumber,
  accountDetails,
}) {
  const users = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
  const email = userEmail || userId
  if (!users[email]) users[email] = { usdBalance: 0, etbBalance: 0, email }

  const balance =
    currency === 'USD' ? Number(users[email].usdBalance || 0) : Number(users[email].etbBalance || 0)
  if (amount > balance) {
    return { ok: false, error: `Insufficient ${currency} balance for this withdrawal.` }
  }

  if (currency === 'USD') {
    users[email].usdBalance = balance - amount
  } else {
    users[email].etbBalance = balance - amount
  }
  localStorage.setItem('admin_user_data', JSON.stringify(users))

  const record = {
    id: `withdrawal-${Date.now()}`,
    userName: users[email].fullName || email,
    userEmail: email,
    amount,
    currency,
    bank,
    paymentMethod,
    accountDetails,
    accountName,
    accountNumber,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  }
  appendLocalPendingWithdrawal(record)

  return {
    ok: true,
    withdrawalId: record.id,
    usdBalance: users[email].usdBalance,
    etbBalance: users[email].etbBalance,
  }
}

export { REFERRAL_BONUS_USD, REFERRAL_BONUS_ETB }
