import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { generateSlug, getUniqueSlug } from '../lib/slugUtils';
import { NativeImageUploader } from './NativeImageUploader';
import { RichTextEditorModal } from './RichTextEditorModal';
import { 
  Loader2, ArrowLeft, ArrowRight, Save, CheckCircle2, AlertCircle, 
  Trash2, FileText, Check, UploadCloud, BookOpen
} from 'lucide-react';

interface Trainer { id: string; name: string; }

export default function AdminEbookWizard({ ebookId }: { ebookId?: string }) {
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // References
  const [trainers, setTrainers] = useState<Trainer[]>([]);

  // Form State
  const [title, setTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileUrl, setPdfFileUrl] = useState<string | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  
  const [priceFcfa, setPriceFcfa] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Modals
  const [isRichTextModalOpen, setIsRichTextModalOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [ebookId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: trainersRes, error: trainersError } = await supabase
        .from('trainers')
        .select('id, name')
        .order('name');

      if (trainersError) throw trainersError;
      setTrainers(trainersRes || []);

      if (ebookId) {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .eq('id', ebookId)
          .eq('product_type', 'ebook')
          .single();
          
        if (courseError) throw courseError;
        
        setTitle(courseData.title || '');
        setCustomSlug(courseData.slug || generateSlug(courseData.title || ''));
        setTrainerId(courseData.trainer_id || '');
        setCoverImageUrl(courseData.cover_image_url || null);
        setDescription(courseData.description || '');
        setPdfFileUrl(courseData.download_file_url || null);
        setPriceFcfa(courseData.price_fcfa ? courseData.price_fcfa.toString() : '');
        setIsActive(courseData.is_active !== false);
        
      } else {
        if (trainersRes && trainersRes.length > 0) setTrainerId(trainersRes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Veuillez sélectionner un fichier PDF.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB max
      setError('Le fichier PDF ne doit pas dépasser 50 Mo.');
      return;
    }

    setError(null);
    setIsUploadingPdf(true);
    setPdfFile(file);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `ebook-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('course-image') // Reuse existing bucket for simplicity and compatibility
        .upload(fileName, file, { contentType: 'application/pdf' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('course-image')
        .getPublicUrl(fileName);

      setPdfFileUrl(publicUrl);
    } catch (err: any) {
      setError(`Erreur de téléversement du PDF: ${err.message}`);
      setPdfFile(null);
      setPdfFileUrl(null);
    } finally {
      setIsUploadingPdf(false);
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
      setError('Veuillez sélectionner un auteur.');
      setSubmitting(false);
      return;
    }
    if (publish && !pdfFileUrl) {
      setError('Le fichier PDF est requis pour la publication.');
      setSubmitting(false);
      return;
    }
    if (publish && !priceFcfa) {
      setError('Le prix est requis pour la publication.');
      setSubmitting(false);
      return;
    }

    try {
      const courseDataToSave: any = {
        title,
        description,
        price_fcfa: priceFcfa ? parseInt(priceFcfa, 10) : 0,
        trainer_id: trainerId,
        is_active: publish,
        cover_image_url: coverImageUrl,
        product_type: 'ebook',
        download_file_url: pdfFileUrl || null,
      };

      let finalCourseId = ebookId;
      const finalSlug = await getUniqueSlug(customSlug || title, ebookId);
      courseDataToSave.slug = finalSlug;

      if (ebookId) {
        let { error: courseError } = await supabase
          .from('courses')
          .update(courseDataToSave)
          .eq('id', ebookId);
          
        if (courseError && (courseError.message?.includes('slug') || courseError.code === 'PGRST204')) {
          delete courseDataToSave.slug;
          const retryRes = await supabase.from('courses').update(courseDataToSave).eq('id', ebookId);
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

      setSuccess(true);
      setTimeout(() => {
        navigate('/admin/ebooks');
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && (!title || !trainerId)) {
      setError('Titre et auteur sont requis pour continuer.');
      return;
    }
    setError(null);
    setCurrentStep(prev => Math.min(prev + 1, 4));
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
    <div className="max-w-3xl mx-auto pb-24 font-sans">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => navigate('/admin/ebooks')} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {ebookId ? 'Modifier l\'e-book' : 'Nouvel e-book'}
        </h1>
        <div className="w-9" />
      </div>

      {/* Stepper Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-medium text-gray-500 mb-2">
          <span className={currentStep === 1 ? 'text-indigo-600 font-bold' : ''}>1. Infos</span>
          <span className={currentStep === 2 ? 'text-indigo-600 font-bold' : ''}>2. Fichier PDF</span>
          <span className={currentStep === 3 ? 'text-indigo-600 font-bold' : ''}>3. Vente</span>
          <span className={currentStep === 4 ? 'text-indigo-600 font-bold' : ''}>4. Validation</span>
        </div>
        <div className="h-2 flex bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${(currentStep / 4) * 100}%` }} />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 flex items-start gap-3 border border-red-100 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        
        {/* STEP 1: Infos */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              Informations du livre
            </h2>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Titre de l'e-book *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" placeholder="Ex: Maîtriser le Code en 30 jours" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Slug URL (optionnel)</label>
                <input type="text" value={customSlug} onChange={e => setCustomSlug(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder={title ? generateSlug(title) : 'mon-super-ebook'} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Auteur *</label>
                <select value={trainerId} onChange={e => setTrainerId(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">Sélectionner un auteur</option>
                  {trainers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <div 
                className="w-full min-h-[120px] p-4 bg-gray-50 border border-gray-200 rounded-xl cursor-text hover:border-indigo-400 transition-colors prose prose-sm max-w-none"
                onClick={() => setIsRichTextModalOpen(true)}
                dangerouslySetInnerHTML={{ __html: description || '<span class="text-gray-400">Cliquez pour éditer la présentation...</span>' }}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Couverture (Image)</label>
              <NativeImageUploader onUploadSuccess={url => setCoverImageUrl(url)} previewUrl={coverImageUrl || ""} label="Téléverser la couverture" />
            </div>
          </div>
        )}

        {/* STEP 2: Fichier PDF */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Le document PDF
            </h2>
            
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
              <input 
                type="file" 
                ref={fileInputRef}
                accept="application/pdf"
                onChange={handlePdfUpload}
                className="hidden"
              />
              
              {isUploadingPdf ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <p className="text-sm font-medium text-gray-700">Téléversement en cours...</p>
                </div>
              ) : pdfFileUrl ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">PDF prêt !</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-[250px] truncate">{pdfFile?.name || 'Fichier PDF distant'}</p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => window.open(pdfFileUrl, '_blank')}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Aperçu
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      Remplacer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Téléversez le fichier</h3>
                    <p className="text-xs text-gray-500 mt-1">Format PDF uniquement (max 50 Mo)</p>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors mt-2"
                  >
                    Sélectionner le PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Commercialisation */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Commercialisation</h2>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Prix de l'e-book (FCFA) *</label>
              <input type="number" value={priceFcfa} onChange={e => setPriceFcfa(e.target.value)} className="w-full px-4 py-3 text-lg font-bold bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Ex: 5000" />
            </div>
          </div>
        )}

        {/* STEP 4: Vérification */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Vérification & Publication</h2>
            
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 flex flex-col sm:flex-row gap-6">
              {coverImageUrl ? (
                <img src={coverImageUrl} alt="Couverture" className="w-32 h-40 object-cover rounded-xl shadow-sm border border-gray-200" />
              ) : (
                <div className="w-32 h-40 bg-gray-200 rounded-xl flex items-center justify-center text-gray-400 border border-gray-300">
                  <BookOpen className="w-8 h-8 opacity-50" />
                </div>
              )}

              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{title || 'Sans titre'}</h3>
                    <p className="text-sm text-gray-500">{trainerId ? trainers.find(t => t.id === trainerId)?.name : 'Aucun auteur'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm bg-white p-3 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-gray-500 block mb-0.5 text-xs">Prix</span>
                    <span className="font-semibold text-gray-900">{priceFcfa ? `${priceFcfa} FCFA` : 'Gratuit'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5 text-xs">Fichier</span>
                    <span className={`font-semibold ${pdfFileUrl ? 'text-emerald-600' : 'text-red-500'}`}>
                      {pdfFileUrl ? 'PDF attaché' : 'Manquant'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:pl-72 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
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
            {currentStep === 4 ? (
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
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 hidden sm:inline" />}
                  Publier
                </button>
              </>
            ) : (
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
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
        title="Description de l'e-book"
      />
    </div>
  );
}
