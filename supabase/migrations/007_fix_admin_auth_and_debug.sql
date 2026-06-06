-- Fix admin RPC returning empty / not_admin when JWT email claim is missing
-- Run in Supabase SQL Editor, then: NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT lower(trim(email)) = lower('workinehabche@gmail.com')
      FROM auth.users
      WHERE id = auth.uid()
    ),
    lower(trim(COALESCE(auth.jwt() ->> 'email', ''))) = lower('workinehabche@gmail.com'),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_debug_auth()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN json_build_object(
    'auth_uid', auth.uid(),
    'jwt_email', auth.jwt() ->> 'email',
    'auth_users_email', (SELECT email FROM auth.users WHERE id = auth.uid()),
    'is_admin', public.is_admin(),
    'profiles_count', (SELECT COUNT(*)::INTEGER FROM public.profiles),
    'pending_deposits_count', (SELECT COUNT(*)::INTEGER FROM public.deposits WHERE status = 'pending'),
    'pending_withdrawals_count', (SELECT COUNT(*)::INTEGER FROM public.withdrawals WHERE status = 'pending')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_debug_auth() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  etb_balance NUMERIC(18,4),
  usd_balance NUMERIC(18,4),
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
    p.id,
    p.email,
    p.full_name,
    COALESCE(b.etb_balance, 0),
    COALESCE(b.usd_balance, 0),
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.balances b ON b.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

NOTIFY pgrst, 'reload schema';
