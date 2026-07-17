import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Loader2, 
  Calendar, 
  Video, 
  FileText, 
  MessageCircle, 
  ArrowRight, 
  LogOut, 
  BookOpen, 
  Heart, 
  Lightbulb, 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Info,
  CheckCircle2,
  Play,
  ExternalLink,
  RefreshCw,
  Check
} from 'lucide-react';
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
  const [activeSection, setActiveSection] = useState<'hub' | 'inscriptions' | 'interests' | 'proposals' | 'calendar' | 'messages'>('hub');
  const [chatContext, setChatContext] = useState<{courseId?: string, registrationId?: string} | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const navigate = useNavigate();

  // Course detailed content (LMS) states
  const [activeCourseContentReg, setActiveCourseContentReg] = useState<any | null>(null);
  const [courseModules, setCourseModules] = useState<any[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [completedModuleIds, setCompletedModuleIds] = useState<string[]>([]);
  const [allCompletedModuleIds, setAllCompletedModuleIds] = useState<string[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [togglingProgressId, setTogglingProgressId] = useState<string | null>(null);

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

        // Fetch registrations with courses and nested course module IDs for progress tracking
        const { data: regData, error: regError } = await supabase
          .from('registrations')
          .select('*, courses(*, course_modules(id))')
          .eq('client_id', userId)
          .order('registered_at', { ascending: false });

        if (regError) throw regError;

        if (regData) {
          // Filter out registrations where course is null (just in case)
          setRegistrations(regData.filter(r => r.courses));
        }

        // Fetch client's completed module progress
        const { data: progressData, error: progressError } = await supabase
          .from('module_progress')
          .select('module_id')
          .eq('client_id', userId);
          
        if (!progressError && progressData) {
          setAllCompletedModuleIds(progressData.map(p => p.module_id));
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

  useEffect(() => {
    if (activeCourseContentReg) {
      fetchCourseContent(activeCourseContentReg.course_id);
    }
  }, [activeCourseContentReg]);

  const fetchCourseContent = async (courseId: string) => {
    try {
      setLoadingContent(true);
      
      // Fetch modules for this course
      const { data: modulesData, error: modulesError } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true });
        
      if (modulesError) throw modulesError;
      
      const fetchedModules = modulesData || [];
      setCourseModules(fetchedModules);
      if (fetchedModules.length > 0) {
        setSelectedModuleId(fetchedModules[0].id);
      } else {
        setSelectedModuleId(null);
      }
      
      // Fetch user's progress for these modules
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: progressData, error: progressError } = await supabase
          .from('module_progress')
          .select('module_id')
          .eq('client_id', session.user.id);
          
        if (!progressError && progressData) {
          const completedIds = progressData.map(p => p.module_id);
          setCompletedModuleIds(completedIds);
          setAllCompletedModuleIds(completedIds);
        }
      }
    } catch (err) {
      console.error("Error loading course content:", err);
    } finally {
      setLoadingContent(false);
    }
  };

  const toggleModuleCompletion = async (moduleId: string) => {
    if (togglingProgressId) return;
    try {
      setTogglingProgressId(moduleId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;
      
      const isCompleted = completedModuleIds.includes(moduleId);
      
      if (isCompleted) {
        const { error } = await supabase
          .from('module_progress')
          .delete()
          .eq('client_id', userId)
          .eq('module_id', moduleId);
          
        if (error) throw error;
        setCompletedModuleIds(prev => prev.filter(id => id !== moduleId));
        setAllCompletedModuleIds(prev => prev.filter(id => id !== moduleId));
      } else {
        const { error } = await supabase
          .from('module_progress')
          .insert([{ client_id: userId, module_id: moduleId }]);
          
        if (error) throw error;
        setCompletedModuleIds(prev => [...prev, moduleId]);
        setAllCompletedModuleIds(prev => [...prev, moduleId]);
      }
    } catch (err) {
      console.error("Error toggling module completion:", err);
    } finally {
      setTogglingProgressId(null);
    }
  };

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}`;
      }
    } catch (e) {
      console.error(e);
    }
    return '';
  };

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
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Personalized Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              {activeSection !== 'hub' && (
                <button 
                  onClick={() => {
                    if (activeCourseContentReg) {
                      setActiveCourseContentReg(null);
                    } else {
                      setActiveSection('hub');
                    }
                  }}
                  className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Bonjour, {firstName} 👋
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Déconnexion"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Hub / Home View */}
        {activeSection === 'hub' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-500 mb-6">Que souhaitez-vous faire aujourd'hui ?</h2>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Mes formations et e-book */}
                <button
                  onClick={() => setActiveSection('inscriptions')}
                  className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all aspect-square text-center group"
                >
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📚</div>
                  <span className="text-sm font-bold text-gray-800 leading-tight">Mes formations et e-book</span>
                </button>

                {/* Mes formations d'intérêt */}
                <button
                  onClick={() => setActiveSection('interests')}
                  className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all aspect-square text-center group"
                >
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">❤️</div>
                  <span className="text-sm font-bold text-gray-800 leading-tight">Mes formations d'intérêt</span>
                </button>

                {/* Mes suggestions */}
                <button
                  onClick={() => setActiveSection('proposals')}
                  className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all aspect-square text-center group"
                >
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">💡</div>
                  <span className="text-sm font-bold text-gray-800 leading-tight">Mes suggestions</span>
                </button>

                {/* Calendrier */}
                <button
                  onClick={() => setActiveSection('calendar')}
                  className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all aspect-square text-center group"
                >
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📅</div>
                  <span className="text-sm font-bold text-gray-800 leading-tight">Calendrier</span>
                </button>

                {/* Messagerie */}
                <button
                  onClick={() => setActiveSection('messages')}
                  className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all aspect-square text-center group"
                >
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">💬</div>
                  <span className="text-sm font-bold text-gray-800 leading-tight">Messagerie</span>
                </button>

                {/* Catalogue */}
                <Link
                  to="/client/marketplace"
                  className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all aspect-square text-center group"
                >
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🛒</div>
                  <span className="text-sm font-bold text-gray-800 leading-tight">Catalogue</span>
                </Link>
              </div>
            </div>

            {/* Quick access or latest activity (Optional but adds value) */}
            {registrations.length > 0 && !loading && (
              <div className="mt-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Dernière formation consultée</h3>
                {registrations.slice(0, 1).map((reg) => (
                  <button
                    key={reg.id}
                    onClick={() => {
                      setActiveSection('inscriptions');
                      setActiveCourseContentReg(reg);
                    }}
                    className="w-full bg-indigo-600 p-5 rounded-[2rem] text-white flex items-center justify-between shadow-lg shadow-indigo-100 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                        <Play className="w-6 h-6 fill-white" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-white leading-tight">{reg.courses.title}</p>
                        <p className="text-xs text-indigo-100">Continuer l'apprentissage</p>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-indigo-200 group-hover:translate-x-1 transition-transform" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section Content */}
        {activeSection === 'inscriptions' && (
          activeCourseContentReg ? (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px] animate-fade-in">
              {/* Sidebar: Course Modules List */}
              <div className="w-full md:w-80 bg-gray-50 border-r border-gray-100 flex flex-col shrink-0">
                {/* Workspace Header */}
                <div className="p-6 border-b border-gray-200 bg-white">
                  <button
                    onClick={() => setActiveCourseContentReg(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 mb-3 transition-colors uppercase tracking-wider"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Mes formations
                  </button>
                  <h2 className="text-lg font-extrabold text-gray-900 leading-tight">
                    {activeCourseContentReg.courses.title}
                  </h2>
                </div>

                {/* Progress Stats Summary */}
                <div className="p-6 bg-purple-50/50 border-b border-gray-100">
                  <div className="flex justify-between items-center text-xs font-semibold text-gray-500 mb-2">
                    <span>Progression globale</span>
                    <span className="text-purple-600 font-bold">
                      {courseModules.filter(m => completedModuleIds.includes(m.id)).length} / {courseModules.length} modules
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-600 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${courseModules.length > 0 
                          ? Math.round((courseModules.filter(m => completedModuleIds.includes(m.id)).length / courseModules.length) * 100) 
                          : 0}%` 
                      }}
                    />
                  </div>
                </div>

                {/* Scrollable list of modules */}
                <div className="flex-grow overflow-y-auto max-h-[450px] p-4 space-y-2">
                  {loadingContent ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                      <span className="text-xs text-gray-500">Chargement des modules...</span>
                    </div>
                  ) : courseModules.length === 0 ? (
                    <div className="text-center py-8 text-xs text-gray-400 italic">
                      Aucun module disponible pour ce cours.
                    </div>
                  ) : (
                    courseModules.map((m, index) => {
                      const isCompleted = completedModuleIds.includes(m.id);
                      const isSelected = selectedModuleId === m.id;
                      
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedModuleId(m.id)}
                          className={`w-full text-left p-3.5 rounded-xl transition-all flex items-start gap-3 border ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                              : 'bg-white text-gray-700 border-gray-100 hover:bg-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                            isCompleted 
                              ? isSelected ? 'bg-white text-purple-600' : 'bg-green-100 text-green-600'
                              : isSelected ? 'bg-purple-500 text-purple-100' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {isCompleted ? (
                              <Check className="w-3 h-3 stroke-[3]" />
                            ) : (
                              <span className="text-[10px] font-bold">{index + 1}</span>
                            )}
                          </div>
                          <div className="flex-grow min-w-0">
                            <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${
                              isSelected ? 'text-purple-200' : 'text-gray-400'
                            }`}>
                              Module {index + 1}
                            </p>
                            <p className="text-sm font-bold truncate leading-snug">
                              {m.title}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Main Content Pane */}
              <div className="flex-grow p-6 sm:p-8 flex flex-col bg-white border-t md:border-t-0">
                {loadingContent ? (
                  <div className="flex-grow flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
                    <span className="text-sm text-gray-500 font-medium">Chargement des détails du module...</span>
                  </div>
                ) : !selectedModuleId ? (
                  <div className="flex-grow flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
                    <BookOpen className="w-12 h-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Sélectionnez un module</h3>
                    <p className="text-gray-500 text-sm">
                      Choisissez un module dans la liste de gauche pour afficher son résumé, ses vidéos et supports de cours.
                    </p>
                  </div>
                ) : (
                  (() => {
                    const activeModule = courseModules.find(m => m.id === selectedModuleId);
                    if (!activeModule) return null;
                    
                    const embedUrl = getYoutubeEmbedUrl(activeModule.youtube_url);
                    const isCompleted = completedModuleIds.includes(activeModule.id);
                    
                    return (
                      <div className="space-y-8 animate-fade-in flex-grow flex flex-col">
                        <div className="border-b border-gray-100 pb-5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100 mb-3">
                            <BookOpen className="w-3.5 h-3.5" />
                            Module actif
                          </span>
                          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight mb-2">
                            {activeModule.title}
                          </h1>
                          {activeModule.description && (
                            <p className="text-gray-500 text-sm">
                              {activeModule.description}
                            </p>
                          )}
                        </div>

                        {/* Long Summary / Rich text */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">
                            Résumé & Contenu du module
                          </h4>
                          {activeModule.long_summary ? (
                            <div 
                              className="prose max-w-none text-gray-700 leading-relaxed bg-gray-50/50 border border-gray-100 p-6 rounded-2xl [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_strong]:font-bold [&_em]:italic [&_u]:underline animate-fade-in"
                              dangerouslySetInnerHTML={{ __html: activeModule.long_summary }}
                            />
                          ) : (
                            <p className="text-gray-400 italic text-sm p-4 bg-gray-50 border border-gray-100/50 rounded-xl animate-fade-in">
                              Aucun résumé détaillé pour ce module.
                            </p>
                          )}
                        </div>

                        {/* YouTube Video */}
                        {embedUrl ? (
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                              <Video className="w-4 h-4 text-red-500" />
                              Vidéo de cours
                            </h4>
                            <div className="aspect-video w-full max-w-3xl rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-black">
                              <iframe
                                src={embedUrl}
                                title={activeModule.title}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full"
                              />
                            </div>
                          </div>
                        ) : activeModule.youtube_url ? (
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                              <Video className="w-4 h-4 text-amber-500" />
                              Vidéo externe
                            </h4>
                            <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-sm flex items-center gap-3 border border-amber-100">
                              <Play className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>
                                Support vidéo disponible sur YouTube :{' '}
                                <a 
                                  href={activeModule.youtube_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="underline font-bold hover:text-amber-900 inline-flex items-center gap-1"
                                >
                                  Ouvrir le lien externe <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </span>
                            </div>
                          </div>
                        ) : null}

                        {/* Download files */}
                        {activeModule.download_files && activeModule.download_files.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-blue-500" />
                              Ressources & Supports téléchargeables
                            </h4>
                            <div className="grid gap-3 sm:grid-cols-2 max-w-3xl">
                              {activeModule.download_files.map((file: any, fIdx: number) => (
                                <a
                                  key={fIdx}
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-3 p-3 bg-white border border-gray-100 hover:border-purple-200 hover:bg-purple-50/20 rounded-xl transition-all shadow-xs group"
                                >
                                  <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center shrink-0">
                                    <FileText className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-gray-900 truncate group-hover:text-purple-700 transition-colors">
                                      {file.name || "Support de cours"}
                                    </p>
                                    <span className="text-[10px] text-gray-400">Cliquez pour télécharger</span>
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Progress controls footer */}
                        <div className="pt-6 border-t border-gray-100 flex justify-end mt-auto">
                          <button
                            type="button"
                            onClick={() => toggleModuleCompletion(activeModule.id)}
                            disabled={togglingProgressId === activeModule.id}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${
                              isCompleted
                                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:scale-[1.01]'
                                : 'bg-gray-900 hover:bg-gray-800 text-white hover:scale-[1.01] active:scale-[0.99]'
                            }`}
                          >
                            {togglingProgressId === activeModule.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isCompleted ? (
                              <Check className="w-4 h-4 stroke-[3]" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            {isCompleted ? "Module complété (Marquer comme non lu)" : "Marquer comme lu"}
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          ) : registrations.length === 0 ? (
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
                
                // Progress calculations
                const courseModulesList = course.course_modules || [];
                const totalModulesCount = courseModulesList.length;
                const completedCount = courseModulesList.filter((m: any) => allCompletedModuleIds.includes(m.id)).length;
                const progressPercentage = totalModulesCount > 0 ? Math.round((completedCount / totalModulesCount) * 100) : 0;
                
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

                      {reg.payment_status === 'approved' && course.product_type !== 'ebook' && (
                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 animate-fade-in">
                          <div className="flex justify-between items-center text-xs font-semibold text-gray-500">
                            <span>Progression</span>
                            <span className="text-purple-600 font-bold">{completedCount} / {totalModulesCount} modules ({progressPercentage}%)</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-600 rounded-full transition-all duration-500" 
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6 pt-0 mt-auto space-y-3 border-t border-gray-50 bg-gray-50/50">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pt-4">Ressources & Accès</p>
                      
                      {reg.payment_status === 'approved' ? (
                        <>
                          {course.product_type !== 'ebook' && (
                            <Link
                              to={`/client/course/${course.id}`}
                              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all text-sm shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] mb-1"
                            >
                              <BookOpen className="w-4 h-4" />
                              Accéder aux modules du cours
                            </Link>
                          )}

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
          <div className="fixed inset-0 z-50 bg-white">
            <div className="flex flex-col h-full">
              <header className="bg-white border-b border-gray-100 h-16 flex items-center px-4 shrink-0">
                <button 
                  onClick={() => {
                    setActiveSection('hub');
                    setChatContext(null);
                  }}
                  className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 flex items-center gap-2"
                >
                  <ChevronLeft className="w-6 h-6" />
                  <span className="font-bold">Retour</span>
                </button>
              </header>
              <div className="flex-grow overflow-hidden">
                <ClientChat 
                  courseId={chatContext?.courseId} 
                  registrationId={chatContext?.registrationId} 
                  onClose={() => {
                    setActiveSection('hub');
                    setChatContext(null);
                  }}
                />
              </div>
            </div>
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
                        {course?.title || prop.custom_title || "Formation inconnue"}
                      </h3>
                      
                      {prop.custom_description && (
                        <div className="mb-4">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Votre demande originale :</p>
                          <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed">
                            {prop.custom_description}
                          </p>
                        </div>
                      )}

                      {!prop.custom_description && (
                        <p className="text-gray-500 text-xs mb-4 italic">
                          Vous avez manifesté votre intérêt pour que cette formation soit programmée ou ouverte à l'inscription. Nous analysons la demande générale pour fixer une date.
                        </p>
                      )}
                    </div>

                    {prop.admin_feedback && (
                      <div className="mt-4 p-5 bg-indigo-50/50 border border-indigo-100 rounded-[2rem] text-sm text-slate-900 shadow-sm">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-100">
                            <MessageSquare className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-grow">
                            <div className="flex justify-between items-center mb-1.5">
                              <p className="font-black text-indigo-950 text-xs uppercase tracking-wider">Réponse de l'administration</p>
                              <span className="text-[10px] font-bold text-indigo-400 bg-white px-2 py-0.5 rounded-full border border-indigo-50">OFFICIEL</span>
                            </div>
                            <p className="text-indigo-900 leading-relaxed font-medium italic">
                              "{prop.admin_feedback}"
                            </p>
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
                      
                      <div className="mb-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Détails de votre suggestion :</p>
                        <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed">
                          {prop.custom_description}
                        </p>
                      </div>
                      
                      {prop.proposed_price && (
                        <div className="text-xs text-gray-500 mb-4 bg-gray-50 px-3 py-1.5 rounded-lg inline-block border border-gray-100">
                          Budget suggéré : <strong className="text-gray-800 font-mono">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(prop.proposed_price)}</strong>
                        </div>
                      )}
                    </div>

                    {prop.admin_feedback && (
                      <div className="mt-4 p-5 bg-indigo-50/50 border border-indigo-100 rounded-[2rem] text-sm text-slate-900 shadow-sm">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-100">
                            <MessageSquare className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-grow">
                            <div className="flex justify-between items-center mb-1.5">
                              <p className="font-black text-indigo-950 text-xs uppercase tracking-wider">Réponse de l'administration</p>
                              <span className="text-[10px] font-bold text-indigo-400 bg-white px-2 py-0.5 rounded-full border border-indigo-50">OFFICIEL</span>
                            </div>
                            <p className="text-indigo-900 leading-relaxed font-medium italic">
                              "{prop.admin_feedback}"
                            </p>
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
