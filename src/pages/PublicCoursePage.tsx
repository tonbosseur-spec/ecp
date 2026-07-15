import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Calendar, User, ChevronDown, ChevronUp, Play, CheckCircle2, MessageCircle, Video, FileText, AlertCircle, Download, Globe, Youtube, Star, Facebook, Linkedin, Send, CalendarOff, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

const testimonials = [
  {
    id: 1,
    name: "Jean-Claude Tchakounté",
    role: "Étudiant en Master",
    text: "La formation en analyses statistiques est excellente. Les explications sont claires et le suivi est vraiment primordial. J'ai pu soutenir mon mémoire sans aucun problème !",
    initials: "JC",
    rating: 5
  },
  {
    id: 2,
    name: "Marie-Claire Ndom",
    role: "Professionnelle RH",
    text: "Ma maîtrise d'Excel s'est nettement améliorée. J'arrive maintenant à automatiser mes tâches. Le formateur prend le temps de bien expliquer chaque étape.",
    initials: "MC",
    rating: 4
  },
  {
    id: 3,
    name: "Amadou Bouba",
    role: "Doctorant",
    text: "Une approche pédagogique incroyable. Les concepts statistiques complexes deviennent simples. C'est grâce à cet accompagnement que j'ai validé ma thèse.",
    initials: "AB",
    rating: 5
  },
  {
    id: 4,
    name: "Estelle Mvogo",
    role: "Analyste de Données",
    text: "J'ai suivi plusieurs formations, mais celle-ci est de loin la meilleure. Le formateur est à l'écoute et le suivi post-formation est un vrai plus pour s'améliorer.",
    initials: "EM",
    rating: 5
  }
];

