import { ASTNode } from './excelParser';
import { CellValue, ExcelErrorType } from './excelTypes';
import { EXCEL_FUNCTIONS_REGISTRY, isExcelError } from './excelFunctions';
import { expandRange } from './excelReferences';

export type CellValueGetter = (address: string) => CellValue | ExcelErrorType;

/**
 * Coerces a CellValue to a number according to Excel rules
 */
export function coerceToNumber(val: CellValue | ExcelErrorType): number | ExcelErrorType {
  if (isExcelError(val)) return val;
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? '#VALUE!' : val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'string') {
    const trimmed = val.replace(',', '.').trim();
    const num = Number(trimmed);
    if (isNaN(num)) return '#VALUE!';
    return num;
  }
  return '#VALUE!';
}

/**
 * Coerces a CellValue to a string
 */
export function coerceToString(val: CellValue | ExcelErrorType): string {
  if (isExcelError(val)) return val;
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'VRAI' : 'FAUX';
  return String(val);
}

/**
 * Evaluates an AST Node given a cell value getter
 */
export function evaluateAST(node: ASTNode, getCellValue: CellValueGetter): CellValue | ExcelErrorType | (CellValue | ExcelErrorType)[] {
  switch (node.type) {
    case 'Number':
      return node.value;

    case 'String':
      return node.value;

    case 'Boolean':
      return node.value;

    case 'CellRef': {
      const cellVal = getCellValue(node.address);
      return cellVal;
    }

    case 'Range': {
      const addresses = expandRange(node.address);
      return addresses.map((addr) => getCellValue(addr));
    }

    case 'UnaryOp': {
      const argVal = evaluateAST(node.argument, getCellValue);
      if (isExcelError(argVal)) return argVal;
      if (Array.isArray(argVal)) return '#VALUE!';

      const num = coerceToNumber(argVal);
      if (isExcelError(num)) return num;

      return node.operator === '-' ? -num : num;
    }

    case 'BinaryOp': {
      const leftVal = evaluateAST(node.left, getCellValue);
      if (isExcelError(leftVal)) return leftVal;
      if (Array.isArray(leftVal)) return '#VALUE!';

      const rightVal = evaluateAST(node.right, getCellValue);
      if (isExcelError(rightVal)) return rightVal;
      if (Array.isArray(rightVal)) return '#VALUE!';

      // 1. Text Concat: &
      if (node.operator === '&') {
        const leftStr = coerceToString(leftVal);
        const rightStr = coerceToString(rightVal);
        return `${leftStr}${rightStr}`;
      }

      // 2. Comparisons: =, <>, <, <=, >, >=
      if (['=', '<>', '<', '<=', '>', '>='].includes(node.operator)) {
        return evaluateComparison(node.operator, leftVal, rightVal);
      }

      // 3. Math Operators: +, -, *, /, ^
      const leftNum = coerceToNumber(leftVal);
      if (isExcelError(leftNum)) return leftNum;

      const rightNum = coerceToNumber(rightVal);
      if (isExcelError(rightNum)) return rightNum;

      switch (node.operator) {
        case '+':
          return leftNum + rightNum;
        case '-':
          return leftNum - rightNum;
        case '*':
          return leftNum * rightNum;
        case '/':
          if (rightNum === 0) return '#DIV/0!';
          return leftNum / rightNum;
        case '^':
          return Math.pow(leftNum, rightNum);
        default:
          return '#VALUE!';
      }
    }

    case 'FunctionCall': {
      const fnName = node.name.toUpperCase();
      const handler = EXCEL_FUNCTIONS_REGISTRY[fnName];

      if (!handler) {
        return '#NAME?';
      }

      // Evaluate all argument nodes
      const evaluatedArgs = node.args.map((argNode) => {
        return evaluateAST(argNode, getCellValue);
      });

      try {
        return handler(evaluatedArgs as any);
      } catch (err) {
        return '#VALUE!';
      }
    }

    default:
      return '#VALUE!';
  }
}

/**
 * Comparison evaluation matching Excel semantics
 */
function evaluateComparison(
  op: string,
  left: CellValue | ExcelErrorType,
  right: CellValue | ExcelErrorType
): boolean {
  // Empty values handling
  const normLeft = left === null || left === undefined ? '' : left;
  const normRight = right === null || right === undefined ? '' : right;

  // Number comparison if both can be numbers
  const leftNum = typeof normLeft === 'number' ? normLeft : (typeof normLeft === 'string' && normLeft.trim() !== '' && !isNaN(Number(normLeft.replace(',', '.'))) ? Number(normLeft.replace(',', '.')) : null);
  const rightNum = typeof normRight === 'number' ? normRight : (typeof normRight === 'string' && normRight.trim() !== '' && !isNaN(Number(normRight.replace(',', '.'))) ? Number(normRight.replace(',', '.')) : null);

  if (leftNum !== null && rightNum !== null) {
    switch (op) {
      case '=': return leftNum === rightNum;
      case '<>': return leftNum !== rightNum;
      case '<': return leftNum < rightNum;
      case '<=': return leftNum <= rightNum;
      case '>': return leftNum > rightNum;
      case '>=': return leftNum >= rightNum;
    }
  }

  // String / Boolean fallback comparison (case-insensitive for strings)
  const lStr = String(normLeft).toLowerCase();
  const rStr = String(normRight).toLowerCase();

  switch (op) {
    case '=': return lStr === rStr;
    case '<>': return lStr !== rStr;
    case '<': return lStr < rStr;
    case '<=': return lStr <= rStr;
    case '>': return lStr > rStr;
    case '>=': return lStr >= rStr;
    default: return false;
  }
}
