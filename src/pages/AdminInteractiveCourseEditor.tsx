import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/Toast';
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  BookOpen, 
  Sparkles, 
  Clock, 
  Layers, 
  Image as ImageIcon, 
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
  AlertCircle, 
  CheckCircle2, 
  Trash2,
  HelpCircle,
  Globe
} from 'lucide-react';
import { MarkdownEditorModal } from '../components/MarkdownEditorModal';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { NativeImageUploader } from '../components/NativeImageUploader';
import { generateSlug, getUniqueInteractiveCourseSlug } from '../lib/slugUtils';
import { InteractiveCourseCategory, InteractiveCourseLevel, InteractiveCourseStatus } from '../types';

export default function AdminInteractiveCourseEditor() {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Loading states
  const [loadingCourse, setLoadingCourse] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<InteractiveCourseCategory>('R');
  const [level, setLevel] = useState<InteractiveCourseLevel>('beginner');
  const [estimatedDuration, setEstimatedDuration] = useState<number>(30);
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [status, setStatus] = useState<InteractiveCourseStatus>('draft');
  const [existingPublishedAt, setExistingPublishedAt] = useState<string | null>(null);

  // Rich Text / Markdown Preview state
  const [descViewMode, setDescViewMode] = useState<'write' | 'preview'>('write');
  const [isRichTextModalOpen, setIsRichTextModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load existing course if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      fetchCourse(id);
    }
  }, [id, isEditMode]);

  const fetchCourse = async (courseId: string) => {
    try {
      setLoadingCourse(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from('interactive_courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Cours introuvable');

      setTitle(data.title || '');
      setSlug(data.slug || '');
      setIsSlugManuallyEdited(true);
      setDescription(data.description || '');
      setCategory(data.category || 'R');
      setLevel(data.level || 'beginner');
      setEstimatedDuration(data.estimated_duration ?? 30);
      setCoverImageUrl(data.cover_image || '');
      setStatus(data.status || 'draft');
      setExistingPublishedAt(data.published_at || null);
    } catch (err: any) {
      console.error('Erreur chargement du cours:', err);
      setLoadError(err?.message || 'Erreur lors du chargement du cours');
      toast.error('Impossible de charger ce cours.');
    } finally {
      setLoadingCourse(false);
    }
  };

  // Handle title change and auto-slug
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (!isSlugManuallyEdited) {
      setSlug(generateSlug(newTitle));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true);
    setSlug(generateSlug(e.target.value));
  };

  // Quick markdown insertion helpers
  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const previousText = textarea.value;
    const selectedText = previousText.substring(start, end) || 'texte';

    const replacement = `${prefix}${selectedText}${suffix}`;
    const newContent = previousText.substring(0, start) + replacement + previousText.substring(end);

    setDescription(newContent);

    // Reset cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 50);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error('Veuillez saisir un titre pour le cours.');
      return;
    }

    try {
      setIsSaving(true);

      // Generate or sanitize slug
      const finalSlug = isSlugManuallyEdited && slug.trim()
        ? generateSlug(slug)
        : await getUniqueInteractiveCourseSlug(cleanTitle, id);

      const now = new Date().toISOString();
      const isNowPublished = status === 'published';
      const publishedAtValue = isNowPublished
        ? (existingPublishedAt || now)
        : null;

      const payload = {
        title: cleanTitle,
        slug: finalSlug,
        description: description.trim() || null,
        category,
        level,
        estimated_duration: Number(estimatedDuration) >= 0 ? Number(estimatedDuration) : 30,
        cover_image: coverImageUrl.trim() || null,
        status,
        published_at: publishedAtValue,
        updated_at: now
      };

      if (isEditMode && id) {
        // UPDATE
        const { error } = await supabase
          .from('interactive_courses')
          .update(payload)
          .eq('id', id);

        if (error) throw error;

        toast.success('✓ Cours modifié avec succès.');
      } else {
        // INSERT
        const { error } = await supabase
          .from('interactive_courses')
          .insert([payload]);

        if (error) throw error;

        toast.success('✓ Cours créé avec succès.');
      }

      // Redirect back to interactive courses list
      navigate('/admin/interactive-courses');
    } catch (err: any) {
      console.error('Erreur enregistrement cours:', err);
      toast.error('Erreur lors de l\'enregistrement : ' + (err?.message || 'Erreur inconnue'));
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingCourse) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">Chargement des données du cours...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">Impossible de charger le cours</h2>
          <p className="text-xs text-gray-500 mb-6">{loadError}</p>
          <Link
            to="/admin/interactive-courses"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à la liste des cours</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-2 px-3 sm:px-6 lg:px-8 font-sans pb-24 w-full">
      <div className="max-w-4xl w-full mx-auto space-y-6">

        {/* 1. Header & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => navigate('/admin/interactive-courses')}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all flex items-center justify-center shrink-0"
              title="Retour aux cours interactifs"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-sky-50 text-sky-700 border border-sky-100">
                  {isEditMode ? 'Édition' : 'Création'}
                </span>
                <span className="text-xs text-gray-400 font-medium">Étape 1 : Infos Générales</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight mt-1">
                {isEditMode ? 'Modifier le cours' : 'Créer un cours interactif'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                {isEditMode 
                  ? 'Mettez à jour les informations et la configuration de votre cours.'
                  : 'Commencez par définir les informations principales de votre cours.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {isEditMode && id && (
              <Link
                to={`/admin/interactive-courses/${id}/content`}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-sm font-bold rounded-2xl transition-colors"
                title="Gérer les modules et les leçons de ce cours"
              >
                <Layers className="w-4 h-4 text-sky-600" />
                <span>Gérer le contenu</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => navigate('/admin/interactive-courses')}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-2xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEditMode ? 'Enregistrer les modifications' : 'Créer le cours'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. Main Form */}
        <form onSubmit={handleSave} className="space-y-6">

          {/* Card 1: Informations Principales */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-gray-100 shadow-sm space-y-5">
            <div className="border-b border-gray-100 pb-3">
              <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-600" />
                <span>Informations principales</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Titre, description et identifiant du cours</p>
            </div>

            {/* Champ 1 : Titre */}
            <div className="space-y-1.5">
              <label htmlFor="course-title" className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                Grand Titre du cours <span className="text-rose-500">*</span>
              </label>
              <input
                id="course-title"
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="Ex: Maîtriser le langage R et la manipulation de données avec Dplyr"
                required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-gray-400"
              />
            </div>

            {/* Slug URL */}
            <div className="space-y-1.5 pt-1">
              <label htmlFor="course-slug" className="block text-xs font-bold text-gray-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-gray-400" />
                  Identifiant URL (Slug)
                </span>
                <span className="text-[11px] font-normal text-gray-400">Généré automatiquement</span>
              </label>
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 text-xs font-mono text-gray-500 focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 focus-within:bg-white transition-all">
                <span className="text-gray-400 select-none hidden xs:inline">/client/interactive-course/</span>
                <input
                  id="course-slug"
                  type="text"
                  value={slug}
                  onChange={handleSlugChange}
                  placeholder="mon-cours-interactif"
                  className="bg-transparent border-none text-xs font-mono text-gray-800 focus:outline-none flex-1 pl-1"
                />
              </div>
            </div>

            {/* Champ 2 : Description avec Toolbar Markdown & RichText Modal */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label htmlFor="course-description" className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Description du cours
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDescViewMode(descViewMode === 'write' ? 'preview' : 'write')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1"
                  >
                    {descViewMode === 'write' ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Aperçu</span>
                      </>
                    ) : (
                      <>
                        <Code2 className="w-3.5 h-3.5" />
                        <span>Éditer</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRichTextModalOpen(true)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors flex items-center gap-1"
                    title="Ouvrir l'éditeur Markdown plein écran"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Éditeur Markdown</span>
                  </button>
                </div>
              </div>

              {/* Formatting Toolbar */}
              {descViewMode === 'write' && (
                <div className="flex flex-wrap items-center gap-1 p-1.5 bg-gray-100 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => insertMarkdown('**', '**')}
                    className="p-1.5 text-gray-700 hover:bg-white rounded-lg transition-colors"
                    title="Gras"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('*', '*')}
                    className="p-1.5 text-gray-700 hover:bg-white rounded-lg transition-colors"
                    title="Italique"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <div className="h-4 w-[1px] bg-gray-300 mx-1" />
                  <button
                    type="button"
                    onClick={() => insertMarkdown('# ')}
                    className="p-1.5 text-gray-700 hover:bg-white rounded-lg transition-colors"
                    title="Grand Titre"
                  >
                    <Heading1 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('## ')}
                    className="p-1.5 text-gray-700 hover:bg-white rounded-lg transition-colors"
                    title="Sous-titre"
                  >
                    <Heading2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="h-4 w-[1px] bg-gray-300 mx-1" />
                  <button
                    type="button"
                    onClick={() => insertMarkdown('- ')}
                    className="p-1.5 text-gray-700 hover:bg-white rounded-lg transition-colors"
                    title="Liste à puces"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('[', '](https://)')}
                    className="p-1.5 text-gray-700 hover:bg-white rounded-lg transition-colors"
                    title="Lien"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {descViewMode === 'write' ? (
                <textarea
                  id="course-description"
                  ref={textareaRef}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Décrivez les objectifs pédagogiques, ce que l'apprenant va apprendre et les prérequis..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-sans leading-relaxed"
                />
              ) : (
                <div className="w-full min-h-[150px] p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-800">
                  {description ? (
                    <MarkdownRenderer content={description} />
                  ) : (
                    <p className="text-gray-400 italic">Aucun texte de description à prévisualiser.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Paramètres & Catégorisation */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-gray-100 shadow-sm space-y-5">
            <div className="border-b border-gray-100 pb-3">
              <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-sky-600" />
                <span>Paramètres du cours</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Catégorie, niveau de difficulté et durée estimée</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Champ 3 : Catégorie */}
              <div className="space-y-1.5">
                <label htmlFor="course-category" className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Catégorie
                </label>
                <select
                  id="course-category"
                  value={category}
                  onChange={e => setCategory(e.target.value as InteractiveCourseCategory)}
                  className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                >
                  <option value="R">R</option>
                  <option value="Excel">Excel</option>
                  <option value="Power BI">Power BI</option>
                  <option value="SQL">SQL</option>
                  <option value="Python">Python</option>
                  <option value="DAX">DAX</option>
                  <option value="General">Général</option>
                </select>
              </div>

              {/* Champ 4 : Niveau */}
              <div className="space-y-1.5">
                <label htmlFor="course-level" className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Niveau
                </label>
                <select
                  id="course-level"
                  value={level}
                  onChange={e => setLevel(e.target.value as InteractiveCourseLevel)}
                  className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                >
                  <option value="beginner">Débutant</option>
                  <option value="intermediate">Intermédiaire</option>
                  <option value="advanced">Avancé</option>
                </select>
              </div>

              {/* Champ 5 : Durée estimée */}
              <div className="space-y-1.5">
                <label htmlFor="course-duration" className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Durée estimée (min)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="course-duration"
                    type="number"
                    min="1"
                    max="10000"
                    value={estimatedDuration}
                    onChange={e => setEstimatedDuration(parseInt(e.target.value) || 0)}
                    placeholder="30"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Image de couverture */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-gray-100 shadow-sm space-y-5">
            <div className="border-b border-gray-100 pb-3">
              <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-sky-600" />
                <span>Image de couverture</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Téléversez une photo ou collez l'URL d'une image d'illustration</p>
            </div>

            {/* Native / Web Uploader Component */}
            <div className="space-y-3">
              <NativeImageUploader
                label="Téléverser une image de couverture"
                previewUrl={coverImageUrl}
                bucketName="course-image"
                onUploadSuccess={url => {
                  setCoverImageUrl(url);
                  toast.success('Image de couverture ajoutée !');
                }}
              />

              {/* Or manual URL */}
              <div className="space-y-1 pt-2">
                <label htmlFor="course-cover-url" className="block text-xs font-semibold text-gray-600">
                  Ou URL directe de l'image :
                </label>
                <input
                  id="course-cover-url"
                  type="url"
                  value={coverImageUrl}
                  onChange={e => setCoverImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-mono text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              {/* Preview with remove */}
              {coverImageUrl && (
                <div className="relative rounded-2xl overflow-hidden aspect-video max-w-sm border border-gray-200 shadow-xs mt-3 group">
                  <img
                    src={coverImageUrl}
                    alt="Aperçu couverture"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => setCoverImageUrl('')}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-rose-600 text-white rounded-xl transition-colors backdrop-blur-xs"
                    title="Supprimer cette image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Statut de Publication */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-gray-100 shadow-sm space-y-5">
            <div className="border-b border-gray-100 pb-3">
              <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-600" />
                <span>Statut du cours</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Choisissez la visibilité du cours pour les apprenants</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1 : Brouillon */}
              <label
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  status === 'draft'
                    ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-gray-900">Brouillon</span>
                  <input
                    type="radio"
                    name="status"
                    value="draft"
                    checked={status === 'draft'}
                    onChange={() => setStatus('draft')}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Visible uniquement par les administrateurs. Idéal pendant la création du contenu.
                </p>
              </label>

              {/* Option 2 : Publié */}
              <label
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  status === 'published'
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-emerald-950 flex items-center gap-1">
                    <span>Publié</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </span>
                  <input
                    type="radio"
                    name="status"
                    value="published"
                    checked={status === 'published'}
                    onChange={() => setStatus('published')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Accessible aux apprenants sur l'espace d'apprentissage en ligne.
                </p>
              </label>

              {/* Option 3 : Archivé */}
              <label
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  status === 'archived'
                    ? 'border-slate-500 bg-slate-50/50 shadow-xs'
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-gray-900">Archivé</span>
                  <input
                    type="radio"
                    name="status"
                    value="archived"
                    checked={status === 'archived'}
                    onChange={() => setStatus('archived')}
                    className="text-slate-600 focus:ring-slate-500"
                  />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Masqué des listes publiques et conservé pour référence.
                </p>
              </label>
            </div>
          </div>

          {/* 3. Bottom Action Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin/interactive-courses')}
              disabled={isSaving}
              className="px-5 py-3 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-2xl transition-colors"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50 text-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEditMode ? 'Enregistrer les modifications' : 'Créer le cours'}</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>

      {/* Markdown Editor Modal */}
      <MarkdownEditorModal
        isOpen={isRichTextModalOpen}
        onClose={() => setIsRichTextModalOpen(false)}
        initialValue={description}
        title="Rédiger la description du cours (Markdown)"
        onSave={md => {
          setDescription(md);
        }}
      />
    </div>
  );
}
