-- ============================================================================
-- Supabase hardening — RUN THIS AFTER db:reset AND seed, EVERY TIME
--
-- WHY THIS EXISTS
--
-- Supabase automatically publishes every table in the `public` schema through
-- PostgREST, its auto-generated REST API. That API is reachable with the
-- project's `anon` key — a key that is public by design and normally lives in
-- browser JavaScript.
--
-- SmartStock does not use that API. The Express server connects directly as
-- the `postgres` role, so it is unaffected either way. But leaving the tables
-- exposed means anyone holding the anon key could read the users table, every
-- product and price, and the full purchase order history, straight from the
-- internet, without ever touching this application.
--
-- This script closes that door in two independent ways: it takes the grants
-- away, and it turns on row level security with no policies so that even if a
-- grant were restored the rows would still be invisible.
--
-- HOW TO RUN IT
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Re-run it after any db:reset, because dropping and recreating the tables
-- also drops these settings.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Remove PostgREST's access
--
-- `anon`          the public key used by unauthenticated browser clients
-- `authenticated` the key used once a user signs in via Supabase Auth, which
--                 this project does not use — SmartStock has its own sessions
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;

-- Stop future tables inheriting access if any are added later.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Turn on row level security, with no policies
--
-- With RLS enabled and no policy defined, every row is invisible to any role
-- that is subject to RLS. The table owner is not subject to it by default,
-- which is exactly what we want: the application keeps full access, and
-- everything arriving through PostgREST sees nothing.
-- ---------------------------------------------------------------------------

ALTER TABLE public.suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session              ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Confirm it worked
--
-- Every table should report rls_enabled = true, and anon_can_select = false.
-- ---------------------------------------------------------------------------

SELECT c.relname                                   AS table_name,
       c.relrowsecurity                            AS rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_select
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
 ORDER BY c.relname;
