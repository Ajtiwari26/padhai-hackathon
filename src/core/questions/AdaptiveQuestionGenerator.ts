/**
 * Adaptive Question Generator
 * 
 * Generates unique questions like a real teacher:
 * - Adapts to current concept being learned
 * - Adjusts difficulty based on student performance
 * - Controls math complexity and thinking depth
 * - Creates Irodov-level problems when needed
 */

import { ModelManager } from '../api/ModelManager';

export interface QuestionRequest {
  // Context
  topic: string;              // "Gravitation"
  subtopic: string;           // "Escape Velocity"
  concepts: string[];         // ["Energy Conservation", "Newton's Law"]
  
  // Difficulty Control
  difficulty: number;         // 0-100 (0=Fundamental, 50=Standard Application, 80=Complex Multi-step, 100=Olympiad/Expert level)
  mathComplexity: 'basic' | 'algebra' | 'calculus' | 'advanced_calculus';
  thinkingDepth: 'recall' | 'application' | 'analysis' | 'synthesis';
  
  // Student Context
  studentUnderstanding: number;  // 0-100
  previousAttempts: {
    correct: number;
    wrong: number;
    avgTime: number;
  };
  
  // Question Type
  type: 'mcq' | 'numerical' | 'integer' | 'subjective' | 'proof';
  style: 'direct' | 'conceptual' | 'multi_step' | 'tricky' | 'expert_level';
}

export interface GeneratedQuestion {
  id: string;
  problem: string;
  solution: string;
  hints: string[];           // Socratic hints, not direct answers
  concepts: string[];        // Concepts tested
  difficulty: number;        // Actual difficulty
  mathComplexity: string;
  expectedTime: number;      // In minutes
  commonMistakes: string[];  // What students usually get wrong
  learningPoints: string[];  // What this question teaches
  
  // For MCQs
  options?: string[];
  correctOption?: number;
}

export interface QuestionAttempt {
  questionId: string;
  correct: boolean;
  timeSpent: number;
  difficulty: number;
  expectedTime: number;
  timestamp: number;
}

class AdaptiveQuestionGeneratorService {
  private questionCache: Map<string, GeneratedQuestion> = new Map();
  private maxRetries = 3;

  /**
   * Generate a unique question based on request
   */
  async generate(request: QuestionRequest, priority: 'foreground' | 'background' = 'foreground'): Promise<GeneratedQuestion> {
    console.log('[QuestionGen] Generating question:', {
      topic: request.topic,
      difficulty: request.difficulty,
      type: request.type,
    });

    const generationPromise = (async () => {
      let attempts = 0;
      while (attempts < this.maxRetries) {
        try {
          const prompt = this.buildPrompt(request);
          const response = await ModelManager.generate(prompt, priority);
          
          // Parse JSON response
          const question = this.parseQuestion(response, request);
          
          // Validate quality
          if (this.validateQuality(question, request)) {
            console.log('[QuestionGen] Question generated successfully');
            return question;
          }
          
          console.log('[QuestionGen] Quality check failed, retrying...');
          attempts++;
        } catch (e) {
          console.error('[QuestionGen] Generation error:', e);
          attempts++;
        }
      }
      return this.getFallbackQuestion(request);
    })();

    const timeoutPromise = new Promise<GeneratedQuestion>((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 15000)
    );

    try {
      return await Promise.race([generationPromise, timeoutPromise]);
    } catch (e) {
      if (e instanceof Error && e.message === 'TIMEOUT') {
        console.warn('[QuestionGen] Generation timed out, returning fallback');
        return this.getFallbackQuestion(request);
      }
      throw e;
    }
  }

