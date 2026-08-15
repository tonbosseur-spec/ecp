-- Migration: 20260814_fix_live_session_creation.sql
-- Description: Fixes trigger log_live_session_event type mismatch (uuid vs text),
-- harmonizes audit_log.entity_id type to TEXT, and removes obsolete permissive policies on live_sessions.

-- ====================================================================
-- 1. Harmonize audit_log.entity_id to TEXT
-- (Allows non-UUID entity IDs such as 'live-' || timestamp)
-- ====================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'audit_log' 
      AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE public.audit_log ALTER COLUMN entity_id TYPE TEXT USING entity_id::text;
  END IF;
END $$;

-- ====================================================================
-- 2. Correct log_live_session_event() trigger function
-- (Explicit cast id::text = NEW.course_id to prevent 42883 uuid = text error)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.log_live_session_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_course_title TEXT;
BEGIN
  IF NEW.course_id IS NOT NULL AND NEW.course_id <> '' THEN
    SELECT title INTO v_course_title 
    FROM public.courses 
    WHERE id::text = NEW.course_id;
  END IF;

  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_log'
  ) THEN
    INSERT INTO public.audit_log (actor_role, action, entity_type, entity_id, summary, link)
    VALUES (
      'admin', 
      'insert', 
      'session', 
      NEW.id::text,
      'Session live "' || COALESCE(NEW.title, 'Sans titre') || '"' || 
        CASE WHEN v_course_title IS NOT NULL THEN ' (' || v_course_title || ')' ELSE '' END || 
        ' programmée.',
      '/live'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger is attached to live_sessions
DROP TRIGGER IF EXISTS trg_log_live_session ON public.live_sessions;
CREATE TRIGGER trg_log_live_session
  AFTER INSERT ON public.live_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_live_session_event();

-- ====================================================================
-- 3. Clean up obsolete and redundant permissive policies on live_sessions
-- (Removes open with_check = true policies that bypassed real RLS rules)
-- ====================================================================
DROP POLICY IF EXISTS "Accès insertion sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Accès lecture sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Accès mise à jour sessions" ON public.live_sessions;
