-- =============================================================================
-- 005_admin_dashboard_backend.sql — FULL ADMIN BACKEND (run entire file in SQL Editor)
-- All admin RPCs use SECURITY DEFINER + is_admin() gate
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Core tables (safe if already exist from 001)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  referred_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  etb_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  usd_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'USDT', 'ETB')),
  amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
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
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'USDT', 'ETB')),
  amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending',
  bank TEXT,
  account_name TEXT,
  account_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If withdrawals existed before 005, CREATE TABLE skips — add columns explicitly
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS bank TEXT,
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.deposits
SET status = 'approved'
WHERE status IS NULL OR status NOT IN ('pending', 'approved', 'rejected');

UPDATE public.withdrawals
SET status = 'pending'
WHERE status IS NULL OR status NOT IN ('pending', 'approved', 'rejected');

ALTER TABLE public.deposits DROP CONSTRAINT IF EXISTS deposits_status_check;
ALTER TABLE public.deposits
  ADD CONSTRAINT deposits_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS withdrawals_status_check;
ALTER TABLE public.withdrawals
  ADD CONSTRAINT withdrawals_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Referral trigger on deposit approval (only if bonus function exists)
DO $migrate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'handle_referral_bonus'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    DROP TRIGGER IF EXISTS on_deposit_referral_bonus_update ON public.deposits;
    CREATE TRIGGER on_deposit_referral_bonus_update
      AFTER UPDATE OF status ON public.deposits
      FOR EACH ROW
      WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')
      EXECUTE FUNCTION public.handle_referral_bonus();
  END IF;
END;
$migrate$;

-- ---------------------------------------------------------------------------
-- is_admin() — SECURITY DEFINER
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT lower(trim(email)) = lower('workinehabche@gmail.com')
      FROM auth.users
      WHERE id = auth.uid()
    ),
    lower(trim(COALESCE(auth.jwt() ->> 'email', ''))) = lower('workinehabche@gmail.com'),
    FALSE
  );
$$;

