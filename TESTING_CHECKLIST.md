# Complete Testing Checklist - Three Core Flows

**Status**: ✅ All code reviewed, built, and verified. Ready for end-to-end testing.

---

## Pre-Testing Requirements

### Critical: Enable Supabase Realtime Replication
1. Open Supabase Console
2. Go to **Database** → **Replication**
3. Find the **`balances`** table
4. Ensure it has **"Replicate all"** enabled (green checkmark)
   - If not, click the checkmark to enable
5. Save/confirm
6. ⏱️ Wait 30 seconds for changes to propagate

**Why**: Without this, balance updates after admin approval will take up to 5 seconds instead of being instant. With it, updates appear immediately.

---

## Test Setup

### Create Test Accounts

**Test Admin Account**
- Email: `admin@test.com` (or use your admin email if different)
- Password: `TestAdmin123!`
- Admin Authorization: Set email to match ADMIN_EMAIL in code

**Test User Account**
- Email: `user@test.com`
- Password: `TestUser123!`
- First name: "Test"
- Last name: "User"

---

## Flow 1: Deposit & Admin Approval ✅

### 1.1 User Submits Deposit

**Action Steps**:
1. Log in as `user@test.com`
2. Go to **Deposit**
3. Select currency: **ETB** (Birr)
4. Select payment method: **Telebirr (Merchant)**
5. Enter amount: `500` (Birr)
6. Enter transaction ID: `TEST123`
7. Upload a test receipt image (any JPG/PNG)
8. Click **Submit Deposit**

**Expected Results**:
- ✅ Green success message appears: "✅ Deposit submitted! Waiting for admin approval."
- ✅ Amount field clears to empty
- ✅ Transaction ID field clears to empty
- ✅ Receipt file clears
- ✅ No error messages

**Backend Check** (Supabase Console):
- Go to SQL Editor
- Run: `SELECT * FROM public.deposits WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1;`
- Verify: user_id matches user account, amount = 500, status = 'pending'

---

### 1.2 Admin Approves Deposit

**Action Steps**:
1. Log out or open new browser window
2. Go to `/admin` (append to URL)
3. Log in as admin (email: `admin@test.com`)
4. Go to **Deposits** tab
5. Find the pending deposit from Test User (500 Birr)
6. Click **Approve** button

**Expected Results**:
- ✅ Alert pops up: "✅ Approved! 550 ETB added to user balance." (550 = 500 + 10% bonus)
- ✅ Deposit status changes to "successful" in list
- ✅ No error alerts

**Backend Check** (Supabase Console):
- Run: `SELECT * FROM public.balances WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user@test.com');`
- Verify: `etb_balance` = 550 (500 deposit + 50 bonus)

---

### 1.3 User Sees Balance Update (Realtime Check)

**Action Steps**:
1. Switch back to user window (or stay if using new admin window)
2. User should be on **Home** page
3. Observe ETB Wallet balance

**Expected Results - WITH Replication Enabled**:
- ✅ Within **1-2 seconds**: ETB Wallet updates from 0 to "550 Br"
- ✅ Balance displays with comma separator: "550 Br"

**Expected Results - WITHOUT Replication**:
- ✅ Within **5 seconds**: ETB Wallet updates to "550 Br"
- ⏱️ Delay is due to polling fallback (not realtime)

**User Action**:
- Manually refresh page (F5) to verify balance persists
- Balance should still show 550 Br

---

## Flow 2: Withdrawal ✅

### 2.1 User Initiates Withdrawal

**Precondition**: ETB balance should be ≥ 300 Birr (from previous deposit approval)

**Action Steps**:
1. User on **Home** page
2. Click **Withdraw** button
3. Verify "550 Br" displays at top in balance section
4. Select currency: **ETB**
5. Select bank: **CBE**
6. Select payment method: **Telebirr**
7. Enter account name: **Test User Account**
8. Enter account number: **0123456789**
9. Enter amount: `300` (ETB)
10. Click **Submit Withdrawal**

**Expected Results**:
- ✅ Green toast appears: "Withdrawal request submitted successfully!"
- ✅ All form fields clear:
  - Amount: empty
  - Bank: resets to "CBE"
  - Payment method: resets to "Telebirr"
  - Account name: empty
  - Account number: empty
- ✅ Page redirects to **Home** after ~1.2 seconds

**Backend Check** (Supabase Console):
- Run: `SELECT * FROM public.withdrawals WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1;`
- Verify: user_id matches user account, amount = 300, currency = 'ETB', status = 'pending'

---

### 2.2 User Balance After Withdrawal Request

**Observation**:
1. User redirected to Home
2. Check ETB Wallet balance

**Expected Results**:
- ✅ Balance updated to reflect withdrawal
- Current formula: Should see reduction based on RPC response

**Note**: Withdrawal reduces available balance. Admin approval is required for funds to be released.

---

## Flow 3: USD Deposit (Alternative Currency) ✅

### 3.1 User Deposits USD

