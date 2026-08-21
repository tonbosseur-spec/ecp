import { ExcelCellsMap, CellValue, ExcelErrorType } from './excelTypes';
import { ExcelChallengeConfig, ExcelCorrectionCriterion, ExcelCorrectionCriterionType } from './excelChallengeTypes';
import { ExcelEngine } from './excelEngine';
import { isExcelError } from './excelFunctions';

export interface ExcelCriterionResult {
  id: string;
  type: ExcelCorrectionCriterionType;
  cell: string;
  description: string;
  passed: boolean;
  isRequired: boolean;
  message: string;
  studentValue?: any;
  studentFormula?: string;
}

export interface ExcelCorrectionResult {
  passed: boolean;
  scorePercentage: number;
  passedCriteria: number;
  totalCriteria: number;
  results: ExcelCriterionResult[];
}

/**
 * Normalizes a formula string for robust comparison:
 * - ensures leading '='
 * - strips unnecessary internal/external whitespace
 * - converts function names and cell references to uppercase
 * - normalizes argument separators (; to ,)
 */
export function normalizeFormula(formulaStr: string | null | undefined): string {
  if (!formulaStr) return '';
  let str = formulaStr.trim();
  if (!str.startsWith('=')) {
    str = '=' + str;
  }
  // Replace spaces inside formula (except inside quotes)
  let inQuotes = false;
  let normalized = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      normalized += char;
    } else if (char === ' ' && !inQuotes) {
      // skip whitespace outside strings
      continue;
    } else {
      normalized += inQuotes ? char : char.toUpperCase();
    }
  }

  // Normalize semicolons used as separators in French Excel to commas
  // but preserve inside string literals
  let finalStr = '';
  inQuotes = false;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      finalStr += char;
    } else if (char === ';' && !inQuotes) {
      finalStr += ',';
    } else {
      finalStr += char;
    }
  }

  return finalStr;
}

/**
 * Equivalent function name synonyms (FR / EN)
 */
const FUNCTION_SYNONYMS: Record<string, string[]> = {
  SOMME: ['SOMME', 'SUM'],
  SUM: ['SOMME', 'SUM'],
  MOYENNE: ['MOYENNE', 'AVERAGE', 'AVG'],
  AVERAGE: ['MOYENNE', 'AVERAGE', 'AVG'],
  SI: ['SI', 'IF'],
  IF: ['SI', 'IF'],
  NB: ['NB', 'COUNT'],
  COUNT: ['NB', 'COUNT'],
  MAX: ['MAX'],
  MIN: ['MIN'],
  RECHERCHEV: ['RECHERCHEV', 'VLOOKUP'],
  VLOOKUP: ['RECHERCHEV', 'VLOOKUP'],
  RECHERCHEH: ['RECHERCHEH', 'HLOOKUP'],
  HLOOKUP: ['RECHERCHEH', 'HLOOKUP'],
  CONCATENER: ['CONCATENER', 'CONCAT'],
  CONCAT: ['CONCATENER', 'CONCAT'],
  ARRONDI: ['ARRONDI', 'ROUND'],
  ROUND: ['ARRONDI', 'ROUND']
};

/**
 * Checks if a formula string contains a specific Excel function call
 */
export function formulaContainsFunction(formulaStr: string | null | undefined, functionName: string): boolean {
  if (!formulaStr || !formulaStr.trim().startsWith('=')) return false;
  const upper = formulaStr.toUpperCase();
  const targetUpper = (functionName || '').toUpperCase().trim();
  const synonyms = FUNCTION_SYNONYMS[targetUpper] || [targetUpper];

  for (const fn of synonyms) {
    // Regex looking for function name followed by opening parenthesis or whitespace+parenthesis
    const regex = new RegExp(`(^|[=+\\-*/(,;\\s])${fn}\\s*\\(`, 'i');
    if (regex.test(upper)) {
      return true;
    }
  }
  return false;
}

/**
 * Compares two evaluated values with numerical floating point tolerance and case-insensitive strings
 */
export function compareExcelValues(actual: CellValue | ExcelErrorType, expected: string | number | boolean | undefined): boolean {
  if (expected === undefined) return true;

  // Error case
  if (isExcelError(actual)) {
    return false;
  }

  if (actual === null || actual === undefined || actual === '') {
    return expected === '' || expected === null || expected === undefined;
  }

  // Boolean comparison
  if (typeof expected === 'boolean') {
    if (typeof actual === 'boolean') return actual === expected;
    const strActual = String(actual).toUpperCase();
    if (expected === true) return strActual === 'VRAI' || strActual === 'TRUE';
    if (expected === false) return strActual === 'FAUX' || strActual === 'FALSE';
    return false;
  }

  // Number comparison (supporting float rounding)
  const numExpected = typeof expected === 'number' ? expected : Number(String(expected).replace(',', '.'));
  const numActual = typeof actual === 'number' ? actual : Number(String(actual).replace(',', '.'));

  if (!isNaN(numExpected) && !isNaN(numActual)) {
    // Tolerant floating point comparison (absolute delta < 0.0001 or relative < 0.01%)
    const diff = Math.abs(numActual - numExpected);
    if (diff < 1e-4) return true;
    if (Math.abs(numExpected) > 0 && diff / Math.abs(numExpected) < 1e-4) return true;
    return false;
  }

  // String comparison (trimmed, normalized)
  const strActual = String(actual).trim().toLowerCase();
  const strExpected = String(expected).trim().toLowerCase();
  return strActual === strExpected;
}

