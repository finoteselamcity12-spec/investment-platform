-- ================================================================
-- 016_complete_rebuild.sql
-- Full Supabase rebuild script for public schema
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
SET client_min_messages TO WARNING;

-- ================================================================
-- Tables
-- ================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  referral_code TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  etb_balance NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (etb_balance >= 0),
  usd_balance NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (usd_balance >= 0),
  active_investment_etb NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (active_investment_etb >= 0),
  active_investment_usd NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (active_investment_usd >= 0),
  total_deposited_etb NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_withdrawn_etb NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_profit_earned_etb NUMERIC(18,2) NOT NULL DEFAULT 0,
  referral_bonus_etb NUMERIC(18,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_type TEXT NOT NULL CHECK (method_type IN ('telebirr_merchant','telebirr_personal','usdt_trc20','cbe','mpesa','bank')),
  currency TEXT NOT NULL CHECK (currency IN ('ETB','USD')),
  label TEXT NOT NULL,
  account_name TEXT,
  account_number TEXT,
  network TEXT,
  wallet_address TEXT,
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (method_type, currency, label)
);

CREATE TABLE IF NOT EXISTS public.investment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_am TEXT,
  min_amount_etb NUMERIC(18,2) NOT NULL DEFAULT 0,
  min_amount_usd NUMERIC(18,6) NOT NULL DEFAULT 0,
  max_amount_etb NUMERIC(18,2),
  max_amount_usd NUMERIC(18,6),
  daily_profit_pct NUMERIC(5,2) NOT NULL,
  duration_days INT NOT NULL,
  total_return_pct NUMERIC(5,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ETB' CHECK (currency IN ('ETB','USD','BOTH')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES public.payment_methods(id),
  amount_etb NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (amount_etb >= 0),
  amount_usd NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (amount_usd >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('ETB','USD')),
  transaction_id TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (currency = 'ETB' AND amount_etb > 0 AND amount_usd = 0)
    OR (currency = 'USD' AND amount_usd > 0 AND amount_etb = 0)
  )
);

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_etb NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (amount_etb >= 0),
  amount_usd NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (amount_usd >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('ETB','USD')),
  method TEXT NOT NULL CHECK (method IN ('telebirr','cbe','bank_transfer','mpesa','usdt_trc20')),
  account_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (currency = 'ETB' AND amount_etb > 0 AND amount_usd = 0)
    OR (currency = 'USD' AND amount_usd > 0 AND amount_etb = 0)
  )
);

CREATE TABLE IF NOT EXISTS public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'deposit','withdrawal','bonus','welcome_bonus',
    'daily_profit','invite_bonus','investment','investment_claim','adjustment'
  )),
  amount_etb NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_usd NUMERIC(18,6) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ETB' CHECK (currency IN ('ETB','USD','MIXED')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  reference_id UUID,
  reference_type TEXT CHECK (reference_type IN ('deposit','withdrawal','investment','bonus')),
  note TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.investment_plans(id),
  amount_etb NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_usd NUMERIC(18,6) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL CHECK (currency IN ('ETB','USD')),
  daily_profit_pct NUMERIC(5,2) NOT NULL,
  duration_days INT NOT NULL,
  total_profit_etb NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_profit_usd NUMERIC(18,6) NOT NULL DEFAULT 0,
  earned_profit_etb NUMERIC(18,2) NOT NULL DEFAULT 0,
  earned_profit_usd NUMERIC(18,6) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (currency = 'ETB' AND amount_etb > 0 AND amount_usd = 0)
    OR (currency = 'USD' AND amount_usd > 0 AND amount_etb = 0)
  )
);

