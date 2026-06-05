/** Platform-wide business rules */
export const REGISTRATION_BONUS_USD = 1.7
export const REGISTRATION_BONUS_ETB = 150
/** ETB per 1 USD (derived from registration bonus parity) */
export const ETB_PER_USD = REGISTRATION_BONUS_ETB / REGISTRATION_BONUS_USD

export function convertEtbToUsd(etbAmount) {
  const etb = Number(etbAmount) || 0
  if (!ETB_PER_USD) return 0
  return etb / ETB_PER_USD
}

/** Combined total in USD for dashboard display */
export function computeTotalBalanceUsd(usdBalance, etbBalance) {
  return (Number(usdBalance) || 0) + convertEtbToUsd(etbBalance)
}
/** public.history action for one-time registration bonus */
export const WELCOME_BONUS_ACTION = 'welcome_bonus'
/** 10% of approved deposit amount */
export const DEPOSIT_BONUS_RATE = 0.1
export const REFERRAL_BONUS_USD = 3
export const REFERRAL_BONUS_ETB = 125
export const WITHDRAWAL_MIN_USD = 3
export const WITHDRAWAL_MIN_ETB = 300
/** Default daily interest rate used to compute daily profit (e.g. 0.05 = 5%) */
export const DAILY_INTEREST_RATE = 0.05
