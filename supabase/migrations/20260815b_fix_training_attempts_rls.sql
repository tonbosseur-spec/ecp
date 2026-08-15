-- ====================================================================
-- Migration: Fix RLS permissions for training_attempts & training_exercise_attempts
-- Allows authenticated students to update their own training session attempts and exercise attempts
-- ====================================================================

-- 1. Enable client UPDATE policy for training_attempts
DROP POLICY IF EXISTS "training_attempts_client_update" ON public.training_attempts;
CREATE POLICY "training_attempts_client_update" ON public.training_attempts
FOR UPDATE TO authenticated
USING (client_id::text = auth.uid()::text)
WITH CHECK (client_id::text = auth.uid()::text);

-- 2. Enable client UPDATE policy for training_exercise_attempts
DROP POLICY IF EXISTS "training_exercise_attempts_client_update" ON public.training_exercise_attempts;
CREATE POLICY "training_exercise_attempts_client_update" ON public.training_exercise_attempts
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.training_attempts ta
    WHERE ta.id = attempt_id
      AND ta.client_id::text = auth.uid()::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.training_attempts ta
    WHERE ta.id = attempt_id
      AND ta.client_id::text = auth.uid()::text
  )
);
