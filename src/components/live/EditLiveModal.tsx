import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Lock, Globe, Video, Sparkles, BookOpen, Edit3, AlertCircle } from 'lucide-react';
import { updateLiveSession, LiveSession } from '../../lib/liveService';
import { supabase } from '../../lib/supabaseClient';

interface EditLiveModalProps {
  session: LiveSession | null;
  isOpen: boolean;
  onClose: () => void;
  onSessionUpdated: (updated: LiveSession) => void;
}

export default function EditLiveModal({
  session,
  isOpen,
  onClose,
  onSessionUpdated
}: EditLiveModalProps) {
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('15:00');
  const [duration, setDuration] = useState(60);
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [status, setStatus] = useState<'scheduled' | 'live' | 'ended'>('scheduled');

  const [coursesList, setCoursesList] = useState<{ id: string; title: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && session) {
      setErrorMessage(null);
      setTitle(session.title || '');
      setCourseId(session.course_id || '');
      setCourseTitle(session.course_title || '');
      setDescription(session.description || '');
      setIsPrivate(session.is_private || false);
      setDuration(session.duration_minutes || 60);
      setMaxParticipants(session.max_participants || 6);
      setStatus(session.status || 'scheduled');

      if (session.scheduled_at) {
        const d = new Date(session.scheduled_at);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setDate(`${yyyy}-${mm}-${dd}`);

        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        setTime(`${hh}:${min}`);
      }
      fetchCourses();
    }
  }, [isOpen, session]);

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

  if (!isOpen || !session) return null;

  const handleCourseChange = (id: string) => {
    setCourseId(id);
    const selected = coursesList.find(c => c.id === id);
    if (selected) {
      setCourseTitle(selected.title);
    } else {
      setCourseTitle('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const scheduledAt = date && time ? new Date(`${date}T${time}:00`).toISOString() : session.scheduled_at;

      const updated = await updateLiveSession(session.id, {
        title,
        course_id: courseId || (null as any),
        course_title: courseTitle || (null as any),
        scheduled_at: scheduledAt,
        duration_minutes: Number(duration),
        description: description.trim() ? description : '',
        is_private: isPrivate,
        max_participants: Number(maxParticipants),
        status
      });

      if (updated) {
        onSessionUpdated(updated);
        onClose();
      } else {
        setErrorMessage('Impossible de mettre à jour la séance. Vérifiez vos permissions.');
      }
    } catch (err: any) {
      console.error('Erreur mise à jour live:', err);
      setErrorMessage(err?.message || 'Erreur lors de la mise à jour de la séance live.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-100 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Modifier la séance Live</h3>
              <p className="text-xs text-slate-500 font-medium">Met à jour le titre et la fiche publique instantanément</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Titre de la séance *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Q&A Live : Stratégie & Réseaux sociaux"
              className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Lier à un cours spécifique (Optionnel)
            </label>
            <div className="relative">
              <select
                value={courseId}
                onChange={(e) => handleCourseChange(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all appearance-none cursor-pointer"
              >
                <option value="">Aucun cours (Session publique / Tous)</option>
                {coursesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <BookOpen className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Date prévue
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Heure (GMT+1)
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
              />
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
                Statut
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer font-bold"
              >
                <option value="scheduled">Programmé</option>
                <option value="live">En direct (Live)</option>
                <option value="ended">Terminé</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Confidentialité & Accès
            </label>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-full py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all ${
                isPrivate
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                {isPrivate ? <Lock className="w-4 h-4 text-amber-600 shrink-0" /> : <Globe className="w-4 h-4 text-slate-500 shrink-0" />}
                <span>{isPrivate ? 'Salle Privée (Modération / Salle d\'attente)' : 'Accès Direct pour les personnes autorisées'}</span>
              </div>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description & Programme (Rich text / HTML)
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Présentez les objectifs de la séance, les consignes et le déroulé..."
              className="w-full px-4 py-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Prise en charge du texte enrichi HTML ou des paragraphes simples.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-2xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
            >
              {submitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
