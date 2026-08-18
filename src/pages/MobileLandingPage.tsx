import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  BarChart2, 
  Terminal, 
  Brain, 
  Award, 
  Zap, 
  CheckCircle2, 
  Globe, 
  LogIn, 
  UserPlus, 
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Play,
  TrendingUp,
  FileSpreadsheet,
  Code2,
  Users,
  Compass,
  Star
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface MobileLandingPageProps {
  session?: any;
}

interface SlideData {
  id: number;
  tag: string;
  tagIcon: any;
  title: string;
  highlight: string;
  subtitle: string;
  features: {
    icon: any;
    title: string;
    description: string;
    badge?: string;
    color: string;
  }[];
}

const SLIDES: SlideData[] = [
  // Page 1 : Présentation de l'Application ECP
  {
    id: 1,
    tag: 'Académie Data & Analyse',
    tagIcon: Sparkles,
    title: 'Exceller chez',
    highlight: 'Pierre',
    subtitle: 'La plateforme mobile tout-en-un pour maîtriser l’analyse de données, de zéro à expert.',
    features: [
      {
        icon: Terminal,
        title: 'R & Data Science Interactive',
        description: 'Exécutez du vrai code R en direct sans aucune installation requise.',
        badge: 'WebAssembly',
        color: 'emerald',
      },
      {
        icon: FileSpreadsheet,
        title: 'Excel, Power BI & Visualisation',
        description: 'Construisez des tableaux de bord percutants et automatisés.',
        badge: 'Pratique',
        color: 'teal',
      },
      {
        icon: Brain,
        title: 'IA & Méthodes Modernes',
        description: 'Adoptez les meilleures pratiques d’analyse augmentée par l’IA.',
        badge: 'Futur',
        color: 'purple',
      },
    ],
  },

  // Page 2 : Les Bénéfices pour l'Apprenant
  {
    id: 2,
    tag: 'Pourquoi choisir ECP ?',
    tagIcon: TrendingUp,
    title: 'Des compétences réelles',
    highlight: 'sur le marché',
    subtitle: 'Une méthode pédagogique éprouvée et axée à 100% sur la pratique professionnelle.',
    features: [
      {
        icon: Zap,
        title: 'Pratique 100% Mobile & Web',
        description: 'Apprenez partout, dans le métro ou chez vous, sur smartphone et ordinateur.',
        badge: 'Zéro config',
        color: 'amber',
      },
      {
        icon: Code2,
        title: '80% d’exercices concrets',
        description: 'Résolvez de vrais cas d’entreprises et manipulez de véritables jeux de données.',
        badge: 'Cas réels',
        color: 'emerald',
      },
      {
        icon: Award,
        title: 'Attestations & Progression',
        description: 'Suivez votre montée en compétences et valorisez votre CV professionnel.',
        badge: 'Certifiant',
        color: 'blue',
      },
    ],
  },

  // Page 3 : Fonctionnalités Intelligentes & Analyse de Données
  {
    id: 3,
    tag: 'Technologie & Outils Intelligents',
    tagIcon: Brain,
    title: 'Une technologie avancée',
    highlight: 'pour la Data',
    subtitle: 'Des outils intelligents conçus pour accélérer et fluidifier votre apprentissage.',
    features: [
      {
        icon: Terminal,
        title: 'Console R WebR Intégrée',
        description: 'Tracez vos graphiques ggplot2 et manipulez dplyr directement sur smartphone.',
        badge: 'Exclusif',
        color: 'indigo',
      },
      {
        icon: Brain,
        title: 'Correction & Feedback IA',
        description: 'Validation instantanée de votre code et explications pas-à-pas des erreurs.',
        badge: 'Smart IA',
        color: 'emerald',
      },
      {
        icon: Users,
        title: 'Sessions Live & Visioconférence',
        description: 'Participez à des ateliers en direct et échangez avec des formateurs experts.',
        badge: 'Live',
        color: 'pink',
      },
    ],
  },

  // Page 4 : Démarrage & Informations
  {
    id: 4,
    tag: 'Prêt à commencer ?',
    tagIcon: Compass,
    title: 'Rejoignez',
    highlight: 'l’aventure Data',
    subtitle: 'Créez votre compte en 30 secondes et accédez immédiatement à vos formations.',
    features: [
      {
        icon: Star,
        title: 'Recommandé par les apprenants',
        description: 'Note moyenne de 4.9/5 et des centaines de professionnels formés.',
        badge: '4.9 ★',
        color: 'amber',
      },
      {
        icon: ShieldCheck,
        title: 'Accès 24/7 & Sécurisé',
        description: 'Vos progressions et exercices sont sauvegardés et accessibles partout.',
        badge: 'Cloud',
        color: 'teal',
      },
    ],
  },
];

