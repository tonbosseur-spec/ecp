import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, ArrowLeft, Users, Banknote, Phone, Mail, MessageCircle, Edit, Trash2, Power, X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ShareCourseButton from '../components/ShareCourseButton';

interface Course {
  id: string;
  title: string;
  initials: string;
  price_fcfa: number;
  date_time: string;
  is_active: boolean;
  product_type?: string;
}

interface Registration {
  id: string;
  client_id: string | null;
  participant_name: string;
  participant_email: string;
  participant_phone: string;
  registered_at: string;
}

export default function AdminCourseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseModules, setCourseModules] = useState<any[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, string[]>>({});
  
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
        supabase.from('courses').select('id, title, initials, price_fcfa, date_time, is_active, product_type').eq('id', id).single(),
        supabase.from('registrations').select('id, client_id, participant_name, participant_email, participant_phone, registered_at').eq('course_id', id).order('registered_at', { ascending: false }),
        supabase.from('course_modules').select('id, title').eq('course_id', id)
      ]);

      if (courseResponse.error) throw courseResponse.error;
      if (registrationsResponse.error) throw registrationsResponse.error;

      setCourse(courseResponse.data);
      setRegistrations(registrationsResponse.data || []);
      
      const modules = modulesResponse.data || [];
      setCourseModules(modules);

      if (modules.length > 0) {
        const moduleIds = modules.map(m => m.id);
        const { data: progressData, error: progressError } = await supabase
          .from('module_progress')
          .select('client_id, module_id')
          .in('module_id', moduleIds);

        if (!progressError && progressData) {
          const map: Record<string, string[]> = {};
          progressData.forEach(p => {
            if (!map[p.client_id]) {
              map[p.client_id] = [];
            }
            if (!map[p.client_id].includes(p.module_id)) {
              map[p.client_id].push(p.module_id);
            }
          });
          setProgressMap(map);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
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
        alert("Aucun inscrit n'a de compte utilisateur associé pour recevoir ce message.");
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

      alert(`Message envoyé avec succès à ${clientsWithAccounts.length} participant(s).`);
      setBroadcastMessage('');
      setShowBroadcastModal(false);
    } catch (err: any) {
      alert("Erreur lors de l'envoi : " + err.message);
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
      
      navigate('/dashboard');
    } catch (err: any) {
      alert("Erreur lors de la suppression : " + err.message);
    }
  };

  const formatWhatsAppLink = (phone: string) => {
    // Remove all non-numeric characters for the wa.me link
    const numericPhone = phone.replace(/\D/g, '');
    return `https://wa.me/${numericPhone}`;
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
      alert("Erreur lors de la modification de l'état : " + err.message);
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
    <div className="p-4 sm:p-6 max-w-lg mx-auto pb-24">
      {/* Header & Back Button */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 truncate tracking-tight">{course.title}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold self-start sm:self-auto ${
              course.product_type === 'ebook' 
                ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                : 'bg-blue-50 text-blue-700 border border-blue-100'
            }`}>
              {course.product_type === 'ebook' ? 'E-book' : 'Formation'}
            </span>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          <button
            onClick={toggleActive}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg transition-colors shadow-sm ${
              course.is_active 
                ? 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100' 
                : 'text-gray-700 bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Power className="w-4 h-4" />
            {course.is_active ? 'Active' : 'Inactive'}
          </button>
          <ShareCourseButton courseId={course.id} courseTitle={course.title} className="py-2" />
          <button
            onClick={() => navigate(`/edit-course/${course.id}`)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Edit className="w-4 h-4" />
            Modifier
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer
          </button>
        </div>
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

            return (
              <div key={`${participant.id}-${index}`} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-gray-900">{participant.participant_name}</h3>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">{date}</span>
                </div>
                
                <div className="space-y-2 mb-4">
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

                <div className="pt-3 border-t border-gray-50">
                  <a
                    href={formatWhatsAppLink(participant.participant_phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 font-medium text-sm rounded-xl transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Contacter via WhatsApp
                  </a>
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
    </div>
  );
}
