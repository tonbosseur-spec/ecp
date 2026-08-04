import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/Toast';
import { 
  CheckSquare, 
  Calendar as CalendarIcon, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  CheckCircle2, 
  Search, 
  BookOpen, 
  Clock, 
  X, 
  Filter, 
  Layers, 
  Grid,
  CalendarDays,
  AlertTriangle,
  AlertCircle,
  Video,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ModuleSession } from '../types';

interface FlatSession extends ModuleSession {
  courseId: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
}

export default function AdminSessionsDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<FlatSession[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filters & Controls State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [onlyOverdueFilter, setOnlyOverdueFilter] = useState(false);
  const [viewMode, setViewMode] = useState<'status' | 'course' | 'calendar'>('status');

  // Helper to determine if a session's date & time has passed without completion
  const isSessionOverdue = (s: FlatSession) => {
    if (s.isCompleted || !s.date) return false;
    let sessionTime: number;
    if (s.date.includes('T') || s.date.includes(':')) {
      sessionTime = new Date(s.date).getTime();
    } else {
      const d = new Date(s.date);
      d.setHours(23, 59, 59, 999);
      sessionTime = d.getTime();
    }
    return !isNaN(sessionTime) && sessionTime < Date.now();
  };

  // Total overdue count across all loaded sessions
  const totalOverdueCount = useMemo(() => {
    return sessions.filter(isSessionOverdue).length;
  }, [sessions]);

  // Mini-Calendar State
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: courses, error } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          course_modules (
            id,
            title,
            download_files
          )
        `)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const allSessions: FlatSession[] = [];
      courses?.forEach(course => {
        course.course_modules?.forEach(mod => {
          const modFiles = mod.download_files || [];
          const modSessions = modFiles.filter((f: any) => f.type === 'session') as ModuleSession[];
          modSessions.forEach(s => {
            allSessions.push({
              ...s,
              courseId: course.id,
              courseTitle: course.title,
              moduleId: mod.id,
              moduleTitle: mod.title
            });
          });
        });
      });

      // Sort by date (closest first)
      allSessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setSessions(allSessions);
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur lors du chargement des séances: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSessionCompletion = async (session: FlatSession) => {
    try {
      setUpdatingId(session.id);
      
      // Fetch current module to ensure we don't overwrite other changes
      const { data: mod, error: fetchError } = await supabase
        .from('course_modules')
        .select('download_files')
        .eq('id', session.moduleId)
        .single();
        
      if (fetchError) throw fetchError;
      
      const files = mod.download_files || [];
      const updatedFiles = files.map((f: any) => {
        if (f.type === 'session' && f.id === session.id) {
          return { ...f, isCompleted: !session.isCompleted };
        }
        return f;
      });
      
      const { error: updateError } = await supabase
        .from('course_modules')
        .update({ download_files: updatedFiles })
        .eq('id', session.moduleId);
        
      if (updateError) throw updateError;
      
      // Update local state
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, isCompleted: !s.isCompleted } : s));
      
    } catch (err: any) {
      toast.error("Erreur lors de la mise à jour : " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Unique list of courses for filter dropdown
  const uniqueCourses = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach(s => map.set(s.courseId, s.courseTitle));
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [sessions]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      // Search match
      const query = searchQuery.toLowerCase().trim();
      const matchesQuery = !query || 
        s.name.toLowerCase().includes(query) ||
        s.courseTitle.toLowerCase().includes(query) ||
        s.moduleTitle.toLowerCase().includes(query) ||
        (s.objectives && s.objectives.some(o => o.toLowerCase().includes(query)));

      // Course match
      const matchesCourse = selectedCourseFilter === 'ALL' || s.courseId === selectedCourseFilter;

      // Date match
      const sessionDateOnly = s.date ? s.date.substring(0, 10) : '';
      const matchesDate = !selectedDateFilter || sessionDateOnly === selectedDateFilter;

      // Overdue match
      const matchesOverdue = !onlyOverdueFilter || isSessionOverdue(s);

      return matchesQuery && matchesCourse && matchesDate && matchesOverdue;
    });
  }, [sessions, searchQuery, selectedCourseFilter, selectedDateFilter, onlyOverdueFilter]);

  // Map of sessions by date string (YYYY-MM-DD) for calendar
  const sessionsByDateMap = useMemo(() => {
    const map = new Map<string, FlatSession[]>();
    sessions.forEach(s => {
      const dateKey = s.date ? s.date.substring(0, 10) : '';
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(s);
    });
    return map;
  }, [sessions]);

  // Helper to format date & time for admin cards
  const formatAdminSessionDateTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const hasTime = dateStr.includes('T') || dateStr.includes(':');
    const dateFormatted = d.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
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

  // Grouped by course
  const sessionsGroupedByCourse = useMemo(() => {
    const map = new Map<string, { courseTitle: string; courseId: string; sessions: FlatSession[] }>();
    filteredSessions.forEach(s => {
      if (!map.has(s.courseId)) {
        map.set(s.courseId, { courseTitle: s.courseTitle, courseId: s.courseId, sessions: [] });
      }
      map.get(s.courseId)!.sessions.push(s);
    });
    return Array.from(map.values());
  }, [filteredSessions]);

  // Calendar calculations
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth(); // 0-indexed

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Day of week for first day (0 = Sunday, transform to 0 = Monday)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days = [];
    
    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const pDate = new Date(year, month - 1, pDay);
      const dateStr = pDate.toISOString().split('T')[0];
      days.push({
        date: pDate,
        dateStr,
        dayNum: pDay,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
      const cDate = new Date(year, month, d);
      // Format YYYY-MM-DD local
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      
      days.push({
        date: cDate,
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill grid (35 or 42 cells)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let n = 1; n <= remaining; n++) {
      const nDate = new Date(year, month + 1, n);
      const dateStr = nDate.toISOString().split('T')[0];
      days.push({
        date: nDate,
        dateStr,
        dayNum: n,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [calendarMonth]);

  const prevMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const upcomingSessions = filteredSessions.filter(s => !s.isCompleted);
  const completedSessions = filteredSessions.filter(s => s.isCompleted);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Alert Banner for Unvalidated Overdue Sessions */}
      {totalOverdueCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-red-500 to-rose-600 text-white p-4 rounded-3xl shadow-md border border-red-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30">
              <AlertTriangle className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white text-red-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider shadow-xs">
                  Alerte Formateur
                </span>
                <span className="text-xs font-bold text-red-100">
                  {totalOverdueCount} séance{totalOverdueCount > 1 ? 's' : ''} en attente
                </span>
              </div>
              <p className="text-sm font-bold text-white mt-0.5">
                L'horaire de {totalOverdueCount === 1 ? "cette séance" : "ces séances"} est passé. Veuillez valider la présence des apprenants !
              </p>
            </div>
          </div>

          <button
            onClick={() => setOnlyOverdueFilter(!onlyOverdueFilter)}
            className={`shrink-0 text-xs font-black px-4 py-2.5 rounded-2xl transition-all shadow-sm ${
              onlyOverdueFilter
                ? 'bg-white text-slate-900 hover:bg-slate-100 ring-2 ring-white/50'
                : 'bg-red-950/40 text-white hover:bg-red-950/60 border border-white/30'
            }`}
          >
            {onlyOverdueFilter ? "Afficher toutes les séances" : "🔴 Filtrer les retardataires"}
          </button>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all flex items-center justify-center shrink-0 border border-slate-200 hover:border-slate-300 group"
            title="Retour au tableau de bord"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <CalendarDays className="w-8 h-8 text-orange-500" />
              Tableau de Bord des Séances
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Suivez, organisez et cochez les séances programmées pour vos formations.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/live')}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-md shadow-indigo-600/20 transition-all"
          >
            <Video className="w-4 h-4" />
            <span>Créer / Lancer un Live</span>
          </button>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setViewMode('status')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
              viewMode === 'status'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-orange-500" />
            Par Statut
          </button>
          <button
            onClick={() => setViewMode('course')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
              viewMode === 'course'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-600" />
            Par Formation
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
              viewMode === 'calendar'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarIcon className="w-4 h-4 text-emerald-600" />
            Calendrier
          </button>
        </div>
      </div>
    </div>

      {/* Search Bar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Field */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une séance, module, formation ou objectif..."
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter by Course */}
          <div className="md:col-span-4 relative">
            <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all appearance-none cursor-pointer"
            >
              <option value="ALL">Toutes les formations ({uniqueCourses.length})</option>
              {uniqueCourses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.title.length > 40 ? course.title.substring(0, 40) + '...' : course.title}
                </option>
              ))}
            </select>
          </div>

          {/* Overdue Filter Button */}
          <div className="md:col-span-3 flex items-center gap-2 justify-end">
            <button
              onClick={() => setOnlyOverdueFilter(!onlyOverdueFilter)}
              className={`w-full py-2.5 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                onlyOverdueFilter
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : totalOverdueCount > 0
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 font-extrabold'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${totalOverdueCount > 0 ? 'bg-red-500 animate-ping' : 'bg-slate-400'}`} />
              <span>Retards / Non validées ({totalOverdueCount})</span>
            </button>

            {(selectedDateFilter || searchQuery || selectedCourseFilter !== 'ALL' || onlyOverdueFilter) && (
              <button
                onClick={() => {
                  setSelectedDateFilter(null);
                  setSearchQuery('');
                  setSelectedCourseFilter('ALL');
                  setOnlyOverdueFilter(false);
                }}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shrink-0"
                title="Réinitialiser tous les filtres"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Date Filter Tag if selected */}
        {selectedDateFilter && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-slate-500 font-medium">Filtre date active :</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-800 font-bold text-xs rounded-lg border border-orange-200">
              <CalendarIcon className="w-3.5 h-3.5" />
              {new Date(selectedDateFilter).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
              <button 
                onClick={() => setSelectedDateFilter(null)}
                className="hover:text-red-600 ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Main View Content */}
      <AnimatePresence mode="wait">
        {/* VIEW 1: BY STATUS */}
        {viewMode === 'status' && (
          <motion.div 
            key="status-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Prochaines Séances */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center justify-between text-slate-800">
                <span className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  A venir ({upcomingSessions.length})
                </span>
                {totalOverdueCount > 0 && (
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    {totalOverdueCount} présence(s) non validée(s)
                  </span>
                )}
              </h2>
              
              <div className="space-y-3">
                {upcomingSessions.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
                    <p className="text-slate-500 text-sm">Aucune séance à venir avec les filtres actuels.</p>
                  </div>
                ) : (
                  upcomingSessions.map(session => {
                    const isOverdue = isSessionOverdue(session);

                    return (
                      <motion.div 
                        key={session.id} 
                        className={`border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all ${
                          isOverdue 
                            ? 'bg-red-50/40 border-red-300 ring-2 ring-red-500/20' 
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                                {session.name}
                              </span>
                              
                              {/* PASTILLE ROUGE D'ALERTE HORAIRE PASSÉ */}
                              {isOverdue && (
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-red-600 text-white shadow-xs animate-pulse">
                                  <AlertCircle className="w-3 h-3" />
                                  Présence non validée (Horaire dépassé)
                                </span>
                              )}

                              <span className={`text-xs font-semibold ${isOverdue ? 'text-red-700 font-bold' : 'text-slate-500'}`}>
                                {formatAdminSessionDateTime(session.date)}
                              </span>
                            </div>

                            <h3 className="font-bold text-slate-900 text-base">{session.courseTitle}</h3>
                            <p className="text-xs font-medium text-purple-700 flex items-center gap-1">
                              <ChevronRight className="w-3 h-3" /> {session.moduleTitle}
                            </p>
                            
                            {session.objectives && session.objectives.length > 0 && (
                              <div className="mt-3 pt-2 border-t border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Objectifs</p>
                                <ul className="text-xs text-slate-600 space-y-1 pl-4 list-disc">
                                  {session.objectives.map((obj, idx) => (
                                    <li key={idx}>{obj}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          
                          <button
                            onClick={() => toggleSessionCompletion(session)}
                            disabled={updatingId === session.id}
                            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                              isOverdue
                                ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm animate-pulse'
                                : 'bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 border border-slate-200 hover:border-emerald-200'
                            }`}
                            title={isOverdue ? "Valider la présence pour cette séance" : "Marquer comme réalisée"}
                          >
                            {updatingId === session.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{isOverdue ? "Valider présence" : "Valider"}</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">Impact module</span>
                          <span className="text-xs font-bold text-orange-600">+{session.completionPercent}%</span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Séances Terminées */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center justify-between text-slate-800">
                <span className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-emerald-600" />
                  Réalisées ({completedSessions.length})
                </span>
              </h2>
              
              <div className="space-y-3">
                {completedSessions.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
                    <p className="text-slate-500 text-sm">Aucune séance réalisée pour le moment.</p>
                  </div>
                ) : (
                  completedSessions.map(session => (
                    <div key={session.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            {session.name}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            {formatAdminSessionDateTime(session.date)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-800 text-sm">{session.courseTitle}</h3>
                        <p className="text-xs text-slate-500">{session.moduleTitle}</p>
                      </div>
                      <button
                        onClick={() => toggleSessionCompletion(session)}
                        disabled={updatingId === session.id}
                        className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 underline"
                      >
                        Réactiver
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 2: BY COURSE */}
        {viewMode === 'course' && (
          <motion.div 
            key="course-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {sessionsGroupedByCourse.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-12 text-center">
                <p className="text-slate-500">Aucune formation ne correspond aux critères de recherche.</p>
              </div>
            ) : (
              sessionsGroupedByCourse.map(group => {
                const totalInGroup = group.sessions.length;
                const completedInGroup = group.sessions.filter(s => s.isCompleted).length;
                const percentDone = Math.round((completedInGroup / totalInGroup) * 100) || 0;

                return (
                  <div key={group.courseId} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                    {/* Course Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-black uppercase text-purple-600 tracking-wider">Formation</span>
                        <h3 className="text-lg font-bold text-slate-900">{group.courseTitle}</h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-700">{completedInGroup} / {totalInGroup} séances</p>
                          <p className="text-[10px] text-slate-400 font-medium">{percentDone}% réalisé</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center font-bold text-purple-700 text-xs border border-purple-100">
                          {percentDone}%
                        </div>
                      </div>
                    </div>

                    {/* Sessions Grid for this course */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.sessions.map(session => {
                        const isOverdue = isSessionOverdue(session);

                        return (
                          <div 
                            key={session.id} 
                            className={`p-4 rounded-2xl border transition-all ${
                              session.isCompleted 
                                ? 'bg-emerald-50/50 border-emerald-100' 
                                : isOverdue
                                ? 'bg-red-50/40 border-red-300 ring-1 ring-red-400'
                                : 'bg-white border-slate-200 hover:border-orange-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    session.isCompleted 
                                      ? 'bg-emerald-100 text-emerald-700' 
                                      : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    {session.name}
                                  </span>

                                  {/* Pastille Rouge Alert */}
                                  {isOverdue && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                                      <AlertCircle className="w-3 h-3" />
                                      Présence non validée
                                    </span>
                                  )}

                                  <span className="text-xs font-medium text-slate-500">
                                    {formatAdminSessionDateTime(session.date)}
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-slate-800">{session.moduleTitle}</p>
                                
                                {session.objectives && session.objectives.length > 0 && (
                                  <ul className="text-xs text-slate-600 mt-2 space-y-0.5 pl-4 list-disc">
                                    {session.objectives.map((obj, idx) => (
                                      <li key={idx}>{obj}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>

                              <button
                                onClick={() => toggleSessionCompletion(session)}
                                disabled={updatingId === session.id}
                                className={`p-2 rounded-xl transition-colors ${
                                  session.isCompleted
                                    ? 'text-emerald-600 hover:bg-emerald-100'
                                    : isOverdue
                                    ? 'text-white bg-red-600 hover:bg-red-700 shadow-xs'
                                    : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'
                                }`}
                                title={isOverdue ? "Valider la présence" : "Marquer comme réalisée"}
                              >
                                <CheckCircle2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        {/* VIEW 3: FULL CALENDAR GRID */}
        {viewMode === 'calendar' && (
          <motion.div 
            key="calendar-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-orange-500" />
                {calendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase()} ({filteredSessions.length} séances)
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevMonth}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                  title="Mois précédent"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCalendarMonth(new Date())}
                  className="text-xs font-bold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                  Aujourd'hui
                </button>
                <button
                  onClick={nextMonth}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                  title="Mois suivant"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-2 text-center">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                <div key={day} className="text-[11px] font-bold text-slate-400 uppercase py-1">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
              {calendarDays.map((cell, idx) => {
                const daySessions = sessionsByDateMap.get(cell.dateStr) || [];
                const isToday = new Date().toISOString().split('T')[0] === cell.dateStr;
                const hasOverdueInDay = daySessions.some(isSessionOverdue);

                return (
                  <div
                    key={idx}
                    className={`min-h-[110px] p-2.5 rounded-2xl border flex flex-col justify-between transition-all ${
                      hasOverdueInDay
                        ? 'bg-red-50/50 border-red-300 ring-1 ring-red-300'
                        : !cell.isCurrentMonth
                        ? 'bg-slate-50/40 border-slate-100 text-slate-300'
                        : isToday
                        ? 'bg-purple-50/60 border-purple-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs ${isToday ? 'font-black text-purple-700 bg-purple-200 px-1.5 py-0.5 rounded-md' : 'font-bold text-slate-700'}`}>
                        {cell.dayNum}
                      </span>
                      {daySessions.length > 0 && (
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                          hasOverdueInDay ? 'bg-red-600 text-white animate-pulse' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {daySessions.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 flex-1 overflow-y-auto max-h-[80px]">
                      {daySessions.map(s => {
                        const isOverdue = isSessionOverdue(s);

                        return (
                          <div
                            key={s.id}
                            onClick={() => toggleSessionCompletion(s)}
                            className={`p-1.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors ${
                              s.isCompleted
                                ? 'bg-emerald-100 text-emerald-800 line-through opacity-70'
                                : isOverdue
                                ? 'bg-red-600 text-white font-bold animate-pulse shadow-2xs'
                                : 'bg-orange-100 text-orange-900 hover:bg-orange-200'
                            }`}
                            title={`${s.courseTitle} - ${s.name} ${isOverdue ? '(Présence non validée - Horaire dépassé)' : ''}`}
                          >
                            <div className="truncate font-bold flex items-center justify-between">
                              <span>{s.name}</span>
                              {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                            </div>
                            <div className={`truncate text-[9px] ${isOverdue ? 'text-red-100' : 'text-slate-600'}`}>
                              {s.courseTitle}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
