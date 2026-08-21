import { ExcelCellsMap, addressToCoord, coordToAddress, normalizeRange } from '../../../lib/excel/excelTypes';
import { isExcelError } from '../../../lib/excel/excelFunctions';
import { ExcelChartParsedData } from './excelChartTypes';

/**
 * Helper to get evaluated primitive value of a cell
 */
function getCellDisplayPrimitive(cells: ExcelCellsMap, address: string): { raw: string; num: number | null; isNumeric: boolean } {
  const cell = cells[address];
  if (!cell) {
    return { raw: '', num: null, isNumeric: false };
  }

  const val = cell.computed !== undefined ? String(cell.computed) : (cell.value || '');
  
  if (!val || isExcelError(val) || val.startsWith('#')) {
    return { raw: val, num: null, isNumeric: false };
  }

  const trimmed = val.trim();
  // Handle French decimal commas e.g. "120,5" -> "120.5"
  const normalizedNumStr = trimmed.replace(',', '.');
  const parsed = Number(normalizedNumStr);

  if (!isNaN(parsed) && trimmed !== '') {
    return { raw: trimmed, num: parsed, isNumeric: true };
  }

  return { raw: trimmed, num: null, isNumeric: false };
}

/**
 * Parses an Excel range string (e.g. "A1:B5" or "A1") and transforms cell values into chart structures.
 */
