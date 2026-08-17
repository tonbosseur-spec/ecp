import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/Toast';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { 
  ArrowLeft, 
  Brain, 
  Search, 
  Filter, 
  RefreshCw, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Award, 
  BarChart3, 
  TrendingUp, 
  Users, 
  FileSpreadsheet, 
  Eye, 
  X, 
  BookOpen, 
  Code2, 
  HelpCircle, 
  Check, 
  Sparkles, 
  Target, 
  Download, 
  ChevronRight, 
  Layers, 
  Activity,
  AlertCircle
} from 'lucide-react';

interface TrainingExercise {
  id: string;
  training_session_id: string;
  exercise_type: 'qcm' | 'r_code';
  title: string;
  instructions: string;
  order_index: number;
  options?: string[];
  correct_option_index?: number;
  expected_output?: string;
  explanation?: string;
  hint?: string;
}

interface TrainingSessionData {
  id: string;
  title: string;
  category: string;
  level: string;
  is_published: boolean;
  created_at: string;
  exercises: TrainingExercise[];
}

interface ExerciseAttemptRecord {
  id: string;
  attempt_id: string;
  exercise_id: string;
  score: number;
  is_correct: boolean;
  answer_data: any;
  snapshot_data?: any;
}

interface AttemptRecord {
  id: string;
  training_session_id: string;
  client_id: string;
  score_percentage: number;
  is_passed: boolean;
  time_spent_seconds: number;
  completed_at: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  session_title: string;
  exercise_attempts: ExerciseAttemptRecord[];
}

