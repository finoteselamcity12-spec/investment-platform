-- ================================================================
-- 002_fix_unique_constraints.sql
-- Add missing unique constraints/indexes for ON CONFLICT targets
-- ================================================================

-- Fix 1: investment_plans.name
CREATE UNIQUE INDEX IF NOT EXISTS idx_investment_plans_name
ON public.investment_plans(name);

-- Fix 2: payment_methods composite keys
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_method_type_currency_label
ON public.payment_methods(method_type, currency, label);

ALTER TABLE public.payment_methods
  DROP CONSTRAINT IF EXISTS uq_payment_methods_type_currency;
ALTER TABLE public.payment_methods
  ADD CONSTRAINT uq_payment_methods_type_currency
  UNIQUE (method_type, currency);

-- Fix 3: profiles.email
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email
ON public.profiles(email);

-- Fix 4: profiles.referral_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code
ON public.profiles(referral_code);

-- Fix 5: daily_profits(user_id + profit_date)
ALTER TABLE public.daily_profits
  DROP CONSTRAINT IF EXISTS uq_daily_profits_user_date;
ALTER TABLE public.daily_profits
  ADD CONSTRAINT uq_daily_profits_user_date
  UNIQUE (user_id, profit_date);

-- Fix 6: balances.user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_balances_user_id
ON public.balances(user_id);

-- ================================================================
-- Verification
-- ================================================================

-- ✅ Verify all unique constraints exist
SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_type,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
  AND tc.table_name IN (
      'profiles', 'balances', 'deposits', 'withdrawals',
      'history', 'investment_plans', 'investments',
      'daily_profits', 'payment_methods', 'support_tickets'
  )
ORDER BY tc.table_name, kcu.column_name;

SELECT '✅ 002_fix_unique_constraints.sql applied successfully' AS status, NOW() AS at;
