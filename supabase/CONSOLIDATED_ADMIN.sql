-- CONSOLIDATED_ADMIN.sql
-- Single-file consolidation: drop all functions in public schema and recreate required RPCs
-- Run once in Supabase SQL Editor, then refresh schema

-- Step 1: Drop all functions in public schema (safe: will DROP and allow recreation below)
DO $$
DECLARE
  r RECORD;
  stmt TEXT;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
  LOOP
    stmt := format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE;', r.proname, r.args);
    EXECUTE stmt;
  END LOOP;
END
$$;

-- Step 2: Ensure base tables exist (profiles, balances, deposits, withdrawals, history)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  referred_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  etb_balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
  usd_balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'USDT', 'ETB')),
  amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  transaction_id TEXT,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD','USDT','ETB')),
  amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending',
  bank TEXT,
  account_name TEXT,
  account_number TEXT,
  payment_method TEXT,
  account_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  currency TEXT,
  amount NUMERIC(18,4) NOT NULL DEFAULT 0,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_action_check;
ALTER TABLE public.history
  ADD CONSTRAINT history_action_check
  CHECK (action IN ('welcome_bonus','signup_bonus','deposit_bonus','referral_bonus','withdrawal','deposit'));

CREATE TABLE IF NOT EXISTS public.user_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD','USDT','ETB')),
  amount NUMERIC(18,4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  daily_interest_rate NUMERIC(10,6) NOT NULL DEFAULT 0.05,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.daily_profit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_usd NUMERIC(18,4) NOT NULL DEFAULT 0,
  amount_etb NUMERIC(18,4) NOT NULL DEFAULT 0,
  profit_to_claim NUMERIC(18,4) GENERATED ALWAYS AS (COALESCE(amount_usd,0) + COALESCE(amount_etb,0)) STORED,
  can_claim BOOLEAN NOT NULL DEFAULT FALSE,
  last_calculated TIMESTAMPTZ,
  last_claimed TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(lower(trim(auth.jwt() ->> 'email')) = lower('workinehabche@gmail.com'), FALSE);
$$;

-- Step 3: Create consolidated RPCs (drop before create to avoid overload conflicts)

-- admin_approve_deposit(deposit_id UUID)
DROP FUNCTION IF EXISTS public.admin_approve_deposit(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep RECORD;
  norm_currency TEXT;
  bonus_amt NUMERIC(18,4);
  bonus_row_id UUID;
  v_deposit_bonus_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found';
  END IF;

  IF dep.status = 'approved' THEN
    RETURN json_build_object('ok', true, 'already_approved', true, 'deposit_id', p_deposit_id);
  END IF;

  IF dep.status = 'rejected' THEN
    RAISE EXCEPTION 'deposit_already_rejected';
  END IF;

  norm_currency := CASE WHEN upper(dep.currency) IN ('USD','USDT') THEN 'USD' ELSE 'ETB' END;
  bonus_amt := ROUND(dep.amount * 0.10, 4);

  INSERT INTO public.balances (user_id, etb_balance, usd_balance)
  VALUES (dep.user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF norm_currency = 'USD' THEN
    UPDATE public.balances SET usd_balance = usd_balance + dep.amount, updated_at = NOW() WHERE user_id = dep.user_id;
  ELSE
    UPDATE public.balances SET etb_balance = etb_balance + dep.amount, updated_at = NOW() WHERE user_id = dep.user_id;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_deposit_bonus_count FROM public.history WHERE user_id = dep.user_id AND action = 'deposit_bonus' AND reference_id = p_deposit_id;

  IF v_deposit_bonus_count = 0 THEN
    INSERT INTO public.history (user_id, action, currency, amount, reference_id, metadata)
    VALUES (dep.user_id, 'deposit_bonus', norm_currency, bonus_amt, p_deposit_id, jsonb_build_object('deposit_amount', dep.amount, 'rate', 0.10))
    ON CONFLICT DO NOTHING RETURNING id INTO bonus_row_id;
  END IF;

  IF bonus_row_id IS NOT NULL AND bonus_amt > 0 THEN
    IF norm_currency = 'USD' THEN
      UPDATE public.balances SET usd_balance = usd_balance + bonus_amt, updated_at = NOW() WHERE user_id = dep.user_id;
    ELSE
      UPDATE public.balances SET etb_balance = etb_balance + bonus_amt, updated_at = NOW() WHERE user_id = dep.user_id;
    END IF;
  END IF;

  UPDATE public.deposits SET status = 'approved', updated_at = NOW() WHERE id = p_deposit_id;

  RETURN json_build_object('ok', true, 'deposit_id', p_deposit_id, 'deposit_amount', dep.amount, 'deposit_bonus', COALESCE(bonus_amt,0), 'bonus_applied', bonus_row_id IS NOT NULL, 'currency', norm_currency);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- admin_reject_deposit(deposit_id UUID)
DROP FUNCTION IF EXISTS public.admin_reject_deposit(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.admin_reject_deposit(p_deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  UPDATE public.deposits SET status = 'rejected', updated_at = NOW() WHERE id = p_deposit_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found_or_not_pending';
  END IF;

  RETURN json_build_object('ok', true, 'deposit_id', p_deposit_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- submit_user_withdrawal: user-facing RPC to create a pending withdrawal and deduct balances
DROP FUNCTION IF EXISTS public.submit_user_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.submit_user_withdrawal(
  p_amount NUMERIC,
  p_currency TEXT,
  p_bank TEXT,
  p_account_name TEXT,
  p_account_number TEXT,
  p_payment_method TEXT,
  p_account_details TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_bal RECORD;
  v_currency TEXT;
  v_withdrawal_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  v_currency := CASE WHEN upper(p_currency) IN ('USD','USDT') THEN 'USD' ELSE 'ETB' END;

  SELECT * INTO v_bal FROM public.balances WHERE user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
  END IF;

  IF v_currency = 'USD' THEN
    IF COALESCE(v_bal.usd_balance,0) < p_amount THEN
      RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
    END IF;
    UPDATE public.balances SET usd_balance = usd_balance - p_amount, updated_at = NOW() WHERE user_id = v_user_id;
  ELSE
    IF COALESCE(v_bal.etb_balance,0) < p_amount THEN
      RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
    END IF;
    UPDATE public.balances SET etb_balance = etb_balance - p_amount, updated_at = NOW() WHERE user_id = v_user_id;
  END IF;

  INSERT INTO public.withdrawals (user_id, amount, currency, bank, account_name, account_number, payment_method, account_details, status)
  VALUES (v_user_id, p_amount, v_currency, NULLIF(TRIM(p_bank),''), NULLIF(TRIM(p_account_name),''), NULLIF(TRIM(p_account_number),''), NULLIF(TRIM(p_payment_method),''), p_account_details, 'pending')
  RETURNING id INTO v_withdrawal_id;

  RETURN json_build_object('ok', true, 'withdrawal_id', v_withdrawal_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- calculate_daily_profit(p_user_id UUID)
DROP FUNCTION IF EXISTS public.calculate_daily_profit(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.calculate_daily_profit(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usd NUMERIC := 0;
  v_etb NUMERIC := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_user_id');
  END IF;

  -- Sum daily returns assuming a per-investment stored daily_interest_rate, fallback 0.05
  IF EXISTS (SELECT 1 FROM public.user_investments LIMIT 1) THEN
    SELECT COALESCE(SUM(amount * COALESCE(daily_interest_rate, 0.05)),0) INTO v_usd
    FROM public.user_investments WHERE user_id = p_user_id AND status = 'active' AND (currency = 'USD' OR currency = 'USDT');

    SELECT COALESCE(SUM(amount * COALESCE(daily_interest_rate, 0.05)),0) INTO v_etb
    FROM public.user_investments WHERE user_id = p_user_id AND status = 'active' AND currency = 'ETB';
  ELSE
    -- No server-side investments table: best-effort zero
    v_usd := 0;
    v_etb := 0;
  END IF;

  INSERT INTO public.daily_profit (user_id, amount_usd, amount_etb, can_claim, last_calculated)
  VALUES (p_user_id, v_usd, v_etb, true, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET amount_usd = EXCLUDED.amount_usd,
      amount_etb = EXCLUDED.amount_etb,
      can_claim = true,
      last_calculated = NOW();

  RETURN json_build_object('ok', true, 'amount_usd', v_usd, 'amount_etb', v_etb);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- claim_daily_profit(p_user_id UUID)
DROP FUNCTION IF EXISTS public.claim_daily_profit(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.claim_daily_profit(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profit_amount NUMERIC;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_user_id');
  END IF;

  SELECT profit_to_claim INTO v_profit_amount
  FROM public.daily_profit
  WHERE user_id = p_user_id AND can_claim = TRUE;

  IF v_profit_amount IS NULL OR v_profit_amount = 0 THEN
    RETURN json_build_object('ok', true, 'claimed', false, 'reason', 'no_profit');
  END IF;

  UPDATE public.daily_profit
  SET can_claim = FALSE,
      amount_usd = 0,
      amount_etb = 0,
      last_claimed = NOW()
  WHERE user_id = p_user_id;

  RETURN json_build_object('ok', true, 'claimed', true, 'profit_amount', v_profit_amount);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- admin_get_dashboard_stats()
DROP FUNCTION IF EXISTS public.admin_get_dashboard_stats() CASCADE;
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN json_build_object(
    'total_users', (SELECT count(*) FROM auth.users),
    'pending_deposits', (SELECT count(*) FROM public.deposits WHERE status = 'pending'),
    'pending_withdrawals', (SELECT count(*) FROM public.withdrawals WHERE status = 'pending'),
    'active_investments', (SELECT count(*) FROM public.user_investments WHERE status = 'active')
  );
END;
$$;

-- admin_list_pending_deposits()
DROP FUNCTION IF EXISTS public.admin_list_pending_deposits() CASCADE;
CREATE OR REPLACE FUNCTION public.admin_list_pending_deposits()
RETURNS SETOF public.deposits
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.deposits WHERE status = 'pending';
$$;

-- admin_list_withdrawals()
DROP FUNCTION IF EXISTS public.admin_list_withdrawals() CASCADE;
CREATE OR REPLACE FUNCTION public.admin_list_withdrawals()
RETURNS SETOF public.withdrawals
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.withdrawals;
$$;

-- admin_list_users()
DROP FUNCTION IF EXISTS public.admin_list_users() CASCADE;
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id UUID, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, email, created_at FROM auth.users;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_user_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_daily_profit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_profit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_deposits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_withdrawals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Schema refresh
NOTIFY pgrst, 'reload schema';
