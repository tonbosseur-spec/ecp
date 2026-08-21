import React, { useState, useCallback, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Table, 
  Check, 
  Lightbulb, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Target, 
  Sliders, 
  HelpCircle,
  FileSpreadsheet,
  Layers,
  Info
} from 'lucide-react';
import { 
  ExcelChallengeConfig, 
  ExcelCorrectionCriterion, 
  ExcelCorrectionCriterionType, 
  EXCEL_PRESET_TEMPLATES, 
  DEFAULT_EXCEL_CHALLENGE_CONFIG 
} from '../../lib/excel/excelChallengeTypes';
import { 
  CellCoordinate, 
  CellRange, 
  ExcelCellsMap, 
  coordToAddress, 
  addressToCoord, 
  rangeToAddress 
} from '../../lib/excel/excelTypes';
import { ExcelEngine } from '../../lib/excel/excelEngine';
import { ExcelGrid } from './ExcelGrid';
import { ExcelFormulaBar } from './ExcelFormulaBar';
import { ExcelFunctionPicker } from './ExcelFunctionPicker';

interface AdminExcelChallengeBuilderProps {
  exerciseIndex?: number;
  config: ExcelChallengeConfig;
  onChange?: (updatedConfig: ExcelChallengeConfig) => void;
  onUpdateConfig?: (updatedConfig: ExcelChallengeConfig) => void;
  // Common exercise fields
  title: string;
  instructions: string;
  hint: string;
  aiAssistanceEnabled: boolean;
  onUpdateTitle: (title: string) => void;
  onUpdateInstructions: (instructions: string) => void;
  onUpdateHint: (hint: string) => void;
  onUpdateAiAssistance: (enabled: boolean) => void;
  showPreview?: boolean;
  onTogglePreview?: () => void;
}

