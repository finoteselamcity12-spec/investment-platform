-- =============================================================================
-- 008: Auto-create public.profiles (+ balances) when auth.users row is created
-- Also backfills existing auth.users missing from public.profiles
-- Run entire file in Supabase SQL Editor
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ensure tables exist
-- ---------------------------------------------------------------------------
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
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  etb_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  usd_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. TRIGGER FUNCTION — SECURITY DEFINER (runs with owner privileges, bypasses RLS)
-- ---------------------------------------------------------------------------
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
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    referred_by = COALESCE(public.profiles.referred_by, EXCLUDED.referred_by);

  INSERT INTO public.balances (user_id, etb_balance, usd_balance)
  VALUES (NEW.id, 150.00, 1.70)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. ATTACH TRIGGER to auth.users
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. BACKFILL — sync existing auth.users → public.profiles
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles (id, email, full_name, referred_by)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    ''
  ) AS full_name,
  CASE
    WHEN (u.raw_user_meta_data->>'referred_by') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN (u.raw_user_meta_data->>'referred_by')::uuid
    ELSE NULL
  END AS referred_by
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO UPDATE SET
  email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
  full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);

-- Repair profiles that exist but have empty email/full_name
UPDATE public.profiles p
SET
  email = COALESCE(NULLIF(p.email, ''), u.email),
  full_name = COALESCE(
    NULLIF(p.full_name, ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    ''
  )
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '' OR p.full_name IS NULL OR p.full_name = '');

-- Backfill missing balances (signup bonus for new syncs only)
INSERT INTO public.balances (user_id, etb_balance, usd_balance)
SELECT p.id, 150.00, 1.70
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.balances b WHERE b.user_id = p.id)
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. RLS policies (users can read/update own row; trigger writes via SECURITY DEFINER)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 6. Verification (inspect results)
-- ---------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*)::INTEGER FROM auth.users) AS auth_users_count,
  (SELECT COUNT(*)::INTEGER FROM public.profiles) AS profiles_count,
  (SELECT COUNT(*)::INTEGER FROM public.balances) AS balances_count,
  (SELECT COUNT(*)::INTEGER FROM auth.users u
   WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)) AS auth_without_profile;
