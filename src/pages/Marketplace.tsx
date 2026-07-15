import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Calendar, User, ArrowRight, BookOpen, Banknote, Users } from 'lucide-react';

export default function Marketplace() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        let userCourseIds: string[] = [];
        
        if (session) {
          const userId = session.user.id;
          const { data: regData } = await supabase
            .from('registrations')
            .select('course_id')
            .eq('client_id', userId);
            
          if (regData) {
            userCourseIds = regData.map(r => r.course_id);
          }
        }

        const { data: coursesData, error } = await supabase
          .from('courses')
          .select('*, trainers(name, photo_url)')
          .eq('is_active', true)
          .order('date_time', { ascending: true });

        if (error) throw error;
        
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-900 text-white rounded-lg flex items-center justify-center font-bold text-lg">
                e
              </div>
              <span className="font-bold text-xl text-gray-900 tracking-tight">ecpmanager</span>
            </div>
            <Link 
              to="/client/hub"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Mon Espace
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Catalogue des Formations
          </h1>
          <p className="text-gray-500 text-lg">
            Découvrez nos prochaines sessions et développez vos compétences avec nos experts.
          </p>
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
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => {
              const courseDate = new Date(course.date_time);
              const formattedPrice = new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'XOF',
                maximumFractionDigits: 0
              }).format(course.price_fcfa);
              
              return (
                <div key={course.id} className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full group">
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
                    
                    {course.max_seats && (
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
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight group-hover:text-blue-600 transition-colors">
                      {course.title}
                    </h3>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-3 text-gray-600 text-sm">
                        <Calendar className="w-4 h-4 text-gray-400" />
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
                      <div className="flex items-center gap-3 text-gray-600 text-sm">
                        <Banknote className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold text-gray-900">{formattedPrice}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-6 py-5 border-t border-gray-50 bg-gray-50/50 flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-3">
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
                        <p className="font-medium text-gray-900 truncate max-w-[120px]">{course.trainers?.name}</p>
                      </div>
                    </div>
                    
                    <Link 
                      to={`/course/${course.id}`}
                      className="inline-flex items-center justify-center px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors shadow-sm group-hover:bg-blue-600"
                    >
                      <span>Découvrir</span>
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
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
