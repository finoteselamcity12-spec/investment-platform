-- =============================================================================
-- FIX: referral_code NOT NULL violation on signup / profile insert
-- Copy entire file → Supabase SQL Editor → Run once
-- =============================================================================

-- 1) Make referral_code optional (nullable)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

ALTER TABLE public.profiles
  ALTER COLUMN referral_code DROP NOT NULL;

-- Remove forced empty-string default if present (optional cleanup)
ALTER TABLE public.profiles
  ALTER COLUMN referral_code DROP DEFAULT;

-- 2) Backfill existing rows (NULL = no referrer code required)
UPDATE public.profiles
SET referral_code = NULL
WHERE referral_code IS NOT NULL
  AND TRIM(referral_code) = '';

-- 3) Recreate trigger — sets referral_code to NULL when not provided
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

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

  -- Optional: custom code from metadata; otherwise NULL (not required)
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error uid=% msg=%', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4) Verify
SELECT
  column_name,
  is_nullable,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'referral_code';
