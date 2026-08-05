import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  CheckCircle2, PlusCircle, CreditCard, UserPlus, 
  Video, HelpCircle, Activity, ArrowRight, Loader2 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminActivities({ setActiveTab }: { setActiveTab: (tab: any) => void }) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    newRegistrations: 0,
    newPayments: 0,
    newLeads: 0,
    upcomingLives: 0
  });

  const navigate = useNavigate();

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      // We will fetch the last 20 items from various tables to build an activity feed
      
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Registrations
      const { data: regsData } = await supabase
        .from('registrations')
        .select('*, courses(title)')
        .order('created_at', { ascending: false })
        .limit(15);

      // 2. Payments
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*, registrations(participant_name, courses(title))')
        .order('created_at', { ascending: false })
        .limit(15);

      // 3. Quiz Leads (Lead magnet)
      const { data: leadsData } = await supabase
        .from('quiz_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      // 4. Quiz Results (Quiz validé dans un module)
      const { data: resultsData } = await supabase
        .from('quiz_results')
        .select('*, courses(title)')
        .order('created_at', { ascending: false })
        .limit(15);

      // 5. Future Live sessions
      const { data: livesData } = await supabase
        .from('live_sessions')
        .select('*')
        .gte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(10);

      // 6. Nouveau quizz créés (Check courses or modules, since we don't have a strict "quiz created" date, maybe recent courses)
      // Actually, if we have quiz_results, that's enough for "quiz validé". For "nouveau quizz", maybe just check course_modules where quiz_data is not null. Let's just use courses for now if needed, or skip.

      // Map everything to a standard Activity object
      const mappedActivities: any[] = [];

      regsData?.forEach((r: any) => {
        mappedActivities.push({
          id: `reg-${r.id}`,
          type: 'registration',
          title: 'Nouvelle inscription',
          description: `${r.participant_name} s'est inscrit(e) à "${r.courses?.title || 'Une formation'}".`,
          date: new Date(r.created_at),
          raw: r,
          action: () => setActiveTab('formations')
        });
      });

      paymentsData?.forEach((p: any) => {
        mappedActivities.push({
          id: `pay-${p.id}`,
          type: 'payment',
          title: 'Nouveau paiement',
          description: `Paiement de ${p.amount.toLocaleString('fr-FR')} FCFA par ${p.registrations?.participant_name} pour "${p.registrations?.courses?.title || 'Une formation'}". Status: ${p.status}`,
          date: new Date(p.created_at),
          raw: p,
          action: () => setActiveTab('paiements')
        });
      });

      leadsData?.forEach((l: any) => {
        mappedActivities.push({
          id: `lead-${l.id}`,
          type: 'lead',
          title: 'Nouveau prospect (Lead Magnet)',
          description: `${l.first_name} ${l.last_name} (${l.email}) a complété le quizz public.`,
          date: new Date(l.created_at),
          raw: l,
          action: () => setActiveTab('quizz')
        });
      });

      resultsData?.forEach((r: any) => {
        mappedActivities.push({
          id: `res-${r.id}`,
          type: 'quiz_result',
          title: 'Quiz complété',
          description: `${r.client_email} a obtenu ${r.score}% au quiz de "${r.courses?.title || 'Une formation'}".`,
          date: new Date(r.created_at),
          raw: r,
          action: () => setActiveTab('quizz')
        });
      });

      livesData?.forEach((l: any) => {
        mappedActivities.push({
          id: `live-${l.id}`,
          type: 'live',
          title: 'Future Session Live',
          description: `Session "${l.title}" prévue le ${new Date(l.scheduled_at).toLocaleDateString('fr-FR')} à ${new Date(l.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
          date: new Date(l.created_at), // use created_at for sorting in feed, but display scheduled_at
          raw: l,
          action: () => navigate('/live')
        });
      });

      // Sort all by date descending
      mappedActivities.sort((a, b) => b.date.getTime() - a.date.getTime());

      setActivities(mappedActivities.slice(0, 50)); // Keep top 50 recent

      // Calculate KPIs (e.g. from last 30 days)
      setKpis({
        newRegistrations: regsData?.filter(d => new Date(d.created_at) > new Date(thirtyDaysAgo)).length || 0,
        newPayments: paymentsData?.filter(d => new Date(d.created_at) > new Date(thirtyDaysAgo)).length || 0,
        newLeads: leadsData?.filter(d => new Date(d.created_at) > new Date(thirtyDaysAgo)).length || 0,
        upcomingLives: livesData?.length || 0
      });

    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'registration': return <UserPlus className="w-5 h-5 text-emerald-600" />;
      case 'payment': return <CreditCard className="w-5 h-5 text-indigo-600" />;
      case 'lead': return <PlusCircle className="w-5 h-5 text-amber-600" />;
      case 'quiz_result': return <CheckCircle2 className="w-5 h-5 text-purple-600" />;
      case 'live': return <Video className="w-5 h-5 text-rose-600" />;
      default: return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'registration': return 'bg-emerald-50 border-emerald-100 hover:border-emerald-200';
      case 'payment': return 'bg-indigo-50 border-indigo-100 hover:border-indigo-200';
      case 'lead': return 'bg-amber-50 border-amber-100 hover:border-amber-200';
      case 'quiz_result': return 'bg-purple-50 border-purple-100 hover:border-purple-200';
      case 'live': return 'bg-rose-50 border-rose-100 hover:border-rose-200';
      default: return 'bg-gray-50 border-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <UserPlus className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm">Inscriptions</span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-gray-900">{kpis.newRegistrations}</span>
            <span className="text-xs text-gray-500 ml-2 font-medium">/ 30 jours</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <CreditCard className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm">Paiements</span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-gray-900">{kpis.newPayments}</span>
            <span className="text-xs text-gray-500 ml-2 font-medium">/ 30 jours</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center gap-3 text-amber-600 mb-2">
            <div className="p-2 bg-amber-50 rounded-xl">
              <HelpCircle className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm">Nouveaux Leads</span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-gray-900">{kpis.newLeads}</span>
            <span className="text-xs text-gray-500 ml-2 font-medium">/ 30 jours</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center gap-3 text-rose-600 mb-2">
            <div className="p-2 bg-rose-50 rounded-xl">
              <Video className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm">Lives à venir</span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-gray-900">{kpis.upcomingLives}</span>
            <span className="text-xs text-gray-500 ml-2 font-medium">programmés</span>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Activité Récente</h2>
          <p className="text-sm text-gray-500 mt-1">Les derniers événements survenus sur votre plateforme.</p>
        </div>
        
        {activities.length === 0 ? (
          <div className="p-10 text-center">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucune activité récente.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activities.map((activity) => (
              <div 
                key={activity.id} 
                onClick={activity.action}
                className={`p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer transition-colors ${getActivityColor(activity.type)}`}
              >
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-white/50">
                    {getActivityIcon(activity.type)}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-sm font-bold text-gray-900">{activity.title}</h3>
                    <span className="text-[11px] font-bold text-gray-500 whitespace-nowrap">
                      {activity.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {activity.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                    {activity.description}
                  </p>
                </div>
                
                <div className="flex-shrink-0 hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm text-gray-400 group-hover:text-indigo-600">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
