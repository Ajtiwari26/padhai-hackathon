import { LocalServerManager } from './LocalServerManager';
import { ToolRegistry } from '../skills/ToolRegistry';
import { NativeModules } from 'react-native';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ModelResponse {
  message: ChatMessage;
  rawResponse: any;
}

const CAVEMAN_SYSTEM_PROMPT = `
[CAVEMAN MODE ACTIVATED]
Talk like a caveman. Use minimal tokens. 
- Drop filler words (a, an, the, that, which).
- Use telegraphic style.
- Keep technical accuracy.
- Maximize information density.
Example: "The model is currently loading" -> "Model loading".
`;

class ModelManagerService {
  private localCircuitBroken = false;
  private activeControllers: Set<{controller: AbortController, priority: 'foreground' | 'background'}> = new Set();
  private portLocks: Map<number, Promise<void>> = new Map();
  private memoryCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Get lock for a specific port to prevent concurrent inference calls
   * which cause empty responses or crashes in single-threaded engines.
   */
  private async acquirePortLock(port: number): Promise<() => void> {
    while (this.portLocks.has(port)) {
      await this.portLocks.get(port);
    }
    
    let resolveLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    
    this.portLocks.set(port, lockPromise);
    
    return () => {
      if (this.portLocks.get(port) === lockPromise) {
        this.portLocks.delete(port);
      }
      resolveLock();
    };
  }

  public async boot() {
    await LocalServerManager.initialize();
    this.localCircuitBroken = false;
    
    // Start memory monitoring
    this.startMemoryMonitoring();
  }

