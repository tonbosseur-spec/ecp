import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabaseClient';
import ClientNavBar from '../components/ClientNavBar';
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
  Search,
  UserPlus,
  LogIn,
  ShoppingBag,
  ChevronLeft
} from 'lucide-react';

const PROPOSAL_TEMPLATES = [
  {
    icon: "📊",
    shortTitle: "Analyse Excel",
    title: "Analyse de données & Rapports Décisionnels avec Excel",
    description: "Je souhaite apprendre à importer, nettoyer et modéliser des données avec Power Query, maîtriser les formules avancées (RECHERCHEX, SOMMEPROD), et réaliser des rapports statistiques complets pour faciliter les décisions.",
    price: "35000"
  },
  {
    icon: "📈",
    shortTitle: "Tableaux de Bord",
    title: "Tableaux de bord (Dashboards) interactifs sur Excel",
    description: "Formation pratique pour concevoir des tableaux de bord dynamiques et visuels. Utilisation de tableaux croisés dynamiques avancés, segments interactifs, graphiques combinés et indicateurs clés de performance (KPI).",
    price: "45000"
  },
  {
    icon: "🔬",
    shortTitle: "Analyse SPSS",
    title: "Analyse statistique et traitement d'enquêtes avec SPSS",
    description: "Apprendre à structurer une base de données d'enquête, réaliser des analyses descriptives, croiser des variables, réaliser des tests d'hypothèses (Khi-deux, t-test, ANOVA) et interpréter rigoureusement les résultats.",
    price: "50000"
  },
  {
    icon: "🤖",
    shortTitle: "VBA & Macros",
    title: "Automatisation de rapports et initiation au VBA Excel",
    description: "Maîtriser l'enregistrement de macros et s'initier à la programmation VBA pour automatiser les tâches répétitives, sécuriser des fichiers de travail et générer des rapports automatisés en un seul clic.",
    price: "40000"
  }
];

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

  const [searchParams] = useSearchParams();
  const action = searchParams.get('action');

  useEffect(() => {
    if (action === 'propose' && session) {
      setShowProposalModal(true);
    }
  }, [action, session]);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        setSession(currentSession);
        
        let userCourseIds: string[] = [];
        
        if (currentSession) {
          const userId = currentSession.user.id;
          const { data: regData } = await supabase
            .from('registrations')
            .select('course_id')
            .eq('client_id', userId);
            
          if (regData) {
            userCourseIds = regData.map(r => r.course_id);
          }
        }

        // Fetch ALL courses
        let { data: coursesData, error } = await supabase
          .from('courses')
          .select('*, trainers(name, photo_url)')
          .eq('is_archived', false)
          .order('date_time', { ascending: true });

        if (error) {
          // Fallback if is_archived doesn't exist
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('courses')
            .select('*, trainers(name, photo_url)')
            .order('date_time', { ascending: true });
          
          if (fallbackError) throw fallbackError;
          coursesData = fallbackData as any;
        }
        
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

      // Check if already proposed
      const { data: existing } = await supabase
        .from('course_proposals')
        .select('id')
        .eq('client_id', session.user.id)
        .eq('course_id', courseId)
        .maybeSingle();

      if (existing) {
        setToast({
          show: true,
          message: "Vous avez déjà manifesté votre intérêt pour cette formation.",
          type: 'info'
        });
        setSubmittingProposal(false);
        return;
      }

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

    } catch (err: any) {
      console.error("Erreur d'envoi de la proposition:", err);
      let errorMessage = err?.message || "Une erreur est survenue lors de l'envoi de votre demande. Veuillez réessayer.";
      if (errorMessage.includes('foreign key constraint') || errorMessage.includes('client_profiles')) {
        errorMessage = "Impossible de soumettre : en tant qu'administrateur, vous n'avez pas de profil client pour effectuer cette action.";
      }
      setToast({
        show: true,
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setSubmittingProposal(false);
    }
  };

  const handleOpenProposalModal = () => {
    if (!session) {
      setAuthModalReason("réserver un accompagnement personnalisé");
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

    } catch (err: any) {
      console.error("Erreur d'envoi de la proposition personnalisée:", err);
      let errorMessage = err?.message || "Une erreur est survenue lors de l'envoi de votre proposition. Veuillez réessayer.";
      if (errorMessage.includes('foreign key constraint') || errorMessage.includes('client_profiles')) {
        errorMessage = "Impossible de soumettre : en tant qu'administrateur, vous n'avez pas de profil client pour effectuer cette action.";
      }
      setToast({
        show: true,
        message: errorMessage,
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
      <ClientNavBar currentSession={session} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Catalogue des Formations
          </h1>
          <p className="text-gray-500 text-lg">
            Découvrez nos prochaines sessions et développez vos compétences avec nos experts.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-10 max-w-2xl mx-auto">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Rechercher une formation (logiciel, domaine, outils...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-12 py-4 border-2 border-gray-100 rounded-[1.5rem] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm text-base"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                title="Effacer la recherche"
              >
                <X className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>

        {/* Custom Proposal Call-to-Action Banner */}
        <div className="mb-12 bg-gradient-to-br from-blue-600 via-indigo-700 to-indigo-900 rounded-[2.5rem] p-8 sm:p-10 text-white shadow-xl shadow-blue-100 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-overlay" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80')" }}></div>
          <div className="relative z-10 space-y-3 text-center md:text-left max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-black flex items-center justify-center md:justify-start gap-3 tracking-tight">
              <Sparkles className="w-8 h-8 text-yellow-300 animate-pulse" />
              Accompagnement personnalisé
            </h2>
            <p className="text-blue-100 text-base sm:text-lg leading-relaxed font-medium">
              Besoin d'une formation sur mesure ou d'un suivi spécifique pour vos projets ? Nous concevons le programme idéal pour vous.
            </p>
          </div>
          <button
            onClick={handleOpenProposalModal}
            className="relative z-10 shrink-0 px-8 py-4 bg-white text-blue-700 font-black rounded-2xl shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all hover:scale-105 active:scale-95 text-base flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>Réservez un accompagnement</span>
          </button>
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
          <div className="bg-white rounded-[2.5rem] p-10 sm:p-16 text-center border border-gray-100 shadow-xl shadow-gray-200/40 max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8">
              <Search className="w-12 h-12 text-blue-400" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-4 tracking-tight">Aucun résultat pour "{searchQuery}"</h3>
            <p className="text-gray-500 mb-10 max-w-md mx-auto leading-relaxed">
              Nous n'avons pas trouvé de formation correspondant à votre recherche. Pourquoi ne pas demander un accompagnement sur mesure ?
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleOpenProposalModal}
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5 text-yellow-300" />
                <span>Demander un accompagnement personnalisé</span>
              </button>
              <button
                onClick={() => setSearchQuery('')}
                className="w-full sm:w-auto px-8 py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-all"
              >
                Voir tout le catalogue
              </button>
            </div>
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
            {filteredCourses.map((course, index) => {
              const courseDate = new Date(course.date_time);
              const isInactive = course.is_active === false;
              const formattedPrice = course.price_fcfa === 0
                ? "Gratuit"
                : `${course.price_fcfa.toLocaleString('fr-FR')} FCFA`;
              
              return (
                <motion.div 
                  key={`${course.id}-${index}`} 
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

        {/* Bottom CTA Section (replaced floating buttons) */}
        <div className="mt-20 pt-10 border-t border-gray-100 text-center">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Vous ne trouvez pas ce que vous cherchez ?</h3>
            <p className="text-gray-500 text-base leading-relaxed">
              Nous pouvons créer un programme sur mesure adapté à vos objectifs spécifiques.
            </p>
            <button
              onClick={handleOpenProposalModal}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-100 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span>Réserver un accompagnement personnalisé</span>
            </button>
          </div>
        </div>
      </main>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-6 sm:p-8 relative shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 font-extrabold text-xs uppercase tracking-wider mb-5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              <span>Espace Privé</span>
            </div>

            <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-tight mb-3">
              Rejoignez Exceller chez Pierre 🚀
            </h3>
            
            <p className="text-gray-600 text-sm leading-relaxed mb-5">
              Pour pouvoir <strong className="text-gray-950 font-bold">{authModalReason}</strong>, vous devez simplement disposer d'un <strong>compte client</strong> (gratuit).
            </p>

            {/* Account advantages */}
            <div className="space-y-3 bg-gray-50/70 p-4 sm:p-5 rounded-2xl border border-gray-100/70 mb-6 text-left">
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Vos avantages membre :</p>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2.5 text-xs text-gray-700 leading-tight">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Accès gratuit & instantané à votre Hub d'apprentissage privé</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-gray-700 leading-tight">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Suivi de l'état de vos inscriptions et validation de vos paiements</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-gray-700 leading-tight">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Accès direct aux liens Google Meet, groupes WhatsApp et guides</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                to="/client/register"
                className="w-full py-3.5 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-center font-extrabold rounded-2xl transition-all shadow-lg shadow-blue-100 hover:shadow-xl hover:shadow-blue-200 text-sm active:scale-98 flex items-center justify-center gap-2 cursor-pointer font-sans"
              >
                <UserPlus className="w-4 h-4" />
                <span>Créer mon compte gratuitement</span>
              </Link>
              <Link
                to="/client/login"
                className="w-full py-3.5 px-5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-center font-bold rounded-2xl transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-gray-600" />
                <span>Déjà membre ? Se connecter</span>
              </Link>
              <button
                onClick={() => setShowAuthModal(false)}
                className="w-full py-2 text-gray-400 hover:text-gray-600 text-center text-xs font-bold transition-all hover:underline cursor-pointer"
              >
                Continuer la navigation sur la boutique
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
                <h3 className="text-xl font-bold text-gray-900">Demander un accompagnement</h3>
                <p className="text-gray-500 text-xs">Exprimez vos besoins, nous créons la solution idéale !</p>
              </div>
            </div>

            {/* Suggestions / Templates */}
            <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left">
              <p className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1">
                💡 Vous n'avez pas d'idée ?
              </p>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                Cliquez sur l'un de nos modèles d'analyse de données et d'outils bureautiques pour pré-remplir le formulaire :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PROPOSAL_TEMPLATES.map((tpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setProposalTitle(tpl.title);
                      setProposalDescription(tpl.description);
                      setProposalPrice(tpl.price);
                    }}
                    className="p-3 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl text-left transition-all group flex flex-col justify-between shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base select-none">{tpl.icon}</span>
                      <span className="font-bold text-gray-800 text-[11px] sm:text-xs leading-tight group-hover:text-blue-700 transition-colors">
                        {tpl.shortTitle}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium font-mono">
                      Suggéré : {parseFloat(tpl.price) === 0 ? "Gratuit" : `${parseFloat(tpl.price).toLocaleString('fr-FR')} FCFA`}
                    </span>
                  </button>
                ))}
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