  /**
   * Build intelligent prompt for question generation
   */
  private buildPrompt(request: QuestionRequest): string {
    return `You are an expert teacher creating a unique problem for a student.

CONTEXT:
- Topic: ${request.topic}
- Subtopic: ${request.subtopic}
- Concepts to test: ${request.concepts.join(', ')}

DIFFICULTY REQUIREMENTS:
- Overall difficulty: ${request.difficulty}/100
  ${this.getDifficultyGuidance(request.difficulty)}
- Math complexity: ${request.mathComplexity}
  ${this.getMathGuidance(request.mathComplexity)}
- Thinking depth: ${request.thinkingDepth}
  ${this.getThinkingGuidance(request.thinkingDepth)}

STUDENT CONTEXT:
- Understanding level: ${request.studentUnderstanding}/100
- Previous performance: ${request.previousAttempts.correct} correct, ${request.previousAttempts.wrong} wrong
${this.getAdaptiveGuidance(request)}

QUESTION TYPE: ${request.type}
STYLE: ${request.style}

CREATE A UNIQUE PROBLEM that:
1. Tests the specified concepts deeply
2. Matches the difficulty level exactly
3. Requires the specified math complexity
4. Demands the specified thinking depth
5. Is similar in style to ${this.getStyleReference(request.style)}
6. Has NO ambiguity
7. Has a clear, step-by-step solution
${request.type === 'mcq' ? '8. Has 4 options with only one correct answer' : ''}

IMPORTANT: Make the problem UNIQUE and CREATIVE. Do not copy standard textbook problems.

FORMAT YOUR RESPONSE AS JSON:
{
  "problem": "Clear problem statement with all necessary information",
  "solution": "Detailed step-by-step solution with explanations",
  "hints": ["Socratic hint 1 (guide thinking, don't give answer)", "Socratic hint 2", "Socratic hint 3"],
  "concepts": ["concept1", "concept2"],
  "difficulty": ${request.difficulty},
  "mathComplexity": "${request.mathComplexity}",
  "expectedTime": 5,
  "commonMistakes": ["Common mistake students make", "Another common mistake"],
  "learningPoints": ["Key learning point 1", "Key learning point 2"]${request.type === 'mcq' ? ',\n  "options": ["Option A", "Option B", "Option C", "Option D"],\n  "correctOption": 0' : ''}
}

RESPOND ONLY WITH THE JSON, NO OTHER TEXT.`;
  }

  private getDifficultyGuidance(difficulty: number): string {
    if (difficulty < 30) {
      return "Fundamental level - Direct formula application, simple numbers, single-step solution";
    } else if (difficulty < 50) {
      return "Intermediate level - Requires understanding, 2-3 steps, moderate calculations";
    } else if (difficulty < 70) {
      return "Advanced level - Conceptual understanding + problem solving, 3-4 steps";
    } else if (difficulty < 85) {
      return "Expert level - Deep conceptual understanding, multi-step, requires insight, calculus often needed";
    } else {
      return "Mastery/Olympiad level - Requires creative thinking, non-obvious approach, advanced techniques";
    }
  }

  private getMathGuidance(complexity: string): string {
    switch (complexity) {
      case 'basic':
        return "Use simple arithmetic and basic algebra only. No calculus.";
      case 'algebra':
        return "Use algebraic manipulation, quadratic equations, simultaneous equations. No calculus.";
      case 'calculus':
        return "Require differentiation or integration (single variable). May need chain rule, product rule.";
      case 'advanced_calculus':
        return "Require partial derivatives, multiple integrals, differential equations, or advanced techniques.";
      default:
        return "";
    }
  }

  private getThinkingGuidance(depth: string): string {
    switch (depth) {
      case 'recall':
        return "Test memory and direct formula application. Student should recognize the formula immediately.";
      case 'application':
        return "Test ability to apply concepts to new situations. Student needs to identify which concept applies.";
      case 'analysis':
        return "Require breaking down complex situations, identifying key principles, analyzing relationships.";
      case 'synthesis':
        return "Require combining multiple concepts, creative problem-solving, deriving new relationships.";
      default:
        return "";
    }
  }

  private getStyleReference(style: string): string {
    switch (style) {
      case 'direct':
        return "standard textbook problems - straightforward, clear setup";
      case 'conceptual':
        return "problems that test understanding over calculation - may have minimal math";
      case 'multi_step':
        return "problems requiring 4-5 distinct steps - each step builds on previous";
      case 'tricky':
        return "problems with a conceptual twist or non-obvious approach - requires insight";
      case 'expert_level':
        return "expert problems - requires deep insight, calculus, multi-concept integration, elegant solution";
      default:
        return "standard problems";
    }
  }

