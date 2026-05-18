/**
 * Concept Teacher Diagram Integration
 * 
 * Integrates diagram generation into Concept Teacher's chat flow
 * Supports parallel execution and inline diagram rendering
 */

import { DiagramOrchestrator, DiagramContext } from './DiagramOrchestrator';
import { ParallelLLMManager } from '../api/ParallelLLMManager';
import { DiagramAI } from '../../skills/DiagramAIIntegration';
import { USE_DIRECT_LITERT } from '../api/LocalServerManager';
import { ModelManager } from '../api/ModelManager';
import type { GeneratedDiagram } from '../../skills/DiagramGenerator';

export interface ConceptResponse {
  text: string;
  diagrams: GeneratedDiagram[];
  renderMode: 'inline' | 'separate' | 'none';
  executionTime: number;
}

export interface LearningContext {
  subject: string;
  currentTopic: string;
  difficulty: number;
  studentLevel: string;
  previousTopics: string[];
  sessionHistory?: { role: 'user' | 'assistant' | 'system'; content: string }[];
}

class ConceptTeacherDiagramIntegrationService {
  /**
   * Generate response with inline diagrams
   */
  async generateResponseWithDiagrams(
    userMessage: string,
    context: LearningContext,
    onToken?: (token: string) => void,
    additionalContext?: string
  ): Promise<ConceptResponse> {
    const startTime = Date.now();

    console.log('[ConceptTeacher] Processing message:', userMessage.substring(0, 50) + '...');

    // 1. Check if diagram needed
    // If the orchestrator already flagged this as VisualExplainer, we force diagram mode
    const isVisualSkill = userMessage.includes('[SKILL:VisualExplainer]') || 
                         /\b(draw|diagram|visualize|picture|plot|graph|dikhao|बनाओ|दिखाओ|samjhao)\b/i.test(userMessage);
    
    const needsDiagram = isVisualSkill || DiagramOrchestrator.shouldGenerateDiagram(userMessage);

    if (!needsDiagram) {
      console.log('[ConceptTeacher] No diagram needed, generating text only');
      const text = await this.generateTextOnly(userMessage, context, onToken);
      return {
        text,
        diagrams: [],
        renderMode: 'none',
        executionTime: Date.now() - startTime
      };
    }

    // 2. Detect diagram requirements
    const diagramContext: DiagramContext = {
      subject: context.subject,
      topic: context.currentTopic,
      userMessage,
      complexity: context.difficulty
    };

    const diagramDecisions = DiagramOrchestrator.detectMultipleDiagrams(diagramContext);
    console.log('[ConceptTeacher] Diagram decisions:', diagramDecisions);

    // If direct LiteRT engine is enabled, force sequential execution to avoid OOM/std::bad_alloc crash
    if (USE_DIRECT_LITERT) {
      console.log('[ConceptTeacher] Direct LiteRT engine is active. Forcing sequential execution to avoid concurrent model calls.');
      return await this.executeSequential(userMessage, context, diagramDecisions);
    }

    // 3. Execute in parallel: Text + Diagrams
    try {
      const result = await this.executeParallel(
        userMessage,
        context,
        diagramDecisions.map(d => d.library),
        onToken
      );

      return {
        text: result.text,
        diagrams: result.diagrams,
        renderMode: 'inline',
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('[ConceptTeacher] Parallel execution failed, falling back to sequential');
      
      // Fallback: Sequential execution
      return await this.executeSequential(userMessage, context, diagramDecisions);
    }
  }

  /**
   * Execute text + diagrams in parallel
   */
  private async executeParallel(
    userMessage: string,
    context: LearningContext,
    diagramTypes: string[],
    onToken?: (token: string) => void,
    additionalContext?: string
  ) {
    console.log('[ConceptTeacher] 🚀 Starting parallel execution');

    const result = await ParallelLLMManager.executeParallel({
      // Main text generation
      main: async (port: number) => {
        return await this.generateTextResponse(userMessage, context, port, onToken, additionalContext);
      },

      // Diagram generation (if single diagram)
      diagram: diagramTypes.length === 1 ? async (port: number) => {
        return await this.generateSingleDiagram(userMessage, context, diagramTypes[0], port);
      } : undefined,

      // Formula generation (if multiple diagrams include formula)
      formula: diagramTypes.includes('formula') && diagramTypes.length > 1 ? async (port: number) => {
        return await this.generateSingleDiagram(userMessage, context, 'formula', port);
      } : undefined,

      // Auxiliary diagram (if multiple diagrams)
      auxiliary: diagramTypes.length > 1 && !diagramTypes.includes('formula') ? async (port: number) => {
        return await this.generateSingleDiagram(userMessage, context, diagramTypes[1], port);
      } : undefined
    });

    // Collect all diagrams
    const diagrams: GeneratedDiagram[] = [];
    if (result.diagram) diagrams.push(result.diagram);
    if (result.formula) diagrams.push(result.formula);
    if (result.auxiliary) diagrams.push(result.auxiliary);

    return {
      text: result.text,
      diagrams
    };
  }

  /**
   * Execute text + diagrams sequentially (fallback)
   */
  private async executeSequential(
    userMessage: string,
    context: LearningContext,
    diagramDecisions: any[]
  ): Promise<ConceptResponse> {
    const startTime = Date.now();

    console.log('[ConceptTeacher] 📝 Sequential execution (fallback)');

    // Generate text first
    const text = await this.generateTextResponse(userMessage, context);

    // Generate diagrams one by one
    const diagrams: GeneratedDiagram[] = [];
    for (const decision of diagramDecisions) {
      try {
        const diagram = await this.generateSingleDiagram(
          userMessage,
          context,
          decision.library
        );
        diagrams.push(diagram);
      } catch (error) {
        console.error(`[ConceptTeacher] Failed to generate ${decision.library} diagram:`, error);
      }
    }

    return {
      text,
      diagrams,
      renderMode: 'inline',
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Generate text response only
   */
  private async generateTextOnly(
    userMessage: string,
    context: LearningContext,
    onToken?: (token: string) => void
  ): Promise<string> {
    return await this.generateTextResponse(userMessage, context, undefined, onToken);
  }

  /**
   * Generate text response (for parallel execution)
   */
  private async generateTextResponse(
    userMessage: string,
    context: LearningContext,
    port?: number,
    onToken?: (token: string) => void,
    additionalContext?: string
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context, additionalContext);
    const userPrompt = this.buildUserPrompt(userMessage, context);

    const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'system', content: systemPrompt }
    ];

    if (context.sessionHistory && context.sessionHistory.length > 0) {
      // Map roles if needed, but assuming they match 'user' | 'assistant' | 'system'
      messages.push(...context.sessionHistory);
    }

    messages.push({ role: 'user', content: userPrompt });

    // Use ModelManager's streamChat for better control
    let fullText = '';
    await ModelManager.streamChat(
      messages,
      (delta) => {
        fullText += delta;
        if (onToken) onToken(delta);
      },
      undefined,
      'foreground',
      port
    );

    return fullText;
  }

