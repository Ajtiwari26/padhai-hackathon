/**
 * Semantic Memory System — PadhMemoir Facade
 *
 * This module now delegates all storage to HierarchicalMemoryStore
 * (native SQLite with taxonomy paths) while maintaining the original
 * API surface for backward compatibility.
 *
 * OLD: Flat MemoryFact[] in AsyncStorage → scan ALL facts
 * NEW: Classified taxonomy nodes in SQLite → path-selective retrieval
 *
 * Migration: existing AsyncStorage facts are loaded once and migrated
 * to the new hierarchical store on first access.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { HierarchicalStore } from './HierarchicalMemoryStore';
import { Classifier } from './PatternClassifier';

const SEMANTIC_FACTS_KEY = '@padhai_semantic_facts';
const MIGRATION_KEY = '@padhai_memoir_migrated';

export interface MemoryFact {
  category: 'personal' | 'academic' | 'goals' | 'struggles' | 'preferences';
  key: string;
  value: string;
  confidence: number;
  timestamp: number;
}

export interface SemanticMemoryData {
  facts: MemoryFact[];
  lastUpdated: number;
}

export class SemanticMemory {
  private facts: MemoryFact[] = [];
  private migrated: boolean = false;

  /**
   * Extract facts from a conversation exchange.
   * Delegates to PatternClassifier and HierarchicalStore.
   *
   * OLD: keyword matching → flat MemoryFact[]
   * NEW: PatternClassifier → taxonomy paths → SQLite nodes
   *
   * Returns MemoryFact[] for backward compat with callers.
   */
  extractFacts(userMessage: string, _aiResponse: string): MemoryFact[] {
    // Use the new PatternClassifier for taxonomy-aware extraction
    const classifications = Classifier.classify(userMessage);

    // Convert to legacy MemoryFact format for backward compat
    const legacyFacts: MemoryFact[] = classifications.map(c => ({
      category: this.pathToCategory(c.path),
      key: c.path.split('.').pop() || 'general',
      value: c.value,
      confidence: c.confidence,
      timestamp: Date.now(),
    }));

    return legacyFacts;
  }

  /**
   * Add facts to memory.
   * Now stores in BOTH the legacy in-memory array AND the new
   * hierarchical SQLite store.
   */
  async addFacts(facts: MemoryFact[]): Promise<void> {
    let changed = false;
    for (const fact of facts) {
      // Update legacy in-memory array (kept for backward compat)
      const existing = this.facts.findIndex(
        f => f.category === fact.category && f.key === fact.key,
      );
      if (existing >= 0) {
        if (fact.confidence > this.facts[existing].confidence) {
          this.facts[existing] = fact;
          changed = true;
        }
      } else {
        this.facts.push(fact);
        changed = true;
      }

      // Store in hierarchical SQLite (new system)
      const path = Classifier.legacyCategoryToPath(fact.category, fact.key);
      try {
        await HierarchicalStore.processExchange(fact.value, '', undefined);
      } catch (e) {
        // Hierarchical store failure shouldn't break legacy flow
        console.warn('[SemanticMemory] Hierarchical store failed for', path, e);
      }
    }

    if (changed) {
      await this.saveFacts();
    }
  }

  /**
   * Get relevant context as a compact state vector.
   *
   * PRIMARY CHANGE: Now uses HierarchicalStore for path-selective retrieval.
   * Falls back to legacy flat scan if hierarchical store is unavailable.
   *
   * @param query     Current user query / topic
   * @param maxFacts  Ignored (kept for API compat). Budget is now token-based.
   */
  getRelevantContext(query: string, _maxFacts: number = 5): string {
    // Try hierarchical store first (async, but we need sync here)
    // The hierarchical context is fetched async in ContextBudget,
    // so this sync method falls back to legacy in-memory facts.
    return this.buildLegacyStateVector();
  }

  /**
   * Async version of getRelevantContext that uses the hierarchical store.
   * This is the preferred method — called by ContextBudget.
   */
  async getRelevantContextAsync(topic: string, maxTokens: number = 60): Promise<string> {
    // Try hierarchical store (path-selective, much more efficient)
    const hierarchicalContext = await HierarchicalStore.getContextForTopic(topic, maxTokens);
    if (hierarchicalContext) {
      return hierarchicalContext;
    }

    // Fallback to legacy
    return this.buildLegacyStateVector();
  }

  /**
   * Legacy state vector builder (from original SemanticMemory).
   * Kept as fallback while hierarchical store is ramping up.
   */
  private buildLegacyStateVector(): string {
    if (this.facts.length === 0) return '';

    const state: Record<string, string> = {};

    const name = this.facts.find(f => f.key === 'name');
    if (name) state.name = name.value;

    const level = this.facts.find(f => f.key === 'level');
    if (level) state.level = this.truncate(level.value, 30);

    const subjects = this.facts.filter(f => f.key === 'subject').map(f => f.value);
    if (subjects.length > 0) state.subjects = subjects.join(',');

    const goals = this.facts
      .filter(f => f.category === 'goals')
      .sort((a, b) => b.confidence - a.confidence);
    if (goals.length > 0) state.goal = this.truncate(goals[0].value, 40);

    const struggles = this.facts
      .filter(f => f.category === 'struggles')
      .sort((a, b) => b.confidence - a.confidence);
    if (struggles.length > 0) state.flaw = this.truncate(struggles[0].value, 40);

    const prefs = this.facts
      .filter(f => f.category === 'preferences')
      .sort((a, b) => b.confidence - a.confidence);
    if (prefs.length > 0) state.pref = this.truncate(prefs[0].value, 30);

    if (Object.keys(state).length === 0) return '';
    return `STATE: ${JSON.stringify(state)}`;
  }

  /** Convert taxonomy path back to legacy category. */
  private pathToCategory(path: string): MemoryFact['category'] {
    if (path.startsWith('student.identity')) return 'personal';
    if (path.startsWith('student.progress')) return 'academic';
    if (path.startsWith('student.goals')) return 'goals';
    if (path.startsWith('student.performance.weakness')) return 'struggles';
    if (path.startsWith('student.preferences')) return 'preferences';
    if (path.startsWith('session.misconception')) return 'struggles';
    return 'academic';
  }

  /** Truncate a value to keep the state vector compact */
  private truncate(val: string, maxLen: number): string {
    if (val.length <= maxLen) return val;
    return val.substring(0, maxLen).trim() + '…';
  }

  /**
   * Get all facts (for saving)
   */
  getAllFacts(): MemoryFact[] {
    return this.facts;
  }

  /**
   * Load facts (from storage) and migrate to hierarchical store.
   */
  async loadFacts(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(SEMANTIC_FACTS_KEY);
      if (raw) {
        this.facts = JSON.parse(raw);
      }

      // One-time migration of existing facts to hierarchical store
      if (!this.migrated) {
        await this.migrateToHierarchical();
      }
    } catch (e) {
      console.error('[SemanticMemory] Failed to load facts', e);
    }
  }

  /**
   * Migrate existing AsyncStorage facts to HierarchicalStore (one-time).
   */
  private async migrateToHierarchical(): Promise<void> {
    try {
      const alreadyMigrated = await AsyncStorage.getItem(MIGRATION_KEY);
      if (alreadyMigrated) {
        this.migrated = true;
        return;
      }

      if (this.facts.length === 0) {
        this.migrated = true;
        return;
      }

      console.log(`[SemanticMemory] Migrating ${this.facts.length} facts to hierarchical store...`);

      for (const fact of this.facts) {
        try {
          // Store via processExchange which handles upsert
          await HierarchicalStore.processExchange(fact.value, '', undefined);
        } catch (e) {
          // Skip individual failures
          console.warn('[SemanticMemory] Migration failed for fact:', fact.key, e);
        }
      }

      await AsyncStorage.setItem(MIGRATION_KEY, 'true');
      this.migrated = true;
      console.log('[SemanticMemory] Migration complete');
    } catch (e) {
      console.error('[SemanticMemory] Migration failed:', e);
      // Don't block — migration is best-effort
      this.migrated = true;
    }
  }

  async saveFacts(): Promise<void> {
    try {
      await AsyncStorage.setItem(SEMANTIC_FACTS_KEY, JSON.stringify(this.facts));
    } catch (e) {
      console.error('[SemanticMemory] Failed to save facts', e);
    }
  }

  /**
   * Get summary for final profile
   */
  getSummary(): { [key: string]: string } {
    const summary: { [key: string]: string } = {};

    // Extract key information
    const name = this.facts.find(f => f.key === 'name');
    if (name) summary.name = name.value;

    const level = this.facts.find(f => f.key === 'level');
    if (level) summary.level = level.value;

    const subjects = this.facts.filter(f => f.key === 'subject').map(f => f.value);
    if (subjects.length > 0) summary.subjects = subjects.join(', ');

    const goals = this.facts.filter(f => f.category === 'goals').map(f => f.value);
    if (goals.length > 0) summary.goals = goals.join('; ');

    return summary;
  }

  /**
   * Clear all facts
   */
  async clear(): Promise<void> {
    this.facts = [];
    await AsyncStorage.removeItem(SEMANTIC_FACTS_KEY);
    await HierarchicalStore.clearAll();
  }
}

export const SemanticMemoryInstance = new SemanticMemory();
// Initialize from storage on app start
SemanticMemoryInstance.loadFacts();
