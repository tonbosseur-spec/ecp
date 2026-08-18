import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Maximize2, 
  X, 
  ArrowLeft,
  BarChart2, 
  Download, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut,
  RotateCcw
} from 'lucide-react';

export interface RGraphicViewerProps {
  /** Array of base64 PNG data URLs or single data URL */
  graphics?: string[];
  graphicDataUrl?: string;
  /** Callback triggered when re-rendering with new canvas dimensions */
  onReRender?: (dimensions: { width: number; height: number }) => Promise<void> | void;
  /** Whether a re-render operation is currently in flight */
  isReRendering?: boolean;
  /** Title of the graphic */
  title?: string;
  /** Variant styling for inline state */
  variant?: 'light' | 'dark' | 'playground';
  className?: string;
}

export default function RGraphicViewer({
  graphics = [],
  graphicDataUrl,
  onReRender,
  isReRendering = false,
  title = "Graphique",
  variant = 'light',
  className = ""
}: RGraphicViewerProps) {
  // Normalize graphics array
  const allGraphics: string[] = graphics.length > 0 
    ? graphics 
    : (graphicDataUrl ? [graphicDataUrl] : []);

  const [activeGraphicIndex, setActiveGraphicIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [stageDimensions, setStageDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  });

  const stageRef = useRef<HTMLDivElement>(null);

  // Keep index within range
  useEffect(() => {
    if (activeGraphicIndex >= allGraphics.length && allGraphics.length > 0) {
      setActiveGraphicIndex(0);
    }
  }, [allGraphics.length, activeGraphicIndex]);

  // Compute adaptive dimensions on resize/orientation changes
  const updateDimensions = useCallback(() => {
    if (stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageDimensions({
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
        return;
      }
    }
    if (typeof window !== 'undefined') {
      setStageDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      window.addEventListener('orientationchange', updateDimensions);
      
      let resizeObserver: ResizeObserver | null = null;
      if (stageRef.current && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          updateDimensions();
        });
        resizeObserver.observe(stageRef.current);
      }

      return () => {
        window.removeEventListener('resize', updateDimensions);
        window.removeEventListener('orientationchange', updateDimensions);
        if (resizeObserver) resizeObserver.disconnect();
      };
    }
  }, [isFullscreen, updateDimensions]);

  // Keyboard navigation & body scroll lock
  useEffect(() => {
    if (!isFullscreen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
        setZoomLevel(1);
      } else if (e.key === 'ArrowLeft' && allGraphics.length > 1) {
        setActiveGraphicIndex((prev) => (prev > 0 ? prev - 1 : allGraphics.length - 1));
      } else if (e.key === 'ArrowRight' && allGraphics.length > 1) {
        setActiveGraphicIndex((prev) => (prev < allGraphics.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, allGraphics.length]);

  // Open & Close Handlers
  const handleOpenFullscreen = () => {
    setIsFullscreen(true);
    setZoomLevel(1);
  };

  const handleCloseFullscreen = () => {
    setIsFullscreen(false);
    setZoomLevel(1);
  };

  // Re-render in high resolution matching the full viewport
  const handleReRenderFullscreen = async () => {
    if (!onReRender || isReRendering) return;

    // Calculate optimal dimensions based on current device screen
    const isMobile = window.innerWidth < 640;
    let targetW = stageDimensions.width;
    let targetH = stageDimensions.height;

    if (isMobile) {
      // In mobile portrait, give generous height so layout() / par(mfrow) never fails margin limits
      targetW = Math.max(750, Math.round(window.innerWidth * 2));
      targetH = Math.max(700, Math.round((window.innerHeight - 80) * 1.5));
    } else {
      targetW = Math.max(900, Math.min(1600, stageDimensions.width));
      targetH = Math.max(650, Math.min(1200, stageDimensions.height));
    }

    await onReRender({ width: targetW, height: targetH });
  };

  // Download Current Image
  const handleDownload = () => {
    const currentImg = allGraphics[activeGraphicIndex];
    if (!currentImg) return;
    const link = document.createElement('a');
    link.href = currentImg;
    link.download = `graphique_r_${activeGraphicIndex + 1}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (allGraphics.length === 0) {
    return null;
  }

  const currentGraphicUrl = allGraphics[activeGraphicIndex] || allGraphics[0];

  return (
    <>
      {/* ============================================================ */}
      {/* 1. MODE NORMAL (AFFICHAGE STRICTEMENT INCHANGÉ DANS LE FLUX)  */}
      {/* ============================================================ */}
      <div className={`w-full flex flex-col items-center ${className}`}>
        
        {/* Header normal avec sélecteur et bouton Plein écran */}
        <div className="w-full flex items-center justify-between gap-2 mb-2">
          
          <div className="flex items-center gap-1.5 min-w-0">
            <BarChart2 className={`w-4 h-4 shrink-0 ${variant === 'dark' ? 'text-sky-400' : 'text-pink-600'}`} />
            <span className={`text-xs font-black uppercase tracking-wider truncate ${
              variant === 'dark' ? 'text-slate-300' : 'text-gray-700'
            }`}>
              {allGraphics.length > 1 ? `Graphiques (${allGraphics.length})` : title}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Multi-graphiques tabs (inline) */}
            {allGraphics.length > 1 && (
              <div className="flex items-center">
                <div className="hidden sm:flex items-center gap-1">
                  {allGraphics.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveGraphicIndex(idx)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                        activeGraphicIndex === idx
                          ? variant === 'dark'
                            ? 'bg-sky-500 text-white shadow-2xs'
                            : 'bg-pink-600 text-white shadow-2xs'
                          : variant === 'dark'
                            ? 'bg-slate-800 text-slate-400 hover:text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>

                <div className="sm:hidden">
                  <select
                    value={activeGraphicIndex}
                    onChange={(e) => setActiveGraphicIndex(parseInt(e.target.value))}
                    className={`text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none border ${
                      variant === 'dark'
                        ? 'bg-slate-800 border-slate-700 text-slate-200'
                        : 'bg-white border-gray-200 text-gray-700 shadow-3xs'
                    }`}
                  >
                    {allGraphics.map((_, idx) => (
                      <option key={idx} value={idx}>
                        Graphique {idx + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Bouton Plein écran (accessible, tactile >= 44px sur mobile) */}
            <button
              type="button"
              onClick={handleOpenFullscreen}
              aria-label="Voir le graphique en plein écran"
              title="Voir en plein écran (⛶)"
              className={`inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 shadow-2xs shrink-0 cursor-pointer min-h-[44px] sm:min-h-[32px] ${
                variant === 'dark'
                  ? 'bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700'
                  : 'bg-white hover:bg-gray-50 text-pink-700 border border-gray-200 hover:border-pink-200'
              }`}
            >
              <Maximize2 className="w-4 h-4 text-pink-600" />
              <span className="font-bold">Plein écran</span>
            </button>
          </div>
        </div>

        {/* Image du graphique en affichage normal */}
        <div className={`w-full p-2 rounded-2xl flex justify-center items-center overflow-hidden border ${
          variant === 'dark'
            ? 'bg-white shadow-xl border-slate-700'
            : 'bg-white shadow-2xs border-gray-200'
        }`}>
          <img 
            src={currentGraphicUrl} 
            alt={`Graphique R ${activeGraphicIndex + 1}`} 
            className="max-h-[320px] sm:max-h-[400px] w-auto max-w-full object-contain rounded-lg"
            referrerPolicy="no-referrer"
          />
        </div>

        {allGraphics.length > 1 && (
          <p className="mt-1.5 text-[10px] text-gray-400 font-medium italic">
            Affichage du graphique {activeGraphicIndex + 1} sur {allGraphics.length}
          </p>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. ESPACE DE VISUALISATION ADAPTATIF PLEIN ÉCRAN (100dvw / 100dvh) */}
      {/* ============================================================ */}
      {isFullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mode plein écran graphique R"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100dvw',
            height: '100dvh',
            zIndex: 99999,
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }}
          className="bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden overflow-y-auto select-none"
        >
          {/* Header Mobile & Desktop : ← Graphique     ✕ */}
          <header className="w-full shrink-0 bg-slate-900/95 border-b border-slate-800 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 shadow-md z-20">
            
            {/* Gauche : Bouton retour / Titre */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={handleCloseFullscreen}
                aria-label="Fermer le plein écran et revenir"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold transition-all min-h-[44px] min-w-[44px] active:scale-95 cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-pink-400" />
                <span>Graphique</span>
              </button>

              {allGraphics.length > 1 && (
                <span className="text-[11px] sm:text-xs font-bold text-pink-400 px-2 py-1 rounded-lg bg-pink-950/60 border border-pink-800/40 shrink-0">
                  {activeGraphicIndex + 1} / {allGraphics.length}
                </span>
              )}
            </div>

            {/* Centre : Sélecteur si multi-graphiques sur écran moyen/large */}
            {allGraphics.length > 1 && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                {allGraphics.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveGraphicIndex(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeGraphicIndex === idx
                        ? 'bg-pink-600 text-white shadow-sm font-black'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    N° {idx + 1}
                  </button>
                ))}
              </div>
            )}

            {/* Droite : Actions (Redessiner, Télécharger, Fermer ✕) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {onReRender && (
                <button
                  type="button"
                  onClick={handleReRenderFullscreen}
                  disabled={isReRendering}
                  aria-label="Redessiner en haute résolution"
                  title="Redessiner pour utiliser tout l'espace disponible"
                  className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-pink-400 border border-slate-700 text-xs font-bold transition-all min-h-[44px] disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isReRendering ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline">
                    {isReRendering ? 'Calcul...' : 'Redessiner'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDownload}
                aria-label="Télécharger le graphique en PNG"
                title="Télécharger l'image PNG"
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Download className="w-4 h-4" />
                <span className="hidden md:inline ml-1">PNG</span>
              </button>

              <button
                type="button"
                onClick={handleCloseFullscreen}
                aria-label="Fermer le plein écran"
                title="Fermer (Échap)"
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-pink-600 hover:bg-pink-700 active:bg-pink-800 text-white text-xs font-black transition-all min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 shadow-md shrink-0"
              >
                <X className="w-5 h-5" />
                <span className="hidden sm:inline ml-1">Fermer</span>
              </button>
            </div>
          </header>

          {/* Zone Graphique Élargie Adaptative (Directe, 100% de l'espace disponible) */}
          <main 
            ref={stageRef}
            className="flex-1 min-h-0 w-full flex items-center justify-center p-2 sm:p-4 overflow-y-auto overflow-x-hidden"
          >
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={currentGraphicUrl}
                alt={`Graphique R ${activeGraphicIndex + 1}`}
                className="max-w-full max-h-full w-auto h-auto object-contain rounded-xl shadow-2xl bg-white select-none transition-transform duration-200"
                style={{
                  maxHeight: 'calc(100dvh - 120px)',
                  maxWidth: '100%',
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center'
                }}
                referrerPolicy="no-referrer"
              />
            </div>
          </main>

          {/* Barre inférieure pour la navigation sur Mobile (si plusieurs graphiques) */}
          {allGraphics.length > 1 && (
            <footer className="shrink-0 bg-slate-900/95 border-t border-slate-800 px-3 py-2 flex items-center justify-between gap-2 z-20">
              <button
                type="button"
                onClick={() => setActiveGraphicIndex((prev) => (prev > 0 ? prev - 1 : allGraphics.length - 1))}
                aria-label="Graphique précédent"
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold min-h-[44px] min-w-[44px] flex items-center gap-1 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Précédent</span>
              </button>

              <div className="text-center">
                <span className="text-xs font-bold text-slate-300">
                  Graphique {activeGraphicIndex + 1} sur {allGraphics.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setActiveGraphicIndex((prev) => (prev < allGraphics.length - 1 ? prev + 1 : 0))}
                aria-label="Graphique suivant"
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold min-h-[44px] min-w-[44px] flex items-center gap-1 active:scale-95"
              >
                <span>Suivant</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </footer>
          )}
        </div>
      )}
    </>
  );
}
