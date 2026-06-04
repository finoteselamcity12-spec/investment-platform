-- =============================================================================
-- FIX: "invalid input syntax for type json" on deposit approve/reject
-- Cause: proof/screenshot columns are JSONB but app sends TEXT / base64 URLs
-- =============================================================================

-- Convert any JSON/JSONB columns on deposits & withdrawals to TEXT
DO $fix$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('deposits', 'withdrawals')
      AND udt_name IN ('json', 'jsonb')
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I TYPE TEXT USING %I::text',
      r.table_name, r.column_name, r.column_name
    );
    RAISE NOTICE 'Converted %.%.% to TEXT', r.table_name, r.column_name;
  END LOOP;
END;
$fix$;

-- Ensure text proof columns exist and are nullable
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

ALTER TABLE public.deposits
  ALTER COLUMN proof_url DROP NOT NULL,
  ALTER COLUMN screenshot_url DROP NOT NULL;

-- Safe manual approve: never cast invalid strings to JSON
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

  -- Only store short plain text URLs; skip data: base64 blobs (use localStorage in app)
  v_proof := NULLIF(TRIM(p_proof_url), '');
  IF v_proof IS NOT NULL AND (v_proof LIKE 'data:%' OR length(v_proof) > 8000) THEN
    v_proof := NULL;
  END IF;

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

CREATE OR REPLACE FUNCTION public.admin_approve_deposit(deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO dep FROM public.deposits WHERE id = deposit_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found';
  END IF;

  IF dep.status = 'approved' THEN
    RETURN json_build_object('ok', true, 'already_approved', true, 'deposit_id', deposit_id);
  END IF;

  IF dep.status = 'rejected' THEN
    RAISE EXCEPTION 'deposit_already_rejected';
  END IF;

  IF dep.currency IN ('USD', 'USDT') THEN
    UPDATE public.balances
    SET usd_balance = usd_balance + dep.amount, updated_at = NOW()
    WHERE user_id = dep.user_id;
  ELSE
    UPDATE public.balances
    SET etb_balance = etb_balance + dep.amount, updated_at = NOW()
    WHERE user_id = dep.user_id;
  END IF;

  UPDATE public.deposits
  SET status = 'approved', updated_at = NOW()
  WHERE id = deposit_id;

  RETURN json_build_object('ok', true, 'deposit_id', deposit_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit_manual(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('deposits', 'withdrawals')
ORDER BY table_name, ordinal_position;
