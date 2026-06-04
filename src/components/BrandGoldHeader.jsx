import { Coins } from 'lucide-react'

const COIN_COUNT = 5

/**
 * Orange-gold 3D brand header with coin row (login + dashboard).
 * @param {'login' | 'dashboard'} variant — sizing for short vs long title
 */
export default function BrandGoldHeader({ title, variant = 'login', className = '' }) {
  const titleClass =
    variant === 'dashboard'
      ? 'brand-gold-3d brand-gold-3d--dashboard'
      : 'brand-gold-3d brand-gold-3d--login'

  return (
    <header className={`brand-header-block ${className}`.trim()}>
      <div className="brand-coin-row" aria-hidden="true">
        {Array.from({ length: COIN_COUNT }, (_, i) => (
          <span key={i} className="brand-coin-icon">
            <Coins size={22} strokeWidth={2.25} />
          </span>
        ))}
      </div>
      <h1 className={titleClass} data-text={title}>
        {title}
      </h1>
    </header>
  )
}
