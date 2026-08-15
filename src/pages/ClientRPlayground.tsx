import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Terminal, 
  Brain, 
  Play, 
  RotateCcw, 
  Trash2, 
  ChevronLeft, 
  Sparkles, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  BarChart2, 
  Box, 
  Code2, 
  HelpCircle,
  Copy,
  Check,
  Maximize2,
  Table as TableIcon,
  Search,
  RefreshCw
} from 'lucide-react';
import { webrEngine, WebRExecutionResult, RObjectInfo, WebRStatus } from '../lib/webrEngine';

const DEFAULT_R_CODE = `# Bienvenue dans R libre !

x <- c(10, 15, 20, 25, 30)

mean(x)
`;

const R_COMMON_KEYWORDS = [
  'c()', 'mean()', 'median()', 'sum()', 'min()', 'max()', 'sd()', 'var()',
  'length()', 'seq()', 'rep()', 'data.frame()', 'head()', 'tail()', 'str()',
  'summary()', 'plot()', 'hist()', 'barplot()', 'boxplot()', 'table()',
  'cor()', 'lm()', 'matrix()', 'library()', 'colnames()', 'rownames()'
];

export default function ClientRPlayground() {
  const navigate = useNavigate();

  // WebR State
  const [webrStatus, setWebrStatus] = useState<WebRStatus>('idle');
  const [webrStatusMessage, setWebrStatusMessage] = useState('Chargement de R...');
  const [code, setCode] = useState(DEFAULT_R_CODE);
  const [executing, setExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<WebRExecutionResult | null>(null);
  const [activeTab, setActiveTab] = useState<'result' | 'objects' | 'graphics'>('result');
  const [rObjects, setRObjects] = useState<RObjectInfo[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [selectedObject, setSelectedObject] = useState<RObjectInfo | null>(null);
  const [copied, setCopied] = useState(false);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionCoords, setSuggestionCoords] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize WebR on mount
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      unsubscribe = webrEngine.subscribe((state) => {
        setWebrStatus(state.status);
        setWebrStatusMessage(state.statusMessage);
      });

      if (!webrEngine.isReady()) {
        await webrEngine.init();
      }
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Update object list when activeTab changes to 'objects'
  useEffect(() => {
    if (activeTab === 'objects' && webrEngine.isReady()) {
      refreshObjects();
    }
  }, [activeTab]);

  const refreshObjects = async () => {
    setLoadingObjects(true);
    try {
      const objs = await webrEngine.getEnvironmentObjects();
      setRObjects(objs);
    } catch (err) {
      console.warn("Erreur chargement objets R:", err);
    } finally {
      setLoadingObjects(false);
    }
  };

  // Handle Code Execution
  const handleExecute = async () => {
    if (executing || !code.trim()) return;

    setExecuting(true);
    setLastResult(null);

    try {
      const result = await webrEngine.execute(code);
      setLastResult(result);

      // Auto switch tab if graphic was produced
      if (result.graphicDataUrl) {
        setActiveTab('graphics');
      } else {
        setActiveTab('result');
      }

      // Fetch updated objects list
      refreshObjects();
    } catch (err: any) {
      setLastResult({
        success: false,
        output: err?.message || 'Erreur lors de l\'exécution du code R.',
        stdout: [],
        stderr: [],
        warnings: [],
        errors: [err?.message || 'Erreur d\'exécution'],
        executionTimeMs: 0
      });
      setActiveTab('result');
    } finally {
      setExecuting(false);
    }
  };

  // Reset Environment and Code
  const handleReset = async () => {
    if (window.confirm("Voulez-vous réinitialiser le code et effacer tous les objets créés dans R ?")) {
      setCode(DEFAULT_R_CODE);
      setLastResult(null);
      setSelectedObject(null);
      await webrEngine.resetEnvironment();
      refreshObjects();
    }
  };

  // Clear Output
  const handleClearOutput = () => {
    setLastResult(null);
  };

  // Insert helper shortcut snippet into editor
  const insertSnippet = (snippet: string) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    const newCode = code.substring(0, start) + snippet + code.substring(end);
    setCode(newCode);

    setTimeout(() => {
      el.focus();
      const newCursor = start + snippet.length;
      el.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  // Textarea Keydown handlers for indentation and autocomplete
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      insertSnippet('  ');
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleExecute();
    }
  };

  // Handle Textarea change & simple autocompletion triggers
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCode(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursor);
    const lastWordMatch = textBeforeCursor.match(/([a-zA-Z0-9_\.$]+)$/);

    if (lastWordMatch && lastWordMatch[1].length >= 2) {
      const word = lastWordMatch[1].toLowerCase();
      const matches = R_COMMON_KEYWORDS.filter(k => k.toLowerCase().includes(word));
      if (matches.length > 0) {
        setSuggestions(matches.slice(0, 6));
        setShowSuggestions(true);
        return;
      }
    }
    setShowSuggestions(false);
  };

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Left: App Title and Sub-Nav Tabs */}
            <div className="flex items-center gap-4">
              <Link 
                to="/client/hub" 
                className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all sm:hidden"
                title="Retour au Tableau de bord"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-purple-600" />
                    <span>Espace R</span>
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200/80">
                    Interactif
                  </span>
                </div>
              </div>

              {/* Sub-Navigation Switcher: Exercices vs R Libre */}
              <div className="hidden md:flex items-center gap-1.5 p-1 bg-gray-100 rounded-2xl ml-4">
                <Link
                  to="/client/training"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-900 transition-all flex items-center gap-1.5"
                >
                  <Brain className="w-3.5 h-3.5 text-sky-600" />
                  <span>Exercices & Quiz</span>
                </Link>
                <div className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-white text-purple-700 shadow-2xs flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-purple-600" />
                  <span>💻 R libre</span>
                </div>
              </div>
            </div>

            {/* Right Header Actions */}
            <div className="flex items-center gap-2">
              <Link
                to="/client/training"
                className="md:hidden inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold"
              >
                <Brain className="w-3.5 h-3.5 text-sky-600" />
                <span>Exercices</span>
              </Link>

              <Link
                to="/client/hub"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Tableau de bord
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-4">

        {/* Banner Info */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-200 border border-purple-400/30">
                  ⚡ WebAssembly (WebR)
                </span>
                {webrStatus === 'ready' && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-300 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    R 4.3 Prêt
                  </span>
                )}
                {webrStatus === 'loading' && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-300 font-bold">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Chargement de WebR...
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                Bac à sable R autonome
              </h2>
              <p className="text-xs text-purple-200 font-medium max-w-2xl leading-relaxed">
                Écrivez et exécutez votre code R directement dans votre navigateur. Aucun serveur externe requis, tous vos calculs sont exécutés localement en toute sécurité.
              </p>
            </div>

            {/* Top Bar Action Buttons */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                onClick={handleReset}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5"
                title="Réinitialiser l'environnement et le code"
              >
                <RotateCcw className="w-3.5 h-3.5 text-purple-300" />
                <span>Réinitialiser</span>
              </button>

              <button
                onClick={handleExecute}
                disabled={executing || webrStatus === 'loading'}
                className="min-h-[44px] sm:min-h-[48px] px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Exécution...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Exécuter (Ctrl+Entrée)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Layout Grid: Mobile Vertical Stack, Desktop 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          
          {/* Column 1: Editor & Shortcuts (LG: 6 cols) */}
          <div className="lg:col-span-6 flex flex-col gap-3 bg-white rounded-2xl sm:rounded-3xl border border-gray-200 shadow-2xs p-3.5 sm:p-4">
            
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-black text-gray-900 uppercase tracking-wider">
                  Éditeur R
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={copyCodeToClipboard}
                  className="px-2.5 py-1 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                  title="Copier le code"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {/* Quick R Shortcuts Keyboard */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 overflow-x-auto pb-1 text-xs">
              <span className="text-[10px] font-bold text-gray-400 mr-1">Raccourcis :</span>
              {['<-', 'c()', 'mean()', '$', '%>%', 'data.frame()', 'head()', 'summary()', 'plot()', '#'].map((sc) => (
                <button
                  key={sc}
                  onClick={() => insertSnippet(sc)}
                  className="px-2 py-1 bg-gray-100 hover:bg-purple-100 hover:text-purple-700 font-mono text-xs font-semibold text-gray-700 rounded-md transition-all"
                >
                  {sc}
                </button>
              ))}
            </div>

            {/* Code Input Box */}
            <div className="relative flex-1 min-h-[260px] sm:min-h-[340px]">
              <textarea
                ref={textareaRef}
                value={code}
                onChange={handleCodeChange}
                onKeyDown={handleKeyDown}
                placeholder="# Écrivez votre script R ici..."
                className="w-full h-full min-h-[260px] sm:min-h-[340px] p-3.5 bg-slate-900 text-slate-100 font-mono text-xs sm:text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y leading-relaxed"
                spellCheck={false}
              />

              {/* Autocomplete suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-4 bottom-4 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl shadow-xl z-20 py-1 min-w-[160px]">
                  <div className="px-3 py-1 text-[10px] font-bold text-purple-400 uppercase border-b border-slate-700">
                    Suggestions R
                  </div>
                  {suggestions.map((sug) => (
                    <button
                      key={sug}
                      onClick={() => {
                        insertSnippet(sug);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-purple-600 hover:text-white transition-all flex items-center justify-between"
                    >
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Execution Button (Big & Prominent) */}
            <div className="sm:hidden pt-2">
              <button
                onClick={handleExecute}
                disabled={executing || webrStatus === 'loading'}
                className="w-full min-h-[48px] px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-400 text-white font-black rounded-xl text-sm shadow-md flex items-center justify-center gap-2"
              >
                {executing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Exécution en cours...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-white" />
                    <span>Exécuter le code R</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Column 2: Results / Objects / Graphics Tabs (LG: 6 cols) */}
          <div className="lg:col-span-6 flex flex-col bg-white rounded-2xl sm:rounded-3xl border border-gray-200 shadow-2xs overflow-hidden">
            
            {/* Tabs Header */}
            <div className="flex items-center justify-between bg-gray-50/80 border-b border-gray-200 px-3 py-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('result')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'result'
                      ? 'bg-white text-purple-700 shadow-2xs font-black'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-purple-600" />
                  <span>Résultat</span>
                  {lastResult && (
                    <span className={`w-2 h-2 rounded-full ${lastResult.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('objects')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'objects'
                      ? 'bg-white text-purple-700 shadow-2xs font-black'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                  }`}
                >
                  <Box className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Objets</span>
                  {rObjects.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black">
                      {rObjects.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('graphics')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'graphics'
                      ? 'bg-white text-purple-700 shadow-2xs font-black'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5 text-pink-600" />
                  <span>Graphique</span>
                  {lastResult?.graphicDataUrl && (
                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                  )}
                </button>
              </div>

              {activeTab === 'result' && lastResult && (
                <button
                  onClick={handleClearOutput}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="Effacer les résultats"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {activeTab === 'objects' && (
                <button
                  onClick={refreshObjects}
                  disabled={loadingObjects}
                  className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                  title="Rafraîchir les objets"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingObjects ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {/* Tab Body Content */}
            <div className="flex-1 p-3.5 sm:p-4 min-h-[300px] sm:min-h-[380px] overflow-y-auto max-h-[500px]">
              
              {/* TAB 1: Console Output Result */}
              {activeTab === 'result' && (
                <div className="space-y-3 font-mono text-xs">
                  {executing && (
                    <div className="flex items-center gap-2 text-purple-600 font-sans p-3 bg-purple-50 rounded-xl">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-bold">Exécution du script R dans le navigateur...</span>
                    </div>
                  )}

                  {!executing && !lastResult && (
                    <div className="text-center py-12 text-gray-400 font-sans space-y-2">
                      <Terminal className="w-10 h-10 mx-auto opacity-30 text-purple-600" />
                      <p className="text-xs font-medium">
                        Cliquez sur <strong className="text-gray-700">▶ Exécuter</strong> pour voir le résultat ici.
                      </p>
                    </div>
                  )}

                  {lastResult && (
                    <div className="space-y-3">
                      {/* Execution Header Status */}
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100 font-sans text-[11px] text-gray-500">
                        <span className="flex items-center gap-1.5 font-bold">
                          {lastResult.success ? (
                            <span className="text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Succès
                            </span>
                          ) : (
                            <span className="text-red-600 flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Erreur d'exécution
                            </span>
                          )}
                        </span>
                        <span>Temps : {lastResult.executionTimeMs} ms</span>
                      </div>

                      {/* Error Banner */}
                      {lastResult.errors.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl font-sans space-y-1">
                          <div className="flex items-center gap-1.5 text-red-700 font-bold text-xs">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span>❌ Erreur R</span>
                          </div>
                          {lastResult.errors.map((err, idx) => (
                            <pre key={idx} className="text-xs text-red-600 font-mono whitespace-pre-wrap">
                              {err}
                            </pre>
                          ))}
                        </div>
                      )}

                      {/* Stdout Console */}
                      {lastResult.stdout.length > 0 && (
                        <div className="p-3.5 bg-slate-950 text-emerald-400 rounded-xl space-y-1 leading-relaxed whitespace-pre-wrap overflow-x-auto shadow-inner">
                          {lastResult.stdout.map((line, idx) => (
                            <div key={idx}>{line}</div>
                          ))}
                        </div>
                      )}

                      {/* Warnings */}
                      {lastResult.warnings.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                          <span className="font-bold">Avertissements :</span>
                          {lastResult.warnings.map((w, idx) => (
                            <div key={idx} className="whitespace-pre-wrap">{w}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: R Objects Inspector */}
              {activeTab === 'objects' && (
                <div className="space-y-4 font-sans text-xs">
                  {loadingObjects ? (
                    <div className="flex items-center justify-center py-12 text-gray-500 gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                      <span>Inspection des objets R...</span>
                    </div>
                  ) : rObjects.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 space-y-2">
                      <Box className="w-10 h-10 mx-auto opacity-30 text-indigo-600" />
                      <p className="text-xs font-medium">Aucun objet créé dans l'environnement R.</p>
                      <p className="text-[11px] text-gray-400">
                        Définissez des variables (ex: <code className="bg-gray-100 px-1 py-0.5 rounded">x &lt;- 10</code>) et exécutez votre script.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                        <span>Objets créés dans le workspace ({rObjects.length})</span>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {rObjects.map((obj) => (
                          <div
                            key={obj.name}
                            onClick={() => setSelectedObject(selectedObject?.name === obj.name ? null : obj)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer ${
                              selectedObject?.name === obj.name
                                ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20'
                                : 'bg-white border-gray-200 hover:border-indigo-200 hover:shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-indigo-700 text-sm">
                                  {obj.name}
                                </span>
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-[10px] font-mono">
                                  {obj.className}
                                </span>
                              </div>
                              <span className="text-[11px] text-gray-500 font-medium">
                                {obj.dimensions 
                                  ? `${obj.dimensions[0]} lignes × ${obj.dimensions[1]} cols`
                                  : `${obj.length} element(s)`}
                              </span>
                            </div>

                            {/* Collapsible Object Preview Details */}
                            {selectedObject?.name === obj.name && (
                              <div className="mt-3 pt-3 border-t border-indigo-100 space-y-2">
                                {obj.previewType === 'dataframe' && obj.previewData && (
                                  <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[200px]">
                                    <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                                      <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                          {obj.previewData.columns.map((col: string, i: number) => (
                                            <th key={i} className="px-2.5 py-1.5 text-left font-bold text-gray-700 border-r border-gray-200">
                                              {col}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 bg-white">
                                        {obj.previewData.rows.map((row: string[], rIdx: number) => (
                                          <tr key={rIdx} className="hover:bg-gray-50">
                                            {row.map((val: string, cIdx: number) => (
                                              <td key={cIdx} className="px-2.5 py-1 font-mono text-gray-800 border-r border-gray-100">
                                                {val}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {obj.previewType === 'vector' && Array.isArray(obj.previewData) && (
                                  <div className="p-2.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto">
                                    {`[1] ${obj.previewData.join('  ')}`}
                                  </div>
                                )}

                                {obj.previewType === 'summary' && (
                                  <pre className="p-2.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto whitespace-pre">
                                    {Array.isArray(obj.previewData) ? obj.previewData.join('\n') : String(obj.previewData)}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: R SVG Graphics Display */}
              {activeTab === 'graphics' && (
                <div className="space-y-3 font-sans text-xs flex flex-col items-center justify-center min-h-[260px]">
                  {lastResult?.graphicDataUrl ? (
                    <div className="w-full space-y-2 flex flex-col items-center">
                      <div className="text-[11px] font-bold text-gray-400 flex items-center justify-between w-full pb-1 border-b border-gray-100">
                        <span>Graphique R généré</span>
                        <span className="text-pink-600">Image Bitmap (PNG)</span>
                      </div>
                      <div className="w-full bg-white p-2 rounded-xl border border-gray-200 flex justify-center overflow-auto max-h-[400px]">
                        <img src={lastResult.graphicDataUrl} alt="Graphique R" className="max-w-full h-auto" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400 space-y-2">
                      <BarChart2 className="w-12 h-12 mx-auto opacity-30 text-pink-600" />
                      <p className="text-xs font-bold text-gray-600">Aucun graphique généré</p>
                      <p className="text-[11px] text-gray-400 max-w-sm mx-auto leading-relaxed">
                        Exécutez du code R contenant une fonction graphique comme <code className="bg-gray-100 px-1.5 py-0.5 rounded text-pink-700 font-mono">plot()</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded text-pink-700 font-mono">hist()</code> ou <code className="bg-gray-100 px-1.5 py-0.5 rounded text-pink-700 font-mono">barplot()</code> pour afficher le rendu graphique ici.
                      </p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
