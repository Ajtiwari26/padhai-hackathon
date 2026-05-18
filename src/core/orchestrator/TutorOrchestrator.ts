import { GeneratedDiagram } from '../../skills/DiagramGenerator';
import { ModelManager } from '../api/ModelManager';
import { HierarchicalStore } from '../memory/HierarchicalMemoryStore';
import { SyllabusGuardrail } from './SyllabusGuardrail';
import { TopicConvergenceTracker } from './TopicConvergenceTracker';
import { ContextBudget } from '../memory/ContextBudget';
import { LocalServerManager } from '../api/LocalServerManager';
import { StudentProfileStore } from '../storage/StudentProfile';
import { ChatStore, ChatMessage } from '../storage/ChatStore';
import { EventBus } from '../bus/EventBus';
import { ContextWindow } from '../memory/ContextWindowManager';
import { KVCache } from '../memory/KVCacheManager';
import { AISyllabusGenerator } from '../curriculum/AISyllabusGenerator';
import { MemoryCondenser } from '../memory/MemoryCondenser';
import { TutoringSkillDB } from '../skills/TutoringSkillDB';
import { ConceptTeacherDiagramIntegration, LearningContext } from './ConceptTeacherDiagramIntegration';
import { DiagramOrchestrator } from './DiagramOrchestrator';


export interface OrchestratorState {
  activeTopic: string;
  activeSubtopic?: string;
  currentPhase: 'SWEEPING' | 'MOLDING' | 'VERIFYING';
  confidenceLevel: number;
  numericalDifficultyLevel: number;
  currentSkill?: string;
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
    currentSkill: 'SocraticMolder',
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

