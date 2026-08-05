import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/Toast';
import VerifiedBadge from '../components/VerifiedBadge';
import { 
  ArrowLeft, 
  CreditCard, 
  Lightbulb, 
  Users, 
  Gift, 
  MessageSquare, 
  Loader2, 
  Check, 
  X, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  Search, 
  Phone, 
  Trash2, 
  UserX, 
  UserCheck, 
  Tag, 
  Award,
  ChevronRight,
  ChevronDown,
  Filter
} from 'lucide-react';
import { AdminChat } from '../components/AdminChat';
import { 
  setClientReferralCode, 
  removeClientReferralCode, 
  getLocalReferralCodes, 
  getAllReferralCodes,
  getAllReferralSales
} from '../lib/referralService';

interface PendingPayment {
  id: string;
  participant_name: string;
  participant_email: string;
  transaction_id: string;
  registered_at: string;
  courses: {
    title: string;
    product_type: string;
  };
}

export default function AdminClients() {
  const { toast: notify } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as 'payments' | 'proposals' | 'students' | 'commerciaux' | 'messages' | null;
  const [activeTab, setActiveTab] = useState<'payments' | 'proposals' | 'students' | 'commerciaux' | 'messages'>(tabParam || 'payments');

  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Proposal filter
  const [proposalFilter, setProposalFilter] = useState<'pending' | 'all'>('pending');

  // Students filter states
  const [studentsSearch, setStudentsSearch] = useState('');
  const [studentsCourseFilter, setStudentsCourseFilter] = useState<string>('all');
  const [studentsProgressFilter, setStudentsProgressFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all');
  const [studentsStatusFilter, setStudentsStatusFilter] = useState<'all' | 'active' | 'pending' | 'rejected'>('all');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Promo assignment states
  const [editingPromoStudent, setEditingPromoStudent] = useState<any | null>(null);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [savingPromo, setSavingPromo] = useState(false);

  useEffect(() => {
    fetchPendingPayments();
    fetchProposals();
    fetchUnreadMessages();

    const channel = supabase
      .channel(`admin_unread_msgs_${Math.random()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          fetchUnreadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [proposalFilter]);

  useEffect(() => {
    if (activeTab === 'students' || activeTab === 'commerciaux') {
      fetchStudentsData();
    }
  }, [activeTab]);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const changeTab = (tab: 'payments' | 'proposals' | 'students' | 'commerciaux' | 'messages') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const fetchUnreadMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .neq('sender_id', user.id)
        .eq('is_read', false);
        
      if (!error && count !== null) {
        setUnreadMessagesCount(count);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPendingPayments = async () => {
    try {
      setLoadingPayments(true);
      const { data, error } = await supabase
        .from('registrations')
        .select(`
          id,
          participant_name,
          participant_email,
          transaction_id,
          registered_at,
          courses (
            title,
            product_type
          )
        `)
        .eq('payment_status', 'pending')
        .order('registered_at', { ascending: false });

      if (error) throw error;
      setPendingPayments(data as unknown as PendingPayment[]);
    } catch (err: any) {
      console.error('Erreur chargement paiements:', err.message);
    } finally {
      setLoadingPayments(false);
    }
  };

  const updatePaymentStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('registrations')
        .update({ payment_status: status })
        .eq('id', id);
        
      if (error) throw error;
      
      showNotification(`Paiement ${status === 'approved' ? 'validé' : 'rejeté'}`);
      fetchPendingPayments();
    } catch (err: any) {
      notify.error("Erreur: " + err.message);
    }
  };

  const fetchProposals = async () => {
    try {
      setLoadingProposals(true);
      let query = supabase
        .from('course_proposals')
        .select(`
          id,
          client_id,
          course_id,
          custom_title,
          custom_description,
          proposed_price,
          status,
          admin_feedback,
          created_at,
          client_profiles (
            first_name,
            last_name,
            phone
          ),
          courses (
            title
          )
        `);

      if (proposalFilter === 'pending') {
        query = query.eq('status', 'pending');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (err: any) {
      console.error('Erreur chargement propositions:', err.message);
    } finally {
      setLoadingProposals(false);
    }
  };

  const handleUpdateProposal = async (id: string, status: string, feedback: string) => {
    try {
      const { error } = await supabase
        .from('course_proposals')
        .update({ status, admin_feedback: feedback })
        .eq('id', id);

      if (error) throw error;

      showNotification("Proposition mise à jour avec succès");
      fetchProposals();
    } catch (err: any) {
      notify.error("Erreur: " + err.message);
    }
  };

  const [availableCoursesOptions, setAvailableCoursesOptions] = useState<{ id: string; title: string }[]>([]);

  const fetchStudentsData = async () => {
    try {
      setLoadingStudents(true);
      
      await Promise.all([
        getAllReferralCodes(),
        getAllReferralSales()
      ]);

      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, title')
        .order('title', { ascending: true });

      if (coursesData) {
        setAvailableCoursesOptions(coursesData);
      }
      
      const { data: regs, error: regsError } = await supabase
        .from('registrations')
        .select(`
          id,
          client_id,
          course_id,
          participant_name,
          participant_email,
          participant_phone,
          payment_status,
          registered_at,
          courses (
            id,
            title,
            product_type
          )
        `)
        .order('registered_at', { ascending: false });

      if (regsError) throw regsError;

      const { data: mods, error: modsError } = await supabase
        .from('course_modules')
        .select('id, course_id, title, order_index')
        .order('order_index', { ascending: true });

      if (modsError) throw modsError;

      const { data: quizzes } = await supabase
        .from('quizzes')
        .select('id, module_id, title');

      const quizByModuleId: Record<string, any> = {};
      (quizzes || []).forEach(q => {
        quizByModuleId[q.module_id] = q;
      });
      const quizModuleIds = new Set((quizzes || []).map(q => q.module_id));

      const { data: progress } = await supabase
        .from('module_progress')
        .select('*')
        .order('completed_at', { ascending: true });

      const modulesByCourse: Record<string, typeof mods> = {};
      mods?.forEach(m => {
        if (!modulesByCourse[m.course_id]) {
          modulesByCourse[m.course_id] = [];
        }
        modulesByCourse[m.course_id].push(m);
      });

      const progressByClient: Record<string, string[]> = {};
      const progressMapByClient: Record<string, Record<string, { completed_at: string; score?: number | null }>> = {};
      
      progress?.forEach(p => {
        if (!progressByClient[p.client_id]) {
          progressByClient[p.client_id] = [];
        }
        progressByClient[p.client_id].push(p.module_id);

        if (!progressMapByClient[p.client_id]) {
          progressMapByClient[p.client_id] = {};
        }
        progressMapByClient[p.client_id][p.module_id] = {
          completed_at: p.completed_at,
          score: (p as any).score !== undefined && (p as any).score !== null ? Number((p as any).score) : null
        };
      });

      const studentsList = (regs || []).map(reg => {
        const client_id = reg.client_id;
        const course_id = reg.course_id;
        const courseModules = modulesByCourse[course_id] || [];
        const totalModules = courseModules.length;

        const completedModuleIds = client_id ? (progressByClient[client_id] || []) : [];
        const completedCourseModules = courseModules.filter(m => completedModuleIds.includes(m.id));
        const completedCount = completedCourseModules.length;
        const completionRate = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

        let localQuizScores: Record<string, number> = {};
        if (client_id) {
          try {
            const scoresKey = `quiz_scores_${client_id}`;
            const localRaw = localStorage.getItem(scoresKey);
            if (localRaw) {
              localQuizScores = JSON.parse(localRaw);
            }
          } catch (e) {
            console.warn('Error reading local quiz scores:', e);
          }
        }

        const modulesDetail = courseModules.map(m => {
          const hasQuiz = quizModuleIds.has(m.id);
          const quizObj = quizByModuleId[m.id];
          const clientProgMap = client_id ? progressMapByClient[client_id] : null;
          const progItem = clientProgMap ? clientProgMap[m.id] : null;
          const isCompleted = !!progItem || (client_id ? (progressByClient[client_id] || []).includes(m.id) : false);

          let score: number | null = null;
          if (progItem && progItem.score !== null && progItem.score !== undefined) {
            score = progItem.score;
          } else if (localQuizScores[m.id] !== undefined && localQuizScores[m.id] !== null) {
            score = Number(localQuizScores[m.id]);
          }

          return {
            id: m.id,
            title: m.title,
            order_index: m.order_index,
            hasQuiz,
            quizTitle: quizObj?.title || 'Quiz de module',
            isCompleted,
            completedAt: progItem?.completed_at || null,
            score
          };
        });

        const realQuizScores = modulesDetail
          .filter(m => m.hasQuiz && m.score !== null && m.score !== undefined)
          .map(m => m.score as number);

        const averageQuizScore = realQuizScores.length > 0
          ? Math.round(realQuizScores.reduce((a, b) => a + b, 0) / realQuizScores.length)
          : null;

        const courseData: any = reg.courses;
        const courseObj = Array.isArray(courseData) ? courseData[0] : courseData;
        const course_title = courseObj?.title || 'Formation inconnue';
        const course_type = courseObj?.product_type || 'formation';

        const localCodes = getLocalReferralCodes();
        const clientPromo = (client_id && localCodes[client_id]) ? localCodes[client_id].code : '';

        return {
          id: reg.id,
          client_id,
          course_id,
          participant_name: reg.participant_name,
          participant_email: reg.participant_email,
          participant_phone: reg.participant_phone,
          payment_status: reg.payment_status,
          registered_at: reg.registered_at,
          course_title,
          course_type,
          completed_count: completedCount,
          total_modules: totalModules,
          completion_rate: completionRate,
          average_quiz_score: averageQuizScore,
          modulesDetail,
          promo_code: clientPromo
        };
      });

      setStudentsData(studentsList);
    } catch (err: any) {
      console.error('Erreur chargement apprenants:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleDeleteStudent = async (student: any) => {
    if (!window.confirm(`Supprimer définitivement l'inscription de "${student.participant_name}" ?`)) return;

    setStudentsData(prev => prev.filter(s => s.id !== student.id));

    try {
      await supabase.from('registrations').delete().eq('id', student.id);
      if (student.client_id) {
        await supabase.from('client_profiles').delete().eq('id', student.client_id);
        await removeClientReferralCode(student.client_id);
      }
      showNotification(`Compte de ${student.participant_name} supprimé.`);
    } catch (err) {
      showNotification(`Compte supprimé.`);
    }
  };

  const handleToggleStudentAccess = async (student: any, newStatus: 'approved' | 'rejected' | 'pending') => {
    const isReject = newStatus === 'rejected';
    if (!window.confirm(`Voulez-vous vraiment ${isReject ? 'désinscrire' : 'réinscrire'} ${student.participant_name} ?`)) return;

    setStudentsData(prev => prev.map(s => s.id === student.id ? { ...s, payment_status: newStatus } : s));

    try {
      await supabase.from('registrations').update({ payment_status: newStatus }).eq('id', student.id);
      showNotification(isReject ? "Accès retiré." : "Accès réactivé.");
    } catch (err) {
      showNotification(isReject ? "Accès retiré." : "Accès activé.");
    }
  };

  const handleAssignPromoCode = async () => {
    if (!editingPromoStudent) return;
    const targetId = editingPromoStudent.client_id || editingPromoStudent.id;
    const code = promoCodeInput.trim().toUpperCase();

    if (!code) {
      notify.info("Veuillez saisir un code promo commercial valide.");
      return;
    }

    setSavingPromo(true);
    try {
      const res = await setClientReferralCode(targetId, code, {
        name: editingPromoStudent.participant_name,
        email: editingPromoStudent.participant_email,
        phone: editingPromoStudent.participant_phone
      });

      if (!res.success) {
        notify.error(res.message || "Erreur lors de l'attribution du code.");
        setSavingPromo(false);
        return;
      }

      setStudentsData(prev => prev.map(s => {
        if (s.id === editingPromoStudent.id || (s.client_id && s.client_id === targetId)) {
          return { ...s, promo_code: code };
        }
        return s;
      }));

      showNotification(`Code promo "${code}" attribué à ${editingPromoStudent.participant_name}.`);
      setEditingPromoStudent(null);
      setPromoCodeInput('');
    } catch (e: any) {
      notify.error("Erreur: " + e.message);
    } finally {
      setSavingPromo(false);
    }
  };

  const getWhatsAppLink = (phone: string, name: string, courseTitle?: string) => {
    let cleanPhone = (phone || '').replace(/\D/g, '');
    if (cleanPhone.length === 9 && (cleanPhone.startsWith('6') || cleanPhone.startsWith('2'))) {
      cleanPhone = '237' + cleanPhone;
    }
    const msg = courseTitle
      ? `Bonjour ${name}, je vous contacte au sujet de votre formation "${courseTitle}".`
      : `Bonjour ${name}, je vous contacte de la part de l'administration.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  const filteredStudents = useMemo(() => {
    return studentsData.filter(student => {
      const matchesSearch = 
        student.participant_name.toLowerCase().includes(studentsSearch.toLowerCase()) ||
        student.participant_email.toLowerCase().includes(studentsSearch.toLowerCase()) ||
        student.participant_phone.includes(studentsSearch);

      const matchesCourse = studentsCourseFilter === 'all' || student.course_id === studentsCourseFilter;

      let matchesProgress = true;
      if (studentsProgressFilter === 'not_started') matchesProgress = student.completion_rate === 0;
      else if (studentsProgressFilter === 'in_progress') matchesProgress = student.completion_rate > 0 && student.completion_rate < 100;
      else if (studentsProgressFilter === 'completed') matchesProgress = student.completion_rate === 100;

      let matchesStatus = true;
      if (studentsStatusFilter === 'active') matchesStatus = student.payment_status === 'approved';
      else if (studentsStatusFilter === 'pending') matchesStatus = student.payment_status === 'pending';
      else if (studentsStatusFilter === 'rejected') matchesStatus = student.payment_status === 'rejected' || student.payment_status === 'cancelled';

      return matchesSearch && matchesCourse && matchesProgress && matchesStatus;
    });
  }, [studentsData, studentsSearch, studentsCourseFilter, studentsProgressFilter, studentsStatusFilter]);

  if (activeTab === 'messages') {
    return <AdminChat onBack={() => changeTab('payments')} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 font-sans pb-24 w-full">
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-top-4 fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          {toastMessage}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header with Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all flex items-center justify-center shrink-0"
              title="Retour à l'accueil admin"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Espace Client
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1">Gestion clients</h1>
              <p className="text-xs sm:text-sm text-gray-500">Paiements, propositions, apprenants, promo et messagerie</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            onClick={() => changeTab('payments')}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 relative ${
              activeTab === 'payments'
                ? 'bg-emerald-900 text-white border-emerald-900 shadow-md ring-2 ring-emerald-600'
                : 'bg-white text-gray-900 border-gray-100 hover:border-emerald-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <CreditCard className={`w-5 h-5 ${activeTab === 'payments' ? 'text-white' : 'text-emerald-600'}`} />
              {pendingPayments.length > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full animate-pulse">
                  {pendingPayments.length}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm">Paiements</h3>
              <p className={`text-[11px] ${activeTab === 'payments' ? 'text-emerald-200' : 'text-gray-500'}`}>En attente</p>
            </div>
          </button>

          <button
            onClick={() => changeTab('proposals')}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
              activeTab === 'proposals'
                ? 'bg-blue-900 text-white border-blue-900 shadow-md ring-2 ring-blue-600'
                : 'bg-white text-gray-900 border-gray-100 hover:border-blue-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <Lightbulb className={`w-5 h-5 ${activeTab === 'proposals' ? 'text-white' : 'text-blue-600'}`} />
              {proposals.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-black rounded-full">
                  {proposals.length}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm">Idées / Demandes</h3>
              <p className={`text-[11px] ${activeTab === 'proposals' ? 'text-blue-200' : 'text-gray-500'}`}>Propositions</p>
            </div>
          </button>

          <button
            onClick={() => changeTab('students')}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
              activeTab === 'students'
                ? 'bg-purple-900 text-white border-purple-900 shadow-md ring-2 ring-purple-600'
                : 'bg-white text-gray-900 border-gray-100 hover:border-purple-200 shadow-sm'
            }`}
          >
            <Users className={`w-5 h-5 ${activeTab === 'students' ? 'text-white' : 'text-purple-600'}`} />
            <div>
              <h3 className="font-bold text-sm">Apprenants</h3>
              <p className={`text-[11px] ${activeTab === 'students' ? 'text-purple-200' : 'text-gray-500'}`}>Suivi & accès</p>
            </div>
          </button>

          <button
            onClick={() => changeTab('commerciaux')}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
              activeTab === 'commerciaux'
                ? 'bg-amber-900 text-white border-amber-900 shadow-md ring-2 ring-amber-600'
                : 'bg-white text-gray-900 border-gray-100 hover:border-amber-200 shadow-sm'
            }`}
          >
            <Gift className={`w-5 h-5 ${activeTab === 'commerciaux' ? 'text-white' : 'text-amber-500'}`} />
            <div>
              <h3 className="font-bold text-sm">Commerciaux & Promo</h3>
              <p className={`text-[11px] ${activeTab === 'commerciaux' ? 'text-amber-200' : 'text-gray-500'}`}>Codes de réduction</p>
            </div>
          </button>

          <button
            onClick={() => changeTab('messages')}
            className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 col-span-2 sm:col-span-1 ${
              activeTab === 'messages'
                ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                : 'bg-white text-gray-900 border-gray-100 hover:border-gray-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <MessageSquare className={`w-5 h-5 ${activeTab === 'messages' ? 'text-white' : 'text-indigo-600'}`} />
              {unreadMessagesCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm">Messages</h3>
              <p className={`text-[11px] ${activeTab === 'messages' ? 'text-gray-300' : 'text-gray-500'}`}>
                {unreadMessagesCount > 0 ? `${unreadMessagesCount} non lu(s)` : 'Messagerie'}
              </p>
            </div>
          </button>
        </div>

        {/* Tab Content Section */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  Paiements en attente de validation ({pendingPayments.length})
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Vérifiez les preuves de transactions des clients</p>
              </div>

              <button
                onClick={fetchPendingPayments}
                className="p-2 hover:bg-gray-100 text-gray-500 rounded-xl transition-colors"
                title="Rafraîchir"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {loadingPayments ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : pendingPayments.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-200 rounded-3xl">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="font-bold text-gray-900 text-base mb-1">Aucun paiement en attente</h3>
                <p className="text-xs text-gray-500">Tous les paiements ont été validés ou traités.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingPayments.map((p) => (
                  <div key={p.id} className="p-5 bg-gray-50/50 border border-gray-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900 text-base">{p.participant_name}</span>
                        <VerifiedBadge size="sm" />
                        <span className="text-xs text-gray-400">• {p.participant_email}</span>
                      </div>
                      <p className="text-xs font-bold text-indigo-600 mb-1">{p.courses?.title || 'Formation'}</p>
                      <p className="text-xs text-gray-500">
                        Transaction ID : <span className="font-mono text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">{p.transaction_id || 'N/A'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => updatePaymentStatus(p.id, 'rejected')}
                        className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        <X className="w-4 h-4" /> Rejeter
                      </button>
                      <button
                        onClick={() => updatePaymentStatus(p.id, 'approved')}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-4 h-4" /> Valider l'accès
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'proposals' && (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-blue-600" />
                  Idées & Demandes sur-mesure ({proposals.length})
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Demandes de formations personnalisées soumises par les clients</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setProposalFilter('pending')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-full ${proposalFilter === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  En attente
                </button>
                <button
                  onClick={() => setProposalFilter('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-full ${proposalFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  Toutes
                </button>
              </div>
            </div>

            {loadingProposals ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : proposals.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-200 rounded-3xl">
                <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-gray-900 text-base mb-1">Aucune demande trouvée</h3>
                <p className="text-xs text-gray-500">Aucune proposition de cours pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {proposals.map((prop) => (
                  <div key={prop.id} className="p-5 bg-gray-50/50 border border-gray-100 rounded-2xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                      <div>
                        <span className="font-bold text-gray-900 text-base">
                          {prop.client_profiles?.first_name} {prop.client_profiles?.last_name}
                        </span>
                        {prop.client_profiles?.phone && (
                          <span className="text-xs text-gray-500 ml-2">({prop.client_profiles.phone})</span>
                        )}
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full ${
                        prop.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        prop.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {prop.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-indigo-700 text-sm mb-1">{prop.custom_title}</h4>
                      <p className="text-xs text-gray-600 whitespace-pre-line bg-white p-3 rounded-xl border border-gray-100">
                        {prop.custom_description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs font-bold text-gray-900">
                        Prix proposé : {prop.proposed_price ? `${prop.proposed_price.toLocaleString('fr-FR')} FCFA` : 'Non précisé'}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateProposal(prop.id, 'rejected', 'Proposition déclinée.')}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                        >
                          Refuser
                        </button>
                        <button
                          onClick={() => handleUpdateProposal(prop.id, 'approved', 'Proposition acceptée.')}
                          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                        >
                          Accepter
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'students' && (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    Espace Apprenants ({filteredStudents.length})
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">Suivi de la progression des cours et notes des quiz</p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, email..."
                    value={studentsSearch}
                    onChange={e => setStudentsSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* Filters Toolbar */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mr-1">
                  <Filter className="w-3.5 h-3.5 text-purple-600" />
                  <span>Filtres :</span>
                </div>

                {/* Course Filter */}
                <select
                  value={studentsCourseFilter}
                  onChange={e => setStudentsCourseFilter(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none max-w-[220px]"
                >
                  <option value="all">Toutes les formations</option>
                  {availableCoursesOptions.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>

                {/* Progress Filter */}
                <select
                  value={studentsProgressFilter}
                  onChange={e => setStudentsProgressFilter(e.target.value as any)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="all">Toute progression</option>
                  <option value="not_started">Non commencé (0%)</option>
                  <option value="in_progress">En cours (1-99%)</option>
                  <option value="completed">Terminé (100%)</option>
                </select>

                {/* Status Filter */}
                <select
                  value={studentsStatusFilter}
                  onChange={e => setStudentsStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="all">Tous les statuts d'accès</option>
                  <option value="active">Actif (Validé)</option>
                  <option value="pending">En attente</option>
                  <option value="rejected">Bloqué / Rejeté</option>
                </select>

                {(studentsCourseFilter !== 'all' || studentsProgressFilter !== 'all' || studentsStatusFilter !== 'all' || studentsSearch !== '') && (
                  <button
                    onClick={() => {
                      setStudentsCourseFilter('all');
                      setStudentsProgressFilter('all');
                      setStudentsStatusFilter('all');
                      setStudentsSearch('');
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 underline"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>

            {loadingStudents ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-200 rounded-3xl">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-gray-900 text-base mb-1">Aucun apprenant trouvé</h3>
                <p className="text-xs text-gray-500">Aucune inscription ne correspond aux filtres appliqués.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredStudents.map((student) => {
                  const isExpanded = expandedStudentId === student.id;

                  return (
                    <div key={student.id} className="py-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900 text-sm">{student.participant_name}</span>
                            <VerifiedBadge size="xs" />
                            <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full ${
                              student.payment_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {student.payment_status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{student.participant_email} • {student.participant_phone}</p>
                          <p className="text-xs font-bold text-purple-700 mt-0.5">{student.course_title}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {student.participant_phone && (
                            <a
                              href={getWhatsAppLink(student.participant_phone, student.participant_name, student.course_title)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors"
                              title="Contacter sur WhatsApp"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}

                          <button
                            onClick={() => {
                              setEditingPromoStudent(student);
                              setPromoCodeInput(student.promo_code || '');
                            }}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                            title="Attribuer un code promo"
                          >
                            <Tag className="w-3.5 h-3.5" />
                            <span>{student.promo_code ? student.promo_code : 'Code Promo'}</span>
                          </button>

                          <button
                            onClick={() => handleToggleStudentAccess(student, student.payment_status === 'approved' ? 'rejected' : 'approved')}
                            className={`p-2 rounded-xl transition-colors ${student.payment_status === 'approved' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                            title={student.payment_status === 'approved' ? 'Bloquer l\'accès' : 'Activer l\'accès'}
                          >
                            {student.payment_status === 'approved' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => handleDeleteStudent(student)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Supprimer la fiche"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar & Accordion Toggle */}
                      <div className="bg-gray-50 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 flex-1 pr-2">
                          <span className="font-bold text-gray-700 shrink-0">Progression :</span>
                          <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden max-w-xs">
                            <div className="bg-purple-600 h-full transition-all" style={{ width: `${student.completion_rate}%` }}></div>
                          </div>
                          <span className="font-bold text-gray-900 shrink-0">{student.completion_rate}%</span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {student.average_quiz_score !== null && (
                            <div className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg">
                              <Award className="w-3.5 h-3.5" />
                              <span>Moyenne Quiz : {student.average_quiz_score}%</span>
                            </div>
                          )}

                          {/* Accordion Toggle Button */}
                          <button
                            onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                            className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                            title="Voir le détail des quiz par module"
                          >
                            <span>{isExpanded ? 'Masquer le détail' : 'Détail des Quiz par module'}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Accordion Drawer for Quiz Scores */}
                      {isExpanded && (
                        <div className="bg-purple-50/40 border border-purple-100 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between border-b border-purple-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-purple-600" />
                              <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                                Scores et résultats aux Quiz par module ({student.course_title})
                              </h4>
                            </div>
                            <span className="text-[11px] text-purple-700 font-bold bg-purple-100/60 px-2.5 py-0.5 rounded-full">
                              {student.completed_count} / {student.total_modules} module(s) validé(s)
                            </span>
                          </div>

                          {(!student.modulesDetail || student.modulesDetail.length === 0) ? (
                            <p className="text-xs text-gray-400 italic py-2">Aucun module configuré pour cette formation.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                              {student.modulesDetail.map((m: any, idx: number) => (
                                <div 
                                  key={m.id} 
                                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                                    m.isCompleted 
                                      ? 'bg-white border-purple-200 shadow-xs' 
                                      : 'bg-white/70 border-gray-200 opacity-75'
                                  }`}
                                >
                                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                    <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                      m.isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                                    }`}>
                                      {m.isCompleted ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-gray-900 truncate">
                                        Module {idx + 1} : {m.title}
                                      </p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-[10px] font-medium ${m.isCompleted ? 'text-emerald-600' : 'text-gray-400'}`}>
                                          {m.isCompleted 
                                            ? (m.completedAt ? `Validé le ${new Date(m.completedAt).toLocaleDateString('fr-FR')}` : 'Complété')
                                            : 'Non commencé'
                                          }
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="shrink-0 text-right">
                                    {m.hasQuiz ? (
                                      m.score !== null && m.score !== undefined ? (
                                        <div className={`px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 shadow-xs ${
                                          m.score >= 70 
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                            : 'bg-red-50 text-red-700 border border-red-200'
                                        }`}>
                                          <Award className="w-3.5 h-3.5" />
                                          <span>{m.score}%</span>
                                        </div>
                                      ) : m.isCompleted ? (
                                        <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                          Quiz réussi (Note N/A)
                                        </span>
                                      ) : (
                                        <span className="px-2 py-1 rounded-lg text-[10px] font-medium bg-gray-100 text-gray-500">
                                          Quiz non effectué
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-[10px] text-gray-400 italic">Sans quiz</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'commerciaux' && (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-amber-500" />
                  Commerciaux & Codes Promo
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Suivi des codes de réduction attribués aux commerciaux et apprenants</p>
              </div>
            </div>

            <div className="space-y-4">
              {studentsData.filter(s => s.promo_code).length === 0 ? (
                <div className="text-center py-10 border border-dashed border-gray-200 rounded-3xl">
                  <Tag className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Aucun code promo attribué pour le moment.</p>
                  <p className="text-[11px] text-gray-400 mt-1">Allez dans l'onglet "Apprenants" pour en attribuer un.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {studentsData.filter(s => s.promo_code).map(student => (
                    <div key={student.id} className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black uppercase text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg">
                          {student.promo_code}
                        </span>
                        <div className="flex items-center gap-1.5 mt-2">
                          <h4 className="font-bold text-gray-900 text-sm">{student.participant_name}</h4>
                          <VerifiedBadge size="xs" />
                        </div>
                        <p className="text-xs text-gray-500">{student.participant_email}</p>
                      </div>

                      <button
                        onClick={() => {
                          setEditingPromoStudent(student);
                          setPromoCodeInput(student.promo_code);
                        }}
                        className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors"
                      >
                        Modifier
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Modal attribution code promo */}
      {editingPromoStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-gray-900 mb-1">Code Promo Commercial</h3>
            <p className="text-xs text-gray-500 mb-4">Attribuer un code à {editingPromoStudent.participant_name}</p>

            <input
              type="text"
              value={promoCodeInput}
              onChange={e => setPromoCodeInput(e.target.value.toUpperCase())}
              placeholder="Ex: COMMERCIAL10"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold uppercase focus:ring-2 focus:ring-amber-500 outline-none mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingPromoStudent(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl"
              >
                Annuler
              </button>
              <button
                onClick={handleAssignPromoCode}
                disabled={savingPromo}
                className="px-5 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center gap-1"
              >
                {savingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
