import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { isUuid } from '../lib/slugUtils';
import { 
  Loader2, 
  ChevronLeft, 
  BookOpen, 
  Layers, 
  Clock, 
  Sparkles, 
  ChevronRight, 
  FileText, 
  Code2, 
  HelpCircle, 
  Video, 
  Image as ImageIcon,
  CheckCircle2,
  Play,
  AlertCircle,
  Award,
  Circle,
  RotateCcw,
  Check,
  Lock
} from 'lucide-react';
import { 
  InteractiveCourse, 
  InteractiveCourseModule, 
  InteractiveCourseLesson,
  InteractiveActivityProgress 
} from '../types';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { 
  getUserCourseProgress, 
  calculateCourseProgression, 
  calculateLessonProgression 
} from '../lib/interactiveProgressService';
import { getFirstIncompleteActivity, isLessonUnlocked } from '../lib/courseNavigationService';

export default function ClientInteractiveCourseView() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<InteractiveCourse | null>(null);
  const [modules, setModules] = useState<InteractiveCourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Map<string, InteractiveActivityProgress>>(new Map());

  useEffect(() => {
    async function fetchCourseAndStructure() {
      if (!courseId) return;
      try {
        setLoading(true);
        setError(null);

        // Check if current user is authenticated
        const { data: authData } = await supabase.auth.getSession();
        const user = authData?.session?.user;
        const currentUid = user?.id || null;
        setUserId(currentUid);

        const userEmail = user?.email;
        const userIsAdmin = userEmail === 'association.astral@gmail.com' || 
          localStorage.getItem('admin_logged_in') === 'true' || 
          sessionStorage.getItem('admin_auth') === 'true';
        setIsAdmin(userIsAdmin);

        // Fetch course info
        let courseData: any = null;
        let courseErr: any = null;

        if (isUuid(courseId)) {
          const res = await supabase
            .from('interactive_courses')
            .select('*')
            .eq('id', courseId)
            .maybeSingle();
          courseData = res.data;
          courseErr = res.error;
        } else {
          const res = await supabase
            .from('interactive_courses')
            .select('*')
            .eq('slug', courseId)
            .maybeSingle();
          courseData = res.data;
          courseErr = res.error;
        }

        if (courseErr) throw courseErr;
        if (!courseData) throw new Error("Ce cours est introuvable.");

        // Canonical redirect if accessed via UUID but has a slug
        if (isUuid(courseId) && courseData.slug) {
          navigate(`/client/interactive-course/${courseData.slug}${window.location.search}`, { replace: true });
        }

        // Check published status if user is not admin
        if (courseData.status !== 'published' && !userIsAdmin) {
          throw new Error("Ce cours n'est pas encore accessible au public.");
        }

        setCourse(courseData);

        // Fetch modules with their lessons and activities
        const { data: modulesData, error: modulesErr } = await supabase
          .from('interactive_course_modules')
          .select(`
            *,
            interactive_course_lessons (
              *,
              interactive_activities (
                id,
                activity_type,
                title,
                position,
                is_required
              )
            )
          `)
          .eq('course_id', courseData.id)
          .order('position', { ascending: true });

        if (modulesErr) throw modulesErr;

        // Sort lessons inside each module by position
        const sortedModules = (modulesData || []).map((m: any) => ({
          ...m,
          interactive_course_lessons: (m.interactive_course_lessons || [])
            .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
            .map((l: any) => ({
              ...l,
              interactive_activities: (l.interactive_activities || []).sort(
                (a: any, b: any) => (a.position || 0) - (b.position || 0)
              )
            }))
        }));

        setModules(sortedModules);

        // Fetch user progress for this course
        if (currentUid) {
          const userProg = await getUserCourseProgress(currentUid, courseData.id);
          setProgressMap(userProg);
        }
      } catch (err: any) {
        console.error("Erreur chargement cours interactif:", err);
        setError(err?.message || "Impossible de charger ce cours.");
      } finally {
        setLoading(false);
      }
    }

    fetchCourseAndStructure();
  }, [courseId]);

  // Compute course progression summary
  const progressionSummary = useMemo(() => {
    return calculateCourseProgression(modules, progressMap);
  }, [modules, progressMap]);

  // Find first incomplete activity across entire course using centralized navigation service
  const firstIncompleteActivityItem = useMemo(() => {
    return getFirstIncompleteActivity(modules, progressMap);
  }, [modules, progressMap]);

  const targetContinuePath = useMemo(() => {
    if (firstIncompleteActivityItem) {
      return `/client/interactive-course/${course?.id}/lesson/${firstIncompleteActivityItem.lesson.id}?activityId=${firstIncompleteActivityItem.activity.id}`;
    }
    const firstLessonId = modules[0]?.interactive_course_lessons?.[0]?.id;
    if (firstLessonId && course?.id) {
      return `/client/interactive-course/${course.id}/lesson/${firstLessonId}`;
    }
    return null;
  }, [firstIncompleteActivityItem, modules, course]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-700 gap-3 p-4">
        <Loader2 className="w-9 h-9 animate-spin text-emerald-600" />
        <p className="text-sm font-bold text-slate-600">Chargement du cours interactif...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 p-4">
        <div className="bg-white border border-slate-200/80 p-6 sm:p-8 rounded-3xl max-w-md w-full text-center shadow-xs">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Cours inaccessible</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">{error || "Ce cours est introuvable."}</p>
          <button
            onClick={() => navigate('/client/hub')}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl transition-all shadow-xs"
          >
            Retour aux formations
          </button>
        </div>
      </div>
    );
  }

  const totalLessons = modules.reduce(
    (acc, m) => acc + (m.interactive_course_lessons?.length || 0),
    0
  );

  const totalActivities = modules.reduce(
    (acc, m) =>
      acc +
      (m.interactive_course_lessons || []).reduce(
        (lesAcc: number, l: any) => lesAcc + (l.interactive_activities?.length || 0),
        0
      ),
    0
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <button
            onClick={() => navigate('/client/hub')}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors p-1.5 rounded-xl hover:bg-slate-100"
          >
            <ChevronLeft className="w-5 h-5 text-slate-500" />
            <span>Mon espace</span>
          </button>

          <div className="flex items-center gap-2">
            {course.status !== 'published' && isAdmin && (
              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-extrabold uppercase rounded-full border border-amber-200">
                Aperçu Admin ({course.status})
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-extrabold rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cours interactif</span>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6 sm:space-y-8">
        {/* Celebration Banner if Entire Course is Completed */}
        {progressionSummary.isCourseCompleted && (
          <div className="p-6 sm:p-8 bg-emerald-500/10 border border-emerald-200 rounded-3xl text-center space-y-3 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-sm">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                🎉 Félicitations !
              </h3>
              <p className="text-xs sm:text-sm text-emerald-800 mt-1 font-bold">
                Vous avez terminé l'ensemble des activités de ce cours.
              </p>
            </div>
          </div>
        )}

        {/* Course Presentation Banner with Progression Status */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden space-y-6">
          {/* Cover Image if available */}
          {course.cover_image && (
            <div className="rounded-2xl overflow-hidden max-h-72 w-full bg-slate-100 border border-slate-200">
              <img
                src={course.cover_image}
                alt={course.title}
                className="w-full h-48 sm:h-64 object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          <div className="relative z-10 max-w-3xl space-y-4">
            {/* Tags & Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-black rounded-lg border border-emerald-200 uppercase tracking-wider">
                {course.category || 'R'}
              </span>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200">
                Niveau : {course.level === 'beginner' ? 'Débutant' : course.level === 'intermediate' ? 'Intermédiaire' : 'Avancé'}
              </span>
              {course.estimated_duration > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{course.estimated_duration} min</span>
                </span>
              )}
            </div>

            {/* Course Grand Title */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {course.title}
            </h1>

            {/* Rich Markdown Description */}
            {course.description && (
              <div className="pt-2 border-t border-slate-100 text-slate-600 leading-relaxed text-sm sm:text-base">
                <MarkdownRenderer content={course.description} isDark={false} />
              </div>
            )}

            {/* Metrics Bar */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs font-bold text-slate-500 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>{modules.length} module{modules.length > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>{totalLessons} leçon{totalLessons > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>{totalActivities} activité{totalActivities > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Learner Progression Bar & Action CTA */}
          <div className="pt-6 border-t border-slate-100 space-y-4 bg-emerald-50/40 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 p-6 sm:p-8 rounded-b-3xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Progression du cours
                  </span>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-md ${
                    progressionSummary.isCourseCompleted
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : progressionSummary.percentage > 0
                      ? 'bg-sky-100 text-sky-800 border border-sky-300'
                      : 'bg-slate-200 text-slate-700 border border-slate-300'
                  }`}>
                    {progressionSummary.percentage} %
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold">
                  {progressionSummary.completedActivities} / {progressionSummary.totalActivities} activité{progressionSummary.totalActivities > 1 ? 's' : ''} terminée{progressionSummary.completedActivities > 1 ? 's' : ''}
                </p>
              </div>

              {/* Continue / Start Button */}
              {targetContinuePath && (
                <button
                  onClick={() => navigate(targetContinuePath)}
                  className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl font-extrabold text-sm sm:text-base shadow-sm transition-all active:scale-95 ${
                    progressionSummary.isCourseCompleted
                      ? 'bg-slate-900 hover:bg-slate-800 text-white'
                      : progressionSummary.completedActivities > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {progressionSummary.isCourseCompleted ? (
                    <>
                      <RotateCcw className="w-5 h-5" />
                      <span>✓ Cours terminé (Revoir)</span>
                    </>
                  ) : progressionSummary.completedActivities > 0 ? (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      <span>Continuer le cours →</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      <span>Commencer le cours →</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-200/80 rounded-full h-3 border border-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  progressionSummary.isCourseCompleted
                    ? 'bg-emerald-600'
                    : progressionSummary.percentage > 0
                    ? 'bg-emerald-600'
                    : 'bg-transparent'
                }`}
                style={{ width: `${Math.max(progressionSummary.percentage, 0)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Modules & Lessons Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Contenu du cours</span>
            </h2>
            <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
              Sélectionnez une leçon pour commencer
            </span>
          </div>

          {modules.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center text-slate-500 shadow-xs">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-400" />
              <p className="text-sm font-semibold">Aucun module n'est encore disponible pour ce cours.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {modules.map((module, mIdx) => {
                const moduleActivities = (module.interactive_course_lessons || []).flatMap(
                  (l: any) => l.interactive_activities || []
                );
                const moduleCompletedActivities = moduleActivities.filter(
                  (a: any) => progressMap.get(a.id)?.completed === true
                ).length;
                const moduleTotalActivities = moduleActivities.length;
                const moduleProgressPercentage = moduleTotalActivities > 0
                  ? Math.round((moduleCompletedActivities / moduleTotalActivities) * 100)
                  : 0;

                return (
                  <div 
                    key={module.id} 
                    className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4"
                  >
                    {/* Module Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-0.5">
                          MODULE {mIdx + 1}
                        </div>
                        <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                          {module.title}
                        </h3>
                        {module.description && (
                          <div className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                            <MarkdownRenderer content={module.description} isDark={false} />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-xs font-bold text-slate-500">
                        <span>{(module.interactive_course_lessons || []).length} leçons · {moduleTotalActivities} activités</span>
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                          {moduleProgressPercentage} %
                        </span>
                      </div>
                    </div>

                    {/* Lessons List */}
                    <div className="space-y-2.5">
                      {(module.interactive_course_lessons || []).length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">
                          Aucune leçon dans ce module pour l'instant.
                        </p>
                      ) : (
                        (module.interactive_course_lessons || []).map((lesson, lIdx) => {
                          const activities = lesson.interactive_activities || [];
                          const hasCode = activities.some((a: any) => a.activity_type === 'code_r');
                          const hasQuiz = activities.some((a: any) => a.activity_type === 'quiz');
                          const hasVideo = activities.some((a: any) => a.activity_type === 'video');
                          const hasText = activities.some((a: any) => a.activity_type === 'text');

                          const lessonProg = calculateLessonProgression(activities, progressMap);
                          const isUnlocked = isLessonUnlocked(lesson.id, modules, progressMap);

                          return (
                            <Link
                              key={lesson.id}
                              to={`/client/interactive-course/${course.id}/lesson/${lesson.id}`}
                              className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl transition-all duration-200 gap-3 border ${
                                lessonProg.isCompleted
                                  ? 'bg-emerald-50/30 border-emerald-200/80 hover:border-emerald-400'
                                  : !isUnlocked
                                  ? 'bg-slate-100/60 border-slate-200/80 text-slate-500'
                                  : 'bg-slate-50/80 hover:bg-slate-100/90 border-slate-200/70 hover:border-emerald-300'
                              }`}
                            >
                              {/* Left: Number / Status Checkmark + Title + Metadata */}
                              <div className="flex items-start sm:items-center gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 transition-colors mt-0.5 sm:mt-0 ${
                                  lessonProg.isCompleted
                                    ? 'bg-emerald-600 text-white'
                                    : !isUnlocked
                                    ? 'bg-slate-200 text-slate-500 border border-slate-300'
                                    : lessonProg.completed > 0
                                    ? 'bg-sky-100 text-sky-700 border border-sky-300'
                                    : 'bg-slate-200 text-slate-600 border border-slate-300'
                                }`}>
                                  {lessonProg.isCompleted ? (
                                    <Check className="w-4 h-4 stroke-[3]" />
                                  ) : !isUnlocked ? (
                                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                                  ) : lessonProg.completed > 0 ? (
                                    <span>●</span>
                                  ) : (
                                    <span>○</span>
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                                      {lesson.title}
                                    </h4>
                                    {lessonProg.isCompleted ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Terminée</span>
                                      </span>
                                    ) : !isUnlocked ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-600 border border-slate-300">
                                        <Lock className="w-3 h-3 text-slate-500" />
                                        <span>🔒 Verrouillée</span>
                                      </span>
                                    ) : lessonProg.completed > 0 ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-300">
                                        <span>{lessonProg.completed}/{lessonProg.total} terminées</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-600 border border-slate-300">
                                        <span>À faire</span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5 font-medium">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      <span>{lesson.estimated_duration || 15} min</span>
                                    </span>
                                    <span className="text-slate-400">•</span>
                                    <span>{activities.length} activité{activities.length > 1 ? 's' : ''}</span>
                                    {lesson.description && (
                                      <span className="truncate max-w-[200px] sm:max-w-md text-slate-500">
                                        • {lesson.description.replace(/<[^>]+>/g, '').slice(0, 80)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Activity Type Badges & Play Button */}
                              <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t border-slate-200/50 sm:border-t-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {hasText && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10px] font-bold">
                                      <FileText className="w-2.5 h-2.5 text-slate-500" />
                                      <span>Texte</span>
                                    </span>
                                  )}
                                  {hasVideo && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-[10px] font-bold">
                                      <Video className="w-2.5 h-2.5 text-rose-500" />
                                      <span>Vidéo</span>
                                    </span>
                                  )}
                                  {hasQuiz && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-[10px] font-bold">
                                      <HelpCircle className="w-2.5 h-2.5 text-purple-500" />
                                      <span>Quiz</span>
                                    </span>
                                  )}
                                  {hasCode && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold">
                                      <Code2 className="w-2.5 h-2.5 text-emerald-600" />
                                      <span>Code R</span>
                                    </span>
                                  )}
                                </div>

                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                                  lessonProg.isCompleted
                                    ? 'bg-emerald-100 group-hover:bg-emerald-600 text-emerald-700 group-hover:text-white'
                                    : 'bg-slate-200 group-hover:bg-emerald-600 text-slate-600 group-hover:text-white'
                                }`}>
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                </div>
                              </div>
                            </Link>
                          );
                        })
                      )}
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
