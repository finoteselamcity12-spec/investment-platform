# Ethio-Invest Platform - Database Architecture & Implementation Guide

## Executive Summary

This document outlines the finalized database architecture for the Ethio-Invest platform hosted on Supabase. All critical business logic has been optimized for:
- **Data Integrity**: Transactional consistency with row-level locking
- **Performance**: Strategic indexing and optimized queries
- **Auditability**: Comprehensive history tracking
- **Race Condition Prevention**: `FOR UPDATE` locking mechanism

---

## Table of Contents

1. [Database Schema Overview](#database-schema-overview)
2. [Critical Balance Logic](#critical-balance-logic)
3. [Deposit Approval Flow](#deposit-approval-flow)
4. [Signup Bonus Logic](#signup-bonus-logic)
5. [Data Consistency Guarantees](#data-consistency-guarantees)
6. [Frontend Integration Guide](#frontend-integration-guide)
7. [Admin Operations](#admin-operations)
8. [Testing Scenarios](#testing-scenarios)

---

## Database Schema Overview

### Core Tables

#### 1. `profiles`
Stores user account information.

```sql
profiles {
  id UUID PRIMARY KEY                    -- Firebase Auth UID
  email TEXT UNIQUE
  full_name TEXT
  role TEXT ('user'|'admin')             -- Access control
  referral_code TEXT UNIQUE              -- For referral bonuses
  referred_by UUID                       -- Who invited this user
  is_active BOOLEAN
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
}
```

#### 2. `balances` ⭐ CRITICAL TABLE
Tracks both total received and available balance.

```sql
balances {
  user_id UUID PRIMARY KEY               -- One balance per user
  
  -- ETB balances
  etb_balance NUMERIC(18,2)              -- Total cumulative ETB received
  etb_wallet NUMERIC(18,2)               -- Available ETB (for UI display)
  
  -- USD balances  
  usd_balance NUMERIC(18,6)              -- Total cumulative USD received
  usd_wallet NUMERIC(18,6)               -- Available USD (for UI display)
  
  -- Tracking columns
  active_investment_etb NUMERIC(18,2)    -- Locked in investments
  active_investment_usd NUMERIC(18,6)
  total_deposited_etb NUMERIC(18,2)      -- Cumulative deposits
  total_withdrawn_etb NUMERIC(18,2)      -- Cumulative withdrawals
  total_profit_earned_etb NUMERIC(18,2)  -- Profit distribution total
  referral_bonus_etb NUMERIC(18,2)       -- Total referral bonuses
  
  updated_at TIMESTAMPTZ
}
```

**Key Design Decision:**
- `*_balance` columns = **Total cumulative amount ever received** (never decreases)
- `*_wallet` columns = **Display balance** (what user sees and can use)
- Both columns are updated simultaneously to prevent inconsistency

#### 3. `deposits`
Immutable record of deposit requests.

```sql
deposits {
  id UUID PRIMARY KEY
  user_id UUID NOT NULL
  payment_method_id UUID
  amount_etb NUMERIC(18,2)               -- Amount in ETB
  amount_usd NUMERIC(18,6)               -- Amount in USD
  currency TEXT ('ETB'|'USD')
  transaction_id TEXT                    -- User's transaction ID
  screenshot_url TEXT                    -- Proof of payment
  status TEXT ('pending'|'approved'|'rejected')
  admin_note TEXT
  reviewed_by UUID                       -- Admin who reviewed
  reviewed_at TIMESTAMPTZ
  created_at TIMESTAMPTZ
}
```

#### 4. `history` ⭐ AUDIT TRAIL
Complete transaction history for auditability.

```sql
history {
  id UUID PRIMARY KEY
  user_id UUID NOT NULL
  type TEXT (
    'deposit',
    'bonus',                  -- 10% welcome bonus
    'welcome_bonus',          -- 100 ETB signup bonus
    'invite_bonus',           -- Referral bonus (50 ETB)
    'withdrawal',
    'daily_profit',
    'investment',
    'investment_claim',
    'adjustment'
  )
  amount_etb NUMERIC(18,2)
  amount_usd NUMERIC(18,6)
  currency TEXT ('ETB'|'USD'|'MIXED')
  status TEXT ('success'|'pending'|'failed')
  reference_id UUID                      -- Link to deposits/investments/etc
  reference_type TEXT ('deposit'|'withdrawal'|'investment'|'bonus')
  note TEXT
  metadata JSONB                         -- Additional context
  created_at TIMESTAMPTZ
}
```

---

## Critical Balance Logic

### Balance Column Semantics

| Column | Purpose | Behavior | Example |
|--------|---------|----------|---------|
| `etb_balance` | Total cumulative balance | Always increases or stays same | Deposit 100 ETB → balance becomes 100 |
| `etb_wallet` | Available for use | Increases/decreases | After withdrawal, wallet decreases |
| `*_balance` | Never decreases | Immutable historical record | Used for reporting/auditing |
| `*_wallet` | Mutable | Changes with withdrawals, investments | Used for UI display |

### Frontend Always Fetches from `*_wallet`

```javascript
// CORRECT: Use wallet columns for UI
const displayBalance = balances.etb_wallet;  // ✅ Shows available balance

// WRONG: Using balance columns shows incorrect value
const displayBalance = balances.etb_balance; // ❌ Shows cumulative (misleading)
```

### Consistency Guarantee

**After every transaction, this invariant holds:**
```
etb_wallet + locked_in_investments + pending_withdrawals ≈ etb_balance
```

---

## Deposit Approval Flow

### Step-by-Step Process

```
User Submits Deposit
  ↓
[Supabase Storage: Screenshot uploaded]
  ↓
[deposits table: Record created with status='pending']
  ↓
Admin Reviews via Dashboard
  ↓
Admin Calls approve_deposit(deposit_id)
  ↓
  
[BEGIN TRANSACTION]
  1. Verify status = 'pending' ✓
  2. Calculate 10% bonus
  3. Lock user's balance record (FOR UPDATE)
  4. Update BOTH etb_balance + etb_wallet
  5. Record 'deposit' entry in history
  6. Record 'bonus' entry in history
  7. Set deposits.status = 'approved'
[COMMIT TRANSACTION]
  ↓
User sees balance updated immediately
```

### approve_deposit() Function Signature

```sql
FUNCTION approve_deposit(p_deposit_id UUID)
RETURNS JSONB
```

**Input:**
- `p_deposit_id`: The deposit ID to approve

**Returns:**
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

### What Happens Under the Hood

```sql
-- Deposit: 1000 ETB
-- Bonus: 1000 * 0.10 = 100 ETB
-- Total: 1100 ETB

-- BEFORE:
balances: { etb_balance: 0, etb_wallet: 0 }

-- AFTER approve_deposit():
balances: { etb_balance: 1100, etb_wallet: 1100 }

-- history table gets TWO entries:
1. type='deposit', amount=1000, note='Deposit approved: 1000 ETB'
2. type='bonus', amount=100, note='10% Welcome bonus: 100 ETB'

-- deposits table:
status changed: 'pending' → 'approved'
```

### Race Condition Prevention

The function uses `FOR UPDATE` locks:

```sql
SELECT * FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
SELECT * FROM public.balances WHERE user_id = v_deposit.user_id FOR UPDATE;
```

This ensures **only one approval can happen simultaneously** per user, preventing duplicate crediting.

---

## Signup Bonus Logic

### Automatic Trigger: `handle_new_user()`

When a new user signs up, the trigger automatically:

1. **Creates profile** → `profiles` table
2. **Creates balance record** with 100 ETB → `balances` table
3. **Records welcome bonus** → `history` table

### Step-by-Step

```sql
NEW USER SIGNS UP
  ↓
[auth.users trigger: on_auth_user_created]
  ↓
EXECUTE handle_new_user()
  1. Insert into profiles
  2. Insert into balances:
     - etb_balance = 100.00
     - etb_wallet = 100.00     ← IMPORTANT: Both columns credited
     - usd_balance = 0
     - usd_wallet = 0
  3. Insert into history:
     - type = 'welcome_bonus'
     - amount_etb = 100.00
     - status = 'success'
  ↓
User can immediately see 100 ETB in wallet
```

### Referral Bonus

If user signed up with a referral code:

```sql
IF referral_code IS PROVIDED AND VALID THEN
  -- Credit REFERRER with 50 ETB
  UPDATE balances
  SET etb_balance = etb_balance + 50,
      etb_wallet = etb_wallet + 50         ← BOTH columns
  WHERE user_id = referrer_id
  
  -- Record referral bonus in history
  INSERT INTO history (type='invite_bonus', amount_etb=50, ...)
END IF
```

---

## Data Consistency Guarantees

### ACID Compliance

All critical operations are wrapped in transactions with:
- **Atomicity**: All-or-nothing (no partial updates)
- **Consistency**: Data integrity constraints enforced
- **Isolation**: Row locks prevent race conditions
- **Durability**: Persistent to Supabase

### Constraint Validation

```sql
-- Balance constraints
CHECK (etb_balance >= 0)
CHECK (etb_wallet >= 0)
CHECK (usd_balance >= 0)
CHECK (usd_wallet >= 0)

-- Deposit constraints
CHECK (status IN ('pending', 'approved', 'rejected'))
CHECK (
  (currency = 'ETB' AND amount_etb > 0 AND amount_usd = 0)
  OR (currency = 'USD' AND amount_usd > 0 AND amount_etb = 0)
)

-- History constraints
CHECK (type IN ('deposit', 'bonus', 'withdrawal', ...))
CHECK (status IN ('success', 'pending', 'failed'))
```

### Audit Trail

Every financial transaction creates an immutable history entry:
- Deposit approval → 2 entries (deposit + bonus)
- Withdrawal approval → 1 entry
- Signup bonus → 1 entry
- Referral bonus → 1 entry

**Immutable**: History entries cannot be updated/deleted.

---

## Frontend Integration Guide

### 1. Fetch User Balance

```javascript
// In AppShell or Dashboard component
import { supabase } from '@/lib/supabase';

async function fetchUserBalance() {
  const { data, error } = await supabase
    .from('balances')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (error) throw error;
  
  return {
    etbWallet: data.etb_wallet,      // ✅ Use WALLET for display
    usdWallet: data.usd_wallet,
    etbTotal: data.etb_balance,      // For reporting
    usdTotal: data.usd_balance
  };
}
```

### 2. Submit Deposit Request

```javascript
// In DepositPage.jsx
async function submitDeposit(amount, currency) {
  // 1. Upload screenshot to storage
  const file = document.querySelector('#receipt-upload').files[0];
  const { data: uploadData } = await supabase
    .storage
    .from('deposit-proofs')
    .upload(`${userId}/${Date.now()}.jpg`, file);
    
  // 2. Create deposit record
  const { data: deposit, error } = await supabase
    .from('deposits')
    .insert({
      user_id: userId,
      amount_etb: currency === 'ETB' ? amount : 0,
      amount_usd: currency === 'USD' ? amount : 0,
      currency: currency,
      screenshot_url: uploadData.path,
      transaction_id: transactionId,
      status: 'pending'
    })
    .select()
    .single();
    
  return deposit;
}
```

### 3. Poll for Balance Updates (After Deposit Approved)

```javascript
// In AdminPanel or Dashboard
async function pollForApproval(depositId) {
  const checkStatus = setInterval(async () => {
    const { data: deposit } = await supabase
      .from('deposits')
      .select('status')
      .eq('id', depositId)
      .single();
      
    if (deposit.status === 'approved') {
      // Refresh balance
      const balance = await fetchUserBalance();
      setBalance(balance);
      clearInterval(checkStatus);
      showToast('Deposit approved! Balance updated.');
    }
  }, 2000);  // Poll every 2 seconds
}
```

### 4. Real-Time Balance Updates (Optional - Recommended)

```javascript
// Use Supabase Real-Time subscription
const subscription = supabase
  .channel(`balances:user_id=eq.${userId}`)
  .on('postgres_changes', 
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'balances',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('Balance updated:', payload.new);
      setBalance({
        etbWallet: payload.new.etb_wallet,
        usdWallet: payload.new.usd_wallet
      });
    }
  )
  .subscribe();
```

### 5. Display Transaction History

```javascript
// In HistoryPage.jsx
async function fetchHistory(userId, limit = 50) {
  const { data, error } = await supabase
    .from('history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  return data.map(entry => ({
    id: entry.id,
    type: entry.type,              // 'deposit', 'bonus', 'withdrawal', etc
    amount: entry.amount_etb || entry.amount_usd,
    currency: entry.currency,
    status: entry.status,          // 'success', 'pending', 'failed'
    note: entry.note,
    timestamp: entry.created_at
  }));
}
```

---

## Admin Operations

### 1. Admin Approve Deposit

```javascript
// In AdminDashboard.jsx
import { supabase } from '@/lib/supabase';

async function approveDeposit(depositId) {
  try {
    const { data: result, error } = await supabase
      .rpc('approve_deposit', {
        p_deposit_id: depositId
      });
      
    if (error) throw error;
    
    if (result.ok) {
      console.log('✅ Deposit approved:', result.message);
      // Show toast
      setToast({
        type: 'success',
        message: result.message,
        duration: 5000
      });
      
      // Refresh pending deposits list
      await fetchPendingDeposits();
    }
  } catch (error) {
    console.error('❌ Approval failed:', error);
    setToast({
      type: 'error',
      message: error.message,
      duration: 5000
    });
  }
}
```

### 2. Admin Reject Deposit

```javascript
async function rejectDeposit(depositId, reason) {
  const { data: result, error } = await supabase
    .rpc('reject_deposit', {
      p_deposit_id: depositId,
      p_note: reason || 'Rejected by admin'
    });
    
  if (result.ok) {
    console.log('✅ Deposit rejected');
    await fetchPendingDeposits();
  }
}
```

### 3. View Pending Deposits

```javascript
async function fetchPendingDeposits() {
  const { data, error } = await supabase
    .from('deposits')
    .select(`
      id,
      user_id,
      amount_etb,
      amount_usd,
      currency,
      transaction_id,
      screenshot_url,
      status,
      created_at,
      profiles!inner(full_name, email)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
    
  return data;
}
```

---

## Testing Scenarios

### Scenario 1: New User Signs Up

```
GIVEN: User registers with email "test@example.com"
WHEN: User signs up successfully
THEN:
  1. Profile created: { id: UUID, email: "test@example.com", ... }
  2. Balance created: { etb_balance: 100, etb_wallet: 100 }
  3. History entry: { type: 'welcome_bonus', amount_etb: 100, status: 'success' }
  4. Frontend shows: "You have 100 ETB welcome bonus"
VERIFY: SELECT * FROM balances WHERE user_id = UUID returns { etb_wallet: 100 }
```

### Scenario 2: User With Referral Code

```
GIVEN: User A has referral_code = "ABC123"
  AND User B registers with referral_code = "ABC123"
WHEN: User B signs up
THEN:
  1. User B's balance: { etb_balance: 100, etb_wallet: 100 }
  2. User A's balance updated: { etb_balance: +50, etb_wallet: +50 }
  3. History for User A: { type: 'invite_bonus', amount_etb: 50 }
VERIFY:
  SELECT * FROM balances WHERE user_id = A_ID 
  → etb_balance should include +50
```

### Scenario 3: Deposit Approval With 10% Bonus

```
GIVEN: User deposited 1000 ETB (status = 'pending')
WHEN: Admin approves deposit via approve_deposit(deposit_id)
THEN:
  1. Deposit status: 'pending' → 'approved'
  2. User balance updated:
     - etb_balance: 0 → 1100 (1000 + 100 bonus)
     - etb_wallet: 0 → 1100
  3. History entries created:
     a) type='deposit', amount=1000, status='success'
     b) type='bonus', amount=100, status='success'
  4. Response: { ok: true, total_credited: 1100, ... }

VERIFY:
  SELECT * FROM balances WHERE user_id = UUID
  → Should show etb_balance = 1100, etb_wallet = 1100
  
  SELECT COUNT(*) FROM history WHERE reference_id = deposit_id
  → Should show 2 rows (deposit + bonus)
```

### Scenario 4: Concurrent Approvals (Race Condition Test)

```
GIVEN: User U deposits 1000 ETB (deposit_id = D1)
WHEN: Two admins simultaneously call approve_deposit(D1)
THEN:
  - First call: ✅ SUCCESS (acquires lock, approves, releases lock)
  - Second call: ✅ Returns { already_approved: true }
  - Final balance: etb_balance = 1100 (NOT 2200)
  
VERIFY: Row lock prevents race condition
```

### Scenario 5: Double-Spending Prevention

```
GIVEN: User has balance { etb_wallet: 100 }
WHEN: Two concurrent invest requests for 100 ETB each
THEN:
  - First request: ✅ SUCCESS
  - Second request: ❌ FAIL (insufficient balance)
  
VERIFY: FOR UPDATE lock ensures atomicity
```

---

## Migration Deployment

### Step 1: Backup Current Data

```sql
-- Create backup of critical tables
CREATE TABLE balances_backup_20260606 AS SELECT * FROM public.balances;
CREATE TABLE history_backup_20260606 AS SELECT * FROM public.history;
CREATE TABLE deposits_backup_20260606 AS SELECT * FROM public.deposits;
```

### Step 2: Run Migration

```bash
# Via Supabase SQL Editor
-- Copy entire content of:
-- supabase/migrations/018_final_ethio_invest_database_finalization.sql
-- Paste into Supabase SQL Editor and execute
```

### Step 3: Verify

```sql
-- Check wallet columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'balances' AND column_name LIKE '%wallet';

-- Should return: etb_wallet, usd_wallet

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name LIKE 'approve%';

-- Should return: approve_deposit, reject_deposit, etc
```

### Step 4: Test

Run all testing scenarios above to ensure everything works correctly.

---

## Performance Optimization

### Indexes Created

```sql
idx_balances_user_id              -- Fast lookup by user
idx_balances_updated_at           -- Sort by update time
idx_deposits_user_id_status       -- Find pending deposits quickly
idx_deposits_status_created       -- Admin dashboard queries
idx_history_user_id_type          -- User transaction queries
idx_history_created_at            -- Recent transaction queries
idx_history_reference_deposit     -- Link deposits to history
```

### Query Performance (Estimated)

| Query | Index Used | Rows | Time |
|-------|-----------|-------|------|
| Get user balance | `idx_balances_user_id` | 1 | <1ms |
| List pending deposits | `idx_deposits_status_created` | 1-100 | <5ms |
| User history | `idx_history_user_id_type` | 50 | <10ms |
| Approve deposit | Row locks | 1 | <100ms |

---

## Troubleshooting

### Issue: Balance not updating after approval

**Symptom:** Admin approves deposit, but user balance doesn't change.

**Solution:**
```javascript
// Clear cache and refetch
await supabase.auth.refreshSession();
const { data } = await supabase
  .from('balances')
  .select('*')
  .eq('user_id', userId)
  .single();
```

### Issue: "Only administrators can approve" error

**Symptom:** Admin gets unauthorized error when approving.

**Solution:** Check that admin user has `role = 'admin'` in profiles table.

```sql
SELECT role FROM profiles WHERE id = UUID;
-- Should return: admin
```

### Issue: Duplicate bonus records in history

**Symptom:** Two bonus entries created for one deposit.

**Solution:** This should not happen with the new function. If it does, check for manual inserts:

```sql
SELECT COUNT(*) FROM history 
WHERE reference_id = deposit_id AND type = 'bonus';
-- Should be <= 1
```

---

## Summary

This finalized architecture ensures:

✅ **Deposit approval with 10% bonus** correctly updates both wallet and balance  
✅ **Signup bonus of 100 ETB** automatically credited to new users  
✅ **Race condition prevention** via FOR UPDATE row locking  
✅ **Complete audit trail** with immutable history entries  
✅ **Data consistency** maintained via ACID transactions  
✅ **Performance optimized** with strategic indexing  

The platform is now production-ready for the Ethio-Invest launch.

---

**Last Updated:** June 6, 2026  
**Database Version:** Finalization v1.0  
**Status:** ✅ Production Ready
