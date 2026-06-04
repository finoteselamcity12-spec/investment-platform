import { Coins } from 'lucide-react'

const COIN_COUNT = 5

/**
 * Orange-gold 3D brand header with coin row (login + dashboard).
 * @param {'login' | 'dashboard'} variant — sizing for short vs long title
 */
export default function BrandGoldHeader({ title, variant = 'login', className = '' }) {
  const isLogin = variant === 'login'
  const titleClass = isLogin
    ? 'brand-gold-3d brand-gold-3d--login w-full text-center font-extrabold tracking-wider'
    : 'brand-gold-3d brand-gold-3d--dashboard'

  const coinSize = isLogin ? 28 : 24
  const headerClass = `brand-header-block ${isLogin ? 'w-full' : ''} ${className}`.trim()

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
