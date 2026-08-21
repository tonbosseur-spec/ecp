import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { parseCourseQuizSettings, encodeCourseQuizSettings } from '../lib/quizUtils';
import { PromoCode, getDefaultPromoCodesForCourse, extractCoursePromoCodes } from '../lib/promoUtils';
import PromoCodeManager from './PromoCodeManager';
import { 
  Loader2, ArrowLeft, ArrowRight, Save, CheckCircle2, AlertCircle, 
  Trash2, Plus, GripVertical, Check, Video, FileText, Image as ImageIcon,
  MessageCircle, Link as LinkIcon, User, Calendar
} from 'lucide-react';
import { NativeImageUploader } from './NativeImageUploader';
import { RichTextEditorModal } from './RichTextEditorModal';
import { EnrichModuleModal } from './EnrichModuleModal';
import { generateSlug, getUniqueSlug } from '../lib/slugUtils';

interface Trainer { id: string; name: string; }
interface Template { id: string; name: string; }
interface ModuleInput {
  localId: string;
  title: string;
  description: string;
  long_summary?: string;
  youtube_url?: string;
  download_files?: { name: string; url: string; type?: string }[];
  quiz?: any;
  scheduled_date?: string;
}

export default function AdminCourseWizard({ courseId }: { courseId?: string }) {
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // References
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  // Form State
  const [title, setTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [initials, setInitials] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState('');

  const [dateTime, setDateTime] = useState('');
  const [isDateTbd, setIsDateTbd] = useState(false);
  const [maxSeats, setMaxSeats] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');
  const [googleMeetLink, setGoogleMeetLink] = useState('');

  const [priceFcfa, setPriceFcfa] = useState('');
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);

  const [modules, setModules] = useState<ModuleInput[]>([]);

  const [isActive, setIsActive] = useState(true);
  const [templateId, setTemplateId] = useState('');
  const [guideUrl, setGuideUrl] = useState('');
  const [guideText, setGuideText] = useState('');

  // Modals
  const [isRichTextModalOpen, setIsRichTextModalOpen] = useState(false);
  const [enrichingModuleLocalId, setEnrichingModuleLocalId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [courseId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [trainersRes, templatesRes] = await Promise.all([
        supabase.from('trainers').select('id, name').order('name'),
        supabase.from('templates').select('*').order('name')
      ]);

      if (trainersRes.error) throw trainersRes.error;
      if (templatesRes.error) throw templatesRes.error;

      setTrainers(trainersRes.data || []);
      setTemplates(templatesRes.data || []);

      if (courseId) {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select(`*, course_modules(*, module_files(*))`)
          .eq('id', courseId)
          .single();
          
        if (courseError) throw courseError;
        
        setTitle(courseData.title || '');
        setCustomSlug(courseData.slug || generateSlug(courseData.title || ''));
        setInitials(courseData.initials || '');
        setTrainerId(courseData.trainer_id || '');
        setCoverImageUrl(courseData.cover_image_url || null);
        setDescription(courseData.description || '');
        setYoutubeVideoUrl(courseData.youtube_video_url || '');

        if (courseData.is_date_tbd || !courseData.date_time) {
          setIsDateTbd(true);
          setDateTime('');
        } else {
          setIsDateTbd(false);
          const date = new Date(courseData.date_time);
          setDateTime(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        }

        setMaxSeats(courseData.max_seats ? courseData.max_seats.toString() : '');
        setWhatsappLink(courseData.whatsapp_link || '');
        setGoogleMeetLink(courseData.google_meet_link || '');
        setPriceFcfa(courseData.price_fcfa ? courseData.price_fcfa.toString() : '');
        setIsActive(courseData.is_active !== false);
        setTemplateId(courseData.template_id || (templatesRes.data && templatesRes.data.length > 0 ? templatesRes.data[0].id : ''));
        setGuideUrl(courseData.guide_url || '');

        const parsedQuizSettings = parseCourseQuizSettings(courseData.guide_text);
        setGuideText(parsedQuizSettings.guideText || '');
        setPromoCodes(extractCoursePromoCodes(courseData));

        if (courseData.course_modules && courseData.course_modules.length > 0) {
          const moduleIds = courseData.course_modules.map((m: any) => m.id);
          const { data: quizzesData } = await supabase
            .from('quizzes')
            .select('*')
            .in('module_id', moduleIds);
          
          const sortedModules = courseData.course_modules.sort((a: any, b: any) => a.order_index - b.order_index);
          const mappedModules = sortedModules.map((m: any) => {
            const moduleQuiz = quizzesData?.find((q: any) => q.module_id === m.id);
            const rawFiles = m.download_files || [];
            const sessions = rawFiles.filter((f: any) => f.type === 'session');
            const filesFromRaw = rawFiles.filter((f: any) => f.type !== 'session');
            const filesFromTable = m.module_files || [];
            const effectiveFiles = filesFromTable.length > 0 ? filesFromTable : filesFromRaw;

            return {
              localId: m.id || Math.random().toString(36).substring(7),
              title: m.title,
              description: m.description,
              long_summary: m.long_summary || '',
              youtube_url: m.youtube_url || '',
              download_files: [...effectiveFiles, ...sessions],
              quiz: moduleQuiz ? { title: moduleQuiz.title, questions: moduleQuiz.questions } : null,
              scheduled_date: m.scheduled_date ? m.scheduled_date.substring(0, 16) : ''
            };
          });
          setModules(mappedModules);
        }
      } else {
        if (trainersRes.data && trainersRes.data.length > 0) setTrainerId(trainersRes.data[0].id);
        if (templatesRes.data && templatesRes.data.length > 0) setTemplateId(templatesRes.data[0].id);
        setPromoCodes(getDefaultPromoCodesForCourse());
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (publish: boolean) => {
    setError(null);
    setSubmitting(true);

    if (!title.trim()) {
      setError('Le titre est requis.');
      setSubmitting(false);
      return;
    }
    if (!trainerId) {
      setError('Veuillez sélectionner un formateur.');
      setSubmitting(false);
      return;
    }
    if (publish && !priceFcfa) {
      setError('Le prix est requis pour la publication.');
      setSubmitting(false);
      return;
    }
    if (publish && !isDateTbd && !dateTime) {
      setError('Veuillez spécifier une date ou cocher "Date à déterminer".');
      setSubmitting(false);
      return;
    }

    try {
      const courseDataToSave: any = {
        title,
        initials: initials || null,
        description,
        price_fcfa: priceFcfa ? parseInt(priceFcfa, 10) : 0,
        date_time: (isDateTbd || !dateTime) ? null : new Date(dateTime).toISOString(),
        is_date_tbd: isDateTbd,
        trainer_id: trainerId,
        max_seats: maxSeats ? parseInt(maxSeats, 10) : null,
        is_active: publish,
        whatsapp_link: whatsappLink || null,
        google_meet_link: googleMeetLink || null,
        guide_url: guideUrl || null,
        guide_text: encodeCourseQuizSettings(null, {
          guideText: guideText.trim() || null,
          promoCodes: promoCodes
        }),
        youtube_video_url: youtubeVideoUrl || null,
        cover_image_url: coverImageUrl,
        product_type: 'formation',
        download_file_url: null,
        template_id: templateId || null,
        promo_codes: promoCodes,
      };

      let finalCourseId = courseId;
      const finalSlug = await getUniqueSlug(customSlug || title, courseId);
      courseDataToSave.slug = finalSlug;

      if (courseId) {
        let { error: courseError } = await supabase
          .from('courses')
          .update(courseDataToSave)
          .eq('id', courseId);
          
        if (courseError && (courseError.message?.includes('slug') || courseError.code === 'PGRST204')) {
          delete courseDataToSave.slug;
          const retryRes = await supabase.from('courses').update(courseDataToSave).eq('id', courseId);
          courseError = retryRes.error;
        }
        if (courseError) throw courseError;
      } else {
        let { data, error: courseError } = await supabase
          .from('courses')
          .insert([courseDataToSave])
          .select()
          .single();
          
        if (courseError && (courseError.message?.includes('slug') || courseError.code === 'PGRST204')) {
          delete courseDataToSave.slug;
          const retryRes = await supabase.from('courses').insert([courseDataToSave]).select().single();
          data = retryRes.data;
          courseError = retryRes.error;
        }
        if (courseError) throw courseError;
        finalCourseId = data.id;
      }

      // Modules Management
      const currentModuleIds = modules.map(m => m.localId).filter(id => id.includes('-'));
      
      let deleteQuery = supabase.from('course_modules').delete().eq('course_id', finalCourseId);
      if (currentModuleIds.length > 0) {
        deleteQuery = deleteQuery.not('id', 'in', `(${currentModuleIds.join(',')})`);
      }
      const { error: deleteError } = await deleteQuery;
      if (deleteError) throw deleteError;

      if (modules.length > 0) {
        const modulesToUpsert = modules.map((mod, index) => {
          const isExisting = mod.localId.includes('-');
          return {
            ...(isExisting ? { id: mod.localId } : {}),
            course_id: finalCourseId,
            title: mod.title,
            description: mod.description,
            order_index: index,
            long_summary: mod.long_summary || null,
            youtube_url: mod.youtube_url || null,
            download_files: mod.download_files || [],
            scheduled_date: mod.scheduled_date ? new Date(mod.scheduled_date).toISOString() : null
          };
        });

        const { data: upsertedModules, error: upsertError } = await supabase
          .from('course_modules')
          .upsert(modulesToUpsert)
          .select();

        if (upsertError) throw upsertError;

        if (upsertedModules) {
          const upsertedModuleIds = upsertedModules.map(m => m.id);
          if (upsertedModuleIds.length > 0) {
            await supabase.from('module_files').delete().in('module_id', upsertedModuleIds);
          }

          const filesToInsert: any[] = [];
          for (const savedMod of upsertedModules) {
            const originalMod = modules.find(m => m.localId === savedMod.id) || modules[savedMod.order_index];
            
            if (originalMod) {
              if (originalMod.quiz) {
                const { data: existingQuiz } = await supabase.from('quizzes').select('id').eq('module_id', savedMod.id).maybeSingle();
                if (existingQuiz) {
                  await supabase.from('quizzes').update({
                    title: originalMod.quiz.title || `Quizz : ${savedMod.title}`,
                    questions: originalMod.quiz.questions
                  }).eq('id', existingQuiz.id);
                } else {
                  await supabase.from('quizzes').insert({
                    module_id: savedMod.id,
                    title: originalMod.quiz.title || `Quizz : ${savedMod.title}`,
                    questions: originalMod.quiz.questions
                  });
                }
              } else {
                await supabase.from('quizzes').delete().eq('module_id', savedMod.id);
              }

              if (originalMod.download_files && originalMod.download_files.length > 0) {
                originalMod.download_files.forEach((file: any) => {
                  if (file.url && file.type !== 'session') {
                    filesToInsert.push({ module_id: savedMod.id, name: file.name, url: file.url });
                  }
                });
              }
            }
          }

          if (filesToInsert.length > 0) {
            await supabase.from('module_files').insert(filesToInsert);
          }
        }
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/admin/formations');
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && (!title || !trainerId)) {
      setError('Titre et formateur sont requis pour continuer.');
      return;
    }
    setError(null);
    setCurrentStep(prev => Math.min(prev + 1, 6));
  };

  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Chargement...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Enregistré avec succès !</h2>
        <p className="text-gray-500">Redirection en cours...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-24 font-sans">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => navigate('/admin/formations')} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {courseId ? 'Modifier la formation' : 'Nouvelle formation'}
        </h1>
        <div className="w-9" />
      </div>

      {/* Stepper Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-medium text-gray-500 mb-2">
          <span className={currentStep === 1 ? 'text-emerald-600 font-bold' : ''}>1. Infos</span>
          <span className={currentStep === 2 ? 'text-emerald-600 font-bold' : 'hidden sm:inline'}>2. Présentation</span>
          <span className={currentStep === 3 ? 'text-emerald-600 font-bold' : 'hidden sm:inline'}>3. Programmation</span>
          <span className={currentStep === 4 ? 'text-emerald-600 font-bold' : 'hidden sm:inline'}>4. Tarifs</span>
          <span className={currentStep === 5 ? 'text-emerald-600 font-bold' : 'hidden sm:inline'}>5. Programme</span>
          <span className={currentStep === 6 ? 'text-emerald-600 font-bold' : ''}>6. Valid.</span>
        </div>
        <div className="h-2 flex bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${(currentStep / 6) * 100}%` }} />
        </div>
        <div className="mt-2 text-center text-sm font-semibold text-emerald-700 sm:hidden">
          Étape {currentStep} / 6
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 flex items-start gap-3 border border-red-100 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        
        {/* STEP 1 */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Informations Générales</h2>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Titre de la formation *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" placeholder="Ex: Introduction à R" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Slug URL (optionnel)</label>
                <input type="text" value={customSlug} onChange={e => setCustomSlug(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder={title ? generateSlug(title) : 'mon-super-cours'} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Initiales</label>
                <input type="text" value={initials} onChange={e => setInitials(e.target.value)} maxLength={4} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Ex: IR" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Formateur *</label>
              <select value={trainerId} onChange={e => setTrainerId(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                <option value="">Sélectionner un formateur</option>
                {trainers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <NativeImageUploader onUploadSuccess={url => setCoverImageUrl(url)} label="Image de couverture" previewUrl={coverImageUrl || ""} />
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Présentation Éditoriale</h2>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description détaillée</label>
              <div 
                className="w-full min-h-[150px] p-4 bg-gray-50 border border-gray-200 rounded-xl cursor-text hover:border-emerald-400 transition-colors prose prose-sm max-w-none"
                onClick={() => setIsRichTextModalOpen(true)}
                dangerouslySetInnerHTML={{ __html: description || '<span class="text-gray-400">Cliquez pour éditer la présentation...</span>' }}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                <Video className="w-4 h-4" /> Vidéo de présentation (YouTube)
              </label>
              <input type="url" value={youtubeVideoUrl} onChange={e => setYoutubeVideoUrl(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="https://youtube.com/watch?v=..." />
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Programmation & Modalités</h2>
            
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={isDateTbd} onChange={e => setIsDateTbd(e.target.checked)} className="w-5 h-5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" />
                <span className="text-sm font-semibold text-gray-700 group-hover:text-emerald-700 transition-colors">Date à déterminer ultérieurement</span>
              </label>
              
              {!isDateTbd && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Date et heure de début</label>
                  <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Places limitées (optionnel)</label>
                <input type="number" value={maxSeats} onChange={e => setMaxSeats(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Ex: 50" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-500" /> Lien WhatsApp
                </label>
                <input type="url" value={whatsappLink} onChange={e => setWhatsappLink(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="https://chat.whatsapp.com/..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-500" /> Lien Google Meet
                </label>
                <input type="url" value={googleMeetLink} onChange={e => setGoogleMeetLink(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="https://meet.google.com/..." />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4 */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Tarification</h2>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Prix de la formation (FCFA) *</label>
              <input type="number" value={priceFcfa} onChange={e => setPriceFcfa(e.target.value)} className="w-full px-4 py-3 text-lg font-bold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Ex: 35000" />
            </div>

            <div className="pt-4 border-t border-gray-100">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Codes promotionnels</label>
              <PromoCodeManager promoCodes={promoCodes} coursePriceFcfa={parseInt(priceFcfa, 10) || 0} onChange={setPromoCodes} />
            </div>
          </div>
        )}

        {/* STEP 5 */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Programme & Ressources</h2>
              <button 
                onClick={() => setModules([...modules, { localId: Math.random().toString(36).substring(7), title: '', description: '' }])}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 font-semibold rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <Plus className="w-4 h-4" /> Ajouter un module
              </button>
            </div>
            
            <div className="space-y-4">
              {modules.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                  <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 font-medium">Aucun module pour le moment.</p>
                </div>
              ) : (
                modules.map((mod, index) => (
                  <div key={mod.localId} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm group">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center justify-center text-gray-300 cursor-move">
                        <GripVertical className="w-5 h-5" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <input type="text" value={mod.title} onChange={e => setModules(modules.map(m => m.localId === mod.localId ? { ...m, title: e.target.value } : m))} className="w-full font-bold px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder={`Titre du module ${index + 1}`} />
                        <textarea value={mod.description} onChange={e => setModules(modules.map(m => m.localId === mod.localId ? { ...m, description: e.target.value } : m))} className="w-full text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 min-h-[80px]" placeholder="Brève description..." />
                        
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                          <button onClick={() => setEnrichingModuleLocalId(mod.localId)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Fichiers, Vidéo & Quiz
                          </button>
                        </div>
                      </div>
                      <button onClick={() => setModules(modules.filter(m => m.localId !== mod.localId))} className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg self-start transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP 6 */}
        {currentStep === 6 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Vérification & Publication</h2>
            
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{title || 'Sans titre'}</h3>
                  <p className="text-sm text-gray-500">{trainerId ? trainers.find(t => t.id === trainerId)?.name : 'Aucun formateur sélectionné'}</p>
                </div>
                <button onClick={() => setCurrentStep(1)} className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">Modifier</button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 block mb-1">Date</span>
                  <span className="font-semibold text-gray-900">
                    {isDateTbd ? 'À déterminer' : dateTime ? new Date(dateTime).toLocaleString('fr-FR') : 'Non renseignée'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">Prix</span>
                  <span className="font-semibold text-gray-900">{priceFcfa ? `${priceFcfa} FCFA` : 'Non renseigné'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">Modules</span>
                  <span className="font-semibold text-gray-900">{modules.length} module(s) configuré(s)</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">Codes Promo</span>
                  <span className="font-semibold text-gray-900">{promoCodes.length} code(s) actif(s)</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:pl-72 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={prevStep}
            disabled={currentStep === 1 || submitting}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
              currentStep === 1 ? 'opacity-0 pointer-events-none' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Précédent</span>
          </button>

          <div className="flex gap-3">
            {currentStep === 6 ? (
              <>
                <button
                  onClick={() => handleSave(false)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 hidden sm:inline" />}
                  Brouillon
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 hidden sm:inline" />}
                  Publier
                </button>
              </>
            ) : (
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <span className="hidden sm:inline">Suivant</span> <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <RichTextEditorModal
        isOpen={isRichTextModalOpen}
        onClose={() => setIsRichTextModalOpen(false)}
        initialValue={description}
        onSave={setDescription}
        title="Description de la formation"
      />

      {enrichingModuleLocalId && (
        <EnrichModuleModal
          isOpen={true}
          onClose={() => setEnrichingModuleLocalId(null)}
          moduleTitle={modules.find(m => m.localId === enrichingModuleLocalId)?.title || 'Module'}
          initialData={modules.find(m => m.localId === enrichingModuleLocalId) || {}}
          onSave={data => {
            setModules(modules.map(m => m.localId === enrichingModuleLocalId ? { ...m, ...data } : m));
            setEnrichingModuleLocalId(null);
          }}
        />
      )}
    </div>
  );
}
