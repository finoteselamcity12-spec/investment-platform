-- =============================================================================
-- RUN_WITHDRAWAL_BONUS_FIXES.sql — paste into Supabase SQL Editor → Run once
-- Fixes: withdrawal RLS/403, history withdrawal rows, signup bonus duplication
-- =============================================================================

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

-- ─── History: allow withdrawal (+ deposit audit) actions ─────────────────────
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
ALTER TABLE public.history DROP CONSTRAINT IF EXISTS bonus_history_action_check;
ALTER TABLE public.history
  ADD CONSTRAINT history_action_check
  CHECK (action IN (
    'welcome_bonus', 'signup_bonus', 'deposit_bonus', 'referral_bonus',
    'withdrawal', 'deposit'
  ));

-- ─── grant_signup_bonus_if_missing: grant ONCE per user (no login re-grant) ───
CREATE OR REPLACE FUNCTION public.grant_signup_bonus_if_missing(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user_id';
  END IF;

  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.history
    WHERE user_id = p_user_id
      AND action IN ('signup_bonus', 'welcome_bonus')
  ) THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'history_exists');
  END IF;

  INSERT INTO public.history (user_id, action, currency, amount, metadata)
  VALUES (
    p_user_id,
    'signup_bonus',
    'MIXED',
    0,
    jsonb_build_object('etb', 150.00, 'usd', 1.70)
  );

  -- Backfill balances only if the user has no balances row (legacy accounts)
  INSERT INTO public.balances (user_id, etb_balance, usd_balance)
  VALUES (p_user_id, 150.00, 1.70)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN json_build_object('ok', true, 'granted', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_signup_bonus_if_missing(UUID) TO authenticated;

-- ─── Withdrawals: RLS + grants ───────────────────────────────────────────────
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own pending withdrawal" ON public.withdrawals;
DROP POLICY IF EXISTS "Users insert own pending withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users select own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users read own withdrawals" ON public.withdrawals;

CREATE POLICY "Users insert own pending withdrawals"
  ON public.withdrawals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND COALESCE(lower(trim(status)), 'pending') = 'pending'
  );

CREATE POLICY "Users select own withdrawals"
  ON public.withdrawals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.withdrawals TO authenticated;

-- ─── Log withdrawals to public.history ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_withdrawal_to_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.history
    WHERE user_id = NEW.user_id
      AND action = 'withdrawal'
      AND reference_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.history (user_id, action, currency, amount, reference_id, metadata)
  VALUES (
    NEW.user_id,
    'withdrawal',
    CASE WHEN upper(NEW.currency) IN ('USD', 'USDT') THEN 'USD' ELSE 'ETB' END,
    NEW.amount,
    NEW.id,
    jsonb_build_object(
      'bank', NEW.bank,
      'account_name', NEW.account_name,
      'account_number', NEW.account_number,
      'status', NEW.status
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_log_withdrawal_history ON public.withdrawals;
CREATE TRIGGER tr_log_withdrawal_history
  AFTER INSERT ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_withdrawal_to_history();

-- ─── submit_user_withdrawal: balance check + deduct + pending row ─────────────
DROP FUNCTION IF EXISTS public.submit_user_withdrawal(numeric, text, text, text, text);
DROP FUNCTION IF EXISTS public.submit_user_withdrawal(numeric, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_user_withdrawal(
  p_amount NUMERIC,
  p_currency TEXT,
  p_bank TEXT,
  p_account_name TEXT,
  p_account_number TEXT,
  p_payment_method TEXT,
  p_account_details TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_bal RECORD;
  v_currency TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  v_currency := CASE WHEN upper(p_currency) IN ('USD', 'USDT') THEN 'USD' ELSE 'ETB' END;

  SELECT * INTO v_bal FROM public.balances WHERE user_id = v_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  IF v_currency = 'USD' THEN
    IF COALESCE(v_bal.usd_balance, 0) < p_amount THEN
      RAISE EXCEPTION 'insufficient_balance';
    END IF;
    UPDATE public.balances
    SET usd_balance = usd_balance - p_amount, updated_at = NOW()
    WHERE user_id = v_user_id;
  ELSE
    IF COALESCE(v_bal.etb_balance, 0) < p_amount THEN
      RAISE EXCEPTION 'insufficient_balance';
    END IF;
    UPDATE public.balances
    SET etb_balance = etb_balance - p_amount, updated_at = NOW()
    WHERE user_id = v_user_id;
  END IF;

  INSERT INTO public.withdrawals (user_id, amount, currency, bank, account_name, account_number, payment_method, account_details, status)
  VALUES (
    v_user_id,
    p_amount,
    v_currency,
    NULLIF(TRIM(p_bank), ''),
    NULLIF(TRIM(p_account_name), ''),
    NULLIF(TRIM(p_account_number), ''),
    NULLIF(TRIM(p_payment_method), ''),
    p_account_details,
    'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_user_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
