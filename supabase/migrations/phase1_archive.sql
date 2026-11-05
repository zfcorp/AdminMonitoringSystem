-- ============================================================
-- ARCHIVE MODULE — Phase 1 Migration
-- Zurich Finance Admin Monitoring System
-- ============================================================
-- Run this in Supabase SQL Editor.
-- Safe to re-run. All changes are additive.
-- Zero existing records are modified or deleted.
-- ============================================================


-- ── Step 1: Archive columns on records ───────────────────────

ALTER TABLE records
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID;

CREATE INDEX IF NOT EXISTS idx_records_is_archived
  ON records (is_archived);

CREATE INDEX IF NOT EXISTS idx_records_module_archived
  ON records (module, is_archived);


-- ── Step 2: Profiles table ────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'user'
               CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create a user-role profile for every new auth signup.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── Step 3: RLS on profiles ───────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"     ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"     ON profiles;
DROP POLICY IF EXISTS "profiles_insert_service" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_service" ON profiles;

-- Users can read only their own profile row.
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Users can update their own row but cannot elevate their role.
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- Only service_role (Supabase dashboard / migrations) can
-- insert or delete profile rows directly.
CREATE POLICY "profiles_insert_service" ON profiles
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "profiles_delete_service" ON profiles
  FOR DELETE TO service_role
  USING (true);


-- ── Step 4: is_admin() helper ─────────────────────────────────

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;


-- ── Step 5: Tighten RLS on records ───────────────────────────

DROP POLICY IF EXISTS "records_all"    ON records;
DROP POLICY IF EXISTS "records_select" ON records;
DROP POLICY IF EXISTS "records_insert" ON records;
DROP POLICY IF EXISTS "records_update" ON records;
DROP POLICY IF EXISTS "records_delete" ON records;

CREATE POLICY "records_select" ON records
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "records_insert" ON records
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Non-admins cannot write to is_archived / archived_at / archived_by.
CREATE POLICY "records_update" ON records
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    is_admin()
    OR (
      is_archived = (SELECT r.is_archived FROM records r WHERE r.id = records.id)
      AND archived_at IS NOT DISTINCT FROM (SELECT r.archived_at FROM records r WHERE r.id = records.id)
      AND archived_by IS NOT DISTINCT FROM (SELECT r.archived_by FROM records r WHERE r.id = records.id)
    )
  );

-- Hard-delete is admin-only at the database level.
CREATE POLICY "records_delete" ON records
  FOR DELETE TO authenticated
  USING (is_admin());


-- ── Step 6: Backfill profiles for existing users ─────────────

INSERT INTO public.profiles (id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- ── Step 7: Promote initial admin ────────────────────────────
-- Replace the email below with the actual admin email.
-- Run this AFTER the migration completes.
-- IMPORTANT: change the email to your actual admin account.

-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE id = (
--   SELECT id FROM auth.users
--   WHERE email = 'zurichfinanceit@gmail.com'
-- );


-- ── Reload schema cache ───────────────────────────────────────

NOTIFY pgrst, 'reload schema';
