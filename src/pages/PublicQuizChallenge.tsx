import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { parseCourseQuizSettings } from '../lib/quizUtils';
import { getQuizClassForScore, QUIZ_CLASSES, extractCoursePromoCodes, PromoCode } from '../lib/promoUtils';
import { Play, CheckCircle2, XCircle, ArrowRight, Award, ChevronDown, ChevronUp, Copy, Check, Clock, Dices, Gift, ChevronLeft, Target, Trophy, Sparkles, User, Users, HelpCircle, ExternalLink, Zap, Ticket, Loader2 } from 'lucide-react';
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

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0 sec";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) {
    return `${secs} sec`;
  }
  return `${mins} min ${secs < 10 ? '0' : ''}${secs} sec`;
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
  const [step, setStep] = useState<'landing' | 'participant_form' | 'quiz' | 'auth' | 'results'>('landing');
  const [session, setSession] = useState<any>(null);

  const [participantForm, setParticipantForm] = useState({
    firstName: '',
    lastName: '',
    whatsappCountry: '+237',
    whatsappNumber: '',
    email: ''
  });
  const [participantFormLoading, setParticipantFormLoading] = useState(false);

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
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeTakenSeconds, setTimeTakenSeconds] = useState<number>(0);
  
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

  const handleStart = async () => {
    setParticipantFormLoading(true);
    setStep('participant_form');
    
    // Auto-fill if user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      if (profile) {
        setParticipantForm({
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          whatsappCountry: '+237',
          whatsappNumber: profile.phone_number || '',
          email: session.user.email || ''
        });
      } else {
        setParticipantForm(prev => ({ ...prev, email: session.user.email || '' }));
      }
    }
    
    setParticipantFormLoading(false);
  };

  const handleStartQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('quiz');
    setCurrentIdx(0);
    setAnswers([]);
    setSelectedIndex(null);
    setStartTime(Date.now());
    setTimeTakenSeconds(0);
  };

  const handlePreviousQuestion = () => {
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setCurrentIdx(prevIdx);
      setSelectedIndex(answers[prevIdx] !== undefined ? answers[prevIdx] : null);
    } else {
      setStep('landing');
    }
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
    
    const scorePercentage = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
    const elapsed = startTime ? Math.max(1, Math.round((Date.now() - startTime) / 1000)) : timeTakenSeconds;
    setTimeTakenSeconds(elapsed);

    // Get promo code for user's quiz class
    const quizClass = getQuizClassForScore(scorePercentage);
    const coursePromoCodes = extractCoursePromoCodes(course);
    const unlockedPromo = coursePromoCodes.find(p => p.min_score === quizClass.minScore && p.max_score === quizClass.maxScore) || {
      code: quizClass.defaultCode,
      discount_type: 'percentage' as const,
      discount_value: quizClass.defaultDiscount,
      min_score: quizClass.minScore,
      max_score: quizClass.maxScore,
      class_name: quizClass.name
    };

    if (courseId) {
      try {
        localStorage.setItem(`promo_${courseId}`, unlockedPromo.code);
      } catch (e) {
        // ignore
      }
    }
    
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    await saveResult(currentSession?.user?.id || null, scorePercentage, elapsed);
    
    setStep('results');
    if (scorePercentage >= 60) triggerConfetti();
  };

  const saveResult = async (userId: string | null, score: number, durationSec: number) => {
    try {
      // 1. Log in the new dedicated quiz_results table for beautiful Admin Dashboard
      try {
        await supabase.from('quiz_results').insert({
          course_id: courseId,
          user_id: userId,
          first_name: participantForm.firstName,
          last_name: participantForm.lastName,
          whatsapp_country: participantForm.whatsappCountry,
          whatsapp_number: participantForm.whatsappNumber,
          email: participantForm.email,
          score_percentage: score,
          duration_sec: durationSec
        });
      } catch (err) {
        console.warn('quiz_results insert failed, falling back to course_proposals only', err);
      }

      // 2. Also keep the old course_proposals lead insertion for backwards compatibility/lead tracking
      const quizClass = getQuizClassForScore(score);
      const coursePromoCodes = extractCoursePromoCodes(course);
      const unlockedPromo = coursePromoCodes.find(p => p.min_score === quizClass.minScore && p.max_score === quizClass.maxScore) || {
        code: quizClass.defaultCode,
        discount_value: quizClass.defaultDiscount,
        discount_type: 'percentage'
      };

      await supabase.from('course_proposals').insert({
        client_id: userId,
        course_id: courseId,
        custom_title: `Résultat Quizz (${quizClass.title}) : ${course?.title}`,
        description: `Nom: ${participantForm.firstName} ${participantForm.lastName} | Email: ${participantForm.email} | WhatsApp: ${participantForm.whatsappCountry}${participantForm.whatsappNumber} | Score : ${Math.round(score)}% (${quizClass.name} - ${quizClass.title}) | Temps : ${formatDuration(durationSec)} | Code Promo : ${unlockedPromo.code} (-${unlockedPromo.discount_value}${unlockedPromo.discount_type === 'fixed' ? ' FCFA' : '%'})`,
        status: 'quiz_lead',
        price: 0
      });
    } catch (e) {
      console.error('Error saving result', e);
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
        
        await saveResult(authRes.data.session.user.id, scorePercentage, timeTakenSeconds);
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
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 flex flex-col justify-between">
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 pb-20 flex-grow w-full">
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

              {/* Bouton pour lancer le quizz juste sous le titre */}
              {questions.length > 0 && (
                <div className="mb-8">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStart}
                    className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl text-base sm:text-lg font-bold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-600/20 group cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    Lancer le Challenge
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                </div>
              )}
              
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
                  disabled={participantFormLoading}
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl text-lg font-bold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-xl shadow-indigo-600/20 group cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {participantFormLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Lancer le Challenge Maintenant'}
                  {!participantFormLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {step === 'participant_form' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl mx-auto"
          >
            <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Users className="w-32 h-32 text-indigo-900" />
              </div>
              
              <div className="relative z-10 text-center mb-8">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-indigo-100">
                  <User className="w-8 h-8" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">Vos informations</h2>
                <p className="text-slate-500 text-sm">Veuillez indiquer vos coordonnées pour valider votre participation et recevoir vos résultats.</p>
              </div>

              <form onSubmit={handleStartQuiz} className="space-y-5 relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700">Prénom</label>
                    <input
                      type="text"
                      required
                      value={participantForm.firstName}
                      onChange={e => setParticipantForm(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      placeholder="Votre prénom"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700">Nom</label>
                    <input
                      type="text"
                      required
                      value={participantForm.lastName}
                      onChange={e => setParticipantForm(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      placeholder="Votre nom"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">Email</label>
                  <input
                    type="email"
                    required
                    value={participantForm.email}
                    onChange={e => setParticipantForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    placeholder="votre.email@exemple.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">Numéro WhatsApp</label>
                  <div className="flex gap-2">
                    <select
                      value={participantForm.whatsappCountry}
                      onChange={e => setParticipantForm(prev => ({ ...prev, whatsappCountry: e.target.value }))}
                      className="w-32 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="+237">🇨🇲 +237</option>
                      <option value="+33">🇫🇷 +33</option>
                      <option value="+225">🇨🇮 +225</option>
                      <option value="+221">🇸🇳 +221</option>
                      <option value="+241">🇬🇦 +241</option>
                      <option value="+242">🇨🇬 +242</option>
                      <option value="+243">🇨🇩 +243</option>
                      <option value="+1">🇺🇸 +1</option>
                    </select>
                    <input
                      type="tel"
                      required
                      value={participantForm.whatsappNumber}
                      onChange={e => setParticipantForm(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      placeholder="690000000"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('landing')}
                    className="px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                  >
                    Démarrer le Quizz
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}

        {step === 'quiz' && (
          <div className="w-full max-w-2xl mx-auto">
            {/* Navigation & Bouton Retour */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePreviousQuestion}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200/80 shadow-xs transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-indigo-600 stroke-[2.5]" />
                {currentIdx > 0 ? "Question précédente" : "Retour au sommaire"}
              </button>

              <button
                onClick={() => setStep('landing')}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                Quitter le quizz
              </button>
            </div>

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

        {step === 'results' && (() => {
          const userClass = getQuizClassForScore(scorePercentage);
          const coursePromoCodes = extractCoursePromoCodes(course);
          const unlockedPromo = coursePromoCodes.find(p => p.min_score === userClass.minScore && p.max_score === userClass.maxScore) || {
            code: userClass.defaultCode,
            discount_type: 'percentage' as const,
            discount_value: userClass.defaultDiscount,
            min_score: userClass.minScore,
            max_score: userClass.maxScore,
            class_name: userClass.name
          };

          return (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 w-full max-w-3xl mx-auto"
            >
              {/* Card Écran de Résumé des Performances */}
              <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-[0_10px_40px_rgb(0,0,0,0.04)] border border-slate-100">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-5 mb-6 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">Résumé de vos Performances</h3>
                      <p className="text-xs text-slate-500">Bilan synthétique de votre session de challenge</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Quizz Terminé
                  </span>
                </div>

                {/* Grid 3 Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {/* Stat 1: Score Final */}
                  <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Score Final</span>
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                        <Trophy className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900 leading-none mb-1">
                        {correctCount} <span className="text-slate-400 text-lg font-medium">/ {questions.length}</span>
                      </div>
                      <p className="text-xs font-bold text-indigo-600">
                        {Math.round(scorePercentage)}% de bonnes réponses
                      </p>
                    </div>
                  </div>

                  {/* Stat 2: Temps Mis */}
                  <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Temps Réalisé</span>
                      <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-black text-slate-900 leading-none mb-1">
                        {formatDuration(timeTakenSeconds)}
                      </div>
                      <p className="text-xs font-bold text-purple-600">
                        ~{questions.length > 0 ? Math.round(timeTakenSeconds / questions.length) : 0}s par question
                      </p>
                    </div>
                  </div>

                  {/* Stat 3: Statut / Code Promo */}
                  <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Niveau Atteint</span>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${userClass.badgeBg} ${userClass.badgeColor}`}>
                        <Award className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className={`text-xl sm:text-2xl font-black leading-tight mb-1 ${userClass.badgeColor}`}>
                        {userClass.title}
                      </div>
                      <p className="text-xs font-bold text-slate-600">
                        Réduction -{unlockedPromo.discount_value}{unlockedPromo.discount_type === 'fixed' ? ' FCFA' : '%'} Débloquée
                      </p>
                    </div>
                  </div>
                </div>

                {/* Échelle visuelle des 5 Classes */}
                <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Échelle des 5 Niveaux de Compétence
                    </h4>
                    <span className="text-[11px] font-bold text-slate-500">
                      Votre Niveau : <strong className={userClass.badgeColor}>{userClass.name}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {QUIZ_CLASSES.map((qc) => {
                      const isActive = qc.level === userClass.level;
                      const promoForTier = coursePromoCodes.find(p => p.min_score === qc.minScore && p.max_score === qc.maxScore) || {
                        code: qc.defaultCode,
                        discount_type: 'percentage' as const,
                        discount_value: qc.defaultDiscount
                      };

                      return (
                        <div 
                          key={qc.level}
                          className={`p-2.5 rounded-xl border text-center transition-all ${
                            isActive 
                              ? `${qc.badgeBg} ${qc.badgeBorder} shadow-xs ring-2 ring-indigo-500/30 scale-[1.02]`
                              : 'bg-white border-slate-200 opacity-60'
                          }`}
                        >
                          <div className={`text-[10px] font-extrabold uppercase ${isActive ? qc.badgeColor : 'text-slate-400'}`}>
                            {qc.name}
                          </div>
                          <div className="text-xs font-bold text-slate-900 mt-0.5 truncate" title={qc.title}>
                            {qc.title.replace('Niveau ', '')}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {qc.minScore}-{qc.maxScore}%
                          </div>
                          <div className={`text-[11px] font-black mt-1 px-1.5 py-0.5 rounded ${isActive ? 'bg-white text-indigo-700 shadow-2xs font-mono' : 'text-slate-400'}`}>
                            -{promoForTier.discount_value}{promoForTier.discount_type === 'fixed' ? ' FCFA' : '%'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Banner Result & Promo Code */}
              <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-[0_10px_40px_rgb(0,0,0,0.04)] border border-slate-100 text-center relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1.5 ${userClass.level >= 4 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-indigo-400 to-purple-500'}`}></div>
                
                <div className="mb-6 flex justify-center">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-inner ${userClass.badgeBg}`}>
                    <Trophy className={`w-10 h-10 ${userClass.badgeColor}`} />
                  </div>
                </div>

                <div className="inline-flex items-center justify-center gap-3 px-5 py-2 rounded-full mb-6 font-bold text-sm bg-slate-50 border border-slate-200/80 shadow-2xs">
                  <span className="flex items-center gap-1.5 text-indigo-700">
                    <Trophy className="w-4 h-4 text-indigo-500" />
                    Score : {correctCount} / {questions.length} ({Math.round(scorePercentage)}%)
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5 text-purple-700">
                    <Clock className="w-4 h-4 text-purple-500" />
                    Temps : {formatDuration(timeTakenSeconds)}
                  </span>
                </div>

                <h2 className="text-3xl font-black text-slate-900 mb-4">
                  {userClass.title} <span className={userClass.badgeColor}>({userClass.name})</span>
                </h2>

                <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto mb-8">
                  {userClass.description} Grâce à votre performance, vous débloquez automatiquement une réduction de <strong>{unlockedPromo.discount_value}{unlockedPromo.discount_type === 'fixed' ? ' FCFA' : '%'}</strong> sur la formation !
                </p>

                {/* Code Promo Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md mx-auto mb-8 shadow-inner space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1.5">
                    <Ticket className="w-4 h-4 text-indigo-500" />
                    Votre Code Promo Privilège
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="bg-white border-2 border-indigo-200 border-dashed rounded-xl px-6 py-3 font-mono font-black text-2xl text-indigo-700 tracking-wider shadow-2xs">
                      {unlockedPromo.code}
                    </div>
                    <button 
                      onClick={() => handleCopyPromo(unlockedPromo.code)}
                      className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                      title="Copier le code"
                    >
                      {copiedCode ? <Check className="w-6 h-6 text-emerald-600" /> : <Copy className="w-6 h-6" />}
                    </button>
                  </div>
                  {copiedCode ? (
                    <p className="text-xs font-medium text-emerald-600">Code copié dans le presse-papier !</p>
                  ) : (
                    <p className="text-[11px] text-slate-400">Ce code s'appliquera automatiquement sur la formation</p>
                  )}
                </div>

                <Link
                  to={`/course/${courseId}?promo=${unlockedPromo.code}`}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-lg font-bold transition-all shadow-xl shadow-indigo-600/20 group cursor-pointer"
                >
                  Profiter de ma réduction (-{unlockedPromo.discount_value}{unlockedPromo.discount_type === 'fixed' ? ' FCFA' : '%'}) & Inscrire
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

            </motion.div>
          );
        })()}
      </main>

      {/* Footer Public Quiz */}
      <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 pb-12 border-b border-slate-800">
            
            {/* Branding & Description */}
            <div className="md:col-span-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                  <Trophy className="w-5 h-5" />
                </div>
                <span className="text-xl font-black text-white tracking-tight">
                  Challenge Quizz
                </span>
              </div>
              
              <p className="text-sm text-slate-400 leading-relaxed max-w-md">
                {course?.title ? (
                  <>
                    Évaluez vos compétences gratuitement en lien avec la formation <strong className="text-white font-semibold">{course.title}</strong> et débloquez votre bourse d'apprentissage exclusive.
                  </>
                ) : (
                  "Testez vos connaissances en situation réelle, découvrez votre niveau exact et obtenez un avantage exclusif pour votre parcours d'apprentissage."
                )}
              </p>

              {course?.trainers && (
                <div className="pt-2 flex items-center gap-3">
                  {course.trainers.photo_url ? (
                    <img 
                      src={course.trainers.photo_url} 
                      alt={course.trainers.name} 
                      className="w-10 h-10 rounded-full object-cover border border-slate-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-800 text-indigo-400 border border-slate-700 flex items-center justify-center font-bold text-xs">
                      {course.trainers.name ? course.trainers.name.substring(0, 2).toUpperCase() : 'TR'}
                    </div>
                  )}
                  <div className="text-xs">
                    <span className="text-slate-500 block font-medium">Formateur référent</span>
                    <span className="text-white font-bold">{course.trainers.name}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Accès Rapide</h4>
              <ul className="space-y-2.5 text-sm font-medium">
                {courseId && (
                  <li>
                    <Link 
                      to={`/course/${courseId}`} 
                      className="text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Voir la formation</span>
                    </Link>
                  </li>
                )}
                <li>
                  <Link 
                    to="/client/login" 
                    className="text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    <span>Espace Membre</span>
                  </Link>
                </li>
                <li>
                  <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="text-slate-300 hover:text-white transition-colors flex items-center gap-2 cursor-pointer text-left"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    <span>Haut de page</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Trust Badge */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Engagement & Qualité</h4>
              <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Test 100% Gratuit</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Score instantané et corrigés pédagogiques détaillés pour consolider vos acquis.
                </p>
              </div>
            </div>

          </div>

          {/* Bottom Legal / Copyright */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium">
            <p>© {new Date().getFullYear()} Exceller chez Pierre. Tous droits réservés.</p>
            <div className="flex items-center gap-6">
              {courseId && (
                <Link to={`/course/${courseId}`} className="hover:text-slate-300 transition-colors">Formation</Link>
              )}
              <span className="text-slate-700">•</span>
              <Link to="/" className="hover:text-slate-300 transition-colors">Catalogue de formations</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
