# Quick Reference: Transaction System

## 🚀 ONE-LINER USAGE

```javascript
// All transactions use this pattern:
const result = await processTransaction({
  type: 'deposit|withdrawal|invest|referral_bonus',
  amount: 100,
  currency: 'USD' | 'ETB',
  // ... optional params
})
```

---

## 📋 FUNCTION SIGNATURES

### Investment (User)
```javascript
await submitInvestment({
  amount: 100,
  currency: 'USD' | 'ETB',
  userId: uuid // optional
})
```

### Withdrawal (User)
```javascript
await submitWithdrawal({
  amount: 100,
  currency: 'USD' | 'ETB',
  bank: 'CBE',
  accountName: 'John Doe',
  accountNumber: '1234567890',
  paymentMethod: 'Telebirr',
  accountDetails: '{}', // optional JSON
  userId: uuid // optional
})
```

### Deposit Approval (Admin)
```javascript
await approveDeposit({
  amount: 100,
  currency: 'USD' | 'ETB',
  depositId: uuid, // reference to pending deposit
  paymentMethod: 'Bank Transfer',
  userId: uuid // optional
})
```

### Referral Bonus (Admin)
```javascript
await awardReferralBonus({
  userId: uuid,
  amount: 3, // USD or 125 ETB
  currency: 'USD' | 'ETB'
})
```

### Pending Deposit (User)
```javascript
await submitPendingDeposit({
  amount: 100,
  currency: 'USD' | 'ETB',
  transactionId: 'TXN123456',
  receiptFile: File,
  paymentMethod: 'Telebirr',
  userId: uuid // optional
})
```

---

## 🔄 STANDARD RESPONSE

```javascript
{
  ok: true | false,
  error: 'error_code', // if ok=false
  action: 'deposit|withdrawal|investment|referral_bonus',
  amount: 100,
  currency: 'USD|ETB',
  balance_etb: 1000.50,
  balance_usd: 50.25,
  // Plus transaction-specific fields
}
```

---

## ⚡ COMMON ERRORS

| Error | Cause | Fix |
|-------|-------|-----|
| `not_authenticated` | User not signed in | Call `getSession()` first |
| `invalid_amount` | Amount ≤ 0 | Validate input |
| `insufficient_balance` | Not enough money | Check balance first |
| `not_authorized` | Not admin | Use admin email |

---

## 📊 ALWAYS REFRESH AFTER TRANSACTIONS

```javascript
const balances = await refreshUserBalancesFromAuth(userId)
setUsdBalance(balances.usdBalance)
setEtbBalance(balances.etbBalance)
```

---

## 🔐 SECURITY

- ✅ RLS enabled on all tables
- ✅ Users see only their own data
- ✅ Admin functions require `is_admin()` check
- ✅ Balance updates use row locks (no race conditions)

---

## 📱 INTEGRATION PATTERN

```javascript
async function handleAction() {
  try {
    const result = await processTransaction({ /* ... */ })
    
    if (!result.ok) {
      showToast(result.error, 'error')
      return
    }
    
    // Refresh UI
    const balances = await refreshUserBalancesFromAuth()
    setBalances(balances)
    
    showToast('Success!', 'success')
  } catch (error) {
    console.error(error)
    showToast('Unexpected error', 'error')
  }
}
```

---

## 🗂️ DATABASE TABLES

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `balances` | Current wallet state | etb_balance, usd_balance, etb_wallet, usd_wallet |
| `history` | Transaction log | action, amount_etb, amount_usd, currency, created_at |
| `deposits` | Pending/approved deposits | amount_etb, amount_usd, status, proof_url |
| `withdrawals` | User withdrawal requests | amount_etb, amount_usd, bank, account_name, status |
| `investments` | Active/completed investments | amount_etb, amount_usd, status, created_at |

---

## 🔗 FLOW DIAGRAMS

### User Investment
```
User submits amount
        ↓
submitInvestment() → process_transaction('invest')
        ↓
Backend: check balance → deduct → log → return new balance
        ↓
Frontend: refresh UI → show success
```

### User Withdrawal
```
User submits form
        ↓
submitWithdrawal() → process_transaction('withdrawal')
        ↓
Backend: check balance → deduct → create record → log → return new balance
        ↓
Frontend: refresh UI → show "pending admin approval"
```

### Deposit Approval (Admin)
```
Admin approves pending deposit
        ↓
approveDeposit() → process_transaction('deposit')
        ↓
Backend: add amount + 10% bonus → log → update status
        ↓
Frontend: show success, update deposit status
```

---

## 📝 SQL QUERIES FOR DEBUGGING

### See all transactions for a user
```sql
SELECT action, amount_etb, amount_usd, currency, created_at 
FROM history 
WHERE user_id = 'uuid-here' 
ORDER BY created_at DESC;
```

### Check balance
```sql
SELECT etb_balance, usd_balance FROM balances WHERE user_id = 'uuid-here';
```

### See pending deposits
```sql
SELECT * FROM deposits WHERE status = 'pending' ORDER BY created_at DESC;
```

### See pending withdrawals
```sql
SELECT * FROM withdrawals WHERE status = 'pending' ORDER BY created_at DESC;
```

---

## ✅ TESTING CHECKLIST

- [ ] New user gets 100 ETB signup bonus
- [ ] User can view balance
- [ ] User can invest (balance decreases)
- [ ] User can withdraw (balance decreases)
- [ ] User can submit deposit proof
- [ ] Admin can approve deposit (balance increases + 10% bonus)
- [ ] Admin can award referral bonus
- [ ] All actions logged in history
- [ ] All transactions have correct amounts
- [ ] Balance refresh works immediately after transaction

---

## 🚨 CRITICAL RULES

1. **Always use `process_transaction`** - No direct balance updates
2. **Always refresh balances after transactions** - UI must stay in sync
3. **Check errors in every response** - Handle failures gracefully
4. **Log all transactions** - Audit trail is automatic
5. **Use Row Level Security** - RLS protects user data

---

## 📞 SUPPORT

| Issue | Where to Look |
|-------|---------------|
| Transaction failed | Browser console → RPC error |
| Balance not updating | Call `refreshUserBalancesFromAuth()` |
| User can't see data | Check RLS policies in Supabase |
| Admin function blocked | Check `is_admin()` function, verify email |
| Old data showing | Clear browser cache, hard refresh |

---

Generated: 2026-06-06