  /**
   * Generate single diagram
   */
  private async generateSingleDiagram(
    userMessage: string,
    context: LearningContext,
    diagramType: string,
    port?: number
  ): Promise<GeneratedDiagram> {
    console.log(`[ConceptTeacher] Generating ${diagramType} diagram`);

    const topic = DiagramOrchestrator.extractTopic(userMessage);
    const concepts = DiagramOrchestrator.extractConcepts(userMessage);

    return await DiagramAI.generateFromRequest({
      topic: topic || context.currentTopic,
      type: diagramType as any,
      concepts,
      difficulty: context.difficulty,
      additionalContext: userMessage,
      port
    });
  }

  /**
   * Build system prompt for Concept Teacher
   */
  private buildSystemPrompt(context: LearningContext, additionalContext?: string): string {
    return `You are an expert ${context.subject} teacher guiding the student toward their academic goals.
${additionalContext ? '\nADDITIONAL CONTEXT:\n' + additionalContext + '\n' : ''}

Student Level: ${context.studentLevel}
Current Topic: ${context.currentTopic}
Difficulty: ${context.difficulty}/100

Teaching Style:
- Explain a specific concept clearly, using relatable analogies.
- Do not ask questions yet, just provide a clear, concise explanation.
- Use Hindi/English mix (Hinglish) when appropriate.
- **ALWAYS use LaTeX/KaTeX for mathematical formulas, derivations, and chemical equations.**
- Wrap small inline math in $...$.
- For complex derivations, theorems, or major formulas, write them clearly in LaTeX blocks ($$...$$) so the visual orchestrator can identify and render them as premium cards.
- Never use plain text for exponents (use x^{2}, not x^2).
- Focus on conceptual clarity and problem-solving strategies.`;
  }

  /**
   * Build user prompt
   */
  private buildUserPrompt(userMessage: string, context: LearningContext): string {
    return `Student Question: ${userMessage}

Context: We are studying ${context.currentTopic} in ${context.subject}.

Please provide a clear, conceptual explanation. Remember:
- Formulas will be rendered separately (don't write them in text)
- Diagrams will be shown visually (don't describe them in detail)
- Focus on understanding and problem-solving approach`;
  }

  /**
   * Format response for chat display
   */
  formatForChat(response: ConceptResponse): {
    textBlocks: string[];
    diagramBlocks: GeneratedDiagram[];
  } {
    // Split text into paragraphs
    const textBlocks = response.text
      .split('\n\n')
      .filter(block => block.trim().length > 0);

    return {
      textBlocks,
      diagramBlocks: response.diagrams
    };
  }

  /**
   * Check if parallel execution is available
   */
  isParallelAvailable(): boolean {
    return ParallelLLMManager.isParallelAvailable();
  }

  /**
   * Get execution metrics
   */
  getMetrics() {
    return ParallelLLMManager.getMetrics();
  }
}

export const ConceptTeacherDiagramIntegration = new ConceptTeacherDiagramIntegrationService();