export default function PublicCoursePage() {
  const { id } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInactive, setIsInactive] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+237');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  // Review State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewName, setReviewName] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [dbTestimonials, setDbTestimonials] = useState<any[]>([]);

  // Accordion State
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  const [showCalendarMenu, setShowCalendarMenu] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  const generateIcs = () => {
    if (!course) return;
    const date = new Date(course.date_time);
    const endDate = new Date(date.getTime() + 2 * 60 * 60 * 1000); // assume 2 hours
    
    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, '');
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${course.title}
DTSTART:${formatDate(date)}
DTEND:${formatDate(endDate)}
DESCRIPTION:${course.description || ''}
LOCATION:${course.google_meet_link || 'En ligne'}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${course.title.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowCalendarMenu(false);
  };

  const generateGoogleCalendarLink = () => {
    if (!course) return '#';
    const date = new Date(course.date_time);
    const endDate = new Date(date.getTime() + 2 * 60 * 60 * 1000); // assume 2 hours
    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, '');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: course.title,
      dates: `${formatDate(date)}/${formatDate(endDate)}`,
      details: course.description || '',
      location: course.google_meet_link || '',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const fetchTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDbTestimonials(data || []);
    } catch (err: any) {
      console.error('Error fetching testimonials:', err.message);
    }
  };

  useEffect(() => {
    if (id) fetchCourse();
    fetchTestimonials();
    
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setClientId(session.user.id);
          setEmail(session.user.email || '');
          
          const { data: profile } = await supabase
            .from('client_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          if (profile) {
            setName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim());
            if (profile.phone) {
              setPhone(profile.phone);
              setCountryCode(''); // reset since full number might be in phone
            }
          } else if (session.user.user_metadata) {
            setName(`${session.user.user_metadata.first_name || ''} ${session.user.user_metadata.last_name || ''}`.trim());
            if (session.user.user_metadata.phone) {
               setPhone(session.user.user_metadata.phone);
               setCountryCode('');
            }
          }
        }
      } catch (err) {
        console.error("Error checking user:", err);
      }
    };
    checkUser();
  }, [id]);

  useEffect(() => {
    if (course) {
      document.title = `Exceller chez Pierre : ${course.title}`;
    } else {
      document.title = 'Exceller chez Pierre';
    }
  }, [course]);

  const fetchCourse = async () => {
    try {
      setLoading(true);
      
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select(`
          *,
          trainers (*),
          templates (*),
          course_modules (*),
          registrations (count)
        `)
        .eq('id', id)
        .single();

      if (courseError) throw courseError;
      
      if (courseData.is_active === false) {
        setIsInactive(true);
        setLoading(false);
        return;
      }

      // Sort modules by order_index
      if (courseData && courseData.course_modules) {
         courseData.course_modules.sort((a: any, b: any) => a.order_index - b.order_index);
      }
      
      const registeredCount = courseData.registrations?.[0]?.count || 0;
      const remainingSeats = courseData.max_seats ? courseData.max_seats - registeredCount : null;

      setCourse({ ...courseData, registeredCount, remainingSeats });
    } catch (err: any) {
      setError("Impossible de charger la formation. Le lien est peut-être invalide.");
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (moduleId: string) => {
    setOpenModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      if (course.max_seats) {
        const { count, error: countError } = await supabase
          .from('registrations')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', id);
          
        if (countError) throw countError;
        
        if (count !== null && count >= course.max_seats) {
          setFormError("Désolé, cette formation est complète. Les inscriptions sont fermées.");
          setSubmitting(false);
          // Update local state to hide form immediately
          setCourse({ ...course, remainingSeats: 0 });
          return;
        }
      }

      const { error } = await supabase
        .from('registrations')
        .insert([{
          course_id: id,
          client_id: clientId,
          participant_name: name,
          participant_email: email,
          participant_phone: countryCode + phone.replace(/\s+/g, '')
        }]);

      if (error) throw error;
      
      setSuccess(true);
    } catch (err: any) {
      setFormError("Une erreur est survenue lors de l'inscription.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewSubmitting(true);
    try {
      const { error } = await supabase
        .from('testimonials')
        .insert([{
          name: reviewName,
          status: reviewStatus,
          comment: reviewComment,
          rating: reviewRating
        }]);
      if (error) throw error;
      setReviewSuccess(true);
      fetchTestimonials();
      setTimeout(() => {
        setShowReviewModal(false);
        setReviewSuccess(false);
        setReviewName('');
        setReviewStatus('');
        setReviewComment('');
        setReviewRating(5);
      }, 2000);
    } catch (err: any) {
      console.error('Error adding review:', err.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Chargement des détails de la formation...</p>
      </div>
    );
  }

  if (isInactive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-10 rounded-3xl shadow-lg border border-red-100 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CalendarOff className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">Formation Indisponible</h2>
          <p className="text-gray-500 text-lg leading-relaxed">
            Cette formation n'est actuellement plus disponible ou a déjà eu lieu. Merci de votre intérêt !
          </p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Oups !</h2>
          <p className="text-gray-500">{error || "Formation introuvable."}</p>
        </div>
      </div>
    );
  }

  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(course.date_time));

  const template = course?.templates;
  const primaryColor = template?.primary_color || '#16a34a';
  const primaryColorLight = primaryColor + '40';
  const bgClass = template?.bg_pattern || 'bg-green-50/30';

  const allTestimonials = [
    ...dbTestimonials.map(t => ({
      id: t.id,
      name: t.name,
      role: t.status,
      text: t.comment,
      rating: t.rating,
      initials: t.name.substring(0, 2).toUpperCase()
    })),
    ...testimonials
  ];

  return (
    <div className={`min-h-screen ${bgClass} font-sans pb-20 theme-page`}>
      <style dangerouslySetInnerHTML={{__html: `
        .theme-page {
          --theme-primary: ${primaryColor};
          --theme-primary-light: ${primaryColorLight};
        }
        .theme-text { color: var(--theme-primary) !important; }
        .theme-bg { background-color: var(--theme-primary) !important; color: #111827 !important; }
        .theme-border { border-color: var(--theme-primary) !important; }
        .theme-border-light { border-color: var(--theme-primary-light) !important; }
        .theme-gradient { background: linear-gradient(to right, var(--theme-primary), var(--theme-primary-light)) !important; }
        .theme-bg-light { background-color: var(--theme-primary-light) !important; color: #111827 !important; }
      `}} />

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b theme-border-light">
        <div className="max-w-3xl mx-auto px-4 py-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">Exceller chez Pierre</h1>
          {course && <p className="text-lg sm:text-xl font-bold theme-text mt-1">{course.title}</p>}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 mt-8 space-y-8 sm:space-y-12">
        {/* Hero Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border theme-border text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 theme-gradient"></div>
          
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 theme-bg-light rounded-full text-sm font-medium theme-text border theme-border-light">
              <Calendar className="w-4 h-4" />
              <span className="capitalize">{formattedDate}</span>
            </div>
            
            {course.max_seats ? (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${course.remainingSeats && course.remainingSeats > 0 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                <User className="w-4 h-4" />
                {course.remainingSeats && course.remainingSeats > 0 ? (
                  <span>{course.remainingSeats} {course.remainingSeats > 1 ? 'places restantes' : 'place restante'} sur {course.max_seats}</span>
                ) : (
                  <span>Complet ({course.max_seats} inscrits)</span>
                )}
              </div>
            ) : (
              course.registeredCount > 0 && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-full text-sm font-medium border border-gray-200">
                  <User className="w-4 h-4" />
                  <span>{course.registeredCount} {course.registeredCount > 1 ? 'inscrits' : 'inscrit'}</span>
                </div>
              )
            )}
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-6">
            {course.title}
          </h1>
          
          {course.description && (
            <p className="text-gray-600 text-base sm:text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
              {course.description}
            </p>
          )}

          <div className="flex flex-col items-center justify-center gap-2 mb-10">
            <span className="text-sm theme-text uppercase tracking-widest font-bold">Tarif d'inscription</span>
            {course.price_fcfa === 0 ? (
              <span className="text-4xl sm:text-5xl font-black theme-text animate-pulse">
                Gratuit !
              </span>
            ) : (
              <span className="text-4xl sm:text-5xl font-black text-gray-900">
                {course.price_fcfa.toLocaleString('fr-FR')} <span className="text-xl text-gray-500 font-medium">FCFA</span>
              </span>
            )}
          </div>

          {course.remainingSeats === 0 ? (
            <button 
              disabled
              className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-semibold text-lg cursor-not-allowed border border-gray-200"
            >
              Formation complète
            </button>
          ) : (
            <button 
              onClick={scrollToForm}
              className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 theme-bg rounded-2xl font-bold text-lg hover:opacity-90 transition-all active:scale-[0.98] animate-pulse hover:animate-none"
            >
              Je m'inscris maintenant
            </button>
          )}

          {course.youtube_video_url && (
            <div className="mt-6">
              <a 
                href={course.youtube_video_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 text-sm font-medium theme-text hover:opacity-80 transition-opacity theme-bg-light px-4 py-2 rounded-full border theme-border-light"
              >
                <Play className="w-4 h-4" />
                Voir la vidéo de présentation
              </a>
            </div>
          )}
        </motion.section>

        {/* Modules Section */}
        {course.course_modules && course.course_modules.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-gray-900 px-2 mb-2 flex items-center gap-2">
              <span className="text-2xl">📚</span> Programme de la formation
            </h2>
            <div className="space-y-3">
              {course.course_modules.map((module: any, idx: number) => (
                <div key={module.id} className="bg-white border theme-border rounded-2xl overflow-hidden transition-all shadow-sm hover:shadow-md">
                  <button 
                    onClick={() => toggleModule(module.id)}
                    className="w-full px-5 py-4 flex items-center justify-between bg-white text-left focus:outline-none"
                  >
                    <div className="flex items-center gap-4 pr-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full theme-bg-light flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900">{module.title}</h3>
                    </div>
                    {openModules[module.id] ? (
                      <ChevronUp className="w-5 h-5 theme-text flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  
                  <div 
                    className={`px-5 pb-5 pt-1 text-gray-600 text-sm sm:text-base leading-relaxed transition-all overflow-hidden ${openModules[module.id] ? 'block' : 'hidden'}`}
                  >
                    <div className="pl-12">
                      {module.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Trainer Section */}
        {course.trainers && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border theme-border relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 theme-bg-light rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-6 border-b theme-border-light pb-4 flex items-center gap-2">
              <span className="text-2xl">🎓</span> Animé par
            </h2>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left relative z-10">
              {course.trainers.photo_url ? (
                <img 
                  src={course.trainers.photo_url} 
                  alt={course.trainers.name} 
                  className="w-24 h-24 rounded-full object-cover shadow-md border-4 border-white" 
                />
              ) : (
                <div className="w-24 h-24 rounded-full theme-bg-light flex flex-shrink-0 items-center justify-center border-4 border-white shadow-sm">
                  <User className="w-10 h-10 theme-text" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{course.trainers.name}</h3>
                {course.trainers.description && (
                  <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                    {course.trainers.description}
                  </p>
                )}
              </div>
            </div>
          </motion.section>
        )}

        {/* Testimonials Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
              Ce qu'ils en disent
            </h2>
            <button
              onClick={() => setShowReviewModal(true)}
              className="text-sm font-medium theme-text hover:underline transition-colors px-3 py-1.5 rounded-lg theme-bg-light"
            >
              Laissez un avis
            </button>
          </div>
          <div className="flex overflow-x-auto gap-4 pb-6 snap-x hide-scrollbar px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style dangerouslySetInnerHTML={{__html: `
              .hide-scrollbar::-webkit-scrollbar {
                display: none;
              }
            `}} />
            {allTestimonials.map((testimonial) => (
              <div 
                key={testimonial.id} 
                className="min-w-[280px] sm:min-w-[320px] bg-white rounded-3xl p-6 shadow-sm border theme-border snap-center flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${(testimonial.rating || 5) > i ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <p className="text-gray-700 italic mb-6 leading-relaxed text-sm sm:text-base">
                    "{testimonial.text}"
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full theme-bg-light theme-text font-bold flex items-center justify-center flex-shrink-0">
                    {testimonial.initials}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{testimonial.name}</h4>
                    <p className="text-xs text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Registration Form / Success Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          ref={formRef} 
          className="bg-gray-900 text-white rounded-3xl p-6 sm:p-10 shadow-2xl overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-gray-800 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gray-800 rounded-tr-full -ml-10 -mb-10 opacity-50 pointer-events-none"></div>
          
          {success ? (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="text-center space-y-6 py-4 relative z-10"
            >
              <div className="w-16 h-16 theme-bg-light theme-text rounded-full flex items-center justify-center mx-auto mb-2 relative">
                <div className="absolute inset-0 theme-bg rounded-full animate-ping opacity-20"></div>
                <CheckCircle2 className="w-8 h-8 relative z-10" />
              </div>
              <h2 className="text-2xl font-bold">Inscription confirmée !</h2>
              <p className="text-gray-300 max-w-md mx-auto leading-relaxed">
                Merci <strong className="text-white">{name}</strong>. Votre inscription à la formation a été enregistrée avec succès. Voici les informations pour y accéder :
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 text-left">
                {course.whatsapp_link && (
                  <a href={course.whatsapp_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-gray-800/80 rounded-xl hover:bg-gray-700 transition-colors border border-gray-700 shadow-sm">
                    <div className="p-2 theme-bg-light theme-text rounded-lg">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">Groupe WhatsApp</div>
                      <div className="text-xs text-gray-400">Rejoindre les autres participants</div>
                    </div>
                  </a>
                )}
                
                {course.google_meet_link && (
                  <a href={course.google_meet_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-gray-800/80 rounded-xl hover:bg-gray-700 transition-colors border border-gray-700 shadow-sm">
                    <div className="p-2 theme-bg-light theme-text rounded-lg">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">Google Meet</div>
                      <div className="text-xs text-gray-400">Lien de la visioconférence</div>
                    </div>
                  </a>
                )}
                
                {course.guide_url && (
                  <div className="col-span-1 sm:col-span-2 mt-4 p-5 bg-gray-800/80 rounded-2xl border border-gray-700 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                      <FileText className="w-5 h-5 theme-text" />
                      Guide de préparation
                    </h3>
                    <p className="text-sm text-gray-300 mb-4">
                      {course.guide_text || 'Nous avons préparé un guide pour vous aider à bien démarrer. Téléchargez-le et lisez-le avant la session.'}
                    </p>
                    <a 
                      href={course.guide_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger le guide
                    </a>
                  </div>
                )}
              </div>
              
              <div className="mt-8 pt-8 border-t border-gray-800">
                <h3 className="text-lg font-bold text-white mb-2">Ajoutez cet événement à votre agenda</h3>
                <div className="relative inline-block text-left mt-2">
                  <button 
                    onClick={() => setShowCalendarMenu(!showCalendarMenu)}
                    className="flex items-center gap-2 px-4 py-3 bg-gray-800/80 text-white border border-gray-700 rounded-xl hover:bg-gray-700 transition-colors shadow-sm font-medium"
                  >
                    <Calendar className="w-5 h-5 theme-text" />
                    Ajouter au calendrier
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                  
                  {showCalendarMenu && (
                    <div className="absolute left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:right-0 mt-2 w-64 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 z-50 overflow-hidden">
                      <div className="py-1">
                        <a
                          href={generateGoogleCalendarLink()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors font-medium"
                        >
                          Ajouter à Google Agenda
                        </a>
                        <button
                          onClick={generateIcs}
                          className="group flex w-full items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors font-medium text-left border-t border-gray-100"
                        >
                          Télécharger pour Outlook/Apple
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!(course.whatsapp_link || course.google_meet_link || course.guide_url) && (
                <p className="text-gray-300 text-sm p-4 bg-gray-800/80 rounded-xl border border-gray-700 text-center mt-4 shadow-inner">
                  L'administrateur vous contactera bientôt avec les informations d'accès à la formation.
                </p>
              )}
            </motion.div>
          ) : (
            <div className="relative z-10">
              {course.remainingSeats === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Complet</h2>
                  <p className="text-gray-400">Désolé, cette formation est complète. Les inscriptions sont fermées.</p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold mb-2">Réservez votre place 🎉</h2>
                    <p className="text-gray-400 text-sm">Complétez ce formulaire pour vous inscrire à la formation.</p>
                    
                    {course.remainingSeats !== null && course.remainingSeats > 0 && (
                      <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 rounded-full text-sm font-bold shadow-sm">
                        <AlertCircle className="w-4 h-4" />
                        Plus que {course.remainingSeats} {course.remainingSeats > 1 ? 'places disponibles' : 'place disponible'} !
                      </div>
                    )}
                  </div>
                  
                  {formError && (
                    <div className="mb-6 p-4 rounded-xl bg-red-900/50 border border-red-500/50 text-red-300 text-sm text-center flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {formError}
                    </div>
                  )}

                  <form onSubmit={handleRegister} className="space-y-4 max-w-md mx-auto">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Nom complet</label>
                      <input
                        required
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-white focus:border-transparent transition-shadow text-sm"
                        placeholder="Ex: Kouamé Jean"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Adresse email</label>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-white focus:border-transparent transition-shadow text-sm"
                        placeholder="vous@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Numéro de téléphone</label>
                      <div className="flex gap-2">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="block w-1/3 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-white focus:border-transparent transition-shadow text-sm"
                          required
                        >
                          <option value="+237">🇨🇲 +237 (Cameroun)</option>
                          <option value="+225">🇨🇮 +225 (Côte d'Ivoire)</option>
                          <option value="+221">🇸🇳 +221 (Sénégal)</option>
                          <option value="+228">🇹🇬 +228 (Togo)</option>
                          <option value="+229">🇧🇯 +229 (Bénin)</option>
                          <option value="+226">🇧🇫 +226 (Burkina Faso)</option>
                          <option value="+241">🇬🇦 +241 (Gabon)</option>
                          <option value="+242">🇨🇬 +242 (Congo)</option>
                          <option value="+243">🇨🇩 +243 (RDC)</option>
                          <option value="+33">🇫🇷 +33 (France)</option>
                          <option value="+1">🇺🇸/🇨🇦 +1 (USA/Canada)</option>
                        </select>
                        <input
                          required
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="block w-2/3 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-white focus:border-transparent transition-shadow text-sm"
                          placeholder="Numéro sans l'indicatif"
                        />
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-md text-base font-bold text-gray-900 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-white disabled:opacity-50 transition-colors mt-6 transform active:scale-95"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-gray-900" />
                          Confirmation en cours...
                        </>
                      ) : (
                        'Confirmer mon inscription'
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </motion.section>

        {/* Footer / Links */}
        <div className="mt-16 text-center space-y-6 pb-12">
          <h3 className="text-xl font-bold text-gray-900">Pour aller plus loin</h3>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a 
              href="https://excellerchezpierre.vercel.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex justify-center items-center gap-2 px-6 py-3 theme-bg-light theme-text rounded-xl font-semibold hover:opacity-80 transition-opacity shadow-sm border theme-border"
            >
              <Globe className="w-5 h-5 theme-text" />
              Visiter le site officiel
            </a>
            <a 
              href="https://youtube.com/@excellerchezpierre?si=VjYob_33LerLzC99" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 rounded-xl font-semibold hover:bg-red-500/20 transition-colors border border-red-500/20 shadow-sm"
            >
              <Youtube className="w-5 h-5" />
              Découvrir sur YouTube
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t theme-border-light bg-white/50 pt-10 pb-8 px-4 text-center">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          <div className="flex items-center gap-6">
            <a href="https://www.linkedin.com/in/pierre-valdeze-mbom-mbom-75a660217" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors" title="LinkedIn">
              <Linkedin className="w-6 h-6" />
            </a>
            <a href="https://facebook.com/pierrembom" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500 transition-colors" title="Facebook">
              <Facebook className="w-6 h-6" />
            </a>
            <a href="https://t.me/pierrembom" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400 transition-colors" title="Telegram">
              <Send className="w-6 h-6" />
            </a>
            <a href="https://wa.me/237698389030" target="_blank" rel="noopener noreferrer" className="text-gray-400 theme-text transition-colors" title="WhatsApp">
              <MessageCircle className="w-6 h-6" />
            </a>
          </div>
          <div className="space-y-2 text-sm text-gray-500 font-medium">
            <p>© 2026 Exceller chez Pierre. Tous droits réservés.</p>
            <div className="flex items-center justify-center gap-4">
              <button className="hover:opacity-80 theme-text transition-opacity">Mentions légales</button>
              <button className="hover:opacity-80 theme-text transition-opacity">Politique de confidentialité</button>
            </div>
          </div>
        </div>
      </footer>
      {/* Floating Action Button (Mobile) */}
      <div className="fixed bottom-4 left-0 right-0 px-4 z-50 sm:hidden">
        <a 
          href="https://wa.me/237698389030"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white font-bold py-3.5 px-6 rounded-full shadow-[0_4px_14px_0_rgba(37,211,102,0.39)] hover:bg-[#128C7E] hover:shadow-[0_6px_20px_rgba(37,211,102,0.23)] transition-all active:scale-95"
        >
          <MessageCircle className="w-5 h-5" />
          Contacter sur WhatsApp
        </a>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
          >
            {reviewSuccess ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 theme-bg-light theme-text rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Merci pour votre avis !</h3>
                <p className="text-gray-500">Votre témoignage a été ajouté avec succès.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Laissez un avis</h3>
                  <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <form onSubmit={handleReviewSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom et prénom</label>
                    <input 
                      required 
                      type="text" 
                      value={reviewName}
                      onChange={e => setReviewName(e.target.value)}
                      className="block w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Ex: Kouamé Jean"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut (Niveau d'étude, Poste)</label>
                    <input 
                      required 
                      type="text" 
                      value={reviewStatus}
                      onChange={e => setReviewStatus(e.target.value)}
                      className="block w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Ex: Étudiant en Master, Analyste"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="focus:outline-none hover:scale-110 transition-transform"
                        >
                          <Star className={`w-8 h-8 ${reviewRating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire</label>
                    <textarea 
                      required 
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      rows={4}
                      className="block w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Votre avis sur la formation..."
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={reviewSubmitting}
                    className="w-full py-3 theme-bg rounded-xl text-white font-bold disabled:opacity-50"
                  >
                    {reviewSubmitting ? 'Envoi...' : 'Envoyer mon avis'}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
