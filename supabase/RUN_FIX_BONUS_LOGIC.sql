-- =============================================================================
-- FIX: Signup bonus (once per user) + 10% deposit bonus (once per deposit)
-- Run entire script in Supabase SQL Editor
-- =============================================================================

-- Uses public.history (not bonus_history)
CREATE TABLE IF NOT EXISTS public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('welcome_bonus', 'signup_bonus', 'deposit_bonus', 'referral_bonus')),
  currency TEXT,
  amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS history_welcome_once
  ON public.history (user_id)
  WHERE action = 'welcome_bonus';

CREATE UNIQUE INDEX IF NOT EXISTS history_deposit_once
  ON public.history (user_id, reference_id)
  WHERE action = 'deposit_bonus' AND reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS history_user_action_idx
  ON public.history (user_id, action);

ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS history_select_own ON public.history;
CREATE POLICY history_select_own ON public.history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.history TO authenticated;

-- ─── Signup bonus: idempotent grant (login / backfill) ───────────────────────
CREATE OR REPLACE FUNCTION public.grant_signup_bonus_if_missing(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user_id';
  END IF;

  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_signup_count
  FROM public.history
  WHERE user_id = p_user_id AND action IN ('welcome_bonus', 'signup_bonus');

  IF v_signup_count > 0 THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'history_exists', 'count', v_signup_count);
  END IF;

  INSERT INTO public.history (user_id, action, currency, amount, metadata)
  VALUES (
    p_user_id,
    'welcome_bonus',
    'MIXED',
    0,
    jsonb_build_object('etb', 150.00, 'usd', 1.70)
  )
  ON CONFLICT DO NOTHING;

  SELECT COUNT(*)::INTEGER INTO v_signup_count
  FROM public.history
  WHERE user_id = p_user_id AND action IN ('welcome_bonus', 'signup_bonus');

  IF v_signup_count = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'history_insert_failed');
  END IF;

  INSERT INTO public.balances (user_id, etb_balance, usd_balance)
  VALUES (p_user_id, 150.00, 1.70)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN json_build_object('ok', true, 'granted', true);
END;
$$;

-- ─── handle_new_user: record signup_bonus in history ─────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_full_name TEXT;
  ref_raw TEXT;
  ref_uuid UUID;
  v_referral_code TEXT;
BEGIN
  v_email := COALESCE(NULLIF(TRIM(NEW.email), ''), '');
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    split_part(v_email, '@', 1),
    'User'
  );

  v_referral_code := NULLIF(TRIM(NEW.raw_user_meta_data->>'referral_code'), '');

  ref_raw := NULLIF(TRIM(NEW.raw_user_meta_data->>'referred_by'), '');
  ref_uuid := NULL;
  IF ref_raw IS NOT NULL AND ref_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    BEGIN
      ref_uuid := ref_raw::uuid;
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = ref_uuid) THEN
        ref_uuid := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      ref_uuid := NULL;
    END;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, referred_by, referral_code)
  VALUES (NEW.id, NULLIF(v_email, ''), v_full_name, ref_uuid, v_referral_code)
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    referred_by = COALESCE(public.profiles.referred_by, EXCLUDED.referred_by),
    referral_code = COALESCE(public.profiles.referral_code, EXCLUDED.referral_code);

  INSERT INTO public.balances (user_id, etb_balance, usd_balance)
  VALUES (NEW.id, 150.00, 1.70)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.history (user_id, action, currency, amount, metadata)
  VALUES (
    NEW.id,
    'welcome_bonus',
    'MIXED',
    0,
    jsonb_build_object('etb', 150.00, 'usd', 1.70)
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error uid=% msg=%', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Backfill signup_bonus history for users who already have balances
INSERT INTO public.history (user_id, action, currency, amount, metadata)
SELECT b.user_id, 'welcome_bonus', 'MIXED', 0, jsonb_build_object('etb', 150.00, 'usd', 1.70)
FROM public.balances b
WHERE NOT EXISTS (
  SELECT 1 FROM public.history h
  WHERE h.user_id = b.user_id AND h.action IN ('welcome_bonus', 'signup_bonus')
)
ON CONFLICT DO NOTHING;

-- ─── Admin approve deposit: principal + 10% bonus (idempotent per deposit) ───
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep RECORD;
  bonus_amt NUMERIC(18, 4);
  norm_currency TEXT;
  bonus_row_id UUID;
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
  bonus_amt := ROUND(dep.amount * 0.10, 4);

  IF norm_currency = 'USD' THEN
    UPDATE public.balances
    SET usd_balance = usd_balance + dep.amount, updated_at = NOW()
    WHERE user_id = dep.user_id;
  ELSE
    UPDATE public.balances
    SET etb_balance = etb_balance + dep.amount, updated_at = NOW()
    WHERE user_id = dep.user_id;
  END IF;

  INSERT INTO public.history (user_id, action, currency, amount, reference_id, metadata)
  VALUES (
    dep.user_id,
    'deposit_bonus',
    norm_currency,
    bonus_amt,
    p_deposit_id,
    jsonb_build_object('deposit_amount', dep.amount, 'rate', 0.10)
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO bonus_row_id;

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
    'deposit_amount', dep.amount,
    'deposit_bonus', COALESCE(bonus_amt, 0),
    'bonus_applied', bonus_row_id IS NOT NULL,
    'currency', norm_currency
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_signup_bonus_if_missing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
