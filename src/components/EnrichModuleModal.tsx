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
  HelpCircle,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  CheckSquare,
  Sigma,
  Code,
  Eye,
  Edit2
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

// Helper to convert Markdown to HTML
function markdownToHtml(md: string): string {
  if (!md) return '';
  
  // Format formula blocks first: $$ formula $$
  let html = md.replace(/\$\$(.*?)\$\$/gs, (match, formula) => {
    const trimmed = formula.trim();
    return `<div class="formula-block my-4 p-4 bg-purple-50 border border-purple-100 rounded-2xl flex flex-col items-center justify-center font-serif text-purple-950 shadow-xs border-l-4 border-l-purple-600 select-all" data-formula="${trimmed}"><span class="text-[10px] uppercase tracking-widest text-purple-600 font-black font-sans mb-1">Formule Mathématique</span><span class="font-bold tracking-wide text-lg text-center font-serif">${trimmed}</span></div>`;
  });

  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) {
        result.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = null;
      }
      result.push('<br>');
      continue;
    }

    // Check headings
    if (trimmed.startsWith('# ')) {
      if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; }
      result.push(`<h1 class="text-2xl font-black text-gray-900 mt-5 mb-3 tracking-tight border-b border-gray-100 pb-1">${trimmed.slice(2)}</h1>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; }
      result.push(`<h2 class="text-xl font-extrabold text-gray-900 mt-4 mb-2 tracking-tight">${trimmed.slice(3)}</h2>`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; }
      result.push(`<h3 class="text-lg font-bold text-gray-900 mt-3.5 mb-1.5">${trimmed.slice(4)}</h3>`);
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; listType = null; }
      result.push(`<h4 class="text-base font-bold text-gray-800 mt-3 mb-1">${trimmed.slice(5)}</h4>`);
      continue;
    }

    // Checkboxes (Checklist items)
    const checkboxMatch = line.match(/^(\s*)-\s+\[([ xX])\]\s+(.*)$/);
    if (checkboxMatch) {
      if (inList && listType !== 'ul') {
        result.push('</ol>');
        inList = false;
        listType = null;
      }
      if (!inList) {
        result.push('<ul class="space-y-1.5 my-2">');
        inList = true;
        listType = 'ul';
      }
      const checked = checkboxMatch[2].toLowerCase() === 'x';
      const text = checkboxMatch[3];
      const parsedText = parseInlineMarkdown(text);
      
      result.push(`  <li class="flex items-center gap-2.5 list-none -ml-5">
    <input type="checkbox" ${checked ? 'checked' : ''} class="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer align-middle shrink-0" />
    <span class="text-sm text-gray-700 align-middle">${parsedText}</span>
  </li>`);
      continue;
    }

    // Bullet lists
    const bulletMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (bulletMatch) {
      if (inList && listType !== 'ul') {
        result.push('</ol>');
        inList = false;
        listType = null;
      }
      if (!inList) {
        result.push('<ul class="list-disc pl-5 space-y-1 my-2">');
        inList = true;
        listType = 'ul';
      }
      const parsedText = parseInlineMarkdown(bulletMatch[2]);
      result.push(`  <li>${parsedText}</li>`);
      continue;
    }

    // Ordered lists
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (inList && listType !== 'ol') {
        result.push('</ul>');
        inList = false;
        listType = null;
      }
      if (!inList) {
        result.push('<ol class="list-decimal pl-5 space-y-1 my-2">');
        inList = true;
        listType = 'ol';
      }
      const parsedText = parseInlineMarkdown(orderedMatch[2]);
      result.push(`  <li>${parsedText}</li>`);
      continue;
    }

    // If it's not a list item, close any open lists
    if (inList) {
      result.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
      listType = null;
    }

    if (line.trim().startsWith('<div') || line.trim().startsWith('</div')) {
      result.push(line);
      continue;
    }

    const parsedLine = parseInlineMarkdown(line);
    result.push(`<p class="text-sm text-gray-700 leading-relaxed my-1.5">${parsedLine}</p>`);
  }

  if (inList) {
    result.push(listType === 'ul' ? '</ul>' : '</ol>');
  }

  return result.join('\n');
}

function parseInlineMarkdown(text: string): string {
  let res = text;
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/\*(.*?)\*/g, '<em>$1</em>');
  res = res.replace(/<u>(.*?)<\/u>/g, '<u>$1</u>');
  return res;
}

// Helper to convert HTML back to Markdown
function htmlToMarkdown(html: string): string {
  if (!html) return '';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    const traverse = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const el = node as HTMLElement;

      // Check formula blocks
      if (el.classList.contains('formula-block') || el.getAttribute('data-formula')) {
        const formula = el.getAttribute('data-formula') || el.innerText.replace('Formule Mathématique', '').replace('f(x) =', '').trim();
        return `\n\n$$ ${formula} $$\n\n`;
      }

      // Check lists
      if (el.tagName === 'UL') {
        let mdList = '';
        for (const child of Array.from(el.childNodes)) {
          mdList += traverse(child);
        }
        return `\n${mdList}\n`;
      }

      if (el.tagName === 'OL') {
        let mdList = '';
        let index = 1;
        for (const child of Array.from(el.childNodes)) {
          if (child.nodeName === 'LI') {
            mdList += traverse(child).replace(/^- /, `${index}. `);
            index++;
          } else {
            mdList += traverse(child);
          }
        }
        return `\n${mdList}\n`;
      }

      if (el.tagName === 'LI') {
        const checkbox = el.querySelector('input[type="checkbox"]');
        const textContent = Array.from(el.childNodes)
          .filter(n => n.nodeName !== 'INPUT')
          .map(n => traverse(n))
          .join('')
          .trim();

        if (checkbox) {
          const isChecked = (checkbox as HTMLInputElement).checked || checkbox.hasAttribute('checked');
          return `- [${isChecked ? 'x' : ' '}] ${textContent}\n`;
        }
        return `- ${textContent}\n`;
      }

      const isCheckboxContainer = el.tagName === 'DIV' && el.querySelector('input[type="checkbox"]');
      if (isCheckboxContainer) {
        const checkbox = el.querySelector('input[type="checkbox"]');
        const textContent = Array.from(el.childNodes)
          .filter(n => n.nodeName !== 'INPUT')
          .map(n => traverse(n))
          .join('')
          .trim();
        const isChecked = checkbox ? ((checkbox as HTMLInputElement).checked || checkbox.hasAttribute('checked')) : false;
        return `- [${isChecked ? 'x' : ' '}] ${textContent}\n`;
      }

      let childrenContent = '';
      for (const child of Array.from(el.childNodes)) {
        childrenContent += traverse(child);
      }

      switch (el.tagName) {
        case 'H1':
          return `\n# ${childrenContent}\n`;
        case 'H2':
          return `\n## ${childrenContent}\n`;
        case 'H3':
          return `\n### ${childrenContent}\n`;
        case 'H4':
          return `\n#### ${childrenContent}\n`;
        case 'STRONG':
        case 'B':
          return `**${childrenContent}**`;
        case 'EM':
        case 'I':
          return `*${childrenContent}*`;
        case 'U':
          return `<u>${childrenContent}</u>`;
        case 'P':
          return `\n${childrenContent}\n`;
        case 'BR':
          return '\n';
        case 'DIV':
          return `\n${childrenContent}\n`;
        default:
          return childrenContent;
      }
    };

    let rawMd = '';
    for (const child of Array.from(body.childNodes)) {
      rawMd += traverse(child);
    }

    return rawMd
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch (e) {
    console.error("Error parsing html to markdown", e);
    return html;
  }
}

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

  // Markdown Tab & Text States
  const [activeTab, setActiveTab] = useState<'visual' | 'markdown' | 'preview'>('visual');
  const [markdownText, setMarkdownText] = useState('');

  // Load initial content when modal opens
  useEffect(() => {
    if (isOpen) {
      setYoutubeUrl(initialData.youtube_url || '');
      setDownloadFiles(initialData.download_files || []);
      setQuiz(initialData.quiz || null);
      
      const longSummary = initialData.long_summary || '';
      setMarkdownText(htmlToMarkdown(longSummary));
      setActiveTab('visual');
      
      // Load rich text summary
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = longSummary;
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

  const insertHTML = (html: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        const el = document.createElement('div');
        el.innerHTML = html;
        const frag = document.createDocumentFragment();
        let node;
        let lastNode = null;
        while ((node = el.firstChild)) {
          lastNode = frag.appendChild(node);
        }
        range.insertNode(frag);
        
        if (lastNode) {
          const newRange = range.cloneRange();
          newRange.setStartAfter(lastNode);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      } else {
        editorRef.current.innerHTML += html;
      }
    }
  };

  const handleTabChange = (newTab: 'visual' | 'markdown' | 'preview') => {
    if (activeTab === newTab) return;

    let currentHtml = '';
    if (activeTab === 'visual') {
      currentHtml = editorRef.current?.innerHTML || '';
    } else if (activeTab === 'markdown') {
      currentHtml = markdownToHtml(markdownText);
    } else if (activeTab === 'preview') {
      currentHtml = markdownToHtml(markdownText);
    }

    if (newTab === 'visual') {
      const htmlToSet = activeTab === 'markdown' ? markdownToHtml(markdownText) : currentHtml;
      setActiveTab('visual');
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = htmlToSet;
        }
      }, 50);
    } else if (newTab === 'markdown') {
      const mdToSet = activeTab === 'visual' ? htmlToMarkdown(currentHtml) : markdownText;
      setMarkdownText(mdToSet);
      setActiveTab('markdown');
    } else if (newTab === 'preview') {
      const mdToSet = activeTab === 'visual' ? htmlToMarkdown(currentHtml) : markdownText;
      setMarkdownText(mdToSet);
      setActiveTab('preview');
    }
  };

  const applyHeader = (level: 'h1' | 'h2' | 'h3' | 'h4' | 'p') => {
    if (level === 'p') {
      handleCommand('formatBlock', '<p>');
    } else {
      handleCommand('formatBlock', `<${level}>`);
    }
  };

  const insertCheckbox = () => {
    const checkboxHtml = `<div><input type="checkbox" class="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer align-middle mr-2 shrink-0" /> <span class="text-sm text-gray-700 align-middle">Nouvelle tâche</span></div>`;
    insertHTML(checkboxHtml);
  };

  const insertFormulaBlock = () => {
    const formula = window.prompt("Entrez votre formule mathématique (ex: E = mc², a² + b² = c²) :");
    if (formula && formula.trim()) {
      const trimmed = formula.trim();
      const formulaHtml = `<div class="formula-block my-4 p-4 bg-purple-50 border border-purple-100 rounded-2xl flex flex-col items-center justify-center font-serif text-purple-950 shadow-xs border-l-4 border-l-purple-600 select-all" data-formula="${trimmed}"><span class="text-[10px] uppercase tracking-widest text-purple-600 font-black font-sans mb-1">Formule Mathématique</span><span class="font-bold tracking-wide text-lg text-center font-serif">${trimmed}</span></div><p><br></p>`;
      insertHTML(formulaHtml);
    }
  };

  // Submit Handler
  const handleSave = () => {
    let summaryHtml = '';
    if (activeTab === 'visual') {
      if (editorRef.current) {
        summaryHtml = editorRef.current.innerHTML;
      }
    } else {
      summaryHtml = markdownToHtml(markdownText);
    }

    if (summaryHtml === '<br>' || summaryHtml.trim() === '') {
      summaryHtml = '';
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
              1. Résumé détaillé du module <span className="text-xs font-normal text-gray-400">(Saisie en mode visuel ou Markdown directe)</span>
            </label>
            
            <div className="border border-gray-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
              {/* Tab Selector */}
              <div className="flex border-b border-gray-100 bg-gray-50/50 p-1.5 gap-1 select-none">
                <button
                  type="button"
                  onClick={() => handleTabChange('visual')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'visual'
                      ? 'bg-white text-purple-700 shadow-xs border border-gray-200/50'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Éditeur Visuel
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('markdown')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'markdown'
                      ? 'bg-white text-purple-700 shadow-xs border border-gray-200/50'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  Éditeur Markdown
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('preview')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-white text-purple-700 shadow-xs border border-gray-200/50'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Aperçu Élève
                </button>
              </div>

              {/* Tab 1: Visual Editor (WYSIWYG) */}
              {activeTab === 'visual' && (
                <div className="flex flex-col">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-1 px-3 py-2 bg-gray-50/80 border-b border-gray-100 select-none">
                    {/* Basic formats */}
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

                    {/* Titres H1, H2, H3, H4 */}
                    <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
                      <button
                        type="button"
                        onClick={() => applyHeader('h1')}
                        className="px-2 py-1 text-[10px] font-black text-gray-700 hover:text-gray-950 hover:bg-white rounded transition-colors"
                        title="Titre 1 (H1)"
                      >
                        H1
                      </button>
                      <button
                        type="button"
                        onClick={() => applyHeader('h2')}
                        className="px-2 py-1 text-[10px] font-extrabold text-gray-700 hover:text-gray-950 hover:bg-white rounded transition-colors"
                        title="Titre 2 (H2)"
                      >
                        H2
                      </button>
                      <button
                        type="button"
                        onClick={() => applyHeader('h3')}
                        className="px-2 py-1 text-[10px] font-bold text-gray-700 hover:text-gray-950 hover:bg-white rounded transition-colors"
                        title="Titre 3 (H3)"
                      >
                        H3
                      </button>
                      <button
                        type="button"
                        onClick={() => applyHeader('h4')}
                        className="px-2 py-1 text-[10px] font-semibold text-gray-700 hover:text-gray-950 hover:bg-white rounded transition-colors"
                        title="Titre 4 (H4)"
                      >
                        H4
                      </button>
                      <button
                        type="button"
                        onClick={() => applyHeader('p')}
                        className="px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-gray-800 hover:bg-white rounded transition-colors"
                        title="Paragraphe normal"
                      >
                        P
                      </button>
                    </div>

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

                    {/* Custom Additions: Checkbox and Formulas */}
                    <button
                      type="button"
                      onClick={insertCheckbox}
                      className="p-2 text-purple-700 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-1"
                      title="Insérer une case à cocher (checklist)"
                    >
                      <CheckSquare className="w-4 h-4" />
                    </button>
                    
                    <button
                      type="button"
                      onClick={insertFormulaBlock}
                      className="p-2 text-indigo-700 hover:text-indigo-950 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                      title="Insérer un espace à formules"
                    >
                      <Sigma className="w-4 h-4" />
                    </button>

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
                      className="outline-none min-h-[140px] text-sm text-gray-800 leading-relaxed prose max-w-none focus:outline-none focus:ring-0
                        [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_strong]:font-bold [&_em]:italic [&_u]:underline
                        [&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-gray-900 [&_h1]:mt-5 [&_h1]:mb-3 [&_h1]:tracking-tight [&_h1]:border-b [&_h1]:border-gray-100 [&_h1]:pb-1
                        [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-gray-900 [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:tracking-tight
                        [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-gray-900 [&_h3]:mt-3.5 [&_h3]:mb-1.5
                        [&_h4]:text-base [&_h4]:font-bold [&_h4]:text-gray-800 [&_h4]:mt-3 [&_h4]:mb-1 [&_li]:list-none"
                      placeholder="Rédigez le résumé très long ou le contenu du cours pour ce module..."
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Raw Markdown Editor */}
              {activeTab === 'markdown' && (
                <div className="flex flex-col bg-slate-900 border-t border-slate-800">
                  <div className="p-2 bg-slate-950 flex items-center justify-between px-4 text-xs font-semibold text-slate-400 select-none border-b border-slate-800">
                    <span>Mode Code Source Markdown (.md)</span>
                    <span className="text-[10px] text-purple-400 font-mono">Prise en charge de H1-H4, Listes, Cases à cocher et $$ Formule $$</span>
                  </div>
                  <textarea
                    value={markdownText}
                    onChange={(e) => setMarkdownText(e.target.value)}
                    className="p-4 w-full h-[240px] bg-transparent outline-none resize-none text-slate-200 font-mono text-xs focus:ring-0 focus:border-transparent border-none placeholder-slate-600 leading-relaxed"
                    placeholder="# Titre 1&#10;## Titre 2&#10;Texte en **gras** ou *italique*...&#10;- [ ] Case à cocher 1&#10;- [x] Case à cocher 2&#10;&#10;$$ E = mc^2 $$"
                  />
                </div>
              )}

              {/* Tab 3: Live Student View Preview */}
              {activeTab === 'preview' && (
                <div className="p-4 bg-slate-100 min-h-[160px] max-h-[300px] overflow-y-auto">
                  <div className="p-2 bg-slate-200/70 text-slate-500 font-semibold text-[10px] uppercase tracking-wider rounded-lg mb-3 select-none flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-purple-600" />
                    Prévisualisation de l'affichage de l'élève
                  </div>
                  {markdownText.trim() ? (
                    <div 
                      className="bg-white p-5 rounded-xl border border-gray-200 max-w-none prose prose-indigo text-gray-800
                        [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_strong]:font-bold [&_em]:italic [&_u]:underline
                        [&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-gray-950 [&_h1]:mt-5 [&_h1]:mb-3 [&_h1]:tracking-tight [&_h1]:border-b [&_h1]:border-gray-100 [&_h1]:pb-1
                        [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-gray-900 [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:tracking-tight
                        [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-gray-900 [&_h3]:mt-3.5 [&_h3]:mb-1.5
                        [&_h4]:text-base [&_h4]:font-bold [&_h4]:text-gray-800 [&_h4]:mt-3 [&_h4]:mb-1 [&_li]:list-none"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(markdownText) }}
                    />
                  ) : (
                    <div className="bg-white p-5 rounded-xl border border-gray-200 text-center text-xs italic text-gray-400">
                      Rédigez du contenu pour voir un aperçu élève réaliste.
                    </div>
                  )}
                </div>
              )}
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 bg-gray-50 border-t border-gray-100 shrink-0">
          <div className="text-xs text-gray-500 font-medium max-w-sm">
            💡 <strong>Étape 2 sur 3</strong> : Enregistrez le module ici, puis cliquez sur le bouton <strong>"Enregistrer les modifications"</strong> tout en bas de la page principale pour sauvegarder.
          </div>
          <div className="flex items-center gap-3 justify-end">
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
