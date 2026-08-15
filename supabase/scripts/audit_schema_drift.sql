-- =========================================================================================
-- SCRIPT D'AUDIT DE DÉRIVE DE SCHÉMA (SCHEMA DRIFT DETECTOR)
-- =========================================================================================
-- Objectif : Identifier en un clic dans Supabase Studio tout objet (fonction, trigger, policy)
-- créé manuellement en production et absent des migrations versionnées dans le dépôt Git.
-- =========================================================================================

WITH 
-- 1. Répertoire des fonctions versionnées dans supabase/migrations/
versioned_functions AS (
  SELECT unnest(ARRAY[
    'is_admin',
    'is_trainer',
    'protect_client_profile_role',
    'can_join_live_session',
    'enforce_live_message_author',
    'log_live_session_event'
  ]) AS func_name
),

-- 2. Répertoire des triggers versionnés dans supabase/migrations/
versioned_triggers AS (
  SELECT unnest(ARRAY[
    'tr_protect_client_profile_role',
    'tr_enforce_live_message_author',
    'trg_log_live_session'
  ]) AS trigger_name
),

-- 3. Répertoire des policies RLS versionnées dans supabase/migrations/
versioned_policies AS (
  SELECT unnest(ARRAY[
    -- live_sessions
    'live_sessions_select_policy',
    'live_sessions_insert_policy',
    'live_sessions_update_policy',
    'live_sessions_delete_policy',
    'Trainers and admins can delete live_sessions',
    -- client_profiles
    'client_profiles_select_policy',
    'client_profiles_insert_policy',
    'client_profiles_update_policy',
    'client_profiles_delete_policy',
    'Clients can insert their own profile',
    'Admins can manage all profiles',
    'Admins can view all profiles',
    -- live_presence
    'live_presence_select_policy',
    'live_presence_insert_policy',
    'live_presence_update_policy',
    'live_presence_delete_policy',
    'Trainers, admins or self can delete live_presence',
    'Anyone can delete live_presence',
    -- live_messages
    'live_messages_select_policy',
    'live_messages_insert_policy',
    'live_messages_delete_policy',
    'Trainers, admins or self can delete live_messages',
    'Anyone can delete live_messages',
    -- session_recordings & storage
    'session_recordings_select_policy',
    'session_recordings_insert_policy',
    'session_recordings_delete_policy',
    'live_recordings_storage_select',
    'live_recordings_storage_insert',
    'live_recordings_storage_delete',
    'Admin Upload',
    'Admin Update',
    'Admin Delete',
    -- realtime
    'realtime_live_room_authorization',
    -- courses & modules & registrations & base tables
    'Courses are viewable by everyone',
    'Anyone can manage trainers',
    'Anyone can manage courses',
    'Anyone can manage course modules',
    'Anyone can manage registrations',
    'Admins can manage templates',
    'Admins can manage testimonials',
    'Admins can manage proposals',
    'Admins have full access to all messages',
    -- quizzes & progress & promo & service requests
    'Admins have full access to quizzes',
    'Admins have full access to progress',
    'Clients can manage their own progress',
    'Admins have full access to module files',
    'Allow public insert on quiz_results',
    'Allow admin read on quiz_results',
    'Allow admin delete on quiz_results',
    'Allow public insert on quiz_challenge_leads',
    'Allow admin read on quiz_challenge_leads',
    'Allow admin delete on quiz_challenge_leads',
    'Anyone can view promo codes',
    'Admins can manage promo codes',
    'Allow read access to admin_users',
    'Allow superadmin insert/delete on admin_users',
    'Anyone can insert a service request',
    'Admins can view all service requests',
    'Admins can update service requests',
    'Admins can delete service requests',
    'Anyone can delete live_participants'
  ]) AS policy_name
),

-- Analyse des fonctions actuelles dans le schéma public
live_functions AS (
  SELECT 
    'FUNCTION' AS object_type,
    p.proname AS object_name,
    'public' AS target_table,
    CASE 
      WHEN vf.func_name IS NOT NULL THEN 'OK_VERSIONED'
      ELSE 'DRIFT_UNTRACKED'
    END AS audit_status,
    pg_get_function_arguments(p.oid) AS details
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  LEFT JOIN versioned_functions vf ON vf.func_name = p.proname
  WHERE n.nspname = 'public'
    -- Exclure les fonctions internes générées par des extensions courantes (pg_stat, etc.)
    AND p.proname NOT LIKE 'pg_%'
),

-- Analyse des triggers actuels sur les tables du schéma public
live_triggers AS (
  SELECT 
    'TRIGGER' AS object_type,
    t.tgname AS object_name,
    c.relname AS target_table,
    CASE 
      WHEN vt.trigger_name IS NOT NULL THEN 'OK_VERSIONED'
      ELSE 'DRIFT_UNTRACKED'
    END AS audit_status,
    'Attached to table public.' || c.relname AS details
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN versioned_triggers vt ON vt.trigger_name = t.tgname
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
),

-- Analyse des policies RLS actuelles
live_policies AS (
  SELECT 
    'RLS_POLICY' AS object_type,
    pol.policyname AS object_name,
    pol.schemaname || '.' || pol.tablename AS target_table,
    CASE 
      WHEN vp.policy_name IS NOT NULL THEN 'OK_VERSIONED'
      ELSE 'DRIFT_UNTRACKED'
    END AS audit_status,
    'Command: ' || pol.cmd || ' | Roles: ' || array_to_string(pol.roles, ', ') AS details
  FROM pg_policies pol
  LEFT JOIN versioned_policies vp ON vp.policy_name = pol.policyname
  WHERE pol.schemaname IN ('public', 'storage', 'realtime')
)

-- Rapport consolidé
SELECT 
  CASE 
    WHEN audit_status = 'DRIFT_UNTRACKED' THEN '⚠️ NON VERSIONNÉ (DÉRIVE DÉTECTÉE)'
    ELSE '✅ VERSIONNÉ (CONFORME)'
  END AS statut,
  object_type AS type_objet,
  object_name AS nom_objet,
  target_table AS table_cible,
  details AS details
FROM (
  SELECT * FROM live_functions
  UNION ALL
  SELECT * FROM live_triggers
  UNION ALL
  SELECT * FROM live_policies
) consolidated
ORDER BY 
  audit_status ASC, -- Les DRIFT_UNTRACKED apparaissent en premier
  object_type ASC,
  object_name ASC;
