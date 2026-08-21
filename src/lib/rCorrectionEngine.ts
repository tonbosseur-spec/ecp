/**
 * R Automatic Correction Engine for Interactive R Activities
 * 
 * Generates and runs robust R unit validation tests directly inside WebR (client-side WebAssembly).
 * Transforms teacher visual criteria into secure, isolated R assertions.
 * 
 * Supports extensible test criteria:
 * - object_exists
 * - object_value
 * - object_class
 * - object_length
 * - rows
 * - columns
 * - column_exists
 * - expression
 * - object_result
 */

import { webrEngine } from './webrEngine';
import { prepareActivityRPackages } from './rPackageManager';

export type RCorrectionCriterionType =
  | 'object_exists'
  | 'object_value'
  | 'object_class'
  | 'object_length'
  | 'rows'
  | 'columns'
  | 'column_exists'
  | 'expression'
  | 'object_result';

export interface RCorrectionCriterion {
  id: string;
  type: RCorrectionCriterionType;
  required?: boolean; // default: true
  object?: string;
  expected?: string | number;
  expected_class?: string;
  length?: number | string;
  rows?: number | string;
  columns?: number | string;
  column?: string;
  expression?: string;
  description?: string;
}

export interface RCorrectionConfig {
  tests: RCorrectionCriterion[];
}

export interface RTestEvaluationResult {
  criterion: RCorrectionCriterion;
  passed: boolean;
  message: string;
  error?: string;
  isRequired: boolean;
}

export interface RCorrectionSuiteResult {
  success: boolean;
  totalTests: number;
  passedTests: number;
  totalRequired: number;
  passedRequired: number;
  scorePercentage: number;
  hasStudentCodeError: boolean;
  studentErrorMessage?: string;
  testResults: RTestEvaluationResult[];
  executionTimeMs: number;
}

export interface RCorrectionCriterionDefinition {
  type: RCorrectionCriterionType;
  label: string;
  shortLabel: string;
  description: string;
  category: 'basics' | 'structure' | 'custom';
  defaultValues: Partial<RCorrectionCriterion>;
  generateRTest: (criterion: RCorrectionCriterion) => string;
  getSuccessMessage: (criterion: RCorrectionCriterion) => string;
  getFailureMessage: (criterion: RCorrectionCriterion) => string;
}

export const R_CLASSES_OPTIONS = [
  { value: 'numeric', label: 'numeric (nombres réels/flottants)' },
  { value: 'integer', label: 'integer (nombres entiers)' },
  { value: 'character', label: 'character (chaîne de texte)' },
  { value: 'logical', label: 'logical (booléens TRUE/FALSE)' },
  { value: 'factor', label: 'factor (facteur catégoriel)' },
  { value: 'data.frame', label: 'data.frame (tableau de données)' },
  { value: 'matrix', label: 'matrix (matrice)' },
  { value: 'list', label: 'list (liste R)' },
  { value: 'vector', label: 'vector (vecteur atomique)' },
];

/**
 * Sanitizes R identifier names (e.g. variable or column names)
 */
