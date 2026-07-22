import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { parseCourseQuizSettings } from '../lib/quizUtils';
import { PromoCode, extractCoursePromoCodes, calculateDiscountedPrice } from '../lib/promoUtils';
import { Loader2, Calendar, User, ChevronDown, ChevronUp, Play, CheckCircle2, MessageCircle, Video, FileText, AlertCircle, Download, Globe, Youtube, Star, Facebook, Linkedin, Send, CalendarOff, ArrowLeft, X, CheckCircle, Clock, Ticket, Tag, Sparkles, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const testimonials = [
  {
    id: 1,
    name: "Jean-Claude Tchakounté",
    role: "Étudiant en Master",
    text: "La formation en analyses statistiques est excellente. Les explications sont claires et le suivi est vraiment primordial. J'ai pu soutenir mon mémoire sans aucun problème !",
    initials: "JC",
    rating: 5
  },
  {
    id: 2,
    name: "Marie-Claire Ndom",
    role: "Professionnelle RH",
    text: "Ma maîtrise d'Excel s'est nettement améliorée. J'arrive maintenant à automatiser mes tâches. Le formateur prend le temps de bien expliquer chaque étape.",
    initials: "MC",
    rating: 4
  },
  {
    id: 3,
    name: "Amadou Bouba",
    role: "Doctorant",
    text: "Une approche pédagogique incroyable. Les concepts statistiques complexes deviennent simples. C'est grâce à cet accompagnement que j'ai validé ma thèse.",
    initials: "AB",
    rating: 5
  },
  {
    id: 4,
    name: "Estelle Mvogo",
    role: "Analyste de Données",
    text: "J'ai suivi plusieurs formations, mais celle-ci est de loin la meilleure. Le formateur est à l'écoute et le suivi post-formation est un vrai plus pour s'améliorer.",
    initials: "EM",
    rating: 5
  }
];

export default function PublicCoursePage() {
  const { id } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInactive, setIsInactive] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState<'full' | 'installments'>('full');
  const [countryCode, setCountryCode] = useState('+237');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });

  // Review State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewName, setReviewName] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [dbTestimonials, setDbTestimonials] = useState<any[]>([]);

  // Auth requirement modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalReason, setAuthModalReason] = useState('');

  // Promo Code State
  const [searchParams] = useSearchParams();
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccessMsg, setPromoSuccessMsg] = useState<string | null>(null);
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);

  // Auto-check promo code when course loaded or searchParams changed
  useEffect(() => {
    if (!course) return;
    const urlPromo = searchParams.get('promo');
    const storedPromo = id ? localStorage.getItem(`promo_${id}`) : null;
    const codeToTest = (urlPromo || storedPromo || '').trim().toUpperCase();

    if (codeToTest) {
      applyCode(codeToTest, false);
    }
  }, [course, searchParams]);

  const applyCode = async (code: string, isManual: boolean = true) => {
    if (!course) return;
    setPromoError(null);
    setPromoSuccessMsg(null);

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setPromoError("Veuillez saisir un code promo.");
      return;
    }

    if (isManual) {
      setIsCheckingPromo(true);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setIsCheckingPromo(false);
    }

    const availablePromos = extractCoursePromoCodes(course);
    const match = availablePromos.find(p => p.code.trim().toUpperCase() === cleanCode);

    if (match) {
      setAppliedPromo(match);
      setPromoInput(cleanCode);
      const discountLabel = match.discount_type === 'fixed' 
        ? `${(match.discount_value || 0).toLocaleString('fr-FR')} FCFA` 
        : `${match.discount_value}%`;
      setPromoSuccessMsg(`Code "${match.code}" appliqué avec succès (-${discountLabel}) !`);
      if (id) {
        try { localStorage.setItem(`promo_${id}`, cleanCode); } catch (e) {}
      }
    } else {
      if (isManual) {
        setPromoError(`Le code "${cleanCode}" est invalide ou non applicable à cette formation.`);
      }
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
    setPromoSuccessMsg(null);
    if (id) {
      try { localStorage.removeItem(`promo_${id}`); } catch (e) {}
    }
  };

  const basePrice = course?.price_fcfa || 0;
  const discountCalculation = appliedPromo ? calculateDiscountedPrice(basePrice, appliedPromo) : { finalPrice: basePrice, discountAmount: 0, savings: 0 };
  const effectivePrice = discountCalculation.finalPrice || 0;

  // Accordion State
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  const [showCalendarMenu, setShowCalendarMenu] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  const generateIcs = () => {
    if (!course) return;
    const date = new Date(course.date_time);
    const endDate = new Date(date.getTime() + 2 * 60 * 60 * 1000); // assume 2 hours
    
    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, '');
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${course.title}
DTSTART:${formatDate(date)}
DTEND:${formatDate(endDate)}
DESCRIPTION:${course.description || ''}
LOCATION:${course.google_meet_link || 'En ligne'}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${course.title.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowCalendarMenu(false);
  };

  const generateGoogleCalendarLink = () => {
    if (!course) return '#';
    const date = new Date(course.date_time);
    const endDate = new Date(date.getTime() + 2 * 60 * 60 * 1000); // assume 2 hours
    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, '');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: course.title,
      dates: `${formatDate(date)}/${formatDate(endDate)}`,
      details: course.description || '',
      location: course.google_meet_link || '',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const fetchTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDbTestimonials(data || []);
    } catch (err: any) {
      console.error('Error fetching testimonials:', err.message);
    }
  };

  useEffect(() => {
    if (id) fetchCourse();
    fetchTestimonials();
    
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setClientId(session.user.id);
          setEmail(session.user.email || '');
          
          const { data: profile } = await supabase
            .from('client_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          if (profile) {
            setName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim());
            if (profile.phone) {
              setPhone(profile.phone);
              setCountryCode(''); // reset since full number might be in phone
            }
          } else if (session.user.user_metadata) {
            setName(`${session.user.user_metadata.first_name || ''} ${session.user.user_metadata.last_name || ''}`.trim());
            if (session.user.user_metadata.phone) {
               setPhone(session.user.user_metadata.phone);
               setCountryCode('');
            }
          }
        }
      } catch (err) {
        console.error("Error checking user:", err);
      }
    };
    checkUser();
  }, [id]);

  useEffect(() => {
    if (course) {
      document.title = `Exceller chez Pierre : ${course.title}`;
    } else {
      document.title = 'Exceller chez Pierre';
    }
  }, [course]);

  const fetchCourse = async () => {
    try {
      setLoading(true);
      
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select(`
          *,
          trainers (*),
          templates (*),
          course_modules (*),
          registrations (count)
        `)
        .eq('id', id)
        .single();

      if (courseError) throw courseError;
      
      if (courseData.is_active === false || courseData.is_archived === true) {
        setIsInactive(true);
        setLoading(false);
        return;
      }

      // Sort modules by order_index
      if (courseData && courseData.course_modules) {
         courseData.course_modules.sort((a: any, b: any) => a.order_index - b.order_index);
      }
      
      const registeredCount = courseData.registrations?.[0]?.count || 0;
      const remainingSeats = courseData.max_seats ? courseData.max_seats - registeredCount : null;

      setCourse({ ...courseData, registeredCount, remainingSeats });
    } catch (err: any) {
      setError("Impossible de charger la formation. Le lien est peut-être invalide.");
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (moduleId: string) => {
    setOpenModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const scrollToForm = () => {
    if (!clientId) {
      setAuthModalReason(course?.product_type === 'ebook' ? "télécharger cet E-book" : "vous inscrire à cette formation");
      setShowAuthModal(true);
      return;
    }
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // If it's a paid product, open the payment modal. Otherwise, submit immediately.
    if (course && effectivePrice > 0) {
      setShowPaymentModal(true);
    } else {
      await submitRegistration(true);
    }
  };

  const submitRegistration = async (isFree: boolean = false) => {
    setSubmitting(true);
    setFormError(null);

    try {
      if (course.max_seats) {
        const { count, error: countError } = await supabase
          .from('registrations')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', id);
          
        if (countError) throw countError;
        
        if (count !== null && count >= course.max_seats) {
          setFormError("Désolé, cette formation est complète. Les inscriptions sont fermées.");
          setSubmitting(false);
          // Update local state to hide form immediately
          setCourse({ ...course, remainingSeats: 0 });
          return;
        }
      }

      const { data: registration, error: regError } = await supabase
        .from('registrations')
        .insert([{
          course_id: id,
          client_id: clientId,
          participant_name: name,
          participant_email: email,
          participant_phone: countryCode + phone.replace(/\s+/g, ''),
          transaction_id: isFree ? 'GRATUIT' : transactionId,
          payment_status: isFree ? 'approved' : 'pending',
          payment_mode: isFree ? 'full' : paymentMode
        }])
        .select()
        .single();

      if (regError) throw regError;

      // Create initial payment record if not free
      if (!isFree && registration) {
        const initialAmount = paymentMode === 'full' 
          ? effectivePrice 
          : Math.floor(effectivePrice * 0.5);

        await supabase.from('payments').insert([{
          registration_id: registration.id,
          user_id: clientId,
          amount: initialAmount,
          status: 'pending',
          payment_type: paymentMode === 'full' ? 'full' : 'installment',
          tranche_number: 1,
          due_date: new Date().toISOString()
        }]);

        // If installments, create the second tranche (placeholder)
        if (paymentMode === 'installments') {
          const secondAmount = effectivePrice - initialAmount;
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          
          await supabase.from('payments').insert([{
            registration_id: registration.id,
            user_id: clientId,
            amount: secondAmount,
            status: 'pending',
            payment_type: 'installment',
            tranche_number: 2,
            due_date: nextMonth.toISOString()
          }]);
        }
      }
      
      const isPreRegistration = course.is_date_tbd || !course.date_time;
      const successMessage = isPreRegistration
        ? "Pré-inscription validée ! Nous vous informerons dès que la date sera fixée."
        : "Votre inscription a été enregistrée avec succès !";

      setToast({
        show: true,
        message: successMessage,
        type: 'success'
      });

      setSuccess(true);
      setShowPaymentModal(false);
    } catch (err: any) {
      setFormError("Une erreur est survenue lors de l'inscription.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewSubmitting(true);
    try {
      const { error } = await supabase
        .from('testimonials')
        .insert([{
          name: reviewName,
          status: reviewStatus,
          comment: reviewComment,
          rating: reviewRating
        }]);
      if (error) throw error;
      setReviewSuccess(true);
      fetchTestimonials();
      setTimeout(() => {
        setShowReviewModal(false);
        setReviewSuccess(false);
        setReviewName('');
        setReviewStatus('');
        setReviewComment('');
        setReviewRating(5);
      }, 2000);
    } catch (err: any) {
      console.error('Error adding review:', err.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Chargement des détails de la formation...</p>
      </div>
    );
  }

  if (isInactive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-10 rounded-3xl shadow-lg border border-red-100 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CalendarOff className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">Formation Indisponible</h2>
          <p className="text-gray-500 text-lg leading-relaxed">
            Cette formation n'est actuellement plus disponible ou a déjà eu lieu. Merci de votre intérêt !
          </p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Oups !</h2>
          <p className="text-gray-500">{error || "Formation introuvable."}</p>
        </div>
      </div>
    );
  }

  const formattedDate = (course.is_date_tbd || !course.date_time)
    ? "Date à déterminer"
    : new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(course.date_time));

  const template = course?.templates;
  const primaryColor = template?.primary_color || '#16a34a';
  const primaryColorLight = primaryColor + '40';
  const bgClass = template?.bg_pattern || 'bg-green-50/30';

  const allTestimonials = [
    ...dbTestimonials.map(t => ({
      id: t.id,
      name: t.name,
      role: t.status,
      text: t.comment,
      rating: t.rating,
      initials: t.name.substring(0, 2).toUpperCase()
    })),
    ...testimonials
  ];

  return (
    <div className={`min-h-screen ${bgClass} font-sans pb-20 theme-page`}>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Dancing+Script:wght@600;700&display=swap');
        .theme-page {
          --theme-primary: ${primaryColor};
          --theme-primary-light: ${primaryColorLight};
        }
        .theme-text { color: var(--theme-primary) !important; }
        .theme-bg { background-color: var(--theme-primary) !important; color: #111827 !important; }
        .theme-border { border-color: var(--theme-primary) !important; }
        .theme-border-light { border-color: var(--theme-primary-light) !important; }
        .theme-gradient { background: linear-gradient(to right, var(--theme-primary), var(--theme-primary-light)) !important; }
        .theme-bg-light { background-color: var(--theme-primary-light) !important; color: #111827 !important; }
        .font-handwritten {
          font-family: 'Dancing Script', 'Caveat', cursive, sans-serif !important;
        }
      `}} />

      {/* Header */}
      <header className={`bg-white shadow-md sticky top-0 z-40 border-b theme-border-light transition-all duration-500 ease-in-out ${isScrolled ? 'py-2 shadow-sm' : 'py-3 sm:py-4 shadow-md'}`}>
        <div className={`max-w-3xl mx-auto px-4 flex flex-col items-center justify-center text-center transition-all duration-500 ease-in-out ${isScrolled ? 'gap-1.5' : 'gap-3'}`}>
          {/* Top Row: Back button, Title, Espace button */}
          <div className="w-full flex items-center justify-between gap-4">
            <a 
              href="/client/marketplace" 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-gray-700 hover:text-gray-950 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-all shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Boutique</span>
            </a>
            
            <h1 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
              Exceller chez Pierre
            </h1>
            
            <a 
              href="/client/login" 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-gray-700 hover:text-gray-950 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-all shadow-xs"
            >
              <User className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden sm:inline">Mon Espace</span>
            </a>
          </div>

          {/* Cover image or pattern render inside the header */}
          {course && (
            <div 
              className={`w-full transition-all duration-500 ease-in-out rounded-2xl overflow-hidden shadow-inner relative border border-gray-150/80 bg-white ${
                isScrolled ? 'max-w-xs h-10 sm:h-12' : 'max-w-md h-48 sm:h-[280px]'
              }`}
            >
              {course.cover_image_url ? (
                <img 
                  src={course.cover_image_url} 
                  alt={course.title} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                />
              ) : (
                /* Beautiful abstract render with patterns & theme gradient if no image */
                <div className="w-full h-full theme-gradient flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_15%,transparent_16%)] [background-size:16px_16px]"></div>
                  <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,#fff_25%,transparent_25%,transparent_75%,#fff_75%,#fff),linear-gradient(45deg,#fff_25%,transparent_25%,transparent_75%,#fff_75%,#fff)] [background-size:20px_20px] [background-position:0_0,10px_10px]"></div>
                  <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/20 rounded-full blur-lg"></div>
                  <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-white/20 rounded-full blur-lg"></div>
                  <div className={`relative text-center px-4 transition-all duration-500 ${isScrolled ? 'py-0.5' : 'py-3'}`}>
                    {!isScrolled && (
                      <span className="text-white font-extrabold text-[10px] sm:text-xs tracking-wider uppercase bg-white/20 px-2.5 py-0.5 rounded-full">
                        {course.product_type === 'ebook' ? "📖 E-book" : "🎓 Formation"}
                      </span>
                    )}
                    <p className={`text-white font-bold max-w-sm line-clamp-1 transition-all duration-500 ${isScrolled ? 'text-[10px] sm:text-xs mt-0' : 'text-xs sm:text-sm mt-1'}`}>
                      {course.title}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 mt-8 space-y-8 sm:space-y-12">
        {/* Hero Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border theme-border text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 theme-gradient"></div>
          
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            {course.product_type === 'ebook' ? (
              <>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full text-sm font-bold text-purple-800 border border-purple-200 shadow-xs">
                  <FileText className="w-4 h-4 text-purple-700" />
                  <span>📖 Livre Numérique (E-book)</span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full text-sm font-bold text-green-700 border border-green-200">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                  <span>⚡ Accès immédiat</span>
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-2 px-4 py-2 theme-bg-light rounded-full text-sm font-semibold theme-text border theme-border-light shadow-xs">
                  <span>🎓 Formation</span>
                </div>
                {course.is_date_tbd || !course.date_time ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-full text-sm font-bold text-amber-800 border border-amber-200 shadow-xs">
                    <span>🗓️ Date à déterminer</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-sm font-semibold text-blue-700 border border-blue-200">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span className="capitalize">{formattedDate}</span>
                  </div>
                )}
              </>
            )}
            
            {course.product_type !== 'ebook' && (
              course.max_seats ? (
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${course.remainingSeats && course.remainingSeats > 0 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                  <User className="w-4 h-4" />
                  {course.remainingSeats && course.remainingSeats > 0 ? (
                    <span>{course.remainingSeats} {course.remainingSeats > 1 ? 'places restantes' : 'place restante'} sur {course.max_seats}</span>
                  ) : (
                    <span>Complet ({course.max_seats} inscrits)</span>
                  )}
                </div>
              ) : (
                course.registeredCount > 0 && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-full text-sm font-medium border border-gray-200">
                    <User className="w-4 h-4" />
                    <span>{course.registeredCount} {course.registeredCount > 1 ? 'inscrits' : 'inscrit'}</span>
                  </div>
                )
              )
            )}
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-6">
            {course.title}
          </h1>
          
          {course.description && (
            course.description.includes('<') && course.description.includes('>') ? (
              <div 
                className="text-gray-600 text-base sm:text-lg leading-relaxed mb-6 max-w-2xl mx-auto prose max-w-none text-left sm:text-center
                  [&>ul]:list-disc [&>ul]:inline-block [&>ul]:text-left [&>ol]:list-decimal [&>ol]:inline-block [&>ol]:text-left 
                  [&_strong]:font-bold [&_em]:italic [&_u]:underline
                  [&_h1]:text-2xl [&_h1]:font-black [&_h1]:mb-4 [&_h1]:text-gray-900
                  [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:text-gray-800
                  [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:text-gray-800"
                dangerouslySetInnerHTML={{ __html: course.description }}
              />
            ) : (
              <p className="text-gray-600 text-base sm:text-lg leading-relaxed mb-6 max-w-2xl mx-auto whitespace-pre-wrap">
                {course.description}
              </p>
            )
          )}

          {course.product_type === 'ebook' ? (
            <div className="mb-8 p-5 bg-purple-50/50 border border-purple-200/60 rounded-2xl max-w-md mx-auto text-center shadow-xs">
              <span className="text-purple-800 font-bold text-sm flex items-center justify-center gap-1.5">
                📖 Livre Numérique (Téléchargement)
              </span>
              <span className="text-xs text-purple-600 block mt-1.5 leading-relaxed">
                Ce produit est un livre électronique au format PDF. Vous en obtiendrez l'<strong>accès immédiat</strong> pour consultation et téléchargement dans votre <strong>Espace Personnel</strong> dès validation de votre commande.
              </span>
            </div>
          ) : (
            <div className="mb-8 p-5 bg-emerald-50/50 border border-emerald-200/60 rounded-2xl max-w-md mx-auto text-center shadow-xs">
              <span className="text-emerald-800 font-bold text-sm flex items-center justify-center gap-1.5">
                🎓 Formation en ligne interactive
              </span>
              <span className="text-xs text-emerald-600 block mt-1.5 leading-relaxed">
                Ce produit est une session de formation en direct. Vous aurez accès aux modules, au groupe WhatsApp d'entraide, à la visioconférence et au guide de préparation.
              </span>
            </div>
          )}

          <div className="flex flex-col items-center justify-center gap-2 mb-6">
            <span className="text-sm theme-text uppercase tracking-widest font-bold">
              {course.product_type === 'ebook' ? "Prix de l'e-book" : "Tarif d'inscription"}
            </span>
            {basePrice === 0 ? (
              <span className="text-4xl sm:text-5xl font-black theme-text animate-pulse">
                Gratuit !
              </span>
            ) : appliedPromo ? (
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl font-bold text-gray-400 line-through">
                    {basePrice.toLocaleString('fr-FR')} FCFA
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    Code {appliedPromo.code} (-{appliedPromo.discount_value}{appliedPromo.discount_type === 'fixed' ? ' FCFA' : '%'})
                  </span>
                </div>
                <div className="text-4xl sm:text-5xl font-black text-emerald-600">
                  {effectivePrice.toLocaleString('fr-FR')} <span className="text-xl text-emerald-700 font-medium">FCFA</span>
                </div>
              </div>
            ) : (
              <span className="text-4xl sm:text-5xl font-black text-gray-900">
                {basePrice.toLocaleString('fr-FR')} <span className="text-xl text-gray-500 font-medium">FCFA</span>
              </span>
            )}
          </div>

          {/* Interactive Promo Code Box */}
          {basePrice > 0 && (
            <div className="w-full max-w-md mx-auto mb-8 bg-slate-50 border border-slate-200/90 rounded-2xl p-4 shadow-2xs text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-indigo-600" />
                  Code Promotionnel Privilège
                </span>
                {appliedPromo && (
                  <button 
                    onClick={removePromo} 
                    className="text-xs text-red-600 font-bold hover:underline cursor-pointer"
                  >
                    Retirer le code
                  </button>
                )}
              </div>

              {appliedPromo ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-extrabold text-emerald-950 font-mono">
                        {appliedPromo.code}
                      </p>
                      <p className="text-[11px] text-emerald-700 font-medium">
                        Réduction de -{appliedPromo.discount_value}{appliedPromo.discount_type === 'fixed' ? ' FCFA' : '%'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                    -{(discountCalculation.savings ?? discountCalculation.discountAmount ?? 0).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      disabled={isCheckingPromo}
                      onChange={(e) => setPromoInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isCheckingPromo) {
                          e.preventDefault();
                          applyCode(promoInput, true);
                        }
                      }}
                      placeholder="Ex: EXPERT50, BOOST20..."
                      className="flex-1 px-3.5 py-2.5 text-xs font-mono font-bold uppercase bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                    <button
                      type="button"
                      disabled={isCheckingPromo}
                      onClick={() => applyCode(promoInput, true)}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-colors shrink-0 shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 min-w-[95px]"
                    >
                      {isCheckingPromo ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Vérification...</span>
                        </>
                      ) : (
                        'Appliquer'
                      )}
                    </button>
                  </div>
                  <AnimatePresence mode="wait">
                    {isCheckingPromo && (
                      <motion.div
                        key="promo-checking"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="p-2.5 bg-indigo-50 border border-indigo-200/80 rounded-xl text-[11px] font-semibold text-indigo-700 flex items-center gap-2 shadow-2xs"
                      >
                        <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
                        <span>Vérification du code promo en cours...</span>
                      </motion.div>
                    )}
                    {!isCheckingPromo && promoError && (
                      <motion.div
                        key="promo-error"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="p-2.5 bg-red-50 border border-red-200/80 rounded-xl text-[11px] font-semibold text-red-700 flex items-center gap-1.5 shadow-2xs"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span>{promoError}</span>
                      </motion.div>
                    )}
                    {!isCheckingPromo && promoSuccessMsg && (
                      <motion.div
                        key="promo-success"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="p-2.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5 shadow-2xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{promoSuccessMsg}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {course.product_type !== 'ebook' && course.remainingSeats === 0 ? (
            <button 
              disabled
              className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-semibold text-lg cursor-not-allowed border border-gray-200"
            >
              Formation complète
            </button>
          ) : (
            <button 
              onClick={scrollToForm}
              className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 theme-bg rounded-2xl font-bold text-lg hover:opacity-90 transition-all active:scale-[0.98] animate-pulse hover:animate-none"
            >
              {course.product_type === 'ebook' 
                ? (course.price_fcfa === 0 ? "Télécharger cet E-book" : "Acheter cet E-book") 
                : ((course.is_date_tbd || !course.date_time) ? "Se pré-inscrire" : "S'inscrire")
              }
            </button>
          )}

          {course.youtube_video_url && (
            <div className="mt-6">
              <a 
                href={course.youtube_video_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 text-sm font-medium theme-text hover:opacity-80 transition-opacity theme-bg-light px-4 py-2 rounded-full border theme-border-light"
              >
                <Play className="w-4 h-4" />
                Voir la vidéo de présentation
              </a>
            </div>
          )}
        </motion.section>

        {/* Modules Section */}
        {course.course_modules && course.course_modules.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-gray-900 px-2 mb-2 flex items-center gap-2">
              <span className="text-2xl">📚</span> {course.product_type === 'ebook' ? "Sommaire / Chapitres de l'E-book" : "Programme de la formation"}
            </h2>
            <div className="space-y-3">
              {course.course_modules.map((module: any, idx: number) => (
                <div key={`${module.id}-${idx}`} className="bg-white border theme-border rounded-2xl overflow-hidden transition-all shadow-sm hover:shadow-md">
                  <button 
                    onClick={() => toggleModule(module.id)}
                    className="w-full px-5 py-4 flex items-center justify-between bg-white text-left focus:outline-none"
                  >
                    <div className="flex items-center gap-4 pr-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full theme-bg-light flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">{module.title}</h3>
                        {module.scheduled_date && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full border border-emerald-100">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(module.scheduled_date).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                    {openModules[module.id] ? (
                      <ChevronUp className="w-5 h-5 theme-text flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  
                  <div 
                    className={`px-5 pb-5 pt-1 text-gray-600 text-sm sm:text-base leading-relaxed transition-all overflow-hidden ${openModules[module.id] ? 'block' : 'hidden'}`}
                  >
                    <div className="pl-12">
                      {module.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Trainer Section */}
        {course.trainers && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border theme-border relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 theme-bg-light rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-6 border-b theme-border-light pb-4 flex items-center gap-2">
              <span className="text-2xl">{course.product_type === 'ebook' ? "✍️" : "🎓"}</span> {course.product_type === 'ebook' ? "Auteur" : "Animé par"}
            </h2>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left relative z-10">
              {course.trainers.photo_url ? (
                <img 
                  src={course.trainers.photo_url} 
                  alt={course.trainers.name} 
                  className="w-24 h-24 rounded-full object-cover shadow-md border-4 border-white" 
                />
              ) : (
                <div className="w-24 h-24 rounded-full theme-bg-light flex flex-shrink-0 items-center justify-center border-4 border-white shadow-sm">
                  <User className="w-10 h-10 theme-text" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{course.trainers.name}</h3>
                {course.trainers.description && (
                  <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                    {course.trainers.description}
                  </p>
                )}
              </div>
            </div>
          </motion.section>
        )}

        {/* Testimonials Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
              Ce qu'ils en disent
            </h2>
            <button
              onClick={() => setShowReviewModal(true)}
              className="text-sm font-medium theme-text hover:underline transition-colors px-3 py-1.5 rounded-lg theme-bg-light"
            >
              Laissez un avis
            </button>
          </div>
          <div className="flex overflow-x-auto gap-4 pb-6 snap-x hide-scrollbar px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style dangerouslySetInnerHTML={{__html: `
              .hide-scrollbar::-webkit-scrollbar {
                display: none;
              }
            `}} />
            {allTestimonials.map((testimonial, index) => (
              <div 
                key={`${testimonial.id}-${index}`} 
                className="min-w-[280px] sm:min-w-[320px] bg-white rounded-3xl p-6 shadow-sm border theme-border snap-center flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${(testimonial.rating || 5) > i ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <p className="text-gray-700 italic mb-6 leading-relaxed text-sm sm:text-base">
                    "{testimonial.text}"
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full theme-bg-light theme-text font-bold flex items-center justify-center flex-shrink-0">
                    {testimonial.initials}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{testimonial.name}</h4>
                    <p className="text-xs text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Registration Form / Success Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          ref={formRef} 
          className="bg-gray-900 text-white rounded-3xl p-6 sm:p-10 shadow-2xl overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-gray-800 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gray-800 rounded-tr-full -ml-10 -mb-10 opacity-50 pointer-events-none"></div>
          
          {success ? (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="text-center space-y-6 py-4 relative z-10"
            >
              <div className="w-16 h-16 theme-bg-light theme-text rounded-full flex items-center justify-center mx-auto mb-2 relative">
                <div className="absolute inset-0 theme-bg rounded-full animate-ping opacity-20"></div>
                <CheckCircle2 className="w-8 h-8 relative z-10" />
              </div>

              {course.product_type === 'ebook' ? (
                <>
                  <h2 className="text-2xl font-bold">Commande validée !</h2>
                  <p className="text-gray-300 max-w-md mx-auto leading-relaxed">
                    Merci <strong className="text-white">{name}</strong>. Votre demande pour l'e-book <strong>{course.title}</strong> a bien été enregistrée.
                  </p>

                  {course.price_fcfa === 0 && course.download_file_url ? (
                    <div className="p-6 bg-purple-600/20 border border-purple-500/30 rounded-2xl text-center space-y-4 max-w-md mx-auto">
                      <p className="text-sm text-purple-200">Votre e-book gratuit est prêt à être téléchargé !</p>
                      <a
                        href={course.download_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all shadow-md"
                      >
                        <Download className="w-5 h-5 text-white" />
                        <span>Télécharger l'E-book (PDF)</span>
                      </a>
                    </div>
                  ) : (
                    <p className="text-amber-300 text-sm p-4 bg-gray-800/80 rounded-xl border border-gray-700 text-center mt-4">
                      ⏳ Dès que l'administrateur aura validé votre paiement Mobile Money, votre e-book sera débloqué et téléchargeable dans votre <strong>Espace Personnel</strong>.
                    </p>
                  )}

                  <div className="pt-4">
                    <a 
                      href="/client/hub" 
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-gray-950 hover:bg-gray-100 rounded-xl font-bold transition-all"
                    >
                      <User className="w-4 h-4 text-gray-600" />
                      Accéder à mon Espace Personnel
                    </a>
                  </div>
                </>
              ) : (
                <>
                  {(course.is_date_tbd || !course.date_time) ? (
                    <>
                      <h2 className="text-2xl font-bold">Pré-inscription validée !</h2>
                      <p className="text-gray-300 max-w-md mx-auto leading-relaxed">
                        Merci <strong className="text-white">{name}</strong>. Votre pré-inscription a été prise en compte. Nous vous informerons dès que la date sera fixée.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold">Inscription confirmée !</h2>
                      <p className="text-gray-300 max-w-md mx-auto leading-relaxed">
                        Merci <strong className="text-white">{name}</strong>. Votre inscription à la formation a été enregistrée avec succès. Voici les informations pour y accéder :
                      </p>
                    </>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 text-left">
                    {course.whatsapp_link && (
                      <a href={course.whatsapp_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-gray-800/80 rounded-xl hover:bg-gray-700 transition-colors border border-gray-700 shadow-sm">
                        <div className="p-2 theme-bg-light theme-text rounded-lg">
                          <MessageCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-white">Groupe WhatsApp</div>
                          <div className="text-xs text-gray-400">Rejoindre les autres participants</div>
                        </div>
                      </a>
                    )}
                    
                    {course.google_meet_link && (
                      <a href={course.google_meet_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-gray-800/80 rounded-xl hover:bg-gray-700 transition-colors border border-gray-700 shadow-sm">
                        <div className="p-2 theme-bg-light theme-text rounded-lg">
                          <Video className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-white">Google Meet</div>
                          <div className="text-xs text-gray-400">Lien de la visioconférence</div>
                        </div>
                      </a>
                    )}
                    
                    {course.guide_url && (
                      <div className="col-span-1 sm:col-span-2 mt-4 p-5 bg-gray-800/80 rounded-2xl border border-gray-700 shadow-sm">
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                          <FileText className="w-5 h-5 theme-text" />
                          Guide de préparation
                        </h3>
                        <p className="text-sm text-gray-300 mb-4">
                          {parseCourseQuizSettings(course.guide_text).guideText || 'Nous avons préparé un guide pour vous aider à bien démarrer. Téléchargez-le et lisez-le avant la session.'}
                        </p>
                        <a 
                          href={course.guide_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-md"
                        >
                          <Download className="w-4 h-4" />
                          Télécharger le guide
                        </a>
                      </div>
                    )}
                  </div>
                  
                  {!course.is_date_tbd && course.date_time && (
                    <div className="mt-8 pt-8 border-t border-gray-800">
                      <h3 className="text-lg font-bold text-white mb-2">Ajoutez cet événement à votre agenda</h3>
                      <div className="relative inline-block text-left mt-2">
                        <button 
                          onClick={() => setShowCalendarMenu(!showCalendarMenu)}
                          className="flex items-center gap-2 px-4 py-3 bg-gray-800/80 text-white border border-gray-700 rounded-xl hover:bg-gray-700 transition-colors shadow-sm font-medium"
                        >
                          <Calendar className="w-5 h-5 theme-text" />
                          Ajouter au calendrier
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>
                        
                        {showCalendarMenu && (
                          <div className="absolute left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:right-0 mt-2 w-64 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 z-50 overflow-hidden">
                            <div className="py-1">
                              <a
                                href={generateGoogleCalendarLink()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors font-medium"
                              >
                                Ajouter à Google Agenda
                              </a>
                              <button
                                onClick={generateIcs}
                                className="group flex w-full items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors font-medium text-left border-t border-gray-100"
                              >
                                Télécharger pour Outlook/Apple
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!(course.whatsapp_link || course.google_meet_link || course.guide_url) && (
                    <p className="text-gray-300 text-sm p-4 bg-gray-800/80 rounded-xl border border-gray-700 text-center mt-4 shadow-inner">
                      L'administrateur vous contactera bientôt avec les informations d'accès à la formation.
                    </p>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <div className="relative z-10">
              {!clientId ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 theme-bg-light theme-text rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Compte Requis</h2>
                  <p className="text-gray-400 mb-6">Vous devez disposer d'un compte (gratuit) pour procéder à l'inscription.</p>
                  <button 
                    onClick={() => {
                      setAuthModalReason(course?.product_type === 'ebook' ? "télécharger cet E-book" : "vous inscrire à cette formation");
                      setShowAuthModal(true);
                    }}
                    className="inline-flex justify-center items-center px-8 py-3 theme-bg rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg"
                  >
                    Créer un compte ou se connecter
                  </button>
                </div>
              ) : course.product_type !== 'ebook' && course.remainingSeats === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Complet</h2>
                  <p className="text-gray-400">Désolé, cette formation est complète. Les inscriptions sont fermées.</p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8">
                    {course.product_type === 'ebook' ? (
                      <>
                        <h2 className="text-2xl font-bold mb-2">Commandez votre E-book 📖</h2>
                        <p className="text-gray-400 text-sm">Complétez ce formulaire pour obtenir votre livre numérique.</p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-2xl font-bold mb-2">Réservez votre place 🎉</h2>
                        <p className="text-gray-400 text-sm">Complétez ce formulaire pour vous inscrire à la formation.</p>
                      </>
                    )}
                    
                    {course.product_type !== 'ebook' && course.remainingSeats !== null && course.remainingSeats > 0 && (
                      <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 rounded-full text-sm font-bold shadow-sm">
                        <AlertCircle className="w-4 h-4" />
                        Plus que {course.remainingSeats} {course.remainingSeats > 1 ? 'places disponibles' : 'place disponible'} !
                      </div>
                    )}
                  </div>
                  
                  {formError && (
                    <div className="mb-6 p-4 rounded-xl bg-red-900/50 border border-red-500/50 text-red-300 text-sm text-center flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {formError}
                    </div>
                  )}

                  <form onSubmit={handleRegister} className="space-y-4 max-w-md mx-auto">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Nom complet</label>
                      <input
                        required
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-white focus:border-transparent transition-shadow text-sm"
                        placeholder="Ex: Kouamé Jean"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Adresse email</label>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-white focus:border-transparent transition-shadow text-sm"
                        placeholder="vous@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Numéro de téléphone</label>
                      <div className="flex gap-2">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="block w-1/3 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-white focus:border-transparent transition-shadow text-sm"
                          required
                        >
                          <option value="+237">🇨🇲 +237 (Cameroun)</option>
                          <option value="+225">🇨🇮 +225 (Côte d'Ivoire)</option>
                          <option value="+221">🇸🇳 +221 (Sénégal)</option>
                          <option value="+228">🇹🇬 +228 (Togo)</option>
                          <option value="+229">🇧🇯 +229 (Bénin)</option>
                          <option value="+226">🇧🇫 +226 (Burkina Faso)</option>
                          <option value="+241">🇬🇦 +241 (Gabon)</option>
                          <option value="+242">🇨🇬 +242 (Congo)</option>
                          <option value="+243">🇨🇩 +243 (RDC)</option>
                          <option value="+33">🇫🇷 +33 (France)</option>
                          <option value="+1">🇺🇸/🇨🇦 +1 (USA/Canada)</option>
                        </select>
                        <input
                          required
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="block w-2/3 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-white focus:border-transparent transition-shadow text-sm"
                          placeholder="Numéro sans l'indicatif"
                        />
                      </div>
                    </div>

                    {course.product_type !== 'ebook' && effectivePrice > 0 && (
                      <div className="bg-gray-800/30 border border-gray-700/50 p-4 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-bold text-gray-300">Option de paiement</label>
                          {appliedPromo && (
                            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                              <Ticket className="w-3.5 h-3.5" />
                              Code {appliedPromo.code} inclus
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            type="button"
                            onClick={() => setPaymentMode('full')}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                              paymentMode === 'full' 
                                ? 'bg-white text-gray-900 border-white shadow-lg shadow-white/5' 
                                : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:border-gray-600'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMode === 'full' ? 'border-gray-900' : 'border-gray-600'}`}>
                                {paymentMode === 'full' && <div className="w-2 h-2 bg-gray-900 rounded-full" />}
                              </div>
                              <span className="text-sm font-bold">Paiement complet</span>
                            </div>
                            <span className="text-sm font-black">{effectivePrice.toLocaleString('fr-FR')} FCFA</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => setPaymentMode('installments')}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                              paymentMode === 'installments' 
                                ? 'bg-white text-gray-900 border-white shadow-lg shadow-white/5' 
                                : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:border-gray-600'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMode === 'installments' ? 'border-gray-900' : 'border-gray-600'}`}>
                                {paymentMode === 'installments' && <div className="w-2 h-2 bg-gray-900 rounded-full" />}
                              </div>
                              <span className="text-sm font-bold">Paiement en 2 tranches</span>
                            </div>
                            <span className="text-sm font-black">2 x {Math.floor(effectivePrice / 2).toLocaleString('fr-FR')} FCFA</span>
                          </button>
                        </div>
                        {paymentMode === 'installments' && (
                          <p className="text-[10px] text-emerald-400 font-medium px-1">
                            ℹ️ Vous réglez 50% aujourd'hui pour valider votre place, et le reste plus tard.
                          </p>
                        )}
                      </div>
                    )}

                    {effectivePrice > 0 && (
                      <div className="pt-2">
                        <p className="text-xs text-gray-400">
                          ℹ️ Le règlement de <strong>{effectivePrice.toLocaleString('fr-FR')} FCFA</strong> s'effectue par transfert Mobile Money au <strong>+237 650989019</strong>.
                        </p>
                      </div>
                    )}
                    
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-md text-base font-bold text-gray-900 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-white disabled:opacity-50 transition-colors mt-6 transform active:scale-95"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-gray-900" />
                          Traitement en cours...
                        </>
                      ) : course.price_fcfa > 0 ? (
                        `Continuer vers le paiement (Transfert au +237 650989019)`
                      ) : (
                        course.product_type === 'ebook' ? 'Télécharger l\'e-book gratuitement' : ((course.is_date_tbd || !course.date_time) ? 'Se pré-inscrire' : 'S\'inscrire')
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </motion.section>

        {/* Footer / Links */}
        <div className="mt-16 text-center space-y-6 pb-12">
          <h3 className="text-xl font-bold text-gray-900">Pour aller plus loin</h3>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a 
              href="/" 
              className="inline-flex justify-center items-center gap-2 px-6 py-3 theme-bg-light theme-text rounded-xl font-semibold hover:opacity-80 transition-opacity shadow-sm border theme-border"
            >
              <Globe className="w-5 h-5 theme-text" />
              Visiter le site officiel
            </a>
            <a 
              href="https://youtube.com/@excellerchezpierre?si=VjYob_33LerLzC99" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 rounded-xl font-semibold hover:bg-red-500/20 transition-colors border border-red-500/20 shadow-sm"
            >
              <Youtube className="w-5 h-5" />
              Découvrir sur YouTube
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t theme-border-light bg-white/50 pt-10 pb-8 px-4 text-center">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          <div className="flex items-center gap-6">
            <a href="https://www.linkedin.com/in/pierre-valdeze-mbom-mbom-75a660217" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors" title="LinkedIn">
              <Linkedin className="w-6 h-6" />
            </a>
            <a href="https://facebook.com/pierrembom" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500 transition-colors" title="Facebook">
              <Facebook className="w-6 h-6" />
            </a>
            <a href="https://t.me/pierrembom" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400 transition-colors" title="Telegram">
              <Send className="w-6 h-6" />
            </a>
            <a href="https://wa.me/237698389030" target="_blank" rel="noopener noreferrer" className="text-gray-400 theme-text transition-colors" title="WhatsApp">
              <MessageCircle className="w-6 h-6" />
            </a>
          </div>
          <div className="space-y-2 text-sm text-gray-500 font-medium">
            <p>© 2026 Exceller chez Pierre. Tous droits réservés.</p>
            <div className="flex items-center justify-center gap-4">
              <button className="hover:opacity-80 theme-text transition-opacity">Mentions légales</button>
              <button className="hover:opacity-80 theme-text transition-opacity">Politique de confidentialité</button>
            </div>
          </div>
        </div>
      </footer>
      {/* Floating Action Button (Mobile) */}
      <div className="fixed bottom-4 left-0 right-0 px-4 z-50 sm:hidden">
        <a 
          href="https://wa.me/237698389030"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white font-bold py-3.5 px-6 rounded-full shadow-[0_4px_14px_0_rgba(37,211,102,0.39)] hover:bg-[#128C7E] hover:shadow-[0_6px_20px_rgba(37,211,102,0.23)] transition-all active:scale-95"
        >
          <MessageCircle className="w-5 h-5" />
          Contacter sur WhatsApp
        </a>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
          >
            {reviewSuccess ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 theme-bg-light theme-text rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Merci pour votre avis !</h3>
                <p className="text-gray-500">Votre témoignage a été ajouté avec succès.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Laissez un avis</h3>
                  <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <form onSubmit={handleReviewSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom et prénom</label>
                    <input 
                      required 
                      type="text" 
                      value={reviewName}
                      onChange={e => setReviewName(e.target.value)}
                      className="block w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Ex: Kouamé Jean"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut (Niveau d'étude, Poste)</label>
                    <input 
                      required 
                      type="text" 
                      value={reviewStatus}
                      onChange={e => setReviewStatus(e.target.value)}
                      className="block w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Ex: Étudiant en Master, Analyste"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="focus:outline-none hover:scale-110 transition-transform"
                        >
                          <Star className={`w-8 h-8 ${reviewRating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire</label>
                    <textarea 
                      required 
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      rows={4}
                      className="block w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Votre avis sur la formation..."
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={reviewSubmitting}
                    className="w-full py-3 theme-bg rounded-xl text-white font-bold disabled:opacity-50"
                  >
                    {reviewSubmitting ? 'Envoi...' : 'Envoyer mon avis'}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Finaliser votre règlement</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); submitRegistration(false); }} className="p-6 space-y-5">
              
              {/* Payment Mode Choice */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-bold text-gray-900">Option de paiement :</label>
                  {appliedPromo && (
                    <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                      <Ticket className="w-3.5 h-3.5" />
                      Code {appliedPromo.code} (-{appliedPromo.discount_value}{appliedPromo.discount_type === 'fixed' ? ' FCFA' : '%'})
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('full')}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                      paymentMode === 'full' 
                        ? 'border-emerald-600 bg-emerald-50' 
                        : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <CheckCircle2 className={`w-5 h-5 mb-1 ${paymentMode === 'full' ? 'text-emerald-600' : 'text-gray-300'}`} />
                    <span className="text-xs font-bold text-gray-900">Totalité</span>
                    <span className="text-[10px] text-gray-600 font-bold">{effectivePrice.toLocaleString('fr-FR')} FCFA</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('installments')}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                      paymentMode === 'installments' 
                        ? 'border-emerald-600 bg-emerald-50' 
                        : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <Clock className={`w-5 h-5 mb-1 ${paymentMode === 'installments' ? 'text-emerald-600' : 'text-gray-300'}`} />
                    <span className="text-xs font-bold text-gray-900">2 Tranches</span>
                    <span className="text-[10px] text-gray-600 font-bold">{Math.floor(effectivePrice * 0.5).toLocaleString('fr-FR')} FCFA x 2</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  {paymentMode === 'full' ? (
                    <>Pour débloquer votre accès à <strong>{course?.title}</strong>, veuillez effectuer un transfert manuel de <strong>{effectivePrice.toLocaleString('fr-FR')} FCFA</strong> par Mobile Money.</>
                  ) : (
                    <>Pour valider votre inscription (1ère tranche de 50%), veuillez effectuer un transfert manuel de <strong>{Math.floor(effectivePrice * 0.5).toLocaleString('fr-FR')} FCFA</strong> par Mobile Money.</>
                  )}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm border border-gray-100">
                <p className="font-semibold text-gray-700">Instructions de paiement Cameroun :</p>
                <div className="space-y-2 font-medium">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                    <span className="text-gray-600">MTN Mobile Money :</span>
                    <span className="text-gray-950 font-bold font-mono">+237 650 989 019</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 italic">
                    Titulaire : Pierre Valdeze Mbom Mbom
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-950">
                  Numéro de transaction (ID du SMS) *
                </label>
                <input 
                  required 
                  type="text" 
                  value={transactionId}
                  onChange={e => setTransactionId(e.target.value)}
                  className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm placeholder-gray-400"
                  placeholder="Ex: AP2607.1340.C359"
                />
                <p className="text-xs text-gray-400">
                  Saisissez le code de référence unique indiqué sur le SMS de confirmation de transfert.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button 
                  type="submit" 
                  disabled={submitting || !transactionId}
                  className="w-full py-3 px-4 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 shadow-md"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      Validation...
                    </>
                  ) : (
                    'Confirmer le transfert au +237 650989019'
                  )}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-500 font-medium rounded-xl transition-colors text-xs"
                >
                  Annuler
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gray-900 border border-gray-800 text-white p-4 rounded-2xl shadow-xl flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-grow">
              <p className="text-sm font-semibold">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToast({ ...toast, show: false })}
              className="shrink-0 text-gray-400 hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* Auth Prompt Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-6 sm:p-8 relative shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 font-extrabold text-xs uppercase tracking-wider mb-5">
              <User className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              <span>Espace Privé</span>
            </div>

            <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-tight mb-3">
              Rejoignez Exceller chez Pierre 🚀
            </h3>
            
            <p className="text-gray-600 text-sm leading-relaxed mb-5">
              Pour pouvoir <strong className="text-gray-950 font-bold">{authModalReason}</strong>, vous devez simplement disposer d'un <strong>compte client</strong> (gratuit).
            </p>

            {/* Account advantages */}
            <div className="space-y-3 bg-gray-50/70 p-4 sm:p-5 rounded-2xl border border-gray-100/70 mb-6 text-left">
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Vos avantages membre :</p>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2.5 text-xs text-gray-700 leading-tight">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Accès gratuit & instantané à votre Hub d'apprentissage privé</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-gray-700 leading-tight">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Suivi de l'état de vos inscriptions et validation de vos paiements</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-gray-700 leading-tight">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Accès direct aux liens Google Meet, groupes WhatsApp et guides</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <a
                href="/client/register"
                className="w-full py-3.5 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-center font-extrabold rounded-2xl transition-all shadow-lg shadow-blue-100 hover:shadow-xl hover:shadow-blue-200 text-sm active:scale-98 flex items-center justify-center gap-2 cursor-pointer font-sans"
              >
                <User className="w-4 h-4" />
                <span>Créer mon compte gratuitement</span>
              </a>
              <a
                href={`/client/login?redirect=course/${course?.id}`}
                className="w-full py-3.5 px-5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-center font-bold rounded-2xl transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Déjà membre ? Se connecter</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
