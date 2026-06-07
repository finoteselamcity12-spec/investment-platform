-- ============================================================================
-- ADMIN_DASHBOARD_SCHEMA.sql
-- Full Supabase schema rebuild for investment platform admin RPCs
-- ============================================================================

-- Clean slate: remove all custom admin/submit functions and target tables
DO $$
DECLARE
  r RECORD;
  stmt TEXT;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND (p.proname LIKE 'admin_%' OR p.proname LIKE 'submit_%')
  LOOP
    stmt := format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE;', r.proname, r.args);
    EXECUTE stmt;
  END LOOP;
END
$$;

DROP TABLE IF EXISTS public.withdrawals CASCADE;
DROP TABLE IF EXISTS public.deposits CASCADE;
DROP TABLE IF EXISTS public.history CASCADE;
DROP TABLE IF EXISTS public.balances CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Ensure UUID helper exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Balances table
CREATE TABLE public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  usd_balance NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (usd_balance >= 0),
  etb_balance NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (etb_balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deposits table
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD','USDT','ETB')),
  amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','rejected')),
  payment_method TEXT,
  transaction_id TEXT,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Withdrawals table
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD','USDT','ETB')),
  amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','rejected')),
  bank TEXT,
  account_name TEXT,
  account_number TEXT,
  payment_method TEXT,
  account_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- History table
CREATE TABLE public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('deposit','withdrawal','deposit_bonus','referral_bonus','signup_bonus','welcome_bonus')),
  currency TEXT CHECK (currency IN ('USD','USDT','ETB')),
  amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  status TEXT,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(lower(trim(auth.jwt() ->> 'email')) = lower('workinehabche@gmail.com'), FALSE);
$$;

-- Admin dashboard stats
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  RETURN json_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'pending_deposits', (SELECT COUNT(*) FROM public.deposits WHERE status = 'pending'),
    'pending_withdrawals', (SELECT COUNT(*) FROM public.withdrawals WHERE status = 'pending')
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- List pending deposits
CREATE OR REPLACE FUNCTION public.admin_list_pending_deposits()
RETURNS SETOF public.deposits
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.deposits WHERE status = 'pending';
$$;

-- List withdrawals
CREATE OR REPLACE FUNCTION public.admin_list_withdrawals()
RETURNS SETOF public.withdrawals
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.withdrawals;
$$;

-- List users
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id UUID, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, email, created_at FROM auth.users;
$$;

-- Approve deposit
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep public.deposits%ROWTYPE;
  deposit_amount NUMERIC(18,4);
  v_currency TEXT;
  v_balance_exists BOOLEAN;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found';
  END IF;

  IF v_dep.status != 'pending' THEN
    RAISE EXCEPTION 'deposit_not_pending';
  END IF;

  v_currency := CASE WHEN upper(v_dep.currency) IN ('USD','USDT') THEN 'USD' ELSE 'ETB' END;
  deposit_amount := COALESCE(v_dep.amount, v_dep.amount_usd, v_dep.amount_etb, 0);

  INSERT INTO public.balances (user_id, usd_balance, etb_balance)
  VALUES (v_dep.user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF v_currency = 'USD' THEN
    UPDATE public.balances
    SET usd_balance = usd_balance + deposit_amount,
        updated_at = NOW()
    WHERE user_id = v_dep.user_id;
  ELSE
    UPDATE public.balances
    SET etb_balance = etb_balance + deposit_amount,
        updated_at = NOW()
    WHERE user_id = v_dep.user_id;
  END IF;

  UPDATE public.deposits
  SET status = 'successful', updated_at = NOW()
  WHERE id = p_deposit_id;

  INSERT INTO public.history (user_id, action, currency, amount, status, reference_id, metadata)
  VALUES (v_dep.user_id, 'deposit', v_currency, deposit_amount, 'successful', p_deposit_id, jsonb_build_object('payment_method', v_dep.payment_method));

  RETURN json_build_object('ok', true, 'deposit_id', p_deposit_id, 'status', 'successful');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Approve withdrawal
CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(p_withdrawal_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w public.withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal_not_found';
  END IF;

  IF v_w.status != 'pending' THEN
    RAISE EXCEPTION 'withdrawal_not_pending';
  END IF;

  UPDATE public.withdrawals
  SET status = 'successful', updated_at = NOW()
  WHERE id = p_withdrawal_id;

  IF upper(v_w.currency) IN ('USD','USDT') THEN
    UPDATE public.balances
    SET usd_balance = usd_balance - v_w.amount,
        updated_at = NOW()
    WHERE user_id = v_w.user_id;
  ELSE
    UPDATE public.balances
    SET etb_balance = etb_balance - v_w.amount,
        updated_at = NOW()
    WHERE user_id = v_w.user_id;
  END IF;

  INSERT INTO public.history (user_id, action, currency, amount, status, reference_id, metadata)
  VALUES (v_w.user_id, 'withdrawal', v_w.currency, v_w.amount, 'successful', p_withdrawal_id, jsonb_build_object('payment_method', v_w.payment_method));

  RETURN json_build_object('ok', true, 'withdrawal_id', p_withdrawal_id, 'status', 'successful');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- User withdrawal submission
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
  v_user_id UUID := auth.uid();
  v_balance public.balances%ROWTYPE;
  v_currency TEXT;
  v_withdrawal_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  v_currency := CASE WHEN upper(p_currency) IN ('USD','USDT') THEN 'USD' ELSE 'ETB' END;

  SELECT * INTO v_balance FROM public.balances WHERE user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'balance_not_found');
  END IF;

  IF v_currency = 'USD' THEN
    IF v_balance.usd_balance < p_amount THEN
      RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
    END IF;
  ELSE
    IF v_balance.etb_balance < p_amount THEN
      RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
    END IF;
  END IF;

  INSERT INTO public.withdrawals (user_id, currency, amount, status, bank, account_name, account_number, payment_method, account_details)
  VALUES (v_user_id, v_currency, p_amount, 'pending', NULLIF(TRIM(p_bank), ''), NULLIF(TRIM(p_account_name), ''), NULLIF(TRIM(p_account_number), ''), NULLIF(TRIM(p_payment_method), ''), p_account_details)
  RETURNING id INTO v_withdrawal_id;

  RETURN json_build_object('ok', true, 'withdrawal_id', v_withdrawal_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Auto-create profile and balance on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.balances (user_id, usd_balance, etb_balance)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant execute rights to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_deposits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_withdrawals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_withdrawal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_user_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
