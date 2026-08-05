import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './Toast';
import { 
  X, 
  BookOpen, 
  Video, 
  FileText, 
  Calendar, 
  PlusCircle, 
  CheckCircle2, 
  Clock, 
  User, 
  ExternalLink, 
  Edit, 
  Award, 
  Sparkles, 
  Layers, 
  Download, 
  ChevronRight,
  AlertCircle,
  HelpCircle,
  CheckSquare,
  Loader2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DownloadFile {
  name: string;
  url: string;
  type?: string;
}

interface ModuleSession {
  id: string;
  name: string;
  date: string;
  description?: string;
  objectives?: string[];
  trainer?: string;
  roomCode?: string;
  isCompleted?: boolean;
  type: 'session';
}

interface ModuleData {
  id: string;
  title: string;
  description?: string;
  long_summary?: string;
  youtube_url?: string;
  download_files?: (DownloadFile | ModuleSession)[];
  scheduled_date?: string;
  order_index?: number;
  quiz?: any;
}

interface AdminModuleViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseTitle: string;
  module: ModuleData | null;
  onRefreshCourse?: () => void;
  initialTab?: 'content' | 'sessions' | 'add-session';
}

// Convert Markdown to clean HTML with styling
function renderEnrichedContent(text: string | undefined): string {
  if (!text) return '<p class="text-gray-400 italic">Aucun résumé ou contenu rédigé pour ce module.</p>';

  // If already contains HTML tags
  let html = text;

  // Render Math formula blocks: $$ formula $$
  html = html.replace(/\$\$(.*?)\$\$/gs, (_, formula) => {
    const trimmed = formula.trim();
    return `<div class="my-4 p-4 bg-purple-50 border border-purple-100 rounded-2xl flex flex-col items-center justify-center font-serif text-purple-950 border-l-4 border-l-purple-600 select-all"><span class="text-[10px] uppercase tracking-widest text-purple-600 font-bold mb-1">Formule Mathématique</span><span class="font-bold tracking-wide text-lg text-center">${trimmed}</span></div>`;
  });

  // Convert basic Markdown lines if not full HTML
  if (!html.includes('<p>') && !html.includes('<div>') && !html.includes('<h1>')) {
    const lines = html.split('\n');
    const processedLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<br>';
      if (trimmed.startsWith('# ')) return `<h1 class="text-xl font-black text-gray-900 mt-4 mb-2">${trimmed.slice(2)}</h1>`;
      if (trimmed.startsWith('## ')) return `<h2 class="text-lg font-bold text-gray-900 mt-3 mb-1.5">${trimmed.slice(3)}</h2>`;
      if (trimmed.startsWith('### ')) return `<h3 class="text-base font-bold text-gray-800 mt-2.5 mb-1">${trimmed.slice(4)}</h3>`;
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return `<li class="ml-4 list-disc text-sm text-gray-700 py-0.5">${trimmed.slice(2)}</li>`;
      return `<p class="text-sm text-gray-700 leading-relaxed mb-2">${trimmed}</p>`;
    });
    html = processedLines.join('');
  }

  return html;
}

