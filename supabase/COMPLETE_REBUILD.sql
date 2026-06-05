-- ============================================================================
-- COMPLETE_REBUILD.sql
-- Full Supabase schema rebuild with tables, RLS policies, and RPC functions
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP EXISTING SCHEMA (SAFE CLEANUP)
-- ============================================================================

-- Drop all functions in public schema first
DO $$
DECLARE
  r RECORD;
  stmt TEXT;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname NOT LIKE 'pg_%'
  LOOP
    stmt := format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE;', r.proname, r.args);
    EXECUTE stmt;
  END LOOP;
END
$$;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.daily_profit CASCADE;
DROP TABLE IF EXISTS public.user_investments CASCADE;
DROP TABLE IF EXISTS public.withdrawals CASCADE;
DROP TABLE IF EXISTS public.deposits CASCADE;
DROP TABLE IF EXISTS public.history CASCADE;
DROP TABLE IF EXISTS public.balances CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================================
-- STEP 2: CREATE BASE TABLES
-- ============================================================================

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Balances table (user fund tracking)
CREATE TABLE public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  etb_balance NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (etb_balance >= 0),
  usd_balance NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (usd_balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deposits table (user deposit requests)
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'USDT', 'ETB')),
  amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  payment_method TEXT,
  transaction_id TEXT,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Withdrawals table (user withdrawal requests)
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'USDT', 'ETB')),
  amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  bank TEXT,
  account_name TEXT,
  account_number TEXT,
  payment_method TEXT,
  account_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- History table (audit log for all transactions)
CREATE TABLE public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('welcome_bonus', 'signup_bonus', 'deposit_bonus', 'referral_bonus', 'withdrawal', 'deposit')),
  currency TEXT CHECK (currency IN ('USD', 'USDT', 'ETB')),
  amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Investments table (tracks active investments)
CREATE TABLE public.user_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'USDT', 'ETB')),
  amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending')),
  daily_interest_rate NUMERIC(10, 6) NOT NULL DEFAULT 0.05,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily Profit table (daily profit calculations)
CREATE TABLE public.daily_profit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_usd NUMERIC(18, 4) NOT NULL DEFAULT 0,
  amount_etb NUMERIC(18, 4) NOT NULL DEFAULT 0,
  profit_to_claim NUMERIC(18, 4) GENERATED ALWAYS AS (COALESCE(amount_usd, 0) + COALESCE(amount_etb, 0)) STORED,
  can_claim BOOLEAN NOT NULL DEFAULT FALSE,
  last_calculated TIMESTAMPTZ,
  last_claimed TIMESTAMPTZ
);

-- ============================================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_profit ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: CREATE RLS POLICIES
-- ============================================================================

-- Admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(lower(trim(auth.jwt() ->> 'email')) = lower('workinehabche@gmail.com'), FALSE);
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- Balances policies
CREATE POLICY "Users can view own balance" ON public.balances
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "System can update balances" ON public.balances
  FOR UPDATE USING (public.is_admin() OR auth.uid() = user_id);

-- Deposits policies
CREATE POLICY "Users can view own deposits" ON public.deposits
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert own deposits" ON public.deposits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update deposits" ON public.deposits
  FOR UPDATE USING (public.is_admin());

-- Withdrawals policies
CREATE POLICY "Users can view own withdrawals" ON public.withdrawals
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert own withdrawals" ON public.withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update withdrawals" ON public.withdrawals
  FOR UPDATE USING (public.is_admin());

-- History policies
CREATE POLICY "Users can view own history" ON public.history
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "System can insert history" ON public.history
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- User Investments policies
CREATE POLICY "Users can view own investments" ON public.user_investments
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can manage investments" ON public.user_investments
  FOR ALL USING (public.is_admin());

-- Daily Profit policies
CREATE POLICY "Users can view own profit" ON public.daily_profit
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "System can manage profit records" ON public.daily_profit
  FOR ALL USING (public.is_admin() OR auth.uid() = user_id);

-- ============================================================================
-- STEP 5: CREATE CORE RPC FUNCTIONS
-- ============================================================================

