/**
 * HierarchicalMemoryStore — On-device aggregation + path-selective retrieval.
 *
 * This is the main interface between the React Native app and the native
 * PadhMemoryDB (SQLite). It orchestrates:
 *
 *   1. Classification: user message → taxonomy paths (via PatternClassifier)
 *   2. Storage: upsert classified memories into native SQLite nodes
 *   3. Aggregation: condense nodes when they exceed maxEntries threshold
 *   4. Retrieval: path-selective context injection for the LLM
 *
 * Memoir equivalent: ProllyTreeMemoryStoreManager + IntelligentSearchEngine
 * (but without any LLM calls for classify/search — all on-device)
 *
 * @see https://github.com/zhangfengcdt/memoir — store/prolly_adapter.py
 */

import { NativeModules } from 'react-native';
import { PatternClassifier, Classifier, ClassificationResult } from './PatternClassifier';
import { TaxonomyTree } from './TaxonomyTree';

const { PadhVectorDB } = NativeModules;

// ── Types ───────────────────────────────────────────────────────

export interface MemoryNode {
  path: string;
  content: string;
  summary: string;
  confidence: number;
  count: number;
  createdAt: number;
  updatedAt: number;
}

export interface AggregatedSummary {
  prefix: string;
  nodeCount: number;
  totalMemories: number;
  topContent: { path: string; content: string; confidence: number }[];
}

export interface StoreStats {
  totalNodes: number;
  distinctPaths: number;
  totalMemories: number;
  topPaths: { path: string; count: number }[];
}

// ── Store ───────────────────────────────────────────────────────

class HierarchicalMemoryStoreService {
  private classifier: PatternClassifier = Classifier;
  private isNativeAvailable: boolean = !!PadhVectorDB?.upsertNode;

  // ── Core: Process & Store ───────────────────────────────────

  /**
   * Process a conversation exchange and store extracted knowledge.
   * This is the main entry point — called after every user message.
   *
   * Memoir equivalent: ProllyTreeMemoryStoreManager.store_memory()
   *
   * @param userMessage   Raw user message text
   * @param aiResponse    AI response text (currently unused, reserved for future)
   * @param currentTopic  Optional current topic for session context
   */
  async processExchange(
    userMessage: string,
    _aiResponse: string,
    currentTopic?: string,
  ): Promise<ClassificationResult[]> {
    if (!this.isNativeAvailable) {
      console.warn('[HierarchicalStore] Native module not available, skipping');
      return [];
    }

    try {
      // 1. Classify the user message into taxonomy paths
      const classifications = this.classifier.classify(userMessage, currentTopic);

      if (classifications.length === 0) {
        return [];
      }

      console.log(
        `[HierarchicalStore] Classified ${classifications.length} paths:`,
        classifications.map(c => `${c.path}(${c.confidence.toFixed(2)})`).join(', '),
      );

      // 2. Store each classified memory at its path
      for (const { path, value, confidence } of classifications) {
        // Validate path against taxonomy (or find closest ancestor)
        const validPath = TaxonomyTree.isValidPath(path)
          ? path
          : TaxonomyTree.getClosestPath(path) || 'student.progress.general';

        await PadhVectorDB.upsertNode(validPath, value, confidence);
      }

      // 3. Check if any nodes need condensing (aggregation)
      await this.maybeCondense(classifications.map(c => c.path));

      return classifications;
    } catch (e) {
      console.error('[HierarchicalStore] processExchange failed:', e);
      return [];
    }
  }

  /**
   * Add pre-extracted facts directly to the hierarchical store.
   * Maps legacy SemanticMemory categories to taxonomy paths.
   */
  async addFacts(facts: { text: string; category: string; confidence: number }[]): Promise<void> {
    if (!this.isNativeAvailable) return;
    try {
      for (const fact of facts) {
        let path = 'student.progress.general';
        if (fact.category === 'personal') path = 'student.identity';
        else if (fact.category === 'preferences') path = 'student.preferences';
        else if (fact.category === 'goals') path = 'student.goals';
        else if (fact.category === 'struggles') path = 'student.performance.weakness';
        else if (fact.category === 'academic') path = 'student.progress.general';
        
        await PadhVectorDB.upsertNode(path, fact.text, fact.confidence);
      }
    } catch (e) {
      console.error('[HierarchicalStore] addFacts failed:', e);
    }
  }

