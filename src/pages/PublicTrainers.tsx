import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ClientNavBar from '../components/ClientNavBar';
import Footer from '../components/Footer';
import { TrainerAvatar } from '../components/TrainerAvatar';
import { 
  Users, 
  Award, 
  BookOpen, 
  Sparkles, 
  User, 
  ArrowRight, 
  AlertCircle, 
  RefreshCw, 
  X, 
  MessageSquare,
  CheckCircle2,
  ExternalLink,
  GraduationCap
} from 'lucide-react';

interface Trainer {
  id: string;
  name: string;
  description: string;
  photo_url?: string;
  created_at?: string;
}

interface AssociatedCourse {
  id: string;
  title: string;
  product_type?: string;
  price_fcfa?: number;
  trainer_id?: string;
  is_active?: boolean;
  is_archived?: boolean;
}

function formatParagraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.split('\n').filter(p => p.trim().length > 0);
}

export default function PublicTrainers() {
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [trainerCoursesMap, setTrainerCoursesMap] = useState<Record<string, AssociatedCourse[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected trainer for detail modal
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);

  useEffect(() => {
    // SEO setup
    document.title = "Nos formateurs | Exceller chez Pierre";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content', 
        'Découvrez les formateurs et experts qui vous accompagnent dans vos formations chez Exceller chez Pierre.'
      );
    }

    // Session auth listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentSession(session);
    });

    fetchData();

    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async (retries = 2) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch trainers with retry helper
      let trainersData: any = null;
      let trainersError: any = null;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await supabase
            .from('trainers')
            .select('*');
          trainersData = res.data;
          trainersError = res.error;
          if (!trainersError) break;
        } catch (e) {
          trainersError = e;
        }
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }

      if (trainersError) {
        throw trainersError;
      }

      const trainersList = (trainersData || []).sort((a: any, b: any) => 
        (a.name || '').localeCompare(b.name || '')
      );

      setTrainers(trainersList);

      // 2. Fetch active non-archived courses safely
      let coursesData: AssociatedCourse[] = [];
      try {
        const { data, error: coursesError } = await supabase
          .from('courses')
          .select('id, title, product_type, price_fcfa, trainer_id, is_active, is_archived')
          .eq('is_archived', false)
          .eq('is_active', true);

        if (coursesError) {
          const { data: fallbackData } = await supabase
            .from('courses')
            .select('id, title, product_type, price_fcfa, trainer_id, is_active')
            .eq('is_active', true);
          coursesData = fallbackData || [];
        } else {
          coursesData = data || [];
        }
      } catch (e) {
        console.warn("Could not load associated courses:", e);
        coursesData = [];
      }

      // Group courses by trainer_id
      const coursesMap: Record<string, AssociatedCourse[]> = {};
      coursesData.forEach(course => {
        if (course.trainer_id) {
          if (!coursesMap[course.trainer_id]) {
            coursesMap[course.trainer_id] = [];
          }
          coursesMap[course.trainer_id].push(course);
        }
      });

      setTrainerCoursesMap(coursesMap);

    } catch (err: any) {
      console.warn("Erreur lors de la récupération des formateurs:", err);
      setError("Impossible de charger les profils des formateurs pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <ClientNavBar currentSession={currentSession} />

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 sm:space-y-16">
        
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/70 to-slate-900 border border-slate-800/80 p-6 sm:p-10 lg:p-12 text-center shadow-2xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto space-y-4">
            {/* Tag / Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-black tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>NOTRE ÉQUIPE</span>
            </div>

            {/* Main Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Apprenez auprès de ceux qui pratiquent.
            </h1>

            {/* Description */}
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal pt-1">
              Chez <strong className="text-white font-bold">Exceller chez Pierre</strong>, nous croyons qu'un bon apprentissage commence par un accompagnement de qualité. Découvrez les experts qui partagent leur expérience et vous accompagnent dans votre progression.
            </p>
          </div>
        </section>

        {/* TRAINERS SECTION */}
        <section className="space-y-8">
          
          {/* Section Sub-header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                <Users className="w-7 h-7 text-blue-500" />
                <span>Des formateurs qui vous accompagnent</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Découvrez les experts qui partagent leur expérience et vous accompagnent dans votre progression.
              </p>
            </div>
            
            {!loading && !error && trainers.length > 0 && (
              <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-800 shrink-0">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>{trainers.length} {trainers.length > 1 ? 'formateurs experts' : 'formateur expert'}</span>
              </div>
            )}
          </div>

          {/* LOADING STATE (Skeleton Loaders) */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {[1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  className="bg-slate-900/80 border border-slate-800/90 rounded-3xl p-6 space-y-5 animate-pulse"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-slate-800 rounded-2xl shrink-0" />
                    <div className="space-y-2.5 flex-1">
                      <div className="h-5 bg-slate-800 rounded-lg w-3/4" />
                      <div className="h-3 bg-slate-800/80 rounded-md w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="h-3.5 bg-slate-800 rounded-md w-full" />
                    <div className="h-3.5 bg-slate-800 rounded-md w-5/6" />
                    <div className="h-3.5 bg-slate-800 rounded-md w-2/3" />
                  </div>
                  <div className="pt-4 border-t border-slate-800/80 space-y-2">
                    <div className="h-3 bg-slate-800 rounded-md w-1/3" />
                    <div className="h-8 bg-slate-800/60 rounded-xl w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ERROR STATE */}
          {!loading && error && (
            <div className="bg-red-950/30 border border-red-500/30 rounded-3xl p-8 sm:p-12 text-center space-y-4 max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center mx-auto shadow-lg">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Oups, une erreur est survenue</h3>
                <p className="text-xs sm:text-sm text-slate-300">{error}</p>
              </div>
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold rounded-2xl transition-all shadow-lg shadow-red-950/40 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Réessayer</span>
              </button>
            </div>
          )}

          {/* EMPTY STATE */}
          {!loading && !error && trainers.length === 0 && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 sm:p-14 text-center space-y-4 max-w-lg mx-auto shadow-xl">
              <div className="w-16 h-16 rounded-3xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto shadow-lg">
                <Users className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-white">Notre équipe se prépare</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Les profils de nos formateurs seront bientôt disponibles.
                </p>
              </div>
              <Link
                to="/catalogue"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-2xl transition-all shadow-lg shadow-blue-950/40"
              >
                <span>Découvrir nos formations</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* TRAINERS GRID */}
          {!loading && !error && trainers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {trainers.map((trainer) => {
                const courses = trainerCoursesMap[trainer.id] || [];
                const paragraphs = formatParagraphs(trainer.description);

                return (
                  <motion.div
                    key={trainer.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-6 flex flex-col justify-between shadow-xl transition-all group hover:shadow-2xl hover:shadow-blue-950/20"
                  >
                    <div className="space-y-5">
                      
                      {/* Photo + Header Info */}
                      <div className="flex items-start gap-4">
                        {/* Trainer Photo */}
                        <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden border-2 border-slate-700/80 bg-slate-800 shrink-0 shadow-md">
                          <TrainerAvatar
                            photoUrl={trainer.photo_url}
                            name={trainer.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            fallbackClassName="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-indigo-950 text-indigo-300 font-bold text-lg"
                          />
                        </div>

                        {/* Name & Badge */}
                        <div className="min-w-0 flex-1">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider mb-1">
                            <Award className="w-3 h-3 text-blue-400" />
                            <span>Formateur / Expert</span>
                          </div>
                          <h3 className="text-lg font-black text-white tracking-tight truncate group-hover:text-blue-300 transition-colors">
                            {trainer.name}
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Intervenant ECP
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-3 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/60 font-normal">
                        {paragraphs.length > 0 ? (
                          paragraphs[0]
                        ) : (
                          <span className="text-slate-500 italic">Aucune description disponible.</span>
                        )}
                      </div>

                      {/* Formations list */}
                      <div className="space-y-2.5 pt-1">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-200">
                            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                            <span>Formations</span>
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            {courses.length} {courses.length > 1 ? 'disponibles' : 'disponible'}
                          </span>
                        </div>

                        {courses.length > 0 ? (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {courses.map((course) => (
                              <Link
                                key={course.id}
                                to={`/course/${course.id}`}
                                className="group/course flex items-center justify-between p-2 rounded-xl bg-slate-950/80 hover:bg-blue-950/40 border border-slate-800/90 hover:border-blue-500/40 transition-all text-xs"
                              >
                                <span className="font-semibold text-slate-200 group-hover/course:text-blue-300 truncate pr-2">
                                  {course.title}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 shrink-0 group-hover/course:bg-blue-600 group-hover/course:text-white transition-colors">
                                  {course.product_type === 'ebook' ? 'eBook' : 'Formation'}
                                </span>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 text-center">
                            <p className="text-[11px] text-slate-400 italic">
                              De nouvelles formations seront bientôt disponibles.
                            </p>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Action button */}
                    <div className="pt-5 mt-5 border-t border-slate-800/80">
                      <button
                        onClick={() => setSelectedTrainer(trainer)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/90 hover:bg-blue-600 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition-all border border-slate-700/80 hover:border-blue-500 shadow-sm cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Voir le profil</span>
                      </button>
                    </div>

                  </motion.div>
                );
              })}
            </div>
          )}

        </section>

      </main>

      {/* DETAILED TRAINER MODAL */}
      <AnimatePresence>
        {selectedTrainer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8">
            {/* Dark blur backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTrainer(null)}
              className="fixed inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-blue-950/40 overflow-hidden z-10 flex flex-col max-h-[90vh] my-auto"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-900/90 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-800 shrink-0 shadow-lg">
                    <TrainerAvatar
                      photoUrl={selectedTrainer.photo_url}
                      name={selectedTrainer.name}
                      className="w-full h-full object-cover"
                      fallbackClassName="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-indigo-950 text-indigo-300 font-bold text-xl"
                    />
                  </div>

                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                      <Award className="w-3 h-3 text-blue-400" />
                      <span>Formateur / Expert ECP</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {selectedTrainer.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Intervenant officiel chez Exceller chez Pierre
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedTrainer(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors shrink-0 cursor-pointer"
                  title="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body Scrollable */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
                
                {/* Description Full */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400" />
                    <span>Présentation</span>
                  </h4>
                  <div className="text-sm text-slate-200 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                    {formatParagraphs(selectedTrainer.description).map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                    {formatParagraphs(selectedTrainer.description).length === 0 && (
                      <p className="text-slate-500 italic">Aucune description n'a été ajoutée pour ce formateur.</p>
                    )}
                  </div>
                </div>

                {/* Formations associées */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-400" />
                      <span>Formations dispensées par {selectedTrainer.name}</span>
                    </span>
                  </h4>

                  {trainerCoursesMap[selectedTrainer.id]?.length ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {trainerCoursesMap[selectedTrainer.id].map((course) => (
                        <Link
                          key={course.id}
                          to={`/course/${course.id}`}
                          onClick={() => setSelectedTrainer(null)}
                          className="p-3.5 rounded-2xl bg-slate-950 hover:bg-blue-950/50 border border-slate-800 hover:border-blue-500/50 transition-all flex flex-col justify-between group/c shadow-sm"
                        >
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-block mb-1">
                              {course.product_type === 'ebook' ? 'eBook' : 'Formation'}
                            </span>
                            <h5 className="text-xs font-bold text-white group-hover/c:text-blue-300 transition-colors line-clamp-2">
                              {course.title}
                            </h5>
                          </div>
                          
                          <div className="pt-3 mt-2 flex items-center justify-between border-t border-slate-850 text-[11px]">
                            <span className="font-extrabold text-emerald-400">
                              {course.price_fcfa ? `${course.price_fcfa.toLocaleString('fr-FR')} FCFA` : 'Sur demande'}
                            </span>
                            <span className="text-blue-400 font-bold flex items-center gap-1 group-hover/c:translate-x-0.5 transition-transform">
                              S'inscrire <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/80 text-center">
                      <p className="text-xs text-slate-400">
                        De nouvelles formations seront bientôt disponibles pour ce formateur.
                      </p>
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-400 hidden sm:inline-block">
                  Besoin de renseignements ?
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => setSelectedTrainer(null)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Fermer
                  </button>
                  <Link
                    to="/catalogue"
                    onClick={() => setSelectedTrainer(null)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Voir tout le catalogue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <Footer />
    </div>
  );
}
