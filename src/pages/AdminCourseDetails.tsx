import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/Toast';
import { Loader2, ArrowLeft, Users, Banknote, Phone, Mail, MessageCircle, Edit, Trash2, Power, X, Send, Archive, ArchiveRestore, UserX, UserCheck, CheckCircle2, BookOpen, Calendar, Sparkles, Video, FileText, Award, AlertCircle, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ShareCourseButton from '../components/ShareCourseButton';
import AdminModuleViewerModal from '../components/AdminModuleViewerModal';
import VerifiedBadge from '../components/VerifiedBadge';

interface Course {
  id: string;
  slug?: string;
  title: string;
  initials: string;
  price_fcfa: number;
  date_time: string;
  is_active: boolean;
  product_type?: string;
  is_archived?: boolean;
}

interface Registration {
  id: string;
  client_id: string | null;
  participant_name: string;
  participant_email: string;
  participant_phone: string;
  payment_status?: string;
  registered_at: string;
}

export default function AdminCourseDetails() {
  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseModules, setCourseModules] = useState<any[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, string[]>>({});
  
  // Module viewer modal state
  const [selectedModuleForViewer, setSelectedModuleForViewer] = useState<any | null>(null);
  const [viewerInitialTab, setViewerInitialTab] = useState<'content' | 'sessions' | 'add-session'>('content');
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Broadcast message state
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    if (id) fetchCourseData();
  }, [id]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      
      const [courseResponse, registrationsResponse, modulesResponse] = await Promise.all([
        supabase.from('courses').select('*').eq('id', id).single(),
        supabase.from('registrations').select('id, client_id, participant_name, participant_email, participant_phone, payment_status, registered_at').eq('course_id', id).order('registered_at', { ascending: false }),
        supabase.from('course_modules').select('id, title, description, long_summary, youtube_url, download_files, scheduled_date, order_index').eq('course_id', id).order('order_index', { ascending: true })
      ]);

      if (courseResponse.error) throw courseResponse.error;
      if (registrationsResponse.error) throw registrationsResponse.error;

      setCourse(courseResponse.data);
      setRegistrations(registrationsResponse.data || []);
      
      const modules = modulesResponse.data || [];
      
      if (modules.length > 0) {
        const moduleIds = modules.map(m => m.id);
        
        // Fetch quizzes and progress parallelly
        const [progressRes, quizzesRes] = await Promise.all([
          supabase.from('module_progress').select('client_id, module_id').in('module_id', moduleIds),
          supabase.from('quizzes').select('*').in('module_id', moduleIds)
        ]);

        const quizzesData = quizzesRes.data || [];
        const modulesWithQuiz = modules.map(mod => {
          const q = quizzesData.find(quiz => quiz.module_id === mod.id);
          return { ...mod, quiz: q || null };
        });

        setCourseModules(modulesWithQuiz);

        if (!progressRes.error && progressRes.data) {
          const map: Record<string, string[]> = {};
          progressRes.data.forEach(p => {
            if (!map[p.client_id]) {
              map[p.client_id] = [];
            }
            if (!map[p.client_id].includes(p.module_id)) {
              map[p.client_id].push(p.module_id);
            }
          });
          setProgressMap(map);
        }
      } else {
        setCourseModules([]);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  const openModuleViewer = (moduleItem: any, initialTab: 'content' | 'sessions' | 'add-session' = 'content') => {
    setSelectedModuleForViewer(moduleItem);
    setViewerInitialTab(initialTab);
    setIsViewerOpen(true);
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim() || !course) return;
    
    setBroadcasting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Vous devez être connecté pour envoyer des messages.");

      // Filter registrations that have a client_id (actual users)
      const clientsWithAccounts = registrations.filter(reg => reg.client_id);
      
      if (clientsWithAccounts.length === 0) {
        toast.info("Aucun inscrit n'a de compte utilisateur associé pour recevoir ce message.");
        setBroadcasting(false);
        return;
      }

      // Create messages for each registered client
      const messagesToInsert = clientsWithAccounts.map(reg => ({
        client_id: reg.client_id,
        sender_id: user.id,
        course_id: course.id,
        content: broadcastMessage.trim(),
        is_read: false
      }));

      const { error: msgError } = await supabase.from('messages').insert(messagesToInsert);
      
      if (msgError) throw msgError;

      toast.success(`Message envoyé avec succès à ${clientsWithAccounts.length} participant(s).`);
      setBroadcastMessage('');
      setShowBroadcastModal(false);
    } catch (err: any) {
      toast.error("Erreur lors de l'envoi : " + err.message);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette formation ? Cette action est irréversible et supprimera également toutes les inscriptions liées.")) {
      return;
    }
    
    try {
      // Suppression manuelle des dépendances au cas où ON DELETE CASCADE ne serait pas configuré dans Supabase
      const { error: modError } = await supabase.from('course_modules').delete().eq('course_id', id);
      if (modError) console.error("Erreur modules:", modError);
      
      const { error: regError } = await supabase.from('registrations').delete().eq('course_id', id);
      if (regError) console.error("Erreur inscriptions:", regError);

      const { data, error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error("Impossible de supprimer la formation. Vérifiez vos permissions administrateur (RLS) ou si la formation existe encore.");
      }
      
      navigate('/admin/formations');
    } catch (err: any) {
      toast.error("Erreur lors de la suppression : " + err.message);
    }
  };

  const formatWhatsAppLink = (phone: string, name?: string) => {
    let numericPhone = (phone || '').replace(/\D/g, '');
    if (numericPhone.length === 9 && (numericPhone.startsWith('6') || numericPhone.startsWith('2'))) {
      numericPhone = '237' + numericPhone;
    }
    const msg = name && course
      ? `Bonjour ${name} ! Je suis l'administrateur de Exceller chez Pierre. Je me permets de vous contacter concernant votre inscription à la formation "${course.title}".`
      : `Bonjour ! Je me permets de vous contacter concernant votre parcours de formation sur Exceller chez Pierre.`;
    return `https://wa.me/${numericPhone}?text=${encodeURIComponent(msg)}`;
  };

  const handleToggleRegistrationAccess = async (registrationId: string, name: string, currentStatus?: string) => {
    const isApproved = currentStatus === 'approved';
    const newStatus = isApproved ? 'rejected' : 'approved';
    const actionText = isApproved 
      ? `désinscrire ${name} de la formation "${course?.title}" (son accès au compte sera immédiatement retiré)`
      : `réinscrire ${name} et lui réactiver l'accès à la formation "${course?.title}"`;

    if (!window.confirm(`Voulez-vous vraiment ${actionText} ?`)) return;

    // Immediate local state update for instant UI feedback
    setRegistrations(prev => prev.map(r => r.id === registrationId ? { ...r, payment_status: newStatus } : r));

    try {
      const { error } = await supabase
        .from('registrations')
        .update({ payment_status: newStatus })
        .eq('id', registrationId);

      if (error) console.warn("Notice updating registration status:", error.message);
    } catch (err: any) {
      console.warn("Could not update registration status in DB:", err);
    }
  };

  const handleDeleteRegistration = async (registrationId: string, name: string) => {
    if (!window.confirm(`Suppression définitive : Voulez-vous vraiment supprimer le compte / l'inscription de "${name}" pour cette formation ? Cette action est irréversible.`)) {
      return;
    }

    // Immediate local state update for instant UI feedback
    setRegistrations(prev => prev.filter(r => r.id !== registrationId));

    try {
      const { error } = await supabase
        .from('registrations')
        .delete()
        .eq('id', registrationId);

      if (error) console.warn("Notice deleting registration:", error.message);
    } catch (err: any) {
      console.warn("Could not delete registration in DB:", err);
    }
  };

  const toggleActive = async () => {
    if (!course) return;
    
    try {
      const newStatus = !course.is_active;
      
      const { error: updateError } = await supabase
        .from('courses')
        .update({ is_active: newStatus })
        .eq('id', course.id);

      if (updateError) throw updateError;
      
      setCourse({ ...course, is_active: newStatus });
    } catch (err: any) {
      toast.error("Erreur lors de la modification de l'état : " + err.message);
    }
  };

  const toggleArchive = async () => {
    if (!course) return;
    
    try {
      const newStatus = !course.is_archived;
      
      const { error: updateError } = await supabase
        .from('courses')
        .update({ is_archived: newStatus })
        .eq('id', course.id);

      if (updateError) throw updateError;
      
      setCourse({ ...course, is_archived: newStatus });
    } catch (err: any) {
      toast.error("Erreur lors de la modification du statut d'archivage : " + err.message);
    }
  };

  const exportToGoogleContacts = () => {
    if (!course || registrations.length === 0) return;
    
    // Header compatible with Google Contacts
    const header = "Name,Given Name,Additional Name,Family Name,Yomi Name,Given Name Yomi,Additional Name Yomi,Family Name Yomi,Name Prefix,Name Suffix,Initials,Nickname,Short Name,Maiden Name,Birthday,Gender,Location,Billing Information,Directory Server,Mileage,Occupation,Hobby,Sensitivity,Priority,Subject,Notes,Language,Photo,Group Membership,Phone 1 - Type,Phone 1 - Value\n";
    
    const initials = course.initials ? course.initials.trim() : "FORMATION";
    
    const rows = registrations.map(reg => {
      const contactName = `${initials}-${reg.participant_name}`;
      const phone = reg.participant_phone.replace(/\s+/g, '');
      // Name in first column, Phone in last column. The commas separate empty fields.
      // There are 31 columns. Name is 1st. Phone 1 - Type is 30th. Phone 1 - Value is 31st.
      return `${contactName},,,,,,,,,,,,,,,,,,,,,,,,,,,,,Mobile,${phone}`;
    });
    
    const csvContent = header + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `contacts_${initials}_${course.id.substring(0,6)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Chargement des détails...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="p-4 sm:p-6 max-w-md mx-auto">
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-sm text-red-600">{error || 'Formation introuvable'}</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="mt-3 text-sm font-medium text-red-700 hover:text-red-800"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  const totalRegistrations = registrations.length;
  const grossRevenue = totalRegistrations * course.price_fcfa;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto pb-24 font-sans">
      {/* Back Button Row */}
      <div className="mb-4">
        <button 
          onClick={() => navigate('/admin/formations')}
          className="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100 flex items-center gap-1.5 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux formations</span>
        </button>
      </div>

      {/* Title & Badge Column - Centered */}
      <div className="flex flex-col items-center text-center gap-2 mb-4">
        <h1 className="text-xl sm:text-3xl font-black text-gray-900 tracking-tight leading-tight max-w-2xl">
          {course.title}
        </h1>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
          course.product_type === 'ebook' 
            ? 'bg-purple-100 text-purple-800 border border-purple-200' 
            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
        }`}>
          {course.product_type === 'ebook' ? 'E-book' : 'Formation'}
        </span>
      </div>

      {/* Actions Row - Just below the title and centered */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm max-w-xl mx-auto">
        {/* Active Button */}
        <button
          onClick={toggleActive}
          className={`flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 text-xs font-bold border rounded-xl transition-all shadow-sm shrink-0 ${
            course.is_active 
              ? 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100' 
              : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'
          }`}
          title={course.is_active ? 'Désactiver' : 'Activer'}
        >
          <Power className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{course.is_active ? 'Active' : 'Inactive'}</span>
        </button>

        {/* Share Button */}
        <ShareCourseButton 
          courseId={course.id} 
          courseSlug={course.slug}
          courseTitle={course.title} 
          className="text-xs font-bold text-white bg-blue-600 border border-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-sm shrink-0 p-2 sm:px-3 sm:py-2" 
          mobileIconOnly={true}
        />

        {/* Archive Button */}
        <button
          onClick={toggleArchive}
          className={`flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 text-xs font-bold border rounded-xl transition-all shadow-sm shrink-0 ${
            course.is_archived 
              ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100' 
              : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50'
          }`}
          title={course.is_archived ? 'Désarchiver' : 'Archiver'}
        >
          {course.is_archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{course.is_archived ? 'Archivée' : 'Archiver'}</span>
        </button>

        {/* Edit Button */}
        <button
          onClick={() => navigate(`/admin/formations/${course.id}/edit`)}
          className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm shrink-0"
          title="Formulaire de modification"
        >
          <Edit className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Modifier</span>
        </button>

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          className="flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 text-xs font-bold text-red-600 bg-white border border-red-100 rounded-xl hover:bg-red-50 transition-all shadow-sm shrink-0"
          title="Supprimer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Supprimer</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
            <Users className="w-4 h-4" />
            {course.product_type === 'ebook' ? 'Ventes' : 'Inscrits'}
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {totalRegistrations}
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
            <Banknote className="w-4 h-4" />
            Revenu brut
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900">
            {grossRevenue.toLocaleString('fr-FR')} <span className="text-sm font-medium text-gray-500">FCFA</span>
          </div>
        </div>
      </div>

      {/* Modules et Contenus Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-gray-100 mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                Contenu Pédagogique
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Modules et Programme de la Formation ({courseModules.length})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Consultez les contenus enrichis (textes, vidéos, supports) et les séances associées sans ouvrir le formulaire.
            </p>
          </div>

          <button
            onClick={() => navigate(`/edit-course/${course.id}`)}
            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors border border-indigo-200 flex items-center gap-1.5 shrink-0"
          >
            <Edit className="w-4 h-4" />
            <span>Formulaire de modification</span>
          </button>
        </div>

        {courseModules.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-3">
            <BookOpen className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-sm font-bold text-gray-700">Aucun module n'a encore été créé pour cette formation.</p>
            <button
              onClick={() => navigate(`/edit-course/${course.id}`)}
              className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Ajouter le premier module
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {courseModules.map((mod, idx) => {
              const rawFiles = mod.download_files || [];
              const resourcesCount = rawFiles.filter((f: any) => f.type !== 'session').length;
              const sessions = rawFiles.filter((f: any) => f.type === 'session');
              const hasSessions = sessions.length > 0;
              const hasRichSummary = !!mod.long_summary || !!mod.description;
              const hasVideo = !!mod.youtube_url;

              return (
                <div 
                  key={mod.id || idx}
                  className="p-4 bg-gray-50/70 hover:bg-white hover:shadow-md border border-gray-100 rounded-2xl transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 text-sm truncate">{mod.title}</h3>
                        {mod.description && (
                          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{mod.description}</p>
                        )}

                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {hasRichSummary && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                              <Sparkles className="w-3 h-3 text-purple-600" />
                              Contenu enrichi
                            </span>
                          )}

                          {hasVideo && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                              <Video className="w-3 h-3 text-rose-600" />
                              Vidéo YouTube
                            </span>
                          )}

                          {resourcesCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                              <FileText className="w-3 h-3 text-blue-600" />
                              {resourcesCount} fichier(s)
                            </span>
                          )}

                          {mod.quiz && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              <Award className="w-3 h-3 text-emerald-600" />
                              Quiz inclus
                            </span>
                          )}

                          {hasSessions ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                              <Calendar className="w-3 h-3 text-orange-600" />
                              {sessions.length} séance(s)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              Aucune séance
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 sm:pt-0">
                      <button
                        onClick={() => openModuleViewer(mod, 'content')}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Lire le contenu</span>
                      </button>

                      {hasSessions ? (
                        <button
                          onClick={() => openModuleViewer(mod, 'sessions')}
                          className="px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Séances ({sessions.length})</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => openModuleViewer(mod, 'add-session')}
                          className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Ajouter séance</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Participants List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {course.product_type === 'ebook' ? 'Acheteurs' : 'Participants'} ({totalRegistrations})
          </h2>
          {registrations.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBroadcastModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
              >
                <MessageCircle className="w-4 h-4" />
                Message groupé
              </button>
              <button
                onClick={exportToGoogleContacts}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
              >
                <Users className="w-4 h-4" />
                Exporter Contacts
              </button>
            </div>
          )}
        </div>
        
        {registrations.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100 border-dashed">
            <p className="text-sm text-gray-500">
              {course.product_type === 'ebook' ? 'Aucun achat pour le moment.' : 'Aucun participant inscrit pour le moment.'}
            </p>
          </div>
        ) : (
          registrations.map((participant, index) => {
            const date = new Intl.DateTimeFormat('fr-FR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date(participant.registered_at));

            const completedCount = participant.client_id ? (progressMap[participant.client_id]?.length || 0) : 0;
            const totalCount = courseModules.length;
            const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

            const isApproved = participant.payment_status === 'approved';
            const isRejected = participant.payment_status === 'rejected' || participant.payment_status === 'cancelled';
            const isPending = !isApproved && !isRejected;

            return (
              <div key={`${participant.id}-${index}`} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-gray-900 text-sm">{participant.participant_name}</h3>
                    <VerifiedBadge size="xs" />
                    {isApproved ? (
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        Accès Actif
                      </span>
                    ) : isRejected ? (
                      <span className="text-[10px] font-extrabold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                        Désinscrit (Accès retiré)
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                        En attente
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">{date}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${participant.participant_email}`} className="truncate hover:text-gray-900">
                      {participant.participant_email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${participant.participant_phone}`} className="hover:text-gray-900">
                      {participant.participant_phone}
                    </a>
                  </div>

                  {course.product_type !== 'ebook' && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex justify-between items-center text-xs font-bold text-gray-500 mb-1.5">
                        <span>Progression de l'étudiant</span>
                        <span className="text-purple-600 font-extrabold">{completedCount} / {totalCount} validés ({percent}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      {!participant.client_id && (
                        <p className="text-[10px] text-amber-600 font-medium mt-1">
                          L'étudiant n'a pas encore créé de compte pour enregistrer son avancement.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions bar: WhatsApp, Désinscrire/Réinscrire, Supprimer */}
                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
                  <a
                    href={formatWhatsAppLink(participant.participant_phone, participant.participant_name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2 px-3 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 font-bold text-xs rounded-xl transition-colors border border-[#25D366]/20"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>

                  {isApproved ? (
                    <button
                      onClick={() => handleToggleRegistrationAccess(participant.id, participant.participant_name, participant.payment_status)}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs rounded-xl transition-colors border border-amber-200"
                      title="Retirer l'accès et désinscrire cet élève"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Désinscrire
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleRegistrationAccess(participant.id, participant.participant_name, participant.payment_status)}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs rounded-xl transition-colors border border-emerald-200"
                      title="Réinscrire et réactiver l'accès"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {isRejected ? 'Réinscrire' : 'Valider accès'}
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteRegistration(participant.id, participant.participant_name)}
                    className="p-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 font-bold text-xs rounded-xl transition-colors border border-red-200 flex items-center justify-center"
                    title="Supprimer définitivement ce compte / cette inscription"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Broadcast Modal */}
      <AnimatePresence>
        {showBroadcastModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl relative border border-gray-100"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-50">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Message à tous les inscrits</h3>
                  <p className="text-xs text-gray-500 mt-1">Diffusion groupée pour : {course.title}</p>
                </div>
                <button 
                  onClick={() => setShowBroadcastModal(false)} 
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    <strong>Note :</strong> Ce message sera envoyé individuellement à chaque inscrit possédant un compte client. Ils recevront une notification dans leur espace personnel.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700 ml-1">
                    Votre message
                  </label>
                  <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Bonjour à tous, voici une information importante concernant..."
                    className="w-full h-40 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm resize-none"
                  />
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] text-gray-400 font-medium">
                      {registrations.filter(r => r.client_id).length} destinataires potentiels
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium">
                      {broadcastMessage.length} caractères
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowBroadcastModal(false)}
                    className="flex-1 px-4 py-3 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleBroadcast}
                    disabled={broadcasting || !broadcastMessage.trim()}
                    className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-all shadow-lg shadow-emerald-200"
                  >
                    {broadcasting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Envoi...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Diffuser le message
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Module Content & Sessions Viewer Modal */}
      {course && (
        <AdminModuleViewerModal
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          courseId={course.id}
          courseTitle={course.title}
          module={selectedModuleForViewer}
          initialTab={viewerInitialTab}
          onRefreshCourse={fetchCourseData}
        />
      )}
    </div>
  );
}
