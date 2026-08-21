import React, { useState } from 'react';
import { X, Search, FunctionSquare, ArrowRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EXCEL_FUNCTIONS } from '../../lib/excel/excelFunctionsList';
import { ExcelFunctionItem } from '../../lib/excel/excelTypes';

interface ExcelFunctionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFunction: (funcName: string) => void;
}

export const ExcelFunctionPicker: React.FC<ExcelFunctionPickerProps> = ({
  isOpen,
  onClose,
  onSelectFunction
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');

  const categories = ['Tous', 'Math', 'Statistiques', 'Logique', 'Texte', 'Recherche'];

  const filteredFunctions = EXCEL_FUNCTIONS.filter((fn) => {
    const matchesSearch =
      fn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fn.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'Tous' || fn.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/40 backdrop-blur-xs">
          {/* Backdrop click to dismiss */}
          <div className="absolute inset-0" onClick={onClose} />

          {/* Bottom Sheet Modal Container */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] z-10"
          >
            {/* Sheet Drag Handle for mobile */}
            <div className="pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center font-bold">
                  ƒx
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    Fonctions Excel
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sélectionnez une fonction pour l'insérer dans votre formule
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search & Category Pills */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher une fonction (ex: SOMME, SI)..."
                  className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-600 shadow-2xs"
                />
              </div>

              {/* Categories */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Functions List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1 max-h-[400px]">
              {filteredFunctions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Aucune fonction trouvée pour "{searchTerm}".
                </div>
              ) : (
                filteredFunctions.map((fn) => (
                  <div
                    key={fn.name}
                    onClick={() => {
                      onSelectFunction(fn.name);
                      onClose();
                    }}
                    className="group p-3.5 bg-white hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 rounded-2xl transition-all cursor-pointer shadow-2xs flex items-start justify-between gap-3 active:scale-[0.99]"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-slate-900 group-hover:text-emerald-800">
                          {fn.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                          {fn.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-snug">
                        {fn.description}
                      </p>
                      <div className="pt-1 flex items-center gap-2 text-[11px] font-mono text-emerald-700">
                        <span className="text-slate-400 not-italic">Syntaxe :</span>
                        <code className="bg-slate-100 px-1.5 py-0.5 rounded-sm text-slate-700">
                          {fn.syntax}
                        </code>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="shrink-0 mt-1 p-2 rounded-xl bg-emerald-500 group-hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-xs"
                      title="Insérer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer Notice */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500 font-medium">
              💡 Astuce : Cliquez sur une fonction pour l'insérer dans la formule active.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
