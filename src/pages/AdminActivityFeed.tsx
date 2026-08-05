import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Activity, Users, CreditCard, BookOpen, Clock, ArrowRight, ArrowLeft, 
  Loader2, Calendar, MessageSquare, TrendingUp, Search, Filter, 
  CheckCircle2, Video, HelpCircle 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminActivityFeed() {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('30days');
  
  // KPIs
  const [stats, setStats] = useState({
    newClients: 0,
    newRegistrations: 0,
    newPayments: 0,
    courseQuizzes: 0,
    publicQuizzes: 0,
    newSessions: 0
  });

  useEffect(() => {
    fetchActivity();
  }, [dateFilter]);

  const fetchActivity = async () => {
    setLoading(true);
    try {
      let since: string | null = null;
      
      if (dateFilter !== 'all') {
        const d = new Date();
        if (dateFilter === 'today') {
          d.setHours(0, 0, 0, 0);
        } else if (dateFilter === '7days') {
          d.setDate(d.getDate() - 7);
        } else if (dateFilter === '30days') {
          d.setDate(d.getDate() - 30);
        }
        since = d.toISOString();
      }

      const mixed: any[] = [];
      let clientCount = 0;
      let regCount = 0;
      let payCount = 0;
      let courseQuizCount = 0;
      let publicQuizCount = 0;
      let sessCount = 0;

      const sinceTime = since ? new Date(since).getTime() : 0;

      const isAfterSince = (dateStr?: string) => {
        if (!sinceTime) return true;
        if (!dateStr) return false;
        return new Date(dateStr).getTime() >= sinceTime;
      };

      // Pre-fetch lookup maps
      const profilesMap = new Map<string, any>();
      try {
        const { data: profiles, error } = await supabase.from('client_profiles').select('*');
        if (error) console.warn('Error fetching client_profiles:', error);
        if (profiles) {
          profiles.forEach(p => {
            profilesMap.set(p.id, p);
            if (isAfterSince(p.created_at)) {
              clientCount++;
              const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Nouveau client';
              mixed.push({
                id: `client-${p.id}`,
                type: 'client',
                title: 'Nouveau client inscrit',
                description: `${name} a créé son compte sur la plateforme.`,
                date: p.created_at || new Date().toISOString(),
                icon: <Users className="w-5 h-5 text-indigo-600" />,
                bgColor: 'bg-indigo-100',
                link: '/admin/clients'
              });
            }
          });
        }
      } catch (e) {
        console.warn('client_profiles query exception:', e);
      }

      const coursesMap = new Map<string, string>();
      const modulesMap = new Map<string, { title: string; course_id: string }>();
      try {
        const { data: coursesData } = await supabase.from('courses').select('id, title');
        coursesData?.forEach(c => coursesMap.set(c.id, c.title));

        const { data: modsData } = await supabase.from('course_modules').select('id, title, course_id');
        modsData?.forEach(m => modulesMap.set(m.id, { title: m.title, course_id: m.course_id }));
      } catch (e) {
        console.warn('courses/modules lookup exception:', e);
      }

      // 2. Registrations
      try {
        const { data: registrations, error } = await supabase
          .from('registrations')
          .select('*, courses(title)')
          .order('registered_at', { ascending: false });

        if (error) {
          console.warn('Error fetching registrations:', error);
        } else if (registrations) {
          registrations.forEach(r => {
            const dateVal = r.registered_at || r.created_at;
            if (isAfterSince(dateVal)) {
              regCount++;
              const clientName = r.participant_name || r.participant_email || 'Un étudiant';
              const courseTitle = r.courses?.title || coursesMap.get(r.course_id) || 'une formation';
              const statusText = r.payment_status === 'completed' ? 'Paiement effectué' : r.payment_status === 'pending' ? 'Paiement en attente' : (r.payment_status || 'Inscrit');

              mixed.push({
                id: `reg-${r.id}`,
                type: 'registration',
                title: 'Inscription à une formation',
                description: `${clientName} s'est inscrit(e) à "${courseTitle}" (Statut: ${statusText}).`,
                date: dateVal || new Date().toISOString(),
                icon: <BookOpen className="w-5 h-5 text-emerald-600" />,
                bgColor: 'bg-emerald-100',
                link: '/admin/hub'
              });
            }
          });
        }
      } catch (e) {
        console.warn('registrations exception:', e);
      }

      // 3. Payments
      try {
        const { data: payments, error } = await supabase
          .from('payments')
          .select('*, registrations(participant_name, participant_email, courses(title))')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Error fetching payments:', error);
        } else if (payments) {
          payments.forEach(p => {
            const dateVal = p.paid_at || p.created_at;
            if (isAfterSince(dateVal)) {
              payCount++;
              const reg = p.registrations as any;
              const clientName = reg?.participant_name || reg?.participant_email || 'Un client';
              const courseTitle = reg?.courses?.title || 'la formation';
              const formattedAmount = p.amount ? `${Number(p.amount).toLocaleString('fr-FR')} FCFA` : '';
              const isPaid = p.status === 'paid' || p.status === 'completed';

              mixed.push({
                id: `pay-${p.id}`,
                type: 'payment',
                title: isPaid ? 'Paiement validé' : 'Paiement enregistré',
                description: `Paiement ${formattedAmount ? `de ${formattedAmount} ` : ''}par ${clientName} pour "${courseTitle}" (Statut: ${p.status || 'en attente'}).`,
                date: dateVal || new Date().toISOString(),
                icon: <CreditCard className="w-5 h-5 text-amber-600" />,
                bgColor: 'bg-amber-100',
                link: '/admin/hub'
              });
            }
          });
        }
      } catch (e) {
        console.warn('payments exception:', e);
      }

      // 4. Course Quizzes (module_progress)
      try {
        const { data: progressData, error } = await supabase
          .from('module_progress')
          .select('*');

        if (error) {
          console.warn('Error fetching module_progress:', error);
        } else if (progressData) {
          progressData.forEach(mp => {
            const dateVal = mp.completed_at || mp.created_at || mp.updated_at;
            if (mp.score !== null && mp.score !== undefined && isAfterSince(dateVal)) {
              courseQuizCount++;
              const profile = mp.client_id ? profilesMap.get(mp.client_id) : null;
              const clientName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email : 'Un étudiant';
              const modInfo = mp.module_id ? modulesMap.get(mp.module_id) : null;
              const moduleTitle = modInfo?.title || 'un module';
              const courseTitle = modInfo?.course_id ? coursesMap.get(modInfo.course_id) : null;

              mixed.push({
                id: `course-quiz-${mp.id}`,
                type: 'course_quiz',
                title: 'Quiz de cours validé',
                description: `${clientName} a validé le quiz du module "${moduleTitle}"${courseTitle ? ` (${courseTitle})` : ''} avec un score de ${mp.score}%.`,
                date: dateVal || new Date().toISOString(),
                icon: <CheckCircle2 className="w-5 h-5 text-purple-600" />,
                bgColor: 'bg-purple-100',
                link: '/admin/courses'
              });
            }
          });
        }
      } catch (e) {
        console.warn('module_progress exception:', e);
      }

      // 5. Public Quiz Results (quiz_results)
      try {
        const { data: quizResults, error } = await supabase
          .from('quiz_results')
          .select('*, courses(title)')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Error fetching quiz_results:', error);
        } else if (quizResults) {
          quizResults.forEach(qr => {
            if (isAfterSince(qr.created_at)) {
              publicQuizCount++;
              const participant = qr.participant_name || qr.client_email || qr.participant_email || 'Un visiteur';
              const courseTitle = qr.courses?.title || (qr.course_id ? coursesMap.get(qr.course_id) : null);
              mixed.push({
                id: `quiz-res-${qr.id}`,
                type: 'public_quiz',
                title: 'Quiz public validé',
                description: `${participant} a terminé un quiz public${courseTitle ? ` (${courseTitle})` : ''} avec un score de ${qr.score}/${qr.max_score || 100}.`,
                date: qr.created_at || new Date().toISOString(),
                icon: <Activity className="w-5 h-5 text-blue-600" />,
                bgColor: 'bg-blue-100',
                link: '/admin/hub'
              });
            }
          });
        }
      } catch (e) {
        console.warn('quiz_results exception:', e);
      }

      // 6. Public Quiz Leads (quiz_leads table & course_proposals)
      try {
        const { data: quizLeads, error } = await supabase
          .from('quiz_leads')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && quizLeads) {
          quizLeads.forEach(ql => {
            if (isAfterSince(ql.created_at)) {
              const name = `${ql.first_name || ''} ${ql.last_name || ''}`.trim() || ql.email || 'Nouveau prospect';
              mixed.push({
                id: `quiz-lead-${ql.id}`,
                type: 'public_quiz',
                title: 'Prospect Quiz Public',
                description: `${name} a complété le quiz d'évaluation lead magnet.`,
                date: ql.created_at || new Date().toISOString(),
                icon: <MessageSquare className="w-5 h-5 text-teal-600" />,
                bgColor: 'bg-teal-100',
                link: '/admin/hub'
              });
            }
          });
        }
      } catch (e) {
        console.warn('quiz_leads exception:', e);
      }

      // 7. Live Sessions
      try {
        const { data: lives, error } = await supabase
          .from('live_sessions')
          .select('*, courses(title)')
          .order('created_at', { ascending: false });

        if (!error && lives) {
          lives.forEach(l => {
            const dateVal = l.created_at || l.scheduled_at;
            if (isAfterSince(dateVal)) {
              sessCount++;
              const courseTitle = l.courses?.title || (l.course_id ? coursesMap.get(l.course_id) : null);
              const dateStr = l.scheduled_at ? new Date(l.scheduled_at).toLocaleDateString('fr-FR') : '';
              const timeStr = l.scheduled_at ? new Date(l.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

              mixed.push({
                id: `live-${l.id}`,
                type: 'session',
                title: 'Session Live programmée',
                description: `Live "${l.title}"${courseTitle ? ` (${courseTitle})` : ''} prévu le ${dateStr}${timeStr ? ` à ${timeStr}` : ''}.`,
                date: dateVal || new Date().toISOString(),
                icon: <Video className="w-5 h-5 text-rose-600" />,
                bgColor: 'bg-rose-100',
                link: '/live'
              });
            }
          });
        }
      } catch (e) {
        console.warn('live_sessions exception:', e);
      }

      setStats({
        newClients: clientCount,
        newRegistrations: regCount,
        newPayments: payCount,
        courseQuizzes: courseQuizCount,
        publicQuizzes: publicQuizCount,
        newSessions: sessCount
      });

      mixed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(mixed);

    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.description.toLowerCase().includes(searchQuery.toLowerCase());
        
      // Type filter
      const matchesType = typeFilter === 'all' || activity.type === typeFilter;
      
      return matchesSearch && matchesType;
    });
  }, [activities, searchQuery, typeFilter]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Back Button */}
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-2xl text-sm font-bold shadow-xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500" />
          <span>Retour à l'accueil</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="bg-sky-100 p-3 rounded-2xl text-sky-600">
            <Activity className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Du nouveau (Activité)</h1>
            <p className="text-gray-500 text-sm mt-1">Historique complet des activités et événements de la plateforme.</p>
          </div>
        </div>
        
        {/* Date Filter Selection */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1 shadow-xs">
          <button 
            onClick={() => setDateFilter('today')} 
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${dateFilter === 'today' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Aujourd'hui
          </button>
          <button 
            onClick={() => setDateFilter('7days')} 
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${dateFilter === '7days' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            7 jours
          </button>
          <button 
            onClick={() => setDateFilter('30days')} 
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${dateFilter === '30days' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            30 jours
          </button>
          <button 
            onClick={() => setDateFilter('all')} 
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${dateFilter === 'all' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Tout
          </button>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 truncate">Clients</p>
            <p className="text-xl font-black text-gray-900">{stats.newClients}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 truncate">Inscriptions</p>
            <p className="text-xl font-black text-gray-900">{stats.newRegistrations}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="bg-amber-50 p-3 rounded-xl text-amber-600 shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 truncate">Paiements</p>
            <p className="text-xl font-black text-gray-900">{stats.newPayments}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="bg-purple-50 p-3 rounded-xl text-purple-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 truncate">Quiz Cours</p>
            <p className="text-xl font-black text-gray-900">{stats.courseQuizzes}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 truncate">Quiz Publics</p>
            <p className="text-xl font-black text-gray-900">{stats.publicQuizzes}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="bg-orange-50 p-3 rounded-xl text-orange-600 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 truncate">Sessions</p>
            <p className="text-xl font-black text-gray-900">{stats.newSessions}</p>
          </div>
        </div>
      </div>

      {/* Timeline with Filters */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une activité..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow shadow-xs"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-5 h-5 text-gray-400 shrink-0" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs"
            >
              <option value="all">Toutes les activités ({activities.length})</option>
              <option value="registration">Inscriptions aux formations</option>
              <option value="course_quiz">Quiz de cours validés</option>
              <option value="public_quiz">Quiz publics (Leads)</option>
              <option value="payment">Paiements & Tranches</option>
              <option value="session">Sessions & Lives</option>
              <option value="client">Nouveaux clients</option>
            </select>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-400" /> Fil d'actualité {filteredActivities.length > 0 && `(${filteredActivities.length})`}
          </h2>
          
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : filteredActivities.length > 0 ? (
            <div className="relative border-l-2 border-gray-100 ml-4 space-y-8 pb-4">
              {filteredActivities.map((activity) => (
                <div key={activity.id} className="relative pl-8">
                  <div className={`absolute -left-[21px] top-1 p-2 rounded-full border-4 border-white ${activity.bgColor}`}>
                    {activity.icon}
                  </div>
                  <div className="bg-gray-50 hover:bg-gray-100 transition-colors rounded-2xl p-4 sm:p-5 border border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 mb-2">
                      <h3 className="font-bold text-gray-900 text-base">{activity.title}</h3>
                      <div className="flex items-center gap-1 text-xs font-semibold text-gray-400 bg-white px-2 py-1 rounded-lg border border-gray-100 w-fit">
                        <Clock className="w-3 h-3" />
                        {new Date(activity.date).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed">{activity.description}</p>
                    <Link
                      to={activity.link}
                      className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Voir les détails <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                {searchQuery || typeFilter !== 'all' ? (
                  <Search className="w-8 h-8 text-gray-400" />
                ) : (
                  <Activity className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {searchQuery || typeFilter !== 'all' ? "Aucun résultat" : "Aucune activité récente"}
              </h3>
              <p className="text-gray-500 max-w-sm mx-auto text-sm">
                {searchQuery || typeFilter !== 'all' 
                  ? "Aucune activité ne correspond à vos critères de recherche."
                  : "Il n'y a pas eu d'activité sur la plateforme pour la période sélectionnée."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
