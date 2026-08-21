import React, { useEffect, useRef } from 'react';
import { isExcelError } from '../../lib/excel/excelFunctions';
import type { ExcelEditorRef } from './ExcelFormulaBar';
import { renderHighlightedText, HighlightedReference } from './utils/formulaHighlighter';

interface ExcelCellProps {
  address: string;
  value: string;
  displayValue?: string;
  isActive: boolean;
  isInRange: boolean;
  isRangeCorner: boolean;
  isEditing: boolean;
  highlightColorClass?: string;
  highlights?: HighlightedReference[];
  width: number;
  height: number;
  onSelect: (address: string, e?: React.MouseEvent | React.TouchEvent) => void;
  onStartEdit: (address: string) => void;
  onCommitEdit: (value: string) => void;
  onCancelEdit: () => void;
  onHandleDragStart?: (e: React.TouchEvent | React.MouseEvent) => void;
  onChangeEditValue?: (val: string) => void;
}

export const ExcelCell = React.memo(React.forwardRef<ExcelEditorRef, ExcelCellProps>((props, ref) => {
  const {
    address,
    value,
    displayValue,
    isActive,
    isInRange,
    isRangeCorner,
    isEditing,
    highlightColorClass,
    highlights,
    width,
    height,
    onSelect,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
    onHandleDragStart,
    onChangeEditValue
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const cellOverlayRef = useRef<HTMLDivElement>(null);
  const lastInsertedPos = useRef<{start: number, end: number} | null>(null);

  React.useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      if (!inputRef.current) return;
      const input = inputRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      
      const newVal = value.substring(0, start) + text + value.substring(end);
      onChangeEditValue?.(newVal);
      
      const newPos = start + text.length;
      lastInsertedPos.current = { start, end: newPos };
      
      requestAnimationFrame(() => {
        if (inputRef.current) {
          if (document.activeElement !== inputRef.current) inputRef.current.focus();
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
        onChangeEditValue?.(newVal);
        
        const newPos = start + text.length;
        lastInsertedPos.current = { start, end: newPos };
        
        requestAnimationFrame(() => {
          if (inputRef.current) {
            if (document.activeElement !== inputRef.current) inputRef.current.focus();
            inputRef.current.setSelectionRange(newPos, newPos);
          }
        });
        return;
      }
      
      const { start, end } = lastInsertedPos.current;
      const newVal = value.substring(0, start) + text + value.substring(end);
      onChangeEditValue?.(newVal);
      
      const newPos = start + text.length;
      lastInsertedPos.current = { start, end: newPos };
      
      requestAnimationFrame(() => {
        if (inputRef.current) {
          if (document.activeElement !== inputRef.current) inputRef.current.focus();
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      });
    },
    focus: () => {
      inputRef.current?.focus();
    }
  }));

  useEffect(() => {
    if (isEditing && inputRef.current) {
      if (document.activeElement !== inputRef.current) {
         inputRef.current.focus();
         const len = inputRef.current.value.length;
         inputRef.current.setSelectionRange(len, len);
      }
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommitEdit(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onCommitEdit(value);
    }
  };

  const handleBlur = () => {
    if (isEditing) {
      onCommitEdit(value);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    lastInsertedPos.current = null;
    onChangeEditValue?.(e.target.value);
  };

  const renderedText = displayValue !== undefined ? displayValue : value;
  const isErr = isExcelError(renderedText) || renderedText.startsWith('#');
  const isNumber = !isErr && !isNaN(Number(renderedText.replace(',', '.'))) && renderedText.trim() !== '';
  const isBool = !isErr && (renderedText === 'true' || renderedText === 'false' || renderedText === 'VRAI' || renderedText === 'FAUX');

  const hasInlineHighlights = isEditing && value.startsWith('=') && highlights && highlights.length > 0;

  return (
    <div
      onPointerDown={(e) => {
        if ('button' in e && e.button !== 0 && e.pointerType === 'mouse') return;
        onSelect(address, e);
      }}
      onDoubleClick={() => onStartEdit(address)}
      style={{
        width: `${width}px`,
        minWidth: `${width}px`,
        height: `${height}px`,
        minHeight: `${height}px`
      }}
      className={`relative select-none box-border text-xs border-r border-b transition-colors flex items-center px-2 cursor-cell ${
        isActive
          ? 'bg-white z-20 ring-2 ring-emerald-600 border-transparent shadow-xs'
          : highlightColorClass
          ? `${highlightColorClass} z-10`
          : isInRange
          ? 'bg-emerald-500/15 border-emerald-300/60'
          : isErr
          ? 'bg-rose-50/60 hover:bg-rose-100/50 border-slate-200'
          : 'bg-white hover:bg-slate-50/80 border-slate-200'
      }`}
    >
      {isEditing ? (
        <div className="relative w-full h-full flex items-center z-30">
          {hasInlineHighlights && (
            <div 
              ref={cellOverlayRef}
              className="absolute inset-0 pointer-events-none px-1 py-0.5 font-mono text-xs whitespace-pre overflow-hidden flex items-center text-slate-900"
              aria-hidden="true"
            >
              {renderHighlightedText(value, highlights!)}
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onScroll={(e) => {
              if (cellOverlayRef.current) {
                cellOverlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
              }
            }}
            className={`w-full h-full font-mono text-xs outline-none px-1 py-0.5 border border-emerald-600 shadow-inner ${
              hasInlineHighlights
                ? 'bg-transparent text-transparent caret-slate-800'
                : 'bg-white text-slate-900'
            }`}
          />
        </div>
      ) : (
        <div
          className={`w-full truncate font-sans text-xs ${
            isErr
              ? 'text-center font-mono font-bold text-rose-600'
              : isNumber
              ? 'text-right font-mono text-slate-900 font-medium'
              : isBool
              ? 'text-center font-mono font-bold text-teal-700'
              : 'text-left text-slate-800'
          }`}
          title={value.startsWith('=') ? `${value}  ➜  ${renderedText}` : renderedText}
        >
          {renderedText}
        </div>
      )}
      {/* Fill handle (poignée de recopie) - With larger invisible touch target */}
      {(isActive || isRangeCorner) && !isEditing && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            onHandleDragStart && onHandleDragStart(e);
          }}
          className="absolute -bottom-3 -right-3 w-7 h-7 flex items-center justify-center z-30 cursor-crosshair group touch-none"
          title="Tirer pour recopier (remplissage automatique)"
        >
          <div className="w-3.5 h-3.5 bg-emerald-600 border-2 border-white rounded-xs shadow-md group-hover:scale-125 transition-transform" />
        </div>
      )}
    </div>
  );
}));
