-- Migration: Fix Permissive Row Level Security (RLS) Policies
-- Created on: 2026-08-04

-- ────────────────────────────────────────
-- 1. Table quizzes — Only admins can manage quizzes
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Admins have full access to quizzes" ON quizzes;
CREATE POLICY "Admins have full access to quizzes" ON quizzes
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ────────────────────────────────────────
-- 2. Table module_progress — Only admins can manage all progress, clients manage their own
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Admins have full access to progress" ON module_progress;
CREATE POLICY "Admins have full access to progress" ON module_progress
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Nettoyage des anciennes politiques individuelles pour éviter les conflits avec la nouvelle politique "FOR ALL"
DROP POLICY IF EXISTS "Clients can view their own progress" ON module_progress;
DROP POLICY IF EXISTS "Clients can insert their own progress" ON module_progress;
DROP POLICY IF EXISTS "Clients can delete their own progress" ON module_progress;
DROP POLICY IF EXISTS "Clients can manage their own progress" ON module_progress;

CREATE POLICY "Clients can manage their own progress" ON module_progress
  FOR ALL TO authenticated
  USING (auth.uid()::text = client_id::text)
  WITH CHECK (auth.uid()::text = client_id::text);


-- ────────────────────────────────────────
-- 3. Table module_files — Only admins have full access
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Admins have full access to module files" ON module_files;
CREATE POLICY "Admins have full access to module files" ON module_files
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- ────────────────────────────────────────
-- 4. Tables live_messages, live_presence — Delete safety
-- ────────────────────────────────────────
-- live_messages : suppression limitée à l'admin ou à l'auteur du message (user_id)
DROP POLICY IF EXISTS "Anyone can delete live_messages" ON live_messages;
DROP POLICY IF EXISTS "Trainers, admins or self can delete live_messages" ON live_messages;
CREATE POLICY "Trainers, admins or self can delete live_messages" ON live_messages
  FOR DELETE TO authenticated
  USING (is_admin() OR user_id::text = auth.uid()::text);

-- live_presence : suppression limitée à l'admin ou à soi-même
DROP POLICY IF EXISTS "Anyone can delete live_presence" ON live_presence;
DROP POLICY IF EXISTS "Trainers, admins or self can delete live_presence" ON live_presence;
CREATE POLICY "Trainers, admins or self can delete live_presence" ON live_presence
  FOR DELETE TO authenticated
  USING (is_admin() OR user_id::text = auth.uid()::text);


-- ────────────────────────────────────────
-- 5. Storage bucket course-image — Restricted upload/update/delete for admin only
-- ────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;

CREATE POLICY "Admin Upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-image' AND is_admin());

CREATE POLICY "Admin Update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'course-image' AND is_admin());

CREATE POLICY "Admin Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'course-image' AND is_admin());


-- ────────────────────────────────────────
-- 6. Table promo_code — Security analysis & TODO comment
-- ────────────────────────────────────────
-- TODO: à valider avec Pierre au lieu de deviner, et n'applique pas de changement risqué sur ce point précis.
-- Actuellement, la policy "Anyone can view promo codes" permet à tous les visiteurs (y compris anonymes)
-- d'effectuer des requêtes SELECT libres sur toute la table. C'est nécessaire dans l'état actuel de l'application
-- pour valider un code promo saisi par un visiteur non authentifié lors de son inscription (findReferralCode).
-- Si nous restreignions SELECT à "authenticated", cela empêcherait les visiteurs de valider leur code de parrainage.
-- La meilleure solution recommandée : implémenter une fonction PostgreSQL RPC "SECURITY DEFINER" dédiée qui prend
-- un seul paramètre "code_input text" et renvoie les informations de réduction uniquement si le code existe, puis
-- restreindre l'accès SELECT général de la table promo_code aux seuls administrateurs (is_admin()).
-- Pour éviter d'altérer le flux d'inscription critique sans votre accord, nous laissons la policy existante en place
-- pour l'instant avec ce warning.
