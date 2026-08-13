import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Video, 
  Calendar, 
  Clock, 
  Users, 
  Plus, 
  Play, 
  CheckCircle2, 
  Copy, 
  Check, 
  Sparkles, 
  Search, 
  Filter, 
  ChevronRight, 
  Shield, 
  BookOpen, 
  ArrowLeft,
  Lock,
  Globe,
  Loader2,
  Trash2,
  ExternalLink,
  Share2,
  Edit3
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { fetchLiveSessions, deleteLiveSession, LiveSession } from '../lib/liveService';
import CreateLiveModal from '../components/live/CreateLiveModal';
import EditLiveModal from '../components/live/EditLiveModal';

export default function LiveDashboard() {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'ended'>('all');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [isTrainer, setIsTrainer] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [approvedCourseIds, setApprovedCourseIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSessions();
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || null);
        const isSuperAdmin = session.user.email === 'pmbom@ecp.cm';

        // Query client_profiles for role
        const { data: profile } = await supabase
          .from('client_profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        const userRole = profile?.role || 'client';
        const isAdmin = isSuperAdmin || userRole === 'admin';
        const isTrainerUser = isAdmin || userRole === 'trainer';

        setIsTrainer(isTrainerUser);

        if (!isAdmin) {
          // Fetch user's approved course registrations
          const { data: regs } = await supabase
            .from('registrations')
            .select('course_id')
            .eq('client_id', session.user.id)
            .eq('payment_status', 'approved');

          if (regs && regs.length > 0) {
            setApprovedCourseIds(new Set(regs.map((r: any) => r.course_id)));
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await fetchLiveSessions();
      setSessions(data);
    } catch (err) {
      console.error('Erreur chargement sessions live:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionCreated = (newSession: LiveSession) => {
    setSessions((prev) => [newSession, ...prev]);
  };

  const handleCopyLink = (roomCode: string, id: string) => {
    const fullLink = `${window.location.origin}/live/session/${roomCode}`;
    navigator.clipboard.writeText(fullLink);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleDeleteSession = async (session: LiveSession, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Voulez-vous vraiment supprimer cette séance live ? Cette action est irréversible.')) {
      return;
    }
    try {
      await deleteLiveSession(session.id, session.room_code);
      setSessions((prev) => prev.filter((s) => s.id !== session.id && s.room_code !== session.room_code));
    } catch (err) {
      console.error('Erreur lors de la suppression de la session:', err);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    // If client (non-trainer/admin), show public sessions OR sessions for courses the client is enrolled in
    if (!isTrainer) {
      const isPublicSession = !s.course_id || !s.is_private;
      const isEnrolledCourseSession = Boolean(s.course_id && approvedCourseIds.has(s.course_id));

      if (!isPublicSession && !isEnrolledCourseSession) {
        return false;
      }
    }

    const matchesSearch = 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.course_title && s.course_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.trainer_name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'upcoming') {
      return s.status === 'scheduled' || s.status === 'live';
    }
    if (statusFilter === 'ended') {
      return s.status === 'ended';
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20 pt-safe">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Espace Live</h1>
              <p className="text-xs text-slate-500 font-medium">Visioconférence pour petits groupes (5 à 6 max)</p>
            </div>
          </div>

          {isTrainer && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Créer un Live</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Banner callout */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-8 -translate-y-8">
            <Video className="w-64 h-64 text-white" />
          </div>
          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-indigo-200 border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Module Visioconférence Exceller Chez Pierre
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Sessions en direct & coaching de groupe
            </h2>
            <p className="text-indigo-100 text-sm leading-relaxed">
              Rejoignez vos sessions programmées directement sur la plateforme. Partage d'écran, levée de main et chat intégrés.
            </p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-96 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une session, un cours ou formateur..."
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 w-full md:w-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Toutes ({sessions.length})
            </button>
            <button
              onClick={() => setStatusFilter('upcoming')}
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                statusFilter === 'upcoming'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              À venir / En cours ({sessions.filter((s) => s.status !== 'ended').length})
            </button>
            <button
              onClick={() => setStatusFilter('ended')}
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                statusFilter === 'ended'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Terminées ({sessions.filter((s) => s.status === 'ended').length})
            </button>
          </div>
        </div>

        {/* Sessions List */}
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 mx-auto">
              <Video className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Aucune session Live trouvée</h3>
              <p className="text-xs text-slate-500 mt-1">
                Aucune séance programmée ne correspond aux filtres actuels.
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-2xl shadow-md hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Programmer une séance</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredSessions.map((session) => {
              const isEnded = session.status === 'ended';
              const isLiveNow = session.status === 'live';
              const startDate = new Date(session.scheduled_at);

              return (
                <div
                  key={session.id}
                  className={`bg-white border rounded-3xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-5 ${
                    isLiveNow
                      ? 'border-red-300 ring-2 ring-red-500/20 bg-gradient-to-b from-red-50/20 to-white'
                      : 'border-slate-200/80'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Top Status & Code Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          isLiveNow
                            ? 'bg-red-100 text-red-700 border border-red-200 animate-pulse'
                            : isEnded
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isLiveNow ? 'bg-red-600' : isEnded ? 'bg-slate-400' : 'bg-indigo-600'
                          }`}
                        />
                        <span>
                          {isLiveNow ? '🔴 EN DIRECT' : isEnded ? 'Terminé' : 'À venir'}
                        </span>
                      </span>

                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
                        {session.room_code}
                      </span>
                    </div>

                    {/* Course Title */}
                    <div>
                      {session.course_title && (
                        <span className="text-[11px] font-extrabold uppercase text-indigo-600 tracking-wider block mb-1">
                          {session.course_title}
                        </span>
                      )}
                      <h3 className="text-lg font-black text-slate-900 leading-snug">
                        {session.title}
                      </h3>
                      {session.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                          {session.description}
                        </p>
                      )}
                    </div>

                    {/* Meta info (Date, Time, Duration, Participants) */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 font-semibold">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>
                          {startDate.toLocaleDateString('fr-FR', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-700 font-semibold">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>
                          {startDate.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          ({session.duration_minutes} min)
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">{session.trainer_name}</span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <Users className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>
                          {session.participant_count || 0} / {session.max_participants || 6} places
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => navigate(`/live/session/${session.room_code}`)}
                        className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors text-xs font-bold flex items-center gap-1.5"
                        title="Voir la page publique"
                      >
                        <ExternalLink className="w-4 h-4 text-indigo-600" />
                        <span className="hidden sm:inline">Page publique</span>
                      </button>

                      <button
                        onClick={() => handleCopyLink(session.room_code, session.id)}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5"
                        title="Copier le lien public"
                      >
                        {copiedCodeId === session.id ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span className="text-emerald-700 font-bold hidden sm:inline">Lien copié</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span className="hidden sm:inline">Copier lien</span>
                          </>
                        )}
                      </button>

                      {isTrainer && (
                        <>
                          <button
                            onClick={() => {
                              setEditingSession(session);
                              setIsEditModalOpen(true);
                            }}
                            className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1"
                            title="Modifier la séance"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteSession(session, e)}
                            className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1"
                            title="Supprimer la séance"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>

                    {(() => {
                      const maxLimit = session.max_participants || 6;
                      const isFull = !isTrainer && (session.participant_count || 0) >= maxLimit;

                      return (
                        <button
                          onClick={() => navigate(`/live/${session.room_code}`)}
                          disabled={isEnded || isFull}
                          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md ${
                            isEnded || isFull
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                              : isLiveNow
                              ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30 animate-pulse'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>
                            {isEnded 
                              ? 'Session terminée' 
                              : isFull 
                              ? 'Session complète' 
                              : 'Rejoindre le live'}
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal for creating a live session */}
      <CreateLiveModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSessionCreated={handleSessionCreated}
      />

      {/* Modal for editing a live session */}
      <EditLiveModal
        session={editingSession}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingSession(null);
        }}
        onSessionUpdated={(updated) => {
          setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        }}
      />
    </div>
  );
}
