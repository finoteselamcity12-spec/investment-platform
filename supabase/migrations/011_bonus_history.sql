-- Bonus audit table: prevents duplicate signup & deposit bonuses
-- Run in Supabase SQL Editor, then NOTIFY pgrst

CREATE TABLE IF NOT EXISTS public.bonus_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('signup_bonus', 'deposit_bonus', 'referral_bonus')),
  currency TEXT,
  amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS bonus_history_signup_once
  ON public.bonus_history (user_id)
  WHERE action = 'signup_bonus';

CREATE UNIQUE INDEX IF NOT EXISTS bonus_history_deposit_once
  ON public.bonus_history (user_id, reference_id)
  WHERE action = 'deposit_bonus' AND reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bonus_history_user_action_idx
  ON public.bonus_history (user_id, action);

ALTER TABLE public.bonus_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bonus_history_select_own ON public.bonus_history;
CREATE POLICY bonus_history_select_own ON public.bonus_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.bonus_history TO authenticated;
