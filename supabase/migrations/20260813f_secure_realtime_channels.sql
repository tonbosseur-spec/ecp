-- Migration: Secure Supabase Realtime Private Channels using RLS on realtime.messages

-- 1. Enable Row Level Security on realtime.messages table
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policy if any
DROP POLICY IF EXISTS "realtime_live_room_authorization" ON realtime.messages;

-- 3. Create RLS Policy for Realtime Private Channels
-- Allows subscription to live-room-* channels ONLY if user is Admin or authorized via can_join_live_session()
CREATE POLICY "realtime_live_room_authorization" ON realtime.messages
FOR SELECT TO authenticated
USING (
  -- Check if the topic belongs to a live-room channel
  topic LIKE 'live-room-%'
  AND (
    public.is_admin()
    OR public.can_join_live_session(split_part(topic, 'live-room-', 2))
  )
);
