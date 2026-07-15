import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Calendar, Video, FileText, MessageCircle, ArrowRight, LogOut, BookOpen } from 'lucide-react';

export default function ClientHub() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/client/login');
          return;
        }

        const userId = session.user.id;

        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('client_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error("Erreur profil:", profileError);
        }
        
        if (profileData) {
          setProfile(profileData);
        } else {
          // Fallback to user metadata
          setProfile({
            first_name: session.user.user_metadata?.first_name || 'Client',
            last_name: session.user.user_metadata?.last_name || ''
          });
        }

        // Fetch registrations with courses
        const { data: regData, error: regError } = await supabase
          .from('registrations')
          .select('*, courses(*)')
          .eq('client_id', userId)
          .order('registered_at', { ascending: false });

        if (regError) throw regError;

        if (regData) {
          // Filter out registrations where course is null (just in case)
          setRegistrations(regData.filter(r => r.courses));
        }
      } catch (err) {
        console.error("Erreur chargement hub:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/client/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const firstName = profile?.first_name || 'Client';

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-900 text-white rounded-lg flex items-center justify-center font-bold text-lg">
                e
              </div>
              <span className="font-bold text-xl text-gray-900 tracking-tight">ecpmanager</span>
            </div>
            <div className="flex items-center gap-6">
              <Link
                to="/client/marketplace"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Catalogue
              </Link>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-2">
            Bonjour, {firstName} 👋
          </h1>
          <p className="text-gray-500 text-lg">
            Bienvenue dans votre espace personnel. Voici vos formations en cours.
          </p>
        </div>

        {/* Courses Grid */}
        {registrations.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Aucune formation</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Vous n'êtes inscrit à aucune formation pour le moment. Explorez notre catalogue pour trouver celle qui vous convient.
            </p>
            <Link 
              to="/client/marketplace" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-sm"
            >
              Voir le catalogue
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {registrations.map((reg) => {
              const course = reg.courses;
              const courseDate = new Date(course.date_time);
              
              return (
                <div key={reg.id} className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                  <div className="p-6 flex-grow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                        Accès actif
                      </div>
                      {course.initials && (
                        <span className="text-sm font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                          {course.initials}
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight">
                      {course.title}
                    </h3>
                    
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-6">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {courseDate.toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })} à {courseDate.toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-6 pt-0 mt-auto space-y-3 border-t border-gray-50 bg-gray-50/50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pt-4">Ressources & Accès</p>
                    
                    {course.whatsapp_link && (
                      <a 
                        href={course.whatsapp_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-medium transition-colors text-sm shadow-sm"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Groupe WhatsApp
                      </a>
                    )}
                    
                    {course.google_meet_link && (
                      <a 
                        href={course.google_meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors text-sm shadow-sm"
                      >
                        <Video className="w-4 h-4" />
                        Rejoindre le Meet
                      </a>
                    )}
                    
                    {course.guide_url && (
                      <a 
                        href={course.guide_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors text-sm shadow-sm"
                      >
                        <FileText className="w-4 h-4" />
                        Télécharger le guide
                      </a>
                    )}
                    
                    {!course.whatsapp_link && !course.google_meet_link && !course.guide_url && (
                      <div className="text-center py-2 text-sm text-gray-400 italic">
                        Aucune ressource disponible
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
