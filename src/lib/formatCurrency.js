export const formatCurrency = (amount, currency = 'ETB') => {
  const value = Number(amount)
  if (Number.isNaN(value)) {
    return currency === 'USD' ? '$0.00' : '0 Br'
  }
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  return `${value.toLocaleString('en-US')} Br`
}
