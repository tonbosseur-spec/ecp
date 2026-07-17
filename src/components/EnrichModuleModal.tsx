import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Bold, 
  Italic, 
  Underline, 
  Palette, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Trash2, 
  Check, 
  Plus, 
  Link as LinkIcon, 
  FileText, 
  Upload, 
  Loader2, 
  Video,
  HelpCircle
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { QuizEditorModal } from './QuizEditorModal';

interface DownloadFile {
  name: string;
  url: string;
}

interface EnrichModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleTitle: string;
  initialData: {
    long_summary?: string;
    youtube_url?: string;
    download_files?: DownloadFile[];
    quiz?: any;
  };
  onSave: (data: {
    long_summary: string;
    youtube_url: string;
    download_files: DownloadFile[];
    quiz: any;
  }) => void;
}

const COLORS = [
  { name: 'Noir', value: '#111827' },
  { name: 'Gris', value: '#4B5563' },
  { name: 'Rouge', value: '#DC2626' },
  { name: 'Vert', value: '#16A34A' },
  { name: 'Bleu', value: '#2563EB' },
  { name: 'Violet', value: '#7C3AED' },
  { name: 'Orange', value: '#EA580C' },
  { name: 'Rose', value: '#DB2777' },
];

export function EnrichModuleModal({
  isOpen,
  onClose,
  moduleTitle,
  initialData,
  onSave,
}: EnrichModuleModalProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Rich Text Editor States
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentColor, setCurrentColor] = useState('#111827');
  
  // Custom States
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [downloadFiles, setDownloadFiles] = useState<DownloadFile[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [quiz, setQuiz] = useState<any | null>(null);
  const [isQuizEditorOpen, setIsQuizEditorOpen] = useState(false);

  // Load initial content when modal opens
  useEffect(() => {
    if (isOpen) {
      setYoutubeUrl(initialData.youtube_url || '');
      setDownloadFiles(initialData.download_files || []);
      setQuiz(initialData.quiz || null);
      
      // Load rich text summary
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = initialData.long_summary || '';
        }
      }, 50);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  // Rich Text Commands
  const handleCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleColorSelect = (colorValue: string) => {
    setCurrentColor(colorValue);
    handleCommand('foreColor', colorValue);
    setShowColorPicker(false);
  };

  const handleClearFormatting = () => {
    if (window.confirm('Voulez-vous effacer toutes les mises en forme du résumé ?')) {
      handleCommand('removeFormat');
    }
  };

  // Download Files Handlers
  const addDownloadFileSlot = () => {
    setDownloadFiles([...downloadFiles, { name: '', url: '' }]);
  };

  const removeDownloadFile = (index: number) => {
    setDownloadFiles(downloadFiles.filter((_, i) => i !== index));
  };

  const updateDownloadFileName = (index: number, name: string) => {
    setDownloadFiles(downloadFiles.map((f, i) => (i === index ? { ...f, name } : f)));
  };

  const updateDownloadFileUrl = (index: number, url: string) => {
    setDownloadFiles(downloadFiles.map((f, i) => (i === index ? { ...f, url } : f)));
  };

  const handleFileUpload = async (index: number, file: File) => {
    try {
      setUploadingIndex(index);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `module-resource-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('course-image')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('course-image')
        .getPublicUrl(fileName);

      // Auto-populate file name if empty
      const currentName = downloadFiles[index].name || file.name.split('.')[0];
      
      setDownloadFiles(downloadFiles.map((f, i) => 
        i === index ? { name: currentName, url: publicUrl } : f
      ));
    } catch (err: any) {
      alert(`Erreur de téléversement: ${err.message}`);
    } finally {
      setUploadingIndex(null);
    }
  };

  // Submit Handler
  const handleSave = () => {
    let summaryHtml = '';
    if (editorRef.current) {
      summaryHtml = editorRef.current.innerHTML;
      if (summaryHtml === '<br>' || summaryHtml.trim() === '') {
        summaryHtml = '';
      }
    }

    // Filter out invalid files
    const validFiles = downloadFiles.filter(f => f.name.trim() !== '' && f.url.trim() !== '');

    onSave({
      long_summary: summaryHtml,
      youtube_url: youtubeUrl.trim(),
      download_files: validFiles,
      quiz: quiz,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Contenu Enrichi</span>
            <h3 className="text-lg font-bold text-gray-900 mt-1 leading-tight">
              Enrichir le module : <span className="text-purple-700">{moduleTitle || "Sans titre"}</span>
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section 1: Rich Text Summary */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800">
              1. Résumé détaillé du module <span className="text-xs font-normal text-gray-400">(Prend en charge le riche text)</span>
            </label>
            
            <div className="border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-100 select-none">
                <button
                  type="button"
                  onClick={() => handleCommand('bold')}
                  className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors"
                  title="Gras"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCommand('italic')}
                  className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors"
                  title="Italique"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCommand('underline')}
                  className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors"
                  title="Souligné"
                >
                  <Underline className="w-4 h-4" />
                </button>

                <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>

                {/* Color Picker */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors flex items-center gap-1"
                    title="Couleur du texte"
                  >
                    <Palette className="w-4 h-4" style={{ color: currentColor }} />
                  </button>
                  
                  {showColorPicker && (
                    <div className="absolute left-0 top-full mt-1.5 p-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 grid grid-cols-4 gap-1.5 w-36">
                      {COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => handleColorSelect(c.value)}
                          className="w-6 h-6 rounded-full border border-gray-100 hover:scale-110 transition-transform relative"
                          style={{ backgroundColor: c.value }}
                          title={c.name}
                        >
                          {currentColor === c.value && (
                            <span className="absolute inset-0 flex items-center justify-center text-white text-[10px]">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>

                {/* Alignments */}
                <button
                  type="button"
                  onClick={() => handleCommand('justifyLeft')}
                  className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors"
                  title="Aligner à gauche"
                >
                  <AlignLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCommand('justifyCenter')}
                  className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors"
                  title="Aligner au centre"
                >
                  <AlignCenter className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCommand('justifyRight')}
                  className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors"
                  title="Aligner à droite"
                >
                  <AlignRight className="w-4 h-4" />
                </button>

                <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>

                {/* Lists */}
                <button
                  type="button"
                  onClick={() => handleCommand('insertUnorderedList')}
                  className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors"
                  title="Liste à puces"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleCommand('insertOrderedList')}
                  className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors"
                  title="Liste ordonnée"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>

                <div className="flex-grow"></div>

                {/* Remove Format */}
                <button
                  type="button"
                  onClick={handleClearFormatting}
                  className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Effacer la mise en forme"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Editing Area */}
              <div className="p-4 bg-white min-h-[160px] max-h-[300px] overflow-y-auto">
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="outline-none min-h-[140px] text-sm text-gray-800 leading-relaxed prose max-w-none focus:prose-indigo
                    [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_strong]:font-bold [&_em]:italic [&_u]:underline"
                  placeholder="Rédigez le résumé très long ou le contenu du cours pour ce module..."
                />
              </div>
            </div>
          </div>

          {/* Section 2: YouTube Video URL */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <Video className="w-4 h-4 text-red-500" />
              2. Vidéo YouTube <span className="text-xs font-normal text-gray-400">(Facultatif, s'ouvrira directement dans l'interface de l'élève)</span>
            </label>
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="block w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-shadow text-sm"
            />
          </div>

          {/* Section 3: Downloadable Files */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-500" />
                3. Fichiers & Ressources à télécharger
              </label>
              <button
                type="button"
                onClick={addDownloadFileSlot}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter un fichier
              </button>
            </div>

            {downloadFiles.length === 0 ? (
              <p className="text-xs text-gray-400 italic bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-200 text-center">
                Aucun fichier ou ressource téléchargeable ajouté à ce module.
              </p>
            ) : (
              <div className="space-y-3">
                {downloadFiles.map((fileSlot, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3 relative group">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        placeholder="Nom du fichier (ex: Support PDF, Code source...)"
                        value={fileSlot.name}
                        onChange={(e) => updateDownloadFileName(index, e.target.value)}
                        className="block w-full px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-semibold text-gray-800"
                      />
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          placeholder="Coller l'URL du fichier externe ou téléverser ci-contre"
                          value={fileSlot.url}
                          onChange={(e) => updateDownloadFileUrl(index, e.target.value)}
                          className="flex-1 block px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-[11px] text-gray-600"
                        />
                        
                        {fileSlot.url && (
                          <a 
                            href={fileSlot.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[10px] text-purple-600 hover:underline font-bold"
                          >
                            Tester le lien
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 md:pl-2">
                      {/* Hidden File Input */}
                      <input
                        type="file"
                        id={`file-upload-input-${index}`}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(index, file);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const element = document.getElementById(`file-upload-input-${index}`);
                          if (element) element.click();
                        }}
                        disabled={uploadingIndex !== null}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-[11px] font-bold text-gray-700 shadow-xs transition-colors shrink-0 disabled:opacity-50"
                      >
                        {uploadingIndex === index ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 text-purple-600" />
                        )}
                        Téléverser
                      </button>

                      <button
                        type="button"
                        onClick={() => removeDownloadFile(index)}
                        className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-xl transition-colors shrink-0"
                        title="Supprimer la ressource"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Quiz du module */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-emerald-500" />
                4. Quizz d'évaluation du module
              </label>
              {quiz && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Voulez-vous vraiment supprimer le quizz de ce module ?")) {
                      setQuiz(null);
                    }
                  }}
                  className="text-xs text-red-600 hover:text-red-800 hover:underline font-semibold"
                >
                  Supprimer le quizz
                </button>
              )}
            </div>

            {quiz ? (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-emerald-800">{quiz.title || "Quizz d'évaluation"}</h4>
                  <p className="text-[11px] text-emerald-600 mt-0.5">{quiz.questions?.length || 0} question(s) de validation configurée(s)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuizEditorOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all hover:shadow-md"
                >
                  Modifier le Quizz
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-gray-200 rounded-2xl p-6 text-center flex flex-col items-center">
                <p className="text-xs text-gray-500 mb-3 max-w-lg">
                  Ajoutez un quizz d'évaluation pour ce module. Pour valider le module et accéder au suivant, l'apprenant devra obtenir un score de réussite d'au moins 70%.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuiz({
                      title: `Quizz : ${moduleTitle || "Validation"}`,
                      questions: [
                        { text: "", options: ["", "", "", ""], correct_index: 0 }
                      ]
                    });
                    setIsQuizEditorOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Créer le Quizz
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-md transition-colors"
          >
            <Check className="w-4 h-4" />
            Enregistrer les détails du module
          </button>
        </div>

        {/* Quiz Editor Modal Overlay */}
        <QuizEditorModal
          isOpen={isQuizEditorOpen}
          onClose={() => setIsQuizEditorOpen(false)}
          initialQuiz={quiz}
          moduleTitle={moduleTitle}
          onSave={(updatedQuiz) => {
            setQuiz(updatedQuiz);
          }}
        />

      </div>
    </div>
  );
}
