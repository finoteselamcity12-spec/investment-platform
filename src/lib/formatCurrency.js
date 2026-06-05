export function formatCurrency(amount, currency = 'ETB') {
  const value = Number(amount)
  if (Number.isNaN(value)) {
    return currency === 'USD' ? '$0.00' : '0 Br'
  }

  if (currency === 'USD' || currency === 'USDT') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} Br`
}
