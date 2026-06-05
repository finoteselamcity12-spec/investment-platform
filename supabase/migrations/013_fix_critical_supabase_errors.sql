-- =============================================================================
-- 013_fix_critical_supabase_errors.sql
-- Fixes: missing grant_signup_bonus_if_missing RPC, deposits RLS, history schema
-- Run entire file in Supabase SQL Editor (safe to re-run)
-- =============================================================================

-- ─── is_admin() (required by grant_signup_bonus_if_missing) ───────────────────
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

-- ─── public.history: ensure columns + welcome_bonus action ────────────────────
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

ALTER TABLE public.history
  ADD COLUMN IF NOT EXISTS reference_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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

-- ─── grant_signup_bonus_if_missing (404 fix) ──────────────────────────────────
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

GRANT EXECUTE ON FUNCTION public.grant_signup_bonus_if_missing(UUID) TO authenticated;

-- ─── deposits: RLS + grants (403 fix) ───────────────────────────────────────
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own pending deposit" ON public.deposits;
DROP POLICY IF EXISTS "Users insert own pending deposits" ON public.deposits;
DROP POLICY IF EXISTS "Users select own deposits" ON public.deposits;
DROP POLICY IF EXISTS "Users read own deposits" ON public.deposits;

CREATE POLICY "Users insert own pending deposits"
  ON public.deposits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND COALESCE(lower(trim(status)), 'pending') = 'pending'
  );

CREATE POLICY "Users select own deposits"
  ON public.deposits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.deposits TO authenticated;

NOTIFY pgrst, 'reload schema';
