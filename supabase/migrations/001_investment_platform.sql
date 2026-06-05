-- ================================================================
-- SECTION 1: EXTENSIONS & SESSION CONFIG
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SET client_min_messages TO WARNING;

-- ================================================================
-- SECTION 2: DROP EXISTING OBJECTS (Clean Slate)
-- ================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.approve_deposit(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.reject_deposit(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.approve_withdrawal(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.reject_withdrawal(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.distribute_daily_profit(NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.admin_get_dashboard_stats() CASCADE;
DROP FUNCTION IF EXISTS public.admin_delete_user(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP VIEW IF EXISTS public.my_balance CASCADE;
DROP VIEW IF EXISTS public.my_history CASCADE;
DROP TABLE IF EXISTS public.support_tickets CASCADE;
DROP TABLE IF EXISTS public.daily_profits CASCADE;
DROP TABLE IF EXISTS public.investments CASCADE;
DROP TABLE IF EXISTS public.investment_plans CASCADE;
DROP TABLE IF EXISTS public.history CASCADE;
DROP TABLE IF EXISTS public.withdrawals CASCADE;
DROP TABLE IF EXISTS public.deposits CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;
DROP TABLE IF EXISTS public.balances CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ================================================================
-- SECTION 3: TABLE: public.profiles
-- ================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  referral_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text || clock_timestamp()::text),1,10),
  referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- SECTION 4: TABLE: public.balances
-- ================================================================

CREATE TABLE IF NOT EXISTS public.balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

-- ================================================================
-- SECTION 5: TABLE: public.payment_methods
-- ================================================================

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.payment_methods (
  method_type, currency, label, account_name, account_number, network, wallet_address, is_active, display_order
) VALUES
  ('telebirr_merchant', 'ETB', 'Telebirr Merchant', 'Amsale Aneley', '900675', NULL, NULL, true, 1),
  ('telebirr_personal', 'ETB', 'Telebirr Personal', 'Yohanis', '0993855459', NULL, NULL, true, 2),
  ('usdt_trc20', 'USD', 'USDT TRC20', NULL, NULL, 'TRC20', 'TQjEAMhuezFdqKww9o5NWFBJhNKTgTpLMU', true, 3)
ON CONFLICT (method_type, currency, label) DO NOTHING;

-- ================================================================
-- SECTION 6: TABLE: public.deposits
-- ================================================================

CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ================================================================
-- SECTION 7: TABLE: public.withdrawals
-- ================================================================

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ================================================================
-- SECTION 8: TABLE: public.investment_plans
-- ================================================================

CREATE TABLE IF NOT EXISTS public.investment_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_am TEXT,
  min_amount_etb NUMERIC(18,2) NOT NULL,
  min_amount_usd NUMERIC(18,6) NOT NULL DEFAULT 0,
  max_amount_etb NUMERIC(18,2),
  daily_profit_pct NUMERIC(5,2) NOT NULL,
  duration_days INT NOT NULL,
  total_return_pct NUMERIC(5,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ETB' CHECK (currency IN ('ETB','USD','BOTH')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.investment_plans (
  name, name_am, min_amount_etb, min_amount_usd, max_amount_etb, daily_profit_pct, duration_days, total_return_pct, currency, display_order
) VALUES
  ('Starter', 'Starter', 500, 0, 4999, 2.0, 30, 60.0, 'ETB', 1),
  ('Basic', 'Basic', 5000, 0, 19999, 2.5, 45, 112.5, 'ETB', 2),
  ('Standard', 'Standard', 20000, 0, 49999, 3.0, 60, 180.0, 'ETB', 3),
  ('Premium', 'Premium', 50000, 0, 99999, 3.5, 90, 315.0, 'ETB', 4),
  ('VIP', 'VIP', 100000, 0, NULL, 4.0, 120, 480.0, 'ETB', 5),
  ('USD Starter', 'USD Starter', 0, 1.0, NULL, 2.0, 30, 60.0, 'USD', 6)
ON CONFLICT (name) DO NOTHING;

-- ================================================================
-- SECTION 9: TABLE: public.investments
-- ================================================================

CREATE TABLE IF NOT EXISTS public.investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ================================================================
-- SECTION 10: TABLE: public.history
-- ================================================================

CREATE TABLE IF NOT EXISTS public.history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'deposit','withdrawal','bonus','welcome_bonus',
    'daily_profit','invite_bonus','investment','investment_claim','adjustment'
  )),
  amount_etb NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_usd NUMERIC(18,6) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ETB',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  reference_id UUID,
  reference_type TEXT CHECK (reference_type IN ('deposit','withdrawal','investment','bonus')),
  note TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- SECTION 11: TABLE: public.daily_profits
-- ================================================================

CREATE TABLE IF NOT EXISTS public.daily_profits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  investment_id UUID REFERENCES public.investments(id) ON DELETE SET NULL,
  amount_etb NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_usd NUMERIC(18,6) NOT NULL DEFAULT 0,
  profit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, profit_date)
);

