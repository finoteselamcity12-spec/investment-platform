-- ============================================================================
-- DB_FULL_CLEANUP.sql
-- Drops all objects in the public schema (tables, views, functions, sequences, types)
-- WARNING: IRREVERSIBLE. Run only if you have a backup and you intend a full reset.
-- ============================================================================

-- 1) Drop all functions in public schema
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE;', r.proname, r.args);
  END LOOP;
END
$$;

-- 2) Drop all views in public schema
DO $$
DECLARE
  v RECORD;
BEGIN
  FOR v IN
    SELECT table_name FROM information_schema.views WHERE table_schema = 'public'
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE;', v.table_name);
  END LOOP;
END
$$;

-- 3) Drop all materialized views in public schema
DO $$
DECLARE
  mv RECORD;
BEGIN
  FOR mv IN
    SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS public.%I CASCADE;', mv.matviewname);
  END LOOP;
END
$$;

-- 4) Drop all tables in public schema
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE;', t.tablename);
  END LOOP;
END
$$;

-- 5) Drop all sequences in public schema
DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN
    SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE;', s.sequence_name);
  END LOOP;
END
$$;

-- 6) Drop custom types in public schema
DO $$
DECLARE
  tp RECORD;
BEGIN
  FOR tp IN
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typtype IN ('e','c','d') -- enum, composite, domain
  LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE;', tp.typname);
  END LOOP;
END
$$;

-- 7) Remove RLS policies on public tables (if any remain)
DO $$
DECLARE
  tbl RECORD;
  pol RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    BEGIN
      FOR pol IN
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl.tablename
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl.tablename);
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      -- ignore
    END;
  END LOOP;
END
$$;

-- 8) Final quick checks (run manually in SQL editor after execution if you want):
-- List remaining public tables (should be empty):
--   SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public';
-- List remaining public functions (should be empty):
--   SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public';
-- List remaining views:
--   SELECT table_schema, table_name FROM information_schema.views WHERE table_schema = 'public';

-- 9) Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- End of cleanup script
-- After running: execute the verification queries (uncomment above) to confirm
-- ============================================================================
