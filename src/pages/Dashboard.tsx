import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import AdminManagementModal from '../components/AdminManagementModal';
import { 
  BookOpen, Users, LogOut, ChevronRight, Sparkles, CreditCard, 
  MessageSquare, Loader2, ShieldCheck, GraduationCap, 
  Activity, Mail, Brain, BarChart3, Settings, PlaySquare, BookText,
  UserCheck, Briefcase, FileText, Target, LayoutDashboard, ClipboardList
} from 'lucide-react';

const AdminTile = ({ title, description, icon: Icon, to, onClick, colorClass, badgeCount }: any) => {
  const content = (
    <div className={`group bg-white p-4 lg:p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[128px] sm:min-h-[144px] lg:min-h-[136px] relative overflow-hidden ring-1 ring-black/5 active:scale-95 ${onClick ? 'cursor-pointer' : ''}`}>
      {/* Background Watermark Icon */}
      <Icon className="absolute -bottom-4 -right-4 w-24 h-24 opacity-[0.03] transform group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 text-gray-900 pointer-events-none" />
      
      <div className="flex items-start justify-between relative z-10 mb-2">
        <div className={`w-10 h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform ${colorClass}`}>
          <Icon className="w-5 h-5 lg:w-5 lg:h-5" />
        </div>
        
        {badgeCount > 0 && (
          <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-sm">
            {badgeCount}
          </span>
        )}
      </div>
      
      <div className="relative z-10">
        <h3 className="text-sm lg:text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-1">
          {title}
        </h3>
        {description && (
          <p className="text-[10px] sm:text-[11px] lg:text-[11px] text-gray-500 mt-1 font-medium line-clamp-2 leading-tight lg:leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );

  if (to) {
    return <Link to={to} className="block outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-2xl">{content}</Link>;
  }
  return <button type="button" onClick={onClick} className="w-full text-left outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-2xl">{content}</button>;
};

const DashboardGroup = ({ title, description, icon: Icon, children }: any) => (
  <div className="mb-10 lg:mb-12">
    <div className="mb-4 lg:mb-5">
      <h2 className="text-lg lg:text-xl font-extrabold text-gray-900 flex items-center gap-2">
        <Icon className="w-5 h-5 lg:w-6 lg:h-6 text-indigo-500" />
        {title}
      </h2>
      {description && <p className="text-xs lg:text-sm text-gray-500 mt-1">{description}</p>}
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
      {children}
    </div>
  </div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [coursesCount, setCoursesCount] = useState<number>(0);
  const [interactiveCoursesCount, setInteractiveCoursesCount] = useState<number>(0);
  const [paymentsCount, setPaymentsCount] = useState<number>(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState<number>(0);
  const [clientsCount, setClientsCount] = useState<number>(0);
  const [trainersCount, setTrainersCount] = useState<number>(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setCurrentUserEmail(data.user.email);
    }).catch((err) => console.warn('GetUser error in Dashboard:', err));

    fetchDashboardMetrics();
  }, []);

  const fetchDashboardMetrics = async () => {
    try {
      setLoadingStats(true);

      // 1. Fetch courses count
      const { count: cCount } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true });

      if (cCount !== null) setCoursesCount(cCount);

      // 1b. Fetch interactive courses count
      try {
        const { count: icCount } = await supabase
          .from('interactive_courses')
          .select('*', { count: 'exact', head: true });
        if (icCount !== null) setInteractiveCoursesCount(icCount);
      } catch (e) {
        console.warn('Erreur count interactive_courses:', e);
      }

      // 2. Fetch real payments count
      const { count: pTableCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true });

      const { count: regApprovedCount } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'approved');

      const realPCount = (pTableCount && pTableCount > 0)
        ? pTableCount
        : (regApprovedCount !== null ? regApprovedCount : 0);

      setPaymentsCount(realPCount);

      // Pending payments count for red badge indicator
      const { count: pendCount } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'pending');

      if (pendCount !== null) setPendingPaymentsCount(pendCount);

      // 3. Fetch total clients count
      const { count: clCount } = await supabase
        .from('client_profiles')
        .select('*', { count: 'exact', head: true });

      if (clCount !== null && clCount > 0) {
        setClientsCount(clCount);
      } else {
        const { count: regCount } = await supabase
          .from('registrations')
          .select('*', { count: 'exact', head: true });
        setClientsCount(regCount || 0);
      }

      // 4. Fetch trainers count
      const { count: tCount } = await supabase
        .from('trainers')
        .select('*', { count: 'exact', head: true });

      if (tCount !== null) setTrainersCount(tCount);

      // 5. Fetch unread messages count
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { count: mCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .neq('sender_id', user.id)
          .eq('is_read', false);

        if (mCount !== null) setUnreadMessagesCount(mCount);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Voulez-vous vraiment vous déconnecter de l\'espace administrateur ?')) {
      setIsLoggingOut(true);
      await supabase.auth.signOut();
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-1 px-3 sm:p-6 lg:py-5 lg:px-8 font-sans pb-24 lg:pb-8 w-full">
      <div className="max-w-5xl mx-auto space-y-8 lg:space-y-10">
        
        {/* Welcome Banner & Quick Metrics */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] lg:rounded-3xl p-6 sm:p-8 lg:p-6 xl:p-8 text-white shadow-xl lg:shadow-xl lg:shadow-indigo-950/40 lg:border lg:border-white/10 lg:backdrop-blur-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 lg:w-[400px] lg:h-[400px] bg-indigo-500/10 lg:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-10 -left-10 w-72 h-72 lg:w-[300px] lg:h-[300px] bg-purple-500/10 lg:bg-purple-500/15 rounded-full blur-2xl pointer-events-none"></div>
          <div className="hidden lg:block absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none"></div>
          
          {/* Decorative Watermark Icon in Background */}
          <BarChart3 className="absolute -bottom-8 -right-8 w-56 h-56 sm:w-72 sm:h-72 lg:w-80 lg:h-80 opacity-[0.06] text-indigo-200 transform -rotate-12 pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2 max-w-full">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-indigo-100 shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Espace Administrateur</span>
                </div>
                {currentUserEmail && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 backdrop-blur-md border border-indigo-400/30 text-xs font-medium text-white max-w-full overflow-hidden">
                    <span className="hidden lg:inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Compte actif" />
                    <Mail className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                    <span className="truncate font-semibold">{currentUserEmail}</span>
                  </div>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-extrabold lg:font-black tracking-tight text-white mb-2">
                Tableau de bord administrateur
              </h1>
              <p className="text-xs sm:text-sm text-indigo-200/80 font-medium max-w-md">
                Gérez votre école, vos formations, vos clients et vos ventes depuis ce portail unifié.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3 w-full lg:w-auto shrink-0">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full sm:w-auto">
                {/* 1. Formations */}
                <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-2.5 rounded-2xl lg:rounded-xl text-center min-w-[110px] lg:min-w-[95px] xl:min-w-[105px]">
                  <div className="flex items-center justify-center gap-1.5">
                    <BookOpen className="hidden lg:inline-block w-3.5 h-3.5 text-indigo-300" />
                    <span className="text-xl xl:text-2xl font-extrabold text-white">
                      {loadingStats ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : coursesCount}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs lg:text-[10px] font-bold text-indigo-200 uppercase tracking-wider mt-0.5 block">
                    Formations
                  </span>
                </div>
                {/* 2. Paiements */}
                <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-2.5 rounded-2xl lg:rounded-xl text-center relative min-w-[110px] lg:min-w-[95px] xl:min-w-[105px]">
                  <div className="flex items-center justify-center gap-1.5">
                    <CreditCard className="hidden lg:inline-block w-3.5 h-3.5 text-amber-300" />
                    <span className="text-xl xl:text-2xl font-extrabold text-white">
                      {loadingStats ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : paymentsCount}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs lg:text-[10px] font-bold text-amber-300 uppercase tracking-wider mt-0.5 block">
                    Paiements
                  </span>
                  {pendingPaymentsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                  )}
                </div>
                {/* 3. Clients */}
                <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-2.5 rounded-2xl lg:rounded-xl text-center min-w-[110px] lg:min-w-[95px] xl:min-w-[105px]">
                  <div className="flex items-center justify-center gap-1.5">
                    <Users className="hidden lg:inline-block w-3.5 h-3.5 text-sky-300" />
                    <span className="text-xl xl:text-2xl font-extrabold text-white">
                      {loadingStats ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : clientsCount}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs lg:text-[10px] font-bold text-sky-300 uppercase tracking-wider mt-0.5 block">
                    Clients
                  </span>
                </div>
                {/* 4. Formateurs */}
                <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-2.5 rounded-2xl lg:rounded-xl text-center min-w-[110px] lg:min-w-[95px] xl:min-w-[105px]">
                  <div className="flex items-center justify-center gap-1.5">
                    <GraduationCap className="hidden lg:inline-block w-3.5 h-3.5 text-emerald-300" />
                    <span className="text-xl xl:text-2xl font-extrabold text-white">
                      {loadingStats ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : trainersCount}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs lg:text-[10px] font-bold text-emerald-300 uppercase tracking-wider mt-0.5 block">
                    Formateurs
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- NAVIGATION GROUPÉE --- */}
        <div className="space-y-4">
          
          <DashboardGroup 
            title="Contenu pédagogique" 
            description="Gérez vos différents formats de contenu et produits."
            icon={BookOpen}
          >
            <AdminTile 
              title="Formations" 
              description="Catalogue, chapitres, leçons"
              icon={BookOpen} 
              to="/admin/formations"
              colorClass="bg-indigo-50 text-indigo-600"
            />
            <AdminTile 
              title="Cours Interactifs" 
              description="Activités interactives et exercices"
              icon={PlaySquare} 
              to="/admin/interactive-courses"
              colorClass="bg-sky-50 text-sky-600"
            />
            <AdminTile 
              title="E-books" 
              description="Livres numériques et PDF"
              icon={BookText} 
              to="/admin/ebooks"
              colorClass="bg-fuchsia-50 text-fuchsia-600"
            />
            <AdminTile 
              title="Centre d'entraînement" 
              description="Correction de code et algorithmique"
              icon={Brain} 
              to="/admin/training"
              colorClass="bg-emerald-50 text-emerald-600"
            />
          </DashboardGroup>

          <DashboardGroup 
            title="Clients & Communauté" 
            description="Gérez vos utilisateurs et vos échanges."
            icon={Users}
          >
            <AdminTile 
              title="Base Clients" 
              description="Tous les profils clients inscrits"
              icon={Users} 
              to="/admin/clients?tab=all_clients"
              colorClass="bg-blue-50 text-blue-600"
            />
            <AdminTile 
              title="Étudiants & Inscrits" 
              description="Suivi des élèves en formation"
              icon={GraduationCap} 
              to="/admin/clients?tab=students"
              colorClass="bg-purple-50 text-purple-600"
            />
            <AdminTile 
              title="Messagerie" 
              description="Échanges avec les clients"
              icon={MessageSquare} 
              to="/admin/clients?tab=messages"
              colorClass="bg-amber-50 text-amber-600"
              badgeCount={unreadMessagesCount}
            />
            <AdminTile 
              title="Commerciaux" 
              description="Réseau d'affiliation et codes promo"
              icon={Briefcase} 
              to="/admin/clients?tab=commerciaux"
              colorClass="bg-teal-50 text-teal-600"
            />
          </DashboardGroup>

          <DashboardGroup 
            title="Finance & Ventes" 
            description="Suivez vos paiements et prestations."
            icon={CreditCard}
          >
            <AdminTile 
              title="Paiements" 
              description="Vérification et validation financière"
              icon={CreditCard} 
              to="/admin/clients?tab=payments"
              colorClass="bg-emerald-50 text-emerald-600"
              badgeCount={pendingPaymentsCount}
            />
            <AdminTile 
              title="Demandes de services" 
              description="Prestations sur mesure"
              icon={FileText} 
              to="/admin/clients?tab=service_requests"
              colorClass="bg-orange-50 text-orange-600"
            />
          </DashboardGroup>

          <DashboardGroup 
            title="Analyses & Statistiques" 
            description="Suivez les performances de votre école."
            icon={BarChart3}
          >
            <AdminTile 
              title="Activité Récente" 
              description="Journal des événements de la plateforme"
              icon={Activity} 
              to="/admin/activity"
              colorClass="bg-indigo-50 text-indigo-600"
            />
            <AdminTile 
              title="Formulaires & Quiz" 
              description="Réponses aux quiz publics (leads)"
              icon={ClipboardList} 
              to="/admin/hub"
              colorClass="bg-pink-50 text-pink-600"
            />
            <AdminTile 
              title="Propositions Projets" 
              description="Leads et prospection commerciale"
              icon={Target} 
              to="/admin/clients?tab=proposals"
              colorClass="bg-rose-50 text-rose-600"
            />
            <AdminTile 
              title="Stats Entraînement" 
              description="Suivi du code et exercices"
              icon={BarChart3} 
              to="/admin/training/stats"
              colorClass="bg-sky-50 text-sky-600"
            />
          </DashboardGroup>

          <DashboardGroup 
            title="Paramètres" 
            description="Configuration et accès de la plateforme."
            icon={Settings}
          >
            <AdminTile 
              title="Formateurs" 
              description="Comptes et droits d'auteurs"
              icon={UserCheck} 
              to="/admin/trainers"
              colorClass="bg-slate-100 text-slate-700"
            />
            <AdminTile 
              title="Administrateurs" 
              description="Gérer les accès super-admin"
              icon={Settings} 
              onClick={() => setIsAdminModalOpen(true)}
              colorClass="bg-slate-100 text-slate-700"
            />
            <AdminTile 
              title="Déconnexion" 
              description="Fermer la session"
              icon={LogOut} 
              onClick={handleLogout}
              colorClass="bg-red-50 text-red-600"
            />
          </DashboardGroup>

        </div>
      </div>

      <AdminManagementModal 
        isOpen={isAdminModalOpen} 
        onClose={() => setIsAdminModalOpen(false)} 
      />
    </div>
  );
}
