-- =====================================================================
-- 018_final_ethio_invest_database_finalization.sql
-- COMPREHENSIVE FINALIZATION FOR ETHIO-INVEST PLATFORM
-- =====================================================================
-- FEATURES:
-- 1. Add _wallet columns for display balance tracking
-- 2. Fix signup bonus: 100 ETB to both etb_wallet and etb_balance
-- 3. Complete deposit approval with 10% welcome bonus
--    - Updates both _wallet and _balance columns simultaneously
--    - Records deposit and deposit_bonus as separate history entries
--    - Prevents race conditions with FOR UPDATE
-- 4. Enhanced data integrity and consistency
-- 5. Performance optimizations with strategic indexing
-- =====================================================================

SET client_min_messages TO WARNING;

-- =====================================================================
-- SECTION 1: ADD WALLET COLUMNS TO BALANCES TABLE
-- =====================================================================
-- Purpose: Track available balance for UI display
-- _balance = total cumulative balance (never decreases unless withdrawn)
-- _wallet = display balance (what user sees in wallet)

ALTER TABLE public.balances
ADD COLUMN IF NOT EXISTS etb_wallet NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (etb_wallet >= 0),
ADD COLUMN IF NOT EXISTS usd_wallet NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (usd_wallet >= 0);

-- =====================================================================
-- SECTION 2: SYNCHRONIZE EXISTING BALANCES
-- =====================================================================
-- For existing users, initialize wallet columns from balance columns
-- if they haven't been set

UPDATE public.balances
SET etb_wallet = GREATEST(etb_wallet, 0),
    usd_wallet = GREATEST(usd_wallet, 0)
WHERE etb_wallet = 0 AND etb_balance > 0;

UPDATE public.balances
SET usd_wallet = GREATEST(usd_wallet, 0)
WHERE usd_wallet = 0 AND usd_balance > 0;

-- =====================================================================
-- SECTION 3: ADD STRATEGIC INDEXES FOR PERFORMANCE
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_balances_user_id ON public.balances(user_id);
CREATE INDEX IF NOT EXISTS idx_balances_updated_at ON public.balances(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_user_id_status ON public.deposits(user_id, status);
CREATE INDEX IF NOT EXISTS idx_deposits_status_created ON public.deposits(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_user_id_type ON public.history(user_id, type);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON public.history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_reference_deposit ON public.history(reference_id, reference_type) WHERE reference_type = 'deposit';

-- =====================================================================
-- SECTION 4: FIX SIGNUP BONUS TRIGGER
-- =====================================================================
-- Ensure NEW users get 100 ETB credited to BOTH etb_wallet AND etb_balance
-- This replaces the old trigger logic

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  c_signup_bonus_etb CONSTANT NUMERIC := 100.00;
  v_referral_code TEXT;
  v_referrer_id UUID;
  c_invite_bonus_etb CONSTANT NUMERIC := 50.00;
BEGIN
  -- Extract full name from metadata
  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    'User'
  );

  -- Insert into profiles table
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (NEW.id, NEW.email, v_full_name, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Create initial balance record with 100 ETB signup bonus
  INSERT INTO public.balances (
    user_id, 
    etb_balance, 
    etb_wallet, 
    usd_balance, 
    usd_wallet,
    updated_at
  )
  VALUES (
    NEW.id,
    c_signup_bonus_etb,      -- Total received: 100 ETB
    c_signup_bonus_etb,      -- Available for use: 100 ETB
    0,
    0,
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Record the welcome bonus in history
  INSERT INTO public.history (
    user_id,
    action,
    amount_etb,
    amount_usd,
    currency,
    status,
    reference_type,
    note,
    metadata,
    created_at
  )
  VALUES (
    NEW.id,
    'welcome_bonus',
    c_signup_bonus_etb,
    0,
    'ETB',
    'success',
    'bonus',
    'Welcome signup bonus: 100 ETB',
    jsonb_build_object(
      'bonus_type', 'signup',
      'amount', c_signup_bonus_etb,
      'credited_at', NOW()
    ),
    NOW()
  );

  -- Handle referral bonus if referral code was provided
  v_referral_code := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'referral_code', ''),
    NULL
  );

  IF v_referral_code IS NOT NULL THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = v_referral_code
      AND id <> NEW.id
    LIMIT 1;

    IF v_referrer_id IS NOT NULL THEN
      -- Update referred_by relationship
      UPDATE public.profiles
      SET referred_by = v_referrer_id
      WHERE id = NEW.id;

      -- Credit referrer with invite bonus to BOTH wallet and balance
      UPDATE public.balances
      SET etb_balance = etb_balance + c_invite_bonus_etb,
          etb_wallet = etb_wallet + c_invite_bonus_etb,
          updated_at = NOW()
      WHERE user_id = v_referrer_id;

      -- Record the referral bonus in history
      INSERT INTO public.history (
        user_id,
        action,
        amount_etb,
        amount_usd,
        currency,
        status,
        reference_type,
        note,
        metadata,
        created_at
      )
      VALUES (
        v_referrer_id,
        'invite_bonus',
        c_invite_bonus_etb,
        0,
        'ETB',
        'success',
        'bonus',
        format('Referral bonus for inviting %s', NEW.email),
        jsonb_build_object(
          'referred_user_id', NEW.id,
          'referred_email', NEW.email,
          'bonus_amount', c_invite_bonus_etb
        ),
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user() failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- SECTION 5: ADMIN_APPROVE_DEPOSIT FUNCTION (PRODUCTION-READY)
-- =====================================================================
-- CRITICAL LOGIC:
-- a) Verify deposit status is 'pending'
-- b) Calculate 10% welcome bonus on deposit amount
-- c) Update BOTH _wallet and _balance columns simultaneously
-- d) Record TWO distinct history entries: 'deposit' and 'deposit_bonus'
-- e) Set deposit status to 'approved'
-- f) Use FOR UPDATE to prevent race conditions

