import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/Toast';
import { 
  ArrowLeft, 
  Save, 
  PlusCircle, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Brain, 
  HelpCircle, 
  Code2, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Loader2,
  BookOpen,
  Eye,
  EyeOff,
  Lightbulb,
  Terminal,
  Play,
  Check,
  Plus,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { TrainingActivityType, TrainingDifficultyLevel } from '../types';

export interface TestCaseItem {
  description: string;
  code: string;
}

export interface ExerciseFormItem {
  id?: string;
  exercise_type: 'qcm' | 'r_code';
  title: string;
  instructions: string;
  orderIndex: number;
  // QCM specific fields
  options: [string, string, string, string];
  correctOptionIndex: number;
  explanation: string;
  // R code specific fields
  starter_code: string;
  hint: string;
  ai_assistance_enabled?: boolean;
  expected_output: string;
  test_cases: TestCaseItem[];
  // UI preview state
  showPreview?: boolean;
}

export default function AdminTrainingEditor() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Loading states
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  // Available courses
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);

  // Training Session Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState<string>('');
  const [activityType, setActivityType] = useState<TrainingActivityType>('quiz_qcm');
  const [difficultyLevel, setDifficultyLevel] = useState<TrainingDifficultyLevel>('beginner');
  const [isPublished, setIsPublished] = useState(false);
  const [orderIndex, setOrderIndex] = useState<number>(0);

  // Unified Exercises List (QCM & R Code)
  const [exercises, setExercises] = useState<ExerciseFormItem[]>([
    {
      exercise_type: 'qcm',
      title: 'Question 1',
      instructions: '',
      options: ['', '', '', ''],
      correctOptionIndex: 0,
      explanation: '',
      starter_code: '',
      hint: '',
      expected_output: '',
      test_cases: [],
      orderIndex: 0,
      showPreview: false
    }
  ]);

  useEffect(() => {
    fetchCourses();
    if (isEditing && id) {
      loadTrainingSession(id);
    }
  }, [id, isEditing]);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .order('title', { ascending: true });
      if (!error && data) {
        setCourses(data);
      }
    } catch (err) {
      console.warn('Erreur chargement formations:', err);
    }
  };

  const loadTrainingSession = async (sessionId: string) => {
    try {
      setInitialLoading(true);

      // 1. Fetch training session
      const { data: sessionData, error: sessionError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      if (!sessionData) throw new Error('Entraînement introuvable.');

      setTitle(sessionData.title || '');
      setDescription(sessionData.description || '');
      setCourseId(sessionData.course_id || '');
      setActivityType(sessionData.activity_type || 'quiz_qcm');
      setDifficultyLevel(sessionData.difficulty_level || 'beginner');
      setIsPublished(Boolean(sessionData.is_published));
      setOrderIndex(sessionData.order_index ?? 0);

      // 2. Fetch exercises
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('training_exercises')
        .select('*')
        .eq('training_session_id', sessionId)
        .order('order_index', { ascending: true });

      if (exercisesError) throw exercisesError;

      if (exercisesData && exercisesData.length > 0) {
        // 3. Fetch correct answers for QCM exercises (Admin only)
        const qcmExerciseIds = exercisesData
          .filter(e => e.exercise_type === 'qcm')
          .map(e => e.id);

        const answersMap = new Map<string, number>();
        if (qcmExerciseIds.length > 0) {
          const { data: answersData } = await supabase
            .from('training_qcm_answers')
            .select('*')
            .in('exercise_id', qcmExerciseIds);

          if (answersData) {
            answersData.forEach(a => answersMap.set(a.exercise_id, a.correct_option_index));
          }
        }

        const loadedExercises: ExerciseFormItem[] = exercisesData.map((ex, index) => {
          if (ex.exercise_type === 'r_code') {
            let parsedTests: TestCaseItem[] = [];
            if (Array.isArray(ex.test_cases)) {
              parsedTests = ex.test_cases.map((t: any) => ({
                description: t.description || '',
                code: t.code || ''
              }));
            } else if (typeof ex.test_cases === 'string') {
              try {
                const parsed = JSON.parse(ex.test_cases);
                if (Array.isArray(parsed)) {
                  parsedTests = parsed.map((t: any) => ({
                    description: t.description || '',
                    code: t.code || ''
                  }));
                }
              } catch {
                parsedTests = [];
              }
            }

            return {
              id: ex.id,
              exercise_type: 'r_code',
              title: ex.title || `Exercice ${index + 1}`,
              instructions: ex.instructions || '',
              options: ['', '', '', ''],
              correctOptionIndex: 0,
              explanation: '',
              starter_code: ex.starter_code || '',
              hint: ex.hint || '',
              ai_assistance_enabled: ex.ai_assistance_enabled ?? true,
              expected_output: ex.expected_output || '',
              test_cases: parsedTests.length > 0 ? parsedTests : [{ description: '', code: '' }],
              orderIndex: ex.order_index ?? index,
              showPreview: false
            };
          } else {
            // QCM
            let opts: [string, string, string, string] = ['', '', '', ''];
            if (Array.isArray(ex.options)) {
              opts = [
                ex.options[0] || '',
                ex.options[1] || '',
                ex.options[2] || '',
                ex.options[3] || ''
              ];
            }
            return {
              id: ex.id,
              exercise_type: 'qcm',
              title: ex.title || `Question ${index + 1}`,
              instructions: ex.instructions || '',
              options: opts,
              correctOptionIndex: answersMap.get(ex.id) ?? 0,
              explanation: ex.explanation || '',
              starter_code: '',
              hint: '',
              ai_assistance_enabled: true,
              expected_output: '',
              test_cases: [],
              orderIndex: ex.order_index ?? index,
              showPreview: false
            };
          }
        });

        setExercises(loadedExercises);
      }
    } catch (err: any) {
      console.error('Erreur chargement session:', err);
      toast.error('Erreur lors du chargement : ' + err.message);
      navigate('/admin/training');
    } finally {
      setInitialLoading(false);
    }
  };

  // Activity Type Change Handler
  const handleActivityTypeChange = (newType: TrainingActivityType) => {
    setActivityType(newType);

    // If new session with single default item, switch its type nicely
    if (!isEditing && exercises.length === 1) {
      const current = exercises[0];
      const isBlank = !current.instructions.trim() && !current.starter_code.trim();

      if (isBlank) {
        if (newType === 'r_exercise') {
          setExercises([
            {
              exercise_type: 'r_code',
              title: 'Calculer une moyenne',
              instructions: '',
              options: ['', '', '', ''],
              correctOptionIndex: 0,
              explanation: '',
              starter_code: 'notes <- c(10, 12, 14, 16, 18)\n\n# Calculez la moyenne de notes\n',
              hint: 'Utilisez la fonction mean().',
              ai_assistance_enabled: true,
              expected_output: '14',
              test_cases: [
                {
                  description: 'Le calcul de la moyenne avec mean() est présent',
                  code: 'mean(notes)'
                }
              ],
              orderIndex: 0,
              showPreview: false
            }
          ]);
        } else if (newType === 'quiz_qcm') {
          setExercises([
            {
              exercise_type: 'qcm',
              title: 'Question 1',
              instructions: '',
              options: ['', '', '', ''],
              correctOptionIndex: 0,
              explanation: '',
              starter_code: '',
              hint: '',
              ai_assistance_enabled: true,
              expected_output: '',
              test_cases: [],
              orderIndex: 0,
              showPreview: false
            }
          ]);
        }
      }
    }
  };

  // Exercise Management Helpers
  const handleAddQcmQuestion = () => {
    setExercises(prev => [
      ...prev,
      {
        exercise_type: 'qcm',
        title: `Question ${prev.length + 1}`,
        instructions: '',
        options: ['', '', '', ''],
        correctOptionIndex: 0,
        explanation: '',
        starter_code: '',
        hint: '',
        ai_assistance_enabled: true,
        expected_output: '',
        test_cases: [],
        orderIndex: prev.length,
        showPreview: false
      }
    ]);
  };

  const handleAddRExercise = () => {
    setExercises(prev => [
      ...prev,
      {
        exercise_type: 'r_code',
        title: `Exercice R ${prev.length + 1}`,
        instructions: '',
        options: ['', '', '', ''],
        correctOptionIndex: 0,
        explanation: '',
        starter_code: '# Votre code R ici\n',
        hint: '',
        ai_assistance_enabled: true,
        expected_output: '',
        test_cases: [
          {
            description: 'La variable nom est créée',
            code: 'nom <- "Paul"'
          }
        ],
        orderIndex: prev.length,
        showPreview: false
      }
    ]);
  };

  const handleRemoveExercise = (indexToRemove: number) => {
    if (exercises.length <= 1) {
      toast.info('Un entraînement doit comporter au moins un exercice ou une question.');
      return;
    }
    const ex = exercises[indexToRemove];
    const label = ex.exercise_type === 'qcm' ? 'cette question QCM' : 'cet exercice R';
    if ((ex.instructions || ex.title) && !window.confirm(`Supprimer ${label} (#${indexToRemove + 1}) ?`)) {
      return;
    }
    setExercises(prev => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      return updated.map((item, idx) => ({ ...item, orderIndex: idx }));
    });
  };

  const handleMoveExercise = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === exercises.length - 1)) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    setExercises(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((item, idx) => ({ ...item, orderIndex: idx }));
    });
  };

  const handleUpdateExercise = (index: number, field: keyof ExerciseFormItem, value: any) => {
    setExercises(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleUpdateQcmOption = (exerciseIndex: number, optionIndex: number, text: string) => {
    setExercises(prev => {
      const copy = [...prev];
      const currentOpts = [...copy[exerciseIndex].options] as [string, string, string, string];
      currentOpts[optionIndex] = text;
      copy[exerciseIndex] = { ...copy[exerciseIndex], options: currentOpts };
      return copy;
    });
  };

  // Test Case Management Helpers for R
  const handleAddTestCase = (exerciseIndex: number) => {
    setExercises(prev => {
      const copy = [...prev];
      const currentTests = [...copy[exerciseIndex].test_cases];
      currentTests.push({ description: '', code: '' });
      copy[exerciseIndex] = { ...copy[exerciseIndex], test_cases: currentTests };
      return copy;
    });
  };

  const handleRemoveTestCase = (exerciseIndex: number, testIndex: number) => {
    setExercises(prev => {
      const copy = [...prev];
      const currentTests = copy[exerciseIndex].test_cases.filter((_, idx) => idx !== testIndex);
      copy[exerciseIndex] = { ...copy[exerciseIndex], test_cases: currentTests };
      return copy;
    });
  };

  const handleUpdateTestCase = (exerciseIndex: number, testIndex: number, field: keyof TestCaseItem, value: string) => {
    setExercises(prev => {
      const copy = [...prev];
      const currentTests = [...copy[exerciseIndex].test_cases];
      currentTests[testIndex] = {
        ...currentTests[testIndex],
        [field]: value
      };
      copy[exerciseIndex] = { ...copy[exerciseIndex], test_cases: currentTests };
      return copy;
    });
  };

  const handleTogglePreview = (exerciseIndex: number) => {
    setExercises(prev => {
      const copy = [...prev];
      copy[exerciseIndex] = { ...copy[exerciseIndex], showPreview: !copy[exerciseIndex].showPreview };
      return copy;
    });
  };

  // Validation
  const validateForm = () => {
    if (!title.trim()) {
      toast.error('Veuillez renseigner un titre pour cet entraînement.');
      return false;
    }

    if (exercises.length === 0) {
      toast.error('Veuillez ajouter au moins un exercice ou une question.');
      return false;
    }

    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];

      if (ex.exercise_type === 'qcm') {
        if (!ex.instructions.trim()) {
          toast.error(`La question QCM #${i + 1} n'a pas d'énoncé.`);
          return false;
        }

        const filledOptions = ex.options.filter(opt => opt.trim().length > 0);
        if (filledOptions.length < 2) {
          toast.error(`La question QCM #${i + 1} doit comporter au moins 2 options de réponse.`);
          return false;
        }

        if (!ex.options[ex.correctOptionIndex]?.trim()) {
          toast.error(`Pour la question QCM #${i + 1}, l'option sélectionnée comme bonne réponse ne peut pas être vide.`);
          return false;
        }
      } else if (ex.exercise_type === 'r_code') {
        if (!ex.title.trim()) {
          toast.error(`L'exercice R #${i + 1} doit avoir un titre.`);
          return false;
        }

        if (!ex.instructions.trim()) {
          toast.error(`L'exercice R #${i + 1} (« ${ex.title || 'Sans titre'} ») doit avoir une consigne / énoncé.`);
          return false;
        }

        // Validate test cases (code fragments) if any
        for (let t = 0; t < ex.test_cases.length; t++) {
          const test = ex.test_cases[t];
          const hasDesc = test.description.trim().length > 0;
          const hasCode = test.code.trim().length > 0;

          // If one is filled and other is empty
          if (hasDesc && !hasCode) {
            toast.error(`Dans l'exercice R #${i + 1}, la ligne #${t + 1} (« ${test.description} ») doit comporter le code exact à retrouver.`);
            return false;
          }
          if (!hasDesc && hasCode) {
            toast.error(`Dans l'exercice R #${i + 1}, la ligne #${t + 1} doit comporter une description pour l'étudiant.`);
            return false;
          }
        }
      }
    }

    return true;
  };

  // Submit Handler
  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const sessionPayload = {
        title: title.trim(),
        description: description.trim() || null,
        course_id: courseId.trim() ? courseId : null,
        activity_type: activityType,
        difficulty_level: difficultyLevel,
        is_published: isPublished,
        order_index: Number(orderIndex) || 0,
        updated_at: new Date().toISOString()
      };

      let currentSessionId = id;

      if (isEditing && currentSessionId) {
        // 1. Update session
        const { error: sessionUpdateError } = await supabase
          .from('training_sessions')
          .update(sessionPayload)
          .eq('id', currentSessionId);

        if (sessionUpdateError) throw sessionUpdateError;
      } else {
        // 1. Insert session
        const { data: newSession, error: sessionInsertError } = await supabase
          .from('training_sessions')
          .insert([sessionPayload])
          .select('id')
          .single();

        if (sessionInsertError) throw sessionInsertError;
        currentSessionId = newSession.id;
      }

      if (currentSessionId) {
        // 2. If editing, clean old exercises (cascade handles training_qcm_answers)
        if (isEditing) {
          const { error: deleteOldError } = await supabase
            .from('training_exercises')
            .delete()
            .eq('training_session_id', currentSessionId);

          if (deleteOldError) throw deleteOldError;
        }

        // 3. Prepare exercises to insert
        const exercisesToInsert = exercises.map((ex, idx) => {
          if (ex.exercise_type === 'r_code') {
            // Clean valid test cases
            const validTestCases = ex.test_cases
              .filter(t => t.description.trim() && t.code.trim())
              .map(t => ({
                description: t.description.trim(),
                code: t.code.trim()
              }));

            return {
              training_session_id: currentSessionId,
              exercise_type: 'r_code',
              title: ex.title.trim() || `Exercice R ${idx + 1}`,
              instructions: ex.instructions.trim(),
              order_index: idx,
              options: null,
              explanation: null,
              starter_code: ex.starter_code.trim() || null,
              hint: ex.hint.trim() || null,
              ai_assistance_enabled: ex.ai_assistance_enabled ?? true,
              expected_output: ex.expected_output.trim() || null,
              test_cases: validTestCases.length > 0 ? validTestCases : null
            };
          } else {
            // QCM
            return {
              training_session_id: currentSessionId,
              exercise_type: 'qcm',
              title: ex.title.trim() || `Question ${idx + 1}`,
              instructions: ex.instructions.trim(),
              order_index: idx,
              options: ex.options.map(o => o.trim()),
              explanation: ex.explanation.trim() || null,
              starter_code: null,
              hint: null,
              ai_assistance_enabled: ex.ai_assistance_enabled ?? true,
              expected_output: null,
              test_cases: null
            };
          }
        });

        const { data: insertedExercises, error: exercisesInsertError } = await supabase
          .from('training_exercises')
          .insert(exercisesToInsert)
          .select('id, order_index, exercise_type');

        if (exercisesInsertError) throw exercisesInsertError;

        // 4. Insert correct answers for QCM exercises ONLY
        if (insertedExercises && insertedExercises.length > 0) {
          const qcmInserted = insertedExercises.filter(ex => ex.exercise_type === 'qcm');
          
          if (qcmInserted.length > 0) {
            const answersToInsert = qcmInserted.map(ex => {
              const originalExercise = exercises[ex.order_index];
              return {
                exercise_id: ex.id,
                correct_option_index: originalExercise && originalExercise.exercise_type === 'qcm' 
                  ? originalExercise.correctOptionIndex 
                  : 0
              };
            });

            const { error: answersInsertError } = await supabase
              .from('training_qcm_answers')
              .insert(answersToInsert);

            if (answersInsertError) throw answersInsertError;
          }
        }
      }

      toast.success(isEditing ? 'Entraînement mis à jour avec succès !' : 'Entraînement créé avec succès !');
      navigate('/admin/training');
    } catch (err: any) {
      console.error('Erreur enregistrement entraînement:', err);
      toast.error('Erreur lors de l\'enregistrement : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm font-semibold text-gray-600">Chargement de l'entraînement...</p>
        </div>
      </div>
    );
  }

  const qcmCount = exercises.filter(e => e.exercise_type === 'qcm').length;
  const rCount = exercises.filter(e => e.exercise_type === 'r_code').length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 font-sans pb-24 w-full">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/training')}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]"
              title="Retour à la liste des entraînements"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {isEditing ? 'Édition' : 'Création'}
                </span>
                {activityType === 'r_exercise' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                    <Code2 className="w-3 h-3" />
                    Exercices R
                  </span>
                )}
                {activityType === 'mixed' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Session Mixte
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1">
                {isEditing ? 'Modifier l\'entraînement' : 'Nouvel entraînement'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">
                Configurez les paramètres généraux et les exercices pédagogiques.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to="/admin/training"
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-2xl transition-all min-h-[44px] flex items-center justify-center"
            >
              Annuler
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-2xl transition-all shadow-md shadow-indigo-200 hover:shadow-lg disabled:opacity-50 active:scale-98 min-h-[44px] cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isEditing ? 'Enregistrer' : 'Créer l\'entraînement'}</span>
            </button>
          </div>
        </div>

        {/* General Session Information Card */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <h2 className="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            <span>Informations générales</span>
          </h2>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Titre de l'entraînement <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Les bases de la manipulation de données avec R"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-medium transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Description (optionnelle)
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Ex: Testez vos connaissances sur les vecteurs, matrices, data frames et opérateurs de base."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-medium transition-all resize-y"
              />
            </div>

            {/* Grid 2 columns: Course & Difficulty */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Formation */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  Formation associée
                </label>
                <select
                  value={courseId}
                  onChange={e => setCourseId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-semibold text-gray-800"
                >
                  <option value="">Aucune formation spécifique (Entraînement libre)</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Si rattaché à une formation, l'accès sera réservé aux étudiants inscrits.
                </p>
              </div>

              {/* Niveau de difficulté */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Niveau de difficulté
                </label>
                <select
                  value={difficultyLevel}
                  onChange={e => setDifficultyLevel(e.target.value as TrainingDifficultyLevel)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-semibold text-gray-800"
                >
                  <option value="beginner">Débutant</option>
                  <option value="intermediate">Intermédiaire</option>
                  <option value="advanced">Avancé</option>
                </select>
              </div>
            </div>

            {/* Activity Type Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Type d'activité
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Quiz QCM */}
                <button
                  type="button"
                  onClick={() => handleActivityTypeChange('quiz_qcm')}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 min-h-[90px] cursor-pointer ${
                    activityType === 'quiz_qcm'
                      ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-900 shadow-xs'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    {activityType === 'quiz_qcm' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-1.5">
                      <span>📝</span> Quiz QCM
                    </h4>
                    <p className="text-[11px] text-gray-500">Questions à choix multiples avec validation théorique</p>
                  </div>
                </button>

                {/* Exercices R */}
                <button
                  type="button"
                  onClick={() => handleActivityTypeChange('r_exercise')}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 min-h-[90px] cursor-pointer ${
                    activityType === 'r_exercise'
                      ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-xs'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Code2 className="w-4 h-4" />
                    </div>
                    {activityType === 'r_exercise' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-1.5">
                      <span>💻</span> Exercices R
                    </h4>
                    <p className="text-[11px] text-gray-500">Scripting et tests unitaires R automatisés</p>
                  </div>
                </button>

                {/* Mixte */}
                <button
                  type="button"
                  onClick={() => handleActivityTypeChange('mixed')}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 min-h-[90px] cursor-pointer ${
                    activityType === 'mixed'
                      ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 text-purple-900 shadow-xs'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    {activityType === 'mixed' && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-1.5">
                      <span>🔀</span> Mixte
                    </h4>
                    <p className="text-[11px] text-gray-500">Combinaison libre de QCM et de scripts R</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Publication & Order */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              {/* Publication Switch */}
              <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Statut de publication</h4>
                  <p className="text-xs text-gray-500">
                    {isPublished ? 'Visible par les étudiants autorisés' : 'En mode brouillon (invisible)'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={e => setIsPublished(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Order Index */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Ordre d'affichage</h4>
                  <p className="text-xs text-gray-500">Position numérique dans la liste</p>
                </div>
                <input
                  type="number"
                  value={orderIndex}
                  onChange={e => setOrderIndex(parseInt(e.target.value, 10) || 0)}
                  className="w-20 px-3 py-2 bg-white border border-gray-300 rounded-xl text-center text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Exercises Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                {activityType === 'quiz_qcm' ? (
                  <>
                    <HelpCircle className="w-5 h-5 text-indigo-600" />
                    <span>Questions du quiz ({exercises.length})</span>
                  </>
                ) : activityType === 'r_exercise' ? (
                  <>
                    <Code2 className="w-5 h-5 text-blue-600" />
                    <span>Exercices R interactifs ({exercises.length})</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-5 h-5 text-purple-600" />
                    <span>Exercices de la session ({exercises.length} au total : {qcmCount} QCM, {rCount} R)</span>
                  </>
                )}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {activityType === 'quiz_qcm' && 'Rédigez vos questions, précisez les 4 options et cochez la bonne réponse.'}
                {activityType === 'r_exercise' && 'Configurez les consignes, le code de départ et les critères de test unitaire.'}
                {activityType === 'mixed' && 'Assemblez librement des questions théoriques et des exercices de programmation R.'}
              </p>
            </div>

            {/* Quick Add Header Button for Single-mode */}
            <div className="flex items-center gap-2">
              {activityType === 'quiz_qcm' && (
                <button
                  type="button"
                  onClick={handleAddQcmQuestion}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95 min-h-[44px] cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Ajouter une question</span>
                </button>
              )}
              {activityType === 'r_exercise' && (
                <button
                  type="button"
                  onClick={handleAddRExercise}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95 min-h-[44px] cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Ajouter un exercice R</span>
                </button>
              )}
            </div>
          </div>

          {/* Exercises List */}
          <div className="space-y-6">
            {exercises.map((ex, exIndex) => {
              const isQcm = ex.exercise_type === 'qcm';
              const isR = ex.exercise_type === 'r_code';

              return (
                <div
                  key={exIndex}
                  className={`bg-white rounded-3xl border shadow-sm transition-all overflow-hidden ${
                    isR 
                      ? 'border-blue-100 ring-1 ring-blue-50/50' 
                      : 'border-gray-100'
                  }`}
                >
                  {/* Card Header with Badges and Move/Delete/Preview Controls */}
                  <div className="p-4 sm:p-6 pb-4 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shadow-xs shrink-0 ${
                        isR 
                          ? 'bg-blue-600 text-white shadow-blue-200' 
                          : 'bg-indigo-600 text-white shadow-indigo-200'
                      }`}>
                        {exIndex + 1}
                      </span>

                      {/* Type Badge */}
                      {isR ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-blue-700" />
                          Exercice R
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-indigo-700" />
                          Question QCM
                        </span>
                      )}

                      <h3 className="text-sm font-extrabold text-gray-900 truncate max-w-[240px] sm:max-w-[340px]">
                        {ex.title || (isR ? `Exercice #${exIndex + 1}` : `Question #${exIndex + 1}`)}
                      </h3>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      {/* Preview toggle for R */}
                      {isR && (
                        <button
                          type="button"
                          onClick={() => handleTogglePreview(exIndex)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all min-h-[38px] cursor-pointer mr-1 ${
                            ex.showPreview
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white border border-gray-200 hover:bg-gray-100 text-gray-700'
                          }`}
                          title="Basculer la prévisualisation étudiant"
                        >
                          {ex.showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">{ex.showPreview ? 'Modifier' : '👁 Aperçu étudiant'}</span>
                        </button>
                      )}

                      {/* Move Up */}
                      <button
                        type="button"
                        onClick={() => handleMoveExercise(exIndex, 'up')}
                        disabled={exIndex === 0}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-xl border border-transparent hover:border-gray-200 disabled:opacity-20 transition-all min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                        title="Déplacer vers le haut"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        onClick={() => handleMoveExercise(exIndex, 'down')}
                        disabled={exIndex === exercises.length - 1}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-xl border border-transparent hover:border-gray-200 disabled:opacity-20 transition-all min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                        title="Déplacer vers le bas"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(exIndex)}
                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors ml-1 min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                        title="Supprimer cet élément"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 sm:p-6 space-y-5">
                    
                    {/* ======================================================== */}
                    {/* QCM FORM CONTENT                                         */}
                    {/* ======================================================== */}
                    {isQcm && (
                      <div className="space-y-4">
                        {/* Title (Optional for QCM, default is Question N) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Titre court
                            </label>
                            <input
                              type="text"
                              value={ex.title}
                              onChange={e => handleUpdateExercise(exIndex, 'title', e.target.value)}
                              placeholder={`Question ${exIndex + 1}`}
                              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-medium"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                              Énoncé de la question <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                              value={ex.instructions}
                              onChange={e => handleUpdateExercise(exIndex, 'instructions', e.target.value)}
                              rows={2}
                              placeholder="Ex: Quelle fonction permet d'afficher la structure d'un data frame en R ?"
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-medium transition-all"
                            />
                          </div>
                        </div>

                        {/* Options (A, B, C, D) */}
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                            Options de réponse & Sélection de la bonne réponse
                          </label>
                          <div className="space-y-2.5">
                            {['Option A', 'Option B', 'Option C', 'Option D'].map((label, optIndex) => {
                              const isCorrect = ex.correctOptionIndex === optIndex;
                              return (
                                <div
                                  key={optIndex}
                                  className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
                                    isCorrect
                                      ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300/50'
                                      : 'bg-gray-50 border-gray-200'
                                  }`}
                                >
                                  {/* Radio Button */}
                                  <label className="flex items-center gap-2 cursor-pointer shrink-0 pl-1 min-h-[36px]">
                                    <input
                                      type="radio"
                                      name={`correct_opt_${exIndex}`}
                                      checked={isCorrect}
                                      onChange={() => handleUpdateExercise(exIndex, 'correctOptionIndex', optIndex)}
                                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 cursor-pointer"
                                    />
                                    <span className={`text-xs font-bold ${isCorrect ? 'text-emerald-800' : 'text-gray-600'}`}>
                                      {label}
                                    </span>
                                  </label>

                                  {/* Text Input */}
                                  <input
                                    type="text"
                                    value={ex.options[optIndex]}
                                    onChange={e => handleUpdateQcmOption(exIndex, optIndex, e.target.value)}
                                    placeholder={`Texte de l'${label.toLowerCase()}`}
                                    className={`flex-1 px-3 py-2 bg-white border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 transition-all ${
                                      isCorrect
                                        ? 'border-emerald-300 focus:ring-emerald-500 text-emerald-950 font-semibold'
                                        : 'border-gray-200 focus:ring-indigo-500 text-gray-800'
                                    }`}
                                  />

                                  {isCorrect && (
                                    <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 hidden sm:inline-block">
                                      Bonne réponse
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Explanation */}
                        <div className="pt-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                            Explication pédagogique (affichée après soumission)
                          </label>
                          <textarea
                            value={ex.explanation}
                            onChange={e => handleUpdateExercise(exIndex, 'explanation', e.target.value)}
                            rows={2}
                            placeholder="Ex: La fonction str() donne un résumé compact de la structure interne d'un objet R (types de colonnes, aperçu des premières valeurs, etc.)."
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-medium text-gray-700 transition-all"
                          />
                        </div>
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* R CODE EXERCISE CONTENT                                  */}
                    {/* ======================================================== */}
                    {isR && (
                      <div className="space-y-5">
                        
                        {/* 1. Preview Mode if toggled */}
                        {ex.showPreview ? (
                          <div className="bg-slate-900 text-slate-100 rounded-3xl p-5 sm:p-7 border border-slate-800 space-y-5 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                              <span className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                                <Eye className="w-3.5 h-3.5" />
                                👁 Aperçu étudiant en direct
                              </span>
                              <span className="text-[11px] text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                                Les critères et fragments requis sont masqués pour l'étudiant
                              </span>
                            </div>

                            {/* Title & Instructions */}
                            <div className="space-y-2">
                              <h4 className="text-lg font-black text-white">
                                {ex.title || 'Titre de l\'exercice'}
                              </h4>
                              <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line bg-slate-800/60 p-4 rounded-2xl border border-slate-800">
                                {ex.instructions || 'Aucune consigne rédigée pour le moment.'}
                              </div>
                            </div>

                            {/* Starter code simulated editor */}
                            <div>
                              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 px-1">
                                <span className="font-bold flex items-center gap-1">
                                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                                  Script R de départ (Éditeur)
                                </span>
                              </div>
                              <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-400 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                                {ex.starter_code || '# Aucun code de départ fourni'}
                              </pre>
                            </div>

                            {/* Hint if provided */}
                            {ex.hint && (
                              <div className="p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-2xl text-amber-200 text-xs flex items-start gap-2.5">
                                <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                                <div>
                                  <span className="font-extrabold uppercase text-[10px] text-amber-400 block tracking-wider">Indice</span>
                                  <p className="mt-0.5">{ex.hint}</p>
                                </div>
                              </div>
                            )}

                            {/* Expected output if provided */}
                            {ex.expected_output && (
                              <div className="p-3.5 bg-blue-950/40 border border-blue-800/60 rounded-2xl text-blue-200 text-xs">
                                <span className="font-extrabold uppercase text-[10px] text-blue-400 block tracking-wider">Sortie attendue</span>
                                <pre className="mt-1 font-mono text-xs text-blue-100 bg-slate-950/80 p-2.5 rounded-xl border border-blue-900/50">
                                  {ex.expected_output}
                                </pre>
                              </div>
                            )}

                            {/* Simulated action buttons */}
                            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                              <button
                                type="button"
                                disabled
                                className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed opacity-75"
                              >
                                <Play className="w-3.5 h-3.5 text-blue-400" />
                                <span>▶ Exécuter le code (Simulation)</span>
                              </button>

                              <button
                                type="button"
                                disabled
                                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed opacity-75 shadow-md shadow-emerald-950"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>✓ Valider ma réponse (Simulation)</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Edit Mode for R */
                          <div className="space-y-4">
                            {/* Exercise Title */}
                            <div>
                              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                Titre de l'exercice <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={ex.title}
                                onChange={e => handleUpdateExercise(exIndex, 'title', e.target.value)}
                                placeholder="Exemple : Calculer une moyenne"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm font-semibold text-gray-900 transition-all"
                              />
                            </div>

                            {/* Instructions */}
                            <div>
                              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                Description / consigne pédagogique <span className="text-rose-500">*</span>
                              </label>
                              <textarea
                                value={ex.instructions}
                                onChange={e => handleUpdateExercise(exIndex, 'instructions', e.target.value)}
                                rows={3}
                                placeholder="Ex: Rédigez un script R pour calculer la moyenne des éléments du vecteur 'notes' et assignez le résultat à la variable 'moyenne'."
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm font-medium transition-all resize-y leading-relaxed"
                              />
                            </div>

                            {/* Starter Code */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                  <Terminal className="w-3.5 h-3.5 text-blue-600" />
                                  Code de départ (pré-rempli pour l'étudiant)
                                </label>
                                <span className="text-[11px] text-gray-400 font-medium">Optionnel</span>
                              </div>
                              <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-inner">
                                <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                                  <span>script.R</span>
                                  <span className="text-blue-400 font-sans font-bold">R Language</span>
                                </div>
                                <textarea
                                  value={ex.starter_code}
                                  onChange={e => handleUpdateExercise(exIndex, 'starter_code', e.target.value)}
                                  rows={5}
                                  placeholder={"notes <- c(10, 12, 14, 16, 18)\n\n# Calculez la moyenne de notes"}
                                  className="w-full p-4 bg-slate-900 text-emerald-300 font-mono text-xs sm:text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y placeholder-slate-600"
                                  spellCheck={false}
                                />
                              </div>
                            </div>

                            {/* Hint & Expected Output Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Assistance Gemini */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                    Assistance Gemini
                                  </label>
                                </div>
                                <label className="flex items-start gap-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl cursor-pointer hover:bg-indigo-50 transition-colors h-[42px] sm:h-auto items-center sm:items-start overflow-hidden">
                                  <div className="flex-shrink-0 sm:mt-0.5">
                                    <input
                                      type="checkbox"
                                      checked={ex.ai_assistance_enabled ?? true}
                                      onChange={e => handleUpdateExercise(exIndex, 'ai_assistance_enabled', e.target.checked)}
                                      className="w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500 cursor-pointer"
                                    />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[13px] sm:text-sm font-semibold text-indigo-900 leading-tight">
                                      Autoriser Gemini à aider l'étudiant
                                    </span>
                                    <span className="hidden sm:block text-[11px] text-indigo-700/80 mt-0.5 leading-snug">
                                      Gemini pourra fournir des indices et expliquer les erreurs sans donner directement la solution.
                                    </span>
                                  </div>
                                </label>
                              </div>

                              {/* Expected Output */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    Sortie attendue (valeur / résultat)
                                  </label>
                                  <span className="text-[11px] text-gray-400 font-medium">Optionnel</span>
                                </div>
                                <input
                                  type="text"
                                  value={ex.expected_output}
                                  onChange={e => handleUpdateExercise(exIndex, 'expected_output', e.target.value)}
                                  placeholder='Ex: 14 ou "Paul"'
                                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-xs sm:text-sm font-medium transition-all"
                                />
                                <p className="text-[11px] text-gray-500 mt-1">
                                  Laisse vide si l'exercice est une simple assignation sans affichage.
                                </p>
                              </div>
                            </div>

                            {/* =================================================== */}
                            {/* SECTION LIGNES DE CODE À VÉRIFIER                   */}
                            {/* =================================================== */}
                            <div className="pt-3 border-t border-gray-100 space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <label className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <Code2 className="w-4 h-4 text-blue-600" />
                                    <span>Lignes de code à vérifier ({ex.test_cases.length})</span>
                                  </label>
                                  <p className="text-[11px] text-gray-500 mt-0.5">
                                    Chaque fragment doit apparaître dans le code de l'étudiant (espaces, retours et <code className="text-blue-600 font-mono">&lt;-</code> / <code className="text-blue-600 font-mono">=</code> normalisés). Ces fragments sont masqués pour l'étudiant.
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleAddTestCase(exIndex)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95 min-h-[38px] cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>+ Ajouter une ligne</span>
                                </button>
                              </div>

                              {/* Test cases list */}
                              {ex.test_cases.length === 0 ? (
                                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-center space-y-2">
                                  <p className="text-xs text-amber-800 font-bold flex items-center justify-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    <span>Aucune ligne de code configurée</span>
                                  </p>
                                  <p className="text-[11px] text-amber-700 max-w-md mx-auto">
                                    {ex.expected_output.trim()
                                      ? "La validation reposera uniquement sur la sortie attendue."
                                      : "Sans sortie attendue ni ligne de code à vérifier, l'exercice ne pourra pas être validé."}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => handleAddTestCase(exIndex)}
                                    className="mt-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95 inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>+ Ajouter une première ligne de code</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {ex.test_cases.map((tc, tcIndex) => (
                                    <div
                                      key={tcIndex}
                                      className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-extrabold uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                          Ligne / Fragment requis #{tcIndex + 1}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveTestCase(exIndex, tcIndex)}
                                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
                                          title="Supprimer cette ligne"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Description */}
                                        <div>
                                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                            Description pour l'étudiant <span className="text-rose-500">*</span>
                                          </label>
                                          <input
                                            type="text"
                                            value={tc.description}
                                            onChange={e => handleUpdateTestCase(exIndex, tcIndex, 'description', e.target.value)}
                                            placeholder='Ex: La variable nom est bien créée'
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium text-gray-800"
                                          />
                                        </div>

                                        {/* Validation code fragment */}
                                        <div>
                                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                                            Code exact à retrouver <span className="text-rose-500">*</span>
                                          </label>
                                          <input
                                            type="text"
                                            value={tc.code}
                                            onChange={e => handleUpdateTestCase(exIndex, tcIndex, 'code', e.target.value)}
                                            placeholder='nom <- "Paul"'
                                            className="w-full px-3 py-2 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-700"
                                            spellCheck={false}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Add Exercise Bar */}
          <div className="pt-2">
            {activityType === 'quiz_qcm' && (
              <button
                type="button"
                onClick={handleAddQcmQuestion}
                className="w-full py-4 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 rounded-3xl text-sm font-bold flex items-center justify-center gap-2 transition-all min-h-[50px] cursor-pointer"
              >
                <PlusCircle className="w-5 h-5" />
                <span>+ Ajouter une question (QCM)</span>
              </button>
            )}

            {activityType === 'r_exercise' && (
              <button
                type="button"
                onClick={handleAddRExercise}
                className="w-full py-4 border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/50 hover:bg-blue-50 text-blue-700 rounded-3xl text-sm font-bold flex items-center justify-center gap-2 transition-all min-h-[50px] cursor-pointer"
              >
                <PlusCircle className="w-5 h-5" />
                <span>+ Ajouter un exercice (R)</span>
              </button>
            )}

            {activityType === 'mixed' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleAddQcmQuestion}
                  className="py-4 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 rounded-3xl text-sm font-bold flex items-center justify-center gap-2 transition-all min-h-[50px] cursor-pointer"
                >
                  <HelpCircle className="w-5 h-5" />
                  <span>+ Ajouter une question QCM</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddRExercise}
                  className="py-4 border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/50 hover:bg-blue-50 text-blue-700 rounded-3xl text-sm font-bold flex items-center justify-center gap-2 transition-all min-h-[50px] cursor-pointer"
                >
                  <Code2 className="w-5 h-5" />
                  <span>+ Ajouter un exercice R</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Save Bar Bottom */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link
            to="/admin/training"
            className="px-5 py-3 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-sm font-bold rounded-2xl transition-all min-h-[44px] flex items-center justify-center"
          >
            Annuler
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-2xl transition-all shadow-md shadow-indigo-200 hover:shadow-lg disabled:opacity-50 active:scale-98 min-h-[44px] cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isEditing ? 'Enregistrer les modifications' : 'Créer l\'entraînement'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
