import React, { useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Check, X, FunctionSquare } from 'lucide-react';
import { extractFormulaReferences, renderHighlightedText } from './utils/formulaHighlighter';

export interface ExcelEditorRef {
  insertText: (text: string) => void;
  updateLastInserted: (text: string) => void;
  focus: () => void;
}

export type ExcelFormulaBarRef = ExcelEditorRef;

interface ExcelFormulaBarProps {
  activeAddress: string;
  value: string;
  isEditing: boolean;
  onChange: (val: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onOpenFunctions: () => void;
  onFocusInput?: () => void;
}

export const ExcelFormulaBar = forwardRef<ExcelEditorRef, ExcelFormulaBarProps>(({
  activeAddress,
  value,
  isEditing,
  onChange,
  onCommit,
  onCancel,
  onOpenFunctions,
  onFocusInput
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const lastInsertedPos = useRef<{start: number, end: number} | null>(null);

  const highlights = useMemo(() => (isEditing && value.startsWith('=')) ? extractFormulaReferences(value) : [], [isEditing, value]);

  const handleScroll = (e: React.UIEvent<HTMLInputElement>) => {
    if (overlayRef.current) {
      overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      if (!inputRef.current) return;
      const input = inputRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      
      const newVal = value.substring(0, start) + text + value.substring(end);
      onChange(newVal);
      
      const newPos = start + text.length;
      lastInsertedPos.current = { start, end: newPos };
      
      requestAnimationFrame(() => {
        if (inputRef.current) {
          if (document.activeElement !== inputRef.current) {
            inputRef.current.focus();
          }
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      });
    },
    updateLastInserted: (text: string) => {
      if (!inputRef.current) return;
      if (!lastInsertedPos.current) {
        const input = inputRef.current;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        
        const newVal = value.substring(0, start) + text + value.substring(end);
        onChange(newVal);
        
        const newPos = start + text.length;
        lastInsertedPos.current = { start, end: newPos };
        
        requestAnimationFrame(() => {
          if (inputRef.current) {
            if (document.activeElement !== inputRef.current) {
              inputRef.current.focus();
            }
            inputRef.current.setSelectionRange(newPos, newPos);
          }
        });
        return;
      }
      
      const { start, end } = lastInsertedPos.current;
      const newVal = value.substring(0, start) + text + value.substring(end);
      onChange(newVal);
      
      const newPos = start + text.length;
      lastInsertedPos.current = { start, end: newPos };
      
      requestAnimationFrame(() => {
        if (inputRef.current) {
          if (document.activeElement !== inputRef.current) {
            inputRef.current.focus();
          }
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      });
    },
    focus: () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-1.5 sm:p-2 flex items-center gap-1.5 sm:gap-2 shadow-xs">
      {/* Active Cell Address Badge */}
      <div 
        className="shrink-0 px-2.5 sm:px-3.5 py-1.5 bg-slate-100 border border-slate-200 rounded-xl font-mono text-xs sm:text-sm font-black text-slate-800 min-w-[48px] sm:min-w-[60px] text-center select-none shadow-2xs"
        title="Cellule active"
      >
        {activeAddress || 'A1'}
      </div>

      {/* Function Button [fx] */}
      <button
        type="button"
        onClick={onOpenFunctions}
        className="shrink-0 px-2.5 sm:px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl font-serif italic font-bold text-xs sm:text-sm flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
        title="Insérer une fonction Excel"
      >
        <span className="font-mono not-italic text-[11px] font-extrabold text-emerald-600">ƒ</span>
        <span className="font-mono text-xs font-black">x</span>
      </button>

      {/* Action Buttons (Validate / Cancel) */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onCommit}
          className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs transition-all active:scale-95 cursor-pointer shadow-2xs"
          title="Valider la saisie (Entrée)"
        >
          <Check className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs transition-all active:scale-95 cursor-pointer"
          title="Annuler (Échap)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Formula Input Field */}
      <div className="flex-1 min-w-0 relative flex">
        {/* Highlight Overlay */}
        <div 
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none px-3 py-1.5 border border-transparent font-mono text-xs sm:text-sm whitespace-pre overflow-hidden flex items-center"
          aria-hidden="true"
        >
          <div className="text-slate-800">
             {highlights.length > 0 ? renderHighlightedText(value, highlights) : value}
          </div>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            lastInsertedPos.current = null;
            onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onFocus={() => onFocusInput && onFocusInput()}
          placeholder="Saisissez un texte, nombre ou formule (ex: =SOMME(B2:B5))"
          className={`w-full font-mono text-xs sm:text-sm px-3 py-1.5 rounded-xl border outline-none transition-all placeholder:text-slate-400 ${
            highlights.length > 0 
              ? 'bg-transparent text-transparent caret-slate-800 border-slate-200 focus:border-emerald-600' 
              : 'bg-slate-50/70 focus:bg-white text-slate-900 border-slate-200 focus:border-emerald-600'
          }`}
        />
      </div>
    </div>
  );
});