  // ── Aggregation (Memoir's core pattern) ─────────────────────

  /**
   * Check if any paths need condensing and trigger if so.
   * A node is condensed when its memory count exceeds the
   * taxonomy-defined maxEntries threshold.
   *
   * Memoir equivalent: AggregatedMemory pattern in prolly_adapter.py
   */
  private async maybeCondense(paths: string[]): Promise<void> {
    const uniquePaths = [...new Set(paths)];

    for (const path of uniquePaths) {
      try {
        const meta = TaxonomyTree.getMeta(path);
        const node = await this.getByPath(path);

        if (node && node.count > meta.maxEntries) {
          console.log(
            `[HierarchicalStore] Condensing ${path}: ${node.count} > ${meta.maxEntries}`,
          );
          // Keep the latest 3 entries, condense the rest
          await PadhVectorDB.condenseNode(path, 3);
        }
      } catch (e) {
        console.warn(`[HierarchicalStore] Condense check failed for ${path}:`, e);
      }
    }
  }

  // ── Retrieval ─────────────────────────────────────────────────

  /**
   * Get all memory nodes under a path prefix.
   *
   * Memoir equivalent: ProllyTreeStore.search() with namespace prefix
   */
  async getByPrefix(prefix: string, limit: number = 20): Promise<MemoryNode[]> {
    if (!this.isNativeAvailable) return [];
    try {
      const results = await PadhVectorDB.getByPrefix(prefix, limit);
      return results || [];
    } catch (e) {
      console.error(`[HierarchicalStore] getByPrefix(${prefix}) failed:`, e);
      return [];
    }
  }

  /**
   * Get a single node at an exact path.
   *
   * Memoir equivalent: ProllyTreeStore.get()
   */
  async getByPath(path: string): Promise<MemoryNode | null> {
    if (!this.isNativeAvailable) return null;
    try {
      return await PadhVectorDB.getByPath(path);
    } catch (e) {
      console.error(`[HierarchicalStore] getByPath(${path}) failed:`, e);
      return null;
    }
  }

  /**
   * Get relevant context for the current conversation topic.
   *
   * THIS IS THE KEY IMPROVEMENT over SemanticMemory.getRelevantContext():
   *   - Old: scans ALL facts, builds one state vector (~200 tokens)
   *   - New: queries ONLY the relevant subtree paths (~50 tokens)
   *
   * Memoir equivalent: IntelligentSearchEngine.search()
   *   (but without LLM path selection — uses topic-based prefix mapping)
   *
   * @param topic         Current conversation topic (e.g., "Newton's Laws")
   * @param maxTokens     Approximate token budget for the state vector
   * @returns             Compact state string for LLM context injection
   */
  async getContextForTopic(topic: string, maxTokens: number = 60): Promise<string> {
    if (!this.isNativeAvailable) return '';

    try {
      // Determine which taxonomy subtrees are relevant
      const prefixes = this.getRelevantPrefixes(topic);

      // Query only those subtrees
      const allNodes: MemoryNode[] = [];
      for (const prefix of prefixes) {
        const nodes = await this.getByPrefix(prefix, 10);
        allNodes.push(...nodes);
      }

      if (allNodes.length === 0) return '';

      // Build compact state vector
      return this.buildStateVector(allNodes, maxTokens);
    } catch (e) {
      console.error('[HierarchicalStore] getContextForTopic failed:', e);
      return '';
    }
  }

  /**
   * Determine which taxonomy prefixes are relevant for a topic.
   * This is our on-device replacement for memoir's LLM-powered
   * IntelligentSearchEngine path selection.
   */
  private getRelevantPrefixes(topic: string): string[] {
    const prefixes: string[] = [];

    // Always include identity (tiny, <10 tokens)
    prefixes.push('student.identity');

    // Map topic to subject progress paths
    const subjectPath = this.classifier.topicToPath(topic);
    if (subjectPath) {
      prefixes.push(subjectPath);
    }

    // Always include preferences and goals (small nodes)
    prefixes.push('student.preferences');
    prefixes.push('student.goals');

    // Include performance if discussing struggles/strengths
    const lower = topic.toLowerCase();
    if (lower.includes('weak') || lower.includes('strong') || lower.includes('improve')) {
      prefixes.push('student.performance');
    }

    return [...new Set(prefixes)]; // deduplicate
  }