export default function AdminTrainingStats() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Raw data from Supabase
  const [trainingSessions, setTrainingSessions] = useState<TrainingSessionData[]>([]);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);

  // Filter States
  const [selectedSessionId, setSelectedSessionId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'PASSED' | 'FAILED'>('ALL');
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<'ALL' | '7D' | '30D' | 'THIS_MONTH'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Attempt for Question-by-Question Detail Modal
  const [selectedAttemptModal, setSelectedAttemptModal] = useState<AttemptRecord | null>(null);

  useEffect(() => {
    fetchDashboardAnalytics();
  }, []);

  const fetchDashboardAnalytics = async () => {
    try {
      setLoading(true);

      // 1. Fetch training sessions and their exercises
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('training_sessions')
        .select(`
          id,
          title,
          difficulty_level,
          is_published,
          created_at,
          courses (
            id,
            title
          ),
          training_exercises (
            id,
            training_session_id,
            exercise_type,
            title,
            instructions,
            order_index,
            options,
            expected_output,
            hint
          )
        `)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      const qcmExerciseIds: string[] = [];
      (sessionsData || []).forEach((s: any) => {
        (s.training_exercises || []).forEach((ex: any) => {
          if (ex.exercise_type === 'qcm') {
            qcmExerciseIds.push(ex.id);
          }
        });
      });

      const answersMap = new Map<string, number>();
      if (qcmExerciseIds.length > 0) {
        const { data: answersData } = await supabase
          .from('training_qcm_answers')
          .select('*')
          .in('exercise_id', qcmExerciseIds);

        if (answersData) {
          answersData.forEach((a: any) => {
            answersMap.set(a.exercise_id, a.correct_option_index);
          });
        }
      }

      const sessionsFormatted: TrainingSessionData[] = (sessionsData || []).map((s: any) => {
        const courseTitle = s.courses?.title || '';
        let category = 'Général';
        if (courseTitle.toLowerCase().includes('excel')) {
          category = 'Excel';
        } else if (courseTitle.toLowerCase().includes('power bi') || courseTitle.toLowerCase().includes('powerbi')) {
          category = 'Power BI';
        } else if (courseTitle.toLowerCase().includes('r ') || courseTitle.toLowerCase().includes(' programmation r') || courseTitle.toLowerCase().includes(' r')) {
          category = 'Programmation R';
        } else if (courseTitle.toLowerCase().includes('stat')) {
          category = 'Statistiques';
        } else if (courseTitle) {
          category = courseTitle;
        }

        return {
          id: s.id,
          title: s.title,
          category,
          level: s.difficulty_level || 'intermediate',
          is_published: s.is_published,
          created_at: s.created_at,
          exercises: (s.training_exercises || [])
            .map((ex: any) => ({
              ...ex,
              correct_option_index: answersMap.get(ex.id)
            }))
            .sort((a: any, b: any) => a.order_index - b.order_index)
        };
      });

      setTrainingSessions(sessionsFormatted);

      const sessionsMap: Record<string, TrainingSessionData> = {};
      sessionsFormatted.forEach(s => {
        sessionsMap[s.id] = s;
      });

      // 2. Fetch clients profiles & registrations for client name resolution
      const { data: clientProfiles } = await supabase
        .from('client_profiles')
        .select('id, first_name, last_name, phone');

      const profilesMap: Record<string, { name: string; phone?: string }> = {};
      (clientProfiles || []).forEach((cp: any) => {
        const name = `${cp.first_name || ''} ${cp.last_name || ''}`.trim();
        profilesMap[cp.id] = {
          name: name || 'Apprenant Anonyme',
          phone: cp.phone || ''
        };
      });

      const { data: registrations } = await supabase
        .from('registrations')
        .select('client_id, participant_name, participant_email, participant_phone');

      const regMapByClientId: Record<string, { name: string; email: string; phone?: string }> = {};
      (registrations || []).forEach((r: any) => {
        if (r.client_id) {
          regMapByClientId[r.client_id] = {
            name: r.participant_name || 'Apprenant Registré',
            email: r.participant_email || 'Non renseigné',
            phone: r.participant_phone || ''
          };
        }
      });

      // 3. Fetch training attempts
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('training_attempts')
        .select(`
          id,
          training_session_id,
          client_id,
          score_percentage,
          is_passed,
          time_spent_seconds,
          completed_at,
          training_exercise_attempts (
            id,
            attempt_id,
            exercise_id,
            score,
            is_correct,
            answer_data,
            snapshot_data
          )
        `)
        .order('completed_at', { ascending: false });

      if (attemptsError) throw attemptsError;

      const attemptsFormatted: AttemptRecord[] = (attemptsData || []).map((att: any) => {
        const sessionObj = sessionsMap[att.training_session_id];
        const profileObj = profilesMap[att.client_id];
        const regObj = regMapByClientId[att.client_id];

        let clientName = 'Apprenant';
        if (profileObj && profileObj.name) {
          clientName = profileObj.name;
        } else if (regObj && regObj.name) {
          clientName = regObj.name;
        }

        let clientEmail = 'Compte Apprenant';
        if (regObj && regObj.email) {
          clientEmail = regObj.email;
        }

        const clientPhone = profileObj?.phone || regObj?.phone || '';

        return {
          id: att.id,
          training_session_id: att.training_session_id,
          client_id: att.client_id,
          score_percentage: Number(att.score_percentage) || 0,
          is_passed: Boolean(att.is_passed),
          time_spent_seconds: Number(att.time_spent_seconds) || 0,
          completed_at: att.completed_at,
          client_name: clientName,
          client_email: clientEmail,
          client_phone: clientPhone,
          session_title: sessionObj?.title || 'Entraînement',
          exercise_attempts: (att.training_exercise_attempts || []) as ExerciseAttemptRecord[]
        };
      });

      setAttempts(attemptsFormatted);
    } catch (err: any) {
      console.error('Erreur chargement statistiques:', err);
      toast.error('Erreur lors du chargement des analytiques : ' + (err.message || 'Erreur réseau'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardAnalytics();
  };

  // Filtered Attempts based on controls
  const filteredAttempts = useMemo(() => {
    const now = new Date();

    return attempts.filter(att => {
      // Session filter
      if (selectedSessionId !== 'ALL' && att.training_session_id !== selectedSessionId) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL') {
        const sessionObj = trainingSessions.find(s => s.id === att.training_session_id);
        if (sessionObj?.category !== selectedCategory) return false;
      }

      // Status filter
      if (selectedStatus === 'PASSED' && !att.is_passed) return false;
      if (selectedStatus === 'FAILED' && att.is_passed) return false;

      // Time Period filter
      if (selectedTimePeriod !== 'ALL') {
        const attDate = new Date(att.completed_at);
        const diffDays = (now.getTime() - attDate.getTime()) / (1000 * 3600 * 24);

        if (selectedTimePeriod === '7D' && diffDays > 7) return false;
        if (selectedTimePeriod === '30D' && diffDays > 30) return false;
        if (selectedTimePeriod === 'THIS_MONTH') {
          if (attDate.getMonth() !== now.getMonth() || attDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = att.client_name.toLowerCase().includes(q);
        const matchEmail = att.client_email.toLowerCase().includes(q);
        const matchSession = att.session_title.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchSession) return false;
      }

      return true;
    });
  }, [attempts, selectedSessionId, selectedCategory, selectedStatus, selectedTimePeriod, searchQuery, trainingSessions]);

  // Overall Global Key Indicators
  const kpiStats = useMemo(() => {
    const totalAttempts = filteredAttempts.length;
    const totalPassed = filteredAttempts.filter(a => a.is_passed).length;
    const passRate = totalAttempts > 0 ? Math.round((totalPassed / totalAttempts) * 100) : 0;

    const sumScore = filteredAttempts.reduce((acc, a) => acc + a.score_percentage, 0);
    const avgScore = totalAttempts > 0 ? Math.round(sumScore / totalAttempts) : 0;

    const uniqueClients = new Set(filteredAttempts.map(a => a.client_id)).size;

    const totalSeconds = filteredAttempts.reduce((acc, a) => acc + a.time_spent_seconds, 0);
    const avgSeconds = totalAttempts > 0 ? Math.round(totalSeconds / totalAttempts) : 0;

    const mins = Math.floor(avgSeconds / 60);
    const secs = avgSeconds % 60;
    const avgTimeFormatted = `${mins}m ${secs.toString().padStart(2, '0')}s`;

    return {
      totalAttempts,
      totalPassed,
      passRate,
      avgScore,
      uniqueClients,
      avgTimeFormatted
    };
  }, [filteredAttempts]);

  // Chart Data 1: Attempts & Average Score per Training Session
  const sessionChartData = useMemo(() => {
    const map: Record<string, { name: string; attemptsCount: number; sumScore: number; passedCount: number }> = {};

    trainingSessions.forEach(s => {
      map[s.id] = {
        name: s.title.length > 22 ? s.title.substring(0, 22) + '...' : s.title,
        attemptsCount: 0,
        sumScore: 0,
        passedCount: 0
      };
    });

    filteredAttempts.forEach(att => {
      if (map[att.training_session_id]) {
        map[att.training_session_id].attemptsCount += 1;
        map[att.training_session_id].sumScore += att.score_percentage;
        if (att.is_passed) map[att.training_session_id].passedCount += 1;
      }
    });

    return Object.values(map)
      .filter(item => item.attemptsCount > 0 || selectedSessionId === 'ALL')
      .slice(0, 8)
      .map(item => ({
        ...item,
        avgScore: item.attemptsCount > 0 ? Math.round(item.sumScore / item.attemptsCount) : 0,
        passRate: item.attemptsCount > 0 ? Math.round((item.passedCount / item.attemptsCount) * 100) : 0
      }));
  }, [trainingSessions, filteredAttempts, selectedSessionId]);

  // Chart Data 2: Score Grade Distribution
  const scoreDistributionData = useMemo(() => {
    let range0_25 = 0;
    let range25_50 = 0;
    let range50_75 = 0;
    let range75_100 = 0;

    filteredAttempts.forEach(att => {
      const s = att.score_percentage;
      if (s < 25) range0_25++;
      else if (s < 50) range25_50++;
      else if (s < 75) range50_75++;
      else range75_100++;
    });

    return [
      { name: '0 - 25%', value: range0_25, color: '#f43f5e' },
      { name: '25 - 50%', value: range25_50, color: '#f59e0b' },
      { name: '50 - 75%', value: range50_75, color: '#3b82f6' },
      { name: '75 - 100%', value: range75_100, color: '#10b981' }
    ];
  }, [filteredAttempts]);

  // Chart Data 3: Attempts over time
  const timeSeriesChartData = useMemo(() => {
    const mapByDate: Record<string, { dateStr: string; attempts: number; avgScoreSum: number }> = {};

    filteredAttempts.forEach(att => {
      const d = new Date(att.completed_at);
      const key = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!mapByDate[key]) {
        mapByDate[key] = { dateStr: key, attempts: 0, avgScoreSum: 0 };
      }
      mapByDate[key].attempts += 1;
      mapByDate[key].avgScoreSum += att.score_percentage;
    });

    const list = Object.values(mapByDate).map(item => ({
      date: item.dateStr,
      'Essais': item.attempts,
      'Note Moyenne': Math.round(item.avgScoreSum / item.attempts)
    }));

    return list.slice(-14); // Last 14 active days
  }, [filteredAttempts]);

  // Chart Data 4: QCM vs Code R success
  const exerciseTypePerformance = useMemo(() => {
    let qcmTotal = 0;
    let qcmCorrect = 0;
    let rCodeTotal = 0;
    let rCodeCorrect = 0;

    const exercisesMap: Record<string, 'qcm' | 'r_code'> = {};
    trainingSessions.forEach(s => {
      s.exercises.forEach(e => {
        exercisesMap[e.id] = e.exercise_type;
      });
    });

    filteredAttempts.forEach(att => {
      att.exercise_attempts.forEach(ea => {
        const type = exercisesMap[ea.exercise_id];
        if (type === 'qcm') {
          qcmTotal++;
          if (ea.is_correct) qcmCorrect++;
        } else if (type === 'r_code') {
          rCodeTotal++;
          if (ea.is_correct) rCodeCorrect++;
        }
      });
    });

    return [
      {
        name: 'Questions QCM',
        'Réussis': qcmCorrect,
        'Échoués': qcmTotal - qcmCorrect,
        'Taux': qcmTotal > 0 ? Math.round((qcmCorrect / qcmTotal) * 100) : 0
      },
      {
        name: 'Code R',
        'Réussis': rCodeCorrect,
        'Échoués': rCodeTotal - rCodeCorrect,
        'Taux': rCodeTotal > 0 ? Math.round((rCodeCorrect / rCodeTotal) * 100) : 0
      }
    ];
  }, [trainingSessions, filteredAttempts]);

  // Export to CSV Function
  const handleExportCSV = () => {
    if (filteredAttempts.length === 0) {
      toast.error('Aucune donnée à exporter.');
      return;
    }

    const headers = ['Client', 'Email', 'Entraînement', 'Note (%)', 'Statut', 'Temps Passé (s)', 'Date'];
    const rows = filteredAttempts.map(att => [
      `"${att.client_name}"`,
      `"${att.client_email}"`,
      `"${att.session_title}"`,
      att.score_percentage,
      att.is_passed ? 'Réussi' : 'Échoué',
      att.time_spent_seconds,
      `"${new Date(att.completed_at).toLocaleString('fr-FR')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `statistiques_entrainements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Fichier CSV exporté avec succès !');
  };

  // Helper to format duration in seconds
  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50/80 p-3 sm:p-6 lg:p-8 font-sans pb-24 w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

        {/* 1. En-tête */}
        <section className="bg-white p-4 sm:p-6 lg:p-7 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-2xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/admin/training')}
                className="p-2.5 sm:p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all flex items-center justify-center shrink-0 cursor-pointer min-w-[42px] min-h-[42px]"
                title="Retour à la liste des entraînements"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                    <Brain className="w-3 h-3 text-indigo-600 shrink-0" />
                    Tableau de Bord
                  </span>
                  <span className="text-xs text-gray-400 font-bold hidden xs:inline">•</span>
                  <span className="text-xs text-gray-500 font-semibold truncate block xs:inline">{trainingSessions.length} module(s) d'entraînement</span>
                </div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight mt-1 leading-tight">
                  Suivi des Séances d'Entraînement
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
                  Outil de pilotage pédagogique, analyse des performances et suivi individuel des apprenants.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full md:w-auto self-stretch md:self-center shrink-0 relative z-10">
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer min-h-[44px]"
                title="Actualiser les données"
              >
                <RefreshCw className={`w-4 h-4 shrink-0 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
                <span>Actualiser</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer min-h-[44px]"
                title="Exporter toutes les données filtrées au format CSV"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Exporter CSV</span>
              </button>

              <Link
                to="/admin/training"
                className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer min-h-[44px]"
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>Gérer les exercices</span>
              </Link>
            </div>
          </div>
        </section>

        {/* 2. Filtres */}
        <section className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-2xs space-y-3.5 sm:space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                <Filter className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-xs sm:text-sm font-extrabold text-gray-900 uppercase tracking-wider">
                2. Filtres & Contrôles
              </h2>
            </div>

            {(selectedSessionId !== 'ALL' || selectedCategory !== 'ALL' || selectedStatus !== 'ALL' || selectedTimePeriod !== 'ALL' || searchQuery !== '') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSessionId('ALL');
                  setSelectedCategory('ALL');
                  setSelectedStatus('ALL');
                  setSelectedTimePeriod('ALL');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
            
            {/* 1. Séance */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Séance</label>
              <select
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
                className="w-full px-3 py-2.5 text-xs sm:text-sm min-h-[42px] bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
              >
                <option value="ALL">Toutes les séances ({trainingSessions.length})</option>
                {trainingSessions.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>

            {/* 2. Catégorie */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Catégorie</label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2.5 text-xs sm:text-sm min-h-[42px] bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
              >
                <option value="ALL">Toutes catégories</option>
                <option value="Excel">Excel & Formules</option>
                <option value="R">Programmation R</option>
                <option value="Power BI">Power BI & Analytics</option>
                <option value="Statistiques">Statistiques & Analyse</option>
              </select>
            </div>

            {/* 3. Statut */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Statut</label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value as any)}
                className="w-full px-3 py-2.5 text-xs sm:text-sm min-h-[42px] bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="PASSED">{"Réussis uniquement (≥ 70%)"}</option>
                <option value="FAILED">{"Échoués uniquement (< 70%)"}</option>
              </select>
            </div>

            {/* 4. Période */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Période</label>
              <select
                value={selectedTimePeriod}
                onChange={e => setSelectedTimePeriod(e.target.value as any)}
                className="w-full px-3 py-2.5 text-xs sm:text-sm min-h-[42px] bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all cursor-pointer"
              >
                <option value="ALL">Toutes les périodes</option>
                <option value="7D">7 derniers jours</option>
                <option value="30D">30 derniers jours</option>
                <option value="THIS_MONTH">Ce mois-ci</option>
              </select>
            </div>

            {/* 5. Recherche apprenant */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Recherche apprenant</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Nom ou e-mail..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm min-h-[42px] bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                />
              </div>
            </div>

          </div>
        </section>

        {/* 3. KPI */}
        <section className="space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xs sm:text-sm font-extrabold text-gray-900 uppercase tracking-wider">
              3. Indicateurs Clés (KPI)
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
            
            {/* KPI 1: Nombre total de tentatives */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-2xs space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">Total Tentatives</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                  <Activity className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight">
                {kpiStats.totalAttempts}
              </div>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate">
                Sessions réalisées
              </p>
            </div>

            {/* KPI 2: Apprenants uniques */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-2xs space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">Apprenants Uniques</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs shrink-0">
                  <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight">
                {kpiStats.uniqueClients}
              </div>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate">
                Clients distincts
              </p>
            </div>

            {/* KPI 3: Taux de réussite */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-2xs space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">Taux de Réussite</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                  <CheckCircle2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight">
                {kpiStats.passRate}%
              </div>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate">
                <span className="font-bold text-emerald-600">{kpiStats.totalPassed}</span> session(s) validée(s)
              </p>
            </div>

            {/* KPI 4: Score moyen */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-2xs space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">Score Moyen</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                  <Target className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight flex items-baseline gap-1">
                <span>{kpiStats.avgScore}%</span>
                <span className="text-[10px] sm:text-xs font-bold text-gray-400">/ 100%</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate">
                Moyenne globale
              </p>
            </div>

            {/* KPI 5: Temps moyen */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-2xs space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">Temps Moyen</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs shrink-0">
                  <Clock className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight truncate">
                {kpiStats.avgTimeFormatted}
              </div>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate">
                Durée par tentative
              </p>
            </div>

            {/* KPI 6: Modules d'entraînement */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-2xs space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider truncate">Modules Actifs</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs shrink-0">
                  <BookOpen className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight">
                {trainingSessions.length}
              </div>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate">
                Au catalogue disponible
              </p>
            </div>

          </div>
        </section>

        {/* 4. Analyse des Performances */}
        <section className="space-y-4 sm:space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xs sm:text-sm font-extrabold text-gray-900 uppercase tracking-wider">
              4. Analyse des Performances
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

            {/* Chart 1: BarChart - Attempts & Average Score per Training */}
            <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-2xs space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>Performances par Séance</span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-500 font-medium">
                    Nombre de tentatives et score moyen par module d'entraînement.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="h-60 sm:h-72 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
              ) : sessionChartData.length === 0 ? (
                <div className="h-60 sm:h-72 flex flex-col items-center justify-center text-center text-gray-400 space-y-2">
                  <BarChart3 className="w-8 h-8 stroke-1" />
                  <p className="text-xs font-medium">Aucune donnée disponible pour ces filtres.</p>
                </div>
              ) : (
                <div className="h-60 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sessionChartData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 9, fill: '#64748b' }} 
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        tickFormatter={(val: string) => (val && val.length > 14 ? `${val.substring(0, 12)}...` : val)}
                      />
                      <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#64748b' }} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '11px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Bar yAxisId="left" dataKey="attemptsCount" name="Nombre d'essais" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={20} />
                      <Bar yAxisId="right" dataKey="avgScore" name="Note Moyenne (%)" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Chart 2: Donut Chart - Score Distribution */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-2xs space-y-3 sm:space-y-4">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-600" />
                  <span>Distribution des Scores</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium">
                  Répartition des apprenants par tranches de note (%)
                </p>
              </div>

              {loading ? (
                <div className="h-56 sm:h-64 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
              ) : filteredAttempts.length === 0 ? (
                <div className="h-56 sm:h-64 flex flex-col items-center justify-center text-center text-gray-400 space-y-2">
                  <Target className="w-8 h-8 stroke-1" />
                  <p className="text-xs font-medium">Aucune donnée disponible.</p>
                </div>
              ) : (
                <div className="h-56 sm:h-64 w-full relative flex flex-col justify-between">
                  <div className="h-40 sm:h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={scoreDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={68}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {scoreDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-gray-100 text-xs">
                    {scoreDistributionData.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-md shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-[10px] sm:text-[11px] font-bold text-gray-700 truncate">{item.name} :</span>
                        <span className="text-[10px] sm:text-[11px] font-extrabold text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Secondary Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            
            {/* Chart 3: AreaChart - Time series evolution */}
            <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-2xs space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span>Évolution dans le Temps</span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-500 font-medium">
                    Volume quotidien de sessions réalisées par les apprenants.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="h-48 sm:h-56 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
              ) : timeSeriesChartData.length === 0 ? (
                <div className="h-48 sm:h-56 flex items-center justify-center text-center text-gray-400 text-xs">
                  Aucune donnée d'évolution temporelle disponible.
                </div>
              ) : (
                <div className="h-48 sm:h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeriesChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorEssais" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                      <Area type="monotone" dataKey="Essais" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEssais)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Chart 4: QCM vs Code R comparison */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-2xs space-y-3 sm:space-y-4">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-purple-600" />
                  <span>Comparaison QCM / Code R</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium">
                  Volume de questions réussies ou échouées par typologie.
                </p>
              </div>

              {loading ? (
                <div className="h-48 sm:h-56 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
              ) : (
                <div className="h-48 sm:h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={exerciseTypePerformance} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="Réussis" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Échoués" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* 5. Liste des Tentatives */}
        <section className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-2xs overflow-hidden space-y-0">
          
          <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-xs sm:text-sm font-extrabold text-gray-900 uppercase tracking-wider">
                  5. Liste des Tentatives
                </h2>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 font-medium mt-1">
                Consultez chaque tentative effectuée avec l'accès au détail question par question.
              </p>
            </div>

            <div className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-100 shrink-0 self-start sm:self-auto">
              {filteredAttempts.length} tentative(s) affichée(s)
            </div>
          </div>

          {loading ? (
            <div className="p-8 sm:p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              <p className="text-xs font-medium">Chargement des participations des clients...</p>
            </div>
          ) : filteredAttempts.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-gray-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6 stroke-1" />
              </div>
              <p className="text-sm font-extrabold text-gray-700">Aucune participation trouvée</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Aucune séance d'entraînement ne correspond aux critères de recherche actuels.
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE CARD VIEW (Phones < md) */}
              <div className="block md:hidden divide-y divide-gray-100 bg-gray-50/40 p-2.5 space-y-3">
                {filteredAttempts.map((att) => {
                  const pass = att.is_passed;
                  const dateFormatted = new Date(att.completed_at).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div key={att.id} className="bg-white p-3.5 rounded-2xl border border-gray-200/80 shadow-2xs space-y-3">
                      {/* Top: Client Info + Score */}
                      <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {att.client_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-gray-900 truncate">
                              {att.client_name}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate">
                              {att.client_email}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`font-black text-sm px-2 py-0.5 rounded-lg ${
                            att.score_percentage >= 70 ? 'bg-emerald-50 text-emerald-700' :
                            att.score_percentage >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {att.score_percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Middle: Session Title & Info */}
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-gray-900 leading-snug">
                          {att.session_title}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                          <span className="font-mono">{dateFormatted}</span>
                          <span className="font-mono text-gray-700 font-semibold">{formatSeconds(att.time_spent_seconds)}</span>
                          {pass ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Validé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                              <XCircle className="w-3 h-3" /> Échoué
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Action Button */}
                      <button
                        type="button"
                        onClick={() => setSelectedAttemptModal(att)}
                        className="w-full min-h-[42px] px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-indigo-100/80"
                      >
                        <Eye className="w-4 h-4 text-indigo-600" />
                        <span>Consulter détail par question</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE VIEW (Screens >= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <th className="py-3.5 px-6">Client / Apprenant</th>
                      <th className="py-3.5 px-4">Entraînement</th>
                      <th className="py-3.5 px-4">Date & Heure</th>
                      <th className="py-3.5 px-4">Note (%)</th>
                      <th className="py-3.5 px-4">Statut</th>
                      <th className="py-3.5 px-4">Temps</th>
                      <th className="py-3.5 px-6 text-right">Détail par question</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-medium">
                    {filteredAttempts.map((att) => {
                      const pass = att.is_passed;
                      const dateFormatted = new Date(att.completed_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <tr key={att.id} className="hover:bg-indigo-50/30 transition-colors group">
                          
                          {/* Client Info */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                {att.client_name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                  {att.client_name}
                                </div>
                                <div className="text-[11px] text-gray-500 truncate max-w-[180px]">
                                  {att.client_email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Session Title */}
                          <td className="py-4 px-4 font-bold text-gray-800">
                            <div className="max-w-[200px] truncate" title={att.session_title}>
                              {att.session_title}
                            </div>
                          </td>

                          {/* Date */}
                          <td className="py-4 px-4 text-gray-600 text-[11px] font-mono">
                            {dateFormatted}
                          </td>

                          {/* Score (%) */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`font-black text-sm ${
                                att.score_percentage >= 70 ? 'text-emerald-600' :
                                att.score_percentage >= 50 ? 'text-amber-600' : 'text-rose-600'
                              }`}>
                                {att.score_percentage}%
                              </span>
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                                <div 
                                  className={`h-full rounded-full ${
                                    att.score_percentage >= 70 ? 'bg-emerald-500' :
                                    att.score_percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${att.score_percentage}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-4 px-4">
                            {pass ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Validé</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>Échoué</span>
                              </span>
                            )}
                          </td>

                          {/* Time Spent */}
                          <td className="py-4 px-4 text-gray-600 font-mono text-[11px]">
                            {formatSeconds(att.time_spent_seconds)}
                          </td>

                          {/* Detail Question par Question Button */}
                          <td className="py-4 px-6 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedAttemptModal(att)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition-all cursor-pointer active:scale-95"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Détail questions</span>
                            </button>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

      </div>

      {/* 6. Détail d'une Tentative (Modal) */}
      {selectedAttemptModal && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-gray-950/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedAttemptModal(null)}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-indigo-100 relative space-y-3.5 sm:space-y-4 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-md shadow-indigo-200">
                  <Brain className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] sm:text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider">
                    6. Détail d'une tentative
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-gray-900 truncate">
                    {selectedAttemptModal.client_name}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-500 font-medium truncate">
                    {selectedAttemptModal.session_title} • {new Date(selectedAttemptModal.completed_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAttemptModal(null)}
                className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all cursor-pointer shrink-0 min-w-[38px] min-h-[38px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Score Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs">
              <div>
                <span className="text-gray-500 font-semibold block text-[10px] sm:text-[11px]">Note globale</span>
                <span className={`font-black text-base sm:text-lg ${selectedAttemptModal.score_percentage >= 70 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {selectedAttemptModal.score_percentage}%
                </span>
              </div>
              <div>
                <span className="text-gray-500 font-semibold block text-[10px] sm:text-[11px]">Statut</span>
                <span className="font-bold text-gray-900 text-xs sm:text-sm block truncate">
                  {selectedAttemptModal.is_passed ? '🎉 Validé (≥70%)' : '❌ Non validé'}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-gray-500 font-semibold block text-[10px] sm:text-[11px]">Durée de l'essai</span>
                <span className="font-bold text-gray-900 font-mono text-xs sm:text-sm">
                  {formatSeconds(selectedAttemptModal.time_spent_seconds)}
                </span>
              </div>
            </div>

            {/* Questions List */}
            <div className="overflow-y-auto space-y-3 sm:space-y-4 flex-1 pr-1 my-1 custom-scrollbar">
              {(() => {
                const sessionObj = trainingSessions.find(s => s.id === selectedAttemptModal.training_session_id);
                const liveExercisesList = sessionObj?.exercises || [];
                const attemptRecords = selectedAttemptModal.exercise_attempts || [];

                if (attemptRecords.length === 0 && liveExercisesList.length === 0) {
                  return (
                    <div className="p-6 text-center text-gray-500 text-xs">
                      Aucune information détaillée sur les exercices n'a pu être retrouvée pour cet entraînement.
                    </div>
                  );
                }

                // Map attempts prioritizing snapshot_data, falling back to live exercises
                const itemsToRender = attemptRecords.length > 0 
                  ? attemptRecords 
                  : liveExercisesList.map(ex => ({
                      id: ex.id,
                      attempt_id: selectedAttemptModal.id,
                      exercise_id: ex.id,
                      score: 0,
                      is_correct: false,
                      answer_data: {},
                      snapshot_data: null
                    }));

                return itemsToRender.map((ea, idx) => {
                  const snap = ea.snapshot_data;
                  const liveEx = liveExercisesList.find(e => e.id === ea.exercise_id);

                  const isSnapshot = Boolean(snap);
                  const exerciseType = snap?.exercise_type || liveEx?.exercise_type || (ea.answer_data?.type === 'r_code' ? 'r_code' : 'qcm');
                  const title = snap?.title || liveEx?.title || `Exercice ${idx + 1}`;
                  const instructions = snap?.instructions || liveEx?.instructions || 'Énoncé de l\'exercice non disponible dans cette version d\'archivage.';
                  
                  const isCorrect = ea.is_correct || false;
                  const score = ea.score || 0;
                  const ansData = ea.answer_data || {};

                  // QCM specific fields
                  const qcmOptions: string[] = snap?.options || liveEx?.options || [];
                  const correctOptIdx = snap?.correct_option_index !== undefined ? snap.correct_option_index : liveEx?.correct_option_index;
                  const selectedOptIdx = snap?.selected_option_index !== undefined ? snap.selected_option_index : ansData?.selected_option_index;
                  const explanation = snap?.explanation || liveEx?.explanation;

                  // R code specific fields
                  const studentCode = snap?.student_code || ansData?.student_code || '';
                  const passedTests = snap?.passed_tests !== undefined ? snap.passed_tests : ansData?.passed_tests;
                  const totalTests = snap?.total_tests !== undefined ? snap.total_tests : ansData?.total_tests;

                  return (
                    <div key={ea.id || ea.exercise_id || idx} className="p-3.5 sm:p-4 bg-white rounded-2xl border border-gray-200/90 shadow-2xs space-y-2.5 sm:space-y-3">
                      
                      {/* Question Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-[10px] sm:text-xs flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-xs text-gray-900">
                            {title}
                          </span>
                          {isSnapshot ? (
                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase rounded-md border border-indigo-200/60" title="Contenu textuel figé et immuable au moment de la tentative">
                              📸 Snapshot
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 text-[9px] font-bold rounded-md border border-amber-200/60" title="Tentative antérieure à la mise en place des snapshots">
                              ⚠️ Hérité
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 self-start sm:self-auto">
                          {exerciseType === 'r_code' ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200/60 flex items-center gap-1">
                              <Code2 className="w-3 h-3 text-emerald-600" /> Code R
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-bold rounded-md border border-blue-200/60 flex items-center gap-1">
                              <HelpCircle className="w-3 h-3 text-blue-600" /> QCM
                            </span>
                          )}

                          {isCorrect ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-md flex items-center gap-1">
                              <Check className="w-3 h-3" /> Validé ({score}%)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-extrabold text-[10px] rounded-md flex items-center gap-1">
                              <X className="w-3 h-3" /> Échoué ({score}%)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Instructions */}
                      <p className="text-xs text-gray-700 leading-relaxed font-normal bg-gray-50/70 p-2.5 sm:p-3 rounded-xl border border-gray-100">
                        {instructions}
                      </p>

                      {/* Detail Answer Logic for QCM */}
                      {exerciseType === 'qcm' && qcmOptions.length > 0 && (
                        <div className="space-y-1.5 pt-1 text-xs">
                          <span className="font-extrabold text-gray-700 text-[11px] block">
                            Options du QCM & Réponse donnée :
                          </span>
                          <div className="grid grid-cols-1 gap-1.5">
                            {qcmOptions.map((opt, oIdx) => {
                              const isSelectedByClient = selectedOptIdx === oIdx;
                              const isCorrectOption = correctOptIdx === oIdx;

                              let bgStyle = 'bg-gray-50 border-gray-200 text-gray-700';
                              if (isSelectedByClient && isCorrectOption) {
                                bgStyle = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold';
                              } else if (isSelectedByClient && !isCorrectOption) {
                                bgStyle = 'bg-rose-50 border-rose-300 text-rose-900 font-bold';
                              } else if (isCorrectOption) {
                                bgStyle = 'bg-emerald-50/50 border-emerald-200 text-emerald-800';
                              }

                              return (
                                <div key={oIdx} className={`p-2 sm:p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 ${bgStyle}`}>
                                  <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                                    <span className="w-5 h-5 rounded-md bg-white text-gray-700 font-extrabold text-[10px] flex items-center justify-center border border-gray-200 shrink-0 mt-0.5 sm:mt-0">
                                      {String.fromCharCode(65 + oIdx)}
                                    </span>
                                    <span className="text-xs leading-snug">{opt}</span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                    {isSelectedByClient && (
                                      <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                                        Choix client
                                      </span>
                                    )}
                                    {isCorrectOption && (
                                      <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                        Bonne réponse
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {explanation && (
                            <div className="mt-2 p-2.5 sm:p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-indigo-900 text-xs font-medium">
                              <span className="font-extrabold block text-[11px] text-indigo-950 mb-0.5">Explication pédagogique :</span>
                              {explanation}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Detail Answer Logic for R Code */}
                      {exerciseType === 'r_code' && (
                        <div className="space-y-2 pt-1 text-xs">
                          <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                            <span className="font-bold text-gray-700">Moteur de validation WebR :</span>
                            <span className="font-extrabold text-indigo-700">
                              {passedTests !== undefined 
                                ? `${passedTests} / ${totalTests || 0} tests validés`
                                : 'Code exécuté'
                              }
                            </span>
                          </div>

                          {studentCode && (
                            <div className="space-y-1">
                              <span className="font-extrabold text-gray-700 text-[11px] block">Code R soumis par l'apprenant :</span>
                              <pre className="p-3 bg-gray-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto leading-relaxed border border-gray-800">
                                {studentCode}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedAttemptModal(null)}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm min-h-[44px]"
              >
                Fermer le bilan
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
