import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import AdminManagementModal from '../components/AdminManagementModal';
import { 
  BookOpen, 
  Users, 
  Store, 
  UserPlus, 
  LogOut, 
  ChevronRight, 
  Sparkles, 
  CreditCard, 
  MessageSquare, 
  CalendarCheck, 
  Video, 
  PlusCircle, 
  Lightbulb, 
  Gift, 
  Loader2,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  GraduationCap,
  Activity,
  Smartphone,
  Mail,
  Brain
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [coursesCount, setCoursesCount] = useState<number>(0);
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
      <div className="max-w-6xl mx-auto space-y-6 lg:space-y-4">
        
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] lg:rounded-3xl p-6 sm:p-8 lg:p-5 xl:p-6 text-white shadow-xl lg:shadow-xl lg:shadow-indigo-950/40 lg:border lg:border-white/10 lg:backdrop-blur-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 lg:w-[400px] lg:h-[400px] bg-indigo-500/10 lg:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-10 -left-10 w-72 h-72 lg:w-[300px] lg:h-[300px] bg-purple-500/10 lg:bg-purple-500/15 rounded-full blur-2xl pointer-events-none"></div>
          <div className="hidden lg:block absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none"></div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 lg:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2 lg:mb-2.5 max-w-full overflow-hidden">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 lg:px-3 lg:py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-indigo-200 lg:text-indigo-100 lg:bg-white/15 lg:border-white/20 shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Espace Administrateur</span>
                </div>
                {currentUserEmail && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 lg:px-3 lg:py-1 rounded-full bg-indigo-500/20 backdrop-blur-md border border-indigo-400/30 text-xs font-medium text-indigo-100 lg:text-white lg:bg-indigo-500/25 lg:border-indigo-400/40 min-w-0">
                    <span className="hidden lg:inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Compte actif" />
                    <Mail className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                    <span className="truncate max-w-[150px] xs:max-w-[200px] sm:max-w-xs lg:max-w-[220px] xl:max-w-xs font-semibold">{currentUserEmail}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-extrabold lg:font-black tracking-tight text-white lg:bg-clip-text lg:text-transparent lg:bg-gradient-to-r lg:from-white lg:via-slate-100 lg:to-indigo-200">
                  Accueil Administration
                </h1>
              </div>

              {currentUserEmail && (
                <p className="text-xs sm:text-sm text-indigo-200/80 mt-1 lg:mt-1.5 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="hidden lg:inline-block w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Connecté avec l'adresse :</span>
                  <span className="font-bold text-white underline decoration-indigo-400/50 underline-offset-2 lg:decoration-indigo-400/80">{currentUserEmail}</span>
                </p>
              )}
            </div>

            {/* Quick Metrics Bar */}
            <div className="flex items-center gap-3 lg:gap-3 w-full lg:w-auto shrink-0">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-2.5 w-full sm:w-auto">
                {/* 1. Formations */}
                <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-3 lg:py-2 rounded-2xl lg:rounded-xl text-center min-w-[110px] lg:min-w-[95px] xl:min-w-[105px] lg:hover:bg-white/20 lg:hover:border-white/25 lg:transition-all lg:duration-200">
                  <div className="flex items-center justify-center gap-1.5">
                    <BookOpen className="hidden lg:inline-block w-3.5 h-3.5 text-indigo-300 shrink-0" />
                    <span className="text-lg sm:text-xl lg:text-xl xl:text-2xl font-extrabold text-white block">
                      {loadingStats ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin mx-auto" /> : coursesCount}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs lg:text-[10px] font-bold text-indigo-200 uppercase tracking-wider mt-0.5 block">
                    Formations
                  </span>
                </div>

                {/* 2. Paiements */}
                <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-3 lg:py-2 rounded-2xl lg:rounded-xl text-center relative min-w-[110px] lg:min-w-[95px] xl:min-w-[105px] lg:hover:bg-white/20 lg:hover:border-white/25 lg:transition-all lg:duration-200">
                  <div className="flex items-center justify-center gap-1.5">
                    <CreditCard className="hidden lg:inline-block w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="text-lg sm:text-xl lg:text-xl xl:text-2xl font-extrabold text-white block">
                      {loadingStats ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin mx-auto" /> : paymentsCount}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs lg:text-[10px] font-bold text-amber-300 uppercase tracking-wider mt-0.5 block">
                    Paiements
                  </span>
                  {pendingPaymentsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-ping" title={`${pendingPaymentsCount} en attente`}></span>
                  )}
                </div>

                {/* 3. Clients */}
                <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-3 lg:py-2 rounded-2xl lg:rounded-xl text-center min-w-[110px] lg:min-w-[95px] xl:min-w-[105px] lg:hover:bg-white/20 lg:hover:border-white/25 lg:transition-all lg:duration-200">
                  <div className="flex items-center justify-center gap-1.5">
                    <Users className="hidden lg:inline-block w-3.5 h-3.5 text-sky-300 shrink-0" />
                    <span className="text-lg sm:text-xl lg:text-xl xl:text-2xl font-extrabold text-white block">
                      {loadingStats ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin mx-auto" /> : clientsCount}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs lg:text-[10px] font-bold text-sky-300 uppercase tracking-wider mt-0.5 block">
                    Clients
                  </span>
                </div>

                {/* 4. Formateurs */}
                <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-3 lg:py-2 rounded-2xl lg:rounded-xl text-center min-w-[110px] lg:min-w-[95px] xl:min-w-[105px] lg:hover:bg-white/20 lg:hover:border-white/25 lg:transition-all lg:duration-200">
                  <div className="flex items-center justify-center gap-1.5">
                    <GraduationCap className="hidden lg:inline-block w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span className="text-lg sm:text-xl lg:text-xl xl:text-2xl font-extrabold text-white block">
                      {loadingStats ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin mx-auto" /> : trainersCount}
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

        {/* Belles Tuiles Principal Navigation */}
        <div className="space-y-3.5 lg:space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">Espaces de Gestion</h2>
            <span className="text-xs font-semibold text-gray-500">Sélectionnez une option</span>
          </div>

          {/* Grille : 2 par ligne sur mobile, 5 par ligne sur grand écran */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-3.5">

            {/* TUILE 1: Gestion des formations */}
            <Link
              to="/admin/formations"
              className="group bg-white p-4 sm:p-5 lg:p-4 xl:p-5 rounded-3xl lg:rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl lg:hover:shadow-lg transition-all duration-300 flex flex-col justify-between aspect-square lg:aspect-auto lg:h-36 xl:h-40 relative overflow-hidden ring-1 ring-black/5 active:scale-95 lg:hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 sm:w-12 sm:h-12 lg:w-10 lg:h-10 xl:w-11 xl:h-11 rounded-2xl lg:rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
                  <BookOpen className="w-6 h-6 sm:w-6 sm:h-6 lg:w-5 lg:h-5 xl:w-5 xl:h-5" />
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-7 lg:h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 lg:w-4 lg:h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <h3 className="text-sm sm:text-base lg:text-xs xl:text-sm font-extrabold text-gray-900 group-hover:text-indigo-900 transition-colors leading-snug">
                  Formations
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-[10px] xl:text-[11px] text-gray-500 mt-0.5 sm:mt-1 font-medium line-clamp-1">
                  Catalogue & cours
                </p>
              </div>
            </Link>

            {/* TUILE 2: Gestion des clients */}
            <Link
              to="/admin/clients"
              className="group bg-white p-4 sm:p-5 lg:p-4 xl:p-5 rounded-3xl lg:rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl lg:hover:shadow-lg transition-all duration-300 flex flex-col justify-between aspect-square lg:aspect-auto lg:h-36 xl:h-40 relative overflow-hidden ring-1 ring-black/5 active:scale-95 lg:hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 sm:w-12 sm:h-12 lg:w-10 lg:h-10 xl:w-11 xl:h-11 rounded-2xl lg:rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-200 group-hover:scale-105 transition-transform relative">
                  <Users className="w-6 h-6 sm:w-6 sm:h-6 lg:w-5 lg:h-5 xl:w-5 xl:h-5" />
                  {pendingPaymentsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-ping"></span>
                  )}
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-7 lg:h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 lg:w-4 lg:h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-sm sm:text-base lg:text-xs xl:text-sm font-extrabold text-gray-900 group-hover:text-emerald-900 transition-colors leading-snug">
                    Clients
                  </h3>
                  {pendingPaymentsCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-red-500 text-white text-[9px] font-black rounded-full">
                      {pendingPaymentsCount}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs lg:text-[10px] xl:text-[11px] text-gray-500 mt-0.5 sm:mt-1 font-medium line-clamp-1">
                  Paiements & suivis
                </p>
              </div>
            </Link>

            {/* TUILE 3: Centre d'entraînement */}
            <Link
              to="/admin/training"
              className="group bg-white p-4 sm:p-5 lg:p-4 xl:p-5 rounded-3xl lg:rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl lg:hover:shadow-lg transition-all duration-300 flex flex-col justify-between aspect-square lg:aspect-auto lg:h-36 xl:h-40 relative overflow-hidden ring-1 ring-black/5 active:scale-95 lg:hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 sm:w-12 sm:h-12 lg:w-10 lg:h-10 xl:w-11 xl:h-11 rounded-2xl lg:rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-200 group-hover:scale-105 transition-transform">
                  <Brain className="w-6 h-6 sm:w-6 sm:h-6 lg:w-5 lg:h-5 xl:w-5 xl:h-5" />
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-7 lg:h-7 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors">
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 lg:w-4 lg:h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <h3 className="text-sm sm:text-base lg:text-xs xl:text-sm font-extrabold text-gray-900 group-hover:text-sky-900 transition-colors leading-snug flex items-center gap-1">
                  <span>Entraînement</span>
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-[10px] xl:text-[11px] text-gray-500 mt-0.5 sm:mt-1 font-medium line-clamp-1">
                  Exercices & Quiz
                </p>
              </div>
            </Link>

            {/* TUILE 4: Espace Hub */}
            <Link
              to="/admin/hub"
              className="group bg-white p-4 sm:p-5 lg:p-4 xl:p-5 rounded-3xl lg:rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl lg:hover:shadow-lg transition-all duration-300 flex flex-col justify-between aspect-square lg:aspect-auto lg:h-36 xl:h-40 relative overflow-hidden ring-1 ring-black/5 active:scale-95 lg:hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 sm:w-12 sm:h-12 lg:w-10 lg:h-10 xl:w-11 xl:h-11 rounded-2xl lg:rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-200 group-hover:scale-105 transition-transform">
                  <Store className="w-6 h-6 sm:w-6 sm:h-6 lg:w-5 lg:h-5 xl:w-5 xl:h-5" />
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-7 lg:h-7 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 lg:w-4 lg:h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <h3 className="text-sm sm:text-base lg:text-xs xl:text-sm font-extrabold text-gray-900 group-hover:text-purple-900 transition-colors leading-snug">
                  Espace Hub
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-[10px] xl:text-[11px] text-gray-500 mt-0.5 sm:mt-1 font-medium line-clamp-1">
                  Marketplace & Quiz
                </p>
              </div>
            </Link>

            {/* TUILE 5: Ajouter un formateur */}
            <Link
              to="/admin/trainers"
              className="group bg-white p-4 sm:p-5 lg:p-4 xl:p-5 rounded-3xl lg:rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl lg:hover:shadow-lg transition-all duration-300 flex flex-col justify-between aspect-square lg:aspect-auto lg:h-36 xl:h-40 relative overflow-hidden ring-1 ring-black/5 active:scale-95 lg:hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 sm:w-12 sm:h-12 lg:w-10 lg:h-10 xl:w-11 xl:h-11 rounded-2xl lg:rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-200 group-hover:scale-105 transition-transform">
                  <UserPlus className="w-6 h-6 sm:w-6 sm:h-6 lg:w-5 lg:h-5 xl:w-5 xl:h-5" />
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-7 lg:h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 lg:w-4 lg:h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <h3 className="text-sm sm:text-base lg:text-xs xl:text-sm font-extrabold text-gray-900 group-hover:text-amber-900 transition-colors leading-snug">
                  Formateurs
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-[10px] xl:text-[11px] text-gray-500 mt-0.5 sm:mt-1 font-medium line-clamp-1">
                  Équipe pédagogique
                </p>
              </div>
            </Link>

          </div>

          {/* Actions du bas (Administration & Déconnexion) : côte à côte sur PC */}
          <div className={`pt-2 sm:pt-3 lg:pt-2 grid grid-cols-1 ${currentUserEmail?.toLowerCase().trim() === 'pmbom@ecp.cm' ? 'lg:grid-cols-2' : ''} gap-3 sm:gap-4`}>
            
            {/* Tuile Administration - Réservée uniquement au compte pmbom@ecp.cm */}
            {currentUserEmail?.toLowerCase().trim() === 'pmbom@ecp.cm' && (
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="w-full group bg-slate-900 hover:bg-slate-800 p-4 sm:p-5 lg:py-3.5 lg:px-4.5 rounded-3xl lg:rounded-2xl border border-slate-900 shadow-md hover:shadow-xl transition-all duration-300 flex items-center justify-between gap-4 active:scale-98 text-white lg:hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3.5 sm:gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 lg:w-9 lg:h-9 rounded-2xl lg:rounded-xl bg-white/10 text-white flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                    <ShieldCheck className="w-5 h-5 sm:w-5 sm:h-5 lg:w-4 lg:h-4 text-indigo-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm sm:text-base lg:text-sm font-extrabold text-white leading-snug">
                      Administration
                    </h3>
                    <p className="text-[11px] sm:text-xs lg:text-[11px] text-slate-300 font-medium">
                      Gestion des comptes administrateur
                    </p>
                  </div>
                </div>

                <div className="px-3.5 py-1.5 sm:px-4 sm:py-2 lg:px-3 lg:py-1.5 bg-white/10 text-white rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5">
                  <span>Gérer</span>
                  <ChevronRight className="w-4 h-4 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            )}

            {/* Bouton Se déconnecter */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full group bg-white hover:bg-rose-50/80 p-4 sm:p-5 lg:py-3.5 lg:px-4.5 rounded-3xl lg:rounded-2xl border border-rose-100 shadow-xs hover:shadow-md transition-all duration-300 flex items-center justify-between gap-4 active:scale-98 lg:hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3.5 sm:gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 lg:w-9 lg:h-9 rounded-2xl lg:rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
                  {isLoggingOut ? <Loader2 className="w-5 h-5 sm:w-5 sm:h-5 lg:w-4 lg:h-4 animate-spin" /> : <LogOut className="w-5 h-5 sm:w-5 sm:h-5 lg:w-4 lg:h-4" />}
                </div>
                <div className="text-left">
                  <h3 className="text-sm sm:text-base lg:text-sm font-extrabold text-gray-900 group-hover:text-rose-900 transition-colors">
                    Se déconnecter
                  </h3>
                  <p className="text-[11px] sm:text-xs lg:text-[11px] text-gray-500 group-hover:text-rose-700/80 transition-colors">
                    Fermer la session
                  </p>
                </div>
              </div>

              <div className="px-3.5 py-1.5 sm:px-4 sm:py-2 lg:px-3 lg:py-1.5 bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white rounded-xl text-xs font-bold transition-colors shrink-0">
                Déconnexion
              </div>
            </button>
          </div>

        </div>
      </div>

      {/* Modal de gestion des Administrateurs */}
      <AdminManagementModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />
    </div>
  );
}
