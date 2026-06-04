-- Rename signup_bonus → welcome_bonus in public.history (run once in SQL Editor)

ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_action_check;
ALTER TABLE public.history DROP CONSTRAINT IF EXISTS bonus_history_action_check;

ALTER TABLE public.history
  ADD CONSTRAINT history_action_check
  CHECK (action IN ('welcome_bonus', 'signup_bonus', 'deposit_bonus', 'referral_bonus'));

UPDATE public.history SET action = 'welcome_bonus' WHERE action = 'signup_bonus';

DROP INDEX IF EXISTS history_signup_once;
DROP INDEX IF EXISTS bonus_history_signup_once;

CREATE UNIQUE INDEX IF NOT EXISTS history_welcome_once
  ON public.history (user_id)
  WHERE action = 'welcome_bonus';

-- grant_signup_bonus_if_missing: log welcome_bonus
CREATE OR REPLACE FUNCTION public.grant_signup_bonus_if_missing(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_welcome_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user_id';
  END IF;

  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_welcome_count
  FROM public.history
  WHERE user_id = p_user_id AND action IN ('welcome_bonus', 'signup_bonus');

  IF v_welcome_count > 0 THEN
    RETURN json_build_object('ok', true, 'skipped', true, 'reason', 'history_exists', 'count', v_welcome_count);
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

  SELECT COUNT(*)::INTEGER INTO v_welcome_count
  FROM public.history
  WHERE user_id = p_user_id AND action IN ('welcome_bonus', 'signup_bonus');

  IF v_welcome_count = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'history_insert_failed');
  END IF;

  INSERT INTO public.balances (user_id, etb_balance, usd_balance)
  VALUES (p_user_id, 150.00, 1.70)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN json_build_object('ok', true, 'granted', true);
END;
$$;

NOTIFY pgrst, 'reload schema';
