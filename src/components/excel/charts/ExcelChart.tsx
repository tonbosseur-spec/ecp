import React, { useMemo } from 'react';
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
  Legend 
} from 'recharts';
import { Trash2, AlertCircle, BarChart3 } from 'lucide-react';
import { ExcelCellsMap } from '../../../lib/excel/excelTypes';
import { ExcelChartConfig } from './excelChartTypes';
import { parseRangeToChartData } from './excelChartUtils';

interface ExcelChartProps {
  config: ExcelChartConfig;
  cells: ExcelCellsMap;
  onDelete: (id: string) => void;
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

export const ExcelChart: React.FC<ExcelChartProps> = ({ config, cells, onDelete }) => {
  const parsed = useMemo(() => {
    return parseRangeToChartData(config.sourceRange, cells);
  }, [config.sourceRange, cells]);

  const chartTitle = config.title || (parsed.seriesKeys.length > 0 ? parsed.seriesKeys.join(' & ') : 'Graphique');

  // Format pie data
  const pieData = useMemo(() => {
    if (!parsed.isValid || parsed.rechartsData.length === 0 || parsed.seriesKeys.length === 0) return [];
    const mainKey = parsed.seriesKeys[0];
    return parsed.rechartsData.map((d) => ({
      name: String(d.name),
      value: typeof d[mainKey] === 'number' ? (d[mainKey] as number) : 0,
    }));
  }, [parsed]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col space-y-3">
      {/* Chart Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate">{chartTitle}</h4>
            <span className="text-[11px] font-mono text-slate-400">Source : {config.sourceRange}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDelete(config.id)}
          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
          title="Supprimer le graphique"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Chart Body */}
      {!parsed.isValid ? (
        <div className="h-56 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl text-slate-500 text-xs text-center gap-2 border border-dashed border-slate-200">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          <p className="max-w-xs">{parsed.errorMessage || 'Données invalides pour l\'affichage du graphique.'}</p>
        </div>
      ) : (
        <div className="w-full h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            {config.type === 'column' ? (
              <BarChart data={parsed.rechartsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} />
                {parsed.seriesKeys.length > 1 && <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />}
                {parsed.seriesKeys.map((key, idx) => (
                  <Bar key={key} dataKey={key} fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]} radius={[6, 6, 0, 0]} />
                ))}
              </BarChart>
            ) : config.type === 'line' ? (
              <LineChart data={parsed.rechartsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} />
                {parsed.seriesKeys.length > 1 && <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />}
                {parsed.seriesKeys.map((key, idx) => (
                  <Line 
                    key={key} 
                    type="monotone" 
                    dataKey={key} 
                    stroke={COLOR_PALETTE[idx % COLOR_PALETTE.length]} 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: COLOR_PALETTE[idx % COLOR_PALETTE.length] }} 
                  />
                ))}
              </LineChart>
            ) : config.type === 'bar' ? (
              <BarChart layout="vertical" data={parsed.rechartsData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} />
                {parsed.seriesKeys.length > 1 && <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />}
                {parsed.seriesKeys.map((key, idx) => (
                  <Bar key={key} dataKey={key} fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]} radius={[0, 6, 6, 0]} />
                ))}
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
