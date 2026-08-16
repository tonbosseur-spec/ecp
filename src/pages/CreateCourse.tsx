import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Plus, Trash2, AlertCircle, CheckCircle2, Video, Link as LinkIcon, MessageCircle, FileText, User, ArrowLeft, Palette } from 'lucide-react';
import ShareCourseButton from '../components/ShareCourseButton';
import { NativeImageUploader } from '../components/NativeImageUploader';
import { RichTextEditorModal } from '../components/RichTextEditorModal';
import { EnrichModuleModal } from '../components/EnrichModuleModal';
import PromoCodeManager from '../components/PromoCodeManager';
import { PromoCode, getDefaultPromoCodesForCourse } from '../lib/promoUtils';
import { encodeCourseQuizSettings } from '../lib/quizUtils';
import { generateSlug, getUniqueSlug } from '../lib/slugUtils';
import SupabaseSlugMigrationBanner from '../components/SupabaseSlugMigrationBanner';

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
  scheduled_date?: string;
}

export default function CreateCourse() {
  const navigate = useNavigate();
  
  // Data States
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Form States
  const [title, setTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [isSlugUserModified, setIsSlugUserModified] = useState(false);
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
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(getDefaultPromoCodesForCourse());

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

      const encodedGuide = encodeCourseQuizSettings(null, {
        guideText: guideText.trim() || null,
        promoCodes: promoCodes
      });

      // 1. Insert Course
      const courseInsertPayload: any = {
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
        guide_text: encodedGuide,
        youtube_video_url: youtubeVideoUrl || null,
        cover_image_url: coverImageUrl,
        product_type: productType,
        download_file_url: uploadedFileUrl,
        template_id: templateId || null,
        promo_codes: promoCodes,
        slug: await getUniqueSlug(customSlug || title)
      };

      let { data: courseData, error: courseError } = await supabase
        .from('courses')
        .insert([courseInsertPayload])
        .select()
        .single();

      if (courseError && (courseError.message?.includes('slug') || courseError.code === 'PGRST204')) {
        delete courseInsertPayload.slug;
        const retryRes = await supabase
          .from('courses')
          .insert([courseInsertPayload])
          .select()
          .single();
        courseData = retryRes.data;
        courseError = retryRes.error;
      }

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
          download_files: mod.download_files || [],
          scheduled_date: mod.scheduled_date ? new Date(mod.scheduled_date).toISOString() : null
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
                originalMod.download_files.forEach((file: any) => {
                  if (file.url && file.type !== 'session') {
                    filesToInsert.push({
                      module_id: savedMod.id,
                      name: file.name,
                      url: file.url
                    });
                  }
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
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto pb-28 font-sans">
      
      {/* Top Banner Header */}
      <div className="mb-8 bg-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-4 z-10">
          <button
            type="button"
            onClick={() => navigate('/admin/formations')}
            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-md transition-all flex items-center justify-center shrink-0 border border-white/10 group"
            title="Retour aux formations"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                {productType === 'ebook' ? 'E-Book / PDF' : 'Formation en Ligne'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
              {productType === 'ebook' ? 'Créer un E-book' : 'Créer une Formation'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              {productType === 'ebook' ? 'Configurez votre ouvrage numérique téléchargeable.' : 'Structurez le contenu, le tarif et les modules de votre formation.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 z-10">
          <button
            type="button"
            onClick={() => navigate('/admin/formations')}
            className="px-4 py-3 text-xs font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl transition-all"
          >
            Annuler
          </button>
        </div>
      </div>

      {trainers.length === 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-amber-200 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-900">
              Aucun formateur n'existe dans la base de données. Vous devez en créer au moins un.
            </p>
          </div>
          <button 
            onClick={createDefaultTrainer}
            type="button"
            className="text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 px-4 py-2 rounded-xl transition-colors shrink-0"
          >
            Créer un formateur par défaut
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 flex items-start gap-3 border border-red-200 text-red-700 shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success ? (
        <div className="p-10 bg-white rounded-3xl border border-slate-200 shadow-lg text-center flex flex-col items-center max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">
            {productType === 'ebook' ? 'E-book créé avec succès !' : 'Formation créée avec succès !'}
          </h3>
          <p className="text-sm text-slate-500 mb-8 max-w-md">
            {productType === 'ebook' 
              ? 'Votre e-book est désormais configuré et disponible sur la plateforme.' 
              : 'Votre formation est en ligne ! Vous pouvez partager le lien d\'inscription avec vos apprenants.'}
          </p>
          
          <div className="w-full space-y-3">
            {createdCourseId && (
              <ShareCourseButton 
                courseId={createdCourseId} 
                courseTitle={title}
                className="w-full py-3.5"
              />
            )}
            <button
              onClick={() => navigate('/admin/formations')}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-2xl hover:bg-slate-200 transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour aux formations
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Card Selector: Product Type */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span>Type de Produit</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setProductType('formation')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                  productType === 'formation'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${
                  productType === 'formation' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  🎓
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Formation en Ligne</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Avec modules, séances en direct ou replay et quizz interactive.</p>
                </div>
              </div>

              <div
                onClick={() => setProductType('ebook')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                  productType === 'ebook'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${
                  productType === 'ebook' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  📚
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">E-book (Document PDF)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Fichier numérique téléchargeable directement après achat.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Desktop Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Informations Principales */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="space-y-5 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200">
                <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                  Informations Générales
                </h2>
                
                <div>
                  <NativeImageUploader 
                    onUploadSuccess={(url) => setCoverImageUrl(url)}
                    label="Image de couverture (Recommandé 16:9)"
                    previewUrl={coverImageUrl || ''}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    {productType === 'ebook' ? "Titre de l'e-book *" : "Titre de la formation *"}
                  </label>
                  <input
                    required
                    type="text"
                    value={title}
                    onChange={e => {
                      const val = e.target.value;
                      setTitle(val);
                      if (!isSlugUserModified) {
                        setCustomSlug(generateSlug(val));
                      }
                    }}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm font-medium shadow-xs"
                    placeholder={productType === 'ebook' ? "Ex: Guide Ultime de l'Entrepreneuriat" : "Ex: Maîtriser le Marketing Digital"}
                  />
                </div>

                <SupabaseSlugMigrationBanner />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Slug d'URL publique (personnalisable)
                    </label>
                    {title && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomSlug(generateSlug(title));
                          setIsSlugUserModified(false);
                        }}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                      >
                        Synchroniser avec le titre
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono bg-slate-100 px-3 py-3 border border-slate-200 rounded-2xl shrink-0">
                      /course/
                    </span>
                    <input
                      type="text"
                      value={customSlug}
                      onChange={e => {
                        setIsSlugUserModified(true);
                        setCustomSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                      }}
                      className="block w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm font-mono shadow-xs"
                      placeholder="ex: excel-debutant"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                    <span>URL publique finale :</span>
                    <code className="text-indigo-600 font-bold font-mono bg-indigo-50 px-1.5 py-0.5 rounded">
                      /course/{customSlug || 'votre-slug'}
                    </code>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Initiales (pour l'exportation des contacts)</label>
                  <input
                    type="text"
                    value={initials}
                    onChange={e => setInitials(e.target.value)}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm shadow-xs font-medium"
                    placeholder="Ex: MKT"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Description détaillée</label>
                    <button
                      type="button"
                      onClick={() => setIsRichTextModalOpen(true)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                    >
                      {description ? "Modifier le texte" : "+ Rédiger avec mise en forme"}
                    </button>
                  </div>

                  {description ? (
                    <div className="relative group bg-slate-50 border border-slate-200 rounded-2xl p-4 transition-all">
                      <div 
                        className="text-xs text-slate-700 leading-relaxed max-h-48 overflow-y-auto prose max-w-none 
                          [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&_strong]:font-bold [&_em]:italic [&_u]:underline"
                        dangerouslySetInnerHTML={{ __html: description }}
                      />
                      <button
                        type="button"
                        onClick={() => setIsRichTextModalOpen(true)}
                        className="mt-3 text-xs font-bold text-indigo-600 hover:underline"
                      >
                        Modifier le contenu
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsRichTextModalOpen(true)}
                      className="block w-full py-8 px-4 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50/50 transition-all text-sm group cursor-pointer"
                    >
                      <Palette className="w-6 h-6 mx-auto text-slate-400 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="font-bold block text-xs mb-1 text-slate-700">
                        Rédiger la présentation enrichie
                      </span>
                      <span className="text-[11px] text-slate-400 block">Formatez vos paragraphes, listes à puces et points forts</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Prix (FCFA) *</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={priceFcfa}
                      onChange={e => setPriceFcfa(e.target.value)}
                      className="block w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm font-bold shadow-xs"
                      placeholder="Ex: 25000"
                    />
                  </div>

                  {productType === 'formation' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Date et Heure {!isDateTbd && '*'}
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isDateTbd}
                            onChange={e => {
                              setIsDateTbd(e.target.checked);
                              if (e.target.checked) setDateTime('');
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                          />
                          <span className="text-xs font-medium text-slate-500">Date à déterminer</span>
                        </label>
                      </div>
                      <input
                        disabled={isDateTbd}
                        type="datetime-local"
                        value={dateTime}
                        onChange={e => setDateTime(e.target.value)}
                        className="block w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm disabled:bg-slate-50 disabled:text-slate-400 shadow-xs"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-indigo-600" /> {productType === 'ebook' ? 'Auteur / Formateur *' : 'Formateur Référent *'}
                    </label>
                    <select
                      required
                      value={trainerId}
                      onChange={e => setTrainerId(e.target.value)}
                      disabled={trainers.length === 0}
                      className="block w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm font-medium bg-white shadow-xs"
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
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Places Limitées (Optionnel)</label>
                      <input
                        type="number"
                        min="1"
                        value={maxSeats}
                        onChange={e => setMaxSeats(e.target.value)}
                        className="block w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm font-medium shadow-xs"
                        placeholder="Ex: 50"
                      />
                    </div>
                  )}
                </div>

                {productType !== 'ebook' && (
                  <div className="pt-2">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={e => setIsActive(e.target.checked)}
                        className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-600"
                      />
                      <span className="text-sm font-bold text-slate-900">Activer directement la formation sur la plateforme</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Section: Design public */}
              {templates.length > 0 && (
                <div className="space-y-4 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200">
                  <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-indigo-600" />
                     Thème Visuel de la Page Vente
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {templates.map(template => (
                      <label 
                        key={template.id} 
                        className={`relative flex items-center p-4 cursor-pointer rounded-2xl border-2 transition-all ${
                          templateId === template.id 
                            ? 'border-indigo-600 bg-indigo-50/40 shadow-xs' 
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
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
                          className="w-8 h-8 rounded-xl border border-black/10 flex-shrink-0 shadow-xs mr-3.5" 
                          style={{ backgroundColor: template.primary_color }}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 text-xs truncate">{template.name}</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{template.layout_style}</p>
                        </div>
                        {templateId === template.id && (
                          <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 ml-2" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Right Column: Liens, Ebook, Promos, et Modules */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Promo code manager */}
              <PromoCodeManager
                promoCodes={promoCodes}
                onChange={setPromoCodes}
                coursePriceFcfa={parseInt(priceFcfa, 10) || 0}
              />

              {/* Section: Fichier Ebook ou Liens de formation */}
              <div className="space-y-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-3">
                  {productType === 'ebook' ? 'Document PDF E-book *' : 'Liens Utiles & Ressources'}
                </h2>
                
                <div className="space-y-4">
                  {productType === 'ebook' ? (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" /> Téléverser le fichier PDF *
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
                        className="block w-full text-xs text-slate-500
                          file:mr-4 file:py-2.5 file:px-4
                          file:rounded-xl file:border-0
                          file:text-xs file:font-bold
                          file:bg-indigo-50 file:text-indigo-700
                          hover:file:bg-indigo-100 cursor-pointer
                        "
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Lien Groupe WhatsApp</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <MessageCircle className="h-4 w-4 text-emerald-600" />
                          </div>
                          <input
                            type="url"
                            value={whatsappLink}
                            onChange={e => setWhatsappLink(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-indigo-600 text-xs shadow-xs"
                            placeholder="https://chat.whatsapp.com/..."
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Lien Visio Google Meet</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Video className="h-4 w-4 text-blue-600" />
                          </div>
                          <input
                            type="url"
                            value={googleMeetLink}
                            onChange={e => setGoogleMeetLink(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-indigo-600 text-xs shadow-xs"
                            placeholder="https://meet.google.com/..."
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Vidéo YouTube de Présentation</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Video className="h-4 w-4 text-red-500" />
                      </div>
                      <input
                        type="url"
                        value={youtubeVideoUrl}
                        onChange={e => setYoutubeVideoUrl(e.target.value)}
                        className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-indigo-600 text-xs shadow-xs"
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Program Modules */}
              {productType === 'formation' && (
                <div className="space-y-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-base font-extrabold text-slate-900">Modules & Programme</h2>
                    <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                      {modules.length} Module{modules.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {modules.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200 border-dashed p-6 flex flex-col items-center gap-3">
                      <p className="text-xs text-slate-500">
                        Aucun module configuré. Ajoutez-en pour détailler le programme.
                      </p>
                      <button
                        type="button"
                        onClick={addModule}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter le premier module
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {modules.map((mod, index) => (
                        <div key={mod.localId} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 relative group">
                          <button
                            type="button"
                            onClick={() => removeModule(mod.localId)}
                            className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer ce module"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div className="space-y-3 pr-8">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">
                              Module {index + 1}
                            </span>
                            <input
                              required
                              type="text"
                              value={mod.title}
                              onChange={e => updateModule(mod.localId, 'title', e.target.value)}
                              className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                              placeholder="Titre du module"
                            />
                            <textarea
                              required
                              value={mod.description}
                              onChange={e => updateModule(mod.localId, 'description', e.target.value)}
                              rows={2}
                              className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs resize-none focus:ring-2 focus:ring-indigo-600"
                              placeholder="Description rapide..."
                            />
                            
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                              <button
                                type="button"
                                onClick={() => setEnrichingModuleLocalId(mod.localId)}
                                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl transition-all"
                              >
                                <Palette className="w-3.5 h-3.5" />
                                <span>{mod.long_summary || mod.youtube_url || (mod.download_files && mod.download_files.length > 0) || mod.quiz ? 'Enrichi (Modifier)' : 'Enrichir le module'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addModule}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-all"
                      >
                        <Plus className="w-4 h-4 text-indigo-600" />
                        <span>Ajouter un autre module</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Sticky Bottom Bar for PC */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 p-4 z-40 shadow-lg">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-5 py-3 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-2xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500" />
                <span className="hidden sm:inline">Annuler et retour</span>
              </button>
              
              <button
                type="submit"
                disabled={submitting || trainers.length === 0}
                className="flex-1 sm:flex-none px-8 py-3.5 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 text-white" />
                    <span>Création en cours...</span>
                  </>
                ) : productType === 'ebook' ? (
                  "Publier l'E-book"
                ) : (
                  'Publier la Formation'
                )}
              </button>
            </div>
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
