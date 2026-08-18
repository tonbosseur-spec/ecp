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
  FileUp,
  FolderOpen,
  X,
  BarChart2
} from 'lucide-react';
import { 
  initWebR, 
  executeRCode, 
  subscribeWebRState, 
  getWebRState, 
  WebREngineState, 
  WebRExecutionResult 
} from '../lib/webrEngine';
import WebRFileManager from './WebRFileManager';
import RGraphicViewer from './RGraphicViewer';

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
  const [showFileManager, setShowFileManager] = useState(false);
  const [activeGraphicIndex, setActiveGraphicIndex] = useState(0);

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

  // Execute R Code
  const handleRunCode = async () => {
    if (engineState.isRunning) return;

    if (!currentCode.trim()) {
      setConsoleOutput(['[Info] Le code est vide. Veuillez saisir du code R à exécuter.']);
      return;
    }

    setActiveGraphicIndex(0);

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

  // Re-render graphics with custom canvas dimensions (for full screen)
  const handleReRenderGraphics = async (dimensions: { width: number; height: number }) => {
    if (engineState.isRunning || !currentCode.trim()) return;
    try {
      const result = await executeRCode(currentCode, {
        canvasWidth: dimensions.width,
        canvasHeight: dimensions.height,
      });
      setLastResult(result);
      if (onExecute) {
        onExecute(result);
      }
    } catch (err: any) {
      console.warn("Erreur re-render graphique:", err);
    }
  };

  // Clear console output
  const handleClearConsole = () => {
    setConsoleOutput([]);
    setLastResult(null);
    setActiveGraphicIndex(0);
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
              onClick={() => setShowFileManager(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-amber-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
              title="Gérer vos fichiers de données"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Données</span>
            </button>

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

      {/* 3. CONSOLE OUTPUT SECTION */}
      <div className="bg-slate-900 rounded-2xl md:rounded-3xl border border-slate-800 shadow-sm overflow-hidden flex flex-col">
        {/* Console Header */}
        <div className="bg-slate-950/80 px-3.5 sm:px-4 py-2.5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-slate-200">
              Console R
            </span>
          </div>

          {/* Status Badge */}
          {lastResult && (
            <div className="flex items-center gap-2">
              {lastResult.success ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Exécution réussie ({lastResult.executionTimeMs}ms)
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

        {/* Console Body */}
        <div className="p-3.5 sm:p-4 bg-slate-950 min-h-[110px] max-h-[300px] overflow-y-auto font-mono text-xs sm:text-sm leading-relaxed text-slate-200 select-text">
          {consoleOutput.length === 0 && !lastResult?.graphicDataUrl ? (
            <div className="h-full min-h-[80px] flex items-center justify-center text-slate-500 text-xs italic">
              La sortie de votre code R apparaîtra ici après l'exécution.
            </div>
          ) : (
            <div className="space-y-2">
              {consoleOutput.map((line, idx) => {
                let textStyle = "text-slate-200";
                if (line.startsWith('[Erreur R]') || line.startsWith('[Erreur]') || line.includes('❌')) {
                  textStyle = "text-rose-400 font-semibold";
                } else if (line.startsWith('[Avertissement]')) {
                  textStyle = "text-amber-400 font-medium";
                } else if (line.startsWith('[Message R]')) {
                  textStyle = "text-sky-400";
                } else if (line.includes('📦') || line.startsWith('[Package WebR]')) {
                  textStyle = "text-sky-300 font-medium";
                } else if (line.includes('✅')) {
                  textStyle = "text-emerald-400 font-medium";
                } else if (line.startsWith('[Info]') || line.startsWith('[Code exécuté')) {
                  textStyle = "text-slate-400 italic";
                }

                return (
                  <div key={idx} className={`whitespace-pre-wrap break-words ${textStyle}`}>
                    {line}
                  </div>
                );
              })}

              {/* Render Plot Graphic if created (ggplot2, plot, etc.) */}
              {lastResult?.graphics && lastResult.graphics.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-800 w-full">
                  <RGraphicViewer
                    graphics={lastResult.graphics}
                    graphicDataUrl={lastResult.graphicDataUrl}
                    onReRender={handleReRenderGraphics}
                    isReRendering={engineState.isRunning}
                    title="Graphique R"
                    variant="dark"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. FILE MANAGER MODAL OVERLAY */}
      {showFileManager && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Gestionnaire de données R</h3>
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">WebR VFS Storage</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFileManager(false)}
                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto">
              <WebRFileManager 
                onFileImported={(meta) => {
                  // Suggest code injection if appropriate
                }}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowFileManager(false)}
                className="px-5 py-2.5 bg-gray-900 text-white rounded-2xl text-xs font-black hover:bg-gray-800 transition-all active:scale-95"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

REditorConsole.displayName = 'REditorConsole';

export default REditorConsole;
