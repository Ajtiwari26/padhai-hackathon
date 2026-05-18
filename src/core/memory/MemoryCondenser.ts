import { ModelManager } from '../api/ModelManager';
import { ChatStore } from '../storage/ChatStore';
import { NativeModules } from 'react-native';

const { PadhVectorDB } = NativeModules;


class MemoryCondenserService {
  /**
   * Summarizes the latest chat interaction into a "Cheatsheet".
   * This cheatsheet is what is fed back to the LLM instead of raw history.
   */
  public async generateSessionCheatsheet(
    topic: string,
    history: { role: string; content: string }[]
  ): Promise<string> {
    if (history.length === 0) return '';

    // Take only the last 20 messages for summary to avoid massive prompts
    const recentHistory = history.slice(-20);
    const formattedHistory = recentHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    const prompt = `
You are an expert educational AI analyzing a tutoring session.
Create a high-quality "Learning Digest" (Cheatsheet) for the topic: ${topic}.

Rules for formatting:
1. Use Markdown headers (###) for sections.
2. Use bold (**text**) for key terms.
3. IMPORTANT - MATH: Use KaTeX for ALL mathematical formulas, variables, and physics terms.
   - Use $$ [formula] $$ for standalone equations or blocks.
   - Use $ [term] $ for inline variables (e.g. $m$, $F_g$, $\\pi$).
4. NO LOW-QUALITY SYMBOLS: Strictly FORBIDDEN to use characters like "=>", "->", "*", "/", "^" outside of KaTeX. Use proper LaTeX equivalents (\\rightarrow, \\times, \\frac, etc.).
5. Structure the content to look like a professional textbook summary.

Summarize the session using this structure:

### 📖 TOPIC: ${topic}
---
### 🧩 CONCEPTS COVERED
- [Concept Name]: [✅ fully understood / ⚠️ partial / ❌ needs review]
  * [Brief technical explanation using KaTeX if needed]

### 💡 STUDENT INSIGHTS
- **Strengths**: [What the student understood well]
- **Gaps**: [Specific misconceptions or missing links]

### ❓ UNRESOLVED
- [List any open questions or incomplete explanations]

### 🎯 NEXT STEPS
- [Specific instruction for the next session]

CHAT HISTORY:
${formattedHistory}

Output ONLY the structured cheatsheet. No conversational filler.
`;

    try {
      console.log(`[MemoryCondenser] Generating cheatsheet for ${topic}...`);
      const summary = await ModelManager.generate(prompt);
      
      // Save it to ChatStore
      await ChatStore.saveSessionSummary(topic, summary);
      return summary;
    } catch (e) {
      console.error('[MemoryCondenser] Failed to generate cheatsheet:', e);
      return '';
    }
  }
  /**
   * Retrieves relevant "Cheatsheet" snippets based on the current user query.
   */
  public async getRelevantContext(query: string): Promise<string[]> {
    try {
      const results = await PadhVectorDB.search(query, 3);
      return results.map((r: any) => r.content);
    } catch (e) {
      console.warn('[MemoryCondenser] Vector search failed, returning empty context.');
      return [];
    }
  }


}

export const MemoryCondenser = new MemoryCondenserService();
