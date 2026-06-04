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

NOTIFY pgrst, 'reload schema';
