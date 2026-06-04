import {
  REFERRAL_BONUS_ETB,
  REFERRAL_BONUS_USD,
  WITHDRAWAL_MIN_ETB,
  WITHDRAWAL_MIN_USD,
} from './platformConfig'

export const TELEGRAM_USERNAME = '@investment_platform_3'
export const TELEGRAM_URL = 'https://t.me/investment_platform_3'
export const SUPPORT_EMAIL = 'balackrock@gmail.com'

export const GOAL_TEXT =
  'Our Goal: At Blackrock Investment, our goal is to empower individuals by providing a secure, transparent, and sustainable financial ecosystem. We bridge the gap between complex market opportunities and everyday investors through innovative technology and strategic asset management. Our commitment is to ensure long-term wealth growth, absolute transparency, and ironclad security for every user. We believe in building a future where financial freedom is accessible, reliable, and consistent for everyone, regardless of their starting point. Your trust is our greatest asset, and we are dedicated to protecting it with industry-leading security practices and consistent, performance-driven results.'

export const TERMS_HEADING = 'Terms, Conditions, and User Guide:'

export const TERMS_SECTIONS = [
  {
    title: 'Registration',
    bullets: [
      'Users must register using a valid Email Address and Password.',
      'New accounts receive an automatic sign-up bonus of 150 ETB and 1.7 USD.',
    ],
  },
  {
    title: 'Deposit',
    bullets: [
      'To add funds, navigate to the "Deposit" section, select your preferred payment method, and follow the instructions to transfer funds to our verified wallet.',
    ],
  },
  {
    title: 'Investment',
    bullets: [
      'Go to the "Invest" page, choose a plan that fits your goals, and click "Invest" to start earning daily returns.',
    ],
  },
  {
    title: 'Daily Claim',
    bullets: [
      'Your earnings are credited every 24 hours. Navigate to your dashboard and click "Claim" to add your profit to your balance.',
    ],
  },
  {
    title: 'Withdrawal',
    bullets: [
      'To withdraw, go to the "Withdrawal" section, enter your wallet address and amount.',
      `Minimum withdrawal: ${WITHDRAWAL_MIN_ETB} ETB or $${WITHDRAWAL_MIN_USD} USD.`,
      'Requests are processed within 24–48 hours.',
    ],
  },
  {
    title: 'Invite (Referral)',
    bullets: [
      'Grow your network by sharing your unique referral link from the "Invite" section.',
      `When your invitee makes their first approved deposit, you earn ${REFERRAL_BONUS_USD} USD (USD/USDT) or ${REFERRAL_BONUS_ETB} ETB (ETB). Bonuses apply once per invited user.`,
    ],
  },
  {
    title: 'Official Support',
    bullets: [
      `Telegram: ${TELEGRAM_USERNAME}`,
      `Email: ${SUPPORT_EMAIL}`,
    ],
  },
  {
    title: 'Security & Compliance',
    bullets: [
      'By using this platform, you agree to these terms. Unauthorized use is prohibited.',
      'Blackrock Investment is not liable for market risks; invest responsibly.',
    ],
  },
]
