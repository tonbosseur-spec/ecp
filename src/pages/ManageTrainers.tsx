import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, User, Image as ImageIcon } from 'lucide-react';

interface Trainer {
  id: string;
  name: string;
  description: string;
  photo_url: string;
}

export default function ManageTrainers() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('trainers')
        .insert([{ name, description, photo_url: photoUrl }])
        .select()
        .single();

      if (error) throw error;
      
      if (data) {
        setTrainers([...trainers, data].sort((a, b) => a.name.localeCompare(b.name)));
        setName('');
        setDescription('');
        setPhotoUrl('');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'ajout du formateur.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        <p className="text-sm text-gray-500">Chargement des formateurs...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-md mx-auto pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Formateurs</h1>
        <p className="text-sm text-gray-500 mt-1">Gérez l'équipe de formateurs</p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mb-8 space-y-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-4">Nouveau formateur</h2>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-4 w-4 text-gray-400" />
            </div>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 text-sm"
              placeholder="Jean Dupont"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="block w-full px-3 py-2 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 text-sm resize-none"
            placeholder="Expert en..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Photo (URL)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <ImageIcon className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-900 text-sm"
              placeholder="https://..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 transition-colors mt-2"
        >
          {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Ajouter le formateur'}
        </button>
      </form>

      {/* List */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Formateurs enregistrés</h2>
        {trainers.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
            Aucun formateur pour le moment.
          </p>
        ) : (
          trainers.map((trainer) => (
            <div key={trainer.id} className="flex items-start gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              {trainer.photo_url ? (
                <img src={trainer.photo_url} alt={trainer.name} className="w-12 h-12 rounded-full object-cover bg-gray-100" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-100 flex flex-shrink-0 items-center justify-center">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{trainer.name}</h3>
                {trainer.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{trainer.description}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
