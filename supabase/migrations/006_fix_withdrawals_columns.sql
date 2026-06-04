-- Fix: column w.bank does not exist — add missing withdrawals columns
-- Run this in Supabase SQL Editor if admin_list_withdrawals fails

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS bank TEXT,
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Re-deploy list function (same as 005 — safe to re-run)
CREATE OR REPLACE FUNCTION public.admin_list_withdrawals()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  user_full_name TEXT,
  currency TEXT,
  amount NUMERIC,
  bank TEXT,
  account_name TEXT,
  account_number TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.user_id,
    p.email,
    p.full_name,
    w.currency,
    w.amount,
    w.bank,
    w.account_name,
    w.account_number,
    w.status,
    w.created_at
  FROM public.withdrawals w
  JOIN public.profiles p ON p.id = w.user_id
  WHERE w.status = 'pending'
  ORDER BY w.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_withdrawals() TO authenticated;

NOTIFY pgrst, 'reload schema';
