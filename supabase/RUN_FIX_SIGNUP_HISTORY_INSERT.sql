-- Signup trigger + backfill: ensure welcome_bonus rows exist in public.history
-- Run after RUN_WELCOME_BONUS_ACTION.sql (welcome_bonus action allowed)

ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_action_check;
ALTER TABLE public.history
  ADD CONSTRAINT history_action_check
  CHECK (action IN ('welcome_bonus', 'signup_bonus', 'deposit_bonus', 'referral_bonus'));

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
  v_welcome_count INTEGER;
BEGIN
  v_email := COALESCE(NULLIF(TRIM(NEW.email), ''), '');
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    split_part(v_email, '@', 1),
    'User'
  );

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

  INSERT INTO public.profiles (id, email, full_name, referred_by)
  VALUES (NEW.id, NULLIF(v_email, ''), v_full_name, ref_uuid)
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    referred_by = COALESCE(public.profiles.referred_by, EXCLUDED.referred_by);

  INSERT INTO public.balances (user_id, etb_balance, usd_balance)
  VALUES (NEW.id, 150.00, 1.70)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT COUNT(*)::INTEGER INTO v_welcome_count
  FROM public.history
  WHERE user_id = NEW.id AND action IN ('welcome_bonus', 'signup_bonus');

  IF v_welcome_count = 0 THEN
    INSERT INTO public.history (user_id, action, currency, amount, metadata)
    VALUES (
      NEW.id,
      'welcome_bonus',
      'MIXED',
      0,
      jsonb_build_object('etb', 150.00, 'usd', 1.70)
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error uid=% msg=%', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.history (user_id, action, currency, amount, metadata)
SELECT b.user_id, 'welcome_bonus', 'MIXED', 0, jsonb_build_object('etb', 150.00, 'usd', 1.70)
FROM public.balances b
WHERE NOT EXISTS (
  SELECT 1 FROM public.history h
  WHERE h.user_id = b.user_id AND h.action IN ('welcome_bonus', 'signup_bonus')
);

NOTIFY pgrst, 'reload schema';
