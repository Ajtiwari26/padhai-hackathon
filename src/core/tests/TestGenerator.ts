/**
 * Test Generator
 * 
 * Generates chapter tests with mixed question types
 */

import { ModelManager } from '../api/ModelManager';
import { DiagramDecisionEngine } from '../orchestrator/DiagramDecisionEngine';
import { DiagramAI } from '../../skills/DiagramAIIntegration';

export interface TestQuestion {
  id: string;
  type: 'mcq' | 'numerical' | 'short' | 'long';
  question: string;
  options?: string[]; // For MCQs
  correctAnswer: string;
  explanation: string;
  marks: number;
  difficulty: number;
  diagram?: any;
}

export interface Test {
  id: string;
  chapterId: string;
  title: string;
  questions: TestQuestion[];
  totalMarks: number;
  timeLimit: number; // minutes
  difficulty: number;
  createdAt: number;
}

export interface TestConfig {
  chapterId: string;
  chapterName: string;
  subtopics: string[];
  subject: string;
  questionCount: number;
  difficulty: number;
  timeLimit: number;
  questionMix?: {
    mcq: number;
    numerical: number;
    short: number;
    long: number;
  };
}

class TestGeneratorService {
  async generate(config: TestConfig): Promise<Test> {
    console.log('[TestGenerator] Generating test for:', config.chapterName);

    // Default question mix if not provided
    const mix = config.questionMix || {
      mcq: Math.floor(config.questionCount * 0.5),      // 50% MCQs
      numerical: Math.floor(config.questionCount * 0.3), // 30% Numericals
      short: Math.floor(config.questionCount * 0.15),    // 15% Short
      long: Math.floor(config.questionCount * 0.05)      // 5% Long
    };

    const prompt = `Generate a comprehensive test for the chapter "${config.chapterName}" in ${config.subject}.

Subtopics to cover: ${config.subtopics.join(', ')}

Test Requirements:
- ${mix.mcq} Multiple Choice Questions (4 marks each)
- ${mix.numerical} Numerical Problems (5 marks each)
- ${mix.short} Short Answer Questions (3 marks each)
- ${mix.long} Long Answer Questions (10 marks each)
- Difficulty Level: ${config.difficulty}/100
- Time Limit: ${config.timeLimit} minutes

For each question, provide:
1. Question text
2. Options (for MCQs, labeled A, B, C, D)
3. Correct answer
4. Detailed explanation
5. Marks

Format each question as:
---
TYPE: mcq/numerical/short/long
MARKS: X
DIFFICULTY: 0-100
QUESTION: [question text]
OPTIONS: (for MCQs only)
A) [option]
B) [option]
C) [option]
D) [option]
ANSWER: [correct answer]
EXPLANATION: [detailed explanation]
---

Generate all questions now:`;

    try {
      const response = await ModelManager.streamChat([
        { role: 'system', content: 'You are an expert test creator. Generate high-quality, well-structured test questions.' },
        { role: 'user', content: prompt }
      ], () => {});

      // Parse questions from response
      const questions = await this.parseQuestions(response, config.subject);

      // Evaluate diagram needs for each question
      for (const question of questions) {
        const assessment = await DiagramDecisionEngine.evaluateNeed(
          question.question,
          'test',
          config.subject
        );

        if (assessment.needsDiagram && assessment.confidence > 70) {
          console.log(`[TestGenerator] Generating diagram for question ${question.id}`);
          try {
            const diagram = await DiagramAI.generateFromPrompt(
              assessment.suggestedType || 'formula',
              question.question
            );
            question.diagram = diagram;
          } catch (error) {
            console.warn('[TestGenerator] Diagram generation failed:', error);
          }
        }
      }

      const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

      const test: Test = {
        id: `test_${Date.now()}`,
        chapterId: config.chapterId,
        title: `${config.chapterName} - Chapter Test`,
        questions,
        totalMarks,
        timeLimit: config.timeLimit,
        difficulty: config.difficulty,
        createdAt: Date.now()
      };

      console.log('[TestGenerator] Test generated:', test.questions.length, 'questions');
      return test;
    } catch (error) {
      console.error('[TestGenerator] Generation failed:', error);
      throw error;
    }
  }

  private async parseQuestions(response: string, subject: string): Promise<TestQuestion[]> {
    const questions: TestQuestion[] = [];
    const blocks = response.split('---').filter(b => b.trim().length > 0);

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      
      const typeMatch = block.match(/TYPE:\s*(mcq|numerical|short|long)/i);
      const marksMatch = block.match(/MARKS:\s*(\d+)/);
      const difficultyMatch = block.match(/DIFFICULTY:\s*(\d+)/);
      const questionMatch = block.match(/QUESTION:\s*(.+?)(?=OPTIONS:|ANSWER:|$)/s);
      const optionsMatch = block.match(/OPTIONS:\s*(.+?)(?=ANSWER:|$)/s);
      const answerMatch = block.match(/ANSWER:\s*(.+?)(?=EXPLANATION:|$)/s);
      const explanationMatch = block.match(/EXPLANATION:\s*(.+?)$/s);

      if (!typeMatch || !questionMatch || !answerMatch) continue;

      const type = typeMatch[1].toLowerCase() as TestQuestion['type'];
      const question: TestQuestion = {
        id: `q${i + 1}`,
        type,
        question: questionMatch[1].trim(),
        correctAnswer: answerMatch[1].trim(),
        explanation: explanationMatch?.[1]?.trim() || '',
        marks: parseInt(marksMatch?.[1] || '4'),
        difficulty: parseInt(difficultyMatch?.[1] || '50')
      };

      if (type === 'mcq' && optionsMatch) {
        const optionsText = optionsMatch[1];
        question.options = optionsText
          .split(/[A-D]\)/)
          .map(o => o.trim())
          .filter(o => o.length > 0);
      }

      questions.push(question);
    }

    return questions;
  }
}

export const TestGenerator = new TestGeneratorService();
