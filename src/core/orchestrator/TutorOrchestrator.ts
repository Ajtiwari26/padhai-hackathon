import { DiagramAI } from '../../skills/DiagramAIIntegration';
import { ToolRegistry } from '../skills/ToolRegistry';
import { GeneratedDiagram } from '../../skills/DiagramGenerator';
import { ModelManager } from '../api/ModelManager';
import { HierarchicalStore } from '../memory/HierarchicalMemoryStore';
import { SyllabusGuardrail } from './SyllabusGuardrail';
import { TopicConvergenceTracker } from './TopicConvergenceTracker';
import { ContextMapper } from '../context/ContextMapper';
import { ContextBudget } from '../memory/ContextBudget';
import { LocalServerManager } from '../api/LocalServerManager';
import { StudentProfileStore } from '../storage/StudentProfile';
import { SemanticMemoryInstance } from '../memory/SemanticMemory';
import { ChatStore } from '../storage/ChatStore';

export interface OrchestratorState {
  activeTopic: string;
  activeSubtopic?: string;
  currentPhase: 'SWEEPING' | 'MOLDING' | 'VERIFYING';
  confidenceLevel: number;
  numericalDifficultyLevel: number;
}

export interface TutorResponse {
  text: string;
  diagrams?: GeneratedDiagram[];
  detectedSkill?: string;
}

class TutorOrchestratorService {
  private state: OrchestratorState = {
    activeTopic: 'General',
    currentPhase: 'SWEEPING',
    confidenceLevel: 0,
    numericalDifficultyLevel: 1,
  };

  /**
   * Main entry point for student interaction.
   */
  public async handleMessage(
    userInput: string,
    onToken: (token: string) => void,
    customSystemPrompt?: string,
    history: { role: 'user' | 'assistant' | 'system'; content: string }[] = [],
    caveman: boolean = false
  ): Promise<TutorResponse> {
    console.log('[Orchestrator] Handling input:', userInput);

    // 1. Retrieve condensed context (Semantic Memory & Cheatsheet)
    const profile = await StudentProfileStore.get();
    const semanticContext = SemanticMemoryInstance.getRelevantContext(userInput);
    const sessionCheatsheet = await ChatStore.getSessionSummary(this.state.activeTopic);

    // 1b. Fetch path-selective hierarchical facts (PadhMemoir)
    let hierarchicalFacts = '';
    try {
      hierarchicalFacts = await HierarchicalStore.getContextForTopic(
        this.state.activeTopic,
        60, // ~60 tokens budget for state vector
      );
      if (hierarchicalFacts) {
        console.log(`[Orchestrator] PadhMemoir context (${hierarchicalFacts.length} chars)`);
      }
    } catch (e) {
      console.warn('[Orchestrator] HierarchicalStore failed, using legacy:', e);
    }
    
    // 1c. SigMap Context Injection (Codebase/Knowledge Structure)
    let sigMapContext = '';
    if (userInput.toLowerCase().includes('structure') || userInput.toLowerCase().includes('how do you') || userInput.toLowerCase().includes('where is')) {
      if (ContextMapper) {
        try {
          const matches = await ContextMapper.ask(userInput);
          if (matches && matches.length > 0) {
            sigMapContext = matches.map((m: { path: string, name: string, type: string }) => `[SigMap] ${m.path} > ${m.name} (${m.type})`).join('\n');
            console.log(`[Orchestrator] SigMap Context found: ${matches.length} matches`);
          }
        } catch (e) {
          console.warn('[Orchestrator] SigMap query failed:', e);
        }
      }
    }
    
    // 2. Build AI-Native System Prompt
    const systemPrompt = customSystemPrompt || this.getUnifiedPrompt(
      this.state.activeTopic,
      profile
    );
    
    // 3. Assemble Prompt with Budget
    const config = await LocalServerManager.getConfig();
    const messages = ContextBudget.assembleFinalMessages({
      systemPrompt,
      sessionCheatsheet,
      semanticFacts: '', // Handled by search_memory tool now!
      hierarchicalFacts: hierarchicalFacts || undefined,
      rawHistory: history as any,
      currentUserMessage: userInput,
      maxTokens: config.maxTokens,
      maxOutputTokens: config.maxOutputTokens,
    });

    // 4. Stream Response with Native Tool Calling enabled
    console.log(`[Orchestrator] 🚀 Dispatching to ModelManager with Tools. Messages: ${messages.length}, Caveman: ${caveman}`);
    let fullResponse = await ModelManager.streamChat(messages as any, onToken, undefined, 'foreground', undefined, undefined, true, caveman);

    // 5. Post-process
    console.log(`[Orchestrator] 🔚 Received response (${fullResponse.length} chars).`);
    
    TopicConvergenceTracker.evaluateTurn(userInput, fullResponse, 'Agentic').catch(e => console.error(e));
    await this.updateStateAfterTurn(fullResponse);

    HierarchicalStore.processExchange(userInput, fullResponse, this.state.activeTopic).catch(e => console.error(e));

    return { 
      text: fullResponse,
      diagrams: [], // Now handled via tools!
      detectedSkill: 'Agentic'
    };
  }

  /**
   * AI-Native System Prompt.
   */
  private getUnifiedPrompt(
    topic: string,
    profile?: any
  ): string {
    const profileSnapshot = profile ? `
STUDENT PROFILE:
- Name: ${profile.name}
- Level: ${profile.educationLevel}
- Learning Style: ${profile.learningStyle}
- Subjects: ${profile.subjects?.join(', ') || 'General'}
` : '';

    return `You are the Padh.ai AI Mentor for topic: ${topic}.

${profileSnapshot}

${SyllabusGuardrail.getGuardrailPrompt()}

CORE MENTOR RULES:
- TOOL-NATIVE: You have access to tools. Use 'search_memory' before answering questions about the user's past or personal context. Use 'generate_diagram' when a visual aid would help.
- BREVITY IS KEY: Match the length of your response to the user's input. For simple inputs like 'hi', respond with a single sentence.
- ACADEMIC RIGOR: Use KaTeX for ALL mathematical formulas (e.g. $$ E=mc^2 $$ or inline $ x $).
- PEDAGOGY: Use the Socratic method where possible. Instead of giving answers, use tools to guide the student.
`;
  }

  private async updateStateAfterTurn(response: string) {
    if (response.includes('[DIFFICULTY_UP]')) {
      this.state.numericalDifficultyLevel = Math.min(5, this.state.numericalDifficultyLevel + 1);
      console.log(`[Orchestrator] Numerical difficulty increased to: ${this.state.numericalDifficultyLevel}`);
    }
    // Phase transitions could be managed here if needed
    console.log('[Orchestrator] Turn complete.');
  }

  public setTopic(topic: string, subtopic?: string) {
    this.state.activeTopic = topic;
    this.state.activeSubtopic = subtopic;
    this.state.confidenceLevel = 0;
    this.state.numericalDifficultyLevel = 1;
    this.state.currentPhase = 'SWEEPING';
    SyllabusGuardrail.setActiveTopic(topic, subtopic);
    
    // Initialize tracking for this new topic
    if (subtopic) {
      TopicConvergenceTracker.initTracking(topic, subtopic, []);
    }
  }
}

export const TutorOrchestrator = new TutorOrchestratorService();
