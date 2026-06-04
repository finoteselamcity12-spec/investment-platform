import { Coins } from 'lucide-react'

const COIN_COUNT = 5

/**
 * Golden-yellow 3D brand header with coin row (login + dashboard).
 * @param {'login' | 'dashboard'} variant — sizing for short vs long title
 */
export default function BrandGoldHeader({ title, variant = 'login', className = '' }) {
  const isLogin = variant === 'login'
  const titleClass = [
    'brand-gold-3d w-full text-center font-extrabold tracking-wider',
    isLogin ? 'brand-gold-3d--login' : 'brand-gold-3d--dashboard',
  ].join(' ')

  const coinSize = isLogin ? 28 : 24
  const headerClass = `brand-header-block w-full ${className}`.trim()

  return (
    <header className={headerClass}>
      <div className="brand-coin-row" aria-hidden="true">
        {Array.from({ length: COIN_COUNT }, (_, i) => (
          <span key={i} className="brand-coin-icon">
            <Coins size={coinSize} strokeWidth={2.5} style={{ color: '#FFD700' }} />
          </span>
        ))}
      </div>
      <h1 className={titleClass} data-text={title}>
        {title}
      </h1>
    </header>
  )
}
