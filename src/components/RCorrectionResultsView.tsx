import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Award,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  Code2,
  Info
} from 'lucide-react';
import {
  RCorrectionSuiteResult,
  R_CORRECTION_TEST_TYPES
} from '../lib/rCorrectionEngine';

interface RCorrectionResultsViewProps {
  result: RCorrectionSuiteResult;
  points?: number;
  onNextActivity?: () => void;
  onRetry?: () => void;
  hasNextActivity?: boolean;
}

export const RCorrectionResultsView: React.FC<RCorrectionResultsViewProps> = ({
  result,
  points = 10,
  onNextActivity,
  onRetry,
  hasNextActivity = true,
}) => {
  const {
    success,
    totalTests,
    passedTests,
    totalRequired,
    passedRequired,
    scorePercentage,
    hasStudentCodeError,
    studentErrorMessage,
    testResults
  } = result;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 1. Global Status Banner */}
      <div
        className={`p-5 sm:p-6 rounded-3xl border shadow-2xs transition-all ${
          success
            ? 'bg-emerald-50/90 border-emerald-200 text-slate-900'
            : 'bg-rose-50/90 border-rose-200 text-slate-900'
        }`}
      >
        <div className="flex items-start gap-3.5 sm:gap-4">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${
              success
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            {success ? (
              <Check className="w-6 h-6 stroke-[3]" />
            ) : (
              <XCircle className="w-6 h-6 stroke-[2.5]" />
            )}
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                {success ? '🎉 Exercice validé avec succès !' : '⚠️ Exercice non validé'}
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-black px-2.5 py-1 rounded-xl border shadow-2xs ${
                    success
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                      : 'bg-rose-100 text-rose-950 border-rose-300'
                  }`}
                >
                  Score : {scorePercentage}%
                </span>
                {success && points > 0 && (
                  <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-amber-100 text-amber-950 border border-amber-300 flex items-center gap-1 shadow-2xs">
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    +{points} pts
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
              {success
                ? `Tous les critères obligatoires (${passedRequired}/${totalRequired}) ont été validés avec succès.`
                : `${passedRequired} critère(s) obligatoire(s) sur ${totalRequired} validé(s). Suivez les indications ci-dessous pour corriger votre script.`}
            </p>
          </div>
        </div>

        {/* Action CTA inside banner if success */}
        {success && onNextActivity && (
          <div className="mt-4 pt-4 border-t border-emerald-200/80 flex justify-end">
            <button
              type="button"
              onClick={onNextActivity}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <span>{hasNextActivity ? 'Passer à l\'activité suivante' : 'Terminer la leçon'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Student code error notice if any */}
      {hasStudentCodeError && studentErrorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300/90 rounded-2xl space-y-2 text-xs sm:text-sm shadow-2xs">
          <div className="flex items-center gap-2 font-black text-rose-950 text-sm">
            <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
            <span>Erreur d'exécution de votre code R :</span>
          </div>
          <pre className="p-3 bg-slate-950 rounded-xl font-mono text-xs text-rose-300 whitespace-pre-wrap overflow-x-auto border border-slate-800 shadow-inner">
            {studentErrorMessage}
          </pre>
          <p className="text-xs text-slate-700 font-semibold">
            Assurez-vous qu'il n'y a pas d'erreur de syntaxe ou de variable indéfinie avant de relancer la validation.
          </p>
        </div>
      )}

      {/* 3. Detailed Criteria Breakdown Cards */}
      {testResults.length > 0 && (
        <div className="space-y-2.5">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider px-1">
            Détail des vérifications ({passedTests} / {totalTests} validés) :
          </h4>

          <div className="space-y-2">
            {testResults.map((test, index) => {
              const def = R_CORRECTION_TEST_TYPES[test.criterion.type] || R_CORRECTION_TEST_TYPES.object_exists;

              return (
                <div
                  key={test.criterion.id || index}
                  className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all shadow-2xs ${
                    test.passed
                      ? 'bg-emerald-50/80 border-emerald-200/90'
                      : 'bg-rose-50/80 border-rose-200/90'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-black shadow-2xs ${
                        test.passed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {test.passed ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <X className="w-3.5 h-3.5 stroke-[3]" />
                      )}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[11px] font-black uppercase tracking-wider ${
                            test.passed ? 'text-emerald-900' : 'text-rose-900'
                          }`}
                        >
                          {def.shortLabel} :
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-900">
                          {test.message}
                        </span>
                      </div>

                      {test.error && (
                        <div className="p-2 bg-white/90 border border-rose-200 rounded-lg text-xs font-mono text-rose-950 font-bold mt-1">
                          {test.error}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 self-end sm:self-center">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                        test.isRequired
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {test.isRequired ? 'Obligatoire' : 'Facultatif'}
                    </span>

                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                        test.passed
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                          : 'bg-rose-100 text-rose-950 border-rose-300'
                      }`}
                    >
                      {test.passed ? '✓ Validé' : '✗ À corriger'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
