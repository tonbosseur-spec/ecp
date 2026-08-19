import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  ArrowRight,
  RefreshCcw,
  Check
} from 'lucide-react';
import { 
  InteractiveCourseLesson, 
  InteractiveActivity 
} from '../types';
import { REditorConsole } from '../components/REditorConsole';

export default function ClientInteractiveActivityPlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<InteractiveCourseLesson | null>(null);
  const [activities, setActivities] = useState<InteractiveActivity[]>([]);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedHints, setRevealedHints] = useState<number[]>([]);
  
  // Local state for basic quiz interactivity (without backend validation requirement)
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);

  useEffect(() => {
    async function fetchLessonAndActivities() {
      if (!lessonId) return;
      try {
        setLoading(true);
        setError(null);

        // Fetch lesson details
        const { data: lessonData, error: lessonErr } = await supabase
          .from('interactive_course_lessons')
          .select(`
            *,
            interactive_course_modules (
              id,
              title,
              course_id,
              interactive_courses (
                id,
                title
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

        setActivities(activitiesData || []);
        setCurrentActivityIndex(0);
        setSelectedQuizOption(null);
        setRevealedHints([]);
      } catch (err: any) {
        console.error("Erreur chargement activités:", err);
        setError(err?.message || "Impossible de charger cette leçon.");
      } finally {
        setLoading(false);
      }
    }

    fetchLessonAndActivities();
  }, [lessonId]);

  // Reset local state when activity index changes
  useEffect(() => {
    setSelectedQuizOption(null);
    setRevealedHints([]);
  }, [currentActivityIndex]);

  const currentActivity = activities[currentActivityIndex] || null;

  const handleNextActivity = () => {
    if (currentActivityIndex < activities.length - 1) {
      setCurrentActivityIndex(prev => prev + 1);
    } else {
      // Return to course view when done
      navigate(`/client/interactive-course/${courseId}`);
    }
  };

  const handlePrevActivity = () => {
    if (currentActivityIndex > 0) {
      setCurrentActivityIndex(prev => prev - 1);
    }
  };

  const toggleHint = (index: number) => {
    setRevealedHints(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}`;
      }
    } catch (e) {
      console.error(e);
    }
    return url;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-3 p-4">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        <p className="text-sm font-medium text-slate-400">Chargement des activités de la leçon...</p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-100 mb-2">Leçon inaccessible</h2>
          <p className="text-sm text-slate-400 mb-6">{error || "Cette leçon n'est pas disponible."}</p>
          <button
            onClick={() => navigate(`/client/interactive-course/${courseId}`)}
            className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-2xl transition-all"
          >
            Retour au cours
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Header Bar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(`/client/interactive-course/${courseId}`)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-100 transition-colors shrink-0"
              title="Retour au programme"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Sommaire du cours</span>
            </button>

            <div className="h-4 w-px bg-slate-800 hidden sm:block shrink-0" />

            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-white truncate">
                {lesson.title}
              </h1>
            </div>
          </div>

          {/* Activity Progress Indicator */}
          {activities.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-400">
                Activité {currentActivityIndex + 1} / {activities.length}
              </span>
            </div>
          )}
        </div>

        {/* Step Indicator Bar */}
        {activities.length > 1 && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {activities.map((act, idx) => {
              const isActive = idx === currentActivityIndex;
              const isPast = idx < currentActivityIndex;

              return (
                <button
                  key={act.id}
                  onClick={() => setCurrentActivityIndex(idx)}
                  className={`h-1.5 rounded-full transition-all flex-1 min-w-[24px] ${
                    isActive 
                      ? 'bg-sky-400' 
                      : isPast 
                      ? 'bg-sky-700/60 hover:bg-sky-600' 
                      : 'bg-slate-800 hover:bg-slate-700'
                  }`}
                  title={`${idx + 1}. ${act.title}`}
                />
              );
            })}
          </div>
        )}
      </header>

      {/* Main Activity Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full flex flex-col justify-between">
        {!currentActivity ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 my-auto">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <h3 className="text-lg font-bold text-white mb-1">Aucune activité dans cette leçon</h3>
            <p className="text-sm text-slate-400 mb-6">Le contenu de cette leçon sera bientôt disponible.</p>
            <button
              onClick={() => navigate(`/client/interactive-course/${courseId}`)}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-all"
            >
              Retour au cours
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Activity Card Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {currentActivity.activity_type === 'code_r' && <Code2 className="w-3 h-3" />}
                  {currentActivity.activity_type === 'quiz' && <HelpCircle className="w-3 h-3" />}
                  {currentActivity.activity_type === 'video' && <Video className="w-3 h-3" />}
                  {currentActivity.activity_type === 'image' && <ImageIcon className="w-3 h-3" />}
                  {currentActivity.activity_type === 'text' && <FileText className="w-3 h-3" />}
                  <span>{currentActivity.activity_type}</span>
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {currentActivity.points} point{currentActivity.points !== 1 ? 's' : ''}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
                {currentActivity.title}
              </h2>

              {currentActivity.instructions && (
                <div className="text-sm sm:text-base text-slate-300 whitespace-pre-line leading-relaxed">
                  {currentActivity.instructions}
                </div>
              )}
            </div>

            {/* Activity Dynamic Content */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
              {/* 1. TEXT ACTIVITY */}
              {currentActivity.activity_type === 'text' && (
                <div className="prose prose-invert max-w-none text-slate-200 leading-relaxed">
                  {currentActivity.configuration?.content ? (
                    <div className="whitespace-pre-line text-sm sm:text-base">
                      {currentActivity.configuration.content}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      Lisez attentivement les consignes ci-dessus pour continuer.
                    </p>
                  )}
                </div>
              )}

              {/* 2. VIDEO ACTIVITY */}
              {currentActivity.activity_type === 'video' && (
                <div className="space-y-4">
                  {currentActivity.configuration?.video_url ? (
                    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-lg">
                      {currentActivity.configuration.video_url.includes('youtube') || 
                       currentActivity.configuration.video_url.includes('youtu.be') ? (
                        <iframe
                          src={getYoutubeEmbedUrl(currentActivity.configuration.video_url)}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
                    <div className="aspect-video w-full rounded-2xl bg-slate-950 flex items-center justify-center text-slate-500 border border-slate-800">
                      <div className="text-center">
                        <Video className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                        <p className="text-xs">Aucun lien vidéo configuré</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. IMAGE ACTIVITY */}
              {currentActivity.activity_type === 'image' && (
                <div className="space-y-4">
                  {currentActivity.configuration?.image_url ? (
                    <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 p-2 flex flex-col items-center">
                      <img
                        src={currentActivity.configuration.image_url}
                        alt={currentActivity.title}
                        className="max-h-[500px] w-auto object-contain rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                      {currentActivity.configuration.caption && (
                        <p className="text-xs text-slate-400 mt-2 italic text-center">
                          {currentActivity.configuration.caption}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="h-64 w-full rounded-2xl bg-slate-950 flex items-center justify-center text-slate-500 border border-slate-800">
                      <div className="text-center">
                        <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                        <p className="text-xs">Aucune image configurée</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. QUIZ ACTIVITY */}
              {currentActivity.activity_type === 'quiz' && (
                <div className="space-y-4">
                  {currentActivity.configuration?.question && (
                    <h3 className="text-base sm:text-lg font-bold text-white mb-4">
                      {currentActivity.configuration.question}
                    </h3>
                  )}

                  {Array.isArray(currentActivity.configuration?.options) && (
                    <div className="space-y-2.5">
                      {currentActivity.configuration.options.map((option: string, optIdx: number) => {
                        const isSelected = selectedQuizOption === optIdx;

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => setSelectedQuizOption(optIdx)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all ${
                              isSelected
                                ? 'bg-sky-500/10 border-sky-500 text-sky-200'
                                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <span className="text-sm font-semibold">{option}</span>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected 
                                ? 'border-sky-400 bg-sky-500 text-white' 
                                : 'border-slate-700 bg-slate-900'
                            }`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 5. CODE_R ACTIVITY */}
              {currentActivity.activity_type === 'code_r' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-2">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-sky-400" />
                      <span>Console & Environnement R</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Exécutez votre code directement dans le navigateur
                    </span>
                  </div>

                  <REditorConsole
                    key={currentActivity.id}
                    starterCode={currentActivity.configuration?.starter_code || '# Saisissez votre code R ici\n'}
                    initialCode={currentActivity.configuration?.starter_code || '# Saisissez votre code R ici\n'}
                    minHeight="200px"
                    autoInit={true}
                  />
                </div>
              )}

              {/* Progressive Hints Section */}
              {Array.isArray(currentActivity.hints) && currentActivity.hints.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4" />
                    <span>Indices disponibles</span>
                  </div>
                  <div className="space-y-2">
                    {currentActivity.hints.map((hint: string, hIdx: number) => {
                      const isRevealed = revealedHints.includes(hIdx);

                      return (
                        <div key={hIdx} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                          {isRevealed ? (
                            <p className="text-xs text-slate-300">{hint}</p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleHint(hIdx)}
                              className="text-xs font-semibold text-amber-400/90 hover:text-amber-300 transition-colors"
                            >
                              💡 Afficher l'indice {hIdx + 1}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Navigation Controls */}
        <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handlePrevActivity}
            disabled={currentActivityIndex === 0}
            className={`inline-flex items-center gap-2 px-4 sm:px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
              currentActivityIndex === 0
                ? 'opacity-40 text-slate-500 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Précédent</span>
          </button>

          <button
            type="button"
            onClick={handleNextActivity}
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-sky-900/30 transition-all active:scale-95"
          >
            <span>
              {currentActivityIndex < activities.length - 1 
                ? 'Activité suivante' 
                : 'Terminer la leçon'}
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
