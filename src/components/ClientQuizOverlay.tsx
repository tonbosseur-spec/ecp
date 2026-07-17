import React, { useState } from 'react';
import { X, Check, AlertCircle, Award, RefreshCw, ChevronRight, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Question {
  text: string;
  options: string[];
  correct_index: number;
}

interface Quiz {
  title: string;
  questions: Question[];
}

interface ClientQuizOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: Quiz;
  moduleTitle: string;
  onPass: (score: number) => void;
}

export function ClientQuizOverlay({
  isOpen,
  onClose,
  quiz,
  moduleTitle,
  onPass,
}: ClientQuizOverlayProps) {
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [quizState, setQuizState] = useState<'playing' | 'success' | 'failed'>('playing');
  const [scorePercentage, setScorePercentage] = useState(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);

  if (!isOpen) return null;

  const totalQuestions = quiz.questions?.length || 0;
  const currentQuestion = quiz.questions?.[currentQuestionIdx];

  const handleSelectOption = (optionIndex: number) => {
    const newAnswers = [...selectedOptions];
    newAnswers[currentQuestionIdx] = optionIndex;
    setSelectedOptions(newAnswers);
  };

  const handleNext = () => {
    if (selectedOptions[currentQuestionIdx] === undefined) {
      alert("Veuillez sélectionner une réponse.");
      return;
    }

    if (currentQuestionIdx < totalQuestions - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    } else {
      // Calculate Score
      let correctCount = 0;
      quiz.questions.forEach((q, idx) => {
        if (selectedOptions[idx] === q.correct_index) {
          correctCount++;
        }
      });

      const percentage = Math.round((correctCount / totalQuestions) * 100);
      setScorePercentage(percentage);
      setCorrectAnswersCount(correctCount);

      if (percentage >= 70) {
        setQuizState('success');
        onPass(percentage);
      } else {
        setQuizState('failed');
      }
    }
  };

  const handleRetry = () => {
    setCurrentQuestionIdx(0);
    setSelectedOptions([]);
    setQuizState('playing');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95 backdrop-blur-lg flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative max-h-[92vh]">
        
        {/* Absolute Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 rounded-full transition-all z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <AnimatePresence mode="wait">
          {quizState === 'playing' && currentQuestion && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="p-6 sm:p-10 flex-1 flex flex-col"
            >
              {/* Header */}
              <div className="mb-6">
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
                  Évaluation : {quiz.title}
                </span>
                <p className="text-xs text-slate-400 mt-2 truncate">
                  Module : {moduleTitle}
                </p>
                
                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-400 font-bold mb-1.5">
                    <span>Progression</span>
                    <span>Question {currentQuestionIdx + 1} sur {totalQuestions}</span>
                  </div>
                  <div className="h-2 bg-slate-850 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${((currentQuestionIdx + 1) / totalQuestions) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Question Text */}
              <div className="flex-1 my-4 flex flex-col justify-center">
                <h3 className="text-lg sm:text-xl font-extrabold text-white leading-snug">
                  {currentQuestion.text}
                </h3>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 gap-3.5 mt-4 mb-8">
                {currentQuestion.options.map((option, oIdx) => {
                  const isSelected = selectedOptions[currentQuestionIdx] === oIdx;
                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleSelectOption(oIdx)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-4 ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500/80 text-white shadow-lg shadow-emerald-500/5'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-950/70'
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 transition-all ${
                        isSelected
                          ? 'bg-emerald-500 text-white scale-110 shadow-sm shadow-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold flex-1 leading-snug">
                        {option}
                      </span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-white stroke-[3.5]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Bottom Nav */}
              <div className="flex justify-end pt-4 border-t border-slate-800/60 shrink-0">
                <button
                  onClick={handleNext}
                  disabled={selectedOptions[currentQuestionIdx] === undefined}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {currentQuestionIdx < totalQuestions - 1 ? (
                    <>
                      Suivant
                      <ChevronRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Soumettre mes réponses
                      <Check className="w-4 h-4 stroke-[3]" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {quizState === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="p-8 sm:p-12 text-center flex flex-col items-center justify-center"
            >
              {/* Celeb visual badge */}
              <div className="w-20 h-20 bg-emerald-500/15 text-emerald-400 rounded-3xl flex items-center justify-center mb-6 animate-bounce">
                <Award className="w-10 h-10" />
              </div>

              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
                Validation Réussie !
              </span>
              
              <h2 className="text-2xl sm:text-3xl font-black text-white mt-4 mb-2 tracking-tight">
                Félicitations ! 🎉
              </h2>
              
              <p className="text-slate-400 text-xs sm:text-sm max-w-md mb-8 leading-relaxed">
                Vous avez brillamment complété l'évaluation avec un score de <strong className="text-white text-base">{scorePercentage}%</strong> ({correctAnswersCount} sur {totalQuestions} réponses correctes).
                Ce module est maintenant entièrement validé.
              </p>

              {/* Dynamic Confetti decoration inside the card */}
              <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden rounded-[2rem]">
                <div className="absolute top-12 left-12 w-3 h-3 bg-red-400 rounded-full animate-ping"></div>
                <div className="absolute top-1/2 right-12 w-2 h-2 bg-yellow-400 rounded-full animate-bounce"></div>
                <div className="absolute bottom-12 left-1/3 w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                <button
                  onClick={onClose}
                  className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-2xl text-xs font-bold transition-colors border border-slate-700/50"
                >
                  Retourner au cours
                </button>
              </div>
            </motion.div>
          )}

          {quizState === 'failed' && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="p-8 sm:p-12 text-center flex flex-col items-center justify-center"
            >
              <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-3xl flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>

              <span className="text-[10px] font-black uppercase text-red-400 tracking-widest bg-red-500/10 px-3 py-1 rounded-full">
                Score Insuffisant
              </span>
              
              <h2 className="text-2xl font-black text-white mt-4 mb-2 tracking-tight">
                Évaluation non validée
              </h2>
              
              <p className="text-slate-400 text-xs sm:text-sm max-w-md mb-8 leading-relaxed">
                Votre score est de <strong className="text-red-400">{scorePercentage}%</strong>. L'objectif requis pour valider ce module est d'au moins <strong className="text-emerald-400">70%</strong> de bonnes réponses.
                Prenez le temps de réviser la leçon ou la vidéo récapitulative et réessayez !
              </p>

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                <button
                  onClick={onClose}
                  className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-2xl text-xs font-bold transition-all border border-slate-700/50"
                >
                  Relire la leçon
                </button>
                <button
                  onClick={handleRetry}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-extrabold transition-all shadow-lg flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Réessayer le Quizz
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
