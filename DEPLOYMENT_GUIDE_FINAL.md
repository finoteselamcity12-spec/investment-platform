# Ethio-Invest Platform - Database Deployment & Rollout Guide

## 📋 Pre-Deployment Checklist

- [ ] **Backup all current data** (see "Backup Strategy")
- [ ] **Read migration file**: `018_final_ethio_invest_database_finalization.sql`
- [ ] **Test migration in dev environment** (if possible)
- [ ] **Notify team members** of scheduled maintenance
- [ ] **Prepare rollback plan** (see "Rollback Procedure")
- [ ] **Ensure admin dashboard is ready** for deposit approvals
- [ ] **Test deposit approval flow** with test user
- [ ] **Monitor logs** during and after deployment

---

## 🚀 Deployment Steps

### Step 1: Backup Current Data (CRITICAL)

Go to Supabase Dashboard → SQL Editor and run:

```sql
-- Create backup tables
CREATE TABLE IF NOT EXISTS public.balances_backup_20260606 AS SELECT * FROM public.balances;
CREATE TABLE IF NOT EXISTS public.history_backup_20260606 AS SELECT * FROM public.history;
CREATE TABLE IF NOT EXISTS public.deposits_backup_20260606 AS SELECT * FROM public.deposits;
CREATE TABLE IF NOT EXISTS public.profiles_backup_20260606 AS SELECT * FROM public.profiles;

-- Verify backups created
SELECT COUNT(*) as "Profiles Backed Up" FROM public.profiles_backup_20260606;
SELECT COUNT(*) as "Balances Backed Up" FROM public.balances_backup_20260606;
SELECT COUNT(*) as "Deposits Backed Up" FROM public.deposits_backup_20260606;
SELECT COUNT(*) as "History Backed Up" FROM public.history_backup_20260606;
```

### Step 2: Run Migration

In Supabase SQL Editor:

1. Open new query tab
2. Copy entire content from: `supabase/migrations/018_final_ethio_invest_database_finalization.sql`
3. Paste into SQL editor
4. Click **Execute**
5. Wait for completion (should take <30 seconds)

### Step 3: Verify Migration Success

Run verification queries:

```sql
-- Check wallet columns exist
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'balances'
  AND column_name LIKE '%wallet'
ORDER BY column_name;

-- Expected output:
-- column_name    | data_type
-- ───────────────|──────────────────
-- etb_wallet     | numeric
-- usd_wallet     | numeric
```

```sql
-- Check indexes created
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('balances', 'deposits', 'history')
ORDER BY indexname;

-- Should show: idx_balances_*, idx_deposits_*, idx_history_*
```

```sql
-- Check functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_name IN ('approve_deposit', 'reject_deposit', 'handle_new_user')
ORDER BY routine_name;

-- Expected output:
-- routine_name       | routine_type
-- ──────────────────|──────────────
-- approve_deposit    | FUNCTION
-- reject_deposit     | FUNCTION
-- handle_new_user    | FUNCTION
```

### Step 4: Test Core Functions

```sql
-- Test: Is migration applied?
SELECT version();  -- Check PostgreSQL version

-- Test: Can admins use approve_deposit?
-- (Use a test deposit ID from your database)
SELECT approve_deposit('00000000-0000-0000-0000-000000000000'::UUID);
-- Should return: {"ok": false, "error": "deposit_not_found"} (expected since ID doesn't exist)

-- Test: Verify balance columns
SELECT user_id, etb_balance, etb_wallet, usd_balance, usd_wallet
FROM public.balances
LIMIT 5;
```

### Step 5: Sync Wallet Columns (for existing users)

If you have existing users, sync their wallet columns:

```sql
-- For users with ETB balance
UPDATE public.balances
SET etb_wallet = etb_balance
WHERE etb_wallet = 0 AND etb_balance > 0;

-- For users with USD balance
UPDATE public.balances
SET usd_wallet = usd_balance
WHERE usd_wallet = 0 AND usd_balance > 0;

-- Verify
SELECT COUNT(*) as "Users with synced ETB wallet"
FROM public.balances
WHERE etb_wallet > 0;
```

