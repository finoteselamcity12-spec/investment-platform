-- RUN_CLEAN_REINSTALL_TRANSACTION_LOGIC.sql
-- Reinstall unified transaction processing logic and reset legacy backend RPCs.

-- Cleanup old transaction and admin RPCs (preserve tables/data).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'process_transaction',
        'submit_user_withdrawal',
        'admin_approve_deposit',
        'admin_reject_deposit',
        'admin_approve_deposit_manual',
        'admin_approve_withdrawal',
        'admin_reject_withdrawal'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE;', r.proname, r.args);
  END LOOP;
END
$$;

-- Ensure latest balance schema supports both legacy and wallet-based systems.
ALTER TABLE public.balances
  ADD COLUMN IF NOT EXISTS etb_wallet NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (etb_wallet >= 0),
  ADD COLUMN IF NOT EXISTS usd_wallet NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (usd_wallet >= 0);

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS amount_etb NUMERIC(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(18,4) DEFAULT 0;

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS amount_etb NUMERIC(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(18,4) DEFAULT 0;

ALTER TABLE public.history
  ADD COLUMN IF NOT EXISTS amount_etb NUMERIC(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(18,4) DEFAULT 0;

DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'history'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%action IN (%';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.history DROP CONSTRAINT IF EXISTS %I;', v_conname);
  END IF;

  EXECUTE $$
    ALTER TABLE public.history
    ADD CONSTRAINT history_action_check
    CHECK (action IN (
      'deposit',
      'withdrawal',
      'deposit_bonus',
      'referral_bonus',
      'signup_bonus',
      'welcome_bonus',
      'investment'
    ));
  $$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not adjust history action constraint: %', SQLERRM;
END;
$$;

-- Unified transaction processor.
CREATE OR REPLACE FUNCTION public.process_transaction(
  p_user_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'ETB',
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_action TEXT;
  v_currency TEXT;
  v_amount_usd NUMERIC(18,4) := 0;
  v_amount_etb NUMERIC(18,4) := 0;
  v_balance RECORD;
  v_history_id UUID;
  v_withdrawal_id UUID;
  v_deposit RECORD;
  v_bonus_amount NUMERIC(18,4) := 0;
  v_total_credit NUMERIC(18,4);
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  v_action := lower(trim(p_type));
  v_currency := CASE WHEN upper(trim(p_currency)) IN ('USD', 'USDT') THEN 'USD' ELSE 'ETB' END;

  IF v_currency = 'USD' THEN
    v_amount_usd := ROUND(p_amount, 4);
  ELSE
    v_amount_etb := ROUND(p_amount, 4);
  END IF;

  -- Ensure the user has a balances row before mutating it.
  SELECT * INTO v_balance FROM public.balances WHERE user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.balances (user_id, usd_balance, etb_balance, usd_wallet, etb_wallet, updated_at)
    VALUES (v_user_id, 0, 0, 0, 0, NOW());
    SELECT * INTO v_balance FROM public.balances WHERE user_id = v_user_id FOR UPDATE;
  END IF;

  IF v_action = 'deposit' THEN
    IF NOT public.is_admin() THEN
      RETURN json_build_object('ok', false, 'error', 'not_authorized');
    END IF;

    IF p_reference_id IS NOT NULL THEN
      SELECT * INTO v_deposit FROM public.deposits WHERE id = p_reference_id FOR UPDATE;
      IF NOT FOUND THEN
        RETURN json_build_object('ok', false, 'error', 'deposit_not_found');
      END IF;
      IF v_deposit.status = 'successful' THEN
        RETURN json_build_object('ok', true, 'already_approved', true, 'deposit_id', p_reference_id);
      END IF;
      IF v_deposit.status = 'rejected' THEN
        RETURN json_build_object('ok', false, 'error', 'deposit_already_rejected');
      END IF;
      IF v_deposit.status != 'pending' THEN
        RETURN json_build_object('ok', false, 'error', 'invalid_deposit_status');
      END IF;
    END IF;

    v_bonus_amount := CASE WHEN v_currency = 'USD' THEN ROUND(p_amount * 0.10, 4) ELSE ROUND(p_amount * 0.10, 4) END;
    v_total_credit := p_amount + v_bonus_amount;

    UPDATE public.balances
    SET
      usd_balance = usd_balance + CASE WHEN v_currency = 'USD' THEN v_total_credit ELSE 0 END,
      etb_balance = etb_balance + CASE WHEN v_currency = 'ETB' THEN v_total_credit ELSE 0 END,
      usd_wallet = COALESCE(usd_wallet, 0) + CASE WHEN v_currency = 'USD' THEN v_total_credit ELSE 0 END,
      etb_wallet = COALESCE(etb_wallet, 0) + CASE WHEN v_currency = 'ETB' THEN v_total_credit ELSE 0 END,
      updated_at = NOW()
    WHERE user_id = v_user_id;

    INSERT INTO public.history (
      user_id,
      action,
      currency,
      amount,
      amount_usd,
      amount_etb,
      status,
      reference_id,
      metadata,
      created_at
    ) VALUES (
      v_user_id,
      'deposit',
      v_currency,
      p_amount,
      v_amount_usd,
      v_amount_etb,
      'successful',
      p_reference_id,
      jsonb_build_object(
        'deposit_amount', p_amount,
        'bonus_amount', v_bonus_amount,
        'bonus_rate', '10%',
        'transaction_id', NULL,
        'source', 'process_transaction'
      ),
      NOW()
    ) RETURNING id INTO v_history_id;

    IF v_bonus_amount > 0 THEN
      INSERT INTO public.history (
        user_id,
        action,
        currency,
        amount,
        amount_usd,
        amount_etb,
        status,
        reference_id,
        metadata,
        created_at
      ) VALUES (
        v_user_id,
        'deposit_bonus',
        v_currency,
        v_bonus_amount,
        CASE WHEN v_currency = 'USD' THEN v_bonus_amount ELSE 0 END,
        CASE WHEN v_currency = 'ETB' THEN v_bonus_amount ELSE 0 END,
        'successful',
        p_reference_id,
        jsonb_build_object(
          'bonus_rate', '10%',
          'deposit_amount', p_amount,
          'bonus_amount', v_bonus_amount,
          'source', 'process_transaction'
        ),
        NOW()
      );
    END IF;

    IF p_reference_id IS NOT NULL THEN
      UPDATE public.deposits
      SET status = 'successful', updated_at = NOW()
      WHERE id = p_reference_id;
    END IF;

    RETURN json_build_object(
      'ok', true,
      'action', 'deposit',
      'currency', v_currency,
      'amount', p_amount,
      'amount_usd', v_amount_usd,
      'amount_etb', v_amount_etb,
      'bonus_amount', v_bonus_amount,
      'total_credit', v_total_credit,
      'reference_id', p_reference_id,
      'history_id', v_history_id,
      'balance_usd', (SELECT COALESCE(usd_balance, 0) FROM public.balances WHERE user_id = v_user_id),
      'balance_etb', (SELECT COALESCE(etb_balance, 0) FROM public.balances WHERE user_id = v_user_id)
    );
  ELSIF v_action = 'withdrawal' THEN
    IF v_currency = 'USD' THEN
      IF COALESCE(v_balance.usd_balance, 0) < p_amount THEN
        RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
      END IF;
      UPDATE public.balances
      SET usd_balance = usd_balance - p_amount,
          usd_wallet = GREATEST(COALESCE(usd_wallet, 0) - p_amount, 0),
          updated_at = NOW()
      WHERE user_id = v_user_id;
    ELSE
      IF COALESCE(v_balance.etb_balance, 0) < p_amount THEN
        RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
      END IF;
      UPDATE public.balances
      SET etb_balance = etb_balance - p_amount,
          etb_wallet = GREATEST(COALESCE(etb_wallet, 0) - p_amount, 0),
          updated_at = NOW()
      WHERE user_id = v_user_id;
    END IF;

    IF p_reference_id IS NULL THEN
      INSERT INTO public.withdrawals (
        user_id,
        currency,
        amount,
        amount_usd,
        amount_etb,
        status,
        created_at,
        updated_at
      ) VALUES (
        v_user_id,
        v_currency,
        p_amount,
        v_amount_usd,
        v_amount_etb,
        'pending',
        NOW(),
        NOW()
      ) RETURNING id INTO v_withdrawal_id;
      p_reference_id := v_withdrawal_id;
    ELSE
      v_withdrawal_id := p_reference_id;
    END IF;

    INSERT INTO public.history (
      user_id,
      action,
      currency,
      amount,
      amount_usd,
      amount_etb,
      status,
      reference_id,
      metadata,
      created_at
    ) VALUES (
      v_user_id,
      'withdrawal',
      v_currency,
      p_amount,
      v_amount_usd,
      v_amount_etb,
      'pending',
      p_reference_id,
      jsonb_build_object('source', 'process_transaction'),
      NOW()
    ) RETURNING id INTO v_history_id;

    RETURN json_build_object(
      'ok', true,
      'action', 'withdrawal',
      'currency', v_currency,
      'amount', p_amount,
      'amount_usd', v_amount_usd,
      'amount_etb', v_amount_etb,
      'reference_id', p_reference_id,
      'withdrawal_id', v_withdrawal_id,
      'history_id', v_history_id,
      'balance_usd', (SELECT COALESCE(usd_balance, 0) FROM public.balances WHERE user_id = v_user_id),
      'balance_etb', (SELECT COALESCE(etb_balance, 0) FROM public.balances WHERE user_id = v_user_id)
    );
  ELSIF v_action = 'invite_bonus' OR v_action = 'referral_bonus' THEN
    IF NOT public.is_admin() THEN
      RETURN json_build_object('ok', false, 'error', 'not_authorized');
    END IF;

    UPDATE public.balances
    SET
      usd_balance = usd_balance + CASE WHEN v_currency = 'USD' THEN p_amount ELSE 0 END,
      etb_balance = etb_balance + CASE WHEN v_currency = 'ETB' THEN p_amount ELSE 0 END,
      usd_wallet = COALESCE(usd_wallet, 0) + CASE WHEN v_currency = 'USD' THEN p_amount ELSE 0 END,
      etb_wallet = COALESCE(etb_wallet, 0) + CASE WHEN v_currency = 'ETB' THEN p_amount ELSE 0 END,
      updated_at = NOW()
    WHERE user_id = v_user_id;

    INSERT INTO public.history (
      user_id,
      action,
      currency,
      amount,
      amount_usd,
      amount_etb,
      status,
      reference_id,
      metadata,
      created_at
    ) VALUES (
      v_user_id,
      'referral_bonus',
      v_currency,
      p_amount,
      v_amount_usd,
      v_amount_etb,
      'successful',
      p_reference_id,
      jsonb_build_object(
        'source', 'process_transaction',
        'reference_type', 'invite_bonus'
      ),
      NOW()
    ) RETURNING id INTO v_history_id;

    RETURN json_build_object(
      'ok', true,
      'action', 'referral_bonus',
      'currency', v_currency,
      'amount', p_amount,
      'amount_usd', v_amount_usd,
      'amount_etb', v_amount_etb,
      'reference_id', p_reference_id,
      'history_id', v_history_id,
      'balance_usd', (SELECT COALESCE(usd_balance, 0) FROM public.balances WHERE user_id = v_user_id),
      'balance_etb', (SELECT COALESCE(etb_balance, 0) FROM public.balances WHERE user_id = v_user_id)
    );
  ELSIF v_action = 'invest' THEN
    IF v_currency = 'USD' THEN
      IF COALESCE(v_balance.usd_balance, 0) < p_amount THEN
        RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
      END IF;
      UPDATE public.balances
      SET usd_balance = usd_balance - p_amount,
          usd_wallet = GREATEST(COALESCE(usd_wallet, 0) - p_amount, 0),
          updated_at = NOW()
      WHERE user_id = v_user_id;
    ELSE
      IF COALESCE(v_balance.etb_balance, 0) < p_amount THEN
        RETURN json_build_object('ok', false, 'error', 'insufficient_balance');
      END IF;
      UPDATE public.balances
      SET etb_balance = etb_balance - p_amount,
          etb_wallet = GREATEST(COALESCE(etb_wallet, 0) - p_amount, 0),
          updated_at = NOW()
      WHERE user_id = v_user_id;
    END IF;

    INSERT INTO public.history (
      user_id,
      action,
      currency,
      amount,
      amount_usd,
      amount_etb,
      status,
      reference_id,
      metadata,
      created_at
    ) VALUES (
      v_user_id,
      'investment',
      v_currency,
      p_amount,
      v_amount_usd,
      v_amount_etb,
      'successful',
      p_reference_id,
      jsonb_build_object(
        'source', 'process_transaction'
      ),
      NOW()
    ) RETURNING id INTO v_history_id;

    RETURN json_build_object(
      'ok', true,
      'action', 'investment',
      'currency', v_currency,
      'amount', p_amount,
      'amount_usd', v_amount_usd,
      'amount_etb', v_amount_etb,
      'reference_id', p_reference_id,
      'history_id', v_history_id,
      'balance_usd', (SELECT COALESCE(usd_balance, 0) FROM public.balances WHERE user_id = v_user_id),
      'balance_etb', (SELECT COALESCE(etb_balance, 0) FROM public.balances WHERE user_id = v_user_id)
    );
  ELSE
    RETURN json_build_object('ok', false, 'error', 'invalid_transaction_type');
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_user_withdrawal(
  p_amount NUMERIC,
  p_currency TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.process_transaction(
    NULL,
    'withdrawal',
    p_amount,
    p_currency,
    NULL
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep public.deposits%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('ok', false, 'error', 'not_admin');
  END IF;

  SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'deposit_not_found');
  END IF;

  RETURN public.process_transaction(
    v_dep.user_id,
    'deposit',
    CASE WHEN upper(v_dep.currency) IN ('USD', 'USDT') THEN COALESCE(v_dep.amount_usd, v_dep.amount) ELSE 0 END +
      CASE WHEN upper(v_dep.currency) NOT IN ('USD', 'USDT') THEN COALESCE(v_dep.amount_etb, v_dep.amount) ELSE 0 END,
    v_dep.currency,
    p_deposit_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_deposit_manual(
  p_user_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_payment_method TEXT,
  p_transaction_id TEXT,
  p_proof_url TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit_id UUID;
  v_norm_currency TEXT;
  v_amount_usd NUMERIC(18,4) := 0;
  v_amount_etb NUMERIC(18,4) := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('ok', false, 'error', 'not_admin');
  END IF;

  v_norm_currency := CASE WHEN upper(trim(p_currency)) IN ('USD', 'USDT') THEN 'USD' ELSE 'ETB' END;
  IF v_norm_currency = 'USD' THEN
    v_amount_usd := p_amount;
  ELSE
    v_amount_etb := p_amount;
  END IF;

  INSERT INTO public.deposits (
    user_id,
    currency,
    amount,
    amount_usd,
    amount_etb,
    payment_method,
    transaction_id,
    proof_url,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_norm_currency,
    p_amount,
    v_amount_usd,
    v_amount_etb,
    p_payment_method,
    p_transaction_id,
    p_proof_url,
    'pending',
    NOW(),
    NOW()
  ) RETURNING id INTO v_deposit_id;

  RETURN public.admin_approve_deposit(v_deposit_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_deposit(p_deposit_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('ok', false, 'error', 'not_admin');
  END IF;

  UPDATE public.deposits
  SET status = 'rejected', updated_at = NOW()
  WHERE id = p_deposit_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'deposit_not_found_or_not_pending');
  END IF;

  RETURN json_build_object('ok', true, 'deposit_id', p_deposit_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(p_withdrawal_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('ok', false, 'error', 'not_admin');
  END IF;

  UPDATE public.withdrawals
  SET status = 'successful', updated_at = NOW()
  WHERE id = p_withdrawal_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'withdrawal_not_found_or_not_pending');
  END IF;

  RETURN json_build_object('ok', true, 'withdrawal_id', p_withdrawal_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(p_withdrawal_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('ok', false, 'error', 'not_admin');
  END IF;

  UPDATE public.withdrawals
  SET status = 'rejected', updated_at = NOW()
  WHERE id = p_withdrawal_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'withdrawal_not_found_or_not_pending');
  END IF;

  RETURN json_build_object('ok', true, 'withdrawal_id', p_withdrawal_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_transaction(UUID, TEXT, NUMERIC, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_user_withdrawal(NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit_manual(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_withdrawal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_withdrawal(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