// Helper for YouTube embed
function getYoutubeEmbedUrl(url?: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

export default function AdminModuleViewerModal({
  isOpen,
  onClose,
  courseId,
  courseTitle,
  module,
  onRefreshCourse,
  initialTab = 'content'
}: AdminModuleViewerModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'content' | 'sessions'>(initialTab === 'add-session' ? 'sessions' : initialTab as any);
  const [showAddSessionForm, setShowAddSessionForm] = useState(initialTab === 'add-session');
  
  // Session Form state
  const [sessionName, setSessionName] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTrainer, setSessionTrainer] = useState('');
  const [sessionRoomCode, setSessionRoomCode] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  // Sync state on open
  useEffect(() => {
    if (isOpen && module) {
      setActiveTab(initialTab === 'add-session' ? 'sessions' : (initialTab as any));
      setShowAddSessionForm(initialTab === 'add-session');

      // Pre-fill session form default name
      const allFiles = module.download_files || [];
      const existingSessions = allFiles.filter((f: any) => f.type === 'session');
      setSessionName(`Séance ${existingSessions.length + 1} - ${module.title}`);

      // Default date: now formatted ISO
      const now = new Date();
      const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setSessionDate(localISO);
      setSessionTrainer('');
      setSessionRoomCode('');
      setSessionDescription('');
    }
  }, [isOpen, module, initialTab]);

  if (!isOpen || !module) return null;

  const rawFiles = module.download_files || [];
  const resources = rawFiles.filter((f: any) => f.type !== 'session') as DownloadFile[];
  const moduleSessions = rawFiles.filter((f: any) => f.type === 'session') as ModuleSession[];
  const youtubeEmbed = getYoutubeEmbedUrl(module.youtube_url);

  // Toggle session completion status directly in DB
  const handleToggleSessionComplete = async (sessionToToggle: ModuleSession) => {
    try {
      const updatedFiles = rawFiles.map((f: any) => {
        if (f.type === 'session' && (f.id === sessionToToggle.id || f.name === sessionToToggle.name)) {
          return { ...f, isCompleted: !f.isCompleted };
        }
        return f;
      });

      const { error } = await supabase
        .from('course_modules')
        .update({ download_files: updatedFiles })
        .eq('id', module.id);

      if (error) throw error;

      toast.success(sessionToToggle.isCompleted ? "Séance marquée comme non terminée" : "Séance marquée comme réalisée !");
      if (onRefreshCourse) onRefreshCourse();
    } catch (err: any) {
      toast.error("Erreur lors de la mise à jour : " + err.message);
    }
  };

  // Create & Save Session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim()) {
      toast.error("Veuillez saisir un nom pour la séance.");
      return;
    }
    if (!sessionDate) {
      toast.error("Veuillez sélectionner une date et une heure pour la séance.");
      return;
    }

    try {
      setSavingSession(true);

      const newSession: ModuleSession = {
        id: crypto.randomUUID(),
        name: sessionName.trim(),
        date: sessionDate,
        trainer: sessionTrainer.trim() || undefined,
        roomCode: sessionRoomCode.trim() || undefined,
        description: sessionDescription.trim() || undefined,
        isCompleted: false,
        type: 'session'
      };

      const updatedFiles = [...rawFiles, newSession];

      const { error } = await supabase
        .from('course_modules')
        .update({ download_files: updatedFiles })
        .eq('id', module.id);

      if (error) throw error;

      toast.success("Séance ajoutée avec succès au module !");
      setShowAddSessionForm(false);
      if (onRefreshCourse) onRefreshCourse();
    } catch (err: any) {
      toast.error("Erreur lors de la sauvegarde de la séance : " + err.message);
    } finally {
      setSavingSession(false);
    }
  };

  const navigateToEditForm = () => {
    onClose();
    navigate(`/edit-course/${courseId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto"
      >
        {/* Top Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-400/30">
                {courseTitle}
              </span>
              <span className="text-xs text-slate-400 font-bold">
                Module {module.order_index !== undefined ? module.order_index + 1 : ''}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {module.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={navigateToEditForm}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
              title="Ouvrir dans le formulaire de modification de la formation"
            >
              <Edit className="w-4 h-4 text-purple-400" />
              <span>Formulaire complet</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-100 bg-slate-50 px-4 sm:px-6 gap-2 shrink-0 pt-2 overflow-x-auto no-scrollbar whitespace-nowrap">
          <button
            onClick={() => { setActiveTab('content'); setShowAddSessionForm(false); }}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'content'
                ? 'border-purple-600 text-purple-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Contenu Enrichi</span>
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'sessions'
                ? 'border-purple-600 text-purple-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Séances du Module ({moduleSessions.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'content' && (
            <div className="space-y-6">
              {/* Short Description */}
              {module.description && (
                <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl">
                  <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    Objectif principal & Aperçu
                  </h4>
                  <p className="text-sm text-purple-900 font-medium leading-relaxed">
                    {module.description}
                  </p>
                </div>
              )}

              {/* YouTube Video Section */}
              {youtubeEmbed ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Video className="w-4 h-4 text-rose-500" />
                    Vidéo explicative du module
                  </h3>
                  <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-md border border-slate-200">
                    <iframe
                      src={youtubeEmbed}
                      title={module.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>
              ) : module.youtube_url ? (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Video className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-rose-900">Lien Vidéo Externe</p>
                      <p className="text-xs text-rose-700 truncate max-w-md">{module.youtube_url}</p>
                    </div>
                  </div>
                  <a
                    href={module.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors flex items-center gap-1"
                  >
                    <span>Regarder</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : null}

              {/* Rich Content Summary */}
              <div className="space-y-2">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Contenu détaillé du module
                </h3>
                <div 
                  className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 text-sm text-slate-800 leading-relaxed prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderEnrichedContent(module.long_summary || module.description) }}
                />
              </div>

              {/* Attached Files & Documents */}
              {resources.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-600" />
                    Fichiers et Supports Téléchargeables ({resources.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {resources.map((file, idx) => (
                      <div 
                        key={idx}
                        className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs hover:border-purple-300 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {file.name || `Support #${idx + 1}`}
                            </p>
                            <span className="text-[10px] text-slate-400">Document joint</span>
                          </div>
                        </div>

                        {file.url && (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-slate-100 hover:bg-purple-600 hover:text-white text-slate-700 rounded-xl text-xs font-bold transition-all shrink-0"
                            title="Télécharger le document"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quiz Summary */}
              {module.quiz && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-emerald-600" />
                      <h4 className="text-sm font-bold text-emerald-950">
                        Quiz d'évaluation : {module.quiz.title || 'Quiz de fin de module'}
                      </h4>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                      {module.quiz.questions?.length || 0} Question(s)
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800">
                    Ce module comporte un test d'auto-évaluation interactif pour valider l'acquisition des compétences par les apprenants.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-6">
              {/* Header Action Row */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    Séances et rendez-vous du module
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gérez le calendrier des visioconférences et ateliers pratiques.
                  </p>
                </div>

                {!showAddSessionForm && (
                  <button
                    onClick={() => setShowAddSessionForm(true)}
                    className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-orange-100 flex items-center gap-1.5 shrink-0"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Ajouter une séance</span>
                  </button>
                )}
              </div>

              {/* Inline Add Session Form */}
              {showAddSessionForm && (
                <form onSubmit={handleCreateSession} className="bg-orange-50/60 border border-orange-200 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-orange-200 pb-3">
                    <h4 className="text-xs font-black text-orange-950 uppercase tracking-wider flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-orange-600" />
                      Créer une nouvelle séance de cours
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddSessionForm(false)}
                      className="text-xs text-orange-700 hover:text-orange-900 font-bold"
                    >
                      Annuler
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nom de la séance *
                      </label>
                      <input
                        type="text"
                        required
                        value={sessionName}
                        onChange={e => setSessionName(e.target.value)}
                        placeholder="Ex: Séance 1 - Cas pratiques et Q&R"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Date et heure de début *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={sessionDate}
                        onChange={e => setSessionDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Formateur / Intervenant
                      </label>
                      <input
                        type="text"
                        value={sessionTrainer}
                        onChange={e => setSessionTrainer(e.target.value)}
                        placeholder="Ex: Pierre M. (Directeur de formation)"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Code ou Lien de la Salle Visioconférence
                      </label>
                      <input
                        type="text"
                        value={sessionRoomCode}
                        onChange={e => setSessionRoomCode(e.target.value)}
                        placeholder="Ex: live-secu-2026 ou https://..."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Description & Objectifs de la séance
                    </label>
                    <textarea
                      rows={2}
                      value={sessionDescription}
                      onChange={e => setSessionDescription(e.target.value)}
                      placeholder="Détails du programme de la séance..."
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={navigateToEditForm}
                      className="text-xs text-slate-600 hover:text-slate-900 font-bold underline"
                    >
                      Aller au formulaire complet de la formation
                    </button>

                    <button
                      type="submit"
                      disabled={savingSession}
                      className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
                    >
                      {savingSession ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>Enregistrer la séance</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Sessions List */}
              {moduleSessions.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-3xl p-8 text-center bg-slate-50 space-y-3">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto text-orange-500 shadow-xs border border-slate-100">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Aucune séance créée pour ce module</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Vous n'avez pas encore programmé de rendez-vous en direct ou de séance pratique pour ce module.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => setShowAddSessionForm(true)}
                      className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-2xl transition-all shadow-md flex items-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Ajouter séance</span>
                    </button>

                    <button
                      onClick={navigateToEditForm}
                      className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-2xl transition-colors"
                    >
                      Ouvrir le formulaire de formation
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {moduleSessions.map((session, index) => {
                    const sessionDateObj = new Date(session.date);
                    const formattedDateStr = isNaN(sessionDateObj.getTime())
                      ? session.date
                      : new Intl.DateTimeFormat('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }).format(sessionDateObj);

                    return (
                      <div 
                        key={session.id || index}
                        className={`p-4 rounded-2xl border transition-all ${
                          session.isCompleted 
                            ? 'bg-emerald-50/40 border-emerald-200' 
                            : 'bg-white border-slate-200 shadow-xs hover:border-orange-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full ${
                                session.isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                              }`}>
                                {session.isCompleted ? 'Réalisée' : 'À venir'}
                              </span>
                              <h4 className="font-bold text-slate-900 text-sm">{session.name}</h4>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-0.5">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                <Clock className="w-3.5 h-3.5 text-orange-500" />
                                <span>{formattedDateStr}</span>
                              </div>

                              {session.trainer && (
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <User className="w-3.5 h-3.5 text-purple-500" />
                                  <span>{session.trainer}</span>
                                </div>
                              )}
                            </div>

                            {session.description && (
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                                {session.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                            {session.roomCode && (
                              <a
                                href={session.roomCode.startsWith('http') ? session.roomCode : `/live/${session.roomCode}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                              >
                                <Video className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Accéder au Live</span>
                              </a>
                            )}

                            <button
                              onClick={() => handleToggleSessionComplete(session)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                session.isCompleted
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                              title={session.isCompleted ? "Marquer comme non réalisée" : "Marquer comme réalisée"}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{session.isCompleted ? 'Validée' : 'Valider'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="font-medium">
            Formation : <strong className="text-slate-900">{courseTitle}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors"
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
