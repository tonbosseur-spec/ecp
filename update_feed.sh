#!/bin/bash
cat << 'INNEREOF' > src/pages/AdminActivityFeed.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Activity, Users, CreditCard, BookOpen, Clock, ArrowRight, Loader2, Calendar, MessageSquare, TrendingUp, Search, Filter } from 'lucide-react';
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

      const buildQuery = (table: string, select: string) => {
        let q = supabase.from(table).select(select);
        if (since) {
          q = q.gte('created_at', since);
        }
        return q;
      };

      // Fetch profiles
      const { data: profiles } = await buildQuery('client_profiles', 'id, first_name, last_name, created_at');
      // Fetch registrations
      const { data: registrations } = await buildQuery('registrations', 'id, client_id, course_id, payment_status, created_at');
      // Fetch sessions
      const { data: sessions } = await buildQuery('course_sessions', 'id, title, date, created_at');
      // Fetch quiz results
      const { data: quizResults } = await buildQuery('quiz_results', 'id, participant_name, score, max_score, created_at');
      // Fetch quiz leads
      let quizLeadsQuery = supabase.from('course_proposals').select('id, client_profiles(first_name, last_name), created_at').eq('status', 'quiz_lead');
      if (since) quizLeadsQuery = quizLeadsQuery.gte('created_at', since);
      const { data: quizLeads } = await quizLeadsQuery;
      
      const mixed: any[] = [];
      
      let clientCount = 0;
      let regCount = 0;
      let payCount = 0;
      let sessCount = 0;

      if (profiles) {
        clientCount = profiles.length;
        profiles.forEach(p => {
          mixed.push({
            id: `client-${p.id}`,
            type: 'client',
            title: 'Nouveau client inscrit',
            description: `${p.first_name || ''} ${p.last_name || ''} a rejoint la plateforme.`,
            date: p.created_at,
            icon: <Users className="w-5 h-5 text-indigo-600" />,
            bgColor: 'bg-indigo-100',
            link: '/admin/clients'
          });
        });
      }

      if (registrations) {
        regCount = registrations.length;
        payCount = registrations.filter(r => r.payment_status === 'pending' || r.payment_status === 'completed').length;
        
        registrations.forEach(r => {
          mixed.push({
            id: `reg-${r.id}`,
            type: 'registration',
            title: 'Nouvelle Inscription',
            description: `Une nouvelle inscription à une formation (Statut: ${r.payment_status}).`,
            date: r.created_at,
            icon: <BookOpen className="w-5 h-5 text-emerald-600" />,
            bgColor: 'bg-emerald-100',
            link: '/admin/hub'
          });
        });
      }

      if (sessions) {
        sessCount = sessions.length;
        sessions.forEach(s => {
          mixed.push({
            id: `sess-${s.id}`,
            type: 'session',
            title: 'Nouvelle Session Programmée',
            description: `Session "${s.title}" prévue pour le ${new Date(s.date).toLocaleDateString()}.`,
            date: s.created_at,
            icon: <Calendar className="w-5 h-5 text-amber-600" />,
            bgColor: 'bg-amber-100',
            link: '/admin/sessions'
          });
        });
      }

      if (quizResults) {
        quizResults.forEach(qr => {
          mixed.push({
            id: `quiz-${qr.id}`,
            type: 'quiz_result',
            title: 'Quiz validé par un client',
            description: `${qr.participant_name || 'Client anonyme'} a terminé un quiz avec un score de ${qr.score}/${qr.max_score}.`,
            date: qr.created_at,
            icon: <Activity className="w-5 h-5 text-blue-600" />,
            bgColor: 'bg-blue-100',
            link: '/admin/hub'
          });
        });
      }

      if (quizLeads) {
        quizLeads.forEach(ql => {
          const clientName = ql.client_profiles ? `${(ql.client_profiles as any).first_name || ''} ${(ql.client_profiles as any).last_name || ''}` : 'Nouveau client';
          mixed.push({
            id: `lead-${ql.id}`,
            type: 'quiz_lead',
            title: 'Nouveau Lead Magnet (Quiz)',
            description: `${clientName} a manifesté un intérêt suite à un quiz lead magnet.`,
            date: ql.created_at,
            icon: <MessageSquare className="w-5 h-5 text-rose-600" />,
            bgColor: 'bg-rose-100',
            link: '/admin/hub'
          });
        });
      }

      setStats({
        newClients: clientCount,
        newRegistrations: regCount,
        newPayments: payCount,
        newSessions: sessCount
      });

      mixed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(mixed);
      
    } catch (err) {
      console.error(err);
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/dashboard" className="bg-sky-100 p-3 rounded-2xl text-sky-600 hover:bg-sky-200 transition-colors">
            <Activity className="w-8 h-8" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Du nouveau (Activité)</h1>
            <p className="text-gray-500 text-sm mt-1">Surveillez l'activité récente de votre plateforme.</p>
          </div>
        </div>
        
        {/* Date Filter Selection */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1">
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

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-indigo-50 p-4 rounded-full text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500">Nouveaux Clients</p>
            <p className="text-2xl font-black text-gray-900">{stats.newClients}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-50 p-4 rounded-full text-emerald-600">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500">Nouvelles Inscriptions</p>
            <p className="text-2xl font-black text-gray-900">{stats.newRegistrations}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-amber-50 p-4 rounded-full text-amber-600">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500">Paiements / Tranches</p>
            <p className="text-2xl font-black text-gray-900">{stats.newPayments}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-orange-50 p-4 rounded-full text-orange-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500">Sessions Programmées</p>
            <p className="text-2xl font-black text-gray-900">{stats.newSessions}</p>
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
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
            >
              <option value="all">Toutes les activités</option>
              <option value="client">Nouveaux clients</option>
              <option value="registration">Inscriptions</option>
              <option value="session">Sessions</option>
              <option value="quiz_result">Quiz complétés</option>
              <option value="quiz_lead">Leads (Quiz)</option>
            </select>
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-400" /> Fil d'actualité {filteredActivities.length > 0 && `(${filteredActivities.length})`}
          </h2>
          
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : filteredActivities.length > 0 ? (
            <div className="relative border-l-2 border-gray-100 ml-4 space-y-8 pb-4">
              {filteredActivities.map((activity, index) => (
                <div key={activity.id} className="relative pl-8">
                  <div className={`absolute -left-[21px] top-1 p-2 rounded-full border-4 border-white ${activity.bgColor}`}>
                    {activity.icon}
                  </div>
                  <div className="bg-gray-50 hover:bg-gray-100 transition-colors rounded-2xl p-5 border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-900">{activity.title}</h3>
                      <div className="flex items-center gap-1 text-xs font-semibold text-gray-400 bg-white px-2 py-1 rounded-lg border border-gray-100">
                        <Clock className="w-3 h-3" />
                        {new Date(activity.date).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{activity.description}</p>
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
              <p className="text-gray-500 max-w-sm mx-auto">
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
INNEREOF
