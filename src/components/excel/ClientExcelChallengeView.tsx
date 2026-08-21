import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Table,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  Trash2,
  BookOpen,
  Eye,
  EyeOff,
  Lightbulb,
  Lock,
  Edit3,
  Loader2,
  Sparkles,
  PenTool
} from 'lucide-react';
import { ExcelGrid } from './ExcelGrid';
import { ExcelFormulaBar, ExcelFormulaBarRef, ExcelEditorRef } from './ExcelFormulaBar';
import { ExcelFunctionPicker } from './ExcelFunctionPicker';
import { ExcelEngine } from '../../lib/excel/excelEngine';
import {
  ExcelCellsMap,
  CellCoordinate,
  CellRange,
  coordToAddress,
  addressToCoord,
  normalizeRange
} from '../../lib/excel/excelTypes';
import { offsetFormula } from '../../lib/excel/excelReferences';
import {
  ExcelChallengeConfig,
  DEFAULT_EXCEL_CHALLENGE_CONFIG
} from '../../lib/excel/excelChallengeTypes';
import { ExcelCorrectionResult } from '../../lib/excel/excelCorrectionEngine';
import { TrainingExercise } from '../../types';
import { useToast } from '../Toast';

interface ClientExcelChallengeViewProps {
  exercise: TrainingExercise;
  isValidating: boolean;
  isSaving: boolean;
  validationResult?: ExcelCorrectionResult;
  isAlreadyPassedPrior?: boolean;
  difficultyBadge: { label: string; bg: string };
  onValidate: (currentCells: ExcelCellsMap, config: ExcelChallengeConfig) => void;
  onOpenInstructionsModal?: () => void;
}

