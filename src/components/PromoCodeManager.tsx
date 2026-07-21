import React from 'react';
import { PromoCode, QUIZ_CLASSES, calculateDiscountedPrice } from '../lib/promoUtils';
import { Ticket, Percent, Plus, Trash2, Sparkles, CheckCircle2 } from 'lucide-react';

interface PromoCodeManagerProps {
  promoCodes: PromoCode[];
  coursePriceFcfa: number;
  onChange: (codes: PromoCode[]) => void;
}

export default function PromoCodeManager({ promoCodes, coursePriceFcfa, onChange }: PromoCodeManagerProps) {
  // Update a promo code for a specific quiz class index (0 to 4)
  const handleUpdateClassCode = (classIdx: number, field: keyof PromoCode, value: any) => {
    const updated = [...promoCodes];
    const targetClass = QUIZ_CLASSES[classIdx];
    
    // Find index in promoCodes or create one
    let codeIndex = updated.findIndex(p => p.min_score === targetClass.minScore && p.max_score === targetClass.maxScore);
    
    if (codeIndex === -1) {
      // Create code entry for this class
      const newCode: PromoCode = {
        code: targetClass.defaultCode,
        discount_type: 'percentage',
        discount_value: targetClass.defaultDiscount,
        min_score: targetClass.minScore,
        max_score: targetClass.maxScore,
        class_name: targetClass.name,
        description: targetClass.description
      };
      (newCode as any)[field] = value;
      updated.push(newCode);
    } else {
      updated[codeIndex] = {
        ...updated[codeIndex],
        [field]: value
      };
    }

    onChange(updated);
  };

  // Add custom general promo code
  const handleAddCustomCode = () => {
    const customCode: PromoCode = {
      code: `PROMO${Math.floor(10 + Math.random() * 90)}`,
      discount_type: 'percentage',
      discount_value: 15,
      min_score: 0,
      max_score: 100,
      class_name: "Code Promotionnel Général",
      description: "Code promo valable sans condition de score"
    };
    onChange([...promoCodes, customCode]);
  };

  const handleRemoveCustomCode = (index: number) => {
    const updated = promoCodes.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Codes Promo selon les 5 Niveaux du Quizz</h3>
            <p className="text-xs text-slate-500">
              Définissez les réductions automatiques débloquées par les candidats selon leur résultat au quizz
            </p>
          </div>
        </div>
        <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold border border-indigo-100">
          Système Automatique
        </span>
      </div>

      {/* Grid des 5 Classes */}
      <div className="space-y-3.5">
        {QUIZ_CLASSES.map((qc, idx) => {
          // Find promo code for this class
          const codeObj = promoCodes.find(p => p.min_score === qc.minScore && p.max_score === qc.maxScore) || {
            code: qc.defaultCode,
            discount_type: 'percentage' as const,
            discount_value: qc.defaultDiscount,
            min_score: qc.minScore,
            max_score: qc.maxScore,
            class_name: qc.name
          };

          const { finalPrice, discountAmount } = calculateDiscountedPrice(coursePriceFcfa || 0, codeObj);

          return (
            <div 
              key={qc.level}
              className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              {/* Badge & Name */}
              <div className="sm:w-1/3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${qc.badgeBg} ${qc.badgeColor} ${qc.badgeBorder}`}>
                    {qc.name} ({qc.minScore}% à {qc.maxScore}%)
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">{qc.title}</div>
                <p className="text-xs text-slate-500">{qc.description}</p>
              </div>

              {/* Code Name & Discount value */}
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Code Promo
                  </label>
                  <input 
                    type="text"
                    value={codeObj.code}
                    onChange={(e) => handleUpdateClassCode(idx, 'code', e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    placeholder="EX: CODE10"
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 uppercase tracking-wide focus:ring-2 focus:ring-indigo-500 w-28 sm:w-32"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Type
                  </label>
                  <select
                    value={codeObj.discount_type}
                    onChange={(e) => handleUpdateClassCode(idx, 'discount_type', e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="percentage">% Réduction</option>
                    <option value="fixed">FCFA Fixe</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Valeur
                  </label>
                  <div className="relative">
                    <input 
                      type="number"
                      min="0"
                      value={codeObj.discount_value}
                      onChange={(e) => handleUpdateClassCode(idx, 'discount_value', Math.max(0, parseFloat(e.target.value) || 0))}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 w-20 focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="absolute right-2 top-1.5 text-[11px] font-bold text-slate-400 pointer-events-none">
                      {codeObj.discount_type === 'percentage' ? '%' : 'FCFA'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Impact sur le prix de la formation */}
              <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 text-right w-full sm:w-auto shrink-0 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Prix réduit estimé</span>
                {coursePriceFcfa > 0 ? (
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-xs text-slate-400 line-through">
                      {coursePriceFcfa.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-xs font-black text-emerald-600">
                      {finalPrice.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-slate-500">Gratuit</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Codes Promo Généraux Supplémentaires */}
      {promoCodes.filter(p => !(p.min_score !== undefined && p.max_score !== undefined && p.min_score < p.max_score && (p.max_score - p.min_score <= 20))).length > 0 && (
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Codes Promo Généraux Hors Quizz</h4>
          <div className="space-y-2">
            {promoCodes.map((p, index) => {
              const isClassCode = QUIZ_CLASSES.some(qc => qc.minScore === p.min_score && qc.maxScore === p.max_score);
              if (isClassCode) return null;

              return (
                <div key={index} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input 
                      type="text"
                      value={p.code}
                      onChange={(e) => {
                        const updated = [...promoCodes];
                        updated[index].code = e.target.value.toUpperCase().replace(/\s+/g, '');
                        onChange(updated);
                      }}
                      className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 uppercase"
                    />
                    <select
                      value={p.discount_type}
                      onChange={(e) => {
                        const updated = [...promoCodes];
                        updated[index].discount_type = e.target.value as any;
                        onChange(updated);
                      }}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                    >
                      <option value="percentage">% Réduction</option>
                      <option value="fixed">FCFA Fixe</option>
                    </select>
                    <input 
                      type="number"
                      value={p.discount_value}
                      onChange={(e) => {
                        const updated = [...promoCodes];
                        updated[index].discount_value = Math.max(0, parseFloat(e.target.value) || 0);
                        onChange(updated);
                      }}
                      className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold w-20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomCode(index)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleAddCustomCode}
        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Ajouter un code promo général
      </button>
    </div>
  );
}
