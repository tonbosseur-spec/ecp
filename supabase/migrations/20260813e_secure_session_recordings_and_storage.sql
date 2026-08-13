-- Migration: Create session_recordings table, private live-recordings bucket, and RLS policies

-- 1. Create session_recordings table
CREATE TABLE IF NOT EXISTS public.session_recordings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  recording_url TEXT,
  duration_seconds INTEGER DEFAULT 0,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security on session_recordings
ALTER TABLE public.session_recordings ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies on session_recordings
DROP POLICY IF EXISTS "session_recordings_select_policy" ON public.session_recordings;
DROP POLICY IF EXISTS "session_recordings_insert_policy" ON public.session_recordings;
DROP POLICY IF EXISTS "session_recordings_delete_policy" ON public.session_recordings;

-- RLS Policy: SELECT session_recordings
-- Allowed if Admin OR authorized to join session
CREATE POLICY "session_recordings_select_policy" ON public.session_recordings
FOR SELECT TO authenticated
USING (
  public.is_admin() OR public.can_join_live_session(session_id)
);

-- RLS Policy: INSERT session_recordings
-- Allowed if user_id matches auth.uid() AND user is Admin OR Trainer responsible for the session
CREATE POLICY "session_recordings_insert_policy" ON public.session_recordings
FOR INSERT TO authenticated
WITH CHECK (
  user_id::text = auth.uid()::text
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.live_sessions s
      WHERE (s.id::text = session_id::text OR s.room_code::text = session_id::text)
        AND (s.trainer_id::text = (auth.jwt() ->> 'email') OR s.trainer_id::text = auth.uid()::text)
    )
  )
);

-- RLS Policy: DELETE session_recordings
-- Allowed if Admin OR Trainer responsible for the session
CREATE POLICY "session_recordings_delete_policy" ON public.session_recordings
FOR DELETE TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.live_sessions s
    WHERE (s.id::text = session_id::text OR s.room_code::text = session_id::text)
      AND (s.trainer_id::text = (auth.jwt() ->> 'email') OR s.trainer_id::text = auth.uid()::text)
  )
);

-- 2. Configure Private Storage Bucket live-recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('live-recordings', 'live-recordings', false, 5368709120, ARRAY['video/webm', 'video/mp4', 'video/mkv'])
ON CONFLICT (id) DO UPDATE SET public = false;

-- Clean up storage policies for live-recordings bucket
DROP POLICY IF EXISTS "live_recordings_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "live_recordings_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "live_recordings_storage_delete" ON storage.objects;

-- Storage RLS Policy: SELECT
CREATE POLICY "live_recordings_storage_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'live-recordings'
  AND (
    public.is_admin()
    OR public.can_join_live_session(split_part(name, '/', 1))
  )
);

-- Storage RLS Policy: INSERT
CREATE POLICY "live_recordings_storage_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'live-recordings'
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.live_sessions s
      WHERE (s.id::text = split_part(name, '/', 1) OR s.room_code::text = split_part(name, '/', 1))
        AND (s.trainer_id::text = (auth.jwt() ->> 'email') OR s.trainer_id::text = auth.uid()::text)
    )
  )
);

-- Storage RLS Policy: DELETE
CREATE POLICY "live_recordings_storage_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'live-recordings'
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.live_sessions s
      WHERE (s.id::text = split_part(name, '/', 1) OR s.room_code::text = split_part(name, '/', 1))
        AND (s.trainer_id::text = (auth.jwt() ->> 'email') OR s.trainer_id::text = auth.uid()::text)
    )
  )
);