### Step 6: Update Frontend Code

In your React components:

```javascript
// BEFORE (incorrect)
const balance = userBalance.etb_balance;

// AFTER (correct)
const balance = userBalance.etb_wallet;
```

Files to check and update:
- `src/components/HomePage.jsx` - Balance display
- `src/components/DashboardView.jsx` - Balance summary
- `src/lib/supabaseData.js` - Balance fetch query (if exists)

### Step 7: Test Deposit Approval Flow

```javascript
// Test script: Test deposit approval
const testDepositApproval = async () => {
  // 1. Create test deposit
  const { data: deposit } = await supabase
    .from('deposits')
    .insert({
      user_id: 'test-user-uuid',
      amount_etb: 1000,
      currency: 'ETB',
      status: 'pending'
    })
    .select()
    .single();
  
  // 2. Approve it
  const { data: result } = await supabase
    .rpc('approve_deposit', {
      p_deposit_id: deposit.id
    });
  
  // 3. Verify
  console.log('Approval result:', result);
  // Should show:
  // {
  //   "ok": true,
  //   "deposit_amount": 1000,
  //   "bonus_amount": 100,
  //   "total_credited": 1100
  // }
  
  // 4. Check balance was updated
  const { data: balance } = await supabase
    .from('balances')
    .select('*')
    .eq('user_id', 'test-user-uuid')
    .single();
  
  console.log('Updated balance:', {
    etb_balance: balance.etb_balance,  // Should be 1100
    etb_wallet: balance.etb_wallet     // Should be 1100
  });
};
```

---

## 📊 Post-Deployment Validation

### Day 1 Checks

```sql
-- Check for errors in logs
SELECT * FROM pg_stat_statements
WHERE calls > 0 AND mean_time > 1000;  -- Queries taking >1s

-- Monitor balance updates
SELECT user_id, COUNT(*) as update_count, MAX(updated_at)
FROM public.balances
GROUP BY user_id
ORDER BY update_count DESC
LIMIT 20;

-- Check for pending deposits
SELECT COUNT(*) as pending_deposits FROM public.deposits WHERE status = 'pending';
```

### Weekly Health Check

```sql
-- Data consistency: Check wallet ≥ 0
SELECT COUNT(*) as invalid_wallets
FROM public.balances
WHERE etb_wallet < 0 OR usd_wallet < 0;
-- Should return 0

-- Check for orphaned history entries
SELECT COUNT(*) as orphaned_history
FROM public.history h
LEFT JOIN public.deposits d ON h.reference_id = d.id AND h.reference_type = 'deposit'
WHERE h.reference_type = 'deposit' AND d.id IS NULL;
-- Should return 0

-- Verify trigger is working
SELECT COUNT(*) as new_users_with_signup_bonus
FROM public.history
WHERE type = 'welcome_bonus'
  AND created_at > NOW() - INTERVAL '7 days';
```

---

## 🔄 Rollback Procedure

If something goes wrong, you can rollback:

```sql
-- Option 1: Restore from backup (if immediately detected)
-- Drop current schema
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restore from backup
-- (Run the 016_complete_rebuild.sql to recreate base schema)
-- Then restore data from backups

-- Option 2: Revert specific changes
-- Drop new functions and restore old ones
DROP FUNCTION IF EXISTS public.approve_deposit(UUID);
DROP FUNCTION IF EXISTS public.reject_deposit(UUID, TEXT);

-- Remove wallet columns
ALTER TABLE public.balances
DROP COLUMN IF EXISTS etb_wallet;
ALTER TABLE public.balances
DROP COLUMN IF EXISTS usd_wallet;

-- Re-run migration 016 to restore to previous state
```

**Note:** Only use rollback within 24 hours of deployment. After that, you'll need a more careful data recovery strategy.

---

## 🎯 Function Response Codes & Error Handling

