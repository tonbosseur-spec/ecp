-- Migration: Secure Roles and live_sessions RLS Policies

-- 1. Add role column to client_profiles if not exists
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client';

-- 2. Drop potential foreign key constraints that prevent altering trainer_id / course_id
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_trainer_id_fkey;
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_trainer_id_fk;
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS fk_trainer;
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_course_id_fkey;

-- 3. Alter columns to TEXT to avoid UUID vs TEXT type mismatch
ALTER TABLE public.live_sessions ALTER COLUMN trainer_id TYPE TEXT USING trainer_id::text;
ALTER TABLE public.live_sessions ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE public.live_sessions ALTER COLUMN course_id TYPE TEXT USING course_id::text;

-- 4. Create or update is_admin() helper function with explicit cast
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'email' = 'pmbom@ecp.cm')
    OR EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE id::text = auth.uid()::text AND role = 'admin'
    ),
    false
  );
$$;

-- 5. Create is_trainer() helper function with explicit cast
CREATE OR REPLACE FUNCTION public.is_trainer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE id::text = auth.uid()::text AND role = 'trainer'
    ),
    false
  );
$$;

-- 6. Enable RLS on live_sessions
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

-- Drop legacy/conflicting policies
DROP POLICY IF EXISTS "Trainers and admins can delete live_sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.live_sessions;
DROP POLICY IF EXISTS "Anyone can read live_sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Admins and trainers can insert live_sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Admins and trainers can update live_sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "live_sessions_select_policy" ON public.live_sessions;
DROP POLICY IF EXISTS "live_sessions_insert_policy" ON public.live_sessions;
DROP POLICY IF EXISTS "live_sessions_update_policy" ON public.live_sessions;
DROP POLICY IF EXISTS "live_sessions_delete_policy" ON public.live_sessions;
DROP POLICY IF EXISTS "Anyone can view live sessions" ON public.live_sessions;

-- Policy 1: SELECT
-- Public can read non-private sessions; authenticated users, trainers, and admins can read all sessions.
CREATE POLICY "live_sessions_select_policy" ON public.live_sessions
FOR SELECT
USING (
  is_private = false OR auth.role() = 'authenticated'
);

-- Policy 2: INSERT
-- Admin can insert any session.
-- Trainer can insert ONLY IF is_trainer() AND trainer_id match.
CREATE POLICY "live_sessions_insert_policy" ON public.live_sessions
FOR INSERT TO authenticated
WITH CHECK (
  is_admin() OR (
    is_trainer() AND (
      trainer_id::text = (auth.jwt() ->> 'email') OR
      trainer_id::text = auth.uid()::text
    )
  )
);

-- Policy 3: UPDATE
CREATE POLICY "live_sessions_update_policy" ON public.live_sessions
FOR UPDATE TO authenticated
USING (
  is_admin() OR (
    is_trainer() AND (
      trainer_id::text = (auth.jwt() ->> 'email') OR
      trainer_id::text = auth.uid()::text
    )
  )
)
WITH CHECK (
  is_admin() OR (
    is_trainer() AND (
      trainer_id::text = (auth.jwt() ->> 'email') OR
      trainer_id::text = auth.uid()::text
    )
  )
);

-- Policy 4: DELETE
CREATE POLICY "live_sessions_delete_policy" ON public.live_sessions
FOR DELETE TO authenticated
USING (
  is_admin() OR (
    is_trainer() AND (
      trainer_id::text = (auth.jwt() ->> 'email') OR
      trainer_id::text = auth.uid()::text
    )
  )
);
