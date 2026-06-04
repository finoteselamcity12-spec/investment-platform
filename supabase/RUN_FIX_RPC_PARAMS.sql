-- =============================================================================
-- FIX RPC parameter names — must match frontend supabase.rpc() payload keys
-- Frontend sends: { p_deposit_id }, { p_user_id }, { p_withdrawal_id }
-- Run in Supabase SQL Editor → NOTIFY reload
-- =============================================================================

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
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO dep FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found';
  END IF;

  IF dep.status = 'approved' THEN
    RETURN json_build_object('ok', true, 'already_approved', true, 'p_deposit_id', p_deposit_id);
  END IF;

  IF dep.status = 'rejected' THEN
    RAISE EXCEPTION 'deposit_already_rejected';
  END IF;

  -- For 10% deposit bonus + bonus_history, run RUN_FIX_BONUS_LOGIC.sql after this script.
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
  WHERE id = p_deposit_id;

  RETURN json_build_object('ok', true, 'p_deposit_id', p_deposit_id);
END;
$$;

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

CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(p_withdrawal_id UUID)
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

  SELECT * INTO w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal_not_found';
  END IF;

  IF w.status = 'approved' THEN
    RETURN json_build_object('ok', true, 'already_approved', true);
  END IF;

  UPDATE public.withdrawals
  SET status = 'approved', updated_at = NOW()
  WHERE id = p_withdrawal_id;

  RETURN json_build_object('ok', true, 'p_withdrawal_id', p_withdrawal_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(p_withdrawal_id UUID)
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

  SELECT * INTO w FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal_not_found';
  END IF;

  IF w.status <> 'pending' THEN
    RAISE EXCEPTION 'withdrawal_not_pending';
  END IF;

  IF w.currency IN ('USD', 'USDT') THEN
    UPDATE public.balances SET usd_balance = usd_balance + w.amount, updated_at = NOW() WHERE user_id = w.user_id;
  ELSE
    UPDATE public.balances SET etb_balance = etb_balance + w.amount, updated_at = NOW() WHERE user_id = w.user_id;
  END IF;

  UPDATE public.withdrawals SET status = 'rejected', updated_at = NOW() WHERE id = p_withdrawal_id;

  RETURN json_build_object('ok', true, 'p_withdrawal_id', p_withdrawal_id, 'refunded', true);
END;
$$;

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

  DELETE FROM public.withdrawals WHERE user_id = p_user_id;
  DELETE FROM public.deposits WHERE user_id = p_user_id;
  DELETE FROM public.balances WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN json_build_object('ok', true, 'p_user_id', p_user_id);
END;
$$;

-- manual approve (unchanged param names — already p_*)
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
GRANT EXECUTE ON FUNCTION public.admin_approve_withdrawal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_withdrawal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
