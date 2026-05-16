/**
 * Module Manager
 * 
 * Manages dynamic switching between 7 learning modules:
 * 1. Concept Class (Main Teaching)
 * 2. Practical Lab (Visualization)
 * 3. Numerical Zone (Problem Solving)
 * 4. Doubt Session (Q&A)
 * 5. Quick Test (Formative Assessment)
 * 6. Mock Test (Summative Assessment)
 * 7. Key Points (Quick Revision)
 */

export type ModuleType = 
  | 'concept_class'
  | 'practical_lab'
  | 'numerical_zone'
  | 'doubt_session'
  | 'quick_test'
  | 'mock_test'
  | 'key_points';

export interface ModuleContext {
  type: ModuleType;
  topic: string;
  subtopic: string;
  enteredAt: number;
  reason: string; // Why this module was entered
  previousModule?: ModuleType;
}

export interface ModuleSwitchDecision {
  shouldSwitch: boolean;
  targetModule: ModuleType;
  reason: string;
  confidence: number; // 0-1
}

class ModuleManagerService {
  private currentModule: ModuleContext | null = null;
  private moduleHistory: ModuleContext[] = [];
  private listeners: ((module: ModuleContext | null) => void)[] = [];

  subscribe(listener: (module: ModuleContext | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.currentModule));
  }

  /**
   * Initialize with a module
   */
  enterModule(
    type: ModuleType,
    topic: string,
    subtopic: string,
    reason: string = 'User initiated'
  ): void {
    const previousModule = this.currentModule?.type;

    if (this.currentModule) {
      this.moduleHistory.push(this.currentModule);
    }

    this.currentModule = {
      type,
      topic,
      subtopic,
      enteredAt: Date.now(),
      reason,
      previousModule,
    };

    console.log('[ModuleManager] Entered module:', type, 'Reason:', reason);
    this.notifyListeners();
  }

  /**
   * Get current module
   */
  getCurrentModule(): ModuleContext | null {
    return this.currentModule;
  }

  /**
   * Return to previous module
   */
  returnToPrevious(): ModuleContext | null {
    if (this.moduleHistory.length === 0) {
      console.log('[ModuleManager] No previous module to return to');
      return null;
    }

    this.currentModule = this.moduleHistory.pop() || null;
    console.log('[ModuleManager] Returned to:', this.currentModule?.type);
    this.notifyListeners();
    return this.currentModule;
  }

  /**
   * AI decides if module switch is needed based on student message
   */
  aiDecideSwitch(
    studentMessage: string,
    context: {
      understanding: number;
      questionsAttempted: number;
      recentAccuracy: number;
    }
  ): ModuleSwitchDecision {
    const lower = studentMessage.toLowerCase();

    // Check for explicit visualization requests
    if (this.needsVisualization(lower)) {
      return {
        shouldSwitch: true,
        targetModule: 'practical_lab',
        reason: 'Student needs visualization',
        confidence: 0.9,
      };
    }

    // Check for practice requests
    if (this.needsPractice(lower)) {
      return {
        shouldSwitch: true,
        targetModule: 'numerical_zone',
        reason: 'Student wants practice',
        confidence: 0.9,
      };
    }

    // Check for doubt/question
    if (this.hasDoubt(lower)) {
      return {
        shouldSwitch: true,
        targetModule: 'doubt_session',
        reason: 'Student has a specific doubt',
        confidence: 0.8,
      };
    }

    // Check for test readiness
    if (this.wantsTest(lower)) {
      return {
        shouldSwitch: true,
        targetModule: 'quick_test',
        reason: 'Student wants to test understanding',
        confidence: 0.85,
      };
    }

    // Check for formula/revision request
    if (this.needsRevision(lower)) {
      return {
        shouldSwitch: true,
        targetModule: 'key_points',
        reason: 'Student needs quick revision',
        confidence: 0.8,
      };
    }

    // AI-initiated switches based on context
    if (this.currentModule?.type === 'concept_class') {
      // If understanding is good and enough questions attempted, suggest practice
      if (context.understanding >= 70 && context.questionsAttempted < 3) {
        return {
          shouldSwitch: true,
          targetModule: 'numerical_zone',
          reason: 'Concept clear, time for practice',
          confidence: 0.7,
        };
      }

      // If struggling, might need visualization
      if (context.understanding < 40 && context.recentAccuracy < 0.3) {
        return {
          shouldSwitch: true,
          targetModule: 'practical_lab',
          reason: 'Student struggling, needs visual explanation',
          confidence: 0.6,
        };
      }

      // If doing well consistently, suggest test
      if (context.understanding >= 80 && context.recentAccuracy >= 0.8 && context.questionsAttempted >= 5) {
        return {
          shouldSwitch: true,
          targetModule: 'quick_test',
          reason: 'Ready for assessment',
          confidence: 0.75,
        };
      }
    }

    // No switch needed
    return {
      shouldSwitch: false,
      targetModule: this.currentModule?.type || 'concept_class',
      reason: 'Continue in current module',
      confidence: 0.5,
    };
  }

  /**
   * User manually invokes a module
   */
  userInvokeModule(command: string): ModuleType | null {
    const lower = command.toLowerCase().trim();

    const commandMap: { [key: string]: ModuleType } = {
      '/concept': 'concept_class',
      '/class': 'concept_class',
      '/teach': 'concept_class',
      
      '/practical': 'practical_lab',
      '/visual': 'practical_lab',
      '/diagram': 'practical_lab',
      '/show': 'practical_lab',
      
      '/numerical': 'numerical_zone',
      '/practice': 'numerical_zone',
      '/problem': 'numerical_zone',
      '/solve': 'numerical_zone',
      
      '/doubt': 'doubt_session',
      '/question': 'doubt_session',
      '/ask': 'doubt_session',
      
      '/test': 'quick_test',
      '/quiz': 'quick_test',
      '/check': 'quick_test',
      
      '/mock': 'mock_test',
      '/exam': 'mock_test',
      
      '/formulas': 'key_points',
      '/revision': 'key_points',
      '/summary': 'key_points',
      '/keypoints': 'key_points',
    };

    for (const [cmd, module] of Object.entries(commandMap)) {
      if (lower.startsWith(cmd)) {
        console.log('[ModuleManager] User invoked:', module);
        return module;
      }
    }

    return null;
  }

  /**
   * Get module display name
   */
  getModuleName(type: ModuleType): string {
    const names: { [key in ModuleType]: string } = {
      concept_class: '📚 Concept Class',
      practical_lab: '🔬 Practical Lab',
      numerical_zone: '🧮 Numerical Zone',
      doubt_session: '❓ Doubt Session',
      quick_test: '📝 Quick Test',
      mock_test: '⏱️ Mock Test',
      key_points: '📌 Key Points',
    };
    return names[type];
  }

  /**
   * Get module description
   */
  getModuleDescription(type: ModuleType): string {
    const descriptions: { [key in ModuleType]: string } = {
      concept_class: 'Learn concepts through Socratic dialogue',
      practical_lab: 'Visualize concepts with diagrams and examples',
      numerical_zone: 'Practice with adaptive problems',
      doubt_session: 'Ask questions and clear doubts',
      quick_test: 'Test your understanding (no timer)',
      mock_test: 'Full exam simulation with timer',
      key_points: 'Quick revision and formulas',
    };
    return descriptions[type];
  }

  // Helper methods for detection

  private needsVisualization(message: string): boolean {
    const keywords = [
      'visualize', 'see', 'show', 'diagram', 'picture', 'draw',
      'can\'t imagine', 'can\'t picture', 'don\'t understand how',
      'what does it look like', 'how does it look',
    ];
    return keywords.some(kw => message.includes(kw));
  }

  private needsPractice(message: string): boolean {
    const keywords = [
      'practice', 'problem', 'question', 'solve', 'example',
      'give me', 'try', 'attempt', 'exercise',
    ];
    return keywords.some(kw => message.includes(kw));
  }

  private hasDoubt(message: string): boolean {
    const keywords = [
      'why', 'how', 'what if', 'confused', 'don\'t understand',
      'explain', 'clarify', 'doubt', 'not clear',
    ];
    return keywords.some(kw => message.includes(kw));
  }

  private wantsTest(message: string): boolean {
    const keywords = [
      'test', 'quiz', 'check', 'assess', 'evaluate',
      'ready', 'exam', 'mock',
    ];
    return keywords.some(kw => message.includes(kw));
  }

  private needsRevision(message: string): boolean {
    const keywords = [
      'formula', 'formulas', 'revision', 'revise', 'summary',
      'key points', 'important', 'remember', 'quick',
    ];
    return keywords.some(kw => message.includes(kw));
  }

  /**
   * Clear module history
   */
  clearHistory(): void {
    this.moduleHistory = [];
    console.log('[ModuleManager] History cleared');
  }

  /**
   * Get module history
   */
  getHistory(): ModuleContext[] {
    return [...this.moduleHistory];
  }
}

export const ModuleManager = new ModuleManagerService();
