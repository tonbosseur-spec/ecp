import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabaseClient';
import { 
  Loader2, 
  Calendar, 
  User, 
  ArrowRight, 
  BookOpen, 
  Banknote, 
  Users, 
  Sparkles, 
  Plus, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  X,
  Search
} from 'lucide-react';

export default function Marketplace() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCourses = courses.filter(course => {
    const query = searchQuery.toLowerCase();
    const titleMatch = course.title?.toLowerCase().includes(query);
    const descriptionMatch = course.description?.toLowerCase().includes(query);
    return titleMatch || descriptionMatch;
  });

  // Toast Notification State
  const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });

  // Auth requirement modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalReason, setAuthModalReason] = useState('');

  // Proposal modal state
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposalPrice, setProposalPrice] = useState('');
  const [submittingProposal, setSubmittingProposal] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession) {
          navigate('/client/login?redirect=marketplace');
          return;
        }
        
        setSession(currentSession);
        
        let userCourseIds: string[] = [];
        
        const userId = currentSession.user.id;
        const { data: regData } = await supabase
          .from('registrations')
          .select('course_id')
          .eq('client_id', userId);
          
        if (regData) {
          userCourseIds = regData.map(r => r.course_id);
        }

        // Fetch ALL courses (active and inactive)
        const { data: coursesData, error } = await supabase
          .from('courses')
          .select('*, trainers(name, photo_url)')
          .order('date_time', { ascending: true });

        if (error) throw error;
        
        if (coursesData) {
          const availableCourses = coursesData.filter(c => !userCourseIds.includes(c.id));
          setCourses(availableCourses);
        }
      } catch (err) {
        console.error("Erreur chargement catalogue:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Handle click on "Je veux cette formation ✋" for inactive courses
  const handleExpressInterest = async (courseId: string) => {
    if (!session) {
      setAuthModalReason("manifester votre intérêt pour cette formation");
      setShowAuthModal(true);
      return;
    }

    try {
      setSubmittingProposal(true);
      const { error } = await supabase
        .from('course_proposals')
        .insert({
          client_id: session.user.id,
          course_id: courseId,
          status: 'pending'
        });

      if (error) throw error;

      setToast({
        show: true,
        message: "Demande envoyée ! Nous vous tiendrons informé.",
        type: 'success'
      });
      
      setTimeout(() => {
        setToast(prev => prev.message.includes("Demande envoyée") ? { ...prev, show: false } : prev);
      }, 4000);

    } catch (err) {
      console.error("Erreur d'envoi de la proposition:", err);
      setToast({
        show: true,
        message: "Une erreur est survenue lors de l'envoi de votre demande. Veuillez réessayer.",
        type: 'error'
      });
    } finally {
      setSubmittingProposal(false);
    }
  };

  const handleOpenProposalModal = () => {
    if (!session) {
      setAuthModalReason("proposer une idée de formation");
      setShowAuthModal(true);
      return;
    }
    setShowProposalModal(true);
  };

  // Handle custom course proposal form submit
  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    
    if (!proposalTitle.trim() || !proposalDescription.trim()) {
      setToast({
        show: true,
        message: "Veuillez remplir tous les champs obligatoires.",
        type: 'error'
      });
      return;
    }

    try {
      setSubmittingProposal(true);
      const { error } = await supabase
        .from('course_proposals')
        .insert({
          client_id: session.user.id,
          custom_title: proposalTitle,
          custom_description: proposalDescription,
          proposed_price: proposalPrice ? parseFloat(proposalPrice) : null,
          status: 'pending'
        });

      if (error) throw error;

      // Reset and close
      setShowProposalModal(false);
      setProposalTitle('');
      setProposalDescription('');
      setProposalPrice('');
      
      setToast({
        show: true,
        message: "Merci ! Votre proposition a été soumise avec succès. Notre équipe va l'étudier.",
        type: 'success'
      });
      
      setTimeout(() => {
        setToast(prev => prev.message.includes("proposition a été soumise") ? { ...prev, show: false } : prev);
      }, 5000);

    } catch (err) {
      console.error("Erreur d'envoi de la proposition personnalisée:", err);
      setToast({
        show: true,
        message: "Une erreur est survenue lors de l'envoi de votre proposition. Veuillez réessayer.",
        type: 'error'
      });
    } finally {
      setSubmittingProposal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-900 text-white rounded-lg flex items-center justify-center font-bold text-lg">
                E
              </div>
              <span className="font-bold text-xl text-gray-900 tracking-tight">Exceller Market</span>
            </div>
            <Link 
              to="/client/hub"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Mon Espace
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Catalogue des Formations
          </h1>
          <p className="text-gray-500 text-lg">
            Découvrez nos prochaines sessions et développez vos compétences avec nos experts.
          </p>
        </div>

        {/* Custom Proposal Call-to-Action Banner */}
        <div className="mb-12 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-overlay" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80')" }}></div>
          <div className="relative z-10 space-y-2 text-center md:text-left max-w-xl">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center justify-center md:justify-start gap-2">
              <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
              Une idée de formation sur-mesure ?
            </h2>
            <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
              Proposez-nous vos thématiques idéales ! Nous concevrons des formations adaptées à vos besoins spécifiques.
            </p>
          </div>
          <button
            onClick={handleOpenProposalModal}
            className="relative z-10 shrink-0 px-6 py-3.5 bg-white text-blue-700 font-bold rounded-2xl shadow-md hover:bg-blue-50 transition-all hover:scale-105 active:scale-95 text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Proposer une formation</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-8 max-w-xl mx-auto">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Rechercher une formation (titre, description...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-12 py-3.5 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-xs text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                title="Effacer la recherche"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm max-w-lg mx-auto">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Aucune formation disponible</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Il n'y a actuellement aucune nouvelle formation à laquelle vous n'êtes pas déjà inscrit(e).
            </p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm max-w-lg mx-auto">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Aucun résultat trouvé</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Aucune formation ne correspond à votre recherche "{searchQuery}". Essayez avec d'autres mots-clés.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors text-sm"
            >
              Réinitialiser la recherche
            </button>
          </div>
        ) : (
          <motion.div 
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
          >
            {filteredCourses.map((course) => {
              const courseDate = new Date(course.date_time);
              const isInactive = course.is_active === false;
              const formattedPrice = new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'XOF',
                maximumFractionDigits: 0
              }).format(course.price_fcfa);
              
              return (
                <motion.div 
                  key={course.id} 
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } }
                  }}
                  className={`bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full group ${
                    isInactive ? 'opacity-90 saturate-75 border-gray-200' : ''
                  }`}
                >
                  {/* Image de couverture */}
                  <div className="relative h-48 w-full bg-gradient-to-br from-blue-50 to-indigo-50 flex-shrink-0 border-b border-gray-100">
                    {course.cover_image_url ? (
                      <img 
                        src={course.cover_image_url} 
                        alt={course.title} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-blue-200/50" />
                      </div>
                    )}
                    
                    {/* Badge de Type de Produit et Statut d'activation */}
                    <div className="absolute top-4 left-4 flex flex-col items-start gap-1.5">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/95 backdrop-blur-sm shadow-sm">
                        {course.product_type === 'ebook' ? (
                          <span className="text-purple-700 font-bold">📖 E-book</span>
                        ) : (
                          <span className="text-blue-700 font-bold">🎓 Formation</span>
                        )}
                      </div>
                      {isInactive && (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500 text-white border border-amber-400 shadow-sm animate-pulse">
                          <span>Bientôt disponible / Sur demande</span>
                        </div>
                      )}
                    </div>

                    {!isInactive && course.product_type !== 'ebook' && course.max_seats && (
                      <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/90 backdrop-blur-sm text-gray-900 shadow-sm">
                        <Users className="w-3.5 h-3.5" />
                        <span>Max {course.max_seats} pl.</span>
                      </div>
                    )}
                  </div>

                  <div className="p-6 flex-grow relative">
                    {course.initials && (
                      <div className="mb-4">
                        <span className="inline-block text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                          {course.initials}
                        </span>
                      </div>
                    )}
                    
                    <h3 className={`text-xl font-bold text-gray-900 mb-3 leading-tight ${!isInactive ? 'group-hover:text-blue-600 transition-colors' : ''}`}>
                      {course.title}
                    </h3>
                    
                    <div className="space-y-3 mb-6">
                      {course.product_type !== 'ebook' ? (
                        <div className="flex items-center gap-3 text-gray-600 text-sm">
                          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                          <span>
                            {course.is_date_tbd || !course.date_time ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                🗓️ Date à déterminer
                              </span>
                            ) : (
                              `${courseDate.toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              })} à ${courseDate.toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}`
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-gray-600 text-sm">
                          <BookOpen className="w-4 h-4 text-purple-400" />
                          <span className="text-purple-700 font-medium bg-purple-50 px-2 py-0.5 rounded text-xs">Accès immédiat après validation</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-gray-600 text-sm">
                        <Banknote className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold text-gray-900">{formattedPrice}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-6 py-5 border-t border-gray-50 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-auto">
                    <div className="flex items-center gap-3 shrink-0">
                      {course.trainers?.photo_url ? (
                        <img 
                          src={course.trainers.photo_url} 
                          alt={course.trainers.name} 
                          className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white shadow-sm text-gray-500">
                          <User className="w-5 h-5" />
                        </div>
                      )}
                      <div className="text-sm">
                        <p className="text-gray-500 text-xs">Formateur</p>
                        <p className="font-medium text-gray-900 truncate max-w-[150px]">{course.trainers?.name}</p>
                      </div>
                    </div>
                    
                    {isInactive ? (
                      <button 
                        onClick={() => handleExpressInterest(course.id)}
                        disabled={submittingProposal}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold rounded-xl transition-all shadow-sm text-sm"
                      >
                        <span>Je veux cette formation ✋</span>
                      </button>
                    ) : (
                      <Link 
                        to={`/course/${course.id}`}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors shadow-sm group-hover:bg-blue-600 text-sm"
                      >
                        <span>{(course.is_date_tbd || !course.date_time) ? "Se pré-inscrire" : "S'inscrire"}</span>
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>

      {/* Floating Action Button (FAB) for custom proposal (visible on desktop/tablet) */}
      <div className="fixed bottom-6 right-6 z-40 hidden sm:block">
        <button
          onClick={handleOpenProposalModal}
          className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 group"
        >
          <Sparkles className="w-5 h-5 text-yellow-300 group-hover:animate-spin" />
          <span>Une idée ? Proposez-la !</span>
        </button>
      </div>

      {/* Floating Action Button for mobile */}
      <div className="fixed bottom-4 left-4 right-4 z-40 sm:hidden">
        <button
          onClick={handleOpenProposalModal}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white font-bold rounded-2xl shadow-xl transition-all hover:bg-blue-700"
        >
          <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
          <span>Proposer une idée de formation</span>
        </button>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`p-4 rounded-2xl shadow-xl flex items-start gap-3 border ${
            toast.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-900' 
              : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div className="flex-grow">
              <p className="text-sm font-semibold">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToast({ ...toast, show: false })}
              className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Auth Prompt Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 relative shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <User className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">Création de compte requise</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Pour pouvoir <strong className="text-gray-900">{authModalReason}</strong>, vous devez obligatoirement <strong>créer un compte client</strong>. Cela vous permettra d'accéder à votre espace privé sécurisé et de suivre l'évolution de vos demandes.
            </p>

            <div className="flex flex-col gap-2.5">
              <Link
                to="/client/register"
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-center font-extrabold rounded-xl transition-all shadow-md text-sm active:scale-98"
              >
                Créer un compte client (Gratuit)
              </Link>
              <Link
                to="/client/login"
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 text-center font-bold rounded-xl transition-all text-sm"
              >
                Déjà inscrit ? Se connecter
              </Link>
              <button
                onClick={() => setShowAuthModal(false)}
                className="w-full py-2.5 text-gray-400 hover:text-gray-600 text-center text-xs font-semibold transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Modal */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 relative shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowProposalModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Proposer une formation</h3>
                <p className="text-gray-500 text-xs">Exprimez vos besoins, nous créons la formation idéale !</p>
              </div>
            </div>

            <form onSubmit={handleCreateProposal} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Titre de la formation souhaitée <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={proposalTitle}
                  onChange={(e) => setProposalTitle(e.target.value)}
                  placeholder="Ex: Perfectionnement Next.js et Tailwind CSS"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  De quoi s'agit-il ? <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={proposalDescription}
                  onChange={(e) => setProposalDescription(e.target.value)}
                  placeholder="Décrivez brièvement les compétences que vous souhaitez acquérir, les modules idéaux, etc."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Quel budget proposez-vous ? (FCFA / Optionnel)
                </label>
                <input
                  type="number"
                  min="0"
                  value={proposalPrice}
                  onChange={(e) => setProposalPrice(e.target.value)}
                  placeholder="Ex: 50000"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setShowProposalModal(false)}
                  className="flex-1 py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold rounded-xl text-sm transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingProposal}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submittingProposal ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Envoi en cours...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Soumettre mon idée</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
