import React, { useState, useEffect, useRef } from 'react';
import { 
  FileUp, 
  FileText, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  FileSpreadsheet, 
  File as FileIcon,
  RefreshCw,
  Plus
} from 'lucide-react';
import { importFileToWebR, getWebRFiles, removeFileFromWebR, WebRFileMeta } from '../lib/webrFiles';
import { isWebRReady } from '../lib/webrEngine';

interface WebRFileManagerProps {
  onFileImported?: (file: WebRFileMeta) => void;
  onFileDeleted?: (fileName: string) => void;
}

export default function WebRFileManager({ onFileImported, onFileDeleted }: WebRFileManagerProps) {
  const [files, setFiles] = useState<WebRFileMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshFiles = async () => {
    if (!isWebRReady()) return;
    setLoading(true);
    try {
      const webrFiles = await getWebRFiles();
      setFiles(webrFiles);
    } catch (err) {
      console.warn("Erreur lors de la récupération des fichiers WebR:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isWebRReady()) {
      refreshFiles();
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);
    setSuccess(null);
    setImporting(true);

    try {
      const existing = files.find(f => f.name === selectedFile.name);
      if (existing) {
        if (!window.confirm(`Le fichier "${selectedFile.name}" existe déjà. Voulez-vous le remplacer ?`)) {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
      }

      const meta = await importFileToWebR(selectedFile);
      setSuccess(`${meta.name} a été importé avec succès.`);
      await refreshFiles();
      if (onFileImported) onFileImported(meta);
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'importation.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le fichier "${fileName}" ?`)) return;

    try {
      await removeFileFromWebR(fileName);
      await refreshFiles();
      if (onFileDeleted) onFileDeleted(fileName);
    } catch (err: any) {
      setError("Impossible de supprimer le fichier.");
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'csv' || ext === 'txt') return <FileText className="w-5 h-5 text-blue-500" />;
    if (ext === 'xlsx' || ext === 'xls') return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    return <FileIcon className="w-5 h-5 text-gray-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return 'Taille inconnue';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <FileUp className="w-4 h-4 text-purple-600" />
          Fichiers de données
        </h3>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing || !isWebRReady()}
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-xl text-[11px] font-black transition-all flex items-center gap-1.5 shadow-2xs"
        >
          {importing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          <span>Importer</span>
        </button>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept=".csv,.xlsx,.xls,.txt,.rds,.RData,.sav,.dta"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-700 text-xs animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2 text-emerald-700 text-xs animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <div className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            <span className="text-[11px] font-bold">Chargement...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-1">
              <FileUp className="w-6 h-6 opacity-20" />
            </div>
            <p className="text-xs font-bold text-gray-600">Aucun fichier importé</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {files.map((file) => (
              <div key={file.name} className="p-3 flex items-center justify-between gap-3 hover:bg-white transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 p-2 bg-white rounded-lg border border-gray-100 shadow-3xs group-hover:border-purple-200">
                    {getFileIcon(file.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-gray-900 truncate font-mono">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold">
                      {formatSize(file.size)}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleDelete(file.name)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
