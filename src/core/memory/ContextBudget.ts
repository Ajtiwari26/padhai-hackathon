import { ChatMessage } from '../storage/ChatStore';

export interface AssembleContextOptions {
  systemPrompt: string;
  sessionCheatsheet: string;
  semanticFacts: string;
  /** Path-selective facts from HierarchicalMemoryStore (preferred over semanticFacts) */
  hierarchicalFacts?: string;
  rawHistory: ChatMessage[];
  currentUserMessage: string;
  maxTokens: number;
  maxOutputTokens: number;
}

export interface AssembledMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class ContextBudgetManager {
  /**
   * CRITICAL: Hard limit to prevent OOM crashes
   * Never exceed 8192 tokens total context (input + output)
   */
  private static readonly MAX_SAFE_CONTEXT_TOKENS = 8192;
  
  /**
   * Emergency fallback if still over limit after trimming
   */
  private static readonly EMERGENCY_CONTEXT_TOKENS = 4096;
  
  /**
   * Maximum conversation turns to keep in context, regardless of token budget.
   * Research: Sliding Window Attention — capping at 2 turns (1 user + 1 assistant)
   * keeps the model focused and prevents memory bloat on 8k context Gemma 4.
   * 
   * CRITICAL: This prevents app crashes from growing chat history!
   */
  private static readonly MAX_HISTORY_TURNS = 2;

  /**
   * Maximum tokens allowed per individual history message.
   * Long AI responses are truncated to their tail (most recent context).
   */
  private static readonly MAX_TOKENS_PER_HISTORY_MSG = 300;
  /**
   * Estimate tokens from a string.
   * Using conservative heuristic: 1 token ≈ 4 characters.
   */
  public estimateTokens(text: string): number {
    return Math.ceil((text || '').length / 4);
  }

  /**
   * Assembles the final messages array, staying within the maximum token budget.
   * Prioritizes: System Prompt > Current User Message > Cheatsheet > Semantic Facts > Recent History.
   * 
   * DYNAMIC OUTPUT TOKENS: If maxOutputTokens is -1, calculates dynamically based on response type.
   * HARD LIMIT: Never exceeds MAX_SAFE_CONTEXT_TOKENS to prevent OOM crashes.
   */
  public assembleFinalMessages(opts: AssembleContextOptions): AssembledMessage[] {
    const {
      systemPrompt,
      sessionCheatsheet,
      semanticFacts,
      rawHistory,
      currentUserMessage,
      maxTokens,
      maxOutputTokens: configuredMaxOutput,
    } = opts;

    // SAFETY: Enforce hard limit
    const safeMaxTokens = Math.min(maxTokens, ContextBudgetManager.MAX_SAFE_CONTEXT_TOKENS);
    console.log(`[ContextBudget] Safe max tokens: ${safeMaxTokens} (requested: ${maxTokens})`);

    // Dynamic output token calculation
    let maxOutputTokens = configuredMaxOutput;
    if (maxOutputTokens === -1) {
      // Detect response type from system prompt — check ACTIVE SKILLS section, not the roster
      const lowerPrompt = systemPrompt.toLowerCase();
      
      // Check the ACTIVE instruction block, not the roster that lists all skills
      const activeSkillsSection = lowerPrompt.split('active skills')[1] || '';
      
      const isVisualExplainer = activeSkillsSection.includes('visualexplainer') || 
                                 activeSkillsSection.includes('visual');
      const isConceptTeacher = activeSkillsSection.includes('conceptteacher') || 
                                activeSkillsSection.includes('explain');
      const isQuickResponse = activeSkillsSection.includes('quickmcq') || 
                               activeSkillsSection.includes('keypoints');
      // Conversational: only if the ACTIVE skill is purely conversational (very short acks)
      const isConversational = activeSkillsSection.includes('acknowledge the student warmly');
      
      if (isConversational) {
        maxOutputTokens = 256; // Very short casual responses
      } else if (isVisualExplainer || isConceptTeacher) {
        maxOutputTokens = 3072; // Long explanations and visual descriptions
      } else if (isQuickResponse) {
        maxOutputTokens = 512; // Short responses
      } else {
        maxOutputTokens = 1536; // Medium responses (default)
      }
      
      console.log(`[ContextBudget] Dynamic output tokens: ${maxOutputTokens} (type: ${isConversational ? 'conversational' : isVisualExplainer ? 'visual' : isConceptTeacher ? 'concept' : isQuickResponse ? 'quick' : 'default'})`);
    }

    let availableTokens = safeMaxTokens - maxOutputTokens;
    const inputBudget = availableTokens;
    console.log(`[ContextBudget] Input budget: ${inputBudget} tokens`);
    
    const finalMessages: AssembledMessage[] = [];

    // 1. Allocate System Prompt (Critical)
    let fullSystemPrompt = systemPrompt;
    
    // Check cheatsheet and facts, append to system prompt if budget allows
    const cheatsheetText = sessionCheatsheet ? `\n\nPREVIOUS SESSION CHEATSHEET:\n${sessionCheatsheet}` : '';
    // Prefer hierarchical path-selective facts over legacy flat facts
    const activeFacts = opts.hierarchicalFacts || semanticFacts;
    const factsLabel = opts.hierarchicalFacts ? 'STUDENT KNOWLEDGE STATE' : 'STUDENT FACTS';
    const factsText = activeFacts ? `\n\n${factsLabel}:\n${activeFacts}` : '';

    const sysTokens = this.estimateTokens(systemPrompt);
    const cheatTokens = this.estimateTokens(cheatsheetText);
    const factsTokens = this.estimateTokens(factsText);
    const currentUserMsgTokens = this.estimateTokens(currentUserMessage);

    // Reserve tokens for the current message (Critical)
    availableTokens -= currentUserMsgTokens;
    availableTokens -= sysTokens;

    if (availableTokens > cheatTokens && cheatsheetText) {
      fullSystemPrompt += cheatsheetText;
      availableTokens -= cheatTokens;
    }

    if (availableTokens > factsTokens && factsText) {
      fullSystemPrompt += factsText;
      availableTokens -= factsTokens;
    }

    finalMessages.push({ role: 'system', content: fullSystemPrompt });

    // 2. Allocate History (Newest first, capped by MAX_HISTORY_TURNS)
    // Research: Even if budget allows 30+ short turns, limit to 6 to prevent noisy context.
    const historyToAdd: AssembledMessage[] = [];
    const cappedHistory = [...rawHistory]
      .slice(-ContextBudgetManager.MAX_HISTORY_TURNS)
      .reverse();

    for (const msg of cappedHistory) {
      // Truncate long messages (especially AI responses) to prevent budget blowout
      let truncatedContent = msg.content;
      const rawTokens = this.estimateTokens(truncatedContent);
      if (rawTokens > ContextBudgetManager.MAX_TOKENS_PER_HISTORY_MSG) {
        // Keep the tail of the message (most recent context is more valuable)
        const maxChars = ContextBudgetManager.MAX_TOKENS_PER_HISTORY_MSG * 4;
        truncatedContent = '...' + truncatedContent.slice(-maxChars);
        console.log(`[ContextBudget] Truncated history msg from ${rawTokens} to ~${ContextBudgetManager.MAX_TOKENS_PER_HISTORY_MSG} tokens`);
      }

      const msgTokens = this.estimateTokens(truncatedContent);
      if (availableTokens >= msgTokens) {
        historyToAdd.push({
          role: msg.role as 'user' | 'assistant',
          content: truncatedContent,
        });
        availableTokens -= msgTokens;
      } else {
        // Budget exhausted, stop adding older history
        break;
      }
    }

    // Reverse history to put it back in chronological order
    finalMessages.push(...historyToAdd.reverse());

    // 3. Add Current Message (Critical)
    finalMessages.push({ role: 'user', content: currentUserMessage });

    const totalEstTokens = this.estimateTokens(finalMessages.map(m => m.content).join(''));
    console.log(`[ContextBudget] Budget: ${safeMaxTokens} total, ${maxOutputTokens} reserved -> ${inputBudget} input.`);
    console.log(`[ContextBudget] Used: sys=${sysTokens}, cheat=${cheatTokens}, facts=${factsTokens}, user=${currentUserMsgTokens}, history=${historyToAdd.length} turns. Total est: ${totalEstTokens} tokens.`);
    
    // CRITICAL SAFETY CHECK: If still over limit, emergency trim
    if (totalEstTokens > safeMaxTokens) {
      console.error(`[ContextBudget] 🔴 STILL OVER LIMIT (${totalEstTokens} tokens), emergency trim`);
      return this.emergencyTrim(finalMessages, ContextBudgetManager.EMERGENCY_CONTEXT_TOKENS);
    }
    
    // Safety check: warn if total exceeds budget
    if (totalEstTokens > inputBudget) {
      console.warn(`[ContextBudget] ⚠️ OVER BUDGET! ${totalEstTokens} > ${inputBudget}. Risk of OOM.`);
    }

    return finalMessages;
  }