-- ---------------------------------------------------------------------------
-- admin_get_dashboard_stats() — SECURITY DEFINER
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin: Sign in as workinehabche@gmail.com via /admin-login';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*)::INTEGER FROM public.profiles),
    'pending_deposits', (SELECT COUNT(*)::INTEGER FROM public.deposits WHERE status = 'pending'),
    'pending_withdrawals', (SELECT COUNT(*)::INTEGER FROM public.withdrawals WHERE status = 'pending'),
    'approved_deposits', (SELECT COUNT(*)::INTEGER FROM public.deposits WHERE status = 'approved'),
    'daily_transactions', (
      SELECT COUNT(*)::INTEGER FROM (
        SELECT id FROM public.deposits
        WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
        UNION ALL
        SELECT id FROM public.withdrawals
        WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
      ) t
    ),
    'total_deposits', (SELECT COUNT(*)::INTEGER FROM public.deposits),
    'total_withdrawals', (SELECT COUNT(*)::INTEGER FROM public.withdrawals)
  ) INTO result;

  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_list_pending_deposits() — SECURITY DEFINER
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_pending_deposits()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  user_full_name TEXT,
  currency TEXT,
  amount NUMERIC,
  payment_method TEXT,
  transaction_id TEXT,
  proof_url TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.user_id,
    p.email,
    p.full_name,
    d.currency,
    d.amount,
    d.payment_method,
    d.transaction_id,
    d.proof_url,
    d.status,
    d.created_at
  FROM public.deposits d
  JOIN public.profiles p ON p.id = d.user_id
  WHERE d.status = 'pending'
  ORDER BY d.created_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_list_withdrawals() — SECURITY DEFINER (pending by default)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_withdrawals()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  user_full_name TEXT,
  currency TEXT,
  amount NUMERIC,
  bank TEXT,
  account_name TEXT,
  account_number TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.user_id,
    p.email,
    p.full_name,
    w.currency,
    w.amount,
    w.bank,
    w.account_name,
    w.account_number,
    w.status,
    w.created_at
  FROM public.withdrawals w
  JOIN public.profiles p ON p.id = w.user_id
  WHERE w.status = 'pending'
  ORDER BY w.created_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_list_users() — SECURITY DEFINER
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  etb_balance NUMERIC,
  usd_balance NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    COALESCE(b.etb_balance, 0),
    COALESCE(b.usd_balance, 0),
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.balances b ON b.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_approve_deposit(deposit_id) — SECURITY DEFINER
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO dep FROM public.deposits WHERE id = deposit_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found';
  END IF;

  IF dep.status = 'approved' THEN
    RETURN json_build_object('ok', true, 'already_approved', true, 'deposit_id', deposit_id);
  END IF;

  IF dep.status = 'rejected' THEN
    RAISE EXCEPTION 'deposit_already_rejected';
  END IF;

  IF dep.currency IN ('USD', 'USDT') THEN
    UPDATE public.balances
    SET usd_balance = usd_balance + dep.amount, updated_at = NOW()
    WHERE user_id = dep.user_id;
  ELSE
    UPDATE public.balances
    SET etb_balance = etb_balance + dep.amount, updated_at = NOW()
    WHERE user_id = dep.user_id;
  END IF;

  UPDATE public.deposits
  SET status = 'approved', updated_at = NOW()
  WHERE id = deposit_id;

  RETURN json_build_object('ok', true, 'deposit_id', deposit_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_deposit(deposit_id UUID)
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
  WHERE id = deposit_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found_or_not_pending';
  END IF;

  RETURN json_build_object('ok', true, 'deposit_id', deposit_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_deposit_manual(
  p_user_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_payment_method TEXT DEFAULT NULL,
  p_transaction_id TEXT DEFAULT NULL,
  p_proof_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  norm_currency TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  norm_currency := CASE
    WHEN upper(p_currency) IN ('USD', 'USDT') THEN 'USD'
    ELSE 'ETB'
  END;

  INSERT INTO public.deposits (
    user_id, currency, amount, status, payment_method, transaction_id, proof_url
  ) VALUES (
    p_user_id, norm_currency, p_amount, 'pending',
    p_payment_method, p_transaction_id, p_proof_url
  ) RETURNING id INTO new_id;

  RETURN public.admin_approve_deposit(new_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Withdrawals approve / reject — SECURITY DEFINER
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(withdrawal_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO w FROM public.withdrawals WHERE id = withdrawal_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal_not_found';
  END IF;

  IF w.status = 'approved' THEN
    RETURN json_build_object('ok', true, 'already_approved', true);
  END IF;

  UPDATE public.withdrawals
  SET status = 'approved', updated_at = NOW()
  WHERE id = withdrawal_id;

  RETURN json_build_object('ok', true, 'withdrawal_id', withdrawal_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(withdrawal_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO w FROM public.withdrawals WHERE id = withdrawal_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal_not_found';
  END IF;

  IF w.status <> 'pending' THEN
    RAISE EXCEPTION 'withdrawal_not_pending';
  END IF;

  IF w.currency IN ('USD', 'USDT') THEN
    UPDATE public.balances
    SET usd_balance = usd_balance + w.amount, updated_at = NOW()
    WHERE user_id = w.user_id;
  ELSE
    UPDATE public.balances
    SET etb_balance = etb_balance + w.amount, updated_at = NOW()
    WHERE user_id = w.user_id;
  END IF;

  UPDATE public.withdrawals
  SET status = 'rejected', updated_at = NOW()
  WHERE id = withdrawal_id;

  RETURN json_build_object('ok', true, 'withdrawal_id', withdrawal_id, 'refunded', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_delete_user(user_id) — SECURITY DEFINER
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_user(user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user_id';
  END IF;

  DELETE FROM public.withdrawals WHERE user_id = admin_delete_user.user_id;
  DELETE FROM public.deposits WHERE user_id = admin_delete_user.user_id;
  DELETE FROM public.balances WHERE user_id = admin_delete_user.user_id;
  DELETE FROM public.profiles WHERE id = admin_delete_user.user_id;
  DELETE FROM auth.users WHERE id = admin_delete_user.user_id;

  RETURN json_build_object('ok', true, 'user_id', admin_delete_user.user_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own pending deposit" ON public.deposits;
CREATE POLICY "Users insert own pending deposit" ON public.deposits
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Users insert own pending withdrawal" ON public.withdrawals;
CREATE POLICY "Users insert own pending withdrawal" ON public.withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_deposits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_withdrawals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit_manual(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_withdrawal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_withdrawal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
