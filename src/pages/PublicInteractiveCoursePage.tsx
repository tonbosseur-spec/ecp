import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { PromoCode, extractCoursePromoCodes, calculateDiscountedPrice } from '../lib/promoUtils';
import { findReferralCode, ReferralCodeInfo } from '../lib/referralService';
import { isUuid } from '../lib/slugUtils';
import Footer from '../components/Footer';
import { TrainerAvatar } from '../components/TrainerAvatar';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { 
  Loader2, 
  Sparkles, 
  BookOpen, 
  Code, 
  CheckCircle2, 
  User, 
  ChevronDown, 
  ChevronUp, 
  MessageCircle, 
  ArrowRight,
  ShieldCheck,
  Award,
  Zap,
  GraduationCap,
  Play,
  ArrowLeft,
  Share2,
  Check,
  FileText,
  Clock,
  Tag,
  Ticket,
  Star,
  HelpCircle,
  Laptop,
  CheckCircle,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const defaultTestimonials = [
  {
    id: 1,
    name: "Jean-Claude Tchakounté",
    role: "Étudiant en Master & Économétrie",
    text: "La formation interactive en R est une révélation. L'exécution du code en direct sans rien installer m'a permis de comprendre les statistiques pas à pas sans prise de tête !",
    initials: "JC",
    rating: 5
  },
  {
    id: 2,
    name: "Marie-Claire Ndom",
    role: "Analyste Données & RH",
    text: "Les exercices corrigés automatiquement sont ultra pédagogiques. Dès qu'on fait une erreur de syntaxe ou de paramètre, le retour est immédiat et clair.",
    initials: "MC",
    rating: 5
  },
  {
    id: 3,
    name: "Amadou Bouba",
    role: "Doctorant en Santé Publique",
    text: "Une approche moderne et directe. Les activités pratiques collent exactement aux besoins réels d'analyse de données. Je recommande à 100%.",
    initials: "AB",
    rating: 5
  },
  {
    id: 4,
    name: "Estelle Mvogo",
    role: "Ingénieure Agronome",
    text: "J'avais toujours eu du mal avec la ligne de commande R, mais ce format interactif guidé change complètement la donne. Excellente formation !",
    initials: "EM",
    rating: 5
  }
];

const faqs = [
  {
    question: "Dois-je installer R ou RStudio sur mon ordinateur ?",
    answer: "Non, absolument rien à installer ! Tout s'exécute directement dans votre navigateur grâce à la technologie WebR. Vous tapez du vrai code R et obtenez les résultats instantanément sur votre écran."
  },
  {
    question: "Puis-je suivre cette formation sur tablette ou smartphone ?",
    answer: "Oui, la plateforme est entièrement responsive. Pour un confort optimal lors de la saisie de code R et des manipulations de graphiques, nous vous recommandons toutefois un ordinateur portable ou une tablette."
  },
  {
    question: "Ma progression est-elle sauvegardée automatiquement ?",
    answer: "Oui, toutes vos étapes validées, réponses aux quiz et scripts R sont automatiquement synchronisés avec votre espace personnel. Vous pouvez reprendre là où vous vous étiez arrêté à tout moment."
  },
  {
    question: "Obtiens-je une attestation de réussite à la fin ?",
    answer: "Oui, une fois l'intégralité des modules et activités validés avec succès, une attestation nominative certifiant vos compétences acquises est générée directement dans votre profil."
  }
];

export default function PublicInteractiveCoursePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Accordion states
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [openFaqs, setOpenFaqs] = useState<Record<number, boolean>>({});

  // Promo Code State
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [appliedReferralInfo, setAppliedReferralInfo] = useState<ReferralCodeInfo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccessMsg, setPromoSuccessMsg] = useState<string | null>(null);
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);

        if (!id) return;

        const selectQuery = `
          *,
          interactive_course_modules (
            *,
            interactive_course_lessons (
              *,
              interactive_activities (*)
            )
          )
        `;

        let data: any = null;
        let queryError: any = null;

        if (isUuid(id)) {
          const res = await supabase
            .from('interactive_courses')
            .select(selectQuery)
            .eq('id', id)
            .maybeSingle();
          data = res.data;
          queryError = res.error;
        } else {
          const res = await supabase
            .from('interactive_courses')
            .select(selectQuery)
            .eq('slug', id)
            .maybeSingle();
          data = res.data;
          queryError = res.error;
        }

        if (queryError) throw queryError;

        if (data && isUuid(id) && data.slug) {
          navigate(`/interactive-course/${data.slug}${window.location.search}`, { replace: true });
        }

        // Sort modules & lessons
        if (data && data.interactive_course_modules) {
          data.interactive_course_modules.sort((a: any, b: any) => a.order_index - b.order_index);
          data.interactive_course_modules.forEach((mod: any) => {
            if (mod.interactive_course_lessons) {
              mod.interactive_course_lessons.sort((a: any, b: any) => a.order_index - b.order_index);
            }
          });

          // Open first module by default
          if (data.interactive_course_modules.length > 0) {
            setOpenModules({ [data.interactive_course_modules[0].id]: true });
          }
        }

        setCourse(data);
      } catch (err: any) {
        console.error("Erreur chargement cours interactif:", err);
        setError("Impossible de charger les détails de cette formation interactive.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, navigate]);

  // Auto-check promo code when course loaded or searchParams changed
  useEffect(() => {
    if (!course) return;
    const urlPromo = searchParams.get('promo');
    const storedPromo = id ? localStorage.getItem(`promo_interactive_${id}`) : null;
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
      await new Promise((resolve) => setTimeout(resolve, 400));
      setIsCheckingPromo(false);
    }

    // 1. Direct course promo codes
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
        try { localStorage.setItem(`promo_interactive_${id}`, cleanCode); } catch (e) {}
      }
      return;
    }

    // 2. Referral promo codes
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
      setPromoSuccessMsg(`Code parrainage "${cleanCode}" valide (-10%) !`);
      if (id) {
        try { localStorage.setItem(`promo_interactive_${id}`, cleanCode); } catch (e) {}
      }
      return;
    }

    if (isManual) {
      setPromoError(`Le code "${cleanCode}" est invalide ou non applicable.`);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setAppliedReferralInfo(null);
    setPromoInput('');
    setPromoError(null);
    setPromoSuccessMsg(null);
    if (id) {
      try { localStorage.removeItem(`promo_interactive_${id}`); } catch (e) {}
    }
  };

  const toggleModule = (moduleId: string) => {
    setOpenModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const toggleFaq = (index: number) => {
    setOpenFaqs(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleCopyShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleStartCourse = () => {
    if (!course) return;
    const targetIdentifier = course.slug || course.id;
    if (!session) {
      navigate(`/client/login?redirect=/client/interactive-course/${targetIdentifier}`);
    } else {
      navigate(`/client/interactive-course/${targetIdentifier}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="w-9 h-9 text-emerald-400 animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chargement de la formation...</p>
      </div>
    );
  }

  if (!course || error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between font-sans">
        <div className="max-w-md mx-auto my-auto p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 shadow-2xl">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
          <h2 className="text-2xl font-black text-white">Formation introuvable</h2>
          <p className="text-xs text-slate-400 leading-relaxed">{error || "Cette formation interactive n'existe pas ou n'est plus accessible."}</p>
          <Link 
            to="/catalogue" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour au catalogue</span>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const modules = course.interactive_course_modules || [];
  const totalLessons = modules.reduce((acc: number, m: any) => acc + (m.interactive_course_lessons?.length || 0), 0);
  let totalActivities = 0;
  let codeActivities = 0;
  let quizActivities = 0;

  modules.forEach((m: any) => {
    (m.interactive_course_lessons || []).forEach((l: any) => {
      const acts = l.interactive_activities || [];
      totalActivities += acts.length;
      codeActivities += acts.filter((a: any) => a.activity_type === 'code_r').length;
      quizActivities += acts.filter((a: any) => a.activity_type === 'quiz_mcq' || a.activity_type === 'quiz_text').length;
    });
  });

  const basePrice = course.price_fcfa || 0;
  const isFree = basePrice === 0;
  const discountCalculation = appliedPromo ? calculateDiscountedPrice(basePrice, appliedPromo) : { finalPrice: basePrice, discountAmount: 0, savings: 0 };
  const effectivePrice = discountCalculation.finalPrice || 0;
  const coverImage = course.cover_image || course.cover_image_url || course.thumbnail_url || course.image_url;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* 1. Header Minimal & Discret Flottant */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 py-3 shadow-xl' : 'bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-transparent py-4 sm:py-6'
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <Link 
            to="/catalogue" 
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-bold transition-all backdrop-blur-md cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Catalogue</span>
          </Link>

          <Link to="/" className="text-sm sm:text-base font-black tracking-tight text-white hover:opacity-90 transition-opacity">
            Exceller chez Pierre
          </Link>

          <Link 
            to={session ? "/client/hub" : "/client/login"} 
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all backdrop-blur-md cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{session ? "Mon Espace" : "Connexion"}</span>
          </Link>
        </div>
      </header>

      {/* 2. HERO IMMERSIVE (100% Largeur avec dégradé progressif) */}
      <section className="relative w-full min-h-[560px] sm:min-h-[640px] lg:min-h-[720px] bg-slate-950 flex flex-col justify-end pt-24 pb-12 sm:pb-16 overflow-hidden">
        
        {/* Widescreen Cover Image Ambient Backdrop */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {coverImage ? (
            <img 
              src={coverImage} 
              alt={course.title}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center scale-105 filter blur-xs opacity-35 sm:opacity-45"
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
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-wider shadow-xs">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Formation Interactive
              </span>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-extrabold tracking-wide">
                <Code className="w-3.5 h-3.5 text-sky-400" />
                Moteur R Embarqué (WebR)
              </span>
              {modules.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-900/90 text-slate-300 border border-slate-700/80 text-xs font-bold">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  {modules.length} {modules.length > 1 ? 'chapitres' : 'chapitre'} • {totalLessons} leçons
                </span>
              )}
            </div>

            {/* Titre principal */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
              {course.title}
            </h1>

            {/* Formateur / Responsable Pédagogique */}
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-medium text-slate-300 backdrop-blur-md">
              <TrainerAvatar
                name="Pierre Valdeze Mbom Mbom"
                className="w-6 h-6 rounded-full object-cover"
                fallbackClassName="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 font-bold text-[10px]"
              />
              <span>Conception & Pédagogie : <strong className="text-white font-bold">Pierre Valdeze Mbom Mbom</strong></span>
            </div>

            {/* Tarif Hero */}
            <div className="pt-2 flex items-center justify-center gap-3">
              <div className="text-3xl sm:text-4xl font-black text-white">
                {isFree ? (
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
                onClick={handleStartCourse}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-950/60 hover:scale-105 active:scale-95 transition-all text-base cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{isFree ? "Démarrer la formation" : "Accéder à la formation"}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={handleCopyShare}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold rounded-2xl border border-slate-700/80 transition-all text-sm cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-slate-400" />}
                <span>{copiedLink ? "Lien copié !" : "Partager"}</span>
              </button>

              <a
                href={`https://wa.me/237698389030?text=${encodeURIComponent(`Bonjour Pierre ! J'aimerais avoir des informations sur la formation interactive "${course.title}".`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold rounded-2xl border border-slate-700/80 transition-all text-sm"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span className="hidden lg:inline">Question WhatsApp</span>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. CONTENU PRINCIPAL DE LA PAGE (Émergeant du dégradé) */}
      <main className="relative z-20 max-w-4xl mx-auto px-4 sm:px-6 space-y-12 sm:space-y-16 py-12">

        {/* SECTION 1: Présentation & Description de la Formation */}
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
                Présentation & Objectifs de la Formation
              </h2>
            </div>

            <div className="text-slate-300 text-sm sm:text-base leading-relaxed">
              <MarkdownRenderer content={course.description} isDark={true} />
            </div>

            {/* Grille des 4 Piliers Interactifs */}
            <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800/80">
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 flex items-start gap-3">
                <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20 shrink-0">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">WebR Intégré</h4>
                  <p className="text-xs text-slate-400 mt-1">Exécution R directe dans votre navigateur sans aucune installation.</p>
                </div>
              </div>

              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 flex items-start gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Correction Instantanée</h4>
                  <p className="text-xs text-slate-400 mt-1">Évaluation automatique de votre code R et suggestions immédiates.</p>
                </div>
              </div>

              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 flex items-start gap-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Progression 24/7</h4>
                  <p className="text-xs text-slate-400 mt-1">Avancez à votre rythme avec sauvegarde automatique de vos acquis.</p>
                </div>
              </div>

              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 flex items-start gap-3">
                <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20 shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Attestation de Réussite</h4>
                  <p className="text-xs text-slate-400 mt-1">Certificat nominatif délivré après validation des chapitres.</p>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* SECTION 2: Programme & Sommaire des Chapitres Interactifs */}
        {modules.length > 0 && (
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
                  Programme & Chapitres Interactifs
                </h2>
                <p className="text-xs text-slate-400">
                  {modules.length} chapitres • {totalLessons} leçons • {totalActivities} activités ({codeActivities} exercices R)
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {modules.map((module: any, idx: number) => {
                const lessons = module.interactive_course_lessons || [];
                const isOpen = !!openModules[module.id];
                const moduleActivitiesCount = lessons.reduce((acc: number, l: any) => acc + (l.interactive_activities?.length || 0), 0);

                return (
                  <div 
                    key={module.id} 
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
                          <div className="flex items-center gap-2 mt-1 text-[11px] font-medium text-slate-400">
                            <span>{lessons.length} leçons</span>
                            <span>•</span>
                            <span>{moduleActivitiesCount} activités</span>
                          </div>
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
                      )}
                    </button>
                    
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-5 pb-5 pt-1 text-slate-300 text-xs sm:text-sm leading-relaxed border-t border-slate-800/60 bg-slate-950/40 space-y-2"
                        >
                          {module.description && (
                            <p className="text-xs text-slate-400 pt-2 pb-1 pl-12">
                              {module.description}
                            </p>
                          )}

                          <div className="pl-0 sm:pl-12 space-y-2 pt-2">
                            {lessons.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">Aucune leçon dans ce chapitre pour le moment.</p>
                            ) : (
                              lessons.map((lesson: any, lIdx: number) => {
                                const acts = lesson.interactive_activities || [];
                                const hasRCode = acts.some((a: any) => a.activity_type === 'code_r');

                                return (
                                  <div 
                                    key={lesson.id}
                                    className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                      <span className="text-slate-500 font-mono font-bold text-[11px]">
                                        {idx + 1}.{lIdx + 1}
                                      </span>
                                      <span className="font-semibold text-slate-200 truncate">{lesson.title}</span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {hasRCode && (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                                          <Code className="w-3 h-3" /> Code R
                                        </span>
                                      )}
                                      <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                                        {acts.length} exercice{acts.length > 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
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
              Modalités de la Formation
            </span>

            <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <p>
                Formation 100% interactive et immersive. Pratiquez directement avec le moteur R embarqué, réalisez les exercices en autonomie et validez vos compétences à votre rythme.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                <Zap className="w-3.5 h-3.5" />
                <span>Accès Immédiat & Illimité 24h/24</span>
              </div>
            </div>
          </div>

          {/* Carte Formateur / Auteur */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl flex flex-col justify-between">
            <span className="text-indigo-400 font-bold text-xs uppercase tracking-wider">
              Formateur Expert & Concepteur
            </span>

            <div className="flex items-center gap-4">
              <TrainerAvatar
                name="Pierre Valdeze Mbom Mbom"
                className="w-14 h-14 rounded-2xl object-cover border border-slate-700 shrink-0"
                fallbackClassName="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-indigo-400 font-bold text-sm"
              />
              <div>
                <h3 className="text-base font-bold text-white">Pierre Valdeze Mbom Mbom</h3>
                <p className="text-xs text-slate-400 mt-0.5">Consultant Data Analysis, Statistique & R • Fondateur d'Exceller chez Pierre</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* SECTION 4: Tarif & Inscription */}
        <motion.section 
          ref={formRef}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 text-center space-y-6 shadow-2xl"
        >
          <div className="max-w-md mx-auto space-y-5">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              <Tag className="w-5 h-5 text-emerald-400" />
              <span>Tarif & Accès Immédiat</span>
            </h2>

            <div className="text-center">
              {isFree ? (
                <div className="space-y-1">
                  <span className="text-4xl font-black text-emerald-400">Gratuit !</span>
                  <p className="text-xs text-slate-400">Accès complet à tous les chapitres et exercices R</p>
                </div>
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

            {/* Box Code Promo (if course is paid) */}
            {!isFree && (
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

            {/* Bouton d'action principal */}
            <button
              onClick={handleStartCourse}
              className="w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-950/60 hover:scale-[1.02] active:scale-95 transition-all text-base flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{isFree ? "Démarrer immédiatement ce cours" : `S'inscrire (${effectivePrice.toLocaleString('fr-FR')} FCFA)`}</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-[11px] text-slate-400 font-medium">
              Aucun prérequis technique • Pratique directe dans le navigateur
            </p>
          </div>
        </motion.section>

        {/* SECTION 5: Témoignages & Avis */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <span>Retours d'Apprenants</span>
            </h2>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              Note moyenne 4.9/5
            </span>
          </div>

          <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {defaultTestimonials.map((testimonial, index) => (
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

        {/* SECTION 6: FAQ Pédagogique */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Questions Fréquentes
              </h2>
              <p className="text-xs text-slate-400">Tout ce que vous devez savoir sur le fonctionnement interactif</p>
            </div>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = !!openFaqs[index];
              return (
                <div 
                  key={index}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-all hover:border-slate-700"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none cursor-pointer"
                  >
                    <span className="text-sm sm:text-base font-bold text-white pr-4">{faq.question}</span>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-5 pb-5 pt-1 text-slate-300 text-xs sm:text-sm leading-relaxed border-t border-slate-800/60 bg-slate-950/40"
                      >
                        {faq.answer}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </motion.section>

      </main>

      {/* 4. CTA FIXE DISCRET MOBILE */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 p-3 sm:hidden shadow-2xl flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-slate-400 line-clamp-1">{course.title}</p>
          <div className="text-sm font-black text-white">
            {isFree ? (
              <span className="text-emerald-400">Gratuit</span>
            ) : appliedPromo ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-emerald-400">{effectivePrice.toLocaleString('fr-FR')} FCFA</span>
                <span className="text-[10px] text-slate-500 line-through">{basePrice.toLocaleString('fr-FR')} FCFA</span>
              </div>
            ) : (
              <span>{basePrice.toLocaleString('fr-FR')} FCFA</span>
            )}
          </div>
        </div>

        <button
          onClick={handleStartCourse}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isFree ? "Démarrer" : "S'inscrire"}</span>
        </button>
      </div>

      <Footer />
    </div>
  );
}

