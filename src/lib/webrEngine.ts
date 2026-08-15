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

export type WebRStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error';

export interface WebRExecutionResult {
  success: boolean;
  output: string;
  stdout: string[];
  stderr: string[];
  warnings: string[];
  errors: string[];
  executionTimeMs: number;
  resultValue?: any;
}

export interface RTestCase {
  code: string;
  description: string;
}

export interface RTestResultDetail {
  description: string;
  passed: boolean;
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

    const timeoutMs = 45000;
    let timeoutId: NodeJS.Timeout | null = null;

    this.initPromise = (async () => {
      try {
        this.setStatus('loading', "Chargement de l'environnement R...");

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error("Le chargement de R prend trop de temps. Vérifiez votre connexion internet puis réessayez."));
          }, timeoutMs);
        });

        const loadPromise = (async () => {
          // Dynamic import to guarantee zero bundle overhead on initial page load
          const { WebR } = await import('@r-wasm/webr');

          // Instantiate WebR with self-hosted runtime files
          const webR = new WebR({
            baseUrl: '/webr/',
            serviceWorkerUrl: '/webr/',
          });
          await webR.init();
          return webR;
        })();

        const webR = await Promise.race([loadPromise, timeoutPromise]);
        if (timeoutId) clearTimeout(timeoutId);

        this.webRInstance = webR;
        this.setStatus('ready', 'R est prêt.');
      } catch (err: any) {
        if (timeoutId) clearTimeout(timeoutId);
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
    options: { timeoutMs?: number } = {}
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

    const timeoutMs = options.timeoutMs || 30000; // 30s timeout default
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Create a Shelter for safe R evaluation and memory cleanup
      const shelter = await new this.webRInstance.Shelter();

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

        return { resultValue };
      })();

      const { resultValue } = await Promise.race([executionPromise, timeoutPromise]);

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
   * @param testCases Array of test objects { code, description } or serialized JSON string
   * @param options Configuration options such as execution timeout
   */
  public async validateCode(
    code: string,
    testCases: RTestCase[] | string | any,
    options: { timeoutMs?: number } = {}
  ): Promise<RValidationResult> {
    // Parse test cases safely if string was provided
    let parsedTestCases: RTestCase[] = [];
    if (typeof testCases === 'string') {
      try {
        parsedTestCases = JSON.parse(testCases);
      } catch {
        parsedTestCases = [];
      }
    } else if (Array.isArray(testCases)) {
      parsedTestCases = testCases;
    }

    // Filter out invalid items
    const validTestCases = parsedTestCases.filter(
      (tc) => tc && typeof tc.code === 'string' && tc.code.trim().length > 0
    );

    // If no test cases defined, return empty success
    if (validTestCases.length === 0) {
      return {
        success: true,
        passed: 0,
        total: 0,
        tests: [],
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

    const timeoutMs = options.timeoutMs || 30000;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Create isolated Shelter
      const shelter = await new this.webRInstance.Shelter();

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Délai d'exécution dépassé (${Math.round(timeoutMs / 1000)}s).`));
        }, timeoutMs);
      });

      const validationPromise = (async (): Promise<RValidationResult> => {
        // Step 1: Execute student code with stream & condition capture
        const studentCapture = await shelter.captureR(code, {
          withAutoprint: false,
          captureStreams: true,
          captureConditions: true,
        });

        // Check if student code resulted in an execution error
        const studentErrors: string[] = [];
        if (studentCapture.output && Array.isArray(studentCapture.output)) {
          studentCapture.output.forEach((outObj: any) => {
            if (outObj.type === 'error') {
              const text = outObj.data?.message || String(outObj.data || '');
              studentErrors.push(text);
            }
          });
        }

        // If code fails to execute cleanly, all tests are marked failed without leaking internals
        if (studentErrors.length > 0) {
          await shelter.purge();
          const endTime = performance.now();
          return {
            success: false,
            passed: 0,
            total: validTestCases.length,
            tests: validTestCases.map((tc) => ({
              description: tc.description || 'Critère de validation',
              passed: false,
            })),
            error: studentErrors[0] || "Erreur lors de l'exécution du code R.",
            executionTimeMs: Math.round(endTime - startTime),
          };
        }

        // Step 2: Evaluate each test case in the same environment
        const testResults: RTestResultDetail[] = [];
        let passedCount = 0;

        for (const tc of validTestCases) {
          // Wrapped safely in tryCatch: evaluates truthiness and returns integer 1L (passed) or 0L (failed)
          const sanitizedTestRCode = `tryCatch({ as.integer(isTRUE(as.logical((${tc.code}))[1])) }, error = function(e) 0L, warning = function(w) 0L)`;

          let isPassed = false;
          try {
            const evalResult = await shelter.evalR(sanitizedTestRCode);
            const jsVal = await evalResult.toJs();
            const raw = jsVal?.values ? jsVal.values[0] : jsVal;
            isPassed = raw === 1 || raw === true;
          } catch {
            isPassed = false;
          }

          if (isPassed) {
            passedCount++;
          }

          testResults.push({
            description: tc.description || 'Critère de validation',
            passed: isPassed,
          });
        }

        // Clean up shelter memory
        await shelter.purge();

        const endTime = performance.now();
        const allPassed = passedCount === validTestCases.length;

        return {
          success: allPassed,
          passed: passedCount,
          total: validTestCases.length,
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

      return {
        success: false,
        passed: 0,
        total: validTestCases.length,
        tests: validTestCases.map((tc) => ({
          description: tc.description || 'Critère de validation',
          passed: false,
        })),
        error: errorMessage,
        executionTimeMs,
      };
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
export const executeRCode = (code: string, options?: { timeoutMs?: number }) => webrEngine.execute(code, options);
export const validateCode = (code: string, testCases: RTestCase[] | string | any, options?: { timeoutMs?: number }) => webrEngine.validateCode(code, testCases, options);
export const validateRCode = validateCode;
export const stopWebR = () => webrEngine.close();
export const getWebRState = () => webrEngine.getState();
export const subscribeWebRState = (listener: WebRStateListener) => webrEngine.subscribe(listener);
