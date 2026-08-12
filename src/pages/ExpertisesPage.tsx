import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ClientNavBar from '../components/ClientNavBar';
import Footer from '../components/Footer';
import AuthRequiredModal from '../components/AuthRequiredModal';
import { 
  GraduationCap, 
  Briefcase, 
  ArrowRight, 
  CheckCircle2, 
  Loader2, 
  FileText, 
  BarChart2, 
  Send, 
  Sparkles,
  Phone,
  Mail,
  User,
  Folder,
  DollarSign,
  HelpCircle,
  Home,
  RotateCcw
} from 'lucide-react';

export default function ExpertisesPage() {
  const [currentSession, setCurrentSession] = useState<any>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [domain, setDomain] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [serviceType, setServiceType] = useState('Analyse de données');
  const [customServiceType, setCustomServiceType] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentSession(session);
      if (session?.user) {
        // Pre-fill user data if available from meta
        const meta = session.user.user_metadata || {};
        if (meta.first_name) setFirstName(meta.first_name);
        if (meta.last_name) setLastName(meta.last_name);
        if (meta.phone) setPhone(meta.phone);
        if (session.user.email) setEmail(session.user.email);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleResetForm = () => {
    setSubmitted(false);
    setErrorMessage(null);
    setDescription('');
    setBudget('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentSession) {
      setShowAuthModal(true);
      return;
    }

    // 1. Validation
    if (!lastName.trim() || !firstName.trim()) {
      setErrorMessage("Veuillez renseigner votre nom et prénom.");
      return;
    }

    if (!domain.trim()) {
      setErrorMessage("Veuillez indiquer votre domaine d'activité ou d'étude.");
      return;
    }

    if (!phone.trim()) {
      setErrorMessage("Veuillez renseigner votre numéro de téléphone.");
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage("Veuillez indiquer une adresse e-mail valide.");
      return;
    }

    if (!description.trim() || description.trim().length < 15) {
      setErrorMessage("Veuillez décrire précisément votre besoin (au moins 15 caractères).");
      return;
    }

    const numericBudget = budget ? parseFloat(budget) : null;
    if (budget && (isNaN(numericBudget!) || numericBudget! < 0)) {
      setErrorMessage("Veuillez indiquer un montant de budget valide en FCFA.");
      return;
    }

    const finalServiceType = serviceType === 'Autre' && customServiceType.trim()
      ? `Autre : ${customServiceType.trim()}`
      : serviceType;

    // 2. Submit with Duplicate Protection
    setIsSubmitting(true);

    try {
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        domain: domain.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        service_type: finalServiceType,
        description: description.trim(),
        budget: numericBudget,
        status: 'Nouvelle'
      };

      const { error } = await supabase
        .from('service_requests')
        .insert([payload]);

      if (error) {
        console.error("Supabase insert error:", error);
        throw error;
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error("Erreur envoi demande:", err);
      setErrorMessage("Une erreur s'est produite lors de l'envoi de votre demande. Veuillez réessayer ou nous contacter directement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-emerald-200 pt-safe pb-safe">
      <ClientNavBar currentSession={currentSession} />

      <main className="flex-1">
        
        {/* HERO / QUESTION INITIALE */}
        <section className="bg-white py-12 sm:py-16 lg:py-20 border-b border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-black uppercase tracking-widest mb-4">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Services & Formations
            </span>

            <h1 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight mb-4">
              Que souhaitez-vous faire ?
            </h1>
            
            <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Choisissez entre développer vos compétences en autonomie grâce à nos formations, ou bénéficier d'un accompagnement personnalisé pour vos projets.
            </p>
          </div>
        </section>

        {/* SECTION LES 2 ORIENTATIONS CLAIRES */}
        <section className="py-12 sm:py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            
            {/* OPTION A — ME FORMER */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                  <GraduationCap className="w-7 h-7" />
                </div>

                <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block mb-1">
                  Option A
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">
                  Me former
                </h2>

                <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-6">
                  Développez vos compétences grâce à nos formations pratiques en Excel, Power BI, R, statistiques et analyse de données.
                </p>

                <div className="space-y-2 mb-8">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Accès aux cours en vidéo & exercices pratiques</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Formateurs expérimentés & suivi pédagogique</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Attestations & fichiers de travail téléchargeables</span>
                  </div>
                </div>
              </div>

              <Link
                to="/catalogue"
                className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 group-hover:shadow-lg active:scale-98"
              >
                <span>Voir les formations</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            {/* OPTION B — J'AI BESOIN D'UN ACCOMPAGNEMENT */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-200/80 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

              <div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                  <Briefcase className="w-7 h-7" />
                </div>

                <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider block mb-1">
                  Option B
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">
                  J'ai besoin d'un accompagnement
                </h2>

                <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-6">
                  Prestations sur-mesure pour professionnels, chercheurs et étudiants :
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-8 text-xs font-semibold text-gray-700">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Analyse de données</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Accompagnement de mémoire</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Analyse statistique</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Traitement / Nettoyage</span>
                  </div>
                </div>
              </div>

              <button
                onClick={scrollToForm}
                className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 group-hover:shadow-lg active:scale-98"
              >
                <span>Demander un accompagnement</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>

          </div>
        </section>

        {/* FORMULAIRE DE DEMANDE DE SERVICE */}
        <section ref={formRef} className="py-12 sm:py-16 bg-white border-t border-gray-100">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center mb-10">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                Prestations & Services Personnalisés
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight mt-3">
                Parlez-nous de votre besoin
              </h2>
              <p className="text-gray-600 text-sm sm:text-base mt-2">
                Décrivez votre projet afin que nous puissions vous proposer un accompagnement adapté.
              </p>
            </div>

            {submitted ? (
              /* ECRAN DE CONFIRMATION AVEC MESSAGE CLAIR ET RETOUR ACCUEIL */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 sm:p-10 text-center shadow-lg"
              >
                <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <h3 className="text-2xl font-black text-gray-900 mb-2">
                  Votre demande a bien été envoyée.
                </h3>

                <p className="text-gray-700 text-sm sm:text-base leading-relaxed max-w-lg mx-auto mb-8">
                  Nous avons bien reçu votre demande. Notre équipe d'experts l'analysera avec attention et nous reviendrons vers vous dans les plus brefs délais.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={handleResetForm}
                    className="w-full sm:w-auto px-6 py-3 bg-white border border-emerald-300 text-emerald-800 font-bold rounded-xl hover:bg-emerald-100/50 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Soumettre une autre demande</span>
                  </button>

                  <Link
                    to="/"
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Home className="w-4 h-4" />
                    <span>Retour à l'accueil</span>
                  </Link>
                </div>
              </motion.div>
            ) : (
              /* FORMULAIRE MOBILE-FIRST */
              <form onSubmit={handleSubmit} className="bg-slate-50 border border-gray-200/80 rounded-3xl p-5 sm:p-8 shadow-sm space-y-6">
                
                {errorMessage && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 shrink-0 text-red-500" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* NOM & PRÉNOM (Empilés sur mobile, côte à côte sur PC) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-1.5">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        placeholder="Ex: NANA"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-1.5">
                      Prénom <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="Ex: Pierre"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* TÉLÉPHONE & EMAIL (Empilés sur mobile, côte à côte sur PC) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-1.5">
                      Téléphone / WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="Ex: +237 690000000"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-1.5">
                      E-mail <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Ex: pierre@example.com"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* DOMAINE D'ACTIVITÉ OU D'ÉTUDE */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-1.5">
                    Domaine d'activité / Domaine d'étude <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Folder className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={domain}
                      onChange={e => setDomain(e.target.value)}
                      placeholder="Ex: Santé publique, Économie, Finance, Agronomie, Marketing..."
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                </div>

                {/* TYPE D'ACCOMPAGNEMENT */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-1.5">
                    Quel type d'accompagnement recherchez-vous ? <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={serviceType}
                    onChange={e => setServiceType(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                  >
                    <option value="Analyse de données">Analyse de données</option>
                    <option value="Accompagnement de mémoire">Accompagnement de mémoire</option>
                    <option value="Analyse statistique">Analyse statistique</option>
                    <option value="Traitement / nettoyage de données">Traitement / nettoyage de données</option>
                    <option value="Appui méthodologique">Appui méthodologique</option>
                    <option value="Autre">Autre</option>
                  </select>

                  {serviceType === 'Autre' && (
                    <div className="mt-3">
                      <input
                        type="text"
                        required
                        value={customServiceType}
                        onChange={e => setCustomServiceType(e.target.value)}
                        placeholder="Précisez votre type d'accompagnement..."
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* DESCRIPTION PRÉCISE DU BESOIN */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-1.5">
                    Description précise de votre besoin <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Décrivez précisément votre besoin, vos données disponibles, vos objectifs, les délais éventuels et toute information qui pourrait nous aider à comprendre votre projet."
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all resize-y min-h-[120px]"
                  />
                </div>

                {/* BUDGET PRÉVU EN FCFA */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-1.5">
                    Budget prévu (FCFA)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={budget}
                      onChange={e => setBudget(e.target.value)}
                      placeholder="Ex: 50 000"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Indiquez une estimation approximative de votre budget.
                  </p>
                </div>

                {/* BOUTON D'ENVOI AVEC ÉTAT DE CHARGEMENT & PROTECTION DOUBLONS */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 group active:scale-98"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Envoi de votre demande en cours...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        <span>Envoyer ma demande</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            )}

          </div>
        </section>

      </main>

      <Footer />

      {/* Modal invitation d'authentification */}
      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Connexion ou inscription requise"
        description="Pour soumettre une demande d'accompagnement ou de prestation personnalisée et pouvoir suivre son évolution depuis votre espace client, vous devez vous connecter ou créer un compte."
        redirectPath="/expertises"
      />
    </div>
  );
}