  /**
   * Build a compact state vector from memory nodes.
   * Targets ~30-60 tokens for minimal context footprint.
   *
   * Output format: STATE: {"name":"Ajay","grade":"12","subject":"physics.mechanics","goal":"JEE"}
   */
  private buildStateVector(nodes: MemoryNode[], maxTokens: number): string {
    const state: Record<string, string> = {};
    const approxCharsPerToken = 4;
    const maxChars = maxTokens * approxCharsPerToken;
    let totalChars = 0;

    // Sort by confidence (highest first), then by path depth (shallowest first)
    const sorted = [...nodes].sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.path.split('.').length - b.path.split('.').length;
    });

    for (const node of sorted) {
      // Extract a compact key from the path
      const parts = node.path.split('.');
      const key = parts.length <= 2 ? parts[parts.length - 1] : parts.slice(-2).join('_');

      // Use summary if available, otherwise content
      const value = this.truncate(node.summary || node.content, 40);

      // Check budget
      const entryChars = key.length + value.length + 5; // ":"," overhead
      if (totalChars + entryChars > maxChars) break;

      state[key] = value;
      totalChars += entryChars;
    }

    if (Object.keys(state).length === 0) return '';

    return `STATE: ${JSON.stringify(state)}`;
  }

  // ── Aggregated Summary (for analytics / debugging) ────────────

  /**
   * Get aggregated summary for a taxonomy subtree.
   * Used by the KnowledgeGraph screen and debugging tools.
   */
  async getAggregatedSummary(prefix: string, limit: number = 5): Promise<AggregatedSummary | null> {
    if (!this.isNativeAvailable) return null;
    try {
      return await PadhVectorDB.getAggregatedSummary(prefix, limit);
    } catch (e) {
      console.error(`[HierarchicalStore] getAggregatedSummary(${prefix}) failed:`, e);
      return null;
    }
  }

  // ── Store Stats ───────────────────────────────────────────────

  /**
   * Get store statistics.
   * Memoir equivalent: ProllyTreeStore.get_statistics()
   */
  async getStats(): Promise<StoreStats | null> {
    if (!this.isNativeAvailable) return null;
    try {
      return await PadhVectorDB.getStats();
    } catch (e) {
      console.error('[HierarchicalStore] getStats failed:', e);
      return null;
    }
  }

  // ── Session Management ────────────────────────────────────────

  /**
   * Clear all ephemeral session nodes.
   * Should be called on app restart or session end.
   */
  async clearSession(): Promise<void> {
    if (!this.isNativeAvailable) return;
    try {
      await PadhVectorDB.clearSessionNodes();
      console.log('[HierarchicalStore] Session nodes cleared');
    } catch (e) {
      console.error('[HierarchicalStore] clearSession failed:', e);
    }
  }

  /**
   * Full reset — clear all memory nodes.
   */
  async clearAll(): Promise<void> {
    if (!this.isNativeAvailable) return;
    try {
      await PadhVectorDB.clearAllNodes();
      console.log('[HierarchicalStore] All memory nodes cleared');
    } catch (e) {
      console.error('[HierarchicalStore] clearAll failed:', e);
    }
  }

  // ── FTS Search ────────────────────────────────────────────────

  /**
   * Full-text search across all memory content.
   * Fallback when path-based retrieval isn't specific enough.
   */
  async searchContent(query: string, limit: number = 5): Promise<MemoryNode[]> {
    if (!this.isNativeAvailable) return [];
    if (!query || typeof query !== 'string' || !query.trim()) {
      console.warn('[HierarchicalStore] searchContent received empty or invalid query:', query);
      return [];
    }
    try {
      return await PadhVectorDB.searchContent(query, limit);
    } catch (e) {
      console.error('[HierarchicalStore] searchContent failed:', e);
      return [];
    }
  }

  // ── Utility ───────────────────────────────────────────────────

  private truncate(val: string, maxLen: number): string {
    if (val.length <= maxLen) return val;
    return val.substring(0, maxLen).trim() + '…';
  }
}

/** Singleton instance */
export const HierarchicalStore = new HierarchicalMemoryStoreService();
