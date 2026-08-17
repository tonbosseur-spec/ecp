import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/Toast';
import { 
  Brain, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Clock, 
  Award, 
  BookOpen, 
  Sparkles, 
  RotateCcw, 
  Check, 
  AlertCircle, 
  Search, 
  Filter, 
  Loader2, 
  Trophy, 
  Play, 
  ArrowLeft,
  Terminal,
  Info,
  RefreshCw,
  Share2
} from 'lucide-react';
import { TrainingSession, TrainingExercise, TrainingDifficultyLevel, TrainingActivityType } from '../types';

interface AttemptResultDetail {
  exercise_id: string;
  selected_option_index: number | null;
  correct_option_index: number;
  is_correct: boolean;
  explanation?: string | null;
}

interface AttemptSummary {
  attempt_id: string;
  session_id: string;
  score_percentage: number;
  is_passed: boolean;
  total_questions: number;
  correct_count: number;
  time_spent_seconds: number;
  results: AttemptResultDetail[];
}

export default function ClientTrainingHub() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Primary Data States
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [userEnrolledCourses, setUserEnrolledCourses] = useState<{ id: string; title: string }[]>([]);
  const [pastAttempts, setPastAttempts] = useState<any[]>([]);

  // Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');

  // Active training runner state (Quiz QCM)
  const [activeSession, setActiveSession] = useState<TrainingSession | null>(null);
  const [exercises, setExercises] = useState<TrainingExercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [attemptResult, setAttemptResult] = useState<AttemptSummary | null>(null);

  // Timer effect for active training
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (activeSession && !attemptResult) {
      interval = setInterval(() => {
        setTimeSpentSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSession, attemptResult]);

  // Initial load
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      const session = authData?.session;

      if (!session) {
        navigate('/client/login');
        return;
      }

      setCurrentUser(session.user);
      const userId = session.user.id;

      // 1. Fetch user approved registrations to identify courses they are enrolled in
      const { data: regData, error: regError } = await supabase
        .from('registrations')
        .select(`
          course_id,
          payment_status,
          courses (id, title)
        `)
        .eq('client_id', userId)
        .eq('payment_status', 'approved');

      if (regError) {
        console.warn("Erreur lors de la récupération des inscriptions:", regError);
      }

      const enrolledCourses: { id: string; title: string }[] = [];
      if (regData) {
        regData.forEach((r: any) => {
          if (r.courses && !enrolledCourses.some(c => c.id === r.courses.id)) {
            enrolledCourses.push({ id: r.courses.id, title: r.courses.title });
          }
        });
      }
      setUserEnrolledCourses(enrolledCourses);

      // 2. Fetch training sessions through normal Supabase query (RLS handles student/admin access)
      // We NEVER fetch training_qcm_answers table on client side.
      const { data: sessionsData, error: sessionsError } = await supabase
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
          courses (id, title),
          training_exercises (id, exercise_type, is_active)
        `)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      const formattedSessions: TrainingSession[] = (sessionsData || []).map((s: any) => ({
        ...s,
        training_exercises: (s.training_exercises || []).filter((ex: any) => ex.is_active !== false)
      }));

      setSessions(formattedSessions);

      // 3. Fetch past attempts for this user to compute best scores and history
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('training_attempts')
        .select('id, training_session_id, score_percentage, is_passed, time_spent_seconds, completed_at')
        .eq('client_id', userId)
        .order('completed_at', { ascending: false });

      if (attemptsError) {
        console.warn("Erreur lors de la récupération des tentatives:", attemptsError);
      }

      setPastAttempts(attemptsData || []);
    } catch (err: any) {
      console.error("Erreur chargement de l'espace entraînement:", err);
      setErrorMessage(err.message || 'Impossible de communiquer avec le serveur Supabase.');
      toast.error("Erreur de chargement : " + (err.message || 'Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  // Compute best score and status per session
  const sessionStatsMap = useMemo(() => {
    const map: Record<string, { bestScore: number; attemptsCount: number; isPassed: boolean; lastAttemptDate?: string }> = {};
    pastAttempts.forEach(att => {
      const sId = att.training_session_id;
      if (!map[sId]) {
        map[sId] = {
          bestScore: Number(att.score_percentage || 0),
          attemptsCount: 1,
          isPassed: Boolean(att.is_passed),
          lastAttemptDate: att.completed_at
        };
      } else {
        map[sId].attemptsCount += 1;
        if (Number(att.score_percentage || 0) > map[sId].bestScore) {
          map[sId].bestScore = Number(att.score_percentage || 0);
        }
        if (att.is_passed) {
          map[sId].isPassed = true;
        }
      }
    });
    return map;
  }, [pastAttempts]);

  // Overall student stats
  const overallStats = useMemo(() => {
    const totalSessions = sessions.length;
    const completedSessionsCount = Object.keys(sessionStatsMap).filter(id => sessionStatsMap[id]?.isPassed).length;
    const totalAttempts = pastAttempts.length;
    const avgScore = pastAttempts.length > 0 
      ? Math.round(pastAttempts.reduce((acc, curr) => acc + Number(curr.score_percentage || 0), 0) / pastAttempts.length)
      : 0;

    return { totalSessions, completedSessionsCount, totalAttempts, avgScore };
  }, [sessions, sessionStatsMap, pastAttempts]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Course filter
      if (selectedCourseFilter !== 'all') {
        if (selectedCourseFilter === 'general' && session.course_id !== null) return false;
        if (selectedCourseFilter !== 'general' && session.course_id !== selectedCourseFilter) return false;
      }

      // Type filter
      if (selectedTypeFilter !== 'all' && session.activity_type !== selectedTypeFilter) {
        return false;
      }

      // Difficulty filter
      if (selectedDifficulty !== 'all' && session.difficulty_level !== selectedDifficulty) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = (session.title || '').toLowerCase().includes(query);
        const matchesDesc = (session.description || '').toLowerCase().includes(query);
        const matchesCourse = (session.courses?.title || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesCourse) return false;
      }

      return true;
    });
  }, [sessions, selectedCourseFilter, selectedTypeFilter, selectedDifficulty, searchQuery]);

  // Start training session
  const handleStartSession = (session: TrainingSession) => {
    navigate(`/client/training/${session.id}`);
  };

  // Submit attempt to secure RPC
  const handleSubmitAttempt = async () => {
    if (!activeSession) return;
    try {
      setSubmitting(true);

      const answersPayload = exercises.map(ex => ({
        exercise_id: ex.id,
        selected_option_index: selectedAnswers[ex.id] !== undefined ? selectedAnswers[ex.id] : null
      }));

      const { data, error } = await supabase.rpc('submit_training_qcm_attempt', {
        p_session_id: activeSession.id,
        p_answers: answersPayload,
        p_time_spent_seconds: timeSpentSeconds
      });

      if (error) throw error;

      setAttemptResult(data as AttemptSummary);
      toast.success(data.is_passed ? "Félicitations ! Entraînement réussi !" : "Entraînement terminé !");

      // Refresh past attempts in background
      if (currentUser?.id) {
        const { data: newAttempts } = await supabase
          .from('training_attempts')
          .select('id, training_session_id, score_percentage, is_passed, time_spent_seconds, completed_at')
          .eq('client_id', currentUser.id)
          .order('completed_at', { ascending: false });
        if (newAttempts) setPastAttempts(newAttempts);
      }
    } catch (err: any) {
      console.error("Erreur lors de la soumission de l'entraînement:", err);
      toast.error("Erreur lors de l'enregistrement de votre tentative : " + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Difficulty badge styling
  const getDifficultyBadge = (level: TrainingDifficultyLevel) => {
    switch (level) {
      case 'beginner':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Débutant
          </span>
        );
      case 'intermediate':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Intermédiaire
          </span>
        );
      case 'advanced':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Avancé
          </span>
        );
      default:
        return null;
    }
  };

  // Activity type badge styling
  const getActivityTypeBadge = (type: TrainingActivityType) => {
    switch (type) {
      case 'quiz_qcm':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/60">
            <Brain className="w-3 h-3 text-sky-600" />
            Quiz QCM
          </span>
        );
      case 'r_exercise':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
            <Terminal className="w-3 h-3 text-purple-600" />
            Exercices R
          </span>
        );
      case 'mixed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            <Sparkles className="w-3 h-3 text-indigo-600" />
            Mixte
          </span>
        );
      default:
        return null;
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
            <h3 className="text-base font-bold text-gray-900">Chargement de vos entraînements</h3>
            <p className="text-xs text-gray-500 mt-1">Vérification de vos modules et calcul des scores...</p>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 4: SUPABASE ERROR
  // =========================================================================
  if (errorMessage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-3xl border border-rose-100 shadow-sm max-w-md w-full space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Impossible de charger les entraînements</h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1.5 leading-relaxed">
              {errorMessage}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={fetchInitialData}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Réessayer
            </button>
            <Link
              to="/client/hub"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Retour au Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: RESULT & PEDAGOGICAL REVIEW SCREEN
  // =========================================================================
  if (activeSession && attemptResult) {
    const isPassed = attemptResult.is_passed;
    return (
      <div className="min-h-screen bg-gray-50 font-sans py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm text-center relative overflow-hidden">
            <div className={`absolute top-0 inset-x-0 h-2 ${isPassed ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`} />
            
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl mx-auto flex items-center justify-center mb-4 ${isPassed ? 'bg-emerald-50 text-emerald-600 shadow-lg shadow-emerald-100' : 'bg-amber-50 text-amber-600 shadow-lg shadow-amber-100'}`}>
              {isPassed ? <Trophy className="w-8 h-8 sm:w-10 sm:h-10" /> : <Award className="w-8 h-8 sm:w-10 sm:h-10" />}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
              {isPassed ? '🎉 Félicitations !' : '💪 Continuez à vous entraîner !'}
            </h1>
            <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
              {isPassed
                ? 'Vous avez réussi cette session d\'entraînement avec brio. Vos acquis sont solides !'
                : 'Vous êtes sur la bonne voie. Prenez le temps de revoir les explications détaillées ci-dessous.'}
            </p>

            {/* Score cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-lg mx-auto mb-6">
              <div className="bg-gray-50 rounded-2xl p-3 sm:p-4 border border-gray-100">
                <span className="text-xs font-bold text-gray-400 block mb-1">Score</span>
                <span className={`text-xl sm:text-2xl font-black ${isPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {attemptResult.score_percentage}%
                </span>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 sm:p-4 border border-gray-100">
                <span className="text-xs font-bold text-gray-400 block mb-1">Réponses</span>
                <span className="text-xl sm:text-2xl font-black text-gray-900">
                  {attemptResult.correct_count}/{attemptResult.total_questions}
                </span>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 sm:p-4 border border-gray-100">
                <span className="text-xs font-bold text-gray-400 block mb-1">Temps</span>
                <span className="text-xl sm:text-2xl font-black text-gray-900">
                  {formatTime(attemptResult.time_spent_seconds)}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => handleStartSession(activeSession)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-sky-200 transition-all active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                Recommencer l'entraînement
              </button>
              <button
                onClick={() => {
                  setActiveSession(null);
                  setAttemptResult(null);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl font-bold text-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour aux entraînements
              </button>
            </div>
          </div>

          {/* Detailed Question Review */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-sky-600" />
              Correction & Explications pédagogiques
            </h2>

            {attemptResult.results.map((res, index) => {
              const exercise = exercises.find(e => e.id === res.exercise_id);
              if (!exercise) return null;

              const options = (exercise.options as string[]) || [];

              return (
                <div 
                  key={res.exercise_id}
                  className={`bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border transition-all ${
                    res.is_correct ? 'border-emerald-200/80 shadow-2xs' : 'border-rose-200/80 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="text-xs font-extrabold text-gray-400">
                      Question {index + 1} sur {attemptResult.total_questions}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                      res.is_correct ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {res.is_correct ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Correct
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          Incorrect
                        </>
                      )}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-gray-900 mb-4 leading-snug">
                    {exercise.title}
                  </h3>

                  {/* Options display with correct/incorrect states */}
                  <div className="space-y-2 mb-4">
                    {options.map((opt, optIdx) => {
                      const isUserChoice = res.selected_option_index === optIdx;
                      const isCorrectChoice = res.correct_option_index === optIdx;

                      let styleClass = "bg-gray-50 border-gray-200 text-gray-700";
                      if (isCorrectChoice) {
                        styleClass = "bg-emerald-50 border-emerald-400 text-emerald-950 font-semibold ring-2 ring-emerald-400/20";
                      } else if (isUserChoice && !isCorrectChoice) {
                        styleClass = "bg-rose-50 border-rose-400 text-rose-950 font-semibold";
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`flex items-start gap-3 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border text-sm transition-all ${styleClass}`}
                        >
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isCorrectChoice 
                              ? 'bg-emerald-600 text-white' 
                              : (isUserChoice ? 'bg-rose-600 text-white' : 'bg-gray-200 text-gray-600')
                          }`}>
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="flex-1 leading-snug">{opt}</span>
                          {isCorrectChoice && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                              Bonne réponse
                            </span>
                          )}
                          {isUserChoice && !isCorrectChoice && (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full shrink-0">
                              Votre choix
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pedagogical explanation */}
                  {res.explanation && (
                    <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 text-xs sm:text-sm text-sky-950">
                      <div className="flex items-center gap-1.5 font-bold text-sky-800 mb-1">
                        <Sparkles className="w-4 h-4 text-sky-600" />
                        <span>Explication du formateur :</span>
                      </div>
                      <p className="leading-relaxed text-sky-900">{res.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: ACTIVE QUIZ RUNNER SCREEN
  // =========================================================================
  if (activeSession) {
    const currentEx = exercises[currentQuestionIndex];
    const totalQ = exercises.length;
    const progressPercent = totalQ > 0 ? Math.round(((currentQuestionIndex + 1) / totalQ) * 100) : 0;
    const answeredCount = Object.keys(selectedAnswers).length;

    return (
      <div className="min-h-screen bg-gray-50 font-sans py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
          {/* Top Bar with Exit & Timer */}
          <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-2xs">
            <button
              onClick={() => {
                if (window.confirm("Quitter cet entraînement ? Votre progression actuelle ne sera pas sauvegardée.")) {
                  setActiveSession(null);
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Quitter</span>
            </button>

            <div className="flex items-center gap-2 bg-sky-50 text-sky-700 px-3 py-1.5 rounded-full text-xs font-extrabold border border-sky-100">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>{formatTime(timeSpentSeconds)}</span>
            </div>
          </div>

          {/* Session Header & Progress */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-[11px] font-extrabold text-sky-600 tracking-wide uppercase">
                  {activeSession.courses?.title || "Entraînement Général"}
                </span>
                <h1 className="text-base sm:text-lg font-bold text-gray-900">
                  {activeSession.title}
                </h1>
              </div>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                Question {currentQuestionIndex + 1} / {totalQ}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-sky-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Question Quick Jump Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {exercises.map((ex, idx) => {
                const isAnswered = selectedAnswers[ex.id] !== undefined;
                const isCurrent = idx === currentQuestionIndex;
                return (
                  <button
                    key={ex.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                      isCurrent 
                        ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-200' 
                        : (isAnswered ? 'bg-sky-100 text-sky-700 hover:bg-sky-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Card */}
          {loadingExercises || !currentEx ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100">
              <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-500">Chargement de la question...</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-5 sm:p-7 border border-gray-100 shadow-sm space-y-6">
              <div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 mb-1">
                  <Brain className="w-3.5 h-3.5 text-sky-600" />
                  Question {currentQuestionIndex + 1}
                </span>
                <h2 className="text-base sm:text-xl font-bold text-gray-900 leading-snug">
                  {currentEx.title}
                </h2>
                {currentEx.instructions && (
                  <p className="text-xs sm:text-sm text-gray-600 mt-2 whitespace-pre-line leading-relaxed">
                    {currentEx.instructions}
                  </p>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3">
                {((currentEx.options as string[]) || []).map((optionText, optIdx) => {
                  const isSelected = selectedAnswers[currentEx.id] === optIdx;
                  return (
                    <button
                      key={optIdx}
                      onClick={() => {
                        setSelectedAnswers(prev => ({
                          ...prev,
                          [currentEx.id]: optIdx
                        }));
                      }}
                      className={`w-full text-left flex items-start gap-3.5 p-4 rounded-2xl border transition-all duration-200 ${
                        isSelected 
                          ? 'bg-sky-50 border-sky-500 text-sky-950 shadow-sm ring-2 ring-sky-500/20 font-semibold' 
                          : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/70 text-gray-800'
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                        isSelected ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className="text-sm sm:text-base leading-snug flex-1 pt-0.5">
                        {optionText}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 gap-3">
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="inline-flex items-center gap-1 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Précédent
                </button>

                {currentQuestionIndex < totalQ - 1 ? (
                  <button
                    onClick={() => setCurrentQuestionIndex(prev => Math.min(totalQ - 1, prev + 1))}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm text-white bg-sky-600 hover:bg-sky-700 shadow-md shadow-sky-200 transition-all active:scale-95"
                  >
                    Suivant
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitAttempt}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-2xl font-black text-xs sm:text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Évaluation...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Valider & Terminer ({answeredCount}/{totalQ})
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: MAIN TRAINING HUB LIST SCREEN
  // =========================================================================
  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-2xs sticky top-0 z-20 pt-safe">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 min-h-[4rem]">
            <div className="flex items-center gap-3">
              <Link 
                to="/client/hub"
                className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 shrink-0"
                title="Retour au tableau de bord"
              >
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <Brain className="w-6 h-6 text-sky-600" />
                    <span>S'exercer</span>
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200/80 shadow-2xs">
                    Entraînement
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Entraînez-vous sur vos formations et progressez à votre rythme.
                </p>
              </div>

              {/* Sub-Navigation Switcher: Exercices vs R Libre */}
              <div className="hidden md:flex items-center gap-1.5 p-1 bg-gray-100 rounded-2xl ml-4">
                <div className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-white text-sky-700 shadow-2xs flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-sky-600" />
                  <span>Exercices & Quiz</span>
                </div>
                <Link
                  to="/client/training/r"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:text-purple-700 transition-all flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5 text-purple-600" />
                  <span>💻 R libre</span>
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/client/training/r"
                className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-extrabold transition-all"
              >
                <Terminal className="w-3.5 h-3.5 text-purple-600" />
                <span>R libre</span>
              </Link>

              <Link
                to="/client/hub"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Tableau de bord
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Banner for Free R Sandbox */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-purple-500/20">
          <div className="space-y-1.5 relative z-10 max-w-xl">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-200 border border-purple-400/30">
              <Terminal className="w-3 h-3 text-purple-300" />
              Espace d'entraînement autonome
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white">
              💻 Console R libre (Bac à sable)
            </h3>
            <p className="text-xs text-purple-100 font-medium leading-relaxed">
              Exécutez librement du code R, testez des scripts, examinez vos données et vos graphiques directement dans votre navigateur grâce à WebAssembly.
            </p>
          </div>

          <Link
            to="/client/training/r"
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap self-stretch sm:self-center"
          >
            <span>Ouvrir R libre</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Banner with Overview Stats */}
        <div className="bg-gradient-to-br from-sky-600 via-indigo-600 to-blue-800 rounded-3xl p-5 sm:p-7 text-white relative overflow-hidden shadow-lg shadow-sky-900/10">
          <div className="absolute top-0 right-0 p-6 opacity-10 transform translate-x-4 -translate-y-4 pointer-events-none">
            <Brain className="w-48 h-48 text-white" />
          </div>

          <div className="relative z-10 max-w-2xl space-y-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-white/20 backdrop-blur-sm text-sky-100 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-sky-200" />
              Pratique & Évaluation continue
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
              S'exercer & Tester ses acquis
            </h2>
            <p className="text-xs sm:text-sm text-sky-100 leading-relaxed font-medium">
              Entraînez-vous sur vos formations et progressez à votre rythme grâce aux quiz ciblés et aux corrections pédagogiques.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mt-5 pt-5 border-t border-white/15">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
              <span className="text-[11px] text-sky-200 font-bold block">Entraînements dispo</span>
              <span className="text-xl sm:text-2xl font-black text-white">{overallStats.totalSessions}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
              <span className="text-[11px] text-sky-200 font-bold block">Sessions réussies</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-300">{overallStats.completedSessionsCount}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
              <span className="text-[11px] text-sky-200 font-bold block">Tentatives totales</span>
              <span className="text-xl sm:text-2xl font-black text-white">{overallStats.totalAttempts}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
              <span className="text-[11px] text-sky-200 font-bold block">Score moyen</span>
              <span className="text-xl sm:text-2xl font-black text-sky-200">{overallStats.avgScore}%</span>
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search */}
            <div className="relative sm:col-span-4">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un entraînement..."
                className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-gray-400"
              />
            </div>

            {/* Course Filter */}
            <div className="sm:col-span-4">
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              >
                <option value="all">Toutes les formations</option>
                <option value="general">Entraînements généraux</option>
                {userEnrolledCourses.map(c => (
                  <option key={c.id} value={c.id}>
                    Formation : {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="sm:col-span-2">
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              >
                <option value="all">Tous les types</option>
                <option value="quiz_qcm">Quiz QCM</option>
                <option value="r_exercise">Exercices R</option>
                <option value="mixed">Mixte</option>
              </select>
            </div>

            {/* Difficulty Filter */}
            <div className="sm:col-span-2">
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              >
                <option value="all">Tous niveaux</option>
                <option value="beginner">Débutant</option>
                <option value="intermediate">Intermédiaire</option>
                <option value="advanced">Avancé</option>
              </select>
            </div>
          </div>
        </div>

        {/* Training Sessions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>Sessions d'entraînement disponibles</span>
              <span className="text-xs font-black bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-full border border-sky-200">
                {filteredSessions.length}
              </span>
            </h3>
          </div>

          {/* STATE 2: NO SESSIONS AVAILABLE AT ALL */}
          {sessions.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-gray-100 shadow-2xs space-y-3">
              <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-3xl flex items-center justify-center mx-auto">
                <Brain className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-gray-900">Aucun entraînement disponible pour le moment</h4>
              <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                Les sessions d'entraînement sont accessibles lorsque vous êtes inscrit à une formation validée ou lorsque des quiz généraux sont publiés par l'équipe pédagogique.
              </p>
              <div className="pt-2">
                <Link
                  to="/catalogue"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Découvrir le catalogue de formations
                </Link>
              </div>
            </div>
          ) : filteredSessions.length === 0 ? (
            /* STATE 3: NO SEARCH / FILTER RESULTS */
            <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-gray-100 shadow-2xs space-y-3">
              <div className="w-14 h-14 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-gray-900">Aucun résultat pour cette recherche</h4>
              <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
                Aucun entraînement ne correspond à vos filtres actuels. Modifiez vos critères ou réinitialisez la recherche.
              </p>
              <div className="pt-1">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCourseFilter('all');
                    setSelectedTypeFilter('all');
                    setSelectedDifficulty('all');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Réinitialiser tous les filtres
                </button>
              </div>
            </div>
          ) : (
            /* STATE 5: AVAILABLE SESSIONS CARDS */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSessions.map((session) => {
                const stats = sessionStatsMap[session.id];
                const exerciseCount = Array.isArray(session.training_exercises) ? session.training_exercises.length : 0;
                const isRExercise = session.activity_type === 'r_exercise';

                return (
                  <div
                    key={session.id}
                    className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between group"
                  >
                    <div className="space-y-3.5">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {getDifficultyBadge(session.difficulty_level)}
                          {getActivityTypeBadge(session.activity_type)}
                        </div>

                        {stats?.bestScore !== undefined && (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                            stats.isPassed 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {stats.isPassed ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Award className="w-3 h-3 text-amber-600" />
                            )}
                            Meilleur score : {stats.bestScore}%
                          </span>
                        )}
                      </div>

                      {/* Course badge if attached */}
                      <div>
                        {session.courses ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 mb-1">
                            <BookOpen className="w-3 h-3" />
                            {session.courses.title}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            Entraînement général
                          </span>
                        )}

                        <h4 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-sky-700 transition-colors leading-snug">
                          {session.title}
                        </h4>

                        {session.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                            {session.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom Metadata and Action */}
                    <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                        <span className="flex items-center gap-1">
                          <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
                          {exerciseCount} exercice{exerciseCount !== 1 ? 's' : ''}
                        </span>
                        {stats && (
                          <span className="text-gray-400">
                            {stats.attemptsCount} tentative{stats.attemptsCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const publicUrl = `${window.location.origin}/training/${session.slug || session.id}`;
                            navigator.clipboard.writeText(publicUrl);
                            toast.success('Lien public de la présentation copié !');
                          }}
                          className="p-2.5 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-2xl border border-gray-200 transition-all cursor-pointer"
                          title="Partager la page publique de présentation"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleStartSession(session)}
                          className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all active:scale-95 cursor-pointer ${
                            isRExercise
                              ? stats?.isPassed
                                ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                                : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-200'
                              : stats?.isPassed
                                ? 'bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200'
                                : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-200'
                          }`}
                        >
                          {isRExercise ? (
                            <Terminal className="w-3.5 h-3.5 text-current" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                          <span>{stats ? "S'entraîner à nouveau" : "S'entraîner"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
