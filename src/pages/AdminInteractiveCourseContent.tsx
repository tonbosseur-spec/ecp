import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/Toast';
import {
  ArrowLeft,
  BookOpen,
  Layers,
  PlusCircle,
  Edit3,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Sparkles,
  ExternalLink,
  Tag,
  GraduationCap,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  Link as LinkIcon,
  Maximize2,
  Eye,
  Code2,
  X,
  Video,
  HelpCircle,
  Award
} from 'lucide-react';
import { MarkdownEditorModal } from '../components/MarkdownEditorModal';
import { InteractiveCourse, InteractiveCourseModule, InteractiveCourseLesson } from '../types';

export default function AdminInteractiveCourseContent() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Course state
  const [course, setCourse] = useState<InteractiveCourse | null>(null);
  const [modules, setModules] = useState<InteractiveCourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Module Modal state (Create / Edit)
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<InteractiveCourseModule | null>(null);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [isSavingModule, setIsSavingModule] = useState(false);

  // Lesson Modal state (Create / Edit)
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [targetModuleForLesson, setTargetModuleForLesson] = useState<InteractiveCourseModule | null>(null);
  const [editingLesson, setEditingLesson] = useState<InteractiveCourseLesson | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonDuration, setLessonDuration] = useState<number>(15);
  const [isSavingLesson, setIsSavingLesson] = useState(false);

  // Deletion Modal state (for module or lesson)
  const [moduleToDelete, setModuleToDelete] = useState<InteractiveCourseModule | null>(null);
  const [lessonToDelete, setLessonToDelete] = useState<{ lesson: InteractiveCourseLesson; moduleId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reorder loading state
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // Rich Text Editor Modal for descriptions
  const [richTextTarget, setRichTextTarget] = useState<'module' | 'lesson' | null>(null);
  const [isRichTextModalOpen, setIsRichTextModalOpen] = useState(false);

  useEffect(() => {
    if (courseId) {
      fetchCourseAndContent();
    }
  }, [courseId]);

  const fetchCourseAndContent = async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      setLoadError(null);

      // 1. Fetch course details
      const { data: courseData, error: courseError } = await supabase
        .from('interactive_courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      if (!courseData) throw new Error('Cours introuvable');
      setCourse(courseData);

      // 2. Fetch modules with lessons & activities
      const { data: modulesData, error: modulesError } = await supabase
        .from('interactive_course_modules')
        .select(`
          *,
          interactive_course_lessons (
            *,
            interactive_activities (*)
          )
        `)
        .eq('course_id', courseId)
        .order('position', { ascending: true });

      if (modulesError) throw modulesError;

      // Sort lessons and their activities inside each module by position
      const sortedModules = (modulesData || []).map(mod => ({
        ...mod,
        interactive_course_lessons: (mod.interactive_course_lessons || [])
          .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
          .map((les: any) => ({
            ...les,
            interactive_activities: (les.interactive_activities || []).sort(
              (a: any, b: any) => (a.position || 0) - (b.position || 0)
            )
          }))
      }));

      setModules(sortedModules);
    } catch (err: any) {
      console.error('Erreur chargement contenu du cours:', err);
      setLoadError(err?.message || 'Erreur lors du chargement des données');
      toast.error('Impossible de charger le contenu du cours.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // MODULE ACTIONS (CREATE / EDIT / REORDER / DELETE)
  // ==========================================

  const openCreateModuleModal = () => {
    setEditingModule(null);
    setModuleTitle('');
    setModuleDescription('');
    setIsModuleModalOpen(true);
  };

  const openEditModuleModal = (mod: InteractiveCourseModule) => {
    setEditingModule(mod);
    setModuleTitle(mod.title || '');
    setModuleDescription(mod.description || '');
    setIsModuleModalOpen(true);
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;

    const cleanTitle = moduleTitle.trim();
    if (!cleanTitle) {
      toast.error('Veuillez saisir un titre pour le module.');
      return;
    }

    try {
      setIsSavingModule(true);
      const now = new Date().toISOString();

      if (editingModule) {
        // UPDATE module
        const { error } = await supabase
          .from('interactive_course_modules')
          .update({
            title: cleanTitle,
            description: moduleDescription.trim() || null,
            updated_at: now
          })
          .eq('id', editingModule.id);

        if (error) throw error;

        setModules(prev =>
          prev.map(m =>
            m.id === editingModule.id
              ? { ...m, title: cleanTitle, description: moduleDescription.trim() || null, updated_at: now }
              : m
          )
        );
        toast.success('✓ Modifications du module enregistrées');
      } else {
        // INSERT module
        const nextPosition = modules.length > 0
          ? Math.max(...modules.map(m => m.position || 0)) + 1
          : 1;

        const { data, error } = await supabase
          .from('interactive_course_modules')
          .insert([
            {
              course_id: courseId,
              title: cleanTitle,
              description: moduleDescription.trim() || null,
              position: nextPosition,
              updated_at: now
            }
          ])
          .select()
          .single();

        if (error) throw error;

        setModules(prev => [
          ...prev,
          { ...data, interactive_course_lessons: [] }
        ]);
        toast.success('✓ Module créé');
      }

      setIsModuleModalOpen(false);
    } catch (err: any) {
      console.error('Erreur sauvegarde module:', err);
      toast.error('Erreur lors de l\'enregistrement du module : ' + (err?.message || 'Erreur'));
    } finally {
      setIsSavingModule(false);
    }
  };

  const handleMoveModule = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    const currentMod = modules[index];
    const targetMod = modules[targetIndex];

    try {
      setReorderingId(currentMod.id);

      const currentPos = currentMod.position;
      const targetPos = targetMod.position;

      // Swap positions in optimistic state
      const updatedModules = [...modules];
      updatedModules[index] = { ...targetMod, position: currentPos };
      updatedModules[targetIndex] = { ...currentMod, position: targetPos };
      setModules(updatedModules);

      // Persist in Supabase
      const [res1, res2] = await Promise.all([
        supabase
          .from('interactive_course_modules')
          .update({ position: targetPos, updated_at: new Date().toISOString() })
          .eq('id', currentMod.id),
        supabase
          .from('interactive_course_modules')
          .update({ position: currentPos, updated_at: new Date().toISOString() })
          .eq('id', targetMod.id)
      ]);

      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;
    } catch (err: any) {
      console.error('Erreur changement ordre module:', err);
      toast.error('Impossible de modifier l\'ordre du module.');
      // Re-fetch to restore consistent state
      fetchCourseAndContent();
    } finally {
      setReorderingId(null);
    }
  };

  const handleDeleteModule = async () => {
    if (!moduleToDelete) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('interactive_course_modules')
        .delete()
        .eq('id', moduleToDelete.id);

      if (error) throw error;

      setModules(prev => prev.filter(m => m.id !== moduleToDelete.id));
      toast.success('✓ Module supprimé');
      setModuleToDelete(null);
    } catch (err: any) {
      console.error('Erreur suppression module:', err);
      toast.error('Impossible de supprimer le module : ' + (err?.message || 'Erreur'));
    } finally {
      setIsDeleting(false);
    }
  };

  // ==========================================
  // LESSON ACTIONS (CREATE / EDIT / REORDER / DELETE)
  // ==========================================

  const openCreateLessonModal = (mod: InteractiveCourseModule) => {
    setTargetModuleForLesson(mod);
    setEditingLesson(null);
    setLessonTitle('');
    setLessonDescription('');
    setLessonDuration(15);
    setIsLessonModalOpen(true);
  };

  const openEditLessonModal = (mod: InteractiveCourseModule, les: InteractiveCourseLesson) => {
    setTargetModuleForLesson(mod);
    setEditingLesson(les);
    setLessonTitle(les.title || '');
    setLessonDescription(les.description || '');
    setLessonDuration(les.estimated_duration ?? 15);
    setIsLessonModalOpen(true);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetModuleForLesson) return;

    const cleanTitle = lessonTitle.trim();
    if (!cleanTitle) {
      toast.error('Veuillez saisir un titre pour la leçon.');
      return;
    }

    try {
      setIsSavingLesson(true);
      const now = new Date().toISOString();
      const duration = Number(lessonDuration) > 0 ? Number(lessonDuration) : 15;

      if (editingLesson) {
        // UPDATE lesson
        const { error } = await supabase
          .from('interactive_course_lessons')
          .update({
            title: cleanTitle,
            description: lessonDescription.trim() || null,
            estimated_duration: duration,
            updated_at: now
          })
          .eq('id', editingLesson.id);

        if (error) throw error;

        setModules(prev =>
          prev.map(m => {
            if (m.id !== targetModuleForLesson.id) return m;
            return {
              ...m,
              interactive_course_lessons: (m.interactive_course_lessons || []).map(les =>
                les.id === editingLesson.id
                  ? {
                      ...les,
                      title: cleanTitle,
                      description: lessonDescription.trim() || null,
                      estimated_duration: duration,
                      updated_at: now
                    }
                  : les
              )
            };
          })
        );
        toast.success('✓ Modifications de la leçon enregistrées');
      } else {
        // INSERT lesson
        const existingLessons = targetModuleForLesson.interactive_course_lessons || [];
        const nextPosition = existingLessons.length > 0
          ? Math.max(...existingLessons.map(l => l.position || 0)) + 1
          : 1;

        const { data, error } = await supabase
          .from('interactive_course_lessons')
          .insert([
            {
              module_id: targetModuleForLesson.id,
              title: cleanTitle,
              description: lessonDescription.trim() || null,
              position: nextPosition,
              estimated_duration: duration,
              updated_at: now
            }
          ])
          .select()
          .single();

        if (error) throw error;

        setModules(prev =>
          prev.map(m => {
            if (m.id !== targetModuleForLesson.id) return m;
            return {
              ...m,
              interactive_course_lessons: [...(m.interactive_course_lessons || []), data]
            };
          })
        );
        toast.success('✓ Leçon créée');
      }

      setIsLessonModalOpen(false);
    } catch (err: any) {
      console.error('Erreur sauvegarde leçon:', err);
      toast.error('Erreur lors de l\'enregistrement de la leçon : ' + (err?.message || 'Erreur'));
    } finally {
      setIsSavingLesson(false);
    }
  };

  const handleMoveLesson = async (
    moduleId: string,
    lessonIndex: number,
    direction: 'up' | 'down'
  ) => {
    const targetMod = modules.find(m => m.id === moduleId);
    if (!targetMod || !targetMod.interactive_course_lessons) return;

    const lessons = targetMod.interactive_course_lessons;
    const targetIndex = direction === 'up' ? lessonIndex - 1 : lessonIndex + 1;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;

    const currentLes = lessons[lessonIndex];
    const targetLes = lessons[targetIndex];

    try {
      setReorderingId(currentLes.id);

      const currentPos = currentLes.position;
      const targetPos = targetLes.position;

      // Optimistic update
      const updatedLessons = [...lessons];
      updatedLessons[lessonIndex] = { ...targetLes, position: currentPos };
      updatedLessons[targetIndex] = { ...currentLes, position: targetPos };

      setModules(prev =>
        prev.map(m => (m.id === moduleId ? { ...m, interactive_course_lessons: updatedLessons } : m))
      );

      // Persist in Supabase
      const [res1, res2] = await Promise.all([
        supabase
          .from('interactive_course_lessons')
          .update({ position: targetPos, updated_at: new Date().toISOString() })
          .eq('id', currentLes.id),
        supabase
          .from('interactive_course_lessons')
          .update({ position: currentPos, updated_at: new Date().toISOString() })
          .eq('id', targetLes.id)
      ]);

      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;
    } catch (err: any) {
      console.error('Erreur changement ordre leçon:', err);
      toast.error('Impossible de modifier l\'ordre de la leçon.');
      fetchCourseAndContent();
    } finally {
      setReorderingId(null);
    }
  };

  const handleDeleteLesson = async () => {
    if (!lessonToDelete) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('interactive_course_lessons')
        .delete()
        .eq('id', lessonToDelete.lesson.id);

      if (error) throw error;

      setModules(prev =>
        prev.map(m => {
          if (m.id !== lessonToDelete.moduleId) return m;
          return {
            ...m,
            interactive_course_lessons: (m.interactive_course_lessons || []).filter(
              l => l.id !== lessonToDelete.lesson.id
            )
          };
        })
      );

      toast.success('✓ Leçon supprimée');
      setLessonToDelete(null);
    } catch (err: any) {
      console.error('Erreur suppression leçon:', err);
      toast.error('Impossible de supprimer la leçon : ' + (err?.message || 'Erreur'));
    } finally {
      setIsDeleting(false);
    }
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
          <p className="text-sm font-semibold text-gray-600">Chargement du contenu du cours...</p>
        </div>
      </div>
    );
  }

  if (loadError || !course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">Impossible de charger le cours</h2>
          <p className="text-xs text-gray-500 mb-6">{loadError || 'Cours introuvable'}</p>
          <Link
            to="/admin/interactive-courses"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour aux cours</span>
          </Link>
        </div>
      </div>
    );
  }

  const totalLessonsCount = modules.reduce(
    (acc, m) => acc + (m.interactive_course_lessons?.length || 0),
    0
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-2 px-3 sm:px-6 lg:px-8 font-sans pb-24 w-full">
      <div className="max-w-4xl w-full mx-auto space-y-6">

        {/* 1. Header & Course Summary Banner */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/interactive-courses')}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all flex items-center justify-center shrink-0"
                title="Retour aux cours interactifs"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-sky-50 text-sky-700 border border-sky-100">
                    Contenu du cours
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-700">
                    {course.category}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-700">
                    {course.level === 'beginner' ? 'Débutant' : course.level === 'intermediate' ? 'Intermédiaire' : 'Avancé'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      course.status === 'published'
                        ? 'bg-emerald-50 text-emerald-700'
                        : course.status === 'draft'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {course.status === 'published' ? '● Publié' : course.status === 'draft' ? '● Brouillon' : '● Archivé'}
                  </span>
                </div>
                <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 tracking-tight mt-1">
                  {course.title}
                </h1>
              </div>
            </div>

            {/* Top Quick Actions */}
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <Link
                to={`/admin/interactive-courses/${course.id}/edit`}
                className="inline-flex items-center gap-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold transition-colors"
                title="Modifier les informations générales du cours"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Infos cours</span>
              </Link>

              {course.status === 'published' && (
                <Link
                  to={`/client/interactive-course/${course.slug || course.id}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition-colors"
                  title="Aperçu apprenant"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Aperçu</span>
                </Link>
              )}
            </div>
          </div>

          {/* Short description preview if available */}
          {course.description && (
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
              {stripHtmlOrMarkdown(course.description)}
            </p>
          )}

          {/* Stats Bar */}
          <div className="flex items-center gap-4 text-xs font-semibold text-gray-600 bg-gray-50/80 px-4 py-2.5 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-600" />
              <span>{modules.length} module{modules.length > 1 ? 's' : ''}</span>
            </div>
            <div className="h-3 w-[1px] bg-gray-200" />
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-sky-600" />
              <span>{totalLessonsCount} leçon{totalLessonsCount > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* 2. Content Structure Section Header */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-sky-600" />
              <span>Contenu du cours</span>
            </h2>
            <p className="text-xs text-gray-500">Organisez vos modules et vos leçons dans l'ordre pédagogique souhaité.</p>
          </div>

          <button
            type="button"
            onClick={openCreateModuleModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-sm transition-all active:scale-95 shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Ajouter un module</span>
          </button>
        </div>

        {/* 3. Empty State : Aucun module */}
        {modules.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-8 sm:p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-gray-900 mb-2">
              Ce cours ne contient encore aucun module.
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mb-6 max-w-md mx-auto leading-relaxed">
              Commencez par créer votre premier module (ex: "Introduction", "Les bases", "Manipulation des données").
            </p>
            <button
              type="button"
              onClick={openCreateModuleModal}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl shadow-sm transition-all active:scale-95 text-sm"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Créer mon premier module</span>
            </button>
          </div>
        ) : (
          /* 4. Modules List */
          <div className="space-y-6">
            {modules.map((mod, modIndex) => {
              const lessons = mod.interactive_course_lessons || [];
              const isFirstModule = modIndex === 0;
              const isLastModule = modIndex === modules.length - 1;
              const isModReordering = reorderingId === mod.id;

              return (
                <div
                  key={mod.id}
                  className="bg-white border-2 border-gray-100 rounded-3xl overflow-hidden shadow-xs hover:border-sky-200/80 transition-all space-y-0"
                >
                  {/* Module Header Bar */}
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-white/10 text-sky-300 font-black text-sm flex items-center justify-center shrink-0 mt-0.5 border border-white/10">
                        {modIndex + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300">
                            Module {modIndex + 1}
                          </span>
                          <span className="text-[10px] text-gray-300 font-medium">
                            • {lessons.length} leçon{lessons.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-white tracking-tight break-words">
                          {mod.title}
                        </h3>
                        {mod.description && (
                          <p className="text-xs text-gray-300 mt-1 line-clamp-2 leading-relaxed">
                            {stripHtmlOrMarkdown(mod.description)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Module Controls (Reorder, Edit, Delete) */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {/* Move Up */}
                      <button
                        type="button"
                        onClick={() => handleMoveModule(modIndex, 'up')}
                        disabled={isFirstModule || isModReordering}
                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Monter le module"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        onClick={() => handleMoveModule(modIndex, 'down')}
                        disabled={isLastModule || isModReordering}
                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Descendre le module"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>

                      <div className="h-4 w-[1px] bg-white/20 mx-0.5" />

                      {/* Edit Module */}
                      <button
                        type="button"
                        onClick={() => openEditModuleModal(mod)}
                        className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                        title="Modifier ce module"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Delete Module */}
                      <button
                        type="button"
                        onClick={() => setModuleToDelete(mod)}
                        className="p-2 text-rose-300 hover:text-white hover:bg-rose-600/60 rounded-xl transition-colors"
                        title="Supprimer ce module"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Lessons Container */}
                  <div className="p-4 sm:p-5 space-y-3 bg-white">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-sky-600" />
                        <span>Leçons du module {modIndex + 1}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => openCreateLessonModal(mod)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition-all active:scale-95"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Ajouter une leçon</span>
                      </button>
                    </div>

                    {lessons.length === 0 ? (
                      /* Empty State : Aucune leçon dans ce module */
                      <div className="p-4 sm:p-6 bg-gray-50/80 rounded-2xl border border-dashed border-gray-200 text-center space-y-2">
                        <p className="text-xs font-semibold text-gray-500">
                          Ce module ne contient encore aucune leçon.
                        </p>
                        <button
                          type="button"
                          onClick={() => openCreateLessonModal(mod)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-100 text-gray-800 border border-gray-200 rounded-xl text-xs font-bold shadow-2xs transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-sky-600" />
                          <span>Ajouter la première leçon</span>
                        </button>
                      </div>
                    ) : (
                      /* Lessons List */
                      <div className="space-y-2">
                        {lessons.map((lesson, lessonIndex) => {
                          const isFirstLesson = lessonIndex === 0;
                          const isLastLesson = lessonIndex === lessons.length - 1;
                          const isLesReordering = reorderingId === lesson.id;
                          const activitiesList = lesson.interactive_activities || [];
                          const activitiesCount = activitiesList.length;

                          return (
                            <div
                              key={lesson.id}
                              className="p-3.5 sm:p-4 bg-gray-50/90 hover:bg-gray-100/90 border border-gray-200 rounded-2xl flex flex-col gap-3 transition-all group"
                            >
                              <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5">
                                {/* Left: Lesson Index, Title & Duration */}
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                    {lessonIndex + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-xs sm:text-sm font-bold text-gray-900 break-words group-hover:text-sky-700 transition-colors">
                                      {lesson.title}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-gray-400" />
                                        <span>{lesson.estimated_duration || 15} min</span>
                                      </span>
                                      <span className="inline-flex items-center gap-1 font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                                        <Sparkles className="w-3 h-3 text-sky-600" />
                                        <span>{activitiesCount} activité{activitiesCount > 1 ? 's' : ''}</span>
                                      </span>
                                      {lesson.description && (
                                        <span className="truncate max-w-[200px] xs:max-w-xs text-gray-400">
                                          • {stripHtmlOrMarkdown(lesson.description)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Right: Lesson Action Controls */}
                                <div className="flex items-center gap-1 self-end xs:self-center shrink-0">
                                  {/* Move Lesson Up */}
                                  <button
                                    type="button"
                                    onClick={() => handleMoveLesson(mod.id, lessonIndex, 'up')}
                                    disabled={isFirstLesson || isLesReordering}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                                    title="Monter la leçon"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Move Lesson Down */}
                                  <button
                                    type="button"
                                    onClick={() => handleMoveLesson(mod.id, lessonIndex, 'down')}
                                    disabled={isLastLesson || isLesReordering}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                                    title="Descendre la leçon"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>

                                  <div className="h-3 w-[1px] bg-gray-200 mx-0.5" />

                                  {/* Edit Lesson */}
                                  <button
                                    type="button"
                                    onClick={() => openEditLessonModal(mod, lesson)}
                                    className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-white rounded-lg transition-colors"
                                    title="Modifier cette leçon"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete Lesson */}
                                  <button
                                    type="button"
                                    onClick={() => setLessonToDelete({ lesson, moduleId: mod.id })}
                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                                    title="Supprimer cette leçon"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Lesson Activities Action Banner */}
                              <div className="pt-2 border-t border-gray-200/80 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {activitiesList.length === 0 ? (
                                    <span className="text-[11px] text-gray-400 italic">
                                      Aucune activité configurée
                                    </span>
                                  ) : (
                                    activitiesList.map((act: any, actIdx: number) => (
                                      <span
                                        key={act.id || actIdx}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                          act.activity_type === 'text'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                            : act.activity_type === 'video'
                                            ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                            : act.activity_type === 'quiz'
                                            ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                        }`}
                                        title={act.title}
                                      >
                                        {act.activity_type === 'text' && <FileText className="w-2.5 h-2.5" />}
                                        {act.activity_type === 'video' && <Video className="w-2.5 h-2.5" />}
                                        {act.activity_type === 'quiz' && <HelpCircle className="w-2.5 h-2.5" />}
                                        {act.activity_type === 'code_r' && <Code2 className="w-2.5 h-2.5" />}
                                        <span className="truncate max-w-[90px]">{act.title || `Activité ${actIdx + 1}`}</span>
                                      </span>
                                    ))
                                  )}
                                </div>

                                <Link
                                  to={`/admin/interactive-courses/${courseId}/lesson/${lesson.id}/activities`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-sky-50 text-sky-700 hover:text-sky-800 border border-sky-200 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-95 ml-auto"
                                >
                                  <Layers className="w-3.5 h-3.5 text-sky-600" />
                                  <span>Gérer les activités ({activitiesCount})</span>
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Bottom Add Lesson Button in module */}
                    {lessons.length > 0 && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => openCreateLessonModal(mod)}
                          className="w-full py-2.5 px-3 bg-gray-50 hover:bg-sky-50 text-gray-600 hover:text-sky-700 border border-dashed border-gray-200 hover:border-sky-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>+ Ajouter une leçon</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Bottom Add Module Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={openCreateModuleModal}
                className="w-full py-4 px-4 bg-white hover:bg-sky-50 text-gray-700 hover:text-sky-700 border-2 border-dashed border-gray-200 hover:border-sky-300 rounded-3xl text-sm font-extrabold transition-all shadow-xs flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-5 h-5 text-sky-600" />
                <span>+ Ajouter un module</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 5. MODAL : CRÉER / MODIFIER UN MODULE                */}
      {/* ==================================================== */}
      {isModuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">
                  {editingModule ? 'Modifier le module' : 'Nouveau module'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Définissez le titre et les objectifs de ce module.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModuleModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModule} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Titre */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Titre du module <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={moduleTitle}
                  onChange={e => setModuleTitle(e.target.value)}
                  placeholder="Ex: Découvrir R et RStudio"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Description du module
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setRichTextTarget('module');
                      setIsRichTextModalOpen(true);
                    }}
                    className="px-2 py-0.5 text-xs font-semibold rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors flex items-center gap-1"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Éditeur Markdown</span>
                  </button>
                </div>
                <textarea
                  value={moduleDescription}
                  onChange={e => setModuleDescription(e.target.value)}
                  rows={4}
                  placeholder="Présentation des concepts abordés dans ce module..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all leading-relaxed"
                />
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModuleModalOpen(false)}
                  disabled={isSavingModule}
                  className="px-4 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-2xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingModule}
                  className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-2xl shadow-sm transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingModule ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>{editingModule ? 'Enregistrer les modifications' : 'Créer le module'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. MODAL : CRÉER / MODIFIER UNE LEÇON                */}
      {/* ==================================================== */}
      {isLessonModalOpen && targetModuleForLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase text-sky-700 tracking-wider">
                  Dans : {targetModuleForLesson.title}
                </div>
                <h3 className="text-base font-extrabold text-gray-900 mt-0.5">
                  {editingLesson ? 'Modifier la leçon' : 'Nouvelle leçon'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLessonModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveLesson} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Titre */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Titre de la leçon <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={lessonTitle}
                  onChange={e => setLessonTitle(e.target.value)}
                  placeholder="Ex: Qu'est-ce que R ?"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              {/* Durée estimée */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Durée estimée (minutes)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="1"
                    max="600"
                    value={lessonDuration}
                    onChange={e => setLessonDuration(parseInt(e.target.value) || 0)}
                    placeholder="15"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Description de la leçon
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setRichTextTarget('lesson');
                      setIsRichTextModalOpen(true);
                    }}
                    className="px-2 py-0.5 text-xs font-semibold rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors flex items-center gap-1"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Éditeur Markdown</span>
                  </button>
                </div>
                <textarea
                  value={lessonDescription}
                  onChange={e => setLessonDescription(e.target.value)}
                  rows={4}
                  placeholder="Résumé du contenu ou consignes d'introduction de la leçon..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all leading-relaxed"
                />
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsLessonModalOpen(false)}
                  disabled={isSavingLesson}
                  className="px-4 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-2xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingLesson}
                  className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-2xl shadow-sm transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingLesson ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>{editingLesson ? 'Enregistrer les modifications' : 'Créer la leçon'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 7. CONFIRMATION DE SUPPRESSION : MODULE             */}
      {/* ==================================================== */}
      {moduleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 overflow-hidden border border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
              Supprimer ce module ?
            </h3>

            <p className="text-sm font-semibold text-gray-800 text-center mb-1">
              "{moduleToDelete.title}"
            </p>

            <p className="text-xs text-gray-500 text-center leading-relaxed mb-6">
              Les leçons appartenant à ce module seront également supprimées.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setModuleToDelete(null)}
                disabled={isDeleting}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleDeleteModule}
                disabled={isDeleting}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
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
      {/* 8. CONFIRMATION DE SUPPRESSION : LEÇON              */}
      {/* ==================================================== */}
      {lessonToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 overflow-hidden border border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
              Supprimer cette leçon ?
            </h3>

            <p className="text-sm font-semibold text-gray-800 text-center mb-1">
              "{lessonToDelete.lesson.title}"
            </p>

            <p className="text-xs text-gray-500 text-center leading-relaxed mb-6">
              Cette action est irréversible.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLessonToDelete(null)}
                disabled={isDeleting}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleDeleteLesson}
                disabled={isDeleting}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
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
      {/* 9. REUSED MARKDOWN EDITOR MODAL                     */}
      {/* ==================================================== */}
      <MarkdownEditorModal
        isOpen={isRichTextModalOpen}
        onClose={() => {
          setIsRichTextModalOpen(false);
          setRichTextTarget(null);
        }}
        initialValue={richTextTarget === 'module' ? moduleDescription : lessonDescription}
        title={richTextTarget === 'module' ? 'Rédiger la description du module (Markdown)' : 'Rédiger la description de la leçon (Markdown)'}
        onSave={md => {
          if (richTextTarget === 'module') {
            setModuleDescription(md);
          } else if (richTextTarget === 'lesson') {
            setLessonDescription(md);
          }
          setIsRichTextModalOpen(false);
          setRichTextTarget(null);
        }}
      />
    </div>
  );
}
