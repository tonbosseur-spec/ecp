import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  CellCoordinate,
  CellRange,
  ExcelCellsMap,
  addressToCoord,
  coordToAddress,
  indexToColName,
  isCoordInRange,
  normalizeRange,
  rangeToAddress
} from '../../lib/excel/excelTypes';
import { ExcelCell } from './ExcelCell';
import { ExcelColumnHeader } from './ExcelColumnHeader';
import { ExcelRowHeader } from './ExcelRowHeader';
import type { ExcelEditorRef } from './ExcelFormulaBar';

import { extractFormulaReferences } from './utils/formulaHighlighter';
import type { HighlightedReference } from './utils/formulaHighlighter';

interface ExcelGridProps {
  colsCount?: number;
  rowsCount?: number;
  cells: ExcelCellsMap;
  activeCoord: CellCoordinate;
  selectionRange: CellRange;
  isEditing: boolean;
  isFormulaEditing?: boolean;
  onSelectCell: (coord: CellCoordinate, extendRange?: boolean, e?: React.MouseEvent | React.TouchEvent) => void;
  onUpdateRange: (range: CellRange) => void;
  onFillRange?: (sourceRange: CellRange, targetRange: CellRange) => void;
  onStartEdit: (address: string) => void;
  onCommitEdit: (address: string, value: string) => void;
  onCancelEdit: () => void;
  onDeleteSelected: () => void;
  inlineEditorRef?: React.RefObject<ExcelEditorRef>;
  editValue?: string;
  onChangeEditValue?: (val: string) => void;
}

