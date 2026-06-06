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
      etb_wallet: REGISTRATION_BONUS_ETB,
      usd_wallet: REGISTRATION_BONUS_USD,
      etb_referral_bonus: 0,
      usd_referral_bonus: 0,
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
    .select('etb_wallet, usd_wallet')
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
    etbBalance: Number(data.etb_wallet) || 0,
    usdBalance: Number(data.usd_wallet) || 0,
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
 * Deduct investment amount using live DB balance (fetch → check → update).
 */
export async function deductBalanceForInvestment(userId, currency, amount) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured' }
  }

  const resolvedUserId = await resolveAuthenticatedUserId(userId)
  if (!resolvedUserId) {
    return { ok: false, error: 'not_authenticated' }
  }

  const investAmount = Number(amount)
  if (!Number.isFinite(investAmount) || investAmount <= 0) {
    return { ok: false, error: 'invalid_amount' }
  }

  const live = await fetchUserBalances(resolvedUserId)
  if (!live?.fromDatabase) {
    return { ok: false, error: 'fetch_failed' }
  }

  const isUsd = currency === 'USD' || currency === 'USDT'
  const currentBalance = isUsd ? live.usdBalance : live.etbBalance

  if (currentBalance < investAmount) {
    return {
      ok: false,
      error: 'insufficient',
      currentBalance,
      requiredAmount: investAmount,
      usdBalance: live.usdBalance,
      etbBalance: live.etbBalance,
    }
  }

  const nextUsd = isUsd ? live.usdBalance - investAmount : live.usdBalance
  const nextEtb = !isUsd ? live.etbBalance - investAmount : live.etbBalance

  const { data, error } = await supabase
    .from('balances')
    .update({
      usd_wallet: nextUsd,
      etb_wallet: nextEtb,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', resolvedUserId)
    .select('usd_wallet, etb_wallet')
    .maybeSingle()

  if (error) {
    console.error('[invest] balance deduct failed:', error.message)
    return { ok: false, error: 'update_failed', message: error.message }
  }

  const balances = {
    usdBalance: Number(data?.usd_wallet ?? nextUsd) || 0,
    etbBalance: Number(data?.etb_wallet ?? nextEtb) || 0,
    fromDatabase: true,
  }

  return { ok: true, ...balances, userId: resolvedUserId }
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

  // Insert using amount_etb / amount_usd to match DB schema
  const depositPayload = {
    user_id: userId,
    currency: normalizedCurrency === 'USD' ? 'USD' : 'ETB',
    status: 'approved',
  }
  if (normalizedCurrency === 'USD') {
    depositPayload.amount_usd = Number(amount)
  } else {
    depositPayload.amount_etb = Number(amount)
  }

  const { error } = await supabase.from('deposits').insert(depositPayload)

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
 * Submit a pending deposit: upload receipt to Storage, insert row in public.deposits.
 */
export async function submitPendingDeposit({
  userId,
  userEmail,
  amount,
  amount_usd,
  amount_etb,
  currency,
  payment_method_id,
  paymentMethod,
  transactionId,
  receiptFile,
}) {
  const txId = String(transactionId || '').trim()
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
      userId: userId || userEmail,
      userEmail,
      amount: depositAmount,
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
  let proofUrl = await uploadDepositProof(authUserId, compressedFile)

  const paymentMethodIdentifier = payment_method_id ?? paymentMethod

  const insertPayload = {
    user_id: authUserId,
    currency: normCurrency,
    status: 'pending',
    payment_method_id: paymentMethodIdentifier || null,
    transaction_id: txId,
    proof_url: proofUrl,
    screenshot_url: proofUrl,
  }

  if (normCurrency === 'USD') {
    insertPayload.amount_usd = depositAmount
  } else {
    insertPayload.amount_etb = depositAmount
  }

  const { data, error } = await supabase
    .from('deposits')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error) {
    console.error('[deposit] insert failed:', error.message)
    return { ok: false, error: error.message || 'Could not save deposit.' }
  }

  const localRecord = {
    id: data.id,
    supabaseId: data.id,
    userId: authUserId,
    userEmail: userEmail || user.email,
    amount: depositAmount,
    currency: normCurrency,
    paymentMethod: paymentMethodIdentifier || null,
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

  return { ok: true, depositId: data.id, proofUrl }
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
  let proofPreview = null
  try {
    proofPreview = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(receiptFile)
    })
    if (typeof proofPreview === 'string' && proofPreview.length > 120_000) {
      proofPreview = null
    }
  } catch {
    proofPreview = null
  }

  const pendingDeposit = {
    id: `deposit-${Date.now()}`,
    userId: userId || userEmail,
    userEmail: userEmail || userId,
    amount,
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
 * Submit a pending withdrawal: server-side balance check, deduct, log to history.
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

  const { user: authUser, error: authError } = await resolveSupabaseAuthUser()
  if (!authUser?.id) {
    const detail = authError?.message
    return {
      ok: false,
      error: detail
        ? `Please sign in again to withdraw. (${detail})`
        : 'Please sign in again to withdraw.',
    }
  }

  const accountDetailsJson = providedAccountDetails || JSON.stringify({
    bank: trimmedBank,
    payment_method: trimmedPaymentMethod,
    account_name: trimmedName,
    account_number: trimmedAccount,
  })

  const { data, error } = await supabase.rpc('submit_user_withdrawal', {
    p_amount: withdrawAmount,
    p_currency: normCurrency,
    p_bank: trimmedBank || null,
    p_account_name: trimmedName,
    p_account_number: trimmedAccount,
    p_payment_method: trimmedPaymentMethod || null,
    p_account_details: accountDetailsJson || null,
  })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('insufficient_balance')) {
      return { ok: false, error: `Insufficient ${normCurrency} balance for this withdrawal.` }
    }
    if (msg.includes('not_authenticated')) {
      return { ok: false, error: 'Please sign in again to withdraw.' }
    }
    console.error('[withdrawal] RPC failed:', msg)
    return { ok: false, error: msg || 'Could not submit withdrawal.' }
  }

  const withdrawalId = data?.withdrawal_id
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

  const balances = await fetchUserBalances(authUser.id)
  return {
    ok: true,
    withdrawalId,
    usdBalance: balances?.usdBalance,
    etbBalance: balances?.etbBalance,
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
