-- Allow deletes on live_sessions for admins or the trainer
DROP POLICY IF EXISTS "Trainers and admins can delete live_sessions" ON live_sessions;
CREATE POLICY "Trainers and admins can delete live_sessions" 
ON live_sessions
FOR DELETE
TO authenticated
USING (
  is_admin() OR trainer_id = (auth.jwt() ->> 'email')
);

DROP POLICY IF EXISTS "Anyone can delete live_participants" ON live_participants;
CREATE POLICY "Anyone can delete live_participants" 
ON live_participants
FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anyone can delete live_messages" ON live_messages;
CREATE POLICY "Anyone can delete live_messages" 
ON live_messages
FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anyone can delete live_presence" ON live_presence;
CREATE POLICY "Anyone can delete live_presence" 
ON live_presence
FOR DELETE
TO authenticated
USING (true);
