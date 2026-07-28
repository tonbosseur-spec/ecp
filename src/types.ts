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
