/**
 * WebR Interactive Execution Engine
 * 
 * Executes R code directly in the client's browser using WebAssembly (WebR).
 * Zero server-side R computation — fully sandboxed, private, and client-side.
 * 
 * Features:
 * - Lazy dynamic loading: WebR Wasm binary is only fetched when explicitly initialized.
 * - Non-blocking execution running in background Web Worker (via WebR Channel).
 * - Mobile-friendly with clear status lifecycle (idle -> loading -> ready -> running -> error).
 * - Output & error streaming with stdout, stderr, warnings, and structured execution metrics.
 * - Clean teardown and timeout support.
 */

import {
  ensurePackagesForCode,
  extractPackageRequirements,
  isPackageInstalled,
  installWebRPackage,
  uninstallWebRPackage,
  restorePersistedPackages,
  getPersistedPackages,
  removePersistedPackage,
  getTrackedPackages,
  PackageStatusInfo,
  PackageInstallResult,
  PackageProgressEvent,
  WEBR_KNOWN_PACKAGES,
} from './webrPackages';

export * from './webrPackages';

/**
 * Normalizes R code for deterministic fragment comparison:
 * 1. Strips comments (# to end of line).
 * 2. Normalizes smart quotes into standard quotes.
 * 3. Normalizes single quotes to double quotes.
 * 4. Normalizes assignment operators (treats '<-' and '=' as equivalent '=').
 * 5. Strips extra whitespace around syntax delimiters (=, ,, (, ), [, ], {, }, +, -, *, /, :, ;, <, >, !, &, |).
 * 6. Collapses multiple whitespace into a single space.
 */
