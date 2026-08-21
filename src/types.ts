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

import { ExcelChallengeConfig } from './lib/excel/excelChallengeTypes';

// Training Center types
export type TrainingActivityType = 'quiz_qcm' | 'r_exercise' | 'excel_exercise' | 'mixed';
export type TrainingDifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingExerciseType = 'qcm' | 'r_code' | 'excel_formula';

export interface TrainingSession {
  id: string;
  course_id?: string | null;
  slug?: string | null;
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
  ai_assistance_enabled?: boolean;
  expected_output?: string | null;
  test_cases?: any;
  excel_config?: ExcelChallengeConfig;
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
    type: 'r_code' | 'qcm' | 'excel_formula';
    passed_tests?: number;
    total_tests?: number;
    passed_criteria?: number;
    total_criteria?: number;
    selected_option_index?: number;
    [key: string]: any;
  };
  is_correct: boolean;
  score: number;
  created_at?: string;
  updated_at?: string;
}

// Interactive Autonomous Course Types
export type InteractiveCourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type InteractiveCourseCategory = 'R' | 'Excel' | 'Power BI' | 'SQL' | 'Python' | 'DAX' | 'General';
export type InteractiveCourseStatus = 'draft' | 'published' | 'archived';
export type InteractiveActivityType = 
  | 'text' 
  | 'video' 
  | 'image' 
  | 'quiz' 
  | 'code_r' 
  | 'challenge' 
  | 'assessment' 
  | 'code_python' 
  | 'code_sql' 
  | 'code_excel' 
  | 'code_dax';

export interface InteractiveCourse {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  cover_image?: string | null;
  level: InteractiveCourseLevel;
  category: InteractiveCourseCategory;
  estimated_duration: number;
  status: InteractiveCourseStatus;
  access_policy: {
    type: 'free' | 'premium' | 'linked_course' | 'restricted';
    linked_course_id?: string;
    allowed_domain?: string;
    [key: string]: any;
  };
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
  interactive_course_modules?: InteractiveCourseModule[];
}

export interface InteractiveCourseModule {
  id: string;
  course_id: string;
  title: string;
  description?: string | null;
  position: number;
  created_at?: string;
  updated_at?: string;
  interactive_courses?: InteractiveCourse | null;
  interactive_course_lessons?: InteractiveCourseLesson[];
}

export interface InteractiveCourseLesson {
  id: string;
  module_id: string;
  title: string;
  description?: string | null;
  position: number;
  estimated_duration: number;
  created_at?: string;
  updated_at?: string;
  interactive_course_modules?: InteractiveCourseModule | null;
  interactive_activities?: InteractiveActivity[];
}

export interface InteractiveActivity {
  id: string;
  lesson_id: string;
  activity_type: InteractiveActivityType;
  title: string;
  instructions: string;
  position: number;
  is_required: boolean;
  points: number;
  configuration: {
    video_url?: string;
    image_url?: string;
    caption?: string;
    content?: string;
    questions?: {
      id?: string;
      question: string;
      options: string[];
      explanation?: string;
      correctAnswerIndex?: number;
    }[];
    options?: string[];
    question?: string;
    starter_code?: string;
    correction?: {
      tests?: any[];
      [key: string]: any;
    };
    [key: string]: any;
  };
  hints: string[];
  created_at?: string;
  updated_at?: string;
}

export interface InteractiveActivityProgress {
  id?: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  activity_id: string;
  completed: boolean;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CourseProgressionSummary {
  totalActivities: number;
  completedActivities: number;
  totalRequiredActivities: number;
  completedRequiredActivities: number;
  percentage: number;
  requiredPercentage: number;
  isCourseCompleted: boolean;
  nextLessonId?: string | null;
  nextActivityId?: string | null;
  completedActivityIds: Set<string>;
}

