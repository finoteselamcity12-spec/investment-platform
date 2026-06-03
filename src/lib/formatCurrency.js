export const formatCurrency = (amount, currency = 'ETB') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'ETB',
  }).format(amount)
}