export function normalizeRFragment(code: string): string {
  if (!code) return '';
  return code
    .split('\n')
    .map(line => line.replace(/#.*$/, ''))
    .join(' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/'/g, '"')
    .replace(/<-\s*/g, '=')
    .replace(/\s*([=,()\[\]{}+*/:;<>!&|])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if student code contains the required code fragment after normalization.
 * Respects boundary tokens so that e.g. x <- 5 does not falsely match x <- 50.
 */
export function doesCodeContainFragment(studentCode: string, fragment: string): boolean {
  const normStudent = normalizeRFragment(studentCode);
  const normFragment = normalizeRFragment(fragment);
  
  if (!normFragment) return true;
  if (!normStudent) return false;

  // Escape special regex characters in normFragment
  const escaped = normFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Boundary check: if starts with word character, ensure word boundary before
  const prefix = /^[a-zA-Z0-9_]/.test(normFragment) ? '(?:^|[^a-zA-Z0-9_.])' : '';
  // Boundary check: if ends with word character, ensure word boundary after
  const suffix = /[a-zA-Z0-9_]$/.test(normFragment) ? '(?![a-zA-Z0-9_.])' : '';

  const regex = new RegExp(prefix + escaped + suffix);
  return regex.test(normStudent);
}

export type WebRStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error';

export interface RObjectDataFramePreview {
  columns: string[];
  rows: string[][];
  totalRows: number;
  totalCols: number;
}

export interface RObjectInfo {
  name: string;
  className: string;
  type: string;
  length: number;
  dimensions?: [number, number] | null;
  previewType: 'dataframe' | 'vector' | 'summary' | 'scalar';
  previewData?: any;
}

export interface WebRExecuteOptions {
  timeoutMs?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  canvasPointSize?: number;
}

export interface WebRExecutionResult {
  success: boolean;
  output: string;
  stdout: string[];
  stderr: string[];
  warnings: string[];
  errors: string[];
  executionTimeMs: number;
  resultValue?: any;
  graphicDataUrl?: string; // Gardé pour rétro-compatibilité (premier graphique)
  graphics?: string[];     // Liste de tous les graphiques générés
}

export interface RTestCase {
  code: string;
  description: string;
}

export interface RTestResultDetail {
  description: string;
  passed: boolean;
}

export interface ValidateCodeOptions {
  timeoutMs?: number;
  expectedOutput?: string | null;
}

export interface RValidationResult {
  success: boolean;
  passed: number;
  total: number;
  tests: RTestResultDetail[];
  error?: string;
  executionTimeMs: number;
}

export interface WebREngineState {
  status: WebRStatus;
  statusMessage: string;
  isReady: boolean;
  isRunning: boolean;
  error: string | null;
}

export type WebRStateListener = (state: WebREngineState) => void;

class WebREngine {
  private static instance: WebREngine | null = null;
  private webRInstance: any = null;
  private initPromise: Promise<void> | null = null;
  private status: WebRStatus = 'idle';
  private statusMessage: string = 'Environnement R non initialisé.';
  private error: string | null = null;
  private listeners: Set<WebRStateListener> = new Set();

  private constructor() {
    // Singleton
  }

  public static getInstance(): WebREngine {
    if (!WebREngine.instance) {
      WebREngine.instance = new WebREngine();
    }
    return WebREngine.instance;
  }

  /**
   * Current snapshot of the WebR Engine state.
   */
  public getState(): WebREngineState {
    return {
      status: this.status,
      statusMessage: this.statusMessage,
      isReady: this.status === 'ready',
      isRunning: this.status === 'running',
      error: this.error,
    };
  }

  /**
   * Subscribe to state updates (e.g. status changes from loading -> ready -> running).
   */
  public subscribe(listener: WebRStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('Error in WebR listener callback:', err);
      }
    });
  }

  private setStatus(status: WebRStatus, message: string, error: string | null = null): void {
    this.status = status;
    this.statusMessage = message;
    this.error = error;
    this.notify();
  }

  /**
   * Checks if the WebR engine is initialized and ready to execute R code.
   */
  public isReady(): boolean {
    return this.status === 'ready' && this.webRInstance !== null;
  }

  /**
   * Checks if WebR is currently busy executing an R script.
   */
  public isRunning(): boolean {
    return this.status === 'running';
  }

  /**
   * Initialize WebR with dynamic lazy loading.
   * Does NOT block the app startup.
   * Uses self-hosted WebAssembly assets from /webr/ and a 45s timeout.
   */
  public async init(): Promise<void> {
    // If already ready, return immediately
    if (this.isReady()) {
      return;
    }

    // If already in progress of initializing, await the existing promise
    if (this.initPromise) {
      return this.initPromise;
    }

    const overallTimeoutMs = 120000;
    let overallTimeoutId: NodeJS.Timeout | null = null;

    this.initPromise = (async () => {
      try {
        this.setStatus('loading', "Chargement de l'environnement R...");

        const timeoutPromise = new Promise<never>((_, reject) => {
          overallTimeoutId = setTimeout(() => {
            reject(new Error("Le chargement de R a dépassé le délai imparti. Vérifiez votre connexion internet puis réessayez."));
          }, overallTimeoutMs);
        });

        const loadPromise = (async () => {
          // Dynamic import to guarantee zero bundle overhead on initial page load
          const { WebR, ChannelType } = await import('webr');

          // Helper to verify that an initialized WebR instance can safely execute R code
          const verifyInstance = async (instance: any) => {
            const ok = await instance.evalRBoolean('TRUE');
            if (!ok) throw new Error('Échec de la validation de base de WebR.');
            return instance;
          };

          const isIsolated = typeof window !== 'undefined' && window.crossOriginIsolated === true;
          const preferredChannel = isIsolated ? ChannelType.Automatic : ChannelType.PostMessage;

          const localBaseUrl = typeof window !== 'undefined' && window.location?.origin
            ? `${window.location.origin}/webr/`
            : '/webr/';

          const strategies: Array<{ name: string; options: any; timeoutMs: number }> = [
            // Strategy 1: Official CDN with PostMessage (Highest reliability across all browsers/iframes)
            {
              name: 'CDN WebR (https://webr.r-wasm.org/v0.6.0/)',
              options: {
                baseUrl: 'https://webr.r-wasm.org/v0.6.0/',
                repoUrl: 'https://repo.r-wasm.org',
                channelType: ChannelType.PostMessage,
              },
              timeoutMs: 45000,
            },
            // Strategy 2: Local self-hosted runtime with absolute URL
            {
              name: 'Local self-hosted (Absolute URL)',
              options: {
                baseUrl: localBaseUrl,
                repoUrl: 'https://repo.r-wasm.org',
                channelType: preferredChannel,
              },
              timeoutMs: 30000,
            },
            // Strategy 3: Local fallback (Relative path)
            {
              name: 'Local fallback (Relative path)',
              options: {
                baseUrl: '/webr/',
                repoUrl: 'https://repo.r-wasm.org',
                channelType: ChannelType.PostMessage,
              },
              timeoutMs: 30000,
            },
            // Strategy 4: Default WebR package setup
            {
              name: 'Default package options',
              options: {
                channelType: ChannelType.PostMessage,
              },
              timeoutMs: 25000,
            },
          ];

          let lastError: any = null;
          for (const strat of strategies) {
            let stratTimer: NodeJS.Timeout | null = null;
            let currentWebRInstance: any = null;

            try {
              console.log(`[WebR] Tentative d'initialisation via : ${strat.name}...`);
              currentWebRInstance = new WebR(strat.options);

              const stratTimeoutPromise = new Promise<never>((_, reject) => {
                stratTimer = setTimeout(() => {
                  reject(new Error(`Timeout de ${strat.timeoutMs}ms dépassé pour ${strat.name}`));
                }, strat.timeoutMs);
              });

              await Promise.race([currentWebRInstance.init(), stratTimeoutPromise]);
              await Promise.race([verifyInstance(currentWebRInstance), stratTimeoutPromise]);

              if (stratTimer) clearTimeout(stratTimer);
              console.log(`[WebR] Initialisation réussie avec succès via : ${strat.name}`);
              return currentWebRInstance;
            } catch (err: any) {
              if (stratTimer) clearTimeout(stratTimer);
              console.warn(`[WebR] Échec avec ${strat.name} :`, err?.message || err);
              lastError = err;
              if (currentWebRInstance && typeof currentWebRInstance.close === 'function') {
                try {
                  await currentWebRInstance.close();
                } catch {
                  // Ignore cleanup error
                }
              }
            }
          }

          throw lastError || new Error("Impossible d'initialiser le worker WebR.");
        })();

        const webR = await Promise.race([loadPromise, timeoutPromise]);
        if (overallTimeoutId) clearTimeout(overallTimeoutId);

        this.webRInstance = webR;
        this.setStatus('ready', 'R est prêt.');

        // Restauration automatique et non-bloquante des packages enregistrés par l'utilisateur
        restorePersistedPackages(webR).then((restored) => {
          if (restored.length > 0) {
            console.log(`[WebR] ${restored.length} package(s) restauré(s) avec succès : ${restored.join(', ')}`);
          }
        }).catch((e) => {
          console.warn('[WebR] Restauration des packages:', e);
        });
      } catch (err: any) {
        if (overallTimeoutId) clearTimeout(overallTimeoutId);
        console.error("Échec de l'initialisation de WebR :", err);
        const errMsg = err?.message || "Impossible de charger le moteur R dans ce navigateur.";
        this.setStatus('error', errMsg, errMsg);
        this.webRInstance = null;
        throw new Error(errMsg);
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Execute an arbitrary R code block and capture all outputs (stdout, stderr, warnings, return value).
   * 
   * @param code The R script to execute
   * @param options Configuration options such as execution timeout
   */
  public async execute(
    code: string,
    options: WebRExecuteOptions = {}
  ): Promise<WebRExecutionResult> {
    if (!this.isReady()) {
      // Auto-initialize if not done yet
      await this.init();
    }

    if (!this.webRInstance) {
      throw new Error("Le moteur R n'est pas disponible.");
    }

    if (this.status === 'running') {
      throw new Error("Une exécution R est déjà en cours. Veuillez patienter.");
    }

    const startTime = performance.now();
    this.setStatus('running', 'Exécution du code R...');

    const stdout: string[] = [];
    const stderr: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // Step 0: Detect and prepare any requested packages (library, require, install.packages, pkg::...)
    try {
      const pkgReqs = extractPackageRequirements(code);
      const hasPkgs = pkgReqs.requiredPackages.length > 0 || pkgReqs.explicitInstalls.length > 0 || pkgReqs.namespacePackages.length > 0;

      if (hasPkgs) {
        this.setStatus('running', 'Vérification et installation des packages R...');
        const pkgPrep = await ensurePackagesForCode(this.webRInstance, code, (evt) => {
          this.setStatus('running', evt.message);
        });

        if (pkgPrep.messages && pkgPrep.messages.length > 0) {
          stdout.push(...pkgPrep.messages);
        }

        if (!pkgPrep.success && pkgPrep.failedPackages.length > 0) {
          const failedList = pkgPrep.failedPackages.join(', ');
          const pkgErrorMsg = `❌ Impossible d'utiliser le(s) package(s) : ${failedList}.\nCe(s) package(s) ne sont pas disponibles sous forme de binaires WebAssembly compatibles avec WebR ou une erreur réseau est survenue.`;
          errors.push(pkgErrorMsg);
          this.setStatus('ready', 'R est prêt.');

          const outputLines: string[] = [...stdout, `[Error] ${pkgErrorMsg}`];
          return {
            success: false,
            output: outputLines.join('\n'),
            stdout,
            stderr,
            warnings,
            errors,
            executionTimeMs: Math.round(performance.now() - startTime),
          };
        }
      }
    } catch (pkgErr: any) {
      console.warn("Erreur lors de la préparation des packages:", pkgErr);
    }

    const timeoutMs = options.timeoutMs || 45000; // 45s timeout default for package workloads
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Create a Shelter for safe R evaluation and memory cleanup
      const shelter = await new this.webRInstance.Shelter();

      // Configure graphic device dimensions dynamically based on requested options
      const canvasWidth = options.canvasWidth;
      const canvasHeight = options.canvasHeight;
      const pointSize = options.canvasPointSize || (canvasWidth && Math.min(canvasWidth, canvasHeight || 600) >= 800 ? 14 : 12);

      if (canvasWidth && canvasHeight) {
        await shelter.evalR(`
          options(
            webr.fig.width = ${Math.round(canvasWidth)},
            webr.fig.height = ${Math.round(canvasHeight)},
            webr.fig.pointsize = ${pointSize}
          )
        `);
      } else {
        // Standard normal default: 504x504, pointsize 12
        await shelter.evalR(`
          options(
            webr.fig.width = 504,
            webr.fig.height = 504,
            webr.fig.pointsize = 12
          )
        `);
      }

      // Define harmless install.packages shim inside shelter so R doesn't attempt CRAN source compilation
      await shelter.evalR(`
        install.packages <- function(pkgs, ...) {
          invisible(NULL)
        }
      `);

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Délai d'exécution dépassé (${Math.round(timeoutMs / 1000)}s).`));
        }, timeoutMs);
      });

      const executionPromise = (async () => {
        // Execute R code with stream and condition capture
        const capture = await shelter.captureR(code, {
          withAutoprint: true,
          captureStreams: true,
          captureConditions: true,
        });

        // Extract graphics if generated (via webr::canvas())
        const graphics: string[] = [];
        try {
          if (capture.images && capture.images.length > 0) {
            for (const imgBitmap of capture.images) {
              const canvas = document.createElement('canvas');
              canvas.width = imgBitmap.width;
              canvas.height = imgBitmap.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(imgBitmap, 0, 0);
                graphics.push(canvas.toDataURL('image/png'));
              }
            }
          }
        } catch (e) {
          console.warn("Failed to extract ImageBitmap:", e);
        }

        // Extract console outputs
        if (capture.output && Array.isArray(capture.output)) {
          capture.output.forEach((outObj: any) => {
            if (outObj.type === 'stdout' && outObj.data !== undefined) {
              const text = String(outObj.data);
              stdout.push(text);
            } else if (outObj.type === 'stderr' && outObj.data !== undefined) {
              const text = String(outObj.data);
              stderr.push(text);
            } else if (outObj.type === 'warning') {
              const text = outObj.data?.message || String(outObj.data || '');
              warnings.push(text);
            } else if (outObj.type === 'error') {
              const text = outObj.data?.message || String(outObj.data || '');
              errors.push(text);
            }
          });
        }

        // Try converting final evaluated result if available
        let resultValue: any = undefined;
        try {
          if (capture.result) {
            resultValue = await capture.result.toJs();
          }
        } catch {
          // Ignored if object cannot be serialized to JS
        }

        // Purge shelter memory objects
        await shelter.purge();

        return { resultValue, graphics };
      })();

      const { resultValue, graphics } = await Promise.race([executionPromise, timeoutPromise]);

      if (timeoutId) clearTimeout(timeoutId);

      const endTime = performance.now();
      const executionTimeMs = Math.round(endTime - startTime);

      const isSuccess = errors.length === 0;

      // Construct formatted consolidated output string
      const outputLines: string[] = [];
      if (stdout.length > 0) {
        outputLines.push(...stdout);
      }
      if (warnings.length > 0) {
        warnings.forEach(w => outputLines.push(`[Warning] ${w}`));
      }
      if (stderr.length > 0) {
        stderr.forEach(e => outputLines.push(`[Stderr] ${e}`));
      }
      if (errors.length > 0) {
        errors.forEach(e => outputLines.push(`[Error] ${e}`));
      }

      this.setStatus('ready', 'R est prêt.');

      return {
        success: isSuccess,
        output: outputLines.join('\n'),
        stdout,
        stderr,
        warnings,
        errors,
        executionTimeMs,
        resultValue,
        graphics,
        graphicDataUrl: graphics.length > 0 ? graphics[0] : undefined,
      };
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);

      const endTime = performance.now();
      const executionTimeMs = Math.round(endTime - startTime);
      const errorMessage = err?.message || "Impossible d'exécuter le code R.";

      errors.push(errorMessage);
      this.setStatus('ready', 'R est prêt.');

      return {
        success: false,
        output: `[Erreur d'exécution R] : ${errorMessage}`,
        stdout,
        stderr,
        warnings,
        errors,
        executionTimeMs,
      };
    }
  }

  /**
   * Automatically validates student R code against a series of criteria (test cases).
   * 
   * Security & Privacy:
   * - Evaluates student code and each test case safely inside an isolated WebR Shelter.
   * - Never exposes raw test code in the result object; only returns the description and passed status.
   * - Traps all R conditions/errors to prevent leaking internal test structures.
   * 
   * @param code The student's R code to test
   * @param testCases Array of test objects { code, description }, string array, or serialized JSON string
   * @param options Configuration options such as execution timeout
   */
  public async validateCode(
    code: string,
    testCases: RTestCase[] | string | any,
    options: ValidateCodeOptions = {}
  ): Promise<RValidationResult> {
    // Parse and normalize test cases safely
    let rawTestCases: any[] = [];
    if (typeof testCases === 'string') {
      try {
        const parsed = JSON.parse(testCases);
        if (Array.isArray(parsed)) {
          rawTestCases = parsed;
        } else if (parsed && typeof parsed === 'object') {
          rawTestCases = Array.isArray(parsed.test_cases) ? parsed.test_cases : (Array.isArray(parsed.tests) ? parsed.tests : []);
        }
      } catch {
        rawTestCases = [];
      }
    } else if (Array.isArray(testCases)) {
      rawTestCases = testCases;
    } else if (testCases && typeof testCases === 'object') {
      rawTestCases = Array.isArray(testCases.test_cases) ? testCases.test_cases : (Array.isArray(testCases.tests) ? testCases.tests : []);
    }

    // Normalize each test item
    const validTestCases: RTestCase[] = [];
    rawTestCases.forEach((tc) => {
      if (!tc) return;
      if (typeof tc === 'string' && tc.trim().length > 0) {
        validTestCases.push({
          code: tc.trim(),
          description: tc.trim()
        });
      } else if (typeof tc === 'object') {
        const testCode = tc.code || tc.test || tc.expression || tc.test_code || tc.r_code || '';
        const desc = tc.description || tc.name || tc.title || tc.label || testCode || 'Critère de validation';
        if (typeof testCode === 'string' && testCode.trim().length > 0) {
          validTestCases.push({
            code: testCode.trim(),
            description: desc
          });
        }
      }
    });

    const expOutStr = options.expectedOutput ? options.expectedOutput.trim() : '';
    const totalTestsCount = validTestCases.length + (expOutStr ? 1 : 0);

    // Filter out comments from student code to ensure actual R statements were typed
    const executableCode = (code || '')
      .split('\n')
      .map((line) => line.replace(/#.*$/, ''))
      .join('')
      .trim();

    if (!executableCode) {
      const emptyTests: RTestResultDetail[] = [];
      if (expOutStr) {
        emptyTests.push({ description: `Résultat attendu : "${expOutStr}"`, passed: false });
      }
      validTestCases.forEach((tc) => {
        emptyTests.push({ description: tc.description || 'Critère de validation', passed: false });
      });

      return {
        success: false,
        passed: 0,
        total: Math.max(totalTestsCount, 1),
        tests: emptyTests.length > 0 ? emptyTests : [{ description: 'Saisie de code R', passed: false }],
        error: "Veuillez d'abord saisir votre code R avant de valider l'exercice.",
        executionTimeMs: 0,
      };
    }

    // If no test cases defined and no expected output, reject validation
    if (totalTestsCount === 0) {
      return {
        success: false,
        passed: 0,
        total: 0,
        tests: [],
        error: "Aucun critère de validation (test unitaire ou résultat attendu) n'est configuré pour cet exercice.",
        executionTimeMs: 0,
      };
    }

    if (!this.isReady()) {
      await this.init();
    }

    if (!this.webRInstance) {
      throw new Error("Le moteur R n'est pas disponible.");
    }

    if (this.status === 'running') {
      throw new Error("Une exécution R est déjà en cours. Veuillez patienter.");
    }

    const startTime = performance.now();
    this.setStatus('running', 'Validation des critères R...');

    // Step 0: Ensure packages required by student code are prepared
    try {
      const pkgReqs = extractPackageRequirements(code);
      const hasPkgs = pkgReqs.requiredPackages.length > 0 || pkgReqs.explicitInstalls.length > 0 || pkgReqs.namespacePackages.length > 0;

      if (hasPkgs) {
        this.setStatus('running', 'Préparation des packages R pour la validation...');
        const pkgPrep = await ensurePackagesForCode(this.webRInstance, code);

        if (!pkgPrep.success && pkgPrep.failedPackages.length > 0) {
          const failedList = pkgPrep.failedPackages.join(', ');
          const errText = `Le package requis « ${failedList} » n'a pas pu être installé ou n'est pas disponible pour WebR.`;
          const failedTests: RTestResultDetail[] = validTestCases.map(tc => ({
            description: tc.description || 'Critère de validation',
            passed: false,
          }));
          if (expOutStr) {
            failedTests.unshift({
              description: `Résultat attendu : "${expOutStr}"`,
              passed: false,
            });
          }

          this.setStatus('ready', 'R est prêt.');
          return {
            success: false,
            passed: 0,
            total: Math.max(totalTestsCount, 1),
            tests: failedTests,
            error: `❌ Échec de la préparation des packages : ${errText}`,
            executionTimeMs: Math.round(performance.now() - startTime),
          };
        }
      }
    } catch (pkgErr: any) {
      console.warn("Erreur lors de la préparation des packages pour validation:", pkgErr);
    }

    const timeoutMs = options.timeoutMs || 45000;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Create isolated Shelter
      const shelter = await new this.webRInstance.Shelter();

      // Define harmless install.packages shim inside shelter
      await shelter.evalR(`
        install.packages <- function(pkgs, ...) {
          invisible(NULL)
        }
      `);

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Délai d'exécution dépassé (${Math.round(timeoutMs / 1000)}s).`));
        }, timeoutMs);
      });

      const validationPromise = (async (): Promise<RValidationResult> => {
        // Ensure global environment is clean before evaluating student code
        await shelter.evalR("rm(list = ls(envir = .GlobalEnv, all.names = TRUE), envir = .GlobalEnv)");

        // Step 1: Execute student code with stream & condition capture ONCE
        let studentCapture: any = null;
        let studentErrors: string[] = [];
        try {
          studentCapture = await shelter.captureR(code, {
            withAutoprint: true,
            captureStreams: true,
            captureConditions: true,
          });

          if (studentCapture.output && Array.isArray(studentCapture.output)) {
            studentCapture.output.forEach((outObj: any) => {
              if (outObj.type === 'error') {
                const text = outObj.data?.message || String(outObj.data || '');
                studentErrors.push(text);
              }
            });
          }
        } catch (captureErr: any) {
          studentErrors.push(captureErr?.message || "Erreur d'exécution dans votre code R.");
        }

        // If code fails to execute cleanly, all tests are marked failed
        if (studentErrors.length > 0) {
          await shelter.purge();
          const endTime = performance.now();
          
          const failedTests: RTestResultDetail[] = [];
          if (expOutStr) {
            failedTests.push({ description: `Résultat attendu : "${expOutStr}"`, passed: false });
          }
          validTestCases.forEach((tc) => {
            failedTests.push({ description: tc.description || 'Critère de validation', passed: false });
          });

          return {
            success: false,
            passed: 0,
            total: totalTestsCount,
            tests: failedTests,
            error: studentErrors[0] || "Erreur lors de l'exécution du code R.",
            executionTimeMs: Math.round(endTime - startTime),
          };
        }

        // Define validator function in R inside this shelter
        const rValidatorSetup = `
          .webr_validate_target <- function(target_raw, stdout_raw) {
            tryCatch({
              target_str <- trimws(target_raw)
              if (nchar(target_str) == 0) return(0L)
              
              strip_fmt <- function(s) {
                s <- gsub("\\\\[\\\\d+\\\\]", "", s)
                s <- gsub("[\\\\r\\\\n\\\\t]+", " ", s)
                trimws(s)
              }
              
              strip_quotes <- function(s) {
                gsub('^["\\\']|["\\\']$', '', s)
              }
              
              strip_all_quotes <- function(s) {
                gsub('["\\\']', '', s)
              }
              
              clean_target <- strip_fmt(target_str)
              if (nchar(clean_target) == 0) return(0L)
              
              unquoted_target <- strip_quotes(clean_target)
              all_unquoted_target <- strip_all_quotes(clean_target)
              
              clean_stdout <- strip_fmt(stdout_raw)
              unquoted_stdout <- strip_quotes(clean_stdout)
              all_unquoted_stdout <- strip_all_quotes(clean_stdout)
              
              # 1. Direct stdout comparison (only when stdout is non-empty)
              if (nchar(clean_stdout) > 0) {
                if (clean_stdout == clean_target || unquoted_stdout == unquoted_target || all_unquoted_stdout == all_unquoted_target) {
                  return(1L)
                }
              }
              
              # 2. Gather user created objects in .GlobalEnv
              vars <- ls(envir = .GlobalEnv, all.names = FALSE)
              user_objs <- list()
              for (v in vars) {
                if (!grepl("^\\\\.", v)) {
                  user_objs[[v]] <- get(v, envir = .GlobalEnv)
                }
              }
              
              if (length(user_objs) == 0 && nchar(clean_stdout) == 0) {
                return(0L)
              }
              
              # 3. Parse target as R expression (e.g. c(10, 12, 14, 16, 18), "Paul", 14, etc.)
              target_obj <- tryCatch(eval(parse(text = target_str)), error = function(e) {
                tryCatch(eval(parse(text = paste0('"', gsub('"', '\\\\"', target_str), '"'))), error = function(e2) NULL)
              })
              
              if (!is.null(target_obj)) {
                for (obj in user_objs) {
                  if (isTRUE(all.equal(obj, target_obj, check.attributes = FALSE)) || identical(obj, target_obj)) {
                    return(1L)
                  }
                }
              }
              
              # 4. Check user objects against multiple representations
              for (obj in user_objs) {
                if (is.atomic(obj)) {
                  s_space <- trimws(paste(as.character(obj), collapse = " "))
                  s_comma <- trimws(paste(as.character(obj), collapse = ", "))
                  s_comma_tight <- trimws(paste(as.character(obj), collapse = ","))
                  s_deparse <- trimws(paste(deparse(obj), collapse = ""))
                  
                  if (s_space == clean_target || s_space == unquoted_target || s_space == all_unquoted_target ||
                      s_comma == clean_target || s_comma == unquoted_target ||
                      s_comma_tight == clean_target || s_comma_tight == unquoted_target ||
                      s_deparse == clean_target || s_deparse == unquoted_target) {
                    return(1L)
                  }
                  
                  # Numeric scalar tolerance
                  if (is.numeric(obj) && length(obj) == 1) {
                    t_num <- suppressWarnings(as.numeric(gsub(",", ".", unquoted_target)))
                    if (!is.na(t_num) && abs(obj - t_num) < 0.001) {
                      return(1L)
                    }
                  }
                  
                  # Numeric vector tolerance
                  if (is.numeric(obj) && length(obj) > 1) {
                    num_tokens <- suppressWarnings(as.numeric(unlist(strsplit(gsub(",", " ", unquoted_target), "\\\\s+"))))
                    num_tokens <- num_tokens[!is.na(num_tokens)]
                    if (length(num_tokens) == length(obj)) {
                      if (isTRUE(all.equal(as.numeric(obj), num_tokens, tolerance = 0.001))) {
                        return(1L)
                      }
                    }
                  }
                  
                  # Character vector tolerance
                  if (is.character(obj) && length(obj) > 1) {
                    char_tokens <- unlist(strsplit(gsub(",", " ", all_unquoted_target), "\\\\s+"))
                    char_tokens <- char_tokens[nchar(char_tokens) > 0]
                    if (length(char_tokens) == length(obj)) {
                      if (all(obj == char_tokens)) {
                        return(1L)
                      }
                    }
                  }
                }
              }
              
              return(0L)
            }, error = function(e) 0L)
          }
        `;
        await shelter.evalR(rValidatorSetup);

        // Step 2: Check expected output if defined
        const testResults: RTestResultDetail[] = [];
        let passedCount = 0;

        if (expOutStr) {
          const actOutputTexts = studentCapture?.output || [];
          
          const actualTexts = actOutputTexts
            .filter((o: any) => o.type === 'stdout' || o.type === 'message')
            .map((o: any) => String(o.data || ''))
            .join('\n');

          const checkExpectedCode = `
            .webr_validate_target(
              ${JSON.stringify(expOutStr)},
              ${JSON.stringify(actualTexts)}
            )
          `;

          let expectedPassed = false;
          try {
            const expCheckRes = await shelter.evalR(checkExpectedCode);
            const jsExpVal = await expCheckRes.toJs();
            const rawVal = jsExpVal?.values ? jsExpVal.values[0] : jsExpVal;
            expectedPassed = rawVal === 1 || rawVal === true;
          } catch (e) {
            console.warn("Erreur lors de la validation du résultat attendu:", e);
            expectedPassed = false;
          }
          
          if (expectedPassed) {
            passedCount++;
          }
          
          testResults.push({
            description: `Résultat attendu : "${expOutStr}"`,
            passed: expectedPassed
          });
        }

        // Step 3: Pure textual verification for required code fragments (NO R-side eval)
        for (const tc of validTestCases) {
          const isPassed = doesCodeContainFragment(code, tc.code);
          if (isPassed) {
            passedCount++;
          }

          testResults.push({
            description: tc.description || 'Ligne de code requise',
            passed: isPassed,
          });
        }

        // Clean up shelter memory
        await shelter.purge();

        const endTime = performance.now();
        const allPassed = passedCount === totalTestsCount;

        return {
          success: allPassed,
          passed: passedCount,
          total: totalTestsCount,
          tests: testResults,
          executionTimeMs: Math.round(endTime - startTime),
        };
      })();

      const result = await Promise.race([validationPromise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);

      this.setStatus('ready', 'R est prêt.');
      return result;
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);

      const endTime = performance.now();
      const executionTimeMs = Math.round(endTime - startTime);
      const errorMessage = err?.message || "Impossible de valider le code R.";

      this.setStatus('ready', 'R est prêt.');

      const failedTests: RTestResultDetail[] = [];
      if (expOutStr) {
        failedTests.push({ description: `Résultat attendu : "${expOutStr}"`, passed: false });
      }
      validTestCases.forEach((tc) => {
        failedTests.push({ description: tc.description || 'Critère de validation', passed: false });
      });

      return {
        success: false,
        passed: 0,
        total: totalTestsCount,
        tests: failedTests,
        error: errorMessage,
        executionTimeMs,
      };
    }
  }

  /**
   * Returns a list of all objects currently defined in the R global workspace (.GlobalEnv).
   */
  public async getEnvironmentObjects(): Promise<RObjectInfo[]> {
    if (!this.isReady() || !this.webRInstance) {
      return [];
    }
    try {
      const shelter = await new this.webRInstance.Shelter();
      const inspectCode = `
        local({
          objs <- ls(envir = .GlobalEnv, all.names = FALSE)
          res <- list()
          for (name in objs) {
            if (startsWith(name, ".")) next
            val <- get(name, envir = .GlobalEnv)
            obj_class <- paste(class(val), collapse = ", ")
            obj_type <- typeof(val)
            
            dims <- NULL
            len <- length(val)
            if (is.data.frame(val) || is.matrix(val) || is.array(val)) {
              dims <- as.integer(dim(val))
            }
            
            p_type <- "scalar"
            p_data <- NULL
            
            if (is.data.frame(val)) {
              p_type <- "dataframe"
              cols <- colnames(val)
              nrows <- min(nrow(val), 50)
              rows <- list()
              if (nrows > 0 && length(cols) > 0) {
                for (i in 1:nrows) {
                  r_vals <- sapply(1:length(cols), function(j) {
                    v <- val[i, j]
                    if (is.null(v) || is.na(v)) "NA" else as.character(v)
                  })
                  rows[[i]] <- r_vals
                }
              }
              p_data <- list(columns = cols, rows = rows, totalRows = nrow(val), totalCols = length(cols))
            } else if (is.vector(val) || is.factor(val)) {
              p_type <- "vector"
              char_vals <- as.character(val)
              if (length(char_vals) <= 50) {
                p_data <- char_vals
              } else {
                p_data <- c(char_vals[1:45], paste("... (+", length(char_vals) - 45, "éléments)"))
              }
            } else {
              p_type <- "summary"
              p_data <- capture.output(str(val))
            }
            
            res[[name]] <- list(
              name = name,
              className = obj_class,
              type = obj_type,
              length = len,
              dimensions = dims,
              previewType = p_type,
              previewData = p_data
            )
          }
          res
        })
      `;
      const evalRes = await shelter.evalR(inspectCode);
      const jsVal = await evalRes.toJs();
      await shelter.purge();

      if (!jsVal || typeof jsVal !== 'object' || jsVal.type !== 'list' || !Array.isArray(jsVal.values)) {
        return [];
      }

      const resultList: RObjectInfo[] = [];
      for (let i = 0; i < jsVal.values.length; i++) {
        const item = jsVal.values[i];
        if (!item || item.type !== 'list' || !item.names || !item.values) continue;

        const getField = (fieldName: string) => {
          const idx = item.names.indexOf(fieldName);
          return idx !== -1 ? item.values[idx] : undefined;
        };
        const getScalar = (fieldName: string) => {
          const field = getField(fieldName);
          return field?.values ? field.values[0] : field;
        };
        const getArray = (fieldName: string) => {
          const field = getField(fieldName);
          return field?.values ? Array.from(field.values) : (Array.isArray(field) ? field : null);
        };
        const parsePreviewData = (fieldVal: any, previewType: string) => {
          if (!fieldVal) return undefined;
          if (previewType === 'vector' || previewType === 'summary') {
            return fieldVal.values ? Array.from(fieldVal.values) : fieldVal;
          }
          if (previewType === 'dataframe' && fieldVal.type === 'list' && fieldVal.names) {
            const getSubField = (fName: string) => {
              const idx = fieldVal.names.indexOf(fName);
              return idx !== -1 ? fieldVal.values[idx] : undefined;
            };
            const columnsField = getSubField('columns');
            const columns = columnsField?.values ? Array.from(columnsField.values) : [];

            const rowsField = getSubField('rows');
            const rows = [];
            if (rowsField && rowsField.type === 'list' && rowsField.values) {
              for (const rowItem of rowsField.values) {
                rows.push(rowItem?.values ? Array.from(rowItem.values) : []);
              }
            }

            const totalRowsField = getSubField('totalRows');
            const totalRows = totalRowsField?.values ? totalRowsField.values[0] : 0;

            const totalColsField = getSubField('totalCols');
            const totalCols = totalColsField?.values ? totalColsField.values[0] : 0;

            return { columns, rows, totalRows, totalCols };
          }
          return fieldVal?.values ? fieldVal.values[0] : fieldVal;
        };

        const name = getScalar('name');
        if (name) {
          const pType = getScalar('previewType') || 'scalar';
          resultList.push({
            name: String(name),
            className: String(getScalar('className') || 'object'),
            type: String(getScalar('type') || 'unknown'),
            length: Number(getScalar('length') || 0),
            dimensions: getArray('dimensions') as [number, number] | null,
            previewType: pType,
            previewData: parsePreviewData(getField('previewData'), pType),
          });
        }
      }
      return resultList;
    } catch (err) {
      console.warn("Erreur lors de la récupération des objets R:", err);
      return [];
    }
  }

  /**
   * Resets all variables and objects in the global R environment (.GlobalEnv).
   */
  public async resetEnvironment(): Promise<void> {
    if (!this.isReady() || !this.webRInstance) return;
    try {
      const shelter = await new this.webRInstance.Shelter();
      await shelter.evalR("rm(list = ls(envir = .GlobalEnv, all.names = TRUE), envir = .GlobalEnv)");
      await shelter.purge();
    } catch (err) {
      console.warn("Erreur réinitialisation environnement R:", err);
    }
  }

  /**
   * Installs an R package directly using WebR binary packages.
   */
  /**
   * Installs an R package directly using WebR binary packages and saves it persistently.
   */
  public async installPackage(pkg: string): Promise<PackageInstallResult> {
    if (!this.isReady()) {
      await this.init();
    }
    return installWebRPackage(this.webRInstance, pkg);
  }

  /**
   * Uninstalls/unmounts an R package from the active session and persistence.
   */
  public async uninstallPackage(pkg: string): Promise<{ success: boolean; message: string }> {
    return uninstallWebRPackage(this.webRInstance, pkg);
  }

  /**
   * Checks if an R package is currently loaded or installed in this session.
   */
  public async isPackageInstalled(pkg: string): Promise<boolean> {
    if (!this.isReady()) return false;
    return isPackageInstalled(this.webRInstance, pkg);
  }

  /**
   * Returns list of packages saved for persistent auto-restoration across reloads.
   */
  public getPersistedPackages(): string[] {
    return getPersistedPackages();
  }

  /**
   * Returns list of currently tracked packages and their status.
   */
  public getTrackedPackages(): PackageStatusInfo[] {
    return getTrackedPackages();
  }

  /**
   * Returns raw WebR instance.
   */
  public getWebR(): any {
    return this.webRInstance;
  }

  /**
   * Writes a file to the WebR virtual file system (VFS).
   * 
   * @param path Target path in the VFS (e.g. "data.csv")
   * @param data Content as Uint8Array or ArrayBuffer
   */
  public async writeFile(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
    if (!this.isReady() || !this.webRInstance) {
      throw new Error("Le moteur R n'est pas prêt.");
    }
    const uint8Data = data instanceof Uint8Array ? data : new Uint8Array(data);
    await this.webRInstance.FS.writeFile(path, uint8Data);
  }

  /**
   * Reads a file from the WebR virtual file system (VFS).
   */
  public async readFile(path: string): Promise<Uint8Array> {
    if (!this.isReady() || !this.webRInstance) {
      throw new Error("Le moteur R n'est pas prêt.");
    }
    return await this.webRInstance.FS.readFile(path);
  }

  /**
   * Deletes a file from the WebR virtual file system (VFS).
   */
  public async unlink(path: string): Promise<void> {
    if (!this.isReady() || !this.webRInstance) {
      throw new Error("Le moteur R n'est pas prêt.");
    }
    await this.webRInstance.FS.unlink(path);
  }

  /**
   * Checks if a file exists in the WebR virtual file system (VFS).
   */
  public async fileExists(path: string): Promise<boolean> {
    if (!this.isReady() || !this.webRInstance) return false;
    try {
      // Re-evaluate using R to be absolutely sure R can see it
      const res = await this.webRInstance.evalRBoolean(`file.exists("${path}")`);
      return !!res;
    } catch {
      return false;
    }
  }

  /**
   * Lists files in a directory of the WebR virtual file system (VFS).
   * Filters out internal hidden files by default.
   */
  public async listFiles(dir: string = '.'): Promise<string[]> {
    if (!this.isReady() || !this.webRInstance) return [];
    try {
      const files = await this.webRInstance.FS.readdir(dir);
      // Filter out standard Emscripten/R internal dots
      return files.filter((f: string) => f !== '.' && f !== '..' && !f.startsWith('.'));
    } catch {
      return [];
    }
  }

  /**
   * Closes WebR instance and frees WebAssembly resources.
   */
  public async close(): Promise<void> {
    if (this.webRInstance) {
      try {
        await this.webRInstance.close();
      } catch (err) {
        console.warn('Erreur lors de la fermeture de WebR:', err);
      } finally {
        this.webRInstance = null;
        this.setStatus('idle', 'Environnement R fermé.');
      }
    }
  }
}

