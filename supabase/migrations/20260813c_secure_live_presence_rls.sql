-- Migration: Secure live_presence table with strict RLS policies and session access authorization helper

-- 1. Helper function: check if authenticated user can join a live session
CREATE OR REPLACE FUNCTION public.can_join_live_session(p_session_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.live_sessions s
    WHERE (s.id::text = p_session_id OR s.room_code::text = p_session_id)
      AND (
        public.is_admin()
        OR s.trainer_id::text = (auth.jwt() ->> 'email')
        OR s.trainer_id::text = auth.uid()::text
        OR s.course_id IS NULL
        OR s.course_id = ''
        OR EXISTS (
          SELECT 1 FROM public.registrations r
          WHERE r.client_id::text = auth.uid()::text
            AND r.course_id::text = s.course_id::text
            AND r.payment_status = 'approved'
        )
      )
  );
$$;

-- 2. Enable RLS on live_presence
ALTER TABLE public.live_presence ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing/legacy policies on live_presence
DROP POLICY IF EXISTS "Anyone can delete live_presence" ON public.live_presence;
DROP POLICY IF EXISTS "Trainers, admins or self can delete live_presence" ON public.live_presence;
DROP POLICY IF EXISTS "live_presence_select_policy" ON public.live_presence;
DROP POLICY IF EXISTS "live_presence_insert_policy" ON public.live_presence;
DROP POLICY IF EXISTS "live_presence_update_policy" ON public.live_presence;
DROP POLICY IF EXISTS "live_presence_delete_policy" ON public.live_presence;

-- 4. Create new strict RLS policies

-- SELECT Policy
-- Authenticated users can view presence records for authorized sessions
CREATE POLICY "live_presence_select_policy" ON public.live_presence
FOR SELECT TO authenticated
USING (
  is_admin() OR can_join_live_session(session_id)
);

-- INSERT Policy
-- User can insert presence ONLY for themselves (user_id = auth.uid()) AND if authorized to join the session
CREATE POLICY "live_presence_insert_policy" ON public.live_presence
FOR INSERT TO authenticated
WITH CHECK (
  is_admin() OR (
    user_id::text = auth.uid()::text
    AND can_join_live_session(session_id)
  )
);

-- UPDATE Policy
-- User can update ONLY their own presence (user_id = auth.uid()) and CANNOT change user_id or session_id
CREATE POLICY "live_presence_update_policy" ON public.live_presence
FOR UPDATE TO authenticated
USING (
  is_admin() OR user_id::text = auth.uid()::text
)
WITH CHECK (
  is_admin() OR (
    user_id::text = auth.uid()::text
    AND can_join_live_session(session_id)
  )
);

-- DELETE Policy
-- User can delete their own presence, Trainer can delete presence in their session, Admin can delete any
CREATE POLICY "live_presence_delete_policy" ON public.live_presence
FOR DELETE TO authenticated
USING (
  is_admin()
  OR user_id::text = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.live_sessions s
    WHERE (s.id = session_id OR s.room_code = session_id)
      AND s.trainer_id = (auth.jwt() ->> 'email')
  )
);
