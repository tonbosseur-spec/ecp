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
  Type,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  ChevronDown,
  Link as LinkIcon,
  Minus
} from 'lucide-react';

interface RichTextEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue: string;
  onSave: (value: string) => void;
  title?: string;
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
  { name: 'Word Blue', value: '#2B579A' },
  { name: 'Or', value: '#D4AF37' },
];

const HIGHLIGHTS = [
  { name: 'Jaune', value: '#FEF08A' },
  { name: 'Vert', value: '#BBF7D0' },
  { name: 'Bleu', value: '#BFDBFE' },
  { name: 'Rose', value: '#FBCFE8' },
  { name: 'Orange', value: '#FED7AA' },
  { name: 'Transparent', value: 'transparent' },
];

export function RichTextEditorModal({ 
  isOpen, 
  onClose, 
  initialValue, 
  onSave, 
  title = 'Rédiger la description' 
}: RichTextEditorModalProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [currentColor, setCurrentColor] = useState('#111827');

  // Load initial content when modal opens
  useEffect(() => {
    if (isOpen && editorRef.current) {
      editorRef.current.innerHTML = initialValue || '';
      // Focus the editor
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
    setShowFormatDropdown(false);
  };

  const handleColorSelect = (colorValue: string) => {
    setCurrentColor(colorValue);
    handleCommand('foreColor', colorValue);
    setShowColorPicker(false);
  };

  const handleHighlightSelect = (colorValue: string) => {
    handleCommand('hiliteColor', colorValue);
    setShowHighlightPicker(false);
  };

  const handleClearFormatting = () => {
    if (window.confirm('Voulez-vous effacer toutes les mises en forme de la description ?')) {
      handleCommand('removeFormat');
    }
  };

  const handleAddLink = () => {
    const url = window.prompt('Entrez l\'URL du lien :', 'https://');
    if (url && url !== 'https://') {
      handleCommand('createLink', url);
    }
  };

  const handleSave = () => {
    if (editorRef.current) {
      const htmlContent = editorRef.current.innerHTML;
      // If the content is just an empty tag or empty space, treat as empty
      if (htmlContent === '<br>' || htmlContent.trim() === '') {
        onSave('');
      } else {
        onSave(htmlContent);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Mise en forme avancée pour votre cours</p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 px-4 py-2 bg-gray-50 border-b border-gray-100 select-none">
          
          {/* Format Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFormatDropdown(!showFormatDropdown)}
              className="px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200/80 rounded-lg transition-colors flex items-center gap-1.5"
              title="Style de texte"
            >
              <Type className="w-4 h-4 text-emerald-600" />
              <span>Style</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showFormatDropdown && (
              <div className="absolute left-0 top-full mt-1.5 p-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-48 flex flex-col">
                <button
                  type="button"
                  onClick={() => handleCommand('formatBlock', '<h1>')}
                  className="px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-lg flex items-center gap-2"
                >
                  <Heading1 className="w-4 h-4" />
                  <span className="font-bold">Grand Titre</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCommand('formatBlock', '<h2>')}
                  className="px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-lg flex items-center gap-2"
                >
                  <Heading2 className="w-4 h-4" />
                  <span className="font-semibold">Sous-titre</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCommand('formatBlock', '<h3>')}
                  className="px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-lg flex items-center gap-2"
                >
                  <Heading3 className="w-4 h-4" />
                  <span className="font-medium">Petit titre</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCommand('formatBlock', '<p>')}
                  className="px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-lg flex items-center gap-2"
                >
                  <Type className="w-4 h-4" />
                  <span>Paragraphe normal</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>

          {/* Basic Formatting */}
          <button
            type="button"
            onClick={() => handleCommand('bold')}
            className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors"
            title="Gras (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleCommand('italic')}
            className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors"
            title="Italique (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleCommand('underline')}
            className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors"
            title="Souligné (Ctrl+U)"
          >
            <Underline className="w-4 h-4" />
          </button>

          <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>

          {/* Color Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowHighlightPicker(false);
              }}
              className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors flex items-center gap-1"
              title="Couleur du texte"
            >
              <Palette className="w-4 h-4" style={{ color: currentColor }} />
            </button>
            
            {showColorPicker && (
              <div className="absolute left-0 top-full mt-1.5 p-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 grid grid-cols-5 gap-1.5 w-44">
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

          {/* Highlight Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowHighlightPicker(!showHighlightPicker);
                setShowColorPicker(false);
              }}
              className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors flex items-center gap-1"
              title="Surlignage"
            >
              <Highlighter className="w-4 h-4" />
            </button>
            
            {showHighlightPicker && (
              <div className="absolute left-0 top-full mt-1.5 p-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 grid grid-cols-3 gap-1.5 w-32">
                {HIGHLIGHTS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => handleHighlightSelect(c.value)}
                    className="w-full h-8 rounded-lg border border-gray-100 hover:opacity-80 transition-opacity relative"
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  >
                    {c.value === 'transparent' && <span className="text-[10px] text-gray-400">Aucun</span>}
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

          <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>

          {/* Additional Options */}
          <button
            type="button"
            onClick={handleAddLink}
            className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors"
            title="Insérer un lien"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleCommand('insertHorizontalRule')}
            className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 rounded-lg transition-colors"
            title="Ligne horizontale"
          >
            <Minus className="w-4 h-4" />
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
        <div className="flex-1 overflow-y-auto p-8 bg-white min-h-[300px] md:min-h-[450px]">
          <div
            id="rich-text-editor-area"
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="outline-none min-h-full text-sm text-gray-800 leading-relaxed prose max-w-none focus:prose-emerald
              [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_strong]:font-bold [&_em]:italic [&_u]:underline
              [&_h1]:text-2xl [&_h1]:font-black [&_h1]:mb-4 [&_h1]:text-gray-900
              [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:text-gray-800
              [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:text-gray-800"
            placeholder="Écrivez votre description ici..."
            style={{ minHeight: '100%' }}
          />
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
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors"
          >
            <Check className="w-4 h-4" />
            Valider la description
          </button>
        </div>

      </div>
    </div>
  );
}