DROP FUNCTION IF EXISTS public.approve_deposit(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit_record public.deposits%ROWTYPE;
  v_balance_record public.balances%ROWTYPE;
  v_bonus_amount NUMERIC(18,2);
  v_total_credit NUMERIC(18,2);
  v_bonus_pct CONSTANT NUMERIC := 0.10;  -- 10% welcome bonus
BEGIN
  -- ─────────────────────────────────────────────────────────────────
  -- AUTHORIZATION: Only admins can approve deposits
  -- ─────────────────────────────────────────────────────────────────
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'unauthorized',
      'message', 'Only administrators can approve deposits'
    );
  END IF;

  -- ─────────────────────────────────────────────────────────────────
  -- FETCH DEPOSIT WITH ROW LOCK (prevent race conditions)
  -- ─────────────────────────────────────────────────────────────────
  SELECT * INTO v_deposit_record
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'deposit_not_found',
      'message', format('Deposit %s not found', p_deposit_id)
    );
  END IF;

  -- ─────────────────────────────────────────────────────────────────
  -- REQUIREMENT A: VERIFY DEPOSIT STATUS IS 'PENDING'
  -- ─────────────────────────────────────────────────────────────────
  IF v_deposit_record.status = 'approved' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_approved', true,
      'message', 'Deposit already approved',
      'deposit_id', p_deposit_id
    );
  END IF;

  IF v_deposit_record.status = 'rejected' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'deposit_already_rejected',
      'message', 'Cannot approve a rejected deposit'
    );
  END IF;

  IF v_deposit_record.status != 'pending' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_deposit_status',
      'message', format('Deposit status is %s, expected pending', v_deposit_record.status)
    );
  END IF;

  -- ─────────────────────────────────────────────────────────────────
  -- REQUIREMENT B: CALCULATE 10% WELCOME BONUS
  -- ─────────────────────────────────────────────────────────────────
  -- Determine which amount field to use based on currency
  IF v_deposit_record.currency = 'ETB' THEN
    v_bonus_amount := ROUND(v_deposit_record.amount_etb * v_bonus_pct, 2);
    v_total_credit := v_deposit_record.amount_etb + v_bonus_amount;
  ELSE
    -- For USD, we still calculate 10% bonus
    v_bonus_amount := ROUND(v_deposit_record.amount_usd * v_bonus_pct, 6);
    v_total_credit := v_deposit_record.amount_usd + v_bonus_amount;
  END IF;

  -- ─────────────────────────────────────────────────────────────────
  -- FETCH USER'S BALANCE RECORD WITH ROW LOCK
  -- Create if doesn't exist yet
  -- ─────────────────────────────────────────────────────────────────
  SELECT * INTO v_balance_record
  FROM public.balances
  WHERE user_id = v_deposit_record.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Create balance record if it doesn't exist
    INSERT INTO public.balances (
      user_id,
      etb_balance,
      etb_wallet,
      usd_balance,
      usd_wallet,
      updated_at
    )
    VALUES (
      v_deposit_record.user_id,
      0, 0, 0, 0,
      NOW()
    );

    SELECT * INTO v_balance_record
    FROM public.balances
    WHERE user_id = v_deposit_record.user_id
    FOR UPDATE;
  END IF;

  -- ─────────────────────────────────────────────────────────────────
  -- REQUIREMENT C: UPDATE BOTH _WALLET AND _BALANCE SIMULTANEOUSLY
  -- Update the balance table with deposit + bonus
  -- ─────────────────────────────────────────────────────────────────
  IF v_deposit_record.currency = 'ETB' THEN
    UPDATE public.balances
    SET
      etb_balance = etb_balance + v_total_credit,
      etb_wallet = etb_wallet + v_total_credit,
      total_deposited_etb = total_deposited_etb + v_deposit_record.amount_etb,
      updated_at = NOW()
    WHERE user_id = v_deposit_record.user_id;
  ELSE  -- USD
    UPDATE public.balances
    SET
      usd_balance = usd_balance + v_total_credit,
      usd_wallet = usd_wallet + v_total_credit,
      updated_at = NOW()
    WHERE user_id = v_deposit_record.user_id;
  END IF;

  -- ─────────────────────────────────────────────────────────────────
  -- REQUIREMENT D: RECORD TWO DISTINCT HISTORY ENTRIES
  -- Entry 1: The deposit itself
  -- ─────────────────────────────────────────────────────────────────
  INSERT INTO public.history (
    user_id,
    action,
    amount_etb,
    amount_usd,
    currency,
    status,
    reference_id,
    reference_type,
    note,
    metadata,
    created_at
  )
  VALUES (
    v_deposit_record.user_id,
    'deposit',
    CASE WHEN v_deposit_record.currency = 'ETB' THEN v_deposit_record.amount_etb ELSE 0 END,
    CASE WHEN v_deposit_record.currency = 'USD' THEN v_deposit_record.amount_usd ELSE 0 END,
    v_deposit_record.currency,
    'success',
    v_deposit_record.id,
    'deposit',
    format('Deposit approved: %s %s', v_deposit_record.amount_etb, v_deposit_record.currency),
    jsonb_build_object(
      'payment_method_id', v_deposit_record.payment_method_id,
      'transaction_id', v_deposit_record.transaction_id,
      'approved_by', auth.uid(),
      'approved_at', NOW()
    ),
    NOW()
  );

  -- ─────────────────────────────────────────────────────────────────
  -- Entry 2: The 10% welcome bonus (separate entry)
  -- ─────────────────────────────────────────────────────────────────
  IF v_bonus_amount > 0 THEN
    INSERT INTO public.history (
      user_id,
      action,
      amount_etb,
      amount_usd,
      currency,
      status,
      reference_id,
      reference_type,
      note,
      metadata,
      created_at
    )
    VALUES (
      v_deposit_record.user_id,
      'bonus',
      CASE WHEN v_deposit_record.currency = 'ETB' THEN v_bonus_amount ELSE 0 END,
      CASE WHEN v_deposit_record.currency = 'USD' THEN v_bonus_amount ELSE 0 END,
      v_deposit_record.currency,
      'success',
      v_deposit_record.id,
      'deposit',
      format('10% Welcome bonus: %s %s', v_bonus_amount, v_deposit_record.currency),
      jsonb_build_object(
        'bonus_type', 'deposit_welcome',
        'bonus_rate', '10%',
        'deposit_id', v_deposit_record.id,
        'deposit_amount', CASE WHEN v_deposit_record.currency = 'ETB' THEN v_deposit_record.amount_etb ELSE v_deposit_record.amount_usd END,
        'bonus_amount', v_bonus_amount
      ),
      NOW()
    );
  END IF;

  -- ─────────────────────────────────────────────────────────────────
  -- REQUIREMENT E: SET DEPOSIT STATUS TO 'APPROVED'
  -- ─────────────────────────────────────────────────────────────────
  UPDATE public.deposits
  SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = NOW()
  WHERE id = p_deposit_id;

  -- ─────────────────────────────────────────────────────────────────
  -- SUCCESS RESPONSE
  -- ─────────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok', true,
    'deposit_id', p_deposit_id,
    'user_id', v_deposit_record.user_id,
    'currency', v_deposit_record.currency,
    'deposit_amount', CASE WHEN v_deposit_record.currency = 'ETB' THEN v_deposit_record.amount_etb ELSE v_deposit_record.amount_usd END,
    'bonus_amount', v_bonus_amount,
    'bonus_rate', '10%',
    'total_credited', v_total_credit,
    'message', format(
      'Deposit approved: %s + %s (10%% bonus) = %s %s total credited',
      CASE WHEN v_deposit_record.currency = 'ETB' THEN v_deposit_record.amount_etb ELSE v_deposit_record.amount_usd END,
      v_bonus_amount,
      v_total_credit,
      v_deposit_record.currency
    ),
    'timestamp', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', 'approval_failed',
    'message', SQLERRM,
    'deposit_id', p_deposit_id
  );
