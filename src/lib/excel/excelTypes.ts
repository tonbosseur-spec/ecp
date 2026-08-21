export type CellValue = string | number | boolean | null;

export type ExcelErrorType = 
  | '#DIV/0!' 
  | '#REF!' 
  | '#VALUE!' 
  | '#NAME?' 
  | '#CIRCULAIRE!' 
  | '#N/A';

export interface CellCoordinate {
  col: number; // 0 = A, 1 = B, etc.
  row: number; // 0 = row 1, 1 = row 2, etc.
}

export interface CellRange {
  start: CellCoordinate;
  end: CellCoordinate;
}

export type CellValueType = 'number' | 'text' | 'boolean' | 'error' | 'empty' | 'formula';

export interface ExcelCellData {
  value: string; // The raw input string, e.g. "12500", "Pierre", "=SOMME(B2:B5)"
  computed?: CellValue | ExcelErrorType; // Calculated evaluated value (e.g. 5000, "Admis", "#DIV/0!")
  computedType?: CellValueType;
  error?: ExcelErrorType;
}

export type ExcelCellsMap = Record<string, ExcelCellData>;

export interface ExcelFunctionItem {
  name: string;
  syntax: string;
  category: 'Math' | 'Statistiques' | 'Logique' | 'Texte' | 'Recherche';
  description: string;
  example: string;
}

/**
 * Converts column index (0-based) to letter (0 -> 'A', 25 -> 'Z', 26 -> 'AA')
 */
export function indexToColName(colIdx: number): string {
  let colName = '';
  let index = colIdx;
  while (index >= 0) {
    colName = String.fromCharCode((index % 26) + 65) + colName;
    index = Math.floor(index / 26) - 1;
  }
  return colName;
}

/**
 * Converts column letter to 0-based index ('A' -> 0, 'B' -> 1, 'Z' -> 25)
 */
export function colNameToIndex(colName: string): number {
  let index = 0;
  const upper = colName.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Converts {col: 1, row: 1} to "B2"
 */
export function coordToAddress(coord: CellCoordinate): string {
  return `${indexToColName(coord.col)}${coord.row + 1}`;
}

/**
 * Converts "B2" to {col: 1, row: 1}
 */
export function addressToCoord(address: string): CellCoordinate | null {
  const match = address.trim().toUpperCase().match(/^([A-Z]+)([0-9]+)$/);
  if (!match) return null;
  const col = colNameToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1;
  if (isNaN(col) || isNaN(row) || col < 0 || row < 0) return null;
  return { col, row };
}

/**
 * Normalizes a range so start is top-left and end is bottom-right
 */
export function normalizeRange(range: CellRange): CellRange {
  const minCol = Math.min(range.start.col, range.end.col);
  const maxCol = Math.max(range.start.col, range.end.col);
  const minRow = Math.min(range.start.row, range.end.row);
  const maxRow = Math.max(range.start.row, range.end.row);
  return {
    start: { col: minCol, row: minRow },
    end: { col: maxCol, row: maxRow }
  };
}

/**
 * Checks if a coordinate is within a normalized range
 */
export function isCoordInRange(coord: CellCoordinate, range: CellRange): boolean {
  const norm = normalizeRange(range);
  return (
    coord.col >= norm.start.col &&
    coord.col <= norm.end.col &&
    coord.row >= norm.start.row &&
    coord.row <= norm.end.row
  );
}

/**
 * Formats range as string e.g. "B2:D6" or "B2" if 1x1
 */
export function rangeToAddress(range: CellRange): string {
  const norm = normalizeRange(range);
  const startAddr = coordToAddress(norm.start);
  const endAddr = coordToAddress(norm.end);
  if (startAddr === endAddr) return startAddr;
  return `${startAddr}:${endAddr}`;
}
