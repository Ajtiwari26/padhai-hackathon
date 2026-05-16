/**
 * Learning Context Tracker
 * 
 * Tracks what student is currently learning and determines
 * what type of question they need next
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuestionAttempt, QuestionRequest } from '../questions/AdaptiveQuestionGenerator';
import { DifficultyProgression } from '../questions/DifficultyProgression';

export interface LearningContext {
  // Current learning state
  topic: string;
  subtopic: string;
  conceptsCovered: string[];
  currentPhase: 'introduction' | 'understanding' | 'application' | 'mastery';
  
  // Progress metrics
  timeSpent: number; // minutes
  questionsAttempted: number;
  understanding: number; // 0-100
  
  // Performance tracking
  weakPoints: string[];
  strongPoints: string[];
  
  // Question history
  questionHistory: QuestionAttempt[];
  
  // Timestamps
  startedAt: number;
  lastUpdated: number;
}

const STORAGE_KEY = '@padhai_learning_context';

class LearningContextTrackerService {
  private context: LearningContext | null = null;

  /**
   * Initialize learning context for a new topic
   */
  async startTopic(topic: string, subtopic: string, initialUnderstanding: number = 50): Promise<void> {
    this.context = {
      topic,
      subtopic,
      conceptsCovered: [],
      currentPhase: 'introduction',
      timeSpent: 0,
      questionsAttempted: 0,
      understanding: initialUnderstanding,
      weakPoints: [],
      strongPoints: [],
      questionHistory: [],
      startedAt: Date.now(),
      lastUpdated: Date.now(),
    };

    await this.saveContext();
    console.log('[LearningContext] Started topic:', topic, subtopic);
  }

  /**
   * Get current learning context
   */
  async getCurrentContext(): Promise<LearningContext | null> {
    if (!this.context) {
      await this.loadContext();
    }
    return this.context;
  }

  /**
   * Add a concept to covered list
   */
  async addConcept(concept: string): Promise<void> {
    if (!this.context) return;

    if (!this.context.conceptsCovered.includes(concept)) {
      this.context.conceptsCovered.push(concept);
      this.context.lastUpdated = Date.now();
      await this.saveContext();
      console.log('[LearningContext] Added concept:', concept);
    }
  }

  /**
   * Update learning phase
   */
  async updatePhase(phase: LearningContext['currentPhase']): Promise<void> {
    if (!this.context) return;

    this.context.currentPhase = phase;
    this.context.lastUpdated = Date.now();
    await this.saveContext();
    console.log('[LearningContext] Updated phase:', phase);
  }

  /**
   * Record a question attempt
   */
  async recordAttempt(attempt: QuestionAttempt): Promise<void> {
    if (!this.context) return;

    this.context.questionHistory.push(attempt);
    this.context.questionsAttempted++;
    this.context.lastUpdated = Date.now();

    // Update understanding based on performance
    await this.updateUnderstanding(attempt.correct);

    // Update phase based on progress
    await this.autoUpdatePhase();

    await this.saveContext();
    console.log('[LearningContext] Recorded attempt:', {
      correct: attempt.correct,
      understanding: this.context.understanding,
    });
  }

  /**
   * Update understanding score based on performance
   */
  async updateUnderstanding(correct: boolean): Promise<void> {
    if (!this.context) return;

    const recent = this.context.questionHistory.slice(-5);
    const recentCorrect = recent.filter(a => a.correct).length;
    const recentAccuracy = recent.length > 0 ? recentCorrect / recent.length : 0.5;

    // Adjust understanding based on recent performance
    if (correct) {
      // Increase understanding (faster if low, slower if high)
      const increase = this.context.understanding < 50 ? 5 : 3;
      this.context.understanding = Math.min(this.context.understanding + increase, 100);
    } else {
      // Decrease understanding (more if consistently wrong)
      const decrease = recentAccuracy < 0.4 ? 8 : 4;
      this.context.understanding = Math.max(this.context.understanding - decrease, 10);
    }

    // Smooth out with recent accuracy
    this.context.understanding = Math.round(
      this.context.understanding * 0.7 + recentAccuracy * 100 * 0.3
    );

    console.log('[LearningContext] Understanding updated:', this.context.understanding);
  }

  /**
   * Automatically update learning phase based on progress
   */
  private async autoUpdatePhase(): Promise<void> {
    if (!this.context) return;

    const { understanding, questionsAttempted, currentPhase } = this.context;

    if (currentPhase === 'introduction' && questionsAttempted >= 2) {
      await this.updatePhase('understanding');
    } else if (currentPhase === 'understanding' && understanding >= 60 && questionsAttempted >= 5) {
      await this.updatePhase('application');
    } else if (currentPhase === 'application' && understanding >= 80 && questionsAttempted >= 10) {
      await this.updatePhase('mastery');
    }
  }

  /**
   * Get what type of question student needs now
   */
  async getQuestionNeeds(): Promise<QuestionRequest> {
    const context = await this.getCurrentContext();
    
    if (!context) {
      // Default request if no context
      return {
        topic: 'General',
        subtopic: 'Introduction',
        concepts: ['Basic concepts'],
        difficulty: 40,
        mathComplexity: 'algebra',
        thinkingDepth: 'application',
        studentUnderstanding: 50,
        previousAttempts: { correct: 0, wrong: 0, avgTime: 0 },
        type: 'numerical',
        style: 'direct',
      };
    }

    const metrics = DifficultyProgression.getProgressionMetrics(
      context.questionHistory,
      context.understanding
    );

    // Determine question type based on phase
    let type: QuestionRequest['type'] = 'numerical';
    if (context.currentPhase === 'introduction') {
      type = 'mcq'; // Start with MCQs for introduction
    } else if (context.currentPhase === 'understanding') {
      type = Math.random() > 0.5 ? 'mcq' : 'numerical';
    } else {
      type = 'numerical'; // Focus on numerical for application and mastery
    }

    // Calculate previous attempts stats
    const previousAttempts = {
      correct: context.questionHistory.filter(a => a.correct).length,
      wrong: context.questionHistory.filter(a => !a.correct).length,
      avgTime: context.questionHistory.length > 0
        ? context.questionHistory.reduce((sum, a) => sum + a.timeSpent, 0) / context.questionHistory.length
        : 0,
    };

    return {
      topic: context.topic,
      subtopic: context.subtopic,
      concepts: context.conceptsCovered.length > 0 
        ? context.conceptsCovered 
        : ['Basic concepts'],
      difficulty: metrics.recommendedDifficulty,
      mathComplexity: metrics.mathComplexity,
      thinkingDepth: metrics.thinkingDepth,
      studentUnderstanding: context.understanding,
      previousAttempts,
      type,
      style: DifficultyProgression.getQuestionStyle(metrics.recommendedDifficulty),
    };
  }

  /**
   * Check if student is ready for test
   */
  async isReadyForTest(): Promise<boolean> {
    const context = await this.getCurrentContext();
    if (!context) return false;

    return DifficultyProgression.isReadyForTest(context.questionHistory, 5);
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary() {
    const context = await this.getCurrentContext();
    if (!context) return null;

    return DifficultyProgression.getPerformanceSummary(context.questionHistory);
  }

  /**
   * Get weak areas
   */
  async getWeakAreas(): Promise<string[]> {
    const context = await this.getCurrentContext();
    if (!context) return [];

    return DifficultyProgression.getWeakAreas(context.questionHistory);
  }

  /**
   * Save context to storage
   */
  private async saveContext(): Promise<void> {
    if (!this.context) return;

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.context));
    } catch (e) {
      console.error('[LearningContext] Failed to save:', e);
    }
  }

  /**
   * Load context from storage
   */
  private async loadContext(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.context = JSON.parse(raw);
        console.log('[LearningContext] Loaded context:', this.context?.topic);
      }
    } catch (e) {
      console.error('[LearningContext] Failed to load:', e);
    }
  }

  /**
   * Clear context (when topic is completed)
   */
  async clearContext(): Promise<void> {
    this.context = null;
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('[LearningContext] Context cleared');
    } catch (e) {
      console.error('[LearningContext] Failed to clear:', e);
    }
  }

  /**
   * Add time spent (call periodically)
   */
  async addTimeSpent(minutes: number): Promise<void> {
    if (!this.context) return;

    this.context.timeSpent += minutes;
    this.context.lastUpdated = Date.now();
    await this.saveContext();
  }
}

export const LearningContextTracker = new LearningContextTrackerService();