export function parseRangeToChartData(sourceRange: string, cells: ExcelCellsMap): ExcelChartParsedData {
  const trimmedRange = sourceRange.trim().toUpperCase();
  if (!trimmedRange) {
    return {
      categories: [],
      series: [],
      rechartsData: [],
      seriesKeys: [],
      isValid: false,
      errorMessage: "Impossible de créer le graphique : sélectionnez une plage contenant des données."
    };
  }

  let startAddr = trimmedRange;
  let endAddr = trimmedRange;

  if (trimmedRange.includes(':')) {
    const parts = trimmedRange.split(':');
    startAddr = parts[0];
    endAddr = parts[1];
  }

  const startCoord = addressToCoord(startAddr);
  const endCoord = addressToCoord(endAddr);

  if (!startCoord || !endCoord) {
    return {
      categories: [],
      series: [],
      rechartsData: [],
      seriesKeys: [],
      isValid: false,
      errorMessage: "La plage sélectionnée est invalide."
    };
  }

  const norm = normalizeRange({ start: startCoord, end: endCoord });
  const minCol = norm.start.col;
  const maxCol = norm.end.col;
  const minRow = norm.start.row;
  const maxRow = norm.end.row;

  const totalCols = maxCol - minCol + 1;
  const totalRows = maxRow - minRow + 1;

  // Check if range contains any data at all
  let hasAnyData = false;
  for (let c = minCol; c <= maxCol; c++) {
    for (let r = minRow; r <= maxRow; r++) {
      const addr = coordToAddress({ col: c, row: r });
      if (cells[addr] && cells[addr].value && cells[addr].value.trim() !== '') {
        hasAnyData = true;
        break;
      }
    }
    if (hasAnyData) break;
  }

  if (!hasAnyData) {
    return {
      categories: [],
      series: [],
      rechartsData: [],
      seriesKeys: [],
      isValid: false,
      errorMessage: "Impossible de créer le graphique : sélectionnez une plage contenant des données."
    };
  }

  // Determine if header row and/or category column exist
  // Standard vertical table assumption:
  // Col minCol = categories (or category header at minRow)
  // Cols minCol+1..maxCol = numeric series
  let hasHeaderRow = false;

  if (totalRows > 1 && totalCols > 1) {
    // Look at cell (minCol + 1, minRow)
    const topSeriesCell = getCellDisplayPrimitive(cells, coordToAddress({ col: minCol + 1, row: minRow }));
    // If the top cell of the second column is non-numeric (e.g. "Ventes", "2025" as string header), row minRow is a header row
    if (!topSeriesCell.isNumeric) {
      hasHeaderRow = true;
    }
  } else if (totalRows > 1 && totalCols === 1) {
    // Single column range (e.g. B1:B5)
    const firstCell = getCellDisplayPrimitive(cells, coordToAddress({ col: minCol, row: minRow }));
    if (!firstCell.isNumeric) {
      hasHeaderRow = true;
    }
  }

  const startDataRow = hasHeaderRow ? minRow + 1 : minRow;

  const categories: string[] = [];
  const seriesKeys: string[] = [];
  const rechartsData: Record<string, string | number>[] = [];

  let totalNumericCount = 0;

  if (totalCols === 1) {
    // Single column case: Category = Row label, Series 1 = Column name or "Valeurs"
    const seriesName = hasHeaderRow 
      ? (getCellDisplayPrimitive(cells, coordToAddress({ col: minCol, row: minRow })).raw || "Valeurs")
      : "Valeurs";
    seriesKeys.push(seriesName);

    for (let r = startDataRow; r <= maxRow; r++) {
      const addr = coordToAddress({ col: minCol, row: r });
      const prim = getCellDisplayPrimitive(cells, addr);
      const catName = `Ligne ${r + 1}`;
      categories.push(catName);

      const val = prim.num !== null ? prim.num : 0;
      if (prim.isNumeric) totalNumericCount++;

      rechartsData.push({
        name: catName,
        [seriesName]: val
      });
    }
  } else if (totalRows === 1) {
    // Single row case (e.g. A2:D2)
    // Categories = Column names (A, B, C...), Series 1 = "Série 1"
    const seriesName = "Série 1";
    seriesKeys.push(seriesName);

    for (let c = minCol; c <= maxCol; c++) {
      const addr = coordToAddress({ col: c, row: minRow });
      const prim = getCellDisplayPrimitive(cells, addr);
      const catName = coordToAddress({ col: c, row: minRow });
      categories.push(catName);

      const val = prim.num !== null ? prim.num : 0;
      if (prim.isNumeric) totalNumericCount++;

      rechartsData.push({
        name: catName,
        [seriesName]: val
      });
    }
  } else {
    // Multi-row, multi-column case (e.g. A1:B5, A1:C4)
    // Col minCol = category labels
    // Cols minCol + 1 to maxCol = series
    for (let c = minCol + 1; c <= maxCol; c++) {
      let sName = `Série ${c - minCol}`;
      if (hasHeaderRow) {
        const headerCell = getCellDisplayPrimitive(cells, coordToAddress({ col: c, row: minRow }));
        if (headerCell.raw) {
          sName = headerCell.raw;
        }
      }
      seriesKeys.push(sName);
    }

    for (let r = startDataRow; r <= maxRow; r++) {
      const catAddr = coordToAddress({ col: minCol, row: r });
      const catPrim = getCellDisplayPrimitive(cells, catAddr);
      const catName = catPrim.raw || `Ligne ${r + 1}`;
      categories.push(catName);

      const rowObj: Record<string, string | number> = { name: catName };

      for (let c = minCol + 1; c <= maxCol; c++) {
        const seriesIndex = c - (minCol + 1);
        const sKey = seriesKeys[seriesIndex];
        const valAddr = coordToAddress({ col: c, row: r });
        const valPrim = getCellDisplayPrimitive(cells, valAddr);

        const val = valPrim.num !== null ? valPrim.num : 0;
        if (valPrim.isNumeric) totalNumericCount++;

        rowObj[sKey] = val;
      }

      rechartsData.push(rowObj);
    }
  }

  if (totalNumericCount === 0) {
    return {
      categories: [],
      series: [],
      rechartsData: [],
      seriesKeys: [],
      isValid: false,
      errorMessage: "Le graphique nécessite au moins une série de valeurs numériques."
    };
  }

  return {
    categories,
    series: [],
    rechartsData,
    seriesKeys,
    isValid: true
  };
}
