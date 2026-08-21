import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft, BookOpen, PlusCircle, Search, Trash2, Archive, ArchiveRestore, CheckCircle2, AlertCircle, FileText, Download, Loader2 } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function AdminEbooks() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [ebooks, setEbooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  useEffect(() => {
    fetchEbooks();
  }, []);

  const fetchEbooks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          trainers (id, name),
          registrations (id, payment_status)
        `)
        .eq('product_type', 'ebook')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEbooks(data || []);
    } catch (err: any) {
      toast.error(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleArchive = async (id: string, currentArchived: boolean) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ is_archived: !currentArchived, is_active: currentArchived }) // if archived, unpublish. if unarchiving, maybe keep inactive? Actually just set is_archived.
        .eq('id', id);

      if (error) throw error;
      toast.success(`E-book ${!currentArchived ? 'archivé' : 'désarchivé'} avec succès`);
      fetchEbooks();
    } catch (err: any) {
      toast.error(`Erreur: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('E-book supprimé avec succès');
      setDeleteConfirmId(null);
      fetchEbooks();
    } catch (err: any) {
      toast.error(`Erreur lors de la suppression: ${err.message}`);
    }
  };

  const filteredEbooks = useMemo(() => {
    return ebooks.filter(e => {
      const matchesSearch = e.title?.toLowerCase().includes(searchQuery.toLowerCase());
      if (filter === 'active') return matchesSearch && !e.is_archived;
      if (filter === 'archived') return matchesSearch && e.is_archived;
      return matchesSearch;
    });
  }, [ebooks, searchQuery, filter]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 font-sans pb-24 w-full">

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all flex items-center justify-center shrink-0"
              title="Retour à l'accueil admin"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Page Administrateur
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1">E-books</h1>
              <p className="text-xs sm:text-sm text-gray-500">Gérez vos livres numériques.</p>
            </div>
          </div>
          <Link 
            to="/admin/ebooks/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm w-full sm:w-auto justify-center"
          >
            <PlusCircle className="w-4 h-4" />
            Nouvel e-book
          </Link>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Rechercher un e-book..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium placeholder:font-normal"
            />
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setFilter('active')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filter === 'active' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Actifs
            </button>
            <button
              onClick={() => setFilter('archived')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filter === 'archived' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Archivés
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Tous
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm font-medium">Chargement des e-books...</p>
          </div>
        ) : filteredEbooks.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Vous n'avez encore créé aucun e-book.</h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-8 text-sm">
              Ajoutez votre premier livre numérique pour commencer à le proposer à vos élèves.
            </p>
            <Link 
              to="/admin/ebooks/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <PlusCircle className="w-5 h-5" />
              Créer un e-book
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredEbooks.map((ebook) => {
              const salesCount = ebook.registrations?.filter((r: any) => r.payment_status === 'approved')?.length || 0;
              return (
                <div key={ebook.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow relative">
                  {/* Cover */}
                  <div className="aspect-[3/4] bg-gray-100 relative group overflow-hidden">
                    {ebook.cover_image_url ? (
                      <img src={ebook.cover_image_url} alt={ebook.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <BookOpen className="w-12 h-12 mb-2 opacity-50" />
                        <span className="text-xs font-medium">Sans couverture</span>
                      </div>
                    )}
                    
                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                      <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold shadow-sm ${
                        ebook.is_active ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'
                      }`}>
                        {ebook.is_active ? 'PUBLIÉ' : 'BROUILLON'}
                      </span>
                      {ebook.is_archived && (
                        <span className="inline-flex px-2 py-1 rounded-md text-[10px] font-bold shadow-sm bg-amber-500 text-white">
                          ARCHIVÉ
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-900 mb-1 line-clamp-2">{ebook.title}</h3>
                    <p className="text-xs text-gray-500 mb-3">{ebook.trainers?.name || 'Auteur inconnu'}</p>
                    
                    <div className="mt-auto space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold bg-gray-50 p-2 rounded-lg text-gray-700">
                        <span>{salesCount} ventes</span>
                        <span>{ebook.price_fcfa} FCFA</span>
                      </div>
                      
                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-100">
                        <Link 
                          to={`/admin/ebooks/${ebook.id}/edit`}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                        >
                          Modifier
                        </Link>
                        {ebook.download_file_url ? (
                          <a 
                            href={ebook.download_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                          >
                            PDF
                          </a>
                        ) : (
                          <span className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-400 rounded-lg text-xs font-bold cursor-not-allowed">
                            Pas de PDF
                          </span>
                        )}
                        <a 
                          href={`/formations/${ebook.slug || ebook.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors col-span-2"
                        >
                          Prévisualiser
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Actions Overlay */}
                  <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleToggleArchive(ebook.id, ebook.is_archived)}
                      className={`p-2 rounded-full shadow-sm text-white transition-colors ${ebook.is_archived ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-amber-500 hover:bg-amber-600'}`}
                      title={ebook.is_archived ? "Désarchiver" : "Archiver"}
                    >
                      {ebook.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(ebook.id)}
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-sm transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Delete Confirmation Modal Overlay */}
                  {deleteConfirmId === ebook.id && (
                    <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
                      <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
                      <h4 className="font-bold text-gray-900 mb-1">Supprimer cet e-book ?</h4>
                      <p className="text-xs text-gray-500 mb-6">Cette action est irréversible.</p>
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="flex-1 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => handleDelete(ebook.id)}
                          className="flex-1 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
