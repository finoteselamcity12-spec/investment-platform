import {
  REGISTRATION_BONUS_ETB,
  REGISTRATION_BONUS_USD,
} from './platformConfig'

const SIGNUP_BONUS_ETB_ID = 'signup-bonus-etb'
const SIGNUP_BONUS_USD_ID = 'signup-bonus-usd'

export function ensureSignupBonusHistoryRecords(email) {
  if (!email) return

  const txns = JSON.parse(localStorage.getItem('user_transactions') || '[]')
  const hasEtb = txns.some((t) => t.id === `${SIGNUP_BONUS_ETB_ID}-${email}`)
  const hasUsd = txns.some((t) => t.id === `${SIGNUP_BONUS_USD_ID}-${email}`)

  if (hasEtb && hasUsd) return

  const userData = JSON.parse(localStorage.getItem('admin_user_data') || '{}')
  const user = userData[email]
  if (!user) return null

  const createdAt = user.createdAt || new Date().toISOString()

  if (!hasEtb) {
    txns.unshift({
      id: `${SIGNUP_BONUS_ETB_ID}-${email}`,
      type: 'Bonus',
      category: 'Deposits',
      title: 'Sign-up Bonus (ETB)',
      amount: REGISTRATION_BONUS_ETB,
      currency: 'ETB',
      status: 'Completed',
      date: createdAt,
    })
  }

  if (!hasUsd) {
    txns.unshift({
      id: `${SIGNUP_BONUS_USD_ID}-${email}`,
      type: 'Bonus',
      category: 'Deposits',
      title: 'Sign-up Bonus (USD)',
      amount: REGISTRATION_BONUS_USD,
      currency: 'USD',
      status: 'Completed',
      date: createdAt,
    })
  }

  localStorage.setItem('user_transactions', JSON.stringify(txns))
  return txns
}
