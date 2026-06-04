-- Remove phone column and simplify handle_new_user (id + email only from auth)
-- Run in Supabase SQL Editor after 001_bonus_referral_setup.sql

ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_raw TEXT;
  ref_uuid UUID;
BEGIN
  ref_raw := NULLIF(TRIM(NEW.raw_user_meta_data->>'referred_by'), '');
  ref_uuid := NULL;
  IF ref_raw IS NOT NULL AND ref_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    ref_uuid := ref_raw::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = ref_uuid) THEN
      ref_uuid := NULL;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), ''),
    ref_uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    referred_by = COALESCE(public.profiles.referred_by, EXCLUDED.referred_by);

  INSERT INTO public.balances (user_id, etb_balance, usd_balance)
  VALUES (NEW.id, 150.00, 1.70)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
