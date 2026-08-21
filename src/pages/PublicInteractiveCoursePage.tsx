import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { isUuid } from '../lib/slugUtils';
import ClientNavBar from '../components/ClientNavBar';
import Footer from '../components/Footer';
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
  Check
} from 'lucide-react';

export default function PublicInteractiveCoursePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [expandedModules, setExpandedModules] = useState<{ [key: string]: boolean }>({});
  const [copiedLink, setCopiedLink] = useState(false);

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
        let error: any = null;

        if (isUuid(id)) {
          // Recherche par UUID
          const res = await supabase
            .from('interactive_courses')
            .select(selectQuery)
            .eq('id', id)
            .maybeSingle();
          data = res.data;
          error = res.error;
        } else {
          // Recherche par Slug
          const res = await supabase
            .from('interactive_courses')
            .select(selectQuery)
            .eq('slug', id)
            .maybeSingle();

          if (res.data) {
            data = res.data;
            error = null;
          } else {
            error = res.error;
          }
        }

        if (error) throw error;

        // Redirection canonique si appelé via UUID mais possède un slug lisible
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

          // Expand first module by default
          if (data.interactive_course_modules.length > 0) {
            setExpandedModules({ [data.interactive_course_modules[0].id]: true });
          }
        }

        setCourse(data);
      } catch (err) {
        console.error("Erreur chargement cours interactif:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, navigate]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
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

  const handleCopyShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
        <ClientNavBar currentSession={session} />
        <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl text-center border border-gray-100 shadow-sm">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Cours introuvable</h2>
          <p className="text-xs text-gray-500 mb-6">Le cours interactif demandé n'existe pas ou est indisponible.</p>
          <Link to="/catalogue" className="px-5 py-2.5 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 transition-colors inline-block">
            Retour au catalogue
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

  modules.forEach((m: any) => {
    (m.interactive_course_lessons || []).forEach((l: any) => {
      const acts = l.interactive_activities || [];
      totalActivities += acts.length;
      codeActivities += acts.filter((a: any) => a.activity_type === 'code_r').length;
    });
  });

  const isFree = !course.price_fcfa || course.price_fcfa === 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between font-sans">
      <ClientNavBar currentSession={session} />

      <main className="flex-1">
        {/* Banner Section */}
        <section className="bg-slate-900 text-white pt-8 pb-12 sm:pt-12 sm:pb-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-900/40 to-purple-900/40 pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <Link 
              to="/catalogue" 
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour au catalogue</span>
            </Link>

            <div className="grid lg:grid-cols-3 gap-8 items-start">
              {/* Main Course Info */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-sky-500/20 text-sky-300 border border-sky-400/30 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Cours Interactif Autonome
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-gray-200 border border-white/10">
                    {course.category || 'Logiciel R'}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-gray-200 border border-white/10">
                    {course.level === 'beginner' ? 'Niveau Débutant' : course.level === 'intermediate' ? 'Niveau Intermédiaire' : 'Niveau Avancé'}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                  {course.title}
                </h1>

                {course.description && (
                  <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-3xl">
                    {course.description}
                  </p>
                )}

                {/* Highlights Bar */}
                <div className="pt-4 flex flex-wrap gap-4 sm:gap-6 text-xs sm:text-sm font-semibold text-gray-300 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-sky-400" />
                    <span>{modules.length} Chapitres</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-purple-400" />
                    <span>{totalLessons} Leçons</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-emerald-400" />
                    <span>{codeActivities} Exercices R interactifs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Correction WebR instantanée</span>
                  </div>
                </div>
              </div>

              {/* Action Box / Pricing Card */}
              <div className="bg-white rounded-3xl p-6 text-gray-900 border border-gray-100 shadow-2xl space-y-5 lg:sticky lg:top-24">
                {course.cover_image_url && (
                  <div className="rounded-2xl overflow-hidden aspect-video relative">
                    <img src={course.cover_image_url} alt={course.title} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex items-baseline justify-between border-b border-gray-100 pb-4">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Accès</span>
                  <div className="text-right">
                    {isFree ? (
                      <span className="text-2xl font-black text-emerald-600">GRATUIT</span>
                    ) : (
                      <span className="text-2xl font-black text-gray-900">
                        {course.price_fcfa.toLocaleString('fr-FR')} FCFA
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Accès immédiat & apprentissage à votre rythme</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Exécution réelle du code R dans votre navigateur</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Suivi de progression automatique</span>
                  </div>
                </div>

                <button
                  onClick={handleStartCourse}
                  className="w-full py-4 px-6 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-extrabold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-600/25"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>{isFree ? 'Commencer le cours' : "S'inscrire au cours"}</span>
                </button>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={handleCopyShare}
                    className="text-xs font-bold text-gray-500 hover:text-sky-600 transition-colors flex items-center gap-1.5"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Lien copié !' : 'Partager'}</span>
                  </button>

                  <a
                    href={`https://wa.me/237698389030?text=${encodeURIComponent(`Bonjour ! Je souhaite des informations sur le cours interactif "${course.title}".`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[#25D366] hover:underline flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Besoin d'aide ?</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Details */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-10">

              {/* Pedagogy / WebR Feature Banner */}
              <div className="bg-gradient-to-br from-sky-50 via-indigo-50/50 to-purple-50 p-6 sm:p-8 rounded-3xl border border-sky-100 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-sky-600 text-white rounded-2xl shadow-sm">
                    <Code className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Pratiquez directement en R</h3>
                    <p className="text-xs text-gray-600">Aucune installation requise — WebR exécute le code dans votre navigateur</p>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                  Chaque leçon comprend des explications claires suivies d'activités pratiques interactives. Vous saisissez du vrai code R, le soumettez, et notre moteur évalue vos réponses instantanément.
                </p>
              </div>

              {/* Course Program / Curriculum */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900">Programme du cours</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      {modules.length} chapitres • {totalLessons} leçons • {totalActivities} activités d'évaluation
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {modules.map((module: any, idx: number) => {
                    const lessons = module.interactive_course_lessons || [];
                    const isExpanded = !!expandedModules[module.id];

                    return (
                      <div 
                        key={module.id} 
                        className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs transition-all"
                      >
                        <button
                          onClick={() => toggleModule(module.id)}
                          className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-gray-50/80 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 text-xs font-black flex items-center justify-center shrink-0 border border-sky-100">
                              {idx + 1}
                            </span>
                            <div>
                              <h3 className="text-sm sm:text-base font-extrabold text-gray-900 leading-snug">
                                {module.title}
                              </h3>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {lessons.length} leçons
                              </p>
                            </div>
                          </div>
                          <div className="p-1 text-gray-400">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="bg-gray-50/50 border-t border-gray-100 px-4 py-3 sm:px-6 sm:py-4 space-y-2">
                            {lessons.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">Aucune leçon dans ce chapitre pour le moment.</p>
                            ) : (
                              lessons.map((lesson: any, lIdx: number) => {
                                const acts = lesson.interactive_activities || [];
                                const hasRCode = acts.some((a: any) => a.activity_type === 'code_r');

                                return (
                                  <div 
                                    key={lesson.id}
                                    className="p-3 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                      <span className="text-gray-400 font-bold text-[11px]">{idx + 1}.{lIdx + 1}</span>
                                      <span className="font-semibold text-gray-800 truncate">{lesson.title}</span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {hasRCode && (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                                          <Code className="w-3 h-3" /> Code R
                                        </span>
                                      )}
                                      <span className="text-[10px] text-gray-400 font-medium">
                                        {acts.length} exercice{acts.length > 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Formateur Profile Card */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-2xs space-y-4">
                <h3 className="text-base font-extrabold text-gray-900 uppercase tracking-wider text-xs text-gray-400">
                  Formateur & Concepteur
                </h3>
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-700 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-md">
                    PV
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">Pierre Valdeze Mbom Mbom</h4>
                    <p className="text-xs text-sky-600 font-semibold mb-2">Consultant Data Analysis, Statistique & R</p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Fondateur d'Exceller chez Pierre, spécialisé dans l'accompagnement sur-mesure en analyse de données, statistiques descriptives et inférentielles sur Excel, R, SPSS et Power BI.
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Sidebar CTA on large screens */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-3xl space-y-4 shadow-xl">
                <div className="p-3 bg-white/10 text-sky-400 rounded-2xl w-fit backdrop-blur-sm">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Inclus dans ce cours</h3>
                <ul className="space-y-3 text-xs text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Accès illimité 24/7 depuis PC et mobile</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Moteur de correction WebR temps réel</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Validation automatique des activités</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Attestation de réussite en fin de parcours</span>
                  </li>
                </ul>

                <button
                  onClick={handleStartCourse}
                  className="w-full py-3 px-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md mt-2"
                >
                  {isFree ? 'Accéder gratuitement' : 'S\'inscrire maintenant'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
