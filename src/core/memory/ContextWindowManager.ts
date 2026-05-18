import { ChatMessage } from '../storage/ChatStore';
import { ContextBudget } from './ContextBudget';

export class ContextWindowManager {
  /**
   * Maximum tokens for chat history ALONE (excludes system prompt).
   * For a 2B model on mobile, total input should stay under ~600 tokens.
   * System prompt takes ~120, facts ~30, user message ~20 → ~170 fixed.
   * That leaves ~430 for history. Being conservative at 400.
   */
  private readonly maxHistoryTokens = 400;
  
  private readonly maxRecentTurns = 6;

  /**
   * Builds the context by keeping recent messages and condensing older ones.
   * Uses extractive summarization (no model call) for speed.
   */
  public async buildContext(
    messages: ChatMessage[],
    _currentTopic: string
  ): Promise<ChatMessage[]> {
    const totalTokens = this.estimateTotalTokens(messages);
    console.log(`[ContextWindow] Total tokens in history: ${totalTokens}, messages: ${messages.length}`);

    // If within budget AND few messages, pass through
    if (totalTokens <= this.maxHistoryTokens && messages.length <= this.maxRecentTurns) {
      console.log('[ContextWindow] Within budget. No compression needed.');
      return messages;
    }

    console.log(`[ContextWindow] Compressing: ${totalTokens} tokens / ${messages.length} msgs → budget ${this.maxHistoryTokens} tokens / ${this.maxRecentTurns} turns`);

    // Keep only the most recent turns
    const recentMessages = messages.slice(-this.maxRecentTurns);
    
    // Extract key facts from older messages (no model call needed)
    const olderMessages = messages.slice(0, messages.length - recentMessages.length);
    
    if (olderMessages.length === 0) {
      return recentMessages;
    }

    // Extractive summary: pull key info from older messages
    const summary = this.extractKeyFacts(olderMessages);
    
    if (!summary) {
      return recentMessages;
    }

    console.log(`[ContextWindow] Condensed ${olderMessages.length} older msgs → ${summary.length} chars`);

    const summaryMessage: ChatMessage = {
      id: `summary_${Date.now()}`,
      role: 'ai',
      content: `[Earlier: ${summary}]`,
      timestamp: Date.now(),
    };

    return [summaryMessage, ...recentMessages];
  }

  private extractKeyFacts(messages: ChatMessage[]): string {
    const facts: string[] = [];
    
    for (const msg of messages) {
      if (msg.role === 'user') {
        // User messages are typically short — keep as-is
        facts.push(`Student: ${msg.content.substring(0, 100)}`);
      } else {
        // AI messages — extract first 150 chars to retain core concepts instead of just acknowledgment
        const content = msg.content.trim();
        if (content.length > 0) {
          const truncated = content.substring(0, 150);
          facts.push(`Tutor: ${truncated}${content.length > 150 ? '...' : ''}`);
        }
      }
    }
    
    return facts.join(' | ');
  }

  private estimateTotalTokens(messages: ChatMessage[]): number {
    return messages.reduce((sum, msg) => sum + ContextBudget.estimateTokens(msg.content), 0);
  }
}

export const ContextWindow = new ContextWindowManager();

