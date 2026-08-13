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

-- Recréer les bonnes
CREATE POLICY "live_sessions_select_policy" ON public.live_sessions
FOR SELECT TO authenticated
USING (true); -- Everybody can read sessions (or restrict to enrolled)

CREATE POLICY "live_sessions_insert_policy" ON public.live_sessions
FOR INSERT TO authenticated
WITH CHECK (
  is_admin() OR (
    is_trainer() AND trainer_id = (auth.jwt() ->> 'email')
  )
);

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

CREATE POLICY "live_sessions_delete_policy" ON public.live_sessions
FOR DELETE TO authenticated
USING (
  is_admin() OR (
    is_trainer() AND trainer_id = (auth.jwt() ->> 'email')
  )
);