### approve_deposit() Responses

#### Success
```json
{
  "ok": true,
  "deposit_id": "uuid",
  "user_id": "uuid",
  "currency": "ETB",
  "deposit_amount": 1000.00,
  "bonus_amount": 100.00,
  "bonus_rate": "10%",
  "total_credited": 1100.00,
  "message": "Deposit approved: 1000 + 100 (10% bonus) = 1100 ETB total credited",
  "timestamp": "2026-06-06T10:30:00Z"
}
```

#### Already Approved
```json
{
  "ok": true,
  "already_approved": true,
  "message": "Deposit already approved",
  "deposit_id": "uuid"
}
```

#### Error: Not Found
```json
{
  "ok": false,
  "error": "deposit_not_found",
  "message": "Deposit [uuid] not found"
}
```

#### Error: Not Pending
```json
{
  "ok": false,
  "error": "invalid_deposit_status",
  "message": "Deposit status is rejected, expected pending"
}
```

#### Error: Unauthorized
```json
{
  "ok": false,
  "error": "unauthorized",
  "message": "Only administrators can approve deposits"
}
```

### reject_deposit() Responses

#### Success
```json
{
  "ok": true,
  "deposit_id": "uuid",
  "message": "Deposit rejected: Invalid proof of payment",
  "timestamp": "2026-06-06T10:35:00Z"
}
```

#### Error Cases
Same as approve_deposit, plus:
```json
{
  "ok": false,
  "error": "deposit_already_rejected",
  "message": "Cannot approve a rejected deposit"
}
```

---

## 🔍 Monitoring & Debugging

### Enable Query Logging

```sql
-- Check slow queries
SET log_min_duration_statement = 1000;  -- Log queries >1s

-- View query performance
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

### Monitor Transactions

```sql
-- Check active transactions
SELECT pid, usename, application_name, state, query
FROM pg_stat_activity
WHERE state != 'idle';

-- Check locks
SELECT * FROM pg_locks
WHERE NOT granted;  -- Shows blocking locks
```

### Debug Approval Issues

```sql
-- If approval fails, check deposit state
SELECT * FROM public.deposits WHERE id = 'problem-deposit-id';

-- Check balance state
SELECT * FROM public.balances WHERE user_id = 'problem-user-id';

-- Check history entries
SELECT * FROM public.history
WHERE user_id = 'problem-user-id'
ORDER BY created_at DESC
LIMIT 20;

-- Check for locks
SELECT * FROM pg_locks WHERE relation::regclass::text LIKE '%deposits%';
```

---

## 📞 Emergency Contacts

If deployment fails or there are critical issues:

1. **Check Supabase Status**: https://status.supabase.com
2. **Review error logs**: Supabase Dashboard → Logs
3. **Check query performance**: Supabase Dashboard → Database → Query Performance
4. **Restore from backup** if needed

---

## ✅ Go-Live Checklist

- [ ] All backups verified
- [ ] Migration executed successfully
- [ ] All verification queries passed
- [ ] Wallet columns synced for existing users
- [ ] Frontend code updated to use `*_wallet` columns
- [ ] Deposit approval flow tested with real data
- [ ] Admin can approve deposits
- [ ] Users see updated balance immediately
- [ ] History entries created correctly
- [ ] No errors in logs
- [ ] Team notified of go-live
- [ ] Monitoring set up

---

## 🎉 Success Indicators

After deployment, you should see:

✅ New deposits create 'pending' status  
✅ Admins can approve deposits via function call  
✅ Balance updated with deposit + 10% bonus  
✅ Two history entries created (deposit + bonus)  
✅ New users get 100 ETB signup bonus automatically  
✅ Wallet columns display correctly in frontend  
✅ No race conditions on concurrent approvals  
✅ Query performance within benchmarks (<100ms for approvals)  

---

**Deployment Status:** 🟢 Ready  
**Migration Version:** 018  
**Date:** June 6, 2026  
**Estimated Downtime:** <1 second