export default function MobileLandingPage({ session: propSession }: MobileLandingPageProps) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [activeSession, setActiveSession] = useState<any>(propSession || null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(!propSession);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check auth state on mount if not provided
  useEffect(() => {
    let isMounted = true;
    if (!propSession) {
      supabase.auth.getSession().then(({ data }) => {
        if (isMounted) {
          setActiveSession(data?.session || null);
          setIsCheckingAuth(false);
        }
      }).catch(() => {
        if (isMounted) setIsCheckingAuth(false);
      });
    } else {
      setActiveSession(propSession);
      setIsCheckingAuth(false);
    }
    return () => { isMounted = false; };
  }, [propSession]);

  // Touch Swipe Handlers for mobile gestures
  const minSwipeDistance = 45;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentPage < SLIDES.length - 1) {
      setCurrentPage((prev) => prev + 1);
    }
    if (isRightSwipe && currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < SLIDES.length - 1) {
      setCurrentPage((prev) => prev + 1);
    } else {
      handleFinalAction();
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleSkipToLast = () => {
    setCurrentPage(SLIDES.length - 1);
  };

  const handleFinalAction = () => {
    try {
      sessionStorage.setItem('ecp_session_welcomed', 'true');
    } catch (e) {
      // Ignored
    }

    if (activeSession) {
      navigate('/client/hub');
    } else {
      navigate('/client/login');
    }
  };

  const handleRegister = () => {
    try {
      sessionStorage.setItem('ecp_session_welcomed', 'true');
    } catch (e) {}
    navigate('/client/register');
  };

  const handleLogin = () => {
    try {
      sessionStorage.setItem('ecp_session_welcomed', 'true');
    } catch (e) {}
    navigate('/client/login');
  };

  const handleVisitWebsite = () => {
    try {
      sessionStorage.setItem('ecp_session_welcomed', 'true');
      sessionStorage.setItem('ecp_force_desktop_web', 'true');
    } catch (e) {}
    navigate('/catalogue');
  };

  const currentSlide = SLIDES[currentPage];
  const TagIcon = currentSlide.tagIcon;

  return (
    <div 
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between select-none overflow-hidden font-sans"
    >
      {/* Top Status & Navigation Bar */}
      <header className="px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 flex items-center justify-between z-20 shrink-0">
        {/* App Branding */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <img 
              src="/icon.png" 
              alt="ECP Logo" 
              className="w-full h-full rounded-[10px] object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">
            Exceller chez Pierre
          </span>
        </div>

        {/* Skip Button or direct access */}
        <div className="flex items-center gap-2">
          {currentPage < SLIDES.length - 1 ? (
            <button
              onClick={handleSkipToLast}
              className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 active:scale-95 transition-all"
            >
              Passer
            </button>
          ) : (
            <button
              onClick={handleVisitWebsite}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 flex items-center gap-1 active:scale-95 transition-all"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Site Web</span>
            </button>
          )}
        </div>
      </header>

      {/* Progress Dots / Tabs */}
      <div className="px-5 py-2 z-20 shrink-0">
        <div className="flex items-center gap-2">
          {SLIDES.map((slide, idx) => (
            <button
              key={slide.id}
              onClick={() => setCurrentPage(idx)}
              className="flex-1 group py-1.5 focus:outline-none"
              aria-label={`Aller à la page ${idx + 1}`}
            >
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentPage
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-400 shadow-sm shadow-emerald-400/50'
                    : idx < currentPage
                    ? 'bg-emerald-800/80'
                    : 'bg-slate-800'
                }`}
              />
            </button>
          ))}
        </div>
        <div className="flex justify-between items-center mt-1 text-[11px] font-medium text-slate-400">
          <span>Étape {currentPage + 1} sur {SLIDES.length}</span>
          <span className="text-emerald-400 font-semibold">{currentSlide.tag}</span>
        </div>
      </div>

      {/* Main Slide Carousel Area */}
      <main className="flex-1 flex flex-col justify-center px-5 py-2 z-10 overflow-y-auto max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 40, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -40, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4 my-auto"
          >
            {/* Tag Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <TagIcon className="w-3.5 h-3.5" />
              <span>{currentSlide.tag}</span>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                {currentSlide.title}{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                  {currentSlide.highlight}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {currentSlide.subtitle}
              </p>
            </div>

            {/* Feature Cards Grid */}
            <div className="space-y-2.5 pt-2">
              {currentSlide.features.map((feat, i) => {
                const FeatIcon = feat.icon;
                
                // Color themes for icons
                const colorClasses = 
                  feat.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  feat.color === 'teal' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                  feat.color === 'purple' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                  feat.color === 'amber' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                  feat.color === 'indigo' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                  feat.color === 'pink' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                  'bg-blue-500/10 text-blue-400 border-blue-500/20';

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
                    className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/60 backdrop-blur-md flex items-start gap-3.5 shadow-sm hover:border-slate-600 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${colorClasses}`}>
                      <FeatIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-xs sm:text-sm font-bold text-white leading-tight">
                          {feat.title}
                        </h2>
                        {feat.badge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-700/80 text-slate-300 shrink-0 border border-slate-600/50">
                            {feat.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-400 leading-snug mt-1">
                        {feat.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Action Section */}
      <footer className="px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] z-20 shrink-0 max-w-md mx-auto w-full">
        {/* On slides 1, 2, 3: Next and Previous Navigation */}
        {currentPage < SLIDES.length - 1 ? (
          <div className="flex items-center gap-3">
            {currentPage > 0 && (
              <button
                onClick={handlePrev}
                className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 font-bold text-xs rounded-2xl border border-slate-700/80 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden xs:inline">Retour</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex-1 py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Continuer</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Slide 4 (Final Action Hub) */
          <div className="space-y-2.5">
            {activeSession ? (
              // Connected user: Go directly to Hub
              <button
                onClick={handleFinalAction}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Accéder à mon espace apprenant</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              // Not connected: Registration + Login options
              <>
                <button
                  onClick={handleRegister}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Créer un compte gratuitement</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleLogin}
                    className="py-3 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white font-bold text-xs rounded-xl border border-slate-700/80 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Se connecter</span>
                  </button>

                  <button
                    onClick={handleVisitWebsite}
                    className="py-3 px-3 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5 text-teal-400" />
                    <span>Visiter le site</span>
                  </button>
                </div>
              </>
            )}

            <div className="flex items-center justify-between px-1 pt-1">
              <button
                onClick={handlePrev}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1 py-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Revoir la présentation</span>
              </button>
              
              <Link
                to="/cgu"
                className="text-[11px] font-medium text-slate-500 hover:text-slate-400 py-1"
              >
                Conditions & Confidentialité
              </Link>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
