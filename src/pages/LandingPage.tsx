import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'motion/react';
import { supabase } from '../lib/supabaseClient';
import { 
  GraduationCap, 
  Flame, 
  BookOpen, 
  FileText, 
  BarChart3, 
  CheckCircle, 
  ArrowRight, 
  UserPlus, 
  Compass, 
  MessageSquare, 
  User, 
  Sparkles,
  Award,
  Users,
  Briefcase,
  Layers,
  Star,
  Send,
  Loader2,
  PenTool,
  Check
} from 'lucide-react';

// Subcomponent for counting animation
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  useEffect(() => {
    if (!isInView) return;

    let start = 0;
    const duration = 2000; // 2 seconds
    const increment = Math.ceil(target / (duration / 30));
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [isInView, target]);

  return (
    <span ref={ref} className="font-mono text-4xl sm:text-5xl font-black tracking-tight text-gray-900">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

export default function LandingPage() {
  const adminWhatsAppPhone = "237650989019"; // Pierre's phone number

  const services = [
    {
      icon: <GraduationCap className="w-6 h-6 text-blue-600" />,
      title: "Formations",
      subtitle: "Apprentissage structuré",
      desc: "Des programmes complets, étape par étape, animés par des formateurs experts pour acquérir de solides compétences professionnelles.",
      color: "from-blue-50 to-blue-100/50 border-blue-150 text-blue-700",
      iconBg: "bg-blue-100"
    },
    {
      icon: <Flame className="w-6 h-6 text-orange-600" />,
      title: "Cours intensifs",
      subtitle: "Mise à niveau rapide",
      desc: "Sessions accélérées conçues pour assimiler rapidement des concepts clés et opérationnaliser vos connaissances en un temps record.",
      color: "from-orange-50 to-orange-100/50 border-orange-150 text-orange-700",
      iconBg: "bg-orange-100"
    },
    {
      icon: <BookOpen className="w-6 h-6 text-purple-600" />,
      title: "Ressources & Vidéos",
      subtitle: "Autonomie complète",
      desc: "Bibliothèques d'e-books, de guides méthodologiques et de supports de cours à télécharger pour apprendre à votre propre rythme.",
      color: "from-purple-50 to-purple-100/50 border-purple-150 text-purple-700",
      iconBg: "bg-purple-100"
    },
    {
      icon: <FileText className="w-6 h-6 text-emerald-600" />,
      title: "Suivi de mémoires",
      subtitle: "Méthodologie de recherche",
      desc: "Accompagnement académique rigoureux pour la rédaction, la structuration et la préparation de vos soutenances de mémoire.",
      color: "from-emerald-50 to-emerald-100/50 border-emerald-150 text-emerald-700",
      iconBg: "bg-emerald-100"
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-pink-600" />,
      title: "Analyses statistiques",
      subtitle: "Traitement de données",
      desc: "Analyses descriptives et inférentielles rigoureuses de vos données d'enquêtes ou d'entreprises pour particuliers et professionnels.",
      color: "from-pink-50 to-pink-100/50 border-pink-150 text-pink-700",
      iconBg: "bg-pink-100"
    }
  ];

  const steps = [
    {
      num: "01",
      title: "Création de compte",
      desc: "Inscrivez-vous gratuitement sur la plateforme en quelques clics pour obtenir votre Espace Personnel sécurisé."
    },
    {
      num: "02",
      title: "Sélection ou Proposition",
      desc: "Choisissez parmi nos services et formations disponibles, ou proposez-nous directement votre idée sur-mesure."
    },
    {
      num: "03",
      title: "Apprentissage & Suivi",
      desc: "Accédez à vos modules, ressources et à votre Hub privé interactif pour démarrer votre progression."
    }
  ];

  const stats = [
    { target: 1200, suffix: "+", label: "Étudiants accompagnés" },
    { target: 150, suffix: "+", label: "Mémoires soutenus" },
    { target: 45, suffix: "", label: "Formations & E-books" },
    { target: 98, suffix: "%", label: "Taux de satisfaction" }
  ];

  const [dbTestimonials, setDbTestimonials] = useState<any[]>([]);
  const [loadingTestimonials, setLoadingTestimonials] = useState(true);
  const [currentSession, setCurrentSession] = useState<any>(null);

  // Form states for new testimonial
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [submittingTestimonial, setSubmittingTestimonial] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [testimonialSuccess, setTestimonialSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentSession(session);
    });
    fetchTestimonials();
  }, []);

  const fetchTestimonials = async () => {
    try {
      setLoadingTestimonials(true);
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data && data.length > 0) {
        setDbTestimonials(data);
      } else {
        // Fallback to initial testimonials if DB is empty
        setDbTestimonials([
          {
            name: "Marcelle N.",
            status: "Étudiante en Master 2",
            comment: "L'accompagnement pour mon mémoire a été décisif. Pierre a su m'orienter avec une rigueur méthodologique incroyable. Mention Très Bien obtenue !",
            rating: 5
          },
          {
            name: "Stéphane T.",
            status: "Analyste de données junior",
            comment: "J'ai acheté l'e-book sur les statistiques descriptives, c'est extrêmement clair et pratique. Les exemples sont directement applicables à mes projets.",
            rating: 5
          }
        ]);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des témoignages:", err);
      setDbTestimonials([
        {
          name: "Marcelle N.",
          status: "Étudiante en Master 2",
          comment: "L'accompagnement pour mon mémoire a été décisif. Pierre a su m'orienter avec une rigueur méthodologique incroyable. Mention Très Bien obtenue !",
          rating: 5
        },
        {
          name: "Stéphane T.",
          status: "Analyste de données junior",
          comment: "J'ai acheté l'e-book sur les statistiques descriptives, c'est extrêmement clair et pratique. Les exemples sont directement applicables à mes projets.",
          rating: 5
        }
      ]);
    } finally {
      setLoadingTestimonials(false);
    }
  };

  const handleAddTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newStatus.trim() || !newComment.trim()) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    try {
      setSubmittingTestimonial(true);
      const { error } = await supabase
        .from('testimonials')
        .insert({
          name: newName,
          status: newStatus,
          comment: newComment,
          rating: newRating
        });

      if (error) throw error;

      setTestimonialSuccess(true);
      setNewName("");
      setNewStatus("");
      setNewComment("");
      setNewRating(5);
      
      // Refresh list
      fetchTestimonials();
      
      setTimeout(() => {
        setTestimonialSuccess(false);
        setShowForm(false);
      }, 4000);

    } catch (err: any) {
      console.error("Erreur d'envoi du témoignage:", err);
      alert("Une erreur est survenue lors de l'enregistrement de votre témoignage : " + err.message);
    } finally {
      setSubmittingTestimonial(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-md shadow-blue-200">
                E
              </div>
              <span className="font-bold text-xl text-gray-900 tracking-tight">Exceller chez Pierre</span>
            </div>
            
            <div className="flex items-center gap-4">
              {currentSession ? (
                <>
                  <Link 
                    to="/client/hub"
                    className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors px-3 py-2 rounded-xl hover:bg-gray-50 flex items-center gap-1.5"
                  >
                    <User className="w-4 h-4 text-gray-400" />
                    <span>Mon Hub</span>
                  </Link>
                  <Link 
                    to="/client/marketplace"
                    className="hidden sm:inline-flex items-center justify-center px-4 py-2 bg-gray-950 text-white rounded-xl font-bold text-xs hover:bg-gray-800 transition-all shadow-sm"
                  >
                    Catalogue
                  </Link>
                </>
              ) : (
                <>
                  <Link 
                    to="/client/login"
                    className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors px-3 py-2 rounded-xl hover:bg-gray-50"
                  >
                    Se connecter
                  </Link>
                  <Link 
                    to="/client/register"
                    className="hidden sm:inline-flex items-center justify-center px-4 py-2 bg-gray-950 text-white rounded-xl font-bold text-xs hover:bg-gray-800 transition-all shadow-sm"
                  >
                    S'enregistrer
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* 1. Hero Section */}
      <section className="relative bg-gradient-to-b from-blue-50/70 via-indigo-50/30 to-white pt-16 pb-20 sm:pb-28 overflow-hidden">
        {/* Geometric patterns */}
        <div className="absolute inset-0 z-0 opacity-40">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-300 rounded-full blur-3xl opacity-20"></div>
          <div className="absolute -top-40 right-10 w-[400px] h-[400px] bg-purple-300 rounded-full blur-3xl opacity-20"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6 max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span>Votre passerelle vers la réussite académique & professionnelle</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 tracking-tight leading-[1.1] sm:leading-none">
              Atteignez l'excellence avec un <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">accompagnement sur mesure</span>.
            </h1>
            
            <p className="text-gray-600 text-base sm:text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
              Que vous soyez étudiant, chercheur ou professionnel, bénéficiez de formations de pointe, d'un suivi de mémoire rigoureux et d'analyses statistiques de haut niveau pour concrétiser vos projets.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              {currentSession ? (
                <Link
                  to="/client/hub"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all hover:scale-[1.02] active:scale-98 text-base"
                >
                  <User className="w-5 h-5 mr-2" />
                  <span>Accéder à mon Hub privé</span>
                </Link>
              ) : (
                <Link
                  to="/client/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all hover:scale-[1.02] active:scale-98 text-base"
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  <span>Créer mon espace client</span>
                </Link>
              )}
              <Link
                to="/client/marketplace"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-white hover:bg-gray-50 text-gray-800 font-bold rounded-2xl border border-gray-200 hover:border-gray-300 shadow-xs transition-all text-base"
              >
                <Compass className="w-5 h-5 mr-2 text-gray-500" />
                <span>Explorer le catalogue</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. Section "Nos Services" */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
              Nos Domaines d'Expertise
            </h2>
            <p className="text-gray-500 text-base">
              Découvrez des prestations structurées et adaptées pour maximiser vos compétences et valoriser vos travaux de recherche.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto justify-center">
            {services.map((service, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className={`bg-gradient-to-b ${service.color} border p-6 sm:p-8 rounded-3xl flex flex-col justify-between hover:scale-105 hover:shadow-xl transition-all duration-300 group`}
              >
                <div className="space-y-4">
                  <div className={`w-12 h-12 ${service.iconBg} rounded-2xl flex items-center justify-center shadow-xs mb-4`}>
                    {service.icon}
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1">
                      {service.subtitle}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {service.title}
                    </h3>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {service.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Section "Comment ça fonctionne ?" */}
      <section className="py-20 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
              Une Méthodologie Simple & Efficace
            </h2>
            <p className="text-gray-500 text-base">
              Rejoignez la plateforme et lancez-vous dans votre parcours d'apprentissage en quelques instants.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto relative">
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xs relative flex flex-col items-start"
              >
                <span className="text-5xl font-black text-blue-100 font-mono absolute top-4 right-6 select-none">
                  {step.num}
                </span>
                <div className="px-4 h-10 bg-blue-50 text-blue-600 font-bold rounded-xl flex items-center justify-center text-sm mb-6 border border-blue-100 whitespace-nowrap">
                  Étape {idx + 1}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Section "Nos Résultats" (Preuve Sociale) */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Stats grid */}
          <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-3xl p-8 sm:p-12 border border-gray-100 shadow-xs max-w-5xl mx-auto mb-16">
            <div className="grid gap-8 grid-cols-2 md:grid-cols-4 text-center">
              {stats.map((stat, idx) => (
                <div key={idx} className="space-y-2">
                  <AnimatedCounter target={stat.target} suffix={stat.suffix} />
                  <p className="text-xs sm:text-sm font-semibold text-gray-500 tracking-wide uppercase">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonials */}
          <div className="max-w-6xl mx-auto px-4">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-10 tracking-tight">
              Ce que disent nos apprenants et étudiants :
            </h3>
            
            {loadingTestimonials ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <p className="text-xs text-gray-500">Chargement des témoignages...</p>
              </div>
            ) : (
              <div className="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                {dbTestimonials.map((t, idx) => (
                  <div
                    key={t.id || idx}
                    className="snap-start shrink-0 w-[280px] sm:w-[350px] bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
                  >
                    <div>
                      <div className="flex gap-1 mb-4 text-amber-400">
                        {[...Array(t.rating || 5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-gray-600 text-xs sm:text-sm italic leading-relaxed mb-6">
                        " {t.comment || t.quote} "
                      </p>
                    </div>
                    <div className="flex items-center gap-3 border-t border-gray-100 pt-4 mt-auto">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                        {(t.name || t.author || "A")[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">{t.name || t.author}</h4>
                        <p className="text-xs text-gray-500">{t.status || t.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Form to Add Testimonial */}
            <div className="mt-12 text-center">
              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-700 font-bold rounded-2xl transition-all shadow-sm text-sm"
                >
                  <PenTool className="w-4 h-4" />
                  <span>Laisser mon témoignage</span>
                </button>
              ) : (
                <div className="max-w-xl mx-auto bg-gray-50 rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm text-left animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <PenTool className="w-5 h-5 text-blue-600" />
                      <span>Votre avis nous intéresse</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="text-xs text-gray-500 hover:text-gray-700 font-semibold"
                    >
                      Annuler
                    </button>
                  </div>

                  {testimonialSuccess ? (
                    <div className="bg-green-50 border border-green-100 text-green-900 rounded-2xl p-4 flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-600 shrink-0" />
                      <div>
                        <p className="text-sm font-bold">Témoignage envoyé !</p>
                        <p className="text-xs text-green-700">Merci d'avoir partagé votre expérience avec Exceller chez Pierre.</p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleAddTestimonial} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                            Nom Complet
                          </label>
                          <input
                            type="text"
                            required
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Ex: Marcelle N."
                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                            Statut / Rôle
                          </label>
                          <input
                            type="text"
                            required
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value)}
                            placeholder="Ex: Étudiante en Master 2"
                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                          Note (1 à 5 étoiles)
                        </label>
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4, 5].map((starValue) => (
                            <button
                              key={starValue}
                              type="button"
                              onClick={() => setNewRating(starValue)}
                              className="text-amber-400 hover:scale-110 transition-transform"
                            >
                              <Star
                                className={`w-6 h-6 ${
                                  starValue <= newRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                          Votre Commentaire
                        </label>
                        <textarea
                          required
                          rows={3}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Décrivez votre expérience avec notre encadrement, nos formations ou nos e-books..."
                          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingTestimonial}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {submittingTestimonial ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Enregistrement en cours...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Publier mon témoignage</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Footer & Contact Direct */}
      <footer className="bg-gray-950 text-gray-400 py-16 border-t border-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-10">
          <div className="max-w-xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Une question spécifique ? Discutons-en !
            </h2>
            <p className="text-gray-400 text-sm sm:text-base">
              Notre équipe d'administration est disponible pour répondre à vos demandes personnalisées, besoins en statistiques ou encadrements particuliers.
            </p>
          </div>

          {/* WhatsApp Direct CTA */}
          <div>
            <a
              href={`https://wa.me/${adminWhatsAppPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-900/30 hover:scale-105 active:scale-95 transition-all text-base gap-2.5"
            >
              <MessageSquare className="w-5 h-5 fill-white text-white" />
              <span>Contactez-nous sur WhatsApp</span>
            </a>
          </div>

          <div className="border-t border-gray-900 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-white font-bold">
              <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center font-black text-xs">
                E
              </div>
              <span>Exceller chez Pierre</span>
            </div>
            
            <div className="flex gap-4">
              <Link to="/client/login" className="hover:text-white transition-colors">Espace Client</Link>
              <span className="text-gray-800">|</span>
              <Link to="/login" className="hover:text-white transition-colors">Portail Admin</Link>
            </div>

            <p className="text-gray-600">
              © {new Date().getFullYear()} Exceller chez Pierre. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