-- ================================================================
-- SECTION 12: TABLE: public.support_tickets
-- ================================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- SECTION 13: INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_balances_user_id ON public.balances(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_user_status ON public.deposits(user_id, status);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON public.deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON public.deposits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON public.withdrawals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_history_user_type ON public.history(user_id, type);
CREATE INDEX IF NOT EXISTS idx_history_user_created_at ON public.history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_reference_id ON public.history(reference_id);
CREATE INDEX IF NOT EXISTS idx_history_status ON public.history(status);
CREATE INDEX IF NOT EXISTS idx_investments_user_status ON public.investments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_investments_plan_id ON public.investments(plan_id);
CREATE INDEX IF NOT EXISTS idx_investments_end_date ON public.investments(end_date);
CREATE INDEX IF NOT EXISTS idx_daily_profits_user_date ON public.daily_profits(user_id, profit_date);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status ON public.support_tickets(user_id, status);

-- ================================================================
-- SECTION 14: ENABLE RLS ON ALL TABLES
-- ================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_profits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- SECTION 15: HELPER FUNCTION: is_admin()
-- ================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- ================================================================
-- SECTION 16: RLS POLICIES
-- ================================================================

DO $$
DECLARE
  policy RECORD;
BEGIN
  FOR policy IN
    SELECT policyname, schemaname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy.policyname, policy.tablename);
  END LOOP;
END
$$;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());
CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE USING (public.is_admin());

CREATE POLICY balances_select ON public.balances
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY balances_insert ON public.balances
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY balances_update ON public.balances
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY deposits_select ON public.deposits
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY deposits_insert ON public.deposits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY deposits_update ON public.deposits
  FOR UPDATE USING (public.is_admin());

CREATE POLICY withdrawals_select ON public.withdrawals
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY withdrawals_insert ON public.withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY withdrawals_update ON public.withdrawals
  FOR UPDATE USING (public.is_admin());

CREATE POLICY history_select ON public.history
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY history_insert ON public.history
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY investment_plans_select ON public.investment_plans
  FOR SELECT USING (true);
CREATE POLICY investment_plans_insert ON public.investment_plans
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY investment_plans_update ON public.investment_plans
  FOR UPDATE USING (public.is_admin());
CREATE POLICY investment_plans_delete ON public.investment_plans
  FOR DELETE USING (public.is_admin());

CREATE POLICY investments_select ON public.investments
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY investments_insert ON public.investments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY investments_update ON public.investments
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY daily_profits_select ON public.daily_profits
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY payment_methods_select ON public.payment_methods
  FOR SELECT USING (true);
CREATE POLICY payment_methods_insert ON public.payment_methods
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY payment_methods_update ON public.payment_methods
  FOR UPDATE USING (public.is_admin());

CREATE POLICY support_tickets_select ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY support_tickets_insert ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY support_tickets_update ON public.support_tickets
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

