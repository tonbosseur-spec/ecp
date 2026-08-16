import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/Toast';
import { generateSlug } from '../lib/slugUtils';
import SupabaseSlugMigrationBanner from '../components/SupabaseSlugMigrationBanner';
import { 
  ArrowLeft, 
  BookOpen, 
  PlusCircle, 
  CalendarCheck, 
  Video, 
  Search, 
  Calendar, 
  Users, 
  Trash2, 
  Copy, 
  Archive, 
  ArchiveRestore, 
  Loader2, 
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Eye
} from 'lucide-react';
import AdminModuleViewerModal from '../components/AdminModuleViewerModal';

interface ModuleData {
  id: string;
  title: string;
  description?: string;
  long_summary?: string;
  youtube_url?: string;
  download_files?: any[];
  scheduled_date?: string;
  order_index?: number;
}

interface Course {
  id: string;
  slug?: string;
  title: string;
  date_time: string;
  price_fcfa: number;
  product_type?: string;
  is_date_tbd?: boolean;
  is_active: boolean;
  is_archived?: boolean;
  registrations: { count: number }[];
  course_modules?: ModuleData[];
}

export default function AdminFormations() {
  const { toast: notify } = useToast();
  const navigate = useNavigate();
  
  const [activeSubTab, setActiveSubTab] = useState<'catalogue' | 'actions'>('catalogue');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past' | 'archived'>('all');
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Module viewer state
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [selectedCourseForViewer, setSelectedCourseForViewer] = useState<Course | null>(null);
  const [selectedModuleForViewer, setSelectedModuleForViewer] = useState<ModuleData | null>(null);
  const [viewerInitialTab, setViewerInitialTab] = useState<'content' | 'sessions' | 'add-session'>('content');
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      let { data, error } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          date_time,
          is_date_tbd,
          price_fcfa,
          product_type,
          is_active,
          is_archived,
          registrations (count),
          course_modules (
            id,
            title,
            description,
            long_summary,
            youtube_url,
            download_files,
            scheduled_date,
            order_index
          )
        `)
        .order('date_time', { ascending: false });

      if (error) {
        // Fallback without is_archived
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('courses')
          .select(`
            id,
            title,
            date_time,
            is_date_tbd,
            price_fcfa,
            product_type,
            is_active,
            registrations (count),
            course_modules (
              id,
              title,
              description,
              long_summary,
              youtube_url,
              download_files,
              scheduled_date,
              order_index
            )
          `)
          .order('date_time', { ascending: false });
        
        if (fallbackError) throw fallbackError;
        data = fallbackData as any;
      }

      setCourses(data || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des formations.');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (courseId: string) => {
    try {
      setDuplicatingId(courseId);
      
      const { data: originalCourse, error: fetchError } = await supabase
        .from('courses')
        .select('*, course_modules(*)')
        .eq('id', courseId)
        .single();
        
      if (fetchError) throw fetchError;
      
      const { id, created_at, course_modules, registrations, slug, ...courseDataToDuplicate } = originalCourse;
      const newTitle = `${originalCourse.title} - Copie`;
      const baseSlug = originalCourse.slug ? originalCourse.slug : generateSlug(originalCourse.title);
      const newSlug = `${baseSlug}-copie-${Date.now().toString().slice(-4)}`;

      let newCourseData: any = {
        ...courseDataToDuplicate,
        title: newTitle,
        slug: newSlug
      };
      
      let newCourse: any = null;
      let insertRes = await supabase
        .from('courses')
        .insert([newCourseData])
        .select()
        .single();
        
      if (insertRes.error && insertRes.error.message?.includes('slug')) {
        // Fallback if slug column missing
        delete newCourseData.slug;
        insertRes = await supabase
          .from('courses')
          .insert([newCourseData])
          .select()
          .single();
      }

      if (insertRes.error) throw insertRes.error;
      newCourse = insertRes.data;
      
      if (course_modules && course_modules.length > 0) {
        const modulesToDuplicate = course_modules.map((mod: any) => {
          const { id, created_at, course_id, ...modData } = mod;
          return {
            ...modData,
            course_id: newCourse.id
          };
        });
        
        const { error: modulesError } = await supabase
          .from('course_modules')
          .insert(modulesToDuplicate);
          
        if (modulesError) throw modulesError;
      }
      
      showNotification("Formation dupliquée avec succès !");
      fetchCourses();
    } catch (err: any) {
      notify.error(err.message || "Erreur lors de la duplication de la formation.");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async (courseId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette formation ? Cette action est irréversible.")) {
      return;
    }
    
    try {
      await supabase.from('course_modules').delete().eq('course_id', courseId);
      await supabase.from('registrations').delete().eq('course_id', courseId);

      const { data, error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error("Impossible de supprimer la formation. Vérifiez vos permissions administrateur.");
      }
      
      showNotification("Formation supprimée avec succès !");
      fetchCourses();
    } catch (err: any) {
      notify.error("Erreur lors de la suppression : " + err.message);
    }
  };

  const handleToggleArchive = async (id: string, currentStatus?: boolean) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ is_archived: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      
      showNotification(!currentStatus ? "Formation archivée." : "Formation désarchivée.");
      fetchCourses();
    } catch (err: any) {
      notify.error("Erreur lors du changement d'état : " + err.message);
    }
  };

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredCourses = useMemo(() => {
    const now = new Date();
    return courses.filter(course => {
      if (searchQuery && !course.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      if (filter === 'archived') {
        return course.is_archived === true;
      } else {
        if (course.is_archived) return false;
      }

      if (course.is_date_tbd) {
        if (filter === 'past') return false;
        return true;
      }
      
      const courseDate = new Date(course.date_time);
      if (filter === 'upcoming' && courseDate < now) return false;
      if (filter === 'past' && courseDate >= now) return false;
      
      return true;
    });
  }, [courses, searchQuery, filter]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 font-sans pb-24 w-full">
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-top-4 fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          {toastMessage}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header with Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all flex items-center justify-center shrink-0"
              title="Retour à l'accueil admin"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Page Administrateur
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1">Gestion de formations</h1>
              <p className="text-xs sm:text-sm text-gray-500">Catalogue complet, ajout de formations, séances et lives</p>
            </div>
          </div>

          <Link
            to="/admin/formations/new"
            className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-2xl transition-all shadow-md shadow-indigo-100 shrink-0"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Nouvelle formation</span>
          </Link>
        </div>

        {/* Supabase Slug Banner */}
        <SupabaseSlugMigrationBanner />

        {/* Action Hub Navigation Tuiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => setActiveSubTab('catalogue')}
            className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-4 ${
              activeSubTab === 'catalogue'
                ? 'bg-indigo-900 text-white border-indigo-900 shadow-md ring-2 ring-indigo-600'
                : 'bg-white text-gray-900 border-gray-100 hover:border-indigo-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className={`p-3 rounded-xl ${activeSubTab === 'catalogue' ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                <BookOpen className="w-6 h-6" />
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${activeSubTab === 'catalogue' ? 'bg-indigo-800 text-indigo-200' : 'bg-gray-100 text-gray-600'}`}>
                {courses.length} formation{courses.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-base">Catalogue (page unique)</h3>
              <p className={`text-xs mt-1 ${activeSubTab === 'catalogue' ? 'text-indigo-200' : 'text-gray-500'}`}>
                Consulter et gérer toutes vos formations
              </p>
            </div>
          </button>

          <Link
            to="/admin/formations/new"
            className="p-5 bg-white hover:border-indigo-200 rounded-2xl border border-gray-100 text-gray-900 transition-all flex flex-col justify-between gap-4 shadow-sm group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <PlusCircle className="w-6 h-6" />
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
            </div>
            <div>
              <h3 className="font-bold text-base">Ajouter une formation</h3>
              <p className="text-xs text-gray-500 mt-1">
                Créer un nouveau programme ou e-book
              </p>
            </div>
          </Link>

          <Link
            to="/admin/sessions"
            className="p-5 bg-white hover:border-indigo-200 rounded-2xl border border-gray-100 text-gray-900 transition-all flex flex-col justify-between gap-4 shadow-sm group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-amber-600 transition-colors" />
            </div>
            <div>
              <h3 className="font-bold text-base">Séances de formations</h3>
              <p className="text-xs text-gray-500 mt-1">
                Suivi des rendez-vous et formateurs
              </p>
            </div>
          </Link>

          <Link
            to="/live"
            className="p-5 bg-white hover:border-indigo-200 rounded-2xl border border-gray-100 text-gray-900 transition-all flex flex-col justify-between gap-4 shadow-sm group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <Video className="w-6 h-6" />
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-rose-600 transition-colors" />
            </div>
            <div>
              <h3 className="font-bold text-base">Création des Lives</h3>
              <p className="text-xs text-gray-500 mt-1">
                Salles virtuelles et visioconférences
              </p>
            </div>
          </Link>
        </div>

        {/* Catalogue Content Section */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                Catalogue Général des Formations
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Recherchez, filtrez ou modifiez vos modules</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-colors ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Tout ({courses.length})
              </button>
              <button
                onClick={() => setFilter('upcoming')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-colors ${filter === 'upcoming' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                À venir
              </button>
              <button
                onClick={() => setFilter('past')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-colors ${filter === 'past' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Passées
              </button>
              <button
                onClick={() => setFilter('archived')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-colors ${filter === 'archived' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Archivées
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mb-6">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
              placeholder="Rechercher une formation par nom..."
            />
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-xs font-medium">Chargement du catalogue...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm">{error}</div>
          ) : filteredCourses.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-3xl p-10 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3 text-gray-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-1">Aucune formation trouvée</h3>
              <p className="text-xs text-gray-500 mb-4 max-w-sm">
                {courses.length === 0
                  ? "Vous n'avez pas encore créé de formation. Ajoutez-en une dès maintenant !"
                  : "Aucun résultat ne correspond à votre recherche."}
              </p>
              {courses.length === 0 && (
                <Link
                  to="/courses/new"
                  className="px-5 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Créer une formation
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCourses.map((course) => {
                const isEbook = course.product_type === 'ebook';
                const formattedDate = (course.is_date_tbd || !course.date_time)
                  ? "Date à déterminer"
                  : new Intl.DateTimeFormat('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(course.date_time));
                
                const registrationCount = course.registrations?.[0]?.count || 0;

                const modules = course.course_modules || [];
                const modulesCount = modules.length;
                const isExpanded = expandedCourseId === course.id;

                return (
                  <div key={course.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${isEbook ? 'bg-purple-600' : 'bg-indigo-600'}`}></div>
                    
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isEbook 
                            ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {isEbook ? 'E-book' : 'Formation'}
                        </span>
                        {course.is_archived && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                            Archivé
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-gray-900 mb-2 line-clamp-2">{course.title}</h3>
                      
                      <div className="space-y-2 mb-3 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{formattedDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span>{registrationCount} {isEbook ? 'vente(s)' : 'inscrit(s)'}</span>
                        </div>
                      </div>

                      {/* Module Expand Toggle Button */}
                      <div className="my-3">
                        <button
                          onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                          className="w-full flex items-center justify-between p-2.5 bg-gray-50 hover:bg-indigo-50/50 rounded-xl text-xs font-bold text-gray-700 border border-gray-100 transition-colors group"
                        >
                          <span className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-600" />
                            <span>Programme : {modulesCount} module(s)</span>
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                          )}
                        </button>

                        {/* Expandable Module List */}
                        {isExpanded && (
                          <div className="mt-2 p-3 bg-gray-50/80 rounded-xl border border-gray-100 space-y-2 max-h-60 overflow-y-auto">
                            {modules.length === 0 ? (
                              <p className="text-[11px] text-gray-400 italic text-center py-2">
                                Aucun module créé pour cette formation.
                              </p>
                            ) : (
                              modules.map((m, idx) => {
                                const rawFiles = m.download_files || [];
                                const sessions = rawFiles.filter((f: any) => f.type === 'session');
                                const hasRichContent = !!m.long_summary || !!m.description;

                                return (
                                  <div 
                                    key={m.id || idx}
                                    className="p-2.5 bg-white rounded-lg border border-gray-200/60 shadow-2xs hover:border-indigo-200 transition-all text-xs"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-bold text-gray-900 truncate flex-1">
                                        {idx + 1}. {m.title}
                                      </span>
                                      
                                      <button
                                        onClick={() => {
                                          setSelectedCourseForViewer(course);
                                          setSelectedModuleForViewer(m);
                                          setViewerInitialTab('content');
                                          setIsViewerOpen(true);
                                        }}
                                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] shrink-0 flex items-center gap-1 transition-colors"
                                      >
                                        <Eye className="w-3 h-3" />
                                        <span>Lire</span>
                                      </button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px]">
                                      {hasRichContent && (
                                        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-100">
                                          Enrichi
                                        </span>
                                      )}
                                      {m.youtube_url && (
                                        <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold border border-rose-100">
                                          Vidéo
                                        </span>
                                      )}
                                      {sessions.length > 0 ? (
                                        <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-semibold border border-orange-100">
                                          {sessions.length} séance(s)
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setSelectedCourseForViewer(course);
                                            setSelectedModuleForViewer(m);
                                            setViewerInitialTab('add-session');
                                            setIsViewerOpen(true);
                                          }}
                                          className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold border border-amber-200 underline"
                                        >
                                          + Ajouter séance
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-2">
                      <span className="font-extrabold text-gray-900 text-sm">
                        {course.price_fcfa.toLocaleString('fr-FR')} FCFA
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleArchive(course.id, course.is_archived)}
                          className={`p-2 rounded-lg transition-colors ${course.is_archived ? 'text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-amber-600 hover:bg-gray-50'}`}
                          title={course.is_archived ? "Désarchiver" : "Archiver"}
                        >
                          {course.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDuplicate(course.id)}
                          disabled={duplicatingId === course.id}
                          className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                          title="Dupliquer"
                        >
                          {duplicatingId === course.id ? <Loader2 className="w-4 h-4 animate-spin text-gray-900" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(course.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <Link
                          to={`/admin/formations/${course.id}`}
                          className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-colors ml-1"
                        >
                          Détails & Modules
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Module Content & Sessions Viewer Modal */}
      {selectedCourseForViewer && (
        <AdminModuleViewerModal
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          courseId={selectedCourseForViewer.id}
          courseTitle={selectedCourseForViewer.title}
          module={selectedModuleForViewer}
          initialTab={viewerInitialTab}
          onRefreshCourse={fetchCourses}
        />
      )}
    </div>
  );
}
