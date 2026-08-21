import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Code2, 
  HelpCircle, 
  Video, 
  Image as ImageIcon, 
  FileText, 
  Sparkles, 
  AlertCircle, 
  Lightbulb, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Check, 
  Play, 
  Layers,
  Award,
  Trophy,
  X,
  List,
  Lock
} from 'lucide-react';
import { 
  InteractiveCourseModule,
  InteractiveCourseLesson, 
  InteractiveActivity,
  InteractiveActivityProgress 
} from '../types';
import { REditorConsole } from '../components/REditorConsole';
import { RCorrectionResultsView } from '../components/RCorrectionResultsView';
import { RPackagePreparationBanner } from '../components/RPackagePreparationBanner';
import {
  prepareActivityRPackages,
  normalizeActivityPackages,
  areAllPackagesLoadedInSession,
  PackagePreparationStep
} from '../lib/rPackageManager';
import {
  runWebRCorrectionSuite,
  normalizeRCorrectionCriteria,
  RCorrectionSuiteResult
} from '../lib/rCorrectionEngine';
import {
  getUserCourseProgress,
  recordActivityProgress,
  calculateLessonProgression
} from '../lib/interactiveProgressService';
import {
  getNextActivity,
  getPreviousActivity,
  getFirstIncompleteActivity,
  isLessonCompleted,
  isModuleCompleted,
  isCourseCompleted,
  isActivityUnlocked,
  isLessonUnlocked,
  FlattenedActivityItem
} from '../lib/courseNavigationService';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface NormalizedQuizQuestion {
  question: string;
  options: string[];
  correct_answer: number;
}

export default function ClientInteractiveActivityPlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlActivityId = searchParams.get('activityId');

  const [lesson, setLesson] = useState<InteractiveCourseLesson | null>(null);
  const [activities, setActivities] = useState<InteractiveActivity[]>([]);
  const [allModules, setAllModules] = useState<InteractiveCourseModule[]>([]);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mobile activity selector modal & course completion overlay states
  const [showMobileActivityList, setShowMobileActivityList] = useState<boolean>(false);
  const [showCourseCompletionScreen, setShowCourseCompletionScreen] = useState<boolean>(false);

  // User auth & Progress state
  const [userId, setUserId] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Map<string, InteractiveActivityProgress>>(new Map());

  // Progressive hints state
  const [revealedHintCount, setRevealedHintCount] = useState<number>(0);

  // Quiz interactive state (Multi-questions support)
  const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState<number>(0);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [isQuizQuestionSubmitted, setIsQuizQuestionSubmitted] = useState<boolean>(false);
  const [quizAnswersHistory, setQuizAnswersHistory] = useState<{
    questionIndex: number;
    selectedOption: number;
    isCorrect: boolean;
  }[]>([]);
  const [isQuizCompleted, setIsQuizCompleted] = useState<boolean>(false);

  // Code R interactive evaluation state
  const [studentRCode, setStudentRCode] = useState<string>('');
  const [rCorrectionResult, setRCorrectionResult] = useState<RCorrectionSuiteResult | null>(null);
  const [isEvaluatingR, setIsEvaluatingR] = useState<boolean>(false);

  // Code R package preparation state
  const [isPreparingPackages, setIsPreparingPackages] = useState<boolean>(false);
  const [isPackagesReady, setIsPackagesReady] = useState<boolean>(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [packageSteps, setPackageSteps] = useState<PackagePreparationStep[]>([]);
  const [packageStatusMessage, setPackageStatusMessage] = useState<string>('');

  useEffect(() => {
    async function fetchLessonAndActivities() {
      if (!lessonId) return;
      try {
        setLoading(true);
        setError(null);

        // Fetch auth session
        const { data: authData } = await supabase.auth.getSession();
        const user = authData?.session?.user;
        const currentUid = user?.id || null;
        setUserId(currentUid);

        // Fetch lesson details with module & course title
        const { data: lessonData, error: lessonErr } = await supabase
          .from('interactive_course_lessons')
          .select(`
            *,
            interactive_course_modules (
              id,
              title,
              position,
              course_id,
              interactive_courses (
                id,
                title,
                slug,
                status
              )
            )
          `)
          .eq('id', lessonId)
          .single();

        if (lessonErr) throw lessonErr;
        if (!lessonData) throw new Error("Leçon introuvable.");

        setLesson(lessonData);

        // Fetch activities of this lesson
        const { data: activitiesData, error: activitiesErr } = await supabase
          .from('interactive_activities')
          .select('*')
          .eq('lesson_id', lessonId)
          .order('position', { ascending: true });

        if (activitiesErr) throw activitiesErr;

        const loadedActivities = activitiesData || [];
        setActivities(loadedActivities);
        setLesson({ ...lessonData, interactive_activities: loadedActivities });

        // Fetch full course structure (all modules, lessons, activities) for seamless navigation
        const courseUuid = lessonData.interactive_course_modules?.course_id;
        if (courseUuid) {
          const { data: modulesData } = await supabase
            .from('interactive_course_modules')
            .select(`
              *,
              interactive_course_lessons (
                *,
                interactive_activities (
                  *
                )
              )
            `)
            .eq('course_id', courseUuid)
            .order('position', { ascending: true });

          if (modulesData) {
            const sortedModules = modulesData.map((m: any) => ({
              ...m,
              position: m.position ?? 0,
              interactive_course_lessons: (m.interactive_course_lessons || [])
                .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
                .map((l: any) => ({
                  ...l,
                  position: l.position ?? 0,
                  interactive_activities: (l.interactive_activities || []).sort(
                    (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
                  )
                }))
            }));
            setAllModules(sortedModules);
          }

          if (currentUid) {
            const userProg = await getUserCourseProgress(currentUid, courseUuid);
            setProgressMap(userProg);
          }
        }
      } catch (err: any) {
        console.error("Erreur chargement leçon:", err);
        setError(err?.message || "Impossible de charger cette leçon.");
      } finally {
        setLoading(false);
      }
    }

    fetchLessonAndActivities();
  }, [lessonId, courseId]);

  const currentActivity = activities[currentActivityIndex] || null;
  const isCurrentActivityDone = currentActivity ? progressMap.get(currentActivity.id)?.completed === true : false;
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null);

  // Lesson progression summary
  const lessonProgression = useMemo(() => {
    return calculateLessonProgression(activities, progressMap);
  }, [activities, progressMap]);

  // Sync currentActivityIndex with urlActivityId parameter
  useEffect(() => {
    if (urlActivityId && activities.length > 0) {
      const foundIdx = activities.findIndex(a => a.id === urlActivityId);
      if (foundIdx !== -1 && foundIdx !== currentActivityIndex) {
        setCurrentActivityIndex(foundIdx);
      }
    }
  }, [urlActivityId, activities]);

  // Guard against direct URL access to locked activities
  useEffect(() => {
    if (loading || !allModules.length || !currentActivity) return;

    const isUnlocked = isActivityUnlocked(currentActivity.id, allModules, progressMap);

    if (!isUnlocked) {
      const firstIncomplete = getFirstIncompleteActivity(allModules, progressMap);
      if (firstIncomplete) {
        setRedirectNotice("Terminez d'abord l'activité précédente pour continuer.");

        const targetCourseId = lesson?.interactive_course_modules?.interactive_courses?.slug || courseId || lesson?.interactive_course_modules?.course_id;

        if (firstIncomplete.lesson.id === lessonId) {
          const targetIdx = activities.findIndex(a => a.id === firstIncomplete.activity.id);
          if (targetIdx !== -1) {
            setCurrentActivityIndex(targetIdx);
            setSearchParams({ activityId: firstIncomplete.activity.id }, { replace: true });
          }
        } else {
          navigate(
            `/client/interactive-course/${targetCourseId}/lesson/${firstIncomplete.lesson.id}?activityId=${firstIncomplete.activity.id}`,
            { replace: true }
          );
        }
      }
    }
  }, [loading, allModules, currentActivity?.id, progressMap, lessonId, courseId]);

  // Helper to change activity within current lesson and update searchParams
  const changeActivityIndex = (newIdx: number) => {
    if (newIdx >= 0 && newIdx < activities.length) {
      const targetAct = activities[newIdx];
      if (targetAct) {
        const isUnlocked = isActivityUnlocked(targetAct.id, allModules, progressMap);
        if (!isUnlocked) {
          setRedirectNotice("Terminez d'abord l'activité précédente pour continuer.");
          return;
        }
        setRedirectNotice(null);
        setCurrentActivityIndex(newIdx);
        setSearchParams({ activityId: targetAct.id }, { replace: true });
      }
    }
  };

  // Chronological Next and Previous activity calculation
  const nextActivityItem = useMemo(() => {
    if (!currentActivity || allModules.length === 0) return null;
    return getNextActivity(allModules, currentActivity.id);
  }, [allModules, currentActivity]);

  const prevActivityItem = useMemo(() => {
    if (!currentActivity || allModules.length === 0) return null;
    return getPreviousActivity(allModules, currentActivity.id);
  }, [allModules, currentActivity]);

  const currentLessonCompleted = useMemo(() => {
    if (!lesson) return false;
    const lessonWithActivities = {
      ...lesson,
      interactive_activities: activities.length > 0 ? activities : (lesson.interactive_activities || [])
    };
    return isLessonCompleted(lessonWithActivities, progressMap);
  }, [lesson, activities, progressMap]);

  const currentModuleCompleted = useMemo(() => {
    if (!lesson?.interactive_course_modules) return false;
    const currModule = allModules.find(m => m.id === lesson.interactive_course_modules?.id);
    if (!currModule) return false;
    return isModuleCompleted(currModule, progressMap);
  }, [lesson, allModules, progressMap]);

  const entireCourseCompleted = useMemo(() => {
    if (allModules.length === 0) return false;
    return isCourseCompleted(allModules, progressMap);
  }, [allModules, progressMap]);

  // Determine state & text for primary Next button
  const nextButtonState = useMemo(() => {
    if (!currentActivity) {
      return { label: 'Activité suivante →', disabled: true, isFinishCourse: false };
    }

    const isCurrentRequired = currentActivity.is_required !== false;
    const isCurrentDone = progressMap.get(currentActivity.id)?.completed === true;

    // Rule 1: Required activity not finished -> Block
    if (isCurrentRequired && !isCurrentDone) {
      return {
        label: "Terminer l'activité pour continuer",
        disabled: true,
        isFinishCourse: false
      };
    }

    // If current activity is finished OR optional:
    if (!nextActivityItem) {
      // Reached end of course
      if (entireCourseCompleted) {
        return {
          label: "🎉 Cours terminé",
          disabled: false,
          isFinishCourse: true
        };
      } else {
        return {
          label: "Terminer les activités restantes",
          disabled: true,
          isFinishCourse: false
        };
      }
    }

    // Next activity exists
    const isNextInSameLesson = nextActivityItem.lesson.id === lessonId;

    if (isNextInSameLesson) {
      return {
        label: "Activité suivante →",
        disabled: false,
        isFinishCourse: false
      };
    } else {
      // Crossing lesson boundary
      if (currentLessonCompleted) {
        return {
          label: "Leçon suivante →",
          disabled: false,
          isFinishCourse: false
        };
      } else {
        return {
          label: "Terminer les activités restantes",
          disabled: true,
          isFinishCourse: false
        };
      }
    }
  }, [
    currentActivity,
    progressMap,
    nextActivityItem,
    lessonId,
    entireCourseCompleted,
    currentLessonCompleted
  ]);

  // Reset interactive states when changing activity
  useEffect(() => {
    setCurrentQuizQuestionIndex(0);
    setSelectedQuizOption(null);
    setIsQuizQuestionSubmitted(false);
    setQuizAnswersHistory([]);
    setIsQuizCompleted(false);
    setRevealedHintCount(0);

    // Reset R activity state
    if (currentActivity?.activity_type === 'code_r') {
      const initCode = currentActivity.configuration?.starter_code || '# Saisissez votre code R ici\n';
      setStudentRCode(initCode);
      setRCorrectionResult(null);
      setIsEvaluatingR(false);
    }
  }, [currentActivityIndex, currentActivity?.id]);

  // Normalized R correction criteria list
  const rCriteria = useMemo(() => {
    if (currentActivity?.activity_type !== 'code_r') return [];
    return normalizeRCorrectionCriteria(currentActivity.configuration);
  }, [currentActivity]);

  // Normalized required R packages list
  const currentActivityPackages = useMemo(() => {
    if (currentActivity?.activity_type !== 'code_r') return [];
    return normalizeActivityPackages(currentActivity.configuration);
  }, [currentActivity]);

  // Package preparation effect
  useEffect(() => {
    if (currentActivity?.activity_type !== 'code_r') {
      setIsPreparingPackages(false);
      setIsPackagesReady(true);
      setPackagesError(null);
      setPackageSteps([]);
      setPackageStatusMessage('');
      return;
    }

    const pkgs = normalizeActivityPackages(currentActivity.configuration);
    if (pkgs.length === 0) {
      setIsPreparingPackages(false);
      setIsPackagesReady(true);
      setPackagesError(null);
      setPackageSteps([]);
      setPackageStatusMessage('');
      return;
    }

    if (areAllPackagesLoadedInSession(pkgs)) {
      setIsPreparingPackages(false);
      setIsPackagesReady(true);
      setPackagesError(null);
      setPackageSteps(pkgs.map(name => ({ name, status: 'ready', message: `✓ ${name} prêt` })));
      setPackageStatusMessage('🟢 Environnement prêt');
      return;
    }

    let isCancelled = false;
    setIsPreparingPackages(true);
    setIsPackagesReady(false);
    setPackagesError(null);

    prepareActivityRPackages(pkgs, (steps, msg) => {
      if (!isCancelled) {
        setPackageSteps(steps);
        setPackageStatusMessage(msg);
      }
    }).then((result) => {
      if (isCancelled) return;
      setIsPreparingPackages(false);
      if (result.success) {
        setIsPackagesReady(true);
        setPackagesError(null);
        setPackageStatusMessage('🟢 Environnement prêt');
      } else {
        setIsPackagesReady(false);
        setPackagesError(result.errorMessage || "Impossible de charger certains packages R.");
      }
    }).catch((err: any) => {
      if (isCancelled) return;
      setIsPreparingPackages(false);
      setIsPackagesReady(false);
      setPackagesError(err?.message || "Erreur inattendue lors de la préparation des packages R.");
    });

    return () => {
      isCancelled = true;
    };
  }, [currentActivity?.id, currentActivity?.activity_type]);

  const handleRetryPreparePackages = () => {
    if (!currentActivityPackages || currentActivityPackages.length === 0) return;
    setIsPreparingPackages(true);
    setIsPackagesReady(false);
    setPackagesError(null);

    prepareActivityRPackages(currentActivityPackages, (steps, msg) => {
      setPackageSteps(steps);
      setPackageStatusMessage(msg);
    }).then((result) => {
      setIsPreparingPackages(false);
      if (result.success) {
        setIsPackagesReady(true);
        setPackagesError(null);
        setPackageStatusMessage('🟢 Environnement prêt');
      } else {
        setIsPackagesReady(false);
        setPackagesError(result.errorMessage || "Impossible de charger certains packages R.");
      }
    }).catch((err: any) => {
      setIsPreparingPackages(false);
      setIsPackagesReady(false);
      setPackagesError(err?.message || "Erreur inattendue lors de la préparation des packages R.");
    });
  };

  // Helper to persist activity progress
  const saveActivityCompletion = async (activityId: string, completed: boolean) => {
    const targetCourseId = courseId || lesson?.interactive_course_modules?.course_id;
    if (!userId || !targetCourseId || !lessonId || !activityId) return;

    // Optimistic UI state update
    setProgressMap(prev => {
      const nextMap = new Map(prev);
      nextMap.set(activityId, {
        user_id: userId,
        course_id: targetCourseId,
        lesson_id: lessonId,
        activity_id: activityId,
        completed,
        completed_at: completed ? new Date().toISOString() : null
      });
      return nextMap;
    });

    const res = await recordActivityProgress({
      userId,
      courseId: targetCourseId,
      lessonId,
      activityId,
      completed
    });

    if (res.data) {
      setProgressMap(prev => new Map(prev).set(activityId, res.data!));
    }
  };

  // Manual completion toggle for text/video/image activities
  const handleToggleManualCompletion = () => {
    if (!currentActivity) return;
    const currentCompleted = progressMap.get(currentActivity.id)?.completed === true;
    saveActivityCompletion(currentActivity.id, !currentCompleted);
  };

  // Code R validation handler
  const handleValidateRCode = async () => {
    if (!studentRCode.trim() || isEvaluatingR) return;
    try {
      setIsEvaluatingR(true);
      const result = await runWebRCorrectionSuite(studentRCode, rCriteria, {
        packages: currentActivityPackages
      });
      setRCorrectionResult(result);

      // Auto-complete if all required tests pass!
      if (result.success && currentActivity) {
        saveActivityCompletion(currentActivity.id, true);
      }
    } catch (err: any) {
      console.error("Erreur lors de la validation du code R:", err);
    } finally {
      setIsEvaluatingR(false);
    }
  };

  const handleResetRCode = () => {
    const initCode = currentActivity?.configuration?.starter_code || '# Saisissez votre code R ici\n';
    setStudentRCode(initCode);
    setRCorrectionResult(null);
  };

  // Hints array normalization
  const hintsList = useMemo(() => {
    if (!currentActivity?.hints) return [];
    if (Array.isArray(currentActivity.hints)) {
      return currentActivity.hints.filter(h => typeof h === 'string' && h.trim().length > 0);
    }
    return [];
  }, [currentActivity]);

  // Handle next / previous activity
  const handleNextActivity = () => {
    if (nextButtonState.disabled) return;

    if (nextButtonState.isFinishCourse || !nextActivityItem) {
      setShowCourseCompletionScreen(true);
      return;
    }

    const targetCourseId = lesson?.interactive_course_modules?.interactive_courses?.slug || courseId || lesson?.interactive_course_modules?.course_id;

    if (nextActivityItem.lesson.id === lessonId) {
      const nextIdx = activities.findIndex(a => a.id === nextActivityItem.activity.id);
      if (nextIdx !== -1) {
        changeActivityIndex(nextIdx);
      }
    } else {
      navigate(`/client/interactive-course/${targetCourseId}/lesson/${nextActivityItem.lesson.id}?activityId=${nextActivityItem.activity.id}`);
    }
  };

  const handlePrevActivity = () => {
    const targetCourseId = lesson?.interactive_course_modules?.interactive_courses?.slug || courseId || lesson?.interactive_course_modules?.course_id;

    if (!prevActivityItem) return;

    if (prevActivityItem.lesson.id === lessonId) {
      const prevIdx = activities.findIndex(a => a.id === prevActivityItem.activity.id);
      if (prevIdx !== -1) {
        changeActivityIndex(prevIdx);
      }
    } else {
      navigate(`/client/interactive-course/${targetCourseId}/lesson/${prevActivityItem.lesson.id}?activityId=${prevActivityItem.activity.id}`);
    }
  };

  // Convert YouTube link to embed URL
  const getYoutubeEmbedUrl = (rawUrl: string) => {
    if (!rawUrl) return '';
    try {
      const trimmed = rawUrl.trim();
      // Format: https://youtu.be/ID
      if (trimmed.includes('youtu.be/')) {
        const id = trimmed.split('youtu.be/')[1]?.split(/[?#]/)[0];
        if (id) return `https://www.youtube.com/embed/${id}?rel=0`;
      }
      // Format: https://www.youtube.com/watch?v=ID or /v/ID or /embed/ID
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = trimmed.match(regExp);
      if (match && match[2] && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}?rel=0`;
      }
      if (trimmed.includes('/embed/')) {
        return trimmed;
      }
    } catch (e) {
      console.error("Erreur conversion URL YouTube:", e);
    }
    return rawUrl;
  };

  // Normalized Quiz Questions list (backward-compatible with single-question format)
  const quizQuestionsList = useMemo<NormalizedQuizQuestion[]>(() => {
    if (currentActivity?.activity_type !== 'quiz') return [];
    const config = currentActivity.configuration || {};

    // 1. Multi-questions array format
    if (Array.isArray(config.questions) && config.questions.length > 0) {
      return config.questions.map((q: any) => {
        const options = Array.isArray(q.options) ? q.options.map((o: any) => String(o ?? '')) : [];
        let correctIndex = 0;
        if (q.correct_answer !== undefined && q.correct_answer !== null) {
          if (typeof q.correct_answer === 'number') {
            correctIndex = q.correct_answer;
          } else if (!isNaN(Number(q.correct_answer))) {
            correctIndex = parseInt(q.correct_answer, 10);
          }
        } else if (q.correctAnswerIndex !== undefined) {
          correctIndex = Number(q.correctAnswerIndex);
        }
        return {
          question: q.question || 'Choisissez la bonne réponse :',
          options,
          correct_answer: options.length > 0 ? Math.max(0, Math.min(correctIndex, options.length - 1)) : 0
        };
      });
    }

    // 2. Legacy single-question format
    if (config.question) {
      const options = Array.isArray(config.options) ? config.options.map((o: any) => String(o ?? '')) : [];
      let correctIndex = 0;
      if (config.correct_answer !== undefined && config.correct_answer !== null) {
        if (typeof config.correct_answer === 'number') {
          correctIndex = config.correct_answer;
        } else if (!isNaN(Number(config.correct_answer))) {
          correctIndex = parseInt(config.correct_answer, 10);
        }
      } else if (config.correctAnswerIndex !== undefined) {
        correctIndex = Number(config.correctAnswerIndex);
      }
      return [{
        question: config.question,
        options,
        correct_answer: options.length > 0 ? Math.max(0, Math.min(correctIndex, options.length - 1)) : 0
      }];
    }

    return [];
  }, [currentActivity]);

  const currentQuizQuestion = quizQuestionsList[currentQuizQuestionIndex] || null;

  // Quiz handlers
  const handleValidateQuizQuestion = () => {
    if (selectedQuizOption === null || !currentQuizQuestion) return;

    const isCorrect = selectedQuizOption === currentQuizQuestion.correct_answer;
    setIsQuizQuestionSubmitted(true);

    setQuizAnswersHistory(prev => [
      ...prev.filter(h => h.questionIndex !== currentQuizQuestionIndex),
      {
        questionIndex: currentQuizQuestionIndex,
        selectedOption: selectedQuizOption,
        isCorrect
      }
    ]);
  };

  const handleNextQuizQuestion = () => {
    if (currentQuizQuestionIndex < quizQuestionsList.length - 1) {
      setCurrentQuizQuestionIndex(prev => prev + 1);
      setSelectedQuizOption(null);
      setIsQuizQuestionSubmitted(false);
    } else {
      setIsQuizCompleted(true);

      // Check if ALL questions were answered correctly
      const totalQ = quizQuestionsList.length;
      const correctCount = quizAnswersHistory.filter(h => h.isCorrect).length;
      const allCorrect = totalQ > 0 && correctCount === totalQ;

      if (allCorrect && currentActivity) {
        saveActivityCompletion(currentActivity.id, true);
      }
    }
  };

  const handleResetQuiz = () => {
    setCurrentQuizQuestionIndex(0);
    setSelectedQuizOption(null);
    setIsQuizQuestionSubmitted(false);
    setQuizAnswersHistory([]);
    setIsQuizCompleted(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-700 gap-3 p-4">
        <Loader2 className="w-9 h-9 animate-spin text-emerald-600" />
        <p className="text-sm font-bold text-slate-600">Chargement de la leçon interactive...</p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 p-4">
        <div className="bg-white border border-slate-200/80 p-6 sm:p-8 rounded-3xl max-w-md w-full text-center shadow-xs">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Leçon inaccessible</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">{error || "Cette leçon n'est pas disponible."}</p>
          <button
            onClick={() => navigate(`/client/interactive-course/${courseId}`)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl transition-all shadow-xs"
          >
            Retour au cours
          </button>
        </div>
      </div>
    );
  }

  // Calculate quiz score summary
  const totalQuizQuestions = quizQuestionsList.length;
  const correctQuizAnswersCount = quizAnswersHistory.filter(h => h.isCorrect).length;
  const wrongQuizAnswersCount = totalQuizQuestions - correctQuizAnswersCount;
  const quizScorePercentage = totalQuizQuestions > 0 ? Math.round((correctQuizAnswersCount / totalQuizQuestions) * 100) : 0;
  const isQuizPassed = totalQuizQuestions > 0 && correctQuizAnswersCount === totalQuizQuestions;

  const isCurrentQuizAnswerCorrect = isQuizQuestionSubmitted && currentQuizQuestion && selectedQuizOption === currentQuizQuestion.correct_answer;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between pb-12">
      {/* 1. Header Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          {/* Back button & Lesson Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(`/client/interactive-course/${lesson?.interactive_course_modules?.interactive_courses?.slug || courseId || lesson?.interactive_course_modules?.course_id}`)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors shrink-0 p-1.5 rounded-xl hover:bg-slate-100 border border-slate-200"
              title="Retour au sommaire du cours"
            >
              <ChevronLeft className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Sommaire</span>
            </button>

            <div className="h-4 w-px bg-slate-200 hidden sm:block shrink-0" />

            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs font-extrabold text-emerald-600 block truncate uppercase tracking-wider">
                {lesson.interactive_course_modules?.title || 'Module'}
              </span>
              <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                {lesson.title}
              </h1>
            </div>
          </div>

          {/* Activity Stepper / Counter */}
          {activities.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              {/* Stepper buttons on desktop */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                {activities.map((act, i) => {
                  const isDone = progressMap.get(act.id)?.completed === true;
                  const isCurrent = i === currentActivityIndex;
                  const isUnlocked = isActivityUnlocked(act.id, allModules, progressMap);

                  return (
                    <button
                      key={act.id}
                      type="button"
                      disabled={!isUnlocked}
                      onClick={() => changeActivityIndex(i)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isDone
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                          : isUnlocked
                          ? 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                          : 'bg-slate-200/80 text-slate-400 border border-slate-300 cursor-not-allowed opacity-70'
                      }`}
                      title={
                        !isUnlocked
                          ? `🔒 Activité verrouillée : ${act.title}`
                          : `Activité ${i + 1} : ${act.title}`
                      }
                    >
                      {!isUnlocked ? (
                        <Lock className="w-3 h-3 text-slate-400" />
                      ) : isDone ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : (
                        <span className="w-3 h-3 text-[9px] flex items-center justify-center font-mono">○</span>
                      )}
                      <span>{i + 1}</span>
                    </button>
                  );
                })}
              </div>

              {/* Progress counter text */}
              <div className="hidden md:flex items-center gap-1 text-xs text-slate-500 font-bold px-2">
                <span>{lessonProgression.completed}/{lessonProgression.total} terminées</span>
              </div>

              {/* Mobile activity list drawer trigger */}
              <button
                type="button"
                onClick={() => setShowMobileActivityList(true)}
                className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 hover:bg-slate-50 shadow-xs active:scale-95"
              >
                <List className="w-3.5 h-3.5 text-emerald-600" />
                <span>Activité {currentActivityIndex + 1} / {activities.length}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Activity Drawer Modal */}
      {showMobileActivityList && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end sm:hidden">
          <div className="bg-white border-t border-slate-200 rounded-t-3xl p-5 space-y-4 max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>Activités de la leçon</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowMobileActivityList(false)}
                className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {activities.map((act, i) => {
                const isDone = progressMap.get(act.id)?.completed === true;
                const isCurrent = i === currentActivityIndex;
                const isUnlocked = isActivityUnlocked(act.id, allModules, progressMap);

                return (
                  <button
                    key={act.id}
                    type="button"
                    disabled={!isUnlocked}
                    onClick={() => {
                      if (isUnlocked) {
                        changeActivityIndex(i);
                        setShowMobileActivityList(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left text-xs font-extrabold transition-all ${
                      isCurrent
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs'
                        : isDone
                        ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                        : isUnlocked
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        : 'bg-slate-100/80 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                        !isUnlocked
                          ? 'bg-slate-200 text-slate-500'
                          : isDone
                          ? 'bg-emerald-100 text-emerald-800'
                          : isCurrent
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {!isUnlocked ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : i + 1}
                      </span>
                      <span className="truncate">{act.title}</span>
                      {act.is_required === false && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-semibold shrink-0">
                          Facultative
                        </span>
                      )}
                    </div>

                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 flex items-center gap-1 ${
                      !isUnlocked
                        ? 'bg-slate-200 text-slate-600 border border-slate-300'
                        : isDone
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : isCurrent
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {!isUnlocked ? (
                        <>
                          <Lock className="w-3 h-3 text-slate-500" />
                          <span>🔒 Verrouillée</span>
                        </>
                      ) : isDone ? (
                        <>
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>✓ Terminée</span>
                        </>
                      ) : isCurrent ? (
                        <>
                          <span>● En cours</span>
                        </>
                      ) : (
                        <>
                          <span>○ À faire</span>
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Content Player */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 flex flex-col justify-between space-y-6">
        {/* Direct Access Redirect Notice Banner */}
        {redirectNotice && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between gap-3 text-amber-950 font-bold text-xs sm:text-sm shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>{redirectNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setRedirectNotice(null)}
              className="p-1 rounded-lg hover:bg-amber-100 text-amber-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {showCourseCompletionScreen ? (
          <div className="bg-white border border-emerald-200 rounded-3xl p-6 sm:p-10 text-center space-y-6 shadow-sm my-auto">
            <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
              <Trophy className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">🎉 Félicitations !</h2>
              <p className="text-sm sm:text-base text-slate-600 font-semibold">
                Vous avez terminé l'ensemble de ce cours avec succès.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Toutes les activités obligatoires terminées</span>
              </span>
              <span className="px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
                Progression : 100 %
              </span>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => navigate(`/client/interactive-course/${lesson?.interactive_course_modules?.interactive_courses?.slug || courseId || lesson?.interactive_course_modules?.course_id}`)}
                className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-xs transition-all active:scale-95"
              >
                Retour au cours
              </button>
            </div>
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center my-auto shadow-xs">
            <Sparkles className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Aucune activité dans cette leçon</h3>
            <p className="text-xs text-slate-500 mb-6">Cette leçon est en cours de préparation par l'enseignant.</p>
            <button
              onClick={() => navigate(`/client/interactive-course/${lesson?.interactive_course_modules?.interactive_courses?.slug || courseId || lesson?.interactive_course_modules?.course_id}`)}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
            >
              Retour au sommaire
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Activity Header Card */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                    currentActivity.activity_type === 'text'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : currentActivity.activity_type === 'video'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : currentActivity.activity_type === 'quiz'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {currentActivity.activity_type === 'text' && <FileText className="w-3.5 h-3.5" />}
                    {currentActivity.activity_type === 'video' && <Video className="w-3.5 h-3.5" />}
                    {currentActivity.activity_type === 'quiz' && <HelpCircle className="w-3.5 h-3.5" />}
                    {currentActivity.activity_type === 'code_r' && <Code2 className="w-3.5 h-3.5" />}
                    <span>
                      {currentActivity.activity_type === 'text'
                        ? 'Lecture'
                        : currentActivity.activity_type === 'video'
                        ? 'Vidéo'
                        : currentActivity.activity_type === 'quiz'
                        ? 'QCM'
                        : 'Pratique R'}
                    </span>
                  </span>

                  {/* Completion Status Badge */}
                  {isCurrentActivityDone ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Terminée</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                      <span>À faire</span>
                    </span>
                  )}

                  {currentActivity.points ? (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      {currentActivity.points} pts
                    </span>
                  ) : null}
                </div>

                <span className="text-xs text-slate-500 font-bold">
                  Activité {currentActivityIndex + 1} sur {activities.length}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {currentActivity.title}
              </h2>

              {currentActivity.instructions && (
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  {currentActivity.instructions}
                </p>
              )}
            </div>

            {/* Content Area By Activity Type */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-8 shadow-xs">
              {/* =================================================== */}
              {/* 1. ACTIVITÉ TEXTE / COURS (Riche Markdown)          */}
              {/* =================================================== */}
              {currentActivity.activity_type === 'text' && (
                <div className="space-y-6">
                  {currentActivity.configuration?.content ? (
                    <MarkdownRenderer 
                      content={currentActivity.configuration.content} 
                      isDark={false}
                    />
                  ) : (
                    <div className="text-center py-10 text-slate-500 text-xs sm:text-sm">
                      <p>Aucun contenu textuel pour cette activité.</p>
                    </div>
                  )}

                  {/* Complete Button for text */}
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={handleToggleManualCompletion}
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-extrabold text-xs sm:text-sm transition-all active:scale-95 shadow-xs ${
                        isCurrentActivityDone
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>{isCurrentActivityDone ? '✓ Activité terminée' : 'Marquer comme terminé'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* 2. ACTIVITÉ VIDÉO (YouTube Responsive)              */}
              {/* =================================================== */}
              {currentActivity.activity_type === 'video' && (
                <div className="space-y-6">
                  {currentActivity.configuration?.video_url ? (
                    <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-200 shadow-sm relative max-w-3xl mx-auto">
                      {currentActivity.configuration.video_url.includes('youtube') || 
                       currentActivity.configuration.video_url.includes('youtu.be') ? (
                        <iframe
                          src={getYoutubeEmbedUrl(currentActivity.configuration.video_url)}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          title={currentActivity.title}
                        />
                      ) : (
                        <video
                          src={currentActivity.configuration.video_url}
                          controls
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video w-full rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-200 max-w-3xl mx-auto">
                      <div className="text-center p-4">
                        <Video className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-500">Aucun lien vidéo configuré</p>
                      </div>
                    </div>
                  )}

                  {/* Complete Button for video */}
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={handleToggleManualCompletion}
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-extrabold text-xs sm:text-sm transition-all active:scale-95 shadow-xs ${
                        isCurrentActivityDone
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>{isCurrentActivityDone ? '✓ Vidéo visionnée & terminée' : 'Marquer comme terminé'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* 3. ACTIVITÉ IMAGE                                   */}
              {/* =================================================== */}
              {currentActivity.activity_type === 'image' && (
                <div className="space-y-6">
                  {currentActivity.configuration?.image_url ? (
                    <div className="rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 max-h-96 flex items-center justify-center max-w-2xl mx-auto p-2">
                      <img
                        src={currentActivity.configuration.image_url}
                        alt={currentActivity.title}
                        className="max-h-96 object-contain rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="p-8 bg-slate-50 rounded-2xl text-center text-slate-400 border border-slate-200">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm font-semibold text-slate-500">Aucune image configurée</p>
                    </div>
                  )}

                  {currentActivity.configuration?.caption && (
                    <p className="text-xs sm:text-sm text-slate-500 italic text-center">
                      {currentActivity.configuration.caption}
                    </p>
                  )}

                  {/* Complete Button for image */}
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={handleToggleManualCompletion}
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-extrabold text-xs sm:text-sm transition-all active:scale-95 shadow-xs ${
                        isCurrentActivityDone
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>{isCurrentActivityDone ? '✓ Activité terminée' : 'Marquer comme terminé'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* 4. ACTIVITÉ QCM (MULTI-QUESTIONS & COMPATIBILITÉ)   */}
              {/* =================================================== */}
              {currentActivity.activity_type === 'quiz' && (
                <div className="space-y-6">
                  {quizQuestionsList.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">Configuration de quiz incomplète.</p>
                  ) : isQuizCompleted ? (
                    /* === VUE RÉSUMÉ / SCORE FINAL DU QUIZ === */
                    <div className="space-y-6 animate-in fade-in zoom-in-95">
                      <div className={`p-6 sm:p-8 rounded-3xl text-center space-y-4 border ${
                        isQuizPassed
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-rose-50/50 border-rose-200'
                      }`}>
                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-xs ${
                          isQuizPassed
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-500 text-white'
                        }`}>
                          {isQuizPassed ? <Trophy className="w-8 h-8" /> : <RotateCcw className="w-8 h-8" />}
                        </div>

                        <div>
                          <span className={`text-xs font-black uppercase tracking-wider ${
                            isQuizPassed ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {isQuizPassed ? '✓ Activité validée & enregistrée' : '❌ Activité non terminée'}
                          </span>
                          <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                            {isQuizPassed ? 'Bravo ! Quiz réussi sans faute !' : 'Quiz non validé'}
                          </h3>
                        </div>

                        {/* Score Display */}
                        <div className="inline-flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
                          <span className="text-2xl sm:text-3xl font-black text-slate-900">
                            {correctQuizAnswersCount} / {totalQuizQuestions}
                          </span>
                          <div className="h-6 w-px bg-slate-200" />
                          <span className={`text-sm sm:text-base font-extrabold ${
                            isQuizPassed ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {quizScorePercentage} %
                          </span>
                        </div>

                        {/* Badges details */}
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{correctQuizAnswersCount} bonne{correctQuizAnswersCount > 1 ? 's' : ''} réponse{correctQuizAnswersCount > 1 ? 's' : ''}</span>
                          </span>

                          {wrongQuizAnswersCount > 0 && (
                            <span className="px-3 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>{wrongQuizAnswersCount} erreur{wrongQuizAnswersCount > 1 ? 's' : ''}</span>
                            </span>
                          )}
                        </div>

                        {/* Performance text */}
                        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed pt-1">
                          {isQuizPassed
                            ? 'Félicitations ! Vous avez réussi l\'ensemble des questions de ce QCM. Votre progression est enregistrée.'
                            : 'Toutes les questions doivent être correctes pour valider cette activité. Veuillez cliquer sur Réessayer le quiz.'}
                        </p>
                      </div>

                      {/* Recap list of questions */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
                          Détail des questions ({totalQuizQuestions})
                        </h4>

                        <div className="space-y-2.5">
                          {quizQuestionsList.map((q, qIdx) => {
                            const ans = quizAnswersHistory.find(h => h.questionIndex === qIdx);
                            const isCorrect = ans?.isCorrect ?? false;
                            const chosenOpt = ans?.selectedOption !== undefined ? q.options[ans.selectedOption] : null;
                            const correctOpt = q.options[q.correct_answer] || '';

                            return (
                              <div
                                key={qIdx}
                                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs ${
                                  isCorrect
                                    ? 'bg-emerald-50/40 border-emerald-200 text-slate-800'
                                    : 'bg-rose-50/40 border-rose-200 text-slate-800'
                                }`}
                              >
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2">
                                    {isCorrect ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                    )}
                                    <span className="font-extrabold text-slate-900">
                                      Question {qIdx + 1} : {q.question}
                                    </span>
                                  </div>

                                  {!isCorrect && (
                                    <div className="pl-6 space-y-0.5 text-[11px] pt-1">
                                      {chosenOpt && (
                                        <p className="text-rose-700">
                                          Votre réponse : <span className="line-through">{chosenOpt}</span>
                                        </p>
                                      )}
                                      <p className="text-emerald-700 font-bold">
                                        Bonne réponse : {correctOpt}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black self-start sm:self-center shrink-0 ${
                                  isCorrect
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                                }`}>
                                  {isCorrect ? 'Correct' : 'Erreur'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Summary Actions */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleResetQuiz}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Réessayer le quiz</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleNextActivity}
                          disabled={nextButtonState.disabled}
                          className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-xs ml-auto ${
                            nextButtonState.disabled
                              ? 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed opacity-80'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 cursor-pointer'
                          }`}
                        >
                          <span>{nextButtonState.label}</span>
                          {!nextButtonState.disabled && <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ) : currentQuizQuestion ? (
                    /* === QUESTION EN COURS === */
                    <>
                      {/* Top Question Stepper Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-black uppercase tracking-wider border border-purple-200">
                            Question {currentQuizQuestionIndex + 1} / {totalQuizQuestions}
                          </span>
                        </div>

                        {/* Step indicators */}
                        {totalQuizQuestions > 1 && (
                          <div className="flex items-center gap-1.5">
                            {quizQuestionsList.map((_, dotIdx) => {
                              const isPast = dotIdx < currentQuizQuestionIndex;
                              const isCurrent = dotIdx === currentQuizQuestionIndex;
                              return (
                                <div
                                  key={dotIdx}
                                  className={`h-2 rounded-full transition-all ${
                                    isCurrent
                                      ? 'w-6 bg-purple-600'
                                      : isPast
                                      ? 'w-2 bg-purple-300'
                                      : 'w-2 bg-slate-200'
                                  }`}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Question statement */}
                      <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl">
                        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-relaxed">
                          {currentQuizQuestion.question}
                        </h3>
                      </div>

                      {/* Options List */}
                      <div className="space-y-3">
                        {currentQuizQuestion.options.map((optionText, optIdx) => {
                          const isSelected = selectedQuizOption === optIdx;
                          const isThisCorrect = currentQuizQuestion.correct_answer === optIdx;

                          let cardClasses = 'bg-white border-slate-200 text-slate-800 hover:border-purple-300 hover:bg-purple-50/20';

                          if (isQuizQuestionSubmitted) {
                            if (isThisCorrect) {
                              cardClasses = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold';
                            } else if (isSelected && !isThisCorrect) {
                              cardClasses = 'bg-rose-50 border-rose-500 text-rose-900 font-bold';
                            } else {
                              cardClasses = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                            }
                          } else if (isSelected) {
                            cardClasses = 'bg-purple-50 border-purple-500 text-purple-900 font-bold shadow-xs';
                          }

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              disabled={isQuizQuestionSubmitted}
                              onClick={() => setSelectedQuizOption(optIdx)}
                              className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all gap-3 min-h-[56px] ${cardClasses}`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                                  isQuizQuestionSubmitted && isThisCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : isQuizQuestionSubmitted && isSelected && !isThisCorrect
                                    ? 'bg-rose-600 text-white'
                                    : isSelected
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}>
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className="text-sm sm:text-base font-semibold break-words">
                                  {optionText}
                                </span>
                              </div>

                              <div className="shrink-0 flex items-center gap-2">
                                {isQuizQuestionSubmitted && isThisCorrect && (
                                  <span className="hidden xs:inline text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-200">
                                    Bonne réponse
                                  </span>
                                )}
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                  isQuizQuestionSubmitted && isThisCorrect
                                    ? 'border-emerald-600 bg-emerald-600 text-white'
                                    : isQuizQuestionSubmitted && isSelected && !isThisCorrect
                                    ? 'border-rose-600 bg-rose-600 text-white'
                                    : isSelected 
                                    ? 'border-purple-600 bg-purple-600 text-white' 
                                    : 'border-slate-300 bg-slate-50'
                                }`}>
                                  {isQuizQuestionSubmitted && isThisCorrect && <Check className="w-3 h-3 stroke-[3]" />}
                                  {isQuizQuestionSubmitted && isSelected && !isThisCorrect && <XCircle className="w-3 h-3" />}
                                  {!isQuizQuestionSubmitted && isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Validation button & Next Question feedback */}
                      {!isQuizQuestionSubmitted ? (
                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={handleValidateQuizQuestion}
                            disabled={selectedQuizOption === null}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl shadow-xs transition-all active:scale-95"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Valider ma réponse</span>
                          </button>
                        </div>
                      ) : (
                        <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${
                          isCurrentQuizAnswerCorrect
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-rose-50 border-rose-200 text-rose-900'
                        }`}>
                          <div className="flex items-start gap-3">
                            {isCurrentQuizAnswerCorrect ? (
                              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                            )}
                            <div className="space-y-1">
                              <h4 className="text-base font-extrabold text-slate-900">
                                {isCurrentQuizAnswerCorrect ? 'Excellente réponse !' : 'Ce n\'est pas la bonne réponse.'}
                              </h4>
                              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                                {isCurrentQuizAnswerCorrect
                                  ? 'Vous avez correctement identifié la bonne option.'
                                  : currentQuizQuestion.options[currentQuizQuestion.correct_answer]
                                  ? `La réponse attendue était l'option ${String.fromCharCode(65 + currentQuizQuestion.correct_answer)} : "${currentQuizQuestion.options[currentQuizQuestion.correct_answer]}".`
                                  : 'Vérifiez la consigne.'}
                              </p>
                            </div>
                          </div>

                          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={handleResetQuiz}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Recommencer</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleNextQuizQuestion}
                              className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs ml-auto active:scale-95"
                            >
                              <span>
                                {currentQuizQuestionIndex < totalQuizQuestions - 1
                                  ? `Question suivante (${currentQuizQuestionIndex + 2}/${totalQuizQuestions})`
                                  : 'Voir mon résultat'}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              )}

              {/* =================================================== */}
              {/* 4. ACTIVITÉ CODE R (WebR Console Engine & Auto-Correction) */}
              {/* =================================================== */}
              {currentActivity.activity_type === 'code_r' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between text-xs text-slate-700 pb-1 font-extrabold">
                    <span className="flex items-center gap-1.5 text-slate-900 font-black text-sm">
                      <Code2 className="w-4 h-4 text-emerald-600" />
                      <span>Console & Environnement R interactif</span>
                    </span>
                    <span className="text-xs text-slate-600 font-semibold hidden xs:inline">
                      Moteur WebR (WebAssembly)
                    </span>
                  </div>

                  {/* R Packages Preparation Banner */}
                  <RPackagePreparationBanner
                    packages={currentActivityPackages}
                    steps={packageSteps}
                    isPreparing={isPreparingPackages}
                    isReady={isPackagesReady}
                    error={packagesError}
                    currentMessage={packageStatusMessage}
                    onRetry={handleRetryPreparePackages}
                  />

                  {/* R Code Editor Console */}
                  <REditorConsole
                    key={currentActivity.id}
                    value={studentRCode}
                    onChange={setStudentRCode}
                    starterCode={currentActivity.configuration?.starter_code || '# Saisissez votre code R ici\n'}
                    initialCode={currentActivity.configuration?.starter_code || '# Saisissez votre code R ici\n'}
                    minHeight="240px"
                    autoInit={true}
                  />

                  {/* Auto-Correction Action Bar */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleResetRCode}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-extrabold transition-all active:scale-95 cursor-pointer"
                      title="Réinitialiser avec le code de départ"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                      <span>Réinitialiser le code</span>
                    </button>

                    {rCriteria.length > 0 ? (
                      <button
                        type="button"
                        onClick={handleValidateRCode}
                        disabled={isEvaluatingR || isPreparingPackages || !!packagesError || !studentRCode.trim()}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm rounded-2xl shadow-xs transition-all ml-auto active:scale-95 cursor-pointer"
                      >
                        {isEvaluatingR ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Vérification WebR en cours...</span>
                          </>
                        ) : isPreparingPackages ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Préparation des packages...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Vérifier mon exercice ({rCriteria.length} critère{rCriteria.length > 1 ? 's' : ''})</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <p className="text-xs text-slate-600 font-medium italic">
                        Exécutez votre code avec le bouton Exécuter pour observer les résultats.
                      </p>
                    )}
                  </div>

                  {/* Correction Results View */}
                  {rCorrectionResult && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <RCorrectionResultsView
                        result={rCorrectionResult}
                        points={currentActivity.points}
                        onNextActivity={handleNextActivity}
                        hasNextActivity={currentActivityIndex < activities.length - 1}
                        onRetry={handleResetRCode}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Progressive Hints Section */}
              {hintsList.length > 0 && (
                <div className="mt-8 pt-5 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-extrabold text-amber-800 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-600" />
                      <span>Indices progressifs ({revealedHintCount} / {hintsList.length})</span>
                    </div>

                    {revealedHintCount < hintsList.length && (
                      <button
                        type="button"
                        onClick={() => setRevealedHintCount(prev => Math.min(prev + 1, hintsList.length))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all active:scale-95"
                      >
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          {revealedHintCount === 0 
                            ? '💡 Voir un premier indice' 
                            : `💡 Voir l'indice suivant (${revealedHintCount + 1}/${hintsList.length})`}
                        </span>
                      </button>
                    )}
                  </div>

                  {revealedHintCount > 0 && (
                    <div className="space-y-2 pt-1">
                      {hintsList.slice(0, revealedHintCount).map((hintText, hIdx) => (
                        <div 
                          key={hIdx} 
                          className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm text-amber-950 leading-relaxed animate-in fade-in slide-in-from-top-1 font-medium"
                        >
                          <span className="font-extrabold text-amber-800 block mb-1">
                            Indice {hIdx + 1} :
                          </span>
                          <MarkdownRenderer content={hintText} isDark={false} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Milestone Banners (End of Lesson / End of Module) */}
        {!showCourseCompletionScreen && (
          <>
            {currentModuleCompleted && (currentActivityIndex === activities.length - 1 || isCurrentActivityDone) ? (
              <div className="p-5 sm:p-6 bg-indigo-50/80 border border-indigo-200 rounded-3xl text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-xs">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900">🎉 Module terminé !</h3>
                <p className="text-xs sm:text-sm text-indigo-900 font-semibold">Toutes les leçons de ce module sont validées.</p>
                {nextActivityItem && (
                  <button
                    type="button"
                    onClick={handleNextActivity}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-2xl text-xs sm:text-sm shadow-xs transition-all inline-flex items-center gap-2 active:scale-95"
                  >
                    <span>Module suivant →</span>
                  </button>
                )}
              </div>
            ) : currentLessonCompleted && (currentActivityIndex === activities.length - 1 || isCurrentActivityDone) ? (
              <div className="p-5 sm:p-6 bg-sky-50/80 border border-sky-200 rounded-3xl text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900">🎉 Leçon terminée !</h3>
                <p className="text-xs sm:text-sm text-sky-900 font-semibold">Vous avez terminé cette leçon.</p>
                {nextActivityItem && (
                  <button
                    type="button"
                    onClick={handleNextActivity}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs sm:text-sm shadow-xs transition-all inline-flex items-center gap-2 active:scale-95"
                  >
                    <span>Leçon suivante →</span>
                  </button>
                )}
              </div>
            ) : null}
          </>
        )}

        {/* 3. Footer Navigation Controls */}
        <div className="pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrevActivity}
            disabled={!prevActivityItem}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
              !prevActivityItem
                ? 'opacity-30 text-slate-400 cursor-not-allowed border border-transparent'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs active:scale-95'
            }`}
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
            <span>← Activité précédente</span>
          </button>

          <button
            type="button"
            onClick={handleNextActivity}
            disabled={nextButtonState.disabled}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 text-xs sm:text-sm font-black rounded-2xl transition-all shadow-xs ${
              nextButtonState.disabled
                ? 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed opacity-80'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 cursor-pointer'
            }`}
          >
            <span>{nextButtonState.label}</span>
            {!nextButtonState.disabled && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </main>
    </div>
  );
}
