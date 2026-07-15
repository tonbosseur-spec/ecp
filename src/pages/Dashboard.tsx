import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Calendar, Users, PlusCircle, Search, Copy, CheckCircle2, Trash2, Banknote, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Course {
  id: string;
  title: string;
  date_time: string;
  price_fcfa: number;
  product_type?: string;
  registrations: { count: number }[];
}

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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'formations' | 'payments'>('formations');
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses();
    fetchPendingPayments();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          date_time,
          price_fcfa,
          product_type,
          registrations (count)
        `)
        .order('date_time', { ascending: false });

      if (error) {
        throw error;
      }

      setCourses(data || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des formations.');
    } finally {
      setLoading(false);
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
      
      setToast(`Paiement ${status === 'approved' ? 'validé' : 'rejeté'}`);
      setTimeout(() => setToast(null), 3000);
      
      fetchPendingPayments(); // Refresh list
    } catch (err: any) {
      alert("Erreur: " + err.message);
    }
  };


  const handleDuplicate = async (courseId: string) => {
    try {
      setDuplicatingId(courseId);
      
      const { data: originalCourse, error: fetchError } = await supabase
        .from('courses')
        .select('*, course_modules(*)')
        .eq('id', courseId)
        .single();
        
      if (fetchError) throw fetchError;
      
      const { id, created_at, course_modules, registrations, ...courseDataToDuplicate } = originalCourse;
      const newCourseData = {
        ...courseDataToDuplicate,
        title: `${originalCourse.title} - Copie`
      };
      
      const { data: newCourse, error: insertError } = await supabase
        .from('courses')
        .insert([newCourseData])
        .select()
        .single();
        
      if (insertError) throw insertError;
      
      if (course_modules && course_modules.length > 0) {
        const modulesToDuplicate = course_modules.map((mod: any) => {
          const { id, created_at, course_id, ...modData } = mod;
          return {
            ...modData,
            course_id: newCourse.id
          };
        });
        
        const { error: modulesError } = await supabase
          .from('course_modules')
          .insert(modulesToDuplicate);
          
        if (modulesError) throw modulesError;
      }
      
      setToast("Formation dupliquée avec succès !");
      setTimeout(() => setToast(null), 3000);
      
      fetchCourses();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la duplication de la formation.");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async (courseId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette formation ? Cette action est irréversible.")) {
      return;
    }
    
    try {
      // Suppression manuelle des dépendances au cas où ON DELETE CASCADE ne serait pas configuré dans Supabase
      const { error: modError } = await supabase.from('course_modules').delete().eq('course_id', courseId);
      if (modError) console.error("Erreur suppression modules:", modError);
      
      const { error: regError } = await supabase.from('registrations').delete().eq('course_id', courseId);
      if (regError) console.error("Erreur suppression inscriptions:", regError);

      const { data, error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error("Impossible de supprimer la formation. Vérifiez vos permissions administrateur (RLS).");
      }
      
      setToast("Formation supprimée avec succès !");
      setTimeout(() => setToast(null), 3000);
      
      fetchCourses();
    } catch (err: any) {
      alert("Erreur lors de la suppression : " + err.message);
    }
  };

  const filteredCourses = useMemo(() => {
    const now = new Date();
    return courses.filter(course => {
      if (searchQuery && !course.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      const courseDate = new Date(course.date_time);
      if (filter === 'upcoming' && courseDate < now) return false;
      if (filter === 'past' && courseDate >= now) return false;
      
      return true;
    });
  }, [courses, searchQuery, filter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Chargement de vos formations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 m-4 bg-red-50 border border-red-100 rounded-xl">
        <p className="text-sm text-red-600">{error}</p>
        <button 
          onClick={fetchCourses}
          className="mt-3 text-sm font-medium text-red-700 hover:text-red-800"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-md mx-auto pb-24 relative">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-top-4 fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Catalogue & Paiements</h1>
        <p className="text-sm text-gray-500 mt-1">Gérez vos produits et validez les achats</p>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('formations')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'formations' 
              ? 'border-gray-900 text-gray-900' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Catalogue
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors relative ${
            activeTab === 'payments' 
              ? 'border-gray-900 text-gray-900' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Paiements en attente
          {pendingPayments.length > 0 && (
            <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-red-500"></span>
          )}
        </button>
      </div>

      {activeTab === 'formations' && (
        <>
          <div className="mb-6 space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 transition-shadow text-sm"
            placeholder="Rechercher une formation..."
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Tout
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${filter === 'upcoming' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            À venir
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${filter === 'past' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Passées
          </button>
        </div>
      </div>

      {filteredCourses.length === 0 ? (
        <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-8 text-center flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Aucune formation trouvée</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-[200px]">
            {courses.length === 0 ? "Vous n'avez pas encore créé de formation. Lancez-vous !" : "Aucune formation ne correspond à vos critères."}
          </p>
          {courses.length === 0 && (
            <Link
              to="/courses/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Créer ma première formation
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCourses.map((course) => {
            const date = new Date(course.date_time);
            const formattedDate = new Intl.DateTimeFormat('fr-FR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }).format(date);
            
            const registrationCount = course.registrations?.[0]?.count || 0;

            return (
              <div key={course.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gray-900"></div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{course.title}</h3>
                
                <div className="flex flex-col gap-2.5 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{formattedDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span>{registrationCount} inscrit{registrationCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {course.price_fcfa.toLocaleString('fr-FR')} FCFA
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(course.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Supprimer la formation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(course.id)}
                      disabled={duplicatingId === course.id}
                      className="p-2 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-50"
                      title="Dupliquer la formation"
                    >
                      {duplicatingId === course.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-900" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <Link
                      to={`/courses/${course.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors"
                    >
                      Gérer
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-4">
          {loadingPayments ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
              <p className="text-sm text-gray-500">Chargement des paiements...</p>
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-8 text-center flex flex-col items-center">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Tout est à jour</h3>
              <p className="text-sm text-gray-500">Aucun paiement en attente de validation.</p>
            </div>
          ) : (
            pendingPayments.map(payment => (
              <div key={payment.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{payment.participant_name}</h3>
                    <p className="text-sm text-gray-500">{payment.participant_email}</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    En attente
                  </span>
                </div>
                
                <div className="space-y-2 mb-4 bg-gray-50 p-3 rounded-xl text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Produit:</span>
                    <span className="font-medium text-gray-900 text-right">{payment.courses?.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type:</span>
                    <span className="font-medium text-gray-900 capitalize">{payment.courses?.product_type || 'Formation'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">ID Transaction:</span>
                    <span className="font-medium font-mono text-gray-900">{payment.transaction_id || 'Non fourni'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(payment.registered_at).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => updatePaymentStatus(payment.id, 'approved')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-50 text-green-700 rounded-xl font-medium hover:bg-green-100 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Valider
                  </button>
                  <button
                    onClick={() => updatePaymentStatus(payment.id, 'rejected')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 text-red-700 rounded-xl font-medium hover:bg-red-100 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Rejeter
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