  /**
   * Monitor memory every 10 seconds and take action if pressure is high
   */
  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(async () => {
      await this.checkMemoryPressure();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Check memory and take action if pressure is high
   */
  private async checkMemoryPressure(): Promise<void> {
    try {
      const memoryInfo = await NativeModules.PadhMemoryMonitor?.getMemoryInfo();
      
      if (!memoryInfo) {
        return; // Module not available
      }
      
      const { usedMemory, totalMemory, availableMemory } = memoryInfo;
      const memoryPressure = usedMemory / totalMemory;
      
      console.log(`[ModelManager] Memory: ${(usedMemory / 1024 / 1024).toFixed(0)}MB / ${(totalMemory / 1024 / 1024).toFixed(0)}MB (${(memoryPressure * 100).toFixed(1)}%)`);
      
      if (memoryPressure > 0.85) {
        console.error('[ModelManager] 🔴 CRITICAL MEMORY PRESSURE:', memoryPressure);
        await this.emergencyMemoryCleanup();
      } else if (memoryPressure > 0.75) {
        console.warn('[ModelManager] 🟡 HIGH MEMORY PRESSURE:', memoryPressure);
        await this.preventiveMemoryCleanup();
      }
    } catch (e) {
      console.error('[ModelManager] Memory check failed:', e);
    }
  }

  /**
   * Emergency cleanup when memory is critical
   */
  private async emergencyMemoryCleanup(): Promise<void> {
    console.log('[ModelManager] 🚨 EMERGENCY MEMORY CLEANUP');
    
    // 1. Abort all background tasks
    for (const item of this.activeControllers) {
      if (item.priority === 'background') {
        console.log('[ModelManager] Aborting background task');
        item.controller.abort();
        this.activeControllers.delete(item);
      }
    }
    
    // 2. Force garbage collection (if available)
    if (global.gc) {
      console.log('[ModelManager] Forcing garbage collection');
      global.gc();
    }
    
    // 3. Clear port locks (release any stuck locks)
    this.portLocks.clear();
    
    // 4. Reset model cache
    try {
      await LocalServerManager.resetCache();
      console.log('[ModelManager] Model cache reset');
    } catch (e) {
      console.error('[ModelManager] Failed to reset cache:', e);
    }
  }

  /**
   * Preventive cleanup when memory is high
   */
  private async preventiveMemoryCleanup(): Promise<void> {
    console.log('[ModelManager] 🟡 PREVENTIVE MEMORY CLEANUP');
    
    // Abort low-priority background tasks only
    for (const item of this.activeControllers) {
      if (item.priority === 'background') {
        item.controller.abort();
        this.activeControllers.delete(item);
      }
    }
  }

  /**
   * Stop monitoring on shutdown
   */
  public shutdown(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  /**
   * Check thermal state before inference
   */
  private async checkThermalState(): Promise<void> {
    try {
      const thermal = await NativeModules.PadhThermalMonitor?.getThermalState();
      
      if (!thermal) return;
      
      console.log(`[ModelManager] Thermal: ${thermal.state} (headroom: ${(thermal.headroom * 100).toFixed(0)}%)`);
      
      if (thermal.state === 'critical') {
        throw new Error('Device too hot. Please wait for it to cool down.');
      }
      
      if (thermal.state === 'severe') {
        console.warn('[ModelManager] 🔥 Severe thermal state, reducing max tokens');
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('too hot')) {
        throw e;
      }
      console.error('[ModelManager] Thermal check failed:', e);
    }
  }

  /**
   * Simple non-streaming wrapper for single prompt generation
   */
  public async generate(
    prompt: string,
    priority: 'foreground' | 'background' = 'foreground',
    portOverride?: number,
    maxOutputTokens?: number,
    includeTools: boolean = true,
    signal?: AbortSignal,
    caveman: boolean = false
  ): Promise<string> {
    console.log(`[ModelManager] Starting generate(). Prompt: ${prompt.length}, Priority: ${priority}, Port: ${portOverride || 'default'}, Tools: ${includeTools}, Caveman: ${caveman}`);
    const result = await this.streamChat(
      [{ role: 'user', content: prompt }],
      () => {},
      signal,
      priority,
      portOverride,
      maxOutputTokens,
      includeTools,
      caveman
    );
    console.log('[ModelManager] generate() completed successfully. Output length:', result.length);
    return result;
  }

  /**
   * Streaming chat specifically routed to the Native LiteRT engine.
   * This handles parsing SSE chunks from the native loopback or native events.
   */
  public async streamChat(
    messages: ChatMessage[],
    onToken: (delta: string) => void,
    signal?: AbortSignal,
    priority: 'foreground' | 'background' = 'foreground',
    portOverride?: number,
    maxOutputTokensOverride?: number,
    includeTools: boolean = true,
    caveman: boolean = false
  ): Promise<string> {
    console.log(`[ModelManager] streamChat() called. Priority: ${priority}, Messages: ${messages.length}, Port: ${portOverride || 'default'}, Tools: ${includeTools}, Caveman: ${caveman}`);
    
    // Record activity to prevent auto-pause
    LocalServerManager.recordActivity();
    
    // Check thermal state before inference
    await this.checkThermalState();
    
    // Override background tasks if this is a foreground request
    if (priority === 'foreground') {
      for (const item of this.activeControllers) {
        if (item.priority === 'background') {
          console.log('[ModelManager] Aborting background task to prioritize foreground chat.');
          item.controller.abort();
          this.activeControllers.delete(item);
        }
      }
    }
    const localConfig = (await LocalServerManager.getConfig()) as any;
    console.log('[ModelManager] Local config loaded:', localConfig.enabled, localConfig.modelId);

    if (!localConfig.enabled) {
      console.warn('[ModelManager] Local AI disabled in settings');
      throw new Error("Local AI is currently disabled in Settings.");
    }

    let isReady = await LocalServerManager.isRunning();
    console.log('[ModelManager] Local server isReady initially:', isReady);
    
    // Auto-wake local server if it went to sleep
    if (!isReady) {
      console.log("[ModelManager] Waking local inference engine...");
      try {
        await LocalServerManager.startServer(localConfig);
        console.log('[ModelManager] startServer called, waiting 3 seconds...');
        await new Promise<void>(r => setTimeout(() => r(), 3000));
        isReady = await LocalServerManager.isRunning();
        console.log('[ModelManager] Local server isReady after wake:', isReady);
      } catch (e) {
        console.error("[ModelManager] Local Server failed to wake up:", e);
        throw new Error("Failed to start local AI engine.");
      }
    }

    if (!isReady) {
      console.error("[ModelManager] Local AI engine is not responding.");
      throw new Error("Local AI engine is not responding.");
    }

    // Apply Socratic system prompt + Window Size filtering
    // (Window slicing is now handled upstream by ContextBudgetManager)
    const port = portOverride || localConfig.port || 8080;
    const releaseLock = await this.acquirePortLock(port);
    
    try {
      return await this._streamChatInternal(
        messages,
        onToken,
        port,
        localConfig,
        signal,
        priority,
        maxOutputTokensOverride,
        includeTools,
        caveman
      );
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(`[ModelManager] streamChat error on port ${port}:`, errorMsg);
      throw e;
    } finally {
      releaseLock();
    }
  }

  /**
   * Internal implementation of streamChat that assumes the port lock is already held.
   * This is used for recursive tool calls to avoid deadlocking.
   */
  private async _streamChatInternal(
    messages: ChatMessage[],
    onToken: (delta: string) => void,
    port: number,
    localConfig: any,
    signal?: AbortSignal,
    priority: 'foreground' | 'background' = 'foreground',
    maxOutputTokensOverride?: number,
    includeTools: boolean = true,
    caveman: boolean = false
  ): Promise<string> {
    try {
      let finalMessages = [...messages];
      
      if (caveman) {
        finalMessages.unshift({ role: 'system', content: CAVEMAN_SYSTEM_PROMPT });
      }
      const endpoint = `http://127.0.0.1:${port}/v1/chat/completions`;
        
      // Dynamic max_tokens based on config
      let dynamicMaxTokens = localConfig.maxOutputTokens || 4096;
      if (dynamicMaxTokens === -1 || isNaN(dynamicMaxTokens)) {
        // Let the model decide, but cap at reasonable limit
        dynamicMaxTokens = 4096;
      }

      // SAFETY: Estimate total input tokens and enforce hard ceiling
      const safeInputLimit = (localConfig.maxTokens || 8192) - dynamicMaxTokens;
      const MAX_SAFE_INPUT_TOKENS = Math.max(safeInputLimit, 2048); // Ensure at least some room
      
      const estimateTokens = (text: string) => Math.ceil((text || '').length / 4);
      const totalInputTokens = finalMessages.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0);
      
      if (totalInputTokens > MAX_SAFE_INPUT_TOKENS) {
        console.warn(`[ModelManager] ⚠️ Input tokens (${totalInputTokens}) exceed safe limit (${MAX_SAFE_INPUT_TOKENS}). Trimming history.`);
        while (finalMessages.length > 2) {
          const newTotal = finalMessages.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0);
          if (newTotal <= MAX_SAFE_INPUT_TOKENS) break;
          finalMessages.splice(1, 1);
        }
      }
      
      if (maxOutputTokensOverride && maxOutputTokensOverride > 0) {
        dynamicMaxTokens = Math.min(dynamicMaxTokens, maxOutputTokensOverride);
      }

      const payload: any = {
        model: localConfig.modelId || 'gemma-4-E2B-it.litertlm',
        messages: finalMessages,
        temperature: localConfig.temperature ?? 0.2,
        top_p: localConfig.topP || 0.95,
        max_tokens: Math.floor(dynamicMaxTokens),
        stream: true,
      };

      if (includeTools) {
        payload.tools = Object.entries(ToolRegistry).map(([name]) => ({
          type: 'function',
          function: {
            name,
            description: `Execute ${name} skill`,
          }
        }));
      }

      const fetchController = new AbortController();
      const abortHandler = () => fetchController.abort();
      if (signal) signal.addEventListener('abort', abortHandler);
      
      const activeItem = { controller: fetchController, priority };
      this.activeControllers.add(activeItem);

      // Add a safety timeout for the fetch itself (150s for foreground, 120s for background)
      const timeoutMs = priority === 'foreground' ? 150000 : 120000;
      const fetchTimeout = setTimeout(() => {
        console.warn(`[ModelManager] Fetch timeout after ${timeoutMs / 1000}s for ${priority} task`);
        fetchController.abort();
      }, timeoutMs);

      try {
        let fullText = '';
        let sseBuffer = '';

        const processSSEChunk = async (chunk: string) => {
          sseBuffer += chunk;
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const choice = parsed.choices?.[0];
              const delta = choice?.delta;

              if (delta?.tool_calls) {
                const toolCalls = delta.tool_calls;
                const toolMessages: ChatMessage[] = [];
                for (const call of toolCalls) {
                  const name = call.function.name;
                  const args = JSON.parse(call.function.arguments || '{}');
                  const result = await (ToolRegistry as any)[name]?.(args) || 'Error: Tool not found';
                  toolMessages.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    name: name,
                    content: typeof result === 'string' ? result : JSON.stringify(result)
                  });
                }
                fullText = await this._streamChatInternal(
                  [...messages, { role: 'assistant', content: null, tool_calls: toolCalls }, ...toolMessages],
                  onToken,
                  port,
                  localConfig,
                  signal,
                  priority,
                  maxOutputTokensOverride,
                  includeTools,
                  caveman  // ✅ FIXED: Pass caveman flag through recursion
                );
                return;
              }

              const content = delta?.content ?? null;
              if (content !== null) {
                fullText += content;
                onToken(content);
                await new Promise(r => setTimeout(() => r(null), 2));
              }
            } catch {
              console.error('[ModelManager] Error parsing SSE data');
            }
          }
        };