export function sanitizeRIdentifier(name: string): string {
  if (!name) return '';
  return name.trim().replace(/[`"'\\]/g, '');
}

/**
 * Central dictionary defining each criterion type, its R code generator and user messages.
 */
export const R_CORRECTION_TEST_TYPES: Record<RCorrectionCriterionType, RCorrectionCriterionDefinition> = {
  object_exists: {
    type: 'object_exists',
    label: "L'objet existe",
    shortLabel: 'Existence',
    description: "Vérifie que l'apprenant a créé un objet avec le nom spécifié.",
    category: 'basics',
    defaultValues: {
      object: 'x',
      required: true,
    },
    generateRTest: (c) => {
      const obj = sanitizeRIdentifier(c.object || 'x');
      return `tryCatch({ exists("${obj}", envir = .GlobalEnv) && !is.null(get("${obj}", envir = .GlobalEnv)) }, error = function(e) FALSE)`;
    },
    getSuccessMessage: (c) => {
      const obj = c.object || 'x';
      return `L'objet "${obj}" existe bien dans l'environnement.`;
    },
    getFailureMessage: (c) => {
      const obj = c.object || 'x';
      return `L'objet "${obj}" est introuvable. Avez-vous pensé à lui affecter une valeur (ex: ${obj} <- ...) ?`;
    },
  },

  object_value: {
    type: 'object_value',
    label: "Valeur précise d'un objet",
    shortLabel: 'Valeur',
    description: "Vérifie que l'objet contient exactement la valeur ou le vecteur attendu.",
    category: 'basics',
    defaultValues: {
      object: 'moyenne',
      expected: '15',
      required: true,
    },
    generateRTest: (c) => {
      const obj = sanitizeRIdentifier(c.object || 'x');
      const expectedStr = String(c.expected ?? '').trim();

      return `tryCatch({
        if (!exists("${obj}", envir = .GlobalEnv)) return(FALSE)
        .val <- get("${obj}", envir = .GlobalEnv)
        .exp_str <- ${JSON.stringify(expectedStr)}
        
        # Tentative d'évaluation de la valeur attendue comme expression R
        .exp_obj <- tryCatch(eval(parse(text = .exp_str)), error = function(e) .exp_str)
        
        # Comparaison robuste
        if (is.numeric(.val) && is.numeric(.exp_obj)) {
          if (length(.val) == length(.exp_obj)) {
            isTRUE(all.equal(as.numeric(.val), as.numeric(.exp_obj), tolerance = 1e-4))
          } else {
            FALSE
          }
        } else if (is.character(.val) && is.character(.exp_obj)) {
          if (length(.val) == length(.exp_obj)) {
            all(trimws(as.character(.val)) == trimws(as.character(.exp_obj)))
          } else {
            FALSE
          }
        } else {
          isTRUE(all.equal(.val, .exp_obj, check.attributes = FALSE)) || identical(.val, .exp_obj)
        }
      }, error = function(e) FALSE)`;
    },
    getSuccessMessage: (c) => {
      const obj = c.object || 'x';
      const exp = c.expected ?? '';
      return `L'objet "${obj}" contient bien la valeur attendue (${exp}).`;
    },
    getFailureMessage: (c) => {
      const obj = c.object || 'x';
      const exp = c.expected ?? '';
      return `La valeur de "${obj}" n'est pas celle attendue (valeur attendue : ${exp}).`;
    },
  },

  object_result: {
    type: 'object_result',
    label: "Vérifier un résultat (calcul ou valeur)",
    shortLabel: 'Résultat',
    description: "Vérifie le résultat final stocké dans une variable (simplifié pour débutants).",
    category: 'basics',
    defaultValues: {
      object: 'resultat',
      expected: '10',
      required: true,
    },
    generateRTest: (c) => {
      const obj = sanitizeRIdentifier(c.object || 'resultat');
      const expectedStr = String(c.expected ?? '').trim();

      return `tryCatch({
        if (!exists("${obj}", envir = .GlobalEnv)) return(FALSE)
        .val <- get("${obj}", envir = .GlobalEnv)
        .exp_str <- ${JSON.stringify(expectedStr)}
        .exp_obj <- tryCatch(eval(parse(text = .exp_str)), error = function(e) .exp_str)
        
        if (is.numeric(.val) && is.numeric(.exp_obj)) {
          isTRUE(all.equal(as.numeric(.val), as.numeric(.exp_obj), tolerance = 1e-4))
        } else {
          isTRUE(all.equal(.val, .exp_obj, check.attributes = FALSE)) || identical(.val, .exp_obj)
        }
      }, error = function(e) FALSE)`;
    },
    getSuccessMessage: (c) => {
      const obj = c.object || 'resultat';
      return `Le résultat stocké dans "${obj}" est parfaitement correct.`;
    },
    getFailureMessage: (c) => {
      const obj = c.object || 'resultat';
      const exp = c.expected ?? '';
      return `Le résultat de "${obj}" est incorrect. Résultat attendu : ${exp}.`;
    },
  },

  object_class: {
    type: 'object_class',
    label: "Classe / Type de l'objet",
    shortLabel: 'Classe / Type',
    description: "Vérifie que l'objet est du bon type (numeric, character, data.frame, etc.).",
    category: 'basics',
    defaultValues: {
      object: 'age',
      expected_class: 'numeric',
      required: true,
    },
    generateRTest: (c) => {
      const obj = sanitizeRIdentifier(c.object || 'x');
      const expectedClass = c.expected_class || 'numeric';

      return `tryCatch({
        if (!exists("${obj}", envir = .GlobalEnv)) return(FALSE)
        .val <- get("${obj}", envir = .GlobalEnv)
        .exp <- "${expectedClass}"
        
        if (.exp == "vector") {
          is.vector(.val) || is.atomic(.val)
        } else if (.exp == "numeric") {
          is.numeric(.val)
        } else if (.exp == "integer") {
          is.integer(.val) || (is.numeric(.val) && all(.val == as.integer(.val)))
        } else if (.exp == "character") {
          is.character(.val)
        } else if (.exp == "logical") {
          is.logical(.val)
        } else if (.exp == "factor") {
          is.factor(.val)
        } else if (.exp == "data.frame") {
          is.data.frame(.val)
        } else if (.exp == "matrix") {
          is.matrix(.val)
        } else if (.exp == "list") {
          is.list(.val)
        } else {
          .exp %in% class(.val) || inherits(.val, .exp)
        }
      }, error = function(e) FALSE)`;
    },
    getSuccessMessage: (c) => {
      const obj = c.object || 'x';
      const cls = c.expected_class || 'numeric';
      return `L'objet "${obj}" est bien de type "${cls}".`;
    },
    getFailureMessage: (c) => {
      const obj = c.object || 'x';
      const cls = c.expected_class || 'numeric';
      return `L'objet "${obj}" n'est pas du bon type. Type attendu : "${cls}".`;
    },
  },

  object_length: {
    type: 'object_length',
    label: "Longueur de l'objet (nombre d'éléments)",
    shortLabel: 'Longueur',
    description: "Vérifie le nombre d'éléments dans un vecteur ou une liste.",
    category: 'structure',
    defaultValues: {
      object: 'notes',
      length: 5,
      required: true,
    },
    generateRTest: (c) => {
      const obj = sanitizeRIdentifier(c.object || 'x');
      const len = parseInt(String(c.length ?? '0'), 10) || 0;

      return `tryCatch({
        if (!exists("${obj}", envir = .GlobalEnv)) return(FALSE)
        length(get("${obj}", envir = .GlobalEnv)) == ${len}
      }, error = function(e) FALSE)`;
    },
    getSuccessMessage: (c) => {
      const obj = c.object || 'x';
      const len = c.length ?? 0;
      return `L'objet "${obj}" contient bien ${len} élément${Number(len) > 1 ? 's' : ''}.`;
    },
    getFailureMessage: (c) => {
      const obj = c.object || 'x';
      const len = c.length ?? 0;
      return `L'objet "${obj}" doit contenir ${len} élément${Number(len) > 1 ? 's' : ''}.`;
    },
  },

  rows: {
    type: 'rows',
    label: 'Nombre de lignes (tableau ou matrice)',
    shortLabel: 'Nb de lignes',
    description: "Vérifie le nombre de lignes (nrow) d'un data.frame ou d'une matrice.",
    category: 'structure',
    defaultValues: {
      object: 'donnees',
      rows: 100,
      required: true,
    },
    generateRTest: (c) => {
      const obj = sanitizeRIdentifier(c.object || 'data');
      const r = parseInt(String(c.rows ?? '0'), 10) || 0;

      return `tryCatch({
        if (!exists("${obj}", envir = .GlobalEnv)) return(FALSE)
        nrow(get("${obj}", envir = .GlobalEnv)) == ${r}
      }, error = function(e) FALSE)`;
    },
    getSuccessMessage: (c) => {
      const obj = c.object || 'data';
      const r = c.rows ?? 0;
      return `Le tableau "${obj}" comporte bien ${r} ligne${Number(r) > 1 ? 's' : ''}.`;
    },
    getFailureMessage: (c) => {
      const obj = c.object || 'data';
      const r = c.rows ?? 0;
      return `Le tableau "${obj}" doit comporter ${r} ligne${Number(r) > 1 ? 's' : ''}.`;
    },
  },

  columns: {
    type: 'columns',
    label: 'Nombre de colonnes (tableau ou matrice)',
    shortLabel: 'Nb de colonnes',
    description: "Vérifie le nombre de colonnes (ncol) d'un data.frame ou d'une matrice.",
    category: 'structure',
    defaultValues: {
      object: 'donnees',
      columns: 5,
      required: true,
    },
    generateRTest: (c) => {
      const obj = sanitizeRIdentifier(c.object || 'data');
      const cols = parseInt(String(c.columns ?? '0'), 10) || 0;

      return `tryCatch({
        if (!exists("${obj}", envir = .GlobalEnv)) return(FALSE)
        ncol(get("${obj}", envir = .GlobalEnv)) == ${cols}
      }, error = function(e) FALSE)`;
    },
    getSuccessMessage: (c) => {
      const obj = c.object || 'data';
      const cols = c.columns ?? 0;
      return `Le tableau "${obj}" comporte bien ${cols} colonne${Number(cols) > 1 ? 's' : ''}.`;
    },
    getFailureMessage: (c) => {
      const obj = c.object || 'data';
      const cols = c.columns ?? 0;
      return `Le tableau "${obj}" doit comporter ${cols} colonne${Number(cols) > 1 ? 's' : ''}.`;
    },
  },

  column_exists: {
    type: 'column_exists',
    label: "Présence d'une colonne dans un tableau",
    shortLabel: 'Colonne existe',
    description: "Vérifie qu'un data.frame contient une colonne avec un nom précis.",
    category: 'structure',
    defaultValues: {
      object: 'donnees',
      column: 'age',
      required: true,
    },
    generateRTest: (c) => {
      const obj = sanitizeRIdentifier(c.object || 'data');
      const col = sanitizeRIdentifier(c.column || 'col');

      return `tryCatch({
        if (!exists("${obj}", envir = .GlobalEnv)) return(FALSE)
        .val <- get("${obj}", envir = .GlobalEnv)
        "${col}" %in% names(.val) || "${col}" %in% colnames(.val)
      }, error = function(e) FALSE)`;
    },
    getSuccessMessage: (c) => {
      const obj = c.object || 'data';
      const col = c.column || 'col';
      return `La colonne "${col}" est bien présente dans le tableau "${obj}".`;
    },
    getFailureMessage: (c) => {
      const obj = c.object || 'data';
      const col = c.column || 'col';
      return `La colonne "${col}" est introuvable dans le tableau "${obj}".`;
    },
  },

  expression: {
    type: 'expression',
    label: 'Expression R personnalisée',
    shortLabel: 'Expression R',
    description: "Exécute une expression R libre retournant TRUE ou FALSE.",
    category: 'custom',
    defaultValues: {
      expression: 'moyenne == 15',
      description: 'La moyenne doit valoir 15',
      required: true,
    },
    generateRTest: (c) => {
      const expr = (c.expression || 'TRUE').trim();
      return `tryCatch({
        .res <- eval(parse(text = ${JSON.stringify(expr)}), envir = .GlobalEnv)
        isTRUE(.res) || (is.logical(.res) && length(.res) == 1 && .res == TRUE)
      }, error = function(e) FALSE)`;
    },
    getSuccessMessage: (c) => {
      return c.description ? `✓ ${c.description}` : `La condition "${c.expression}" est validée.`;
    },
    getFailureMessage: (c) => {
      return c.description ? `✗ ${c.description}` : `La condition "${c.expression}" n'est pas remplie.`;
    },
  },
};

