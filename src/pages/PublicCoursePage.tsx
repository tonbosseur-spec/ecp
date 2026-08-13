import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { parseCourseQuizSettings } from '../lib/quizUtils';
import { PromoCode, extractCoursePromoCodes, calculateDiscountedPrice } from '../lib/promoUtils';
import { findReferralCode, recordReferralSale, ReferralCodeInfo } from '../lib/referralService';
import Footer from '../components/Footer';
import { 
  Loader2, 
  Calendar, 
  User, 
  ChevronDown, 
  ChevronUp, 
  Play, 
  CheckCircle2, 
  MessageCircle, 
  Video, 
  FileText, 
  AlertCircle, 
  Download, 
  Globe, 
  Youtube, 
  Star, 
  Facebook, 
  Linkedin, 
  Send, 
  CalendarOff, 
  ArrowLeft, 
  X, 
  CheckCircle, 
  Clock, 
  Ticket, 
  Tag, 
  Sparkles, 
  Check, 
  BookOpen, 
  ArrowRight,
  Share2,
  BookMarked,
  ShieldCheck,
  Smartphone,
  Award,
  Zap,
  Users,
  GraduationCap
} from 'lucide-react';
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

function formatDescriptionHtml(text: string | null | undefined): string {
  if (!text) return '';
  const hasHtml = /<[a-z][\s\S]*>/i.test(text);
  if (hasHtml) {
    return text;
  }
  return text
    .split('\n\n')
    .map(p => `<p class="mb-3 leading-relaxed">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function getYoutubeEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0` : null;
}

function getYoutubeVideoId(url?: string | null): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function PublicCoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInactive, setIsInactive] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
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

  // Promo Code State
  const [searchParams] = useSearchParams();
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [appliedReferralInfo, setAppliedReferralInfo] = useState<ReferralCodeInfo | null>(null);
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
    setAppliedReferralInfo(null);

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

    // 1. Check direct course promo codes
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
      return;
    }

    // 2. Check referral promo codes (Commercials / Parrains)
    const referralMatch = await findReferralCode(cleanCode);
    if (referralMatch) {
      setAppliedReferralInfo(referralMatch);
      const referralPromo: PromoCode = {
        code: cleanCode,
        discount_type: 'percentage',
        discount_value: referralMatch.discountPercent || 10,
        min_score: 0,
        max_score: 100,
        class_name: 'Parrainage',
        description: `Code promo de parrainage (${referralMatch.clientName})`
      };
      setAppliedPromo(referralPromo);
      setPromoInput(cleanCode);
      setPromoSuccessMsg(`Code parrainage "${cleanCode}" valide ! Vous bénéficiez de 10% de réduction.`);
      if (id) {
        try { localStorage.setItem(`promo_${id}`, cleanCode); } catch (e) {}
      }
      return;
    }

    if (isManual) {
      setPromoError(`Le code "${cleanCode}" est invalide ou non applicable à ce produit.`);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setAppliedReferralInfo(null);
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

  // Video YouTube calculations
  const rawVideoUrl = course?.youtube_video_url || course?.video_url || course?.trailer_url || course?.course_modules?.find((m: any) => m.youtube_url)?.youtube_url;
  const youtubeEmbedUrl = getYoutubeEmbedUrl(rawVideoUrl);
  const youtubeVideoId = getYoutubeVideoId(rawVideoUrl);

  // Accordion State
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  const [showCalendarMenu, setShowCalendarMenu] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  const generateIcs = () => {
    if (!course) return;
    const date = new Date(course.date_time);
    const endDate = new Date(date.getTime() + 2 * 60 * 60 * 1000); // assume 2 hours
    
    const formatDate = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');
    
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
    const formatDate = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');

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
              setCountryCode('');
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
        setCourse(courseData);
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
      setError("Impossible de charger le produit. Le lien est peut-être invalide.");
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
      navigate(`/client/login?redirect=${encodeURIComponent(`/course/${id}`)}`);
      return;
    }
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

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
          setFormError("Désolé, cette session est complète.");
          setSubmitting(false);
          setCourse({ ...course, remainingSeats: 0 });
          return;
        }
      }

      const regPayload: any = {
        course_id: id,
        client_id: clientId,
        participant_name: name,
        participant_email: email,
        participant_phone: countryCode + phone.replace(/\s+/g, ''),
        transaction_id: isFree ? 'GRATUIT' : transactionId,
        payment_status: isFree ? 'approved' : 'pending',
        payment_mode: isFree ? 'full' : paymentMode,
        promo_code: appliedPromo ? appliedPromo.code : null
      };

      let registration: any = null;
      let regError: any = null;

      try {
        const res = await supabase.from('registrations').insert([regPayload]).select().single();
        registration = res.data;
        regError = res.error;
      } catch (err: any) {
        delete regPayload.promo_code;
        const res = await supabase.from('registrations').insert([regPayload]).select().single();
        registration = res.data;
        regError = res.error;
      }

      if (regError) throw regError;

      if (appliedReferralInfo && registration) {
        await recordReferralSale({
          registrationId: registration.id,
          courseId: id!,
          courseTitle: course.title,
          coursePrice: effectivePrice,
          buyerClientId: clientId,
          buyerName: name,
          buyerEmail: email,
          buyerPhone: countryCode + phone.replace(/\s+/g, ''),
          paymentStatus: isFree ? 'approved' : 'pending',
          promoCode: appliedReferralInfo.code,
          parrainInfo: appliedReferralInfo
        });
      }

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
      const isEbook = course.product_type === 'ebook';
      const successMessage = isEbook
        ? "Demande enregistrée avec succès !"
        : (isPreRegistration
            ? "Pré-inscription validée ! Nous vous informerons dès que la date sera fixée."
            : "Votre inscription a été enregistrée avec succès !");

      setToast({
        show: true,
        message: successMessage,
        type: 'success'
      });

      setSuccess(true);
      setShowPaymentModal(false);
    } catch (err: any) {
      setFormError("Une erreur est survenue lors de la commande.");
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300 gap-4">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
        <p className="text-sm font-medium tracking-wide">Chargement en cours...</p>
      </div>
    );
  }

  if (isInactive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 sm:p-10 rounded-3xl max-w-lg w-full text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
            <CalendarOff className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Produit indisponible</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Ce produit n'est actuellement plus disponible à l'inscription. Merci de consulter {course?.product_type === 'ebook' ? 'nos ressources' : 'notre catalogue'}.
          </p>
          <div className="pt-2">
            <Link to={course?.product_type === 'ebook' ? '/methodology' : '/catalogue'} className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-950 font-bold rounded-xl hover:bg-slate-100 transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />
              <span>Voir {course?.product_type === 'ebook' ? 'les ressources' : 'le catalogue'}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Introuvable</h2>
          <p className="text-slate-400 text-sm">{error || "Produit introuvable."}</p>
          <Link to="/catalogue" className="inline-block px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl text-xs hover:bg-slate-700">
            Retour au catalogue
          </Link>
        </div>
      </div>
    );
  }

  const isEbook = course.product_type === 'ebook';
  const formattedDate = (course.is_date_tbd || !course.date_time)
    ? "Date à venir"
    : new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(course.date_time));

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

  const mainCtaText = isEbook 
    ? (basePrice === 0 ? "Télécharger l'E-book Gratuit" : "Obtenir cet E-book")
    : (course.remainingSeats === 0 
        ? "Session Complète" 
        : ((course.is_date_tbd || !course.date_time) ? "Se pré-inscrire" : "Je m'inscris à la formation"));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* 1. Header Minimal & Discret Flottant */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 py-3 shadow-xl' : 'bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-transparent py-4 sm:py-6'
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <Link 
            to={isEbook ? "/methodology" : "/catalogue"} 
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-bold transition-all backdrop-blur-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isEbook ? "Ressources" : "Catalogue"}</span>
          </Link>

          <Link to="/" className="text-sm sm:text-base font-black tracking-tight text-white hover:opacity-90 transition-opacity">
            Exceller chez Pierre
          </Link>

          <Link 
            to="/client/login" 
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all backdrop-blur-md"
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mon Espace</span>
          </Link>
        </div>
      </header>

      {/* 2. HERO IMMERSIVE (100% Largeur avec dégradé progressif) */}
      <section className="relative w-full min-h-[560px] sm:min-h-[640px] lg:min-h-[720px] bg-slate-950 flex flex-col justify-end pt-24 pb-12 sm:pb-16 overflow-hidden">
        
        {/* Widescreen Cover Image Ambient Backdrop */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {course.cover_image_url ? (
            <img 
              src={course.cover_image_url} 
              alt={course.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center scale-105 filter blur-xs opacity-40 sm:opacity-50"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-950 to-emerald-950 opacity-60"></div>
          )}
          
          {/* Transition Multi-Niveaux en Dégradé Progressif */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/20"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-transparent to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent"></div>
        </div>

        {/* Hero Content Container */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 w-full text-center space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            {/* Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {isEbook ? (
                <>
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-black uppercase tracking-wider">
                    <BookMarked className="w-4 h-4" />
                    E-book Numérique
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-extrabold uppercase tracking-wider">
                    <Zap className="w-4 h-4" />
                    Accès Immédiat
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-wider">
                    <GraduationCap className="w-4 h-4" />
                    Formation en Ligne
                  </span>
                  {(course.is_date_tbd || !course.date_time) ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                      <Calendar className="w-3.5 h-3.5" />
                      Date à venir
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold capitalize">
                      <Calendar className="w-3.5 h-3.5" />
                      {formattedDate}
                    </span>
                  )}
                  {course.course_modules && course.course_modules.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      {course.course_modules.length} {course.course_modules.length > 1 ? 'modules' : 'module'}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Titre principal */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
              {course.title}
            </h1>

            {/* Formateur / Auteur */}
            {course.trainers?.name && (
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-medium text-slate-300">
                {course.trainers.photo_url ? (
                  <img src={course.trainers.photo_url} alt={course.trainers.name} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-emerald-400" />
                )}
                <span>{isEbook ? "Auteur" : "Formateur"} : <strong className="text-white font-bold">{course.trainers.name}</strong></span>
              </div>
            )}

            {/* Tarif Hero */}
            <div className="pt-2 flex items-center justify-center gap-3">
              <div className="text-3xl sm:text-4xl font-black text-white">
                {basePrice === 0 ? (
                  <span className="text-emerald-400">GRATUIT</span>
                ) : appliedPromo ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-emerald-400">{effectivePrice.toLocaleString('fr-FR')} FCFA</span>
                    <span className="text-lg text-slate-500 line-through">{basePrice.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                ) : (
                  <span>{basePrice.toLocaleString('fr-FR')} <span className="text-xl text-slate-400 font-medium">FCFA</span></span>
                )}
              </div>
            </div>

            {/* CTAs */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
              <button
                onClick={scrollToForm}
                disabled={!isEbook && course.remainingSeats === 0}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-950/60 hover:scale-105 active:scale-95 transition-all text-base cursor-pointer"
              >
                <span>{mainCtaText}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              {isEbook ? (
                <a
                  href={`https://wa.me/237698389030?text=${encodeURIComponent(`Bonjour Pierre ! Je souhaite acheter l'e-book "${course.title}".`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold rounded-2xl border border-slate-700/80 transition-all text-sm"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>Question WhatsApp</span>
                </a>
              ) : youtubeEmbedUrl && (
                <button
                  type="button"
                  onClick={() => setShowVideoModal(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-4 bg-red-600/15 hover:bg-red-600/25 text-red-400 hover:text-red-300 font-bold rounded-2xl border border-red-500/30 hover:border-red-500/50 shadow-lg shadow-red-950/20 transition-all text-sm cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                    <Play className="w-3 h-3 fill-current ml-0.5" />
                  </div>
                  <span>Extrait Vidéo</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. CONTENU PRINCIPAL DE LA PAGE (Émergeant du dégradé) */}
      <main className="relative z-20 max-w-4xl mx-auto px-4 sm:px-6 space-y-12 sm:space-y-16 py-12">

        {/* SECTION 1: Présentation & Description */}
        {course.description && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-sm space-y-6"
          >
            <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <FileText className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {isEbook ? "À propos de cet E-book" : "Présentation de la Formation"}
              </h2>
            </div>

            <div 
              className="text-slate-300 text-sm sm:text-base leading-relaxed space-y-3
                [&_strong]:text-white [&_strong]:font-bold
                [&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-white [&_h1]:mt-6 [&_h1]:mb-3
                [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-5 [&_h2]:mb-2
                [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2
                [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2"
              dangerouslySetInnerHTML={{ __html: formatDescriptionHtml(course.description) }}
            />

            {/* Video Teaser Card */}
            {youtubeEmbedUrl && (
              <div 
                onClick={() => setShowVideoModal(true)}
                className="mt-6 relative rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-950 group cursor-pointer shadow-xl hover:border-red-500/50 transition-all duration-300"
              >
                {youtubeVideoId ? (
                  <div className="relative aspect-video w-full overflow-hidden">
                    <img
                      src={`https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`}
                      alt="Aperçu vidéo"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                    
                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-2xl shadow-red-600/50 group-hover:scale-110 transition-all duration-300 backdrop-blur-xs border border-red-400/40">
                        <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1" />
                      </div>
                    </div>

                    {/* Bottom overlay badge */}
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
                      <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700/80 shadow-md">
                        <Youtube className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-bold">Aperçu Vidéo disponible</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-400 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-md hidden sm:inline-flex items-center gap-1.5">
                        <Play className="w-3 h-3 fill-current" /> Lancer la vidéo
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 flex items-center justify-between bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/30 shrink-0">
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Extrait Vidéo de Présentation</h4>
                        <p className="text-xs text-slate-400">Regarder l'aperçu vidéo directement depuis la page</p>
                      </div>
                    </div>
                    <span className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all shrink-0">
                      Visionner
                    </span>
                  </div>
                )}
              </div>
            )}
          </motion.section>
        )}

        {/* SECTION 2: Programme / Sommaire des Modules */}
        {course.course_modules && course.course_modules.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {isEbook ? "Sommaire de l'E-book" : "Programme & Modules"}
                </h2>
                <p className="text-xs text-slate-400">Cliquez sur un module pour afficher les détails</p>
              </div>
            </div>

            <div className="space-y-3">
              {course.course_modules.map((module: any, idx: number) => (
                <div 
                  key={`${module.id}-${idx}`} 
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden transition-all hover:border-slate-700 shadow-lg"
                >
                  <button 
                    onClick={() => toggleModule(module.id)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none cursor-pointer"
                  >
                    <div className="flex items-center gap-4 pr-4">
                      <div className="shrink-0 w-8 h-8 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center font-extrabold text-xs">
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-white">{module.title}</h3>
                        {module.scheduled_date && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-emerald-400">
                            <Clock className="w-3 h-3" />
                            {new Date(module.scheduled_date).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                    {openModules[module.id] ? (
                      <ChevronUp className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
                    )}
                  </button>
                  
                  <AnimatePresence>
                    {openModules[module.id] && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-5 pb-5 pt-1 text-slate-300 text-xs sm:text-sm leading-relaxed border-t border-slate-800/60 bg-slate-950/40"
                      >
                        <div className="pl-12 pt-2">
                          {module.description}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* SECTION 3: Modalités & Formateur */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Carte Modalités */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
            <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              {isEbook ? "Modalités de Livraison" : "Modalités de la Formation"}
            </span>

            {isEbook ? (
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Produit numérique au format <strong>PDF</strong>. Vous en obtiendrez l'accès immédiat et téléchargeable dans votre <strong>Espace Personnel</strong> dès la confirmation.
              </p>
            ) : (
              <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <p>
                  Session en direct avec support pédagogique, groupe d'entraide et accompagnement personnalisé.
                </p>
                {course.max_seats && (
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${course.remainingSeats && course.remainingSeats > 0 ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                    <Users className="w-3.5 h-3.5" />
                    {course.remainingSeats && course.remainingSeats > 0 ? (
                      <span>{course.remainingSeats} {course.remainingSeats > 1 ? 'places restantes' : 'place restante'} sur {course.max_seats}</span>
                    ) : (
                      <span>Session Complète ({course.max_seats} inscrits)</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Carte Formateur / Auteur */}
          {course.trainers && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl flex flex-col justify-between">
              <span className="text-indigo-400 font-bold text-xs uppercase tracking-wider">
                {isEbook ? "Auteur de l'E-book" : "Formateur Expert"}
              </span>

              <div className="flex items-center gap-4">
                {course.trainers.photo_url ? (
                  <img src={course.trainers.photo_url} alt={course.trainers.name} className="w-14 h-14 rounded-2xl object-cover border border-slate-700 shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-indigo-400" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-white">{course.trainers.name}</h3>
                  {course.trainers.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{course.trainers.description}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.section>

        {/* SECTION 4: Tarif & Code Promo */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 text-center space-y-6 shadow-2xl"
        >
          <div className="max-w-md mx-auto space-y-4">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              <Tag className="w-5 h-5 text-emerald-400" />
              <span>Tarif & Réduction</span>
            </h2>

            <div className="text-center">
              {basePrice === 0 ? (
                <span className="text-4xl font-black text-emerald-400">Gratuit !</span>
              ) : appliedPromo ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-xl font-bold text-slate-500 line-through">{basePrice.toLocaleString('fr-FR')} FCFA</span>
                    <span className="bg-emerald-500/20 text-emerald-300 text-xs font-black px-3 py-1 rounded-full border border-emerald-500/30">
                      Code {appliedPromo.code}
                    </span>
                  </div>
                  <div className="text-4xl font-black text-emerald-400">
                    {effectivePrice.toLocaleString('fr-FR')} <span className="text-lg text-slate-400 font-medium">FCFA</span>
                  </div>
                </div>
              ) : (
                <span className="text-4xl font-black text-white">
                  {basePrice.toLocaleString('fr-FR')} <span className="text-lg text-slate-400 font-medium">FCFA</span>
                </span>
              )}
            </div>

            {/* Box Code Promo */}
            {basePrice > 0 && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Ticket className="w-4 h-4 text-indigo-400" />
                    Code Promo / Parrainage
                  </span>
                  {appliedPromo && (
                    <button onClick={removePromo} className="text-xs text-red-400 font-bold hover:underline cursor-pointer">
                      Retirer
                    </button>
                  )}
                </div>

                {appliedPromo ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-extrabold text-white font-mono">{appliedPromo.code}</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">
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
                        placeholder="Ex: PROMO10"
                        className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        disabled={isCheckingPromo}
                        onClick={() => applyCode(promoInput, true)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-bold rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
                      >
                        {isCheckingPromo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Appliquer'}
                      </button>
                    </div>
                    {promoError && (
                      <p className="text-[11px] text-red-400 font-semibold">{promoError}</p>
                    )}
                    {promoSuccessMsg && (
                      <p className="text-[11px] text-emerald-400 font-semibold">{promoSuccessMsg}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.section>

        {/* SECTION 5: Témoignages */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <span>Témoignages & Avis</span>
            </h2>
            <button
              onClick={() => setShowReviewModal(true)}
              className="text-xs font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Donner mon avis
            </button>
          </div>

          <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {allTestimonials.map((testimonial, index) => (
              <div 
                key={`${testimonial.id}-${index}`} 
                className="min-w-[280px] sm:min-w-[320px] max-w-[340px] bg-slate-900/80 border border-slate-800 rounded-2xl p-6 snap-center flex flex-col justify-between shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${(testimonial.rating || 5) > i ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700'}`} />
                    ))}
                  </div>
                  <p className="text-slate-300 italic text-xs sm:text-sm leading-relaxed">
                    "{testimonial.text}"
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-800/80 mt-4">
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-emerald-400 font-bold text-xs flex items-center justify-center border border-slate-700">
                    {testimonial.initials}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs">{testimonial.name}</h4>
                    <p className="text-[10px] text-slate-400">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* SECTION 6: Formulaire d'inscription / Commande */}
        <motion.section 
          ref={formRef} 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden"
        >
          {success ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="text-center space-y-6 py-4"
            >
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white">
                  {isEbook ? "Commande enregistrée !" : "Inscription confirmée !"}
                </h2>
                <p className="text-slate-300 text-sm max-w-md mx-auto">
                  Merci <strong className="text-white">{name}</strong>. Votre demande a bien été prise en compte.
                </p>
              </div>

              <div className="pt-4">
                <Link 
                  to="/client/hub" 
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-950 font-bold rounded-xl hover:bg-slate-100 transition-colors text-sm shadow-lg"
                >
                  <User className="w-4 h-4" />
                  <span>Accéder à mon Espace Personnel</span>
                </Link>
              </div>
            </motion.div>
          ) : (
            <div className="max-w-md mx-auto space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-black text-white">
                  {isEbook ? "Commander cet E-book 📖" : "S'inscrire à la formation 🎉"}
                </h2>
                <p className="text-xs text-slate-400">Renseignez vos coordonnées ci-dessous pour procéder.</p>
              </div>

              {!clientId ? (
                <div className="text-center py-6 space-y-4">
                  <p className="text-xs text-slate-300">Veuillez vous connecter à votre compte pour procéder.</p>
                  <button 
                    onClick={() => navigate(`/client/login?redirect=${encodeURIComponent(`/course/${id}`)}`)}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-sm transition-all cursor-pointer"
                  >
                    Se connecter pour s'inscrire
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  {formError && (
                    <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-xs text-center">
                      {formError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Nom complet</label>
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      placeholder="Ex: Kouamé Jean"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Adresse email</label>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      placeholder="vous@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Téléphone</label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="w-1/3 px-3 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="+237">🇨🇲 +237</option>
                        <option value="+225">🇨🇮 +225</option>
                        <option value="+221">🇸🇳 +221</option>
                        <option value="+228">🇹🇬 +228</option>
                        <option value="+229">🇧🇯 +229</option>
                        <option value="+241">🇬🇦 +241</option>
                        <option value="+33">🇫🇷 +33</option>
                      </select>
                      <input
                        required
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-2/3 px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        placeholder="Numéro sans l'indicatif"
                      />
                    </div>
                  </div>

                  {!isEbook && effectivePrice > 0 && (
                    <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2">
                      <label className="block text-xs font-bold text-slate-300">Mode de paiement</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMode('full')}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            paymentMode === 'full' 
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' 
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          Paiement 100%
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMode('installments')}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            paymentMode === 'installments' 
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' 
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          Paiement en 2 Tranches
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl transition-all text-sm mt-4 cursor-pointer shadow-lg"
                  >
                    {submitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Validation...</span>
                      </div>
                    ) : (
                      effectivePrice > 0 
                        ? `Continuer vers le paiement (${effectivePrice.toLocaleString('fr-FR')} FCFA)` 
                        : (isEbook ? "Obtenir gratuitement" : "Confirmer l'inscription")
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </motion.section>

      </main>

      {/* 4. CTA FIXE DISCRET MOBILE */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 p-3 sm:hidden shadow-2xl flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-slate-400 line-clamp-1">{course.title}</p>
          <p className="text-sm font-black text-emerald-400">
            {basePrice === 0 ? "Gratuit" : `${effectivePrice.toLocaleString('fr-FR')} FCFA`}
          </p>
        </div>
        <button
          onClick={scrollToForm}
          className="px-5 py-2.5 bg-emerald-500 active:scale-95 text-slate-950 font-black text-xs rounded-xl transition-all shrink-0 cursor-pointer shadow-md"
        >
          {isEbook ? "Obtenir l'E-book" : "S'inscrire"}
        </button>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative text-white"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Laissez un avis</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleReviewSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nom et prénom</label>
                <input 
                  required 
                  type="text" 
                  value={reviewName}
                  onChange={e => setReviewName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  placeholder="Ex: Kouamé Jean"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Statut / Fonction</label>
                <input 
                  required 
                  type="text" 
                  value={reviewStatus}
                  onChange={e => setReviewStatus(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  placeholder="Ex: Analyste de données"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">Note</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="cursor-pointer"
                    >
                      <Star className={`w-6 h-6 ${reviewRating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Commentaire</label>
                <textarea 
                  required 
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  placeholder="Votre avis..."
                />
              </div>
              <button 
                type="submit" 
                disabled={reviewSubmitting}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer"
              >
                {reviewSubmitting ? 'Envoi...' : 'Envoyer mon avis'}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative text-white"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Paiement Mobile Money</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); submitRegistration(false); }} className="p-6 space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
                <p className="text-slate-300">
                  Effectuez le transfert Mobile Money de <strong className="text-emerald-400">{effectivePrice.toLocaleString('fr-FR')} FCFA</strong> au numéro :
                </p>
                <p className="font-mono font-bold text-white text-sm bg-slate-900 p-2 rounded-lg border border-slate-800 text-center">
                  +237 650 989 019
                </p>
                <p className="text-[10px] text-slate-400 italic text-center">Titulaire : Pierre Valdeze Mbom Mbom</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ID Transaction SMS *
                </label>
                <input 
                  required 
                  type="text" 
                  value={transactionId}
                  onChange={e => setTransactionId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                  placeholder="Ex: AP2607.1340.C359"
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button 
                  type="submit" 
                  disabled={submitting || !transactionId}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  {submitting ? 'Validation...' : 'Confirmer le transfert'}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="w-full py-2 bg-slate-800 text-slate-400 font-bold rounded-xl text-xs"
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
          <div className="bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl shadow-xl flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-grow">
              <p className="text-xs font-bold">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToast({ ...toast, show: false })}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modale Vidéo YouTube Moderne */}
      <AnimatePresence>
        {showVideoModal && youtubeEmbedUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-10">
            {/* Arrière-plan flouté sombre */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVideoModal(false)}
              className="fixed inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
            />

            {/* Boîte de la Modale */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-red-950/50 overflow-hidden z-10 flex flex-col my-auto"
            >
              {/* En-tête de la Modale */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/90">
                <div className="flex items-center gap-3 pr-4 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-red-600/15 border border-red-500/30 text-red-500 flex items-center justify-center shrink-0">
                    <Youtube className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-400 block">Extrait Vidéo YouTube</span>
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">{course?.title}</h3>
                  </div>
                </div>

                <button
                  onClick={() => setShowVideoModal(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors shrink-0 cursor-pointer"
                  title="Fermer la vidéo"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Lecteur Vidéo Responsive 16:9 */}
              <div className="relative w-full bg-black aspect-video">
                <iframe
                  src={youtubeEmbedUrl}
                  title={course?.title || "Vidéo de présentation"}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              {/* Pied de la Modale */}
              <div className="p-3.5 sm:p-4 bg-slate-950/90 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Présentation vidéo officielle de la formation</span>
                </div>
                <button
                  onClick={() => {
                    setShowVideoModal(false);
                    scrollToForm();
                  }}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl transition-all text-xs cursor-pointer w-full sm:w-auto text-center"
                >
                  S'inscrire à cette formation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Unifié */}
      <Footer />
    </div>
  );
}
