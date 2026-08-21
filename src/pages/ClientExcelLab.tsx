import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  RotateCcw, 
  Trash2, 
  FileSpreadsheet, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  Calculator,
  PenTool,
  BarChart3,
  Plus
} from 'lucide-react';
import { 
  CellCoordinate, 
  CellRange, 
  ExcelCellsMap, 
  addressToCoord, 
  coordToAddress, 
  rangeToAddress,
  normalizeRange
} from '../lib/excel/excelTypes';
import { offsetFormula } from '../lib/excel/excelReferences';
import { STARTER_EXCEL_DATA } from '../lib/excel/excelSampleData';
import { ExcelEngine } from '../lib/excel/excelEngine';
import { ExcelGrid } from '../components/excel/ExcelGrid';
import { ExcelFormulaBar, ExcelFormulaBarRef, ExcelEditorRef } from '../components/excel/ExcelFormulaBar';
import { ExcelFunctionPicker } from '../components/excel/ExcelFunctionPicker';
import { ExcelChartConfig } from '../components/excel/charts/excelChartTypes';
import { ExcelChartDialog } from '../components/excel/charts/ExcelChartDialog';
import { ExcelChart } from '../components/excel/charts/ExcelChart';

export default function ClientExcelLab() {
  // Grid dimensions
  const colsCount = 6; // A to F
  const rowsCount = 20; // 1 to 20

  // State: Cells data dictionary (initialized and computed with ExcelEngine)
  const [cells, setCells] = useState<ExcelCellsMap>(() => {
    return ExcelEngine.recomputeAll(STARTER_EXCEL_DATA);
  });

  // State: Active cell coordinate (0-based)
  const [activeCoord, setActiveCoord] = useState<CellCoordinate>({ col: 3, row: 1 }); // D2 by default (=B2*C2)
  
  // State: Selection range
  const [selectionRange, setSelectionRange] = useState<CellRange>({
    start: { col: 3, row: 1 },
    end: { col: 3, row: 1 }
  });

  // Active address string e.g. "D2"
  const activeAddress = useMemo(() => coordToAddress(activeCoord), [activeCoord]);

  // State: Formula bar / edit state
  const [editMode, setEditMode] = useState<'none' | 'inline' | 'bar'>('none');
  const [formulaInput, setFormulaInput] = useState<string>(() => {
    return STARTER_EXCEL_DATA['D2']?.value || '';
  });

  // State: Function picker Bottom Sheet
  const [isFunctionPickerOpen, setIsFunctionPickerOpen] = useState(false);

  // State: Charts system
  const [charts, setCharts] = useState<ExcelChartConfig[]>([]);
  const [isChartDialogOpen, setIsChartDialogOpen] = useState(false);

  const handleCreateChart = useCallback((config: Omit<ExcelChartConfig, 'id'>) => {
    const newChart: ExcelChartConfig = {
      ...config,
      id: `chart-${Date.now()}`
    };
    setCharts((prev) => [...prev, newChart]);
  }, []);

  const handleDeleteChart = useCallback((id: string) => {
    setCharts((prev) => prev.filter((c) => c.id !== id));
  }, []);
  
  // Formula bar ref for imperative insertions
  const formulaBarRef = useRef<ExcelFormulaBarRef>(null);
  const inlineEditorRef = useRef<ExcelEditorRef>(null);

  // Active cell metadata
  const activeCellData = cells[activeAddress];
  const activeComputedVal = activeCellData?.computed;
  const isFormulaCell = activeCellData?.value?.startsWith('=');

  // Display range address e.g. "B2:D6" or "D2"
  const formattedSelectionAddress = useMemo(() => {
    return rangeToAddress(selectionRange);
  }, [selectionRange]);

  // Central insert function for both formula bar and inline cell editor
  const insertCellReference = useCallback((text: string, isRangeUpdate: boolean = false) => {
    const editor = editMode === 'bar' ? formulaBarRef.current : inlineEditorRef.current;
    if (editor) {
      if (editor.updateLastInserted) {
         editor.updateLastInserted(text);
      } else {
         editor.insertText(text);
      }
    }
  }, [editMode]);

  // When active cell changes, update the formula bar text with the raw formula/value
  const handleSelectCell = useCallback((coord: CellCoordinate, extendRange: boolean = false, e?: React.MouseEvent | React.TouchEvent) => {
    const addr = coordToAddress(coord);
    
    if ((editMode === 'bar' || editMode === 'inline') && formulaInput.startsWith('=')) {
      if (e && 'preventDefault' in e) e.preventDefault();
      insertCellReference(addr, false);
      return;
    }

    setActiveCoord(coord);
    const cellValue = cells[addr]?.value || '';
    setFormulaInput(cellValue);
    setEditMode('none');

    if (extendRange) {
      setSelectionRange((prev) => ({
        start: prev.start,
        end: coord
      }));
    } else {
      setSelectionRange({
        start: coord,
        end: coord
      });
    }
  }, [cells, editMode, formulaInput]);

  // Range update (e.g. from mouse drag or header click)
  const handleUpdateRange = useCallback((range: CellRange) => {
    if ((editMode === 'bar' || editMode === 'inline') && formulaInput.startsWith('=')) {
      const rangeStr = range.start.col === range.end.col && range.start.row === range.end.row 
        ? coordToAddress(range.start) 
        : `${coordToAddress(range.start)}:${coordToAddress(range.end)}`;
      insertCellReference(rangeStr, true);
      return;
    }

    setSelectionRange(range);
    setActiveCoord(range.start);
    const addr = coordToAddress(range.start);
    const cellValue = cells[addr]?.value || '';
    setFormulaInput(cellValue);
    setEditMode('none');
  }, [cells, editMode, formulaInput, insertCellReference]);

  // Fill handle logic (copy / extrapolate values and formulas over a target range)
  const handleFillRange = useCallback((sourceRange: CellRange, targetRange: CellRange) => {
    setCells((prev) => {
      const updated = { ...prev };
      const normSource = normalizeRange(sourceRange);
      const normTarget = normalizeRange(targetRange);

      for (let c = normTarget.start.col; c <= normTarget.end.col; c++) {
        for (let r = normTarget.start.row; r <= normTarget.end.row; r++) {
          if (c >= normSource.start.col && c <= normSource.end.col &&
              r >= normSource.start.row && r <= normSource.end.row) {
            continue; // Inside the source range, do not overwrite
          }

          // Map to source cell using modulo arithmetic
          const sourceColWidth = normSource.end.col - normSource.start.col + 1;
          const sourceRowHeight = normSource.end.row - normSource.start.row + 1;
          const sourceC = normSource.start.col + ((c - normTarget.start.col) % sourceColWidth);
          const sourceR = normSource.start.row + ((r - normTarget.start.row) % sourceRowHeight);
          
          const sourceAddr = coordToAddress({ col: sourceC, row: sourceR });
          const targetAddr = coordToAddress({ col: c, row: r });

          const sourceCell = prev[sourceAddr];
          if (sourceCell) {
             const deltaCol = c - sourceC;
             const deltaRow = r - sourceR;
             
             let newValue = sourceCell.value;
             if (newValue.startsWith('=')) {
               newValue = offsetFormula(newValue, deltaCol, deltaRow);
             }
             
             updated[targetAddr] = { value: newValue };
          } else {
             delete updated[targetAddr];
          }
        }
      }
      return ExcelEngine.recomputeAll(updated);
    });
    setSelectionRange(targetRange);
  }, []);

  // Start inline edit
  const handleStartEdit = useCallback((address: string) => {
    const coord = addressToCoord(address);
    if (coord) {
      setActiveCoord(coord);
      setSelectionRange({ start: coord, end: coord });
    }
    setEditMode('inline');
    const cellValue = cells[address]?.value || '';
    setFormulaInput(cellValue);
  }, [cells]);

  // Commit value from formula bar or cell and recompute whole grid with ExcelEngine
  const handleCommitValue = useCallback((targetAddress: string, newValue: string) => {
    setCells((prev) => {
      return ExcelEngine.updateCellAndRecompute(prev, targetAddress, newValue);
    });
    setFormulaInput(newValue);
    setEditMode('none');
  }, []);

  // Commit from formula bar (using current activeAddress and formulaInput)
  const handleFormulaBarCommit = useCallback(() => {
    handleCommitValue(activeAddress, formulaInput);
  }, [activeAddress, formulaInput, handleCommitValue]);

  // Cancel edit
  const handleCancelEdit = useCallback(() => {
    const currentVal = cells[activeAddress]?.value || '';
    setFormulaInput(currentVal);
    setEditMode('none');
  }, [cells, activeAddress]);

  // Delete selected cell or range and recompute
  const handleDeleteSelected = useCallback(() => {
    const norm = normalizeRange(selectionRange);
    setCells((prev) => {
      const updated = { ...prev };
      for (let c = norm.start.col; c <= norm.end.col; c++) {
        for (let r = norm.start.row; r <= norm.end.row; r++) {
          const addr = coordToAddress({ col: c, row: r });
          delete updated[addr];
        }
      }
      return ExcelEngine.recomputeAll(updated);
    });
    setFormulaInput('');
    setEditMode('none');
  }, [selectionRange]);

  // Global Keydown to start inline editing smoothly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editMode !== 'none') return;
      
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      
      if (e.key.length === 1) {
        setFormulaInput(e.key);
        setEditMode('inline');
      } else if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        setEditMode('inline');
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editMode, handleDeleteSelected]);

  // Reset to starter table
  const handleResetStarter = () => {
    const fresh = ExcelEngine.recomputeAll(STARTER_EXCEL_DATA);
    setCells(fresh);
    setActiveCoord({ col: 3, row: 1 });
    setSelectionRange({ start: { col: 3, row: 1 }, end: { col: 3, row: 1 } });
    setFormulaInput(fresh['D2']?.value || '');
    setEditMode('none');
  };

  // Clear entire grid
  const handleClearAll = () => {
    setCells({});
    setFormulaInput('');
    setEditMode('none');
  };

  // Insert function from picker into formula bar
  const handleSelectFunction = (funcName: string) => {
    const newFormula = `=${funcName}(`;
    setFormulaInput(newFormula);
    setEditMode('bar');
    // Focus the formula bar after a short delay to allow render
    requestAnimationFrame(() => {
      formulaBarRef.current?.focus();
    });
  };

  // Mobile arrow buttons navigation
  const moveActiveCell = (deltaCol: number, deltaRow: number) => {
    const nextCol = Math.min(colsCount - 1, Math.max(0, activeCoord.col + deltaCol));
    const nextRow = Math.min(rowsCount - 1, Math.max(0, activeCoord.row + deltaRow));
    handleSelectCell({ col: nextCol, row: nextRow });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 py-2.5 px-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          {/* Back button */}
          <Link
            to="/client/training"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>S'entraîner</span>
          </Link>

          {/* Title & Engine status */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black text-slate-900 leading-none truncate">
                  Excel Lab
                </h1>
                <span className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  Moteur actif
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate hidden sm:block">
                Moteur de calcul réactif avec support des formules françaises
              </p>
            </div>
          </div>

          {/* Actions: Insert Chart / Reset / Clear */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsChartDialogOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Insérer un graphique à partir de la sélection"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Insérer un graphique</span>
              <span className="sm:hidden">Graphique</span>
            </button>

            <button
              type="button"
              onClick={handleResetStarter}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Recharger le tableau exemple"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Exemple</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Vider la grille"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vider</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Workspace (Formula Bar + Interactive Grid) */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-2 sm:px-6 py-3 sm:py-5 flex flex-col gap-3">
        
        {/* Formula Bar Component */}
        <div className="space-y-1">
          {editMode === 'bar' && formulaInput.startsWith('=') && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-lg text-[11px] font-bold shadow-xs animate-in fade-in slide-in-from-top-1">
              <PenTool className="w-3.5 h-3.5" />
              <span>Modification de formule : touchez une cellule pour l'insérer</span>
            </div>
          )}
          <ExcelFormulaBar
            ref={formulaBarRef}
            activeAddress={formattedSelectionAddress}
            value={formulaInput}
            isEditing={editMode !== 'none'}
            onChange={(val) => {
              setFormulaInput(val);
              setEditMode('bar');
            }}
          onCommit={handleFormulaBarCommit}
          onCancel={handleCancelEdit}
          onOpenFunctions={() => setIsFunctionPickerOpen(true)}
          onFocusInput={() => setEditMode('bar')}
        />
        </div>

        {/* Dynamic Formula Calculation Indicator */}
        {isFormulaCell && activeComputedVal !== undefined && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 font-mono">
            <div className="flex items-center gap-1.5 truncate">
              <Calculator className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-emerald-700 font-bold">{activeAddress} :</span>
              <span className="truncate">{activeCellData?.value}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2 font-bold">
              <span className="text-slate-400">➜</span>
              <span className={String(activeComputedVal).startsWith('#') ? 'text-rose-600' : 'text-emerald-800'}>
                {String(activeComputedVal)}
              </span>
            </div>
          </div>
        )}

        {/* The Grid Canvas Container */}
        <div className="flex-1 flex flex-col">
          <ExcelGrid
            colsCount={colsCount}
            rowsCount={rowsCount}
            cells={cells}
            activeCoord={activeCoord}
            selectionRange={selectionRange}
            isEditing={editMode === 'inline'}
            isFormulaEditing={editMode !== 'none'}
            editValue={formulaInput}
            inlineEditorRef={inlineEditorRef}
            onChangeEditValue={(val) => setFormulaInput(val)}
            onSelectCell={handleSelectCell}
            onUpdateRange={handleUpdateRange}
            onFillRange={handleFillRange}
            onStartEdit={handleStartEdit}
            onCommitEdit={handleCommitValue}
            onCancelEdit={handleCancelEdit}
            onDeleteSelected={handleDeleteSelected}
          />
        </div>

        {/* Mobile Quick Action Toolbar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2 shadow-xs flex items-center justify-between gap-2 sm:hidden select-none">
          {/* Quick Arrow Direction Keypad */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => moveActiveCell(-1, 0)}
              className="p-1.5 bg-white text-slate-700 rounded-lg shadow-2xs active:bg-slate-200"
              title="Gauche"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => moveActiveCell(0, -1)}
              className="p-1.5 bg-white text-slate-700 rounded-lg shadow-2xs active:bg-slate-200"
              title="Haut"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => moveActiveCell(0, 1)}
              className="p-1.5 bg-white text-slate-700 rounded-lg shadow-2xs active:bg-slate-200"
              title="Bas"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => moveActiveCell(1, 0)}
              className="p-1.5 bg-white text-slate-700 rounded-lg shadow-2xs active:bg-slate-200"
              title="Droite"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick FX & Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setFormulaInput('=SOMME(');
                setEditMode('bar');
                requestAnimationFrame(() => formulaBarRef.current?.focus());
              }}
              className="px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-mono font-black active:scale-95"
            >
              =SOMME(
            </button>

            <button
              type="button"
              onClick={() => setIsFunctionPickerOpen(true)}
              className="px-2.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-mono font-bold active:scale-95 flex items-center gap-1"
            >
              ƒx
            </button>

            <button
              type="button"
              onClick={() => setIsChartDialogOpen(true)}
              className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold active:scale-95 flex items-center gap-1"
              title="Insérer un graphique"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleDeleteSelected}
              className="p-1.5 bg-slate-100 text-slate-600 hover:text-rose-600 rounded-xl text-xs active:scale-95"
              title="Effacer la cellule"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Desktop Helper Tips */}
        <div className="hidden sm:flex items-center justify-between text-[11px] text-slate-400 font-medium px-2">
          <span>
            💡 <strong>Astuce</strong> : Tapez des formules comme <code className="text-emerald-700 font-mono font-bold">=B2*C2</code>, <code className="text-emerald-700 font-mono font-bold">=SOMME(D2:D4)</code> ou <code className="text-emerald-700 font-mono font-bold">=SI(D2&gt;50000; "Top"; "Standard")</code>.
          </span>
          <span>
            Sélection : <strong className="text-slate-600 font-mono">{formattedSelectionAddress}</strong>
          </span>
        </div>

        {/* Charts Container Section */}
        {charts.length > 0 && (
          <section className="mt-4 bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">Graphiques insérés</h2>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold font-mono">
                  {charts.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsChartDialogOpen(true)}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouveau graphique</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {charts.map((chart) => (
                <ExcelChart
                  key={chart.id}
                  config={chart}
                  cells={cells}
                  onDelete={handleDeleteChart}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* 3. Function Picker & Chart Dialog */}
      <ExcelFunctionPicker
        isOpen={isFunctionPickerOpen}
        onClose={() => setIsFunctionPickerOpen(false)}
        onSelectFunction={handleSelectFunction}
      />

      <ExcelChartDialog
        isOpen={isChartDialogOpen}
        selectedRangeAddress={formattedSelectionAddress}
        cells={cells}
        onClose={() => setIsChartDialogOpen(false)}
        onCreateChart={handleCreateChart}
      />

      {/* Footer */}
      <footer className="py-2.5 text-center text-[11px] text-slate-400 border-t border-slate-200/50 bg-white/50">
        Exceller chez Pierre • Espace d'entraînement Excel
      </footer>
    </div>
  );
}