/**
 * Creates an empty criterion object with default values
 */
export function createDefaultCriterion(type: RCorrectionCriterionType = 'object_exists'): RCorrectionCriterion {
  const def = R_CORRECTION_TEST_TYPES[type];
  return {
    id: `crit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    required: true,
    ...def.defaultValues,
  };
}

/**
 * Normalizes configuration object to extract structured RCorrectionCriterion array
 */
export function normalizeRCorrectionCriteria(configuration: any): RCorrectionCriterion[] {
  if (!configuration) return [];

  // 1. New structured format: configuration.correction.tests
  if (configuration.correction && Array.isArray(configuration.correction.tests)) {
    return configuration.correction.tests.map((t: any, idx: number) => ({
      id: t.id || `crit_${idx}_${Date.now()}`,
      type: t.type in R_CORRECTION_TEST_TYPES ? t.type : 'object_exists',
      required: t.required !== false,
      object: t.object || '',
      expected: t.expected !== undefined ? t.expected : '',
      expected_class: t.expected_class || 'numeric',
      length: t.length !== undefined ? t.length : 1,
      rows: t.rows !== undefined ? t.rows : 1,
      columns: t.columns !== undefined ? t.columns : 1,
      column: t.column || '',
      expression: t.expression || '',
      description: t.description || '',
    }));
  }

  // 2. Direct tests array format: configuration.tests
  if (Array.isArray(configuration.tests)) {
    return configuration.tests.map((t: any, idx: number) => ({
      id: t.id || `crit_${idx}_${Date.now()}`,
      type: t.type in R_CORRECTION_TEST_TYPES ? t.type : 'expression',
      required: t.required !== false,
      object: t.object || '',
      expected: t.expected !== undefined ? t.expected : '',
      expected_class: t.expected_class || 'numeric',
      length: t.length !== undefined ? t.length : 1,
      rows: t.rows !== undefined ? t.rows : 1,
      columns: t.columns !== undefined ? t.columns : 1,
      column: t.column || '',
      expression: t.expression || t.code || t.test || '',
      description: t.description || t.name || '',
    }));
  }

  return [];
}

/**
 * Executes student R code and verifies all criteria inside WebR
 */
export async function runWebRCorrectionSuite(
  studentCode: string,
  criteria: RCorrectionCriterion[],
  options: { timeoutMs?: number; packages?: string[] } = {}
): Promise<RCorrectionSuiteResult> {
  const startTime = performance.now();
  const timeoutMs = options.timeoutMs || 30000;
  const packages = options.packages || [];

  if (!criteria || criteria.length === 0) {
    return {
      success: true,
      totalTests: 0,
      passedTests: 0,
      totalRequired: 0,
      passedRequired: 0,
      scorePercentage: 100,
      hasStudentCodeError: false,
      testResults: [],
      executionTimeMs: 0,
    };
  }

  // Ensure WebR engine is ready
  if (!webrEngine.isReady()) {
    await webrEngine.init();
  }

  const webR = webrEngine.getWebR();
  if (!webR) {
    throw new Error("Le moteur R n'est pas accessible.");
  }

  // Prepare and install packages if needed
  if (packages.length > 0) {
    try {
      await prepareActivityRPackages(packages);
    } catch (pkgPrepErr) {
      console.warn("Avertissement lors de la préparation des packages pour la correction:", pkgPrepErr);
    }
  }

  let shelter: any = null;

  try {
    shelter = await new webR.Shelter();

    // 1. Reset GlobalEnv to keep clean state
    await shelter.evalR("rm(list = ls(envir = .GlobalEnv, all.names = TRUE), envir = .GlobalEnv)");

    // 1.b Load required packages inside the active session
    if (packages.length > 0) {
      for (const pkg of packages) {
        try {
          await shelter.evalR(`suppressPackageStartupMessages(library("${pkg}", character.only = TRUE, quietly = TRUE))`);
        } catch (pkgLoadErr) {
          console.warn(`Impossible de charger le package « ${pkg} » dans le shelter de correction:`, pkgLoadErr);
        }
      }
    }

    // 2. Execute student code with condition capture
    let studentErrors: string[] = [];
    try {
      const studentCapture = await shelter.captureR(studentCode || '', {
        withAutoprint: true,
        captureStreams: true,
        captureConditions: true,
      });

      if (studentCapture.output && Array.isArray(studentCapture.output)) {
        studentCapture.output.forEach((out: any) => {
          if (out.type === 'error') {
            studentErrors.push(out.data?.message || String(out.data || ''));
          }
        });
      }
    } catch (evalErr: any) {
      studentErrors.push(evalErr?.message || "Erreur d'exécution de votre code R.");
    }

    // If student code failed to execute, fail all tests with user-friendly error
    if (studentErrors.length > 0) {
      const firstError = studentErrors[0];
      const testResults: RTestEvaluationResult[] = criteria.map((c) => {
        const def = R_CORRECTION_TEST_TYPES[c.type] || R_CORRECTION_TEST_TYPES.object_exists;
        return {
          criterion: c,
          passed: false,
          isRequired: c.required !== false,
          message: def.getFailureMessage(c),
          error: "Non évalué en raison d'une erreur dans votre code R.",
        };
      });

      await shelter.purge();

      return {
        success: false,
        totalTests: criteria.length,
        passedTests: 0,
        totalRequired: criteria.filter((c) => c.required !== false).length,
        passedRequired: 0,
        scorePercentage: 0,
        hasStudentCodeError: true,
        studentErrorMessage: firstError,
        testResults,
        executionTimeMs: Math.round(performance.now() - startTime),
      };
    }

    // 3. Evaluate each criterion in the SAME WebR session / Shelter
    const testResults: RTestEvaluationResult[] = [];
    let passedCount = 0;
    let passedRequiredCount = 0;
    const requiredCriteria = criteria.filter((c) => c.required !== false);
    const totalRequired = requiredCriteria.length;

    for (const criterion of criteria) {
      const def = R_CORRECTION_TEST_TYPES[criterion.type] || R_CORRECTION_TEST_TYPES.object_exists;
      const isRequired = criterion.required !== false;
      const rTestCode = def.generateRTest(criterion);

      let isPassed = false;
      let evalError: string | undefined = undefined;

      try {
        const testRes = await shelter.evalR(rTestCode);
        const jsRes = await testRes.toJs();
        const rawVal = jsRes?.values ? jsRes.values[0] : jsRes;
        isPassed = rawVal === true || rawVal === 1;
      } catch (err: any) {
        console.warn(`Erreur évaluation test ${criterion.type}:`, err);
        isPassed = false;
        evalError = err?.message;
      }

      if (isPassed) {
        passedCount++;
        if (isRequired) passedRequiredCount++;
      }

      testResults.push({
        criterion,
        passed: isPassed,
        isRequired,
        message: isPassed ? def.getSuccessMessage(criterion) : def.getFailureMessage(criterion),
        error: evalError,
      });
    }

    await shelter.purge();

    // Success if all REQUIRED tests passed
    const isGlobalSuccess = totalRequired > 0 ? passedRequiredCount === totalRequired : passedCount === criteria.length;
    const scorePercentage = criteria.length > 0 ? Math.round((passedCount / criteria.length) * 100) : 100;

    return {
      success: isGlobalSuccess,
      totalTests: criteria.length,
      passedTests: passedCount,
      totalRequired,
      passedRequired: passedRequiredCount,
      scorePercentage,
      hasStudentCodeError: false,
      testResults,
      executionTimeMs: Math.round(performance.now() - startTime),
    };
  } catch (globalErr: any) {
    if (shelter) {
      try {
        await shelter.purge();
      } catch {
        // ignore
      }
    }

    const testResults: RTestEvaluationResult[] = criteria.map((c) => {
      const def = R_CORRECTION_TEST_TYPES[c.type] || R_CORRECTION_TEST_TYPES.object_exists;
      return {
        criterion: c,
        passed: false,
        isRequired: c.required !== false,
        message: def.getFailureMessage(c),
        error: globalErr?.message || "Erreur d'évaluation",
      };
    });

    return {
      success: false,
      totalTests: criteria.length,
      passedTests: 0,
      totalRequired: criteria.filter((c) => c.required !== false).length,
      passedRequired: 0,
      scorePercentage: 0,
      hasStudentCodeError: true,
      studentErrorMessage: globalErr?.message || "Erreur inattendue du moteur R.",
      testResults,
      executionTimeMs: Math.round(performance.now() - startTime),
    };
  }
}
