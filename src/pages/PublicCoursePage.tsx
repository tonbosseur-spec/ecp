import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Calendar, User, ChevronDown, ChevronUp, Play, CheckCircle2, MessageCircle, Video, FileText, AlertCircle, Download, Globe, Youtube } from 'lucide-react';
import { motion } from 'motion/react';

export default function PublicCoursePage() {
  const { id } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  useEffect(() => {
    if (id) fetchCourse();
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
          course_modules (*),
          registrations (count)
        `)
        .eq('id', id)
        .single();

      if (courseError) throw courseError;

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
          participant_name: name,
          participant_email: email,
          participant_phone: phone
        }]);

      if (error) throw error;
      
      setSuccess(true);
    } catch (err: any) {
      setFormError("Une erreur est survenue lors de l'inscription.");
    } finally {
      setSubmitting(false);
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

  return (
    <div className="min-h-screen bg-green-50/30 font-sans pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-green-100">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-center">
          <img 
            src="https://drive.google.com/uc?export=view&id=1AunbjscLdHMhMy8cZViVBJ-zUzE1zYrg" 
            alt="Exceller chez Pierre" 
            className="h-10 object-contain hover:scale-105 transition-transform" 
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 mt-8 space-y-8 sm:space-y-12">
        {/* Hero Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-green-100 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-green-600"></div>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full text-sm font-medium text-green-700 mb-6 border border-green-100">
            <Calendar className="w-4 h-4" />
            <span className="capitalize">{formattedDate}</span>
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
            <span className="text-sm text-green-600 uppercase tracking-widest font-bold">Tarif d'inscription</span>
            <span className="text-4xl sm:text-5xl font-black text-gray-900">
              {course.price_fcfa.toLocaleString('fr-FR')} <span className="text-xl text-gray-500 font-medium">FCFA</span>
            </span>
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
              className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 bg-green-600 text-white rounded-2xl font-bold text-lg hover:bg-green-500 transition-all shadow-[0_0_20px_rgba(22,163,74,0.6)] active:scale-[0.98] animate-pulse hover:animate-none"
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
                className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-800 transition-colors bg-green-50 px-4 py-2 rounded-full border border-green-100"
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
                <div key={module.id} className="bg-white border border-green-100 rounded-2xl overflow-hidden transition-all shadow-sm hover:shadow-md hover:border-green-300">
                  <button 
                    onClick={() => toggleModule(module.id)}
                    className="w-full px-5 py-4 flex items-center justify-between bg-white text-left focus:outline-none"
                  >
                    <div className="flex items-center gap-4 pr-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900">{module.title}</h3>
                    </div>
                    {openModules[module.id] ? (
                      <ChevronUp className="w-5 h-5 text-green-500 flex-shrink-0" />
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
            className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-green-100 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-green-50 pb-4 flex items-center gap-2">
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
                <div className="w-24 h-24 rounded-full bg-green-100 flex flex-shrink-0 items-center justify-center border-4 border-white shadow-sm">
                  <User className="w-10 h-10 text-green-600" />
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

        {/* Registration Form / Success Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          ref={formRef} 
          className="bg-green-900 text-white rounded-3xl p-6 sm:p-10 shadow-2xl overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-green-800 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-green-800 rounded-tr-full -ml-10 -mb-10 opacity-50 pointer-events-none"></div>
          
          {success ? (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="text-center space-y-6 py-4 relative z-10"
            >
              <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-2 relative">
                <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-20"></div>
                <CheckCircle2 className="w-8 h-8 relative z-10" />
              </div>
              <h2 className="text-2xl font-bold">Inscription confirmée !</h2>
              <p className="text-gray-300 max-w-md mx-auto leading-relaxed">
                Merci <strong className="text-white">{name}</strong>. Votre inscription à la formation a été enregistrée avec succès. Voici les informations pour y accéder :
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 text-left">
                {course.whatsapp_link && (
                  <a href={course.whatsapp_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-green-800/80 rounded-xl hover:bg-green-700 transition-colors border border-green-700 shadow-sm">
                    <div className="p-2 bg-green-500/20 text-green-300 rounded-lg">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">Groupe WhatsApp</div>
                      <div className="text-xs text-green-200">Rejoindre les autres participants</div>
                    </div>
                  </a>
                )}
                
                {course.google_meet_link && (
                  <a href={course.google_meet_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-green-800/80 rounded-xl hover:bg-green-700 transition-colors border border-green-700 shadow-sm">
                    <div className="p-2 bg-blue-500/20 text-blue-300 rounded-lg">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">Google Meet</div>
                      <div className="text-xs text-green-200">Lien de la visioconférence</div>
                    </div>
                  </a>
                )}
                
                {course.guide_url && (
                  <div className="col-span-1 sm:col-span-2 mt-4 p-5 bg-green-800/80 rounded-2xl border border-green-700 shadow-sm">
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-yellow-300" />
                      Guide de préparation
                    </h3>
                    <p className="text-sm text-green-100 mb-4">
                      {course.guide_text || 'Nous avons préparé un guide pour vous aider à bien démarrer. Téléchargez-le et lisez-le avant la session.'}
                    </p>
                    <a 
                      href={course.guide_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white text-green-900 font-bold rounded-xl hover:bg-green-50 transition-colors shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger le guide
                    </a>
                  </div>
                )}
              </div>
              
              <div className="mt-8 pt-8 border-t border-green-800">
                <h3 className="text-lg font-bold text-white mb-2">Ajoutez cet événement à votre agenda</h3>
                <div className="relative inline-block text-left mt-2">
                  <button 
                    onClick={() => setShowCalendarMenu(!showCalendarMenu)}
                    className="flex items-center gap-2 px-4 py-3 bg-green-800/80 text-white border border-green-700 rounded-xl hover:bg-green-700 transition-colors shadow-sm font-medium"
                  >
                    <Calendar className="w-5 h-5 text-yellow-300" />
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
                <p className="text-green-200 text-sm p-4 bg-green-800/80 rounded-xl border border-green-700 text-center mt-4 shadow-inner">
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
                  <p className="text-green-100">Désolé, cette formation est complète. Les inscriptions sont fermées.</p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold mb-2">Réservez votre place 🎉</h2>
                    <p className="text-green-100 text-sm">Complétez ce formulaire pour vous inscrire à la formation.</p>
                    
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
                      <label className="block text-sm font-medium text-green-100 mb-1.5">Nom complet</label>
                      <input
                        required
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full px-4 py-3 bg-green-800/50 border border-green-700 rounded-xl text-white placeholder-green-300/50 focus:ring-2 focus:ring-white focus:border-transparent transition-shadow text-sm"
                        placeholder="Ex: Kouamé Jean"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-green-100 mb-1.5">Adresse email</label>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full px-4 py-3 bg-green-800/50 border border-green-700 rounded-xl text-white placeholder-green-300/50 focus:ring-2 focus:ring-white focus:border-transparent transition-shadow text-sm"
                        placeholder="vous@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-green-100 mb-1.5">Numéro de téléphone</label>
                      <input
                        required
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="block w-full px-4 py-3 bg-green-800/50 border border-green-700 rounded-xl text-white placeholder-green-300/50 focus:ring-2 focus:ring-white focus:border-transparent transition-shadow text-sm"
                        placeholder="+225 01 23 45 67 89"
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-md text-base font-bold text-green-900 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-900 focus:ring-white disabled:opacity-50 transition-colors mt-6 transform active:scale-95"
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
              className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-green-900 text-white rounded-xl font-semibold hover:bg-green-800 transition-colors shadow-sm"
            >
              <Globe className="w-5 h-5 text-green-300" />
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
    </div>
  );
}
