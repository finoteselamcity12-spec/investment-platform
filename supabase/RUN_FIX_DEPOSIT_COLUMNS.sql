-- =============================================================================
-- FIX: deposits.screenshot_url NOT NULL + optional proof columns
-- Run entire file in Supabase SQL Editor
-- =============================================================================

-- Ensure both proof column names exist (app uses proof_url; some DBs use screenshot_url)
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Make optional columns NULLABLE (no crash when screenshot missing)
ALTER TABLE public.deposits
  ALTER COLUMN screenshot_url DROP NOT NULL,
  ALTER COLUMN proof_url DROP NOT NULL,
  ALTER COLUMN payment_method DROP NOT NULL,
  ALTER COLUMN transaction_id DROP NOT NULL;

ALTER TABLE public.deposits
  ALTER COLUMN screenshot_url DROP DEFAULT,
  ALTER COLUMN proof_url DROP DEFAULT;

-- Withdrawals: optional payout details
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS bank TEXT,
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.withdrawals
  ALTER COLUMN bank DROP NOT NULL,
  ALTER COLUMN account_name DROP NOT NULL,
  ALTER COLUMN account_number DROP NOT NULL;

DO $fix$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'withdrawals' AND column_name = 'payment_method'
  ) THEN
    EXECUTE 'ALTER TABLE public.withdrawals ALTER COLUMN payment_method DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'withdrawals' AND column_name = 'screenshot_url'
  ) THEN
    EXECUTE 'ALTER TABLE public.withdrawals ALTER COLUMN screenshot_url DROP NOT NULL';
  END IF;
END;
$fix$;

-- Sync legacy screenshot_url → proof_url where needed
UPDATE public.deposits
SET proof_url = COALESCE(proof_url, screenshot_url)
WHERE proof_url IS NULL AND screenshot_url IS NOT NULL;

-- ─── Update admin_list_pending_deposits (COALESCE proof columns) ─────────────
CREATE OR REPLACE FUNCTION public.admin_list_pending_deposits()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  user_full_name TEXT,
  currency TEXT,
  amount NUMERIC,
  payment_method TEXT,
  transaction_id TEXT,
  proof_url TEXT,
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
    d.id,
    d.user_id,
    p.email,
    p.full_name,
    d.currency,
    d.amount,
    d.payment_method,
    d.transaction_id,
    COALESCE(d.proof_url, d.screenshot_url) AS proof_url,
    d.status,
    d.created_at
  FROM public.deposits d
  JOIN public.profiles p ON p.id = d.user_id
  WHERE d.status = 'pending'
  ORDER BY d.created_at DESC;
END;
$$;

-- ─── Update manual approve: allow NULL proof / screenshot ───────────────────
CREATE OR REPLACE FUNCTION public.admin_approve_deposit_manual(
  p_user_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_payment_method TEXT DEFAULT NULL,
  p_transaction_id TEXT DEFAULT NULL,
  p_proof_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  norm_currency TEXT;
  v_proof TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  v_proof := NULLIF(TRIM(p_proof_url), '');

  norm_currency := CASE
    WHEN upper(p_currency) IN ('USD', 'USDT') THEN 'USD'
    ELSE 'ETB'
  END;

  INSERT INTO public.deposits (
    user_id, currency, amount, status,
    payment_method, transaction_id, proof_url, screenshot_url
  ) VALUES (
    p_user_id, norm_currency, p_amount, 'pending',
    NULLIF(TRIM(p_payment_method), ''),
    NULLIF(TRIM(p_transaction_id), ''),
    v_proof,
    v_proof
  ) RETURNING id INTO new_id;

  RETURN public.admin_approve_deposit(new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_pending_deposits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit_manual(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify nullable columns
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('deposits', 'withdrawals')
  AND column_name IN (
    'screenshot_url', 'proof_url', 'payment_method', 'transaction_id',
    'bank', 'account_name', 'account_number'
  )
ORDER BY table_name, column_name;
