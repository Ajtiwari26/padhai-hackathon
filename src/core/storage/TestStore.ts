import AsyncStorage from '@react-native-async-storage/async-storage';

const TESTS_KEY = 'padh-tests';
const ASSIGNMENTS_KEY = 'padh-assignments';

export interface TestQuestion {
  id: string;
  problem: string;
  options?: string[]; // Optional for numerical
  type: 'mcq' | 'numerical' | 'subjective';
  correctAnswer: string;
  explanation: string;
  studentAnswer?: string;
  timeTakenMs?: number;
}

export interface TestEntry {
  id: string;
  title: string;
  type: 'MCQ' | 'Numerical' | 'Mixed';
  questions: number;
  difficulty: string;
  topic: string;
  status: 'available' | 'completed';
  score?: number;
  maxScore?: number;
  correctCount?: number;
  wrongCount?: number;
  skippedCount?: number;
  timestamp: number;
  durationMs?: number; // Total time taken
  data?: TestQuestion[]; // The actual questions
}

export interface AssignmentEntry {
  id: string;
  title: string;
  chapter: string;
  status: 'pending' | 'submitted';
  dueIn: string;
  score?: number;
  timestamp: number;
}

class TestStoreService {
  public async getTests(): Promise<TestEntry[]> {
    try {
      const raw = await AsyncStorage.getItem(TESTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[TestStore] Failed to read tests:', e);
      return [];
    }
  }

  public async saveTest(test: TestEntry): Promise<void> {
    const tests = await this.getTests();
    const existingIndex = tests.findIndex(t => t.id === test.id);
    if (existingIndex > -1) {
      tests[existingIndex] = test;
    } else {
      tests.unshift(test);
    }
    await AsyncStorage.setItem(TESTS_KEY, JSON.stringify(tests));
  }

  public async getAssignments(): Promise<AssignmentEntry[]> {
    try {
      const raw = await AsyncStorage.getItem(ASSIGNMENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[TestStore] Failed to read assignments:', e);
      return [];
    }
  }

  public async saveAssignment(assignment: AssignmentEntry): Promise<void> {
    const assignments = await this.getAssignments();
    const existingIndex = assignments.findIndex(a => a.id === assignment.id);
    if (existingIndex > -1) {
      assignments[existingIndex] = assignment;
    } else {
      assignments.unshift(assignment);
    }
    await AsyncStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
  }
}

export const TestStore = new TestStoreService();
