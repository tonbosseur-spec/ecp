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
  Loader2
} from 'lucide-react';
import { TrainingSession, TrainingExercise } from '../types';
import REditorConsole, { REditorConsoleRef } from '../components/REditorConsole';
import { validateCode, resetREnvironment, RValidationResult } from '../lib/webrEngine';

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

  // Ref to R editor for automatic focus
  const rEditorRef = useRef<REditorConsoleRef | null>(null);

  // Modal confirmation state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCompletedState, setIsCompletedState] = useState(false);

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
          test_cases,
          created_at
        `)
        .eq('training_session_id', sessionId)
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
    setTimeSpentSeconds(0);
    setCurrentIndex(0);
    setIsCompletedState(false);
    setQcmAnswers({});
    toast.success("Nouvelle tentative commencée !");
  };

  // Validate R Code against test cases & persist progress securely
  const handleValidateRExercise = async (exercise: TrainingExercise) => {
    const code = rCodes[exercise.id] !== undefined 
      ? rCodes[exercise.id] 
      : (exercise.starter_code || '');

    if (!code.trim()) {
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
      // Strictly store minimal metadata in answer_data (NO raw student code)
      const answerDataPayload = {
        type: 'r_code',
        passed_tests: passedTests,
        total_tests: totalTests
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

  // Final confirmation action
  const handleConfirmFinish = async () => {
    setShowConfirmModal(false);
    setIsCompletedState(true);

    if (currentAttemptId) {
      try {
        await supabase
          .from('training_attempts')
          .update({
            completed_at: new Date().toISOString(),
            time_spent_seconds: timeSpentSeconds
          })
          .eq('id', currentAttemptId);
      } catch (err) {
        console.error("Erreur finalisation tentative:", err);
      }
    }

    toast.success("Vos réponses ont été enregistrées avec succès !");
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
  const answeredCount = exercises.filter(ex => 
    ex.exercise_type === 'r_code' ? isRAnswered(ex) : isQcmAnswered(ex)
  ).length;

  const validRExercisesCount = exercises.filter(ex => 
    ex.exercise_type === 'r_code' && (validationResults[ex.id]?.success || previousExerciseHistory[ex.id]?.isPassed)
  ).length;

  if (isCompletedState) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <Check className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-gray-900">Entraînement terminé !</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Vous avez complété la session <span className="font-semibold text-gray-900">« {session.title} »</span>.
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 grid grid-cols-2 gap-3 text-left">
            <div>
              <span className="text-[11px] text-gray-400 font-bold block">Exercices validés</span>
              <span className="text-base font-bold text-gray-900">{validRExercisesCount} / {exercises.length}</span>
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
  // STATE 4: ACTIVE EXERCISE READER (QCM OR R_CODE)
  // =========================================================================
  const currentExercise = exercises[currentIndex];
  const progressPercent = totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0;
  const currentSelectedOption = currentExercise ? qcmAnswers[currentExercise.id] : undefined;
  const optionsList = (currentExercise?.options as string[]) || [];
  const isCurrentRExercise = currentExercise?.exercise_type === 'r_code';
  const difficultyBadge = getDifficultyBadge(session.difficulty_level || 'intermediaire');
  const isHintOpen = currentExercise ? !!showHints[currentExercise.id] : false;

  // Validation result for current exercise
  const currentValResult = currentExercise ? validationResults[currentExercise.id] : undefined;
  const isValidatingCurrent = currentExercise ? !!validatingR[currentExercise.id] : false;
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
              ) : (
                <Brain className="w-4 h-4 text-sky-600" />
              )}
              {isCurrentRExercise ? 'Exercice R' : 'Question QCM'} {currentIndex + 1} / {totalQuestions}
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
              const isAnswered = isR ? isRAnswered(ex) : isQcmAnswered(ex);
              const isCurrent = idx === currentIndex;
              const isRValidated = isR && (validationResults[ex.id]?.success || previousExerciseHistory[ex.id]?.isPassed);

              let btnClass = 'bg-gray-100 text-gray-600 hover:bg-gray-200';
              if (isCurrent) {
                btnClass = isR 
                  ? 'bg-indigo-600 text-white font-extrabold shadow-sm ring-2 ring-indigo-200'
                  : 'bg-sky-600 text-white font-extrabold shadow-sm ring-2 ring-sky-200';
              } else if (isRValidated) {
                btnClass = 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-extrabold';
              } else if (isAnswered) {
                btnClass = isR
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold'
                  : 'bg-sky-50 text-sky-700 border border-sky-200/80 font-bold';
              }

              return (
                <button
                  key={ex.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-xs flex items-center justify-center transition-all duration-150 ${btnClass}`}
                  title={`${isR ? 'Exercice R' : 'QCM'} ${idx + 1}`}
                >
                  {isRValidated ? '✓' : idx + 1}
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
                  <p className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    Consigne :
                  </p>
                  {currentExercise.instructions}
                </div>
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
        {/* CASE B : QCM EXERCISE */}
        {/* ================================================================= */}
        {currentExercise && !isCurrentRExercise && (
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
                className="w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all active:scale-95"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
