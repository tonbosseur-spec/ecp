import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import VerifiedBadge from '../components/VerifiedBadge';
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
  Sparkles,
  Check,
  Settings,
  Lock,
  Users,
  Share2,
  Copy,
  Gift,
  DollarSign,
  TrendingUp,
  Wallet,
  LayoutGrid,
  FolderDown,
  Brain,
  CreditCard
} from 'lucide-react';
import { ClientChat } from '../components/ClientChat';
import ClientSettings from '../components/ClientSettings';
import ClientFilesManager from '../components/ClientFilesManager';
import SplashScreen from '../components/SplashScreen';
import { dailyTips } from '../data/tips';
import { getClientReferralCode, getParrainReferralSales, ReferralCodeInfo, ReferralSale } from '../lib/referralService';
import { loadFromCache, saveToCache } from '../lib/offlineSync';
import { initiateFapshiPayment } from '../lib/paymentService';

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
  const [dailyTip, setDailyTip] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [profile, setProfile] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [interactiveCourses, setInteractiveCourses] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<'hub' | 'inscriptions' | 'interests' | 'proposals' | 'calendar' | 'messages' | 'payments' | 'parrainage' | 'settings' | 'more' | 'files'>('hub');
  const [chatContext, setChatContext] = useState<{courseId?: string, registrationId?: string} | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const sectionParam = searchParams.get('section');
    if (sectionParam) {
      if (sectionParam === 'messages') {
        setActiveSection('messages');
      } else if (sectionParam === 'formations' || sectionParam === 'inscriptions') {
        setActiveSection('inscriptions');
      } else if (['hub', 'interests', 'proposals', 'calendar', 'payments', 'parrainage', 'settings', 'more', 'files'].includes(sectionParam)) {
        setActiveSection(sectionParam as any);
      }
    }
  }, [searchParams]);

  // Referral / Parrainage state
  const [referralCode, setReferralCode] = useState<ReferralCodeInfo | null>(null);
  const [referralSales, setReferralSales] = useState<ReferralSale[]>([]);
  const [referralStats, setReferralStats] = useState({
    totalReferredCount: 0,
    totalSalesVolume: 0,
    totalCommissionEarned: 0
  });
  const [copiedCodeToast, setCopiedCodeToast] = useState(false);
  const [copiedLinkToast, setCopiedLinkToast] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Course detailed content (LMS) states
  const [activeCourseContentReg, setActiveCourseContentReg] = useState<any | null>(null);
  const [courseModules, setCourseModules] = useState<any[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [completedModuleIds, setCompletedModuleIds] = useState<string[]>([]);
  const [allCompletedModuleIds, setAllCompletedModuleIds] = useState<string[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [togglingProgressId, setTogglingProgressId] = useState<string | null>(null);
  const [quizModuleIds, setQuizModuleIds] = useState<string[]>([]);
  const [processingPaymentKey, setProcessingPaymentKey] = useState<string | null>(null);
  const [fapshiError, setFapshiError] = useState<string | null>(null);

  const handlePayWithFapshi = async (options: {
    registrationId?: string;
    courseId?: string;
    amount: number;
    courseTitle?: string;
    paymentType?: 'full' | 'installment';
    trancheNumber?: number;
    keyId: string;
  }) => {
    setProcessingPaymentKey(options.keyId);
    setFapshiError(null);
    try {
      const res = await initiateFapshiPayment({
        registrationId: options.registrationId,
        courseId: options.courseId,
        amount: options.amount,
        courseTitle: options.courseTitle,
        paymentType: options.paymentType,
        trancheNumber: options.trancheNumber
      });
      if (res.success && res.link) {
        window.location.href = res.link;
      } else {
        setFapshiError(res.message || 'Impossible d\'initialiser le paiement Mobile Money.');
        setProcessingPaymentKey(null);
      }
    } catch (err: any) {
      setFapshiError('Erreur de connexion au service de paiement.');
      setProcessingPaymentKey(null);
    }
  };

  useEffect(() => {
    // Handle online/offline events
    const handleOnline = async () => {
      setIsOffline(false);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const userId = session.user.id;
          const offlineActions = loadFromCache('offline_progress_actions_' + userId);
          if (offlineActions && offlineActions.length > 0) {
            // Process offline actions
            for (const action of offlineActions) {
              if (action.isCompleted) {
                await supabase.from('module_progress').insert([{ client_id: userId, module_id: action.moduleId }]);
              } else {
                await supabase.from('module_progress').delete().eq('client_id', userId).eq('module_id', action.moduleId);
              }
            }
            saveToCache('offline_progress_actions_' + userId, []);
          }
        }
      } catch (err) {
        console.error("Error syncing offline actions", err);
      }
      
      fetchClientData(); // Sync when back online
    };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Pick a random tip
    setDailyTip(dailyTips[Math.floor(Math.random() * dailyTips.length)]);

    const fetchClientData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/client/login');
          return;
        }

        const userId = session.user.id;

        // --- OFFLINE FIRST ---
        // Load from cache first for fast display / offline support
        const cachedProfile = loadFromCache('profile_' + userId);
        const cachedRegistrations = loadFromCache('registrations_' + userId);
        const cachedPayments = loadFromCache('payments_' + userId);
        const cachedProgress = loadFromCache('progress_' + userId);
        const cachedProposals = loadFromCache('proposals_' + userId);
        
        if (cachedProfile) setProfile(cachedProfile);
        if (cachedRegistrations) setRegistrations(cachedRegistrations);
        if (cachedPayments) setPayments(cachedPayments);
        if (cachedProgress) setAllCompletedModuleIds(cachedProgress);
        if (cachedProposals) setProposals(cachedProposals);
        const cachedInteractive = loadFromCache('interactive_courses_' + userId);
        if (cachedInteractive) setInteractiveCourses(cachedInteractive);

        if (!navigator.onLine) {
          setLoading(false);
          return;
        }
        // ---------------------

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
          saveToCache('profile_' + userId, profileData);
        } else {
          // Fallback to user metadata
          const fallbackProfile = {
            first_name: session.user.user_metadata?.first_name || 'Client',
            last_name: session.user.user_metadata?.last_name || ''
          };
          setProfile(fallbackProfile);
          saveToCache('profile_' + userId, fallbackProfile);
        }

        // Fetch registrations with courses and nested course modules with module files
        const { data: regData, error: regError } = await supabase
          .from('registrations')
          .select('*, courses(*, course_modules(*, module_files(*)))')
          .eq('client_id', userId)
          .order('registered_at', { ascending: false });

        if (regError) throw regError;

        if (regData) {
          // Filter out registrations where course is null (just in case)
          const validRegs = regData.filter(r => r.courses);
          setRegistrations(validRegs);
          saveToCache('registrations_' + userId, validRegs);
        }

        // Fetch payments
        const { data: payData, error: payError } = await supabase
          .from('payments')
          .select('*, registrations(courses(title))')
          .eq('user_id', userId)
          .order('due_date', { ascending: true });

        if (payError) throw payError;
        if (payData) {
          setPayments(payData);
          saveToCache('payments_' + userId, payData);
        }

        // Fetch client's completed module progress
        const { data: progressData, error: progressError } = await supabase
          .from('module_progress')
          .select('module_id')
          .eq('client_id', userId);
          
        if (!progressError && progressData) {
          const progressIds = progressData.map(p => p.module_id);
          setAllCompletedModuleIds(progressIds);
          saveToCache('progress_' + userId, progressIds);
        }

        // Fetch referral code for parrainage
        const refInfo = await getClientReferralCode(userId);
        if (refInfo) {
          setReferralCode(refInfo);
          const salesData = await getParrainReferralSales(userId, refInfo.code);
          setReferralSales(salesData.sales);
          setReferralStats({
            totalReferredCount: salesData.totalReferredCount,
            totalSalesVolume: salesData.totalSalesVolume,
            totalCommissionEarned: salesData.totalCommissionEarned
          });
        }
        const { data: propData, error: propError } = await supabase
          .from('course_proposals')
          .select('*, courses(*)')
          .eq('client_id', userId)
          .order('created_at', { ascending: false });

        if (propError) throw propError;
        if (propData) {
          setProposals(propData);
          saveToCache('proposals_' + userId, propData);
        }

        // Fetch published interactive courses
        try {
          const { data: interactiveData, error: interactiveError } = await supabase
            .from('interactive_courses')
            .select(`
              *,
              interactive_course_modules (
                id,
                title,
                interactive_course_lessons (
                  id,
                  interactive_activities (id)
                )
              )
            `)
            .eq('status', 'published')
            .order('created_at', { ascending: false });

          if (!interactiveError && interactiveData) {
            setInteractiveCourses(interactiveData);
            saveToCache('interactive_courses_' + userId, interactiveData);
          }
        } catch (interactiveErr) {
          console.warn("Notice: chargement cours interactifs:", interactiveErr);
        }
      } catch (err) {
        console.error("Erreur chargement hub:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [navigate]);

  useEffect(() => {
    if (activeCourseContentReg) {
      fetchCourseContent(activeCourseContentReg.course_id);
    }
  }, [activeCourseContentReg]);

  const fetchCourseContent = async (courseId: string) => {
    try {
      setLoadingContent(true);
      
      const cachedModules = loadFromCache('modules_' + courseId);
      const cachedQuizModules = loadFromCache('quizModules_' + courseId);
      
      if (cachedModules) {
        setCourseModules(cachedModules);
        if (cachedModules.length > 0) setSelectedModuleId(cachedModules[0].id);
      }
      if (cachedQuizModules) {
        setQuizModuleIds(cachedQuizModules);
      }

      if (!navigator.onLine) {
        setLoadingContent(false);
        return;
      }
      
      // Fetch modules for this course
      const { data: modulesData, error: modulesError } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true });
        
      if (modulesError) throw modulesError;
      
      const fetchedModules = modulesData || [];
      setCourseModules(fetchedModules);
      saveToCache('modules_' + courseId, fetchedModules);
      
      // Fetch quiz status for these modules
      if (fetchedModules.length > 0) {
        const { data: quizzesData } = await supabase
          .from('quizzes')
          .select('module_id')
          .in('module_id', fetchedModules.map(m => m.id));
        const qModuleIds = (quizzesData || []).map((q: any) => q.module_id);
        setQuizModuleIds(qModuleIds);
        saveToCache('quizModules_' + courseId, qModuleIds);
      } else {
        setQuizModuleIds([]);
        saveToCache('quizModules_' + courseId, []);
      }

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
          saveToCache('progress_' + session.user.id, completedIds);
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
      
      // Optimitistic update
      if (isCompleted) {
        setCompletedModuleIds(prev => prev.filter(id => id !== moduleId));
        setAllCompletedModuleIds(prev => prev.filter(id => id !== moduleId));
      } else {
        setCompletedModuleIds(prev => [...prev, moduleId]);
        setAllCompletedModuleIds(prev => [...prev, moduleId]);
      }

      if (!navigator.onLine) {
        // Store offline action
        const offlineActions = loadFromCache('offline_progress_actions_' + userId) || [];
        offlineActions.push({ moduleId, isCompleted: !isCompleted });
        saveToCache('offline_progress_actions_' + userId, offlineActions);
        
        // Update cached progress array
        const currentProgress = loadFromCache('progress_' + userId) || [];
        if (isCompleted) {
          saveToCache('progress_' + userId, currentProgress.filter((id: string) => id !== moduleId));
        } else {
          saveToCache('progress_' + userId, [...currentProgress, moduleId]);
        }
        return;
      }
      
      if (isCompleted) {
        const { error } = await supabase
          .from('module_progress')
          .delete()
          .eq('client_id', userId)
          .eq('module_id', moduleId);
          
        if (error) {
           // rollback
           setCompletedModuleIds(prev => [...prev, moduleId]);
           setAllCompletedModuleIds(prev => [...prev, moduleId]);
           throw error;
        }
      } else {
        const { error } = await supabase
          .from('module_progress')
          .insert([{ client_id: userId, module_id: moduleId }]);
          
        if (error) {
           // rollback
           setCompletedModuleIds(prev => prev.filter(id => id !== moduleId));
           setAllCompletedModuleIds(prev => prev.filter(id => id !== moduleId));
           throw error;
        }
      }
      
      // Update cached progress array
      const currentProgress = loadFromCache('progress_' + userId) || [];
      if (isCompleted) {
        saveToCache('progress_' + userId, currentProgress.filter((id: string) => id !== moduleId));
      } else {
        saveToCache('progress_' + userId, [...currentProgress, moduleId]);
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
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoggingOut(false);
      navigate('/client/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
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
    <div className="min-h-screen bg-gray-50 font-sans max-md:[&::-webkit-scrollbar]:hidden max-md:[-ms-overflow-style:none] max-md:[scrollbar-width:none] overflow-y-auto">
      {/* Personalized Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20 pt-safe">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 min-h-[4rem]">
            <div className="flex items-start gap-3">
              {activeSection !== 'hub' && (
                <button 
                  onClick={() => {
                    if (activeCourseContentReg) {
                      setActiveCourseContentReg(null);
                    } else {
                      setActiveSection('hub');
                    }
                  }}
                  className="p-2 -ml-2 mt-0.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500 shrink-0"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight truncate flex items-center gap-1.5">
                    <span>Bonjour, {firstName}</span>
                    <VerifiedBadge size="md" />
                    <span>👋</span>
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
                    Compte Vérifié
                  </span>
                </div>
                {dailyTip && (
                  <p className="text-[11px] text-gray-500 mt-1 italic line-clamp-2 md:line-clamp-1 pr-2 leading-tight">
                    💡 {dailyTip}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={() => navigate('/mobile-landing')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-2xl text-xs font-bold transition-all active:scale-95 shadow-2xs"
                title="Découvrir l'application"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Découvrir l'application</span>
                <span className="sm:hidden">Découvrir</span>
              </button>
            </div>
          </div>
        </div>
        {isOffline && (
          <div className="bg-amber-50 border-b border-amber-100 py-2">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
              <p className="text-xs font-medium text-amber-700">Vous êtes hors ligne. Affichage des données en cache.</p>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Hub / Home View */}
        {activeSection === 'hub' && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Aperçu de votre espace</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
              
              {/* Live Visioconférence */}
              <button 
                onClick={() => navigate('/live')}
                className="col-span-1 md:col-span-2 bg-gradient-to-br from-red-600 via-rose-600 to-red-800 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 md:p-6 relative overflow-hidden text-left group hover:shadow-xl hover:shadow-red-900/20 active:scale-95 transition-all duration-300 text-white flex flex-col justify-between aspect-square md:aspect-auto md:min-h-[160px]"
              >
                <div className="absolute top-0 right-0 p-4 md:p-8 opacity-15 transform translate-x-2 -translate-y-2 md:translate-x-4 md:-translate-y-4 group-hover:scale-110 transition-transform duration-500">
                  <Video className="w-24 h-24 md:w-40 md:h-40 text-white" />
                </div>
                <div className="relative z-10 flex justify-between items-start w-full">
                  <div className="bg-white/20 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-sm">
                    <Video className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <span className="bg-white/20 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full backdrop-blur-sm text-[10px] sm:text-xs font-bold text-white shadow-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span className="hidden sm:inline">Live Direct</span>
                    <span className="sm:hidden">Live</span>
                  </span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-base sm:text-xl md:text-2xl font-black text-white leading-tight mb-0.5 sm:mb-1">Espace Live</h3>
                  <p className="text-red-100 text-[11px] sm:text-xs md:text-sm font-medium line-clamp-2">Visioconférences groupe</p>
                </div>
              </button>

              {/* Mes formations */}
              <button 
                onClick={() => setActiveSection('inscriptions')}
                className="col-span-1 md:col-span-2 bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-800 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 md:p-6 relative overflow-hidden text-left group hover:shadow-xl hover:shadow-purple-900/10 active:scale-95 transition-all duration-300 text-white flex flex-col justify-between aspect-square md:aspect-auto md:min-h-[160px]"
              >
                <div className="absolute top-0 right-0 p-4 md:p-8 opacity-10 transform translate-x-2 -translate-y-2 md:translate-x-4 md:-translate-y-4 group-hover:scale-110 transition-transform duration-500">
                  <BookOpen className="w-24 h-24 md:w-40 md:h-40 text-white" />
                </div>
                <div className="relative z-10 flex justify-between items-start w-full">
                  <div className="bg-white/20 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-sm">
                    <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <span className="bg-white/20 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full backdrop-blur-sm text-[10px] sm:text-xs font-bold text-white shadow-sm">
                    {registrations.length} <span className="hidden sm:inline">formation{registrations.length !== 1 ? 's' : ''}</span>
                  </span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-base sm:text-xl md:text-2xl font-black text-white leading-tight mb-0.5 sm:mb-1">Mes formations</h3>
                  <p className="text-purple-100 text-[11px] sm:text-xs md:text-sm font-medium line-clamp-2">Reprendre votre cours</p>
                </div>
              </button>

              {/* S'exercer */}
              <Link 
                to="/client/training"
                className="col-span-2 md:col-span-2 bg-gradient-to-br from-sky-600 via-indigo-600 to-blue-800 rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 relative overflow-hidden text-left group hover:shadow-xl hover:shadow-sky-900/20 active:scale-95 transition-all duration-300 text-white flex flex-col justify-between min-h-[130px] sm:min-h-[150px] md:min-h-[160px]"
              >
                <div className="absolute top-0 right-0 p-4 md:p-8 opacity-15 transform translate-x-2 -translate-y-2 md:translate-x-4 md:-translate-y-4 group-hover:scale-110 transition-transform duration-500">
                  <Brain className="w-24 h-24 md:w-40 md:h-40 text-white" />
                </div>
                <div className="relative z-10 flex justify-between items-start w-full gap-2">
                  <div className="bg-white/20 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-sm shrink-0">
                    <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <span className="bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-sm text-[10px] sm:text-xs font-bold text-white shadow-sm flex items-center gap-1 shrink-0">
                    <Sparkles className="w-3 h-3 text-sky-200" />
                    <span>Quiz & Pratique</span>
                  </span>
                </div>
                <div className="relative z-10 mt-3 sm:mt-4">
                  <h3 className="text-base sm:text-xl md:text-2xl font-black text-white leading-tight mb-0.5 sm:mb-1">S'exercer</h3>
                  <p className="text-sky-100 text-[11px] sm:text-xs md:text-sm font-medium line-clamp-2">Testez vos connaissances et entraînez-vous sur vos formations.</p>
                </div>
              </Link>

              {/* Mes fichiers / Bibliothèque */}
              <button 
                onClick={() => setActiveSection('files')}
                className="col-span-2 md:col-span-2 bg-gradient-to-br from-purple-700 via-indigo-700 to-blue-800 rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 relative overflow-hidden text-left group hover:shadow-xl hover:shadow-purple-900/20 active:scale-95 transition-all duration-300 text-white flex flex-col justify-between min-h-[130px] sm:min-h-[150px] md:min-h-[160px]"
              >
                <div className="absolute top-0 right-0 p-4 md:p-8 opacity-15 transform translate-x-2 -translate-y-2 md:translate-x-4 md:-translate-y-4 group-hover:scale-110 transition-transform duration-500">
                  <FolderDown className="w-24 h-24 md:w-40 md:h-40 text-white" />
                </div>
                <div className="relative z-10 flex justify-between items-start w-full gap-2">
                  <div className="bg-white/20 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-sm shrink-0">
                    <FolderDown className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <span className="bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-sm text-[10px] sm:text-xs font-bold text-white shadow-sm flex items-center gap-1 shrink-0">
                    <FileText className="w-3 h-3" />
                    <span>Tous vos supports</span>
                  </span>
                </div>
                <div className="relative z-10 mt-3 sm:mt-4">
                  <h3 className="text-base sm:text-xl md:text-2xl font-black text-white leading-tight mb-0.5 sm:mb-1">Mes fichiers</h3>
                  <p className="text-purple-100 text-[11px] sm:text-xs md:text-sm font-medium line-clamp-2">PDF, Word, Excel & E-books de vos cours</p>
                </div>
              </button>

              {/* Catalogue */}
              <Link 
                to="/catalogue"
                className="col-span-1 relative overflow-hidden bg-gray-900 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between text-left group hover:shadow-xl hover:shadow-gray-900/20 active:scale-95 transition-all duration-300 aspect-square"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black opacity-80" />
                <div className="relative z-10 flex justify-between w-full items-start">
                  <div className="bg-white/10 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl text-white group-hover:bg-white/20 transition-all">
                    <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 group-hover:text-white transition-colors" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight mb-0.5">Catalogue</h3>
                  <p className="text-gray-400 text-[11px] sm:text-xs font-medium line-clamp-1">Découvrir plus</p>
                </div>
              </Link>

              {/* Paiement */}
              <button 
                onClick={() => setActiveSection('payments')}
                className="col-span-1 bg-white border border-gray-100 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between text-left group hover:shadow-xl hover:shadow-emerald-900/5 hover:border-emerald-100 active:scale-95 transition-all duration-300 aspect-square"
              >
                <div className="flex justify-between w-full items-start">
                  <div className="bg-emerald-50 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl text-emerald-600 group-hover:bg-emerald-100 transition-all">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  {payments.filter(p => p.status === 'pending').length > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-200 shadow-sm">
                      {payments.filter(p => p.status === 'pending').length}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight mb-0.5">Paiement</h3>
                  <p className="text-gray-500 text-[11px] sm:text-xs font-medium line-clamp-1">Suivi des tranches</p>
                </div>
              </button>

              {/* Voir plus */}
              <button 
                onClick={() => setActiveSection('more')}
                className="col-span-2 md:col-span-2 bg-slate-900 hover:bg-slate-800 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 relative overflow-hidden text-left group hover:shadow-xl hover:shadow-slate-900/20 active:scale-95 transition-all duration-300 text-white flex flex-col justify-between min-h-[120px] md:min-h-[160px]"
              >
                <div className="absolute top-0 right-0 p-4 md:p-6 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform duration-500">
                  <LayoutGrid className="w-24 h-24 md:w-32 md:h-32 text-white" />
                </div>
                <div className="relative z-10 flex justify-between items-start w-full">
                  <div className="bg-white/10 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-sm group-hover:bg-white/20 transition-all">
                    <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 text-purple-300" />
                  </div>
                  <span className="bg-purple-500/20 text-purple-200 border border-purple-400/30 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1">
                    <span>Autres services</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
                <div className="relative z-10 mt-3">
                  <h3 className="text-base sm:text-xl font-bold text-white leading-tight mb-0.5">Voir plus</h3>
                  <p className="text-slate-300 text-[11px] sm:text-xs font-medium line-clamp-1">
                    Calendrier, Messagerie, Suggestions, Parrainage & Paramètres
                  </p>
                </div>
              </button>

            </div>

            {/* Section Cours Interactifs & Auto-formation */}
            <div className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                      Cours interactifs & Auto-formation
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                      <Sparkles className="w-3 h-3 text-sky-500" />
                      Nouveau
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Apprenez à votre rythme avec nos parcours pas à pas
                  </p>
                </div>
              </div>

              {interactiveCourses.length === 0 ? (
                <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 p-6 text-center shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">
                    Parcours interactifs en cours de publication
                  </h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    De nouveaux cours autonomes avec exercices pratiques seront bientôt disponibles ici.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {interactiveCourses.map((course) => {
                    const modulesCount = course.interactive_course_modules?.length || 0;
                    const lessonsCount = (course.interactive_course_modules || []).reduce(
                      (acc: number, m: any) => acc + (m.interactive_course_lessons?.length || 0),
                      0
                    );

                    return (
                      <Link
                        key={course.id}
                        to={`/client/interactive-course/${course.id}`}
                        className="bg-white border border-gray-100 hover:border-sky-200 rounded-2xl md:rounded-3xl p-5 shadow-xs hover:shadow-lg hover:shadow-sky-900/5 transition-all group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-100">
                              {course.category}
                            </span>
                            <span className="text-[11px] font-medium text-gray-400">
                              {course.level === 'beginner' ? 'Débutant' : course.level === 'intermediate' ? 'Intermédiaire' : 'Avancé'}
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-gray-900 group-hover:text-sky-600 transition-colors line-clamp-2 mb-1.5">
                            {course.title}
                          </h4>

                          {course.description && (
                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-4">
                              {course.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-gray-50 flex items-center justify-between mt-2">
                          <div className="text-[11px] font-medium text-gray-400">
                            {modulesCount} chap. • {lessonsCount} leçon{lessonsCount !== 1 ? 's' : ''}
                          </div>

                          <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 group-hover:translate-x-0.5 transition-transform">
                            <span>Accéder</span>
                            <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* View for More / Autre services */}
        {activeSection === 'more' && (
          <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Plus de fonctionnalités</h2>
                <p className="text-xs text-gray-500 mt-0.5">Accédez à l'ensemble de vos modules complémentaires</p>
              </div>
              <button 
                onClick={() => setActiveSection('hub')}
                className="text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-xl transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
              {/* S'exercer */}
              <Link 
                to="/client/training"
                className="col-span-1 bg-white border border-gray-100 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between text-left group hover:shadow-xl hover:shadow-sky-900/5 hover:border-sky-100 active:scale-95 transition-all duration-300 aspect-square"
              >
                <div className="bg-sky-50 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl text-sky-600 group-hover:bg-sky-100 transition-all w-fit">
                  <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight mb-0.5">S'exercer</h3>
                  <p className="text-gray-500 text-[11px] sm:text-xs font-medium line-clamp-1">Quiz & entraînements</p>
                </div>
              </Link>

              {/* Calendrier */}
              <button 
                onClick={() => setActiveSection('calendar')}
                className="col-span-1 bg-white border border-gray-100 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between text-left group hover:shadow-xl hover:shadow-blue-900/5 hover:border-blue-100 active:scale-95 transition-all duration-300 aspect-square"
              >
                <div className="flex justify-between w-full items-start">
                  <div className="bg-blue-50 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  {calendarEvents.length > 0 && (
                    <span className="bg-blue-50 px-2 py-0.5 rounded-full text-[10px] font-bold text-blue-600 border border-blue-100">
                      {calendarEvents.length}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight mb-0.5">Calendrier</h3>
                  <p className="text-gray-500 text-[11px] sm:text-xs font-medium line-clamp-1">Prochains rendez-vous</p>
                </div>
              </button>

              {/* Mes fichiers */}
              <button 
                onClick={() => setActiveSection('files')}
                className="col-span-1 bg-white border border-gray-100 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between text-left group hover:shadow-xl hover:shadow-purple-900/5 hover:border-purple-100 active:scale-95 transition-all duration-300 aspect-square"
              >
                <div className="bg-purple-50 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl text-purple-600 group-hover:bg-purple-100 transition-all w-fit">
                  <FolderDown className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight mb-0.5">Bibliothèque</h3>
                  <p className="text-gray-500 text-[11px] sm:text-xs font-medium line-clamp-1">Tous vos fichiers</p>
                </div>
              </button>

              {/* Messagerie */}
              <button 
                onClick={() => setActiveSection('messages')}
                className="col-span-1 bg-white border border-gray-100 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between text-left group hover:shadow-xl hover:shadow-emerald-900/5 hover:border-emerald-100 active:scale-95 transition-all duration-300 aspect-square"
              >
                <div className="bg-emerald-50 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl text-emerald-600 group-hover:bg-emerald-100 transition-all w-fit">
                  <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight mb-0.5">Messagerie</h3>
                  <p className="text-gray-500 text-[11px] sm:text-xs font-medium line-clamp-1">Échanges & support</p>
                </div>
              </button>

              {/* Mes demandes */}
              <button 
                onClick={() => setActiveSection('proposals')}
                className="col-span-1 bg-white border border-gray-100 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between text-left group hover:shadow-xl hover:shadow-amber-900/5 hover:border-amber-100 active:scale-95 transition-all duration-300 aspect-square"
              >
                <div className="flex justify-between w-full items-start">
                  <div className="bg-amber-50 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl text-amber-600 group-hover:bg-amber-100 transition-all">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  {proposals.length > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-200 shadow-sm">{proposals.length}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight mb-0.5">Mes demandes</h3>
                  <p className="text-gray-500 text-[11px] sm:text-xs font-medium line-clamp-1">Suivi & propositions</p>
                </div>
              </button>

              {/* Parrainage & Commercial (Si code promo attribué) */}
              {referralCode && (
                <button 
                  onClick={() => setActiveSection('parrainage')}
                  className="col-span-1 bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between text-left group hover:shadow-xl hover:shadow-amber-900/20 active:scale-95 transition-all duration-300 text-white relative overflow-hidden aspect-square"
                >
                  <div className="absolute top-0 right-0 p-3 opacity-15 transform translate-x-2 -translate-y-2">
                    <Gift className="w-20 h-20 text-white" />
                  </div>
                  <div className="relative z-10 flex justify-between w-full items-start">
                    <div className="bg-white/20 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-sm">
                      <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black backdrop-blur-sm border border-white/20">
                      10%
                    </span>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-base sm:text-lg font-bold text-white leading-tight mb-0.5">Parrainage</h3>
                    <p className="text-amber-100 text-[11px] sm:text-xs font-medium line-clamp-1">
                      Code : <span className="font-extrabold underline">{referralCode.code}</span>
                    </p>
                  </div>
                </button>
              )}

              {/* Paramètres */}
              <button 
                onClick={() => setActiveSection('settings')}
                className="col-span-1 bg-white border border-gray-100 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between text-left group hover:shadow-xl hover:shadow-indigo-900/5 hover:border-indigo-100 active:scale-95 transition-all duration-300 aspect-square"
              >
                <div className="bg-slate-50 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl text-slate-600 group-hover:bg-slate-100 transition-all w-fit">
                  <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight mb-0.5">Paramètres</h3>
                  <p className="text-gray-500 text-[11px] sm:text-xs font-medium line-clamp-1">Profil & Sécurité</p>
                </div>
              </button>

              {/* Découvrir l'application */}
              <button 
                onClick={() => navigate('/mobile-landing')}
                className="col-span-1 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between text-left group hover:shadow-xl hover:shadow-emerald-900/20 active:scale-95 transition-all duration-300 text-white relative overflow-hidden aspect-square"
              >
                <div className="absolute top-0 right-0 p-3 opacity-15 transform translate-x-2 -translate-y-2">
                  <Sparkles className="w-20 h-20 text-white" />
                </div>
                <div className="relative z-10 flex justify-between w-full items-start">
                  <div className="bg-white/20 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-sm">
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black backdrop-blur-sm border border-white/20">
                    Présentation
                  </span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight mb-0.5">Découvrir l'app</h3>
                  <p className="text-emerald-100 text-[11px] sm:text-xs font-medium line-clamp-1">Revoir la présentation</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Bibliothèque / Mes Fichiers Section */}
        {activeSection === 'files' && (
          <ClientFilesManager
            registrations={registrations}
            userId={profile?.id}
            onBack={() => setActiveSection('hub')}
          />
        )}

        {/* Section Content */}
        {activeSection === 'payments' && (
          <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Suivi de vos paiements</h2>
              <a 
                href={`https://wa.me/237698389030?text=${encodeURIComponent(`Bonjour ! Je suis ${profile?.first_name || ''} ${profile?.last_name || ''} (${profile?.email || ''}). J'ai une question concernant le suivi de mes paiements et mes accès.`)}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                Contacter l'admin
              </a>
            </div>

            {payments.filter(p => p.status === 'pending' && new Date(p.due_date) < new Date()).length === 0 && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <p className="text-sm text-emerald-800 font-medium">
                  Félicitations ! Vous n'avez aucun paiement en retard.
                </p>
              </div>
            )}

            {payments.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
                <p className="text-gray-500 italic">Aucun historique de paiement pour le moment.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {payments.map((payment) => (
                  <div key={payment.id} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        payment.status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {payment.status === 'paid' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{payment.registrations?.courses?.title || 'Formation'}</h4>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Info className="w-3.5 h-3.5" />
                            {payment.payment_type === 'full' ? 'Paiement complet' : `Tranche ${payment.tranche_number}`}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Échéance : {new Date(payment.due_date).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                      <p className="text-lg font-black text-gray-900">{payment.amount.toLocaleString('fr-FR')} FCFA</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          payment.status === 'paid' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {payment.status === 'paid' ? 'Payé' : 'À régler'}
                        </span>
                        {payment.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handlePayWithFapshi({
                                registrationId: payment.registration_id,
                                courseId: payment.course_id,
                                amount: payment.amount,
                                courseTitle: payment.registrations?.courses?.title,
                                paymentType: payment.payment_type,
                                trancheNumber: payment.tranche_number,
                                keyId: `pay-${payment.id}`
                              })}
                              disabled={processingPaymentKey === `pay-${payment.id}`}
                              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                              title="Payer directement par Mobile Money ou Orange Money"
                            >
                              {processingPaymentKey === `pay-${payment.id}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CreditCard className="w-3.5 h-3.5" />
                              )}
                              <span>Payer en ligne</span>
                            </button>
                            <a 
                              href={`https://wa.me/237698389030?text=${encodeURIComponent(`Bonjour ! Je suis ${profile?.first_name || ''} ${profile?.last_name || ''} (${profile?.email || ''}). Je souhaite régler la tranche ${payment.tranche_number} (${payment.amount.toLocaleString('fr-FR')} FCFA) pour la formation "${payment.registrations?.courses?.title || 'Formation'}". Merci de m'indiquer la marche à suivre.`)}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1.5 bg-[#25D366] text-white rounded-lg hover:opacity-90 transition-all"
                              title="Régler via WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="p-6 bg-blue-50 border border-blue-100 rounded-[2rem]">
              <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Comment régler vos tranches ?
              </h4>
              <p className="text-sm text-blue-800 leading-relaxed">
                Pour chaque tranche à régler, effectuez le transfert Mobile Money au <strong>+237 650 989 019</strong> (Pierre Valdeze Mbom Mbom). 
                Une fois le transfert effectué, contactez l'administrateur via WhatsApp avec l'ID de transaction pour qu'il valide votre paiement manuellement.
              </p>
            </div>
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
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-extrabold text-gray-900 leading-tight">
                      {activeCourseContentReg.courses.title}
                    </h2>
                    <button
                      onClick={() => fetchCourseContent(activeCourseContentReg.course_id)}
                      disabled={loadingContent}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors shrink-0"
                      title="Actualiser les modules"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingContent ? 'animate-spin text-purple-600' : ''}`} />
                    </button>
                  </div>
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
                      
                      // Check if locked
                      let isLocked = false;
                      let lockReason = "";
                      for (let i = 0; i < index; i++) {
                        const prevMod = courseModules[i];
                        const prevHasQuiz = quizModuleIds.includes(prevMod.id);
                        const prevCompleted = completedModuleIds.includes(prevMod.id);
                        if (prevHasQuiz && !prevCompleted) {
                          isLocked = true;
                          lockReason = "Vous devez valider le quizz du module précédent pour débloquer ce module.";
                        }

                        const prevSessions = (prevMod.download_files || []).filter((f: any) => f.type === 'session');
                        if (prevSessions.length > 0) {
                          const allPrevSessionsCompleted = prevSessions.every((s: any) => s.isCompleted);
                          if (!allPrevSessionsCompleted) {
                            isLocked = true;
                            lockReason = "Toutes les séances du module précédent doivent être réalisées pour débloquer ce module.";
                          }
                        }
                      }
                      
                      return (
                        <button
                          key={m.id}
                          onClick={() => !isLocked && setSelectedModuleId(m.id)}
                          disabled={isLocked}
                          className={`w-full text-left p-3.5 rounded-xl transition-all flex items-start gap-3 border ${
                            isLocked
                              ? 'bg-gray-50 text-gray-400 border-gray-150 cursor-not-allowed opacity-60'
                              : isSelected
                                ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                : 'bg-white text-gray-700 border-gray-100 hover:bg-gray-100 hover:border-gray-200'
                          }`}
                          title={isLocked ? lockReason : undefined}
                        >
                          <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                            isLocked
                              ? 'bg-gray-100 text-gray-350'
                              : isCompleted 
                                ? isSelected ? 'bg-white text-purple-600' : 'bg-green-100 text-green-600'
                                : isSelected ? 'bg-purple-500 text-purple-100' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {isLocked ? (
                              <Lock className="w-2.5 h-2.5 text-gray-400" />
                            ) : isCompleted ? (
                              <Check className="w-3 h-3 stroke-[3]" />
                            ) : (
                              <span className="text-[10px] font-bold">{index + 1}</span>
                            )}
                          </div>
                          <div className="flex-grow min-w-0">
                            <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${
                              isLocked
                                ? 'text-gray-400/70'
                                : isSelected ? 'text-purple-200' : 'text-gray-400'
                            }`}>
                              Module {index + 1} {isLocked && "(Bloqué)"}
                            </p>
                            <p className={`text-sm font-bold truncate leading-snug ${isLocked ? 'text-gray-400' : ''}`}>
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
                              className="prose max-w-none text-gray-700 leading-relaxed bg-gray-50/50 border border-gray-100 p-6 rounded-2xl animate-fade-in
                                [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_strong]:font-bold [&_em]:italic [&_u]:underline
                                [&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-gray-950 [&_h1]:mt-5 [&_h1]:mb-3 [&_h1]:tracking-tight [&_h1]:border-b [&_h1]:border-gray-100 [&_h1]:pb-1
                                [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-gray-900 [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:tracking-tight
                                [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-gray-900 [&_h3]:mt-3.5 [&_h3]:mb-1.5
                                [&_h4]:text-base [&_h4]:font-bold [&_h4]:text-gray-800 [&_h4]:mt-3 [&_h4]:mb-1 [&_li]:list-none"
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
                to="/catalogue" 
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
                            🔒 Les ressources seront débloquées automatiquement dès réception de votre paiement.
                          </div>
                          
                          <button
                            onClick={() => handlePayWithFapshi({
                              registrationId: reg.id,
                              courseId: course.id,
                              amount: course.price || 1000,
                              courseTitle: course.title,
                              keyId: `reg-${reg.id}`
                            })}
                            disabled={processingPaymentKey === `reg-${reg.id}`}
                            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all text-xs shadow-md active:scale-[0.99] cursor-pointer"
                          >
                            {processingPaymentKey === `reg-${reg.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CreditCard className="w-4 h-4" />
                            )}
                            <span>Régler par Mobile Money (Orange / MTN)</span>
                          </button>

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

        {/* Mes demandes Section */}
        {(activeSection === 'proposals' || (activeSection as string) === 'interests') && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Mes demandes</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Suivi de vos manifestations d'intérêt et propositions d'accompagnement sur mesure.
                </p>
              </div>
              <Link 
                to="/catalogue?action=propose"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shrink-0"
              >
                <Lightbulb className="w-4 h-4 text-amber-400" />
                Faire une demande sur mesure
              </Link>
            </div>

            {proposals.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm max-w-lg mx-auto">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-10 h-10 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Aucune demande pour le moment</h3>
                <p className="text-gray-500 mb-8 text-sm leading-relaxed">
                  Vous n'avez soumis aucune demande d'accompagnement ni marqué d'intérêt pour une formation.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link 
                    to="/catalogue" 
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-sm text-sm"
                  >
                    Voir le catalogue
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {proposals.map((prop, index) => {
                  const date = new Date(prop.created_at);
                  const course = prop.courses;
                  const isCustomProposal = prop.course_id === null;

                  return (
                    <div key={`${prop.id}-${index}`} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                      <div>
                        {/* Type tag & Status badge */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            isCustomProposal 
                              ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                              : 'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}>
                            {isCustomProposal ? (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                <span>Demande sur mesure</span>
                              </>
                            ) : (
                              <>
                                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                                <span>Intérêt Formation</span>
                              </>
                            )}
                          </span>

                          <span className="text-xs text-gray-400 font-mono">
                            {date.toLocaleDateString('fr-FR')}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-bold text-gray-900 mb-3 leading-tight">
                          {course?.title || prop.custom_title || "Formation / Demande inconnue"}
                        </h3>

                        {/* Description */}
                        {prop.custom_description ? (
                          <div className="mb-4 bg-gray-50/70 p-3.5 rounded-2xl border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Détails de votre demande :</p>
                            <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                              {prop.custom_description}
                            </p>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-xs mb-4 italic">
                            Vous avez manifesté votre intérêt pour l'ouverture ou la programmation de cette formation.
                          </p>
                        )}

                        {/* Budget if any */}
                        {prop.proposed_price && (
                          <div className="text-xs text-gray-500 mb-4 bg-gray-50 px-3 py-1.5 rounded-xl inline-block border border-gray-100">
                            Budget suggéré : <strong className="text-gray-800 font-mono">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(prop.proposed_price)}</strong>
                          </div>
                        )}

                        {/* Status */}
                        <div className="mb-2">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            prop.status === 'accepted' ? 'bg-green-50 text-green-700 border border-green-100' :
                            prop.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100' :
                            prop.status === 'reviewed' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                            'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {prop.status === 'accepted' && <span>✅ Demande acceptée</span>}
                            {prop.status === 'rejected' && <span>❌ Écartée</span>}
                            {prop.status === 'reviewed' && <span>📋 En cours d'analyse</span>}
                            {prop.status === 'pending' && <span className="animate-pulse">⏳ En attente de traitement</span>}
                          </span>
                        </div>
                      </div>

                      {/* Admin feedback */}
                      {prop.admin_feedback && (
                        <div className="mt-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-sm text-slate-900 shadow-sm">
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
                              <MessageSquare className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-grow">
                              <div className="flex justify-between items-center mb-1">
                                <p className="font-extrabold text-indigo-950 text-[10px] uppercase tracking-wider">Réponse de l'administration</p>
                                <span className="text-[9px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-100">OFFICIEL</span>
                              </div>
                              <p className="text-indigo-900 leading-relaxed text-xs font-medium italic">
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
            )}
          </div>
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

        {/* Parrainage & Commercial Section */}
        {activeSection === 'parrainage' && (
          <div className="space-y-6 animate-fade-in">
            {!referralCode ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm max-w-lg mx-auto">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
                  <Lock className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Fonctionnalité non attribuée</h3>
                <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                  Vous n'avez pas de code promo de parrainage attribué à votre compte. Seuls les clients disposant d'un code commercial/parrain ont accès à cet espace.
                </p>
                <a 
                  href={`https://wa.me/237698389030?text=${encodeURIComponent(`Bonjour M. l'Administrateur,\n\nJe suis ${profile?.first_name || ''} ${profile?.last_name || ''} (${profile?.email || ''}).\n\nJe souhaite demander l'activation d'un code promo commercial / parrainage pour mon compte afin de commencer à recommander vos formations et percevoir mes 10% de commission.\n\nMerci !`)}`} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors shadow-sm text-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  Demander un code parrain à l'Admin
                </a>
              </div>
            ) : (
              <>
                {/* Header Banner with Promo Code & Copy Buttons */}
                <div className="bg-gradient-to-br from-amber-600 via-orange-600 to-amber-800 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Gift className="w-64 h-64 text-white" />
                  </div>
                  
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-xs font-bold mb-3 backdrop-blur-sm border border-white/20">
                        <Gift className="w-3.5 h-3.5" />
                        Espace Commercial & Parrainage Actif (10%)
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black mb-2">Votre Code Promo : <span className="underline decoration-amber-300">{referralCode.code}</span></h2>
                      <p className="text-amber-100 text-xs sm:text-sm max-w-xl">
                        Partagez votre code avec vos proches ou prospects. Chaque personne s'inscrivant avec votre code bénéficie de 10% de réduction, et vous touchez <strong className="text-white font-bold">10% de commission</strong> sur tous leurs paiements !
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                      {/* Copy Code */}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(referralCode.code);
                          setCopiedCodeToast(true);
                          setTimeout(() => setCopiedCodeToast(false), 2500);
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-gray-900 hover:bg-amber-50 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        {copiedCodeToast ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-amber-600" />}
                        {copiedCodeToast ? 'Code Copié !' : 'Copier le Code'}
                      </button>

                      {/* Copy Share Link */}
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}/catalogue?promo=${referralCode.code}`;
                          navigator.clipboard.writeText(link);
                          setCopiedLinkToast(true);
                          setTimeout(() => setCopiedLinkToast(false), 2500);
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-900/60 hover:bg-amber-900/80 text-white rounded-xl font-bold text-xs transition-all border border-amber-400/30 backdrop-blur-sm active:scale-95 cursor-pointer"
                      >
                        {copiedLinkToast ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4 text-amber-200" />}
                        {copiedLinkToast ? 'Lien Copié !' : 'Copier Lien d\'Affiliation'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3 KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Filleuls */}
                  <div className="bg-white border border-gray-150 rounded-2xl p-5 flex items-center gap-4 shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Filleuls Parrainés</span>
                      <span className="text-2xl font-black text-gray-900">{referralStats.totalReferredCount}</span>
                      <span className="text-[11px] text-gray-400 block mt-0.5">Personne(s) inscrite(s)</span>
                    </div>
                  </div>

                  {/* Ventes Totales */}
                  <div className="bg-white border border-gray-150 rounded-2xl p-5 flex items-center gap-4 shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Ventes Générées</span>
                      <span className="text-2xl font-black text-gray-900">{referralStats.totalSalesVolume.toLocaleString('fr-FR')} FCFA</span>
                      <span className="text-[11px] text-gray-400 block mt-0.5">Volume total d'achats</span>
                    </div>
                  </div>

                  {/* Commissions (10%) */}
                  <div className="bg-white border border-emerald-200 bg-emerald-50/30 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-xs">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                        <Wallet className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Gain Rétribué (10%)</span>
                        <span className="text-2xl font-black text-emerald-900">{referralStats.totalCommissionEarned.toLocaleString('fr-FR')} FCFA</span>
                        <span className="text-[11px] text-emerald-700 block mt-0.5">Votre montant à réclamer</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Claim Money Action Bar */}
                <div className="bg-white border border-amber-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm bg-gradient-to-r from-amber-50/50 to-orange-50/50">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-amber-600" />
                      <span>Réclamer vos gains de parrainage</span>
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      Cliquez ci-dessous pour contacter directement l'administrateur via WhatsApp avec le détail de vos commissions.
                    </p>
                  </div>

                  <a
                    href={`https://wa.me/237698389030?text=${encodeURIComponent(
                      `Bonjour M. l'Administrateur,\n\nJe suis ${profile?.first_name || ''} ${profile?.last_name || ''} (Code Promo: ${referralCode.code}).\n\nJe souhaite réclamer mes commissions de parrainage :\n- Nombre de filleuls : ${referralStats.totalReferredCount}\n- Montant total des commissions (10%) : ${referralStats.totalCommissionEarned.toLocaleString('fr-FR')} FCFA.\n\nMerci de bien vouloir procéder à mon paiement.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-6 py-3.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-sm shrink-0 w-full sm:w-auto cursor-pointer"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Réclamer mon dû sur WhatsApp
                  </a>
                </div>

                {/* Table of Referred Purchases */}
                <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Achats de vos filleuls</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Liste des utilisateurs s'étant inscrits avec votre code promo</p>
                    </div>
                    <span className="text-xs font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                      {referralSales.length} transaction{referralSales.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {referralSales.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 p-6">
                      <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <h4 className="text-sm font-bold text-gray-700">Aucun filleul inscrit pour le moment</h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                        Partagez votre code promo <strong className="text-amber-700 font-mono font-bold">{referralCode.code}</strong> à vos contacts. Dès leur inscription, leurs achats apparaîtront ici automatiquement !
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100 text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">
                            <th className="py-3 px-4">Filleul</th>
                            <th className="py-3 px-4">Formation</th>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Prix Formation</th>
                            <th className="py-3 px-4 text-right">Votre Commission (10%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                          {referralSales.map((sale) => (
                            <tr key={sale.id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="py-3.5 px-4">
                                <span className="font-bold text-gray-900 block">{sale.buyerName}</span>
                                <span className="text-[11px] text-gray-400 block">{sale.buyerEmail}</span>
                              </td>
                              <td className="py-3.5 px-4 font-medium text-gray-800">
                                {sale.courseTitle}
                              </td>
                              <td className="py-3.5 px-4 text-gray-500">
                                {new Date(sale.registeredAt).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="py-3.5 px-4 font-bold text-gray-700">
                                {sale.coursePrice.toLocaleString('fr-FR')} FCFA
                              </td>
                              <td className="py-3.5 px-4 text-right font-black text-emerald-700 bg-emerald-50/40 rounded-lg">
                                +{sale.commissionAmount.toLocaleString('fr-FR')} FCFA
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {/* Paramètres Section */}
        {activeSection === 'settings' && (
          <ClientSettings profile={profile} referralCode={referralCode} onUpdateProfile={setProfile} />
        )}

        {/* Bouton Se déconnecter en bas de page (Même design que dans l'espace Admin) */}
        <div className="mt-8 pt-6 border-t border-gray-200/60">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full group bg-white hover:bg-rose-50/80 p-4 sm:p-5 rounded-3xl border border-rose-100 shadow-xs hover:shadow-md transition-all duration-300 flex items-center justify-between gap-4 active:scale-98 cursor-pointer"
          >
            <div className="flex items-center gap-3.5 sm:gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
                {isLoggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
              </div>
              <div className="text-left">
                <h3 className="text-sm sm:text-base font-extrabold text-gray-900 group-hover:text-rose-900 transition-colors">
                  Se déconnecter
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-500 group-hover:text-rose-700/80 transition-colors">
                  Fermer la session
                </p>
              </div>
            </div>

            <div className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white rounded-xl text-xs font-bold transition-colors shrink-0">
              Déconnexion
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
