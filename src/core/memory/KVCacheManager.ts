import { ContextBudget } from './ContextBudget';

export interface KVCacheChunk {
  id: string;
  tokens: number;
  content: string;
  importance: number; // Simulated attention score or priority
}

export class KVCacheManager {
  private cache: KVCacheChunk[] = [];
  private totalTokens = 0;
  private readonly compressionThreshold = 8192; // 8K tokens
  private readonly recentTokensLimit = 2048; // Keep recent 2K tokens uncompressed

  /**
   * Adds a new chunk to the cache.
   */
  public addChunk(content: string, importance: number = 1.0) {
    const tokens = ContextBudget.estimateTokens(content);
    const chunk: KVCacheChunk = {
      id: Math.random().toString(36).substring(7),
      tokens,
      content,
      importance,
    };
    this.cache.push(chunk);
    this.totalTokens += tokens;

    console.log(`[KVCache] Added chunk ${chunk.id} with ${tokens} tokens. Total: ${this.totalTokens}`);
    
    // Check if we need to compress
    this.checkAndCompress();
  }

  /**
   * Adds a message to the KV cache by treating it as a chunk.
   */
  public async addMessage(message: { id: string, role: string, content: string, timestamp: number }) {
    // Determine importance based on role
    const importance = message.role === 'ai' ? 1.5 : 1.0;
    this.addChunk(message.content, importance);
  }

  /**
   * Checks if the cache exceeds the threshold and triggers compression.
   */
  private checkAndCompress() {
    if (this.totalTokens > this.compressionThreshold) {
      console.log(`[KVCache] Threshold exceeded (${this.totalTokens} > ${this.compressionThreshold}). Compressing...`);
      this.compress();
    }
  }

  /**
   * Compresses old chunks based on importance (simulated attention score).
   */
  private compress() {
    // Separate recent context from old context
    let currentTokens = 0;
    const recentChunks: KVCacheChunk[] = [];
    const oldChunks: KVCacheChunk[] = [];

    // Iterate from newest to oldest
    for (let i = this.cache.length - 1; i >= 0; i--) {
      const chunk = this.cache[i];
      if (currentTokens < this.recentTokensLimit) {
        recentChunks.unshift(chunk);
        currentTokens += chunk.tokens;
      } else {
        oldChunks.unshift(chunk);
      }
    }

    if (oldChunks.length === 0) {
      console.log('[KVCache] No old chunks to compress.');
      return;
    }

    // Sort old chunks by importance (simulated attention score)
    // Higher importance first
    oldChunks.sort((a, b) => b.importance - a.importance);

    // Keep top 70% of old context based on importance
    const targetOldTokens = Math.floor(this.totalTokensOf(oldChunks) * 0.7);
    let keptOldTokens = 0;
    const keptOldChunks: KVCacheChunk[] = [];

    for (const chunk of oldChunks) {
      if (keptOldTokens + chunk.tokens <= targetOldTokens) {
        keptOldChunks.push(chunk);
        keptOldTokens += chunk.tokens;
      } else {
        console.log(`[KVCache] Dropping chunk ${chunk.id} due to low importance.`);
      }
    }

    // Rebuild cache
    this.cache = [...keptOldChunks, ...recentChunks];
    this.totalTokens = this.totalTokensOf(this.cache);
    console.log(`[KVCache] Compression complete. New total tokens: ${this.totalTokens}`);
  }

  /**
   * Helper to calculate total tokens in a list of chunks.
   */
  private totalTokensOf(chunks: KVCacheChunk[]): number {
    return chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
  }

  /**
   * Public method to manually trigger compression based on external memory pressure signal.
   */
  public handleMemoryPressure(pressure: number) {
    console.log(`[KVCache] Received memory pressure signal: ${pressure}`);
    if (pressure > 0.8) {
      console.log('[KVCache] High memory pressure. Aggressive compression.');
      // More aggressive compression: keep only 50% of old context
      this.compressWithRatio(0.5);
    }
  }

  private compressWithRatio(ratio: number) {
    let currentTokens = 0;
    const recentChunks: KVCacheChunk[] = [];
    const oldChunks: KVCacheChunk[] = [];

    for (let i = this.cache.length - 1; i >= 0; i--) {
      const chunk = this.cache[i];
      if (currentTokens < this.recentTokensLimit) {
        recentChunks.unshift(chunk);
        currentTokens += chunk.tokens;
      } else {
        oldChunks.unshift(chunk);
      }
    }

    if (oldChunks.length === 0) return;

    oldChunks.sort((a, b) => b.importance - a.importance);

    const targetOldTokens = Math.floor(this.totalTokensOf(oldChunks) * ratio);
    let keptOldTokens = 0;
    const keptOldChunks: KVCacheChunk[] = [];

    for (const chunk of oldChunks) {
      if (keptOldTokens + chunk.tokens <= targetOldTokens) {
        keptOldChunks.push(chunk);
        keptOldTokens += chunk.tokens;
      }
    }

    this.cache = [...keptOldChunks, ...recentChunks];
    this.totalTokens = this.totalTokensOf(this.cache);
    console.log(`[KVCache] Aggressive compression complete. New total tokens: ${this.totalTokens}`);
  }

  public getCacheContent(): string {
    return this.cache.map(c => c.content).join('\n');
  }
}

export const KVCache = new KVCacheManager();
