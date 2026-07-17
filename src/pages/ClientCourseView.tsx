import React, { useState, useEffect } from 'react';
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
  WifiOff
} from 'lucide-react';
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
  const [userId, setUserId] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
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
          setModules(modulesData || []);
          setCompletedIds(completed);
          setIsOfflineMode(false);

          // Save to Cache
          const courseToSave = {
            ...courseData,
            completed_module_ids: completed
          };
          await saveCourseToCache(courseToSave);
          if (modulesData && modulesData.length > 0) {
            await saveModulesToCache(courseId!, modulesData);
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
          } else {
            // Throw the original error if there's no cache
            throw networkErr;
          }
        }
      } catch (err) {
        console.error("Error fetching course view:", err);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetchData();
  }, [courseId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="text-sm text-gray-500 font-medium">Chargement de votre espace de formation...</span>
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
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 sm:px-6 py-4 shadow-xs shrink-0">
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
      <main className="flex-grow max-w-7xl mx-auto w-full px-6 py-8">
        
        {/* Banner with Progress and Details */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 mb-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
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
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium text-sm mb-1">Aucun module n'a été publié pour cette formation.</p>
              <p className="text-gray-400 text-xs">Veuillez patienter pendant que le formateur configure le contenu.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((m, index) => {
                const isCompleted = completedIds.includes(m.id);
                const fileCount = m.module_files?.length || 0;
                
                return (
                  <div 
                    key={m.id}
                    className={`bg-white rounded-2xl p-6 border transition-all flex flex-col justify-between h-full hover:shadow-md hover:scale-[1.01] ${
                      isCompleted 
                        ? 'border-green-100 bg-green-50/10' 
                        : 'border-gray-100 hover:border-purple-100'
                    }`}
                  >
                    <div>
                      {/* Top indicator & Status */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Module {index + 1}
                        </span>
                        
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          isCompleted 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          {isCompleted ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            <span className="text-[10px] font-bold">{index + 1}</span>
                          )}
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h4 className="text-base font-black text-gray-900 mb-2 leading-snug group-hover:text-purple-700 transition-colors">
                        {m.title}
                      </h4>
                      <p className="text-gray-500 text-xs leading-relaxed line-clamp-3 mb-4">
                        {m.description || "Aucune description rapide disponible pour ce module."}
                      </p>
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
