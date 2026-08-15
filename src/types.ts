export interface ModuleSession {
  id: string;
  name: string;
  objectives: string[];
  completionPercent: number;
  date: string;
  isCompleted: boolean;
  type: 'session'; // to distinguish in the download_files array
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation?: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
}

// Training Center types
export type TrainingActivityType = 'quiz_qcm' | 'r_exercise' | 'mixed';
export type TrainingDifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingExerciseType = 'qcm' | 'r_code';

export interface TrainingSession {
  id: string;
  course_id?: string | null;
  title: string;
  description?: string | null;
  activity_type: TrainingActivityType;
  difficulty_level: TrainingDifficultyLevel;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  courses?: { id: string; title: string } | null;
  training_exercises?: { count: number }[] | TrainingExercise[];
}

export interface TrainingExercise {
  id: string;
  training_session_id: string;
  exercise_type: TrainingExerciseType;
  title: string;
  instructions: string;
  order_index: number;
  options?: string[];
  explanation?: string | null;
  starter_code?: string | null;
  hint?: string | null;
  expected_output?: string | null;
  test_cases?: any;
  created_at?: string;
  updated_at?: string;
  correct_option_index?: number;
}

export interface TrainingQcmAnswer {
  exercise_id: string;
  correct_option_index: number;
  created_at?: string;
}

export interface TrainingAttempt {
  id: string;
  training_session_id: string;
  client_id: string;
  score_percentage: number;
  is_passed: boolean;
  time_spent_seconds: number;
  completed_at?: string | null;
  created_at?: string;
}

export interface TrainingExerciseAttempt {
  id: string;
  attempt_id: string;
  exercise_id: string;
  answer_data: {
    type: 'r_code' | 'qcm';
    passed_tests?: number;
    total_tests?: number;
    selected_option_index?: number;
    [key: string]: any;
  };
  is_correct: boolean;
  score: number;
  created_at?: string;
  updated_at?: string;
}

