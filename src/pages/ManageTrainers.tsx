import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, User, Image as ImageIcon, ArrowLeft, UserPlus, Search, Trash2, Award, Users, CheckCircle, Edit, X } from 'lucide-react';
import { NativeImageUploader } from '../components/NativeImageUploader';
import { TrainerAvatar } from '../components/TrainerAvatar';

interface Trainer {
  id: string;
  name: string;
  description: string;
  photo_url: string;
}

export default function ManageTrainers() {
  const navigate = useNavigate();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'list' | 'create'>('list');

  useEffect(() => {
    fetchTrainers();
  }, []);

  const fetchTrainers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trainers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setTrainers(data || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des formateurs.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (trainer: Trainer) => {
    setEditingId(trainer.id);
    setName(trainer.name);
    setDescription(trainer.description || '');
    setPhotoUrl(trainer.photo_url || '');
    setSuccessMessage(null);
    setError(null);
    setActiveMobileTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setPhotoUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (editingId) {
        // Update existing trainer
        const { data, error } = await supabase
          .from('trainers')
          .update({
            name: name.trim(),
            description: description.trim(),
            photo_url: photoUrl,
          })
          .eq('id', editingId)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setTrainers(trainers.map(t => t.id === editingId ? data : t).sort((a, b) => a.name.localeCompare(b.name)));
          handleCancelEdit();
          setActiveMobileTab('list');
          setSuccessMessage(`Le formateur "${data.name}" a été mis à jour avec succès.`);
        }
      } else {
        // Create new trainer
        const { data, error } = await supabase
          .from('trainers')
          .insert([{ name: name.trim(), description: description.trim(), photo_url: photoUrl }])
          .select()
          .single();

        if (error) throw error;
        
        if (data) {
          setTrainers([...trainers, data].sort((a, b) => a.name.localeCompare(b.name)));
          setName('');
          setDescription('');
          setPhotoUrl('');
          setActiveMobileTab('list');
          setSuccessMessage(`Le formateur "${data.name}" a été ajouté avec succès.`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement du formateur.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, trainerName: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le formateur "${trainerName}" ?`)) return;
    try {
      setDeletingId(id);
      const { error } = await supabase
        .from('trainers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTrainers(trainers.filter(t => t.id !== id));
    } catch (err: any) {
      alert('Impossible de supprimer ce formateur: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredTrainers = trainers.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-semibold text-gray-500">Chargement de l'équipe pédagogique...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl w-full mx-auto pb-24 font-sans space-y-8">
      
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-5 z-10">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-md transition-all flex items-center justify-center shrink-0 border border-white/10 group"
            title="Retour au tableau de bord"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 backdrop-blur-md">
                Équipe Pédagogique
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1 text-white">Gestion des Formateurs</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Gérez les intervenants et profils d'experts qui animent vos contenus et formations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 bg-white/10 border border-white/10 backdrop-blur-md px-5 py-3 rounded-2xl">
          <Users className="w-6 h-6 text-indigo-400" />
          <div>
            <span className="text-2xl font-black text-white">{trainers.length}</span>
            <span className="text-xs text-slate-300 block font-medium">Formateur{trainers.length > 1 ? 's' : ''} actif{trainers.length > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <p>{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 font-semibold">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile Navigation Tabs (Visible only on mobile < lg) */}
      <div className="flex lg:hidden items-center p-1.5 bg-slate-100 rounded-2xl border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveMobileTab('list')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeMobileTab === 'list'
              ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-600" />
          <span>Liste ({filteredTrainers.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileTab('create')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeMobileTab === 'create'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Créer un Formateur</span>
        </button>
      </div>

      {/* Main Grid for PC */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Create or Edit Form */}
        <div className={`lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6 ${activeMobileTab === 'create' ? 'block' : 'hidden lg:block'}`}>
          <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
                  {editingId ? <Edit className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    {editingId ? 'Modifier le Formateur' : 'Ajouter un Formateur'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {editingId ? 'Mettez à jour les informations du formateur' : 'Remplissez la fiche du nouveau formateur'}
                  </p>
                </div>
              </div>
              
              {editingId ? (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                  title="Annuler la modification"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                /* Mobile Back to List Button */
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('list')}
                  className="lg:hidden px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                >
                  Voir la liste
                </button>
              )}
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Nom complet *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm transition-shadow shadow-xs font-medium"
                  placeholder="Ex: Dr. Jean Dupont"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Description / Bio</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="block w-full px-4 py-3 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm resize-none shadow-xs font-medium"
                placeholder="Spécialiste en gestion d'entreprise, +10 ans d'expérience..."
              />
            </div>

            <div>
              <NativeImageUploader 
                onUploadSuccess={(url) => setPhotoUrl(url)}
                label="Photo de profil (Optionnelle)"
                previewUrl={photoUrl}
              />
            </div>

            {photoUrl && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">URL de l'image de profil</label>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className="block w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 font-mono"
                  placeholder="https://..."
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="py-3.5 px-4 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer shrink-0"
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="flex-1 flex justify-center items-center gap-2 py-3.5 px-5 border border-transparent rounded-2xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 text-white" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    {editingId ? <CheckCircle className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    <span>{editingId ? 'Mettre à jour le Formateur' : 'Ajouter le Formateur'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: List of Trainers */}
        <div className={`lg:col-span-7 xl:col-span-8 space-y-5 ${activeMobileTab === 'list' ? 'block' : 'hidden lg:block'}`}>
          {/* Search bar and Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between w-full sm:w-auto">
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                <span>Liste des Formateurs ({filteredTrainers.length})</span>
              </h2>

              {/* Mobile Quick Add Button */}
              <button
                type="button"
                onClick={() => {
                  handleCancelEdit();
                  setActiveMobileTab('create');
                }}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Créer</span>
              </button>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un formateur..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
              />
            </div>
          </div>

          {filteredTrainers.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 border-dashed p-8">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                <User className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                {searchQuery ? 'Aucun formateur trouvé' : 'Aucun formateur enregistré'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery 
                  ? 'Essayez avec d\'autres mots clés ou réinitialisez la recherche.' 
                  : 'Remplissez le formulaire à gauche pour enregistrer le premier formateur de votre plateforme.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTrainers.map((trainer) => (
                <div 
                  key={trainer.id} 
                  className={`bg-white p-5 rounded-3xl shadow-sm border transition-all flex flex-col justify-between group ${
                    editingId === trainer.id ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <TrainerAvatar
                      photoUrl={trainer.photo_url}
                      name={trainer.name}
                      className="w-14 h-14 rounded-2xl object-cover bg-slate-100 border border-slate-200 shadow-xs shrink-0"
                      fallbackClassName="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600 font-bold text-sm"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                          {trainer.name}
                        </h3>
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      </div>

                      {trainer.description ? (
                        <p className="text-xs text-slate-500 mt-1.5 line-clamp-3 leading-relaxed">
                          {trainer.description}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic mt-1.5">
                          Aucune bio renseignée.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Formateur Certifié
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditClick(trainer)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        title="Modifier les informations de ce formateur"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Modifier</span>
                      </button>
                      <button
                        onClick={() => handleDelete(trainer.id, trainer.name)}
                        disabled={deletingId === trainer.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                        title="Supprimer ce formateur"
                      >
                        {deletingId === trainer.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

