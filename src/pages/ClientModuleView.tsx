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
  HelpCircle,
  RefreshCw,
  Lock,
  X,
  Sun,
  Moon,
  Clock
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
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [quiz, setQuiz] = useState<any | null>(null);
  const [isQuizOverlayOpen, setIsQuizOverlayOpen] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [quizModuleIds, setQuizModuleIds] = useState<string[]>([]);
  const [isFullscreenReading, setIsFullscreenReading] = useState(false);
  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('clientLightMode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('clientLightMode', String(isLightMode));
  }, [isLightMode]);

  const fetchModuleDetails = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
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

        // Fetch quiz status for all modules of this course
        let qModuleIds: string[] = [];
        if (allMods && allMods.length > 0) {
          const { data: quizzesData } = await supabase
            .from('quizzes')
            .select('module_id')
            .in('module_id', allMods.map(m => m.id));
          qModuleIds = (quizzesData || []).map((q: any) => q.module_id);
        }
        setQuizModuleIds(qModuleIds);

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

        // Fetch user's completion status for all modules
        let completedList: string[] = [];
        if (session) {
          const { data: progressData, error: progressError } = await supabase
            .from('module_progress')
            .select('module_id')
            .eq('client_id', session.user.id);

          if (!progressError && progressData) {
            completedList = progressData.map(p => p.module_id);
          }
        }
        setCompletedIds(completedList);
        setIsCompleted(completedList.includes(moduleId!));
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
            
            const qModuleIds = cachedAllModules.filter(m => m.quiz).map(m => m.id);
            setQuizModuleIds(qModuleIds);
          } else {
            setAllModules([{ id: cachedModule.id, title: cachedModule.title, order_index: cachedModule.order_index }]);
            setQuizModuleIds(cachedModule.quiz ? [cachedModule.id] : []);
          }

          // Determine if completed from cached course progress
          const completedList = cachedCourse.completed_module_ids || [];
          setCompletedIds(completedList);
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
      setRefreshing(false);
    }
  };

  useEffect(() => {
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

  // Check if current module is locked
  let isCurrentModuleLocked = false;
  let lockingModuleTitle = '';
  let isLockedByDate = false;
  let isLockedByPreviousDate = false;
  
  if (currentIdx !== -1) {
    if (module.scheduled_date && new Date(module.scheduled_date).getTime() > new Date().getTime()) {
      isCurrentModuleLocked = true;
      isLockedByDate = true;
    }

    for (let i = 0; i < currentIdx; i++) {
      const prevMod = allModules[i];
      if (prevMod.scheduled_date && new Date(prevMod.scheduled_date).getTime() > new Date().getTime()) {
        isCurrentModuleLocked = true;
        isLockedByPreviousDate = true;
      }
      
      const prevHasQuiz = quizModuleIds.includes(prevMod.id);
      const prevCompleted = completedIds.includes(prevMod.id);
      if (prevHasQuiz && !prevCompleted) {
        isCurrentModuleLocked = true;
        lockingModuleTitle = prevMod.title;
        // Don't break so we can check dates of all previous modules
      }
    }
  }

  if (isCurrentModuleLocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl animate-fade-in">
          <div className={`w-16 h-16 ${isLockedByDate || isLockedByPreviousDate ? 'bg-amber-950/40 border-amber-500/30 text-amber-400' : 'bg-red-950/40 border-red-500/30 text-red-400'} rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse`}>
            {isLockedByDate || isLockedByPreviousDate ? <Clock className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
          </div>
          
          <h2 className="text-2xl font-black mb-3 text-white tracking-tight">{isLockedByDate || isLockedByPreviousDate ? 'Bientôt disponible ⏳' : 'Accès Verrouillé 🔒'}</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            {isLockedByDate 
              ? `Ce module sera disponible à partir du ${new Date(module.scheduled_date).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.` 
              : isLockedByPreviousDate
                ? `Pour explorer ce module, vous devez d'abord attendre la disponibilité des modules précédents.`
                : `Pour explorer ce module, vous devez d'abord valider le quiz du module précédent :`}
          </p>
          
          {(!isLockedByDate && !isLockedByPreviousDate) && (
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-left mb-6 flex items-start gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-purple-900/40 text-purple-400 flex items-center justify-center font-bold text-xs mt-0.5">
                💡
              </div>
              <div>
                <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-0.5">Quiz requis</p>
                <p className="text-sm font-bold text-slate-100">{lockingModuleTitle}</p>
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            <button
              onClick={() => navigate(`/client/course/${courseId}`)}
              className="w-full py-3 px-5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Retour au programme de la formation
            </button>
          </div>
        </div>
      </div>
    );
  }

  const embedUrl = getYoutubeEmbedUrl(module.youtube_url);
  // Support either the new module_files relation or old download_files JSON array
  const filesList = module.module_files && module.module_files.length > 0 ? module.module_files : (module.download_files || []);

  const theme = {
    bgApp: isLightMode ? 'bg-slate-50' : 'bg-slate-950',
    textMain: isLightMode ? 'text-slate-900' : 'text-slate-100',
    bgNav: isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800',
    btnGhost: isLightMode ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-slate-800 hover:bg-slate-750 text-purple-400 hover:text-purple-300',
    divider: isLightMode ? 'bg-slate-200' : 'bg-slate-800',
    title: isLightMode ? 'text-slate-900' : 'text-white',
    btnActionGhost: isLightMode ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200',
    bgLeftPanel: isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-900',
    bgRightPanel: isLightMode ? 'bg-white' : 'bg-slate-900',
    textDesc: isLightMode ? 'text-slate-600' : 'text-slate-400',
    bgCard: isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800/80',
    bgFile: isLightMode ? 'bg-white hover:bg-slate-50 border-slate-200 hover:border-purple-300' : 'bg-slate-950 hover:bg-slate-800 border-slate-850 hover:border-purple-900',
    fileText: isLightMode ? 'text-slate-700 group-hover:text-purple-600' : 'text-slate-200 group-hover:text-purple-400',
    bgFooter: isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800',
    prose: isLightMode 
      ? 'prose-slate text-slate-700 [&_h1]:text-slate-900 [&_h1]:border-slate-200 [&_h2]:text-slate-800 [&_h3]:text-slate-800 [&_h4]:text-slate-700'
      : 'prose-invert text-slate-300 [&_h1]:text-white [&_h1]:border-slate-800 [&_h2]:text-slate-200 [&_h3]:text-slate-200 [&_h4]:text-slate-300'
  };

  return (
    <div className={`min-h-screen ${theme.bgApp} ${theme.textMain} flex flex-col overflow-x-hidden animate-fade-in max-md:[&::-webkit-scrollbar]:hidden max-md:[-ms-overflow-style:none] max-md:[scrollbar-width:none]`}>
      {/* Immersive distraction-free status bar */}
      <nav className={`${theme.bgNav} border-b px-4 sm:px-6 py-4 flex items-center justify-between shrink-0 gap-4 transition-colors`}>
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <Link
            to={`/client/course/${courseId}`}
            className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-all shrink-0 ${theme.btnGhost}`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden md:inline">Quitter le plein écran</span>
            <span className="md:hidden">Quitter</span>
          </Link>
          <div className={`h-4 w-[1px] ${theme.divider} shrink-0`}></div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest block mb-0.5 truncate">
              {course.title}
            </span>
            <h2 className={`text-xs sm:text-sm font-black ${theme.title} truncate`} title={`Module ${currentIdx + 1} : ${module.title}`}>
              Module {currentIdx + 1} : {module.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsLightMode(!isLightMode)}
            className={`p-2 border rounded-xl transition-all ${theme.btnActionGhost}`}
            title={isLightMode ? "Passer au mode sombre" : "Passer au mode clair"}
          >
            {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button
            onClick={() => fetchModuleDetails(true)}
            disabled={refreshing}
            className={`p-2 border rounded-xl transition-all ${theme.btnActionGhost} ${refreshing ? (isLightMode ? 'text-purple-600' : 'text-purple-400') : ''}`}
            title="Actualiser le module"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {quiz ? (
            isCompleted ? (
              <button
                onClick={() => setIsQuizOverlayOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/35 rounded-xl text-xs font-extrabold shadow-sm hover:bg-emerald-500/20 transition-all"
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
                  ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
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
      <div className={`flex-grow flex ${embedUrl ? 'flex-col lg:flex-row' : 'flex-col'} h-full transition-colors`}>
        
        {/* Left Side: Video Player ONLY if embedUrl exists */}
        {embedUrl && (
          <div className={`w-full lg:w-[55%] xl:w-[60%] ${theme.bgLeftPanel} p-6 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r shrink-0 transition-colors`}>
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
          </div>
        )}

        {/* Right Side: Scrollable Lesson Material and Resources */}
        <div className={`w-full ${embedUrl ? 'lg:w-[45%] xl:w-[40%]' : 'max-w-4xl mx-auto'} ${theme.bgRightPanel} flex flex-col shrink-0 transition-colors shadow-2xl`}>
          <div className="flex-grow overflow-y-auto max-md:[&::-webkit-scrollbar]:hidden max-md:[-ms-overflow-style:none] max-md:[scrollbar-width:none] p-6 sm:p-10 space-y-8 max-h-[calc(100vh-140px)]">
            
            {/* Title & Description card */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase text-purple-500 tracking-wider">Descriptif</span>
              <h3 className={`text-xl sm:text-2xl font-black ${theme.title} leading-tight`}>
                {module.title}
              </h3>
              {module.scheduled_date && (
                <div className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                  <Clock className="w-4 h-4" />
                  {new Date(module.scheduled_date).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {module.description && (
                <p className={`${theme.textDesc} text-sm leading-relaxed mt-2`}>
                  {module.description}
                </p>
              )}
            </div>

            {/* Quiz validation banner */}
            {quiz && (
              <div className={`p-4 rounded-2xl border text-xs leading-relaxed flex flex-col gap-2.5 ${
                isCompleted 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300' 
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
              }`}>
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span className="font-extrabold uppercase tracking-wider text-[10px]">
                    {isCompleted ? "Évaluation Validée" : "Évaluation Requise"}
                  </span>
                </div>
                <p className="text-[11px] font-medium">
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
            <div className={`space-y-3 border-t ${theme.divider} pt-6`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-purple-500 tracking-wider block">Leçon / Fiche de cours</span>
                {module.long_summary && (
                  <button
                    onClick={() => setIsFullscreenReading(true)}
                    className={`p-1.5 rounded-lg transition-colors ${theme.btnActionGhost}`}
                    title="Lire en plein écran"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {module.long_summary ? (
                <div 
                  className={`prose prose-sm sm:prose-base leading-relaxed ${theme.bgCard} p-6 rounded-2xl border max-w-none transition-colors
                    [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_strong]:font-bold [&_em]:italic [&_u]:underline
                    [&_h1]:text-2xl [&_h1]:font-black [&_h1]:mt-5 [&_h1]:mb-3 [&_h1]:tracking-tight [&_h1]:border-b [&_h1]:pb-1
                    [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:tracking-tight
                    [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-3.5 [&_h3]:mb-1.5
                    [&_h4]:text-base [&_h4]:font-bold [&_h4]:mt-3 [&_h4]:mb-1 [&_li]:list-none ${theme.prose}`}
                  dangerouslySetInnerHTML={{ __html: module.long_summary }}
                />
              ) : (
                <p className={`${theme.textDesc} italic text-sm ${theme.bgCard} p-6 rounded-xl border`}>
                  Aucune fiche récapitulative n'a été rédigée pour ce module.
                </p>
              )}
            </div>

            {/* Downloadable files */}
            <div className={`space-y-3 border-t ${theme.divider} pt-6`}>
              <span className="text-[10px] font-black uppercase text-purple-500 tracking-wider block">
                Fichiers & supports ({filesList.length})
              </span>

              {filesList.length === 0 ? (
                <p className={`${theme.textDesc} italic text-xs`}>Aucun fichier à télécharger.</p>
              ) : (
                <div className="space-y-2.5">
                  {filesList.map((file: any, fIdx: number) => (
                    <a
                      key={fIdx}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-4 border rounded-xl transition-all shadow-sm group ${theme.bgFile}`}
                    >
                      <div className="w-10 h-10 bg-purple-500/10 text-purple-500 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate transition-colors ${theme.fileText}`}>
                          {file.name || "Support de cours"}
                        </p>
                        <span className="text-[10px] text-slate-500 font-medium">Cliquez pour ouvrir ou télécharger</span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-purple-500 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Footer Action of Right panel (e.g. Next module navigation) */}
          <div className={`p-4 ${theme.bgFooter} border-t flex items-center justify-between gap-3 shrink-0 transition-colors`}>
            <Link
              to={`/client/course/${courseId}`}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold ${theme.btnActionGhost} rounded-xl`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Liste
            </Link>

            {quiz && !isCompleted ? (
              <button
                type="button"
                disabled
                className={`flex items-center gap-1.5 px-4 py-2 border rounded-xl text-xs font-bold cursor-not-allowed shadow-inner ${isLightMode ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-800 text-slate-500 border-slate-750'}`}
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

      {isFullscreenReading && module.long_summary && (
        <div className={`fixed inset-0 z-50 ${theme.bgApp} flex flex-col animate-fade-in transition-colors`}>
          <div className={`flex items-center justify-between p-4 border-b ${theme.bgNav} shrink-0`}>
            <h3 className={`text-lg font-bold ${theme.title} truncate max-w-[80%]`}>{module.title}</h3>
            <button
              onClick={() => setIsFullscreenReading(false)}
              className={`p-2 rounded-full transition-colors ${theme.btnActionGhost}`}
              title="Fermer le mode plein écran"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto max-md:[&::-webkit-scrollbar]:hidden max-md:[-ms-overflow-style:none] max-md:[scrollbar-width:none] p-6 sm:p-10">
            <div 
              className={`prose prose-sm sm:prose-base leading-relaxed max-w-4xl mx-auto
                [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_strong]:font-bold [&_em]:italic [&_u]:underline
                [&_h1]:text-2xl [&_h1]:font-black [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:tracking-tight [&_h1]:border-b [&_h1]:pb-2
                [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:tracking-tight
                [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-5 [&_h3]:mb-2
                [&_h4]:text-base [&_h4]:font-bold [&_h4]:mt-4 [&_h4]:mb-1 [&_li]:list-none ${theme.prose}`}
              dangerouslySetInnerHTML={{ __html: module.long_summary }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
