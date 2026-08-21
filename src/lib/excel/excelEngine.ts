import {
  CellValue,
  CellValueType,
  ExcelCellData,
  ExcelCellsMap,
  ExcelErrorType
} from './excelTypes';
import { ExcelParser } from './excelParser';
import { evaluateAST } from './excelEvaluator';
import { extractDependenciesFromFormula } from './excelReferences';
import { isExcelError } from './excelFunctions';

/**
 * Evaluates a single formula string in isolation with a value getter context
 */
export function evaluateFormulaString(
  formula: string,
  getCellValue: (address: string) => CellValue | ExcelErrorType
): CellValue | ExcelErrorType {
  try {
    const parser = new ExcelParser(formula);
    const ast = parser.parse();
    const result = evaluateAST(ast, getCellValue);

    if (Array.isArray(result)) {
      return result.length > 0 ? (result[0] as any) : 0;
    }
    return result as CellValue | ExcelErrorType;
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('#NAME?')) return '#NAME?';
    if (msg.includes('#DIV/0!')) return '#DIV/0!';
    if (msg.includes('#REF!')) return '#REF!';
    return '#VALUE!';
  }
}

/**
 * Determines the primitive type of a computed cell value
 */
export function determineCellType(val: CellValue | ExcelErrorType): CellValueType {
  if (isExcelError(val)) return 'error';
  if (val === null || val === undefined || val === '') return 'empty';
  if (typeof val === 'number') return 'number';
  if (typeof val === 'boolean') return 'boolean';
  return 'text';
}

/**
 * Core Excel Engine class managing dependency graph, cycle detection, and recalculations
 */
export class ExcelEngine {
  /**
   * Recomputes all cells in a cells map in topologically sorted order,
   * detecting circular references (#CIRCULAIRE!).
   */
  public static recomputeAll(cells: ExcelCellsMap): ExcelCellsMap {
    const result: ExcelCellsMap = {};

    // Copy initial values, clearing cached computed properties to ensure complete fresh recalculation
    for (const [addr, cellData] of Object.entries(cells)) {
      result[addr] = {
        value: cellData.value
      };
    }

    // Build dependency graph
    const dependencies: Record<string, string[]> = {};
    for (const [addr, cellData] of Object.entries(result)) {
      if (cellData.value && cellData.value.startsWith('=')) {
        dependencies[addr] = extractDependenciesFromFormula(cellData.value);
      } else {
        dependencies[addr] = [];
      }
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles = new Set<string>();

    // DFS to detect cycles
    const detectCycles = (node: string) => {
      visited.add(node);
      recursionStack.add(node);

      const deps = dependencies[node] || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          detectCycles(dep);
        } else if (recursionStack.has(dep)) {
          // Cycle found!
          cycles.add(node);
          cycles.add(dep);
        }
      }

      recursionStack.delete(node);
    };

    for (const addr of Object.keys(result)) {
      if (!visited.has(addr)) {
        detectCycles(addr);
      }
    }

    // Context value getter with dynamic computation and cycle guard
    const evalStack = new Set<string>();

    const getCellValue = (addr: string): CellValue | ExcelErrorType => {
      const cell = result[addr];
      if (!cell || cell.value === undefined || cell.value === null || cell.value.trim() === '') {
        return null;
      }

      const rawVal = cell.value.trim();

      // If plain literal value (not formula)
      if (!rawVal.startsWith('=')) {
        const num = Number(rawVal.replace(',', '.'));
        if (!isNaN(num) && rawVal !== '') {
          return num;
        }
        if (rawVal.toUpperCase() === 'VRAI' || rawVal.toUpperCase() === 'TRUE') return true;
        if (rawVal.toUpperCase() === 'FAUX' || rawVal.toUpperCase() === 'FALSE') return false;
        return rawVal;
      }

      // If already computed
      if (cell.computed !== undefined) {
        return cell.computed;
      }

      // If in cycle
      if (cycles.has(addr) || evalStack.has(addr)) {
        return '#CIRCULAIRE!';
      }

      evalStack.add(addr);
      const computed = evaluateFormulaString(rawVal, getCellValue);
      evalStack.delete(addr);

      cell.computed = computed;
      cell.computedType = determineCellType(computed);
      return computed;
    };

    // Evaluate all cells
    for (const [addr, cell] of Object.entries(result)) {
      const rawVal = (cell.value || '').trim();

      if (rawVal === '') {
        cell.computed = '';
        cell.computedType = 'empty';
      } else if (!rawVal.startsWith('=')) {
        const num = Number(rawVal.replace(',', '.'));
        if (!isNaN(num) && rawVal !== '') {
          cell.computed = num;
          cell.computedType = 'number';
        } else if (rawVal.toUpperCase() === 'VRAI' || rawVal.toUpperCase() === 'TRUE') {
          cell.computed = true;
          cell.computedType = 'boolean';
        } else if (rawVal.toUpperCase() === 'FAUX' || rawVal.toUpperCase() === 'FALSE') {
          cell.computed = false;
          cell.computedType = 'boolean';
        } else {
          cell.computed = rawVal;
          cell.computedType = 'text';
        }
      } else {
        if (cycles.has(addr)) {
          cell.computed = '#CIRCULAIRE!';
          cell.computedType = 'error';
        } else {
          const comp = getCellValue(addr);
          cell.computed = comp;
          cell.computedType = determineCellType(comp);
        }
      }
    }

    return result;
  }

  /**
   * Updates a single cell and recalculates all dependents
   */
  public static updateCellAndRecompute(
    cells: ExcelCellsMap,
    address: string,
    newValue: string
  ): ExcelCellsMap {
    const updated = { ...cells };
    const trimmed = newValue.trim();

    if (trimmed === '') {
      delete updated[address];
    } else {
      updated[address] = {
        value: newValue
      };
    }

    return this.recomputeAll(updated);
  }
}
