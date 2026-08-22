import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  LabelList
} from 'recharts';
import { Trash2, AlertCircle, BarChart3, Maximize2, X, Eye, EyeOff } from 'lucide-react';
import { ExcelCellsMap } from '../../../lib/excel/excelTypes';
import { ExcelChartConfig } from './excelChartTypes';
import { parseRangeToChartData } from './excelChartUtils';

interface ExcelChartProps {
  config: ExcelChartConfig;
  cells: ExcelCellsMap;
  onDelete: (id: string) => void;
  onToggleLabels?: (id: string) => void;
}

const COLOR_PALETTE = [
  '#059669', // Emerald
  '#2563eb', // Blue
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#e11d48', // Rose
  '#0284c7', // Cyan
  '#4f46e5', // Indigo
];

// Helper to format values on data labels cleanly
const formatLabelValue = (val: unknown): string => {
  if (typeof val === 'number') {
    if (Math.abs(val) >= 1_000_000) {
      return (val / 1_000_000).toFixed(1) + 'M';
    }
    if (Math.abs(val) >= 10_000) {
      return (val / 1_000).toFixed(1) + 'k';
    }
    return val.toLocaleString('fr-FR');
  }
  return String(val ?? '');
};

// Helper to format category ticks cleanly
const formatCategoryTick = (val: unknown, maxLen = 14): string => {
  const str = String(val ?? '');
  if (str.length > maxLen) {
    return str.substring(0, maxLen - 1) + '…';
  }
  return str;
};

