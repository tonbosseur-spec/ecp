import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Copy, CheckCircle2, Store, Users, ExternalLink, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminHub() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch courses and their registrations
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          registrations (
            id,
            client_id,
            participant_name,
            participant_email,
            participant_phone,
            client_profiles (
              id,
              first_name,
              last_name,
              phone
            )
          )
        `)
        .order('date_time', { ascending: false });

      if (error) throw error;
      
      setCourses(data || []);
    } catch (err) {
      console.error('Erreur chargement Hub Admin:', err);
    } finally {
      setLoading(false);
    }
  };

  const marketplaceUrl = `${window.location.origin}/client/marketplace`;

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

        {/* Share Section */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm mb-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6">
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

        {/* Courses Section */}
        {courses.length === 0 ? (
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
