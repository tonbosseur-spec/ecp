import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { parseCourseQuizSettings } from '../lib/quizUtils';
import { Play, CheckCircle2, XCircle, ArrowRight, Award, ChevronDown, ChevronUp, Copy, Check, Clock, Dices, Gift, ChevronLeft, Target, Trophy, Sparkles, User, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

interface Question {
  id?: string;
  text: string;
  options: string[];
  correct_index: number;
  explanation?: string;
  module_title?: string;
}

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

export default function PublicQuizChallenge() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  
  const [course, setCourse] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'landing' | 'quiz' | 'auth' | 'results'>('landing');
  const [session, setSession] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'register'|'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Quiz state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  // Results state
  const [copiedCode, setCopiedCode] = useState(false);
  const [expandedExplanations, setExpandedExplanations] = useState<number[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchCourseAndQuestions();
  }, [courseId]);

  const fetchCourseAndQuestions = async () => {
    try {
      setLoading(true);
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('title, description, guide_text, trainer_id, trainers (*)')
        .eq('id', courseId)
        .single();
        
      if (courseError) throw courseError;
      setCourse(courseData);

      const { data: modules, error: modulesError } = await supabase
        .from('course_modules')
        .select('id, title')
        .eq('course_id', courseId);

      if (modulesError) throw modulesError;
      
      const moduleIds = modules.map(m => m.id);
      
      if (moduleIds.length > 0) {
        const { data: quizzes, error: quizzesError } = await supabase
          .from('quizzes')
          .select('*')
          .in('module_id', moduleIds);
          
        if (quizzesError) throw quizzesError;

        let allQuestions: Question[] = [];
        quizzes.forEach(quiz => {
          const module = modules.find(m => m.id === quiz.module_id);
          if (quiz.questions && Array.isArray(quiz.questions)) {
            quiz.questions.forEach((q: any) => {
              allQuestions.push({
                ...q,
                module_title: module?.title
              });
            });
          }
        });

        // Mélanger et prendre 20 questions max
        const shuffled = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 20);
        setQuestions(shuffled);
      }
    } catch (err) {
      console.error('Error fetching quiz data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    setStep('quiz');
    setCurrentIdx(0);
    setAnswers([]);
    setSelectedIndex(null);
  };

  const handleSelectOption = (optionIndex: number) => {
    if (selectedIndex !== null) return;
    setSelectedIndex(optionIndex);

    const newAnswers = [...answers];
    newAnswers[currentIdx] = optionIndex;
    setAnswers(newAnswers);

    // Auto-advance after small visual feedback delay
    setTimeout(() => {
      setSelectedIndex(null);
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(prev => prev + 1);
      } else {
        finishQuiz(newAnswers);
      }
    }, 350);
  };

  const finishQuiz = async (finalAnswers: number[]) => {
    let correctCount = 0;
    finalAnswers.forEach((ans, idx) => {
      if (ans === questions[idx].correct_index) correctCount++;
    });
    
    const scorePercentage = (correctCount / questions.length) * 100;
    
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    if (currentSession) {
      await saveResult(currentSession.user.id, scorePercentage, currentSession.user.email);
      setStep('results');
      if (scorePercentage >= 80) triggerConfetti();
    } else {
      setStep('auth');
    }
  };

  const saveResult = async (userId: string, score: number, userEmail?: string) => {
    try {
      await supabase.from('course_proposals').insert({
        client_id: userId,
        course_id: courseId,
        custom_title: `Résultat Quizz : ${course?.title}`,
        description: `Email: ${userEmail || email || 'Non renseigné'} | Score : ${Math.round(score)}% - Code Promo : ${score >= 80 ? "EXPERT50" : "BOOST20"}`,
        status: 'quiz_lead',
        price: 0
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    
    try {
      let authRes;
      if (authMode === 'register') {
        authRes = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: firstName, last_name: lastName, phone }
          }
        });
      } else {
        authRes = await supabase.auth.signInWithPassword({
          email,
          password
        });
      }

      if (authRes.error) throw authRes.error;
      
      if (authRes.data.session) {
        let correctCount = 0;
        answers.forEach((ans, idx) => {
          if (ans === questions[idx].correct_index) correctCount++;
        });
        const scorePercentage = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
        
        await saveResult(authRes.data.session.user.id, scorePercentage, authRes.data.session.user.email);
        setStep('results');
        if (scorePercentage >= 80) triggerConfetti();
      }
    } catch (err: any) {
      setAuthError(err.message === 'User already registered' ? 'Cet email est déjà utilisé. Connectez-vous.' : err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#4f46e5', '#9333ea', '#60a5fa']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#4f46e5', '#9333ea', '#60a5fa']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const handleCopyPromo = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const toggleExplanation = (index: number) => {
    if (expandedExplanations.includes(index)) {
      setExpandedExplanations(prev => prev.filter(i => i !== index));
    } else {
      setExpandedExplanations(prev => [...prev, index]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Calculate stats for results
  let correctCount = 0;
  answers.forEach((ans, idx) => {
    if (ans === questions[idx]?.correct_index) correctCount++;
  });
  const scorePercentage = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
  const isExpert = scorePercentage >= 80;

  const quizSettings = parseCourseQuizSettings(course?.guide_text);
  const displayTitle = quizSettings.quizTitle || (course?.title ? `Challenge Quizz : ${course.title}` : 'Challenge Quizz');
  const displayDescription = quizSettings.quizDescription || course?.description || "Testez vos connaissances en situation réelle, découvrez votre niveau exact et débloquez un code promo exclusif pour la formation complète.";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100">
      {/* Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              Exceller chez Pierre
            </span>
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full text-xs font-bold uppercase tracking-wider">
            <span>Challenge Interactif</span>
            <span>📊</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 pb-24">
        {step === 'landing' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <Link to={`/course/${courseId}`} className="self-start flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 mb-8 transition-colors">
              <ChevronLeft className="w-4 h-4" />
              Retour à la formation
            </Link>

            <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-[0_10px_40px_rgb(0,0,0,0.04)] border border-slate-100/80 text-center w-full relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
              
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Challenge Interactif</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 leading-[1.15] mb-6">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
                  {displayTitle}
                </span>
              </h1>
              
              {/* Rich Text Description */}
              <div 
                className="prose prose-indigo max-w-2xl mx-auto mb-10 text-base sm:text-lg text-slate-600 leading-relaxed text-left sm:text-center font-normal [&_p]:mb-3 [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_a]:text-indigo-600 [&_a]:underline [&_strong]:font-bold [&_strong]:text-slate-900 [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold"
                dangerouslySetInnerHTML={{ __html: formatDescriptionHtml(displayDescription) }}
              />

              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 mb-10">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 text-sm font-semibold text-slate-700">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  ~10 minutes
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 text-sm font-semibold text-slate-700">
                  <Dices className="w-4 h-4 text-purple-500" />
                  {questions.length} question(s) interactive(s)
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 text-sm font-semibold text-slate-700">
                  <Gift className="w-4 h-4 text-pink-500" />
                  Code de réduction à débloquer
                </div>
              </div>

              {/* Formateur Référent Card */}
              {course?.trainers && (
                <div className="mb-10 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-left max-w-xl mx-auto bg-slate-50/60 p-5 sm:p-6 rounded-2xl border border-slate-200/60 shadow-xs">
                  {course.trainers.photo_url ? (
                    <img
                      src={course.trainers.photo_url}
                      alt={course.trainers.name}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-2xl flex items-center justify-center shrink-0 shadow-md">
                      {course.trainers.name ? course.trainers.name.substring(0, 2).toUpperCase() : 'TR'}
                    </div>
                  )}
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <User className="w-3 h-3 text-indigo-500" />
                        Formateur Référent
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{course.trainers.name}</h3>
                    {course.trainers.description && (
                      <div 
                        className="text-xs text-slate-600 mt-1.5 line-clamp-3 leading-relaxed [&_p]:mb-1"
                        dangerouslySetInnerHTML={{ __html: formatDescriptionHtml(course.trainers.description) }}
                      />
                    )}
                  </div>
                </div>
              )}

              {questions.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                  <p className="text-slate-500 font-medium">Aucun challenge n'est encore disponible pour cette formation.</p>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStart}
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl text-lg font-bold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-xl shadow-indigo-600/20 group cursor-pointer"
                >
                  Lancer le Challenge Maintenant
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {step === 'quiz' && (
          <div className="w-full max-w-2xl mx-auto">
            {/* Animated Progress Bar & Header */}
            <div className="mb-8 bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-3 text-sm font-bold text-slate-600">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                  Question {currentIdx + 1} sur {questions.length}
                </span>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100 font-extrabold">
                  {Math.round(((currentIdx + 1) / questions.length) * 100)}% complété
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                <motion.div 
                  className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-full"
                  initial={{ width: `${((currentIdx) / questions.length) * 100}%` }}
                  animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                ></motion.div>
              </div>
            </div>

            {/* Question Card with AnimatePresence */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIdx}
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.98 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-[0_12px_40px_rgb(0,0,0,0.06)] border border-slate-100 relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-6">
                  {questions[currentIdx]?.module_title ? (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-xl border border-indigo-100/80">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      {questions[currentIdx].module_title}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-wider rounded-xl border border-purple-100/80">
                      <HelpCircle className="w-3.5 h-3.5 text-purple-500" />
                      Question {currentIdx + 1}
                    </span>
                  )}
                </div>
                
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-8 leading-relaxed">
                  {questions[currentIdx]?.text}
                </h2>

                <div className="space-y-3.5">
                  {questions[currentIdx]?.options.map((option, idx) => {
                    const letters = ['A', 'B', 'C', 'D'];
                    const isSelected = selectedIndex === idx;

                    return (
                      <motion.button
                        key={idx}
                        whileHover={{ scale: 1.01, x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectOption(idx)}
                        className={`w-full flex items-center justify-between p-4 sm:p-5 text-left rounded-2xl border-2 transition-all group cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/90 ring-4 ring-indigo-500/15 shadow-md shadow-indigo-600/10'
                            : 'border-slate-100 bg-slate-50/40 hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-9 h-9 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 transition-all ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                : 'bg-white border border-slate-200 text-slate-600 group-hover:border-indigo-300 group-hover:text-indigo-600'
                            }`}
                          >
                            {letters[idx]}
                          </div>
                          <span className={`font-semibold text-sm sm:text-base leading-snug transition-colors ${
                            isSelected ? 'text-indigo-950 font-bold' : 'text-slate-700 group-hover:text-slate-900'
                          }`}>
                            {option}
                          </span>
                        </div>

                        <div className="shrink-0 ml-3">
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm animate-in zoom-in-75">
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-slate-200 group-hover:border-indigo-300 transition-colors"></div>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        
        {step === 'auth' && (
          <div className="animate-fade-in w-full max-w-md mx-auto">
            <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Débloquez vos résultats</h2>
                <p className="text-slate-600">Créez votre compte gratuitement pour voir votre score détaillé et obtenir votre code promo exclusif.</p>
              </div>

              {authError && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 flex items-start gap-2">
                  <XCircle className="w-5 h-5 shrink-0" />
                  <p>{authError}</p>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'register' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Prénom</label>
                        <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nom</label>
                        <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone</label>
                      <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mot de passe</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <button type="submit" disabled={authLoading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50">
                  {authLoading ? 'Chargement...' : (authMode === 'register' ? 'Créer mon compte & Voir mes résultats' : 'Me connecter & Voir mes résultats')}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button type="button" onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')} className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
                  {authMode === 'register' ? 'Déjà un compte ? Connectez-vous' : 'Pas de compte ? Inscrivez-vous'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'results' && (
          <div className="animate-fade-in space-y-12 w-full max-w-3xl mx-auto">
            {/* Banner Result */}
            <div className="bg-white rounded-[2rem] p-8 sm:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1.5 ${isExpert ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}></div>
              
              <div className="mb-6 flex justify-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-inner ${isExpert ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  {isExpert ? (
                    <Trophy className="w-10 h-10 text-emerald-500" />
                  ) : (
                    <Target className="w-10 h-10 text-amber-500" />
                  )}
                </div>
              </div>

              <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full mb-6 font-bold text-sm bg-slate-50 border border-slate-200">
                Score : {correctCount} / {questions.length} ({Math.round(scorePercentage)}%)
              </div>

              <h2 className="text-3xl font-black text-slate-900 mb-6">
                {isExpert ? (
                  <>🏆 Félicitations ! <span className="text-emerald-600">Niveau Expert Décelé</span></>
                ) : (
                  <>🎯 Beau parcours ! <span className="text-amber-600">Fort Potentiel à Développer</span></>
                )}
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto mb-10">
                {isExpert ? (
                  "Impressionnant ! Vous possédez une excellente maîtrise des fondamentaux. Cependant, pour passer de bon à INCONTOURNABLE sur vos projets de recherche et maîtriser l'analyse avancée sans aucune faute, perfectionnez votre expertise. Pour vous récompenser, nous vous offrons 50% de réduction immédiate !"
                ) : (
                  "Vous avez de bonnes intuitions, mais plusieurs lacunes théoriques ou pratiques vous ralentissent encore. Ne laissez pas les statistiques et l'analyse de données bloquer votre carrière ou votre mémoire. Bénéficiez de 20% de réduction spéciale pour suivre notre programme guidé étape par étape !"
                )}
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md mx-auto mb-8 shadow-inner">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Votre code privilège</p>
                <div className="flex items-center justify-center gap-3">
                  <div className="bg-white border-2 border-slate-300 border-dashed rounded-xl px-6 py-3 font-mono font-bold text-2xl text-slate-900 tracking-wider">
                    {isExpert ? 'EXPERT50' : 'BOOST20'}
                  </div>
                  <button 
                    onClick={() => handleCopyPromo(isExpert ? 'EXPERT50' : 'BOOST20')}
                    className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors"
                    title="Copier le code"
                  >
                    {copiedCode ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                  </button>
                </div>
                {copiedCode && <p className="text-xs font-medium text-emerald-600 mt-3">Code copié dans le presse-papier !</p>}
              </div>

              <Link
                to={`/course/${courseId}`}
                className={`inline-flex items-center justify-center gap-2 px-8 py-4 text-white rounded-2xl text-lg font-bold transition-all shadow-xl group ${
                  isExpert 
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                }`}
              >
                {isExpert ? 'Profiter de mes 50% de réduction & Rejoindre l\'Académie' : 'Profiter de mes 20% de réduction & Débuter la formation'}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Answers Review */}
            <div className="bg-white rounded-[2rem] p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                Voir la correction détaillée de vos réponses
              </h3>
              
              <div className="space-y-4">
                {questions.map((q, idx) => {
                  const userAnswer = answers[idx];
                  const isCorrect = userAnswer === q.correct_index;
                  const isExpanded = expandedExplanations.includes(idx);
                  const letters = ['A', 'B', 'C', 'D'];

                  return (
                    <div key={idx} className={`border rounded-2xl overflow-hidden transition-colors ${isCorrect ? 'border-slate-200' : 'border-amber-200'}`}>
                      <button 
                        onClick={() => toggleExplanation(idx)}
                        className={`w-full flex items-center justify-between p-5 text-left transition-colors ${isCorrect ? 'hover:bg-slate-50' : 'bg-amber-50/30 hover:bg-amber-50/60'}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 leading-snug">{q.text}</p>
                            {!isCorrect && !isExpanded && (
                              <p className="text-sm font-medium text-red-500 mt-1">Vous avez répondu incorrectement.</p>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 ml-4 text-slate-400">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-4 rounded-xl border border-red-100 bg-red-50/50">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 block mb-1">Votre réponse</span>
                              <span className="text-sm font-medium text-slate-700">
                                {letters[userAnswer]} - {q.options[userAnswer] || "Aucune (Temps écoulé)"}
                              </span>
                            </div>
                            <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">Bonne réponse</span>
                              <span className="text-sm font-medium text-slate-700">
                                {letters[q.correct_index]} - {q.options[q.correct_index]}
                              </span>
                            </div>
                          </div>
                          
                          {q.explanation && (
                            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block mb-1 flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5" /> Explication Pédagogique
                              </span>
                              <p className="text-sm text-slate-700 leading-relaxed">{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
