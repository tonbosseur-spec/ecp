import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Plus, Trash2, AlertCircle, CheckCircle2, Video, Link as LinkIcon, MessageCircle, FileText, User, ArrowLeft, Palette } from 'lucide-react';
import { NativeImageUploader } from '../components/NativeImageUploader';
import { RichTextEditorModal } from '../components/RichTextEditorModal';

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
}

export default function EditCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Data States
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  
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
  
  // Product Type and Ebook
  const [productType, setProductType] = useState('formation');
  const [isRichTextModalOpen, setIsRichTextModalOpen] = useState(false);
  const [downloadFile, setDownloadFile] = useState<File | null>(null);
  const [downloadFileUrl, setDownloadFileUrl] = useState<string | null>(null);
  
  // Image Upload
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

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

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch Trainers and Templates
      const [trainersRes, templatesRes] = await Promise.all([
        supabase.from('trainers').select('id, name').order('name'),
        supabase.from('templates').select('*').order('name')
      ]);

      if (trainersRes.error) throw trainersRes.error;
      if (templatesRes.error) throw templatesRes.error;

      setTrainers(trainersRes.data || []);
      setTemplates(templatesRes.data || []);

      // Fetch Course Data
      if (id) {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select(`*, course_modules(*)`)
          .eq('id', id)
          .single();
          
        if (courseError) throw courseError;
        
        setTitle(courseData.title);
        setInitials(courseData.initials || '');
        setDescription(courseData.description || '');
        setPriceFcfa(courseData.price_fcfa.toString());
        
        // Format date for datetime-local input (YYYY-MM-DDThh:mm)
        if (courseData.is_date_tbd || !courseData.date_time) {
          setIsDateTbd(true);
          setDateTime('');
        } else {
          setIsDateTbd(false);
          const date = new Date(courseData.date_time);
          const formattedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          setDateTime(formattedDate);
        }
        
        setTrainerId(courseData.trainer_id);
        setMaxSeats(courseData.max_seats ? courseData.max_seats.toString() : '');
        setIsActive(courseData.is_active !== false);
        setTemplateId(courseData.template_id || (templatesRes.data && templatesRes.data.length > 0 ? templatesRes.data[0].id : ''));
        setCoverImageUrl(courseData.cover_image_url || null);
        setProductType(courseData.product_type || 'formation');
        setDownloadFileUrl(courseData.download_file_url || null);
        setWhatsappLink(courseData.whatsapp_link || '');
        setGoogleMeetLink(courseData.google_meet_link || '');
        setGuideUrl(courseData.guide_url || '');
        setGuideText(courseData.guide_text || '');
        setYoutubeVideoUrl(courseData.youtube_video_url || '');

        if (courseData.course_modules) {
          const sortedModules = courseData.course_modules.sort((a: any, b: any) => a.order_index - b.order_index);
          setModules(sortedModules.map((m: any) => ({
            localId: m.id || Math.random().toString(36).substring(7),
            title: m.title,
            description: m.description
          })));
        }
      }

    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
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
      let uploadedFileUrl = downloadFileUrl;

      // If it's an ebook and a new file was uploaded, upload it to storage
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

      // 1. Prepare Update Object
      const updateData: any = {
        title,
        initials: initials || null,
        description,
        price_fcfa: parseInt(priceFcfa, 10),
        trainer_id: trainerId,
        is_active: isActive,
        cover_image_url: coverImageUrl,
        product_type: productType,
      };

      if (productType === 'ebook') {
        updateData.download_file_url = uploadedFileUrl;
        updateData.date_time = new Date().toISOString();
        updateData.is_date_tbd = false;
        updateData.max_seats = null;
        updateData.whatsapp_link = null;
        updateData.google_meet_link = null;
        updateData.guide_url = null;
        updateData.guide_text = null;
        updateData.youtube_video_url = null;
        updateData.template_id = null;
      } else {
        updateData.date_time = isDateTbd ? null : new Date(dateTime).toISOString();
        updateData.is_date_tbd = isDateTbd;
        updateData.max_seats = maxSeats ? parseInt(maxSeats, 10) : null;
        updateData.whatsapp_link = whatsappLink || null;
        updateData.google_meet_link = googleMeetLink || null;
        updateData.guide_url = guideUrl || null;
        updateData.guide_text = guideText || null;
        updateData.youtube_video_url = youtubeVideoUrl || null;
        updateData.template_id = templateId || null;
        updateData.download_file_url = null;
      }

      const { error: courseError } = await supabase
        .from('courses')
        .update(updateData)
        .eq('id', id);

      if (courseError) throw courseError;

      // 2. Delete existing modules
      const { error: deleteError } = await supabase
        .from('course_modules')
        .delete()
        .eq('course_id', id);

      if (deleteError) throw deleteError;

      // 3. Insert new modules if it's a formation
      if (productType !== 'ebook' && modules.length > 0) {
        const modulesToInsert = modules.map((mod, index) => ({
          course_id: id,
          title: mod.title,
          description: mod.description,
          order_index: index,
        }));

        const { error: modulesError } = await supabase
          .from('course_modules')
          .insert(modulesToInsert);

        if (modulesError) throw modulesError;
      }

      setSuccess(true);
      setTimeout(() => {
        navigate(`/courses/${id}`);
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de la modification.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto pb-24">
      <div className="mb-6 flex items-center gap-3">
        <button 
          onClick={() => navigate(`/courses/${id}`)}
          className="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {productType === 'ebook' ? "Modifier l'E-book" : "Modifier la formation"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Mettez à jour les informations</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 flex items-start gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success ? (
        <div className="p-8 bg-green-50 rounded-2xl border border-green-100 text-center flex flex-col items-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {productType === 'ebook' ? "E-book modifié !" : "Formation modifiée !"}
          </h3>
          <p className="text-sm text-gray-600">Redirection vers les détails...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section: Informations Principales */}
          <div className="space-y-5 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">
              {productType === 'ebook' ? 'Informations de l\'E-book' : 'Informations Principales'}
            </h2>
            
            <div>
              <NativeImageUploader 
                onUploadSuccess={(url) => setCoverImageUrl(url)}
                label="Image de couverture (Optionnel)"
                previewUrl={coverImageUrl || ''}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {productType === 'ebook' ? 'Titre de l\'E-book *' : 'Titre de la formation *'}
              </label>
              <input
                required
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-sm"
                placeholder={productType === 'ebook' ? "Ex: Le Guide Ultime de l'E-commerce" : "Ex: Maîtriser React en 2024"}
              />
            </div>

            {productType !== 'ebook' && (
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
            )}

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
              
              {productType !== 'ebook' ? (
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
                    required={!isDateTbd}
                    disabled={isDateTbd}
                    type="datetime-local"
                    value={dateTime}
                    onChange={e => setDateTime(e.target.value)}
                    className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-sm disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-100"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <User className="w-4 h-4" /> Auteur *
                  </label>
                  <select
                    required
                    value={trainerId}
                    onChange={e => setTrainerId(e.target.value)}
                    disabled={trainers.length === 0}
                    className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-sm bg-white disabled:bg-gray-50"
                  >
                    {trainers.length === 0 ? (
                      <option value="">Aucun auteur</option>
                    ) : (
                      trainers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>

            {productType !== 'ebook' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                    <User className="w-4 h-4" /> Formateur *
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
              </div>
            )}

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm font-medium text-gray-700">
                  {productType === 'ebook' ? "E-book disponible à l'achat" : "Formation active"}
                </span>
              </label>
            </div>
          </div>

          {/* Section: Fichier E-book si applicable */}
          {productType === 'ebook' && (
            <div className="space-y-5 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-500" />
                Fichier E-book (PDF)
              </h2>
              
              <div className="space-y-4">
                {downloadFileUrl && (
                  <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-between text-sm text-purple-800">
                    <span className="font-medium truncate max-w-[250px]">Fichier PDF actuel en ligne</span>
                    <a 
                      href={downloadFileUrl} 
                      target="_blank" 
                      referrerPolicy="no-referrer" 
                      className="text-xs text-purple-700 hover:text-purple-900 underline font-semibold shrink-0"
                    >
                      Visualiser le PDF
                    </a>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {downloadFileUrl ? "Remplacer le fichier PDF (Optionnel)" : "Uploader le PDF de l'E-book *"}
                  </label>
                  <input
                    required={!downloadFileUrl}
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
              </div>
            </div>
          )}

          {/* Section: Design de la page publique */}
          {productType !== 'ebook' && templates.length > 0 && (
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

          {/* Section: Liens & Médias */}
          {productType !== 'ebook' && (
            <div className="space-y-5 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Liens & Médias (Optionnel)</h2>
              
              <div className="space-y-4">
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
          )}

          {/* Section: Modules */}
          {productType !== 'ebook' && (
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

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                  Mise à jour...
                </>
              ) : (
                'Enregistrer les modifications'
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
          
        </form>
      )}
    </div>
  );
}
