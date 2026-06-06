-- ============================================================================
-- INVESTMENT PLATFORM: CLEAN DATABASE BUILD
-- ============================================================================
-- Complete schema with unified transaction processing
-- Designed for fresh Supabase setup
-- ============================================================================

-- ============================================================================
-- 1. BALANCES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  etb_balance NUMERIC(18,4) NOT NULL DEFAULT 100.00,
  etb_wallet NUMERIC(18,4) NOT NULL DEFAULT 100.00,
  usd_balance NUMERIC(18,4) NOT NULL DEFAULT 0.00,
  usd_wallet NUMERIC(18,4) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  amount_etb NUMERIC(18,4) DEFAULT 0,
  amount_usd NUMERIC(18,4) DEFAULT 0,
  currency TEXT NOT NULL,
  reference_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. DEPOSITS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_etb NUMERIC(18,4) DEFAULT 0,
  amount_usd NUMERIC(18,4) DEFAULT 0,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  proof_url TEXT,
  transaction_id TEXT,
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. WITHDRAWALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_etb NUMERIC(18,4) DEFAULT 0,
  amount_usd NUMERIC(18,4) DEFAULT 0,
  currency TEXT NOT NULL,
  bank TEXT,
  account_name TEXT,
  account_number TEXT,
  payment_method TEXT,
  account_details JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. INVESTMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_etb NUMERIC(18,4) DEFAULT 0,
  amount_usd NUMERIC(18,4) DEFAULT 0,
  currency TEXT NOT NULL,
  days INTEGER,
  daily_profit NUMERIC(18,4),
  bonus NUMERIC(18,4),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_history_user_id ON public.history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_action ON public.history(action);
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON public.deposits(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON public.investments(status);

-- ============================================================================
-- 7. ADMIN HELPER: IS_ADMIN FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_emails TEXT[] := ARRAY[
    'workinehabche@gmail.com'
  ];
BEGIN
  RETURN (SELECT email) IN (SELECT unnest(admin_emails));
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

-- ============================================================================
-- 8. TRIGGER: HANDLE_NEW_USER
-- ============================================================================
-- Automatically creates balances entry with 100 ETB signup bonus
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := NEW.id;

  -- Insert into balances with 100 ETB signup bonus
  INSERT INTO public.balances (
    user_id,
    etb_balance,
    etb_wallet,
    usd_balance,
    usd_wallet,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    100.00,
    100.00,
    0.00,
    0.00,
    NOW(),
    NOW()
  );

  -- Log the signup bonus in history
  INSERT INTO public.history (
    user_id,
    action,
    amount_etb,
    amount_usd,
    currency,
    metadata,
    created_at
  ) VALUES (
    v_user_id,
    'signup_bonus',
    100.00,
    0.00,
    'ETB',
    jsonb_build_object(
      'bonus_type', 'welcome_bonus',
      'amount', 100.00
    ),
    NOW()
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER handle_new_user_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 9. UNIFIED TRANSACTION PROCESSOR
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_transaction(
  p_user_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'ETB',
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB
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
  v_deposit_id UUID;
  v_investment_id UUID;
  v_bonus_amount NUMERIC(18,4) := 0;
  v_total_credit NUMERIC(18,4);
BEGIN
  -- Resolve authenticated user
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Validate amount
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  -- Normalize action and currency
  v_action := LOWER(TRIM(p_type));
  v_currency := CASE 
    WHEN UPPER(TRIM(p_currency)) IN ('USD', 'USDT') THEN 'USD' 
    ELSE 'ETB' 
  END;

  -- Set amount in correct column
  IF v_currency = 'USD' THEN
    v_amount_usd := ROUND(p_amount, 4);
  ELSE
    v_amount_etb := ROUND(p_amount, 4);
  END IF;

  -- Ensure user has balances row (with row lock for consistency)
  SELECT * INTO v_balance FROM public.balances 
  WHERE user_id = v_user_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.balances (user_id, etb_balance, etb_wallet, usd_balance, usd_wallet)
    VALUES (v_user_id, 100.00, 100.00, 0.00, 0.00);
    SELECT * INTO v_balance FROM public.balances WHERE user_id = v_user_id FOR UPDATE;
  END IF;

  -- ========================================================================
  -- DEPOSIT: Admin approves a pending deposit
  -- ========================================================================
  IF v_action = 'deposit' THEN
    IF NOT public.is_admin() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;

    -- If reference_id provided, update that deposit record
    IF p_reference_id IS NOT NULL THEN
      UPDATE public.deposits
      SET status = 'successful', updated_at = NOW()
      WHERE id = p_reference_id;
    ELSE
      -- Create a new successful deposit
      INSERT INTO public.deposits (
        user_id, amount_etb, amount_usd, currency, status, created_at, updated_at
      ) VALUES (
        v_user_id,
        v_amount_etb,
        v_amount_usd,
        v_currency,
        'successful',
        NOW(),
        NOW()
      ) RETURNING id INTO v_deposit_id;
      p_reference_id := COALESCE(p_reference_id, v_deposit_id);
    END IF;

    -- Calculate 10% bonus
    v_bonus_amount := ROUND(p_amount * 0.10, 4);
    v_total_credit := p_amount + v_bonus_amount;

    -- Update balances
    UPDATE public.balances
    SET
      etb_balance = CASE WHEN v_currency = 'ETB' THEN etb_balance + v_total_credit ELSE etb_balance END,
      etb_wallet = CASE WHEN v_currency = 'ETB' THEN COALESCE(etb_wallet, 0) + v_total_credit ELSE COALESCE(etb_wallet, 0) END,
      usd_balance = CASE WHEN v_currency = 'USD' THEN usd_balance + v_total_credit ELSE usd_balance END,
      usd_wallet = CASE WHEN v_currency = 'USD' THEN COALESCE(usd_wallet, 0) + v_total_credit ELSE COALESCE(usd_wallet, 0) END,
      updated_at = NOW()
    WHERE user_id = v_user_id;

    -- Log deposit in history
    INSERT INTO public.history (
      user_id, action, amount_etb, amount_usd, currency, reference_id, metadata, created_at
    ) VALUES (
      v_user_id,
      'deposit',
      v_amount_etb,
      v_amount_usd,
      v_currency,
      p_reference_id,
      jsonb_build_object('bonus_rate', '10%'),
      NOW()
    ) RETURNING id INTO v_history_id;

    -- Log bonus if applicable
    IF v_bonus_amount > 0 THEN
      INSERT INTO public.history (
        user_id, action, amount_etb, amount_usd, currency, reference_id, metadata, created_at
      ) VALUES (
        v_user_id,
        'deposit_bonus',
        CASE WHEN v_currency = 'ETB' THEN v_bonus_amount ELSE 0 END,
        CASE WHEN v_currency = 'USD' THEN v_bonus_amount ELSE 0 END,
        v_currency,
        p_reference_id,
        jsonb_build_object('bonus_amount', v_bonus_amount),
        NOW()
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'deposit',
      'amount', p_amount,
      'currency', v_currency,
      'bonus_amount', v_bonus_amount,
      'total_credit', v_total_credit,
      'balance_etb', (SELECT etb_balance FROM public.balances WHERE user_id = v_user_id),
      'balance_usd', (SELECT usd_balance FROM public.balances WHERE user_id = v_user_id)
    );

  -- ========================================================================
  -- WITHDRAWAL: Deduct balance, create withdrawal record
  -- ========================================================================
  ELSIF v_action = 'withdrawal' THEN
    -- Check balance
    IF v_currency = 'USD' THEN
      IF COALESCE(v_balance.usd_balance, 0) < p_amount THEN
        RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance');
      END IF;
      UPDATE public.balances
      SET
        usd_balance = usd_balance - p_amount,
        usd_wallet = GREATEST(COALESCE(usd_wallet, 0) - p_amount, 0),
        updated_at = NOW()
      WHERE user_id = v_user_id;
    ELSE
      IF COALESCE(v_balance.etb_balance, 0) < p_amount THEN
        RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance');
      END IF;
      UPDATE public.balances
      SET
        etb_balance = etb_balance - p_amount,
        etb_wallet = GREATEST(COALESCE(etb_wallet, 0) - p_amount, 0),
        updated_at = NOW()
      WHERE user_id = v_user_id;
    END IF;

    -- Create or update withdrawal record
    IF p_reference_id IS NULL THEN
      INSERT INTO public.withdrawals (
        user_id, amount_etb, amount_usd, currency, status, created_at, updated_at
      ) VALUES (
        v_user_id,
        v_amount_etb,
        v_amount_usd,
        v_currency,
        'pending',
        NOW(),
        NOW()
      ) RETURNING id INTO v_withdrawal_id;
      p_reference_id := v_withdrawal_id;
    ELSE
      v_withdrawal_id := p_reference_id;
    END IF;

    -- Log withdrawal in history
    INSERT INTO public.history (
      user_id, action, amount_etb, amount_usd, currency, reference_id, metadata, created_at
    ) VALUES (
      v_user_id,
      'withdrawal',
      v_amount_etb,
      v_amount_usd,
      v_currency,
      p_reference_id,
      jsonb_build_object('source', 'process_transaction'),
      NOW()
    ) RETURNING id INTO v_history_id;

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'withdrawal',
      'amount', p_amount,
      'currency', v_currency,
      'withdrawal_id', v_withdrawal_id,
      'balance_etb', (SELECT etb_balance FROM public.balances WHERE user_id = v_user_id),
      'balance_usd', (SELECT usd_balance FROM public.balances WHERE user_id = v_user_id)
    );

  -- ========================================================================
  -- INVESTMENT: Deduct balance, create investment record
  -- ========================================================================
  ELSIF v_action = 'invest' THEN
    -- Check balance
    IF v_currency = 'USD' THEN
      IF COALESCE(v_balance.usd_balance, 0) < p_amount THEN
        RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance');
      END IF;
      UPDATE public.balances
      SET
        usd_balance = usd_balance - p_amount,
        usd_wallet = GREATEST(COALESCE(usd_wallet, 0) - p_amount, 0),
        updated_at = NOW()
      WHERE user_id = v_user_id;
    ELSE
      IF COALESCE(v_balance.etb_balance, 0) < p_amount THEN
        RETURN jsonb_build_object('ok', false, 'error', 'insufficient_balance');
      END IF;
      UPDATE public.balances
      SET
        etb_balance = etb_balance - p_amount,
        etb_wallet = GREATEST(COALESCE(etb_wallet, 0) - p_amount, 0),
        updated_at = NOW()
      WHERE user_id = v_user_id;
    END IF;

    -- Create investment record
    INSERT INTO public.investments (
      user_id, amount_etb, amount_usd, currency, status, created_at, updated_at
    ) VALUES (
      v_user_id,
      v_amount_etb,
      v_amount_usd,
      v_currency,
      'active',
      NOW(),
      NOW()
    ) RETURNING id INTO v_investment_id;

    -- Log investment in history
    INSERT INTO public.history (
      user_id, action, amount_etb, amount_usd, currency, reference_id, metadata, created_at
    ) VALUES (
      v_user_id,
      'investment',
      v_amount_etb,
      v_amount_usd,
      v_currency,
      v_investment_id,
      jsonb_build_object('investment_type', 'user_initiated'),
      NOW()
    ) RETURNING id INTO v_history_id;

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'investment',
      'amount', p_amount,
      'currency', v_currency,
      'investment_id', v_investment_id,
      'balance_etb', (SELECT etb_balance FROM public.balances WHERE user_id = v_user_id),
      'balance_usd', (SELECT usd_balance FROM public.balances WHERE user_id = v_user_id)
    );

  -- ========================================================================
  -- REFERRAL BONUS: Add bonus without balance check
  -- ========================================================================
  ELSIF v_action = 'referral_bonus' THEN
    IF NOT public.is_admin() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;

    -- Add bonus to balances
    UPDATE public.balances
    SET
      etb_balance = CASE WHEN v_currency = 'ETB' THEN etb_balance + p_amount ELSE etb_balance END,
      etb_wallet = CASE WHEN v_currency = 'ETB' THEN COALESCE(etb_wallet, 0) + p_amount ELSE COALESCE(etb_wallet, 0) END,
      usd_balance = CASE WHEN v_currency = 'USD' THEN usd_balance + p_amount ELSE usd_balance END,
      usd_wallet = CASE WHEN v_currency = 'USD' THEN COALESCE(usd_wallet, 0) + p_amount ELSE COALESCE(usd_wallet, 0) END,
      updated_at = NOW()
    WHERE user_id = v_user_id;

    -- Log referral bonus in history
    INSERT INTO public.history (
      user_id, action, amount_etb, amount_usd, currency, reference_id, metadata, created_at
    ) VALUES (
      v_user_id,
      'referral_bonus',
      v_amount_etb,
      v_amount_usd,
      v_currency,
      p_reference_id,
      jsonb_build_object('bonus_type', 'referral'),
      NOW()
    ) RETURNING id INTO v_history_id;

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'referral_bonus',
      'amount', p_amount,
      'currency', v_currency,
      'balance_etb', (SELECT etb_balance FROM public.balances WHERE user_id = v_user_id),
      'balance_usd', (SELECT usd_balance FROM public.balances WHERE user_id = v_user_id)
    );

  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_transaction_type');
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.process_transaction TO authenticated;

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

-- Balances: Users can only see their own
CREATE POLICY "Users can view own balance" ON public.balances
  FOR SELECT USING (auth.uid() = user_id);

-- History: Users can only see their own
CREATE POLICY "Users can view own history" ON public.history
  FOR SELECT USING (auth.uid() = user_id);

-- Deposits: Users can view and insert their own
CREATE POLICY "Users can view own deposits" ON public.deposits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deposits" ON public.deposits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Withdrawals: Users can view and insert their own
CREATE POLICY "Users can view own withdrawals" ON public.withdrawals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own withdrawals" ON public.withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Investments: Users can view and insert their own
CREATE POLICY "Users can view own investments" ON public.investments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own investments" ON public.investments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- END OF SCHEMA BUILD
-- ============================================================================
