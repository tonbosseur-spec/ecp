import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/Toast';
import { 
  ArrowLeft, 
  PlusCircle, 
  Search, 
  Filter, 
  BookOpen, 
  Sparkles, 
  Clock, 
  Layers, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  Calendar,
  Image as ImageIcon,
  Tag,
  GraduationCap
} from 'lucide-react';
import { InteractiveCourse, InteractiveCourseStatus, InteractiveCourseCategory } from '../types';

export default function AdminInteractiveCourseList() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [courses, setCourses] = useState<InteractiveCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Deletion modal state
  const [courseToDelete, setCourseToDelete] = useState<InteractiveCourse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchInteractiveCourses();
  }, []);

  const fetchInteractiveCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('interactive_courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (err: any) {
      console.error('Erreur chargement cours interactifs:', err);
      toast.error('Erreur lors du chargement des cours : ' + (err?.message || 'Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (course: InteractiveCourse) => {
    try {
      setActionLoadingId(course.id);
      const nextStatus: InteractiveCourseStatus = course.status === 'published' ? 'draft' : 'published';

      const { error } = await supabase
        .from('interactive_courses')
        .update({
          status: nextStatus,
          published_at: nextStatus === 'published' ? new Date().toISOString() : course.published_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', course.id);

      if (error) throw error;

      setCourses(prev =>
        prev.map(c => (c.id === course.id ? { ...c, status: nextStatus } : c))
      );

      toast.success(
        nextStatus === 'published' 
          ? `✓ Le cours "${course.title}" est maintenant publié.` 
          : `Le cours "${course.title}" a été repassé en brouillon.`
      );
    } catch (err: any) {
      console.error('Erreur changement statut:', err);
      toast.error('Impossible de modifier le statut : ' + (err?.message || 'Erreur'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('interactive_courses')
        .delete()
        .eq('id', courseToDelete.id);

      if (error) throw error;

      setCourses(prev => prev.filter(c => c.id !== courseToDelete.id));
      toast.success(`✓ Le cours "${courseToDelete.title}" a été supprimé.`);
      setCourseToDelete(null);
    } catch (err: any) {
      console.error('Erreur suppression cours:', err);
      toast.error('Impossible de supprimer ce cours : ' + (err?.message || 'Erreur'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = course.title?.toLowerCase().includes(q);
        const matchesDesc = course.description?.toLowerCase().includes(q);
        const matchesSlug = course.slug?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesSlug) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && course.status !== statusFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && course.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [courses, searchQuery, statusFilter, categoryFilter]);

  const stats = useMemo(() => {
    return {
      total: courses.length,
      published: courses.filter(c => c.status === 'published').length,
      draft: courses.filter(c => c.status === 'draft').length,
      archived: courses.filter(c => c.status === 'archived').length,
    };
  }, [courses]);

  const stripHtmlOrMarkdown = (text?: string | null): string => {
    if (!text) return '';
    return text.replace(/<[^>]*>?/gm, '').replace(/[#*_~`]/g, '').trim();
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-2 px-3 sm:px-6 lg:px-8 font-sans pb-24 w-full">
      <div className="max-w-6xl w-full mx-auto space-y-6">

        {/* 1. Header with Title & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all flex items-center justify-center shrink-0"
              title="Retour à l'accueil admin"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-sky-50 text-sky-700 border border-sky-100">
                  Administration
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                  {stats.total} cours au total
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight mt-1">
                Cours interactifs
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                Créez et gérez vos cours en ligne interactifs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              to="/admin/interactive-courses/new"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 text-sm"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Nouveau cours</span>
            </Link>
          </div>
        </div>

        {/* 2. Quick Status Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`p-3 sm:p-4 rounded-2xl border text-left transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-gray-700 border-gray-100 hover:bg-gray-50 shadow-xs'
            }`}
          >
            <span className="text-xs font-semibold block opacity-80">Tous les cours</span>
            <span className="text-lg sm:text-xl font-black mt-0.5 block">{stats.total}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('published')}
            className={`p-3 sm:p-4 rounded-2xl border text-left transition-all ${
              statusFilter === 'published'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-gray-700 border-gray-100 hover:bg-gray-50 shadow-xs'
            }`}
          >
            <span className="text-xs font-semibold block opacity-80">Publiés</span>
            <span className="text-lg sm:text-xl font-black mt-0.5 block text-emerald-600 group-hover:text-emerald-700">
              {stats.published}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('draft')}
            className={`p-3 sm:p-4 rounded-2xl border text-left transition-all ${
              statusFilter === 'draft'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-white text-gray-700 border-gray-100 hover:bg-gray-50 shadow-xs'
            }`}
          >
            <span className="text-xs font-semibold block opacity-80">Brouillons</span>
            <span className="text-lg sm:text-xl font-black mt-0.5 block text-amber-600">
              {stats.draft}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('archived')}
            className={`p-3 sm:p-4 rounded-2xl border text-left transition-all ${
              statusFilter === 'archived'
                ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                : 'bg-white text-gray-700 border-gray-100 hover:bg-gray-50 shadow-xs'
            }`}
          >
            <span className="text-xs font-semibold block opacity-80">Archivés</span>
            <span className="text-lg sm:text-xl font-black mt-0.5 block text-slate-500">
              {stats.archived}
            </span>
          </button>
        </div>

        {/* 3. Search & Category Bar */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher par titre ou mot-clé..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="w-full sm:w-56">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                aria-label="Filtrer par catégorie"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              >
                <option value="all">Toutes les catégories</option>
                <option value="R">R</option>
                <option value="Excel">Excel</option>
                <option value="Power BI">Power BI</option>
                <option value="SQL">SQL</option>
                <option value="Python">Python</option>
                <option value="DAX">DAX</option>
                <option value="General">Général</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4. Course List / Grid */}
        {loading ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
            <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">Chargement des cours interactifs...</p>
          </div>
        ) : courses.length === 0 ? (
          /* Empty State : aucun cours */
          <div className="bg-white rounded-3xl border border-gray-100 p-8 sm:p-12 text-center shadow-sm max-w-lg mx-auto">
            <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8" />
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-2">
              Vous n'avez encore créé aucun cours interactif.
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mb-6 leading-relaxed">
              Commencez dès maintenant par créer votre premier cours avec son titre, sa description et ses paramètres.
            </p>
            <Link
              to="/admin/interactive-courses/new"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl shadow-sm transition-all active:scale-95 text-sm"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Créer mon premier cours</span>
            </Link>
          </div>
        ) : filteredCourses.length === 0 ? (
          /* Empty State : aucun résultat pour le filtre */
          <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center shadow-sm">
            <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <h3 className="text-base font-bold text-gray-900">Aucun cours ne correspond à vos filtres</h3>
            <p className="text-xs text-gray-500 mt-1 mb-4">Essayez de réinitialiser la recherche ou le statut sélectionné.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setCategoryFilter('all');
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          /* Grid of interactive course cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCourses.map(course => {
              const isActionLoading = actionLoadingId === course.id;
              const shortDesc = stripHtmlOrMarkdown(course.description);
              const formattedDate = course.created_at
                ? new Date(course.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })
                : '-';

              return (
                <div
                  key={course.id}
                  className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  {/* Top Cover / Header */}
                  <div>
                    <div className="relative aspect-video w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                      {course.cover_image ? (
                        <img
                          src={course.cover_image}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center text-slate-500 p-4">
                          <BookOpen className="w-10 h-10 text-sky-400/60 mb-1" />
                          <span className="text-[11px] font-medium text-slate-400">Exceller chez Pierre</span>
                        </div>
                      )}

                      {/* Status Badge */}
                      <div className="absolute top-3 left-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md shadow-sm ${
                            course.status === 'published'
                              ? 'bg-emerald-500 text-white'
                              : course.status === 'draft'
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-700 text-white'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          <span>
                            {course.status === 'published'
                              ? 'Publié'
                              : course.status === 'draft'
                              ? 'Brouillon'
                              : 'Archivé'}
                          </span>
                        </span>
                      </div>

                      {/* Category & Level Badges */}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-lg border border-white/10">
                          {course.category}
                        </span>
                        <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-slate-200 text-[10px] font-bold rounded-lg border border-white/10">
                          {course.level === 'beginner'
                            ? 'Débutant'
                            : course.level === 'intermediate'
                            ? 'Intermédiaire'
                            : 'Avancé'}
                        </span>
                      </div>
                    </div>

                    {/* Content Details */}
                    <div className="p-5">
                      <h2 className="text-base sm:text-lg font-bold text-gray-900 line-clamp-2 mb-2 group-hover:text-sky-600 transition-colors">
                        {course.title}
                      </h2>

                      {shortDesc ? (
                        <p className="text-xs sm:text-sm text-gray-500 line-clamp-2 leading-relaxed mb-4">
                          {shortDesc}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 italic mb-4">Aucune description renseignée.</p>
                      )}

                      {/* Metadata Row */}
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{course.estimated_duration || 0} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>Créé le {formattedDate}</span>
                        </div>
                      </div>

                      {/* Primary Action : Gérer le contenu */}
                      <div className="mt-4 pt-1">
                        <Link
                          to={`/admin/interactive-courses/${course.id}/content`}
                          className="w-full py-2.5 px-4 bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-800 border border-sky-200 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-2xs group/btn active:scale-98"
                        >
                          <Layers className="w-4 h-4 text-sky-600 group-hover/btn:scale-110 transition-transform" />
                          <span>Gérer le contenu (Modules & Leçons)</span>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-3.5 bg-gray-50/80 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    {/* Public preview link if published */}
                    {course.status === 'published' && (
                      <Link
                        to={`/client/interactive-course/${course.slug || course.id}`}
                        target="_blank"
                        className="p-2 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-colors shrink-0"
                        title="Aperçu côté apprenant"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    )}

                    <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
                      {/* Publish / Unpublish Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(course)}
                        disabled={isActionLoading}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          course.status === 'published'
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                        title={course.status === 'published' ? 'Dépublier le cours' : 'Publier le cours'}
                      >
                        {isActionLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : course.status === 'published' ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Dépublier</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Publier</span>
                          </>
                        )}
                      </button>

                      {/* Edit Button */}
                      <Link
                        to={`/admin/interactive-courses/${course.id}/edit`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-800 border border-gray-200 rounded-xl text-xs font-bold shadow-2xs transition-colors"
                        title="Modifier les informations générales"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                        <span>Modifier</span>
                      </Link>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setCourseToDelete(course)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                        title="Supprimer ce cours"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Delete Confirmation Modal */}
      {courseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 overflow-hidden border border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
              Supprimer ce cours ?
            </h3>

            <p className="text-sm font-semibold text-gray-800 text-center mb-1">
              "{courseToDelete.title}"
            </p>

            <p className="text-xs text-gray-500 text-center leading-relaxed mb-6">
              Cette action supprimera également son contenu lorsque nous aurons ajouté les modules, leçons et activités.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCourseToDelete(null)}
                disabled={isDeleting}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleDeleteCourse}
                disabled={isDeleting}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <span>Supprimer</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