-- ============================================================================
-- admin_approve_deposit(p_deposit_id UUID)
-- Approves a deposit, adds funds to balance, applies deposit bonus
-- ============================================================================
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
  bonus_amt NUMERIC(18, 4);
  bonus_row_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found';
  END IF;

  IF dep.status != 'pending' THEN
    RAISE EXCEPTION 'deposit_not_pending';
  END IF;

  -- Normalize currency
  norm_currency := CASE WHEN upper(dep.currency) IN ('USD', 'USDT') THEN 'USD' ELSE 'ETB' END;
  bonus_amt := ROUND(dep.amount * 0.10, 4);

  -- Ensure balance record exists
  INSERT INTO public.balances (user_id, etb_balance, usd_balance)
  VALUES (dep.user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Add deposit amount to balance
  IF norm_currency = 'USD' THEN
    UPDATE public.balances SET usd_balance = usd_balance + dep.amount, updated_at = NOW() WHERE user_id = dep.user_id;
  ELSE
    UPDATE public.balances SET etb_balance = etb_balance + dep.amount, updated_at = NOW() WHERE user_id = dep.user_id;
  END IF;

  -- Add deposit bonus
  IF bonus_amt > 0 THEN
    INSERT INTO public.history (user_id, action, currency, amount, reference_id, metadata)
    VALUES (dep.user_id, 'deposit_bonus', norm_currency, bonus_amt, p_deposit_id, jsonb_build_object('deposit_amount', dep.amount, 'rate', 0.10))
    ON CONFLICT DO NOTHING RETURNING id INTO bonus_row_id;

    IF bonus_row_id IS NOT NULL THEN
      IF norm_currency = 'USD' THEN
        UPDATE public.balances SET usd_balance = usd_balance + bonus_amt, updated_at = NOW() WHERE user_id = dep.user_id;
      ELSE
        UPDATE public.balances SET etb_balance = etb_balance + bonus_amt, updated_at = NOW() WHERE user_id = dep.user_id;
      END IF;
    END IF;
  END IF;

  -- Update deposit status
  UPDATE public.deposits SET status = 'approved', updated_at = NOW() WHERE id = p_deposit_id;

  RETURN json_build_object('ok', true, 'deposit_id', p_deposit_id, 'deposit_amount', dep.amount, 'deposit_bonus', COALESCE(bonus_amt, 0), 'currency', norm_currency);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- admin_approve_withdrawal(p_withdrawal_id UUID)
-- Approves a withdrawal, adds history record
-- ============================================================================
DROP FUNCTION IF EXISTS public.admin_approve_withdrawal(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(p_withdrawal_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_amount NUMERIC;
  v_currency TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT user_id, amount, currency INTO v_user_id, v_amount, v_currency
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal_not_found';
  END IF;

  -- Update withdrawal status
  UPDATE public.withdrawals
  SET status = 'approved', updated_at = NOW()
  WHERE id = p_withdrawal_id;

  -- Log to history as successful withdrawal
  INSERT INTO public.history (user_id, action, currency, amount, reference_id, metadata)
  VALUES (v_user_id, 'withdrawal', v_currency, v_amount, p_withdrawal_id, jsonb_build_object('status', 'successful'));

  RETURN json_build_object('ok', true, 'status', 'approved', 'withdrawal_id', p_withdrawal_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- admin_reject_deposit(p_deposit_id UUID)
-- Rejects a deposit and returns funds if already added
-- ============================================================================
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

  UPDATE public.deposits
  SET status = 'rejected', updated_at = NOW()
  WHERE id = p_deposit_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found_or_not_pending';
  END IF;

  RETURN json_build_object('ok', true, 'deposit_id', p_deposit_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- submit_user_withdrawal(p_amount, p_currency, p_bank, p_account_name, p_account_number, p_payment_method, p_account_details)
-- User-facing RPC to create withdrawal request and deduct balance
-- ============================================================================
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

  v_currency := CASE WHEN upper(p_currency) IN ('USD', 'USDT') THEN 'USD' ELSE 'ETB' END;

  -- Lock and check balance
  SELECT * INTO v_bal FROM public.balances WHERE user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
  END IF;

  IF v_currency = 'USD' THEN
    IF COALESCE(v_bal.usd_balance, 0) < p_amount THEN
      RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
    END IF;
    UPDATE public.balances SET usd_balance = usd_balance - p_amount, updated_at = NOW() WHERE user_id = v_user_id;
  ELSE
    IF COALESCE(v_bal.etb_balance, 0) < p_amount THEN
      RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
    END IF;
    UPDATE public.balances SET etb_balance = etb_balance - p_amount, updated_at = NOW() WHERE user_id = v_user_id;
  END IF;

  -- Create withdrawal record
  INSERT INTO public.withdrawals (user_id, amount, currency, bank, account_name, account_number, payment_method, account_details, status)
  VALUES (v_user_id, p_amount, v_currency, NULLIF(TRIM(p_bank), ''), NULLIF(TRIM(p_account_name), ''), NULLIF(TRIM(p_account_number), ''), NULLIF(TRIM(p_payment_method), ''), p_account_details, 'pending')
  RETURNING id INTO v_withdrawal_id;

  RETURN json_build_object('ok', true, 'withdrawal_id', v_withdrawal_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- calculate_daily_profit(p_user_id UUID)
-- Calculates daily profit from active investments
-- ============================================================================
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

  -- Calculate USD profit
  SELECT COALESCE(SUM(amount * COALESCE(daily_interest_rate, 0.05)), 0) INTO v_usd
  FROM public.user_investments
  WHERE user_id = p_user_id AND status = 'active' AND (currency = 'USD' OR currency = 'USDT');

  -- Calculate ETB profit
  SELECT COALESCE(SUM(amount * COALESCE(daily_interest_rate, 0.05)), 0) INTO v_etb
  FROM public.user_investments
  WHERE user_id = p_user_id AND status = 'active' AND currency = 'ETB';

  -- Update or insert daily profit record
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

-- ============================================================================
-- claim_daily_profit(p_user_id UUID)
-- Allows user to claim daily profit and add to balance
-- ============================================================================
DROP FUNCTION IF EXISTS public.claim_daily_profit(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.claim_daily_profit(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profit_usd NUMERIC;
  v_profit_etb NUMERIC;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_user_id');
  END IF;

  SELECT amount_usd, amount_etb INTO v_profit_usd, v_profit_etb
  FROM public.daily_profit
  WHERE user_id = p_user_id AND can_claim = TRUE;

  IF v_profit_usd IS NULL AND v_profit_etb IS NULL THEN
    RETURN json_build_object('ok', true, 'claimed', false, 'reason', 'no_profit');
  END IF;

  v_profit_usd := COALESCE(v_profit_usd, 0);
  v_profit_etb := COALESCE(v_profit_etb, 0);

  -- Add profit to balance
  IF v_profit_usd > 0 OR v_profit_etb > 0 THEN
    UPDATE public.balances
    SET usd_balance = usd_balance + v_profit_usd,
        etb_balance = etb_balance + v_profit_etb,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- Mark profit as claimed
  UPDATE public.daily_profit
  SET can_claim = FALSE,
      amount_usd = 0,
      amount_etb = 0,
      last_claimed = NOW()
  WHERE user_id = p_user_id;

  RETURN json_build_object('ok', true, 'claimed', true, 'profit_usd', v_profit_usd, 'profit_etb', v_profit_etb);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- Admin Dashboard Functions
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_get_dashboard_stats() CASCADE;
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
    'active_investments', (SELECT COUNT(*) FROM public.user_investments WHERE status = 'active')
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

DROP FUNCTION IF EXISTS public.admin_list_pending_deposits() CASCADE;
CREATE OR REPLACE FUNCTION public.admin_list_pending_deposits()
RETURNS SETOF public.deposits
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.deposits WHERE status = 'pending';
$$;

DROP FUNCTION IF EXISTS public.admin_list_withdrawals() CASCADE;
CREATE OR REPLACE FUNCTION public.admin_list_withdrawals()
RETURNS SETOF public.withdrawals
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.withdrawals;
$$;

DROP FUNCTION IF EXISTS public.admin_list_users() CASCADE;
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id UUID, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, email, created_at FROM auth.users;
$$;

DROP FUNCTION IF EXISTS public.admin_delete_user(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user_id';
  END IF;

  DELETE FROM public.profiles WHERE id = p_user_id;
  RETURN json_build_object('ok', true, 'user_id', p_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- STEP 6: TRIGGER FUNCTIONS
-- ============================================================================

-- ============================================================================
-- handle_new_user()
-- Trigger function: creates profiles, balances, daily_profit records for new users
-- ============================================================================
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW());

  INSERT INTO public.balances (user_id, etb_balance, usd_balance)
  VALUES (NEW.id, 0, 0);

  INSERT INTO public.daily_profit (user_id, amount_usd, amount_etb, can_claim, last_calculated)
  VALUES (NEW.id, 0, 0, FALSE, NOW());

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Trigger on auth.users for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 7: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_withdrawal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_user_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_daily_profit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_profit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_deposits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_withdrawals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- ============================================================================
-- STEP 8: SCHEMA REFRESH
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- COMPLETE: All tables, policies, functions, and triggers are now in place
-- ============================================================================
