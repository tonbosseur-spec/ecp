import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  Trophy, 
  RefreshCcw,
  BookOpen,
  HelpCircle,
  Award
} from 'lucide-react';
import { Quiz, QuizQuestion } from '../types';

interface QuizPlayerProps {
  quiz: Quiz;
  onComplete?: (score: number) => void;
}

export default function QuizPlayer({ quiz, onComplete }: QuizPlayerProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const totalQuestions = quiz.questions.length;

  useEffect(() => {
    if (isFinished) {
      const percentage = (score / totalQuestions) * 100;
      if (percentage >= 70) {
        triggerConfetti();
      }
      if (onComplete) {
        onComplete(score);
      }
    }
  }, [isFinished, score, totalQuestions, onComplete]);

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
  };

  const handleConfirmAnswer = () => {
    if (selectedOption === null || isAnswered) return;

    setIsAnswered(true);
    const correct = selectedOption === currentQuestion.correctAnswerIndex;
    if (correct) {
      setScore(prev => prev + 1);
    }
    setUserAnswers(prev => [...prev, selectedOption]);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
    }
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsFinished(false);
    setUserAnswers([]);
  };

  if (isFinished) {
    const percentage = Math.round((score / totalQuestions) * 100);
    const isSuccess = percentage >= 70;

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl p-8 text-center shadow-xl border border-slate-100 max-w-2xl mx-auto"
      >
        <div className="mb-6 flex justify-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isSuccess ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {isSuccess ? <Trophy className="w-12 h-12" /> : <Award className="w-12 h-12" />}
          </div>
        </div>

        <h2 className="text-3xl font-black text-slate-900 mb-2">Quiz Terminé !</h2>
        <p className="text-slate-500 font-medium mb-8">
          {isSuccess ? "Félicitations ! Vous avez brillamment réussi ce quiz." : "Pas mal ! Mais vous pouvez faire mieux."}
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <div className="text-3xl font-black text-slate-900">{score}/{totalQuestions}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Score</div>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <div className="text-3xl font-black text-slate-900">{percentage}%</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Précision</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={restartQuiz}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all"
          >
            <RefreshCcw className="w-5 h-5" />
            Réessayer
          </button>
          <button
            onClick={() => window.history.back()}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all"
          >
            Continuer
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header / Progress */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 leading-none mb-1">Question {currentQuestionIndex + 1}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sur {totalQuestions} questions</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
          <span className="text-xs font-bold text-slate-600">En cours</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-100 rounded-full mb-8 overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${((currentQuestionIndex) / totalQuestions) * 100}%` }}
          className="h-full bg-indigo-600"
        />
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-100 border border-slate-50"
        >
          <h2 className="text-xl font-bold text-slate-900 leading-tight mb-8">
            {currentQuestion.question}
          </h2>

          <div className="space-y-4">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQuestion.correctAnswerIndex;
              
              let variantClasses = "border-slate-100 hover:border-indigo-200 hover:bg-slate-50";
              if (isSelected && !isAnswered) {
                variantClasses = "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/10";
              }
              if (isAnswered) {
                if (isCorrect) {
                  variantClasses = "border-emerald-600 bg-emerald-50 text-emerald-900";
                } else if (isSelected) {
                  variantClasses = "border-red-600 bg-red-50 text-red-900";
                } else {
                  variantClasses = "border-slate-100 opacity-50";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(idx)}
                  disabled={isAnswered}
                  className={`w-full flex items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all text-left ${variantClasses}`}
                >
                  <span className="font-bold">{option}</span>
                  {isAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  {isAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-600" />}
                </button>
              );
            })}
          </div>

          {/* Explanation / Feedback */}
          <AnimatePresence>
            {isAnswered && currentQuestion.explanation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100"
              >
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Explication</p>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Button */}
          <div className="mt-10">
            {!isAnswered ? (
              <button
                onClick={handleConfirmAnswer}
                disabled={selectedOption === null}
                className={`w-full py-5 rounded-[1.5rem] font-black text-lg transition-all shadow-lg ${
                  selectedOption !== null 
                  ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700 active:scale-98' 
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Valider ma réponse
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-[1.5rem] font-black text-lg transition-all flex items-center justify-center gap-2 active:scale-98"
              >
                {currentQuestionIndex < totalQuestions - 1 ? "Question suivante" : "Voir mon score"}
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
