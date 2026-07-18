import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Check, HelpCircle, AlertCircle } from 'lucide-react';
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

interface QuizEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuiz: Quiz | null;
  onSave: (quiz: Quiz) => void;
  moduleTitle: string;
}

export function QuizEditorModal({
  isOpen,
  onClose,
  initialQuiz,
  onSave,
  moduleTitle,
}: QuizEditorModalProps) {
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setTitle(initialQuiz?.title || `Quizz : ${moduleTitle || "Validation"}`);
      
      const loadedQuestions = initialQuiz?.questions && initialQuiz.questions.length > 0
        ? JSON.parse(JSON.stringify(initialQuiz.questions))
        : [{ text: '', options: ['', '', '', ''], correct_index: 0 }];
      
      // Assurer que chaque question chargée a exactement 4 options pour l'édition
      loadedQuestions.forEach((q: Question) => {
        if (!q.options) q.options = [];
        while (q.options.length < 4) {
          q.options.push('');
        }
      });
      
      setQuestions(loadedQuestions);
    }
  }, [isOpen, initialQuiz, moduleTitle]);

  if (!isOpen) return null;

  const handleAddQuestion = () => {
    setError(null);
    setQuestions([
      ...questions,
      { text: '', options: ['', '', '', ''], correct_index: 0 }
    ]);
  };

  const handleRemoveQuestion = (qIndex: number) => {
    setError(null);
    if (questions.length === 1) {
      setError("Un quizz doit contenir au moins une question.");
      return;
    }
    setQuestions(questions.filter((_, idx) => idx !== qIndex));
  };

  const handleQuestionTextChange = (qIndex: number, text: string) => {
    setError(null);
    setQuestions(
      questions.map((q, idx) => (idx === qIndex ? { ...q, text } : q))
    );
  };

  const handleOptionTextChange = (qIndex: number, oIndex: number, text: string) => {
    setError(null);
    setQuestions(
      questions.map((q, idx) => {
        if (idx === qIndex) {
          const newOptions = [...q.options];
          newOptions[oIndex] = text;
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const handleSelectCorrectOption = (qIndex: number, oIndex: number) => {
    setError(null);
    setQuestions(
      questions.map((q, idx) => (idx === qIndex ? { ...q, correct_index: oIndex } : q))
    );
  };

  const handleSave = () => {
    setError(null);
    // Validation
    if (!title.trim()) {
      setError("Veuillez donner un titre au quizz.");
      return;
    }

    const cleanedQuestions = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`La question ${i + 1} n'a pas d'intitulé.`);
        return;
      }
      
      const filledOptions = q.options.map(opt => opt.trim()).filter(opt => opt !== '');
      if (filledOptions.length < 2) {
        setError(`La question ${i + 1} doit avoir au moins 2 options de réponses remplies.`);
        return;
      }
      
      const correctOptionText = q.options[q.correct_index];
      if (!correctOptionText || !correctOptionText.trim()) {
        setError(`Veuillez sélectionner l'une des options remplies comme bonne réponse pour la question ${i + 1}.`);
        return;
      }
      
      const newCorrectIdx = filledOptions.indexOf(correctOptionText.trim());
      if (newCorrectIdx === -1) {
        setError(`La bonne réponse sélectionnée pour la question ${i + 1} n'est pas valide ou est vide.`);
        return;
      }
      
      cleanedQuestions.push({
        text: q.text.trim(),
        options: filledOptions,
        correct_index: newCorrectIdx
      });
    }

    onSave({
      title: title.trim(),
      questions: cleanedQuestions
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl">
              <HelpCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Configurateur de Quizz</span>
              <h3 className="text-lg font-black text-gray-900 mt-0.5 leading-tight">
                Quizz du module : <span className="text-emerald-700">{moduleTitle || "Sans titre"}</span>
              </h3>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Questions Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          
          {/* Error Banner */}
          {error && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3 text-rose-800 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-250">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <div className="flex-1 leading-snug">
                {error}
              </div>
            </div>
          )}
          
          {/* Quiz Title Input Card */}
          <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs space-y-3">
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
              Titre du Quizz
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Évaluation finale du Module 1"
              className="block w-full px-4 py-3 bg-slate-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
            />
          </div>

          {/* List of Questions */}
          <div className="space-y-6">
            {questions.map((question, qIndex) => (
              <div key={qIndex} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm relative space-y-4">
                
                {/* Question Header & Delete */}
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                    Question {qIndex + 1} sur {questions.length}
                  </span>
                  
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(qIndex)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Supprimer cette question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Question Text */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Intitulé de la question
                  </label>
                  <input
                    type="text"
                    required
                    value={question.text}
                    onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                    placeholder="Ex: Quelle est la fonction principale d'un gestionnaire de tâches ?"
                    className="block w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm font-semibold"
                  />
                </div>

                {/* Options List */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Options de réponses <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-sm normal-case font-bold ml-1">Remplissez au moins 2 options. Les cases vides seront ignorées.</span>
                  </label>
                  <p className="text-[11px] text-gray-400">Cliquez sur le rond vert de l'option pour désigner la bonne réponse.</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {question.options.map((option, oIndex) => {
                      const isCorrect = question.correct_index === oIndex;
                      return (
                        <div 
                          key={oIndex} 
                          className={`flex items-center gap-2 px-3 py-2 border rounded-xl transition-all ${
                            isCorrect 
                              ? 'border-emerald-300 bg-emerald-50/40 shadow-xs' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {/* Correct option selector */}
                          <button
                            type="button"
                            onClick={() => handleSelectCorrectOption(qIndex, oIndex)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                              isCorrect 
                                ? 'bg-emerald-600 text-white scale-110 shadow-sm' 
                                : 'bg-gray-100 hover:bg-gray-200 text-transparent'
                            }`}
                            title="Marquer comme bonne réponse"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3px]" />
                          </button>

                          <input
                            type="text"
                            required
                            value={option}
                            onChange={(e) => handleOptionTextChange(qIndex, oIndex, e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + oIndex)}`}
                            className={`flex-1 bg-transparent border-0 outline-none focus:ring-0 text-xs p-1 font-medium ${
                              isCorrect ? 'text-emerald-900 font-semibold' : 'text-gray-700'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            ))}
          </div>

          {/* Add Question Button */}
          <button
            type="button"
            onClick={handleAddQuestion}
            className="w-full py-4 bg-white hover:bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center gap-2 text-sm font-extrabold text-slate-700 hover:text-slate-900 transition-all group"
          >
            <Plus className="w-5 h-5 text-gray-400 group-hover:scale-110 group-hover:text-emerald-500 transition-all" />
            Ajouter une question de QCM
          </button>

        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 bg-slate-50 border-t border-gray-100 shrink-0">
          <div className="text-[11px] text-gray-500 font-medium max-w-sm">
            💡 <strong>Étape 1 sur 3</strong> : Enregistrez le quizz ici, puis enregistrez le module, et enfin le cours en bas de la page principale pour sauvegarder en base.
          </div>
          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 hover:shadow-emerald-200 transition-all"
            >
              <Check className="w-4 h-4" />
              Enregistrer ce Quizz
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
