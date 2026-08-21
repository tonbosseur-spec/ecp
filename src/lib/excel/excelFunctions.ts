import { CellValue, ExcelErrorType } from './excelTypes';

export type ExcelFunctionHandler = (args: (CellValue | CellValue[])[], rawArgs?: any[]) => CellValue | ExcelErrorType;

/**
 * Flattens array arguments (e.g. ranges of values) into a 1D list of primitive CellValue
 */
export function flattenValues(args: (CellValue | CellValue[])[]): CellValue[] {
  const result: CellValue[] = [];
  for (const item of args) {
    if (Array.isArray(item)) {
      result.push(...flattenValues(item));
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * Checks if a value is an error string
 */
export function isExcelError(val: any): val is ExcelErrorType {
  return (
    typeof val === 'string' &&
    (val === '#DIV/0!' ||
      val === '#REF!' ||
      val === '#VALUE!' ||
      val === '#NAME?' ||
      val === '#CIRCULAIRE!' ||
      val === '#N/A')
  );
}

/**
 * Helper to extract pure numbers from a flattened array, ignoring null, strings and booleans in ranges
 */
function extractNumbers(values: CellValue[]): number[] {
  const nums: number[] = [];
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'number' && !isNaN(v)) {
      nums.push(v);
    } else if (typeof v === 'string') {
      const parsed = Number(v.replace(',', '.').trim());
      if (!isNaN(parsed) && v.trim() !== '') {
        nums.push(parsed);
      }
    }
  }
  return nums;
}

/**
 * Evaluates criteria for NB.SI, SOMME.SI, MOYENNE.SI
 * e.g. ">10", "<=5", "Admis", 125, "<>0", "=Pierre"
 */
function matchesCriterion(val: CellValue, criterion: CellValue): boolean {
  if (criterion === null || criterion === undefined) {
    return val === null || val === undefined || val === '';
  }

  const critStr = String(criterion).trim();
  const valStr = val === null || val === undefined ? '' : String(val).trim();
  const valNum = typeof val === 'number' ? val : Number(valStr.replace(',', '.'));
  const isValNumeric = !isNaN(valNum) && valStr !== '';

  const opMatch = critStr.match(/^(>=|<=|<>|>|<|=)(.*)$/);
  if (opMatch) {
    const op = opMatch[1];
    const target = opMatch[2].trim();
    const targetNum = Number(target.replace(',', '.'));
    const isTargetNumeric = !isNaN(targetNum) && target !== '';

    if (isValNumeric && isTargetNumeric) {
      switch (op) {
        case '>=': return valNum >= targetNum;
        case '<=': return valNum <= targetNum;
        case '>': return valNum > targetNum;
        case '<': return valNum < targetNum;
        case '<>': return valNum !== targetNum;
        case '=': return valNum === targetNum;
      }
    } else {
      // String comparison
      const normVal = valStr.toLowerCase();
      const normTarget = target.toLowerCase();
      switch (op) {
        case '=': return normVal === normTarget;
        case '<>': return normVal !== normTarget;
        case '>': return normVal > normTarget;
        case '>=': return normVal >= normTarget;
        case '<': return normVal < normTarget;
        case '<=': return normVal <= normTarget;
      }
    }
  }

  // Exact match (case insensitive if text)
  if (typeof criterion === 'number') {
    return isValNumeric && valNum === criterion;
  }

  return valStr.toLowerCase() === critStr.toLowerCase();
}

/**
 * Standard registry of Excel Functions in French (and standard English aliases)
 */
export const EXCEL_FUNCTIONS_REGISTRY: Record<string, ExcelFunctionHandler> = {
  // --- Math & Statistics ---
  SOMME: (args) => {
    const flat = flattenValues(args);
    for (const v of flat) {
      if (isExcelError(v)) return v;
    }
    const nums = extractNumbers(flat);
    return nums.reduce((acc, curr) => acc + curr, 0);
  },
  SUM: (args) => EXCEL_FUNCTIONS_REGISTRY.SOMME(args),

  MOYENNE: (args) => {
    const flat = flattenValues(args);
    for (const v of flat) {
      if (isExcelError(v)) return v;
    }
    const nums = extractNumbers(flat);
    if (nums.length === 0) return '#DIV/0!';
    const sum = nums.reduce((acc, curr) => acc + curr, 0);
    return sum / nums.length;
  },
  AVERAGE: (args) => EXCEL_FUNCTIONS_REGISTRY.MOYENNE(args),

  MIN: (args) => {
    const flat = flattenValues(args);
    for (const v of flat) {
      if (isExcelError(v)) return v;
    }
    const nums = extractNumbers(flat);
    if (nums.length === 0) return 0;
    return Math.min(...nums);
  },

  MAX: (args) => {
    const flat = flattenValues(args);
    for (const v of flat) {
      if (isExcelError(v)) return v;
    }
    const nums = extractNumbers(flat);
    if (nums.length === 0) return 0;
    return Math.max(...nums);
  },

  NB: (args) => {
    const flat = flattenValues(args);
    for (const v of flat) {
      if (isExcelError(v)) return v;
    }
    const nums = extractNumbers(flat);
    return nums.length;
  },
  COUNT: (args) => EXCEL_FUNCTIONS_REGISTRY.NB(args),

  NBVAL: (args) => {
    const flat = flattenValues(args);
    for (const v of flat) {
      if (isExcelError(v)) return v;
    }
    const nonEmpties = flat.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    return nonEmpties.length;
  },
  COUNTA: (args) => EXCEL_FUNCTIONS_REGISTRY.NBVAL(args),

  // --- Logic ---
  SI: (args) => {
    if (args.length < 2) return '#VALUE!';
    const condition = args[0];
    if (isExcelError(condition)) return condition;

    const isTrue =
      condition === true ||
      condition === 1 ||
      (typeof condition === 'string' && (condition.toUpperCase() === 'VRAI' || condition.toUpperCase() === 'TRUE')) ||
      (typeof condition === 'number' && condition !== 0);

    if (isTrue) {
      const valIfTrue = args[1];
      return Array.isArray(valIfTrue) ? valIfTrue[0] : valIfTrue;
    } else {
      if (args.length >= 3) {
        const valIfFalse = args[2];
        return Array.isArray(valIfFalse) ? valIfFalse[0] : valIfFalse;
      }
      return false;
    }
  },
  IF: (args) => EXCEL_FUNCTIONS_REGISTRY.SI(args),

  ET: (args) => {
    const flat = flattenValues(args);
    if (flat.length === 0) return '#VALUE!';
    for (const v of flat) {
      if (isExcelError(v)) return v;
      const isTruthy =
        v === true ||
        (typeof v === 'number' && v !== 0) ||
        (typeof v === 'string' && (v.toUpperCase() === 'VRAI' || v.toUpperCase() === 'TRUE'));
      if (!isTruthy) return false;
    }
    return true;
  },
  AND: (args) => EXCEL_FUNCTIONS_REGISTRY.ET(args),

  OU: (args) => {
    const flat = flattenValues(args);
    if (flat.length === 0) return '#VALUE!';
    for (const v of flat) {
      if (isExcelError(v)) return v;
      const isTruthy =
        v === true ||
        (typeof v === 'number' && v !== 0) ||
        (typeof v === 'string' && (v.toUpperCase() === 'VRAI' || v.toUpperCase() === 'TRUE'));
      if (isTruthy) return true;
    }
    return false;
  },
  OR: (args) => EXCEL_FUNCTIONS_REGISTRY.OU(args),

  // --- Conditional Functions (NB.SI, SOMME.SI, MOYENNE.SI) ---
  'NB.SI': (args) => {
    if (args.length < 2) return '#VALUE!';
    const range = Array.isArray(args[0]) ? args[0] : [args[0]];
    const flatRange = flattenValues(range);
    const criterion = Array.isArray(args[1]) ? args[1][0] : args[1];

    let count = 0;
    for (const cellVal of flatRange) {
      if (matchesCriterion(cellVal, criterion)) {
        count++;
      }
    }
    return count;
  },
  COUNTIF: (args) => EXCEL_FUNCTIONS_REGISTRY['NB.SI'](args),

  'SOMME.SI': (args) => {
    if (args.length < 2) return '#VALUE!';
    const checkRange = flattenValues(Array.isArray(args[0]) ? args[0] : [args[0]]);
    const criterion = Array.isArray(args[1]) ? args[1][0] : args[1];
    const sumRange = args.length >= 3 ? flattenValues(Array.isArray(args[2]) ? args[2] : [args[2]]) : checkRange;

    let sum = 0;
    for (let i = 0; i < checkRange.length; i++) {
      if (matchesCriterion(checkRange[i], criterion)) {
        const sumVal = sumRange[i];
        if (typeof sumVal === 'number') {
          sum += sumVal;
        } else if (typeof sumVal === 'string') {
          const parsed = Number(sumVal.replace(',', '.'));
          if (!isNaN(parsed)) sum += parsed;
        }
      }
    }
    return sum;
  },
  SUMIF: (args) => EXCEL_FUNCTIONS_REGISTRY['SOMME.SI'](args),

  'MOYENNE.SI': (args) => {
    if (args.length < 2) return '#VALUE!';
    const checkRange = flattenValues(Array.isArray(args[0]) ? args[0] : [args[0]]);
    const criterion = Array.isArray(args[1]) ? args[1][0] : args[1];
    const avgRange = args.length >= 3 ? flattenValues(Array.isArray(args[2]) ? args[2] : [args[2]]) : checkRange;

    let sum = 0;
    let count = 0;
    for (let i = 0; i < checkRange.length; i++) {
      if (matchesCriterion(checkRange[i], criterion)) {
        const val = avgRange[i];
        let num: number | null = null;
        if (typeof val === 'number') {
          num = val;
        } else if (typeof val === 'string') {
          const parsed = Number(val.replace(',', '.'));
          if (!isNaN(parsed) && val.trim() !== '') num = parsed;
        }
        if (num !== null) {
          sum += num;
          count++;
        }
      }
    }
    if (count === 0) return '#DIV/0!';
    return sum / count;
  },
  AVERAGEIF: (args) => EXCEL_FUNCTIONS_REGISTRY['MOYENNE.SI'](args),

  // --- Text Functions ---
  MAJUSCULE: (args) => {
    if (args.length < 1) return '#VALUE!';
    const val = flattenValues(args)[0];
    if (isExcelError(val)) return val;
    return val === null || val === undefined ? '' : String(val).toUpperCase();
  },
  UPPER: (args) => EXCEL_FUNCTIONS_REGISTRY.MAJUSCULE(args),

  MINUSCULE: (args) => {
    if (args.length < 1) return '#VALUE!';
    const val = flattenValues(args)[0];
    if (isExcelError(val)) return val;
    return val === null || val === undefined ? '' : String(val).toLowerCase();
  },
  LOWER: (args) => EXCEL_FUNCTIONS_REGISTRY.MINUSCULE(args),

  NBCAR: (args) => {
    if (args.length < 1) return '#VALUE!';
    const val = flattenValues(args)[0];
    if (isExcelError(val)) return val;
    return val === null || val === undefined ? 0 : String(val).length;
  },
  LEN: (args) => EXCEL_FUNCTIONS_REGISTRY.NBCAR(args),

  CONCATENER: (args) => {
    const flat = flattenValues(args);
    for (const v of flat) {
      if (isExcelError(v)) return v;
    }
    return flat
      .map((v) => (v === null || v === undefined ? '' : String(v)))
      .join('');
  },
  CONCAT: (args) => EXCEL_FUNCTIONS_REGISTRY.CONCATENER(args)
};
