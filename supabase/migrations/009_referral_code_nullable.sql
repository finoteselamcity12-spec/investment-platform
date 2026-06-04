-- Make profiles.referral_code optional + update handle_new_user trigger

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

ALTER TABLE public.profiles
  ALTER COLUMN referral_code DROP NOT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN referral_code DROP DEFAULT;

-- Re-run handle_new_user from RUN_FIX_REFERRAL_CODE.sql or RUN_SYNC_PROFILES_FINAL.sql after this
