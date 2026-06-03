import { useState } from 'react'

export default function InvestPage({ ctx = {} }) {
  const { usdBalance, etbBalance } = ctx
  const [currency, setCurrency] = useState('USD')

  // Hardcoded USD plans (strict replacement)
  const usdPlans = [
    { amount: 3, days: 10, profit: 1.2, deposit: 2, bonus: 2 },
    { amount: 5, days: 15, profit: 2.2, deposit: 3, bonus: 3 },
    { amount: 7, days: 20, profit: 3, deposit: 3, bonus: 3 },
    { amount: 10, days: 22, profit: 4, deposit: 5, bonus: 5 },
    { amount: 15, days: 25, profit: 6, deposit: 7, bonus: 7 },
    { amount: 20, days: 27, profit: 8, deposit: 9, bonus: 9 },
    { amount: 25, days: 30, profit: 12, deposit: 11, bonus: 11 },
    { amount: 30, days: 32, profit: 13, deposit: 14, bonus: 14 },
    { amount: 35, days: 35, profit: 15, deposit: 16, bonus: 16 },
    { amount: 40, days: 37, profit: 17, deposit: 19, bonus: 19 },
    { amount: 45, days: 39, profit: 19, deposit: 21, bonus: 21 },
    { amount: 50, days: 41, profit: 21, deposit: 23, bonus: 23 },
    { amount: 75, days: 43, profit: 25, deposit: 27, bonus: 27 },
    { amount: 90, days: 45, profit: 30, deposit: 37, bonus: 37 },
    { amount: 110, days: 47, profit: 45, deposit: 53, bonus: 53 },
    { amount: 150, days: 49, profit: 54, deposit: 62, bonus: 62 },
    { amount: 200, days: 54, profit: 60, deposit: 68, bonus: 68 },
    { amount: 500, days: 57, profit: 74, deposit: 79, bonus: 79 },
    { amount: 1000, days: 69, profit: 155, deposit: 210, bonus: 210 },
    { amount: 5000, days: 72, profit: 360, deposit: 407, bonus: 407 },
  ]
  // Total column calculated as: Total = Profit + Deposit + Bonus

  // Hardcoded ETB plans (strict replacement)
  const etbPlans = [
    { amount: 350, days: 15, profit: 101, deposit: 63, bonus: 63 },
    { amount: 500, days: 20, profit: 142, deposit: 78, bonus: 78 },
    { amount: 700, days: 25, profit: 185, deposit: 104, bonus: 104 },
    { amount: 1000, days: 30, profit: 201, deposit: 268, bonus: 268 },
    { amount: 1500, days: 35, profit: 258, deposit: 309, bonus: 309 },
    { amount: 5000, days: 40, profit: 377, deposit: 492, bonus: 492 },
    { amount: 10000, days: 45, profit: 452, deposit: 608, bonus: 608 },
    { amount: 15000, days: 50, profit: 500, deposit: 702, bonus: 702 },
    { amount: 20000, days: 55, profit: 715, deposit: 9000, bonus: 9000 },
    { amount: 25000, days: 60, profit: 999, deposit: 1082, bonus: 1082 },
    { amount: 30000, days: 65, profit: 1130, deposit: 1800, bonus: 1800 },
    { amount: 35000, days: 70, profit: 1900, deposit: 3750, bonus: 3750 },
    { amount: 40000, days: 75, profit: 3999, deposit: 3600, bonus: 3600 },
    { amount: 45000, days: 80, profit: 4750, deposit: 4000, bonus: 4000 },
    { amount: 50000, days: 90, profit: 5000, deposit: 55000, bonus: 55000 },
  ]
  // Total column calculated as: Total = Profit + Deposit + Bonus

  function renderUsdTable() {
    return (
      <div>
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-950">USD Investment Plans</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left font-bold text-slate-950">Amount</th>
                <th className="px-4 py-3 text-center font-bold text-slate-950">Days</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Profit</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Deposit</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Bonus</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Total</th>
              </tr>
            </thead>
            <tbody>
              {usdPlans.map((p, idx) => {
                const profit = Number(p.profit) || 0
                const deposit = Number(p.deposit) || 0
                const bonus = Number(p.bonus) || 0
                const total = Number(profit) + Number(deposit) + Number(bonus)
                return (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-950">${(Number(p.amount)).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{p.days}</td>
                    <td className="px-4 py-3 text-right text-slate-700">${(Number(profit)).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-950">${(Number(deposit)).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">${(Number(bonus)).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#84CC16] text-base">${(Number(total)).toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderEtbTable() {
    return (
      <div>
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-950">ETB Investment Plans</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left font-bold text-slate-950">Amount</th>
                <th className="px-4 py-3 text-center font-bold text-slate-950">Days</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Profit</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Deposit</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Bonus</th>
                <th className="px-4 py-3 text-right font-bold text-slate-950">Total</th>
              </tr>
            </thead>
            <tbody>
              {etbPlans.map((p, idx) => {
                const profit = Number(p.profit) || 0
                const deposit = Number(p.deposit) || 0
                const bonus = Number(p.bonus) || 0
                const total = Number(profit) + Number(deposit) + Number(bonus)
                return (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-950">{(Number(p.amount)).toLocaleString()} Br</td>
                    <td className="px-4 py-3 text-center text-slate-700">{p.days}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{(Number(profit)).toLocaleString()} Br</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-950">{(Number(deposit)).toLocaleString()} Br</td>
                    <td className="px-4 py-3 text-right text-slate-700">{(Number(bonus)).toLocaleString()} Br</td>
                    <td className="px-4 py-3 text-right font-bold text-[#84CC16] text-base">{(Number(total)).toLocaleString()} Br</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-950">Investment Plans</h1>
          <p className="text-sm text-slate-600 mt-1">Select your investment tier</p>
        </div>

        {/* Currency Toggle */}
        <div className="flex gap-2 mb-6">
          <button 
            onClick={() => setCurrency('USD')} 
            className={`flex-1 px-4 py-2 rounded-xl font-semibold transition-all ${currency === 'USD' ? 'bg-[#84CC16] text-white shadow-lg shadow-[#84CC16]/30' : 'bg-white text-slate-700 border border-slate-200'}`}
          >
            USD ($)
          </button>
          <button 
            onClick={() => setCurrency('ETB')} 
            className={`flex-1 px-4 py-2 rounded-xl font-semibold transition-all ${currency === 'ETB' ? 'bg-[#84CC16] text-white shadow-lg shadow-[#84CC16]/30' : 'bg-white text-slate-700 border border-slate-200'}`}
          >
            ETB (Br)
          </button>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
          {currency === 'USD' ? renderUsdTable() : renderEtbTable()}
        </div>
      </div>
    </div>
  )
}
