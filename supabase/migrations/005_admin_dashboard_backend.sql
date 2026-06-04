-- Admin dashboard: RPC stats, deposit approval, balance credit, admin policies
-- Run in Supabase SQL Editor after migrations 001–004

-- ---------------------------------------------------------------------------
-- Extend deposits for pending workflow + proof
-- ---------------------------------------------------------------------------
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.deposits
SET status = 'approved'
WHERE status IS NULL OR status NOT IN ('pending', 'approved', 'rejected');

ALTER TABLE public.deposits DROP CONSTRAINT IF EXISTS deposits_status_check;
ALTER TABLE public.deposits
  ADD CONSTRAINT deposits_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Referral bonus when status changes to approved (not only on INSERT)
DROP TRIGGER IF EXISTS on_deposit_referral_bonus_update ON public.deposits;
CREATE TRIGGER on_deposit_referral_bonus_update
  AFTER UPDATE OF status ON public.deposits
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')
  EXECUTE FUNCTION public.handle_referral_bonus();

-- ---------------------------------------------------------------------------
-- Admin helper (JWT email must match platform admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    lower(trim(auth.jwt() ->> 'email')) = lower('workinehabche@gmail.com'),
    FALSE
  );
$$;

-- ---------------------------------------------------------------------------
-- Dashboard stats (bypasses RLS)
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
    RAISE EXCEPTION 'not_admin: Admin Supabase session required (sign in as workinehabche@gmail.com)';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*)::INTEGER FROM public.profiles),
    'pending_deposits', (SELECT COUNT(*)::INTEGER FROM public.deposits WHERE status = 'pending'),
    'approved_deposits', (SELECT COUNT(*)::INTEGER FROM public.deposits WHERE status = 'approved'),
    'daily_transactions', (
      SELECT COUNT(*)::INTEGER FROM public.deposits
      WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
    ),
    'total_deposits', (SELECT COUNT(*)::INTEGER FROM public.deposits)
  ) INTO result;

  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- List pending deposits with profile email
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
    RAISE EXCEPTION 'not_admin: Admin Supabase session required';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.user_id,
    p.email AS user_email,
    p.full_name AS user_full_name,
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
-- List users + balances
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
    RAISE EXCEPTION 'not_admin: Admin Supabase session required';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.email,
    p.full_name,
    COALESCE(b.etb_balance, 0) AS etb_balance,
    COALESCE(b.usd_balance, 0) AS usd_balance,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.balances b ON b.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- Approve deposit: credit balances + set status (referral on UPDATE trigger)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin: Admin Supabase session required';
  END IF;

  SELECT * INTO dep
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found';
  END IF;

  IF dep.status = 'approved' THEN
    RETURN json_build_object('ok', true, 'already_approved', true, 'deposit_id', p_deposit_id);
  END IF;

  IF dep.status = 'rejected' THEN
    RAISE EXCEPTION 'deposit_already_rejected';
  END IF;

  IF dep.currency IN ('USD', 'USDT') THEN
    UPDATE public.balances
    SET usd_balance = usd_balance + dep.amount,
        updated_at = NOW()
    WHERE user_id = dep.user_id;
  ELSIF dep.currency = 'ETB' THEN
    UPDATE public.balances
    SET etb_balance = etb_balance + dep.amount,
        updated_at = NOW()
    WHERE user_id = dep.user_id;
  END IF;

  UPDATE public.deposits
  SET status = 'approved',
      updated_at = NOW()
  WHERE id = p_deposit_id;

  RETURN json_build_object('ok', true, 'deposit_id', p_deposit_id, 'user_id', dep.user_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Approve by user_id (localStorage deposits without a DB row yet)
-- ---------------------------------------------------------------------------
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
    RAISE EXCEPTION 'not_admin: Admin Supabase session required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  norm_currency := CASE
    WHEN upper(p_currency) IN ('USD', 'USDT') THEN 'USD'
    ELSE 'ETB'
  END;

  INSERT INTO public.deposits (
    user_id, currency, amount, status,
    payment_method, transaction_id, proof_url
  )
  VALUES (
    p_user_id, norm_currency, p_amount, 'pending',
    p_payment_method, p_transaction_id, p_proof_url
  )
  RETURNING id INTO new_id;

  RETURN public.admin_approve_deposit(new_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Reject deposit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reject_deposit(p_deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin: Admin Supabase session required';
  END IF;

  UPDATE public.deposits
  SET status = 'rejected',
      updated_at = NOW()
  WHERE id = p_deposit_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found_or_not_pending';
  END IF;

  RETURN json_build_object('ok', true, 'deposit_id', p_deposit_id);
END;
$$;

-- Users can submit pending deposits (for future Deposit page sync)
DROP POLICY IF EXISTS "Users insert own pending deposit" ON public.deposits;
CREATE POLICY "Users insert own pending deposit" ON public.deposits
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_deposits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit_manual(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_deposit(UUID) TO authenticated;
