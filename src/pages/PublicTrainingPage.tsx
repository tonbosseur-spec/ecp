import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { isUuid } from '../lib/slugUtils';
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
  ArrowLeft
} from 'lucide-react';
import { motion } from 'motion/react';

interface TrainingExerciseSummary {
  id: string;
  title: string;
  exercise_type: 'qcm' | 'r_code';
  instructions: string;
  order_index: number;
}

const testimonials = [
  {
    id: 1,
    name: "Jean-Claude Tchakounté",
    role: "Étudiant en Master",
    text: "Les entraînements pratiques m'ont permis d'assimiler directement la syntaxe R et la logique d'analyse. La correction instantanée est d'une efficacité redoutable !",
    initials: "JC",
    rating: 5
  },
  {
    id: 2,
    name: "Marie-Claire Ndom",
    role: "Analyste de Données",
    text: "J'adore le système d'exercices interactifs. On teste son code en direct sans rien installer sur son ordinateur. Un vrai gain de temps.",
    initials: "MC",
    rating: 5
  },
  {
    id: 3,
    name: "Amadou Bouba",
    role: "Doctorant en Économie",
    text: "Grâce aux quiz et exercices progressifs, j'ai pu valider la partie traitement de données de ma recherche en toute autonomie.",
    initials: "AB",
    rating: 5
  }
];

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

      let trainingData = null;

      if (isUuid(slug)) {
        const { data, error: fetchErr } = await supabase
          .from('training_sessions')
          .select('*, courses (id, title, slug, thumbnail_url, category)')
          .eq('id', slug)
          .single();

        if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
        trainingData = data;
      } else {
        // Query by slug
        let query = supabase
          .from('training_sessions')
          .select('*, courses (id, title, slug, thumbnail_url, category)')
          .eq('slug', slug);

        const { data, error: fetchErr } = await query;

        if (fetchErr) {
          // If slug column fails or does not exist, attempt UUID or error
          console.warn('Erreur lors de la recherche par slug:', fetchErr.message);
        } else if (data && data.length > 0) {
          trainingData = data[0];
        }
      }

      if (!trainingData) {
        throw new Error("Cet entraînement n'existe pas ou n'est plus disponible.");
      }

      setTraining(trainingData);
      if (trainingData.courses) {
        setCourseInfo(trainingData.courses);
      }

      // Fetch exercise summaries (no solutions or correct answers exposed)
      const { data: exercisesData, error: exErr } = await supabase
        .from('training_exercises')
        .select('id, title, exercise_type, instructions, order_index')
        .eq('training_session_id', trainingData.id)
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center text-white font-black shadow-md shadow-indigo-200">
              ECP
            </div>
            <div>
              <span className="font-extrabold text-gray-900 text-base tracking-tight block">Exceller chez Pierre</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block -mt-1">Espace Entraînement</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyShareLink}
              className="p-2.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-gray-200 flex items-center gap-1.5 text-xs font-bold"
              title="Partager cet entraînement"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{copiedLink ? 'Lien copié !' : 'Partager'}</span>
            </button>

            {session ? (
              <Link
                to="/client/hub"
                className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5"
              >
                <span>Mon Espace Client</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to={`/client/login?redirect=${encodeURIComponent(`/client/training/${training.id}`)}`}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-200"
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
            <p className="text-base sm:text-lg text-gray-300 leading-relaxed max-w-3xl mb-8 font-normal">
              {training.description}
            </p>
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

        {/* Sommaire / Programme des exercices */}
        <section className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
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
                  className="p-4 rounded-2xl bg-gray-50/80 border border-gray-200/80 hover:border-indigo-200 hover:bg-white transition-all flex items-start gap-4"
                >
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
                  <div className="shrink-0 text-gray-400">
                    <CheckCircle2 className="w-5 h-5 text-gray-300" />
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

        {/* Testimonials */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Ce qu'en pensent nos apprenants
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
              Des centaines d'étudiants et professionnels s'entraînent quotidiennement sur nos outils.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(item => (
              <div key={item.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4 flex flex-col justify-between">
                <p className="text-xs text-gray-600 leading-relaxed italic">
                  "{item.text}"
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <div className="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-full font-bold text-xs flex items-center justify-center">
                    {item.initials}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900">{item.name}</div>
                    <div className="text-[11px] text-gray-500">{item.role}</div>
                  </div>
                </div>
              </div>
            ))}
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

      {/* Footer */}
      <Footer />
    </div>
  );
}