  /**
   * Apply sliding window to keep recent messages within budget
   */
  private applySlidingWindow(
    messages: AssembledMessage[],
    maxTokens: number
  ): AssembledMessage[] {
    const result: AssembledMessage[] = [];
    let currentTokens = 0;

    // Iterate from most recent to oldest
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = this.estimateTokens(msg.content);

      if (currentTokens + msgTokens > maxTokens) {
        break; // Stop adding messages
      }

      result.unshift(msg); // Add to beginning
      currentTokens += msgTokens;
    }

    console.log(`[ContextBudget] Sliding window: kept ${result.length}/${messages.length} messages (${currentTokens} tokens)`);
    return result;
  }

  /**
   * Emergency trim when still over limit after normal budget management
   */
  private emergencyTrim(
    messages: AssembledMessage[],
    maxTokens: number
  ): AssembledMessage[] {
    console.log('[ContextBudget] 🚨 EMERGENCY TRIM');

    // Keep system prompt + last user message (critical)
    const systemPrompt = messages.find(m => m.role === 'system');
    const lastUserMessage = messages[messages.length - 1];

    if (!systemPrompt || !lastUserMessage) {
      console.error('[ContextBudget] Missing critical messages!');
      return messages.slice(-2); // Fallback: keep last 2 messages
    }

    // Calculate remaining budget
    const systemTokens = this.estimateTokens(systemPrompt.content);
    const userTokens = this.estimateTokens(lastUserMessage.content);
    const remainingBudget = maxTokens - systemTokens - userTokens;

    // Keep as many recent messages as possible
    const middleMessages = messages.slice(1, -1); // Exclude system and last user
    const recentMessages = this.applySlidingWindow(middleMessages, remainingBudget);

    return [systemPrompt, ...recentMessages, lastUserMessage];
  }
}

export const ContextBudget = new ContextBudgetManager();
