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
  Brain, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  Eye, 
  EyeOff, 
  Loader2, 
  Sparkles, 
  Layers, 
  Clock, 
  Code2, 
  HelpCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import { TrainingSession } from '../types';

export default function AdminTrainingList() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchTrainingSessions();
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .order('title', { ascending: true });
      if (!error && data) {
        setCourses(data);
      }
    } catch (err) {
      console.warn('Erreur récupération des formations:', err);
    }
  };

  const fetchTrainingSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          *,
          courses (id, title),
          training_exercises (id, is_active)
        `)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions((data as any) || []);
    } catch (err: any) {
      console.error('Erreur chargement des sessions d\'entraînement:', err);
      toast.error('Erreur lors du chargement des entraînements : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async (session: TrainingSession) => {
    try {
      setActionLoadingId(session.id);
      const newStatus = !session.is_published;
      const { error } = await supabase
        .from('training_sessions')
        .update({ 
          is_published: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);

      if (error) throw error;

      setSessions(prev =>
        prev.map(s => (s.id === session.id ? { ...s, is_published: newStatus, updated_at: new Date().toISOString() } : s))
      );

      toast.success(newStatus ? 'Entraînement publié avec succès !' : 'Entraînement mis en brouillon.');
    } catch (err: any) {
      toast.error('Erreur lors de la mise à jour : ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (session: TrainingSession) => {
    const confirm1 = window.confirm(`Supprimer cet entraînement ?\n\n« ${session.title} »`);
    if (!confirm1) return;

    const confirm2 = window.confirm('Cette action supprimera également tous les exercices associés.\n\nVoulez-vous vraiment continuer ?');
    if (!confirm2) return;

    try {
      setActionLoadingId(session.id);
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', session.id);

      if (error) throw error;

      setSessions(prev => prev.filter(s => s.id !== session.id));
      toast.success('Entraînement supprimé avec succès.');
    } catch (err: any) {
      toast.error('Erreur lors de la suppression : ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatActivityType = (type: string) => {
    switch (type) {
      case 'quiz_qcm':
        return { label: 'Quiz QCM', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: HelpCircle };
      case 'r_exercise':
        return { label: 'Exercice R', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Code2 };
      case 'mixed':
        return { label: 'Mixte', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Layers };
      default:
        return { label: type, color: 'bg-gray-50 text-gray-700 border-gray-200', icon: Brain };
    }
  };

  const formatDifficulty = (level: string) => {
    switch (level) {
      case 'beginner':
        return { label: 'Débutant', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'intermediate':
        return { label: 'Intermédiaire', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'advanced':
        return { label: 'Avancé', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { label: level, color: 'bg-gray-50 text-gray-700 border-gray-200' };
    }
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = session.title?.toLowerCase().includes(query);
        const matchDesc = session.description?.toLowerCase().includes(query);
        const matchCourse = session.courses?.title?.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchCourse) return false;
      }

      // 2. Course Filter
      if (courseFilter !== 'all') {
        if (courseFilter === 'none') {
          if (session.course_id) return false;
        } else {
          if (session.course_id !== courseFilter) return false;
        }
      }

      // 3. Type Filter
      if (typeFilter !== 'all') {
        if (session.activity_type !== typeFilter) return false;
      }

      // 4. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'published' && !session.is_published) return false;
        if (statusFilter === 'draft' && session.is_published) return false;
      }

      return true;
    });
  }, [sessions, searchQuery, courseFilter, typeFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = sessions.length;
    const published = sessions.filter(s => s.is_published).length;
    const drafts = total - published;
    const totalExercises = sessions.reduce((acc, curr) => {
      const activeArr = (curr.training_exercises as any[]) || [];
      const cnt = activeArr.filter((ex: any) => ex.is_active !== false).length;
      return acc + cnt;
    }, 0);
    return { total, published, drafts, totalExercises };
  }, [sessions]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 font-sans pb-24 w-full">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header with Back Button & New Training CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all flex items-center justify-center shrink-0"
              title="Retour à l'accueil admin"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1 shrink-0">
                  <Brain className="w-3 h-3 text-indigo-600" />
                  Espace Pédagogique
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight mt-1 truncate">
                Centre d'entraînement
              </h1>
              <p className="text-[10px] sm:text-sm text-gray-500 font-medium mt-0.5 truncate sm:whitespace-normal">
                Créez et gérez les exercices interactifs.
              </p>
            </div>
          </div>

          <div className="flex flex-row items-center gap-2 shrink-0">
            <Link
              to="/admin/training/stats"
              className="flex items-center justify-center p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-2xl transition-all shadow-2xs hover:shadow-xs active:scale-95"
              title="Statistiques"
            >
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <span className="hidden lg:inline ml-2 text-sm font-bold">Statistiques</span>
            </Link>

            <Link
              to="/admin/training/new"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-2xl transition-all shadow-md shadow-indigo-200 hover:shadow-lg active:scale-95 whitespace-nowrap"
            >
              <PlusCircle className="w-5 h-5 shrink-0" />
              <span>Nouveau</span>
            </Link>
          </div>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500">Total sessions</p>
              <p className="text-xl font-black text-gray-900">{stats.total}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500">Publiés</p>
              <p className="text-xl font-black text-emerald-600">{stats.published}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500">Brouillons</p>
              <p className="text-xl font-black text-amber-600">{stats.drafts}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500">Exercices créés</p>
              <p className="text-xl font-black text-purple-600">{stats.totalExercises}</p>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-100 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par titre..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>

            {/* Formation Filter */}
            <div className="relative">
              <select
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium text-gray-700"
              >
                <option value="all">Toutes les formations</option>
                <option value="none">Sans formation spécifique</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Activity Type Filter */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium text-gray-700"
              >
                <option value="all">Tous les types d'activité</option>
                <option value="quiz_qcm">Quiz QCM</option>
                <option value="r_exercise">Exercice R</option>
                <option value="mixed">Mixte</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium text-gray-700"
              >
                <option value="all">Tous les statuts</option>
                <option value="published">Publiés uniquement</option>
                <option value="draft">Brouillons uniquement</option>
              </select>
            </div>
          </div>
        </div>

        {/* Training Sessions List */}
        {loading ? (
          <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-semibold text-gray-600">Chargement des entraînements...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          /* Empty State */
          <div className="bg-white p-12 sm:p-16 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Brain className="w-8 h-8" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
              Aucun entraînement créé pour le moment.
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 max-w-md mb-6">
              {searchQuery || courseFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'Aucun résultat ne correspond à vos filtres actuels. Essayez de réinitialiser vos critères de recherche.'
                : 'Créez votre première session d\'exercices interactifs et QCM pour renforcer l\'apprentissage de vos étudiants.'}
            </p>
            {searchQuery || courseFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCourseFilter('all');
                  setTypeFilter('all');
                  setStatusFilter('all');
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
              >
                Réinitialiser les filtres
              </button>
            ) : (
              <Link
                to="/admin/training/new"
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-2xl transition-all shadow-md shadow-indigo-200 hover:shadow-lg"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Créer mon premier entraînement</span>
              </Link>
            )}
          </div>
        ) : (
          /* List of cards */
          <div className="space-y-4">
            {filteredSessions.map(session => {
              const typeConfig = formatActivityType(session.activity_type);
              const difficultyConfig = formatDifficulty(session.difficulty_level);
              const exercisesArr = (session.training_exercises as any[]) || [];
              const exercisesCount = exercisesArr.filter((ex: any) => ex.is_active !== false).length;
              const TypeIcon = typeConfig.icon;
              const isActionLoading = actionLoadingId === session.id;

              return (
                <div
                  key={session.id}
                  className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-5"
                >
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          session.is_published
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            session.is_published ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        {session.is_published ? 'Publié' : 'Brouillon'}
                      </span>

                      {/* Activity Type Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${typeConfig.color}`}
                      >
                        <TypeIcon className="w-3.5 h-3.5" />
                        {typeConfig.label}
                      </span>

                      {/* Difficulty Level Badge */}
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${difficultyConfig.color}`}
                      >
                        {difficultyConfig.label}
                      </span>

                      {/* Exercises Count */}
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        <Layers className="w-3 h-3 text-gray-500" />
                        {exercisesCount} {exercisesCount > 1 ? 'exercices' : 'exercice'}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-lg font-extrabold text-gray-900 tracking-tight leading-snug">
                        {session.title}
                      </h3>
                      {session.description && (
                        <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">
                          {session.description}
                        </p>
                      )}
                    </div>

                    {/* Associated Course & Last Modified */}
                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-500 pt-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>
                          {session.courses?.title ? (
                            <span className="text-gray-800 font-semibold">{session.courses.title}</span>
                          ) : (
                            <span className="text-gray-400 italic">Aucune formation spécifique</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Modifié le {new Date(session.updated_at || session.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 shrink-0">
                    {/* Copy Public Link Button */}
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/training/${session.slug || session.id}`;
                        navigator.clipboard.writeText(link);
                        toast.success('Lien public copié !');
                      }}
                      className="flex-1 sm:flex-none p-2 sm:p-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      title="Copier le lien public"
                    >
                      <Copy className="w-3.5 h-3.5 sm:w-4 h-4" />
                      <span className="sm:inline">Lien</span>
                    </button>

                    {/* Open Public Page */}
                    <a
                      href={`/training/${session.slug || session.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 sm:p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded-xl transition-all active:scale-95"
                      title="Ouvrir la page publique"
                    >
                      <ExternalLink className="w-3.5 h-3.5 sm:w-4 h-4" />
                    </a>

                    {/* Toggle Publish */}
                    <button
                      onClick={() => handleTogglePublish(session)}
                      disabled={isActionLoading}
                      className={`flex-1 sm:flex-none p-2 sm:p-2.5 rounded-xl border text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        session.is_published
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isActionLoading ? (
                        <Loader2 className="w-3.5 h-3.5 sm:w-4 h-4 animate-spin" />
                      ) : session.is_published ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 sm:w-4 h-4" />
                          <span className="sm:inline">Masquer</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 sm:w-4 h-4" />
                          <span className="sm:inline">Publier</span>
                        </>
                      )}
                    </button>

                    {/* Edit Button */}
                    <Link
                      to={`/admin/training/${session.id}`}
                      className="flex-1 sm:flex-none p-2 sm:p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5 sm:w-4 h-4" />
                      <span className="sm:inline">Éditer</span>
                    </Link>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(session)}
                      disabled={isActionLoading}
                      className="p-2 sm:p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition-all active:scale-95"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
