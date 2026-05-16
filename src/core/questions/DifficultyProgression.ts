/**
 * Difficulty Progression System
 * 
 * Intelligently adjusts question difficulty based on:
 * - Student performance (accuracy)
 * - Time taken per question
 * - Understanding level
 * - Learning phase
 */

import { QuestionAttempt } from './AdaptiveQuestionGenerator';

export interface ProgressionMetrics {
  currentDifficulty: number;
  recommendedDifficulty: number;
  mathComplexity: 'basic' | 'algebra' | 'calculus' | 'advanced_calculus';
  thinkingDepth: 'recall' | 'application' | 'analysis' | 'synthesis';
  reasoning: string;
}

class DifficultyProgressionService {
  /**
   * Determines next question difficulty based on performance history
   */
  getNextDifficulty(history: QuestionAttempt[], currentUnderstanding: number): number {
    if (history.length === 0) {
      // First question - start based on understanding level
      if (currentUnderstanding < 30) return 25; // Beginner
      if (currentUnderstanding < 50) return 40; // Intermediate
      if (currentUnderstanding < 70) return 55; // Advanced
      return 70; // Expert
    }

    const recent = history.slice(-5); // Last 5 attempts
    const correctRate = recent.filter(a => a.correct).length / recent.length;
    const avgTime = recent.reduce((sum, a) => sum + a.timeSpent, 0) / recent.length;
    const avgExpectedTime = recent.reduce((sum, a) => sum + a.expectedTime, 0) / recent.length;
    const currentDifficulty = recent[recent.length - 1].difficulty;

    console.log('[Progression] Metrics:', {
      correctRate,
      avgTime,
      avgExpectedTime,
      currentDifficulty,
    });

    // Adaptive logic
    if (correctRate >= 0.8 && avgTime < avgExpectedTime * 1.2) {
      // Student is doing very well - significant increase
      const increase = correctRate === 1.0 ? 15 : 10;
      return Math.min(currentDifficulty + increase, 95);
    } else if (correctRate >= 0.6 && avgTime < avgExpectedTime * 1.5) {
      // Student is doing well - moderate increase
      return Math.min(currentDifficulty + 5, 90);
    } else if (correctRate >= 0.4) {
      // Student is managing - maintain or slight increase
      return Math.min(currentDifficulty + 2, 85);
    } else if (correctRate >= 0.2) {
      // Student is struggling - decrease difficulty
      return Math.max(currentDifficulty - 10, 25);
    } else {
      // Student is really struggling - significant decrease
      return Math.max(currentDifficulty - 20, 20);
    }
  }

  /**
   * Get progression metrics with reasoning
   */
  getProgressionMetrics(history: QuestionAttempt[], currentUnderstanding: number): ProgressionMetrics {
    const currentDifficulty = history.length > 0 ? history[history.length - 1].difficulty : 40;
    const recommendedDifficulty = this.getNextDifficulty(history, currentUnderstanding);
    
    let reasoning = '';
    if (history.length === 0) {
      reasoning = 'Starting with appropriate difficulty based on understanding level';
    } else {
      const recent = history.slice(-5);
      const correctRate = recent.filter(a => a.correct).length / recent.length;
      
      if (recommendedDifficulty > currentDifficulty) {
        reasoning = `Increasing difficulty (${correctRate * 100}% accuracy) - you're doing great!`;
      } else if (recommendedDifficulty < currentDifficulty) {
        reasoning = `Reducing difficulty (${correctRate * 100}% accuracy) - let's build confidence`;
      } else {
        reasoning = `Maintaining difficulty (${correctRate * 100}% accuracy) - good progress`;
      }
    }

    return {
      currentDifficulty,
      recommendedDifficulty,
      mathComplexity: this.getMathComplexity(recommendedDifficulty, currentUnderstanding),
      thinkingDepth: this.getThinkingDepth(currentUnderstanding),
      reasoning,
    };
  }

