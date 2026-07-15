import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, ArrowLeft, Users, Banknote, Phone, Mail, MessageCircle, Edit, Trash2 } from 'lucide-react';
import ShareCourseButton from '../components/ShareCourseButton';

interface Course {
  id: string;
  title: string;
  initials: string;
  price_fcfa: number;
  date_time: string;
}

interface Registration {
  id: string;
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

  useEffect(() => {
    if (id) fetchCourseData();
  }, [id]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      
      const [courseResponse, registrationsResponse] = await Promise.all([
        supabase.from('courses').select('id, title, initials, price_fcfa, date_time').eq('id', id).single(),
        supabase.from('registrations').select('*').eq('course_id', id).order('registered_at', { ascending: false })
      ]);

      if (courseResponse.error) throw courseResponse.error;
      if (registrationsResponse.error) throw registrationsResponse.error;

      setCourse(courseResponse.data);
      setRegistrations(registrationsResponse.data || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
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
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900 truncate tracking-tight">{course.title}</h1>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
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
            Inscrits
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Participants ({totalRegistrations})</h2>
          {registrations.length > 0 && (
            <button
              onClick={exportToGoogleContacts}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
            >
              <Users className="w-4 h-4" />
              Exporter Contacts
            </button>
          )}
        </div>
        
        {registrations.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100 border-dashed">
            <p className="text-sm text-gray-500">Aucun participant inscrit pour le moment.</p>
          </div>
        ) : (
          registrations.map((participant) => {
            const date = new Intl.DateTimeFormat('fr-FR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date(participant.registered_at));

            return (
              <div key={participant.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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
    </div>
  );
}
