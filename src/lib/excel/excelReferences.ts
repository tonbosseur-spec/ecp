import {
  CellCoordinate,
  CellRange,
  addressToCoord,
  coordToAddress,
  indexToColName,
  normalizeRange
} from './excelTypes';

/**
 * Expands a range address string (e.g. "A1:A5" or "B2:D3") into a list of cell addresses.
 * If given a single cell ("A1"), returns ["A1"].
 */
export function expandRange(rangeStr: string): string[] {
  const parts = rangeStr.trim().toUpperCase().split(':');
  if (parts.length === 1) {
    return [parts[0]];
  }

  const startCoord = addressToCoord(parts[0]);
  const endCoord = addressToCoord(parts[1]);

  if (!startCoord || !endCoord) {
    return [];
  }

  const norm = normalizeRange({ start: startCoord, end: endCoord });
  const result: string[] = [];

  for (let r = norm.start.row; r <= norm.end.row; r++) {
    for (let c = norm.start.col; c <= norm.end.col; c++) {
      result.push(coordToAddress({ col: c, row: r }));
    }
  }

  return result;
}

/**
 * Extracts all cell and range dependencies from a formula string.
 * Returns an array of individual cell addresses (A1, B2, etc.)
 */
export function extractDependenciesFromFormula(formula: string): string[] {
  if (!formula.startsWith('=')) return [];

  const rawExpr = formula.substring(1).toUpperCase();
  const dependencies = new Set<string>();

  // Match ranges first: e.g. A1:B5
  const rangeRegex = /\b([A-Z]+[0-9]+):([A-Z]+[0-9]+)\b/g;
  let match: RegExpExecArray | null;

  while ((match = rangeRegex.exec(rawExpr)) !== null) {
    const rangeCells = expandRange(match[0]);
    rangeCells.forEach((c) => dependencies.add(c));
  }

  // Remove range matches from expression to avoid matching single cells inside ranges twice
  const strippedExpr = rawExpr.replace(rangeRegex, '___RANGE___');

  // Match single cell references: e.g. A1, B10, AA2
  // Make sure not preceded or followed by identifier characters (e.g. not matching part of a function name)
  const cellRegex = /\b([A-Z]+[0-9]+)\b/g;
  while ((match = cellRegex.exec(strippedExpr)) !== null) {
    const addr = match[1];
    if (addressToCoord(addr) !== null) {
      dependencies.add(addr);
    }
  }

  return Array.from(dependencies);
}

/**
 * Shifts cell references in a formula by deltaCol and deltaRow (e.g. for drag-to-fill / copy-paste).
 * Example: "=B2*C2" shifted by (0, 1) -> "=B3*C3"
 */
export function offsetFormula(formula: string, deltaCol: number, deltaRow: number): string {
  if (!formula.startsWith('=')) return formula;

  // Replace ranges e.g. A1:B5
  let result = formula.replace(/\b([A-Z]+[0-9]+):([A-Z]+[0-9]+)\b/gi, (fullMatch, startAddr, endAddr) => {
    const startC = addressToCoord(startAddr);
    const endC = addressToCoord(endAddr);
    if (!startC || !endC) return fullMatch;

    const newStartC: CellCoordinate = {
      col: Math.max(0, startC.col + deltaCol),
      row: Math.max(0, startC.row + deltaRow)
    };
    const newEndC: CellCoordinate = {
      col: Math.max(0, endC.col + deltaCol),
      row: Math.max(0, endC.row + deltaRow)
    };

    return `${coordToAddress(newStartC)}:${coordToAddress(newEndC)}`;
  });

  // Replace single cells e.g. B2
  result = result.replace(/(^|[^A-Za-z0-9_:])([A-Za-z]+[0-9]+)(?![A-Za-z0-9_:]|\()/g, (fullMatch, prefix, addr) => {
    const coord = addressToCoord(addr);
    if (!coord) return fullMatch;

    const newCoord: CellCoordinate = {
      col: Math.max(0, coord.col + deltaCol),
      row: Math.max(0, coord.row + deltaRow)
    };

    return `${prefix}${coordToAddress(newCoord)}`;
  });

  return result;
}
