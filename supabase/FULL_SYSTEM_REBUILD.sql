-- ============================================================================
-- FULL_SYSTEM_REBUILD.sql
-- Complete Supabase schema rebuild for investment platform
-- ============================================================================

-- Clean slate: remove custom RPCs and work tables
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
      AND (
        p.proname LIKE 'admin_%'
        OR p.proname LIKE 'submit_%'
        OR p.proname IN ('deposit','withdraw','invite_bonus','calculate_daily_profit','claim_daily_profit','admin_get_dashboard_stats','admin_list_pending_deposits','admin_list_withdrawals','admin_list_users','admin_delete_user','get_user_active_investment_total','admin_list_active_investments')
      )
  LOOP
    stmt := format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE;', r.proname, r.args);
    EXECUTE stmt;
  END LOOP;
END
$$;

DROP TABLE IF EXISTS public.daily_profit CASCADE;
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.investments CASCADE;
DROP TABLE IF EXISTS public.withdrawals CASCADE;
DROP TABLE IF EXISTS public.deposits CASCADE;
DROP TABLE IF EXISTS public.history CASCADE;
DROP TABLE IF EXISTS public.balances CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Ensure UUID helper exists for new record IDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Profiles store the app user profile linked to auth.users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Balances store per-user USD/ETB totals with non-negative constraints
CREATE TABLE public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  usd_balance NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (usd_balance >= 0),
  etb_balance NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (etb_balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deposits store user deposit requests and approved deposits
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD','USDT','ETB')),
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','rejected')),
  payment_method TEXT,
  transaction_id TEXT,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Withdrawals store user withdrawal requests
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD','USDT','ETB')),
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','rejected')),
  bank TEXT,
  account_name TEXT,
  account_number TEXT,
  payment_method TEXT,
  account_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- History logs every financial action with status and reference ID
CREATE TABLE public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('deposit','withdrawal','invite_bonus','daily_profit','deposit_bonus','referral_bonus','signup_bonus','welcome_bonus')),
  currency TEXT CHECK (currency IN ('USD','USDT','ETB')),
  amount NUMERIC(18,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending','successful','rejected')),
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Investments track active investments and daily interest.
CREATE TABLE public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD','USDT','ETB')),
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','pending')),
  daily_interest_rate NUMERIC(10,6) NOT NULL DEFAULT 0.05,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Referrals record invites and bonus settlements.
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bonus_amount NUMERIC(18,4) NOT NULL CHECK (bonus_amount >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD','USDT','ETB')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

-- Daily profit table stores calculated claimable profit by currency.
CREATE TABLE public.daily_profit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  usd_profit NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (usd_profit >= 0),
  etb_profit NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (etb_profit >= 0),
  can_claim BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);

-- Admin helper: identify admin users by email in JWT.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(lower(trim(auth.jwt() ->> 'email')) = lower('workinehabche@gmail.com'), FALSE);
$$;

-- Internal deposit handler updates balances and history.
CREATE OR REPLACE FUNCTION public.deposit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_reference_id UUID,
  p_payment_method TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currency TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_user';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  v_currency := CASE WHEN upper(p_currency) IN ('USD','USDT') THEN 'USD' ELSE 'ETB' END;

  INSERT INTO public.balances (user_id, usd_balance, etb_balance)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF v_currency = 'USD' THEN
    UPDATE public.balances
    SET usd_balance = usd_balance + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    UPDATE public.balances
    SET etb_balance = etb_balance + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.history (user_id, action, currency, amount, status, reference_id, metadata)
  VALUES (p_user_id, 'deposit', v_currency, p_amount, 'successful', p_reference_id, jsonb_build_object('payment_method', p_payment_method));

  RETURN json_build_object('ok', true, 'user_id', p_user_id, 'amount', p_amount, 'currency', v_currency);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Internal withdraw handler deducts balances and logs history.
CREATE OR REPLACE FUNCTION public.withdraw(
  p_user_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_reference_id UUID,
  p_payment_method TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currency TEXT;
  v_balance public.balances%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_user';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  v_currency := CASE WHEN upper(p_currency) IN ('USD','USDT') THEN 'USD' ELSE 'ETB' END;

  SELECT * INTO v_balance FROM public.balances WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'balance_not_found';
  END IF;

  IF v_currency = 'USD' THEN
    IF v_balance.usd_balance < p_amount THEN
      RAISE EXCEPTION 'insufficient_usd';
    END IF;
    UPDATE public.balances
    SET usd_balance = usd_balance - p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    IF v_balance.etb_balance < p_amount THEN
      RAISE EXCEPTION 'insufficient_etb';
    END IF;
    UPDATE public.balances
    SET etb_balance = etb_balance - p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.history (user_id, action, currency, amount, status, reference_id, metadata)
  VALUES (p_user_id, 'withdrawal', v_currency, p_amount, 'successful', p_reference_id, jsonb_build_object('payment_method', p_payment_method));

  RETURN json_build_object('ok', true, 'user_id', p_user_id, 'amount', p_amount, 'currency', v_currency);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Invite bonus pays bonus to referrer and records the referral.
CREATE OR REPLACE FUNCTION public.invite_bonus(
  p_referrer_id UUID,
  p_referee_id UUID,
  p_amount NUMERIC,
  p_currency TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currency TEXT;
BEGIN
  IF p_referrer_id IS NULL OR p_referee_id IS NULL THEN
    RAISE EXCEPTION 'invalid_referral_ids';
  END IF;

  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  v_currency := CASE WHEN upper(p_currency) IN ('USD','USDT') THEN 'USD' ELSE 'ETB' END;

  INSERT INTO public.referrals (referrer_id, referee_id, bonus_amount, currency, status, created_at)
  VALUES (p_referrer_id, p_referee_id, p_amount, v_currency, 'successful', NOW());

  PERFORM public.deposit(p_referrer_id, p_amount, v_currency, NULL, 'invite_bonus');

  RETURN json_build_object('ok', true, 'referrer_id', p_referrer_id, 'referee_id', p_referee_id, 'bonus_amount', p_amount, 'currency', v_currency);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Daily profit calculation supports ETB and USD separately.
CREATE OR REPLACE FUNCTION public.calculate_daily_profit(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usd_profit NUMERIC := 0;
  v_etb_profit NUMERIC := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user';
  END IF;

  SELECT COALESCE(SUM(amount * daily_interest_rate), 0)
  INTO v_usd_profit
  FROM public.investments
  WHERE user_id = p_user_id
    AND status = 'active'
    AND currency IN ('USD','USDT');

  SELECT COALESCE(SUM(amount * daily_interest_rate), 0)
  INTO v_etb_profit
  FROM public.investments
  WHERE user_id = p_user_id
    AND status = 'active'
    AND currency = 'ETB';

  INSERT INTO public.daily_profit (user_id, usd_profit, etb_profit, can_claim, updated_at)
  VALUES (p_user_id, v_usd_profit, v_etb_profit, true, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET usd_profit = EXCLUDED.usd_profit,
      etb_profit = EXCLUDED.etb_profit,
      can_claim = true,
      updated_at = NOW();

  RETURN json_build_object('ok', true, 'usd_profit', v_usd_profit, 'etb_profit', v_etb_profit);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- User-facing deposit request creates a pending deposit record.
CREATE OR REPLACE FUNCTION public.submit_deposit_request(
  p_amount NUMERIC,
  p_currency TEXT,
  p_payment_method TEXT,
  p_transaction_id TEXT,
  p_proof_url TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_currency TEXT;
  v_deposit_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  v_currency := CASE WHEN upper(p_currency) IN ('USD','USDT') THEN 'USD' ELSE 'ETB' END;

  INSERT INTO public.deposits (user_id, currency, amount, status, payment_method, transaction_id, proof_url)
  VALUES (v_user_id, v_currency, p_amount, 'pending', p_payment_method, p_transaction_id, p_proof_url)
  RETURNING id INTO v_deposit_id;

  INSERT INTO public.history (user_id, action, currency, amount, status, reference_id, metadata)
  VALUES (v_user_id, 'deposit', v_currency, p_amount, 'pending', v_deposit_id, jsonb_build_object('payment_method', p_payment_method, 'transaction_id', p_transaction_id));

  RETURN json_build_object('ok', true, 'deposit_id', v_deposit_id, 'status', 'pending');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- User-facing withdraw request creates a pending withdrawal record.
CREATE OR REPLACE FUNCTION public.submit_withdraw_request(
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
  v_currency TEXT;
  v_withdrawal_id UUID;
  v_balance public.balances%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  v_currency := CASE WHEN upper(p_currency) IN ('USD','USDT') THEN 'USD' ELSE 'ETB' END;

  SELECT * INTO v_balance FROM public.balances WHERE user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'balance_not_found');
  END IF;

  IF v_currency = 'USD' AND v_balance.usd_balance < p_amount THEN
    RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
  ELSIF v_currency = 'ETB' AND v_balance.etb_balance < p_amount THEN
    RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
  END IF;

  INSERT INTO public.withdrawals (user_id, currency, amount, status, bank, account_name, account_number, payment_method, account_details)
  VALUES (v_user_id, v_currency, p_amount, 'pending', p_bank, p_account_name, p_account_number, p_payment_method, p_account_details)
  RETURNING id INTO v_withdrawal_id;

  INSERT INTO public.history (user_id, action, currency, amount, status, reference_id, metadata)
  VALUES (v_user_id, 'withdrawal', v_currency, p_amount, 'pending', v_withdrawal_id, jsonb_build_object('bank', p_bank, 'account_name', p_account_name));

  RETURN json_build_object('ok', true, 'withdrawal_id', v_withdrawal_id, 'status', 'pending');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Approve deposit and make it successful in both deposits and history.
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_deposit_id UUID)
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

  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found';
  END IF;

  IF v_dep.status != 'pending' THEN
    RAISE EXCEPTION 'deposit_not_pending';
  END IF;

  PERFORM public.deposit(v_dep.user_id, v_dep.amount, v_dep.currency, v_dep.id, v_dep.payment_method);

  UPDATE public.deposits
  SET status = 'successful', updated_at = NOW()
  WHERE id = p_deposit_id;

  UPDATE public.history
  SET status = 'successful', updated_at = NOW(), metadata = metadata || jsonb_build_object('approved_by', auth.jwt() ->> 'email')
  WHERE reference_id = p_deposit_id AND action = 'deposit';

  RETURN json_build_object('ok', true, 'deposit_id', p_deposit_id, 'status', 'successful');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Approve withdrawal and make it successful in both withdrawals and history.
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

  PERFORM public.withdraw(v_w.user_id, v_w.amount, v_w.currency, v_w.id, v_w.payment_method);

  UPDATE public.withdrawals
  SET status = 'successful', updated_at = NOW()
  WHERE id = p_withdrawal_id;

  UPDATE public.history
  SET status = 'successful', updated_at = NOW(), metadata = metadata || jsonb_build_object('approved_by', auth.jwt() ->> 'email')
  WHERE reference_id = p_withdrawal_id AND action = 'withdrawal';

  RETURN json_build_object('ok', true, 'withdrawal_id', p_withdrawal_id, 'status', 'successful');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Delete a user and all related data securely.
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  DELETE FROM public.profiles WHERE id = p_user_id;
  RETURN json_build_object('ok', true, 'user_id', p_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Dashboard stats for admin panel.
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
    'pending_withdrawals', (SELECT COUNT(*) FROM public.withdrawals WHERE status = 'pending'),
    'active_investments', (SELECT COUNT(*) FROM public.investments WHERE status = 'active')
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- List functions for admin dashboard.
CREATE OR REPLACE FUNCTION public.admin_list_pending_deposits()
RETURNS SETOF public.deposits
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.deposits WHERE status = 'pending';
$$;

CREATE OR REPLACE FUNCTION public.admin_list_withdrawals()
RETURNS SETOF public.withdrawals
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.withdrawals;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id UUID, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, email, created_at FROM auth.users;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_active_investments()
RETURNS SETOF public.investments
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.investments WHERE status = 'active';
$$;

-- Return a user investment summary with active amounts by currency.
CREATE OR REPLACE FUNCTION public.get_user_active_investment_total(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usd NUMERIC := 0;
  v_etb NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(amount),0)
  INTO v_usd
  FROM public.investments
  WHERE user_id = p_user_id AND status = 'active' AND currency IN ('USD','USDT');

  SELECT COALESCE(SUM(amount),0)
  INTO v_etb
  FROM public.investments
  WHERE user_id = p_user_id AND status = 'active' AND currency = 'ETB';

  RETURN json_build_object('ok', true, 'usd_active_investment', v_usd, 'etb_active_investment', v_etb);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Dynamic view for per-user active investment and daily profit summary.
CREATE OR REPLACE VIEW public.user_financial_summary AS
SELECT
  p.id AS user_id,
  COALESCE(SUM(CASE WHEN i.currency IN ('USD','USDT') THEN i.amount END), 0) AS active_investment_usd,
  COALESCE(SUM(CASE WHEN i.currency = 'ETB' THEN i.amount END), 0) AS active_investment_etb,
  COALESCE(SUM(CASE WHEN i.currency IN ('USD','USDT') THEN i.amount * i.daily_interest_rate END), 0) AS daily_profit_usd,
  COALESCE(SUM(CASE WHEN i.currency = 'ETB' THEN i.amount * i.daily_interest_rate END), 0) AS daily_profit_etb
FROM public.profiles p
LEFT JOIN public.investments i ON i.user_id = p.id AND i.status = 'active'
GROUP BY p.id;

GRANT SELECT ON public.user_financial_summary TO authenticated;

-- Automatically build profile and balance record when a new auth user is created.
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

-- Grant execute rights to authenticated users for API access.
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.deposit(UUID, NUMERIC, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw(UUID, NUMERIC, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_bonus(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_daily_profit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_deposit_request(NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_withdraw_request(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_withdrawal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_deposits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_withdrawals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_active_investments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_active_investment_total(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_deposit_request(NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_withdraw_request(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Refresh Supabase API schema after deployment.
NOTIFY pgrst, 'reload schema';
