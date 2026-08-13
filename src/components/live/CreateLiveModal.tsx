import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Lock, Globe, Video, Copy, Check, Sparkles, BookOpen, AlertCircle } from 'lucide-react';
import { createLiveSession, generateRoomCode, LiveSession } from '../../lib/liveService';
import { supabase } from '../../lib/supabaseClient';

interface CreateLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated: (session: LiveSession) => void;
  initialCourseId?: string;
  initialCourseTitle?: string;
}

export default function CreateLiveModal({
  isOpen,
  onClose,
  onSessionCreated,
  initialCourseId,
  initialCourseTitle
}: CreateLiveModalProps) {
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(initialCourseId || '');
  const [courseTitle, setCourseTitle] = useState(initialCourseTitle || '');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [time, setTime] = useState('15:00');
  const [duration, setDuration] = useState(60);
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  
  const [coursesList, setCoursesList] = useState<{ id: string; title: string }[]>([]);
  const [roomCode] = useState(generateRoomCode());
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      fetchCourses();
    }
  }, [isOpen]);

  const fetchCourses = async () => {
    try {
      const { data } = await supabase.from('courses').select('id, title').eq('is_archived', false);
      if (data) {
        setCoursesList(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  const handleCourseChange = (id: string) => {
    setCourseId(id);
    const selected = coursesList.find(c => c.id === id);
    if (selected) {
      setCourseTitle(selected.title);
      if (!title) {
        setTitle(`Session Live : ${selected.title}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const { data: { session } } = await supabase.auth.getSession();
      const trainerEmail = session?.user?.email || 'pmbom@ecp.cm';
      const trainerId = session?.user?.id || trainerEmail;
      const trainerName = session?.user?.user_metadata?.first_name 
        ? `${session.user.user_metadata.first_name} ${session.user.user_metadata.last_name || ''}`.trim()
        : 'Pierre Valdeze Mbom';

      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

      const created = await createLiveSession({
        title,
        course_id: courseId || undefined,
        course_title: courseTitle || undefined,
        trainer_id: trainerId,
        trainer_name: trainerName,
        scheduled_at: scheduledAt,
        duration_minutes: Number(duration),
        description: description || undefined,
        is_private: isPrivate,
        room_code: roomCode,
        participant_count: 0,
        max_participants: Number(maxParticipants)
      });

      onSessionCreated(created);
      onClose();
    } catch (err: any) {
      console.error('Erreur création live:', err);
      setErrorMessage(err?.message || 'Erreur lors de la programmation de la séance live. Vérifiez vos permissions.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    const fullLink = `${window.location.origin}/live/${roomCode}`;
    navigator.clipboard.writeText(fullLink);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-100 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Créer une session Live</h3>
              <p className="text-xs text-slate-500 font-medium">Visioconférence sécurisée (5-6 participants max)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Room Link Preview Card */}
        <div className="my-5 p-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-2xl border border-indigo-100 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Code unique de réunion</span>
            <p className="text-lg font-black text-slate-900 font-mono tracking-wider">{roomCode}</p>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-indigo-600 text-xs font-bold rounded-xl shadow-xs border border-indigo-200 hover:bg-indigo-50 transition-all"
          >
            {copiedCode ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-600">Lien copié !</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copier le lien</span>
              </>
            )}
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Titre du cours / sujet de la séance *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Séance de coaching live : Module 3"
              className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Formation associée (optionnel)
            </label>
            <div className="relative">
              <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <select
                value={courseId}
                onChange={(e) => handleCourseChange(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
              >
                <option value="">Sélectionner une formation...</option>
                {coursesList.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Date *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Heure *
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Durée
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer font-medium"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1h</option>
                <option value={90}>1h 30m</option>
                <option value={120}>2h</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Max Places
              </label>
              <select
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer font-bold text-indigo-700"
              >
                <option value={2}>2 places</option>
                <option value={4}>4 places</option>
                <option value={5}>5 places</option>
                <option value={6}>6 places (Std)</option>
                <option value={8}>8 places</option>
                <option value={10}>10 places</option>
                <option value={15}>15 places</option>
                <option value={20}>20 places</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Accès
              </label>
              <button
                type="button"
                onClick={() => setIsPrivate(!isPrivate)}
                className={`w-full py-2.5 px-2 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                  isPrivate
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {isPrivate ? <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" /> : <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                <span className="truncate">{isPrivate ? 'Lobby' : 'Ouvert'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description / Instructions pour les apprenants
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Préparez vos questions sur le chapitre 2. Casque recommandé."
              className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
          </div>

          {/* Submit */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{submitting ? 'Programmation...' : 'Programmer la séance Live'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
