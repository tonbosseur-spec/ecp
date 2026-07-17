import React from 'react';
import QuizPlayer from '../components/QuizPlayer';
import { Quiz } from '../types';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MOCK_QUIZ: Quiz = {
  id: 'demo-quiz',
  title: 'Test de connaissances : Statistiques',
  questions: [
    {
      id: 'q1',
      question: "Quelle est la définition d'un échantillon représentatif ?",
      options: [
        "Un petit groupe de personnes choisies au hasard",
        "Un sous-groupe de la population qui reflète fidèlement ses caractéristiques",
        "Le groupe le plus large possible de participants",
        "Une liste de noms tirés d'un annuaire"
      ],
      correctAnswerIndex: 1,
      explanation: "Un échantillon est représentatif s'il possède les mêmes caractéristiques (âge, sexe, catégorie sociale, etc.) que la population globale étudiée."
    },
    {
      id: 'q2',
      question: "Dans une distribution normale, quel pourcentage des données se situe à plus ou moins un écart-type de la moyenne ?",
      options: [
        "Environ 50%",
        "Environ 68%",
        "Environ 95%",
        "Environ 99%"
      ],
      correctAnswerIndex: 1,
      explanation: "Selon la règle empirique (68-95-99.7), environ 68 % des valeurs d'une distribution normale se situent à moins d'un écart-type de la moyenne."
    },
    {
      id: 'q3',
      question: "Qu'est-ce que la valeur 'p' (p-value) en statistiques ?",
      options: [
        "La probabilité que l'hypothèse nulle soit vraie",
        "La probabilité d'obtenir un résultat au moins aussi extrême si l'hypothèse nulle est vraie",
        "La puissance d'un test statistique",
        "La corrélation entre deux variables"
      ],
      correctAnswerIndex: 1,
      explanation: "La p-value est la probabilité, sous l'hypothèse nulle, d'obtenir une valeur de la statistique de test au moins aussi extrême que celle observée."
    }
  ]
};

export default function QuizDemo() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold mb-8 transition-colors group"
        >
          <div className="p-2 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-all">
            <ChevronLeft className="w-5 h-5" />
          </div>
          Retour
        </button>

        <div className="mb-12 text-center">
          <h1 className="text-4xl font-black text-slate-900 mb-4">Démonstration du Quiz</h1>
          <p className="text-slate-600 max-w-xl mx-auto font-medium">
            Testez le composant QuizPlayer avec intégration de canvas-confetti pour les réussites.
          </p>
        </div>

        <QuizPlayer 
          quiz={MOCK_QUIZ} 
          onComplete={(score) => console.log(`Quiz terminé avec le score: ${score}`)}
        />
      </div>
    </div>
  );
}
