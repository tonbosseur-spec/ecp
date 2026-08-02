import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchLiveSessionByCode, LiveSession } from '../lib/liveService';
import { supabase } from '../lib/supabaseClient';
import Footer from '../components/Footer';
import { 
  Video, 
  Calendar, 
  Clock, 
  User, 
  Users, 
  Play, 
  Share2, 
  Check, 
  ChevronLeft, 
  Sparkles, 
  ShieldCheck,
  BookOpen,
  Lock,
  Globe,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';

function formatDescriptionHtml(text: string | null | undefined): string {
  if (!text) return '<p className="italic text-slate-400">Aucune description disponible pour cette séance.</p>';
  const hasHtml = /<[a-z][\s\S]*>/i.test(text);
  if (hasHtml) {
    return text;
  }
  return text
    .split('\n\n')
    .map(p => `<p class="mb-4 leading-relaxed text-slate-700">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export default function PublicLiveSessionPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [userStatus, setUserStatus] = useState<{ isLoggedIn: boolean; isAdmin: boolean }>({
    isLoggedIn: false,
    isAdmin: false
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      if (authSession?.user) {
        setUserStatus({
          isLoggedIn: true,
          isAdmin: authSession.user.email === 'pmbom@ecp.cm'
        });
      }
    });

    if (roomCode) {
      loadSessionData(roomCode);
    }
  }, [roomCode]);

  const loadSessionData = async (code: string) => {
    setLoading(true);
    try {
      const data = await fetchLiveSessionByCode(code);
      setSession(data);
    } catch (err) {
      console.error('Erreur chargement session live:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-600">Chargement de la séance live...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <div className="max-w-xl mx-auto my-auto px-6 py-16 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Séance live introuvable</h1>
          <p className="text-slate-600 mb-8 text-sm">
            La séance demandée n'existe pas ou le code de la salle est incorrect.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all inline-flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Retourner à l'accueil</span>
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const scheduledDate = new Date(session.scheduled_at);
  const formattedDate = scheduledDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const formattedTime = scheduledDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const isLiveNow = session.status === 'live';
  const isEnded = session.status === 'ended';
  const maxPlaces = session.max_participants || 6;
  const currentParticipants = session.participant_count || 0;
  const isFull = !userStatus.isAdmin && currentParticipants >= maxPlaces;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-black text-lg text-slate-900 tracking-tight">Exceller chez Pierre</span>
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
              Live
            </span>
          </Link>

          <button
            onClick={handleCopyShareLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? 'Lien copié !' : 'Partager'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-10 sm:py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-6 sm:p-10 relative overflow-hidden"
          >
            {/* Top Status Badges */}
            <div className="flex flex-wrap items-center gap-2.5 mb-6">
              {isLiveNow ? (
                <span className="px-3.5 py-1.5 rounded-full bg-red-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-red-500/20 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  Séance en direct live
                </span>
              ) : isEnded ? (
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-wider">
                  Séance terminée
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1 border border-indigo-100">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Séance programmée
                </span>
              )}

              {session.is_private ? (
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 font-bold text-xs flex items-center gap-1 border border-amber-200/60">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  Salle privée avec validation
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center gap-1 border border-emerald-200/60">
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  Session accessible aux inscrits
                </span>
              )}

              {session.course_title && (
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-slate-400" />
                  {session.course_title}
                </span>
              )}
            </div>

            {/* Big Session Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.15] mb-6">
              {session.title}
            </h1>

            {/* Session Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-500" /> Date
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-800 capitalize">
                  {formattedDate}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-500" /> Horaire
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-800">
                  {formattedTime} ({session.duration_minutes} min)
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-indigo-500" /> Formateur
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                  {session.trainer_name || 'Pierre Valdeze Mbom'}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3 text-indigo-500" /> Capacite
                </span>
                <span className="text-xs sm:text-sm font-bold text-indigo-700">
                  {currentParticipants} / {maxPlaces} places
                </span>
              </div>
            </div>

            {/* Session Description Section */}
            <div className="mb-10">
              <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">
                Présentation & Programme de la séance
              </h2>
              <div 
                className="prose prose-slate max-w-none text-sm sm:text-base leading-relaxed text-slate-700 font-normal bg-slate-50/50 p-5 rounded-2xl border border-slate-100"
                dangerouslySetInnerHTML={{ __html: formatDescriptionHtml(session.description) }}
              />
            </div>

            {/* Action Buttons Section */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <button
                onClick={() => navigate(`/live/${session.room_code}`)}
                disabled={isEnded || isFull}
                className={`w-full py-4 px-6 rounded-2xl text-base font-black flex items-center justify-center gap-3 transition-all shadow-xl active:scale-98 ${
                  isEnded || isFull
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200'
                    : isLiveNow
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30 animate-pulse'
                    : 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-600/30 hover:scale-[1.01]'
                }`}
              >
                <Video className="w-6 h-6 fill-current" />
                <span>
                  {isEnded 
                    ? 'La séance est terminée' 
                    : isFull 
                    ? 'Séance complète (Nombre max de places atteint)' 
                    : isLiveNow
                    ? 'Rejoindre le Direct Live en cours'
                    : 'Rejoindre la session live'}
                </span>
              </button>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Visioconférence sécurisée avec partage d'écran et espace d'échange</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Partager cette fiche séance</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer identical to public pages */}
      <Footer />
    </div>
  );
}
