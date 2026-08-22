import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Loader2, 
  ChevronLeft, 
  BookOpen, 
  Check, 
  Play, 
  FileText, 
  ExternalLink, 
  ArrowRight,
  Clock,
  Award,
  Video,
  CheckCircle2,
  WifiOff,
  RefreshCw,
  Lock,
  Calendar,
  CheckSquare,
  Sparkles
} from 'lucide-react';
import { ModuleSession } from '../types';
import { 
  getCourseFromCache, 
  getModulesFromCache, 
  saveCourseToCache, 
  saveModulesToCache 
} from '../lib/courseCache';

export default function ClientCourseView() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  
  const [course, setCourse] = useState<any | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [quizModuleIds, setQuizModuleIds] = useState<string[]>([]);
  const [accessDeniedReason, setAccessDeniedReason] = useState<string | null>(null);

  const checkAuthAndFetchData = async (isManualRefresh = false) => {
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

        // Check if admin/trainer or approved student
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        const isAdminOrTrainer = profile && ['admin', 'trainer', 'superadmin'].includes(profile.role);

        if (!isAdminOrTrainer) {
          const { data: regData } = await supabase
            .from('registrations')
            .select('payment_status')
            .eq('client_id', session.user.id)
            .eq('course_id', courseId)
            .maybeSingle();

          if (!regData) {
            setAccessDeniedReason("Vous n'êtes pas encore inscrit(e) à cette formation.");
          } else if (regData.payment_status !== 'approved') {
            setAccessDeniedReason("L'accès à cette formation est verrouillé tant que votre paiement n'a pas été validé par l'administration.");
          } else {
            setAccessDeniedReason(null);
          }
        } else {
          setAccessDeniedReason(null);
        }
      } else {
        setAccessDeniedReason("Vous devez être connecté(e) pour accéder à cette formation.");
      }

      // Try online fetch first
      try {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('*, trainers(*)')
          .eq('id', courseId)
          .single();

        if (courseError) throw courseError;

        const { data: modulesData, error: modulesError } = await supabase
          .from('course_modules')
          .select('*, module_files(*)')
          .eq('course_id', courseId)
          .order('order_index', { ascending: true });

        if (modulesError) throw modulesError;

        const fetchedModules = modulesData || [];
        
        // Fetch quiz status for all modules of this course
        let qModuleIds: string[] = [];
        if (fetchedModules.length > 0) {
          const { data: quizzesData } = await supabase
            .from('quizzes')
            .select('module_id')
            .in('module_id', fetchedModules.map(m => m.id));
          qModuleIds = (quizzesData || []).map((q: any) => q.module_id);
        }
        setQuizModuleIds(qModuleIds);

        let completed: string[] = [];
        if (session) {
          const { data: progressData, error: progressError } = await supabase
            .from('module_progress')
            .select('module_id')
            .eq('client_id', session.user.id);

          if (!progressError && progressData) {
            completed = progressData.map(p => p.module_id);
          }
        }

        // Set state
        setCourse(courseData);
        setModules(fetchedModules);
        setCompletedIds(completed);
        setIsOfflineMode(false);

        // Save to Cache
        const courseToSave = {
          ...courseData,
          completed_module_ids: completed
        };
        await saveCourseToCache(courseToSave);
        if (fetchedModules.length > 0) {
          await saveModulesToCache(courseId!, fetchedModules);
        }

      } catch (networkErr) {
        console.warn("Network request failed, falling back to local IndexedDB cache:", networkErr);
        
        // Try fetching from local cache
        const cachedCourse = await getCourseFromCache(courseId!);
        const cachedModules = await getModulesFromCache(courseId!);
        
        if (cachedCourse) {
          setCourse(cachedCourse);
          setModules(cachedModules || []);
          setCompletedIds(cachedCourse.completed_module_ids || []);
          setIsOfflineMode(true);
          
          if (cachedModules && cachedModules.length > 0) {
            const qModuleIds = cachedModules.filter(m => m.quiz).map(m => m.id);
            setQuizModuleIds(qModuleIds);
          }
        } else {
          // Throw the original error if there's no cache
          throw networkErr;
        }
      }
    } catch (err) {
      console.error("Error fetching course view:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    checkAuthAndFetchData();
  }, [courseId, navigate]);

  // Extract all sessions across accessible/unlocked modules with module metadata
  const allCourseSessions = useMemo(() => {
    const result: { session: ModuleSession; module: any; moduleIndex: number }[] = [];
    
    modules.forEach((mod, modIdx) => {
      // Determine if module is locked
      let isLockedByDate = false;
      if (mod.scheduled_date && new Date(mod.scheduled_date).getTime() > new Date().getTime()) {
        isLockedByDate = true;
      }

      let isLockedByPreviousDate = false;
      let isLockedByQuiz = false;
      let isLockedBySessions = false;
      for (let i = 0; i < modIdx; i++) {
        const prevMod = modules[i];
        if (prevMod.scheduled_date && new Date(prevMod.scheduled_date).getTime() > new Date().getTime()) {
          isLockedByPreviousDate = true;
        }
        const prevHasQuiz = quizModuleIds.includes(prevMod.id);
        const prevCompleted = completedIds.includes(prevMod.id);
        if (prevHasQuiz && !prevCompleted) {
          isLockedByQuiz = true;
        }

        const prevSessions = (prevMod.download_files || []).filter((f: any) => f.type === 'session');
        if (prevSessions.length > 0) {
          const allPrevSessionsCompleted = prevSessions.every((s: any) => s.isCompleted);
          if (!allPrevSessionsCompleted) {
            isLockedBySessions = true;
          }
        }
      }

      const isLocked = isLockedByQuiz || isLockedByDate || isLockedByPreviousDate || isLockedBySessions;
      if (isLocked) {
        // Do not expose sessions for locked modules
        return;
      }

      const rawFiles = mod.download_files || [];
      const modSessions = rawFiles.filter((f: any) => f.type === 'session') as ModuleSession[];
      
      modSessions.forEach(session => {
        result.push({
          session,
          module: mod,
          moduleIndex: modIdx
        });
      });
    });

    return result;
  }, [modules, quizModuleIds, completedIds]);

  // Helper to determine end time of a session
  const getSessionEndTime = (dateStr: string): number => {
    if (!dateStr) return Infinity;
    if (dateStr.includes('T') || dateStr.includes(':')) {
      return new Date(dateStr).getTime();
    }
    const d = new Date(dateStr);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  };

  const formatSessionDateTime = (dateStr: string) => {
    if (!dateStr) return 'Date non spécifiée';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const hasTime = dateStr.includes('T') || dateStr.includes(':');
    const dateFormatted = d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    if (hasTime) {
      const timeFormatted = d.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${dateFormatted} à ${timeFormatted}`;
    }

    return dateFormatted;
  };

  // Find the next upcoming session (uncompleted session whose date/time has NOT passed yet)
  const nextSessionData = useMemo(() => {
    if (allCourseSessions.length === 0) return null;

    const now = Date.now();

    const sorted = [...allCourseSessions].sort((a, b) => {
      const dateA = a.session.date ? new Date(a.session.date).getTime() : Infinity;
      const dateB = b.session.date ? new Date(b.session.date).getTime() : Infinity;
      if (dateA !== dateB) return dateA - dateB;
      return a.moduleIndex - b.moduleIndex;
    });

    const upcoming = sorted.find(item => {
      if (item.session.isCompleted) return false;
      const endTime = getSessionEndTime(item.session.date);
      return endTime >= now;
    });

    if (upcoming) {
      return {
        allCompleted: false,
        data: upcoming
      };
    }

    return {
      allCompleted: true,
      data: sorted[sorted.length - 1]
    };
  }, [allCourseSessions]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="text-sm text-gray-500 font-medium">Chargement de votre espace de formation...</span>
      </div>
    );
  }

  if (accessDeniedReason) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4 text-amber-600 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-gray-900 mb-2">Accès Restreint</h2>
        <p className="text-gray-600 mb-6 max-w-md text-sm leading-relaxed">{accessDeniedReason}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/client/hub')}
            className="px-5 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors text-xs sm:text-sm shadow-sm"
          >
            Retourner à mon tableau de bord
          </button>
          <a
            href={`https://wa.me/237698389030?text=${encodeURIComponent(`Bonjour, je souhaite débloquer mon accès à la formation "${course?.title || ''}".`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors text-xs sm:text-sm shadow-sm"
          >
            Contacter le support (WhatsApp)
          </a>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <BookOpen className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Formation introuvable</h2>
        <p className="text-gray-500 mb-6 max-w-md">Nous n'avons pas pu charger les données de cette formation. Veuillez réessayer.</p>
        <button
          onClick={() => navigate('/client/hub')}
          className="px-5 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors"
        >
          Retourner au tableau de bord
        </button>
      </div>
    );
  }

  const completedCount = modules.filter(m => completedIds.includes(m.id)).length;
  const totalCount = modules.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col animate-fade-in">
      {/* Top clean header bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 sm:px-6 py-4 shadow-xs shrink-0 pt-safe">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 min-w-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate('/client/hub')}
              className="p-2 -ml-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all shrink-0"
              title="Retour au tableau de bord"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="h-5 w-[1px] bg-gray-200 shrink-0"></div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest leading-none mb-1 truncate">Espace Apprenant</p>
              <h1 className="text-base sm:text-lg font-black text-gray-900 leading-tight truncate" title={course.title}>
                {course.title}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => checkAuthAndFetchData(true)}
              disabled={refreshing}
              className={`p-2 bg-slate-50 border border-gray-150 hover:bg-slate-100 rounded-xl transition-all ${
                refreshing ? 'text-purple-600' : 'text-gray-500 hover:text-gray-800'
              }`}
              title="Actualiser le contenu de la formation"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <span className="hidden sm:inline-flex text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">
              {completedCount} / {totalCount} Modules validés
            </span>
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0">
              {progressPercentage}%
            </div>
          </div>
        </div>
      </header>

      {isOfflineMode && (
        <div className="bg-amber-500 text-white text-xs font-bold py-2.5 px-6 flex items-center justify-center gap-2 shadow-sm shrink-0">
          <WifiOff className="w-4 h-4 animate-bounce" />
          <span>Mode Hors-ligne : Contenu chargé depuis le cache local (IndexedDB)</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-8">
        
        {/* Banner with Progress and Details */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-8 mb-6 sm:mb-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
          <div className="space-y-4 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-100 uppercase tracking-wider">
                {course.product_type === 'ebook' ? 'E-Book' : 'Formation active'}
              </span>
              {course.trainers && (
                <span className="text-xs text-gray-500 font-medium">
                  Présentée par <strong className="text-gray-700 font-semibold">{course.trainers.name}</strong>
                </span>
              )}
            </div>
            
            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 leading-tight">
              Bienvenue dans votre parcours de formation
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Consultez les différents modules ci-dessous à votre propre rythme. Chaque module comporte un résumé, des supports vidéo interactifs et des fiches mémo à télécharger.
            </p>
          </div>

          {/* Large Interactive Progress Indicator */}
          <div className="md:w-72 bg-purple-50/40 rounded-2xl border border-purple-100/50 p-5 flex flex-col justify-center shrink-0">
            <div className="flex justify-between items-center text-xs font-bold text-gray-600 mb-2">
              <span>Votre Progression</span>
              <span className="text-purple-700 font-extrabold">{progressPercentage}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200/80 rounded-full overflow-hidden mb-3">
              <div 
                className="h-full bg-purple-600 rounded-full transition-all duration-700"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-800">
              <Award className="w-4 h-4 shrink-0 text-purple-600" />
              <span>
                {progressPercentage === 100 
                  ? "Félicitations ! Vous avez terminé ce cours." 
                  : "Continuez ainsi pour atteindre 100% !"}
              </span>
            </div>
          </div>
        </div>

        {/* Next Session Tile */}
        {nextSessionData && nextSessionData.data && (
          <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-orange-500/10 border-2 border-orange-200/80 rounded-3xl p-6 sm:p-7 shadow-sm mb-8 relative overflow-hidden">
            {/* Top Badge & Module Link */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-orange-200/50">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black text-white shadow-xs ${
                  nextSessionData.allCompleted ? 'bg-emerald-600' : 'bg-orange-500'
                }`}>
                  <Calendar className="w-3.5 h-3.5" />
                  {nextSessionData.allCompleted ? 'Toutes les séances réalisées' : 'PROCHAINE SÉANCE PROGRAMMÉE'}
                </span>
                <span className="text-xs font-bold text-orange-900/80 bg-orange-100/60 px-2.5 py-0.5 rounded-md">
                  Module {nextSessionData.data.moduleIndex + 1}
                </span>
              </div>

              <span className="text-xs font-extrabold text-slate-800 bg-white/80 backdrop-blur-xs px-3 py-1 rounded-xl border border-orange-200/60 truncate max-w-md">
                {nextSessionData.data.module.title}
              </span>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Left Column: Date & Title */}
              <div className="md:col-span-6 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-orange-700">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span>
                    {formatSessionDateTime(nextSessionData.data.session.date)}
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {nextSessionData.data.session.name}
                </h3>

                {nextSessionData.data.session.completionPercent > 0 && (
                  <p className="text-xs text-orange-800/80 font-semibold">
                    Impact sur le module : +{nextSessionData.data.session.completionPercent}% de progression
                  </p>
                )}
              </div>

              {/* Right Column: Objectives & CTA */}
              <div className="md:col-span-6 bg-white/90 backdrop-blur-xs rounded-2xl p-4 border border-orange-100 shadow-xs space-y-3">
                <p className="text-[11px] font-black uppercase text-orange-600 tracking-wider flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5" />
                  Objectifs de la séance
                </p>

                {nextSessionData.data.session.objectives && nextSessionData.data.session.objectives.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                    {nextSessionData.data.session.objectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic">Aucun objectif spécifique renseigné pour cette séance.</p>
                )}

                <div className="pt-2 flex justify-end">
                  <Link
                    to={`/client/course/${courseId}/module/${nextSessionData.data.module.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs hover:shadow-md"
                  >
                    Accéder au module
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modules Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900 tracking-tight">
              Liste des modules de cours
            </h3>
            <span className="text-xs font-semibold text-gray-500">
              {totalCount} modules au total
            </span>
          </div>

          {modules.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-gray-100 shadow-sm">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium text-sm mb-1">Aucun module n'a été publié pour cette formation.</p>
              <p className="text-gray-400 text-xs">Veuillez patienter pendant que le formateur configure le contenu.</p>
            </div>
          ) : (
            <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {modules.map((m, index) => {
                const isCompleted = completedIds.includes(m.id);
                const fileCount = m.module_files?.length || 0;
                
                // Determine if this module is locked (if any previous module has a quiz and is not completed)
                let isLockedByDate = false;
                if (m.scheduled_date && new Date(m.scheduled_date).getTime() > new Date().getTime()) {
                  isLockedByDate = true;
                }

                let isLockedByPreviousDate = false;
                let isLockedByQuiz = false;
                let isLockedBySessions = false;
                for (let i = 0; i < index; i++) {
                  const prevMod = modules[i];
                  
                  if (prevMod.scheduled_date && new Date(prevMod.scheduled_date).getTime() > new Date().getTime()) {
                    isLockedByPreviousDate = true;
                  }

                  const prevHasQuiz = quizModuleIds.includes(prevMod.id);
                  const prevCompleted = completedIds.includes(prevMod.id);

                  if (prevHasQuiz && !prevCompleted) {
                    isLockedByQuiz = true;
                  }

                  // Check if previous module has uncompleted sessions
                  const prevSessions = (prevMod.download_files || []).filter((f: any) => f.type === 'session');
                  if (prevSessions.length > 0) {
                    const allPrevSessionsCompleted = prevSessions.every((s: any) => s.isCompleted);
                    if (!allPrevSessionsCompleted) {
                      isLockedBySessions = true;
                    }
                  }
                }
                
                const isLocked = isLockedByQuiz || isLockedByDate || isLockedByPreviousDate || isLockedBySessions;
                
                return (
                  <div 
                    key={m.id}
                    className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between h-full ${
                      isLocked
                        ? 'opacity-65 bg-gray-50/50 border-gray-150'
                        : isCompleted 
                          ? 'border-green-100 bg-green-50/10 hover:shadow-md hover:scale-[1.01]' 
                          : 'border-gray-100 hover:border-purple-100 hover:shadow-md hover:scale-[1.01]'
                    }`}
                  >
                    <div>
                      {/* Top indicator & Status */}
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        {isLocked ? (
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Module {index + 1}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Module {index + 1}
                          </span>
                        )}
                        
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          isLocked
                            ? 'bg-gray-100 text-gray-300'
                            : isCompleted 
                              ? 'bg-green-100 text-green-600' 
                              : 'bg-gray-100 text-gray-400'
                        }`}>
                          {isLocked ? (
                            <Lock className="w-3 h-3" />
                          ) : isCompleted ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            <span className="text-[10px] font-bold">{index + 1}</span>
                          )}
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h4 className={`text-base font-black leading-snug transition-colors ${
                        isLocked ? 'text-gray-400' : 'text-gray-900 group-hover:text-purple-700'
                      }`}>
                        {m.title}
                      </h4>
                      {m.scheduled_date && (
                        <div className={`flex items-center gap-1.5 mt-2 mb-2 text-xs font-medium w-fit px-2 py-0.5 rounded-full border ${isLocked ? 'text-gray-400 bg-gray-50 border-gray-200' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(m.scheduled_date).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      <p className={`text-xs leading-relaxed line-clamp-3 mb-4 mt-2 ${
                        isLocked ? 'text-gray-400/80' : 'text-gray-500'
                      }`}>
                        {m.description || "Aucune description rapide disponible pour ce module."}
                      </p>

                      {/* Display sessions for accessible / unlocked modules only */}
                      {!isLocked && (() => {
                        const modSessions = (m.download_files || []).filter((f: any) => f.type === 'session') as ModuleSession[];
                        if (modSessions.length === 0) return null;

                        return (
                          <div className="mt-3 pt-3 border-t border-orange-100 space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-black uppercase text-orange-600 tracking-wider">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                                Séances programmées ({modSessions.length})
                              </span>
                            </div>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {modSessions.map((s, sIdx) => (
                                <div 
                                  key={s.id || sIdx}
                                  className={`p-2 rounded-xl text-xs border ${
                                    s.isCompleted 
                                      ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950' 
                                      : 'bg-orange-50/50 border-orange-200/60 text-slate-900'
                                  }`}
                                >
                                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-1 sm:gap-1.5">
                                    <span className="font-bold text-xs flex items-start gap-1.5">
                                      {s.isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />}
                                      <span className="line-clamp-2 leading-snug">{s.name}</span>
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-500 shrink-0 flex items-center gap-1 mt-0.5 xl:mt-0">
                                      <Clock className="w-3 h-3" />
                                      {s.date ? (
                                        s.date.includes('T') || s.date.includes(':') 
                                          ? `${new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${new Date(s.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                                          : new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                                      ) : ''}
                                    </span>
                                  </div>
                                  {s.objectives && s.objectives.length > 0 && (
                                    <ul className="text-[10px] text-slate-600 list-disc pl-3.5 mt-1.5 space-y-0.5">
                                      {s.objectives.map((obj, oIdx) => (
                                        <li key={oIdx} className="line-clamp-2">{obj}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Footer indicators and Call to action */}
                    <div className="pt-4 border-t border-gray-50 space-y-3 mt-auto">
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-400">
                        {m.youtube_url && (
                          <span className="flex items-center gap-1">
                            <Video className="w-3.5 h-3.5 text-red-500" />
                            Contenu vidéo
                          </span>
                        )}
                        {fileCount > 0 && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                            {fileCount} ressource{fileCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {isLocked ? (
                        <button
                          disabled
                          className="flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                          title={
                            isLockedByDate 
                              ? "Ce module sera disponible à la date programmée." 
                              : isLockedByPreviousDate 
                                ? "En attente de la disponibilité des modules précédents."
                                : isLockedBySessions
                                  ? "Toutes les séances du module précédent doivent être réalisées pour débloquer ce module (même si le quizz est validé)."
                                  : "Vous devez valider le quizz du module précédent pour débloquer ce module."
                          }
                        >
                          <Lock className="w-3.5 h-3.5" />
                          {isLockedByDate || isLockedByPreviousDate 
                            ? "Non disponible" 
                            : isLockedBySessions 
                              ? "Bloqué (Séances requises)" 
                              : "Bloqué (Quizz requis)"}
                        </button>
                      ) : (
                        <Link
                          to={`/client/course/${courseId}/module/${m.id}`}
                          className={`flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs ${
                            isCompleted
                              ? 'bg-green-100 hover:bg-green-200 text-green-800'
                              : 'bg-purple-600 hover:bg-purple-700 text-white'
                          }`}
                        >
                          {isCompleted ? "Revoir le module" : "Suivre le module"}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
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
