-- =============================================================================
-- FINAL: SYNC auth.users → public.profiles (copy entire file → SQL Editor → Run)
-- Fixes "No Supabase profile" + admin dashboard user list
-- =============================================================================

-- ─── STEP 1: Remove old / broken triggers & functions ───────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- ─── STEP 2: Tables (safe if already exist) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  referred_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS referred_by UUID,
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- referral_code is optional (registration does not require a code)
ALTER TABLE public.profiles
  ALTER COLUMN referral_code DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  etb_balance NUMERIC(18, 2) NOT NULL DEFAULT 150.00,
  usd_balance NUMERIC(18, 2) NOT NULL DEFAULT 1.70,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── STEP 3: New trigger function (SECURITY DEFINER = bypasses RLS on insert) ─
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error uid=% msg=%', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ─── STEP 4: Attach trigger to auth.users ───────────────────────────────────
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─── STEP 5: FIX ALL EXISTING USERS (immediate backfill) ─────────────────────
INSERT INTO public.profiles (id, email, full_name, referral_code)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    split_part(u.email, '@', 1),
    'User'
  ),
  NULLIF(TRIM(u.raw_user_meta_data->>'referral_code'), '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

UPDATE public.profiles p
SET
  email = COALESCE(NULLIF(TRIM(p.email), ''), u.email),
  full_name = COALESCE(
    NULLIF(TRIM(p.full_name), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    split_part(u.email, '@', 1),
    'User'
  )
FROM auth.users u
WHERE p.id = u.id;

INSERT INTO public.balances (user_id, etb_balance, usd_balance)
SELECT p.id, 150.00, 1.70
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.balances b WHERE b.user_id = p.id)
ON CONFLICT (user_id) DO NOTHING;

-- ─── STEP 6: RLS (trigger writes via SECURITY DEFINER; users read own rows) ─
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users read own balance" ON public.balances;
CREATE POLICY "Users read own balance" ON public.balances
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own balance" ON public.balances;
CREATE POLICY "Users insert own balance" ON public.balances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own balance" ON public.balances;
CREATE POLICY "Users update own balance" ON public.balances
  FOR UPDATE USING (auth.uid() = user_id);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.balances TO authenticated;

-- ─── STEP 7: VERIFY (must show still_missing = 0) ─────────────────────────
SELECT
  (SELECT COUNT(*)::INTEGER FROM auth.users) AS auth_users,
  (SELECT COUNT(*)::INTEGER FROM public.profiles) AS profiles,
  (SELECT COUNT(*)::INTEGER FROM public.balances) AS balances,
  (SELECT COUNT(*)::INTEGER
   FROM auth.users u
   WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  ) AS still_missing;

-- Sample rows (optional — confirm emails visible to admin)
SELECT id, email, full_name, created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;
