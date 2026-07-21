import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Copy, CheckCircle2, Store, Users, ExternalLink, Calendar, CreditCard, Clock, MessageCircle, Check, X, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminHub() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'formations' | 'paiements'>('formations');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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
        {activeTab === 'paiements' ? (
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
    </div>
  );
}
