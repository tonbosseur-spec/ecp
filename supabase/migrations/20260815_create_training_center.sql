-- ====================================================================
-- Migration: 20260815_create_training_center.sql
-- Description: Centre d'Entraînement - Schéma de données, Sécurité & Fonctions RPC
-- Tables créées :
--   1. training_sessions
--   2. training_exercises
--   3. training_qcm_answers (Sécurité renforcée anti-triche)
--   4. training_attempts
--   5. training_exercise_attempts
-- ====================================================================

-- 1. Helper function: has_course_access()
CREATE OR REPLACE FUNCTION public.has_course_access(p_course_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = p_course_id
        AND c.price_fcfa = 0
        AND c.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.course_id = p_course_id
        AND r.client_id::text = auth.uid()::text
        AND r.payment_status = 'approved'
    ),
    false
  );
$$;

-- ====================================================================
-- 2. Table: training_sessions
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.training_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('quiz_qcm', 'r_exercise', 'mixed')),
    difficulty_level TEXT NOT NULL DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    order_index INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 3. Table: training_exercises
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.training_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
    exercise_type TEXT NOT NULL CHECK (exercise_type IN ('qcm', 'r_code')),
    title TEXT NOT NULL,
    instructions TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    -- Champs QCM
    options JSONB DEFAULT '[]'::jsonb,
    explanation TEXT,
    -- Champs R interactifs
    starter_code TEXT,
    hint TEXT,
    expected_output TEXT,
    test_cases JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 4. Table: training_qcm_answers (Table interne sécurisée - Bonnes réponses)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.training_qcm_answers (
    exercise_id UUID PRIMARY KEY REFERENCES public.training_exercises(id) ON DELETE CASCADE,
    correct_option_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 5. Table: training_attempts (Tentatives et scores des apprenants)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.training_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    score_percentage NUMERIC(5,2),
    is_passed BOOLEAN NOT NULL DEFAULT false,
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 6. Table: training_exercise_attempts (Détail par exercice résolu)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.training_exercise_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.training_attempts(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.training_exercises(id) ON DELETE CASCADE,
    answer_data JSONB,
    is_correct BOOLEAN,
    score NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 7. Index de performance
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_training_sessions_course_id ON public.training_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_is_published ON public.training_sessions(is_published);
CREATE INDEX IF NOT EXISTS idx_training_exercises_session_id ON public.training_exercises(training_session_id);
CREATE INDEX IF NOT EXISTS idx_training_exercises_order ON public.training_exercises(training_session_id, order_index);
CREATE INDEX IF NOT EXISTS idx_training_attempts_client_id ON public.training_attempts(client_id);
CREATE INDEX IF NOT EXISTS idx_training_attempts_session_id ON public.training_attempts(training_session_id);
CREATE INDEX IF NOT EXISTS idx_training_exercise_attempts_attempt_id ON public.training_exercise_attempts(attempt_id);
CREATE INDEX IF NOT EXISTS idx_training_exercise_attempts_exercise_id ON public.training_exercise_attempts(exercise_id);

-- ====================================================================
-- 8. Activation de Row Level Security (RLS)
-- ====================================================================
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_qcm_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_exercise_attempts ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 9. Politiques RLS : training_sessions
-- ====================================================================
DROP POLICY IF EXISTS "training_sessions_select_policy" ON public.training_sessions;
CREATE POLICY "training_sessions_select_policy" ON public.training_sessions
FOR SELECT
USING (
  public.is_admin()
  OR (
    is_published = true
    AND (course_id IS NULL OR public.has_course_access(course_id))
  )
);

DROP POLICY IF EXISTS "training_sessions_admin_manage" ON public.training_sessions;
CREATE POLICY "training_sessions_admin_manage" ON public.training_sessions
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ====================================================================
-- 10. Politiques RLS : training_exercises
-- ====================================================================
DROP POLICY IF EXISTS "training_exercises_select_policy" ON public.training_exercises;
CREATE POLICY "training_exercises_select_policy" ON public.training_exercises
FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.training_sessions ts
    WHERE ts.id = training_session_id
      AND ts.is_published = true
      AND (ts.course_id IS NULL OR public.has_course_access(ts.course_id))
  )
);