/**
 * Main evaluation engine for an Excel challenge attempt.
 * Evaluates student cells against defined criteria.
 */
export function evaluateExcelChallenge(
  studentCells: ExcelCellsMap,
  config: ExcelChallengeConfig
): ExcelCorrectionResult {
  // 1. Recompute all student cells topologically to ensure fresh formulas and calculated values
  const recomputedCells = ExcelEngine.recomputeAll(studentCells);

  const criteria = config.criteria || [];
  const results: ExcelCriterionResult[] = [];

  for (const criterion of criteria) {
    const cellAddr = (criterion.cell || '').toUpperCase().trim();
    const cellData = recomputedCells[cellAddr] || { value: '' };
    const rawValue = cellData.value || '';
    const computedVal = cellData.computed !== undefined ? cellData.computed : rawValue;
    const isRequired = criterion.required !== false;

    let passed = false;
    let message = '';

    switch (criterion.type) {
      case 'value': {
        const matches = compareExcelValues(computedVal, criterion.expected);
        passed = matches;
        if (passed) {
          message = criterion.description || `La valeur en ${cellAddr} est correcte.`;
        } else {
          const displayActual = isExcelError(computedVal)
            ? computedVal
            : (computedVal === null || computedVal === undefined || computedVal === '')
            ? '(vide)'
            : String(computedVal);
          message = criterion.description 
            ? `${criterion.description} (actuel : ${displayActual})`
            : `La valeur attendue en ${cellAddr} n'est pas atteinte.`;
        }
        break;
      }

      case 'formula': {
        const studentNorm = normalizeFormula(rawValue);
        const expectedNorm = normalizeFormula(criterion.expected_formula);
        
        // Student must have used a formula (starting with '=')
        if (!rawValue.startsWith('=')) {
          passed = false;
          message = `Une formule commençant par '=' est attendue en ${cellAddr}.`;
        } else {
          passed = studentNorm === expectedNorm;
          if (passed) {
            message = criterion.description || `La formule en ${cellAddr} est conforme.`;
          } else {
            message = criterion.description || `La formule utilisée en ${cellAddr} ne correspond pas à celle attendue.`;
          }
        }
        break;
      }

      case 'required_function': {
        const fnName = (criterion.function_name || '').toUpperCase().trim();
        const hasFn = formulaContainsFunction(rawValue, fnName);
        passed = hasFn;
        if (passed) {
          message = criterion.description || `La fonction ${fnName} a bien été utilisée en ${cellAddr}.`;
        } else {
          message = criterion.description || `La fonction obligatoire ${fnName} n'a pas été utilisée dans la formule de ${cellAddr}.`;
        }
        break;
      }

      case 'forbidden_function': {
        const fnName = (criterion.function_name || '').toUpperCase().trim();
        const hasFn = formulaContainsFunction(rawValue, fnName);
        passed = !hasFn;
        if (passed) {
          message = criterion.description || `Aucune fonction interdite n'est présente en ${cellAddr}.`;
        } else {
          message = criterion.description || `La fonction ${fnName} est interdite pour cet exercice en ${cellAddr}.`;
        }
        break;
      }

      default: {
        passed = true;
        message = criterion.description || 'Critère validé.';
      }
    }

    results.push({
      id: criterion.id,
      type: criterion.type,
      cell: cellAddr,
      description: criterion.description,
      passed,
      isRequired,
      message,
      studentValue: computedVal,
      studentFormula: rawValue.startsWith('=') ? rawValue : undefined
    });
  }

  const totalCriteria = results.length;
  const passedCriteria = results.filter(r => r.passed).length;
  
  // An exercise is passed if:
  // 1. There is at least 1 criterion
  // 2. ALL required criteria are passed
  // 3. No critical errors
  const allRequiredPassed = results.filter(r => r.isRequired).every(r => r.passed);
  const overallPassed = totalCriteria > 0 && allRequiredPassed;

  // Score percentage calculation
  let scorePercentage = 0;
  if (overallPassed) {
    scorePercentage = 100;
  } else if (totalCriteria > 0) {
    scorePercentage = Math.round((passedCriteria / totalCriteria) * 100);
  }

  return {
    passed: overallPassed,
    scorePercentage,
    passedCriteria,
    totalCriteria,
    results
  };
}
