-- Migration: Secure Roles and live_sessions RLS Policies

-- 1. Add role column to client_profiles if not exists
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client';

-- 2. Create or update is_admin() helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'email' = 'pmbom@ecp.cm')
    OR EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE id = auth.uid() AND role = 'admin'
    ),
    false
  );
$$;

-- 3. Create is_trainer() helper function
CREATE OR REPLACE FUNCTION public.is_trainer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE id = auth.uid() AND role = 'trainer'
    ),
    false
  );
$$;

-- 4. Enable RLS on live_sessions
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

-- Policy 1: SELECT
-- Public can read non-private sessions; authenticated users, trainers, and admins can read all sessions.
CREATE POLICY "live_sessions_select_policy" ON public.live_sessions
FOR SELECT
USING (
  is_private = false OR auth.role() = 'authenticated'
);

-- Policy 2: INSERT
-- Admin can insert any session.
-- Trainer can insert ONLY IF is_trainer() AND trainer_id = (auth.jwt() ->> 'email').
-- Client CANNOT insert.
CREATE POLICY "live_sessions_insert_policy" ON public.live_sessions
FOR INSERT TO authenticated
WITH CHECK (
  is_admin() OR (
    is_trainer() AND trainer_id = (auth.jwt() ->> 'email')
  )
);

-- Policy 3: UPDATE
-- Admin can update any session.
-- Trainer can update ONLY IF is_trainer() AND trainer_id = (auth.jwt() ->> 'email').
-- Client CANNOT update.
CREATE POLICY "live_sessions_update_policy" ON public.live_sessions
FOR UPDATE TO authenticated
USING (
  is_admin() OR (
    is_trainer() AND trainer_id = (auth.jwt() ->> 'email')
  )
)
WITH CHECK (
  is_admin() OR (
    is_trainer() AND trainer_id = (auth.jwt() ->> 'email')
  )
);

-- Policy 4: DELETE
-- Admin can delete any session.
-- Trainer can delete ONLY IF is_trainer() AND trainer_id = (auth.jwt() ->> 'email').
-- Client CANNOT delete.
CREATE POLICY "live_sessions_delete_policy" ON public.live_sessions
FOR DELETE TO authenticated
USING (
  is_admin() OR (
    is_trainer() AND trainer_id = (auth.jwt() ->> 'email')
  )
);
