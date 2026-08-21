import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/Toast';
import {
  ArrowLeft,
  BookOpen,
  Layers,
  FileText,
  PlusCircle,
  Edit3,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Video,
  HelpCircle,
  Code2,
  Sparkles,
  ExternalLink,
  Lightbulb,
  Check,
  X,
  Maximize2,
  Play,
  Award,
  ShieldAlert,
  ChevronRight,
  Info,
  Eye
} from 'lucide-react';
import { MarkdownEditorModal } from '../components/MarkdownEditorModal';
import MarkdownRenderer, { normalizeHtmlToMarkdown } from '../components/MarkdownRenderer';
import { AdminRCriteriaBuilder } from '../components/AdminRCriteriaBuilder';
import { AdminRPackageSelector } from '../components/AdminRPackageSelector';
import { normalizeActivityPackages } from '../lib/rPackageManager';
import {
  RCorrectionCriterion,
  normalizeRCorrectionCriteria,
  createDefaultCriterion
} from '../lib/rCorrectionEngine';
import {
  InteractiveCourse,
  InteractiveCourseModule,
  InteractiveCourseLesson,
  InteractiveActivity,
  InteractiveActivityType
} from '../types';

interface QuizQuestionItem {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
}

export default function AdminInteractiveLessonActivities() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [course, setCourse] = useState<InteractiveCourse | null>(null);
  const [moduleData, setModuleData] = useState<InteractiveCourseModule | null>(null);
  const [lesson, setLesson] = useState<InteractiveCourseLesson | null>(null);
  const [activities, setActivities] = useState<InteractiveActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal State for Activity (Create / Edit)
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<InteractiveActivity | null>(null);
  const [selectedType, setSelectedType] = useState<InteractiveActivityType | null>(null);
  const [step, setStep] = useState<'select_type' | 'form'>('select_type');

  // Common Form Fields
  const [activityTitle, setActivityTitle] = useState('');
  const [activityInstructions, setActivityInstructions] = useState('');
  const [activityPoints, setActivityPoints] = useState<number>(10);
  const [activityIsRequired, setActivityIsRequired] = useState<boolean>(true);
  const [activityHints, setActivityHints] = useState<string[]>([]);
  const [newHintInput, setNewHintInput] = useState('');

  // Specific Form Fields
  // 1. Text
  const [textContent, setTextContent] = useState('');
  // 2. Video
  const [videoUrl, setVideoUrl] = useState('');
  // 3. Quiz (Multi-questions)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionItem[]>([]);
  // 4. Code R
  const [starterCode, setStarterCode] = useState('');
  const [rPackages, setRPackages] = useState<string[]>([]);
  const [rCriteria, setRCriteria] = useState<RCorrectionCriterion[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  // Deletion Modal
  const [activityToDelete, setActivityToDelete] = useState<InteractiveActivity | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reorder loading
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // Markdown Editor Modal for Text Content
  const [textActivityTab, setTextActivityTab] = useState<'edit' | 'preview'>('edit');
  const [isMarkdownModalOpen, setIsMarkdownModalOpen] = useState(false);

  useEffect(() => {
    if (courseId && lessonId) {
      fetchLessonAndActivities();
    }
  }, [courseId, lessonId]);

  const fetchLessonAndActivities = async () => {
    if (!courseId || !lessonId) return;

    try {
      setLoading(true);
      setLoadError(null);

      // 1. Fetch course details
      const { data: courseRes, error: courseErr } = await supabase
        .from('interactive_courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseErr) throw courseErr;
      setCourse(courseRes);

      // 2. Fetch lesson details with parent module
      const { data: lessonRes, error: lessonErr } = await supabase
        .from('interactive_course_lessons')
        .select(`
          *,
          interactive_course_modules (*)
        `)
        .eq('id', lessonId)
        .single();

      if (lessonErr) throw lessonErr;
      if (!lessonRes) throw new Error('Leçon introuvable');

      setLesson(lessonRes);
      setModuleData(lessonRes.interactive_course_modules || null);

      // 3. Fetch activities for this lesson
      const { data: activitiesRes, error: actErr } = await supabase
        .from('interactive_activities')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('position', { ascending: true });

      if (actErr) throw actErr;

      setActivities(activitiesRes || []);
    } catch (err: any) {
      console.error('Erreur chargement activités:', err);
      setLoadError(err?.message || 'Erreur lors du chargement de la leçon');
      toast.error('Impossible de charger les activités de la leçon.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to generate a new question item
  const createEmptyQuizQuestion = (): QuizQuestionItem => ({
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    question: '',
    options: ['', '', ''],
    correct_answer: 0
  });

  // Helper to normalize quiz questions from JSON config (backward compatible with single question format)
  const normalizeQuizQuestions = (config: any): QuizQuestionItem[] => {
    if (!config) {
      return [createEmptyQuizQuestion()];
    }

    // 1. New multi-questions format
    if (Array.isArray(config.questions) && config.questions.length > 0) {
      return config.questions.map((q: any, idx: number) => {
        const opts = Array.isArray(q.options) && q.options.length > 0
          ? q.options.map((o: any) => String(o ?? ''))
          : ['', '', ''];
        const rawAns = q.correct_answer ?? q.correctAnswerIndex ?? 0;
        const numAns = typeof rawAns === 'number' ? rawAns : parseInt(String(rawAns), 10) || 0;
        const validAns = Math.max(0, Math.min(numAns, opts.length - 1));
        return {
          id: `q_${idx}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          question: q.question || '',
          options: opts,
          correct_answer: validAns
        };
      });
    }

    // 2. Legacy single-question format
    if (config.question) {
      const opts = Array.isArray(config.options) && config.options.length > 0
        ? config.options.map((o: any) => String(o ?? ''))
        : ['', '', ''];
      const rawAns = config.correct_answer ?? config.correctAnswerIndex ?? 0;
      const numAns = typeof rawAns === 'number' ? rawAns : parseInt(String(rawAns), 10) || 0;
      const validAns = Math.max(0, Math.min(numAns, opts.length - 1));
      return [{
        id: `q_legacy_${Date.now()}`,
        question: config.question || '',
        options: opts,
        correct_answer: validAns
      }];
    }

    // 3. Fallback
    return [createEmptyQuizQuestion()];
  };

  // ==========================================
  // ACTIVITY CREATE / EDIT WORKFLOW
  // ==========================================

  const openCreateActivityModal = () => {
    setEditingActivity(null);
    setSelectedType(null);
    setStep('select_type');

    // Reset fields
    setActivityTitle('');
    setActivityInstructions('');
    setActivityPoints(10);
    setActivityIsRequired(true);
    setActivityHints([]);
    setNewHintInput('');

    setTextContent('');
    setVideoUrl('');
    setQuizQuestions([createEmptyQuizQuestion()]);
    setStarterCode('');
    setRPackages([]);
    setRCriteria([createDefaultCriterion('object_exists')]);

    setIsActivityModalOpen(true);
  };

  const handleSelectType = (type: InteractiveActivityType) => {
    setSelectedType(type);
    setStep('form');

    // Set smart default titles and hints if empty
    if (!activityTitle) {
      if (type === 'text') setActivityTitle('Présentation théorique');
      else if (type === 'video') setActivityTitle('Vidéo explicative');
      else if (type === 'quiz') setActivityTitle('Test de compréhension');
      else if (type === 'code_r') setActivityTitle('Exercice pratique R');
    }

    if (type === 'quiz' && quizQuestions.length === 0) {
      setQuizQuestions([createEmptyQuizQuestion()]);
    }

    if (type === 'code_r') {
      if (!starterCode) {
        setStarterCode('# Saisissez votre code R ici\n');
      }
      if (rCriteria.length === 0) {
        setRCriteria([createDefaultCriterion('object_exists')]);
      }
    }
  };

  const openEditActivityModal = (act: InteractiveActivity) => {
    setEditingActivity(act);
    setSelectedType(act.activity_type);
    setStep('form');

    // Common fields
    setActivityTitle(act.title || '');
    setActivityInstructions(act.instructions || '');
    setActivityPoints(act.points ?? 10);
    setActivityIsRequired(act.is_required ?? true);
    setActivityHints(Array.isArray(act.hints) ? act.hints : []);
    setNewHintInput('');

    // Specific fields
    const config = act.configuration || {};

    // 1. Text (Normalize HTML blocks to Markdown for backward compatibility)
    setTextContent(normalizeHtmlToMarkdown(config.content || ''));

    // 2. Video
    setVideoUrl(config.video_url || '');

    // 3. Quiz (Multi-questions normalization)
    setQuizQuestions(normalizeQuizQuestions(config));

    // 4. Code R
    setStarterCode(config.starter_code || '');
    setRPackages(normalizeActivityPackages(config));
    setRCriteria(normalizeRCorrectionCriteria(config));

    setIsActivityModalOpen(true);
  };

  const handleAddHint = () => {
    const cleanHint = newHintInput.trim();
    if (!cleanHint) return;
    setActivityHints(prev => [...prev, cleanHint]);
    setNewHintInput('');
  };

  const handleRemoveHint = (index: number) => {
    setActivityHints(prev => prev.filter((_, i) => i !== index));
  };

  // ==========================================
  // QUIZ MULTI-QUESTIONS HANDLERS
  // ==========================================

  const handleAddQuizQuestion = () => {
    setQuizQuestions(prev => [...prev, createEmptyQuizQuestion()]);
  };

  const handleRemoveQuizQuestion = (qIndex: number) => {
    if (quizQuestions.length <= 1) {
      toast.error('Le QCM doit comporter au moins 1 question.');
      return;
    }
    setQuizQuestions(prev => prev.filter((_, i) => i !== qIndex));
  };

  const handleMoveQuizQuestion = (qIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? qIndex - 1 : qIndex + 1;
    if (targetIndex < 0 || targetIndex >= quizQuestions.length) return;
    const updated = [...quizQuestions];
    const [moved] = updated.splice(qIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setQuizQuestions(updated);
  };

  const handleQuizQuestionTextChange = (qIndex: number, text: string) => {
    setQuizQuestions(prev => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], question: text };
      return next;
    });
  };

  const handleAddOptionToQuestion = (qIndex: number) => {
    setQuizQuestions(prev => {
      const next = [...prev];
      const currentOpts = next[qIndex].options || [];
      if (currentOpts.length >= 8) {
        toast.error('Vous pouvez ajouter jusqu\'à 8 réponses au maximum par question.');
        return prev;
      }
      next[qIndex] = {
        ...next[qIndex],
        options: [...currentOpts, '']
      };
      return next;
    });
  };

  const handleRemoveOptionFromQuestion = (qIndex: number, optIndex: number) => {
    setQuizQuestions(prev => {
      const next = [...prev];
      const currentOpts = next[qIndex].options || [];
      if (currentOpts.length <= 2) {
        toast.error('Une question doit comporter au moins 2 réponses.');
        return prev;
      }
      const newOptions = currentOpts.filter((_, i) => i !== optIndex);
      let newCorrect = next[qIndex].correct_answer;
      if (newCorrect >= newOptions.length) {
        newCorrect = Math.max(0, newOptions.length - 1);
      }
      next[qIndex] = {
        ...next[qIndex],
        options: newOptions,
        correct_answer: newCorrect
      };
      return next;
    });
  };

  const handleOptionChangeForQuestion = (qIndex: number, optIndex: number, val: string) => {
    setQuizQuestions(prev => {
      const next = [...prev];
      const newOpts = [...next[qIndex].options];
      newOpts[optIndex] = val;
      next[qIndex] = { ...next[qIndex], options: newOpts };
      return next;
    });
  };

  const handleSetCorrectAnswerForQuestion = (qIndex: number, optIndex: number) => {
    setQuizQuestions(prev => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], correct_answer: optIndex };
      return next;
    });
  };

  // ==========================================
  // SAVE ACTIVITY
  // ==========================================

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonId || !selectedType) return;

    const cleanTitle = activityTitle.trim();
    if (!cleanTitle) {
      toast.error('Veuillez saisir un titre pour l\'activité.');
      return;
    }

    // Prepare configuration based on activity type
    let configuration: any = {};

    if (selectedType === 'text') {
      const cleanContent = textContent.trim();
      if (!cleanContent) {
        toast.error('Veuillez saisir le contenu textuel de l\'activité.');
        return;
      }
      configuration = { content: cleanContent };
    } else if (selectedType === 'video') {
      const cleanUrl = videoUrl.trim();
      if (!cleanUrl) {
        toast.error('Veuillez renseigner l\'URL de la vidéo YouTube.');
        return;
      }
      if (!cleanUrl.includes('youtube') && !cleanUrl.includes('youtu.be')) {
        toast.error('L\'URL doit être un lien YouTube valide (ex: https://www.youtube.com/watch?v=...).');
        return;
      }
      configuration = { video_url: cleanUrl };
    } else if (selectedType === 'quiz') {
      if (!quizQuestions || quizQuestions.length === 0) {
        toast.error('Veuillez ajouter au moins une question au QCM.');
        return;
      }

      // Validate each question
      for (let i = 0; i < quizQuestions.length; i++) {
        const q = quizQuestions[i];
        const qNum = i + 1;
        const cleanQ = q.question.trim();
        if (!cleanQ) {
          toast.error(`Question ${qNum} : veuillez saisir l'énoncé de la question.`);
          return;
        }

        const validOptions = (q.options || []).map(opt => opt.trim());
        if (validOptions.length < 2) {
          toast.error(`Question ${qNum} : veuillez fournir au moins 2 options de réponse.`);
          return;
        }

        if (validOptions.some(opt => !opt)) {
          toast.error(`Question ${qNum} : veuillez renseigner toutes les options de réponse.`);
          return;
        }

        if (q.correct_answer < 0 || q.correct_answer >= validOptions.length) {
          toast.error(`Question ${qNum} : veuillez sélectionner la bonne réponse.`);
          return;
        }
      }

      configuration = {
        questions: quizQuestions.map(q => ({
          question: q.question.trim(),
          options: q.options.map(opt => opt.trim()),
          correct_answer: q.correct_answer
        }))
      };
    } else if (selectedType === 'code_r') {
      const cleanInstructions = activityInstructions.trim();
      if (!cleanInstructions) {
        toast.error('Veuillez rédiger les instructions de l\'exercice R.');
        return;
      }

      // Validate R correction criteria if any exist
      if (rCriteria.length > 0) {
        for (let i = 0; i < rCriteria.length; i++) {
          const crit = rCriteria[i];
          const critNum = i + 1;

          if (
            ['object_exists', 'object_value', 'object_result', 'object_class', 'object_length', 'rows', 'columns', 'column_exists'].includes(crit.type)
          ) {
            if (!crit.object || !crit.object.trim()) {
              toast.error(`Critère ${critNum} : veuillez renseigner le nom de l'objet R.`);
              return;
            }
          }

          if (crit.type === 'object_value' || crit.type === 'object_result') {
            if (crit.expected === undefined || String(crit.expected).trim() === '') {
              toast.error(`Critère ${critNum} : veuillez renseigner la valeur attendue.`);
              return;
            }
          }

          if (crit.type === 'column_exists') {
            if (!crit.column || !crit.column.trim()) {
              toast.error(`Critère ${critNum} : veuillez renseigner le nom de la colonne attendue.`);
              return;
            }
          }

          if (crit.type === 'expression') {
            if (!crit.expression || !crit.expression.trim()) {
              toast.error(`Critère ${critNum} : veuillez renseigner l'expression R à évaluer.`);
              return;
            }
          }
        }
      }

      configuration = {
        starter_code: starterCode.trim() || '# Votre code R ici\n',
        packages: rPackages || [],
        correction: {
          tests: rCriteria.map(c => ({
            id: c.id,
            type: c.type,
            required: c.required !== false,
            object: c.object?.trim() || undefined,
            expected: c.expected !== undefined ? c.expected : undefined,
            expected_class: c.expected_class || undefined,
            length: c.length !== undefined ? Number(c.length) : undefined,
            rows: c.rows !== undefined ? Number(c.rows) : undefined,
            columns: c.columns !== undefined ? Number(c.columns) : undefined,
            column: c.column?.trim() || undefined,
            expression: c.expression?.trim() || undefined,
            description: c.description?.trim() || undefined
          }))
        }
      };
    }

    try {
      setIsSaving(true);
      const now = new Date().toISOString();

      if (editingActivity) {
        // UPDATE Activity
        const { error } = await supabase
          .from('interactive_activities')
          .update({
            activity_type: selectedType,
            title: cleanTitle,
            instructions: activityInstructions.trim() || null,
            is_required: activityIsRequired,
            points: Number(activityPoints) >= 0 ? Number(activityPoints) : 10,
            configuration,
            hints: activityHints,
            updated_at: now
          })
          .eq('id', editingActivity.id);

        if (error) throw error;

        setActivities(prev =>
          prev.map(act =>
            act.id === editingActivity.id
              ? {
                  ...act,
                  activity_type: selectedType,
                  title: cleanTitle,
                  instructions: activityInstructions.trim() || '',
                  is_required: activityIsRequired,
                  points: Number(activityPoints) >= 0 ? Number(activityPoints) : 10,
                  configuration,
                  hints: activityHints,
                  updated_at: now
                }
              : act
          )
        );

        toast.success('✓ Modifications de l\'activité enregistrées');
      } else {
        // INSERT Activity
        const nextPosition = activities.length > 0
          ? Math.max(...activities.map(a => a.position || 0)) + 1
          : 1;

        const { data, error } = await supabase
          .from('interactive_activities')
          .insert([
            {
              lesson_id: lessonId,
              activity_type: selectedType,
              title: cleanTitle,
              instructions: activityInstructions.trim() || null,
              position: nextPosition,
              is_required: activityIsRequired,
              points: Number(activityPoints) >= 0 ? Number(activityPoints) : 10,
              configuration,
              hints: activityHints,
              updated_at: now
            }
          ])
          .select()
          .single();

        if (error) throw error;

        setActivities(prev => [...prev, data]);
        toast.success('✓ Activité créée');
      }

      setIsActivityModalOpen(false);
    } catch (err: any) {
      console.error('Erreur enregistrement activité:', err);
      toast.error('Impossible d\'enregistrer l\'activité : ' + (err?.message || 'Erreur'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveActivity = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activities.length) return;

    const currentAct = activities[index];
    const targetAct = activities[targetIndex];

    try {
      setReorderingId(currentAct.id);

      const currentPos = currentAct.position;
      const targetPos = targetAct.position;

      // Optimistic update
      const updated = [...activities];
      updated[index] = { ...targetAct, position: currentPos };
      updated[targetIndex] = { ...currentAct, position: targetPos };
      setActivities(updated);

      // Persist in Supabase
      const [res1, res2] = await Promise.all([
        supabase
          .from('interactive_activities')
          .update({ position: targetPos, updated_at: new Date().toISOString() })
          .eq('id', currentAct.id),
        supabase
          .from('interactive_activities')
          .update({ position: currentPos, updated_at: new Date().toISOString() })
          .eq('id', targetAct.id)
      ]);

      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;

      toast.success('Ordre des activités mis à jour');
    } catch (err: any) {
      console.error('Erreur réorganisation:', err);
      toast.error('Impossible de modifier l\'ordre des activités.');
      fetchLessonAndActivities();
    } finally {
      setReorderingId(null);
    }
  };

  const handleDeleteActivity = async () => {
    if (!activityToDelete) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('interactive_activities')
        .delete()
        .eq('id', activityToDelete.id);

      if (error) throw error;

      setActivities(prev => prev.filter(a => a.id !== activityToDelete.id));
      toast.success('Activité supprimée avec succès');
      setActivityToDelete(null);
    } catch (err: any) {
      console.error('Erreur suppression activité:', err);
      toast.error('Impossible de supprimer l\'activité.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getYoutubeEmbedUrl = (rawUrl: string): string => {
    if (!rawUrl) return '';
    try {
      const trimmed = rawUrl.trim();
      if (trimmed.includes('youtu.be/')) {
        const id = trimmed.split('youtu.be/')[1]?.split(/[?#]/)[0];
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = trimmed.match(regExp);
      if (match && match[2] && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}`;
      }
    } catch (e) {
      console.error('Erreur conversion YouTube URL:', e);
    }
    return rawUrl;
  };

  const stripHtmlOrMarkdown = (text?: string | null): string => {
    if (!text) return '';
    return text.replace(/<[^>]*>?/gm, '').replace(/[#*_~`]/g, '').trim();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">Chargement des activités de la leçon...</p>
        </div>
      </div>
    );
  }

  if (loadError || !lesson || !course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">Impossible de charger la leçon</h2>
          <p className="text-xs text-gray-500 mb-6">{loadError || 'Leçon introuvable'}</p>
          <Link
            to={`/admin/interactive-courses/${courseId}/content`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour au contenu du cours</span>
          </Link>
        </div>
      </div>
    );
  }

  const totalPoints = activities.reduce((acc, a) => acc + (a.points || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 pt-2 px-3 sm:px-6 lg:px-8 font-sans pb-24 w-full">
      <div className="max-w-4xl w-full mx-auto space-y-6">

        {/* 1. Header with Hierarchical Breadcrumbs */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(`/admin/interactive-courses/${courseId}/content`)}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all flex items-center justify-center shrink-0"
                title="Retour aux modules et leçons"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="min-w-0">
                {/* Hierarchical Breadcrumb */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 font-medium mb-1">
                  <Link
                    to="/admin/interactive-courses"
                    className="hover:text-sky-600 transition-colors truncate max-w-[120px] xs:max-w-[160px]"
                  >
                    {course.title}
                  </Link>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  {moduleData && (
                    <>
                      <span className="truncate max-w-[120px] xs:max-w-[160px] text-gray-600">
                        {moduleData.title}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    </>
                  )}
                  <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100">
                    Leçon : {lesson.title}
                  </span>
                </div>

                <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                  <span>Activités de la leçon</span>
                </h1>
              </div>
            </div>

            {/* Top Quick Actions */}
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={openCreateActivityModal}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-sm transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Ajouter une activité</span>
              </button>
            </div>
          </div>

          {/* Lesson summary metadata */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs font-semibold text-gray-600 bg-gray-50/80 px-4 py-3 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-sky-600" />
              <span>Durée estimée : {lesson.estimated_duration || 15} min</span>
            </div>
            <div className="h-3 w-[1px] bg-gray-200 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-sky-600" />
              <span>{activities.length} activité{activities.length > 1 ? 's' : ''}</span>
            </div>
            <div className="h-3 w-[1px] bg-gray-200 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Total : {totalPoints} points</span>
            </div>
          </div>
        </div>

        {/* 2. Activities List Section Header */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-600" />
              <span>Séquence des activités</span>
            </h2>
            <p className="text-xs text-gray-500">
              Les apprenants suivront ces activités dans l'ordre défini ci-dessous.
            </p>
          </div>

          {activities.length > 0 && (
            <button
              type="button"
              onClick={openCreateActivityModal}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-bold rounded-xl text-xs transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Activité</span>
            </button>
          )}
        </div>

        {/* 3. Empty State : Aucune activité */}
        {activities.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-8 sm:p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-gray-900 mb-2">
              Cette leçon ne contient encore aucune activité.
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mb-6 max-w-md mx-auto leading-relaxed">
              Ajoutez du texte explicatif, une vidéo YouTube, un quiz QCM ou un exercice pratique de code R.
            </p>
            <button
              type="button"
              onClick={openCreateActivityModal}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl shadow-sm transition-all active:scale-95 text-sm"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Ajouter une première activité</span>
            </button>
          </div>
        ) : (
          /* 4. Activities Cards List */
          <div className="space-y-4">
            {activities.map((act, index) => {
              const isFirst = index === 0;
              const isLast = index === activities.length - 1;
              const isReordering = reorderingId === act.id;
              const config = act.configuration || {};

              // Normalize questions count for preview
              const quizCount = Array.isArray(config.questions) 
                ? config.questions.length 
                : config.question 
                ? 1 
                : 0;

              return (
                <div
                  key={act.id}
                  className="bg-white border border-gray-100 hover:border-sky-200 rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4 group"
                >
                  {/* Left: Position Badge & Activity Main Info */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Index Badge */}
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-sky-50 text-sky-700 font-extrabold text-xs sm:text-sm flex items-center justify-center shrink-0 mt-0.5 border border-sky-100">
                      {String(index + 1).padStart(2, '0')}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Top Type & Badges Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Type Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold uppercase tracking-wider ${
                            act.activity_type === 'text'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : act.activity_type === 'video'
                              ? 'bg-rose-50 text-rose-700 border border-rose-100'
                              : act.activity_type === 'quiz'
                              ? 'bg-purple-50 text-purple-700 border border-purple-100'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}
                        >
                          {act.activity_type === 'text' && <FileText className="w-3.5 h-3.5" />}
                          {act.activity_type === 'video' && <Video className="w-3.5 h-3.5" />}
                          {act.activity_type === 'quiz' && <HelpCircle className="w-3.5 h-3.5" />}
                          {act.activity_type === 'code_r' && <Code2 className="w-3.5 h-3.5" />}
                          <span>
                            {act.activity_type === 'text'
                              ? 'Texte'
                              : act.activity_type === 'video'
                              ? 'Vidéo'
                              : act.activity_type === 'quiz'
                              ? `QCM (${quizCount} question${quizCount > 1 ? 's' : ''})`
                              : 'Code R'}
                          </span>
                        </span>

                        {/* Points Badge */}
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {act.points || 0} pts
                        </span>

                        {/* Required Tag */}
                        {act.is_required && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-700">
                            Obligatoire
                          </span>
                        )}

                        {/* Hints count */}
                        {Array.isArray(act.hints) && act.hints.length > 0 && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" />
                            <span>{act.hints.length} indice{act.hints.length > 1 ? 's' : ''}</span>
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight break-words group-hover:text-sky-700 transition-colors">
                        {act.title}
                      </h3>

                      {/* Instructions */}
                      {act.instructions && (
                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                          {act.instructions}
                        </p>
                      )}

                      {/* Content Preview based on type */}
                      <div className="pt-1">
                        {act.activity_type === 'text' && config.content && (
                          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-600 line-clamp-2 italic leading-relaxed">
                            "{stripHtmlOrMarkdown(config.content)}"
                          </div>
                        )}

                        {act.activity_type === 'video' && config.video_url && (
                          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50/60 p-2.5 rounded-2xl border border-rose-100">
                            <Play className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span className="truncate font-medium">{config.video_url}</span>
                          </div>
                        )}

                        {act.activity_type === 'quiz' && (
                          <div className="p-3 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-1.5">
                            {Array.isArray(config.questions) && config.questions.length > 0 ? (
                              <div>
                                <p className="text-xs font-bold text-purple-900">
                                  {config.questions.length} question{config.questions.length > 1 ? 's' : ''} configurée{config.questions.length > 1 ? 's' : ''} :
                                </p>
                                <p className="text-xs text-purple-700 truncate mt-0.5">
                                  1. {config.questions[0]?.question || 'Question 1'}
                                </p>
                              </div>
                            ) : config.question ? (
                              <div>
                                <p className="text-xs font-bold text-purple-900 line-clamp-1">
                                  Question : {config.question}
                                </p>
                                {Array.isArray(config.options) && (
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {config.options.map((opt: string, optIdx: number) => {
                                      const isCorrect = (config.correct_answer === optIdx || config.correctAnswerIndex === optIdx);
                                      return (
                                        <span
                                          key={optIdx}
                                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                            isCorrect
                                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                              : 'bg-white text-gray-600 border border-gray-200'
                                          }`}
                                        >
                                          {isCorrect ? '✓ ' : ''}{opt || `Option ${optIdx + 1}`}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-purple-600 italic">Quiz non configuré</p>
                            )}
                          </div>
                        )}

                        {act.activity_type === 'code_r' && (
                          <div className="space-y-2">
                            {/* Packages badges if any */}
                            {Array.isArray(config.packages) && config.packages.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-bold text-sky-900 bg-sky-100 border border-sky-200 px-2 py-0.5 rounded-md">
                                  📦 {config.packages.length} package{config.packages.length > 1 ? 's' : ''} :
                                </span>
                                {config.packages.map((pkg: string) => (
                                  <span
                                    key={pkg}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200"
                                  >
                                    {pkg}
                                  </span>
                                ))}
                              </div>
                            )}

                            {Array.isArray(config.correction?.tests) && config.correction.tests.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <Sparkles className="w-3 h-3 text-emerald-600" />
                                  <span>{config.correction.tests.length} critère{config.correction.tests.length > 1 ? 's' : ''} de correction auto</span>
                                </span>
                                {config.correction.tests.slice(0, 3).map((t: any, ti: number) => (
                                  <span key={ti} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                    {t.type} {t.object ? `(${t.object})` : ''}
                                  </span>
                                ))}
                                {config.correction.tests.length > 3 && (
                                  <span className="text-[10px] text-gray-400 font-medium">
                                    +{config.correction.tests.length - 3} autre(s)
                                  </span>
                                )}
                              </div>
                            )}

                            {config.starter_code && (
                              <pre className="p-2.5 bg-slate-900 text-sky-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-24 leading-relaxed">
                                {config.starter_code}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Controls & Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
                    {/* Move Up */}
                    <button
                      type="button"
                      onClick={() => handleMoveActivity(index, 'up')}
                      disabled={isFirst || isReordering}
                      className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                      title="Monter l'activité"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      onClick={() => handleMoveActivity(index, 'down')}
                      disabled={isLast || isReordering}
                      className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                      title="Descendre l'activité"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    <div className="h-4 w-[1px] bg-gray-200 mx-0.5" />

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => openEditActivityModal(act)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-sky-50 text-gray-700 hover:text-sky-700 border border-gray-200 hover:border-sky-200 rounded-xl text-xs font-bold transition-colors"
                      title="Modifier cette activité"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                      <span>Modifier</span>
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => setActivityToDelete(act)}
                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Supprimer cette activité"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Bottom Add Activity Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={openCreateActivityModal}
                className="w-full py-4 px-4 bg-white hover:bg-sky-50 text-gray-700 hover:text-sky-700 border-2 border-dashed border-gray-200 hover:border-sky-300 rounded-3xl text-sm font-extrabold transition-all shadow-xs flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-5 h-5 text-sky-600" />
                <span>+ Ajouter une activité</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 5. MODAL : CRÉER / MODIFIER UNE ACTIVITÉ            */}
      {/* ==================================================== */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase text-sky-700 tracking-wider">
                  Leçon : {lesson.title}
                </div>
                <h3 className="text-base font-extrabold text-gray-900 mt-0.5">
                  {editingActivity
                    ? 'Modifier l\'activité'
                    : step === 'select_type'
                    ? 'Nouvelle activité : Choisir le type'
                    : `Créer une activité : ${
                        selectedType === 'text'
                          ? 'Texte'
                          : selectedType === 'video'
                          ? 'Vidéo YouTube'
                          : selectedType === 'quiz'
                          ? 'QCM'
                          : 'Code R'
                      }`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsActivityModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* STEP 1: TYPE SELECTION */}
            {step === 'select_type' && !editingActivity ? (
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <p className="text-xs text-gray-500">
                  Sélectionnez le format pédagogique le plus adapté pour cette activité :
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Card 1: Texte */}
                  <button
                    type="button"
                    onClick={() => handleSelectType('text')}
                    className="p-4 bg-white hover:bg-blue-50/60 border-2 border-gray-100 hover:border-blue-300 rounded-2xl text-left transition-all group flex flex-col justify-between space-y-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-700">
                        📖 Texte
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Présenter une notion, cours théorique ou consignes écrites.
                      </p>
                    </div>
                  </button>

                  {/* Card 2: Vidéo */}
                  <button
                    type="button"
                    onClick={() => handleSelectType('video')}
                    className="p-4 bg-white hover:bg-rose-50/60 border-2 border-gray-100 hover:border-rose-300 rounded-2xl text-left transition-all group flex flex-col justify-between space-y-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 group-hover:text-rose-700">
                        🎥 Vidéo YouTube
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Intégrer une vidéo explicative depuis un lien YouTube.
                      </p>
                    </div>
                  </button>

                  {/* Card 3: QCM */}
                  <button
                    type="button"
                    onClick={() => handleSelectType('quiz')}
                    className="p-4 bg-white hover:bg-purple-50/60 border-2 border-gray-100 hover:border-purple-300 rounded-2xl text-left transition-all group flex flex-col justify-between space-y-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 group-hover:text-purple-700">
                        🧠 QCM (Multi-questions)
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Créer une ou plusieurs questions avec choix multiples et validation.
                      </p>
                    </div>
                  </button>

                  {/* Card 4: Code R */}
                  <button
                    type="button"
                    onClick={() => handleSelectType('code_r')}
                    className="p-4 bg-white hover:bg-emerald-50/60 border-2 border-gray-100 hover:border-emerald-300 rounded-2xl text-left transition-all group flex flex-col justify-between space-y-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Code2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700">
                        💻 Code R
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Faire écrire et exécuter du code R avec un modèle initial.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 2: FORM FOR SELECTED TYPE */
              <form onSubmit={handleSaveActivity} className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* Back to Type Selection (only when creating) */}
                {!editingActivity && (
                  <button
                    type="button"
                    onClick={() => setStep('select_type')}
                    className="text-xs text-sky-600 hover:text-sky-700 font-bold flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Changer de type d'activité</span>
                  </button>
                )}

                {/* 1. Titre de l'activité */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Titre de l'activité <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={activityTitle}
                    onChange={e => setActivityTitle(e.target.value)}
                    placeholder="Ex: Quiz — Les bases de R"
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>

                {/* 2. Instructions générales */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Instructions / Consignes {selectedType === 'code_r' && <span className="text-rose-500">*</span>}
                  </label>
                  <textarea
                    value={activityInstructions}
                    onChange={e => setActivityInstructions(e.target.value)}
                    rows={2}
                    placeholder={
                      selectedType === 'code_r'
                        ? 'Ex: Créez un vecteur nommé "scores" contenant les valeurs 12, 15 et 18, puis calculez sa moyenne avec mean().'
                        : 'Instructions facultatives affichées au-dessus du contenu...'
                    }
                    required={selectedType === 'code_r'}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>

                {/* 3. TYPE SPECIFIC FIELDS */}

                {/* === TYPE: TEXT === */}
                {selectedType === 'text' && (
                  <div className="space-y-3 p-4 sm:p-5 bg-blue-50/40 rounded-3xl border border-blue-100">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100/80 pb-3">
                      <div>
                        <label className="block text-xs font-extrabold text-blue-900 uppercase tracking-wider">
                          Contenu de l'activité (Markdown) <span className="text-rose-500">*</span>
                        </label>
                        <p className="text-[11px] text-blue-700">
                          Supporte les titres, listes, code R, citations et liens.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Tab Switcher: Édition / Aperçu */}
                        <div className="flex items-center p-1 bg-blue-100/80 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setTextActivityTab('edit')}
                            className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1 ${
                              textActivityTab === 'edit'
                                ? 'bg-white text-blue-800 shadow-xs'
                                : 'text-blue-700 hover:text-blue-900'
                            }`}
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Édition</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextActivityTab('preview')}
                            className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1 ${
                              textActivityTab === 'preview'
                                ? 'bg-white text-emerald-800 shadow-xs'
                                : 'text-blue-700 hover:text-blue-900'
                            }`}
                          >
                            <Eye className="w-3 h-3" />
                            <span>Aperçu</span>
                          </button>
                        </div>

                        {/* Grand Éditeur Modal Trigger */}
                        <button
                          type="button"
                          onClick={() => setIsMarkdownModalOpen(true)}
                          className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs flex items-center gap-1 active:scale-95"
                          title="Ouvrir l'éditeur grand écran"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Grand éditeur</span>
                        </button>
                      </div>
                    </div>

                    {textActivityTab === 'edit' ? (
                      <div className="space-y-2">
                        {/* Markdown Helper Toolbar */}
                        <div className="flex flex-wrap items-center gap-1 bg-white p-2 rounded-xl border border-blue-200/80 select-none text-xs">
                          <button
                            type="button"
                            onClick={() => setTextContent(prev => prev + '\n# Titre 1\n')}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-bold transition-colors"
                            title="Titre 1"
                          >
                            # H1
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextContent(prev => prev + '\n## Titre 2\n')}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-bold transition-colors"
                            title="Titre 2"
                          >
                            ## H2
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextContent(prev => prev + ' **texte en gras** ')}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-bold transition-colors"
                            title="Texte en gras"
                          >
                            **Gras**
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextContent(prev => prev + ' *italique* ')}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-bold transition-colors"
                            title="Texte en italique"
                          >
                            *Italique*
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextContent(prev => prev + '\n* Élément 1\n* Élément 2\n')}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-bold transition-colors"
                            title="Liste à puces"
                          >
                            * Liste
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextContent(prev => prev + '\n```r\nx <- c(10, 20, 30)\nmean(x)\n```\n')}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-emerald-400 font-mono rounded-lg font-bold transition-colors"
                            title="Bloc de code R"
                          >
                            ```r Code R
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextContent(prev => prev + '\n> Citation importante\n')}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-bold transition-colors"
                            title="Citation"
                          >
                            &gt; Citation
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextContent(prev => prev + ' [Lien](https://example.com) ')}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-bold transition-colors"
                            title="Lien"
                          >
                            [Lien]
                          </button>
                        </div>

                        <textarea
                          value={textContent}
                          onChange={e => setTextContent(e.target.value)}
                          rows={8}
                          placeholder="# Bienvenue dans R&#10;&#10;Rédigez vos explications ici en Markdown..."
                          required
                          className="w-full px-4 py-3 bg-white border border-blue-200 rounded-2xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono leading-relaxed"
                        />
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-blue-200 p-5 sm:p-6 shadow-xs max-h-[400px] overflow-y-auto">
                        <div className="mb-3 pb-2 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400">
                          <span>Aperçu en direct (Rendu apprenant)</span>
                          <span className="text-emerald-600 font-semibold">✓ Formaté</span>
                        </div>
                        {textContent.trim() ? (
                          <MarkdownRenderer content={textContent} isDark={false} />
                        ) : (
                          <p className="text-xs text-slate-400 italic text-center py-6">
                            Saisissez du contenu en mode Édition pour afficher l'aperçu.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* === TYPE: VIDEO === */}
                {selectedType === 'video' && (
                  <div className="space-y-3 p-4 bg-rose-50/40 rounded-2xl border border-rose-100">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-rose-900 uppercase tracking-wider">
                        Lien YouTube <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={videoUrl}
                        onChange={e => setVideoUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX"
                        required
                        className="w-full px-4 py-3 bg-white border border-rose-200 rounded-2xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                      />
                      <p className="text-[11px] text-rose-700">
                        Insérez le lien de visionnage standard ou de partage YouTube.
                      </p>
                    </div>

                    {/* Live Video Embed Preview */}
                    {videoUrl && (videoUrl.includes('youtube') || videoUrl.includes('youtu.be')) && (
                      <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-rose-200 shadow-inner">
                        <iframe
                          src={getYoutubeEmbedUrl(videoUrl)}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title="Aperçu vidéo YouTube"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* === TYPE: QUIZ (MULTI-QUESTIONS) === */}
                {selectedType === 'quiz' && (
                  <div className="space-y-4 p-3.5 sm:p-5 bg-purple-50/40 rounded-3xl border border-purple-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-black text-purple-900 uppercase tracking-wider">
                          Questions du QCM <span className="text-rose-500">*</span>
                        </label>
                        <p className="text-[11px] text-purple-700">
                          {quizQuestions.length} question{quizQuestions.length > 1 ? 's' : ''} dans ce quiz.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddQuizQuestion}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>+ Question</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {quizQuestions.map((q, qIndex) => {
                        const isFirst = qIndex === 0;
                        const isLast = qIndex === quizQuestions.length - 1;

                        return (
                          <div
                            key={q.id || qIndex}
                            className="p-4 sm:p-5 bg-white border border-purple-200/90 rounded-2xl shadow-xs space-y-4 transition-all"
                          >
                            {/* Question Card Header */}
                            <div className="flex items-center justify-between border-b border-purple-50 pb-3">
                              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-xl text-xs font-black uppercase tracking-wider">
                                Question {qIndex + 1}
                              </span>

                              <div className="flex items-center gap-1">
                                {/* Move Up */}
                                {quizQuestions.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveQuizQuestion(qIndex, 'up')}
                                    disabled={isFirst}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                                    title="Monter la question"
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </button>
                                )}

                                {/* Move Down */}
                                {quizQuestions.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveQuizQuestion(qIndex, 'down')}
                                    disabled={isLast}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                                    title="Descendre la question"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </button>
                                )}

                                {/* Delete Question */}
                                {quizQuestions.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveQuizQuestion(qIndex)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                                    title="Supprimer cette question"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span className="hidden xs:inline">Supprimer</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Question Statement Input */}
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                                Question : <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={q.question}
                                onChange={e => handleQuizQuestionTextChange(qIndex, e.target.value)}
                                placeholder="Ex: Quel est le rôle de mean() ?"
                                required
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                              />
                            </div>

                            {/* Options List */}
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                                  Réponses : (Cochez la bonne réponse) <span className="text-rose-500">*</span>
                                </label>
                                <span className="text-[10px] text-purple-700 font-semibold">
                                  {q.options.length} réponse{q.options.length > 1 ? 's' : ''}
                                </span>
                              </div>

                              <div className="space-y-2">
                                {q.options.map((opt, optIndex) => {
                                  const isCorrect = q.correct_answer === optIndex;

                                  return (
                                    <div
                                      key={optIndex}
                                      className={`p-2 bg-gray-50/90 border rounded-xl flex items-center gap-2 transition-all ${
                                        isCorrect
                                          ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/30'
                                          : 'border-gray-200'
                                      }`}
                                    >
                                      {/* Radio for Correct Answer */}
                                      <button
                                        type="button"
                                        onClick={() => handleSetCorrectAnswerForQuestion(qIndex, optIndex)}
                                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                          isCorrect
                                            ? 'border-emerald-600 bg-emerald-600 text-white'
                                            : 'border-gray-300 hover:border-emerald-500 text-transparent'
                                        }`}
                                        title="Définir comme la bonne réponse"
                                      >
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </button>

                                      {/* Option Text Input */}
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={e => handleOptionChangeForQuestion(qIndex, optIndex, e.target.value)}
                                        placeholder={`Réponse ${optIndex + 1}`}
                                        required
                                        className="flex-1 px-2.5 py-1 bg-transparent border-0 text-sm font-medium text-gray-900 focus:outline-none"
                                      />

                                      {/* Delete Option */}
                                      {q.options.length > 2 && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveOptionFromQuestion(qIndex, optIndex)}
                                          className="p-1 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                          title="Supprimer cette réponse"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {q.options.length < 8 && (
                                <button
                                  type="button"
                                  onClick={() => handleAddOptionToQuestion(qIndex)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-colors mt-1"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  <span>+ Ajouter une réponse</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Add Question Button */}
                    <button
                      type="button"
                      onClick={handleAddQuizQuestion}
                      className="w-full py-3.5 bg-white hover:bg-purple-50 text-purple-700 hover:text-purple-800 border-2 border-dashed border-purple-200 hover:border-purple-300 rounded-2xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 shadow-xs"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>+ Ajouter une question</span>
                    </button>
                  </div>
                )}

                {/* === TYPE: CODE R === */}
                {selectedType === 'code_r' && (
                  <div className="space-y-4">
                    {/* Packages Selector */}
                    <AdminRPackageSelector
                      selectedPackages={rPackages}
                      onChange={setRPackages}
                    />

                    {/* Starter code */}
                    <div className="space-y-2 p-4 sm:p-5 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                          Code de départ (Template fourni à l'apprenant)
                        </label>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          R Script
                        </span>
                      </div>
                      <textarea
                        value={starterCode}
                        onChange={e => setStarterCode(e.target.value)}
                        rows={5}
                        placeholder="# Créez le vecteur 'notes' ci-dessous&#10;notes <- c()&#10;&#10;# Calculez la moyenne&#10;"
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-emerald-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all leading-relaxed placeholder:text-slate-600"
                      />
                      <p className="text-xs text-slate-300 font-medium">
                        Ce code apparaîtra pré-rempli dans l'éditeur de code de l'apprenant.
                      </p>
                    </div>

                    {/* Auto-Correction Criteria Builder */}
                    <AdminRCriteriaBuilder
                      criteria={rCriteria}
                      onChange={setRCriteria}
                    />
                  </div>
                )}

                {/* 4. Paramètres de validation : Points & Obligatoire */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-gray-100">
                  {/* Points */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Points attribués
                    </label>
                    <div className="relative">
                      <Award className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={activityPoints}
                        onChange={e => setActivityPoints(parseInt(e.target.value) || 0)}
                        placeholder="10"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Activité obligatoire */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Activité obligatoire
                    </label>
                    <div className="flex items-center gap-3 py-1.5">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="is_required"
                          checked={activityIsRequired === true}
                          onChange={() => setActivityIsRequired(true)}
                          className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="text-xs font-bold text-gray-800">Oui</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="is_required"
                          checked={activityIsRequired === false}
                          onChange={() => setActivityIsRequired(false)}
                          className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="text-xs font-bold text-gray-800">Non</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 5. Indices pédagogiques (Hints) */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Indices d'aide (Optionnel)
                    </label>
                    <span className="text-[11px] text-gray-500">
                      {activityHints.length} indice{activityHints.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Existing Hints List */}
                  {activityHints.length > 0 && (
                    <div className="space-y-2">
                      {activityHints.map((hint, hIndex) => (
                        <div
                          key={hIndex}
                          className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start justify-between gap-3 text-xs text-amber-900"
                        >
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span className="font-medium break-words">{hint}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveHint(hIndex)}
                            className="p-1 text-amber-600 hover:text-rose-600 rounded-lg hover:bg-amber-100 transition-colors shrink-0"
                            title="Supprimer cet indice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Hint Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newHintInput}
                      onChange={e => setNewHintInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddHint();
                        }
                      }}
                      placeholder="Saisissez un indice (ex: Utilisez la fonction c() pour créer un vecteur)..."
                      className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs sm:text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleAddHint}
                      disabled={!newHintInput.trim()}
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-30 disabled:hover:bg-amber-500 text-white text-xs font-bold rounded-2xl transition-all shadow-xs shrink-0"
                    >
                      + Ajouter
                    </button>
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsActivityModalOpen(false)}
                    className="px-5 py-2.5 text-xs sm:text-sm font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-2xl shadow-sm transition-all active:scale-95"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enregistrement...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{editingActivity ? 'Enregistrer les modifications' : 'Créer l\'activité'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. MODAL DE CONFIRMATION DE SUPPRESSION              */}
      {/* ==================================================== */}
      {activityToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 shadow-xl max-w-sm w-full border border-gray-100 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-gray-900">
                Supprimer l'activité ?
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Êtes-vous sûr de vouloir supprimer définitivement l'activité{' '}
                <strong className="text-gray-800">« {activityToDelete.title} »</strong> ?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActivityToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteActivity}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs transition-colors shadow-sm inline-flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <span>Supprimer</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 7. MARKDOWN EDITOR MODAL FOR TEXT CONTENT            */}
      {/* ==================================================== */}
      {isMarkdownModalOpen && (
        <MarkdownEditorModal
          isOpen={isMarkdownModalOpen}
          onClose={() => setIsMarkdownModalOpen(false)}
          initialValue={textContent}
          onSave={val => {
            setTextContent(val);
            setIsMarkdownModalOpen(false);
          }}
          title="Éditer le contenu Markdown de l'activité"
        />
      )}
    </div>
  );
}
