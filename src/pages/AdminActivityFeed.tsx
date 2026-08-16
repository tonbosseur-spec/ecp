import React, { useState } from 'react';
import { 
  Activity, Users, CreditCard, BookOpen, Clock, ArrowRight, ArrowLeft, 
  Loader2, Calendar, MessageSquare, TrendingUp, Search, Filter, 
  CheckCircle2, Video 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuditLog, DateFilter, AuditLogItem } from '../hooks/useAuditLog';

// Unique configuration mapping for entity_types -> icons, styles, defaults
const ENTITY_CONFIG: Record<
  string, 
  { icon: React.ReactNode; bgColor: string; defaultTitle: string; defaultLink: string }
> = {
  client: {
    icon: <Users className="w-5 h-5 text-indigo-600" />,
    bgColor: 'bg-indigo-100',
    defaultTitle: 'Nouveau client inscrit',
    defaultLink: '/admin/clients',
  },
  client_profile: {
    icon: <Users className="w-5 h-5 text-indigo-600" />,
    bgColor: 'bg-indigo-100',
    defaultTitle: 'Nouveau client inscrit',
    defaultLink: '/admin/clients',
  },
  registration: {
    icon: <BookOpen className="w-5 h-5 text-emerald-600" />,
    bgColor: 'bg-emerald-100',
    defaultTitle: 'Inscription à une formation',
    defaultLink: '/admin/hub',
  },
  payment: {
    icon: <CreditCard className="w-5 h-5 text-amber-600" />,
    bgColor: 'bg-amber-100',
    defaultTitle: 'Paiement enregistré',
    defaultLink: '/admin/hub',
  },
  course_quiz: {
    icon: <CheckCircle2 className="w-5 h-5 text-purple-600" />,
    bgColor: 'bg-purple-100',
    defaultTitle: 'Quiz de cours validé',
    defaultLink: '/admin/formations',
  },
  module_progress: {
    icon: <CheckCircle2 className="w-5 h-5 text-purple-600" />,
    bgColor: 'bg-purple-100',
    defaultTitle: 'Quiz de cours validé',
    defaultLink: '/admin/formations',
  },
  public_quiz: {
    icon: <Activity className="w-5 h-5 text-blue-600" />,
    bgColor: 'bg-blue-100',
    defaultTitle: 'Quiz public validé',
    defaultLink: '/admin/hub',
  },
  quiz_result: {
    icon: <Activity className="w-5 h-5 text-blue-600" />,
    bgColor: 'bg-blue-100',
    defaultTitle: 'Quiz public validé',
    defaultLink: '/admin/hub',
  },
  quiz_lead: {
    icon: <MessageSquare className="w-5 h-5 text-teal-600" />,
    bgColor: 'bg-teal-100',
    defaultTitle: 'Prospect Quiz Public',
    defaultLink: '/admin/hub',
  },
  session: {
    icon: <Video className="w-5 h-5 text-rose-600" />,
    bgColor: 'bg-rose-100',
    defaultTitle: 'Session programmée',
    defaultLink: '/live',
  },
  live_session: {
    icon: <Video className="w-5 h-5 text-rose-600" />,
    bgColor: 'bg-rose-100',
    defaultTitle: 'Session Live programmée',
    defaultLink: '/live',
  },
  course_session: {
    icon: <Calendar className="w-5 h-5 text-orange-600" />,
    bgColor: 'bg-orange-100',
    defaultTitle: 'Session de cours',
    defaultLink: '/admin/sessions',
  },
};

const DEFAULT_ENTITY_CONFIG = {
  icon: <Activity className="w-5 h-5 text-sky-600" />,
  bgColor: 'bg-sky-100',
  defaultTitle: 'Activité système',
  defaultLink: '/admin/hub',
};

function getEntityConfig(type: string) {
  if (!type) return DEFAULT_ENTITY_CONFIG;
  return ENTITY_CONFIG[type.toLowerCase()] || DEFAULT_ENTITY_CONFIG;
}

export default function AdminActivityFeed() {
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('30days');

  // Audit log hook
  const { items, loading, loadingMore, hasMore, loadMore, kpis, totalCount } = useAuditLog({
    dateFilter,
    entityTypeFilter: typeFilter,
    searchQuery,
    pageSize: 20,
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Back Button */}
      <div>
        <Link
          to="/admin/dashboard"
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
            <p className="text-xl font-black text-gray-900">{kpis.newClients}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 truncate">Inscriptions</p>
            <p className="text-xl font-black text-gray-900">{kpis.newRegistrations}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="bg-amber-50 p-3 rounded-xl text-amber-600 shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 truncate">Paiements</p>
            <p className="text-xl font-black text-gray-900">{kpis.newPayments}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="bg-purple-50 p-3 rounded-xl text-purple-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 truncate">Quiz Cours</p>
            <p className="text-xl font-black text-gray-900">{kpis.courseQuizzes}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 truncate">Quiz Publics</p>
            <p className="text-xl font-black text-gray-900">{kpis.publicQuizzes}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="bg-orange-50 p-3 rounded-xl text-orange-600 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 truncate">Sessions</p>
            <p className="text-xl font-black text-gray-900">{kpis.newSessions}</p>
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
              <option value="all">Toutes les activités ({totalCount})</option>
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
            <TrendingUp className="w-5 h-5 text-gray-400" /> Fil d'actualité {totalCount > 0 && `(${totalCount})`}
          </h2>
          
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : items.length > 0 ? (
            <div className="relative border-l-2 border-gray-100 ml-4 space-y-8 pb-4">
              {items.map((item: AuditLogItem) => {
                const config = getEntityConfig(item.entity_type);
                const title = item.metadata?.title || item.action || config.defaultTitle;
                const link = item.link || config.defaultLink;

                return (
                  <div key={item.id} className="relative pl-8">
                    <div className={`absolute -left-[21px] top-1 p-2 rounded-full border-4 border-white ${config.bgColor}`}>
                      {config.icon}
                    </div>
                    <div className="bg-gray-50 hover:bg-gray-100 transition-colors rounded-2xl p-4 sm:p-5 border border-gray-100">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 mb-2">
                        <h3 className="font-bold text-gray-900 text-base">{title}</h3>
                        <div className="flex items-center gap-1 text-xs font-semibold text-gray-400 bg-white px-2 py-1 rounded-lg border border-gray-100 w-fit">
                          <Clock className="w-3 h-3" />
                          {new Date(item.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4 leading-relaxed">{item.summary}</p>
                      {link && (
                        <Link
                          to={link}
                          className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          Voir les détails <ArrowRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Load More Button */}
              {hasMore && (
                <div className="pt-6 text-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        <span>Chargement...</span>
                      </>
                    ) : (
                      <span>Charger plus ({items.length} / {totalCount})</span>
                    )}
                  </button>
                </div>
              )}
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