  private getAdaptiveGuidance(request: QuestionRequest): string {
    const { studentUnderstanding, previousAttempts } = request;
    
    if (previousAttempts.correct > previousAttempts.wrong * 2) {
      return "- Student is performing well - increase difficulty slightly, add conceptual twist";
    } else if (previousAttempts.wrong > previousAttempts.correct) {
      return "- Student is struggling - focus on concept clarity, reduce math complexity, provide more guidance";
    } else if (studentUnderstanding < 50) {
      return "- Student has weak understanding - create problem that teaches while testing, include learning hints";
    } else {
      return "- Student has good understanding - challenge them appropriately with standard difficulty";
    }
  }

  /**
   * Parse JSON response from AI
   */
  private parseQuestion(response: string, request: QuestionRequest): GeneratedQuestion {
    try {
      // Extract JSON from response (AI might add extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        problem: parsed.problem || '',
        solution: parsed.solution || '',
        hints: parsed.hints || [],
        concepts: parsed.concepts || request.concepts,
        difficulty: parsed.difficulty || request.difficulty,
        mathComplexity: parsed.mathComplexity || request.mathComplexity,
        expectedTime: parsed.expectedTime || 5,
        commonMistakes: parsed.commonMistakes || [],
        learningPoints: parsed.learningPoints || [],
        options: parsed.options,
        correctOption: parsed.correctOption,
      };
    } catch (e) {
      console.error('[QuestionGen] Parse error:', e);
      throw new Error('Failed to parse question JSON');
    }
  }

  /**
   * Validate question quality
   */
  private validateQuality(question: GeneratedQuestion, request: QuestionRequest): boolean {
    // Check if problem is not empty and has reasonable length
    if (!question.problem || question.problem.length < 50) {
      console.log('[Validator] Problem too short');
      return false;
    }

    // Check if solution exists and is detailed
    if (!question.solution || question.solution.length < 100) {
      console.log('[Validator] Solution too short');
      return false;
    }

    // Check if hints exist and are Socratic (not direct answers)
    if (!question.hints || question.hints.length < 2) {
      console.log('[Validator] Not enough hints');
      return false;
    }

    // Check hints don't give away answer
    const hintsText = question.hints.join(' ').toLowerCase();
    if (hintsText.includes('answer is') || hintsText.includes('solution is')) {
      console.log('[Validator] Hints are too direct');
      return false;
    }

    // Check if difficulty matches request (±15)
    if (Math.abs(question.difficulty - request.difficulty) > 15) {
      console.log('[Validator] Difficulty mismatch');
      return false;
    }

    // For MCQs, check options
    if (request.type === 'mcq') {
      if (!question.options || question.options.length !== 4) {
        console.log('[Validator] MCQ must have 4 options');
        return false;
      }
      if (question.correctOption === undefined || question.correctOption < 0 || question.correctOption > 3) {
        console.log('[Validator] Invalid correct option');
        return false;
      }
    }

    return true;
  }

  /**
   * Fallback question if generation fails
   */
  private getFallbackQuestion(request: QuestionRequest): GeneratedQuestion {
    const safeSubtopic = request.subtopic || "General";
    const safeConcepts = request.concepts && Array.isArray(request.concepts) ? request.concepts.join(' and ') : "the relevant topics";
    
    return {
      id: `fallback_${Date.now()}`,
      problem: `Solve a problem on ${safeSubtopic} using ${safeConcepts}.`,
      solution: 'Solution will be provided after you attempt the problem.',
      hints: [
        'Think about the key concepts involved',
        'Break down the problem into steps',
        'Apply the relevant formulas',
      ],
      concepts: request.concepts || [],
      difficulty: request.difficulty || 50,
      mathComplexity: request.mathComplexity || 'basic',
      expectedTime: 5,
      commonMistakes: ['Not reading the problem carefully'],
      learningPoints: ['Understanding the concept'],
    };
  }
}

export const AdaptiveQuestionGenerator = new AdaptiveQuestionGeneratorService();