-- ================================================================
-- SECTION 17: TRIGGER FUNCTION: handle_new_user()
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_referral_code TEXT;
  v_referrer_id UUID;
  c_welcome_etb CONSTANT NUMERIC := 150.00;
  c_welcome_usd CONSTANT NUMERIC := 1.7;
  c_invite_etb CONSTANT NUMERIC := 50.00;
  c_invite_usd CONSTANT NUMERIC := 0.58;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_referral_code := NEW.raw_user_meta_data->>'referral_code';

  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (NEW.id, NEW.email, v_full_name, NOW())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.balances (user_id, etb_balance, usd_balance, updated_at)
  VALUES (NEW.id, c_welcome_etb, c_welcome_usd, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.history (user_id, type, amount_etb, amount_usd, currency, status, reference_type, note, metadata)
  VALUES (
    NEW.id,
    'welcome_bonus',
    c_welcome_etb,
    c_welcome_usd,
    'ETB',
    'success',
    'bonus',
    'Welcome bonus: 150 ETB + 1.7 USD',
    jsonb_build_object('type', 'signup')
  );

  IF v_referral_code IS NOT NULL AND v_referral_code <> '' THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = v_referral_code
      AND id <> NEW.id
    LIMIT 1;

    IF v_referrer_id IS NOT NULL THEN
      UPDATE public.profiles
      SET referred_by = v_referrer_id
      WHERE id = NEW.id;

      UPDATE public.balances
      SET etb_balance = etb_balance + c_invite_etb,
          usd_balance = usd_balance + c_invite_usd,
          referral_bonus_etb = referral_bonus_etb + c_invite_etb,
          updated_at = NOW()
      WHERE user_id = v_referrer_id;

      INSERT INTO public.history (user_id, type, amount_etb, amount_usd, currency, status, reference_type, note, metadata)
      VALUES (
        v_referrer_id,
        'invite_bonus',
        c_invite_etb,
        c_invite_usd,
        'ETB',
        'success',
        'bonus',
        'Referral bonus for invited user: ' || NEW.email,
        jsonb_build_object('referee_id', NEW.id, 'referrer_id', v_referrer_id)
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- SECTION 18: FUNCTION: approve_deposit(p_deposit_id UUID) RETURNS JSONB
-- ================================================================

CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep public.deposits%ROWTYPE;
  v_balance public.balances%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  BEGIN
    PERFORM 1;
  END;

  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'deposit_not_found');
  END IF;

  IF v_dep.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'deposit_not_pending');
  END IF;

  SELECT * INTO v_balance FROM public.balances WHERE user_id = v_dep.user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.balances (user_id, etb_balance, usd_balance, updated_at)
    VALUES (v_dep.user_id, 0, 0, NOW());
    SELECT * INTO v_balance FROM public.balances WHERE user_id = v_dep.user_id;
  END IF;

  IF v_dep.currency = 'ETB' THEN
    UPDATE public.balances
    SET etb_balance = etb_balance + v_dep.amount_etb,
        total_deposited_etb = total_deposited_etb + v_dep.amount_etb,
        updated_at = NOW()
    WHERE user_id = v_dep.user_id;
  ELSE
    UPDATE public.balances
    SET usd_balance = usd_balance + v_dep.amount_usd,
        updated_at = NOW()
    WHERE user_id = v_dep.user_id;
  END IF;

  UPDATE public.deposits
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = p_deposit_id;

  UPDATE public.history
  SET status = 'success', note = COALESCE(note, 'Deposit approved'), metadata = metadata || jsonb_build_object('approved_by', auth.uid()),
      created_at = created_at
  WHERE reference_id = p_deposit_id AND reference_type = 'deposit';

  IF NOT FOUND THEN
    INSERT INTO public.history (user_id, type, amount_etb, amount_usd, currency, status, reference_id, reference_type, note, metadata)
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
      jsonb_build_object('approved_by', auth.uid())
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_dep.user_id,
    'amount_etb', v_dep.amount_etb,
    'amount_usd', v_dep.amount_usd,
    'currency', v_dep.currency
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ================================================================
-- SECTION 19: FUNCTION: reject_deposit(p_deposit_id UUID, p_note TEXT DEFAULT 'Rejected by admin') RETURNS JSONB
-- ================================================================

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
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'deposit_not_found');
  END IF;

  IF v_dep.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'deposit_not_pending');
  END IF;

  UPDATE public.deposits
  SET status = 'rejected', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = p_deposit_id;

  UPDATE public.history
  SET status = 'failed', note = COALESCE(p_note, note), metadata = metadata || jsonb_build_object('rejected_by', auth.uid())
  WHERE reference_id = p_deposit_id AND reference_type = 'deposit';

  RETURN jsonb_build_object('ok', true, 'deposit_id', p_deposit_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ================================================================
-- SECTION 20: FUNCTION: approve_withdrawal(p_withdrawal_id UUID) RETURNS JSONB
-- ================================================================

CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w public.withdrawals%ROWTYPE;
  v_bal public.balances%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'withdrawal_not_found');
  END IF;

  IF v_w.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'withdrawal_not_pending');
  END IF;

  SELECT * INTO v_bal FROM public.balances WHERE user_id = v_w.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'balance_not_found');
  END IF;

  IF v_w.currency = 'ETB' THEN
    IF v_bal.etb_balance < v_w.amount_etb THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Insufficient ETB', 'available', v_bal.etb_balance, 'requested', v_w.amount_etb);
    END IF;
    UPDATE public.balances
    SET etb_balance = etb_balance - v_w.amount_etb,
        total_withdrawn_etb = total_withdrawn_etb + v_w.amount_etb,
        updated_at = NOW()
    WHERE user_id = v_w.user_id;
  ELSE
    IF v_bal.usd_balance < v_w.amount_usd THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Insufficient USD', 'available', v_bal.usd_balance, 'requested', v_w.amount_usd);
    END IF;
    UPDATE public.balances
    SET usd_balance = usd_balance - v_w.amount_usd,
        updated_at = NOW()
    WHERE user_id = v_w.user_id;
  END IF;

  UPDATE public.withdrawals
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = p_withdrawal_id;

  UPDATE public.history
  SET status = 'success', note = COALESCE(note, 'Withdrawal approved'), metadata = metadata || jsonb_build_object('approved_by', auth.uid())
  WHERE reference_id = p_withdrawal_id AND reference_type = 'withdrawal';

  IF NOT FOUND THEN
    INSERT INTO public.history (user_id, type, amount_etb, amount_usd, currency, status, reference_id, reference_type, note, metadata)
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
      jsonb_build_object('approved_by', auth.uid())
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_w.user_id,
    'amount_etb', v_w.amount_etb,
    'amount_usd', v_w.amount_usd,
    'currency', v_w.currency
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ================================================================
-- SECTION 21: FUNCTION: reject_withdrawal + distribute_daily_profit + admin_get_dashboard_stats + admin_delete_user
-- ================================================================

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
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'withdrawal_not_found');
  END IF;

  IF v_w.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'withdrawal_not_pending');
  END IF;

  UPDATE public.withdrawals
  SET status = 'rejected', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = p_withdrawal_id;

  UPDATE public.history
  SET status = 'failed', note = COALESCE(p_note, note), metadata = metadata || jsonb_build_object('rejected_by', auth.uid())
  WHERE reference_id = p_withdrawal_id AND reference_type = 'withdrawal';

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', p_withdrawal_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
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
  v_profit_etb NUMERIC;
  v_profit_usd NUMERIC;
  v_count INT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  FOR v_rec IN
    SELECT user_id, etb_balance, usd_balance
    FROM public.balances
    WHERE etb_balance > 0 OR usd_balance > 0
  LOOP
    v_profit_etb := ROUND(v_rec.etb_balance * p_rate_percent / 100.0, 2);
    v_profit_usd := ROUND(v_rec.usd_balance * p_rate_percent / 100.0, 6);

    BEGIN
      INSERT INTO public.daily_profits (user_id, amount_etb, amount_usd, profit_date)
      VALUES (v_rec.user_id, v_profit_etb, v_profit_usd, CURRENT_DATE);

      UPDATE public.balances
      SET etb_balance = etb_balance + v_profit_etb,
          usd_balance = usd_balance + v_profit_usd,
          total_profit_earned_etb = total_profit_earned_etb + v_profit_etb,
          updated_at = NOW()
      WHERE user_id = v_rec.user_id;

      INSERT INTO public.history (user_id, type, amount_etb, amount_usd, currency, status, reference_type, note, metadata)
      VALUES (
        v_rec.user_id,
        'daily_profit',
        v_profit_etb,
        v_profit_usd,
        'ETB',
        'success',
        'investment',
        'Daily profit distributed',
        jsonb_build_object('rate_percent', p_rate_percent, 'profit_date', CURRENT_DATE)
      );

      v_count := v_count + 1;
    EXCEPTION WHEN unique_violation THEN
      -- Already distributed for today, skip
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'credited_users', v_count, 'rate_percent', p_rate_percent);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
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
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  RETURN jsonb_build_object(
    'users', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM auth.users),
      'active', (SELECT COUNT(*) FROM public.profiles WHERE is_active),
      'verified', (SELECT COUNT(*) FROM public.profiles WHERE is_verified),
      'new_today', (SELECT COUNT(*) FROM public.profiles WHERE created_at::date = v_today),
      'new_this_week', (SELECT COUNT(*) FROM public.profiles WHERE created_at::date >= v_week_start)
    ),
    'deposits', jsonb_build_object(
      'pending_count', (SELECT COUNT(*) FROM public.deposits WHERE status = 'pending'),
      'pending_etb', (SELECT COALESCE(SUM(amount_etb),0) FROM public.deposits WHERE status = 'pending' AND currency = 'ETB'),
      'approved_count', (SELECT COUNT(*) FROM public.deposits WHERE status = 'approved'),
      'approved_etb', (SELECT COALESCE(SUM(amount_etb),0) FROM public.deposits WHERE status = 'approved' AND currency = 'ETB'),
      'rejected_count', (SELECT COUNT(*) FROM public.deposits WHERE status = 'rejected'),
      'today_count', (SELECT COUNT(*) FROM public.deposits WHERE created_at::date = v_today)
    ),
    'withdrawals', jsonb_build_object(
      'pending_count', (SELECT COUNT(*) FROM public.withdrawals WHERE status = 'pending'),
      'pending_etb', (SELECT COALESCE(SUM(amount_etb),0) FROM public.withdrawals WHERE status = 'pending' AND currency = 'ETB'),
      'approved_count', (SELECT COUNT(*) FROM public.withdrawals WHERE status = 'approved'),
      'approved_etb', (SELECT COALESCE(SUM(amount_etb),0) FROM public.withdrawals WHERE status = 'approved' AND currency = 'ETB'),
      'rejected_count', (SELECT COUNT(*) FROM public.withdrawals WHERE status = 'rejected')
    ),
    'investments', jsonb_build_object(
      'active_count', (SELECT COUNT(*) FROM public.investments WHERE status = 'active'),
      'total_invested_etb', (SELECT COALESCE(SUM(amount_etb),0) FROM public.investments WHERE status = 'active' AND currency = 'ETB'),
      'completed_count', (SELECT COUNT(*) FROM public.investments WHERE status = 'completed')
    ),
    'balances', jsonb_build_object(
      'total_etb_in_system', (SELECT COALESCE(SUM(etb_balance),0) FROM public.balances),
      'total_usd_in_system', (SELECT COALESCE(SUM(usd_balance),0) FROM public.balances),
      'total_active_investment_etb', (SELECT COALESCE(SUM(active_investment_etb),0) FROM public.balances)
    ),
    'history', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.history),
      'success_count', (SELECT COUNT(*) FROM public.history WHERE status = 'success'),
      'pending_count', (SELECT COUNT(*) FROM public.history WHERE status = 'pending'),
      'failed_count', (SELECT COUNT(*) FROM public.history WHERE status = 'failed')
    ),
    'support', jsonb_build_object(
      'open_tickets', (SELECT COUNT(*) FROM public.support_tickets WHERE status = 'open'),
      'urgent_tickets', (SELECT COUNT(*) FROM public.support_tickets WHERE priority = 'urgent' AND status IN ('open','in_progress'))
    ),
    'generated_at', NOW()
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
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
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  DELETE FROM public.profiles WHERE id = p_user_id;
  RETURN jsonb_build_object('ok', true, 'deleted_user_id', p_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- ================================================================
-- SECTION 22: VIEWS, GRANTS & VERIFICATION
-- ================================================================

CREATE OR REPLACE VIEW public.my_balance
WITH (security_invoker = true)
AS
  SELECT * FROM public.balances WHERE user_id = auth.uid();

CREATE OR REPLACE VIEW public.my_history
WITH (security_invoker = true)
AS
  SELECT * FROM public.history WHERE user_id = auth.uid() ORDER BY created_at DESC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_deposit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.distribute_daily_profit(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
GRANT SELECT ON public.my_balance TO authenticated;
GRANT SELECT ON public.my_history TO authenticated;

-- Verification queries
SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.tablename) AS policy_count
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'profiles','balances','deposits','withdrawals',
    'history','investment_plans','investments',
    'daily_profits','payment_methods','support_tickets'
  )
ORDER BY t.tablename;

SELECT '✅ Investment Platform DB — Build Complete' AS status, NOW() AS completed_at;
