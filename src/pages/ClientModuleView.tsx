import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Loader2, 
  ChevronLeft, 
  Check, 
  Play, 
  FileText, 
  ExternalLink, 
  Video, 
  Maximize2,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  WifiOff,
  HelpCircle
} from 'lucide-react';
import {
  getCourseFromCache,
  getModulesFromCache,
  getSingleModuleFromCache,
  saveCourseToCache,
  saveModulesToCache
} from '../lib/courseCache';
import { ClientQuizOverlay } from '../components/ClientQuizOverlay';

export default function ClientModuleView() {
  const { courseId, moduleId } = useParams();
  const navigate = useNavigate();
  
  const [course, setCourse] = useState<any | null>(null);
  const [module, setModule] = useState<any | null>(null);
  const [allModules, setAllModules] = useState<any[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [quiz, setQuiz] = useState<any | null>(null);
  const [isQuizOverlayOpen, setIsQuizOverlayOpen] = useState(false);

  useEffect(() => {
    const fetchModuleDetails = async () => {
      try {
        setLoading(true);
        let session = null;
        try {
          const { data } = await supabase.auth.getSession();
          session = data.session;
        } catch (e) {
          console.warn("Auth check failed offline, trying cached session if available:", e);
        }

        if (session) {
          setUserId(session.user.id);
        }

        // Try online fetch first
        try {
          // Fetch course info
          const { data: courseData, error: courseError } = await supabase
            .from('courses')
            .select('title')
            .eq('id', courseId)
            .single();

          if (courseError) throw courseError;
          setCourse(courseData);

          // Fetch ALL modules for navigation & ordering
          const { data: allMods, error: allModsError } = await supabase
            .from('course_modules')
            .select('id, title, order_index')
            .eq('course_id', courseId)
            .order('order_index', { ascending: true });

          if (allModsError) throw allModsError;
          setAllModules(allMods || []);

          // Fetch specific module along with its files from module_files table
          const { data: modData, error: modError } = await supabase
            .from('course_modules')
            .select('*, module_files(*)')
            .eq('id', moduleId)
            .single();

          if (modError) throw modError;

          // Fetch quiz if any
          const { data: quizData } = await supabase
            .from('quizzes')
            .select('*')
            .eq('module_id', moduleId)
            .maybeSingle();
          setQuiz(quizData);

          const modDataWithQuiz = { ...modData, quiz: quizData };
          setModule(modDataWithQuiz);

          // Fetch if this specific module is completed
          let completed = false;
          if (session) {
            const { data: progress, error: progressError } = await supabase
              .from('module_progress')
              .select('*')
              .eq('client_id', session.user.id)
              .eq('module_id', moduleId);

            if (!progressError && progress && progress.length > 0) {
              completed = true;
            }
          }
          setIsCompleted(completed);
          setIsOfflineMode(false);

          // Cache the fetched data
          await saveCourseToCache({ id: courseId, ...courseData });
          if (modDataWithQuiz) {
            await saveModulesToCache(courseId!, [modDataWithQuiz]);
          }

        } catch (networkErr) {
          console.warn("Network request failed, falling back to local IndexedDB cache:", networkErr);
          
          // Try fetching from local cache
          const cachedCourse = await getCourseFromCache(courseId!);
          const cachedModule = await getSingleModuleFromCache(moduleId!);
          const cachedAllModules = await getModulesFromCache(courseId!);
          
          if (cachedCourse && cachedModule) {
            setCourse(cachedCourse);
            setModule(cachedModule);
            setQuiz(cachedModule.quiz || null);
            
            // Map simple navigation fields for all modules if cached
            if (cachedAllModules && cachedAllModules.length > 0) {
              setAllModules(cachedAllModules.map(m => ({
                id: m.id,
                title: m.title,
                order_index: m.order_index
              })));
            } else {
              setAllModules([{ id: cachedModule.id, title: cachedModule.title, order_index: cachedModule.order_index }]);
            }

            // Determine if completed from cached course progress
            const completedList = cachedCourse.completed_module_ids || [];
            setIsCompleted(completedList.includes(moduleId));
            setIsOfflineMode(true);
          } else {
            // Throw the original error if there's no cache
            throw networkErr;
          }
        }

      } catch (err) {
        console.error("Error loading module workspace:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchModuleDetails();
  }, [courseId, moduleId, navigate]);

  const toggleCompletion = async () => {
    if (toggling || !moduleId) return;
    try {
      setToggling(true);
      const newCompletionState = !isCompleted;
      
      // If we are online, try to sync to Supabase
      if (userId && !isOfflineMode) {
        try {
          if (isCompleted) {
            // Delete progress
            const { error } = await supabase
              .from('module_progress')
              .delete()
              .eq('client_id', userId)
              .eq('module_id', moduleId);
              
            if (error) throw error;
          } else {
            // Add progress
            const { error } = await supabase
              .from('module_progress')
              .insert([{ client_id: userId, module_id: moduleId }]);
              
            if (error) throw error;
          }
        } catch (dbErr) {
          console.warn("Could not sync completion to server, saving locally:", dbErr);
          setIsOfflineMode(true);
        }
      }

      // Update local UI state
      setIsCompleted(newCompletionState);

      // Save locally to course cache completed_module_ids
      const cachedCourse = await getCourseFromCache(courseId!);
      if (cachedCourse) {
        let currentCompleted = cachedCourse.completed_module_ids || [];
        if (newCompletionState) {
          if (!currentCompleted.includes(moduleId)) {
            currentCompleted.push(moduleId);
          }
        } else {
          currentCompleted = currentCompleted.filter((id: string) => id !== moduleId);
        }
        cachedCourse.completed_module_ids = currentCompleted;
        await saveCourseToCache(cachedCourse);
      }
      
    } catch (err) {
      console.error("Error toggling completion:", err);
    } finally {
      setToggling(false);
    }
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
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-100 gap-3">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        <span className="text-sm text-gray-400 font-medium">Initialisation du lecteur immersif...</span>
      </div>
    );
  }

  if (!module || !course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 p-6 text-center text-white">
        <h2 className="text-xl font-bold mb-2">Module introuvable</h2>
        <p className="text-gray-400 mb-6">Le module demandé n'a pas pu être chargé.</p>
        <button
          onClick={() => navigate(`/client/course/${courseId}`)}
          className="px-5 py-2.5 bg-purple-600 text-white rounded-xl font-bold"
        >
          Retour aux modules
        </button>
      </div>
    );
  }

  // Find next module if any
  const currentIdx = allModules.findIndex(m => m.id === moduleId);
  const nextModule = currentIdx !== -1 && currentIdx < allModules.length - 1 ? allModules[currentIdx + 1] : null;

  const embedUrl = getYoutubeEmbedUrl(module.youtube_url);
  // Support either the new module_files relation or old download_files JSON array
  const filesList = module.module_files && module.module_files.length > 0 ? module.module_files : (module.download_files || []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden animate-fade-in">
      {/* Immersive distraction-free status bar */}
      <nav className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0 gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <Link
            to={`/client/course/${courseId}`}
            className="flex items-center gap-1 text-xs font-bold text-purple-400 hover:text-purple-300 bg-slate-800 hover:bg-slate-750 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-all shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden md:inline">Quitter le plein écran</span>
            <span className="md:hidden">Quitter</span>
          </Link>
          <div className="h-4 w-[1px] bg-slate-800 shrink-0"></div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block mb-0.5 truncate">
              {course.title}
            </span>
            <h2 className="text-xs sm:text-sm font-black text-white truncate" title={`Module ${currentIdx + 1} : ${module.title}`}>
              Module {currentIdx + 1} : {module.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {quiz ? (
            isCompleted ? (
              <button
                onClick={() => setIsQuizOverlayOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/35 rounded-xl text-xs font-extrabold shadow-sm hover:bg-emerald-500/20 transition-all"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                Quizz Réussi 🎉
              </button>
            ) : (
              <button
                onClick={() => setIsQuizOverlayOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md rounded-xl text-xs font-extrabold transition-all hover:scale-[1.02] shadow-emerald-500/10 animate-pulse"
              >
                <HelpCircle className="w-3.5 h-3.5 animate-bounce" />
                Passer le Quizz d'évaluation
              </button>
            )
          ) : (
            <button
              onClick={toggleCompletion}
              disabled={toggling}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isCompleted
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md'
              }`}
            >
              {toggling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isCompleted ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  Validé
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Marquer comme vu
                </>
              )}
            </button>
          )}
        </div>
      </nav>

      {isOfflineMode && (
        <div className="bg-amber-500 text-white text-xs font-bold py-2 px-6 flex items-center justify-center gap-2 shadow-sm shrink-0">
          <WifiOff className="w-3.5 h-3.5 animate-bounce" />
          <span>Mode Hors-ligne : Contenu chargé depuis le cache local (IndexedDB). Les ressources téléchargées restent consultables.</span>
        </div>
      )}

      {/* Main Workspace split */}
      <div className="flex-grow flex flex-col lg:flex-row h-full">
        
        {/* Left Side: Video Player or Lesson Card (Immersive media) */}
        <div className="flex-1 bg-slate-950 p-6 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-900">
          {embedUrl ? (
            <div className="w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800 relative">
              <iframe
                src={embedUrl}
                title={module.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full absolute inset-0"
              />
            </div>
          ) : (
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-xl">
              <div className="w-16 h-16 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center">
                <Play className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Ce module n'inclut pas de vidéo</h3>
              <p className="text-gray-400 text-sm max-w-md">
                Le contenu de cette leçon est disponible sous forme de texte, de résumé et de supports de cours téléchargeables ci-contre.
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Scrollable Lesson Material and Resources */}
        <div className="w-full lg:w-[450px] bg-slate-900 flex flex-col shrink-0">
          <div className="flex-grow overflow-y-auto p-6 space-y-8 max-h-[calc(100vh-140px)]">
            
            {/* Title & Description card */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider">Descriptif</span>
              <h3 className="text-lg font-black text-white leading-tight">
                {module.title}
              </h3>
              {module.description && (
                <p className="text-slate-400 text-xs leading-relaxed">
                  {module.description}
                </p>
              )}
            </div>

            {/* Quiz validation banner */}
            {quiz && (
              <div className={`p-4 rounded-2xl border text-xs leading-relaxed flex flex-col gap-2.5 ${
                isCompleted 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}>
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span className="font-extrabold uppercase tracking-wider text-[10px]">
                    {isCompleted ? "Évaluation Validée" : "Évaluation Requise"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {isCompleted 
                    ? "Félicitations ! Vous avez validé l'évaluation de ce module à plus de 70%." 
                    : "Ce module dispose d'un quizz de validation. Vous devez obtenir au moins 70% de réussite pour débloquer le module suivant."}
                </p>
                {!isCompleted && (
                  <button
                    onClick={() => setIsQuizOverlayOpen(true)}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all shadow-md mt-1"
                  >
                    Commencer le Quizz de validation
                  </button>
                )}
              </div>
            )}

            {/* Lesson Core Text */}
            <div className="space-y-3 border-t border-slate-800 pt-6">
              <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider block">Leçon / Fiche de cours</span>
              
              {module.long_summary ? (
                <div 
                  className="prose prose-invert prose-xs text-slate-300 leading-relaxed bg-slate-950 p-5 rounded-2xl border border-slate-800/80 max-w-none 
                    [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_strong]:font-bold [&_em]:italic [&_u]:underline"
                  dangerouslySetInnerHTML={{ __html: module.long_summary }}
                />
              ) : (
                <p className="text-slate-500 italic text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
                  Aucune fiche récapitulative n'a été rédigée pour ce module.
                </p>
              )}
            </div>

            {/* Downloadable files */}
            <div className="space-y-3 border-t border-slate-800 pt-6">
              <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider block">
                Fichiers & supports ({filesList.length})
              </span>

              {filesList.length === 0 ? (
                <p className="text-slate-500 italic text-xs">Aucun fichier à télécharger.</p>
              ) : (
                <div className="space-y-2.5">
                  {filesList.map((file: any, fIdx: number) => (
                    <a
                      key={fIdx}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-slate-950 hover:bg-slate-800 border border-slate-850 hover:border-purple-900 rounded-xl transition-all shadow-xs group"
                    >
                      <div className="w-8 h-8 bg-purple-500/10 text-purple-400 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate group-hover:text-purple-400 transition-colors">
                          {file.name || "Support de cours"}
                        </p>
                        <span className="text-[9px] text-slate-500 font-medium">Cliquez pour ouvrir ou télécharger</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-purple-400 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Footer Action of Right panel (e.g. Next module navigation) */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <Link
              to={`/client/course/${courseId}`}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Liste
            </Link>

            {quiz && !isCompleted ? (
              <button
                type="button"
                disabled
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-slate-500 border border-slate-750 rounded-xl text-xs font-bold cursor-not-allowed shadow-inner"
                title="Vous devez valider le quizz de ce module pour passer au module suivant."
              >
                Bloqué 🔒 (Quizz requis)
              </button>
            ) : nextModule ? (
              <Link
                to={`/client/course/${courseId}/module/${nextModule.id}`}
                className="flex items-center gap-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
              >
                Module suivant
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => navigate(`/client/course/${courseId}`)}
                className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors animate-pulse"
              >
                Formation terminée !
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            )}
          </div>

        </div>

      </div>

      {quiz && (
        <ClientQuizOverlay
          isOpen={isQuizOverlayOpen}
          onClose={() => setIsQuizOverlayOpen(false)}
          quiz={quiz}
          moduleTitle={module.title}
          onPass={async (score) => {
            setIsCompleted(true);
            
            if (userId && !isOfflineMode) {
              try {
                const { data: progress } = await supabase
                  .from('module_progress')
                  .select('*')
                  .eq('client_id', userId)
                  .eq('module_id', moduleId);

                if (!progress || progress.length === 0) {
                  await supabase
                    .from('module_progress')
                    .insert([{ client_id: userId, module_id: moduleId }]);
                }
              } catch (dbErr) {
                console.warn("Could not sync quiz completion to server, saving locally:", dbErr);
                setIsOfflineMode(true);
              }
            }

            const cachedCourse = await getCourseFromCache(courseId!);
            if (cachedCourse) {
              let currentCompleted = cachedCourse.completed_module_ids || [];
              if (!currentCompleted.includes(moduleId)) {
                currentCompleted.push(moduleId);
              }
              cachedCourse.completed_module_ids = currentCompleted;
              await saveCourseToCache(cachedCourse);
            }
          }}
        />
      )}
    </div>
  );
}
