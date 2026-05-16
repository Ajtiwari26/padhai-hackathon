/**
 * DPP (Daily Practice Problems) Generator
 * 
 * Generates daily practice problem sets for revision
 */

import { ModelManager } from '../api/ModelManager';
import { DiagramDecisionEngine } from '../orchestrator/DiagramDecisionEngine';
import { DiagramAI } from '../../skills/DiagramAIIntegration';

export interface DPPProblem {
  id: string;
  type: 'mcq' | 'numerical';
  question: string;
  options?: string[];
  correctAnswer: string;
  hint: string;
  solution: string;
  difficulty: number;
  timeEstimate: number; // minutes
  diagram?: any;
}

export interface DPP {
  id: string;
  date: string;
  title: string;
  chapters: string[];
  problems: DPPProblem[];
  totalTime: number; // minutes
  difficulty: number;
  createdAt: number;
}

export interface DPPConfig {
  chapters: Array<{ id: string; name: string }>;
  subject: string;
  problemCount: number;
  difficulty: number;
  date: string;
}

class DPPGeneratorService {
  async generate(config: DPPConfig): Promise<DPP> {
    console.log('[DPPGenerator] Generating DPP for:', config.date);

    const chapterNames = config.chapters.map(c => c.name).join(', ');
    
    const prompt = `Generate a Daily Practice Problem (DPP) set for ${config.subject}.

Chapters: ${chapterNames}
Date: ${config.date}
Number of Problems: ${config.problemCount}
Difficulty: ${config.difficulty}/100

Mix of problems:
- ${Math.ceil(config.problemCount * 0.6)} MCQs (quick recall and concept check)
- ${Math.floor(config.problemCount * 0.4)} Numerical Problems (application and calculation)

For each problem, provide:
1. Question text (clear and concise)
2. Options (for MCQs, labeled A, B, C, D)
3. Correct answer
4. Hint (one-line clue without giving away the answer)
5. Detailed solution with steps
6. Time estimate (in minutes)

Format each problem as:
---
TYPE: mcq/numerical
TIME: X minutes
DIFFICULTY: 0-100
QUESTION: [question text]
OPTIONS: (for MCQs only)
A) [option]
B) [option]
C) [option]
D) [option]
ANSWER: [correct answer]
HINT: [one-line hint]
SOLUTION: [step-by-step solution]
---

Generate all problems now:`;

    try {
      const response = await ModelManager.streamChat([
        { role: 'system', content: 'You are an expert problem creator for daily practice. Create challenging but solvable problems.' },
        { role: 'user', content: prompt }
      ], () => {});

      // Parse problems from response
      const problems = await this.parseProblems(response, config.subject);

      // Evaluate diagram needs for each problem
      for (const problem of problems) {
        const assessment = await DiagramDecisionEngine.evaluateNeed(
          problem.question,
          'dpp',
          config.subject
        );

        if (assessment.needsDiagram && assessment.confidence > 75) {
          console.log(`[DPPGenerator] Generating diagram for problem ${problem.id}`);
          try {
            const diagram = await DiagramAI.generateFromPrompt(
              assessment.suggestedType || 'formula',
              problem.question
            );
            problem.diagram = diagram;
          } catch (error) {
            console.warn('[DPPGenerator] Diagram generation failed:', error);
          }
        }
      }

      const totalTime = problems.reduce((sum, p) => sum + p.timeEstimate, 0);

      const dpp: DPP = {
        id: `dpp_${Date.now()}`,
        date: config.date,
        title: `DPP - ${config.date}`,
        chapters: config.chapters.map(c => c.name),
        problems,
        totalTime,
        difficulty: config.difficulty,
        createdAt: Date.now()
      };

      console.log('[DPPGenerator] DPP generated:', dpp.problems.length, 'problems');
      return dpp;
    } catch (error) {
      console.error('[DPPGenerator] Generation failed:', error);
      throw error;
    }
  }

  private async parseProblems(response: string, subject: string): Promise<DPPProblem[]> {
    const problems: DPPProblem[] = [];
    const blocks = response.split('---').filter(b => b.trim().length > 0);

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      
      const typeMatch = block.match(/TYPE:\s*(mcq|numerical)/i);
      const timeMatch = block.match(/TIME:\s*(\d+)/);
      const difficultyMatch = block.match(/DIFFICULTY:\s*(\d+)/);
      const questionMatch = block.match(/QUESTION:\s*(.+?)(?=OPTIONS:|ANSWER:|$)/s);
      const optionsMatch = block.match(/OPTIONS:\s*(.+?)(?=ANSWER:|$)/s);
      const answerMatch = block.match(/ANSWER:\s*(.+?)(?=HINT:|$)/s);
      const hintMatch = block.match(/HINT:\s*(.+?)(?=SOLUTION:|$)/s);
      const solutionMatch = block.match(/SOLUTION:\s*(.+?)$/s);

      if (!typeMatch || !questionMatch || !answerMatch) continue;

      const type = typeMatch[1].toLowerCase() as DPPProblem['type'];
      const problem: DPPProblem = {
        id: `p${i + 1}`,
        type,
        question: questionMatch[1].trim(),
        correctAnswer: answerMatch[1].trim(),
        hint: hintMatch?.[1]?.trim() || 'Think about the core concept',
        solution: solutionMatch?.[1]?.trim() || '',
        difficulty: parseInt(difficultyMatch?.[1] || '50'),
        timeEstimate: parseInt(timeMatch?.[1] || '3')
      };

      if (type === 'mcq' && optionsMatch) {
        const optionsText = optionsMatch[1];
        problem.options = optionsText
          .split(/[A-D]\)/)
          .map(o => o.trim())
          .filter(o => o.length > 0);
      }

      problems.push(problem);
    }

    return problems;
  }
}

export const DPPGenerator = new DPPGeneratorService();
