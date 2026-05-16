import { SemanticMemoryInstance } from '../memory/SemanticMemory';
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
  async search_memory(args: { query: string }): Promise<string> {
    console.log('[Tool] search_memory:', args.query);
    const facts = SemanticMemoryInstance.getRelevantContext(args.query, 5);
    return facts || 'No relevant memory found for this query.';
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
   * query_app_structure: Uses SigMap to explain how things are built.
   */
  async query_app_structure(args: { query: string }): Promise<string> {
    console.log('[Tool] query_app_structure:', args.query);
    // SigMap context injection logic...
    return "SigMap structure context would be returned here.";
  }
};

export type ToolName = keyof typeof ToolRegistry;
