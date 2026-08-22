import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, LineChart, PieChart, BarChartHorizontal, X, AlertCircle } from 'lucide-react';
import { ExcelCellsMap } from '../../../lib/excel/excelTypes';
import { ExcelChartType, ExcelChartConfig } from './excelChartTypes';
import { parseRangeToChartData } from './excelChartUtils';

interface ExcelChartDialogProps {
  isOpen: boolean;
  selectedRangeAddress: string;
  cells: ExcelCellsMap;
  onClose: () => void;
  onCreateChart: (config: Omit<ExcelChartConfig, 'id'>) => void;
}

export const ExcelChartDialog: React.FC<ExcelChartDialogProps> = ({
  isOpen,
  selectedRangeAddress,
  cells,
  onClose,
  onCreateChart,
}) => {
  const [chartType, setChartType] = useState<ExcelChartType>('column');
  const [title, setTitle] = useState('');
  const [showLabels, setShowLabels] = useState(true);
  const [rangeInput, setRangeInput] = useState(selectedRangeAddress);

  useEffect(() => {
    if (isOpen) {
      setRangeInput(selectedRangeAddress);
      setTitle('');
      setShowLabels(true);
    }
  }, [isOpen, selectedRangeAddress]);

  const parsedData = useMemo(() => {
    return parseRangeToChartData(rangeInput, cells);
  }, [rangeInput, cells]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedData.isValid) return;

    onCreateChart({
      type: chartType,
      sourceRange: rangeInput.trim().toUpperCase(),
      title: title.trim() || undefined,
      showLabels,
    });
    onClose();
  };

  const chartOptions: { type: ExcelChartType; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      type: 'column',
      label: 'Colonnes',
      icon: <BarChart3 className="w-5 h-5" />,
      desc: 'Histogramme vertical'
    },
    {
      type: 'line',
      label: 'Courbe',
      icon: <LineChart className="w-5 h-5" />,
      desc: 'Évolution temporelle'
    },
    {
      type: 'bar',
      label: 'Barres',
      icon: <BarChartHorizontal className="w-5 h-5" />,
      desc: 'Histogramme horizontal'
    },
    {
      type: 'pie',
      label: 'Secteurs',
      icon: <PieChart className="w-5 h-5" />,
      desc: 'Répartition circulaire'
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Insérer un graphique</h3>
              <p className="text-xs text-slate-500">Transformez votre sélection Excel en visuel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto">
          {/* Source Range */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Plage sélectionnée
            </label>
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="ex: A1:B5"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white"
            />
          </div>

          {/* Validation Warning */}
          {!parsedData.isValid && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs leading-relaxed font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{parsedData.errorMessage}</span>
            </div>
          )}

          {/* Chart Types */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Type de graphique
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {chartOptions.map((opt) => {
                const isSelected = chartType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setChartType(opt.type)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-600/30 font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl mb-1.5 ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {opt.icon}
                    </div>
                    <span className="text-xs font-bold">{opt.label}</span>
                    <span className="text-[10px] text-slate-400 font-normal mt-0.5">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Titre du graphique <span className="font-normal text-slate-400 text-[11px]">(optionnel)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Ventes mensuelles"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white"
            />
          </div>

          {/* Show Labels Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800">Afficher les étiquettes</span>
              <span className="text-[11px] text-slate-500">Affiche les valeurs directes sur le graphique</span>
            </div>
            <button
              type="button"
              onClick={() => setShowLabels(!showLabels)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                showLabels ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  showLabels ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!parsedData.isValid}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Créer le graphique
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
