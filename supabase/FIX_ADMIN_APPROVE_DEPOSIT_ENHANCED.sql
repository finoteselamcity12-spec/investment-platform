-- ============================================================================
-- FIX_ADMIN_APPROVE_DEPOSIT_ENHANCED.sql
-- Comprehensive fix for admin_approve_deposit with proper data synchronization
-- ============================================================================
-- FEATURES:
-- 1. Adds wallet columns to balances table (available balance tracking)
-- 2. Verifies/creates user profile if not exists
-- 3. Calculates and applies 10% welcome bonus
-- 4. Updates both wallet AND balance columns consistently
-- 5. Records deposit and bonus transactions in history table
-- ============================================================================

-- Step 1: Add wallet columns to balances table (if they don't exist)
-- These track available balance (after any pending withdrawals)
ALTER TABLE public.balances
  ADD COLUMN IF NOT EXISTS etb_wallet NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (etb_wallet >= 0);

ALTER TABLE public.balances
  ADD COLUMN IF NOT EXISTS usd_wallet NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (usd_wallet >= 0);

-- Create index on updated_at for faster queries
CREATE INDEX IF NOT EXISTS idx_balances_updated_at ON public.balances(updated_at DESC);

-- Step 2: Ensure history action constraint includes all bonus types
ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_action_check;
ALTER TABLE public.history
  ADD CONSTRAINT history_action_check
  CHECK (action IN (
    'deposit', 
    'deposit_bonus', 
    'referral_bonus', 
    'signup_bonus', 
    'welcome_bonus',
    'withdrawal'
  ));

-- Step 3: Create unique index to prevent duplicate deposit bonuses
CREATE UNIQUE INDEX IF NOT EXISTS idx_history_deposit_bonus_once
  ON public.history (user_id, reference_id)
  WHERE action = 'deposit_bonus' AND reference_id IS NOT NULL;

-- ============================================================================
-- REWRITTEN admin_approve_deposit FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep public.deposits%ROWTYPE;
  v_user_exists BOOLEAN;
  v_norm_currency TEXT;
  v_bonus_amt NUMERIC(18, 4);
  v_total_credit NUMERIC(18, 4);
  v_deposit_history_id UUID;
  v_bonus_history_id UUID;
  v_duplicate_check INTEGER;
BEGIN
  -- ─────────────────────────────────────────────────────────────────────────
  -- AUTHORIZATION CHECK
  -- ─────────────────────────────────────────────────────────────────────────
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- FETCH DEPOSIT (with row lock to prevent race conditions)
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT * INTO v_dep FROM public.deposits 
  WHERE id = p_deposit_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found';
  END IF;

  -- Check if already approved or rejected
  IF v_dep.status = 'successful' THEN
    RETURN json_build_object(
      'ok', true,
      'already_approved', true,
      'message', 'Deposit already approved',
      'deposit_id', p_deposit_id
    );
  END IF;

  IF v_dep.status = 'rejected' THEN
    RAISE EXCEPTION 'deposit_already_rejected';
  END IF;

  IF v_dep.status != 'pending' THEN
    RAISE EXCEPTION 'invalid_deposit_status';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 1: VERIFY/CREATE USER PROFILE
  -- ─────────────────────────────────────────────────────────────────────────
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = v_dep.user_id) 
  INTO v_user_exists;

  IF NOT v_user_exists THEN
    INSERT INTO public.profiles (id, email, full_name, created_at)
    VALUES (
      v_dep.user_id,
      COALESCE((SELECT email FROM auth.users WHERE id = v_dep.user_id), 'unknown@example.com'),
      COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = v_dep.user_id), 'Unknown User'),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 2: NORMALIZE CURRENCY
  -- ─────────────────────────────────────────────────────────────────────────
  v_norm_currency := CASE 
    WHEN upper(v_dep.currency) IN ('USD', 'USDT') THEN 'USD' 
    ELSE 'ETB' 
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 3: CALCULATE 10% WELCOME BONUS
  -- ─────────────────────────────────────────────────────────────────────────
  v_bonus_amt := ROUND(v_dep.amount * 0.10, 4);
  v_total_credit := v_dep.amount + v_bonus_amt;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 4: ENSURE BALANCES RECORD EXISTS
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.balances (user_id, etb_balance, usd_balance, etb_wallet, usd_wallet)
  VALUES (v_dep.user_id, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 5: UPDATE BALANCES WITH DEPOSIT + BONUS
  -- Update BOTH _balance (total received) AND _wallet (available) columns
  -- ─────────────────────────────────────────────────────────────────────────
  IF v_norm_currency = 'USD' THEN
    UPDATE public.balances
    SET 
      usd_balance = usd_balance + v_total_credit,
      usd_wallet = usd_wallet + v_total_credit,
      updated_at = NOW()
    WHERE user_id = v_dep.user_id;
  ELSE
    UPDATE public.balances
    SET 
      etb_balance = etb_balance + v_total_credit,
      etb_wallet = etb_wallet + v_total_credit,
      updated_at = NOW()
    WHERE user_id = v_dep.user_id;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 6: RECORD DEPOSIT TRANSACTION IN HISTORY
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.history (
    user_id, 
    action, 
    currency, 
    amount, 
    status,
    reference_id, 
    metadata
  ) VALUES (
    v_dep.user_id,
    'deposit',
    v_norm_currency,
    v_dep.amount,
    'successful',
    p_deposit_id,
    jsonb_build_object(
      'payment_method', v_dep.payment_method,
      'transaction_id', v_dep.transaction_id,
      'approval_timestamp', NOW()
    )
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_deposit_history_id;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 7: RECORD WELCOME BONUS IN HISTORY (if not already recorded)
  -- ─────────────────────────────────────────────────────────────────────────
  IF v_bonus_amt > 0 THEN
    SELECT COUNT(*)::INTEGER INTO v_duplicate_check
    FROM public.history
    WHERE user_id = v_dep.user_id
      AND action = 'deposit_bonus'
      AND reference_id = p_deposit_id;

    IF v_duplicate_check = 0 THEN
      INSERT INTO public.history (
        user_id,
        action,
        currency,
        amount,
        status,
        reference_id,
        metadata
      ) VALUES (
        v_dep.user_id,
        'deposit_bonus',
        v_norm_currency,
        v_bonus_amt,
        'successful',
        p_deposit_id,
        jsonb_build_object(
          'bonus_rate', '10%',
          'deposit_amount', v_dep.amount,
          'bonus_amount', v_bonus_amt,
          'approval_timestamp', NOW()
        )
      )
      RETURNING id INTO v_bonus_history_id;
    END IF;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 8: UPDATE DEPOSIT STATUS TO SUCCESSFUL
  -- ─────────────────────────────────────────────────────────────────────────
  UPDATE public.deposits
  SET status = 'successful', updated_at = NOW()
  WHERE id = p_deposit_id;

  -- ─────────────────────────────────────────────────────────────────────────
  -- STEP 9: RETURN SUCCESS RESPONSE WITH FULL DETAILS
  -- ─────────────────────────────────────────────────────────────────────────
  RETURN json_build_object(
    'ok', true,
    'deposit_id', p_deposit_id,
    'user_id', v_dep.user_id,
    'currency', v_norm_currency,
    'deposit_amount', v_dep.amount,
    'bonus_amount', v_bonus_amt,
    'bonus_rate', '10%',
    'total_credit', v_total_credit,
    'payment_method', v_dep.payment_method,
    'transaction_id', v_dep.transaction_id,
    'deposit_history_id', v_deposit_history_id,
    'bonus_history_id', v_bonus_history_id,
    'approval_timestamp', NOW(),
    'message', format(
      'Deposit approved: %s %s + %s %s bonus (total: %s %s)',
      v_dep.amount, v_norm_currency,
      v_bonus_amt, v_norm_currency,
      v_total_credit, v_norm_currency
    )
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'ok', false,
    'error', SQLERRM,
    'detail', format('Failed to approve deposit %s', p_deposit_id)
  );
END;
$$;

-- ============================================================================
-- ALSO REWRITE admin_reject_deposit FOR CONSISTENCY
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_reject_deposit(p_deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep public.deposits%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO v_dep FROM public.deposits 
  WHERE id = p_deposit_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found';
  END IF;

  IF v_dep.status != 'pending' THEN
    RAISE EXCEPTION 'deposit_not_pending';
  END IF;

  UPDATE public.deposits
  SET status = 'rejected', updated_at = NOW()
  WHERE id = p_deposit_id;

  -- Record rejection in history for audit trail
  INSERT INTO public.history (
    user_id,
    action,
    currency,
    amount,
    status,
    reference_id,
    metadata
  ) VALUES (
    v_dep.user_id,
    'deposit',
    v_dep.currency,
    v_dep.amount,
    'rejected',
    p_deposit_id,
    jsonb_build_object(
      'reason', 'Admin rejection',
      'timestamp', NOW()
    )
  )
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'ok', true,
    'deposit_id', p_deposit_id,
    'status', 'rejected',
    'message', 'Deposit has been rejected'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'ok', false,
    'error', SQLERRM,
    'detail', format('Failed to reject deposit %s', p_deposit_id)
  );
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_deposit(UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION VIEW: Check balances sync across both tables
-- ============================================================================
CREATE OR REPLACE VIEW public.v_balance_sync_check AS
SELECT 
  p.id AS user_id,
  p.email,
  b.etb_balance,
  b.etb_wallet,
  b.usd_balance,
  b.usd_wallet,
  CASE 
    WHEN b.etb_balance >= b.etb_wallet THEN 'OK'
    ELSE 'MISMATCH: balance < wallet'
  END AS etb_status,
  CASE 
    WHEN b.usd_balance >= b.usd_wallet THEN 'OK'
    ELSE 'MISMATCH: balance < wallet'
  END AS usd_status,
  b.updated_at,
  COUNT(h.id) AS total_transactions
FROM public.profiles p
LEFT JOIN public.balances b ON p.id = b.user_id
LEFT JOIN public.history h ON p.id = h.user_id
GROUP BY p.id, p.email, b.etb_balance, b.etb_wallet, b.usd_balance, b.usd_wallet, b.updated_at
ORDER BY b.updated_at DESC;

GRANT SELECT ON public.v_balance_sync_check TO authenticated;

-- ============================================================================
-- NOTIFY Supabase to reload schema
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICATION SQL (run after to check results)
-- ============================================================================
-- SELECT * FROM public.v_balance_sync_check LIMIT 10;
-- SELECT user_id, action, currency, amount, reference_id, metadata FROM public.history WHERE action IN ('deposit', 'deposit_bonus') ORDER BY created_at DESC LIMIT 20;
-- SELECT id, user_id, currency, amount, status FROM public.deposits WHERE status = 'successful' ORDER BY updated_at DESC LIMIT 10;