**Action Steps**:
1. User on **Deposit** page
2. Select currency: **USD**
3. Payment method should auto-select: **USDT (TRC20)**
4. Verify address displays: `TQjEAMhuezFdqKww9o5NWFBJhNKTgTpLMU`
5. Enter amount: `5` (USD)
6. Enter transaction ID: `USD123ABC`
7. Upload receipt image
8. Click **Submit Deposit**

**Expected Results**:
- ✅ Green success message appears
- ✅ Form clears
- ✅ No errors

**Backend Check**:
- Run: `SELECT * FROM public.deposits WHERE status = 'pending' AND currency = 'USD' ORDER BY created_at DESC LIMIT 1;`
- Verify: amount_usd = 5, amount_etb = 0

---

### 3.2 Admin Approves USD Deposit

**Action Steps**:
1. Admin goes to **Deposits** tab
2. Find pending USD deposit (5 USDT)
3. Click **Approve**

**Expected Results**:
- ✅ Alert: "✅ Approved! 5.50 USD added to user balance." (5 + 10% bonus)
- ✅ Deposit status → "successful"

**User Balance Check**:
- User should see USD Wallet update to "**$5.50**"

---

## Flow 4: Bonus Display (Welcome Bonus) 🎁

### 4.1 Verify 10% Welcome Bonus

**Observation**:
1. After first deposit approval (500 Birr):
   - ✅ User receives: 500 + 50 (bonus) = 550 Birr
2. After second deposit approval (5 USD):
   - ✅ User receives: 5 + 0.50 (bonus) = 5.50 USD

**Note**: Bonus is automatically calculated by admin_approve_deposit RPC

---

## Flow 5: Error Handling ✅

### 5.1 Test Insufficient Balance Withdrawal

**Action Steps**:
1. User selects **Withdraw**
2. Currency: **USD**
3. Amount: `100` (user only has ~$5.50)
4. Click **Submit**

**Expected Results**:
- ✅ Red error toast: "Insufficient USD balance for this withdrawal."
- ✅ Form does NOT submit
- ✅ Balance remains unchanged

---

### 5.2 Test Minimum Withdrawal Violation

**Action Steps**:
1. User selects **Withdraw**
2. Currency: **ETB**
3. Amount: `100` (below 300 minimum)
4. Click **Submit**

**Expected Results**:
- ✅ Red error toast: "Minimum withdrawal is 300 Birr."
- ✅ Form does NOT submit

---

## Success Criteria - All Must Pass ✅

- [ ] Deposit success message displays (green, clear text)
- [ ] Withdrawal success message displays (green, clear text)
- [ ] Form fields clear after successful submission
- [ ] Balance updates after admin approval (within 1-2 seconds if realtime enabled, 5 seconds max)
- [ ] Admin approval alert shows correct bonus amount
- [ ] USD deposit/withdrawal works separately from ETB
- [ ] Insufficient balance errors prevent submission
- [ ] Minimum withdrawal errors prevent submission
- [ ] All navigation between pages works smoothly
- [ ] No console errors or warnings
- [ ] Build succeeds (already verified: ✅)

---

## Troubleshooting

### Issue: Balance not updating after admin approval
**Solutions** (in order):
1. ✅ Check Supabase replication is enabled for `balances` table
2. ✅ Manually refresh browser (F5)
3. ✅ Wait 5 seconds (polling fallback)
4. ✅ Check browser console for errors: Open DevTools (F12) → Console tab
5. ✅ Verify admin email is correct in database

### Issue: Deposit/Withdrawal form not submitting
**Check**:
1. ✅ Receipt file is uploaded (required for deposit)
2. ✅ All required fields filled
3. ✅ Amount > 0
4. ✅ No validation errors shown

### Issue: Admin approval shows error
**Check**:
1. ✅ Admin account exists and is authorized
2. ✅ Deposit status is "pending" (not already approved)
3. ✅ User ID exists in auth.users table

---

## Browser DevTools Console Checks

Open **DevTools** (F12) → **Console** tab and look for errors containing:
- ❌ "not_admin" → Admin authorization issue
- ❌ "deposit_not_found" → Wrong deposit ID
- ❌ "insufficient_balance" → Validation issue
- ✅ "Deposit insert: null" or "Deposit insert: [array]" → Success (null error = success)

All other messages should be informational logs.

---

## Final Verification

After all tests pass:

1. [ ] Create final test report with dates/times
2. [ ] Screenshot balance before and after approval
3. [ ] Screenshot success messages
4. [ ] Note any issues or unexpected behavior
5. [ ] Commit code changes with message:
   ```
   "Complete: audit and fix deposit/withdrawal/admin flows with fresh auth and realtime updates"
   ```

---

## Quick Reference

| Component | File | Fresh Auth | Realtime | Polling |
|-----------|------|-----------|----------|---------|
| Deposit   | DepositPage.jsx | ✅ | N/A | N/A |
| Withdraw  | Withdraw.jsx | ✅ | N/A | N/A |
| Admin Approval | AdminDashboardApp.jsx | ✅ | Triggers | - |
| Balance Display | AppShell.jsx | ✅ | ✅ | ✅ 5s |
| Balance Display | HomePage.jsx | Via ctx | Via ctx | Via ctx |

---

*Last Updated: 2024 - Complete audit and verification of all three core flows*
