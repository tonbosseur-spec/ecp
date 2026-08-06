import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import NotificationBell from '../components/NotificationBell';
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
  CheckCircle2,
  GraduationCap,
  Activity,
  Smartphone
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [coursesCount, setCoursesCount] = useState<number>(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState<number>(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [trainersCount, setTrainersCount] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  useEffect(() => {
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

      // 2. Fetch pending payments count
      const { count: pCount } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'pending');

      if (pCount !== null) setPendingPaymentsCount(pCount);

      // 3. Fetch trainers count
      const { count: tCount } = await supabase
        .from('trainers')
        .select('*', { count: 'exact', head: true });

      if (tCount !== null) setTrainersCount(tCount);

      // 4. Fetch unread messages count
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
    <div className="min-h-screen bg-gray-50 pt-1 px-3 sm:p-6 lg:p-8 font-sans pb-24 w-full">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-6 sm:p-8 lg:p-10 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-indigo-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Espace Administrateur</span>
                </div>
                <div className="md:hidden">
                  <NotificationBell userRole="admin" />
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
                Accueil Administration
              </h1>
            </div>

            {/* Quick Metrics Bar & Bell */}
            <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
              <div className="hidden md:block">
                <NotificationBell userRole="admin" />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
                <div className="bg-white/10 backdrop-blur-md border border-white/10 p-2.5 sm:p-3.5 rounded-2xl text-center">
                  <span className="text-xl font-extrabold text-white block">
                    {loadingStats ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : coursesCount}
                  </span>
                  <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider mt-0.5 block">Formations</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/10 p-2.5 sm:p-3.5 rounded-2xl text-center relative">
                  <span className="text-xl font-extrabold text-white block">
                    {loadingStats ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : pendingPaymentsCount}
                  </span>
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider mt-0.5 block">Paiements</span>
                  {pendingPaymentsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                  )}
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/10 p-2.5 sm:p-3.5 rounded-2xl text-center">
                  <span className="text-xl font-extrabold text-white block">
                    {loadingStats ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : trainersCount}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider mt-0.5 block">Formateurs</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Belles Tuiles Principal Navigation */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Espaces de Gestion</h2>
            <span className="text-xs font-semibold text-gray-500">Sélectionnez une tuile</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">


                        {/* TUILE 1: Du nouveau */}
            <Link
              to="/admin/activity"
              className="group bg-white hover:bg-slate-900/5 p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between gap-6 relative overflow-hidden ring-1 ring-black/5 md:col-span-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-sky-200 group-hover:scale-105 transition-transform">
                  <Activity className="w-7 h-7" />
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-sky-600 bg-sky-50 px-3 py-1 rounded-full group-hover:bg-sky-600 group-hover:text-white transition-colors">
                  <span>Ouvrir</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 group-hover:text-sky-900 transition-colors">
                  Du nouveau (Activité)
                </h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Consultez le fil d'actualité des nouveautés : nouvelles inscriptions, quizz validés, futurs sessions, nouveaux paiements, nouveaux leads...
                </p>
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                  <span className="px-2.5 py-1 bg-sky-50 text-sky-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Fil d'activité
                  </span>
                </div>
              </div>
            </Link>
            {/* TUILE 2: Gestion de formations */}
            <Link
              to="/admin/formations"
              className="group bg-white hover:bg-slate-900/5 p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between gap-6 relative overflow-hidden ring-1 ring-black/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <span>Ouvrir</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-gray-900 group-hover:text-indigo-900 transition-colors">
                  Gestion de formations
                </h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Accédez au catalogue complet, créez une nouvelle formation, gérez vos séances de cours et vos visioconférences en live.
                </p>

                {/* Sub-items badges */}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> Catalogue (page unique)
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <PlusCircle className="w-3 h-3" /> Ajouter formation
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <CalendarCheck className="w-3 h-3" /> Séances
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <Video className="w-3 h-3" /> Création Lives
                  </span>
                </div>
              </div>
            </Link>

            {/* TUILE 3: Gestion clients */}
            <Link
              to="/admin/clients"
              className="group bg-white hover:bg-slate-900/5 p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between gap-6 relative overflow-hidden ring-1 ring-black/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:scale-105 transition-transform">
                  <Users className="w-7 h-7" />
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <span>Ouvrir</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-extrabold text-gray-900 group-hover:text-emerald-900 transition-colors">
                    Gestion clients
                  </h3>
                  {pendingPaymentsCount > 0 && (
                    <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full animate-pulse">
                      {pendingPaymentsCount} en attente
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Gérez les paiements, répondez aux idées et demandes de cours, suivez la progression des apprenants, gérez les codes promo et la messagerie.
                </p>

                {/* Sub-items badges */}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Paiements
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" /> Idées / Demandes
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Apprenants
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <Gift className="w-3 h-3" /> Commerciaux & Promo
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Messages
                  </span>
                </div>
              </div>
            </Link>

            {/* TUILE 4: Espace Hub */}
            <Link
              to="/admin/hub"
              className="group bg-white hover:bg-slate-900/5 p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between gap-6 relative overflow-hidden ring-1 ring-black/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-200 group-hover:scale-105 transition-transform">
                  <Store className="w-7 h-7" />
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <span>Ouvrir</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-gray-900 group-hover:text-purple-900 transition-colors">
                  Espace Hub
                </h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Retrouvez votre espace marketplace, les inscriptions, la validation rapide des paiements ainsi que vos leads & quizz publics avec retour arrière.
                </p>

                {/* Sub-items badges */}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                  <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <Store className="w-3 h-3" /> Marketplace
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Paiements à valider
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Leads & Quizz
                  </span>
                </div>
              </div>
            </Link>

            {/* TUILE 5: Ajouter un formateur */}
            <Link
              to="/trainers"
              className="group bg-white hover:bg-slate-900/5 p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between gap-6 relative overflow-hidden ring-1 ring-black/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-200 group-hover:scale-105 transition-transform">
                  <UserPlus className="w-7 h-7" />
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <span>Ouvrir</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-gray-900 group-hover:text-amber-900 transition-colors">
                  Ajouter un formateur
                </h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Gérez l'équipe pédagogique : ajoutez de nouveaux formateurs, leurs photos, descriptions et leurs expertises de cours.
                </p>

                {/* Sub-items badges */}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    <UserPlus className="w-3 h-3" /> Nouveau profil
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] font-bold rounded-lg flex items-center gap-1">
                    Équipe pédagogique
                  </span>
                </div>
              </div>
            </Link>

          </div>

          {/* TUILE 6: Bouton Se déconnecter */}
          <div className="pt-4">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full group bg-white hover:bg-rose-50/80 p-5 rounded-3xl border border-rose-100 shadow-xs hover:shadow-md transition-all duration-300 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
                  {isLoggingOut ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogOut className="w-6 h-6" />}
                </div>
                <div className="text-left">
                  <h3 className="text-base font-extrabold text-gray-900 group-hover:text-rose-900 transition-colors">
                    Se déconnecter
                  </h3>
                  <p className="text-xs text-gray-500 group-hover:text-rose-700/80 transition-colors">
                    Fermer la session administrateur en toute sécurité
                  </p>
                </div>
              </div>

              <div className="px-4 py-2 bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white rounded-xl text-xs font-bold transition-colors">
                Déconnexion
              </div>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
