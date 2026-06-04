-- Blackrock Investment: profiles, balances, deposits, registration & referral bonuses
-- Run this entire script in the Supabase SQL Editor (Dashboard → SQL → New query)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
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

CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'USDT', 'ETB')),
  amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 1: Referral tracking column (safe if table already exists)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);

-- ---------------------------------------------------------------------------
-- Step 2: Registration bonus — 150 ETB & 1.7 USD on new auth user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

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

-- ---------------------------------------------------------------------------
-- Step 3: Referral bonus on deposit — 3 USD or 125 ETB to referrer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_referral_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT referred_by INTO referrer_id
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF referrer_id IS NOT NULL THEN
    IF NEW.currency IN ('USD', 'USDT') THEN
      UPDATE public.balances
      SET usd_balance = usd_balance + 3.00,
          updated_at = NOW()
      WHERE user_id = referrer_id;
    ELSIF NEW.currency = 'ETB' THEN
      UPDATE public.balances
      SET etb_balance = etb_balance + 125.00,
          updated_at = NOW()
      WHERE user_id = referrer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_deposit_referral_bonus ON public.deposits;
CREATE TRIGGER on_deposit_referral_bonus
  AFTER INSERT ON public.deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_referral_bonus();

-- ---------------------------------------------------------------------------
-- Row Level Security (basic)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users read own balance" ON public.balances;
CREATE POLICY "Users read own balance" ON public.balances
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own deposits" ON public.deposits;
CREATE POLICY "Users read own deposits" ON public.deposits
  FOR SELECT USING (auth.uid() = user_id);
