-- Migration: Secure live_messages table, enforce user_id matching auth.uid(), set official user_name, and enforce session authorization

-- 1. Trigger function to enforce official user_name from client_profiles and check user_id
CREATE OR REPLACE FUNCTION public.enforce_live_message_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_official_name text;
BEGIN
  -- Strict user_id validation: user_id MUST match auth.uid()
  IF NEW.user_id IS NULL OR NEW.user_id::text <> auth.uid()::text THEN
    RAISE EXCEPTION 'Usurpation d''identité interdite: user_id doit correspondre à votre identifiant authentifié.'
      USING ERRCODE = '42501';
  END IF;

  -- Retrieve official name from client_profiles for auth.uid()
  SELECT TRIM(CONCAT(first_name, ' ', last_name))
  INTO v_official_name
  FROM public.client_profiles
  WHERE id = auth.uid();

  -- Override or assign user_name with official profile name
  IF v_official_name IS NOT NULL AND v_official_name <> '' THEN
    NEW.user_name := v_official_name;
  ELSIF NEW.user_name IS NULL OR TRIM(NEW.user_name) = '' THEN
    NEW.user_name := COALESCE(auth.jwt() ->> 'email', 'Utilisateur');
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Attach Trigger to live_messages
DROP TRIGGER IF EXISTS tr_enforce_live_message_author ON public.live_messages;

CREATE TRIGGER tr_enforce_live_message_author
BEFORE INSERT ON public.live_messages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_live_message_author();

-- 3. Enable Row Level Security on live_messages
ALTER TABLE public.live_messages ENABLE ROW LEVEL SECURITY;

-- 4. Clean up existing/legacy policies
DROP POLICY IF EXISTS "Anyone can delete live_messages" ON public.live_messages;
DROP POLICY IF EXISTS "Trainers, admins or self can delete live_messages" ON public.live_messages;
DROP POLICY IF EXISTS "live_messages_select_policy" ON public.live_messages;
DROP POLICY IF EXISTS "live_messages_insert_policy" ON public.live_messages;
DROP POLICY IF EXISTS "live_messages_update_policy" ON public.live_messages;
DROP POLICY IF EXISTS "live_messages_delete_policy" ON public.live_messages;

-- 5. Create new strict RLS policies

-- SELECT Policy: Allowed if Admin OR authorized to join session
CREATE POLICY "live_messages_select_policy" ON public.live_messages
FOR SELECT TO authenticated
USING (
  is_admin() OR can_join_live_session(session_id)
);

-- INSERT Policy: Authenticated user, user_id MUST equal auth.uid(), AND authorized to join session
CREATE POLICY "live_messages_insert_policy" ON public.live_messages
FOR INSERT TO authenticated
WITH CHECK (
  user_id::text = auth.uid()::text
  AND can_join_live_session(session_id)
);

-- DELETE Policy: Admin, Author of message, OR Trainer responsible for session
CREATE POLICY "live_messages_delete_policy" ON public.live_messages
FOR DELETE TO authenticated
USING (
  is_admin()
  OR user_id::text = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.live_sessions s
    WHERE (s.id = session_id OR s.room_code = session_id)
      AND (s.trainer_id = (auth.jwt() ->> 'email') OR s.trainer_id = auth.uid()::text)
  )
);
