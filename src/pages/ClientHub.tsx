import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Calendar, Video, FileText, MessageCircle, ArrowRight, LogOut, BookOpen, Heart, Lightbulb, MessageSquare, ChevronLeft, ChevronRight, Clock, Info } from 'lucide-react';
import { ClientChat } from '../components/ClientChat';

const stripHtml = (html: string) => {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  } catch (e) {
    return html.replace(/<[^>]*>/g, '');
  }
};

export default function ClientHub() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<'inscriptions' | 'interests' | 'proposals' | 'calendar' | 'messages'>('inscriptions');
  const [chatContext, setChatContext] = useState<{courseId?: string, registrationId?: string} | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/client/login');
          return;
        }

        const userId = session.user.id;

        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('client_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error("Erreur profil:", profileError);
        }
        
        if (profileData) {
          setProfile(profileData);
        } else {
          // Fallback to user metadata
          setProfile({
            first_name: session.user.user_metadata?.first_name || 'Client',
            last_name: session.user.user_metadata?.last_name || ''
          });
        }

        // Fetch registrations with courses
        const { data: regData, error: regError } = await supabase
          .from('registrations')
          .select('*, courses(*)')
          .eq('client_id', userId)
          .order('registered_at', { ascending: false });

        if (regError) throw regError;

        if (regData) {
          // Filter out registrations where course is null (just in case)
          setRegistrations(regData.filter(r => r.courses));
        }

        // Fetch proposals & interests
        const { data: propData, error: propError } = await supabase
          .from('course_proposals')
          .select('*, courses(*)')
          .eq('client_id', userId)
          .order('created_at', { ascending: false });

        if (propError) throw propError;
        setProposals(propData || []);
      } catch (err) {
        console.error("Erreur chargement hub:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/client/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const firstName = profile?.first_name || 'Client';

  // Calendar data computation
  const MONTHS_FR = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  const calendarEvents: any[] = [];
  
  registrations.forEach(reg => {
    const course = reg.courses;
    if (course && course.product_type !== 'ebook' && !course.is_date_tbd && course.date_time) {
      calendarEvents.push({
        id: `reg-${reg.id}`,
        title: course.title,
        date: new Date(course.date_time),
        type: reg.payment_status === 'approved' ? 'registered_approved' : 'registered_pending',
        whatsapp_link: course.whatsapp_link,
        google_meet_link: course.google_meet_link,
        guide_url: course.guide_url,
        initials: course.initials,
        time: new Date(course.date_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        payment_status: reg.payment_status,
        description: course.description
      });
    }
  });

  proposals.forEach(prop => {
    const course = prop.courses;
    if (course && course.product_type !== 'ebook' && !course.is_date_tbd && course.date_time && prop.status === 'accepted') {
      if (!calendarEvents.some(e => e.title === course.title)) {
        calendarEvents.push({
          id: `prop-${prop.id}`,
          title: course.title,
          date: new Date(course.date_time),
          type: 'interest_validated',
          whatsapp_link: course.whatsapp_link,
          google_meet_link: course.google_meet_link,
          guide_url: course.guide_url,
          initials: course.initials,
          time: new Date(course.date_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          payment_status: 'approved',
          description: course.description
        });
      }
    }
  });

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust so Monday is 0, Sunday is 6
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);

  // Pad the grid array so that elements match the grid cells
  const calendarCells: (Date | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(new Date(currentYear, currentMonth, day));
  }

  // Get events on a specific day
  const getEventsOnDate = (date: Date) => {
    return calendarEvents.filter(event => {
      const eDate = new Date(event.date);
      return eDate.getDate() === date.getDate() &&
             eDate.getMonth() === date.getMonth() &&
             eDate.getFullYear() === date.getFullYear();
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl text-green-600 tracking-tight">{firstName}</span>
            </div>
            <div className="flex items-center gap-6">
              <Link
                to="/client/marketplace"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Catalogue
              </Link>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-2">
            Bonjour, {firstName} 👋
          </h1>
          <p className="text-gray-500 text-lg">
            Bienvenue dans votre espace personnel. Retrouvez vos formations et vos livres numériques.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 mb-8 overflow-x-auto scrollbar-none gap-2">
          <button
            onClick={() => setActiveSection('inscriptions')}
            className={`pb-4 px-4 font-semibold text-sm border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSection === 'inscriptions'
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Mes Formations & E-books ({registrations.length})</span>
          </button>
          
          <button
            onClick={() => setActiveSection('interests')}
            className={`pb-4 px-4 font-semibold text-sm border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSection === 'interests'
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Formations d'intérêt ({proposals.filter((p: any) => p.course_id !== null).length})</span>
          </button>

          <button
            onClick={() => setActiveSection('proposals')}
            className={`pb-4 px-4 font-semibold text-sm border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSection === 'proposals'
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            <span>Mes Suggestions ({proposals.filter((p: any) => p.course_id === null).length})</span>
          </button>

          <button
            onClick={() => setActiveSection('calendar')}
            className={`pb-4 px-4 font-semibold text-sm border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSection === 'calendar'
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Mon Calendrier ({calendarEvents.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveSection('messages');
              if (activeSection !== 'messages') setChatContext(null);
            }}
            className={`pb-4 px-4 font-semibold text-sm border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSection === 'messages'
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Messagerie</span>
          </button>
        </div>

        {/* Section Content */}
        {activeSection === 'inscriptions' && (
          registrations.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Aucune formation</h3>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Vous n'êtes inscrit à aucune formation pour le moment. Explorez notre catalogue pour trouver celle qui vous convient.
              </p>
              <Link 
                to="/client/marketplace" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-sm"
              >
                Voir le catalogue
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {registrations.map((reg, index) => {
                const course = reg.courses;
                const courseDate = new Date(course.date_time);
                const purchaseDate = reg.registered_at ? new Date(reg.registered_at) : new Date();
                
                return (
                  <div key={`${reg.id}-${index}`} className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                    <div className="p-6 flex-grow">
                      <div className="flex justify-between items-start mb-4">
                        {reg.payment_status === 'approved' ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                            <span>✅ Accès débloqué</span>
                          </div>
                        ) : reg.payment_status === 'rejected' ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                            <span>❌ Paiement rejeté</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
                            <span>⏳ Paiement en cours de vérification</span>
                          </div>
                        )}
                        {course.initials && (
                          <span className="text-sm font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                            {course.initials}
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight">
                        {course.title}
                      </h3>
                      
                      <div className="flex items-center gap-2 text-gray-500 text-sm mb-6">
                        <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className={course.is_date_tbd || !course.date_time ? "text-amber-800 font-medium bg-amber-50/80 px-2.5 py-1 rounded-lg text-xs border border-amber-200" : ""}>
                          {course.product_type === 'ebook' ? (
                            `Acheté le ${purchaseDate.toLocaleDateString('fr-FR')}`
                          ) : course.is_date_tbd || !course.date_time ? (
                            "La date vous sera communiquée prochainement"
                          ) : (
                            `Session le ${courseDate.toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })} à ${courseDate.toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}`
                          )}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-6 pt-0 mt-auto space-y-3 border-t border-gray-50 bg-gray-50/50">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pt-4">Ressources & Accès</p>
                      
                      {reg.payment_status === 'approved' ? (
                        <>
                          {course.product_type === 'ebook' && course.download_file_url && (
                            <a 
                              href={course.download_file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors text-sm shadow-sm"
                            >
                              <FileText className="w-4 h-4" />
                              Télécharger l'E-book
                            </a>
                          )}

                          {course.product_type !== 'ebook' && course.whatsapp_link && (
                            <a 
                              href={course.whatsapp_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-medium transition-colors text-sm shadow-sm"
                            >
                              <MessageCircle className="w-4 h-4" />
                              Groupe WhatsApp
                            </a>
                          )}
                          
                          {course.product_type !== 'ebook' && course.google_meet_link && (
                            course.is_date_tbd || !course.date_time ? (
                              <button 
                                disabled
                                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-gray-100 text-gray-400 rounded-xl font-medium text-sm cursor-not-allowed border border-gray-200"
                                title="Le lien Google Meet sera actif une fois la date de la formation fixée."
                              >
                                <Video className="w-4 h-4 text-gray-300" />
                                Rejoindre le Meet (Date non définie)
                              </button>
                            ) : (
                              <a 
                                href={course.google_meet_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors text-sm shadow-sm"
                              >
                                <Video className="w-4 h-4" />
                                Rejoindre le Meet
                              </a>
                            )
                          )}
                          
                          {course.product_type !== 'ebook' && course.guide_url && (
                            <a 
                              href={course.guide_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors text-sm shadow-sm"
                            >
                              <FileText className="w-4 h-4" />
                              Télécharger le guide
                            </a>
                          )}

                          {(!course.whatsapp_link && !course.google_meet_link && !course.guide_url && !course.download_file_url) && (
                            <div className="text-center py-2 text-sm text-gray-400 italic">
                              Aucune ressource disponible
                            </div>
                          )}

                          <button
                            onClick={() => {
                              setChatContext({ courseId: course.id, registrationId: reg.id });
                              setActiveSection('messages');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-medium transition-colors text-sm shadow-sm mt-2"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Question sur cette formation ?
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="text-center py-3 px-4 bg-amber-50 text-amber-800 text-xs rounded-xl font-medium border border-amber-100">
                            🔒 Les ressources seront débloquées immédiatement après validation de votre reçu de paiement.
                          </div>
                          <button
                            onClick={() => {
                              setChatContext({ courseId: course.id, registrationId: reg.id });
                              setActiveSection('messages');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-medium transition-colors text-sm shadow-sm"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Contacter l'administrateur
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Messagerie Section */}
        {activeSection === 'messages' && (
          <div className="fixed inset-0 z-[100] bg-white">
            <ClientChat 
              courseId={chatContext?.courseId} 
              registrationId={chatContext?.registrationId} 
              onClose={() => {
                setActiveSection('courses');
                setChatContext(null);
              }}
            />
          </div>
        )}

        {/* Formations d'intérêt Section */}
        {activeSection === 'interests' && (
          proposals.filter((p: any) => p.course_id !== null).length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm max-w-lg mx-auto">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Aucun intérêt marqué</h3>
              <p className="text-gray-500 mb-8 text-sm">
                Vous n'avez manifesté votre intérêt pour aucune formation inactive pour le moment. Explorez le catalogue et cliquez sur "Je veux cette formation ✋" sur les sessions à venir.
              </p>
              <Link 
                to="/client/marketplace" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-sm"
              >
                Voir le catalogue
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {proposals.filter((p: any) => p.course_id !== null).map((prop, index) => {
                const date = new Date(prop.created_at);
                const course = prop.courses;
                return (
                  <div key={`${prop.id}-${index}`} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          prop.status === 'accepted' ? 'bg-green-50 text-green-700 border border-green-100' :
                          prop.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100' :
                          prop.status === 'reviewed' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                          'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {prop.status === 'accepted' && <span>✅ Intérêt Validé / Session Planifiée</span>}
                          {prop.status === 'rejected' && <span>❌ Demande écartée</span>}
                          {prop.status === 'reviewed' && <span>📋 En cours de planification</span>}
                          {prop.status === 'pending' && <span className="animate-pulse">⏳ Demande enregistrée</span>}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          {date.toLocaleDateString('fr-FR')}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                        {course?.title || "Formation inconnue"}
                      </h3>
                      <p className="text-gray-500 text-xs mb-4">
                        Vous avez manifesté votre intérêt pour que cette formation soit programmée ou ouverte à l'inscription. Nous analysons la demande générale pour fixer une date.
                      </p>
                    </div>

                    {prop.admin_feedback && (
                      <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100/50 rounded-2xl text-xs text-emerald-950 leading-relaxed">
                        <div className="flex gap-2 items-start">
                          <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-emerald-800 mb-1">Retour de l'équipe :</p>
                            <p className="whitespace-pre-wrap">{prop.admin_feedback}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Suggestions Section */}
        {activeSection === 'proposals' && (
          proposals.filter((p: any) => p.course_id === null).length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm max-w-lg mx-auto">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lightbulb className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Aucune suggestion</h3>
              <p className="text-gray-500 mb-8 text-sm">
                Vous n'avez soumis aucune proposition personnalisée de thématique de formation pour le moment.
              </p>
              <Link 
                to="/client/marketplace" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-sm"
              >
                Proposer une thématique
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {proposals.filter((p: any) => p.course_id === null).map((prop, index) => {
                const date = new Date(prop.created_at);
                return (
                  <div key={`${prop.id}-${index}`} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          prop.status === 'accepted' ? 'bg-green-50 text-green-700 border border-green-100' :
                          prop.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100' :
                          prop.status === 'reviewed' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                          'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {prop.status === 'accepted' && <span>✅ Proposition Validée</span>}
                          {prop.status === 'rejected' && <span>❌ Écartée pour l'instant</span>}
                          {prop.status === 'reviewed' && <span>📋 En cours d'analyse</span>}
                          {prop.status === 'pending' && <span className="animate-pulse">⏳ En attente d'étude</span>}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          {date.toLocaleDateString('fr-FR')}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                        {prop.custom_title}
                      </h3>
                      <p className="text-gray-600 text-sm mb-4 whitespace-pre-wrap leading-relaxed">
                        {prop.custom_description}
                      </p>
                      
                      {prop.proposed_price && (
                        <div className="text-xs text-gray-500 mb-4 bg-gray-50 px-3 py-1.5 rounded-lg inline-block">
                          Budget suggéré : <strong className="text-gray-800 font-mono">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(prop.proposed_price)}</strong>
                        </div>
                      )}
                    </div>

                    {prop.admin_feedback && (
                      <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100/50 rounded-2xl text-xs text-emerald-950 leading-relaxed">
                        <div className="flex gap-2 items-start">
                          <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-emerald-800 mb-1">Retour de l'équipe :</p>
                            <p className="whitespace-pre-wrap">{prop.admin_feedback}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Calendrier Section */}
        {activeSection === 'calendar' && (
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Left: Calendar grid */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm lg:col-span-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                    {MONTHS_FR[currentMonth]} {currentYear}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Visualisez vos sessions et vos formations programmées
                  </p>
                </div>
                
                <div className="flex gap-1">
                  <button
                    onClick={handlePrevMonth}
                    className="p-2 hover:bg-gray-100 text-gray-600 rounded-xl transition-colors border border-gray-100"
                    title="Mois précédent"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setCurrentDate(new Date());
                      setSelectedDate(new Date());
                    }}
                    className="px-3 py-1 text-xs font-bold hover:bg-gray-100 text-gray-700 rounded-xl transition-colors border border-gray-100 flex items-center"
                  >
                    Aujourd'hui
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-2 hover:bg-gray-100 text-gray-600 rounded-xl transition-colors border border-gray-100"
                    title="Mois suivant"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Week Days labels */}
              <div className="grid grid-cols-7 text-center mb-2">
                {DAYS_FR.map((day, idx) => (
                  <span key={idx} className="text-xs font-extrabold text-gray-400 uppercase tracking-wider py-2">
                    {day}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {calendarCells.map((cell, idx) => {
                  if (cell === null) {
                    return <div key={`empty-${idx}`} className="aspect-square bg-gray-50/30 rounded-2xl border border-transparent"></div>;
                  }

                  const dateValue = cell.getDate();
                  const eventsOnThisDay = getEventsOnDate(cell);
                  const hasApprovedEvent = eventsOnThisDay.some(e => e.type === 'registered_approved' || e.type === 'interest_validated');
                  const hasPendingEvent = eventsOnThisDay.some(e => e.type === 'registered_pending');
                  
                  const isToday = (() => {
                    const today = new Date();
                    return cell.getDate() === today.getDate() &&
                           cell.getMonth() === today.getMonth() &&
                           cell.getFullYear() === today.getFullYear();
                  })();

                  const isSelected = selectedDate ? (
                    cell.getDate() === selectedDate.getDate() &&
                    cell.getMonth() === selectedDate.getMonth() &&
                    cell.getFullYear() === selectedDate.getFullYear()
                  ) : false;

                  return (
                    <button
                      key={`day-${dateValue}`}
                      onClick={() => setSelectedDate(cell)}
                      type="button"
                      className={`aspect-square rounded-2xl flex flex-col justify-between p-1.5 sm:p-2.5 border text-left transition-all relative group cursor-pointer ${
                        isSelected 
                          ? 'border-gray-900 bg-gray-900 text-white shadow-md shadow-gray-900/10 scale-102 z-1' 
                          : isToday
                            ? 'border-green-600 bg-green-50/40 text-green-900'
                            : hasApprovedEvent
                              ? 'border-green-100 bg-green-50/80 hover:bg-green-100/50 text-gray-900'
                              : hasPendingEvent
                                ? 'border-amber-100 bg-amber-50/80 hover:bg-amber-100/50 text-gray-900'
                                : 'border-gray-100 hover:border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
                      }`}
                    >
                      <span className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-white' : isToday ? 'text-green-700' : 'text-gray-700'}`}>
                        {dateValue}
                      </span>

                      {eventsOnThisDay.length > 0 && (
                        <div className="flex gap-1 mt-auto">
                          {hasApprovedEvent && (
                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-green-600'}`} />
                          )}
                          {hasPendingEvent && (
                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-200' : 'bg-amber-500'}`} />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-green-100 border border-green-200"></span>
                  <span>Session validée</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-amber-100 border border-amber-200"></span>
                  <span>Session en attente</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-green-50 border border-green-500"></span>
                  <span>Aujourd'hui</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-gray-900"></span>
                  <span>Sélectionné</span>
                </div>
              </div>
            </div>

            {/* Right: Event details or monthly planning list */}
            <div className="space-y-6 lg:col-span-4">
              {/* Event Inspector */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  {selectedDate ? (
                    <span>Détails du {selectedDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
                  ) : (
                    <span>Détails de la date</span>
                  )}
                </h3>

                {selectedDate ? (() => {
                  const dayEvents = getEventsOnDate(selectedDate);
                  if (dayEvents.length === 0) {
                    return (
                      <div className="py-6 text-center">
                        <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-500">
                          Aucun événement programmé pour cette journée.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {dayEvents.map(event => (
                        <div key={event.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              {event.initials && (
                                <span className="inline-block text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded mb-1.5">
                                  {event.initials}
                                </span>
                              )}
                              <h4 className="text-xs font-bold text-gray-900 leading-snug">
                                {event.title}
                              </h4>
                            </div>
                            <span className="text-xs font-bold text-gray-700 bg-white border border-gray-100 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0 font-mono">
                              <Clock className="w-3 h-3 text-amber-500" />
                              {event.time}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {event.payment_status === 'approved' ? (
                              <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                                ✅ Accès débloqué
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                                ⏳ En attente de validation
                              </span>
                            )}
                          </div>

                          {event.description && (
                            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3">
                              {stripHtml(event.description)}
                            </p>
                          )}

                          {event.payment_status === 'approved' ? (
                            <div className="pt-2 space-y-2 border-t border-gray-200/50">
                              {event.google_meet_link && (
                                <a
                                  href={event.google_meet_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-1.5 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  Rejoindre le Meet
                                </a>
                              )}
                              {event.whatsapp_link && (
                                <a
                                  href={event.whatsapp_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-1.5 w-full py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold text-xs transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  Groupe WhatsApp
                                </a>
                              )}
                              {event.guide_url && (
                                <a
                                  href={event.guide_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-1.5 w-full py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-xs transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Télécharger le guide
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className="text-[10px] text-amber-800 bg-amber-50/50 p-2 rounded-xl border border-amber-100/50">
                              🔒 Les liens de connexion et les ressources seront actifs une fois votre reçu de paiement vérifié.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })() : (
                  <p className="text-xs text-gray-500 py-4 text-center">
                    Sélectionnez un jour sur le calendrier pour voir les détails.
                  </p>
                )}
              </div>

              {/* Monthly Overview Schedule */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span>Planning du mois ({MONTHS_FR[currentMonth]})</span>
                </h3>

                {(() => {
                  const monthEvents = calendarEvents.filter(event => {
                    const eDate = new Date(event.date);
                    return eDate.getMonth() === currentMonth && eDate.getFullYear() === currentYear;
                  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                  if (monthEvents.length === 0) {
                    return (
                      <p className="text-xs text-gray-500 text-center py-6">
                        Aucun événement de prévu pour ce mois-ci.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {monthEvents.map(event => {
                        const eventDate = new Date(event.date);
                        return (
                          <div
                            key={event.id}
                            onClick={() => setSelectedDate(eventDate)}
                            className="p-3 bg-gray-50 hover:bg-gray-100/70 border border-gray-100 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all text-left"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="bg-white border border-gray-200 rounded-xl p-2 flex flex-col items-center justify-center min-w-[40px] shadow-xs">
                                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider leading-none mb-0.5">
                                  {eventDate.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}
                                </span>
                                <span className="text-xs font-bold text-gray-800 leading-none">
                                  {eventDate.getDate()}
                                </span>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-gray-900 line-clamp-1 leading-tight">
                                  {event.title}
                                </h4>
                                <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3 text-amber-500" />
                                  {event.time}
                                </span>
                              </div>
                            </div>

                            <span className={`w-2 h-2 rounded-full shrink-0 ${event.payment_status === 'approved' ? 'bg-green-500' : 'bg-amber-500'}`} />
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
