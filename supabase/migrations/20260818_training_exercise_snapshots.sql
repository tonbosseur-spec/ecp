-- Migration to add snapshot_data to training_exercise_attempts for 100% immutable attempt history
ALTER TABLE public.training_exercise_attempts 
ADD COLUMN IF NOT EXISTS snapshot_data JSONB DEFAULT NULL;

-- Update submit_training_qcm_attempt RPC to store snapshot_data on submission
CREATE OR REPLACE FUNCTION public.submit_training_qcm_attempt(
    p_session_id UUID,
    p_answers JSONB,
    p_time_spent_seconds INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID;
    v_session RECORD;
    v_attempt_id UUID;
    v_total_questions INTEGER := 0;
    v_correct_count INTEGER := 0;
    v_score_percentage NUMERIC(5,2) := 0;
    v_is_passed BOOLEAN := false;
    v_exercise_record RECORD;
    v_ex_id UUID;
    v_correct_idx INTEGER;
    v_explanation TEXT;
    v_selected_idx INTEGER;
    v_is_correct BOOLEAN;
    v_results JSONB := '[]'::jsonb;
    v_snapshot JSONB;
BEGIN
    -- 1. Récupération de l'utilisateur authentifié
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non authentifié.';
    END IF;

    -- 2. Vérification de la session et des droits d'accès
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

    -- 3. Comptage des questions QCM actives
    SELECT count(*) INTO v_total_questions
    FROM public.training_exercises
    WHERE training_session_id = p_session_id 
      AND exercise_type = 'qcm'
      AND (is_active = true OR is_active IS NULL);

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

    -- 5. Évaluation de chaque question active et création du snapshot immuable
    FOR v_exercise_record IN
        SELECT te.id, te.title, te.instructions, te.options, te.explanation, te.order_index, qa.correct_option_index
        FROM public.training_exercises te
        LEFT JOIN public.training_qcm_answers qa ON qa.exercise_id = te.id
        WHERE te.training_session_id = p_session_id 
          AND te.exercise_type = 'qcm'
          AND (te.is_active = true OR te.is_active IS NULL)
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

        -- Construction du snapshot immuable de la question
        v_snapshot := jsonb_build_object(
            'exercise_type', 'qcm',
            'title', v_exercise_record.title,
            'instructions', v_exercise_record.instructions,
            'options', v_exercise_record.options,
            'correct_option_index', v_correct_idx,
            'selected_option_index', v_selected_idx,
            'explanation', v_explanation,
            'order_index', v_exercise_record.order_index
        );

        -- Enregistrement du détail de la réponse avec snapshot immuable
        INSERT INTO public.training_exercise_attempts (
            attempt_id,
            exercise_id,
            answer_data,
            snapshot_data,
            is_correct,
            score,
            created_at
        ) VALUES (
            v_attempt_id,
            v_ex_id,
            jsonb_build_object('selected_option_index', v_selected_idx),
            v_snapshot,
            v_is_correct,
            CASE WHEN v_is_correct THEN 100.00 ELSE 0.00 END,
            now()
        );

        -- Construction du feedback post-soumission pour l'étudiant
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
