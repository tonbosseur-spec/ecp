import React from 'react';

interface ExcelRowHeaderProps {
  rowIndex: number;
  height: number;
  width?: number;
  isSelected: boolean;
  onSelectRow?: (rowIndex: number) => void;
}

export const ExcelRowHeader: React.FC<ExcelRowHeaderProps> = React.memo(({
  rowIndex,
  height,
  width = 40,
  isSelected,
  onSelectRow
}) => {
  const rowNumber = rowIndex + 1;

  return (
    <div
      onClick={() => onSelectRow && onSelectRow(rowIndex)}
      style={{
        height: `${height}px`,
        minHeight: `${height}px`,
        width: `${width}px`,
        minWidth: `${width}px`
      }}
      className={`select-none flex items-center justify-center font-mono text-xs font-bold border-b border-r border-slate-300 transition-colors cursor-pointer ${
        isSelected
          ? 'bg-emerald-600 text-white border-emerald-700 shadow-inner'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {rowNumber}
    </div>
  );
});