        let attempt = 0;
        const maxAttempts = 3;

        while (attempt < maxAttempts) {
          attempt++;
          const startTime = Date.now();
          
          try {
            console.log(`[ModelManager] 🚀 Attempt ${attempt}/${maxAttempts} (${priority}) -> ${endpoint}`);
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: fetchController.signal,
              // @ts-ignore
              reactNative: { textStreaming: true },
            });

            // Once we get a response, clear the fetch connection timeout
            clearTimeout(fetchTimeout);

            if (!response.ok) {
              const errText = await response.text().catch(() => String(response.status));
              if (attempt < maxAttempts) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise<void>(r => setTimeout(() => r(), delay));
                continue;
              }
              throw new Error(`Inference Error ${response.status}: ${errText}`);
            }

            const respAny = response as any;
            if (respAny.body && typeof respAny.body.getReader === 'function') {
              const reader = respAny.body.getReader();
              const decoder = new (globalThis as any).TextDecoder();

              while (true) {
                if (signal?.aborted) {
                  reader.cancel();
                  throw new Error('AbortError');
                }
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
                await processSSEChunk(chunk);
              }

              if (sseBuffer.trim()) await processSSEChunk('\n');
              if (!fullText.trim()) throw new Error("Empty response from model");

              console.log(`[ModelManager] ✅ Complete. Duration: ${Date.now() - startTime}ms`);
              return fullText;
            }

            const rawText = await response.text();
            if (!rawText.trim() && attempt < maxAttempts) continue;
            
            if (rawText.includes('data: ')) {
              await processSSEChunk(rawText + '\n');
            } else {
              try {
                const j = JSON.parse(rawText);
                fullText = j.choices?.[0]?.message?.content ?? rawText;
                onToken(fullText);
              } catch (e) {
                fullText = rawText;
                onToken(rawText);
              }
            }
            return fullText;

          } catch (e: any) {
            clearTimeout(fetchTimeout); // Ensure timeout is cleared on catch
            if (e.name === 'AbortError' || e.message === 'AbortError') throw e;
            console.error(`[ModelManager] Attempt ${attempt} failed:`, e.message);
            if (attempt < maxAttempts) {
              await new Promise<void>(r => setTimeout(() => r(), Math.pow(2, attempt) * 1000));
              continue;
            }
            throw e;
          }
        }
        throw new Error("Max retries exceeded");
      } finally {
        clearTimeout(fetchTimeout);
        if (signal) signal.removeEventListener('abort', abortHandler);
        this.activeControllers.delete(activeItem);
      }
    } catch (e) {
      console.error("[ModelManager] Internal stream error:", e);
      throw e;
    }
  }
}

export const ModelManager = new ModelManagerService();
