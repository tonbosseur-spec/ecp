import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Terminal, 
  Code2, 
  Copy, 
  Check, 
  Loader2, 
  Sparkles,
  Info,
  Layers,
  Box,
  BarChart2,
  RefreshCw,
  Table as TableIcon
} from 'lucide-react';
import { 
  initWebR, 
  executeRCode, 
  subscribeWebRState, 
  getWebRState, 
  WebREngineState, 
  WebRExecutionResult,
  webrEngine,
  RObjectInfo
} from '../lib/webrEngine';

export interface REditorConsoleRef {
  focus: () => void;
  runCode: () => Promise<void>;
}

export interface REditorConsoleProps {
  initialCode?: string;
  value?: string;
  onChange?: (code: string) => void;
  onExecute?: (result: WebRExecutionResult) => void;
  readOnly?: boolean;
  minHeight?: string;
  className?: string;
  autoInit?: boolean;
  starterCode?: string;
}

export const REditorConsole = React.forwardRef<REditorConsoleRef, REditorConsoleProps>(({
  initialCode = 'x <- c(10, 20, 30, 40)\nmean(x)\nsummary(x)',
  value,
  onChange,
  onExecute,
  readOnly = false,
  minHeight = '160px',
  className = '',
  autoInit = true,
  starterCode,
}, ref) => {
  // Code editor state
  const isControlled = value !== undefined;
  const [internalCode, setInternalCode] = useState(initialCode);
  const currentCode = isControlled ? value : internalCode;

  // Engine state
  const [engineState, setEngineState] = useState<WebREngineState>(getWebRState());
  const [lastResult, setLastResult] = useState<WebRExecutionResult | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);

  // Expose focus and runCode via ref
  React.useImperativeHandle(ref, () => ({
    focus: () => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    runCode: handleRunCode
  }));

  // Track loading time for reassuring user progress
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (engineState.status === 'loading') {
      setLoadingSeconds(0);
      timer = setInterval(() => {
        setLoadingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setLoadingSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [engineState.status]);

  // Subscribe to WebR state
  useEffect(() => {
    const unsubscribe = subscribeWebRState((state) => {
      setEngineState(state);
    });

    if (autoInit && getWebRState().status === 'idle') {
      initWebR().catch((err) => {
        console.error("Erreur auto-init WebR:", err);
      });
    }

    return () => {
      unsubscribe();
    };
  }, [autoInit]);

  const handleRetryInit = useCallback(() => {
    initWebR().catch((err) => {
      console.error("Erreur lors de la tentative de réinitialisation de WebR:", err);
    });
  }, []);

  // Handle Code changes
  const handleCodeChange = (newCode: string) => {
    if (!isControlled) {
      setInternalCode(newCode);
    }
    if (onChange) {
      onChange(newCode);
    }
  };

  // Keyboard navigation & indentation inside textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunCode();
      return;
    }

    // Tab key support (inserts 2 spaces)
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const updated = val.substring(0, start) + '  ' + val.substring(end);
      handleCodeChange(updated);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Synchronize line numbers scroll with textarea scroll
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Quick helper symbol injection for mobile keyboards
  const insertSymbol = (symbol: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      handleCodeChange(currentCode + symbol);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = currentCode;

    const updated = val.substring(0, start) + symbol + val.substring(end);
    handleCodeChange(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + symbol.length;
    }, 0);
  };

  // Output panel state & tabs
  const [activeOutputTab, setActiveOutputTab] = useState<'console' | 'objects' | 'graphics'>('console');
  const [rObjects, setRObjects] = useState<RObjectInfo[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [lastSvgPlot, setLastSvgPlot] = useState<string | null>(null);
  const [selectedObject, setSelectedObject] = useState<RObjectInfo | null>(null);

  // Fetch updated R objects from .GlobalEnv
  const refreshRObjects = useCallback(async () => {
    setLoadingObjects(true);
    try {
      const objs = await webrEngine.getEnvironmentObjects();
      setRObjects(objs);
    } catch (err) {
      console.warn("Erreur chargement objets R:", err);
    } finally {
      setLoadingObjects(false);
    }
  }, []);

  // Fetch objects when tab changes to 'objects'
  useEffect(() => {
    if (activeOutputTab === 'objects' && webrEngine.isReady()) {
      refreshRObjects();
    }
  }, [activeOutputTab, refreshRObjects]);

  // Execute R Code
  const handleRunCode = async () => {
    if (engineState.isRunning) return;

    if (!currentCode.trim()) {
      setConsoleOutput(['[Info] Le code est vide. Veuillez saisir du code R à exécuter.']);
      return;
    }

    try {
      const result = await executeRCode(currentCode);
      setLastResult(result);

      const outputs: string[] = [];
      if (result.stdout && result.stdout.length > 0) {
        outputs.push(...result.stdout);
      }
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(w => outputs.push(`[Avertissement] ${w}`));
      }
      if (result.stderr && result.stderr.length > 0) {
        result.stderr.forEach(e => outputs.push(`[Message R] ${e}`));
      }
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(err => outputs.push(`[Erreur R] ${err}`));
      }

      if (outputs.length === 0) {
        outputs.push('[Code exécuté sans sortie console]');
      }

      setConsoleOutput(outputs);

      if (result.svgGraphic) {
        setLastSvgPlot(result.svgGraphic);
        setActiveOutputTab('graphics');
      }

      // Automatically refresh environment objects after execution
      refreshRObjects();

      if (onExecute) {
        onExecute(result);
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Une erreur est survenue lors de l'exécution.";
      setConsoleOutput([`[Erreur] ${errorMsg}`]);
      setLastResult({
        success: false,
        output: errorMsg,
        stdout: [],
        stderr: [],
        warnings: [],
        errors: [errorMsg],
        executionTimeMs: 0
      });
    }
  };

  // Clear console output
  const handleClearConsole = () => {
    setConsoleOutput([]);
    setLastResult(null);
  };

  // Copy code
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Échec de copie:", err);
    }
  };

  // Reset to starter code or initial code
  const handleResetCode = () => {
    const fallback = starterCode !== undefined ? starterCode : initialCode;
    handleCodeChange(fallback);
  };

  // Calculate lines count for line numbering
  const linesCount = Math.max(1, currentCode.split('\n').length);
  const lineNumbers = Array.from({ length: linesCount }, (_, i) => i + 1);

  return (
    <div className={`w-full flex flex-col space-y-3 font-sans ${className}`}>
      {/* 1. CODE EDITOR SECTION */}
      <div className="bg-slate-900 rounded-2xl md:rounded-3xl border border-slate-800 shadow-sm overflow-hidden flex flex-col transition-all">
        {/* Top Header of Editor */}
        <div className="bg-slate-950/80 px-3.5 sm:px-4 py-2.5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
              <Code2 className="w-4 h-4" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-slate-200">
              Code R
            </span>
          </div>

          {/* Action Toolbar on Header */}
          <div className="flex items-center gap-1.5">
            {starterCode !== undefined && (
              <button
                type="button"
                onClick={handleResetCode}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Réinitialiser au code initial"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Réinitialiser</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Copier le code"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copié</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copier</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Quick R Syntax Helpers */}
        <div className="bg-slate-950/40 px-3 py-1.5 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Raccourcis :
          </span>
          {[
            { label: '<-', code: ' <- ' },
            { label: 'c(...)', code: 'c()' },
            { label: 'mean()', code: 'mean()' },
            { label: '$', code: '$' },
            { label: '%>%', code: ' %>% ' },
            { label: '#', code: '# ' },
            { label: 'print()', code: 'print()' }
          ].map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => insertSymbol(item.code)}
              className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 active:bg-sky-600 text-slate-300 active:text-white rounded-md text-xs font-mono font-medium shrink-0 transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Editor Area with Line Numbers */}
        <div className="relative flex bg-slate-900 overflow-hidden" style={{ minHeight }}>
          {/* Line Numbers Gutter */}
          <div
            ref={lineNumbersRef}
            aria-hidden="true"
            className="w-9 sm:w-11 py-3 bg-slate-950/50 text-slate-600 select-none text-right pr-2.5 font-mono text-xs sm:text-sm border-r border-slate-800/80 overflow-hidden"
          >
            {lineNumbers.map((num) => (
              <div key={num} className="leading-6 h-6">
                {num}
              </div>
            ))}
          </div>

          {/* Textarea Input */}
          <textarea
            ref={textareaRef}
            value={currentCode}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            readOnly={readOnly}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            placeholder="# Écrivez votre code R ici...&#10;x <- c(1, 2, 3)&#10;mean(x)"
            className="flex-1 p-3 bg-transparent text-slate-100 placeholder:text-slate-600 font-mono text-xs sm:text-sm leading-6 resize-y focus:outline-none focus:ring-0 border-0 w-full overflow-x-auto whitespace-pre tab-2 selection:bg-sky-500/30"
            style={{ minHeight }}
          />
        </div>

        {/* Loading Progress Info Notice (after 8s) */}
        {engineState.status === 'loading' && loadingSeconds >= 8 && loadingSeconds < 60 && (
          <div className="bg-amber-950/60 border-t border-amber-800/50 px-3.5 py-2 flex items-center gap-2 text-xs text-amber-200/90">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Téléchargement de l'environnement R en cours ({loadingSeconds}s)... Cela peut prendre jusqu'à deux minutes lors du premier chargement.
            </span>
          </div>
        )}
        {engineState.status === 'loading' && loadingSeconds >= 60 && (
          <div className="bg-amber-950/60 border-t border-amber-800/50 px-3.5 py-2 flex items-center gap-2 text-xs text-amber-200/90">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Toujours en cours ({loadingSeconds}s)... Le téléchargement continue en arrière-plan, merci de patienter — cela n'ira pas au-delà de 2 minutes.
            </span>
          </div>
        )}

        {/* Error Notice with Retry */}
        {engineState.status === 'error' && (
          <div className="bg-rose-950/60 border-t border-rose-800/50 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs text-rose-200/90 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">
                {engineState.error || "Impossible d'initialiser l'environnement R."}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRetryInit}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg font-bold text-xs shrink-0 transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Réessayer
            </button>
          </div>
        )}

        {/* Bottom Bar of Editor with Engine Status */}
        <div className="bg-slate-950/60 px-3.5 py-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            {engineState.status === 'loading' && (
              <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                Initialisation de R... ({loadingSeconds}s)
              </span>
            )}
            {engineState.status === 'ready' && (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                R est prêt
              </span>
            )}
            {engineState.status === 'running' && (
              <span className="inline-flex items-center gap-1.5 text-sky-400 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                Exécution en cours...
              </span>
            )}
            {engineState.status === 'error' && (
              <span className="inline-flex items-center gap-1.5 text-rose-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                Erreur de chargement
              </span>
            )}
            {engineState.status === 'idle' && (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                Moteur R prêt à démarrer
              </span>
            )}
          </div>

          <span className="hidden sm:inline font-mono text-[10px] text-slate-500">
            Ctrl+Entrée pour exécuter
          </span>
        </div>
      </div>

      {/* 2. ACTION BUTTONS (MOBILE-FRIENDLY HEIGHT) */}
      <div className="flex items-center gap-3">
        {/* Run or Retry Button */}
        {engineState.status === 'error' ? (
          <button
            type="button"
            onClick={handleRetryInit}
            className="flex-1 min-h-[48px] sm:min-h-[52px] px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-md bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 hover:from-rose-700 hover:to-red-900 text-white shadow-rose-900/20 active:scale-[0.98] transition-all duration-200"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Réessayer le chargement de R</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRunCode}
            disabled={engineState.isRunning || engineState.status === 'loading'}
            className={`flex-1 min-h-[48px] sm:min-h-[52px] px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-md transition-all duration-200 active:scale-[0.98] ${
              engineState.isRunning
                ? 'bg-sky-700 text-white cursor-wait opacity-80'
                : engineState.status === 'loading'
                ? 'bg-amber-600 text-white cursor-wait'
                : 'bg-gradient-to-r from-sky-600 via-indigo-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white shadow-sky-900/20 active:shadow-none'
            }`}
          >
            {engineState.isRunning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Exécution...</span>
              </>
            ) : engineState.status === 'loading' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Chargement de R... ({loadingSeconds}s)</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current text-sky-200" />
                <span>Exécuter le code R</span>
              </>
            )}
          </button>
        )}

        {/* Clear Output Button */}
        {consoleOutput.length > 0 && (
          <button
            type="button"
            onClick={handleClearConsole}
            className="min-h-[48px] sm:min-h-[52px] px-4 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-2xl font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 transition-colors shadow-2xs active:scale-95 shrink-0"
            title="Effacer la console"
          >
            <Trash2 className="w-4 h-4 text-gray-500" />
            <span>Effacer</span>
          </button>
        )}
      </div>

      {/* 3. MULTI-TAB OUTPUT SECTION (CONSOLE, OBJETS, GRAPHIQUE) */}
      <div className="bg-slate-900 rounded-2xl md:rounded-3xl border border-slate-800 shadow-sm overflow-hidden flex flex-col">
        {/* Output Header with Tabs */}
        <div className="bg-slate-950/90 px-3 sm:px-4 py-2 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          {/* Tabs Nav */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveOutputTab('console')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeOutputTab === 'console'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Console</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveOutputTab('objects')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeOutputTab === 'objects'
                  ? 'bg-slate-800 text-indigo-400 border border-slate-700 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Objets R</span>
              {rObjects.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {rObjects.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveOutputTab('graphics')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer relative ${
                activeOutputTab === 'graphics'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Graphique</span>
              {lastSvgPlot && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          </div>

          {/* Right Status Badge / Actions */}
          <div className="flex items-center gap-2">
            {activeOutputTab === 'objects' && (
              <button
                type="button"
                onClick={refreshRObjects}
                disabled={loadingObjects}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                title="Actualiser la liste des objets"
              >
                <RefreshCw className={`w-3 h-3 ${loadingObjects ? 'animate-spin text-indigo-400' : ''}`} />
                <span>Actualiser</span>
              </button>
            )}

            {activeOutputTab === 'console' && lastResult && (
              <div className="flex items-center gap-2">
                {lastResult.success ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Réussi ({lastResult.executionTimeMs}ms)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    Erreur R
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Output Tab Contents */}
        {/* TAB 1: CONSOLE */}
        {activeOutputTab === 'console' && (
          <div className="p-3.5 sm:p-4 bg-slate-950 min-h-[120px] max-h-[280px] overflow-y-auto font-mono text-xs sm:text-sm leading-relaxed text-slate-200 select-text">
            {consoleOutput.length === 0 ? (
              <div className="h-full min-h-[90px] flex items-center justify-center text-slate-500 text-xs italic">
                La sortie de votre code R apparaîtra ici après l'exécution.
              </div>
            ) : (
              <div className="space-y-1">
                {consoleOutput.map((line, idx) => {
                  let textStyle = "text-slate-200";
                  if (line.startsWith('[Erreur R]') || line.startsWith('[Erreur]')) {
                    textStyle = "text-rose-400 font-semibold";
                  } else if (line.startsWith('[Avertissement]')) {
                    textStyle = "text-amber-400 font-medium";
                  } else if (line.startsWith('[Message R]')) {
                    textStyle = "text-sky-400";
                  } else if (line.startsWith('[Info]') || line.startsWith('[Code exécuté')) {
                    textStyle = "text-slate-400 italic";
                  }

                  return (
                    <div key={idx} className={`whitespace-pre-wrap break-words ${textStyle}`}>
                      {line}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: OBJETS R */}
        {activeOutputTab === 'objects' && (
          <div className="p-3.5 bg-slate-950 min-h-[140px] max-h-[300px] overflow-y-auto font-sans text-xs text-slate-200">
            {loadingObjects ? (
              <div className="min-h-[100px] flex items-center justify-center gap-2 text-indigo-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Inspection de l'environnement R...</span>
              </div>
            ) : rObjects.length === 0 ? (
              <div className="min-h-[100px] flex flex-col items-center justify-center text-slate-500 space-y-1 text-center p-4">
                <Box className="w-8 h-8 text-slate-700" />
                <p className="font-semibold text-slate-400">Aucun objet R dans l'environnement</p>
                <p className="text-[11px] text-slate-600">
                  Créez des variables dans votre code (ex: <code className="text-sky-400 font-mono">x &lt;- c(10, 20, 30)</code>) pour les voir apparaître ici.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rObjects.map((obj) => (
                    <div
                      key={obj.name}
                      onClick={() => setSelectedObject(selectedObject?.name === obj.name ? null : obj)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        selectedObject?.name === obj.name
                          ? 'bg-indigo-950/60 border-indigo-500/50 ring-1 ring-indigo-500/30'
                          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <code className="font-mono text-xs font-bold text-sky-300 truncate">
                            {obj.name}
                          </code>
                          <span className="px-1.5 py-0.2 text-[10px] rounded font-semibold bg-slate-800 text-indigo-300 border border-slate-700 shrink-0">
                            {obj.className}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {obj.dimensions ? `${obj.dimensions[0]}×${obj.dimensions[1]}` : `n=${obj.length}`}
                        </span>
                      </div>

                      {/* Preview string */}
                      {obj.previewType === 'vector' && Array.isArray(obj.previewData) && (
                        <div className="mt-1.5 font-mono text-[11px] text-slate-400 truncate bg-slate-950/80 p-1.5 rounded-lg border border-slate-850">
                          [1] {obj.previewData.join(', ')}
                        </div>
                      )}

                      {obj.previewType === 'dataframe' && (
                        <div className="mt-1.5 text-[11px] text-indigo-300/80 flex items-center gap-1">
                          <TableIcon className="w-3 h-3 text-indigo-400" />
                          <span>
                            {obj.dimensions ? `${obj.dimensions[0]} lignes, ${obj.dimensions[1]} colonnes` : 'data.frame'}
                          </span>
                          <span className="text-[10px] text-slate-500 ml-auto">(Cliquer pour afficher)</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Selected DataFrame Preview Table */}
                {selectedObject && selectedObject.previewType === 'dataframe' && selectedObject.previewData?.columns && (
                  <div className="mt-3 p-3 bg-slate-900 border border-indigo-500/30 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TableIcon className="w-4 h-4 text-indigo-400" />
                        <span className="font-mono font-bold text-sky-300 text-xs">
                          {selectedObject.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({selectedObject.previewData.totalRows} lignes × {selectedObject.previewData.totalCols} colonnes)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedObject(null)}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-200"
                      >
                        Masquer
                      </button>
                    </div>

                    <div className="overflow-x-auto max-h-[160px] border border-slate-800 rounded-xl">
                      <table className="w-full text-left font-mono text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-950 text-indigo-300 border-b border-slate-800">
                            <th className="p-1.5 px-2 border-r border-slate-800 text-slate-600">#</th>
                            {selectedObject.previewData.columns.map((col: string, i: number) => (
                              <th key={i} className="p-1.5 px-2.5 font-bold border-r border-slate-800 last:border-r-0 whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedObject.previewData.rows.map((row: string[], rIdx: number) => (
                            <tr key={rIdx} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                              <td className="p-1.5 px-2 border-r border-slate-800 text-slate-600 font-mono text-[10px]">
                                {rIdx + 1}
                              </td>
                              {row.map((cell: string, cIdx: number) => (
                                <td key={cIdx} className="p-1.5 px-2.5 border-r border-slate-800/60 last:border-r-0 text-slate-200 whitespace-nowrap">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GRAPHIQUE SVG */}
        {activeOutputTab === 'graphics' && (
          <div className="p-3 sm:p-4 bg-slate-950 min-h-[160px] flex items-center justify-center">
            {lastSvgPlot ? (
              <div 
                className="w-full flex items-center justify-center overflow-hidden bg-white p-3 rounded-2xl border border-slate-800 shadow-md"
                dangerouslySetInnerHTML={{ __html: lastSvgPlot }}
              />
            ) : (
              <div className="text-center p-6 text-slate-500 space-y-2">
                <BarChart2 className="w-8 h-8 mx-auto text-slate-700" />
                <p className="font-semibold text-slate-400 text-xs">Aucun graphique généré</p>
                <p className="text-[11px] text-slate-600">
                  Utilisez des fonctions graphiques (ex: <code className="text-emerald-400 font-mono">plot(x)</code>, <code className="text-emerald-400 font-mono">hist(x)</code>, <code className="text-emerald-400 font-mono">barplot(x)</code>) pour générer un rendu SVG.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

REditorConsole.displayName = 'REditorConsole';

export default REditorConsole;
