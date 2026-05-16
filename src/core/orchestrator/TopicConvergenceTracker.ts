import { ModelManager } from '../api/ModelManager';

export interface TopicProgress {
  topic: string;
  subtopic: string;
  subConcepts: string[];
  coverage: Record<string, number>; // 0 to 100 for each concept
  overallConvergence: number;
  nextSuggestedAction: 'explain' | 'diagram' | 'mcq' | 'numerical' | 'advance';
  studentUnderstandingLevel: number; // 0 to 100 overall assessment
}

class TopicConvergenceTrackerService {
  private currentProgress: TopicProgress | null = null;

  /**
   * Initializes tracking for a new topic session
   */
  public initTracking(topic: string, subtopic: string, concepts: string[]) {
    // If no concepts provided, make some defaults
    const activeConcepts = concepts.length > 0 ? concepts : [
      'Basic Definition',
      'Core Mechanism',
      'Practical Application'
    ];

    const coverage: Record<string, number> = {};
    activeConcepts.forEach(c => coverage[c] = 0);

    this.currentProgress = {
      topic,
      subtopic,
      subConcepts: activeConcepts,
      coverage,
      overallConvergence: 0,
      nextSuggestedAction: 'explain',
      studentUnderstandingLevel: 0
    };
    
    console.log(`[ConvergenceTracker] Initialized for ${subtopic} with ${activeConcepts.length} concepts`);
  }

  /**
   * Fast, lightweight evaluation of the turn to update progress.
   * Runs in background, doesn't block UI.
   */
  public async evaluateTurn(userMsg: string, aiResponse: string, activeSkill: string) {
    if (!this.currentProgress) return;

    // Simple heuristic-based update for immediate feedback without LLM overhead
    // In a full cloud setup, this would use a dedicated lightweight eval model.
    // For local edge inference, we use semantic rules to avoid interrupting the main chat model.
    
    let understandingBoost = 0;
    const lowerUser = userMsg.toLowerCase();
    
    // Positive indicators
    if (lowerUser.includes('got it') || lowerUser.includes('understood') || 
        lowerUser.includes('makes sense') || lowerUser.includes('yes') || lowerUser.includes('clear')) {
      understandingBoost += 15;
    }
    
    // Detailed answer indicator (student is trying to explain back)
    if (userMsg.length > 50 && !lowerUser.includes('what') && !lowerUser.includes('how') && !lowerUser.includes('why')) {
      understandingBoost += 10;
    }

    // Negative indicators
    if (lowerUser.includes('confused') || lowerUser.includes('not clear') || 
        lowerUser.includes('explain again') || lowerUser.includes('hard to understand')) {
      understandingBoost -= 10;
    }

    this.currentProgress.studentUnderstandingLevel = Math.max(0, Math.min(100, 
      this.currentProgress.studentUnderstandingLevel + understandingBoost
    ));

    // Update concept coverage based on AI response content
    const lowerResponse = aiResponse.toLowerCase();
    let coveredCount = 0;
    
    this.currentProgress.subConcepts.forEach(concept => {
      // Very basic keyword matching for coverage
      const keywords = concept.toLowerCase().split(' ').filter(w => w.length > 3);
      const hit = keywords.some(k => lowerResponse.includes(k));
      
      if (hit) {
        this.currentProgress!.coverage[concept] = Math.min(100, this.currentProgress!.coverage[concept] + 35);
      }
      
      if (this.currentProgress!.coverage[concept] > 80) coveredCount++;
    });

    // Calculate overall convergence
    const totalConcepts = this.currentProgress.subConcepts.length;
    let totalScore = 0;
    Object.values(this.currentProgress.coverage).forEach(score => totalScore += score);
    
    // Convergence is a mix of concept coverage (70%) and student understanding (30%)
    const coveragePercent = totalConcepts > 0 ? (totalScore / (totalConcepts * 100)) * 100 : 0;
    this.currentProgress.overallConvergence = Math.round((coveragePercent * 0.7) + (this.currentProgress.studentUnderstandingLevel * 0.3));

    // Decide next action
    if (this.currentProgress.overallConvergence > 85) {
      this.currentProgress.nextSuggestedAction = 'advance';
    } else if (activeSkill === 'ConceptTeacher' && understandingBoost <= 0) {
      this.currentProgress.nextSuggestedAction = 'diagram'; // They didn't get the text, try visual
    } else if (this.currentProgress.overallConvergence > 50 && activeSkill !== 'QuickMCQ') {
      this.currentProgress.nextSuggestedAction = 'mcq'; // Test mid-way
    } else if (activeSkill === 'VisualExplainer') {
      this.currentProgress.nextSuggestedAction = 'explain'; // Follow up visual with text
    } else {
      this.currentProgress.nextSuggestedAction = 'explain';
    }
    
    console.log(`[ConvergenceTracker] Progress updated: ${this.currentProgress.overallConvergence}% (Action: ${this.currentProgress.nextSuggestedAction})`);
  }

  public getProgress(): TopicProgress | null {
    return this.currentProgress;
  }
  
  public getProgressString(): string {
    if (!this.currentProgress) return 'Initializing topic...';
    
    return `${this.currentProgress.subtopic} — ${this.currentProgress.overallConvergence}% • Needs: ${this.formatAction(this.currentProgress.nextSuggestedAction)}`;
  }
  
  private formatAction(action: string): string {
    switch(action) {
      case 'diagram': return 'Visual Diagram';
      case 'mcq': return 'Quick Test';
      case 'numerical': return 'Problem Solving';
      case 'advance': return 'Ready for Next Topic';
      default: return 'Concept Breakdown';
    }
  }
}

export const TopicConvergenceTracker = new TopicConvergenceTrackerService();
