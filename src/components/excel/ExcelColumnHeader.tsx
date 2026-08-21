import React from 'react';
import { indexToColName } from '../../lib/excel/excelTypes';

interface ExcelColumnHeaderProps {
  colIndex: number;
  width: number;
  isSelected: boolean;
  onSelectColumn?: (colIndex: number) => void;
}

export const ExcelColumnHeader: React.FC<ExcelColumnHeaderProps> = React.memo(({
  colIndex,
  width,
  isSelected,
  onSelectColumn
}) => {
  const colLetter = indexToColName(colIndex);

  return (
    <div
      onClick={() => onSelectColumn && onSelectColumn(colIndex)}
      style={{ width: `${width}px`, minWidth: `${width}px` }}
      className={`h-7 select-none flex items-center justify-center font-mono text-xs font-bold border-r border-b border-slate-300 transition-colors cursor-pointer ${
        isSelected
          ? 'bg-emerald-600 text-white border-emerald-700 shadow-inner'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {colLetter}
    </div>
  );
});
