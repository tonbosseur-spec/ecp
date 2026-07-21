import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Copy, CheckCircle2, Store, Users, ExternalLink, Calendar, CreditCard, Clock, MessageCircle, Check, X, RefreshCw, Link as LinkIcon, MessageSquare, Edit2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { parseCourseQuizSettings, encodeCourseQuizSettings } from '../lib/quizUtils';

export default function AdminHub() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'formations' | 'paiements' | 'quizz'>('formations');
  const [quizLeads, setQuizLeads] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal Quiz Settings State
  const [editingQuizCourse, setEditingQuizCourse] = useState<any | null>(null);
  const [customQuizTitle, setCustomQuizTitle] = useState('');
  const [customQuizDescription, setCustomQuizDescription] = useState('');
  const [savingQuizSettings, setSavingQuizSettings] = useState(false);

  const openQuizSettingsModal = (course: any) => {
    setEditingQuizCourse(course);
    const settings = parseCourseQuizSettings(course.guide_text);
    setCustomQuizTitle(settings.quizTitle || '');
    setCustomQuizDescription(settings.quizDescription || '');
  };

  const handleSaveQuizSettings = async () => {
    if (!editingQuizCourse) return;
    setSavingQuizSettings(true);
    try {
      const updatedGuideText = encodeCourseQuizSettings(editingQuizCourse.guide_text, {
        quizTitle: customQuizTitle.trim() || null,
        quizDescription: customQuizDescription.trim() || null
      });

      const { error } = await supabase
        .from('courses')
        .update({ guide_text: updatedGuideText })
        .eq('id', editingQuizCourse.id);

      if (error) throw error;

      setCourses(prev => prev.map(c => c.id === editingQuizCourse.id ? { ...c, guide_text: updatedGuideText } : c));
      setEditingQuizCourse(null);
    } catch (err: any) {
      alert("Erreur lors de la sauvegarde : " + err.message);
    } finally {
      setSavingQuizSettings(false);
    }
  };


  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch courses and their registrations
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          *,
          registrations (
            *,
            client_profiles (*)
          )
        `)
        .order('date_time', { ascending: false });

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Fetch pending payments
      const { data: leadsData, error: leadsError } = await supabase
        .from('course_proposals')
        .select('*, client_profiles(first_name, last_name), courses(title)')
        .eq('status', 'quiz_lead')
        .order('created_at', { ascending: false });

      if (leadsData) setQuizLeads(leadsData);

      const { data: payData, error: payError } = await supabase
        .from('payments')
        .select('*, registrations(participant_name, participant_email, courses(title))')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (payError) throw payError;
      setPendingPayments(payData || []);
    } catch (err) {
      console.error('Erreur chargement Hub Admin:', err);
    } finally {
      setLoading(false);
    }
  };

  const marketplaceUrl = `${window.location.origin}/client/marketplace`;

  
  const copyQuizLink = (courseId: string) => {
    const url = window.location.origin + '/challenge/' + courseId;
    navigator.clipboard.writeText(url);
    alert('Lien du challenge copié : ' + url);
  };

  const handleApprovePayment = async (paymentId: string, registrationId: string) => {
    try {
      setActionLoading(paymentId);
      
      // Update payment status
      const { error: payError } = await supabase
        .from('payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', paymentId);

      if (payError) throw payError;

      // Also update registration status to 'approved' if it was pending
      const { error: regError } = await supabase
        .from('registrations')
        .update({ payment_status: 'approved' })
        .eq('id', registrationId);

      if (regError) throw regError;

      await fetchData();
    } catch (err) {
      console.error('Erreur approbation:', err);
      alert('Erreur lors de la validation du paiement');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    if (!window.confirm('Voulez-vous vraiment rejeter ce paiement ?')) return;
    try {
      setActionLoading(paymentId);
      const { error } = await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', paymentId);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Erreur rejet:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(marketplaceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur copie:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const activeCourses = courses.filter(c => c.is_active);
  const inactiveCourses = courses.filter(c => !c.is_active);

  const renderCourseList = (courseList: any[], title: string) => {
    if (courseList.length === 0) return null;
    
    return (
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4 px-2">{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {courseList.map((course, index) => (
            <div key={`${course.id}-${index}`} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-gray-900 text-lg mb-1">{course.title}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {course.is_date_tbd || !course.date_time ? (
                      "Date à déterminer"
                    ) : (
                      new Date(course.date_time).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 px-3 py-1 rounded-full text-xs font-semibold text-gray-600 border border-gray-200 shrink-0 whitespace-nowrap">
                  {course.registrations?.length || 0} client{(course.registrations?.length || 0) > 1 ? 's' : ''}
                </div>
              </div>
              
              {course.registrations && course.registrations.length > 0 ? (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Clients inscrits
                  </h5>
                  <div className="space-y-2">
                    {course.registrations.map((reg: any, index: number) => {
                      // Prefer profile data if available (since they registered as client)
                      const clientName = reg.client_profiles 
                        ? `${reg.client_profiles.first_name || ''} ${reg.client_profiles.last_name || ''}`.trim()
                        : reg.participant_name;
                        
                      const clientPhone = reg.client_profiles?.phone || reg.participant_phone;
                      
                      return (
                        <div key={`${reg.id}-${index}`} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl text-sm">
                          <div>
                            <p className="font-medium text-gray-900">{clientName || 'Client inconnu'}</p>
                            <p className="text-gray-500 text-xs">{reg.participant_email}</p>
                          </div>
                          <div className="text-gray-600 text-xs font-medium">
                            {clientPhone}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-400 italic">Aucun client inscrit</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 font-sans pb-24 w-full">
      <div className="max-w-3xl md:max-w-none w-full mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Espace Hub & Marketplace</h1>
            <p className="text-sm text-gray-500">Gérez vos formations actives et vos clients</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab('formations')}
            className={`px-6 py-3 font-bold text-sm transition-all relative ${
              activeTab === 'formations' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Catalogue & Inscriptions
            {activeTab === 'formations' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>}
          </button>
          <button
            onClick={() => setActiveTab('paiements')}
            className={`px-6 py-3 font-bold text-sm transition-all relative flex items-center gap-2 ${
              activeTab === 'paiements' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Paiements à valider
            {pendingPayments.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full border border-amber-200">
                {pendingPayments.length}
              </span>
            )}
            {activeTab === 'paiements' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>}
          </button>
          <button
            onClick={() => setActiveTab('quizz')}
            className={`px-6 py-3 font-bold text-sm transition-all relative flex items-center gap-2 ${
              activeTab === 'quizz' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Leads & Quizz
            {quizLeads.length > 0 && (
              <span className="bg-purple-100 text-purple-700 py-0.5 px-2 rounded-full text-[10px] font-black">
                {quizLeads.length}
              </span>
            )}
            {activeTab === 'quizz' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>}
          </button>
        </div>


        {/* Share Section (only on formations tab) */}
        {activeTab === 'formations' && (
          <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm mb-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6 animate-fade-in">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Partager votre Marketplace</h2>
            <p className="text-sm text-gray-500 mb-4 max-w-md">
              Invitez vos clients à découvrir votre catalogue de formations et à s'inscrire directement depuis leur espace.
            </p>
            <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 overflow-hidden">
              <span className="text-sm text-gray-600 truncate flex-1 select-all">{marketplaceUrl}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full sm:w-auto">
            <button
              onClick={copyLink}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-sm"
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Lien copié !' : 'Copier le lien'}
            </button>
            <a
              href={marketplaceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Ouvrir
            </a>
          </div>
        </div>
      )}

        {/* Content Section */}
        
        {activeTab === 'quizz' ? (
          <div className="animate-fade-in space-y-8">
            {/* List of quiz links */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Liens des Challenges Publics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {courses.map(course => {
                  const settings = parseCourseQuizSettings(course.guide_text);
                  return (
                    <div key={course.id} className="p-4 border border-gray-100 rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-colors flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="overflow-hidden">
                          <span className="font-bold text-sm text-gray-800 block truncate">{course.title}</span>
                          {settings.quizTitle && (
                            <span className="text-xs text-indigo-600 font-semibold block truncate">
                              Titre Quizz: {settings.quizTitle}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button 
                            onClick={() => openQuizSettingsModal(course)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                            title="Modifier le titre et la description du quizz"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Personnaliser
                          </button>
                          <button 
                            onClick={() => copyQuizLink(course.id)}
                            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                            Copier
                          </button>
                        </div>
                      </div>
                      
                      {settings.quizDescription && (
                        <p className="text-xs text-gray-500 bg-white p-2.5 rounded-xl border border-gray-200/60 line-clamp-2">
                          <span className="font-semibold text-gray-700">Description Quizz : </span>
                          {settings.quizDescription}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* List of leads */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Répondants aux Quizz ({quizLeads.length})</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {quizLeads.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 font-medium">Aucun répondant pour le moment.</div>
                ) : (
                  quizLeads.map((lead) => (
                    <div key={lead.id} className="p-6 hover:bg-gray-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-gray-900">
                            {lead.client_profiles?.first_name} {lead.client_profiles?.last_name}
                          </span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg font-medium">
                            {new Date(lead.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-purple-600 mb-2">{lead.custom_title}</p>
                        <p className="text-sm text-gray-600 whitespace-pre-line bg-gray-50 p-3 rounded-xl border border-gray-100">
                          {lead.description}
                        </p>
                      </div>
                      
                      <div className="shrink-0 flex items-center gap-2">
                        <Link 
                          to={`/messages?client=${lead.client_id}`}
                          className="px-4 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Contacter
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'paiements' ? (

          <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-emerald-600" />
                Validations de paiements
              </h2>
              <button 
                onClick={fetchData}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {pendingPayments.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center shadow-sm">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Tout est à jour !</h3>
                <p className="text-gray-500">Aucun paiement en attente de validation.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pendingPayments.map((payment) => (
                  <div key={payment.id} className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          payment.payment_type === 'full' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {payment.payment_type === 'full' ? 'Paiement complet' : `Tranche ${payment.tranche_number}`}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Reçu le {new Date(payment.created_at).toLocaleDateString('fr-FR')} à {new Date(payment.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-900 text-lg">{payment.registrations?.courses?.title}</h4>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-sm text-gray-500 font-medium">
                        <span className="text-gray-900 font-bold">{payment.registrations?.participant_name}</span>
                        <span>{payment.registrations?.participant_email}</span>
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-4 border-t md:border-t-0 pt-4 md:pt-0">
                      <div className="text-right">
                        <p className="text-xl font-black text-gray-900">{payment.amount.toLocaleString('fr-FR')} FCFA</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Montant à valider</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRejectPayment(payment.id)}
                          disabled={actionLoading === payment.id}
                          className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Rejeter"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleApprovePayment(payment.id, payment.registration_id)}
                          disabled={actionLoading === payment.id}
                          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-sm shadow-emerald-100"
                        >
                          {actionLoading === payment.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-5 h-5" />
                              <span>Valider</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center shadow-sm">
            <p className="text-gray-500">Aucune formation trouvée.</p>
          </div>
        ) : (
          <>
            {renderCourseList(activeCourses, "Formations Actives (Marketplace)")}
            {renderCourseList(inactiveCourses, "Formations Inactives")}
          </>
        )}
      </div>

      {/* Modal Personnalisation Quizz */}
      {editingQuizCourse && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Personnaliser le Quizz Public</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{editingQuizCourse.title}</p>
              </div>
              <button 
                onClick={() => setEditingQuizCourse(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Titre affiché sur la page du quizz
                </label>
                <input
                  type="text"
                  value={customQuizTitle}
                  onChange={(e) => setCustomQuizTitle(e.target.value)}
                  placeholder={`Titre par défaut : ${editingQuizCourse.title}`}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Laissez vide pour utiliser le titre par défaut de la formation.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Description affichée sur la page du quizz
                </label>
                <textarea
                  rows={4}
                  value={customQuizDescription}
                  onChange={(e) => setCustomQuizDescription(e.target.value)}
                  placeholder="Laissez vide pour utiliser la description par défaut de la formation..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all resize-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Laissez vide pour utiliser la description de la formation.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingQuizCourse(null)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={savingQuizSettings}
                onClick={handleSaveQuizSettings}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
              >
                {savingQuizSettings ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  'Enregistrer les modifications'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