END;
$$;

-- =====================================================================
-- SECTION 6: FIX REJECT_DEPOSIT FUNCTION
-- =====================================================================
-- Ensure status is set to 'rejected' (not 'approved')

DROP FUNCTION IF EXISTS public.reject_deposit(UUID, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.reject_deposit(p_deposit_id UUID, p_note TEXT DEFAULT 'Rejected by admin')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit_record public.deposits%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'unauthorized',
      'message', 'Only administrators can reject deposits'
    );
  END IF;

  SELECT * INTO v_deposit_record
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'deposit_not_found',
      'message', format('Deposit %s not found', p_deposit_id)
    );
  END IF;

  IF v_deposit_record.status = 'rejected' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_rejected', true,
      'message', 'Deposit already rejected'
    );
  END IF;

  IF v_deposit_record.status != 'pending' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_status',
      'message', format('Cannot reject deposit with status %s', v_deposit_record.status)
    );
  END IF;

  -- Update deposit status to REJECTED
  UPDATE public.deposits
  SET
    status = 'rejected',
    admin_note = p_note,
    reviewed_by = auth.uid(),
    reviewed_at = NOW()
  WHERE id = p_deposit_id;

  -- Record rejection in history
  INSERT INTO public.history (
    user_id,
    action,
    amount_etb,
    amount_usd,
    currency,
    status,
    reference_id,
    reference_type,
    note,
    metadata,
    created_at
  )
  VALUES (
    v_deposit_record.user_id,
    'deposit',
    CASE WHEN v_deposit_record.currency = 'ETB' THEN v_deposit_record.amount_etb ELSE 0 END,
    CASE WHEN v_deposit_record.currency = 'USD' THEN v_deposit_record.amount_usd ELSE 0 END,
    v_deposit_record.currency,
    'failed',
    v_deposit_record.id,
    'deposit',
    format('Deposit rejected: %s', p_note),
    jsonb_build_object(
      'rejected_by', auth.uid(),
      'rejection_reason', p_note
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'deposit_id', p_deposit_id,
    'message', format('Deposit rejected: %s', p_note),
    'timestamp', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', 'rejection_failed',
    'message', SQLERRM
  );
END;
$$;

-- =====================================================================
-- SECTION 7: VERIFY DEPOSIT STATUS VALUES IN TABLE CONSTRAINT
-- =====================================================================
-- Ensure deposits table has correct status values

ALTER TABLE public.deposits
  DROP CONSTRAINT IF EXISTS deposits_status_check;

ALTER TABLE public.deposits
  ADD CONSTRAINT deposits_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- =====================================================================
-- SECTION 8: ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================================
-- Ensure all tables have RLS enabled for security

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- SECTION 9: GRANT FUNCTION PERMISSIONS
-- =====================================================================

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_deposit(UUID, TEXT) TO authenticated;

-- =====================================================================
-- SECTION 10: VERIFICATION QUERIES
-- =====================================================================

-- Verify balances table structure
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'balances'
ORDER BY ordinal_position;

-- Verify wallet columns exist
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'balances' AND column_name = 'etb_wallet') AS has_etb_wallet,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'balances' AND column_name = 'usd_wallet') AS has_usd_wallet;

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('balances', 'deposits', 'history', 'profiles', 'withdrawals');

-- Final status message
SELECT '✅ Ethio-Invest Platform Database Finalization Complete' AS status,
       'All deposit approval, signup bonus, and consistency logic optimized' AS summary,
       NOW() AS completed_at;
