-- ====================================================================
-- Migration: 20260818b_interactive_courses_system.sql
-- Description: Schéma de base de données, sécurité RLS avancée, stockage sécurisé
--              et fonctions de droits d'accès pour le nouveau système de 
--              Cours Interactifs Autonomes (ECP).
-- ====================================================================

-- 1. FONCTIONS DE SÉCURITÉ CENTRALISÉES

-- Fonction d'autorisation d'accès centralisée aux cours
CREATE OR REPLACE FUNCTION public.has_interactive_course_access(p_user_id UUID, p_course_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_access_policy JSONB;
    v_status TEXT;
    v_policy_type TEXT;
BEGIN
    -- A. Si l'utilisateur est administrateur, accès complet accordé d'office
    IF public.is_admin() THEN
        RETURN true;
    END IF;

    -- B. Récupérer le statut et la politique d'accès du cours
    SELECT status, access_policy INTO v_status, v_access_policy
    FROM public.interactive_courses
    WHERE id = p_course_id;

    -- Si le cours n'existe pas ou n'est pas publié, refuser l'accès aux étudiants
    IF v_status IS DISTINCT FROM 'published' THEN
        RETURN false;
    END IF;

    -- Extraire le type de politique
    v_policy_type := v_access_policy->>'type';

    -- C. Évaluation selon le type d'accès
    IF v_policy_type = 'free' THEN
        -- Cours gratuits accessibles à tout le monde
        RETURN true;
    ELSIF v_policy_type = 'premium' THEN
        -- Accès premium : restreint aux administrateurs pour le moment 
        -- (Prépare le raccordement futur des achats et abonnements)
        RETURN false;
    ELSIF v_policy_type = 'linked_course' THEN
        -- Lié à une formation synchrone/live existante (via public.registrations)
        RETURN EXISTS (
            SELECT 1 FROM public.registrations r
            WHERE r.course_id = (v_access_policy->>'linked_course_id')::UUID
              AND r.client_id::text = p_user_id::text
              AND r.payment_status = 'approved'
        );
    ELSIF v_policy_type = 'restricted' THEN
        -- Accès restreint à un domaine d'e-mail spécifique (ex : @ecp.cm)
        RETURN EXISTS (
            SELECT 1 FROM auth.users u
            WHERE u.id = p_user_id
              AND u.email LIKE '%' || (v_access_policy->>'allowed_domain')
        );
    ELSE
        -- Politique inconnue ou manquante : par sécurité, accès refusé
        RETURN false;
    END IF;
END;
$$;


-- 2. TABLES DU SYSTÈME PÉDAGOGIQUE

-- Table: interactive_courses (Cours de formation autonomes)
CREATE TABLE IF NOT EXISTS public.interactive_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    cover_image TEXT,
    level TEXT NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    category TEXT NOT NULL DEFAULT 'R' CHECK (category IN ('R', 'Excel', 'Power BI', 'SQL', 'Python', 'DAX', 'General')),
    estimated_duration INTEGER NOT NULL DEFAULT 0, -- en minutes
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    access_policy JSONB NOT NULL DEFAULT '{"type": "free"}'::jsonb, -- Config extensible
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

-- Table: interactive_course_modules (Chapitres d'un cours)
CREATE TABLE IF NOT EXISTS public.interactive_course_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.interactive_courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: interactive_course_lessons (Leçons d'un module)
CREATE TABLE IF NOT EXISTS public.interactive_course_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES public.interactive_course_modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    estimated_duration INTEGER NOT NULL DEFAULT 5, -- en minutes
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: interactive_activities (Activités d'apprentissage)
CREATE TABLE IF NOT EXISTS public.interactive_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.interactive_course_lessons(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'text', 'video', 'image', 'quiz', 'code_r', 'challenge', 'assessment',
        'code_python', 'code_sql', 'code_excel', 'code_dax'
    )),
    title TEXT NOT NULL,
    instructions TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT true,
    points INTEGER NOT NULL DEFAULT 10,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb, -- starter_code, options de QCM (sans bonnes réponses)
    hints JSONB NOT NULL DEFAULT '[]'::jsonb,        -- progressive hints
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table SECRÈTE: interactive_activity_secrets (Bonnes réponses & validation, inaccessible aux étudiants)
CREATE TABLE IF NOT EXISTS public.interactive_activity_secrets (
    activity_id UUID PRIMARY KEY REFERENCES public.interactive_activities(id) ON DELETE CASCADE,
    correct_answers JSONB,                 -- ex: pour QCM unique ou multiple [1] ou [0, 2]
    validation_rules JSONB,                -- critères déclaratifs de validation R sémantique
    reference_solution TEXT,               -- code corrigé ou réponse type
    internal_parameters JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: interactive_activity_progress (Suivi de progression - RESTRICTED ON DELETE)
CREATE TABLE IF NOT EXISTS public.interactive_activity_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, -- Interdit de supprimer un cours ou utilisateur avec de l'activité
    activity_id UUID NOT NULL REFERENCES public.interactive_activities(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
    is_completed BOOLEAN NOT NULL DEFAULT false,
    is_passed BOOLEAN NOT NULL DEFAULT false,
    best_score INTEGER NOT NULL DEFAULT 0,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_activity UNIQUE (user_id, activity_id)
);

-- Table: interactive_activity_attempts (Audit unitaire des tentatives - RESTRICTED ON DELETE)
CREATE TABLE IF NOT EXISTS public.interactive_activity_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, -- Interdit de purger accidentellement
    activity_id UUID NOT NULL REFERENCES public.interactive_activities(id) ON DELETE RESTRICT,
    submitted_answer JSONB NOT NULL,       -- Code entré ou choix du quiz soumis
    score INTEGER NOT NULL DEFAULT 0,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    feedback TEXT,
    execution_error TEXT,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ====================================================================
-- 3. INDEX DE PERFORMANCE OPTIMISÉS (Sans redondances)
-- ====================================================================

-- Index simples pour les jointures rapides de navigation
CREATE INDEX IF NOT EXISTS idx_interactive_modules_course_id ON public.interactive_course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_interactive_lessons_module_id ON public.interactive_course_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_interactive_activities_lesson_id ON public.interactive_activities(lesson_id);
CREATE INDEX IF NOT EXISTS idx_interactive_progress_activity_id ON public.interactive_activity_progress(activity_id);
CREATE INDEX IF NOT EXISTS idx_interactive_attempts_activity_id ON public.interactive_activity_attempts(activity_id);

-- Index composites pour le calcul rapide de progression globale
CREATE INDEX IF NOT EXISTS idx_interactive_progress_status ON public.interactive_activity_progress(status);
CREATE INDEX IF NOT EXISTS idx_interactive_attempts_user_activity_date ON public.interactive_activity_attempts(user_id, activity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactive_courses_status ON public.interactive_courses(status);


-- ====================================================================
-- 4. ACTIVATION DE ROW LEVEL SECURITY (RLS)
-- ====================================================================

ALTER TABLE public.interactive_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_activity_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_activity_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_activity_attempts ENABLE ROW LEVEL SECURITY;


-- ====================================================================
-- 5. POLITIQUES DE SÉCURITÉ RLS SÉCURISÉES (Anti-triche & Permissions)
-- ====================================================================

-- A. Table: interactive_courses
DROP POLICY IF EXISTS "interactive_courses_select_policy" ON public.interactive_courses;
CREATE POLICY "interactive_courses_select_policy" ON public.interactive_courses
FOR SELECT USING (
    status = 'published' 
    OR public.is_admin()
);

DROP POLICY IF EXISTS "interactive_courses_admin_all" ON public.interactive_courses;
CREATE POLICY "interactive_courses_admin_all" ON public.interactive_courses
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- B. Table: interactive_course_modules
DROP POLICY IF EXISTS "interactive_course_modules_select_policy" ON public.interactive_course_modules;
CREATE POLICY "interactive_course_modules_select_policy" ON public.interactive_course_modules
FOR SELECT USING (
    public.is_admin()
    OR public.has_interactive_course_access(auth.uid(), course_id)
);

DROP POLICY IF EXISTS "interactive_course_modules_admin_all" ON public.interactive_course_modules;
CREATE POLICY "interactive_course_modules_admin_all" ON public.interactive_course_modules
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- C. Table: interactive_course_lessons
DROP POLICY IF EXISTS "interactive_course_lessons_select_policy" ON public.interactive_course_lessons;
CREATE POLICY "interactive_course_lessons_select_policy" ON public.interactive_course_lessons
FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.interactive_course_modules m
        WHERE m.id = module_id AND public.has_interactive_course_access(auth.uid(), m.course_id)
    )
);

DROP POLICY IF EXISTS "interactive_course_lessons_admin_all" ON public.interactive_course_lessons;
CREATE POLICY "interactive_course_lessons_admin_all" ON public.interactive_course_lessons
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- E. Table: interactive_activities
DROP POLICY IF EXISTS "interactive_activities_select_policy" ON public.interactive_activities;
CREATE POLICY "interactive_activities_select_policy" ON public.interactive_activities
FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.interactive_course_lessons l
        JOIN public.interactive_course_modules m ON m.id = l.module_id
        WHERE l.id = lesson_id AND public.has_interactive_course_access(auth.uid(), m.course_id)
    )
);

DROP POLICY IF EXISTS "interactive_activities_admin_all" ON public.interactive_activities;
CREATE POLICY "interactive_activities_admin_all" ON public.interactive_activities
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- F. Table SECRÈTE: interactive_activity_secrets (Strictement Admin - Anti-triche)
DROP POLICY IF EXISTS "interactive_activity_secrets_admin_all" ON public.interactive_activity_secrets;
CREATE POLICY "interactive_activity_secrets_admin_all" ON public.interactive_activity_secrets
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- G. Table: interactive_activity_progress (Historique immuable pour les admins)
DROP POLICY IF EXISTS "interactive_progress_select_policy" ON public.interactive_activity_progress;
CREATE POLICY "interactive_progress_select_policy" ON public.interactive_activity_progress
FOR SELECT TO authenticated USING (
    user_id = auth.uid() 
    OR public.is_admin()
);

DROP POLICY IF EXISTS "interactive_progress_insert_policy" ON public.interactive_activity_progress;
CREATE POLICY "interactive_progress_insert_policy" ON public.interactive_activity_progress
FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS "interactive_progress_update_policy" ON public.interactive_activity_progress;
CREATE POLICY "interactive_progress_update_policy" ON public.interactive_activity_progress
FOR UPDATE TO authenticated USING (
    user_id = auth.uid()
) WITH CHECK (
    user_id = auth.uid()
);


-- H. Table: interactive_activity_attempts (Audit immuable - Aucune modification/suppression autorisée)
DROP POLICY IF EXISTS "interactive_attempts_select_policy" ON public.interactive_activity_attempts;
CREATE POLICY "interactive_attempts_select_policy" ON public.interactive_activity_attempts
FOR SELECT TO authenticated USING (
    user_id = auth.uid() 
    OR public.is_admin()
);

DROP POLICY IF EXISTS "interactive_attempts_insert_policy" ON public.interactive_activity_attempts;
CREATE POLICY "interactive_attempts_insert_policy" ON public.interactive_activity_attempts
FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
);