// Export singleton instance and convenience helper methods
export const webrEngine = WebREngine.getInstance();

export const initWebR = () => webrEngine.init();
export const isWebRReady = () => webrEngine.isReady();
export const isWebRRunning = () => webrEngine.isRunning();
export const executeRCode = (code: string, options?: WebRExecuteOptions) => webrEngine.execute(code, options);
export const validateCode = (code: string, testCases: RTestCase[] | string | any, options?: ValidateCodeOptions) => webrEngine.validateCode(code, testCases, options);
export const validateRCode = validateCode;
export const getEnvironmentObjects = () => webrEngine.getEnvironmentObjects();
export const resetREnvironment = () => webrEngine.resetEnvironment();
export const stopWebR = () => webrEngine.close();
export const getWebRState = () => webrEngine.getState();
export const subscribeWebRState = (listener: WebRStateListener) => webrEngine.subscribe(listener);
export const installRPackage = (pkg: string) => webrEngine.installPackage(pkg);
export const uninstallRPackage = (pkg: string) => webrEngine.uninstallPackage(pkg);
export const isRPackageInstalled = (pkg: string) => webrEngine.isPackageInstalled(pkg);
export const getActivePackages = () => webrEngine.getTrackedPackages();
export const getPersistedRPackages = () => webrEngine.getPersistedPackages();
export const removePersistedRPackage = (pkg: string) => removePersistedPackage(pkg);
export const writeWebRFile = (path: string, data: Uint8Array | ArrayBuffer) => webrEngine.writeFile(path, data);
export const readWebRFile = (path: string) => webrEngine.readFile(path);
export const deleteWebRFile = (path: string) => webrEngine.unlink(path);
export const listWebRFiles = (dir?: string) => webrEngine.listFiles(dir);
export const webRFileExists = (path: string) => webrEngine.fileExists(path);
