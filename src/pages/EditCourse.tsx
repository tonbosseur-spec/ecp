import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Plus, Trash2, AlertCircle, CheckCircle2, Video, Link as LinkIcon, MessageCircle, FileText, User, ArrowLeft } from 'lucide-react';

interface Trainer {
  id: string;
  name: string;
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
  const [loading, setLoading] = useState(true);
  
  // Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceFcfa, setPriceFcfa] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [maxSeats, setMaxSeats] = useState('');
  
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
      
      // Fetch Trainers
      const { data: trainersData, error: trainersError } = await supabase
        .from('trainers')
        .select('id, name')
        .order('name');

      if (trainersError) throw trainersError;
      setTrainers(trainersData || []);

      // Fetch Course Data
      if (id) {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select(`*, course_modules(*)`)
          .eq('id', id)
          .single();
          
        if (courseError) throw courseError;
        
        setTitle(courseData.title);
        setDescription(courseData.description || '');
        setPriceFcfa(courseData.price_fcfa.toString());
        
        // Format date for datetime-local input (YYYY-MM-DDThh:mm)
        const date = new Date(courseData.date_time);
        const formattedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setDateTime(formattedDate);
        
        setTrainerId(courseData.trainer_id);
        setMaxSeats(courseData.max_seats ? courseData.max_seats.toString() : '');
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
      // 1. Update Course
      const { error: courseError } = await supabase
        .from('courses')
        .update({
          title,
          description,
          price_fcfa: parseInt(priceFcfa, 10),
          date_time: new Date(dateTime).toISOString(),
          trainer_id: trainerId,
          max_seats: maxSeats ? parseInt(maxSeats, 10) : null,
          whatsapp_link: whatsappLink || null,
          google_meet_link: googleMeetLink || null,
          guide_url: guideUrl || null,
          guide_text: guideText || null,
          youtube_video_url: youtubeVideoUrl || null,
        })
        .eq('id', id);

      if (courseError) throw courseError;

      // 2. Delete existing modules
      const { error: deleteError } = await supabase
        .from('course_modules')
        .delete()
        .eq('course_id', id);

      if (deleteError) throw deleteError;

      // 3. Insert new modules
      if (modules.length > 0) {
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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Modifier la formation</h1>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Formation modifiée !</h3>
          <p className="text-sm text-gray-600">Redirection vers les détails...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section: Informations Principales */}
          <div className="space-y-5 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Informations Principales</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Titre de la formation *</label>
              <input
                required
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-sm"
                placeholder="Ex: Maîtriser React en 2024"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-sm resize-none"
                placeholder="Décrivez le contenu de la formation..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date et Heure *</label>
                <input
                  required
                  type="datetime-local"
                  value={dateTime}
                  onChange={e => setDateTime(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-sm"
                />
              </div>
            </div>

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
          </div>

          {/* Section: Liens & Médias */}
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

          {/* Section: Modules */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Modules de la formation</h2>
              <button
                type="button"
                onClick={addModule}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            </div>

            {modules.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                Aucun module défini. Ajoutez-en pour détailler le programme.
              </p>
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
              </div>
            )}
          </div>

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
          
        </form>
      )}
    </div>
  );
}
