import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { isUuid, generateSlug } from '../lib/slugUtils';
import Footer from '../components/Footer';
import { TrainerAvatar } from '../components/TrainerAvatar';
import { 
  Loader2, 
  Brain, 
  CheckCircle2, 
  ArrowRight, 
  Share2, 
  Copy, 
  Check, 
  BookOpen, 
  Sparkles, 
  Clock, 
  Code2, 
  HelpCircle, 
  Target, 
  Award, 
  Zap, 
  Users, 
  ShieldCheck, 
  Play, 
  ChevronRight, 
  Terminal, 
  GraduationCap, 
  AlertCircle,
  Layers,
  ArrowLeft,
  X,
  FileText,
  Eye
} from 'lucide-react';
import { motion } from 'motion/react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

interface TrainingExerciseSummary {
  id: string;
  title: string;
  exercise_type: 'qcm' | 'r_code';
  instructions: string;
  order_index: number;
}



export default function PublicTrainingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<any>(null);
  const [training, setTraining] = useState<any>(null);
  const [exercises, setExercises] = useState<TrainingExerciseSummary[]>([]);
  const [courseInfo, setCourseInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedModalExercise, setSelectedModalExercise] = useState<TrainingExerciseSummary | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (slug) {
      fetchTrainingData();
    }
  }, [slug]);

  const fetchTrainingData = async () => {
    try {
      setLoading(true);
      setError(null);

      let trainingData: any = null;

      // 1. Try direct ID query if UUID
      if (isUuid(slug)) {
        const { data, error: idErr } = await supabase
          .from('training_sessions')
          .select('*')
          .eq('id', slug)
          .maybeSingle();

        if (data) {
          trainingData = data;
        }
      }

      // 2. Try direct slug query if not found yet
      if (!trainingData && slug) {
        try {
          const { data: slugData } = await supabase
            .from('training_sessions')
            .select('*')
            .eq('slug', slug);

          if (slugData && slugData.length > 0) {
            trainingData = slugData[0];
          }
        } catch (e) {
          console.warn('Query by slug failed, falling back to full scan:', e);
        }
      }

      // 3. Fallback: Fetch all sessions and match by generated slug or ID
      if (!trainingData) {
        const { data: allSessions, error: allErr } = await supabase
          .from('training_sessions')
          .select('*');

        if (allErr) {
          console.error('Erreur chargement training_sessions:', allErr);
        } else if (allSessions) {
          const matched = allSessions.find(
            s =>
              s.id === slug ||
              (s.slug && s.slug === slug) ||
              generateSlug(s.title || '') === slug
          );
          if (matched) {
            trainingData = matched;
          }
        }
      }

      if (!trainingData) {
        throw new Error("Cet entraînement n'existe pas ou n'est plus disponible.");
      }

      setTraining(trainingData);

      // Fetch course info separately if course_id exists
      if (trainingData.course_id) {
        try {
          const { data: cData } = await supabase
            .from('courses')
            .select('id, title, slug, thumbnail_url, category')
            .eq('id', trainingData.course_id)
            .maybeSingle();

          if (cData) {
            setCourseInfo(cData);
          }
        } catch (cErr) {
          console.warn('Impossible de charger la formation liée:', cErr);
        }
      }

      // Fetch exercise summaries (no solutions or correct answers exposed)
      const { data: exercisesData, error: exErr } = await supabase
        .from('training_exercises')
        .select('id, title, exercise_type, instructions, order_index')
        .eq('training_session_id', trainingData.id)
        .or('is_active.eq.true,is_active.is.null')
        .order('order_index', { ascending: true });

      if (!exErr && exercisesData) {
        setExercises(exercisesData as TrainingExerciseSummary[]);
      }

    } catch (err: any) {
      console.error('Erreur chargement entraînement public:', err);
      setError(err.message || "Impossible de charger la page de présentation de cet entraînement.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartTraining = () => {
    if (!training) return;

    if (session) {
      // User is logged in -> Go directly to interactive session
      navigate(`/client/training/${training.id}`);
    } else {
      // User is not logged in -> Redirect to login with redirect parameter
      const redirectPath = `/client/training/${training.id}`;
      navigate(`/client/login?redirect=${encodeURIComponent(redirectPath)}`);
    }
  };

  const handleCopyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const getActivityTypeBadge = (type: string) => {
    switch (type) {
      case 'r_exercise':
        return {
          label: 'Code R & WebR Console',
          icon: Code2,
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800'
        };
      case 'quiz_qcm':
        return {
          label: 'Quiz QCM Interactif',
          icon: HelpCircle,
          bg: 'bg-blue-50 border-blue-200 text-blue-800'
        };
      case 'mixed':
      default:
        return {
          label: 'Session Mixte (Code & QCM)',
          icon: Layers,
          bg: 'bg-purple-50 border-purple-200 text-purple-800'
        };
    }
  };

  const getDifficultyBadge = (level: string) => {
    switch (level) {
      case 'beginner':
        return { label: 'Débutant', bg: 'bg-emerald-100 text-emerald-800' };
      case 'intermediate':
        return { label: 'Intermédiaire', bg: 'bg-amber-100 text-amber-800' };
      case 'advanced':
        return { label: 'Avancé', bg: 'bg-rose-100 text-rose-800' };
      default:
        return { label: 'Tous niveaux', bg: 'bg-gray-100 text-gray-800' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium text-sm animate-pulse">
          Chargement de l'entraînement...
        </p>
      </div>
    );
  }

  if (error || !training) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Entraînement introuvable</h1>
        <p className="text-gray-600 max-w-md mb-6 text-sm">{error || "Cet entraînement n'existe pas ou n'est plus disponible."}</p>
        <Link
          to="/marketplace"
          className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
        >
          Découvrir les formations & entraînements
        </Link>
      </div>
    );
  }

  const activityBadge = getActivityTypeBadge(training.activity_type);
  const difficultyBadge = getDifficultyBadge(training.difficulty_level);
  const qcmCount = exercises.filter(e => e.exercise_type === 'qcm').length;
  const rCount = exercises.filter(e => e.exercise_type === 'r_code').length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 flex flex-col">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center min-w-0 hover:opacity-90 transition-opacity">
            <span className="font-extrabold text-gray-900 text-sm sm:text-base tracking-tight truncate">
              Exceller chez Pierre
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={handleCopyShareLink}
              className="p-2 sm:px-3 sm:py-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-gray-200 flex items-center gap-1.5 text-xs font-bold shrink-0"
              title="Partager cet entraînement"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{copiedLink ? 'Lien copié !' : 'Partager'}</span>
            </button>

            {session ? (
              <Link
                to="/client/hub"
                className="px-3 py-2 sm:px-4 sm:py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold rounded-xl text-xs transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <span>Espace Client</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to={`/client/login?redirect=${encodeURIComponent(`/client/training/${training.id}`)}`}
                className="px-3 py-2 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-200 shrink-0 whitespace-nowrap"
              >
                Se connecter
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-gray-900 via-indigo-950 to-gray-900 text-white py-16 sm:py-20 overflow-hidden">
        {/* Background glow graphics */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl -ml-40 -mb-40 pointer-events-none"></div>

        {/* Brain Icon Watermark (Filigrane Cerveau) */}
        <div className="absolute -right-10 top-1/2 -translate-y-1/2 pointer-events-none select-none text-indigo-400/[0.09] transform rotate-12 z-0">
          <Brain className="w-[420px] h-[420px] sm:w-[520px] sm:h-[520px] stroke-[1.1]" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
          {/* Breadcrumb / Back */}
          <div className="mb-6">
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retour au catalogue</span>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${activityBadge.bg}`}>
              <activityBadge.icon className="w-3.5 h-3.5" />
              {activityBadge.label}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${difficultyBadge.bg}`}>
              {difficultyBadge.label}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white border border-white/20 flex items-center gap-1">
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
              {exercises.length} {exercises.length > 1 ? 'exercices' : 'exercice'}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-6">
            {training.title}
          </h1>

          {/* Pedagogical Description */}
          {training.description && (
            <div className="text-base sm:text-lg text-gray-200 leading-relaxed max-w-3xl mb-8 font-normal">
              <MarkdownRenderer content={training.description} isDark={true} />
            </div>
          )}

          {/* Associated Course Banner if present */}
          {courseInfo && (
            <div className="mb-8 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 inline-flex flex-wrap items-center gap-3 text-sm font-medium">
              <BookOpen className="w-5 h-5 text-indigo-400 shrink-0" />
              <span>Inclus dans la formation :</span>
              <Link
                to={`/course/${courseInfo.slug || courseInfo.id}`}
                className="font-bold text-indigo-300 hover:text-white hover:underline flex items-center gap-1"
              >
                {courseInfo.title}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Main Action Banner inside Hero */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <button
              onClick={handleStartTraining}
              className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-extrabold text-base rounded-2xl transition-all shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-98 flex items-center justify-center gap-3 cursor-pointer group"
            >
              <Play className="w-5 h-5 fill-current text-white group-hover:scale-110 transition-transform" />
              <span>S'ENTRAÎNER MAINTENANT</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={handleCopyShareLink}
              className="px-6 py-4 bg-white/10 hover:bg-white/15 text-white font-bold text-sm rounded-2xl transition-all border border-white/20 flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              <span>{copiedLink ? 'Lien copié dans le presse-papier !' : 'Copier le lien public'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Body */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12 flex-1">
        
        {/* Quick Highlights Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-gray-900">{exercises.length}</div>
              <div className="text-xs text-gray-500 font-medium">Exercices pratiques</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-gray-900">Instantané</div>
              <div className="text-xs text-gray-500 font-medium">Feedback & Correction</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-gray-900">Sans installation</div>
              <div className="text-xs text-gray-500 font-medium">Directement sur navigateur</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-gray-900">Score & Bilan</div>
              <div className="text-xs text-gray-500 font-medium">Suivi de progression</div>
            </div>
          </div>
        </section>

        {/* Description & Objectifs pédagogiques détaillés */}
        {training.description && (
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-4 relative overflow-hidden">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
                  Présentation & Objectifs pédagogiques
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
                  Détails complets de la session d'entraînement et compétences ciblées
                </p>
              </div>
            </div>
            <div className="pt-2 text-gray-700 leading-relaxed">
              <MarkdownRenderer content={training.description} isDark={false} />
            </div>
          </section>
        )}

        {/* Sommaire / Programme des exercices */}
        <section className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6 relative overflow-hidden">
          {/* Brain Watermark Filigrane */}
          <div className="absolute -right-12 -bottom-12 pointer-events-none select-none text-indigo-600/[0.04] transform -rotate-12 z-0">
            <Brain className="w-80 h-80 stroke-[1.2]" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" />
                <span>Aperçu du programme d'entraînement</span>
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
                Voici les notions et exercices abordés dans cette session pratique.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
              {rCount > 0 && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
                  {rCount} {rCount > 1 ? 'exercices R' : 'exercice R'}
                </span>
              )}
              {qcmCount > 0 && (
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                  {qcmCount} {qcmCount > 1 ? 'questions QCM' : 'question QCM'}
                </span>
              )}
            </div>
          </div>

          {exercises.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-4">Les exercices de cet entraînement sont en cours de finalisation.</p>
          ) : (
            <div className="space-y-3">
              {exercises.map((ex, idx) => (
                <div
                  key={ex.id || idx}
                  className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200/80 hover:border-indigo-200 hover:bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">
                          {ex.title || `Exercice ${idx + 1}`}
                        </h3>
                        {ex.exercise_type === 'r_code' ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1">
                            <Code2 className="w-3 h-3" /> Code R
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md flex items-center gap-1">
                            <HelpCircle className="w-3 h-3" /> Question QCM
                          </span>
                        )}
                      </div>
                      {ex.instructions && (
                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                          {ex.instructions}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedModalExercise(ex)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:border-indigo-300 shadow-2xs transition-all active:scale-95 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Voir énoncé</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CTA under exercises */}
          <div className="pt-4 text-center">
            <button
              onClick={handleStartTraining}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl transition-all shadow-md shadow-indigo-200 active:scale-98 cursor-pointer"
            >
              <span>Lancer la session interactive</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* What students will practice / Benefits */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="text-base font-extrabold text-gray-900">Console Interactive R</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Exécutez vos scripts directement sur votre navigateur avec le moteur WebR WebAssembly, sans dépendre d'un serveur externe.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-extrabold text-gray-900">Correction & Indices</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Recevez des conseils pédagogiques, des indices progressifs et des explications synthétiques pour chaque exercice.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-extrabold text-gray-900">Pratique Pédagogique</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Des cas d'usage réels conçus spécifiquement pour ancrer durablement la pratique sur Excel, R, Power BI et les Statistiques.
            </p>
          </div>
        </section>

        {/* Formateur Section */}
        <section className="bg-gradient-to-r from-gray-900 to-indigo-950 text-white p-8 sm:p-10 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="shrink-0">
              <TrainerAvatar
                name="Pierre - Exceller chez Pierre"
                className="w-24 h-24 sm:w-28 sm:w-28 rounded-2xl border-2 border-indigo-400/50 shadow-xl object-cover"
              />
            </div>
            <div className="space-y-3 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-bold border border-indigo-500/30">
                <GraduationCap className="w-3.5 h-3.5" />
                Conçu par votre Formateur Expert
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">
                Accompagnement Pédagogique
              </h3>
              <p className="text-sm text-gray-300 max-w-2xl leading-relaxed">
                Chaque module d'entraînement est construit pour combler l'écart entre la théorie et la pratique professionnelle. Testez vos connaissances et progressez pas à pas.
              </p>
            </div>
          </div>
        </section>



        {/* Bottom CTA Banner */}
        <section className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-8 sm:p-12 rounded-3xl text-center space-y-6 shadow-xl shadow-indigo-200">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto text-white">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white max-w-2xl mx-auto">
            Prêt à tester vos compétences dès maintenant ?
          </h2>
          <p className="text-sm text-indigo-100 max-w-xl mx-auto font-medium">
            Accédez à la console interactive d'entraînement en un clic.
          </p>

          <div>
            <button
              onClick={handleStartTraining}
              className="px-8 py-4 bg-white text-indigo-700 hover:bg-indigo-50 font-extrabold text-base rounded-2xl transition-all shadow-lg shadow-black/10 active:scale-98 inline-flex items-center gap-3 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current text-indigo-700" />
              <span>S'ENTRAÎNER</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </section>

      </main>

      {/* Modal - Énoncé de l'exercice */}
      {selectedModalExercise && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedModalExercise(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-indigo-100/80 relative space-y-5 max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Brain Icon Watermark Background (Filigrane) */}
            <div className="absolute -right-8 -bottom-10 pointer-events-none select-none text-indigo-600/[0.07] transform -rotate-12 z-0">
              <Brain className="w-80 h-80 stroke-[1.25]" />
            </div>

            {/* Subtle Top Ambient Gradient Glow */}
            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-indigo-50/80 via-indigo-50/20 to-transparent pointer-events-none z-0" />

            {/* Header with Title and X Button */}
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100/80 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-md shadow-indigo-200">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      Exercice #{selectedModalExercise.order_index + 1}
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-gray-900 mt-0.5">Énoncé de l'exercice</h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedModalExercise(null)}
                className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all cursor-pointer active:scale-95"
                title="Fermer la fenêtre"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Exercise Title and Type Badge */}
            <div className="space-y-2 relative z-10">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h4 className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-snug">
                  {selectedModalExercise.title}
                </h4>
                {selectedModalExercise.exercise_type === 'r_code' ? (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 shadow-2xs">
                    <Code2 className="w-3.5 h-3.5 text-emerald-600" /> Code R
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200/80 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 shadow-2xs">
                    <HelpCircle className="w-3.5 h-3.5 text-blue-600" /> Question QCM
                  </span>
                )}
              </div>
            </div>

            {/* Full Instructions Content */}
            <div className="overflow-y-auto space-y-3 flex-1 pr-1.5 my-1 relative z-10 custom-scrollbar">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-900 uppercase tracking-wider">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Consigne officielle :</span>
              </div>
              <div className="p-4 sm:p-5 bg-gradient-to-b from-gray-50/90 to-slate-50/90 backdrop-blur-xs rounded-2xl border border-gray-200/80 text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-line font-medium shadow-2xs">
                {selectedModalExercise.instructions || "Aucun énoncé spécifique fourni pour cet exercice."}
              </div>
            </div>

            {/* Modal Footer with Actions */}
            <div className="pt-3.5 border-t border-gray-100 flex items-center justify-between gap-3 relative z-10">
              <button
                type="button"
                onClick={() => setSelectedModalExercise(null)}
                className="px-4.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedModalExercise(null);
                  handleStartTraining();
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300 flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <span>S'entraîner maintenant</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}
