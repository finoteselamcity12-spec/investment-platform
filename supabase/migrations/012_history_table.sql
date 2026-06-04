-- Bonus audit: public.history (one row per signup_bonus per user; one deposit_bonus per deposit)
-- Safe if you already created the table manually — adds indexes/policies only.

CREATE TABLE IF NOT EXISTS public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('signup_bonus', 'deposit_bonus', 'referral_bonus')),
  currency TEXT,
  amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS history_signup_once
  ON public.history (user_id)
  WHERE action = 'signup_bonus';

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
