import { REFERRAL_BONUS_ETB, REFERRAL_BONUS_USD } from '../../lib/platformConfig'
import { findProfileIdByEmail } from '../../lib/supabaseData'
import { loadReferralStats, updateReferralStats } from '../../lib/referralUtils'
import {
  approveDepositInSupabase,
  rejectDepositInSupabase,
  deleteUserInSupabase,
  approveWithdrawalInSupabase,
  rejectWithdrawalInSupabase,
} from './adminSupabase'

export const ADMIN_EMAIL = 'workinehabche@gmail.com'

export const ADMIN_CREDENTIALS = {
  name: 'Admin',
  password: '1q2w3e4@',
  id: '15610010',
}

export function formatAdminCurrency(amount, currency) {
  if (currency === 'USD' || currency === 'USDT') return `$${Number(amount).toFixed(2)}`
  return `${Number(amount).toLocaleString()} Birr`
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadAdminSnapshot() {
  const usersData = readJson('admin_user_data', {})
  const users = Object.values(usersData).map((u) => ({
    ...u,
    id: u.id || u.email,
    email: u.email || u.id,
  }))

  let activeInvestments = 0
  try {
    const investments = readJson('user_investments', [])
    activeInvestments = Array.isArray(investments) ? investments.length : 0
  } catch {
    activeInvestments = users.reduce((sum, u) => sum + (Number(u.activeInvestments) || 0), 0)
  }

  const pendingDeposits = readJson('admin_pending_deposits', [])
  const approvedDeposits = readJson('admin_approved_deposits', [])
  const rejectedDeposits = readJson('admin_rejected_deposits', [])
  const pendingWithdrawals = readJson('admin_pending_withdrawals', [])
  const approvedWithdrawals = readJson('admin_approved_withdrawals', [])
  const rejectedWithdrawals = readJson('admin_rejected_withdrawals', [])
  const registeredUsers = readJson('platform_registered_users', [])

  const dailyTransactions =
    pendingDeposits.length +
    pendingWithdrawals.length +
    approvedDeposits.filter((d) => {
      const t = d.approvedAt ? new Date(d.approvedAt) : null
      return t && t.toDateString() === new Date().toDateString()
    }).length

  return {
    users,
    usersByKey: usersData,
    pendingDeposits,
    pendingDepositsLocal: pendingDeposits,
    approvedDeposits,
    rejectedDeposits,
    pendingWithdrawals,
    approvedWithdrawals,
    rejectedWithdrawals,
    registrationCount: registeredUsers.length,
    activeInvestments,
    dailyTransactions,
  }
}

export function mergePendingWithdrawals(localList, remoteList) {
  const seen = new Set()
  const merged = []

  for (const w of remoteList || []) {
    const key = w.supabaseId || w.id
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(w)
  }

  for (const w of localList || []) {
    if (w.supabaseId && seen.has(w.supabaseId)) continue
    const key = `local:${w.id}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push({ ...w, source: w.source || 'local' })
  }

  return merged
}

export function mergePendingDeposits(localList, remoteList) {
  const seen = new Set()
  const merged = []

  for (const d of remoteList || []) {
    const key = d.supabaseId || d.id
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(d)
  }

  for (const d of localList || []) {
    if (d.supabaseId && seen.has(d.supabaseId)) continue
    const key = `local:${d.id}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push({ ...d, source: d.source || 'local' })
  }

  return merged
}

export function mergeUsers(remoteUsers, localUsers) {
  if (remoteUsers?.length) return remoteUsers
  return localUsers || []
}

export async function approveDeposit(depositId, snapshot) {
  const deposit = snapshot.pendingDeposits.find((d) => d.id === depositId)
  if (!deposit) return snapshot

  const supabaseResult = await approveDepositInSupabase(deposit)
  if (!supabaseResult.ok) {
    throw new Error(supabaseResult.error || 'Supabase approval failed')
  }

  const pendingDeposits = snapshot.pendingDeposits.filter((d) => d.id !== depositId)
  const approvedDeposits = [
    ...snapshot.approvedDeposits,
    { ...deposit, status: 'Approved', approvedAt: new Date().toISOString() },
  ]

  const usersData = { ...snapshot.usersByKey }
  const userKey = deposit.userEmail || deposit.userId
  const existing = usersData[userKey] || {
    id: userKey,
    email: deposit.userEmail || userKey,
    fullName: deposit.userEmail || userKey,
    usdBalance: 0,
    etbBalance: 0,
  }

  const isUsd = deposit.currency === 'USDT' || deposit.currency === 'USD'
  usersData[userKey] = {
    ...existing,
    usdBalance: isUsd ? Number(existing.usdBalance || 0) + Number(deposit.amount) : existing.usdBalance || 0,
    etbBalance: !isUsd ? Number(existing.etbBalance || 0) + Number(deposit.amount) : existing.etbBalance || 0,
  }

  writeJson('admin_pending_deposits', pendingDeposits)
  writeJson('admin_approved_deposits', approvedDeposits)
  writeJson('admin_user_data', usersData)

  try {
    const registered = readJson('platform_registered_users_data', {})
    const depositorEmail = deposit.userEmail || deposit.userId
    const depositorRecord =
      registered[depositorEmail] ||
      Object.values(registered).find((u) => u.userId === deposit.userId || u.email === depositorEmail)
    const referrerKey = depositorRecord?.referredBy

    const priorApprovedCount = snapshot.approvedDeposits.filter(
      (d) => d.userEmail === depositorEmail || d.userId === deposit.userId
    ).length
    const isFirstDeposit = priorApprovedCount === 0 && !depositorRecord?.referralRewardPaid

    if (referrerKey && isFirstDeposit) {
      const referrerRecord =
        usersData[referrerKey] ||
        usersData[registered[referrerKey]?.email] ||
        Object.values(usersData).find((u) => u.id === referrerKey || u.email === referrerKey)

      if (referrerRecord) {
        const referrerStorageKey = referrerRecord.email || referrerKey
        const referrerId = referrerRecord.id || referrerKey

        if (isUsd) {
          referrerRecord.usdBalance = Number((referrerRecord.usdBalance || 0) + REFERRAL_BONUS_USD)
        } else {
          referrerRecord.etbBalance = Number((referrerRecord.etbBalance || 0) + REFERRAL_BONUS_ETB)
        }

        const stats = loadReferralStats(referrerId)
        updateReferralStats(referrerId, {
          earningsUsd: isUsd ? (stats.earningsUsd || 0) + REFERRAL_BONUS_USD : stats.earningsUsd || 0,
          earningsEtb: !isUsd ? (stats.earningsEtb || 0) + REFERRAL_BONUS_ETB : stats.earningsEtb || 0,
          referralCount: (stats.referralCount || 0) + 1,
        })

        usersData[referrerStorageKey] = referrerRecord
        writeJson('admin_user_data', usersData)

        if (depositorRecord) {
          depositorRecord.referralRewardPaid = true
          registered[depositorEmail] = depositorRecord
          writeJson('platform_registered_users_data', registered)
        }

      }
    }
  } catch (err) {
    console.error('Referral bonus local sync error:', err)
  }

  return loadAdminSnapshot()
}

export async function rejectDeposit(depositId, snapshot) {
  const deposit = snapshot.pendingDeposits.find((d) => d.id === depositId)
  if (!deposit) return snapshot

  const rejectResult = await rejectDepositInSupabase(deposit)
  if (!rejectResult.ok) {
    throw new Error(rejectResult.error || 'Supabase reject failed')
  }

  const pendingDeposits = snapshot.pendingDeposits.filter((d) => d.id !== depositId)
  const rejectedDeposits = [
    ...snapshot.rejectedDeposits,
    { ...deposit, status: 'Rejected', rejectedAt: new Date().toISOString() },
  ]

  writeJson('admin_pending_deposits', pendingDeposits)
  writeJson('admin_rejected_deposits', rejectedDeposits)
  return loadAdminSnapshot()
}

export async function approveWithdrawal(withdrawalId, snapshot) {
  const withdrawal = snapshot.pendingWithdrawals.find((w) => w.id === withdrawalId)
  if (!withdrawal) return snapshot

  const result = await approveWithdrawalInSupabase(withdrawal)
  if (!result.ok) {
    throw new Error(result.error || 'Supabase withdrawal approval failed')
  }

  const pendingWithdrawals = snapshot.pendingWithdrawals.filter((w) => w.id !== withdrawalId)
  const approvedWithdrawals = [
    ...snapshot.approvedWithdrawals,
    { ...withdrawal, status: 'Approved', approvedAt: new Date().toISOString() },
  ]

  writeJson('admin_pending_withdrawals', pendingWithdrawals)
  writeJson('admin_approved_withdrawals', approvedWithdrawals)
  return loadAdminSnapshot()
}

export async function rejectWithdrawal(withdrawalId, snapshot) {
  const withdrawal = snapshot.pendingWithdrawals.find((w) => w.id === withdrawalId)
  if (!withdrawal) return snapshot

  const result = await rejectWithdrawalInSupabase(withdrawal)
  if (!result.ok) {
    throw new Error(result.error || 'Supabase withdrawal reject failed')
  }

  const pendingWithdrawals = snapshot.pendingWithdrawals.filter((w) => w.id !== withdrawalId)
  const rejectedWithdrawals = [
    ...snapshot.rejectedWithdrawals,
    { ...withdrawal, status: 'Rejected', rejectedAt: new Date().toISOString() },
  ]

  writeJson('admin_pending_withdrawals', pendingWithdrawals)
  writeJson('admin_rejected_withdrawals', rejectedWithdrawals)
  return loadAdminSnapshot()
}

export async function deleteUser(userId, snapshot) {
  const target = snapshot.users.find(
    (u) => u.id === userId || u.email === userId || u.user_id === userId
  )
  const dbId = target?.id || target?.user_id
  if (dbId && /^[0-9a-f-]{36}$/i.test(dbId)) {
    const result = await deleteUserInSupabase(dbId)
    if (!result.ok) {
      throw new Error(result.error || 'Failed to delete user from database')
    }
  }

  const usersData = { ...snapshot.usersByKey }
  delete usersData[userId]
  Object.keys(usersData).forEach((key) => {
    if (usersData[key]?.id === userId || usersData[key]?.email === userId) {
      delete usersData[key]
    }
  })

  const pendingDeposits = snapshot.pendingDeposits.filter(
    (d) => d.userId !== userId && d.userEmail !== userId
  )

  writeJson('admin_user_data', usersData)
  writeJson('admin_pending_deposits', pendingDeposits)
  return loadAdminSnapshot()
}
