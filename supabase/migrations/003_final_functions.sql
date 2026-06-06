-- ============================================================================
-- 003_final_functions.sql
-- Admin and signup RPCs for Supabase/PostgreSQL
-- ============================================================================

SET client_min_messages TO WARNING;

-- ============================================================================
-- FUNCTION 1: handle_new_user() — TRIGGER ON auth.users
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_welcome_etb CONSTANT NUMERIC := 150.00;
  c_welcome_usd CONSTANT NUMERIC := 1.70;
  c_invite_etb CONSTANT NUMERIC := 50.00;
  v_full_name TEXT;
  v_referral_code TEXT;
  v_referrer_id UUID;
BEGIN
  v_full_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'User');

  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (NEW.id, NEW.email, v_full_name, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.balances (
    user_id,
    etb_balance,
    etb_wallet,
    usd_balance,
    usd_wallet,
    updated_at
  ) VALUES (
    NEW.id,
    c_welcome_etb,
    c_welcome_etb,
    c_welcome_usd,
    c_welcome_usd,
    NOW()
  ) ON CONFLICT (user_id) DO UPDATE SET
    etb_balance = EXCLUDED.etb_balance,
    etb_wallet = EXCLUDED.etb_wallet,
    usd_balance = EXCLUDED.usd_balance,
    usd_wallet = EXCLUDED.usd_wallet,
    updated_at = NOW();

  INSERT INTO public.history (
    user_id,
    action,
    amount_etb,
    reference_id,
    created_at
  ) VALUES (
    NEW.id,
    'signup_bonus',
    c_welcome_etb,
    NULL,
    NOW()
  );

  v_referral_code := NULLIF(NEW.raw_user_meta_data->>'referral_code', '');

  IF v_referral_code IS NOT NULL THEN
    SELECT id
    INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = v_referral_code
      AND id <> NEW.id
    LIMIT 1;

    IF v_referrer_id IS NOT NULL THEN
      UPDATE public.profiles
      SET referred_by = v_referrer_id,
          updated_at = NOW()
      WHERE id = NEW.id;

      UPDATE public.balances
      SET
        etb_balance = COALESCE(etb_balance, 0) + c_invite_etb,
        etb_wallet = COALESCE(etb_wallet, 0) + c_invite_etb,
        referral_bonus_etb = COALESCE(referral_bonus_etb, 0) + c_invite_etb,
        updated_at = NOW()
      WHERE user_id = v_referrer_id;

      INSERT INTO public.history (
        user_id,
        action,
        amount_etb,
        reference_id,
        created_at
      ) VALUES (
        v_referrer_id,
        'invite_bonus',
        c_invite_etb,
        NEW.id,
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- FUNCTION 2: admin_approve_deposit(p_deposit_id UUID)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit public.deposits%ROWTYPE;
  v_amount NUMERIC(18,6);
  v_bonus NUMERIC(18,6);
  v_history_amount_etb NUMERIC(18,6);
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_deposit
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;

  IF v_deposit.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already processed: ' || v_deposit.status,
      'status', v_deposit.status
    );
  END IF;

  IF v_deposit.currency = 'ETB' THEN
    v_amount := v_deposit.amount_etb;
  ELSIF v_deposit.currency = 'USD' THEN
    v_amount := v_deposit.amount_usd;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unsupported currency: ' || v_deposit.currency);
  END IF;

  v_bonus := ROUND(v_amount * 0.10, 2);

  IF v_deposit.currency = 'ETB' THEN
    v_history_amount_etb := v_amount;

    INSERT INTO public.balances (
      user_id,
      etb_balance,
      etb_wallet,
      total_deposited_etb,
      updated_at
    ) VALUES (
      v_deposit.user_id,
      v_amount + v_bonus,
      v_amount + v_bonus,
      v_amount,
      NOW()
    ) ON CONFLICT (user_id) DO UPDATE SET
      etb_balance = COALESCE(etb_balance, 0) + EXCLUDED.etb_balance,
      etb_wallet = COALESCE(etb_wallet, 0) + EXCLUDED.etb_wallet,
      total_deposited_etb = COALESCE(total_deposited_etb, 0) + EXCLUDED.total_deposited_etb,
      updated_at = NOW();
  ELSE
    v_history_amount_etb := 0;

    INSERT INTO public.balances (
      user_id,
      usd_balance,
      usd_wallet,
      updated_at
    ) VALUES (
      v_deposit.user_id,
      v_amount + v_bonus,
      v_amount + v_bonus,
      NOW()
    ) ON CONFLICT (user_id) DO UPDATE SET
      usd_balance = COALESCE(usd_balance, 0) + EXCLUDED.usd_balance,
      usd_wallet = COALESCE(usd_wallet, 0) + EXCLUDED.usd_wallet,
      updated_at = NOW();
  END IF;

  UPDATE public.deposits
  SET status = 'successful',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_deposit_id;

  INSERT INTO public.history (
    user_id,
    action,
    amount_etb,
    reference_id,
    created_at
  ) VALUES (
    v_deposit.user_id,
    'deposit',
    v_history_amount_etb,
    p_deposit_id,
    NOW()
  );

  INSERT INTO public.history (
    user_id,
    action,
    amount_etb,
    reference_id,
    created_at
  ) VALUES (
    v_deposit.user_id,
    'deposit_bonus',
    CASE WHEN v_deposit.currency = 'ETB' THEN v_bonus ELSE 0 END,
    p_deposit_id,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'deposit_id', p_deposit_id,
    'user_id', v_deposit.user_id,
    'currency', v_deposit.currency,
    'amount', v_amount,
    'bonus', v_bonus
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- ============================================================================
-- FUNCTION 3: admin_reject_deposit(p_deposit_id UUID, p_note TEXT DEFAULT 'Rejected by admin')
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_reject_deposit(
  p_deposit_id UUID,
  p_note TEXT DEFAULT 'Rejected by admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_amount_etb NUMERIC(18,2);
  v_status TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT user_id, amount_etb, status
    INTO v_user_id, v_amount_etb, v_status
    FROM public.deposits
    WHERE id = p_deposit_id
    FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;

  IF v_status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already processed: ' || v_status,
      'status', v_status
    );
  END IF;

  UPDATE public.deposits
  SET status = 'rejected',
      admin_note = p_note,
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_deposit_id;

  INSERT INTO public.history (
    user_id,
    action,
    amount_etb,
    reference_id,
    created_at
  ) VALUES (
    v_user_id,
    'rejected',
    v_amount_etb,
    p_deposit_id,
    NOW()
  );

  RETURN jsonb_build_object('success', true, 'deposit_id', p_deposit_id, 'user_id', v_user_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- ============================================================================
-- FUNCTION 4: approve_withdrawal(p_withdrawal_id UUID)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal public.withdrawals%ROWTYPE;
  v_etb_wallet NUMERIC(18,2);
  v_usd_wallet NUMERIC(18,6);
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_withdrawal
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  IF v_withdrawal.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already processed: ' || v_withdrawal.status,
      'status', v_withdrawal.status
    );
  END IF;

  SELECT etb_wallet, usd_wallet
    INTO v_etb_wallet, v_usd_wallet
    FROM public.balances
    WHERE user_id = v_withdrawal.user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Balance record not found');
  END IF;

  IF v_withdrawal.amount_etb > v_etb_wallet THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient ETB wallet balance');
  END IF;

  IF v_withdrawal.amount_usd > v_usd_wallet THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient USD wallet balance');
  END IF;

  UPDATE public.balances
  SET
    etb_balance = GREATEST(etb_balance - v_withdrawal.amount_etb, 0),
    etb_wallet = GREATEST(etb_wallet - v_withdrawal.amount_etb, 0),
    usd_balance = GREATEST(usd_balance - v_withdrawal.amount_usd, 0),
    usd_wallet = GREATEST(usd_wallet - v_withdrawal.amount_usd, 0),
    total_withdrawn_etb = COALESCE(total_withdrawn_etb, 0) + v_withdrawal.amount_etb,
    updated_at = NOW()
  WHERE user_id = v_withdrawal.user_id;

  UPDATE public.withdrawals
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_withdrawal_id;

  INSERT INTO public.history (
    user_id,
    action,
    amount_etb,
    reference_id,
    created_at
  ) VALUES (
    v_withdrawal.user_id,
    'withdrawal',
    v_withdrawal.amount_etb,
    p_withdrawal_id,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', p_withdrawal_id,
    'user_id', v_withdrawal.user_id,
    'amount_etb', v_withdrawal.amount_etb,
    'amount_usd', v_withdrawal.amount_usd
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- ============================================================================
-- FUNCTION 5: reject_withdrawal(p_withdrawal_id UUID, p_note TEXT DEFAULT 'Rejected')
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_withdrawal(
  p_withdrawal_id UUID,
  p_note TEXT DEFAULT 'Rejected'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal public.withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_withdrawal
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  IF v_withdrawal.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already processed: ' || v_withdrawal.status,
      'status', v_withdrawal.status
    );
  END IF;

  UPDATE public.withdrawals
  SET status = 'rejected',
      admin_note = p_note,
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_withdrawal_id;

  INSERT INTO public.history (
    user_id,
    action,
    amount_etb,
    reference_id,
    created_at
  ) VALUES (
    v_withdrawal.user_id,
    'rejected',
    v_withdrawal.amount_etb,
    p_withdrawal_id,
    NOW()
  );

  RETURN jsonb_build_object('success', true, 'withdrawal_id', p_withdrawal_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- ============================================================================
-- FUNCTION 6: admin_list_pending_deposits()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_pending_deposits()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', COALESCE(
      (
        SELECT jsonb_agg(row_json ORDER BY row_json ->> 'created_at' DESC)
        FROM (
          SELECT jsonb_build_object(
            'id', d.id,
            'user_id', d.user_id,
            'amount_etb', d.amount_etb,
            'amount_usd', d.amount_usd,
            'currency', d.currency,
            'transaction_id', d.transaction_id,
            'screenshot_url', d.screenshot_url,
            'status', d.status,
            'created_at', d.created_at,
            'user_email', p.email,
            'user_name', p.full_name,
            'payment_label', pm.label
          ) AS row_json
          FROM public.deposits d
          JOIN public.profiles p ON p.id = d.user_id
          LEFT JOIN public.payment_methods pm ON pm.id = d.payment_method_id
          WHERE d.status = 'pending'
        ) pending_rows
      ), '[]'::jsonb
    )
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- ============================================================================
-- FUNCTION 7: admin_list_withdrawals()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_withdrawals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', COALESCE(
      (
        SELECT jsonb_agg(row_json ORDER BY row_json ->> 'created_at' DESC)
        FROM (
          SELECT jsonb_build_object(
            'id', w.id,
            'user_id', w.user_id,
            'amount_etb', w.amount_etb,
            'amount_usd', w.amount_usd,
            'currency', w.currency,
            'method', w.method,
            'account_info', w.account_info,
            'status', w.status,
            'admin_note', w.admin_note,
            'created_at', w.created_at,
            'user_email', p.email,
            'user_name', p.full_name
          ) AS row_json
          FROM public.withdrawals w
          JOIN public.profiles p ON p.id = w.user_id
          WHERE w.status = 'pending'
        ) withdrawal_rows
      ), '[]'::jsonb
    )
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- ============================================================================
-- FUNCTION 8: admin_list_users()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', COALESCE(
      (
        SELECT jsonb_agg(row_json ORDER BY row_json ->> 'created_at' DESC)
        FROM (
          SELECT jsonb_build_object(
            'id', p.id,
            'email', p.email,
            'full_name', p.full_name,
            'phone', p.phone,
            'role', p.role,
            'referral_code', p.referral_code,
            'is_active', p.is_active,
            'is_verified', p.is_verified,
            'created_at', p.created_at,
            'etb_balance', COALESCE(b.etb_balance, 0),
            'usd_balance', COALESCE(b.usd_balance, 0),
            'etb_wallet', COALESCE(b.etb_wallet, 0),
            'usd_wallet', COALESCE(b.usd_wallet, 0)
          ) AS row_json
          FROM public.profiles p
          LEFT JOIN public.balances b ON b.user_id = p.id
        ) user_rows
      ), '[]'::jsonb
    )
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- ============================================================================
-- FUNCTION 9: admin_get_dashboard_stats()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'users', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.profiles),
      'active', (SELECT COUNT(*) FROM public.profiles WHERE is_active = TRUE),
      'new_today', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= date_trunc('day', NOW()))
    ),
    'deposits', jsonb_build_object(
      'pending_count', (SELECT COUNT(*) FROM public.deposits WHERE status = 'pending'),
      'pending_etb', COALESCE((SELECT SUM(amount_etb) FROM public.deposits WHERE status = 'pending'), 0),
      'approved_count', (SELECT COUNT(*) FROM public.deposits WHERE status = 'successful'),
      'approved_etb', COALESCE((SELECT SUM(amount_etb) FROM public.deposits WHERE status = 'successful'), 0),
      'rejected_count', (SELECT COUNT(*) FROM public.deposits WHERE status = 'rejected'),
      'today_count', (SELECT COUNT(*) FROM public.deposits WHERE created_at >= date_trunc('day', NOW()))
    ),
    'withdrawals', jsonb_build_object(
      'pending_count', (SELECT COUNT(*) FROM public.withdrawals WHERE status = 'pending'),
      'pending_etb', COALESCE((SELECT SUM(amount_etb) FROM public.withdrawals WHERE status = 'pending'), 0),
      'approved_count', (SELECT COUNT(*) FROM public.withdrawals WHERE status = 'approved'),
      'approved_etb', COALESCE((SELECT SUM(amount_etb) FROM public.withdrawals WHERE status = 'approved'), 0),
      'rejected_count', (SELECT COUNT(*) FROM public.withdrawals WHERE status = 'rejected')
    ),
    'balances', jsonb_build_object(
      'total_etb', COALESCE((SELECT SUM(etb_balance) FROM public.balances), 0),
      'total_usd', COALESCE((SELECT SUM(usd_balance) FROM public.balances), 0)
    ),
    'support', jsonb_build_object(
      'open_tickets', COALESCE((SELECT COUNT(*) FROM public.support_tickets WHERE status = 'open'), 0),
      'urgent_tickets', COALESCE((SELECT COUNT(*) FROM public.support_tickets WHERE priority = 'urgent' AND status IN ('open', 'in_progress')), 0)
    ),
    'generated_at', NOW()
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_deposit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_deposits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_withdrawals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats() TO authenticated;
