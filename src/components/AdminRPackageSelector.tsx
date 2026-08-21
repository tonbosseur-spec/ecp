import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  X, 
  Check, 
  Sparkles, 
  Info, 
  AlertCircle 
} from 'lucide-react';
import { 
  AVAILABLE_R_PACKAGES, 
  RPackageDefinition 
} from '../lib/rPackageManager';

interface AdminRPackageSelectorProps {
  selectedPackages: string[];
  onChange: (packages: string[]) => void;
}

export const AdminRPackageSelector: React.FC<AdminRPackageSelectorProps> = ({
  selectedPackages = [],
  onChange,
}) => {
  const [customPackageName, setCustomPackageName] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const togglePackage = (pkgName: string) => {
    const clean = pkgName.trim();
    if (selectedPackages.includes(clean)) {
      onChange(selectedPackages.filter(p => p !== clean));
    } else {
      onChange([...selectedPackages, clean]);
    }
  };

  const handleAddCustomPackage = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customPackageName.trim();

    if (!clean) {
      setIsAddingCustom(false);
      return;
    }

    if (!/^[a-zA-Z.][a-zA-Z0-9._]*$/.test(clean)) {
      setCustomError("Nom de package invalide (lettres, chiffres, points uniquement).");
      return;
    }

    if (selectedPackages.includes(clean)) {
      setCustomError("Ce package est déjà sélectionné.");
      return;
    }

    onChange([...selectedPackages, clean]);
    setCustomPackageName('');
    setIsAddingCustom(false);
    setCustomError(null);
  };

  const removePackage = (pkgName: string) => {
    onChange(selectedPackages.filter(p => p !== pkgName));
  };

  // Predefined packages list
  const popularPackages = AVAILABLE_R_PACKAGES.slice(0, 10);

  // Custom packages added by user that are not in the predefined list
  const customSelectedPackages = selectedPackages.filter(
    pkg => !AVAILABLE_R_PACKAGES.some(p => p.name.toLowerCase() === pkg.toLowerCase())
  );

  return (
    <div className="space-y-3.5 p-4 sm:p-5 bg-sky-50/50 rounded-2xl border border-sky-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-sky-600 text-white rounded-lg shadow-xs">
            <Package className="w-4 h-4" />
          </span>
          <h3 className="text-xs sm:text-sm font-extrabold text-sky-950 uppercase tracking-wider">
            📦 Packages nécessaires
          </h3>
        </div>

        {selectedPackages.length > 0 && (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-600 text-white shadow-xs">
            {selectedPackages.length} package{selectedPackages.length > 1 ? 's' : ''} sélectionné{selectedPackages.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Explanatory text */}
      <p className="text-xs text-sky-800/90 leading-relaxed">
        Sélectionnez les packages utilisés dans cet exercice. Ils seront préparés et chargés automatiquement dans WebR avant l'exécution du code de l'apprenant.
      </p>

      {/* Selected packages badges list */}
      {selectedPackages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-sky-900 mr-1">Actifs :</span>
          {selectedPackages.map(pkg => (
            <span
              key={pkg}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-sky-600 text-white shadow-xs animate-in fade-in zoom-in-95 duration-150"
            >
              <span>{pkg}</span>
              <button
                type="button"
                onClick={() => removePackage(pkg)}
                className="p-0.5 hover:bg-sky-700 text-sky-100 hover:text-white rounded-md transition-colors"
                title={`Retirer ${pkg}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Checkbox grid for popular packages */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
        {popularPackages.map((pkgDef) => {
          const isSelected = selectedPackages.includes(pkgDef.name);

          return (
            <button
              key={pkgDef.name}
              type="button"
              onClick={() => togglePackage(pkgDef.name)}
              className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                  : 'bg-white text-gray-700 border-sky-200/80 hover:border-sky-300 hover:bg-sky-50/60'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                  isSelected
                    ? 'bg-white text-sky-600 border-white'
                    : 'bg-white border-gray-300 text-transparent'
                }`}
              >
                <Check className="w-3 h-3 stroke-[3]" />
              </div>

              <div className="min-w-0 flex-1">
                <span className={`block text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                  {pkgDef.name}
                </span>
                <span className={`block text-[10px] truncate leading-tight mt-0.5 ${isSelected ? 'text-sky-100' : 'text-gray-500'}`}>
                  {pkgDef.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Packages if any */}
      {customSelectedPackages.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-bold text-sky-900 block">Autres packages personnalisés :</span>
          <div className="flex flex-wrap gap-1.5">
            {customSelectedPackages.map(pkg => (
              <span
                key={pkg}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-200"
              >
                <span>{pkg}</span>
                <button
                  type="button"
                  onClick={() => removePackage(pkg)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add custom package input / button */}
      <div className="pt-1">
        {!isAddingCustom ? (
          <button
            type="button"
            onClick={() => {
              setIsAddingCustom(true);
              setCustomError(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-sky-50 text-sky-700 border border-dashed border-sky-300 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Ajouter un autre package</span>
          </button>
        ) : (
          <form onSubmit={handleAddCustomPackage} className="space-y-2 max-w-sm">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customPackageName}
                onChange={e => {
                  setCustomPackageName(e.target.value);
                  setCustomError(null);
                }}
                placeholder="ex: scales, corrplot, jsonlite..."
                className="flex-1 px-3 py-1.5 bg-white border border-sky-300 rounded-xl text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                autoFocus
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Ajouter
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingCustom(false);
                  setCustomPackageName('');
                  setCustomError(null);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {customError && (
              <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{customError}</span>
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