  /**
   * Determines math complexity based on difficulty and understanding
   */
  getMathComplexity(
    difficulty: number,
    understanding: number
  ): 'basic' | 'algebra' | 'calculus' | 'advanced_calculus' {
    // If understanding is low, keep math simple regardless of difficulty
    if (understanding < 40) return 'basic';
    if (understanding < 60) return 'algebra';

    // For higher understanding, scale with difficulty
    if (difficulty < 40) return 'basic';
    if (difficulty < 60) return 'algebra';
    if (difficulty < 80) return 'calculus';
    return 'advanced_calculus';
  }

  /**
   * Determines thinking depth based on understanding and difficulty
   */
  getThinkingDepth(understanding: number): 'recall' | 'application' | 'analysis' | 'synthesis' {
    if (understanding < 30) return 'recall';
    if (understanding < 50) return 'application';
    if (understanding < 75) return 'analysis';
    return 'synthesis';
  }

  /**
   * Determines question style based on difficulty
   */
  getQuestionStyle(difficulty: number): 'direct' | 'conceptual' | 'multi_step' | 'tricky' | 'expert_level' {
    if (difficulty < 40) return 'direct';
    if (difficulty < 60) return 'conceptual';
    if (difficulty < 75) return 'multi_step';
    if (difficulty < 85) return 'tricky';
    return 'expert_level';
  }

  /**
   * Check if student is ready for test
   */
  isReadyForTest(history: QuestionAttempt[], minQuestions: number = 5): boolean {
    if (history.length < minQuestions) return false;

    const recent = history.slice(-minQuestions);
    const correctRate = recent.filter(a => a.correct).length / recent.length;

    // Ready if 70%+ accuracy on recent questions
    return correctRate >= 0.7;
  }

  /**
   * Get weak areas based on attempt history
   */
  getWeakAreas(history: QuestionAttempt[]): string[] {
    // This would analyze which concepts student struggles with
    // For now, return based on difficulty levels where student fails
    
    const failedAttempts = history.filter(a => !a.correct);
    if (failedAttempts.length === 0) return [];

    const avgFailedDifficulty = failedAttempts.reduce((sum, a) => sum + a.difficulty, 0) / failedAttempts.length;

    const weakAreas: string[] = [];
    
    if (avgFailedDifficulty < 40) {
      weakAreas.push('Basic concept understanding');
    } else if (avgFailedDifficulty < 60) {
      weakAreas.push('Concept application');
    } else if (avgFailedDifficulty < 80) {
      weakAreas.push('Multi-step problem solving');
    } else {
      weakAreas.push('Advanced problem solving');
    }

    return weakAreas;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(history: QuestionAttempt[]): {
    totalAttempts: number;
    correctCount: number;
    accuracy: number;
    avgDifficulty: number;
    avgTime: number;
    trend: 'improving' | 'stable' | 'declining';
  } {
    if (history.length === 0) {
      return {
        totalAttempts: 0,
        correctCount: 0,
        accuracy: 0,
        avgDifficulty: 0,
        avgTime: 0,
        trend: 'stable',
      };
    }

    const correctCount = history.filter(a => a.correct).length;
    const accuracy = correctCount / history.length;
    const avgDifficulty = history.reduce((sum, a) => sum + a.difficulty, 0) / history.length;
    const avgTime = history.reduce((sum, a) => sum + a.timeSpent, 0) / history.length;

    // Determine trend by comparing first half vs second half
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (history.length >= 6) {
      const mid = Math.floor(history.length / 2);
      const firstHalf = history.slice(0, mid);
      const secondHalf = history.slice(mid);

      const firstAccuracy = firstHalf.filter(a => a.correct).length / firstHalf.length;
      const secondAccuracy = secondHalf.filter(a => a.correct).length / secondHalf.length;

      if (secondAccuracy > firstAccuracy + 0.1) {
        trend = 'improving';
      } else if (secondAccuracy < firstAccuracy - 0.1) {
        trend = 'declining';
      }
    }

    return {
      totalAttempts: history.length,
      correctCount,
      accuracy,
      avgDifficulty,
      avgTime,
      trend,
    };
  }
}

export const DifficultyProgression = new DifficultyProgressionService();
