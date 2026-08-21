import React from 'react';
import { 
  Package, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RotateCcw, 
  Check, 
  Sparkles 
} from 'lucide-react';
import { PackagePreparationStep } from '../lib/rPackageManager';

interface RPackagePreparationBannerProps {
  packages: string[];
  steps: PackagePreparationStep[];
  isPreparing: boolean;
  isReady: boolean;
  error?: string | null;
  currentMessage?: string;
  onRetry?: () => void;
}

export const RPackagePreparationBanner: React.FC<RPackagePreparationBannerProps> = ({
  packages = [],
  steps = [],
  isPreparing = false,
  isReady = false,
  error = null,
  currentMessage = '',
  onRetry,
}) => {
  if (!packages || packages.length === 0) {
    return null;
  }

  // 1. Error state
  if (error) {
    return (
      <div className="p-4 bg-rose-50/90 border border-rose-200/90 rounded-2xl space-y-2.5 text-xs sm:text-sm text-slate-900 shadow-2xs animate-in fade-in">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 font-black text-rose-950 text-sm">
            <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
            <span>⚠️ Impossible de préparer l'environnement R</span>
          </div>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réessayer</span>
            </button>
          )}
        </div>

        <p className="text-xs text-rose-950 leading-relaxed font-semibold">
          {error}
        </p>

        {/* Breakdown of failed steps */}
        <div className="space-y-1 pt-1">
          {steps.map((step) => (
            <div key={step.name} className="flex items-center gap-2 text-xs font-bold">
              {step.status === 'ready' ? (
                <span className="text-emerald-900 flex items-center gap-1 font-extrabold">
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                  <span>✓ {step.name} prêt</span>
                </span>
              ) : (
                <span className="text-rose-900 flex items-center gap-1 font-extrabold">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>✗ {step.name} : {step.error || 'Échec'}</span>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Ready state
  if (isReady) {
    return (
      <div className="p-3.5 bg-emerald-50/90 border border-emerald-200/90 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs animate-in fade-in">
        <div className="flex items-center gap-2 text-emerald-950 font-black text-xs sm:text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
          <span>✓ Environnement R & packages prêts</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {packages.map(pkg => (
            <span
              key={pkg}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-emerald-100 text-emerald-950 border border-emerald-300"
            >
              <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[3]" />
              <span>{pkg} est prêt</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  // 3. Preparing / Loading state
  return (
    <div className="p-4 bg-sky-50/90 border border-sky-200/90 rounded-2xl space-y-2.5 text-xs text-slate-900 shadow-2xs animate-in fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-black text-sky-950 text-xs sm:text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
          <span>⏳ Préparation de l'environnement R...</span>
        </div>
        <span className="text-xs font-black text-sky-950 bg-sky-100 px-2.5 py-0.5 rounded-lg border border-sky-300">
          {steps.filter(s => s.status === 'ready').length} / {packages.length} package{packages.length > 1 ? 's' : ''}
        </span>
      </div>

      {currentMessage && (
        <p className="text-xs text-slate-800 font-mono font-semibold bg-white p-2.5 rounded-xl border border-sky-200 truncate">
          {currentMessage}
        </p>
      )}

      {/* Steps progress checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
          <span>✓ R WebAssembly prêt</span>
        </div>

        {packages.map(pkg => {
          const step = steps.find(s => s.name.toLowerCase() === pkg.toLowerCase());
          const isPkgReady = step?.status === 'ready';
          const isPkgInstalling = step?.status === 'installing' || step?.status === 'checking' || step?.status === 'loading';

          return (
            <div key={pkg} className="flex items-center gap-1.5 text-xs">
              {isPkgReady ? (
                <span className="text-emerald-900 flex items-center gap-1 font-extrabold">
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                  <span>✓ {pkg} est prêt</span>
                </span>
              ) : isPkgInstalling ? (
                <span className="text-sky-900 flex items-center gap-1 font-bold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                  <span>{step?.message || `Préparation de ${pkg}...`}</span>
                </span>
              ) : (
                <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  <span>{pkg} en attente</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
