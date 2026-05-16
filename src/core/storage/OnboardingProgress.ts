import AsyncStorage from '@react-native-async-storage/async-storage';
import { MemoryFact } from '../memory/SemanticMemory';

export interface OnboardingMessage {
  role: 'ai' | 'user';
  content: string;
  timestamp: number;
}

export interface OnboardingProgressData {
  messages: OnboardingMessage[];
  semanticFacts: MemoryFact[]; // Compact semantic memory instead of full history
  questionCount: number;
  lastUpdated: number;
  isComplete: boolean;
}

const STORAGE_KEY = '@padhai_onboarding_progress';

export class OnboardingProgressStore {
  /**
   * Save current onboarding progress
   */
  static async saveProgress(data: OnboardingProgressData): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('[OnboardingProgress] Progress saved:', data.questionCount, 'questions');
    } catch (e) {
      console.error('[OnboardingProgress] Failed to save progress:', e);
    }
  }

  /**
   * Load saved onboarding progress
   */
  static async loadProgress(): Promise<OnboardingProgressData | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      
      const data = JSON.parse(raw) as OnboardingProgressData;
      console.log('[OnboardingProgress] Progress loaded:', data.questionCount, 'questions');
      return data;
    } catch (e) {
      console.error('[OnboardingProgress] Failed to load progress:', e);
      return null;
    }
  }

  /**
   * Clear onboarding progress (after completion)
   */
  static async clearProgress(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('[OnboardingProgress] Progress cleared');
    } catch (e) {
      console.error('[OnboardingProgress] Failed to clear progress:', e);
    }
  }

  /**
   * Check if there's saved progress
   */
  static async hasProgress(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw !== null;
    } catch (e) {
      return false;
    }
  }
}
