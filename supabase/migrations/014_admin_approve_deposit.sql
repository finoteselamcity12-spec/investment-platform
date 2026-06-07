-- =============================================================================
-- 014_admin_approve_deposit.sql
-- Creates admin_approve_deposit RPC (matches frontend: { p_deposit_id })
-- Safe to re-run in Supabase SQL Editor
-- =============================================================================

-- Required by all admin RPCs
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

-- Ensure history table exists (deposit_bonus audit log)
CREATE TABLE IF NOT EXISTS public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  currency TEXT,
  amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_action_check;
ALTER TABLE public.history
  ADD CONSTRAINT history_action_check
  CHECK (action IN ('welcome_bonus', 'signup_bonus', 'deposit_bonus', 'referral_bonus'));

CREATE UNIQUE INDEX IF NOT EXISTS history_deposit_once
  ON public.history (user_id, reference_id)
  WHERE action = 'deposit_bonus' AND reference_id IS NOT NULL;

-- ─── admin_approve_deposit ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep RECORD;
  deposit_amount NUMERIC(18, 4);
  bonus_amt NUMERIC(18, 4);
  norm_currency TEXT;
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
    RETURN json_build_object(
      'ok', true,
      'already_approved', true,
      'p_deposit_id', p_deposit_id
    );
  END IF;

  IF dep.status = 'rejected' THEN
    RAISE EXCEPTION 'deposit_already_rejected';
  END IF;

  norm_currency := CASE WHEN upper(dep.currency) IN ('USD', 'USDT') THEN 'USD' ELSE 'ETB' END;
  deposit_amount := COALESCE(dep.amount, dep.amount_usd, dep.amount_etb, 0);
  bonus_amt := ROUND(deposit_amount * 0.10, 4);

  -- Ensure a balances row exists before crediting
  INSERT INTO public.balances (user_id, etb_balance, usd_balance)
  VALUES (dep.user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF norm_currency = 'USD' THEN
    UPDATE public.balances
    SET usd_balance = usd_balance + deposit_amount, updated_at = NOW()
    WHERE user_id = dep.user_id;
  ELSE
    UPDATE public.balances
    SET etb_balance = etb_balance + deposit_amount, updated_at = NOW()
    WHERE user_id = dep.user_id;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_deposit_bonus_count
  FROM public.history
  WHERE user_id = dep.user_id
    AND action = 'deposit_bonus'
    AND reference_id = p_deposit_id;

  IF v_deposit_bonus_count = 0 THEN
    INSERT INTO public.history (user_id, action, currency, amount, reference_id, metadata)
    VALUES (
      dep.user_id,
      'deposit_bonus',
      norm_currency,
      bonus_amt,
      p_deposit_id,
      jsonb_build_object('deposit_amount', deposit_amount, 'rate', 0.10)
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO bonus_row_id;
  END IF;

  IF bonus_row_id IS NOT NULL AND bonus_amt > 0 THEN
    IF norm_currency = 'USD' THEN
      UPDATE public.balances
      SET usd_balance = usd_balance + bonus_amt, updated_at = NOW()
      WHERE user_id = dep.user_id;
    ELSE
      UPDATE public.balances
      SET etb_balance = etb_balance + bonus_amt, updated_at = NOW()
      WHERE user_id = dep.user_id;
    END IF;
  END IF;

  UPDATE public.deposits
  SET status = 'approved', updated_at = NOW()
  WHERE id = p_deposit_id;

  RETURN json_build_object(
    'ok', true,
    'p_deposit_id', p_deposit_id,
    'deposit_amount', deposit_amount,
    'deposit_bonus', COALESCE(bonus_amt, 0),
    'bonus_applied', bonus_row_id IS NOT NULL,
    'currency', norm_currency
  );
END;
$$;

-- ─── admin_reject_deposit (paired admin action) ───────────────────────────────
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

  RETURN json_build_object('ok', true, 'p_deposit_id', p_deposit_id);
END;
$$;

-- ─── admin_approve_deposit_manual (local-only deposits fallback) ─────────────
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
  v_proof TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  v_proof := NULLIF(TRIM(p_proof_url), '');
  IF v_proof IS NOT NULL AND (v_proof LIKE 'data:%' OR length(v_proof) > 8000) THEN
    v_proof := NULL;
  END IF;

  norm_currency := CASE WHEN upper(p_currency) IN ('USD', 'USDT') THEN 'USD' ELSE 'ETB' END;

  INSERT INTO public.deposits (
    user_id, currency, amount, status, payment_method, transaction_id, proof_url, screenshot_url
  ) VALUES (
    p_user_id, norm_currency, p_amount, 'pending',
    NULLIF(TRIM(p_payment_method), ''),
    NULLIF(TRIM(p_transaction_id), ''),
    v_proof, v_proof
  ) RETURNING id INTO new_id;

  RETURN public.admin_approve_deposit(new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit_manual(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