export const ExcelChart: React.FC<ExcelChartProps> = ({
  config,
  cells,
  onDelete,
  onToggleLabels,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localShowLabels, setLocalShowLabels] = useState<boolean>(config.showLabels ?? true);

  const showLabels = config.showLabels !== undefined ? config.showLabels : localShowLabels;

  const handleToggleLabels = () => {
    setLocalShowLabels((prev) => !prev);
    if (onToggleLabels) {
      onToggleLabels(config.id);
    }
  };

  const parsed = useMemo(() => {
    return parseRangeToChartData(config.sourceRange, cells);
  }, [config.sourceRange, cells]);

  const chartTitle = config.title || (parsed.seriesKeys.length > 0 ? parsed.seriesKeys.join(' & ') : 'Graphique');

  // Determine if X-axis category tick labels are long or numerous
  const { hasLongCategories, needsRotation } = useMemo(() => {
    if (!parsed.isValid || !parsed.rechartsData.length) return { hasLongCategories: false, needsRotation: false };
    const longCat = parsed.rechartsData.some((d) => String(d.name || '').length > 10);
    const count = parsed.rechartsData.length;
    return {
      hasLongCategories: longCat,
      needsRotation: longCat || count > 4,
    };
  }, [parsed]);

  // Format pie data
  const pieData = useMemo(() => {
    if (!parsed.isValid || parsed.rechartsData.length === 0 || parsed.seriesKeys.length === 0) return [];
    const mainKey = parsed.seriesKeys[0];
    return parsed.rechartsData.map((d) => ({
      name: String(d.name),
      value: typeof d[mainKey] === 'number' ? (d[mainKey] as number) : 0,
    }));
  }, [parsed]);

  // Render chart content dynamically for normal card or fullscreen
  const renderChartContent = (isFS: boolean) => {
    if (!parsed.isValid) {
      return (
        <div className="h-56 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl text-slate-500 text-xs text-center gap-2 border border-dashed border-slate-200">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          <p className="max-w-xs">{parsed.errorMessage || 'Données invalides pour l\'affichage du graphique.'}</p>
        </div>
      );
    }

    const minHeight = isFS ? 350 : 260;

    return (
      <div className={isFS ? "w-full h-full min-h-[350px] relative flex-1" : "w-full h-[270px] sm:h-[300px] min-h-[260px] relative"}>
        <ResponsiveContainer width="100%" height="100%" minHeight={minHeight}>
          {config.type === 'column' ? (
            <BarChart 
              data={parsed.rechartsData} 
              margin={{ top: showLabels ? 24 : 10, right: 15, left: -10, bottom: needsRotation ? 30 : 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: isFS ? 12 : 10, fill: '#64748b' }} 
                axisLine={false} 
                tickLine={false}
                interval={0}
                angle={needsRotation ? -25 : 0}
                textAnchor={needsRotation ? 'end' : 'middle'}
                height={needsRotation ? 45 : 30}
                tickFormatter={(val) => formatCategoryTick(val, isFS ? 18 : 12)}
              />
              <YAxis 
                tick={{ fontSize: isFS ? 12 : 10, fill: '#64748b' }} 
                axisLine={false} 
                tickLine={false}
                width={40}
                tickFormatter={(val) => formatLabelValue(val)}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} 
                formatter={(val) => [formatLabelValue(val), '']}
              />
              {parsed.seriesKeys.length > 1 && <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }} iconSize={10} />}
              {parsed.seriesKeys.map((key, idx) => (
                <Bar key={key} dataKey={key} fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]} radius={[6, 6, 0, 0]}>
                  {showLabels && (
                    <LabelList 
                      dataKey={key} 
                      position="top" 
                      fill="#334155" 
                      fontSize={isFS ? 12 : 10} 
                      fontWeight={600} 
                      formatter={formatLabelValue} 
                    />
                  )}
                </Bar>
              ))}
            </BarChart>
          ) : config.type === 'line' ? (
            <LineChart 
              data={parsed.rechartsData} 
              margin={{ top: showLabels ? 24 : 10, right: 15, left: -10, bottom: needsRotation ? 30 : 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: isFS ? 12 : 10, fill: '#64748b' }} 
                axisLine={false} 
                tickLine={false}
                interval={0}
                angle={needsRotation ? -25 : 0}
                textAnchor={needsRotation ? 'end' : 'middle'}
                height={needsRotation ? 45 : 30}
                tickFormatter={(val) => formatCategoryTick(val, isFS ? 18 : 12)}
              />
              <YAxis 
                tick={{ fontSize: isFS ? 12 : 10, fill: '#64748b' }} 
                axisLine={false} 
                tickLine={false}
                width={40}
                tickFormatter={(val) => formatLabelValue(val)}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} 
                formatter={(val) => [formatLabelValue(val), '']}
              />
              {parsed.seriesKeys.length > 1 && <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }} iconSize={10} />}
              {parsed.seriesKeys.map((key, idx) => (
                <Line 
                  key={key} 
                  type="monotone" 
                  dataKey={key} 
                  stroke={COLOR_PALETTE[idx % COLOR_PALETTE.length]} 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: COLOR_PALETTE[idx % COLOR_PALETTE.length] }} 
                >
                  {showLabels && (
                    <LabelList 
                      dataKey={key} 
                      position="top" 
                      fill="#334155" 
                      fontSize={isFS ? 12 : 10} 
                      fontWeight={600} 
                      formatter={formatLabelValue} 
                    />
                  )}
                </Line>
              ))}
            </LineChart>
          ) : config.type === 'bar' ? (
            <BarChart 
              layout="vertical" 
              data={parsed.rechartsData} 
              margin={{ top: 10, right: showLabels ? 40 : 15, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis 
                type="number" 
                tick={{ fontSize: isFS ? 12 : 10, fill: '#64748b' }} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(val) => formatLabelValue(val)}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fontSize: isFS ? 12 : 10, fill: '#64748b' }} 
                axisLine={false} 
                tickLine={false} 
                width={isFS ? 100 : 75}
                tickFormatter={(val) => formatCategoryTick(val, isFS ? 16 : 10)}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} 
                formatter={(val) => [formatLabelValue(val), '']}
              />
              {parsed.seriesKeys.length > 1 && <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }} iconSize={10} />}
              {parsed.seriesKeys.map((key, idx) => (
                <Bar key={key} dataKey={key} fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]} radius={[0, 6, 6, 0]}>
                  {showLabels && (
                    <LabelList 
                      dataKey={key} 
                      position="right" 
                      fill="#334155" 
                      fontSize={isFS ? 12 : 10} 
                      fontWeight={600} 
                      formatter={formatLabelValue} 
                    />
                  )}
                </Bar>
              ))}
            </BarChart>
          ) : (
            <PieChart margin={{ top: 15, right: 15, left: 15, bottom: 15 }}>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={isFS ? "65%" : "55%"}
                innerRadius={0}
                paddingAngle={2}
                label={
                  showLabels
                    ? ({ name, percent }) => {
                        const pct = ((percent || 0) * 100).toFixed(0);
                        const nameStr = formatCategoryTick(name, isFS ? 12 : 8);
                        return `${nameStr} (${pct}%)`;
                      }
                    : false
                }
                labelLine={showLabels}
              >
                {pieData.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} 
                formatter={(val) => [formatLabelValue(val), '']}
              />
              <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }} iconSize={10} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <>
      {/* Chart Card in Grid */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col space-y-3">
        {/* Card Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-900 truncate" title={chartTitle}>
                {chartTitle}
              </h4>
              <span className="text-[11px] font-mono text-slate-400">Source : {config.sourceRange}</span>
            </div>
          </div>
        </div>

        {/* Card Chart Body */}
        {renderChartContent(false)}

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1.5">
          {/* Label Toggle Button */}
          <button
            type="button"
            onClick={handleToggleLabels}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer touch-manipulation min-h-[38px] ${
              showLabels
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title={showLabels ? "Masquer les étiquettes" : "Afficher les étiquettes"}
          >
            {showLabels ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
            <span className="hidden xs:inline">Étiquettes</span>
            <span className="text-[10px] font-mono opacity-80">{showLabels ? '[On]' : '[Off]'}</span>
          </button>

          <div className="flex items-center gap-1.5">
            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer touch-manipulation min-h-[38px]"
              title="Plein écran"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
              <span>⛶ Plein écran</span>
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={() => onDelete(config.id)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0 active:scale-95 cursor-pointer touch-manipulation min-h-[38px] min-w-[38px] flex items-center justify-center"
              title="Supprimer le graphique"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal Overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-2 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full h-full max-w-6xl max-h-[96vh] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col p-4 sm:p-6 overflow-hidden space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 break-words line-clamp-1">
                    {chartTitle}
                  </h3>
                  <span className="text-xs font-mono text-slate-400">Source : {config.sourceRange}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
              >
                <X className="w-4 h-4" />
                <span>✕ Fermer</span>
              </button>
            </div>

            {/* Modal Chart Body */}
            <div className="flex-1 w-full h-full min-h-[300px] overflow-hidden flex flex-col">
              {renderChartContent(true)}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
              <button
                type="button"
                onClick={handleToggleLabels}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 cursor-pointer touch-manipulation min-h-[40px] ${
                  showLabels
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {showLabels ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                <span>Étiquettes de données {showLabels ? '[Affichées]' : '[Masquées]'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