export const ExcelGrid: React.FC<ExcelGridProps> = ({
  colsCount = 6, // A to F
  rowsCount = 20, // 1 to 20
  cells,
  activeCoord,
  selectionRange,
  isEditing,
  isFormulaEditing,
  onSelectCell,
  onUpdateRange,
  onFillRange,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDeleteSelected,
  inlineEditorRef,
  editValue,
  onChangeEditValue
}) => {
  const gridContainerRef = useRef<HTMLDivElement>(null);
  
  // Drag states
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);

  const activeEditingFormula = Boolean(isFormulaEditing || isEditing);

  const highlights = React.useMemo(() => {
    if (activeEditingFormula && editValue && editValue.startsWith('=')) {
      return extractFormulaReferences(editValue);
    }
    return [];
  }, [activeEditingFormula, editValue]);

  const getCellHighlightColor = useCallback((coord: CellCoordinate, address: string) => {
    if (highlights.length === 0) return undefined;
    
    const cleanAddr = address.toUpperCase();

    for (const hl of highlights) {
      const cleanRef = hl.ref.replace(/\$/g, '').toUpperCase();
      
      if (cleanRef.includes(':')) {
        const parts = cleanRef.split(':');
        if (parts.length === 2) {
          const startCoord = addressToCoord(parts[0]);
          const endCoord = addressToCoord(parts[1]);
          if (startCoord && endCoord) {
            const normRange = normalizeRange({ start: startCoord, end: endCoord });
            if (isCoordInRange(coord, normRange)) {
              return hl.gridColorClass;
            }
          }
        }
      } else {
        if (cleanRef === cleanAddr) {
          return hl.gridColorClass;
        }
      }
    }
    return undefined;
  }, [highlights]);
  const [isDraggingFill, setIsDraggingFill] = useState(false);
  
  const dragStartCoordRef = useRef<CellCoordinate>(selectionRange.start);
  const fillSourceRangeRef = useRef<CellRange | null>(null);

  // Maintain latest selectionRange in ref for pointerUp event
  const currentSelectionRef = useRef<CellRange>(selectionRange);
  useEffect(() => {
    currentSelectionRef.current = selectionRange;
  }, [selectionRange]);

  const colWidth = 100;
  const rowHeight = 34;
  const rowHeaderWidth = 38;
  const colHeaderHeight = 28;

  const normalizedRange = normalizeRange(selectionRange);
  const activeAddress = coordToAddress(activeCoord);

  // Check if a column or row header is selected
  const isColSelected = useCallback(
    (colIdx: number) => {
      return colIdx >= normalizedRange.start.col && colIdx <= normalizedRange.end.col;
    },
    [normalizedRange]
  );

  const isRowSelected = useCallback(
    (rowIdx: number) => {
      return rowIdx >= normalizedRange.start.row && rowIdx <= normalizedRange.end.row;
    },
    [normalizedRange]
  );

  // Column / Row header click to select whole col/row
  const handleSelectColumn = (colIdx: number) => {
    const start: CellCoordinate = { col: colIdx, row: 0 };
    const end: CellCoordinate = { col: colIdx, row: rowsCount - 1 };
    onUpdateRange({ start, end });
  };

  const handleSelectRow = (rowIdx: number) => {
    const start: CellCoordinate = { col: 0, row: rowIdx };
    const end: CellCoordinate = { col: colsCount - 1, row: rowIdx };
    onUpdateRange({ start, end });
  };

  // Keyboard navigation on grid
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) return;

    let nextCol = activeCoord.col;
    let nextRow = activeCoord.row;
    let handled = false;

    if (e.key === 'ArrowUp') {
      nextRow = Math.max(0, activeCoord.row - 1);
      handled = true;
    } else if (e.key === 'ArrowDown') {
      nextRow = Math.min(rowsCount - 1, activeCoord.row + 1);
      handled = true;
    } else if (e.key === 'ArrowLeft') {
      nextCol = Math.max(0, activeCoord.col - 1);
      handled = true;
    } else if (e.key === 'ArrowRight') {
      nextCol = Math.min(colsCount - 1, activeCoord.col + 1);
      handled = true;
    } else if (e.key === 'Tab') {
      handled = true;
      if (e.shiftKey) {
        nextCol = Math.max(0, activeCoord.col - 1);
      } else {
        nextCol = Math.min(colsCount - 1, activeCoord.col + 1);
      }
    } else if (e.key === 'Enter') {
      handled = true;
      if (e.shiftKey) {
        nextRow = Math.max(0, activeCoord.row - 1);
      } else {
        nextRow = Math.min(rowsCount - 1, activeCoord.row + 1);
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      onDeleteSelected();
      handled = true;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Start typing directly into active cell
      onStartEdit(activeAddress);
    }

    if (handled) {
      e.preventDefault();
      const newCoord = { col: nextCol, row: nextRow };
      if (e.shiftKey && (e.key.startsWith('Arrow'))) {
        onSelectCell(newCoord, true);
      } else {
        onSelectCell(newCoord, false);
      }
    }
  };

  // Gesture tracking ref for discriminating TAP vs DRAG vs SCROLL on touch
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    pointerType: string;
    coord: CellCoordinate;
    isShift: boolean;
    hasMoved: boolean;
  } | null>(null);

  const touchHoldTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTouchHoldTimer = () => {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
  };

  // Drag handle handlers (for filling)
  const handleDragHandleStart = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    clearTouchHoldTimer();
    setIsDraggingFill(true);
    fillSourceRangeRef.current = { ...selectionRange };
    dragStartCoordRef.current = selectionRange.start;
  };
  
  // Drag selection & tap handlers (for selecting cell / inserting reference)
  const handleCellPointerDown = (coord: CellCoordinate, e: React.SyntheticEvent) => {
    clearTouchHoldTimer();

    const nativeEv = (e.nativeEvent || e) as PointerEvent | MouseEvent | TouchEvent;
    const isTouch =
      ('pointerType' in nativeEv && (nativeEv as PointerEvent).pointerType === 'touch') ||
      ('touches' in nativeEv && (nativeEv as TouchEvent).touches && (nativeEv as TouchEvent).touches.length > 0);
    const pointerType = 'pointerType' in nativeEv ? (nativeEv as PointerEvent).pointerType : (isTouch ? 'touch' : 'mouse');

    // Ignore right clicks for mouse
    if ('button' in nativeEv && (nativeEv as MouseEvent).button !== 0 && pointerType === 'mouse') return;

    let clientX = 0;
    let clientY = 0;
    if ('clientX' in nativeEv) {
      clientX = (nativeEv as MouseEvent).clientX;
      clientY = (nativeEv as MouseEvent).clientY;
    } else if ('touches' in nativeEv && (nativeEv as TouchEvent).touches && (nativeEv as TouchEvent).touches[0]) {
      clientX = (nativeEv as TouchEvent).touches[0].clientX;
      clientY = (nativeEv as TouchEvent).touches[0].clientY;
    }

    const isShift = 'shiftKey' in nativeEv ? (nativeEv as MouseEvent).shiftKey : false;

    // IF formula editing or inline cell editing:
    // Call preventDefault on pointerdown so formula bar input retains focus
    if (isEditing || isFormulaEditing) {
      if ('preventDefault' in e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
    }

    gestureRef.current = {
      startX: clientX,
      startY: clientY,
      pointerType,
      coord,
      isShift,
      hasMoved: false
    };

    // For desktop mouse (when not editing), start range drag selection immediately
    if (pointerType === 'mouse' && !isEditing && !isFormulaEditing) {
      setIsDraggingSelection(true);
      dragStartCoordRef.current = coord;
      onSelectCell(coord, isShift, e as unknown as React.MouseEvent);
    } else if (pointerType === 'touch' && !isEditing && !isFormulaEditing) {
      // For touch:
      // If touch starts on the active cell or inside active selection, enable range drag immediately
      const isTouchOnActiveOrRange = isCoordInRange(coord, selectionRange) || 
        (coord.col === activeCoord.col && coord.row === activeCoord.row);

      if (isTouchOnActiveOrRange) {
        setIsDraggingSelection(true);
        dragStartCoordRef.current = selectionRange.start;
      } else {
        // Otherwise, set a short 150ms timer for long-press selection drag
        touchHoldTimerRef.current = setTimeout(() => {
          if (gestureRef.current && !gestureRef.current.hasMoved) {
            onSelectCell(coord, false);
            setIsDraggingSelection(true);
            dragStartCoordRef.current = coord;
          }
        }, 150);
      }
    }
  };

  const getCoordFromClientXY = (clientX: number, clientY: number): CellCoordinate | null => {
    if (!gridContainerRef.current) return null;
    const rect = gridContainerRef.current.getBoundingClientRect();
    const scrollLeft = gridContainerRef.current.scrollLeft;
    const scrollTop = gridContainerRef.current.scrollTop;

    const relX = clientX - rect.left + scrollLeft - rowHeaderWidth;
    const relY = clientY - rect.top + scrollTop - colHeaderHeight;

    if (relX < 0 || relY < 0) return null;

    const col = Math.min(colsCount - 1, Math.max(0, Math.floor(relX / colWidth)));
    const row = Math.min(rowsCount - 1, Math.max(0, Math.floor(relY / rowHeight)));

    return { col, row };
  };

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent | TouchEvent | PointerEvent) => {
      // 1. If dragging fill handle: intercept and update fill range
      if (isDraggingFill) {
        if (e.cancelable) e.preventDefault();
        const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
        const targetCoord = getCoordFromClientXY(clientX, clientY);
        if (targetCoord) {
          onUpdateRange({
            start: fillSourceRangeRef.current ? fillSourceRangeRef.current.start : dragStartCoordRef.current,
            end: targetCoord
          });
        }
        return;
      }

      // 2. Track distance for active gesture
      if (gestureRef.current) {
        const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
        const dx = clientX - gestureRef.current.startX;
        const dy = clientY - gestureRef.current.startY;
        const dist = Math.hypot(dx, dy);

        if (dist > 8) {
          gestureRef.current.hasMoved = true;
          // If not currently range-dragging, clear hold timer to allow smooth native scroll
          if (!isDraggingSelection) {
            clearTouchHoldTimer();
          }
        }

        // For drag range selection (mouse or touch active selection):
        if (isDraggingSelection) {
          if (e.cancelable) e.preventDefault();
          const targetCoord = getCoordFromClientXY(clientX, clientY);
          if (targetCoord) {
            onUpdateRange({
              start: dragStartCoordRef.current,
              end: targetCoord
            });
          }
        }
      }
    };

    const handlePointerUp = (e: MouseEvent | TouchEvent | PointerEvent) => {
      clearTouchHoldTimer();

      if (gestureRef.current) {
        const { pointerType, coord, isShift, hasMoved } = gestureRef.current;

        // If it was a TAP (distance <= 8px):
        if (!hasMoved) {
          // Trigger cell selection / formula reference insertion ONCE:
          if (pointerType === 'touch' || isEditing || isFormulaEditing) {
            onSelectCell(coord, isShift, e as unknown as React.MouseEvent);
          }
        }

        gestureRef.current = null;
      }

      if (isDraggingFill) {
        setIsDraggingFill(false);
        if (fillSourceRangeRef.current && onFillRange) {
          onFillRange(fillSourceRangeRef.current, currentSelectionRef.current);
        }
        fillSourceRangeRef.current = null;
      }

      if (isDraggingSelection) {
        setIsDraggingSelection(false);
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingFill, isDraggingSelection, isEditing, isFormulaEditing, onSelectCell, onUpdateRange, onFillRange]);

  return (
    <div
      ref={gridContainerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ touchAction: 'pan-x pan-y' }}
      className="relative w-full max-w-full overflow-auto bg-slate-200 border border-slate-300/80 rounded-2xl shadow-inner focus:outline-none select-none max-h-[60vh] sm:max-h-[68vh]"
    >
      <div
        style={{
          minWidth: `${rowHeaderWidth + colsCount * colWidth}px`,
          width: 'max-content'
        }}
        className="flex flex-col"
      >
        {/* Sticky Top Header Row */}
        <div className="sticky top-0 z-30 flex bg-slate-100 border-b border-slate-300">
          {/* Top-Left Corner Box (Select All) */}
          <div
            style={{ width: `${rowHeaderWidth}px`, minWidth: `${rowHeaderWidth}px`, height: `${colHeaderHeight}px` }}
            onClick={() => {
              onUpdateRange({
                start: { col: 0, row: 0 },
                end: { col: colsCount - 1, row: rowsCount - 1 }
              });
            }}
            className="sticky left-0 z-40 bg-slate-200 border-r border-b border-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-300 transition-colors"
            title="Tout sélectionner"
          >
            <div className="w-2 h-2 bg-slate-400 rounded-2xs" />
          </div>

          {/* Column Headers A, B, C, D, E, F */}
          {Array.from({ length: colsCount }).map((_, cIdx) => (
            <ExcelColumnHeader
              key={cIdx}
              colIndex={cIdx}
              width={colWidth}
              isSelected={isColSelected(cIdx)}
              onSelectColumn={handleSelectColumn}
            />
          ))}
        </div>

        {/* Rows Container */}
        {Array.from({ length: rowsCount }).map((_, rIdx) => {
          const isRowAct = isRowSelected(rIdx);

          return (
            <div key={rIdx} className="flex">
              {/* Sticky Left Row Header (1, 2, 3...) */}
              <div className="sticky left-0 z-20">
                <ExcelRowHeader
                  rowIndex={rIdx}
                  height={rowHeight}
                  width={rowHeaderWidth}
                  isSelected={isRowAct}
                  onSelectRow={handleSelectRow}
                />
              </div>

              {/* Cells in Row */}
              {Array.from({ length: colsCount }).map((_, cIdx) => {
                const cellCoord: CellCoordinate = { col: cIdx, row: rIdx };
                const address = coordToAddress(cellCoord);
                const cellData = cells[address];
                const rawVal = cellData?.value || '';

                const isAct = activeCoord.col === cIdx && activeCoord.row === rIdx;
                const inRange = isCoordInRange(cellCoord, selectionRange);
                const isCorner =
                  normalizedRange.end.col === cIdx && normalizedRange.end.row === rIdx;
                const isCellEditing = isAct && isEditing;

                const highlightClass = getCellHighlightColor(cellCoord, address);

                return (
                  <ExcelCell
                    key={address}
                    address={address}
                    value={rawVal}
                    displayValue={cellData?.computed !== undefined ? String(cellData.computed) : rawVal}
                    isActive={isAct}
                    isInRange={inRange}
                    isRangeCorner={isCorner}
                    isEditing={isCellEditing}
                    highlightColorClass={highlightClass}
                    highlights={isCellEditing ? highlights : undefined}
                    width={colWidth}
                    height={rowHeight}
                    onSelect={(addr, e) => {
                      if (e) {
                        handleCellPointerDown(cellCoord, e);
                      } else {
                        onSelectCell(cellCoord, false);
                      }
                    }}
                    onStartEdit={onStartEdit}
                    onCommitEdit={(val) => onCommitEdit(address, val)}
                    onCancelEdit={onCancelEdit}
                    onHandleDragStart={handleDragHandleStart}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
