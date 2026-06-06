# Clean Build Implementation Guide

## Overview
This guide walks you through setting up a completely fresh database and integrating the unified transaction processing system.

---

## STEP 1: SQL SCHEMA SETUP

### In Supabase Dashboard:
1. Go to **SQL Editor** → **New Query**
2. Copy the entire contents of `CLEAN_BUILD.sql`
3. Paste into the SQL editor
4. Click **Execute**

**What this creates:**
- ✅ `balances` table (100 ETB signup bonus automatic)
- ✅ `history` table (transaction log)
- ✅ `deposits`, `withdrawals`, `investments` tables
- ✅ `handle_new_user` trigger (auto-creates balance on signup)
- ✅ `process_transaction` RPC function (unified handler)
- ✅ Row-level security policies
- ✅ Performance indexes

---

## STEP 2: VERIFY SETUP

Run this query in Supabase SQL Editor to confirm tables exist:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

You should see:
- balances
- deposits
- history
- investments
- withdrawals

---

## STEP 3: FRONTEND INTEGRATION

### Option A: Replace Current supabaseData.js (Recommended)

Replace `src/lib/supabaseData.js` with the contents of `supabaseData_v2.js`:

```bash
# Copy the new version
cp src/lib/supabaseData_v2.js src/lib/supabaseData.js
```

### Option B: Keep Both and Import Carefully

If you want to keep the old file, import from v2 in your components:

```javascript
import {
  processTransaction,
  submitInvestment,
  submitWithdrawal,
  approveDeposit,
  refreshUserBalancesFromAuth,
} from '../lib/supabaseData_v2'
```

---

## STEP 4: USAGE EXAMPLES

### Example 1: User Invests Money

```javascript
// In InvestPage.jsx
import { submitInvestment, refreshUserBalancesFromAuth } from '../lib/supabaseData'

async function handleInvest(amount, currency) {
  const userId = getSession()?.user?.id
  
  const result = await submitInvestment({
    amount,
    currency, // 'USD' or 'ETB'
    userId,
  })

  if (!result.ok) {
    showToast(`Investment failed: ${result.error}`, 'error')
    return
  }

  // Refresh UI
  const balances = await refreshUserBalancesFromAuth(userId)
  setUsdBalance(balances.usdBalance)
  setEtbBalance(balances.etbBalance)
  
  showToast('Investment successful!', 'success')
}
```

### Example 2: User Withdraws Money

```javascript
// In Withdraw.jsx
import { submitWithdrawal, refreshUserBalancesFromAuth } from '../lib/supabaseData'

async function handleWithdraw({
  amount,
  currency,
  bank,
  accountName,
  accountNumber,
  paymentMethod,
}) {
  const userId = getSession()?.user?.id
  
  const result = await submitWithdrawal({
    amount,
    currency,
    bank,
    accountName,
    accountNumber,
    paymentMethod,
    userId,
  })

  if (!result.ok) {
    showToast(`Withdrawal failed: ${result.error}`, 'error')
    return
  }

  // Refresh UI
  const balances = await refreshUserBalancesFromAuth(userId)
  setUsdBalance(balances.usdBalance)
  setEtbBalance(balances.etbBalance)
  
  showToast('Withdrawal request submitted!', 'success')
}
```

### Example 3: Admin Approves Deposit

```javascript
// In AdminDashboard.jsx
import { approveDeposit } from '../lib/supabaseData'

async function handleApproveDeposit(deposit) {
  const result = await approveDeposit({
    amount: deposit.amount_usd || deposit.amount_etb,
    currency: deposit.currency,
    depositId: deposit.id, // reference to the pending deposit
  })

  if (!result.ok) {
    showToast(`Approval failed: ${result.error}`, 'error')
    return
  }

  showToast('Deposit approved successfully!', 'success')
  // Refresh deposits list
  loadPendingDeposits()
}
```

### Example 4: Award Referral Bonus

```javascript
// In AdminDashboard.jsx
import { awardReferralBonus } from '../lib/supabaseData'

async function handleReferralBonus(inviteeUserId, currency) {
  const bonusAmount = currency === 'USD' ? 3 : 125
  
  const result = await awardReferralBonus({
    userId: inviteeUserId,
    amount: bonusAmount,
    currency,
  })

  if (!result.ok) {
    showToast(`Bonus failed: ${result.error}`, 'error')
    return
  }

  showToast('Referral bonus awarded!', 'success')
}
```

### Example 5: Submit Pending Deposit

```javascript
// In DepositPage.jsx
import { submitPendingDeposit } from '../lib/supabaseData'

async function handleSubmitDeposit({
  amount,
  currency,
  transactionId,
  receiptFile,
  paymentMethod,
}) {
  const result = await submitPendingDeposit({
    amount,
    currency,
    transactionId,
    receiptFile,
    paymentMethod,
  })

  if (!result.ok) {
    displayToast(result.error || 'Deposit submission failed', 'error')
    return
  }

  displayToast('Deposit submitted! Waiting for admin approval.', 'success')
  // Reset form
  setAmount('')
  setTransactionId('')
  setReceiptFile(null)
}
```

