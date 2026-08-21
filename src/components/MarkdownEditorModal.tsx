import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Type,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Minus,
  Code2,
  Quote,
  Eye,
  Edit3,
  Check,
  Sparkles,
  Columns
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface MarkdownEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue: string;
  onSave: (value: string) => void;
  title?: string;
}

export function MarkdownEditorModal({ 
  isOpen, 
  onClose, 
  initialValue, 
  onSave, 
  title = 'Éditeur Markdown de l\'activité' 
}: MarkdownEditorModalProps) {
  const [markdown, setMarkdown] = useState(initialValue || '');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'split'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMarkdown(initialValue || '');
      // Auto-detect screen width to default to edit on mobile, split on large screens
      if (window.innerWidth >= 1024) {
        setActiveTab('split');
      } else {
        setActiveTab('edit');
      }
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const insertSyntax = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMarkdown(prev => prev + `${prefix}${defaultText}${suffix}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = markdown.substring(start, end) || defaultText;
    const replacement = `${prefix}${selected}${suffix}`;
    
    const newText = markdown.substring(0, start) + replacement + markdown.substring(end);
    setMarkdown(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 10);
  };

  const handleSave = () => {
    onSave(markdown);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[92vh] max-h-[850px] border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">{title}</h3>
              <p className="text-[11px] text-slate-500 hidden sm:block">Formatage Markdown riche avec prévisualisation en direct</p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                activeTab === 'edit'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Édition</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                activeTab === 'preview'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Aperçu</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('split')}
              className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                activeTab === 'split'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar (Shown in edit or split mode) */}
        {(activeTab === 'edit' || activeTab === 'split') && (
          <div className="flex flex-wrap items-center gap-1 px-3 sm:px-4 py-2 bg-slate-50 border-b border-slate-100 shrink-0 overflow-x-auto select-none">
            {/* Headings */}
            <button
              type="button"
              onClick={() => insertSyntax('# ', '', 'Titre 1')}
              className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
              title="Titre de niveau 1"
            >
              <Heading1 className="w-4 h-4 text-blue-600" />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('## ', '', 'Titre 2')}
              className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
              title="Titre de niveau 2"
            >
              <Heading2 className="w-4 h-4 text-blue-600" />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('### ', '', 'Titre 3')}
              className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
              title="Titre de niveau 3"
            >
              <Heading3 className="w-4 h-4 text-blue-600" />
            </button>

            <div className="h-5 w-[1px] bg-slate-200 mx-1" />

            {/* Formatting */}
            <button
              type="button"
              onClick={() => insertSyntax('**', '**', 'texte en gras')}
              className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors"
              title="Texte en gras (**texte**)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('*', '*', 'texte en italique')}
              className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors"
              title="Texte en italique (*texte*)"
            >
              <Italic className="w-4 h-4" />
            </button>

            <div className="h-5 w-[1px] bg-slate-200 mx-1" />

            {/* Lists */}
            <button
              type="button"
              onClick={() => insertSyntax('* ', '', 'Élément de liste')}
              className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors"
              title="Liste à puces (* Élément)"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('1. ', '', 'Premier élément')}
              className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors"
              title="Liste ordonnée (1. Élément)"
            >
              <ListOrdered className="w-4 h-4" />
            </button>

            <div className="h-5 w-[1px] bg-slate-200 mx-1" />

            {/* Code & Quote */}
            <button
              type="button"
              onClick={() => insertSyntax('`', '`', 'code')}
              className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors font-mono text-xs font-bold"
              title="Code inline (`code`)"
            >
              `code`
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('```r\n', '\n```', '# Insérez votre code R ici\nx <- c(1, 2, 3)\nmean(x)')}
              className="px-2 py-1 bg-slate-800 text-emerald-400 hover:bg-slate-900 rounded-lg transition-colors font-mono text-[11px] font-bold flex items-center gap-1"
              title="Bloc de code R (```r ... ```)"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Bloc R</span>
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('> ', '', 'Citation importante à retenir')}
              className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors"
              title="Citation (> Texte)"
            >
              <Quote className="w-4 h-4" />
            </button>

            <div className="h-5 w-[1px] bg-slate-200 mx-1" />

            {/* Links & Rules */}
            <button
              type="button"
              onClick={() => insertSyntax('[', '](https://example.com)', 'Texte du lien')}
              className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors"
              title="Lien ([Texte](url))"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('\n---\n', '', '')}
              className="p-1.5 text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors"
              title="Ligne de séparation (---)"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex divide-x divide-slate-100 bg-white">
          
          {/* Editor Pane (Shown in 'edit' or 'split') */}
          {(activeTab === 'edit' || activeTab === 'split') && (
            <div className={`flex-1 flex flex-col h-full bg-slate-900 text-slate-100 ${activeTab === 'split' ? 'w-1/2' : 'w-full'}`}>
              <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono font-extrabold text-slate-400 flex items-center justify-between">
                <span>Code Markdown</span>
                <span className="text-slate-500">{markdown.length} caractères</span>
              </div>
              <textarea
                ref={textareaRef}
                value={markdown}
                onChange={e => setMarkdown(e.target.value)}
                placeholder="# Titre du cours&#10;&#10;Saisissez votre cours en Markdown..."
                className="w-full flex-1 p-4 sm:p-6 bg-slate-900 text-slate-100 font-mono text-xs sm:text-sm leading-relaxed focus:outline-none resize-none overflow-y-auto"
                style={{ tabSize: 2 }}
              />
            </div>
          )}

          {/* Preview Pane (Shown in 'preview' or 'split') */}
          {(activeTab === 'preview' || activeTab === 'split') && (
            <div className={`flex-1 flex flex-col h-full bg-white overflow-y-auto ${activeTab === 'split' ? 'w-1/2' : 'w-full'}`}>
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-extrabold text-emerald-800 flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Rendu apprenant en direct</span>
              </div>
              <div className="p-5 sm:p-8 flex-1">
                {markdown.trim() ? (
                  <MarkdownRenderer content={markdown} isDark={false} />
                ) : (
                  <div className="h-full flex items-center justify-center text-center p-8 text-slate-400 text-xs sm:text-sm italic">
                    Aucun contenu à prévisualiser. Saisissez du texte dans l'onglet Édition.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Supporte les titres, listes, citations, blocs de code R et liens.
          </p>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Valider le contenu Markdown</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
