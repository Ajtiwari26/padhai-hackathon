// Learning History — tracks all sessions, chat logs, drawings, notes per chapter
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  skillUsed?: string;        // Which skill generated this response
  attachmentType?: 'image' | 'drawing' | 'mcq' | 'numerical';
  attachmentData?: any;      // MCQ options, drawing JSON, etc.
}

export interface ChapterLearning {
  chapterId: string;
  subjectId: string;
  topicId: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'clear';
  confidenceScore: number;         // 0-100
  chatHistory: ChatMessage[];
  drawings: DrawingSave[];
  notesGenerated: string;          // Markdown notes
  analogiesUsed: string[];
  numericalsSolved: number;
  testsResults: TestResult[];
  assignments: Assignment[];
  lastInteraction: string;
  totalTimeSpentMinutes: number;
}

export interface DrawingSave {
  id: string;
  chapterId: string;
  drawingData: any;     // JSON canvas state
  label: string;
  timestamp: string;
}

export interface TestResult {
  id: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  weakPoints: string[];
  timestamp: string;
  timeTakenSeconds: number;
}

export interface Assignment {
  id: string;
  type: 'objective' | 'subjective' | 'numerical';
  question: string;
  status: 'pending' | 'submitted' | 'evaluated';
  studentAnswer?: string;
  aiEvaluation?: string;
  score?: number;
  timestamp: string;
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  topics: Topic[];
}

export interface Topic {
  id: string;
  name: string;
  chapters: ChapterLearning[];
}

const LEARNING_KEY = '@padhai_learning_history';
const SUBJECTS_KEY = '@padhai_subjects';

export class LearningHistoryStore {
  static async getSubjects(): Promise<Subject[]> {
    try {
      const raw = await AsyncStorage.getItem(SUBJECTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static async saveSubjects(subjects: Subject[]): Promise<void> {
    await AsyncStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));
  }

  static async getChapter(chapterId: string): Promise<ChapterLearning | null> {
    try {
      const raw = await AsyncStorage.getItem(`${LEARNING_KEY}_${chapterId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static async saveChapter(chapter: ChapterLearning): Promise<void> {
    await AsyncStorage.setItem(
      `${LEARNING_KEY}_${chapter.chapterId}`,
      JSON.stringify(chapter)
    );
  }

  static async appendMessage(chapterId: string, message: ChatMessage): Promise<void> {
    const chapter = await this.getChapter(chapterId);
    if (chapter) {
      chapter.chatHistory.push(message);
      chapter.lastInteraction = new Date().toISOString();
      await this.saveChapter(chapter);
    }
  }

  static async updateConfidence(chapterId: string, score: number): Promise<void> {
    const chapter = await this.getChapter(chapterId);
    if (chapter) {
      chapter.confidenceScore = Math.min(100, Math.max(0, score));
      chapter.status = score >= 80 ? 'clear' : score > 0 ? 'in_progress' : 'not_started';
      await this.saveChapter(chapter);
    }
  }
}