-- ====================================================================
-- 6. STOCKAGE : CONFIGURATION DU BUCKET INTERACTIVE-LEARNING (Privé)
-- ====================================================================

-- Insertion du bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('interactive-learning', 'interactive-learning', false, 104857600) -- Limite 100 Mo par fichier
ON CONFLICT (id) DO UPDATE SET public = false;

-- Nettoyage des anciennes politiques du bucket
DROP POLICY IF EXISTS "interactive_learning_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "interactive_learning_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "interactive_learning_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "interactive_learning_storage_delete" ON storage.objects;

-- RLS Politique : SELECT (Vérification granulaire de dossier)
-- Les couvertures et illustrations publiques sont dans 'public/*' et lues par tous.
-- Les documents privés sont dans 'private/courses/{course_id}/*' et validés via has_interactive_course_access.
CREATE POLICY "interactive_learning_storage_select" ON storage.objects
FOR SELECT USING (
  bucket_id = 'interactive-learning'
  AND (
    public.is_admin()
    OR split_part(name, '/', 1) = 'public'
    OR (
      split_part(name, '/', 1) = 'private'
      AND split_part(name, '/', 2) = 'courses'
      AND auth.uid() IS NOT NULL
      -- Protection contre les erreurs de typage UUID : on vérifie la conformité par Regex avant le cast
      AND split_part(name, '/', 3) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND public.has_interactive_course_access(auth.uid(), (split_part(name, '/', 3))::UUID)
    )
  )
);

-- RLS Politique : INSERT (Admin uniquement)
CREATE POLICY "interactive_learning_storage_insert" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'interactive-learning'
  AND public.is_admin()
);

-- RLS Politique : UPDATE (Admin uniquement)
CREATE POLICY "interactive_learning_storage_update" ON storage.objects
FOR UPDATE TO authenticated USING (
  bucket_id = 'interactive-learning'
  AND public.is_admin()
) WITH CHECK (
  bucket_id = 'interactive-learning'
  AND public.is_admin()
);

-- RLS Politique : DELETE (Admin uniquement)
CREATE POLICY "interactive_learning_storage_delete" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'interactive-learning'
  AND public.is_admin()
);
