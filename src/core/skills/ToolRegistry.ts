import { HierarchicalStore } from '../memory/HierarchicalMemoryStore';
import { DiagramOrchestrator } from '../orchestrator/DiagramOrchestrator';
import { DiagramAI } from '../../skills/DiagramAIIntegration';
import { ResourceStore } from '../storage/ResourceStore';

/**
 * ToolRegistry: Source of truth for AI-callable tools.
 * These match the tool definitions in the native LiteRT engine.
 */
export const ToolRegistry = {
  /**
   * search_memory: Semantic search for personal/academic facts.
   */
  async search_memory(args: { query?: string; concept?: string; topic?: string }): Promise<string> {
    const queryStr = args.query || args.concept || args.topic || '';
    console.log('[Tool] search_memory:', queryStr);
    if (!queryStr.trim()) {
      return 'No query provided to search memory.';
    }
    try {
      const facts = await HierarchicalStore.searchContent(queryStr, 5);
      if (facts && facts.length > 0) {
        return facts.map(f => f.content).join('\n');
      }
      return 'No relevant memory found for this query.';
    } catch (e) {
      console.error('[Tool] search_memory error:', e);
      return 'Error searching memory.';
    }
  },

  /**
   * generate_diagram: Triggers the pedagogical diagram engine.
   */
  async generate_diagram(args: { topic: string, type?: string }): Promise<any> {
    console.log('[Tool] generate_diagram:', args.topic, args.type);
    try {
      const diagram = await DiagramAI.generateFromRequest({
        topic: args.topic,
        type: (args.type as any) || 'svg',
        difficulty: 50,
      });
      return diagram ? JSON.stringify(diagram) : 'Failed to generate diagram.';
    } catch (e) {
      return `Error generating diagram: ${e}`;
    }
  },

  /**
   * generate_quiz: Fetches or creates MCQs for the topic.
   */
  async generate_quiz(args: { topic: string, count?: number }): Promise<string> {
    console.log('[Tool] generate_quiz:', args.topic);
    const count = args.count || 2;
    // Check ResourceStore for pre-generated ones first
    const ready = await ResourceStore.getReadyMCQs('General', args.topic, count);
    if (ready.length > 0) {
      return JSON.stringify(ready);
    }
    return `Generate ${count} MCQs about ${args.topic}. (Model should switch to MCQ skill internally)`;
  },

  /**
   * getTool: Retrieve a tool function by name for dynamic execution.
   */
  getTool(name: string): ((args: any) => Promise<any>) | undefined {
    const toolMap: Record<string, (args: any) => Promise<any>> = {
      search_memory: (args) => this.search_memory(args),
      generate_diagram: (args) => this.generate_diagram(args),
      generate_quiz: (args) => this.generate_quiz(args),
      // Add aliases for common variations
      explain_concept: (args) => this.search_memory(args), // Fallback to memory search
    };
    return toolMap[name];
  }
};

export type ToolName = keyof typeof ToolRegistry;
