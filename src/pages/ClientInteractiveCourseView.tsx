import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
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
  AlertCircle
} from 'lucide-react';
import { 
  InteractiveCourse, 
  InteractiveCourseModule, 
  InteractiveCourseLesson 
} from '../types';

export default function ClientInteractiveCourseView() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<InteractiveCourse | null>(null);
  const [modules, setModules] = useState<InteractiveCourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCourseAndStructure() {
      if (!courseId) return;
      try {
        setLoading(true);
        setError(null);

        // Fetch course info
        const { data: courseData, error: courseErr } = await supabase
          .from('interactive_courses')
          .select('*')
          .or(`id.eq.${courseId},slug.eq.${courseId}`)
          .single();

        if (courseErr) throw courseErr;
        if (!courseData) throw new Error("Cours interactif introuvable.");

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
                position
              )
            )
          `)
          .eq('course_id', courseData.id)
          .order('position', { ascending: true });

        if (modulesErr) throw modulesErr;

        // Sort lessons inside each module by position
        const sortedModules = (modulesData || []).map((m: any) => ({
          ...m,
          interactive_course_lessons: (m.interactive_course_lessons || []).sort(
            (a: any, b: any) => a.position - b.position
          )
        }));

        setModules(sortedModules);
      } catch (err: any) {
        console.error("Erreur chargement cours interactif:", err);
        setError(err?.message || "Impossible de charger ce cours.");
      } finally {
        setLoading(false);
      }
    }

    fetchCourseAndStructure();
  }, [courseId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-3 p-4">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        <p className="text-sm font-medium text-slate-400">Chargement du cours interactif...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-3xl max-w-md w-full text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-100 mb-2">Cours inaccessible</h2>
          <p className="text-sm text-slate-400 mb-6">{error || "Ce cours interactif n'est pas disponible."}</p>
          <button
            onClick={() => navigate('/client/hub')}
            className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-2xl transition-all"
          >
            Retour au Hub
          </button>
        </div>
      </div>
    );
  }

  const totalLessons = modules.reduce(
    (acc, m) => acc + (m.interactive_course_lessons?.length || 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Header Bar */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/client/hub')}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Mon espace</span>
          </button>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cours interactif</span>
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
        {/* Course Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl mb-8 relative overflow-hidden">
          <div className="relative z-10 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-2.5 py-1 bg-sky-500/20 text-sky-400 text-[11px] font-bold rounded-lg border border-sky-500/30">
                {course.category}
              </span>
              <span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-[11px] font-bold rounded-lg border border-slate-700">
                Niveau : {course.level === 'beginner' ? 'Débutant' : course.level === 'intermediate' ? 'Intermédiaire' : 'Avancé'}
              </span>
              {course.estimated_duration > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 text-slate-300 text-[11px] font-bold rounded-lg border border-slate-700">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{course.estimated_duration} min</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
              {course.title}
            </h1>

            {course.description && (
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6 font-medium">
                {course.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-400" />
                <span>{modules.length} chapitre{modules.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-sky-400" />
                <span>{totalLessons} leçon{totalLessons !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modules & Lessons Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-400" />
              <span>Programme du cours</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              Sélectionnez une leçon pour commencer
            </span>
          </div>

          {modules.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-medium">Aucun module n'est encore disponible pour ce cours.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {modules.map((module, mIdx) => (
                <div 
                  key={module.id} 
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm overflow-hidden"
                >
                  {/* Module Header */}
                  <div className="mb-4">
                    <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-1">
                      Chapitre {mIdx + 1}
                    </div>
                    <h3 className="text-lg font-bold text-white">{module.title}</h3>
                    {module.description && (
                      <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                        {module.description}
                      </p>
                    )}
                  </div>

                  {/* Lessons List */}
                  <div className="space-y-2.5">
                    {(module.interactive_course_lessons || []).length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">
                        Aucune leçon dans ce chapitre pour l'instant.
                      </p>
                    ) : (
                      (module.interactive_course_lessons || []).map((lesson, lIdx) => {
                        const activities = lesson.interactive_activities || [];
                        const hasCode = activities.some((a: any) => a.activity_type === 'code_r');
                        const hasQuiz = activities.some((a: any) => a.activity_type === 'quiz');

                        return (
                          <Link
                            key={lesson.id}
                            to={`/client/interactive-course/${course.id}/lesson/${lesson.id}`}
                            className="group flex items-center justify-between p-3.5 sm:p-4 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-sky-500/30 rounded-2xl transition-all duration-200"
                          >
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-slate-800 group-hover:bg-sky-500/20 text-slate-400 group-hover:text-sky-400 flex items-center justify-center font-bold text-xs shrink-0 transition-colors">
                                {mIdx + 1}.{lIdx + 1}
                              </div>

                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-slate-200 group-hover:text-white truncate">
                                  {lesson.title}
                                </h4>
                                {lesson.description && (
                                  <p className="text-xs text-slate-500 group-hover:text-slate-400 truncate mt-0.5">
                                    {lesson.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-3">
                              {/* Activity Badges */}
                              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
                                {hasCode && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 rounded text-slate-300 text-[10px]">
                                    <Code2 className="w-3 h-3 text-sky-400" />
                                    <span>Code R</span>
                                  </span>
                                )}
                                {hasQuiz && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 rounded text-slate-300 text-[10px]">
                                    <HelpCircle className="w-3 h-3 text-amber-400" />
                                    <span>Quiz</span>
                                  </span>
                                )}
                                <span className="text-[11px] text-slate-500">
                                  {activities.length} activité{activities.length !== 1 ? 's' : ''}
                                </span>
                              </div>

                              <div className="w-8 h-8 rounded-xl bg-slate-800/80 group-hover:bg-sky-600 text-slate-400 group-hover:text-white flex items-center justify-center transition-all">
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </div>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