CREATE TABLE IF NOT EXISTS public.daily_profits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  investment_id UUID REFERENCES public.investments(id) ON DELETE SET NULL,
  amount_etb NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_usd NUMERIC(18,6) NOT NULL DEFAULT 0,
  profit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, profit_date)
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general','deposit','withdrawal','investment','technical','other')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  admin_reply TEXT,
  replied_by UUID REFERENCES public.profiles(id),
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- Functions
-- ================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NULLIF(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.balances (user_id, etb_balance, usd_balance, updated_at)
  VALUES (NEW.id, 0, 0, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep public.deposits%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'deposit_not_found');
  END IF;

  IF v_dep.status = 'approved' THEN
    RETURN jsonb_build_object('ok', true, 'already_approved', true);
  END IF;

  UPDATE public.deposits
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = p_deposit_id;

  INSERT INTO public.history (
    user_id, type, amount_etb, amount_usd, currency, status,
    reference_id, reference_type, note, metadata, created_at
  )
  VALUES (
    v_dep.user_id,
    'deposit',
    v_dep.amount_etb,
    v_dep.amount_usd,
    v_dep.currency,
    'success',
    v_dep.id,
    'deposit',
    'Deposit approved',
    jsonb_build_object('approved_by', auth.uid()),
    NOW()
  );

  RETURN jsonb_build_object('ok', true, 'deposit_id', p_deposit_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_deposit(p_deposit_id UUID, p_note TEXT DEFAULT 'Rejected by admin')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep public.deposits%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'deposit_not_found');
  END IF;

  UPDATE public.deposits
  SET status = 'rejected', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = p_deposit_id;

  INSERT INTO public.history (
    user_id, type, amount_etb, amount_usd, currency, status,
    reference_id, reference_type, note, metadata, created_at
  )
  VALUES (
    v_dep.user_id,
    'deposit',
    v_dep.amount_etb,
    v_dep.amount_usd,
    v_dep.currency,
    'failed',
    v_dep.id,
    'deposit',
    COALESCE(p_note, 'Deposit rejected'),
    jsonb_build_object('rejected_by', auth.uid()),
    NOW()
  );

  RETURN jsonb_build_object('ok', true, 'deposit_id', p_deposit_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w public.withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'withdrawal_not_found');
  END IF;

  IF v_w.status = 'approved' THEN
    RETURN jsonb_build_object('ok', true, 'already_approved', true);
  END IF;

  UPDATE public.withdrawals
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = p_withdrawal_id;

  INSERT INTO public.history (
    user_id, type, amount_etb, amount_usd, currency, status,
    reference_id, reference_type, note, metadata, created_at
  )
  VALUES (
    v_w.user_id,
    'withdrawal',
    v_w.amount_etb,
    v_w.amount_usd,
    v_w.currency,
    'success',
    v_w.id,
    'withdrawal',
    'Withdrawal approved',
    jsonb_build_object('approved_by', auth.uid()),
    NOW()
  );

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', p_withdrawal_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(p_withdrawal_id UUID, p_note TEXT DEFAULT 'Rejected by admin')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w public.withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'withdrawal_not_found');
  END IF;

  UPDATE public.withdrawals
  SET status = 'rejected', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = p_withdrawal_id;

  INSERT INTO public.history (
    user_id, type, amount_etb, amount_usd, currency, status,
    reference_id, reference_type, note, metadata, created_at
  )
  VALUES (
    v_w.user_id,
    'withdrawal',
    v_w.amount_etb,
    v_w.amount_usd,
    v_w.currency,
    'failed',
    v_w.id,
    'withdrawal',
    COALESCE(p_note, 'Withdrawal rejected'),
    jsonb_build_object('rejected_by', auth.uid()),
    NOW()
  );

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', p_withdrawal_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.distribute_daily_profit(p_rate_percent NUMERIC DEFAULT 2.0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_profit_etb NUMERIC(18,2);
  v_profit_usd NUMERIC(18,6);
  v_count INT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  FOR v_rec IN
    SELECT id AS investment_id, user_id, amount_etb, amount_usd, currency
    FROM public.investments
    WHERE status = 'active'
  LOOP
    v_profit_etb := ROUND(v_rec.amount_etb * p_rate_percent / 100.0, 2);
    v_profit_usd := ROUND(v_rec.amount_usd * p_rate_percent / 100.0, 6);

    INSERT INTO public.daily_profits (
      user_id, investment_id, amount_etb, amount_usd, profit_date, created_at
    )
    VALUES (
      v_rec.user_id,
      v_rec.investment_id,
      v_profit_etb,
      v_profit_usd,
      CURRENT_DATE,
      NOW()
    )
    ON CONFLICT (user_id, profit_date) DO NOTHING;

    INSERT INTO public.history (
      user_id, type, amount_etb, amount_usd, currency, status,
      reference_id, reference_type, note, metadata, created_at
    )
    VALUES (
      v_rec.user_id,
      'daily_profit',
      v_profit_etb,
      v_profit_usd,
      v_rec.currency,
      'success',
      v_rec.investment_id,
      'investment',
      'Daily profit distributed',
      jsonb_build_object('rate_percent', p_rate_percent, 'profit_date', CURRENT_DATE),
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'credited_users', v_count, 'rate_percent', p_rate_percent);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_week_start DATE := date_trunc('week', CURRENT_DATE)::DATE;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  RETURN jsonb_build_object(
    'users', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM auth.users),
      'active', (SELECT COUNT(*) FROM public.profiles WHERE is_active),
      'verified', (SELECT COUNT(*) FROM public.profiles WHERE role = 'user'),
      'new_today', (SELECT COUNT(*) FROM public.profiles WHERE created_at::date = v_today),
      'new_this_week', (SELECT COUNT(*) FROM public.profiles WHERE created_at::date >= v_week_start)
    ),
    'deposits', jsonb_build_object(
      'pending_count', (SELECT COUNT(*) FROM public.deposits WHERE status = 'pending'),
      'approved_count', (SELECT COUNT(*) FROM public.deposits WHERE status = 'approved'),
      'rejected_count', (SELECT COUNT(*) FROM public.deposits WHERE status = 'rejected')
    ),
    'withdrawals', jsonb_build_object(
      'pending_count', (SELECT COUNT(*) FROM public.withdrawals WHERE status = 'pending'),
      'approved_count', (SELECT COUNT(*) FROM public.withdrawals WHERE status = 'approved'),
      'rejected_count', (SELECT COUNT(*) FROM public.withdrawals WHERE status = 'rejected')
    ),
    'investments', jsonb_build_object(
      'active_count', (SELECT COUNT(*) FROM public.investments WHERE status = 'active'),
      'completed_count', (SELECT COUNT(*) FROM public.investments WHERE status = 'completed')
    ),
    'balances', jsonb_build_object(
      'total_etb', (SELECT COALESCE(SUM(etb_balance),0) FROM public.balances),
      'total_usd', (SELECT COALESCE(SUM(usd_balance),0) FROM public.balances)
    ),
    'generated_at', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  DELETE FROM public.profiles WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'deleted_user_id', p_user_id);
END;
$$;

-- ================================================================
-- Trigger
-- ================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
