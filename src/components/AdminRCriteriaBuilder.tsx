import React from 'react';
import {
  PlusCircle,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Code2,
  CheckSquare,
  Square
} from 'lucide-react';
import {
  RCorrectionCriterion,
  RCorrectionCriterionType,
  R_CORRECTION_TEST_TYPES,
  R_CLASSES_OPTIONS,
  createDefaultCriterion
} from '../lib/rCorrectionEngine';

interface AdminRCriteriaBuilderProps {
  criteria: RCorrectionCriterion[];
  onChange: (criteria: RCorrectionCriterion[]) => void;
}

export const AdminRCriteriaBuilder: React.FC<AdminRCriteriaBuilderProps> = ({
  criteria,
  onChange
}) => {
  const handleAddCriterion = () => {
    const newCrit = createDefaultCriterion('object_exists');
    onChange([...criteria, newCrit]);
  };

  const handleRemoveCriterion = (index: number) => {
    onChange(criteria.filter((_, i) => i !== index));
  };

  const handleMoveCriterion = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= criteria.length) return;
    const updated = [...criteria];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    onChange(updated);
  };

  const handleChangeType = (index: number, newType: RCorrectionCriterionType) => {
    const def = R_CORRECTION_TEST_TYPES[newType];
    const prevCrit = criteria[index];
    const updated = [...criteria];
    updated[index] = {
      ...prevCrit,
      type: newType,
      ...def.defaultValues,
      // Preserve user object name if already typed
      object: prevCrit.object || def.defaultValues.object || 'x',
      required: prevCrit.required !== false
    };
    onChange(updated);
  };

  const handleUpdateField = (index: number, field: keyof RCorrectionCriterion, value: any) => {
    const updated = [...criteria];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="bg-white border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              🎯 Correction automatique de l'exercice
            </h4>
            <p className="text-xs sm:text-sm font-medium text-slate-700 leading-relaxed">
              Choisissez ce que l'apprenant doit réussir. L'application créera automatiquement les tests R correspondants et les exécutera dans WebR.
            </p>
          </div>
        </div>
      </div>

      {/* Criteria list */}
      {criteria.length === 0 ? (
        <div className="text-center p-6 sm:p-8 border-2 border-dashed border-emerald-200/80 rounded-2xl bg-emerald-50/30 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <Code2 className="w-5 h-5" />
          </div>
          <p className="text-xs sm:text-sm font-extrabold text-slate-900">
            Aucun critère de correction automatique configuré
          </p>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            Ajoutez au moins un critère (ex : vérifier qu'une variable existe, vérifier sa valeur) pour activer l'auto-correction.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {criteria.map((crit, idx) => {
            const def = R_CORRECTION_TEST_TYPES[crit.type] || R_CORRECTION_TEST_TYPES.object_exists;
            const isFirst = idx === 0;
            const isLast = idx === criteria.length - 1;

            return (
              <div
                key={crit.id || idx}
                className="bg-white border border-slate-200/90 hover:border-emerald-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs transition-all"
              >
                {/* Criterion Header */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-lg text-xs font-black uppercase tracking-wider shrink-0">
                      Critère {idx + 1}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {def.label}
                    </span>
                  </div>

                  {/* Top actions */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {/* Required toggle */}
                    <button
                      type="button"
                      onClick={() => handleUpdateField(idx, 'required', !(crit.required !== false))}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        crit.required !== false
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                      }`}
                      title={crit.required !== false ? 'Critère obligatoire pour réussir' : 'Critère facultatif / bonus'}
                    >
                      {crit.required !== false ? (
                        <CheckSquare className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      <span>{crit.required !== false ? 'Obligatoire' : 'Facultatif'}</span>
                    </button>

                    {/* Move controls */}
                    {criteria.length > 1 && (
                      <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveCriterion(idx, 'up')}
                          disabled={isFirst}
                          className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors disabled:opacity-25"
                          title="Monter ce critère"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveCriterion(idx, 'down')}
                          disabled={isLast}
                          className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors disabled:opacity-25"
                          title="Descendre ce critère"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleRemoveCriterion(idx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200/70 rounded-lg transition-colors ml-0.5"
                      title="Supprimer ce critère"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Supprimer</span>
                    </button>
                  </div>
                </div>

                {/* Criterion Type selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Type de vérification <span className="text-emerald-600">*</span>
                  </label>
                  <select
                    value={crit.type}
                    onChange={e => handleChangeType(idx, e.target.value as RCorrectionCriterionType)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="object_exists">☐ L'objet existe (ex: variable ou fonction créée dans R)</option>
                    <option value="object_value">☐ La valeur de l'objet est correcte (ex: moyenne == 15)</option>
                    <option value="object_class">☐ La classe / type est correcte (ex: numeric, data.frame, list)</option>
                    <option value="object_length">☐ Longueur de l'objet (ex: length == 5)</option>
                    <option value="rows">☐ Nombre de lignes d'un tableau (ex: nrow == 100)</option>
                    <option value="columns">☐ Nombre de colonnes d'un tableau (ex: ncol == 5)</option>
                    <option value="column_exists">☐ Nom d'une colonne dans un tableau (ex: colonne "age")</option>
                    <option value="object_result">☐ Résultat final d'un calcul</option>
                    <option value="expression">☐ Expression R personnalisée libre</option>
                  </select>
                </div>

                {/* Specific Fields by Type */}
                <div className="p-3.5 sm:p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-3.5">
                  {/* 1. OBJECT_EXISTS */}
                  {crit.type === 'object_exists' && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Nom de l'objet attendu dans R <span className="text-emerald-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={crit.object || ''}
                        onChange={e => handleUpdateField(idx, 'object', e.target.value)}
                        placeholder="ex: x ou moyenne"
                        required
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                      />
                      <p className="text-xs text-slate-600 font-medium">
                        Vérifie que l'apprenant a bien créé une variable ou fonction appelée <code className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 font-bold rounded text-xs">{crit.object || 'x'}</code>.
                      </p>
                    </div>
                  )}

                  {/* 2. OBJECT_VALUE */}
                  {crit.type === 'object_value' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Nom de l'objet <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={crit.object || ''}
                          onChange={e => handleUpdateField(idx, 'object', e.target.value)}
                          placeholder="ex: moyenne"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Valeur attendue <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={crit.expected !== undefined ? String(crit.expected) : ''}
                          onChange={e => handleUpdateField(idx, 'expected', e.target.value)}
                          placeholder="ex: 15 ou c(10, 15, 20)"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>
                    </div>
                  )}

                  {/* 3. OBJECT_RESULT */}
                  {crit.type === 'object_result' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Objet <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={crit.object || ''}
                          onChange={e => handleUpdateField(idx, 'object', e.target.value)}
                          placeholder="ex: resultat"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Résultat attendu <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={crit.expected !== undefined ? String(crit.expected) : ''}
                          onChange={e => handleUpdateField(idx, 'expected', e.target.value)}
                          placeholder="ex: 15"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>
                    </div>
                  )}

                  {/* 4. OBJECT_CLASS */}
                  {crit.type === 'object_class' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Nom de l'objet <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={crit.object || ''}
                          onChange={e => handleUpdateField(idx, 'object', e.target.value)}
                          placeholder="ex: age ou notes"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Classe / Type attendu <span className="text-emerald-600">*</span>
                        </label>
                        <select
                          value={crit.expected_class || 'numeric'}
                          onChange={e => handleUpdateField(idx, 'expected_class', e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                        >
                          {R_CLASSES_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* 5. OBJECT_LENGTH */}
                  {crit.type === 'object_length' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Nom de l'objet (vecteur/liste) <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={crit.object || ''}
                          onChange={e => handleUpdateField(idx, 'object', e.target.value)}
                          placeholder="ex: notes"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Longueur attendue (length) <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={crit.length !== undefined ? crit.length : 5}
                          onChange={e => handleUpdateField(idx, 'length', parseInt(e.target.value, 10) || 0)}
                          placeholder="ex: 5"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>
                    </div>
                  )}

                  {/* 6. ROWS */}
                  {crit.type === 'rows' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Nom du tableau (data.frame / matrice) <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={crit.object || ''}
                          onChange={e => handleUpdateField(idx, 'object', e.target.value)}
                          placeholder="ex: donnees"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Nombre de lignes attendu (nrow) <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={crit.rows !== undefined ? crit.rows : 100}
                          onChange={e => handleUpdateField(idx, 'rows', parseInt(e.target.value, 10) || 0)}
                          placeholder="ex: 100"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>
                    </div>
                  )}

                  {/* 7. COLUMNS */}
                  {crit.type === 'columns' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Nom du tableau (data.frame / matrice) <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={crit.object || ''}
                          onChange={e => handleUpdateField(idx, 'object', e.target.value)}
                          placeholder="ex: donnees"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Nombre de colonnes attendu (ncol) <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={crit.columns !== undefined ? crit.columns : 5}
                          onChange={e => handleUpdateField(idx, 'columns', parseInt(e.target.value, 10) || 0)}
                          placeholder="ex: 5"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>
                    </div>
                  )}

                  {/* 8. COLUMN_EXISTS */}
                  {crit.type === 'column_exists' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Nom du tableau (data.frame) <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={crit.object || ''}
                          onChange={e => handleUpdateField(idx, 'object', e.target.value)}
                          placeholder="ex: donnees"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Nom de la colonne attendue <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={crit.column || ''}
                          onChange={e => handleUpdateField(idx, 'column', e.target.value)}
                          placeholder="ex: age ou salaire"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>
                    </div>
                  )}

                  {/* 9. EXPRESSION */}
                  {crit.type === 'expression' && (
                    <div className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Expression R à évaluer (doit retourner TRUE) <span className="text-emerald-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={crit.expression || ''}
                          onChange={e => handleUpdateField(idx, 'expression', e.target.value)}
                          placeholder="ex: moyenne == 15 ou is.numeric(notes) && length(notes) == 3"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-emerald-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Description affichée à l'apprenant (optionnel)
                        </label>
                        <input
                          type="text"
                          value={crit.description || ''}
                          onChange={e => handleUpdateField(idx, 'description', e.target.value)}
                          placeholder="ex: La moyenne des notes doit être égale à 15"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Criterion Button */}
      <button
        type="button"
        onClick={handleAddCriterion}
        className="w-full py-3.5 bg-white hover:bg-emerald-50/70 text-emerald-800 hover:text-emerald-900 border-2 border-dashed border-emerald-300 hover:border-emerald-400 rounded-2xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 shadow-2xs active:scale-[0.99]"
      >
        <PlusCircle className="w-4.5 h-4.5 text-emerald-600" />
        <span>+ Ajouter un critère de correction</span>
      </button>
    </div>
  );
};
