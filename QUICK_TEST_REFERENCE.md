# Quick Testing Reference

## 🚀 30-Minute Quick Start

### Pre-Test (5 min)
```bash
# Enable Realtime Replication in Supabase Console
# Database → Replication → balances table → checkmark to enable
# Wait 30 seconds
```

### Create Test Accounts (2 min)
- **Admin**: admin@test.com / TestAdmin123!
- **User**: user@test.com / TestUser123!

### Test Deposit Flow (8 min)
```javascript
// As User:
1. Deposit → ETB → 500 Birr
2. Submit → See ✅ Green success
3. Verify balance in DB (should be pending)

// As Admin:
4. Approve deposit → See alert "✅ Approved! 550 ETB..."
5. Check DB balance (should be 550)

// As User (switch back):
6. Refresh page → See "550 Br" on Home
```

### Test Withdrawal Flow (8 min)
```javascript
// As User:
1. Withdraw → ETB → 300 Birr
2. Fill account details → Submit
3. See ✅ "Withdrawal request submitted successfully!"
4. Form clears → Auto-redirects to Home

// Verify:
5. Check DB withdrawals table (should have pending entry)
```

### Test Error Handling (3 min)
```javascript
// Try these:
1. Withdraw $100 with only $5.50 balance
   → See: "Insufficient USD balance"
2. Withdraw $1 (below $3 minimum)
   → See: "Minimum withdrawal is $3"
3. Submit deposit without receipt file
   → Button disabled (can't click)
```

### Test USD Currency (4 min)
```javascript
// As User:
1. Deposit → USD → 5 USDT
2. Submit → Green success
3. Verify: amount_usd = 5 in DB

// As Admin:
4. Approve → Alert shows "$5.50"
5. Verify: usd_balance = 5.50 in DB
```

---

## ✅ Pass/Fail Checklist

```
DEPOSIT FLOW
☐ Form shows payment instructions
☐ Currency selection works (ETB/USD)
☐ Payment method updates with currency
☐ Copy button works for payment ID
☐ File upload accepts images only
☐ Submit disabled until receipt uploaded
☐ Green success message shows
☐ Form resets (amount, transaction ID clear)
☐ Database has pending deposit

ADMIN APPROVAL
☐ Deposit appears in admin list
☐ Approve button triggers alert
☐ Alert shows correct bonus (10%)
☐ Deposit status changes to "successful"
☐ Database balance updated correctly

BALANCE UPDATE
☐ Balance visible on Home page
☐ Updates within 1-2 seconds (realtime) OR 5 seconds (polling)
☐ Persists after page refresh
☐ Shows correct currency format (550 Br or $5.50)

WITHDRAWAL FLOW
☐ Current balance shows at top
☐ Validation prevents: insufficient balance
☐ Validation prevents: below minimum
☐ Success toast appears and disappears
☐ Form resets completely
☐ Auto-redirects to Home
☐ Database has pending withdrawal

ERROR HANDLING
☐ Insufficient balance shows error
☐ Minimum violation shows error
☐ Missing fields show error
☐ All errors are readable and helpful
```

---

## 🔍 Database Queries

### Check Pending Deposits
```sql
SELECT id, user_id, amount, currency, status, created_at
FROM public.deposits
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;
```

### Check User Balance
```sql
SELECT user_id, etb_balance, usd_balance, etb_wallet, usd_wallet
FROM public.balances
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user@test.com');
```

### Check Transaction History
```sql
SELECT user_id, action, amount, currency, status, created_at
FROM public.history
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user@test.com')
ORDER BY created_at DESC
LIMIT 10;
```

### Check Approved Deposits
```sql
SELECT id, user_id, amount, currency, status, updated_at
FROM public.deposits
WHERE status = 'successful'
ORDER BY updated_at DESC
LIMIT 5;
```

---

## 🐛 Troubleshooting Quick Fixes

| Problem | Quick Fix | Time |
|---------|-----------|------|
| Balance not updating | Refresh page (F5) | 30s |
| Balance updates slow | Wait 5 seconds | 5s |
| Deposit won't submit | Upload receipt file | - |
| No success message | Scroll up on page | - |
| Admin not authorized | Check email = admin@test.com | - |
| Realtime not working | Enable in Supabase Console | 1m |

---

## 📊 Expected Results Summary

```
Test Case              Expected Result              Status
─────────────────────────────────────────────────────────
Deposit 500 ETB        ✅ Pending → 550 ETB          ✓
Deposit $5 USD         ✅ Pending → $5.50 USD        ✓
Withdraw 300 ETB       ✅ Request submitted          ✓
Admin Approve          ✅ Balance updates            ✓
Balance Display        ✅ Shows "550 Br" or "$5.50"  ✓
Error: Low Balance     ✅ Shows error, no submit     ✓
Error: Below Minimum   ✅ Shows error, no submit     ✓
Form Reset             ✅ Fields clear after submit  ✓
Success Message        ✅ Green, visible, persistent ✓
Redirect to Home       ✅ Auto-nav after submit      ✓
```

---

## 🎯 Critical Path (Must Work)

For production readiness, these 3 must succeed:

1. **Deposit → Admin Approve → Balance Updates**
   - User deposits 500 ETB
   - Admin approves
   - User sees 550 ETB within 5 seconds

2. **Withdrawal Submission**
   - User submits withdrawal
   - Form clears
   - Redirects to Home
   - Success message visible

3. **Error Prevention**
   - Can't withdraw more than balance
   - Can't withdraw below minimum
   - Can't submit without required fields

---

## 📱 Browser Requirements

- Chrome/Edge (latest)
- DevTools open (F12) for debugging
- Clear browser cache before testing
- Disable browser extensions that modify forms

---

## 📝 Session Tracking

```
Test Start Time: ___________
Admin Email: ___________
User Email: ___________

Realtime Enabled: ☐ Yes  ☐ No
Polling Only: ☐ Yes      ☐ No

Issues Found:
1. ___________
2. ___________
3. ___________

Overall Status: ☐ Pass  ☐ Fail
```

---

*Use TESTING_CHECKLIST.md for comprehensive step-by-step guide*
*Use AUDIT_COMPLETE.md for technical details*