DROP POLICY IF EXISTS "training_exercises_admin_manage" ON public.training_exercises;
CREATE POLICY "training_exercises_admin_manage" ON public.training_exercises
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ====================================================================
-- 11. Politiques RLS : training_qcm_answers (Strictement Admin)
-- (Aucun SELECT direct pour les étudiants afin d'éviter la fuite des réponses)
-- ====================================================================
DROP POLICY IF EXISTS "training_qcm_answers_admin_manage" ON public.training_qcm_answers;
CREATE POLICY "training_qcm_answers_admin_manage" ON public.training_qcm_answers
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ====================================================================
-- 12. Politiques RLS : training_attempts
-- ====================================================================
DROP POLICY IF EXISTS "training_attempts_select_policy" ON public.training_attempts;
CREATE POLICY "training_attempts_select_policy" ON public.training_attempts
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR client_id::text = auth.uid()::text
);

DROP POLICY IF EXISTS "training_attempts_insert_policy" ON public.training_attempts;
CREATE POLICY "training_attempts_insert_policy" ON public.training_attempts
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR (
    client_id::text = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.training_sessions ts
      WHERE ts.id = training_session_id
        AND ts.is_published = true
        AND (ts.course_id IS NULL OR public.has_course_access(ts.course_id))
    )
  )
);

DROP POLICY IF EXISTS "training_attempts_admin_modify" ON public.training_attempts;
CREATE POLICY "training_attempts_admin_modify" ON public.training_attempts
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "training_attempts_admin_delete" ON public.training_attempts;
CREATE POLICY "training_attempts_admin_delete" ON public.training_attempts
FOR DELETE TO authenticated
USING (public.is_admin());

-- ====================================================================
-- 13. Politiques RLS : training_exercise_attempts
-- ====================================================================
DROP POLICY IF EXISTS "training_exercise_attempts_select_policy" ON public.training_exercise_attempts;
CREATE POLICY "training_exercise_attempts_select_policy" ON public.training_exercise_attempts
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.training_attempts ta
    WHERE ta.id = attempt_id
      AND ta.client_id::text = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "training_exercise_attempts_insert_policy" ON public.training_exercise_attempts;
CREATE POLICY "training_exercise_attempts_insert_policy" ON public.training_exercise_attempts
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.training_attempts ta
    WHERE ta.id = attempt_id
      AND ta.client_id::text = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "training_exercise_attempts_admin_manage" ON public.training_exercise_attempts;