export const ClientExcelChallengeView: React.FC<ClientExcelChallengeViewProps> = ({
  exercise,
  isValidating,
  isSaving,
  validationResult,
  isAlreadyPassedPrior,
  difficultyBadge,
  onValidate,
  onOpenInstructionsModal
}) => {
  const { toast } = useToast();

  // Extract config from test_cases (stored payload) or fallback
  const config: ExcelChallengeConfig = useMemo(() => {
    if (exercise.test_cases && typeof exercise.test_cases === 'object' && !Array.isArray(exercise.test_cases)) {
      return {
        initial_data: exercise.test_cases.initial_data || {},
        target_cells: exercise.test_cases.target_cells || [],
        editable_cells: exercise.test_cases.editable_cells,
        criteria: exercise.test_cases.criteria || [],
        grid_cols: exercise.test_cases.grid_cols || 6,
        grid_rows: exercise.test_cases.grid_rows || 20,
        allowed_functions: exercise.test_cases.allowed_functions
      };
    }
    return DEFAULT_EXCEL_CHALLENGE_CONFIG;
  }, [exercise]);

  // Target cells set
  const targetCellsNormalized = useMemo(() => {
    const targets = config.target_cells || [];
    return new Set(targets.map(c => c.toUpperCase().trim()));
  }, [config.target_cells]);

  const isTargetCell = useCallback(
    (address: string) => {
      return targetCellsNormalized.has(address.toUpperCase().trim());
    },
    [targetCellsNormalized]
  );

  // Initialize cells state from initial_data and calculate formulas
  const [cells, setCells] = useState<ExcelCellsMap>(() => {
    return ExcelEngine.recomputeAll(config.initial_data || {});
  });

  // Grid coordinates and range
  const initialCoord = useMemo<CellCoordinate>(() => {
    const firstTarget = config.target_cells && config.target_cells.length > 0
      ? config.target_cells[0]
      : 'A1';
    return addressToCoord(firstTarget);
  }, [config.target_cells]);

  const [activeCoord, setActiveCoord] = useState<CellCoordinate>(initialCoord);
  const [selectionRange, setSelectionRange] = useState<CellRange>({
    start: initialCoord,
    end: initialCoord
  });

  const activeAddress = useMemo(() => coordToAddress(activeCoord), [activeCoord]);

  // Formula bar state
  const [formulaInput, setFormulaInput] = useState<string>('');
  const [editMode, setEditMode] = useState<'none' | 'inline' | 'bar'>('none');
  const [isFunctionPickerOpen, setIsFunctionPickerOpen] = useState(false);
  const [isHintOpen, setIsHintOpen] = useState(false);

  // Formula bar ref
  const formulaBarRef = useRef<ExcelFormulaBarRef>(null);
  const inlineEditorRef = useRef<ExcelEditorRef>(null);

  // Handle commit edit
  const handleCommitValue = useCallback(
    (address: string, newValue: string) => {
      if (!isTargetCell(address)) {
        toast.info(`La cellule ${address} est verrouillée en lecture seule.`);
        setEditMode('none');
        return;
      }

      const updated = ExcelEngine.updateCellAndRecompute(cells, address, newValue);
      setCells(updated);
      setFormulaInput(newValue);
      setEditMode('none');
    },
    [cells, isTargetCell, toast]
  );

  // Handle delete on active cell
  const handleDeleteActiveCell = useCallback(() => {
    if (!isTargetCell(activeAddress)) {
      toast.info(`La cellule ${activeAddress} est verrouillée en lecture seule.`);
      return;
    }
    handleCommitValue(activeAddress, '');
    toast.success(`Contenu de la cellule ${activeAddress} effacé.`);
  }, [activeAddress, isTargetCell, handleCommitValue, toast]);

  // Global keydown for instant typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editMode !== 'none') return;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const currentActiveAddress = coordToAddress(activeCoord);
      const canEdit = isTargetCell(currentActiveAddress);

      if (e.key.length === 1) {
        if (!canEdit) {
          toast.info(`La cellule ${currentActiveAddress} est verrouillée en lecture seule.`);
          return;
        }
        setFormulaInput(e.key);
        setEditMode('inline');
      } else if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        if (!canEdit) {
          toast.info(`La cellule ${currentActiveAddress} est verrouillée en lecture seule.`);
          return;
        }
        setEditMode('inline');
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (!canEdit) {
          toast.info(`La cellule ${currentActiveAddress} est verrouillée en lecture seule.`);
          return;
        }
        handleDeleteActiveCell();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editMode, activeCoord, isTargetCell, handleDeleteActiveCell, toast]);

  // Reset internal state when switching exercise
  useEffect(() => {
    const recomputed = ExcelEngine.recomputeAll(config.initial_data || {});
    setCells(recomputed);
    const startCoord = addressToCoord(
      config.target_cells && config.target_cells.length > 0 ? config.target_cells[0] : 'A1'
    );
    setActiveCoord(startCoord);
    setSelectionRange({ start: startCoord, end: startCoord });
    const startAddr = coordToAddress(startCoord);
    setFormulaInput(recomputed[startAddr]?.value || '');
    setEditMode('none');
    setIsHintOpen(false);
  }, [exercise.id, config]);

  // Sync formula input when active address changes
  useEffect(() => {
    if (editMode !== 'none') return; // Ne pas écraser la saisie en cours
    const cellVal = cells[activeAddress]?.value || '';
    setFormulaInput(cellVal);
  }, [activeAddress, cells, editMode]);

  // Central insert function
  const insertCellReference = useCallback(
    (text: string, isRangeUpdate: boolean = false) => {
      const editor = editMode === 'bar' ? formulaBarRef.current : inlineEditorRef.current;
      if (editor) {
        if (editor.updateLastInserted) {
          editor.updateLastInserted(text);
        } else {
          editor.insertText(text);
        }
      }
    },
    [editMode]
  );

  // Handle cell selection
  const handleSelectCell = useCallback(
    (coord: CellCoordinate, extendRange = false, e?: React.MouseEvent | React.TouchEvent) => {
      const addr = coordToAddress(coord);

      if ((editMode === 'bar' || editMode === 'inline') && formulaInput.startsWith('=')) {
        if (e && 'preventDefault' in e) e.preventDefault();
        insertCellReference(addr, false);
        return;
      }

      setActiveCoord(coord);
      setFormulaInput(cells[addr]?.value || '');
      setEditMode('none');

      if (extendRange) {
        setSelectionRange(prev => ({
          start: prev.start,
          end: coord
        }));
      } else {
        setSelectionRange({
          start: coord,
          end: coord
        });
      }
    },
    [cells, editMode, formulaInput]
  );

  // Handle range update from drag
  const handleUpdateRange = useCallback(
    (range: CellRange) => {
      if ((editMode === 'bar' || editMode === 'inline') && formulaInput.startsWith('=')) {
        const rangeStr =
          range.start.col === range.end.col && range.start.row === range.end.row
            ? coordToAddress(range.start)
            : `${coordToAddress(range.start)}:${coordToAddress(range.end)}`;
        insertCellReference(rangeStr, true);
        return;
      }

      setSelectionRange(range);
      setActiveCoord(range.start);
      const addr = coordToAddress(range.start);
      setFormulaInput(cells[addr]?.value || '');
      setEditMode('none');
    },
    [cells, editMode, formulaInput, insertCellReference]
  );

  // Handle fill range (drag fill handle)
  const handleFillRange = useCallback(
    (sourceRange: CellRange, targetRange: CellRange) => {
      setCells(prev => {
        const updated = { ...prev };
        const normSource = normalizeRange(sourceRange);
        const normTarget = normalizeRange(targetRange);

        for (let c = normTarget.start.col; c <= normTarget.end.col; c++) {
          for (let r = normTarget.start.row; r <= normTarget.end.row; r++) {
            if (
              c >= normSource.start.col &&
              c <= normSource.end.col &&
              r >= normSource.start.row &&
              r <= normSource.end.row
            ) {
              continue;
            }

            const targetAddr = coordToAddress({ col: c, row: r });
            // Only allow modifying target cells in the challenge
            if (!isTargetCell(targetAddr)) {
              continue;
            }

            const sourceColWidth = normSource.end.col - normSource.start.col + 1;
            const sourceRowHeight = normSource.end.row - normSource.start.row + 1;
            const sourceC = normSource.start.col + ((c - normTarget.start.col) % sourceColWidth);
            const sourceR = normSource.start.row + ((r - normTarget.start.row) % sourceRowHeight);
            
            const sourceAddr = coordToAddress({ col: sourceC, row: sourceR });
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
    },
    [isTargetCell]
  );

  // Handle start editing (cell double click or direct typing)
  const handleStartEdit = useCallback(
    (address: string) => {
      if (!isTargetCell(address)) {
        toast.info(`La cellule ${address} fait partie des données de départ et est verrouillée en lecture seule.`);
        return;
      }
      setEditMode('inline');
    },
    [isTargetCell, toast]
  );

  // Handle full reset to initial data
  const handleResetChallenge = useCallback(() => {
    const fresh = ExcelEngine.recomputeAll(config.initial_data || {});
    setCells(fresh);
    const startCoord = addressToCoord(
      config.target_cells && config.target_cells.length > 0 ? config.target_cells[0] : 'A1'
    );
    setActiveCoord(startCoord);
    setSelectionRange({ start: startCoord, end: startCoord });
    const startAddr = coordToAddress(startCoord);
    setFormulaInput(fresh[startAddr]?.value || '');
    setEditMode('none');
    toast.success('Grille réinitialisée aux données de départ.');
  }, [config, toast]);

  // Jump directly to a target cell
  const handleJumpToCell = useCallback(
    (targetAddress: string) => {
      const coord = addressToCoord(targetAddress);
      setActiveCoord(coord);
      setSelectionRange({ start: coord, end: coord });
      setFormulaInput(cells[targetAddress]?.value || '');
      setEditMode('none');
    },
    [cells]
  );

  const isActiveCellTarget = isTargetCell(activeAddress);

  return (
    <div className="space-y-6">
      {/* 1. Header Card with Exercise Info */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-gray-100 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Table className="w-3.5 h-3.5 text-emerald-600" />
              Défi Excel
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${difficultyBadge.bg}`}>
              {difficultyBadge.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {validationResult?.passed ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-in fade-in duration-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Validé ({validationResult.scorePercentage}%)
              </span>
            ) : isAlreadyPassedPrior ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-in fade-in duration-200" title="Déjà réussi lors d'une précédente tentative">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Déjà réussi (100%)
              </span>
            ) : null}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">
          {exercise.title}
        </h2>

        {/* Instructions */}
        {exercise.instructions && (
          <div className="bg-emerald-50/40 rounded-2xl p-4 border border-emerald-100/80 text-xs sm:text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            <div className="flex items-center justify-between mb-1.5">
              <p className="font-bold text-emerald-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                Consigne :
              </p>
              {onOpenInstructionsModal && (
                <button
                  type="button"
                  onClick={onOpenInstructionsModal}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                  title="Agrandir l'énoncé dans une fenêtre"
                >
                  <Eye className="w-3 h-3" />
                  <span>Voir énoncé</span>
                </button>
              )}
            </div>
            {exercise.instructions}
          </div>
        )}

        {/* Target Cells Clickable Badges Banner */}
        {config.target_cells && config.target_cells.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
            <span className="font-extrabold text-gray-600 uppercase tracking-wider text-[10px]">
              Cellule{config.target_cells.length > 1 ? 's' : ''} à compléter :
            </span>
            {config.target_cells.map(targetAddr => {
              const isSelected = activeAddress.toUpperCase() === targetAddr.toUpperCase();
              const hasValue = Boolean(cells[targetAddr]?.value && cells[targetAddr]?.value.trim() !== '');

              return (
                <button
                  key={targetAddr}
                  type="button"
                  onClick={() => handleJumpToCell(targetAddr)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-200'
                      : hasValue
                      ? 'bg-emerald-100/80 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                  title={`Cliquer pour sélectionner la cellule ${targetAddr}`}
                >
                  <span>{targetAddr}</span>
                  {hasValue ? <Check className="w-3 h-3" /> : <Edit3 className="w-3 h-3 opacity-60" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Interactive Excel Workspace Card */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-gray-100 shadow-2xs space-y-4">
        {/* Formula Bar & Active Cell Permission Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2">
              {isActiveCellTarget ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                  <Edit3 className="w-3 h-3" />
                  Cellule cible modifiable
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                  <Lock className="w-3 h-3 text-slate-400" />
                  Donnée de départ verrouillée
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-400 font-medium">
              Double-cliquez ou tapez votre formule
            </div>
          </div>

          <div className="space-y-1">
            {editMode === 'bar' && formulaInput.startsWith('=') && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-lg text-[11px] font-bold shadow-xs animate-in fade-in slide-in-from-top-1">
                <PenTool className="w-3.5 h-3.5" />
                <span>Modification de formule : touchez une cellule pour l'insérer</span>
              </div>
            )}
            <ExcelFormulaBar
              ref={formulaBarRef}
              activeAddress={activeAddress}
              value={formulaInput}
              isEditing={editMode !== 'none'}
              onChange={val => {
                if (!isActiveCellTarget) {
                  toast.info(`La cellule ${activeAddress} est verrouillée en lecture seule.`);
                  return;
                }
                setFormulaInput(val);
                setEditMode('bar');
              }}
            onCommit={() => handleCommitValue(activeAddress, formulaInput)}
            onCancel={() => {
              setFormulaInput(cells[activeAddress]?.value || '');
              setEditMode('none');
            }}
            onOpenFunctions={() => {
              if (!isActiveCellTarget) {
                toast.info(`Sélectionnez d'abord une cellule cible modifiable (${config.target_cells?.join(', ') || 'D2'}) pour insérer une fonction.`);
                return;
              }
              setIsFunctionPickerOpen(true);
            }}
            onFocusInput={() => {
              if (!isActiveCellTarget) {
                toast.info(`La cellule ${activeAddress} est verrouillée en lecture seule.`);
              } else {
                setEditMode('bar');
              }
            }}
          />
          </div>
        </div>

        {/* The Spreadsheet Grid */}
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
          <ExcelGrid
            colsCount={config.grid_cols || 6}
            rowsCount={config.grid_rows || 20}
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
            onCancelEdit={() => {
              setFormulaInput(cells[activeAddress]?.value || '');
              setEditMode('none');
            }}
            onDeleteSelected={handleDeleteActiveCell}
          />
        </div>

        {/* Grid Toolbar Actions (Thumb-friendly buttons) */}
        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeleteActiveCell}
              disabled={!isActiveCellTarget}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              title="Effacer le contenu de la cellule active"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Effacer</span>
            </button>

            <button
              type="button"
              onClick={handleResetChallenge}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              title="Rétablir la grille aux données de départ"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réinitialiser</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            Moteur de calcul Excel local
          </div>
        </div>

        {/* Large Touch "Valider mon exercice" Primary Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onValidate(cells, config)}
            disabled={isValidating || isSaving}
            className={`w-full min-h-[50px] sm:min-h-[54px] px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-md transition-all duration-200 active:scale-[0.98] cursor-pointer ${
              isValidating || isSaving
                ? 'bg-emerald-700 text-white cursor-wait opacity-80'
                : validationResult?.passed
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-200'
            }`}
          >
            {isValidating || isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{isValidating ? 'Vérification des critères en cours...' : 'Enregistrement de votre progression...'}</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5 stroke-[2.5]" />
                <span>✓ Valider mon exercice</span>
              </>
            )}
          </button>
        </div>

        {/* Pedagogical Validation Results Feedback Box */}
        {validationResult && (
          <div
            className={`rounded-2xl p-4 sm:p-5 border transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
              validationResult.passed
                ? 'bg-emerald-50/90 border-emerald-200 shadow-xs'
                : 'bg-amber-50/90 border-amber-200'
            }`}
          >
            {/* Case 1: All criteria passed */}
            {validationResult.passed ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-black text-emerald-950 flex items-center gap-1.5">
                      <span>🎉 Défi Excel réussi !</span>
                    </h4>
                    <p className="text-xs text-emerald-800 font-medium">
                      ✓ {validationResult.passedCriteria}/{validationResult.totalCriteria} critère{validationResult.totalCriteria > 1 ? 's' : ''} validé{validationResult.totalCriteria > 1 ? 's' : ''} (100%)
                    </p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-emerald-900 font-semibold pl-1">
                  « Excellent travail ! Vos formules et résultats sont parfaitement conformes. »
                </p>

                {/* Criteria details */}
                {validationResult.results.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-emerald-200/80">
                    {validationResult.results.map((res, rIdx) => (
                      <div key={rIdx} className="flex items-start gap-2 text-xs sm:text-sm text-emerald-900">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{res.message || res.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Case 2: Partial or incomplete validation */
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-black text-amber-950">
                        🟠 Presque !
                      </h4>
                      <p className="text-xs text-amber-800 font-medium">
                        {validationResult.passedCriteria}/{validationResult.totalCriteria} critère{validationResult.totalCriteria > 1 ? 's' : ''} validé{validationResult.totalCriteria > 1 ? 's' : ''} ({validationResult.scorePercentage}%)
                      </p>
                    </div>
                  </div>
                </div>

                {/* List of tests with clear pedagogical feedback */}
                <div className="space-y-1.5 pt-2 border-t border-amber-200/80">
                  {validationResult.results.map((res, rIdx) => (
                    <div key={rIdx} className="flex items-start gap-2 text-xs sm:text-sm">
                      {res.passed ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="text-emerald-900 font-medium">{res.message || res.description}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <span className="text-rose-900 font-bold">{res.message || res.description}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Hint Section */}
      {exercise.hint && (
        <div className="bg-white rounded-3xl p-5 border border-amber-100 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Lightbulb className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-gray-900">
                Besoin d'un coup de pouce ?
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsHintOpen(prev => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
            >
              {isHintOpen ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Masquer l'indice</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Afficher l'indice</span>
                </>
              )}
            </button>
          </div>

          {isHintOpen && (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs sm:text-sm text-amber-900 whitespace-pre-line leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
              {exercise.hint}
            </div>
          )}
        </div>
      )}

      {/* 4. Function Picker Modal [fx] */}
      <ExcelFunctionPicker
        isOpen={isFunctionPickerOpen}
        onClose={() => setIsFunctionPickerOpen(false)}
        onSelectFunction={fnName => {
          setFormulaInput(`=${fnName}(`);
          setEditMode('bar');
          setIsFunctionPickerOpen(false);
          requestAnimationFrame(() => {
            formulaBarRef.current?.focus();
          });
        }}
      />
    </div>
  );
};