    // 1. Retrieve condensed context (Hierarchical Memory & Cheatsheet)
    const profile = await StudentProfileStore.get();
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
      console.warn('[Orchestrator] HierarchicalStore failed:', e);
    }
    
    // 2. Build AI-Native System Prompt
    const systemPrompt = customSystemPrompt || await this.getUnifiedPrompt(
      this.state.activeTopic,
      profile
    );
    
    // Map history to ChatMessage[] for ContextWindowManager
    const chatMessages: ChatMessage[] = history.map((msg, index) => ({
      id: `history_${index}`,
      role: msg.role === 'assistant' ? 'ai' : 'user' as 'user' | 'ai',
      content: msg.content,
      timestamp: Date.now()
    })).filter(msg => msg.role === 'user' || msg.role === 'ai');

    const processedHistory = await ContextWindow.buildContext(chatMessages, this.state.activeTopic);

    // Periodic Memory Condensation (every 10 messages)
    if (chatMessages.length > 0 && chatMessages.length % 10 === 0) {
      console.log('[Orchestrator] Triggering periodic MemoryCondenser...');
      MemoryCondenser.generateSessionCheatsheet(this.state.activeTopic, chatMessages).catch(e => 
        console.error('[Orchestrator] Failed to generate periodic cheatsheet:', e)
      );
    }

    // Add user message to KVCache
    KVCache.addMessage({
      id: `user_${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: Date.now()
    }).catch(e => console.error('[Orchestrator] Failed to add user message to KVCacheManager:', e));

    // 3. Assemble Prompt with Budget
    const config = await LocalServerManager.getConfig();
    const messages = ContextBudget.assembleFinalMessages({
      systemPrompt,
      sessionCheatsheet,
      semanticFacts: '', // Handled by search_memory tool now!
      hierarchicalFacts: hierarchicalFacts || undefined,
      rawHistory: processedHistory,
      currentUserMessage: userInput,
      maxTokens: config.maxTokens,
      maxOutputTokens: config.maxOutputTokens,
    });

    // 4. Stream Response with Native Tool Calling enabled
    let fullResponse = '';
    let diagrams: any[] = [];
    let detectedSkill = 'Agentic';

    const isVisualSkill = userInput.includes('[SKILL:VisualExplainer]') || 
                         /\b(draw|diagram|visualize|picture|plot|graph|dikhao|बनाओ|दिखाओ|samjhao)\b/i.test(userInput);
    
    const needsDiagram = isVisualSkill || DiagramOrchestrator.shouldGenerateDiagram(userInput);

    if (this.state.currentSkill === 'ConceptTeacher' || needsDiagram) {
      console.log('[Orchestrator] Using ConceptTeacherDiagramIntegration');
      const learningContext: LearningContext = {
        subject: profile?.subjects?.[0] || 'General',
        currentTopic: this.state.activeTopic,
        difficulty: this.state.numericalDifficultyLevel * 20,
        studentLevel: profile?.educationLevel || 'High School',
        previousTopics: [],
        sessionHistory: history
      };

      const conceptResponse = await ConceptTeacherDiagramIntegration.generateResponseWithDiagrams(
        userInput,
        learningContext,
        onToken
      );

      fullResponse = conceptResponse.text;
      diagrams = conceptResponse.diagrams;
      detectedSkill = 'ConceptTeacher';
    } else {
      console.log(`[Orchestrator] 🚀 Dispatching to ModelManager with Tools. Messages: ${messages.length}, Caveman: ${caveman}`);
      fullResponse = await ModelManager.streamChat(messages as any, onToken, undefined, 'foreground', undefined, undefined, true, caveman);
    }

    // Add AI response to KVCache
    KVCache.addMessage({
      id: `ai_${Date.now()}`,
      role: 'ai',
      content: fullResponse,
      timestamp: Date.now()
    }).catch(e => console.error('[Orchestrator] Failed to add AI response to KVCache:', e));

    // 5. Post-process
    console.log(`[Orchestrator] 🔚 Received response (${fullResponse.length} chars).`);
    
    // Emit user message event
    EventBus.emitSync('user:message', {
      text: userInput,
      topic: this.state.activeTopic,
      timestamp: Date.now()
    });
    
    // Emit AI response event (TopicConvergenceTracker listens to this)
    EventBus.emitSync('ai:response', {
      text: fullResponse,
      topic: this.state.activeTopic,
      duration: 0,
      tokensUsed: Math.ceil(fullResponse.length / 4)
    });
    
    await this.updateStateAfterTurn(fullResponse);

    // Store exchange in hierarchical memory (async, non-blocking)
    HierarchicalStore.processExchange(userInput, fullResponse, this.state.activeTopic).catch(e => console.error(e));

    return { 
      text: fullResponse,
      diagrams: diagrams,
      detectedSkill: detectedSkill
    };
  }

  /**
   * AI-Native System Prompt.
   */
  private async getUnifiedPrompt(
    topic: string,
    profile?: any
  ): Promise<string> {
    const profileSnapshot = profile ? `
STUDENT PROFILE:
- Name: ${profile.name}
- Level: ${profile.educationLevel}
- Learning Style: ${profile.learningStyle}
- Subjects: ${profile.subjects?.join(', ') || 'General'}
` : '';

    let curriculumContext = '';
    try {
      const curriculum = await AISyllabusGenerator.loadCurriculum();
      if (curriculum) {
        // Find current chapter/subtopic context
        const currentChapter = curriculum.chapters.find(c => 
          c.name === topic || c.subtopics?.some(s => s.name === topic)
        );
        if (currentChapter) {
          curriculumContext = `
CURRICULUM CONTEXT:
- Active Chapter: ${currentChapter.name}
- Active Topic: ${topic}`;
          const subtopic = currentChapter.subtopics?.find(s => s.name === topic);
          if (subtopic) {
             curriculumContext += `\n- Concepts to Cover: ${subtopic.concepts.join(', ')}\n- Difficulty: ${subtopic.difficulty}/100`;
          }
        }
      }
    } catch (e) {
      console.warn('[Orchestrator] Failed to load curriculum context:', e);
    }

    const skill = TutoringSkillDB.get(this.state.currentSkill || 'SocraticMolder');
    const skillPrompt = skill.getSystemPrompt(this.state, []);

    return `You are the Padh.ai AI Mentor for topic: ${topic}.
${curriculumContext}
${profileSnapshot}

${SyllabusGuardrail.getGuardrailPrompt()}

CORE MENTOR RULES:
- TOOL-NATIVE: You have access to tools. Use 'search_memory' before answering questions about the user's past or personal context. Use 'generate_diagram' when a visual aid would help.
- BREVITY IS KEY: Match the length of your response to the user's input. For simple inputs like 'hi', respond with a single sentence.
- ACADEMIC RIGOR: Use KaTeX for ALL mathematical formulas (e.g. $$ E=mc^2 $$ or inline $ x $).
- ADAPTIVE SKILL: You can switch skills. If you feel the student needs a different approach, output [SWITCH_SKILL: SkillId] at the start of your response. Available skills: ConceptTeacher, VisualExplainer, BreadthSweeper, QuickMCQ, NumericalChallenge, KeyPointsSummary.
- DO NOT switch to 'KeyPointsSummary' unless the user explicitly asks for a summary, recap, or list. For requests like 'continue', default to teaching the concepts deeply using 'SocraticMolder' or 'ConceptTeacher'.

SKILL-SPECIFIC RULES (${skill.name}):
${skillPrompt}
`;
  }

  private async updateStateAfterTurn(response: string) {
    if (response.includes('[DIFFICULTY_UP]')) {
      this.state.numericalDifficultyLevel = Math.min(5, this.state.numericalDifficultyLevel + 1);
      console.log(`[Orchestrator] Numerical difficulty increased to: ${this.state.numericalDifficultyLevel}`);
    }

    // Skill switching
    const skillMatch = response.match(/\[SWITCH_SKILL:\s*(\w+)\]/);
    if (skillMatch && skillMatch[1]) {
      const newSkill = skillMatch[1];
      console.log(`[Orchestrator] Switching skill from ${this.state.currentSkill} to ${newSkill}`);
      this.state.currentSkill = newSkill;
    }

    // Phase transitions could be managed here if needed
    console.log('[Orchestrator] Turn complete.');
  }

  public async setTopic(topic: string, subtopic?: string) {
    // Generate cheatsheet for previous topic before switching
    if (this.state.activeTopic && this.state.activeTopic !== topic && this.state.activeTopic !== 'General') {
      try {
        const history = await ChatStore.loadMessages(this.state.activeTopic);
        if (history && history.length > 2) {
          await MemoryCondenser.generateSessionCheatsheet(this.state.activeTopic, history);
        }
      } catch (e) {
        console.error('[Orchestrator] Failed to generate cheatsheet on topic transition:', e);
      }
    }

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
