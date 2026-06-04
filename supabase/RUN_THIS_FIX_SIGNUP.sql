-- =============================================================================
-- BLACKROCK SIGNUP 500 FIX — Run in Supabase SQL Editor (step by step)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: DISABLE TRIGGER (test registration after this)
-- If signup works now, the trigger was the cause.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;


-- -----------------------------------------------------------------------------
-- STEP 2: VERIFY TABLE COLUMNS (inspect results in the grid below)
-- Expected profiles: id, email, full_name, referred_by, created_at
-- Expected balances: user_id, etb_balance, usd_balance, updated_at
-- (There is NO column named "balance" — bonuses use etb_balance + usd_balance)
-- -----------------------------------------------------------------------------
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'balances')
ORDER BY table_name, ordinal_position;


-- -----------------------------------------------------------------------------
-- STEP 3: FIX SCHEMA (safe to re-run)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;

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
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  etb_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  usd_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- STEP 4: CORRECTED TRIGGER FUNCTION (full_name, bonuses, null-safe)
-- -----------------------------------------------------------------------------
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

  BEGIN
    INSERT INTO public.profiles (id, email, full_name, referred_by)
    VALUES (NEW.id, NULLIF(v_email, ''), NULLIF(v_full_name, ''), ref_uuid)
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
      referred_by = COALESCE(public.profiles.referred_by, EXCLUDED.referred_by);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'handle_new_user profiles failed for %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.balances (user_id, etb_balance, usd_balance)
    VALUES (NEW.id, 150.00, 1.70)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'handle_new_user balances failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;


-- -----------------------------------------------------------------------------
-- STEP 5: RE-ENABLE TRIGGER
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- -----------------------------------------------------------------------------
-- STEP 6: RLS + GRANTS (so the app can sync profile after signup)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users upsert own profile" ON public.profiles;
CREATE POLICY "Users upsert own profile" ON public.profiles
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

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.balances TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.balances TO service_role;


-- -----------------------------------------------------------------------------
-- STEP 7: CONFIRM TRIGGER IS ACTIVE
-- -----------------------------------------------------------------------------
SELECT tgname AS trigger_name, tgenabled AS enabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