CREATE POLICY "training_exercise_attempts_admin_manage" ON public.training_exercise_attempts
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ====================================================================
-- 14. Fonction RPC sécurisée : submit_training_qcm_attempt
-- (Évalue un QCM sans jamais exposer les bonnes réponses au client)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.submit_training_qcm_attempt(
    p_session_id UUID,
    p_answers JSONB,
    p_time_spent_seconds INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_user_id UUID;
    v_session RECORD;
    v_total_questions INTEGER := 0;
    v_correct_count INTEGER := 0;
    v_score_percentage NUMERIC(5,2) := 0;
    v_is_passed BOOLEAN := false;
    v_attempt_id UUID;
    v_ex_id UUID;
    v_selected_idx INTEGER;
    v_correct_idx INTEGER;
    v_is_correct BOOLEAN;
    v_explanation TEXT;
    v_results JSONB := '[]'::jsonb;
    v_exercise_record RECORD;
BEGIN
    -- 1. Vérification de l'authentification
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non authentifié.';
    END IF;

    -- 2. Vérification de la session et des droits d''accès
    SELECT * INTO v_session
    FROM public.training_sessions
    WHERE id = p_session_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session d''entraînement introuvable.';
    END IF;

    IF NOT (v_session.is_published OR public.is_admin()) THEN
        RAISE EXCEPTION 'Cette session d''entraînement n''est pas encore disponible.';
    END IF;

    IF v_session.course_id IS NOT NULL AND NOT public.has_course_access(v_session.course_id) THEN
        RAISE EXCEPTION 'Accès refusé : vous devez être inscrit à la formation associée.';
    END IF;

    -- 3. Comptage des questions QCM
    SELECT count(*) INTO v_total_questions
    FROM public.training_exercises
    WHERE training_session_id = p_session_id AND exercise_type = 'qcm';

    IF v_total_questions = 0 THEN
        RAISE EXCEPTION 'Aucune question QCM trouvée pour cette session.';
    END IF;

    -- 4. Création de la tentative (training_attempts)
    INSERT INTO public.training_attempts (
        training_session_id,
        client_id,
        score_percentage,
        is_passed,
        time_spent_seconds,
        completed_at
    ) VALUES (
        p_session_id,
        v_user_id,
        0,
        false,
        COALESCE(p_time_spent_seconds, 0),
        now()
    ) RETURNING id INTO v_attempt_id;

    -- 5. Évaluation de chaque question avec la table interne sécurisée
    FOR v_exercise_record IN
        SELECT te.id, te.title, te.explanation, qa.correct_option_index
        FROM public.training_exercises te
        LEFT JOIN public.training_qcm_answers qa ON qa.exercise_id = te.id
        WHERE te.training_session_id = p_session_id AND te.exercise_type = 'qcm'
        ORDER BY te.order_index ASC
    LOOP
        v_ex_id := v_exercise_record.id;
        v_correct_idx := v_exercise_record.correct_option_index;
        v_explanation := v_exercise_record.explanation;
        v_selected_idx := NULL;
        v_is_correct := false;

        -- Récupération du choix envoyé par le client pour cet exercice
        IF p_answers IS NOT NULL AND jsonb_typeof(p_answers) = 'array' THEN
            SELECT (elem->>'selected_option_index')::INTEGER INTO v_selected_idx
            FROM jsonb_array_elements(p_answers) elem
            WHERE (elem->>'exercise_id')::UUID = v_ex_id
            LIMIT 1;
        END IF;

        IF v_selected_idx IS NOT NULL AND v_correct_idx IS NOT NULL AND v_selected_idx = v_correct_idx THEN
            v_is_correct := true;
            v_correct_count := v_correct_count + 1;
        END IF;

        -- Enregistrement du détail de la réponse
        INSERT INTO public.training_exercise_attempts (
            attempt_id,
            exercise_id,
            answer_data,
            is_correct,
            score,
            created_at
        ) VALUES (
            v_attempt_id,
            v_ex_id,
            jsonb_build_object('selected_option_index', v_selected_idx),
            v_is_correct,
            CASE WHEN v_is_correct THEN 100.00 ELSE 0.00 END,
            now()
        );

        -- Construction du feedback post-soumission (sans risque)
        v_results := v_results || jsonb_build_object(
            'exercise_id', v_ex_id,
            'selected_option_index', v_selected_idx,
            'correct_option_index', v_correct_idx,
            'is_correct', v_is_correct,
            'explanation', v_explanation
        );
    END LOOP;

    -- 6. Calcul du score final
    IF v_total_questions > 0 THEN
        v_score_percentage := ROUND((v_correct_count::numeric / v_total_questions::numeric) * 100, 2);
    ELSE
        v_score_percentage := 0;
    END IF;

    v_is_passed := (v_score_percentage >= 70.00);

    -- 7. Mise à jour de la tentative avec le score calculé
    UPDATE public.training_attempts
    SET 
        score_percentage = v_score_percentage,
        is_passed = v_is_passed
    WHERE id = v_attempt_id;

    -- 8. Retour sécurisé du résultat
    RETURN jsonb_build_object(
        'success', true,
        'attempt_id', v_attempt_id,
        'session_id', p_session_id,
        'score_percentage', v_score_percentage,
        'is_passed', v_is_passed,
        'total_questions', v_total_questions,
        'correct_count', v_correct_count,
        'time_spent_seconds', COALESCE(p_time_spent_seconds, 0),
        'results', v_results
    );
END;
$function$;
