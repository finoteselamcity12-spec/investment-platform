import { formatCurrency } from '../src/lib/formatCurrency.js'

console.log('formatCurrency USD 123.456 ->', formatCurrency(123.456, 'USD'))
console.log('formatCurrency ETB 123456 ->', formatCurrency(123456, 'ETB'))

const usdGain = '2.5'
const etbGain = '150'
let usdBalance = '10.25'
let etbBalance = '1000'

usdBalance = Number((Number(usdBalance) + Number(usdGain)).toFixed(2))
etbBalance = Number((Number(etbBalance) + Number(etbGain)).toFixed(2))

console.log('Updated usdBalance:', usdBalance)
console.log('Updated etbBalance:', etbBalance)

const tier = { profit: '3', bonus: '2' }
const total = Number((Number(tier.profit) + Number(tier.bonus)).toFixed(3))
console.log('Tier total:', total)

console.log('All numeric operations completed without TypeError')
