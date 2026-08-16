import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView } from 'motion/react';
import { supabase } from '../lib/supabaseClient';
import ClientNavBar from '../components/ClientNavBar';
import Footer from '../components/Footer';
import { useToast } from '../components/Toast';

function formatDescriptionHtml(text: string | null | undefined): string {
  if (!text) return '';
  const hasHtml = /<[a-z][\s\S]*>/i.test(text);
  if (hasHtml) {
    return text;
  }
  return text
    .split('\n\n')
    .map(p => `<p class="mb-1 leading-relaxed">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}
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
  Check,
  Gift,
  ShoppingBag,
  Smartphone,
  Download
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
  const { toast } = useToast();
  const adminWhatsAppPhone = "237698389030"; // Pierre's phone number

  const [stats, setStats] = useState([
    { target: 36, suffix: "+", label: "Étudiants & Apprenants" },
    { target: 9, suffix: "+", label: "Projets & Accompagnements" },
    { target: 5, suffix: "", label: "Formations & E-books" },
    { target: 98, suffix: "%", label: "Taux de satisfaction" }
  ]);

  const [dbTestimonials, setDbTestimonials] = useState<any[]>([]);
  const [loadingTestimonials, setLoadingTestimonials] = useState(true);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [latestCourse, setLatestCourse] = useState<any>(null);
  const [featuredEbooks, setFeaturedEbooks] = useState<any[]>([]);
  const [loadingEbooks, setLoadingEbooks] = useState(true);
  const navigate = useNavigate();

  // Profile selector state for 'JE CHOISIS' section
  const [selectedProfile, setSelectedProfile] = useState<'student' | 'pro' | 'reader'>('student');

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
    fetchRealStats();
    fetchTestimonials();
    fetchLatestCourse();
    fetchFeaturedEbooks();
  }, []);

  const fetchRealStats = async () => {
    try {
      const res = await fetch('/api/public-stats');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.stats) {
          const s = json.stats;
          setStats([
            { target: s.students.count, suffix: s.students.suffix, label: s.students.label },
            { target: s.projects.count, suffix: s.projects.suffix, label: s.projects.label },
            { target: s.courses.count, suffix: s.courses.suffix, label: s.courses.label },
            { target: s.satisfaction.count, suffix: s.satisfaction.suffix, label: s.satisfaction.label }
          ]);
          return;
        }
      }
    } catch (err) {
      console.warn("Échec récupération stats API, fallback Supabase direct:", err);
    }

    try {
      const [coursesRes, testimonialsRes] = await Promise.all([
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('is_archived', false),
        supabase.from('testimonials').select('rating')
      ]);

      const coursesCount = coursesRes.count || 5;
      let satisfaction = 98;
      if (testimonialsRes.data && testimonialsRes.data.length > 0) {
        const total = testimonialsRes.data.reduce((acc: number, t: any) => acc + (t.rating || 5), 0);
        satisfaction = Math.min(100, Math.max(80, Math.round((total / (testimonialsRes.data.length * 5)) * 100)));
      }

      setStats([
        { target: 36, suffix: "+", label: "Étudiants & Apprenants" },
        { target: 9, suffix: "+", label: "Projets & Accompagnements" },
        { target: coursesCount, suffix: "", label: "Formations & E-books" },
        { target: satisfaction, suffix: "%", label: "Taux de satisfaction" }
      ]);
    } catch (e) {
      console.error("Erreur stats fallback:", e);
    }
  };

  const fetchFeaturedEbooks = async () => {
    try {
      setLoadingEbooks(true);
      let { data, error } = await supabase
        .from('courses')
        .select('*, trainers(name, photo_url)')
        .eq('product_type', 'ebook')
        .eq('is_active', true)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) {
        const { data: fallbackData } = await supabase
          .from('courses')
          .select('*, trainers(name, photo_url)')
          .eq('product_type', 'ebook')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(4);
        data = fallbackData;
      }

      setFeaturedEbooks(data || []);
    } catch (err) {
      console.error("Erreur chargement e-books vitrine:", err);
    } finally {
      setLoadingEbooks(false);
    }
  };

  const fetchLatestCourse = async () => {
    try {
      // First try with slug (if column exists)
      let { data, error } = await supabase
        .from('courses')
        .select('id, slug, title')
        .eq('is_active', true)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        // Fallback without slug or without is_archived
        const fallbackRes = await supabase
          .from('courses')
          .select('id, title')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error) throw error;

      if (data && data.length > 0) {
        setLatestCourse(data[0]);
      }
    } catch (err: any) {
      console.error("Erreur lors du chargement de la dernière formation:", err.message || err);
    }
  };

  const fetchTestimonials = async () => {
    try {
      setLoadingTestimonials(true);
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .order('id', { ascending: false });
      
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
      toast.info("Veuillez remplir tous les champs obligatoires.");
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
      toast.error("Une erreur est survenue lors de l'enregistrement de votre témoignage : " + err.message);
    } finally {
      setSubmittingTestimonial(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden pt-safe pb-safe">
      {/* 1. Mobile Smart Banner - Visible only on mobile/tablet */}
      <Link 
        to="/download" 
        className="block lg:hidden bg-violet-50 border-b border-violet-100 py-2.5 px-4 text-center transition-colors hover:bg-violet-100/80 group"
      >
        <div className="flex items-center justify-center gap-2 text-[10px] sm:text-xs font-medium text-slate-800">
          <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
          <span>
            📱 Pour un suivi optimal de vos cours en live et vos statistiques, téléchargez l'application Android officielle. <span className="underline decoration-indigo-300 underline-offset-2 font-bold group-hover:text-indigo-700">Télécharger l'APK</span>
          </span>
        </div>
      </Link>

      {/* Top Notification Bar */}
      {latestCourse && (
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-xs sm:text-sm font-semibold py-2.5 px-4 shadow-sm relative overflow-hidden transition-all text-center">
          <Link to={`/course/${latestCourse.slug || latestCourse.id}`} className="hover:underline flex items-center justify-center gap-2 flex-wrap mx-auto max-w-2xl">
            <span className="bg-white/20 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 mx-auto sm:mx-0">
              Du nouveau
            </span>
            <span className="font-semibold text-center leading-normal line-clamp-2">
              {latestCourse.title}
            </span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform hover:translate-x-1 hidden sm:inline-block" />
          </Link>
        </div>
      )}

      {/* Navigation */}
      <ClientNavBar currentSession={currentSession} />

      {/* 1. Hero Section */}
      <section className="relative bg-gradient-to-b from-blue-50/70 via-indigo-50/30 to-white pt-24 pb-20 sm:pt-32 sm:pb-28 overflow-hidden flex items-center min-h-[60vh]">
        {/* Geometric patterns */}
        <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-300 rounded-full blur-3xl opacity-20"></div>
          <div className="absolute -top-40 right-10 w-[400px] h-[400px] bg-purple-300 rounded-full blur-3xl opacity-20"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6 sm:space-y-8 max-w-4xl mx-auto"
          >
            {/* 1. Petite accroche de marque */}
            <div className="inline-flex items-center justify-center">
              <span className="text-xs sm:text-sm font-black tracking-widest text-blue-600 uppercase">
                Exceller chez Pierre
              </span>
            </div>
            
            {/* 2. Titre principal très concret */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-gray-900 tracking-tight leading-[1.15] sm:leading-tight">
              Apprenez à maîtriser les outils <span className="text-blue-600">qui font la différence.</span>
            </h1>
            
            {/* 3. Sous-titre */}
            <p className="text-gray-600 text-lg sm:text-xl md:text-2xl leading-relaxed max-w-3xl mx-auto">
              Formations pratiques en Excel, Power BI, R, statistiques et analyse de données, pour étudiants, chercheurs et professionnels.
            </p>

            {/* 4. Deux boutons maximum */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 sm:pt-10">
              {/* CTA principal */}
              <Link
                to="/catalogue"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 sm:py-4.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all hover:-translate-y-0.5 text-base sm:text-lg"
              >
                <span>Voir les formations</span>
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
              
              {/* CTA secondaire */}
              <Link
                to="/client/register"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 sm:py-4.5 bg-white hover:bg-gray-50 text-gray-800 font-bold rounded-2xl border-2 border-gray-200 hover:border-gray-300 transition-all text-base sm:text-lg"
              >
                <span>S'inscrire</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Nouvelle section "Que recherchez-vous ?" */}
      <section className="py-16 sm:py-20 bg-gray-50 border-b border-gray-100 relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
              Que recherchez-vous ?
            </h2>
            <p className="text-gray-600 text-base sm:text-lg mt-3">
              Choisissez simplement ce dont vous avez besoin.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Carte 1 */}
            <Link
              to="/catalogue"
              className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 flex flex-col group"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform shadow-sm">
                🎓
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                Me former
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6 flex-1">
                Développer une compétence avec une formation pratique.
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 group-hover:text-blue-800 transition-colors mt-auto pt-4 border-t border-gray-100">
                <span>Découvrir</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Carte 2 */}
            <Link
              to="/expertises"
              className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 flex flex-col group"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform shadow-sm">
                📊
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                Analyser mes données
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6 flex-1">
                Obtenir de l'aide pour traiter et analyser mes données.
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 group-hover:text-indigo-800 transition-colors mt-auto pt-4 border-t border-gray-100">
                <span>Découvrir</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Carte 3 */}
            <Link
              to="/expertises"
              className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 flex flex-col group"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform shadow-sm">
                📝
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                Réussir mon mémoire
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6 flex-1">
                Être accompagné dans mon travail de recherche.
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs font-black text-purple-600 group-hover:text-purple-800 transition-colors mt-auto pt-4 border-t border-gray-100">
                <span>Découvrir</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Carte 4 */}
            <Link
              to="/methodology"
              className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 flex flex-col group"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform shadow-sm">
                📚
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">
                Apprendre avec nos e-books
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6 flex-1">
                Découvrir des livres, guides et manuels d'analyse pratiques.
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600 group-hover:text-emerald-800 transition-colors mt-auto pt-4 border-t border-gray-100">
                <span>Accéder aux e-books</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. SECTION JE COMPRENDS : Les 3 Piliers d'Exceller chez Pierre */}
      <section className="py-16 bg-white border-b border-gray-100 relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-100">
              Comprendre notre offre
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mt-3">
              Que faisons-nous pour vous ?
            </h2>
            <p className="text-gray-600 text-sm sm:text-base mt-2">
              Une plateforme unique combinant logiciels d'analyse, accompagnement sur mesure et livres d'apprentissage.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {/* Pilier 1 */}
            <div className="bg-gradient-to-b from-blue-50/50 to-white p-6 sm:p-8 rounded-3xl border border-blue-100/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold mb-5 shadow-md group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-2">
                  Formations aux Logiciels
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  Maîtrisez <strong>SPSS, Stata, R, Excel avancé et Python</strong> avec des cours vidéo, des cas pratiques réels et des enregistrements de sessions live.
                </p>
              </div>
              <Link
                to="/catalogue"
                className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-800 transition-colors pt-3 border-t border-blue-100"
              >
                <span>Consulter les formations</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Pilier 2 */}
            <div className="bg-gradient-to-b from-purple-50/50 to-white p-6 sm:p-8 rounded-3xl border border-purple-100/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-bold mb-5 shadow-md group-hover:scale-110 transition-transform">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-2">
                  Accompagnement Mémoire & Thèse
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  Bénéficiez d'un suivi personnalisé pour structurer votre projet de recherche, traiter vos données et réussir votre soutenance avec mention.
                </p>
              </div>
              <button
                onClick={() => {
                  if (currentSession) {
                    navigate('/catalogue?action=propose');
                  } else {
                    navigate('/client/register?redirect=/catalogue?action=propose&reason=propose');
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs font-black text-purple-600 hover:text-purple-800 transition-colors pt-3 border-t border-purple-100 text-left"
              >
                <span>Demander un encadrement</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pilier 3 */}
            <div className="bg-gradient-to-b from-emerald-50/50 to-white p-6 sm:p-8 rounded-3xl border border-emerald-100/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold mb-5 shadow-md group-hover:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-2">
                  E-books & Guides Pratiques
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  Téléchargez des manuels pas-à-pas clairs, illustrés d'exemples concrets pour progresser immédiatement en autonomie.
                </p>
              </div>
              <Link
                to="/ressources"
                className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600 hover:text-emerald-800 transition-colors pt-3 border-t border-emerald-100"
              >
                <span>Voir les e-books</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION E-BOOKS À LA UNE */}
      <section className="py-16 bg-slate-50 border-b border-gray-100 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-100/80">
                Bibliothèque Numérique
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mt-3">
                Nos E-books & Guides à la une
              </h2>
              <p className="text-gray-600 text-sm sm:text-base mt-2 max-w-xl">
                Des manuels d'analyse de données clairs et directement applicables à vos projets.
              </p>
            </div>
            <Link
              to="/ressources"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-2xl transition-all shadow-md shrink-0 active:scale-95"
            >
              <BookOpen className="w-4 h-4" />
              <span>Accéder à tous les e-books</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loadingEbooks ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-3xl p-4 border border-gray-150 animate-pulse h-80" />
              ))}
            </div>
          ) : featuredEbooks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredEbooks.map((ebook) => {
                const isFree = !ebook.price_fcfa || ebook.price_fcfa === 0;
                const formattedPrice = isFree ? "Gratuit" : `${Number(ebook.price_fcfa).toLocaleString('fr-FR')} FCFA`;

                return (
                  <Link
                    key={ebook.id}
                    to={`/course/${ebook.id}`}
                    className="group bg-white rounded-3xl border border-gray-150 shadow-xs hover:shadow-xl hover:border-emerald-200 transition-all duration-300 flex flex-col overflow-hidden active:scale-[0.98]"
                  >
                    <div className="relative w-full h-48 bg-slate-900 overflow-hidden flex items-center justify-center">
                      {ebook.cover_image_url ? (
                        <img
                          src={ebook.cover_image_url}
                          alt={ebook.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-5 flex flex-col justify-between text-white">
                          <span className="text-[10px] font-black uppercase text-emerald-200">E-Book</span>
                          <h4 className="font-bold text-sm line-clamp-2">{ebook.title}</h4>
                          <span className="text-[10px] text-emerald-100">Exceller chez Pierre</span>
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className={`font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider text-white ${isFree ? 'bg-emerald-500' : 'bg-slate-900/80'}`}>
                          {isFree ? 'Gratuit' : 'E-book'}
                        </span>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1 justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-2 text-sm mb-2">
                          {ebook.title}
                        </h3>
                        {ebook.description && (
                          <div 
                            className="text-gray-500 text-xs line-clamp-2 leading-relaxed mb-3 [&_*]:inline [&_*]:m-0 [&_*]:font-normal [&_strong]:font-bold [&_b]:font-bold [&_em]:italic"
                            dangerouslySetInnerHTML={{ __html: formatDescriptionHtml(ebook.description) }}
                          />
                        )}
                      </div>
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                        <span className="font-black text-gray-900">{formattedPrice}</span>
                        <span className="text-emerald-600 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                          Découvrir <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-gray-150 text-center max-w-lg mx-auto">
              <BookOpen className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 text-base mb-1">Bibliothèque en cours d'enrichissement</h3>
              <p className="text-xs text-gray-500 mb-4">De nouveaux e-books seront très prochainement disponibles.</p>
              <Link to="/ressources" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:underline">
                Accéder à la section Ressources <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* 3. SECTION JE CHOISIS → JE CONSULTE : Sélecteur Interactif de Besoins */}
      <section className="py-16 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-300 bg-indigo-900/60 px-3.5 py-1.5 rounded-full border border-indigo-700/50">
              Trouver votre solution
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3 text-white">
              Quelle est votre situation ?
            </h2>
            <p className="text-indigo-200 text-sm sm:text-base mt-2">
              Sélectionnez votre profil pour découvrir la solution la plus adaptée à vos objectifs.
            </p>
          </div>

          {/* Selector Tabs */}
          <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto mb-8 p-1.5 bg-slate-800/80 rounded-2xl border border-slate-700">
            <button
              onClick={() => setSelectedProfile('student')}
              className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
                selectedProfile === 'student'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Étudiant / Chercheur</span>
            </button>
            <button
              onClick={() => setSelectedProfile('pro')}
              className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
                selectedProfile === 'pro'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Professionnel</span>
            </button>
            <button
              onClick={() => setSelectedProfile('reader')}
              className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
                selectedProfile === 'reader'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>E-books / Autodidacte</span>
            </button>
          </div>

          {/* Dynamic Content Display based on Profile */}
          <div className="max-w-3xl mx-auto bg-slate-800/90 rounded-3xl p-6 sm:p-8 border border-slate-700 shadow-2xl backdrop-blur-sm">
            {selectedProfile === 'student' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      Option recommandée : Encadrement Mémoire / Thèse & Logiciels
                    </h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      Conçu pour les étudiants en Licence, Master et Doctorat ayant besoin d'un cadrage méthodologique rigoureux, du nettoyage et traitement de données (SPSS, Stata, R) et d'une préparation aux soutenances.
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-2.5 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Rédaction & correction du plan de recherche</span>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-2.5 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Traitement et codage sous SPSS / Stata / R</span>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-2.5 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Interprétation statistique des résultats</span>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-2.5 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Coaching oral pour la soutenance</span>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      if (currentSession) {
                        navigate('/catalogue?action=propose');
                      } else {
                        navigate('/client/register?redirect=/catalogue?action=propose&reason=propose');
                      }
                    }}
                    className="flex-1 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Demander un accompagnement</span>
                  </button>
                  <Link
                    to="/catalogue"
                    className="flex-1 px-6 py-3.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <Compass className="w-4 h-4" />
                    <span>Voir les cours & vidéos</span>
                  </Link>
                </div>
              </motion.div>
            )}

            {selectedProfile === 'pro' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      Option recommandée : Formations Pratiques Outils & Analytics
                    </h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      Idéal pour les cadres, consultants, chercheurs d'emploi et analystes souhaitant développer des compétences directes sur Excel avancé, Power BI, Python ou SPSS.
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-2.5 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Tableaux de bord & automatisations Excel</span>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-2.5 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Analyses descriptives et modélisation</span>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-2.5 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Certificats de réussite téléchargeables</span>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-2.5 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Accès illimité aux replays des formations</span>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/catalogue"
                    className="flex-1 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <Compass className="w-4 h-4" />
                    <span>Consulter le catalogue des formations</span>
                  </Link>
                  <a
                    href={`https://wa.me/${adminWhatsAppPhone}?text=${encodeURIComponent("Bonjour Pierre ! Je suis un professionnel et je souhaite me former aux logiciels d'analyse de données.")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-6 py-3.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>Échanger sur WhatsApp</span>
                  </a>
                </div>
              </motion.div>
            )}

            {selectedProfile === 'reader' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      Option recommandée : E-books & Guides Pratiques
                    </h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      Si vous préférez étudier à votre propre rythme, téléchargez nos ouvrages pratiques avec cas d'application concrets et illustrations détaillées.
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-2.5 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Format PDF haute qualité téléchargeable</span>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-2.5 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Fichiers de données d'exercices inclus</span>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-2.5 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Guides de statistiques sans jargon inutile</span>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/60 flex items-center gap-2.5 text-xs text-slate-200">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Lecture disponible sur mobile, tablette et PC</span>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/ressources"
                    className="flex-1 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Découvrir tous les e-books</span>
                  </Link>
                  <a
                    href="https://excellerchezpierre.mychariow.co/prd_23xt77jo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-6 py-3.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <Gift className="w-4 h-4 text-amber-400" />
                    <span>Guide Offert de Bienvenue</span>
                  </a>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Section Cadeau de Bienvenue */}
      <section className="py-20 bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/30 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-[2.5rem] border border-gray-150/70 shadow-2xl shadow-blue-100/40 p-8 sm:p-12 md:p-16 max-w-5xl mx-auto overflow-hidden relative">
            {/* Background decorative element */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/30 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100/30 rounded-full blur-3xl -ml-20 -mb-20"></div>

            <div className="relative grid gap-12 lg:grid-cols-2 items-center">
              {/* Image side */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="order-1 flex justify-center"
              >
                <div className="relative group max-w-2xl lg:max-w-full w-full">
                  {/* Decorative frame shadow */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
                  
                  <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                    <img
                      src="https://titncxnaixghtoerkfiu.supabase.co/storage/v1/object/sign/Images/file_00000000a6e871f49516e7166eb65c0f.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hODRjMTA3My1lMDY4LTQxYzQtYjJkYi1hNGUyMDk0MGE2NzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJJbWFnZXMvZmlsZV8wMDAwMDAwMGE2ZTg3MWY0OTUxNmU3MTY2ZWI2NWMwZi5wbmciLCJzY29wZSI6ImRvd25sb2FkIiwiaWF0IjoxNzg0MTk3ODQyLCJleHAiOjE4MTU3MzM4NDJ9.Eir17hsCyqArRAxa3wrQI0TU0Od2xcsw1wgj-fL4BB8"
                      alt="Votre Cadeau de Bienvenue"
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Text side */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="order-2 space-y-6 text-left"
              >
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 font-extrabold text-xs uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                  <span>Cadeau Exceptionnel</span>
                </div>

                <div className="space-y-3">
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
                    Votre Cadeau de Bienvenue 🎁
                  </h2>
                  <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                    Pour vous remercier de votre intérêt pour <strong>Exceller chez Pierre</strong>, nous sommes ravis de vous offrir un cadeau exclusif préparé spécialement pour vous.
                  </p>
                </div>

                <div className="space-y-3.5 bg-gray-50/60 p-5 rounded-2xl border border-gray-100/70">
                  <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Ce que vous allez recevoir :</p>
                  <ul className="space-y-2.5">
                    {[
                      "Un guide pratique offert immédiatement",
                      "Des astuces exclusives pour maximiser vos compétences",
                      "Des conseils concrets d'outils d'analyse et statistiques",
                      "Un accès privilégié à nos nouveautés et ateliers"
                    ].map((benefit, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2">
                  <a
                    href="https://excellerchezpierre.mychariow.co/prd_23xt77jo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-100 hover:shadow-xl hover:shadow-emerald-200 transition-all hover:scale-[1.02] active:scale-98 text-base text-center cursor-pointer font-sans"
                  >
                    <Gift className="w-5 h-5 mr-2" />
                    <span>Obtenir mon cadeau 🎁</span>
                  </a>
                </div>
              </motion.div>
            </div>
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

      {/* Final CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 rounded-[2.5rem] p-10 sm:p-16 text-white shadow-2xl shadow-emerald-200 relative overflow-hidden group"
          >
            {/* Background Image with Overlay */}
            <div 
              className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-30 transition-transform duration-700 group-hover:scale-105" 
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80')" }}
            ></div>
            
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/20 rounded-full -ml-16 -mb-16 blur-2xl"></div>

            <div className="relative z-10 space-y-8">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight max-w-3xl mx-auto drop-shadow-sm">
                Prêt à réussir vos analyses de données ?
              </h2>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
                <Link
                  to="/catalogue"
                  className="w-full sm:w-auto px-8 py-4 bg-white text-emerald-700 font-black rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all text-base flex items-center justify-center gap-2"
                >
                  <GraduationCap className="w-5 h-5" />
                  <span>Voir les formations</span>
                </Link>
                <Link
                  to="/client/register"
                  className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all text-base flex items-center justify-center gap-2 border border-white/20"
                >
                  <UserPlus className="w-5 h-5 fill-white" />
                  <span>S'inscrire</span>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 5. Mobile App Promotion Section */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-50 rounded-[2.5rem] border border-slate-100 p-8 sm:p-12 md:p-16 overflow-hidden relative group">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-200/20 rounded-full blur-3xl -mr-20 -mt-20 opacity-60"></div>
            
            <div className="relative grid gap-12 md:grid-cols-2 items-center">
              {/* Left: Text */}
              <div className="space-y-6 text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-100 border border-violet-200 text-violet-700 font-extrabold text-[10px] uppercase tracking-wider">
                  <Smartphone className="w-3 h-3" />
                  <span>Application Officielle</span>
                </div>
                
                <h3 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight leading-tight">
                  Votre apprentissage ne s'arrête jamais
                </h3>
                
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                  Accédez instantanément à vos résumés de cours, visionnez les replays de vos séances de formation et téléchargez vos guides pratiques et fichiers d'exercices (Excel, SPSS) directement depuis votre smartphone, même sans connexion Internet.
                </p>
              </div>

              {/* Right: CTA */}
              <div className="flex flex-col items-center justify-center space-y-4">
                <Link
                  to="/download"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-98 text-base group"
                >
                  <Download className="w-6 h-6 mr-3 transition-transform group-hover:-translate-y-0.5" />
                  <span>Télécharger l'application (.apk)</span>
                </Link>
                <p className="text-[10px] text-slate-400 font-medium italic">
                  Optimisé pour Android et appareils Samsung Galaxy
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Footer & Contact Direct */}
      <Footer adminWhatsAppPhone={adminWhatsAppPhone} />
    </div>
  );
}
