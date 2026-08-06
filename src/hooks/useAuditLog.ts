import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface AuditLogItem {
  id: string;
  created_at: string;
  actor_id?: string | null;
  actor_role?: string | null;
  action?: string | null;
  entity_type: string;
  entity_id?: string | null;
  summary: string;
  link?: string | null;
  metadata?: any;
}

export interface AuditLogKPIs {
  newClients: number;
  newRegistrations: number;
  newPayments: number;
  courseQuizzes: number;
  publicQuizzes: number;
  newSessions: number;
}

export type DateFilter = 'today' | '7days' | '30days' | 'all';

interface UseAuditLogOptions {
  dateFilter?: DateFilter;
  entityTypeFilter?: string;
  searchQuery?: string;
  pageSize?: number;
}

export function useAuditLog({
  dateFilter = 'all',
  entityTypeFilter = 'all',
  searchQuery = '',
  pageSize = 20,
}: UseAuditLogOptions = {}) {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<AuditLogKPIs>({
    newClients: 0,
    newRegistrations: 0,
    newPayments: 0,
    courseQuizzes: 0,
    publicQuizzes: 0,
    newSessions: 0,
  });

  // Calculate ISO string for since date
  const getSinceISO = useCallback((filter: DateFilter): string | null => {
    if (filter === 'all') return null;
    const now = new Date();
    if (filter === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return todayStart.toISOString();
    }
    if (filter === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    if (filter === '30days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d.toISOString();
    }
    return null;
  }, []);

  // Fallback data fetcher from existing tables if audit_log is empty
  const fetchFallbackData = useCallback(async (sinceISO: string | null) => {
    const sinceTime = sinceISO ? new Date(sinceISO).getTime() : 0;
    const isAfterSince = (dateStr?: string) => {
      if (!sinceTime) return true;
      if (!dateStr) return false;
      return new Date(dateStr).getTime() >= sinceTime;
    };

    const fallbackItems: AuditLogItem[] = [];
    const counts: AuditLogKPIs = {
      newClients: 0,
      newRegistrations: 0,
      newPayments: 0,
      courseQuizzes: 0,
      publicQuizzes: 0,
      newSessions: 0,
    };

    // Pre-fetch lookup maps
    const profilesMap = new Map<string, any>();
    try {
      const { data: profiles } = await supabase.from('client_profiles').select('*');
      profiles?.forEach(p => {
        profilesMap.set(p.id, p);
        if (isAfterSince(p.created_at)) {
          counts.newClients++;
          const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Nouveau client';
          fallbackItems.push({
            id: `client-${p.id}`,
            created_at: p.created_at || new Date().toISOString(),
            entity_type: 'client',
            entity_id: p.id,
            summary: `${name} a créé son compte sur la plateforme.`,
            link: '/admin/clients',
            metadata: { title: 'Nouveau client inscrit' }
          });
        }
      });
    } catch (e) {
      console.warn('Fallback profiles error:', e);
    }

    const coursesMap = new Map<string, string>();
    const modulesMap = new Map<string, { title: string; course_id: string }>();
    try {
      const { data: coursesData } = await supabase.from('courses').select('id, title');
      coursesData?.forEach(c => coursesMap.set(c.id, c.title));

      const { data: modsData } = await supabase.from('course_modules').select('id, title, course_id');
      modsData?.forEach(m => modulesMap.set(m.id, { title: m.title, course_id: m.course_id }));
    } catch (e) {
      console.warn('Fallback courses lookup error:', e);
    }

    // 1. Registrations
    try {
      const { data: registrations } = await supabase.from('registrations').select('*, courses(title)');
      registrations?.forEach(r => {
        const dateVal = r.registered_at || r.created_at;
        if (isAfterSince(dateVal)) {
          counts.newRegistrations++;
          const clientName = r.participant_name || r.participant_email || 'Un étudiant';
          const courseTitle = r.courses?.title || coursesMap.get(r.course_id) || 'une formation';
          const statusText = r.payment_status === 'completed' || r.payment_status === 'approved' ? 'Paiement effectué' : (r.payment_status || 'Inscrit');

          fallbackItems.push({
            id: `reg-${r.id}`,
            created_at: dateVal || new Date().toISOString(),
            entity_type: 'registration',
            entity_id: r.id,
            summary: `${clientName} s'est inscrit(e) à "${courseTitle}" (Statut: ${statusText}).`,
            link: '/admin/hub',
            metadata: { title: 'Inscription à une formation' }
          });
        }
      });
    } catch (e) {
      console.warn('Fallback registrations error:', e);
    }

    // 2. Payments
    try {
      const { data: payments } = await supabase.from('payments').select('*, registrations(participant_name, participant_email, courses(title))');
      payments?.forEach(p => {
        const dateVal = p.paid_at || p.created_at;
        if (isAfterSince(dateVal)) {
          counts.newPayments++;
          const reg = p.registrations as any;
          const clientName = reg?.participant_name || reg?.participant_email || 'Un client';
          const courseTitle = reg?.courses?.title || 'la formation';
          const formattedAmount = p.amount ? `${Number(p.amount).toLocaleString('fr-FR')} FCFA` : '';

          fallbackItems.push({
            id: `pay-${p.id}`,
            created_at: dateVal || new Date().toISOString(),
            entity_type: 'payment',
            entity_id: p.id,
            summary: `Paiement ${formattedAmount ? `de ${formattedAmount} ` : ''}par ${clientName} pour "${courseTitle}".`,
            link: '/admin/hub',
            metadata: { title: 'Paiement enregistré' }
          });
        }
      });
    } catch (e) {
      console.warn('Fallback payments error:', e);
    }

    // 3. Module Progress / Course Quiz
    try {
      const { data: progressData } = await supabase.from('module_progress').select('*');
      progressData?.forEach(mp => {
        const dateVal = mp.completed_at || mp.created_at || mp.updated_at;
        if (mp.score !== null && mp.score !== undefined && isAfterSince(dateVal)) {
          counts.courseQuizzes++;
          const profile = mp.client_id ? profilesMap.get(mp.client_id) : null;
          const clientName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email : 'Un étudiant';
          const modInfo = mp.module_id ? modulesMap.get(mp.module_id) : null;
          const moduleTitle = modInfo?.title || 'un module';
          const courseTitle = modInfo?.course_id ? coursesMap.get(modInfo.course_id) : null;

          fallbackItems.push({
            id: `course-quiz-${mp.id}`,
            created_at: dateVal || new Date().toISOString(),
            entity_type: 'course_quiz',
            entity_id: mp.id,
            summary: `${clientName} a validé le quiz du module "${moduleTitle}"${courseTitle ? ` (${courseTitle})` : ''} avec un score de ${mp.score}%.`,
            link: '/admin/courses',
            metadata: { title: 'Quiz de cours validé' }
          });
        }
      });
    } catch (e) {
      console.warn('Fallback module_progress error:', e);
    }

    // 4. Public Quiz Results
    try {
      const { data: quizResults } = await supabase.from('quiz_results').select('*, courses(title)');
      quizResults?.forEach(qr => {
        if (isAfterSince(qr.created_at)) {
          counts.publicQuizzes++;
          const participant = qr.participant_name || qr.client_email || qr.participant_email || 'Un visiteur';
          const courseTitle = qr.courses?.title || (qr.course_id ? coursesMap.get(qr.course_id) : null);
          fallbackItems.push({
            id: `quiz-res-${qr.id}`,
            created_at: qr.created_at || new Date().toISOString(),
            entity_type: 'public_quiz',
            entity_id: qr.id,
            summary: `${participant} a terminé un quiz public${courseTitle ? ` (${courseTitle})` : ''} avec un score de ${qr.score}/${qr.max_score || 100}.`,
            link: '/admin/hub',
            metadata: { title: 'Quiz public validé' }
          });
        }
      });
    } catch (e) {
      console.warn('Fallback quiz_results error:', e);
    }

    // 5. Quiz Leads
    try {
      const { data: quizLeads } = await supabase.from('quiz_leads').select('*');
      quizLeads?.forEach(ql => {
        if (isAfterSince(ql.created_at)) {
          counts.publicQuizzes++;
          const name = `${ql.first_name || ''} ${ql.last_name || ''}`.trim() || ql.email || 'Nouveau prospect';
          fallbackItems.push({
            id: `quiz-lead-${ql.id}`,
            created_at: ql.created_at || new Date().toISOString(),
            entity_type: 'quiz_lead',
            entity_id: ql.id,
            summary: `${name} a complété le quiz d'évaluation lead magnet.`,
            link: '/admin/hub',
            metadata: { title: 'Prospect Quiz Public' }
          });
        }
      });
    } catch (e) {
      console.warn('Fallback quiz_leads error:', e);
    }

    // 6. Live Sessions & Course Sessions
    try {
      const { data: lives } = await supabase.from('live_sessions').select('*, courses(title)');
      lives?.forEach(l => {
        const dateVal = l.created_at || l.scheduled_at;
        if (isAfterSince(dateVal)) {
          counts.newSessions++;
          const courseTitle = l.courses?.title || (l.course_id ? coursesMap.get(l.course_id) : null);
          const dateStr = l.scheduled_at ? new Date(l.scheduled_at).toLocaleDateString('fr-FR') : '';

          fallbackItems.push({
            id: `live-${l.id}`,
            created_at: dateVal || new Date().toISOString(),
            entity_type: 'live_session',
            entity_id: l.id,
            summary: `Live "${l.title}"${courseTitle ? ` (${courseTitle})` : ''} prévu le ${dateStr}.`,
            link: '/live',
            metadata: { title: 'Session Live programmée' }
          });
        }
      });
    } catch (e) {
      console.warn('Fallback live_sessions error:', e);
    }

    // Sort descending
    fallbackItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { fallbackItems, counts };
  }, []);

  // Fetch KPIs separately
  const fetchKPIs = useCallback(async (since: string | null) => {
    try {
      let q = supabase.from('audit_log').select('entity_type');
      if (since) {
        q = q.gte('created_at', since);
      }
      const { data, error } = await q;
      if (error || !data || data.length === 0) {
        return false;
      }

      const counts: AuditLogKPIs = {
        newClients: 0,
        newRegistrations: 0,
        newPayments: 0,
        courseQuizzes: 0,
        publicQuizzes: 0,
        newSessions: 0,
      };

      data.forEach((row: { entity_type: string }) => {
        const t = row.entity_type?.toLowerCase();
        if (t === 'client' || t === 'client_profile' || t === 'user') counts.newClients++;
        else if (t === 'registration') counts.newRegistrations++;
        else if (t === 'payment') counts.newPayments++;
        else if (t === 'course_quiz' || t === 'module_progress') counts.courseQuizzes++;
        else if (t === 'public_quiz' || t === 'quiz_result' || t === 'quiz_lead') counts.publicQuizzes++;
        else if (t === 'session' || t === 'course_session' || t === 'live_session') counts.newSessions++;
      });

      setKpis(counts);
      return true;
    } catch (err) {
      console.warn('Failed to calculate audit_log KPIs:', err);
      return false;
    }
  }, []);

  // Fetch initial / filtered audit logs
  const fetchLogs = useCallback(
    async (pageToFetch: number, isInitial = false) => {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const since = getSinceISO(dateFilter);
        const from = pageToFetch * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
          .from('audit_log')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        if (since) {
          query = query.gte('created_at', since);
        }

        if (entityTypeFilter && entityTypeFilter !== 'all') {
          if (entityTypeFilter === 'session') {
            query = query.in('entity_type', ['session', 'course_session', 'live_session']);
          } else if (entityTypeFilter === 'public_quiz') {
            query = query.in('entity_type', ['public_quiz', 'quiz_result', 'quiz_lead']);
          } else if (entityTypeFilter === 'course_quiz') {
            query = query.in('entity_type', ['course_quiz', 'module_progress']);
          } else if (entityTypeFilter === 'client') {
            query = query.in('entity_type', ['client', 'client_profile', 'user']);
          } else {
            query = query.eq('entity_type', entityTypeFilter);
          }
        }

        if (searchQuery.trim()) {
          query = query.ilike('summary', `%${searchQuery.trim()}%`);
        }

        const { data, count, error } = await query;

        // If audit_log is empty or errors out, fall back seamlessly to direct database queries
        if (error || !data || (count === 0 && pageToFetch === 0)) {
          const { fallbackItems, counts } = await fetchFallbackData(since);
          
          // Apply client-side filters for fallback items
          let filtered = fallbackItems;
          if (entityTypeFilter && entityTypeFilter !== 'all') {
            if (entityTypeFilter === 'session') {
              filtered = filtered.filter(i => ['session', 'course_session', 'live_session'].includes(i.entity_type));
            } else if (entityTypeFilter === 'public_quiz') {
              filtered = filtered.filter(i => ['public_quiz', 'quiz_result', 'quiz_lead'].includes(i.entity_type));
            } else if (entityTypeFilter === 'course_quiz') {
              filtered = filtered.filter(i => ['course_quiz', 'module_progress'].includes(i.entity_type));
            } else if (entityTypeFilter === 'client') {
              filtered = filtered.filter(i => ['client', 'client_profile', 'user'].includes(i.entity_type));
            } else {
              filtered = filtered.filter(i => i.entity_type === entityTypeFilter);
            }
          }

          if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            filtered = filtered.filter(i => i.summary.toLowerCase().includes(q));
          }

          const total = filtered.length;
          setTotalCount(total);
          setKpis(counts);

          const paginated = filtered.slice(from, from + pageSize);

          if (isInitial) {
            setItems(paginated);
          } else {
            setItems(prev => [...prev, ...paginated]);
          }

          setHasMore((pageToFetch + 1) * pageSize < total);
          setPage(pageToFetch);
          return;
        }

        const newItems = (data || []) as AuditLogItem[];
        const total = count || 0;
        setTotalCount(total);

        if (isInitial) {
          setItems(newItems);
        } else {
          setItems((prev) => [...prev, ...newItems]);
        }

        setHasMore((pageToFetch + 1) * pageSize < total);
        setPage(pageToFetch);

        if (isInitial) {
          fetchKPIs(since);
        }
      } catch (err) {
        console.error('Audit log fetch error:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [dateFilter, entityTypeFilter, searchQuery, pageSize, getSinceISO, fetchKPIs, fetchFallbackData]
  );

  // Trigger initial fetch when filters change
  useEffect(() => {
    fetchLogs(0, true);
  }, [dateFilter, entityTypeFilter, searchQuery, fetchLogs]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      fetchLogs(page + 1, false);
    }
  }, [loading, loadingMore, hasMore, page, fetchLogs]);

  const refetch = useCallback(() => {
    fetchLogs(0, true);
  }, [fetchLogs]);

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    kpis,
    totalCount,
    refetch,
  };
}
