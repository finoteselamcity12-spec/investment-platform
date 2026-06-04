-- =============================================================================
-- URGENT: SYNC auth.users ↔ public.profiles
-- Paste ENTIRE file into Supabase SQL Editor → Run
-- =============================================================================

-- Tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  referred_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  etb_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  usd_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TRIGGER FUNCTION (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_raw TEXT;
  ref_uuid UUID;
  v_full_name TEXT;
  v_email TEXT;
BEGIN
  v_email := COALESCE(NULLIF(TRIM(NEW.email), ''), '');
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    ''
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
  VALUES (NEW.id, NULLIF(v_email, ''), NULLIF(v_full_name, ''), ref_uuid)
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);

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

-- SYNC EXISTING USERS (your requested repair)
INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    ''
  )
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO UPDATE SET
  email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
  full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);

-- Missing balances for synced profiles
INSERT INTO public.balances (user_id, etb_balance, usd_balance)
SELECT p.id, 150.00, 1.70
FROM public.profiles p
WHERE p.id NOT IN (SELECT user_id FROM public.balances)
ON CONFLICT (user_id) DO NOTHING;

-- VERIFY
SELECT
  (SELECT COUNT(*) FROM auth.users) AS auth_users,
  (SELECT COUNT(*) FROM public.profiles) AS profiles,
  (SELECT COUNT(*) FROM public.balances) AS balances,
  (SELECT COUNT(*) FROM auth.users u
   WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)) AS still_missing;