export const AdminExcelChallengeBuilder: React.FC<AdminExcelChallengeBuilderProps> = ({
  exerciseIndex,
  config,
  onChange,
  onUpdateConfig,
  title,
  instructions,
  hint,
  aiAssistanceEnabled,
  onUpdateTitle,
  onUpdateInstructions,
  onUpdateHint,
  onUpdateAiAssistance,
  showPreview = false,
  onTogglePreview
}) => {
  const notifyConfigChange = useCallback((updated: ExcelChallengeConfig) => {
    if (onUpdateConfig) onUpdateConfig(updated);
    if (onChange) onChange(updated);
  }, [onUpdateConfig, onChange]);
  // Grid state for admin editing
  const colsCount = config.grid_cols || 6;
  const rowsCount = config.grid_rows || 20;

  // Active cell in editor
  const [activeCoord, setActiveCoord] = useState<CellCoordinate>({ col: 0, row: 0 });
  const [selectionRange, setSelectionRange] = useState<CellRange>({
    start: { col: 0, row: 0 },
    end: { col: 0, row: 0 }
  });
  const [isEditing, setIsEditing] = useState(false);
  const [formulaInput, setFormulaInput] = useState('');
  const [isFunctionPickerOpen, setIsFunctionPickerOpen] = useState(false);

  // Recomputed cells map
  const computedCells = useMemo(() => {
    return ExcelEngine.recomputeAll(config.initial_data || {});
  }, [config.initial_data]);

  const activeAddress = useMemo(() => coordToAddress(activeCoord), [activeCoord]);

  // Select cell handler
  const handleSelectCell = useCallback((coord: CellCoordinate, extendRange: boolean = false) => {
    setActiveCoord(coord);
    const addr = coordToAddress(coord);
    const cellVal = config.initial_data[addr]?.value || '';
    setFormulaInput(cellVal);
    setIsEditing(false);

    if (extendRange) {
      setSelectionRange(prev => ({ start: prev.start, end: coord }));
    } else {
      setSelectionRange({ start: coord, end: coord });
    }
  }, [config.initial_data]);

  const handleUpdateRange = useCallback((range: CellRange) => {
    setSelectionRange(range);
    setActiveCoord(range.start);
    const addr = coordToAddress(range.start);
    setFormulaInput(config.initial_data[addr]?.value || '');
  }, [config.initial_data]);

  const handleStartEdit = useCallback((address: string) => {
    const coord = addressToCoord(address);
    if (coord) {
      setActiveCoord(coord);
      setSelectionRange({ start: coord, end: coord });
    }
    setIsEditing(true);
    setFormulaInput(config.initial_data[address]?.value || '');
  }, [config.initial_data]);

  // Commit value in cell and update config
  const handleCommitValue = useCallback((targetAddress: string, newValue: string) => {
    const updatedMap = ExcelEngine.updateCellAndRecompute(config.initial_data || {}, targetAddress, newValue);
    // Remove empty cell entries to keep storage clean
    const cleanedMap: ExcelCellsMap = {};
    Object.entries(updatedMap).forEach(([addr, cell]) => {
      if (cell.value && cell.value.trim() !== '') {
        cleanedMap[addr] = { value: cell.value };
      }
    });

    notifyConfigChange({
      ...config,
      initial_data: cleanedMap
    });

    setFormulaInput(newValue);
    setIsEditing(false);
  }, [config, notifyConfigChange]);

  const handleDeleteSelected = useCallback(() => {
    handleCommitValue(activeAddress, '');
  }, [activeAddress, handleCommitValue]);

  // Apply template
  const handleApplyTemplate = (template: typeof EXCEL_PRESET_TEMPLATES[0]) => {
    if (window.confirm(`Appliquer le modèle « ${template.name} » ?\nCela écrasera la grille actuelle.`)) {
      onUpdateTitle(template.title);
      onUpdateInstructions(template.instructions);
      onUpdateHint(template.hint);
      notifyConfigChange(template.config);
      setFormulaInput('');
    }
  };

  // Add / Remove Target Cell
  const handleToggleTargetCell = (addr: string) => {
    const currentTargets = config.target_cells || [];
    const normalized = addr.toUpperCase().trim();
    if (!normalized) return;

    if (currentTargets.includes(normalized)) {
      notifyConfigChange({
        ...config,
        target_cells: currentTargets.filter(c => c !== normalized)
      });
    } else {
      notifyConfigChange({
        ...config,
        target_cells: [...currentTargets, normalized]
      });
    }
  };

  // Add a new criterion
  const handleAddCriterion = () => {
    const newCrit: ExcelCorrectionCriterion = {
      id: `crit-${Date.now()}`,
      type: 'value',
      cell: activeAddress || 'D2',
      expected: '',
      description: `La cellule ${activeAddress || 'D2'} a la valeur attendue`,
      required: true
    };
    notifyConfigChange({
      ...config,
      criteria: [...(config.criteria || []), newCrit]
    });
  };

  const handleUpdateCriterion = (critIndex: number, field: keyof ExcelCorrectionCriterion, val: any) => {
    const copy = [...(config.criteria || [])];
    copy[critIndex] = { ...copy[critIndex], [field]: val };
    notifyConfigChange({
      ...config,
      criteria: copy
    });
  };

  const handleRemoveCriterion = (critIndex: number) => {
    const filtered = (config.criteria || []).filter((_, idx) => idx !== critIndex);
    notifyConfigChange({
      ...config,
      criteria: filtered
    });
  };

  // =========================================================================
  // PREVIEW MODE (STUDENT PERSPECTIVE)
  // =========================================================================
  if (showPreview) {
    return (
      <div className="bg-slate-900 text-slate-100 rounded-3xl p-5 sm:p-7 border border-slate-800 space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            👁 Aperçu étudiant - Défi Excel
          </span>
          <span className="text-[11px] text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
            Les critères de notation sont masqués pour l'étudiant
          </span>
        </div>

        {/* Title & Instructions */}
        <div className="space-y-2">
          <h4 className="text-lg font-black text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            {title || 'Titre du défi Excel'}
          </h4>
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line bg-slate-800/60 p-4 rounded-2xl border border-slate-800">
            {instructions || 'Aucune consigne rédigée pour le moment.'}
          </div>
        </div>

        {/* Target Cells Notice */}
        <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/40 p-3 rounded-2xl border border-emerald-800/50">
          <Target className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Cellules à compléter : <strong className="text-white font-mono">{(config.target_cells || []).join(', ') || 'Aucune'}</strong>
          </span>
        </div>

        {/* Interactive Formula Bar & Grid */}
        <div className="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
          <ExcelFormulaBar
            activeAddress={activeAddress}
            value={formulaInput}
            isEditing={isEditing}
            onChange={setFormulaInput}
            onCommit={() => handleCommitValue(activeAddress, formulaInput)}
            onCancel={() => {
              setIsEditing(false);
              setFormulaInput(config.initial_data[activeAddress]?.value || '');
            }}
            onOpenFunctions={() => setIsFunctionPickerOpen(true)}
            onFocusInput={() => setIsEditing(true)}
          />

          <div className="rounded-xl overflow-hidden border border-slate-800">
            <ExcelGrid
              colsCount={colsCount}
              rowsCount={rowsCount}
              cells={computedCells}
              activeCoord={activeCoord}
              selectionRange={selectionRange}
              isEditing={isEditing}
              onSelectCell={handleSelectCell}
              onUpdateRange={handleUpdateRange}
              onStartEdit={handleStartEdit}
              onCommitEdit={handleCommitValue}
              onCancelEdit={() => setIsEditing(false)}
              onDeleteSelected={handleDeleteSelected}
            />
          </div>
        </div>

        {/* Hint if provided */}
        {hint && (
          <div className="p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-2xl text-amber-200 text-xs flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-extrabold uppercase text-[10px] text-amber-400 block tracking-wider">Indice</span>
              <p className="mt-0.5">{hint}</p>
            </div>
          </div>
        )}

        {/* Simulated validation CTA */}
        <div className="pt-2 flex items-center justify-end">
          <button
            type="button"
            disabled
            className="px-6 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed opacity-80 shadow-md shadow-emerald-950"
          >
            <Check className="w-4 h-4" />
            <span>✓ Valider ma formule (Simulation)</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // EDIT MODE (ADMIN FORM)
  // =========================================================================
  return (
    <div className="space-y-6">
      
      {/* 1. Presets & Quick Templates Bar */}
      <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Modèles rapides de défis Excel
          </span>
          <span className="text-[11px] text-emerald-700 font-medium">Pré-remplir la grille & les critères</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {EXCEL_PRESET_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleApplyTemplate(tpl)}
              className="px-3 py-1.5 bg-white hover:bg-emerald-100/80 text-emerald-900 border border-emerald-300/80 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Table className="w-3.5 h-3.5 text-emerald-600" />
              <span>{tpl.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Exercise Title & Instructions */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Titre du défi Excel <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => onUpdateTitle(e.target.value)}
            placeholder="Exemple : Calculer le total et la moyenne des ventes"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm font-semibold text-gray-900 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Consigne pédagogique <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={instructions}
            onChange={e => onUpdateInstructions(e.target.value)}
            rows={3}
            placeholder="Ex: Dans la cellule D5, utilisez la formule =SOMME(D2:D4) pour calculer le montant total des ventes."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm font-medium transition-all resize-y leading-relaxed"
          />
        </div>
      </div>

      {/* 3. Interactive Initial Grid Setup */}
      <div className="space-y-3 pt-2 border-t border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Table className="w-4 h-4 text-emerald-600" />
              <span>Grille Excel Initiale & Données de départ</span>
            </label>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Cliquez sur les cellules pour entrer les en-têtes, étiquettes ou nombres.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleToggleTargetCell(activeAddress)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                (config.target_cells || []).includes(activeAddress)
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
              title="Définit la cellule sélectionnée comme cellule cible que l'étudiant doit compléter"
            >
              <Target className="w-3.5 h-3.5" />
              <span>
                {(config.target_cells || []).includes(activeAddress)
                  ? `✓ ${activeAddress} est cible`
                  : `+ Définir ${activeAddress} comme cible`}
              </span>
            </button>
          </div>
        </div>

        {/* Formula Bar & Grid Container */}
        <div className="p-3 bg-gray-50/80 rounded-2xl border border-gray-200 space-y-2">
          <ExcelFormulaBar
            activeAddress={activeAddress}
            value={formulaInput}
            isEditing={isEditing}
            onChange={setFormulaInput}
            onCommit={() => handleCommitValue(activeAddress, formulaInput)}
            onCancel={() => {
              setIsEditing(false);
              setFormulaInput(config.initial_data[activeAddress]?.value || '');
            }}
            onOpenFunctions={() => setIsFunctionPickerOpen(true)}
            onFocusInput={() => setIsEditing(true)}
          />

          <div className="rounded-xl overflow-hidden border border-gray-300 bg-white shadow-2xs">
            <ExcelGrid
              colsCount={colsCount}
              rowsCount={rowsCount}
              cells={computedCells}
              activeCoord={activeCoord}
              selectionRange={selectionRange}
              isEditing={isEditing}
              onSelectCell={handleSelectCell}
              onUpdateRange={handleUpdateRange}
              onStartEdit={handleStartEdit}
              onCommitEdit={handleCommitValue}
              onCancelEdit={() => setIsEditing(false)}
              onDeleteSelected={handleDeleteSelected}
            />
          </div>
        </div>

        {/* Target Cells Summary Chips */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-emerald-600" />
            Cellules cibles (à compléter par l'élève) :
          </span>
          {(config.target_cells || []).length === 0 ? (
            <span className="text-xs text-amber-600 font-medium">
              Aucune cellule cible définie. Cliquez sur une cellule puis sur « Définir comme cible ».
            </span>
          ) : (
            (config.target_cells || []).map(cellAddr => (
              <span
                key={cellAddr}
                className="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5"
              >
                <span>{cellAddr}</span>
                <button
                  type="button"
                  onClick={() => handleToggleTargetCell(cellAddr)}
                  className="hover:text-rose-600 cursor-pointer"
                  title="Retirer cette cellule cible"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* 4. Hint & Gemini Assistance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Indice pédagogique
          </label>
          <input
            type="text"
            value={hint}
            onChange={e => onUpdateHint(e.target.value)}
            placeholder="Ex: Pensez à la formule =SOMME(D2:D4)"
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Assistance IA Gemini
          </label>
          <label className="flex items-center gap-3 p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors min-h-[42px]">
            <input
              type="checkbox"
              checked={aiAssistanceEnabled}
              onChange={e => onUpdateAiAssistance(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-emerald-950">
              Autoriser Gemini à guider l'élève sur la formule Excel
            </span>
          </label>
        </div>
      </div>

      {/* 5. Correction Criteria Builder */}
      <div className="pt-3 border-t border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Règles de validation & Critères de correction ({(config.criteria || []).length})</span>
            </label>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Définissez les conditions automatiques que la formule ou la valeur de l'élève doit respecter.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddCriterion}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Ajouter un critère</span>
          </button>
        </div>

        {/* Criteria List */}
        {(config.criteria || []).length === 0 ? (
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-center space-y-2">
            <p className="text-xs text-amber-800 font-bold">Aucun critère de validation configuré</p>
            <p className="text-[11px] text-amber-700">
              Ajoutez au moins un critère de vérification (valeur calculée, formule ou fonction requise).
            </p>
            <button
              type="button"
              onClick={handleAddCriterion}
              className="mt-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter un premier critère</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {(config.criteria || []).map((crit, critIdx) => (
              <div
                key={crit.id || critIdx}
                className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                      Critère #{critIdx + 1}
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-700">
                      Cellule : {crit.cell || 'Non définie'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveCriterion(critIdx)}
                    className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Supprimer ce critère"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Type */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Type de vérification
                    </label>
                    <select
                      value={crit.type}
                      onChange={e => handleUpdateCriterion(critIdx, 'type', e.target.value as ExcelCorrectionCriterionType)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="value">Valeur calculée exacte</option>
                      <option value="formula">Formule exacte</option>
                      <option value="required_function">Fonction requise (ex: SOMME)</option>
                      <option value="forbidden_function">Fonction interdite</option>
                    </select>
                  </div>

                  {/* Target Cell */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Cellule à tester <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={crit.cell}
                      onChange={e => handleUpdateCriterion(critIdx, 'cell', e.target.value.toUpperCase())}
                      placeholder="Ex: D5"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Expected Value / Function / Formula */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      {crit.type === 'value' && 'Valeur attendue (ex: 385)'}
                      {crit.type === 'formula' && 'Formule attendue (ex: =SOMME(D2:D4))'}
                      {crit.type === 'required_function' && 'Nom de la fonction (ex: SOMME)'}
                      {crit.type === 'forbidden_function' && 'Nom interdit'}
                    </label>
                    {crit.type === 'value' && (
                      <input
                        type="text"
                        value={String(crit.expected ?? '')}
                        onChange={e => handleUpdateCriterion(critIdx, 'expected', e.target.value)}
                        placeholder="Ex: 385 ou Admis"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                      />
                    )}
                    {crit.type === 'formula' && (
                      <input
                        type="text"
                        value={crit.expected_formula ?? ''}
                        onChange={e => handleUpdateCriterion(critIdx, 'expected_formula', e.target.value)}
                        placeholder="=SOMME(D2:D4)"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                      />
                    )}
                    {(crit.type === 'required_function' || crit.type === 'forbidden_function') && (
                      <input
                        type="text"
                        value={crit.function_name ?? ''}
                        onChange={e => handleUpdateCriterion(critIdx, 'function_name', e.target.value.toUpperCase())}
                        placeholder="SOMME"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-emerald-500"
                      />
                    )}
                  </div>
                </div>

                {/* Description for Student */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Description du test pour l'étudiant
                  </label>
                  <input
                    type="text"
                    value={crit.description}
                    onChange={e => handleUpdateCriterion(critIdx, 'description', e.target.value)}
                    placeholder="Ex: Le total général en D5 est correctement calculé avec la fonction SOMME"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Function Picker Modal */}
      <ExcelFunctionPicker
        isOpen={isFunctionPickerOpen}
        onClose={() => setIsFunctionPickerOpen(false)}
        onSelectFunction={fnName => {
          setFormulaInput(`=${fnName}(`);
          setIsEditing(true);
          setIsFunctionPickerOpen(false);
        }}
      />
    </div>
  );
};
