export interface ExamBoundary {
  name: string;
  allowedComplexity: 'basic' | 'intermediate' | 'advanced' | 'expert';
  forbiddenTopics: string[];
  maxMathLevel: string;
  focus: string;
}

const DEFAULT_BOUNDARY: ExamBoundary = {
  name: 'General Learning',
  allowedComplexity: 'advanced',
  forbiddenTopics: [
    'advanced quantum field theory',
    'string theory math'
  ],
  maxMathLevel: 'Relevant to current topic',
  focus: 'Conceptual clarity and application'
};

class SyllabusGuardrailService {
  private activeBoundary: ExamBoundary = DEFAULT_BOUNDARY;
  private activeTopic: string = '';
  private activeSubtopic: string = '';

  public setProfile(goal?: string, level?: string) {
    const lowerGoal = (goal || '').toLowerCase();
    const lowerLevel = (level || '').toLowerCase();

    // Determine complexity based on level and goal
    let complexity: ExamBoundary['allowedComplexity'] = 'intermediate';
    let mathLevel = 'Standard for academic level';
    let focus = 'Conceptual clarity and application';

    if (lowerLevel.includes('junior') || lowerLevel.includes('school')) {
      complexity = 'basic';
      mathLevel = 'Basic Algebra, Arithmetic';
    } else if (lowerLevel.includes('senior') || lowerLevel.includes('high')) {
      complexity = 'intermediate';
      mathLevel = 'Calculus, Trigonometry, Statistics';
    } else if (lowerLevel.includes('undergraduate') || lowerLevel.includes('college')) {
      complexity = 'advanced';
      mathLevel = 'Advanced Calculus, Linear Algebra';
    } else if (lowerLevel.includes('masters') || lowerLevel.includes('expert')) {
      complexity = 'expert';
      mathLevel = 'Advanced Mathematical Modeling, Research Level';
    }

    // Goal-based refinement
    if (lowerGoal.includes('competitive') || lowerGoal.includes('research') || lowerGoal.includes('olympiad')) {
      complexity = complexity === 'basic' ? 'intermediate' : (complexity === 'intermediate' ? 'advanced' : 'expert');
      focus = 'Advanced problem-solving and deep conceptual intuition';
    }

    this.activeBoundary = {
      name: goal || level || 'General Learning',
      allowedComplexity: complexity,
      forbiddenTopics: [],
      maxMathLevel: mathLevel,
      focus: focus
    };
  }

  public setActiveTopic(topic: string, subtopic?: string) {
    this.activeTopic = topic;
    this.activeSubtopic = subtopic || '';
  }

  public getGuardrailPrompt(): string {
    const topicConstraint = this.activeSubtopic 
      ? `\nCRITICAL TOPIC BOUNDARY: You are currently teaching the subtopic "${this.activeSubtopic}" within the chapter "${this.activeTopic}". YOU MUST ONLY DISCUSS THIS TOPIC. If the student asks about anything else, politely redirect them back to "${this.activeSubtopic}".` 
      : (this.activeTopic ? `\nCRITICAL TOPIC BOUNDARY: You are currently teaching "${this.activeTopic}". Do not stray into unrelated subjects.` : '');

    return `
[SYLLABUS GUARDRAIL ACTIVE: ${this.activeBoundary.name}]
You are an expert tutor for ${this.activeBoundary.name}.${topicConstraint}
You must strictly adhere to the boundaries appropriate for this level.

RULES:
1. MAX MATH LEVEL: ${this.activeBoundary.maxMathLevel}. Do not use math beyond this.
2. FOCUS: ${this.activeBoundary.focus}.
3. OUT OF BOUNDS: If the student asks about extremely advanced concepts clearly beyond ${this.activeBoundary.name}, YOU MUST PIVOT.
4. HOW TO PIVOT: Give a very brief (1-2 sentence) fascinating fact about their query to reward curiosity, but then explicitly state that it's beyond the current scope and steer the conversation back to the topic.
`;
  }
}

export const SyllabusGuardrail = new SyllabusGuardrailService();
