-- ================================================================
-- 017_authenticated_public_permissions.sql
-- Grant authenticated users access to public schema tables
-- ================================================================

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO authenticated;

-- Optional: keep future tables accessible to authenticated users
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
