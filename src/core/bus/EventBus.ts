/**
 * EventBus - Typed pub/sub system for decoupling modules
 * 
 * Usage:
 *   EventBus.emit('user:message', { text: 'Hello', topic: 'math' });
 *   EventBus.on('user:message', (data) => console.log(data));
 */

export type EventMap = {
  // User interactions
  'user:message': { text: string; topic: string; timestamp: number };
  'ai:response': { text: string; topic: string; duration: number; tokensUsed: number; userMsg?: string; activeSkill?: string };
  
  // Topic management
  'topic:changed': { topic: string; subtopic?: string; reason: string };
  'topic:convergence': { topic: string; progress: number; isConverged: boolean };
  
  // Inference lifecycle
  'inference:start': { priority: 'foreground' | 'background'; estimatedTokens: number };
  'inference:end': { priority: 'foreground' | 'background'; actualTokens: number; duration: number };
  'inference:error': { error: string; priority: 'foreground' | 'background' };
  
  // Memory events
  'memory:updated': { factCount: number; topic: string };
  'memory:retrieved': { facts: number; topic: string };
  
  // Module events
  'module:switch': { from: string; to: string; reason: string };
  'module:suggested': { module: string; confidence: number };
  
  // Resource events
  'resource:generated': { type: string; topic: string; duration: number };
  'resource:paused': { reason: string };
  'resource:resumed': { reason: string };
  
  // System events
  'system:memory:pressure': { level: 'low' | 'medium' | 'high' | 'critical'; usedMB: number };
  'system:thermal:warning': { state: 'nominal' | 'light' | 'moderate' | 'severe' | 'critical'; temp?: number };
  'system:pause': { reason: string };
  'system:resume': { reason: string };
  
  // Chapter/curriculum events
  'chapter:enriched': { chapterId: string; topic?: string; phase?: 'outline' | 'subtopic' | 'complete'; subtopic?: string };
  'syllabus:generated': { topicId: string; chapterCount: number };

  // Core/strategy events
  'core:strategy:changed': { strategy: string };
  
  // LiteRT server events
  'litert:server:started': { status: 'success' | 'error'; message?: string };
  'litert:server:stopped': { reason: string };
};

type EventCallback<K extends keyof EventMap> = (data: EventMap[K]) => void | Promise<void>;

class EventBusService {
  private listeners: Map<keyof EventMap, Set<EventCallback<any>>> = new Map();
  private eventHistory: Array<{ event: keyof EventMap; data: any; timestamp: number }> = [];
  private maxHistorySize = 100;
  private debugMode = false;

  /**
   * Enable debug logging
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Subscribe to an event
   */
  on<K extends keyof EventMap>(event: K, callback: EventCallback<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    if (this.debugMode) {
      console.log(`[EventBus] Subscribed to '${event}'`);
    }
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event (one-time only)
   */
  once<K extends keyof EventMap>(event: K, callback: EventCallback<K>): () => void {
    const wrappedCallback = async (data: EventMap[K]) => {
      this.off(event, wrappedCallback as any);
      await callback(data);
    };
    
    return this.on(event, wrappedCallback as any);
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof EventMap>(event: K, callback: EventCallback<K>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      
      if (this.debugMode) {
        console.log(`[EventBus] Unsubscribed from '${event}'`);
      }
    }
  }

  /**
   * Emit an event
   */
  async emit<K extends keyof EventMap>(event: K, data: EventMap[K]): Promise<void> {
    // Add to history
    this.eventHistory.push({
      event,
      data,
      timestamp: Date.now()
    });
    
    // Trim history if too large
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
    
    if (this.debugMode) {
      console.log(`[EventBus] Emitting '${event}':`, data);
    }
    
    const callbacks = this.listeners.get(event);
    if (!callbacks || callbacks.size === 0) {
      if (this.debugMode) {
        console.log(`[EventBus] No listeners for '${event}'`);
      }
      return;
    }
    
    // Execute all callbacks (async)
    const promises = Array.from(callbacks).map(async (callback) => {
      try {
        await callback(data);
      } catch (error) {
        console.error(`[EventBus] Error in listener for '${event}':`, error);
      }
    });
    
    await Promise.all(promises);
  }

  /**
   * Emit an event synchronously (fire and forget)
   */
  emitSync<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.emit(event, data).catch((error) => {
      console.error(`[EventBus] Error emitting '${event}':`, error);
    });
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event);
      if (this.debugMode) {
        console.log(`[EventBus] Removed all listeners for '${event}'`);
      }
    } else {
      this.listeners.clear();
      if (this.debugMode) {
        console.log('[EventBus] Removed all listeners');
      }
    }
  }

  /**
   * Get event history
   */
  getHistory(event?: keyof EventMap, limit: number = 10): Array<{ event: keyof EventMap; data: any; timestamp: number }> {
    let history = this.eventHistory;
    
    if (event) {
      history = history.filter(h => h.event === event);
    }
    
    return history.slice(-limit);
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: keyof EventMap): number {
    return this.listeners.get(event)?.size || 0;
  }

  /**
   * Get all registered events
   */
  getRegisteredEvents(): Array<keyof EventMap> {
    return Array.from(this.listeners.keys());
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }
}

// Singleton instance
export const EventBus = new EventBusService();

// Enable debug mode in development
if (__DEV__) {
  EventBus.setDebugMode(true);
}