---

## STEP 5: TRANSACTION FLOW SUMMARY

### Deposit Flow
1. **User submits proof** → `submitPendingDeposit()` → Creates pending deposit record
2. **Admin reviews & approves** → `approveDeposit()` → Calls `process_transaction('deposit')`
3. **Backend**: 
   - Updates user balance (+ 10% bonus)
   - Logs to history
   - Marks deposit as successful

### Withdrawal Flow
1. **User requests withdrawal** → `submitWithdrawal()`
2. **Backend**:
   - Checks balance
   - Deducts amount
   - Creates withdrawal record
   - Logs to history
   - Returns pending status

### Investment Flow
1. **User invests** → `submitInvestment()`
2. **Backend**:
   - Checks balance
   - Deducts amount
   - Creates investment record
   - Logs to history

### Referral Bonus Flow
1. **Admin triggers bonus** → `awardReferralBonus()`
2. **Backend**:
   - Adds bonus to balance
   - Logs to history

---

## STEP 6: KEY FUNCTIONS REFERENCE

### Core Transaction Function
```javascript
processTransaction({
  type: 'deposit' | 'withdrawal' | 'invest' | 'referral_bonus',
  amount: NUMERIC,
  currency: 'USD' | 'ETB',
  referenceId: UUID | null,
  bank: STRING | null,
  accountName: STRING | null,
  accountNumber: STRING | null,
  paymentMethod: STRING | null,
  accountDetails: JSON STRING | null,
  userId: UUID | null,
})
```

### Convenience Wrappers
- `approveDeposit()` - Deposit approval (admin)
- `submitWithdrawal()` - Withdrawal request
- `submitInvestment()` - Investment deduction
- `awardReferralBonus()` - Referral bonus (admin)
- `submitPendingDeposit()` - Create pending deposit record
- `fetchUserBalances()` - Read current balances
- `refreshUserBalancesFromAuth()` - Fetch & return fresh balances

---

## STEP 7: BALANCE REFRESH BEST PRACTICES

After any transaction, always refresh:

```javascript
const balances = await refreshUserBalancesFromAuth(userId)
setUsdBalance(balances.usdBalance)
setEtbBalance(balances.etbBalance)
```

Or use a single call:

```javascript
const { usdBalance, etbBalance } = await refreshUserBalancesFromAuth()
```

---

## STEP 8: ERROR HANDLING

All functions return:

```javascript
{
  ok: true | false,
  error: 'error_code', // if ok=false
  // Plus: action, amount, currency, balance_etb, balance_usd, etc.
}
```

Standard error codes:
- `not_authenticated` - User not logged in
- `invalid_amount` - Amount ≤ 0
- `insufficient_balance` - Not enough money
- `not_authorized` - Admin-only action
- `supabase_not_configured` - Missing env vars

---

## STEP 9: TESTING

Test the complete setup:

```bash
cd c:\Users\HP\Desktop\investment-platform
npm run dev
```

Then in your app:
1. **Sign up** → Should auto-create balance with 100 ETB
2. **Check balances** → Should display 100 ETB
3. **Try withdrawal** → Should deduct from balance
4. **Try investment** → Should deduct from balance
5. **Check history** → Should see all transactions logged

---

## STEP 10: DEBUGGING

### Check balances directly:
```sql
SELECT user_id, etb_balance, usd_balance FROM public.balances;
```

### Check transaction history:
```sql
SELECT user_id, action, amount_etb, amount_usd, currency, created_at 
FROM public.history 
ORDER BY created_at DESC;
```

### Check for errors in deployment:
```bash
npm run build
npm run preview
```

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| "Not authenticated" | Ensure user is logged in via `getSession()` |
| "Insufficient balance" | Check current balance with `refreshUserBalancesFromAuth()` |
| "Not authorized" | Admin functions require admin email in `is_admin()` |
| "Transaction failed" | Check browser console for RPC error details |
| Balances not updating | Call `refreshUserBalancesFromAuth()` after transaction |
| Deposits stuck pending | Admin must call `approveDeposit()` |

---

## DEPLOYMENT CHECKLIST

- [ ] SQL executed in Supabase
- [ ] `supabaseData.js` updated to v2
- [ ] All imports updated in components
- [ ] Balance refresh added after each transaction
- [ ] Error handling implemented
- [ ] Admin email added to `is_admin()` function
- [ ] Tested: signup bonus appears
- [ ] Tested: withdrawal reduces balance
- [ ] Tested: investment reduces balance
- [ ] Tested: history logs correctly
- [ ] Frontend builds without errors

---

## NEXT STEPS

1. Run the SQL in Supabase
2. Update frontend files
3. Test each transaction type
4. Deploy to production
5. Monitor transaction logs in Supabase dashboard
