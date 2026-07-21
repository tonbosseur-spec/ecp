import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Plus, Trash2, AlertCircle, CheckCircle2, Video, Link as LinkIcon, MessageCircle, FileText, User, ArrowLeft, Palette } from 'lucide-react';
import ShareCourseButton from '../components/ShareCourseButton';
import { NativeImageUploader } from '../components/NativeImageUploader';
import { RichTextEditorModal } from '../components/RichTextEditorModal';
import { EnrichModuleModal } from '../components/EnrichModuleModal';

interface Trainer {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  primary_color: string;
  bg_pattern: string;
  layout_style: string;
}

interface ModuleInput {
  localId: string;
  title: string;
  description: string;
  long_summary?: string;
  youtube_url?: string;
  download_files?: { name: string; url: string }[];
  quiz?: any;
}

export default function CreateCourse() {
  const navigate = useNavigate();
  
  // Data States
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Form States
  const [title, setTitle] = useState('');
  const [initials, setInitials] = useState('');
  const [description, setDescription] = useState('');
  const [priceFcfa, setPriceFcfa] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [isDateTbd, setIsDateTbd] = useState(false);
  const [trainerId, setTrainerId] = useState('');
  const [maxSeats, setMaxSeats] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [templateId, setTemplateId] = useState('');
  
  // Product Type
  const [productType, setProductType] = useState('formation');
  const [isRichTextModalOpen, setIsRichTextModalOpen] = useState(false);
  const [enrichingModuleLocalId, setEnrichingModuleLocalId] = useState<string | null>(null);

  // Image Upload
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  // Ebook File Upload
  const [downloadFile, setDownloadFile] = useState<File | null>(null);


  // Optional Links
  const [whatsappLink, setWhatsappLink] = useState('');
  const [googleMeetLink, setGoogleMeetLink] = useState('');
  const [guideUrl, setGuideUrl] = useState('');
  const [guideText, setGuideText] = useState('');
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState('');

  // Modules
  const [modules, setModules] = useState<ModuleInput[]>([]);

  // Submission States
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      const [trainersRes, templatesRes] = await Promise.all([
        supabase.from('trainers').select('id, name').order('name'),
        supabase.from('templates').select('*').order('name')
      ]);

      if (trainersRes.error) throw trainersRes.error;
      if (templatesRes.error) throw templatesRes.error;

      setTrainers(trainersRes.data || []);
      setTemplates(templatesRes.data || []);
      
      if (trainersRes.data && trainersRes.data.length > 0) {
        setTrainerId(trainersRes.data[0].id);
      }
      if (templatesRes.data && templatesRes.data.length > 0) {
        setTemplateId(templatesRes.data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const createDefaultTrainer = async () => {
    try {
      setLoadingData(true);
      const { data, error } = await supabase
        .from('trainers')
        .insert([{ name: 'Formateur Principal', description: 'Formateur créé automatiquement pour les tests.' }])
        .select()
        .single();
        
      if (error) throw error;
      if (data) {
        setTrainers([data]);
        setTrainerId(data.id);
      }
    } catch (err: any) {
      setError('Impossible de créer le formateur par défaut: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const addModule = () => {
    setModules([
      ...modules,
      { localId: Math.random().toString(36).substring(7), title: '', description: '' }
    ]);
  };

  const removeModule = (localId: string) => {
    setModules(modules.filter(m => m.localId !== localId));
  };

  const updateModule = (localId: string, field: keyof ModuleInput, value: string) => {
    setModules(modules.map(m => (m.localId === localId ? { ...m, [field]: value } : m)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!trainerId) {
      setError('Veuillez sélectionner un formateur.');
      setSubmitting(false);
      return;
    }

    try {
      if (!title.trim()) {
        setError('Le titre est requis.');
        setSubmitting(false);
        return;
      }
      if (!priceFcfa) {
        setError('Le prix est requis.');
        setSubmitting(false);
        return;
      }
      if (productType === 'formation' && !isDateTbd && !dateTime) {
        setError('Veuillez spécifier une date ou cocher "Date à déterminer".');
        setSubmitting(false);
        return;
      }

      let uploadedFileUrl = null;

      if (productType === 'ebook' && downloadFile) {
        const fileExt = downloadFile.name.split('.').pop();
        const fileName = `ebook-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('course-image')
          .upload(fileName, downloadFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('course-image')
          .getPublicUrl(fileName);

        uploadedFileUrl = publicUrl;
      }

      // 1. Insert Course
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .insert([{
          title,
          initials: initials || null,
          description,
          price_fcfa: parseInt(priceFcfa, 10),
          date_time: productType === 'formation' 
            ? (isDateTbd || !dateTime ? null : new Date(dateTime).toISOString()) 
            : new Date().toISOString(),
          is_date_tbd: productType === 'formation' ? isDateTbd : false,
          trainer_id: trainerId,
          max_seats: maxSeats ? parseInt(maxSeats, 10) : null,
          is_active: isActive,
          whatsapp_link: whatsappLink || null,
          google_meet_link: googleMeetLink || null,
          guide_url: guideUrl || null,
          guide_text: guideText || null,
          youtube_video_url: youtubeVideoUrl || null,
          cover_image_url: coverImageUrl,
          product_type: productType,
          download_file_url: uploadedFileUrl,
          template_id: templateId || null,
        }])
        .select()
        .single();

      if (courseError) throw courseError;
      const newCourseId = courseData.id;

      // 2. Insert Modules
      if (modules.length > 0) {
        const modulesToInsert = modules.map((mod, index) => ({
          course_id: newCourseId,
          title: mod.title,
          description: mod.description,
          order_index: index,
          long_summary: mod.long_summary || null,
          youtube_url: mod.youtube_url || null,
          download_files: mod.download_files || []
        }));

        console.log("Inserting course modules (create payload):", modulesToInsert);

        const { data: insertedModules, error: modulesError } = await supabase
          .from('course_modules')
          .insert(modulesToInsert)
          .select();

        console.log("Supabase insert response:", { insertedModules, modulesError });

        if (modulesError) throw modulesError;

        if (insertedModules) {
          const filesToInsert: any[] = [];
          for (const savedMod of insertedModules) {
            const originalMod = modules[savedMod.order_index];
            if (originalMod) {
              // Insérer le quiz si configuré
              if (originalMod.quiz) {
                const { error: quizError } = await supabase
                  .from('quizzes')
                  .insert({
                    module_id: savedMod.id,
                    title: originalMod.quiz.title || `Quizz : ${savedMod.title}`,
                    questions: originalMod.quiz.questions
                  });
                if (quizError) {
                  console.error("Erreur insertion quiz:", quizError);
                }
              }

              if (originalMod.download_files && originalMod.download_files.length > 0) {
                originalMod.download_files.forEach(file => {
                  filesToInsert.push({
                    module_id: savedMod.id,
                    name: file.name,
                    url: file.url
                  });
                });
              }
            }
          }

          if (filesToInsert.length > 0) {
            const { error: filesInsertError } = await supabase
              .from('module_files')
              .insert(filesToInsert);
            if (filesInsertError) throw filesInsertError;
          }
        }
      }

      setCreatedCourseId(newCourseId);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de la création.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto pb-24">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-150 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {productType === 'ebook' ? 'Nouvel E-book' : 'Nouvelle Formation'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {productType === 'ebook' ? 'Créez un nouvel e-book avec son fichier de téléchargement' : 'Créez un nouvel événement et ses modules'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-black text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 hover:border-slate-300 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500 transition-transform group-hover:-translate-x-0.5" />
            Retour / Annuler
          </button>
        </div>
      </div>

      {trainers.length === 0 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 flex flex-col gap-3 border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Aucun formateur n'existe dans la base de données. Vous devez en avoir au moins un pour créer une formation.
            </p>
          </div>
          <button 
            onClick={createDefaultTrainer}
            type="button"
            className="self-start text-sm font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Créer un formateur de test
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 flex items-start gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success ? (
        <div className="p-8 bg-green-50 rounded-2xl border border-green-100 text-center flex flex-col items-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {productType === 'ebook' ? 'E-book créé avec succès !' : 'Formation créée avec succès !'}
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            {productType === 'ebook' 
              ? 'Votre e-book est maintenant disponible à la vente sur la Marketplace.' 
              : 'Votre formation est maintenant en ligne. Partagez le lien avec vos clients pour qu\'ils puissent s\'inscrire.'}
          </p>
          
          <div className="w-full space-y-3">
            {createdCourseId && (
              <ShareCourseButton 
                courseId={createdCourseId} 
                courseTitle={title}
                className="w-full py-3"
              />
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour au tableau de bord
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section: Informations Principales */}
          <div className="space-y-5 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Informations Principales</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Type de produit *</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="productType"
                    value="formation"
                    checked={productType === 'formation'}
                    onChange={() => setProductType('formation')}
                    className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                  />
                  <span className="text-sm text-gray-700">Formation</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="productType"
                    value="ebook"
                    checked={productType === 'ebook'}
                    onChange={() => setProductType('ebook')}
                    className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                  />
                  <span className="text-sm text-gray-700">E-book (PDF)</span>
                </label>
              </div>
            </div>

            <div>
              <NativeImageUploader 
                onUploadSuccess={(url) => setCoverImageUrl(url)}
                label="Image de couverture (Optionnel)"
                previewUrl={coverImageUrl || ''}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {productType === 'ebook' ? "Titre de l'e-book *" : "Titre de la formation *"}
              </label>
              <input
                required
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-sm"
                placeholder={productType === 'ebook' ? "Ex: Guide Complet de React" : "Ex: Maîtriser React en 2024"}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Initiales de la formation (pour l'export de contacts)</label>
              <input
                type="text"
                value={initials}
                onChange={e => setInitials(e.target.value)}
                className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-sm"
                placeholder="Ex: EMS"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <button
                  type="button"
                  onClick={() => setIsRichTextModalOpen(true)}
                  className="text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1"
                >
                  {description ? "Modifier la description" : "Ajouter une description"}
                </button>
              </div>

              {description ? (
                <div className="relative group bg-gray-50 border border-gray-200 rounded-xl p-4 transition-all hover:bg-gray-50/50">
                  <div 
                    className="text-xs text-gray-700 leading-relaxed max-h-48 overflow-y-auto prose max-w-none 
                      [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&_strong]:font-bold [&_em]:italic [&_u]:underline"
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setIsRichTextModalOpen(true)}
                      className="px-2 py-1 bg-white border border-gray-200 rounded-lg shadow-xs text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Modifier
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsRichTextModalOpen(true)}
                  className="block w-full py-6 px-4 border border-dashed border-gray-300 rounded-xl text-center text-gray-500 hover:text-gray-900 hover:border-gray-400 hover:bg-gray-50/40 transition-all text-sm group"
                >
                  <Palette className="w-5 h-5 mx-auto text-gray-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold block text-xs mb-0.5">
                    {productType === 'ebook' ? "Rédiger la description de l'e-book" : "Rédiger la description de la formation"}
                  </span>
                  <span className="text-[10.5px] text-gray-400 block">Prend en charge le gras, l'italique, le souligné, les listes et les couleurs</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Prix (FCFA) *</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={priceFcfa}
                  onChange={e => setPriceFcfa(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-sm"
                  placeholder="0"
                />
              </div>
              {productType === 'formation' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Date et Heure {!isDateTbd && '*'}
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isDateTbd}
                        onChange={e => {
                          setIsDateTbd(e.target.checked);
                          if (e.target.checked) {
                            setDateTime('');
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-xs font-semibold text-gray-500">Date à déterminer</span>
                    </label>
                  </div>
                  <input
                    disabled={isDateTbd}
                    type="datetime-local"
                    value={dateTime}
                    onChange={e => setDateTime(e.target.value)}
                    className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-sm disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-100"
                  />
                </div>
              )}
            </div>

            <div className={productType === 'ebook' ? "grid grid-cols-1 gap-4" : "grid grid-cols-2 gap-4"}>
              <div className={productType === 'ebook' ? "col-span-1" : ""}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                  <User className="w-4 h-4" /> {productType === 'ebook' ? 'Auteur / Formateur *' : 'Formateur *'}
                </label>
                <select
                  required
                  value={trainerId}
                  onChange={e => setTrainerId(e.target.value)}
                  disabled={trainers.length === 0}
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-sm bg-white disabled:bg-gray-50"
                >
                  {trainers.length === 0 ? (
                    <option value="">Aucun formateur</option>
                  ) : (
                    trainers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))
                  )}
                </select>
              </div>
              {productType !== 'ebook' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Places limitées (Optionnel)</label>
                  <input
                    type="number"
                    min="1"
                    value={maxSeats}
                    onChange={e => setMaxSeats(e.target.value)}
                    className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-sm"
                    placeholder="Ex: 20"
                  />
                </div>
              )}
            </div>

            {productType !== 'ebook' && (
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-sm font-medium text-gray-700">Formation active</span>
                </label>
              </div>
            )}
          </div>

          {/* Section: Design de la page publique */}
          {templates.length > 0 && (
            <div className="space-y-5 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                <Palette className="w-5 h-5 text-purple-500" />
                Design de la page publique
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates.map(template => (
                  <label 
                    key={template.id} 
                    className={`relative flex items-center p-4 cursor-pointer rounded-xl border-2 transition-all ${
                      templateId === template.id 
                        ? 'border-purple-500 bg-purple-50/50' 
                        : 'border-gray-200 hover:border-purple-200 hover:bg-gray-50'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="template" 
                      value={template.id} 
                      checked={templateId === template.id} 
                      onChange={() => setTemplateId(template.id)}
                      className="sr-only"
                    />
                    <div 
                      className="w-10 h-10 rounded-full border border-black/10 flex-shrink-0 shadow-sm mr-4" 
                      style={{ backgroundColor: template.primary_color }}
                    ></div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm">{template.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{template.layout_style}</p>
                    </div>
                    {templateId === template.id && (
                      <CheckCircle2 className="w-5 h-5 text-purple-600 ml-2" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Section: Liens & Médias / E-book */}
          <div className="space-y-5 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">
              {productType === 'ebook' ? 'Fichier E-book (PDF)' : 'Liens & Médias (Optionnel)'}
            </h2>
            
            <div className="space-y-4">
              {productType === 'ebook' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Uploader le PDF de l'E-book *
                  </label>
                  <input
                    required
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setDownloadFile(e.target.files[0]);
                      }
                    }}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-purple-50 file:text-purple-700
                      hover:file:bg-purple-100
                    "
                  />
                </div>
              ) : (
                <>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MessageCircle className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="url"
                      value={whatsappLink}
                      onChange={e => setWhatsappLink(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 transition-shadow text-sm"
                      placeholder="Lien du groupe WhatsApp"
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Video className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="url"
                      value={googleMeetLink}
                      onChange={e => setGoogleMeetLink(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 transition-shadow text-sm"
                      placeholder="Lien Google Meet"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={guideText}
                    onChange={e => setGuideText(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 transition-shadow text-sm"
                    placeholder="Titre du guide"
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="url"
                    value={guideUrl}
                    onChange={e => setGuideUrl(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 transition-shadow text-sm"
                    placeholder="URL du guide (PDF)"
                  />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Video className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={youtubeVideoUrl}
                  onChange={e => setYoutubeVideoUrl(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 transition-shadow text-sm"
                  placeholder="URL Vidéo YouTube"
                />
              </div>
            </div>
          </div>

          {/* Section: Modules */}
          {productType === 'formation' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Modules de la formation</h2>
              </div>

              {modules.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-100 border-dashed flex flex-col items-center gap-3">
                  <p className="text-sm text-gray-500">
                    Aucun module défini. Ajoutez-en pour détailler le programme.
                  </p>
                  <button
                    type="button"
                    onClick={addModule}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-900 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter le premier module
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {modules.map((mod, index) => (
                    <div key={mod.localId} className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm relative group">
                      <div className="absolute top-4 right-4">
                        <button
                          type="button"
                          onClick={() => removeModule(mod.localId)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          title="Supprimer ce module"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="pr-10 space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                            Module {index + 1}
                          </label>
                          <input
                            required
                            type="text"
                            value={mod.title}
                            onChange={e => updateModule(mod.localId, 'title', e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 transition-shadow text-sm font-medium"
                            placeholder="Titre du module"
                          />
                        </div>
                        <div>
                          <textarea
                            required
                            value={mod.description}
                            onChange={e => updateModule(mod.localId, 'description', e.target.value)}
                            rows={2}
                            className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-900 transition-shadow text-sm resize-none"
                            placeholder="Description du module..."
                          />
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => setEnrichingModuleLocalId(mod.localId)}
                            className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors bg-purple-50 hover:bg-purple-100/80 px-2.5 py-1.5 rounded-lg"
                          >
                            <Palette className="w-3.5 h-3.5" />
                            {mod.long_summary || mod.youtube_url || (mod.download_files && mod.download_files.length > 0) || mod.quiz ? (
                              "Contenu enrichi (Modifier)"
                            ) : (
                              "Enrichir le module"
                            )}
                          </button>
                          
                          <div className="flex items-center gap-1.5">
                            {mod.long_summary && (
                              <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md" title="Résumé long défini">TXT</span>
                            )}
                            {mod.youtube_url && (
                              <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md" title="Vidéo YouTube définie">YT</span>
                            )}
                            {mod.download_files && mod.download_files.length > 0 && (
                              <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md" title={`${mod.download_files.length} fichier(s)`}>
                                DOC ({mod.download_files.length})
                              </span>
                            )}
                            {mod.quiz && (
                              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md" title="Quizz configuré">QZ</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={addModule}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-900 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter un module
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-6 flex flex-col sm:flex-row items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto px-6 py-3.5 border border-slate-200 hover:border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              Annuler et Retourner
            </button>
            <button
              type="submit"
              disabled={submitting || trainers.length === 0}
              className="flex-1 w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                  Enregistrement...
                </>
              ) : productType === 'ebook' ? (
                "Enregistrer l'e-book"
              ) : (
                'Enregistrer la formation'
              )}
            </button>
          </div>
          
          <RichTextEditorModal
            isOpen={isRichTextModalOpen}
            onClose={() => setIsRichTextModalOpen(false)}
            initialValue={description}
            onSave={(val) => setDescription(val)}
            title={productType === 'ebook' ? "Description de l'e-book" : "Description de la formation"}
          />

          <EnrichModuleModal
            isOpen={enrichingModuleLocalId !== null}
            onClose={() => setEnrichingModuleLocalId(null)}
            moduleTitle={modules.find(m => m.localId === enrichingModuleLocalId)?.title || ''}
            initialData={{
              long_summary: modules.find(m => m.localId === enrichingModuleLocalId)?.long_summary || '',
              youtube_url: modules.find(m => m.localId === enrichingModuleLocalId)?.youtube_url || '',
              download_files: modules.find(m => m.localId === enrichingModuleLocalId)?.download_files || [],
              quiz: modules.find(m => m.localId === enrichingModuleLocalId)?.quiz || null
            }}
            onSave={(data) => {
              if (enrichingModuleLocalId) {
                setModules(modules.map(m => m.localId === enrichingModuleLocalId ? {
                  ...m,
                  long_summary: data.long_summary,
                  youtube_url: data.youtube_url,
                  download_files: data.download_files,
                  quiz: data.quiz
                } : m));
              }
              setEnrichingModuleLocalId(null);
            }}
          />
          
        </form>
      )}
    </div>
  );
}
