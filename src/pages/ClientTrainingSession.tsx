import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/Toast';
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  Clock,
  Check,
  AlertCircle,
  Code2,
  Table,
  Lightbulb,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  Award,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Edit3,
  Loader2,
  X,
  FileText,
  Maximize2
} from 'lucide-react';
import { TrainingSession, TrainingExercise } from '../types';
import REditorConsole, { REditorConsoleRef } from '../components/REditorConsole';
import GeminiAssistant from '../components/GeminiAssistant';
import { validateCode, resetREnvironment, RValidationResult } from '../lib/webrEngine';
import { ClientExcelChallengeView } from '../components/excel/ClientExcelChallengeView';
import { ExcelCellsMap } from '../lib/excel/excelTypes';
import { ExcelChallengeConfig } from '../lib/excel/excelChallengeTypes';
import { evaluateExcelChallenge, ExcelCorrectionResult } from '../lib/excel/excelCorrectionEngine';

export default function ClientTrainingSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Loading & Data states
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [exercises, setExercises] = useState<TrainingExercise[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Attempt tracking state
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const [previousExerciseHistory, setPreviousExerciseHistory] = useState<Record<string, { bestScore: number; isPassed: boolean }>>({});
  const [isSavingProgress, setIsSavingProgress] = useState<Record<string, boolean>>({});

  // Navigation & Answers states
  const [currentIndex, setCurrentIndex] = useState(0);
  const [qcmAnswers, setQcmAnswers] = useState<Record<string, number>>({});
  const [rCodes, setRCodes] = useState<Record<string, string>>({});
  const [showHints, setShowHints] = useState<Record<string, boolean>>({});
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);

  // Validation states for R exercises
  const [validatingR, setValidatingR] = useState<Record<string, boolean>>({});
  const [validationResults, setValidationResults] = useState<Record<string, RValidationResult>>({});

  // Validation & Grid states for Excel exercises
  const [excelStudentCells, setExcelStudentCells] = useState<Record<string, ExcelCellsMap>>({});
  const [excelValidationResults, setExcelValidationResults] = useState<Record<string, ExcelCorrectionResult>>({});
  const [validatingExcel, setValidatingExcel] = useState<Record<string, boolean>>({});

  // Ref to R editor for automatic focus
  const rEditorRef = useRef<REditorConsoleRef | null>(null);

  // Modal confirmation state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [isCompletedState, setIsCompletedState] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qcmFeedbackResults, setQcmFeedbackResults] = useState<any[]>([]);
  const [finalScoreSummary, setFinalScoreSummary] = useState<{
    scorePercentage: number;
    isPassed: boolean;
    totalExercises: number;
    correctCount: number;
  } | null>(null);

  // Timer counter
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (!loading && !errorMessage && !isCompletedState && exercises.length > 0) {
      timer = setInterval(() => {
        setTimeSpentSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [loading, errorMessage, isCompletedState, exercises.length]);

  // Reset R environment when switching to a new R exercise
  useEffect(() => {
    if (exercises.length > 0 && exercises[currentIndex]?.exercise_type === 'r_code') {
      resetREnvironment().catch(console.warn);
    }
  }, [currentIndex, exercises]);

  // Load session and exercises securely
  useEffect(() => {
    if (!id) {
      navigate('/client/training');
      return;
    }
    fetchSessionAndExercises(id);
  }, [id]);

  const fetchSessionAndExercises = async (sessionId: string) => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // Verify student auth
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      const user = authData?.session?.user;
      if (!user) {
        navigate('/client/login');
        return;
      }
      setCurrentUserId(user.id);

      // 1. Fetch Training Session (RLS checks student access)
      const { data: sessionData, error: sessionError } = await supabase
        .from('training_sessions')
        .select(`
          id,
          title,
          description,
          activity_type,
          difficulty_level,
          order_index,
          is_published,
          course_id,
          created_at,
          updated_at,
          courses (id, title)
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      if (!sessionData) {
        throw new Error("Cette session d'entraînement est introuvable.");
      }

      const formattedSession: TrainingSession = {
        ...(sessionData as any),
        courses: Array.isArray(sessionData.courses)
          ? (sessionData.courses[0] as any) || null
          : (sessionData.courses as any) || null
      };

      setSession(formattedSession);

      // 2. Fetch Training Exercises
      // SECURITY RULE: NEVER fetch training_qcm_answers table
      // SECURITY RULE: NEVER expose correct_option_index or hidden solution code
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('training_exercises')
        .select(`
          id,
          training_session_id,
          exercise_type,
          title,
          instructions,
          order_index,
          options,
          starter_code,
          expected_output,
          hint,
          ai_assistance_enabled,
          test_cases,
          created_at
        `)
        .eq('training_session_id', sessionId)
        .or('is_active.eq.true,is_active.is.null')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (exercisesError) throw exercisesError;

      if (!exercisesData || exercisesData.length === 0) {
        throw new Error("Cet entraînement ne comporte aucun exercice pour le moment.");
      }

      const typedExercises = exercisesData as TrainingExercise[];
      setExercises(typedExercises);
      setCurrentIndex(0);
      setQcmAnswers({});
      setShowHints({});
      setValidationResults({});
      setValidatingR({});
      setExcelValidationResults({});
      setValidatingExcel({});
      setExcelStudentCells({});
      setCurrentAttemptId(null);

      // 3. Fetch previous exercise attempts to identify already passed exercises
      try {
        const { data: prevAttemptsData, error: prevError } = await supabase
          .from('training_attempts')
          .select(`
            id,
            score_percentage,
            is_passed,
            completed_at,
            training_exercise_attempts (
              exercise_id,
              is_correct,
              score,
              answer_data
            )
          `)
          .eq('training_session_id', sessionId)
          .eq('client_id', user.id);

        if (!prevError && prevAttemptsData) {
          const historyMap: Record<string, { bestScore: number; isPassed: boolean }> = {};
          prevAttemptsData.forEach((att: any) => {
            const exAttempts = att.training_exercise_attempts || [];
            exAttempts.forEach((ea: any) => {
              if (!historyMap[ea.exercise_id]) {
                historyMap[ea.exercise_id] = {
                  bestScore: Number(ea.score) || 0,
                  isPassed: Boolean(ea.is_correct)
                };
              } else {
                if ((Number(ea.score) || 0) > historyMap[ea.exercise_id].bestScore) {
                  historyMap[ea.exercise_id].bestScore = Number(ea.score) || 0;
                }
                if (ea.is_correct) {
                  historyMap[ea.exercise_id].isPassed = true;
                }
              }
            });
          });
          setPreviousExerciseHistory(historyMap);
        }
      } catch (histErr) {
        console.warn("Impossible de récupérer l'historique antérieur:", histErr);
      }

      // Initialize default starter code for R exercises
      const initialRCodes: Record<string, string> = {};
      typedExercises.forEach(ex => {
        if (ex.exercise_type === 'r_code') {
          initialRCodes[ex.id] = ex.starter_code || '# Saisissez votre code R ici\n';
        }
      });
      setRCodes(initialRCodes);

      setTimeSpentSeconds(0);
    } catch (err: any) {
      console.error("Erreur lors du chargement de la session :", err);
      setErrorMessage(err.message || "Impossible de charger cette session d'entraînement.");
      toast.error(err.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  // Select a QCM option
  const handleSelectOption = (exerciseId: string, optionIndex: number) => {
    setQcmAnswers(prev => ({
      ...prev,
      [exerciseId]: optionIndex
    }));
  };

  // Update R Code in state
  const handleRCodeChange = (exerciseId: string, code: string) => {
    setRCodes(prev => ({
      ...prev,
      [exerciseId]: code
    }));
  };

  // Toggle Hint Visibility
  const toggleHint = (exerciseId: string) => {
    setShowHints(prev => ({
      ...prev,
      [exerciseId]: !prev[exerciseId]
    }));
  };

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start a new attempt
  const handleStartNewAttempt = () => {
    setCurrentAttemptId(null);
    setValidationResults({});
    setValidatingR({});
    setExcelValidationResults({});
    setValidatingExcel({});
    setExcelStudentCells({});
    setTimeSpentSeconds(0);
    setCurrentIndex(0);
    setIsCompletedState(false);
    setQcmAnswers({});
    setQcmFeedbackResults([]);
    setFinalScoreSummary(null);
    toast.success("Nouvelle tentative commencée !");
  };

  // Validate R Code against test cases & persist progress securely
  const handleValidateRExercise = async (exercise: TrainingExercise) => {
    const code = rCodes[exercise.id] !== undefined 
      ? rCodes[exercise.id] 
      : (exercise.starter_code || '');

    const executableCode = code
      .split('\n')
      .map((line) => line.replace(/#.*$/, ''))
      .join('')
      .trim();

    if (!executableCode) {
      toast.error("Veuillez d'abord saisir votre code R avant de valider.");
      return;
    }

    try {
      setValidatingR(prev => ({ ...prev, [exercise.id]: true }));

      // 1. Run automatic validation engine locally in WebR (No user-tampered score accepted)
      const result = await validateCode(code, exercise.test_cases || [], {
        expectedOutput: exercise.expected_output || undefined,
      });
      
      setValidationResults(prev => ({
        ...prev,
        [exercise.id]: result
      }));

      // 2. Derive strict, non-tamperable score based strictly on WebR test outcomes
      const totalTests = result.total || 0;
      const passedTests = result.passed || 0;
      const isCorrect = result.success && totalTests > 0;
      
      let computedScore = 0;
      if (isCorrect) {
        computedScore = 100;
      } else if (totalTests > 0) {
        computedScore = Math.round((passedTests / totalTests) * 100);
      } else {
        computedScore = 0;
      }

      // Display immediate feedback to student
      if (isCorrect) {
        toast.success("🎉 Exercice validé avec succès !");
      } else if (totalTests === 0) {
        toast.error(result.error || "Aucun critère de validation n'est configuré pour cet exercice.");
      } else if (result.error) {
        toast.error(`Votre code a généré une erreur : ${result.error}`);
      } else {
        toast.error(`Certains critères ne sont pas encore satisfaits (${passedTests}/${totalTests} validés).`);
      }

      // 3. Persist progress into Supabase tables: training_attempts and training_exercise_attempts
      const answerDataPayload = {
        type: 'r_code',
        passed_tests: passedTests,
        total_tests: totalTests,
        student_code: code
      };

      // Verify connected user
      let userId = currentUserId;
      if (!userId) {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData?.user?.id || null;
      }

      if (!userId) {
        toast.info("Vous n'êtes pas connecté. Votre progression n'a pas pu être enregistrée sur votre compte.");
        return;
      }

      if (!session) return;

      setIsSavingProgress(prev => ({ ...prev, [exercise.id]: true }));

      try {
        let attemptId = currentAttemptId;

        // 4. Create or reuse training_attempt
        if (!attemptId) {
          const { data: newAttempt, error: createAttemptError } = await supabase
            .from('training_attempts')
            .insert({
              training_session_id: session.id,
              client_id: userId,
              score_percentage: computedScore,
              is_passed: isCorrect && exercises.length === 1,
              time_spent_seconds: timeSpentSeconds || 0
            })
            .select('id')
            .single();

          if (createAttemptError) {
            console.error("Erreur lors de la création de la tentative:", createAttemptError);
            toast.error("Erreur serveur Supabase : impossible d'initialiser la tentative.");
            return;
          }

          if (newAttempt) {
            attemptId = newAttempt.id;
            setCurrentAttemptId(attemptId);
          }
        }

        if (attemptId) {
          // 5. Save or update record in training_exercise_attempts
          const { data: existingExRecord, error: checkError } = await supabase
            .from('training_exercise_attempts')
            .select('id')
            .eq('attempt_id', attemptId)
            .eq('exercise_id', exercise.id)
            .maybeSingle();

          if (checkError) {
            console.warn("Erreur vérification training_exercise_attempts:", checkError);
          }

          if (existingExRecord?.id) {
            const { error: updateError } = await supabase
              .from('training_exercise_attempts')
              .update({
                answer_data: answerDataPayload,
                is_correct: isCorrect,
                score: computedScore
              })
              .eq('id', existingExRecord.id);

            if (updateError) {
              console.error("Erreur mise à jour training_exercise_attempts:", updateError);
              toast.error("Erreur de sauvegarde de l'exercice : " + updateError.message);
            }
          } else {
            const { error: insertError } = await supabase
              .from('training_exercise_attempts')
              .insert({
                attempt_id: attemptId,
                exercise_id: exercise.id,
                answer_data: answerDataPayload,
                is_correct: isCorrect,
                score: computedScore
              });

            if (insertError) {
              console.error("Erreur insertion training_exercise_attempts:", insertError);
              toast.error("Erreur de sauvegarde de l'exercice : " + insertError.message);
            }
          }

          // 6. Recalculate and update overall training_attempt score
          const { data: allExAttempts, error: fetchAllError } = await supabase
            .from('training_exercise_attempts')
            .select('exercise_id, score, is_correct')
            .eq('attempt_id', attemptId);

          if (!fetchAllError && allExAttempts) {
            const totalSessionEx = exercises.length || 1;
            const sumScores = allExAttempts.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
            const globalAvgScore = Math.round(sumScores / totalSessionEx);
            const allExercisesPassed = exercises.length > 0 && 
              allExAttempts.length === exercises.length && 
              allExAttempts.every(e => e.is_correct);

            await supabase
              .from('training_attempts')
              .update({
                score_percentage: globalAvgScore,
                is_passed: allExercisesPassed,
                time_spent_seconds: timeSpentSeconds
              })
              .eq('id', attemptId);
          }

          // Update local previous history map
          setPreviousExerciseHistory(prev => ({
            ...prev,
            [exercise.id]: {
              bestScore: Math.max(prev[exercise.id]?.bestScore || 0, computedScore),
              isPassed: (prev[exercise.id]?.isPassed || false) || isCorrect
            }
          }));
        }
      } catch (dbErr: any) {
        console.error("Erreur synchronisation Supabase :", dbErr);
        toast.error("Erreur de synchronisation Supabase : " + (dbErr?.message || 'Erreur réseau'));
      } finally {
        setIsSavingProgress(prev => ({ ...prev, [exercise.id]: false }));
      }
    } catch (err: any) {
      console.error("Erreur de validation R :", err);
      toast.error(err?.message || "Erreur lors de la validation du code.");
    } finally {
      setValidatingR(prev => ({ ...prev, [exercise.id]: false }));
    }
  };

  // Focus back on editor when student wants to modify code
  const handleFocusEditor = () => {
    if (rEditorRef.current) {
      rEditorRef.current.focus();
    }
  };

  // Validate Excel Exercise locally & persist progress securely
  const handleValidateExcelExercise = async (
    exercise: TrainingExercise,
    currentCells: ExcelCellsMap,
    config: ExcelChallengeConfig
  ) => {
    try {
      setValidatingExcel(prev => ({ ...prev, [exercise.id]: true }));

      // 1. Run Excel local correction engine
      const result = evaluateExcelChallenge(currentCells, config);

      setExcelStudentCells(prev => ({
        ...prev,
        [exercise.id]: currentCells
      }));

      setExcelValidationResults(prev => ({
        ...prev,
        [exercise.id]: result
      }));

      const totalCrit = result.totalCriteria;
      const passedCrit = result.passedCriteria;
      const isCorrect = result.passed;
      const computedScore = result.scorePercentage;

      if (isCorrect) {
        toast.success("🎉 Défi Excel validé avec succès ! (100%)");
      } else if (totalCrit === 0) {
        toast.error("Aucun critère de validation n'est configuré pour cet exercice.");
      } else {
        toast.error(`Certains critères ne sont pas encore satisfaits (${passedCrit}/${totalCrit} validés).`);
      }

      // 2. Persist progress into Supabase tables: training_attempts and training_exercise_attempts
      let userId = currentUserId;
      if (!userId) {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData?.user?.id || null;
      }

      if (!userId) {
        console.warn("Utilisateur non connecté : progression Excel validée uniquement localement.");
        return;
      }

      if (!session) return;

      setIsSavingProgress(prev => ({ ...prev, [exercise.id]: true }));

      try {
        let attemptId = currentAttemptId;

        // Create or reuse training_attempt
        if (!attemptId) {
          const { data: newAttempt, error: createAttemptError } = await supabase
            .from('training_attempts')
            .insert({
              training_session_id: session.id,
              client_id: userId,
              score_percentage: computedScore,
              is_passed: isCorrect && exercises.length === 1,
              time_spent_seconds: timeSpentSeconds || 0
            })
            .select('id')
            .single();

          if (createAttemptError) {
            console.error("Erreur création tentative Excel:", createAttemptError);
            toast.error("Erreur serveur Supabase : impossible d'initialiser la tentative.");
            return;
          }

          if (newAttempt) {
            attemptId = newAttempt.id;
            setCurrentAttemptId(attemptId);
          }
        }

        if (attemptId) {
          const excelAnswerPayload = {
            type: 'excel_formula',
            passed_criteria: passedCrit,
            total_criteria: totalCrit,
            score_percentage: computedScore,
            student_cells: currentCells
          };

          const excelSnapshotPayload = {
            exercise_type: 'excel_formula',
            title: exercise.title,
            instructions: exercise.instructions,
            hint: exercise.hint || null,
            test_cases: exercise.test_cases || null,
            order_index: exercise.order_index ?? 0,
            passed_criteria: passedCrit,
            total_criteria: totalCrit,
            is_correct: isCorrect,
            score: computedScore
          };

          // Save or update record in training_exercise_attempts
          const { data: existingExRecord, error: checkError } = await supabase
            .from('training_exercise_attempts')
            .select('id')
            .eq('attempt_id', attemptId)
            .eq('exercise_id', exercise.id)
            .maybeSingle();

          if (checkError) {
            console.warn("Erreur vérification training_exercise_attempts:", checkError);
          }

          if (existingExRecord?.id) {
            const { error: updateError } = await supabase
              .from('training_exercise_attempts')
              .update({
                answer_data: excelAnswerPayload,
                snapshot_data: excelSnapshotPayload,
                is_correct: isCorrect,
                score: computedScore
              })
              .eq('id', existingExRecord.id);

            if (updateError) {
              console.error("Erreur mise à jour training_exercise_attempts:", updateError);
              toast.error("Erreur de sauvegarde de l'exercice Excel : " + updateError.message);
            }
          } else {
            const { error: insertError } = await supabase
              .from('training_exercise_attempts')
              .insert({
                attempt_id: attemptId,
                exercise_id: exercise.id,
                answer_data: excelAnswerPayload,
                snapshot_data: excelSnapshotPayload,
                is_correct: isCorrect,
                score: computedScore
              });

            if (insertError) {
              console.error("Erreur insertion training_exercise_attempts:", insertError);
              toast.error("Erreur de sauvegarde de l'exercice Excel : " + insertError.message);
            }
          }

          // Recalculate and update overall training_attempt score
          const { data: allExAttempts, error: fetchAllError } = await supabase
            .from('training_exercise_attempts')
            .select('exercise_id, score, is_correct')
            .eq('attempt_id', attemptId);

          if (!fetchAllError && allExAttempts) {
            const totalSessionEx = exercises.length || 1;
            const sumScores = allExAttempts.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
            const globalAvgScore = Math.round(sumScores / totalSessionEx);
            const allExercisesPassed = exercises.length > 0 && 
              allExAttempts.length === exercises.length && 
              allExAttempts.every(e => e.is_correct);

            await supabase
              .from('training_attempts')
              .update({
                score_percentage: globalAvgScore,
                is_passed: allExercisesPassed,
                time_spent_seconds: timeSpentSeconds
              })
              .eq('id', attemptId);
          }

          // Update local previous history map
          setPreviousExerciseHistory(prev => ({
            ...prev,
            [exercise.id]: {
              bestScore: Math.max(prev[exercise.id]?.bestScore || 0, computedScore),
              isPassed: (prev[exercise.id]?.isPassed || false) || isCorrect
            }
          }));
        }
      } catch (dbErr: any) {
        console.error("Erreur synchronisation Supabase Excel:", dbErr);
        toast.error("Erreur de synchronisation Supabase : " + (dbErr?.message || 'Erreur réseau'));
      } finally {
        setIsSavingProgress(prev => ({ ...prev, [exercise.id]: false }));
      }
    } catch (err: any) {
      console.error("Erreur lors de la validation Excel :", err);
      toast.error(err?.message || "Erreur lors de la validation Excel.");
    } finally {
      setValidatingExcel(prev => ({ ...prev, [exercise.id]: false }));
    }
  };

  // Final confirmation action with complete atomic QCM + R submission
  const handleConfirmFinish = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // 1. Verify user authentication
      let userId = currentUserId;
      if (!userId) {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData?.user?.id || null;
      }

      if (!userId) {
        toast.error("Vous devez être connecté pour enregistrer vos résultats d'entraînement.");
        setIsSubmitting(false);
        return;
      }

      if (!session || exercises.length === 0) {
        toast.error("Aucune donnée d'exercice disponible.");
        setIsSubmitting(false);
        return;
      }

      const qcmExercises = exercises.filter(ex => ex.exercise_type === 'qcm');
      const rExercises = exercises.filter(ex => ex.exercise_type === 'r_code');
      const excelExercises = exercises.filter(ex => ex.exercise_type === 'excel_formula');

      let attemptId: string | null = null;
      let qcmResultsFromRpc: any[] = [];

      // 2. Submit QCM exercises via secure RPC submit_training_qcm_attempt
      if (qcmExercises.length > 0) {
        const answersPayload = qcmExercises.map(ex => ({
          exercise_id: ex.id,
          selected_option_index: qcmAnswers[ex.id] !== undefined ? qcmAnswers[ex.id] : null
        }));

        const { data: rpcData, error: rpcError } = await supabase.rpc('submit_training_qcm_attempt', {
          p_session_id: session.id,
          p_answers: answersPayload,
          p_time_spent_seconds: timeSpentSeconds
        });

        if (rpcError) {
          console.error("Erreur RPC submit_training_qcm_attempt:", rpcError);
          throw new Error("Erreur de sauvegarde des QCM : " + rpcError.message);
        }

        if (!rpcData || !rpcData.attempt_id) {
          throw new Error("Erreur serveur : la tentative QCM n'a pas pu être enregistrée.");
        }

        attemptId = rpcData.attempt_id;
        qcmResultsFromRpc = rpcData.results || [];
      } else {
        // Non-QCM session (R / Excel): create a new training_attempts record directly
        const { data: newAttempt, error: attemptError } = await supabase
          .from('training_attempts')
          .insert({
            training_session_id: session.id,
            client_id: userId,
            score_percentage: 0,
            is_passed: false,
            time_spent_seconds: timeSpentSeconds,
            completed_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (attemptError || !newAttempt) {
          console.error("Erreur création tentative R/Excel:", attemptError);
          throw new Error("Erreur d'initialisation de la tentative : " + (attemptError?.message || 'Erreur réseau'));
        }

        attemptId = newAttempt.id;
      }

      // 3. Process and record R exercises in training_exercise_attempts for attemptId
      for (const ex of rExercises) {
        const result = validationResults[ex.id];
        const code = rCodes[ex.id] !== undefined ? rCodes[ex.id] : (ex.starter_code || '');

        const totalTests = result?.total || (Array.isArray(ex.test_cases) ? ex.test_cases.length : 0);
        const passedTests = result?.passed || 0;
        const isCorrect = Boolean(result?.success && totalTests > 0);

        let rScore = 0;
        if (isCorrect) {
          rScore = 100;
        } else if (totalTests > 0) {
          rScore = Math.round((passedTests / totalTests) * 100);
        } else {
          rScore = 0;
        }

        const rAnswerPayload = {
          type: 'r_code',
          passed_tests: passedTests,
          total_tests: totalTests,
          student_code: code
        };

        const rSnapshotPayload = {
          exercise_type: 'r_code',
          title: ex.title,
          instructions: ex.instructions,
          starter_code: ex.starter_code || null,
          hint: ex.hint || null,
          expected_output: ex.expected_output || null,
          test_cases: ex.test_cases || null,
          order_index: ex.order_index ?? 0,
          student_code: code,
          passed_tests: passedTests,
          total_tests: totalTests,
          is_correct: isCorrect,
          score: rScore
        };

        const { error: rInsertError } = await supabase
          .from('training_exercise_attempts')
          .insert({
            attempt_id: attemptId,
            exercise_id: ex.id,
            answer_data: rAnswerPayload,
            snapshot_data: rSnapshotPayload,
            is_correct: isCorrect,
            score: rScore
          });

        if (rInsertError) {
          console.error("Erreur insertion exercice R dans la tentative:", rInsertError);
          throw new Error("Erreur d'enregistrement de l'exercice R (" + ex.title + ") : " + rInsertError.message);
        }
      }

      // 4. Process and record Excel exercises in training_exercise_attempts for attemptId
      for (const ex of excelExercises) {
        const config: ExcelChallengeConfig = (ex.test_cases && typeof ex.test_cases === 'object')
          ? ex.test_cases
          : { initial_data: {}, target_cells: [], criteria: [] };
        const studentCells = excelStudentCells[ex.id] || config.initial_data || {};
        const result = excelValidationResults[ex.id] || evaluateExcelChallenge(studentCells, config);

        const totalCrit = result?.totalCriteria || (Array.isArray(config.criteria) ? config.criteria.length : 0);
        const passedCrit = result?.passedCriteria || 0;
        const isCorrect = Boolean(result?.passed && totalCrit > 0);
        const excelScore = result?.scorePercentage || (isCorrect ? 100 : 0);

        const excelAnswerPayload = {
          type: 'excel_formula',
          passed_criteria: passedCrit,
          total_criteria: totalCrit,
          score_percentage: excelScore,
          student_cells: studentCells
        };

        const excelSnapshotPayload = {
          exercise_type: 'excel_formula',
          title: ex.title,
          instructions: ex.instructions,
          hint: ex.hint || null,
          test_cases: ex.test_cases || null,
          order_index: ex.order_index ?? 0,
          passed_criteria: passedCrit,
          total_criteria: totalCrit,
          is_correct: isCorrect,
          score: excelScore
        };

        const { error: excelInsertError } = await supabase
          .from('training_exercise_attempts')
          .insert({
            attempt_id: attemptId,
            exercise_id: ex.id,
            answer_data: excelAnswerPayload,
            snapshot_data: excelSnapshotPayload,
            is_correct: isCorrect,
            score: excelScore
          });

        if (excelInsertError) {
          console.error("Erreur insertion exercice Excel dans la tentative:", excelInsertError);
          throw new Error("Erreur d'enregistrement de l'exercice Excel (" + ex.title + ") : " + excelInsertError.message);
        }
      }

      // 5. Calculate Unified Final Score across ALL exercises in the session (QCM + R + Excel)
      const exerciseScoresList: { exercise_id: string; score: number; is_correct: boolean }[] = [];

      exercises.forEach(ex => {
        if (ex.exercise_type === 'qcm') {
          const qRes = qcmResultsFromRpc.find((r: any) => r.exercise_id === ex.id);
          const isCorr = qRes ? Boolean(qRes.is_correct) : false;
          exerciseScoresList.push({
            exercise_id: ex.id,
            score: isCorr ? 100 : 0,
            is_correct: isCorr
          });
        } else if (ex.exercise_type === 'r_code') {
          const result = validationResults[ex.id];
          const totalTests = result?.total || (Array.isArray(ex.test_cases) ? ex.test_cases.length : 0);
          const passedTests = result?.passed || 0;
          const isCorrect = Boolean(result?.success && totalTests > 0);

          let rScore = 0;
          if (isCorrect) {
            rScore = 100;
          } else if (totalTests > 0) {
            rScore = Math.round((passedTests / totalTests) * 100);
          } else {
            rScore = 0;
          }

          exerciseScoresList.push({
            exercise_id: ex.id,
            score: rScore,
            is_correct: isCorrect
          });
        } else if (ex.exercise_type === 'excel_formula') {
          const config: ExcelChallengeConfig = (ex.test_cases && typeof ex.test_cases === 'object')
            ? ex.test_cases
            : { initial_data: {}, target_cells: [], criteria: [] };
          const studentCells = excelStudentCells[ex.id] || config.initial_data || {};
          const result = excelValidationResults[ex.id] || evaluateExcelChallenge(studentCells, config);
          const totalCrit = result?.totalCriteria || (Array.isArray(config.criteria) ? config.criteria.length : 0);
          const isCorrect = Boolean(result?.passed && totalCrit > 0);
          const excelScore = result?.scorePercentage || (isCorrect ? 100 : 0);

          exerciseScoresList.push({
            exercise_id: ex.id,
            score: excelScore,
            is_correct: isCorrect
          });
        }
      });

      const totalExerciseCount = exercises.length || 1;
      const sumScores = exerciseScoresList.reduce((acc, curr) => acc + curr.score, 0);
      const finalGlobalScore = Math.round(sumScores / totalExerciseCount);
      const correctCount = exerciseScoresList.filter(s => s.is_correct).length;
      const finalIsPassed = finalGlobalScore >= 70;

      // 5. Update training_attempts with final unified score and completion status
      const { error: updateAttemptError } = await supabase
        .from('training_attempts')
        .update({
          score_percentage: finalGlobalScore,
          is_passed: finalIsPassed,
          time_spent_seconds: timeSpentSeconds,
          completed_at: new Date().toISOString()
        })
        .eq('id', attemptId);

      if (updateAttemptError) {
        console.error("Erreur mise à jour finale tentative:", updateAttemptError);
        throw new Error("Erreur de finalisation de la tentative : " + updateAttemptError.message);
      }

      // Update local state for UI display
      setCurrentAttemptId(attemptId);
      setQcmFeedbackResults(qcmResultsFromRpc);
      setFinalScoreSummary({
        scorePercentage: finalGlobalScore,
        isPassed: finalIsPassed,
        totalExercises: totalExerciseCount,
        correctCount
      });

      // Show completion view ONLY after successful persistence
      setIsCompletedState(true);
      setShowConfirmModal(false);

      if (finalIsPassed) {
        toast.success(`Félicitations ! Entraînement réussi (${finalGlobalScore} %) !`);
      } else {
        toast.info(`Entraînement terminé. Score obtenu : ${finalGlobalScore} %.`);
      }
    } catch (err: any) {
      console.error("Erreur lors de la finalisation de la séance :", err);
      toast.error(err.message || "Impossible de finaliser l'entraînement. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for difficulty badge
  const getDifficultyBadge = (level: string) => {
    switch (level) {
      case 'debutant':
        return { label: 'Débutant', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'avance':
        return { label: 'Avancé', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'intermediaire':
      default:
        return { label: 'Intermédiaire', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
  };

  // =========================================================================
  // STATE 1: LOADING
  // =========================================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-3xl border border-gray-100 shadow-sm max-w-sm w-full space-y-4">
          <div className="w-12 h-12 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mx-auto"></div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Préparation de l'entraînement</h3>
            <p className="text-xs text-gray-500 mt-1">Chargement des exercices et configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 2: ERROR
  // =========================================================================
  if (errorMessage || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-3xl border border-rose-100 shadow-sm max-w-md w-full space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Entraînement indisponible</h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1.5 leading-relaxed">
              {errorMessage || "Une erreur est survenue lors de l'accès à cet entraînement."}
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/client/training"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Retour aux entraînements
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 3: COMPLETED VIEW
  // =========================================================================
  const totalQuestions = exercises.length;
  const isQcmAnswered = (ex: TrainingExercise) => qcmAnswers[ex.id] !== undefined;
  const isRAnswered = (ex: TrainingExercise) => {
    if (validationResults[ex.id]?.success) return true;
    return (rCodes[ex.id] || '').trim().length > 0;
  };
  const isExcelAnswered = (ex: TrainingExercise) => {
    if (excelValidationResults[ex.id]?.passed) return true;
    const config: ExcelChallengeConfig = (ex.test_cases && typeof ex.test_cases === 'object')
      ? ex.test_cases
      : { initial_data: {}, target_cells: [], criteria: [] };
    const cells = excelStudentCells[ex.id];
    if (!cells) return false;
    return (config.target_cells || []).some(tc => cells[tc]?.value !== undefined && cells[tc]?.value !== '');
  };
  const answeredCount = exercises.filter(ex => {
    if (ex.exercise_type === 'r_code') return isRAnswered(ex);
    if (ex.exercise_type === 'excel_formula') return isExcelAnswered(ex);
    return isQcmAnswered(ex);
  }).length;

  const validRExercisesCount = exercises.filter(ex => 
    ex.exercise_type === 'r_code' && (validationResults[ex.id]?.success || previousExerciseHistory[ex.id]?.isPassed)
  ).length;

  const validExcelExercisesCount = exercises.filter(ex =>
    ex.exercise_type === 'excel_formula' && (excelValidationResults[ex.id]?.passed || previousExerciseHistory[ex.id]?.isPassed)
  ).length;

  if (isCompletedState) {
    const scorePct = finalScoreSummary?.scorePercentage ?? 0;
    const isPassed = finalScoreSummary?.isPassed ?? false;
    const correctCount = finalScoreSummary?.correctCount ?? exercises.filter(ex => {
      if (ex.exercise_type === 'r_code') return (validationResults[ex.id]?.success || previousExerciseHistory[ex.id]?.isPassed);
      if (ex.exercise_type === 'excel_formula') return (excelValidationResults[ex.id]?.passed || previousExerciseHistory[ex.id]?.isPassed);
      return false;
    }).length;

    return (
      <div className="min-h-screen bg-gray-50 font-sans py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center space-y-5">
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-inner ${
            isPassed ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}>
            {isPassed ? <Check className="w-8 h-8" /> : <Award className="w-8 h-8" />}
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-gray-900">
              {isPassed ? "Félicitations !" : "Entraînement terminé"}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Vous avez complété la session <span className="font-semibold text-gray-900">« {session.title} »</span>.
            </p>

            <div className="pt-2">
              <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-extrabold border ${
                isPassed 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                Score obtenu : {scorePct} % {isPassed ? '(Validé ✓)' : '(À revoir)'}
              </span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 grid grid-cols-2 gap-3 text-left">
            <div>
              <span className="text-[11px] text-gray-400 font-bold block">Exercices réussis</span>
              <span className="text-base font-bold text-gray-900">{correctCount} / {exercises.length}</span>
            </div>
            <div>
              <span className="text-[11px] text-gray-400 font-bold block">Temps total</span>
              <span className="text-base font-bold text-gray-900">{formatTime(timeSpentSeconds)}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleStartNewAttempt}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-indigo-200 transition-all active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Lancer une nouvelle tentative
            </button>

            <Link
              to="/client/training"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-sm transition-all active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
              Retour au centre d'entraînement
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 4: ACTIVE EXERCISE READER (QCM, R_CODE OR EXCEL_FORMULA)
  // =========================================================================
  const currentExercise = exercises[currentIndex];
  const progressPercent = totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0;
  const currentSelectedOption = currentExercise ? qcmAnswers[currentExercise.id] : undefined;
  const optionsList = (currentExercise?.options as string[]) || [];
  const isCurrentRExercise = currentExercise?.exercise_type === 'r_code';
  const isCurrentExcelExercise = currentExercise?.exercise_type === 'excel_formula';
  const difficultyBadge = getDifficultyBadge(session.difficulty_level || 'intermediaire');
  const isHintOpen = currentExercise ? !!showHints[currentExercise.id] : false;

  // Validation result for current exercise (R or Excel)
  const currentValResult = currentExercise ? validationResults[currentExercise.id] : undefined;
  const currentExcelValResult = currentExercise ? excelValidationResults[currentExercise.id] : undefined;
  const isValidatingCurrent = currentExercise ? !!validatingR[currentExercise.id] : false;
  const isValidatingCurrentExcel = currentExercise ? !!validatingExcel[currentExercise.id] : false;
  const isSavingCurrent = currentExercise ? !!isSavingProgress[currentExercise.id] : false;
  const isAlreadyPassedPrior = currentExercise ? !!previousExerciseHistory[currentExercise.id]?.isPassed : false;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-100 shadow-2xs sticky top-0 z-20 pt-safe">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-3.5 gap-3">
            {/* Back Button */}
            <Link
              to="/client/training"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Retour aux entraînements</span>
              <span className="sm:hidden">Retour</span>
            </Link>

            {/* Session Title */}
            <div className="text-center truncate max-w-[180px] sm:max-w-md">
              <h1 className="text-xs sm:text-sm font-black text-gray-900 truncate">
                {session.title}
              </h1>
              {session.courses && (
                <span className="text-[10px] sm:text-xs text-sky-600 font-semibold block truncate">
                  {session.courses.title}
                </span>
              )}
            </div>

            {/* Timer */}
            <div className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 px-3 py-1.5 rounded-full text-xs font-bold border border-sky-100 shrink-0">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>{formatTime(timeSpentSeconds)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Progress Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-2xs space-y-4">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
            <span className="text-gray-900 flex items-center gap-1.5">
              {isCurrentRExercise ? (
                <Code2 className="w-4 h-4 text-indigo-600" />
              ) : isCurrentExcelExercise ? (
                <Table className="w-4 h-4 text-emerald-600" />
              ) : (
                <Brain className="w-4 h-4 text-sky-600" />
              )}
              {isCurrentRExercise ? 'Exercice R' : isCurrentExcelExercise ? 'Défi Excel' : 'Question QCM'} {currentIndex + 1} / {totalQuestions}
            </span>
            <span className="text-gray-500 font-medium text-xs">
              {answeredCount} sur {totalQuestions} complété{answeredCount > 1 ? 's' : ''}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-sky-500 via-indigo-500 to-sky-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Question Jump Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {exercises.map((ex, idx) => {
              const isR = ex.exercise_type === 'r_code';
              const isExcel = ex.exercise_type === 'excel_formula';
              const isAnswered = isR ? isRAnswered(ex) : isExcel ? isExcelAnswered(ex) : isQcmAnswered(ex);
              const isCurrent = idx === currentIndex;
              const isRValidated = isR && (validationResults[ex.id]?.success || previousExerciseHistory[ex.id]?.isPassed);
              const isExcelValidated = isExcel && (excelValidationResults[ex.id]?.passed || previousExerciseHistory[ex.id]?.isPassed);
              const isValidated = isRValidated || isExcelValidated;

              let btnClass = 'bg-gray-100 text-gray-600 hover:bg-gray-200';
              if (isCurrent) {
                btnClass = isR 
                  ? 'bg-indigo-600 text-white font-extrabold shadow-sm ring-2 ring-indigo-200'
                  : isExcel
                  ? 'bg-emerald-600 text-white font-extrabold shadow-sm ring-2 ring-emerald-200'
                  : 'bg-sky-600 text-white font-extrabold shadow-sm ring-2 ring-sky-200';
              } else if (isValidated) {
                btnClass = 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-extrabold';
              } else if (isAnswered) {
                btnClass = isR
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold'
                  : isExcel
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold'
                  : 'bg-sky-50 text-sky-700 border border-sky-200/80 font-bold';
              }

              return (
                <button
                  key={ex.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-xs flex items-center justify-center transition-all duration-150 ${btnClass}`}
                  title={`${isR ? 'Exercice R' : isExcel ? 'Défi Excel' : 'QCM'} ${idx + 1}`}
                >
                  {isValidated ? '✓' : idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* ================================================================= */}
        {/* CASE A : R_CODE EXERCISE */}
        {/* ================================================================= */}
        {currentExercise && isCurrentRExercise && (
          <div className="space-y-6">
            {/* Top Details Card */}
            <div className="bg-white rounded-3xl p-5 sm:p-7 border border-gray-100 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <Code2 className="w-3.5 h-3.5" />
                    Exercice R {currentIndex + 1}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${difficultyBadge.bg}`}>
                    {difficultyBadge.label}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {currentValResult?.success ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-in fade-in duration-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Validé (100%)
                    </span>
                  ) : isAlreadyPassedPrior ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-in fade-in duration-200" title="Cet exercice a déjà été réussi lors d'une session précédente">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Déjà réussi (100%)
                    </span>
                  ) : null}
                </div>
              </div>

              {/* 1. Titre de l'exercice */}
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">
                {currentExercise.title}
              </h2>

              {/* 3. Énoncé / instructions */}
              {currentExercise.instructions && (
                <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 text-xs sm:text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      Consigne :
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowInstructionModal(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                      title="Agrandir l'énoncé dans une fenêtre"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Voir énoncé</span>
                    </button>
                  </div>
                  {currentExercise.instructions}
                </div>
              )}

              {/* Gemini Assistant (Only shows if enabled and not fully passed) */}
              {(!currentValResult?.success && !isAlreadyPassedPrior) && (
                <GeminiAssistant
                  exerciseId={currentExercise.id}
                  studentCode={rCodes[currentExercise.id] || ''}
                  errorMessage={currentValResult?.error}
                  isFailedAttempt={currentValResult?.success === false}
                  aiAssistanceEnabled={currentExercise.ai_assistance_enabled ?? true}
                />
              )}
            </div>

            {/* 4, 5, 6. Zone de Code R + Bouton Exécuter + Console R (Mobile First REditorConsole) */}
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-gray-100 shadow-2xs space-y-4">
              <REditorConsole
                ref={rEditorRef}
                value={rCodes[currentExercise.id] !== undefined ? rCodes[currentExercise.id] : (currentExercise.starter_code || '# Code R\n')}
                onChange={(newCode) => handleRCodeChange(currentExercise.id, newCode)}
                starterCode={currentExercise.starter_code || '# Code R\n'}
                minHeight="180px"
              />

              {/* Large Touch "Valider mon exercice" Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleValidateRExercise(currentExercise)}
                  disabled={isValidatingCurrent || isSavingCurrent}
                  className={`w-full min-h-[50px] sm:min-h-[54px] px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-md transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                    isValidatingCurrent || isSavingCurrent
                      ? 'bg-emerald-700 text-white cursor-wait opacity-80'
                      : currentValResult?.success
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-200'
                  }`}
                >
                  {isValidatingCurrent || isSavingCurrent ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{isValidatingCurrent ? 'Vérification des critères en cours...' : 'Enregistrement de votre progression...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 stroke-[2.5]" />
                      <span>✓ Valider mon exercice</span>
                    </>
                  )}
                </button>
              </div>

              {/* Pedagogical Validation Results Box */}
              {currentValResult && (
                <div
                  className={`rounded-2xl p-4 sm:p-5 border transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
                    currentValResult.success
                      ? 'bg-emerald-50/90 border-emerald-200 shadow-xs'
                      : currentValResult.error
                      ? 'bg-rose-50/90 border-rose-200'
                      : 'bg-amber-50/90 border-amber-200'
                  }`}
                >
                  {/* Case 1: All criteria passed */}
                  {currentValResult.success && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm sm:text-base font-black text-emerald-950 flex items-center gap-1.5">
                            <span>🎉 Exercice réussi !</span>
                          </h4>
                          <p className="text-xs text-emerald-800 font-medium">
                            ✓ {currentValResult.passed}/{currentValResult.total} critère{currentValResult.total > 1 ? 's' : ''} validé{currentValResult.total > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-emerald-900 font-semibold pl-1">
                        « Excellent travail ! »
                      </p>

                      {/* Criteria details */}
                      {currentValResult.tests.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-emerald-200/80">
                          {currentValResult.tests.map((test, tIdx) => (
                            <div key={tIdx} className="flex items-start gap-2 text-xs sm:text-sm text-emerald-900">
                              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{test.description}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Case 2: Code Execution Error */}
                  {!currentValResult.success && currentValResult.error && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm sm:text-base font-black text-rose-950">
                              🔴 Erreur dans votre code
                            </h4>
                            <p className="text-xs text-rose-700">
                              Le code ne s'est pas exécuté correctement.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleFocusEditor}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-100/50 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition-colors shrink-0 shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Modifier mon code</span>
                        </button>
                      </div>

                      <div className="bg-rose-100/60 rounded-xl p-3 text-xs font-mono text-rose-900 whitespace-pre-wrap break-words border border-rose-200">
                        {currentValResult.error}
                      </div>
                    </div>
                  )}

                  {/* Case 3: Partial or complete failure on criteria (without crash) */}
                  {!currentValResult.success && !currentValResult.error && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm sm:text-base font-black text-amber-950">
                              🟠 Presque !
                            </h4>
                            <p className="text-xs text-amber-800 font-medium">
                              {currentValResult.passed}/{currentValResult.total} critère{currentValResult.total > 1 ? 's' : ''} validé{currentValResult.total > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleFocusEditor}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-100/50 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-colors shrink-0 shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Modifier mon code</span>
                        </button>
                      </div>

                      {/* List of failed tests with clear description */}
                      <div className="space-y-1.5 pt-2 border-t border-amber-200/80">
                        {currentValResult.tests.map((test, tIdx) => (
                          <div key={tIdx} className="flex items-start gap-2 text-xs sm:text-sm">
                            {test.passed ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span className="text-emerald-900 font-medium">{test.description}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <span className="text-rose-900 font-bold">{test.description}</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 7. Section "💡 Indice" */}
            {currentExercise.hint && (
              <div className="bg-white rounded-3xl p-5 border border-amber-100 shadow-2xs space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Lightbulb className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      Besoin d'un coup de pouce ?
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleHint(currentExercise.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
                  >
                    {isHintOpen ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Masquer l'indice</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Afficher l'indice</span>
                      </>
                    )}
                  </button>
                </div>

                {isHintOpen && (
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs sm:text-sm text-amber-900 whitespace-pre-line leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                    {currentExercise.hint}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons (Spacious for mobile touch) */}
            <div className="flex items-center justify-between gap-3 pt-2">
              {/* Previous Button */}
              <button
                type="button"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="flex-1 min-h-[48px] sm:min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all active:scale-[0.98]"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Exercice précédent</span>
              </button>

              {/* Next or Finish Button */}
              {currentIndex < totalQuestions - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                  className="flex-1 min-h-[48px] sm:min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all active:scale-[0.98]"
                >
                  <span>Exercice suivant</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="flex-1 min-h-[48px] sm:min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all active:scale-[0.98]"
                >
                  <Check className="w-4 h-4" />
                  <span>Terminer l'entraînement</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* CASE B : EXCEL_FORMULA EXERCISE */}
        {/* ================================================================= */}
        {currentExercise && isCurrentExcelExercise && (
          <div className="space-y-6">
            <ClientExcelChallengeView
              exercise={currentExercise}
              isValidating={isValidatingCurrentExcel}
              isSaving={isSavingCurrent}
              validationResult={currentExcelValResult}
              isAlreadyPassedPrior={isAlreadyPassedPrior}
              difficultyBadge={difficultyBadge}
              onValidate={(currentCells, config) => {
                handleValidateExcelExercise(currentExercise, currentCells, config);
              }}
              onOpenInstructionsModal={() => setShowInstructionModal(true)}
            />

            {/* Navigation Buttons (Spacious for mobile touch) */}
            <div className="flex items-center justify-between gap-3 pt-2">
              {/* Previous Button */}
              <button
                type="button"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="flex-1 min-h-[48px] sm:min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all active:scale-[0.98]"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Exercice précédent</span>
              </button>

              {/* Next or Finish Button */}
              {currentIndex < totalQuestions - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                  className="flex-1 min-h-[48px] sm:min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all active:scale-[0.98]"
                >
                  <span>Exercice suivant</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="flex-1 min-h-[48px] sm:min-h-[52px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all active:scale-[0.98]"
                >
                  <Check className="w-4 h-4" />
                  <span>Terminer l'entraînement</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* CASE C : QCM EXERCISE */}
        {/* ================================================================= */}
        {currentExercise && !isCurrentRExercise && !isCurrentExcelExercise && (
          <div className="bg-white rounded-3xl p-5 sm:p-7 border border-gray-100 shadow-2xs space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-sky-50 text-sky-700 border border-sky-100">
                  Question {currentIndex + 1}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${difficultyBadge.bg}`}>
                  {difficultyBadge.label}
                </span>
              </div>
              
              <h2 className="text-base sm:text-xl font-bold text-gray-900 leading-snug">
                {currentExercise.title}
              </h2>

              {currentExercise.instructions && (
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-xs sm:text-sm text-gray-700 whitespace-pre-line leading-relaxed mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                      Consigne :
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowInstructionModal(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors cursor-pointer"
                      title="Agrandir l'énoncé dans une fenêtre"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Voir énoncé</span>
                    </button>
                  </div>
                  {currentExercise.instructions}
                </div>
              )}
            </div>

            {/* Modern Radio Options */}
            <div className="space-y-3 pt-2">
              {optionsList.map((optionText, optIdx) => {
                const isSelected = currentSelectedOption === optIdx;
                const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelectOption(currentExercise.id, optIdx)}
                    className={`w-full text-left flex items-start gap-3.5 p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-sky-50/80 border-sky-500 text-sky-950 shadow-sm ring-2 ring-sky-500/20 font-medium'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/70 text-gray-800'
                    }`}
                  >
                    {/* Radio Indicator */}
                    <div className="pt-0.5 shrink-0 flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected ? 'border-sky-600 bg-sky-600' : 'border-gray-300 bg-white'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      {/* Letter badge */}
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isSelected ? 'bg-sky-200/70 text-sky-900' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {letter}
                      </span>
                    </div>

                    {/* Option Text */}
                    <span className="text-sm sm:text-base leading-relaxed flex-1 pt-0.5">
                      {optionText}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hint for QCM if provided */}
            {currentExercise.hint && (
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-500 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    Indice disponible
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleHint(currentExercise.id)}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700"
                  >
                    {isHintOpen ? "Masquer l'indice" : "Afficher l'indice"}
                  </button>
                </div>
                {isHintOpen && (
                  <div className="mt-2 p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 whitespace-pre-line leading-relaxed">
                    {currentExercise.hint}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-100 gap-3">
              {/* Previous */}
              <button
                type="button"
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="flex-1 min-h-[48px] sm:min-h-[52px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Précédente</span>
              </button>

              {/* Next or Finish */}
              {currentIndex < totalQuestions - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                  className="flex-1 min-h-[48px] sm:min-h-[52px] inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm text-white bg-sky-600 hover:bg-sky-700 shadow-md shadow-sky-200 transition-all active:scale-[0.98]"
                >
                  <span>Suivante</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="flex-1 min-h-[48px] sm:min-h-[52px] inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all active:scale-[0.98]"
                >
                  <Check className="w-4 h-4" />
                  <span>Terminer l'entraînement</span>
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-gray-100 shadow-xl space-y-4">
            <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto">
              <Brain className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-gray-900">
                Voulez-vous vraiment terminer cet entraînement ?
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                {answeredCount === totalQuestions ? (
                  <span className="text-emerald-700 font-semibold">
                    Vous avez complété l'ensemble des {totalQuestions} exercices.
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold">
                    Attention : vous avez complété {answeredCount} sur {totalQuestions} exercices ({totalQuestions - answeredCount} restant{totalQuestions - answeredCount > 1 ? 's' : ''}).
                  </span>
                )}
              </p>
            </div>

            <div className="pt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-full py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmFinish}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-200 transition-all active:scale-95 inline-flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Terminer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instruction Modal - Énoncé de l'exercice */}
      {showInstructionModal && currentExercise && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowInstructionModal(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-indigo-100/80 relative space-y-5 max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Brain Icon Watermark Background (Filigrane) */}
            <div className="absolute -right-8 -bottom-10 pointer-events-none select-none text-indigo-600/[0.07] transform -rotate-12 z-0">
              <Brain className="w-80 h-80 stroke-[1.25]" />
            </div>

            {/* Subtle Top Ambient Gradient Glow */}
            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-indigo-50/80 via-indigo-50/20 to-transparent pointer-events-none z-0" />

            {/* Header with Title and X Button */}
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100/80 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-md shadow-indigo-200">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      Exercice {currentIndex + 1} / {totalQuestions}
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-gray-900 mt-0.5">Énoncé de l'exercice</h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowInstructionModal(false)}
                className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all cursor-pointer active:scale-95"
                title="Fermer la fenêtre"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Exercise Title and Type Badge */}
            <div className="space-y-2 relative z-10">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h4 className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-snug">
                  {currentExercise.title}
                </h4>
                {isCurrentRExercise ? (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 shadow-2xs">
                    <Code2 className="w-3.5 h-3.5 text-emerald-600" /> Code R
                  </span>
                ) : isCurrentExcelExercise ? (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 shadow-2xs">
                    <Table className="w-3.5 h-3.5 text-emerald-600" /> Défi Excel
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200/80 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 shadow-2xs">
                    <Brain className="w-3.5 h-3.5 text-blue-600" /> Question QCM
                  </span>
                )}
              </div>
            </div>

            {/* Full Instructions & Description Content */}
            <div className="overflow-y-auto space-y-4 flex-1 pr-1.5 my-1 relative z-10 custom-scrollbar">
              
              {/* Session / Exercise Description if available */}
              {session?.description && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-900 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Contexte & Description de l'entraînement :</span>
                  </div>
                  <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-100/90 text-xs text-gray-700 leading-relaxed font-normal">
                    {session.description}
                  </div>
                </div>
              )}

              {/* Énoncé de départ / Consigne officielle */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-900 uppercase tracking-wider">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Énoncé & Consigne de l'exercice :</span>
                </div>
                <div className="p-4 sm:p-5 bg-gradient-to-b from-gray-50/90 to-slate-50/90 backdrop-blur-xs rounded-2xl border border-gray-200/80 text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-line font-medium shadow-2xs">
                  {currentExercise.instructions || "Aucun énoncé spécifique fourni pour cet exercice."}
                </div>
              </div>

              {/* Starter Code if Code R exercise */}
              {currentExercise.starter_code && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                    <Code2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Code R de départ fourni :</span>
                  </div>
                  <div className="p-3.5 bg-gray-900 text-emerald-400 font-mono text-xs rounded-2xl border border-gray-800 overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-2xs">
                    <code>{currentExercise.starter_code}</code>
                  </div>
                </div>
              )}

              {/* Target cells if Excel challenge */}
              {isCurrentExcelExercise && currentExercise.test_cases?.target_cells?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 uppercase tracking-wider">
                    <Table className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cellule(s) cible(s) à compléter :</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {currentExercise.test_cases.target_cells.map((tc: string) => (
                      <span key={tc} className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-black text-xs rounded-xl shadow-2xs">
                        {tc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* QCM Options if available */}
              {currentExercise.options && currentExercise.options.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                    <Brain className="w-3.5 h-3.5 text-blue-600" />
                    <span>Options de réponse :</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {currentExercise.options.map((opt, i) => (
                      <div key={i} className="p-3 bg-blue-50/40 rounded-xl border border-blue-100/80 text-xs text-gray-800 flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-lg bg-blue-100 text-blue-800 font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="leading-snug">{opt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hint if present */}
              {currentExercise.hint && (
                <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold block mb-0.5 uppercase tracking-wider text-[10px]">Indice pédagogique :</span>
                    <span className="leading-relaxed">{currentExercise.hint}</span>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="pt-3.5 border-t border-gray-100 flex items-center justify-end relative z-10">
              <button
                type="button"
                onClick={() => setShowInstructionModal(false)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300 cursor-pointer active:scale-98"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
