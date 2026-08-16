import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Database, Copy, Check, RefreshCw, Sparkles, ExternalLink } from 'lucide-react';
import { useToast } from './Toast';

export default function SupabaseSlugMigrationBanner() {
  const [hasSlugColumn, setHasSlugColumn] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const sqlCode = `ALTER TABLE courses ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;`;

  const checkColumn = async () => {
    setChecking(true);
    try {
      const { error } = await supabase.from('courses').select('slug').limit(1);
      if (error) {
        setHasSlugColumn(false);
      } else {
        setHasSlugColumn(true);
      }
    } catch {
      setHasSlugColumn(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkColumn();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sqlCode);
      setCopied(true);
      showToast('Commande SQL copiée ! Collez-la dans Supabase > SQL Editor', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Impossible de copier automatiquement', 'error');
    }
  };

  if (hasSlugColumn === null) return null; // En cours de chargement silencieux
  if (hasSlugColumn === true) return null; // Déjà configuré, pas besoin d'afficher l'alerte

  return (
    <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/80 rounded-2xl shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-700 rounded-xl shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
              <span>Activer les Slugs d'URL personnalisés dans Supabase</span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-amber-200/60 text-amber-800 rounded-md">
                1 clic requis
              </span>
            </h3>
            <p className="text-xs text-amber-800/90 mt-0.5">
              Pour enregistrer vos slugs personnalisés en base de données, ajoutez la colonne <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold text-amber-900">slug</code> à la table Supabase.
            </p>
          </div>
        </div>

        <button
          onClick={checkColumn}
          disabled={checking}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-950 bg-amber-100/80 hover:bg-amber-200/80 px-3 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer"
          title="Vérifier si la colonne existe"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          <span>{checking ? 'Vérification...' : 'Vérifier l\'activation'}</span>
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-amber-200/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 bg-amber-950 text-amber-100 font-mono text-xs p-3 rounded-xl flex items-center justify-between overflow-x-auto border border-amber-900/50 shadow-inner">
          <code className="whitespace-nowrap select-all">{sqlCode}</code>
          <button
            onClick={handleCopy}
            className="ml-3 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-amber-950 font-sans font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-900" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copié !' : 'Copier SQL'}</span>
          </button>
        </div>

        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-amber-900 hover:text-amber-950 bg-amber-200/60 hover:bg-amber-200 px-4 py-3 sm:py-2.5 rounded-xl transition-all shrink-0"
        >
          <span>Ouvrir Supabase SQL Editor</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
