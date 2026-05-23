import { LocalServerManager, USE_DIRECT_LITERT } from './LocalServerManager';
import { ToolRegistry } from '../skills/ToolRegistry';
import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventBus } from '../bus/EventBus';
import { KVCache } from '../memory/KVCacheManager';
import { CoreSelector } from '../system/CoreSelector';

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
  private memoryCheckInterval: ReturnType<typeof setTimeout> | null = null;
  private directEngineLoaded = false; // Track if direct engine is loaded

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
    
    // Start core selector monitoring
    if (CoreSelector.isAvailable()) {
      await CoreSelector.startMonitoring();
      console.log('[ModelManager] Core selector initialized');
    }
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
      
      const { usedMemory, totalMemory } = memoryInfo;
      const memoryPressure = usedMemory / totalMemory;
      
      console.log(`[ModelManager] Memory: ${(usedMemory / 1024 / 1024).toFixed(0)}MB / ${(totalMemory / 1024 / 1024).toFixed(0)}MB (${(memoryPressure * 100).toFixed(1)}%)`);
      
      // Emit memory pressure event
      let level: 'low' | 'medium' | 'high' | 'critical';
      if (memoryPressure > 0.85) {
        level = 'critical';
      } else if (memoryPressure > 0.75) {
        level = 'high';
      } else if (memoryPressure > 0.60) {
        level = 'medium';
      } else {
        level = 'low';
      }
      
      if (level !== 'low') {
        EventBus.emitSync('system:memory:pressure', {
          level,
          usedMB: Math.round(usedMemory / 1024 / 1024)
        });
      }
      
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
    if ((globalThis as any).gc) {
      console.log('[ModelManager] Forcing garbage collection');
      (globalThis as any).gc();
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
  private async checkThermalState(): Promise<{ reduceTokens: boolean }> {
    try {
      const thermal = await NativeModules.PadhThermalMonitor?.getThermalState();
      
      if (!thermal) return { reduceTokens: false };
      
      // Fix: Check if headroom exists and is a valid number
      const headroom = (thermal.headroom !== undefined && !isNaN(thermal.headroom)) 
        ? thermal.headroom 
        : 0.8; // Default to 80% if undefined
      
      // Determine actual thermal state based on headroom value, not native state string
      let actualState: 'critical' | 'nominal' | 'light' | 'moderate' | 'severe' = 'nominal';
      if (headroom < 0.2) {
        actualState = 'critical';
      } else if (headroom < 0.4) {
        actualState = 'severe';
      } else if (headroom < 0.6) {
        actualState = 'moderate';
      } else if (headroom < 0.8) {
        actualState = 'light';
      }
      
      console.log(`[ModelManager] Thermal: ${actualState} (headroom: ${(headroom * 100).toFixed(0)}%)`);
      
      // Emit thermal warning event
      if (actualState !== 'nominal') {
        EventBus.emitSync('system:thermal:warning', {
          state: actualState,
          temp: thermal.temperature
        });
      }
      
      if (actualState === 'critical') {
        throw new Error('Device too hot. Please wait for it to cool down.');
      }
      
      if (actualState === 'severe') {
        console.warn('[ModelManager] 🔥 Severe thermal state, reducing max tokens and switching to efficiency cores');
        try {
          await NativeModules.PadhLocalServer?.setCorePriority('efficiency');
        } catch (e) {
          console.error('[ModelManager] Failed to set core priority:', e);
        }
        return { reduceTokens: true };
      }
      
      // Restore priority if nominal
      if (actualState === 'nominal') {
        try {
          await NativeModules.PadhLocalServer?.setCorePriority('performance');
        } catch (e) {
          console.error('[ModelManager] Failed to set core priority:', e);
        }
      }
      
      return { reduceTokens: false };
    } catch (e) {
      if (e instanceof Error && e.message.includes('too hot')) {
        throw e;
      }
      console.error('[ModelManager] Thermal check failed:', e);
      return { reduceTokens: false };
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
    
    // Record activity to prevent auto-pause
    LocalServerManager.recordActivity();
    
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
   * Execute a tool call and return the result
   */
  private async executeTool(toolCall: ToolCall): Promise<any> {
    try {
      const { name, arguments: argsStr } = toolCall.function;
      const args = JSON.parse(argsStr);
      
      console.log(`[ModelManager] Executing tool: ${name} with args:`, args);
      
      // Get tool from registry
      const tool = ToolRegistry.getTool(name);
      if (!tool) {
        console.error(`[ModelManager] Tool not found: ${name}`);
        return { error: `Tool ${name} not found` };
      }
      
      // Execute tool directly (it's already a function)
      const result = await tool(args);
      console.log(`[ModelManager] Tool ${name} executed successfully`);
      return result;
    } catch (error) {
      console.error('[ModelManager] Tool execution error:', error);
      return { error: String(error) };
    }
  }

  /**
   * Summarizes history using the model in caveman mode.
   */
  private async summarizeHistory(messages: ChatMessage[]): Promise<string> {
    const summaryPrompt = `Summarize this conversation briefly, focusing on key facts and decisions. Use caveman style (short, no filler words).\n\n` +
      messages.map(m => `${m.role}: ${m.content}`).join('\n');

    try {
      const summary = await this.generate(
        summaryPrompt,
        'background',
        undefined,
        512,
        false, // No tools
        undefined,
        true // Caveman
      );
      return summary;
    } catch (error) {
      console.error('[ModelManager] Failed to summarize history:', error);
      return 'Summary failed.';
    }
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
    const normalizedMessages = messages.map(m => ({
      ...m,
      role: (m.role as string) === 'ai' ? 'assistant' : m.role
    }));

    console.log(`[ModelManager] streamChat() called. Priority: ${priority}, Messages: ${normalizedMessages.length}, Port: ${portOverride || 'default'}, Tools: ${includeTools}, Caveman: ${caveman}`);
    
    // Record activity to prevent auto-pause (CRITICAL: Do this FIRST)
    LocalServerManager.recordActivity();
    
    // Estimate tokens for event
    const estimatedTokens = normalizedMessages.reduce((sum, m) => sum + Math.ceil((m.content || '').length / 4), 0);
    
    // Emit inference start event
    EventBus.emitSync('inference:start', {
      priority,
      estimatedTokens
    });
    
    const startTime = Date.now();
    
    try {
      
      // Check thermal state before inference
      const { reduceTokens } = await this.checkThermalState();
      
      let effectiveMaxTokens = maxOutputTokensOverride;
      if (reduceTokens) {
        effectiveMaxTokens = maxOutputTokensOverride ? Math.floor(maxOutputTokensOverride / 2) : 512;
        console.log(`[ModelManager] Throttling: Reducing max tokens to ${effectiveMaxTokens}`);
      }
      
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
      console.log('[ModelManager] Local config loaded:', localConfig.enabled, localConfig.modelId, 'useCloud:', localConfig.useCloud);

      if (localConfig.useCloud) {
        console.log('[ModelManager] Routing to Cloud Inference via Groq API');
        const result = await this._streamChatCloud(
          normalizedMessages,
          onToken,
          localConfig,
          signal,
          priority,
          effectiveMaxTokens,
          includeTools,
          caveman
        );
        
        // KV Cache Compression
        KVCache.addChunk(result);
        
        // Emit inference end event
        const duration = Date.now() - startTime;
        const actualTokens = Math.ceil(result.length / 4);
        
        EventBus.emitSync('inference:end', {
          priority,
          actualTokens,
          duration
        });
        
        return result;
      }

      if (!localConfig.enabled) {
        console.warn('[ModelManager] Local AI disabled in settings');
        throw new Error("Local AI is currently disabled in Settings.");
      }

      // FEATURE FLAG: Use direct LiteRT calls if enabled and runtime is litert
      const useDirect = USE_DIRECT_LITERT && 
                        (localConfig.runtime === 'litert' || 
                         localConfig.modelPath?.endsWith('.litertlm'));
      
      console.log(`[ModelManager] useDirect evaluation: USE_DIRECT_LITERT=${USE_DIRECT_LITERT}, runtime=${localConfig.runtime}, modelPath=${localConfig.modelPath}, useDirect=${useDirect}`);
      
      let result: string;
      
      if (useDirect) {
        console.log('[ModelManager] 🚀 Using DIRECT LiteRT calls (MTP enabled)');
        result = await this._streamChatDirect(
          normalizedMessages,
          onToken,
          localConfig,
          signal,
          priority,
          effectiveMaxTokens,
          includeTools,
          caveman
        );
      } else {
        // Fallback to HTTP server method
        console.log('[ModelManager] Using HTTP server method');
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
          result = await this._streamChatInternal(
            normalizedMessages,
            onToken,
            port,
            localConfig,
            signal,
            priority,
            effectiveMaxTokens,
            includeTools,
            caveman
          );
        } finally {
          releaseLock();
        }
      }
      
      // Phase 7: KV Cache Compression
      KVCache.addChunk(result);
      
      // Emit inference end event
      const duration = Date.now() - startTime;
      const actualTokens = Math.ceil(result.length / 4);
      
      EventBus.emitSync('inference:end', {
        priority,
        actualTokens,
        duration
      });
      
      return result;
      
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(`[ModelManager] streamChat error:`, errorMsg);
      
      // Emit error event
      EventBus.emitSync('inference:error', {
        error: errorMsg,
        priority
      });
      
      throw e;
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
                if (fullText.includes('[⚠️ Engine Crash:')) {
                  throw new Error(fullText);
                }
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
                if (fullText.includes('[⚠️ Engine Crash:')) {
                  throw new Error(fullText);
                }
                onToken(fullText);
              } catch (e) {
                if (e instanceof Error && e.message.includes('[⚠️ Engine Crash:')) {
                  throw e;
                }
                fullText = rawText;
                if (fullText.includes('[⚠️ Engine Crash:')) {
                  throw new Error(fullText);
                }
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

  /**
   * Direct LiteRT streaming (bypasses HTTP server)
   * Enables MTP (Multi-Token Prediction) for 2.2x speedup
   */
  private async _streamChatDirect(
    messages: ChatMessage[],
    onToken: (delta: string) => void,
    localConfig: any,
    signal?: AbortSignal,
    priority: 'foreground' | 'background' = 'foreground',
    maxOutputTokensOverride?: number,
    includeTools: boolean = true,
    caveman: boolean = false
  ): Promise<string> {
    try {
      // Ensure engine is loaded
      if (!this.directEngineLoaded) {
        console.log('[ModelManager] Loading direct engine...');
        await LocalServerManager.loadModelDirect(
          localConfig.modelPath,
          localConfig.maxTokens || 8192,
          localConfig.temperature ?? 0.2,
          localConfig.useGpu !== undefined ? localConfig.useGpu : true
        );
        this.directEngineLoaded = true;
      }

      let finalMessages = [...messages];
      
      // Add caveman system prompt if enabled
      if (caveman) {
        finalMessages.unshift({ role: 'system', content: CAVEMAN_SYSTEM_PROMPT });
      }

      // Convert messages to prompt format
      // LiteRT expects a single prompt string, not OpenAI-style messages
      const prompt = this.convertMessagesToPrompt(finalMessages);

      console.log('[ModelManager] 🚀 Direct inference starting (MTP enabled)');
      const startTime = Date.now();

      // Use streaming for better UX
      let isToolCall = false;
      const fullText = await LocalServerManager.generateStreamDirect(
        prompt,
        (token) => {
          if (token.includes('@@TOOL_CALL@@') || isToolCall) {
            isToolCall = true;
            // Suppress tool call from UI
          } else {
            if (token.includes('[⚠️ Engine Crash:')) {
              throw new Error(token);
            }
            onToken(token);
          }
        },
        {
          temperature: localConfig.temperature ?? 0.2,
          maxTokens: maxOutputTokensOverride || localConfig.maxOutputTokens || 4096
        }
      );

      const duration = Date.now() - startTime;
      const tokensPerSecond = (fullText.length / 4) / (duration / 1000);
      console.log(`[ModelManager] ✅ Direct inference complete. Duration: ${duration}ms, Speed: ${tokensPerSecond.toFixed(1)} tok/s`);
      
      // Check for degenerate responses (too short or just end tokens)
      if (fullText.length < 10 || fullText.trim().match(/^<\/?end/i)) {
        console.warn(`[ModelManager] ⚠️ Degenerate response (${fullText.length} chars): "${fullText}". Retrying with cache reset...`);
        
        // Reset cache and retry once
        await LocalServerManager.resetCache();
        this.directEngineLoaded = false; // Force reload
        
        return await this._streamChatDirect(
          messages, onToken, localConfig, signal, priority, maxOutputTokensOverride, includeTools, caveman
        );
      }

      // Intercept Native Tool Calls
      if (fullText.includes('@@TOOL_CALL@@')) {
        const toolStr = fullText.substring(fullText.indexOf('@@TOOL_CALL@@') + 13);
        try {
          const parsed = JSON.parse(toolStr);
          if (parsed.type === 'tool_call' && parsed.calls) {
            console.log('[ModelManager] 🛠️ Direct inference requested tool calls:', parsed.calls);
            const toolMessages: ChatMessage[] = [];
            
            const standardToolCalls = parsed.calls.map((c: any, index: number) => ({
              id: `call_${index}`,
              type: 'function',
              function: {
                name: c.name,
                arguments: typeof c.args === 'string' ? c.args : JSON.stringify(c.args || {})
              }
            }));

            for (const call of standardToolCalls) {
              const result = await this.executeTool(call);
              toolMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(result)
              });
            }
            
            // Recurse with tool results
            return await this._streamChatDirect(
              [...finalMessages, { role: 'assistant', content: null, tool_calls: standardToolCalls }, ...toolMessages],
              onToken, localConfig, signal, priority, maxOutputTokensOverride, includeTools, caveman
            );
          }
        } catch (e) {
          console.error('[ModelManager] Failed to parse direct tool call:', e);
        }
      }

      // Guard against empty or degenerate short responses
      if (!isToolCall && (!fullText || fullText.trim().length < 50)) {
        // If 0 tokens: engine is broken/corrupted (e.g., double-load issue).
        // Retrying won't help — go straight to HTTP fallback.
        if (!fullText || fullText.trim().length === 0) {
          console.warn(`[ModelManager] ⚠️ Direct engine produced 0 tokens. Engine state is likely corrupted. Skipping retry, falling back to HTTP.`);
          this.directEngineLoaded = false; // Prevent future direct attempts this session
          const port = localConfig.port || 8080;
          const releaseLock = await this.acquirePortLock(port);
          try {
            return await this._streamChatInternal(
              messages, onToken, port, localConfig, signal, priority,
              maxOutputTokensOverride, includeTools, caveman
            );
          } finally {
            releaseLock();
          }
        }

        // If 1-50 chars: engine works but model is confused (echoing, repeating).
        // Retry once with cache reset and slightly bumped temperature.
        console.warn(`[ModelManager] ⚠️ Degenerate response (${fullText.length} chars): "${fullText.substring(0, 60)}". Retrying with cache reset...`);
        try {
          await LocalServerManager.resetCache();
        } catch { /* ignore reset errors */ }

        const retryText = await LocalServerManager.generateStreamDirect(
          prompt,
          onToken,
          {
            temperature: (localConfig.temperature ?? 0.2) + 0.1, // slightly bump temp
            maxTokens: maxOutputTokensOverride || localConfig.maxOutputTokens || 4096
          }
        );

        if (retryText && retryText.trim().length > 0) {
          console.log(`[ModelManager] ✅ Retry succeeded with ${retryText.length} chars`);
          return retryText;
        }

        // Retry also failed — fall back to HTTP server
        console.warn('[ModelManager] ⚠️ Retry also returned empty. Falling back to HTTP server.');
        this.directEngineLoaded = false; // Mark engine unreliable
        const port = localConfig.port || 8080;
        const releaseLock = await this.acquirePortLock(port);
        try {
          return await this._streamChatInternal(
            messages, onToken, port, localConfig, signal, priority,
            maxOutputTokensOverride, includeTools, caveman
          );
        } finally {
          releaseLock();
        }
      }

      return fullText;
    } catch (e) {
      console.error('[ModelManager] Direct streaming failed:', e);
      
      // Fallback to HTTP server on error
      console.log('[ModelManager] Falling back to HTTP server method');
      this.directEngineLoaded = false; // Reset flag to retry load next time
      
      // Use HTTP server method as fallback
      const port = localConfig.port || 8080;
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
      } finally {
        releaseLock();
      }
    }
  }

  /**
   * Convert OpenAI-style messages to a single prompt string for Gemma 4.
   * 
   * Gemma 4 format: system instructions are embedded in the first user turn.
   * <start_of_turn>user
   * [system instructions]
   * 
   * [user message]<end_of_turn>
   * <start_of_turn>model
   * [response]<end_of_turn>
   */
  /**
   * Streaming chat specifically routed to the Groq Cloud API.
   */
  private async _streamChatCloud(
    messages: ChatMessage[],
    onToken: (delta: string) => void,
    localConfig: any,
    signal?: AbortSignal,
    priority: 'foreground' | 'background' = 'foreground',
    maxOutputTokensOverride?: number,
    includeTools: boolean = true,
    caveman: boolean = false
  ): Promise<string> {
    const apiKey = localConfig.cloudApiKey;
    if (!apiKey) {
      throw new Error("Groq API Key is not configured. Please enter it in Settings.");
    }

    let finalMessages = [...messages];
    if (caveman) {
      finalMessages.unshift({ role: 'system', content: CAVEMAN_SYSTEM_PROMPT });
    }

    const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    const model = localConfig.cloudModelId || 'llama-3.3-70b-versatile';

    const payload: any = {
      model,
      messages: finalMessages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.name ? { name: m.name } : {}),
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {})
      })),
      temperature: localConfig.temperature ?? 0.2,
      max_tokens: (maxOutputTokensOverride && maxOutputTokensOverride > 0)
        ? maxOutputTokensOverride
        : (localConfig.maxOutputTokens && localConfig.maxOutputTokens > 0)
          ? localConfig.maxOutputTokens
          : 4096,
      stream: true,
    };

    if (includeTools) {
      payload.tools = [
        {
          type: 'function',
          function: {
            name: 'search_memory',
            description: 'Semantic search for personal/academic facts in the student database.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query to find relevant memories or facts.'
                }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'generate_diagram',
            description: 'Triggers the pedagogical diagram engine to generate a visual diagram (e.g. mindmap, flowchart).',
            parameters: {
              type: 'object',
              properties: {
                topic: {
                  type: 'string',
                  description: 'The topic or concept to create a diagram for.'
                },
                type: {
                  type: 'string',
                  description: 'The type of diagram (e.g. svg, flowchart).'
                }
              },
              required: ['topic']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'generate_quiz',
            description: 'Fetches or creates MCQs (multiple choice questions) for the given topic.',
            parameters: {
              type: 'object',
              properties: {
                topic: {
                  type: 'string',
                  description: 'The topic or concept to test the student on.'
                },
                count: {
                  type: 'number',
                  description: 'The number of questions to generate (default is 2).'
                }
              },
              required: ['topic']
            }
          }
        }
      ];
    }

    const fetchController = new AbortController();
    const abortHandler = () => fetchController.abort();
    if (signal) signal.addEventListener('abort', abortHandler);

    const activeItem = { controller: fetchController, priority };
    this.activeControllers.add(activeItem);

    const timeoutMs = priority === 'foreground' ? 150000 : 120000;
    const fetchTimeout = setTimeout(() => {
      console.warn(`[ModelManager] Cloud Fetch timeout after ${timeoutMs / 1000}s`);
      fetchController.abort();
    }, timeoutMs);

    try {
      let fullText = '';
      let sseBuffer = '';
      const accumulatedToolCalls: any[] = [];

      const processSSEChunk = async (chunk: string) => {
        sseBuffer += chunk;
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            const delta = choice?.delta;

            if (delta?.tool_calls) {
              const toolCalls = delta.tool_calls;
              for (const tc of toolCalls) {
                const idx = tc.index;
                if (!accumulatedToolCalls[idx]) {
                  accumulatedToolCalls[idx] = { function: {} };
                }
                const acc = accumulatedToolCalls[idx];
                if (tc.id) acc.id = tc.id;
                if (tc.type) acc.type = tc.type;
                if (tc.function) {
                  if (tc.function.name) acc.function.name = tc.function.name;
                  if (tc.function.arguments) {
                    acc.function.arguments = (acc.function.arguments || '') + tc.function.arguments;
                  }
                }
              }
            }

            const content = delta?.content ?? null;
            if (content !== null) {
              fullText += content;
              onToken(content);
              await new Promise(r => setTimeout(() => r(null), 2));
            }
          } catch {
            // Ignored parsing error for specific chunks
          }
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: fetchController.signal,
        // @ts-ignore
        reactNative: { textStreaming: true },
      });

      clearTimeout(fetchTimeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => String(response.status));
        throw new Error(`Cloud Inference Error ${response.status}: ${errText}`);
      }

      // Extract and save Groq rate limit headers
      try {
        const limitReq = response.headers.get('x-ratelimit-limit-requests');
        const remainReq = response.headers.get('x-ratelimit-remaining-requests');
        const limitTok = response.headers.get('x-ratelimit-limit-tokens');
        const remainTok = response.headers.get('x-ratelimit-remaining-tokens');
        const resetReq = response.headers.get('x-ratelimit-reset-requests');
        const resetTok = response.headers.get('x-ratelimit-reset-tokens');

        if (limitReq) await AsyncStorage.setItem('@padhai_groq_limit_requests', limitReq);
        if (remainReq) await AsyncStorage.setItem('@padhai_groq_remaining_requests', remainReq);
        if (limitTok) await AsyncStorage.setItem('@padhai_groq_limit_tokens', limitTok);
        if (remainTok) await AsyncStorage.setItem('@padhai_groq_remaining_tokens', remainTok);
        if (resetReq) await AsyncStorage.setItem('@padhai_groq_reset_requests', resetReq);
        if (resetTok) await AsyncStorage.setItem('@padhai_groq_reset_tokens', resetTok);
        await AsyncStorage.setItem('@padhai_groq_limits_last_updated', String(Date.now()));
      } catch (err) {
        console.warn("[ModelManager] Failed to save Groq rate limit headers:", err);
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
      } else {
        const rawText = await response.text();
        if (rawText.includes('data: ')) {
          await processSSEChunk(rawText + '\n');
        } else {
          const j = JSON.parse(rawText);
          const choice = j.choices?.[0];
          if (choice?.message?.tool_calls) {
            for (const tc of choice.message.tool_calls) {
              accumulatedToolCalls.push(tc);
            }
          }
          fullText = choice?.message?.content ?? '';
          if (fullText) {
            onToken(fullText);
          }
        }
      }

      // Filter accumulatedToolCalls to remove empty/incomplete elements
      const validToolCalls = accumulatedToolCalls.filter(tc => tc && tc.function && tc.function.name);

      // Estimate input tokens
      let textLength = 0;
      for (const msg of finalMessages) {
        if (msg.content) textLength += msg.content.length;
        if (msg.name) textLength += msg.name.length;
        if (msg.tool_calls) {
          textLength += JSON.stringify(msg.tool_calls).length;
        }
      }
      let inputTokens = Math.ceil(textLength / 4);
      if (includeTools) {
        inputTokens += 250; // extra overhead for tools
      }

      // Estimate output tokens
      let toolCallsText = '';
      for (const tc of validToolCalls) {
        if (tc.function) {
          toolCallsText += (tc.function.name || '') + (tc.function.arguments || '');
        }
      }
      const outputTokens = Math.ceil((fullText.length + toolCallsText.length) / 4);
      const totalTokens = inputTokens + outputTokens;

      try {
        const currentUsedRaw = await AsyncStorage.getItem('@padhai_groq_tokens_used');
        const currentUsed = currentUsedRaw ? parseInt(currentUsedRaw, 10) || 0 : 0;
        await AsyncStorage.setItem('@padhai_groq_tokens_used', String(currentUsed + totalTokens));
        console.log(`[ModelManager] Groq cloud token usage tracked: input=${inputTokens}, output=${outputTokens}, total=${totalTokens}. Accumulated: ${currentUsed + totalTokens}`);
      } catch (e) {
        console.warn("[ModelManager] Failed to update @padhai_groq_tokens_used:", e);
      }

      if (validToolCalls.length > 0) {
        console.log('[ModelManager] 🛠️ Cloud inference executing tool calls:', validToolCalls);
        const toolMessages: ChatMessage[] = [];

        // Format tools correctly before sending them
        const standardToolCalls = validToolCalls.map((tc, index) => ({
          id: tc.id || `call_${index}`,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments || '{}'
          }
        }));

        for (const call of standardToolCalls) {
          const result = await this.executeTool(call);
          toolMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: typeof result === 'string' ? result : JSON.stringify(result)
          });
        }

        // Recurse with tool results
        return await this._streamChatCloud(
          [
            ...messages,
            { role: 'assistant', content: fullText || null, tool_calls: standardToolCalls },
            ...toolMessages
          ],
          onToken,
          localConfig,
          signal,
          priority,
          maxOutputTokensOverride,
          includeTools,
          caveman
        );
      }

      return fullText;

    } finally {
      clearTimeout(fetchTimeout);
      if (signal) signal.removeEventListener('abort', abortHandler);
      this.activeControllers.delete(activeItem);
    }
  }

  private convertMessagesToPrompt(messages: ChatMessage[]): string {
    let prompt = '';
    
    // Collect system messages separately
    const systemParts: string[] = [];
    const nonSystemMessages: ChatMessage[] = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content || '');
      } else {
        nonSystemMessages.push(msg);
      }
    }
    
    const systemPrefix = systemParts.length > 0 ? systemParts.join('\n\n') + '\n\n' : '';
    let isFirstUser = true;
    
    for (const msg of nonSystemMessages) {
      if (msg.role === 'user') {
        if (isFirstUser && systemPrefix) {
          // Embed system instructions in the first user turn
          prompt += `<start_of_turn>user\n${systemPrefix}${msg.content}<end_of_turn>\n`;
          isFirstUser = false;
        } else {
          prompt += `<start_of_turn>user\n${msg.content}<end_of_turn>\n`;
          isFirstUser = false;
        }
      } else if (msg.role === 'assistant') {
        prompt += `<start_of_turn>model\n${msg.content}<end_of_turn>\n`;
      } else if (msg.role === 'tool') {
        prompt += `<start_of_turn>user\nTool result: ${msg.content}<end_of_turn>\n`;
      }
    }
    
    // If no user messages existed but we have system text, wrap it as user turn
    if (isFirstUser && systemPrefix) {
      prompt = `<start_of_turn>user\n${systemPrefix.trim()}<end_of_turn>\n` + prompt;
    }
    
    // Add final model turn to prompt generation
    prompt += '<start_of_turn>model\n';
    
    console.log(`[ModelManager] Prompt length: ${prompt.length} chars, turns: ${nonSystemMessages.length}`);
    
    return prompt;
  }

  public async fetchGroqLimitsAndModels(apiKey: string, skipDummyFallback = false): Promise<{
    models: any[];
    limits: {
      limitRequests: number;
      remainingRequests: number;
      limitTokens: number;
      remainingTokens: number;
      resetRequests: string;
      resetTokens: string;
    } | null;
  }> {
    try {
      console.log("[ModelManager] Fetching models list from Groq API...");
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models from Groq: ${response.status}`);
      }
      
      const json = await response.json();
      const models = json.data || [];
      
      let limitReq = response.headers.get('x-ratelimit-limit-requests');
      let remainReq = response.headers.get('x-ratelimit-remaining-requests');
      let limitTok = response.headers.get('x-ratelimit-limit-tokens');
      let remainTok = response.headers.get('x-ratelimit-remaining-tokens');
      let resetReq = response.headers.get('x-ratelimit-reset-requests');
      let resetTok = response.headers.get('x-ratelimit-reset-tokens');
      
      // Fallback to dummy completion if limits are not provided on GET /v1/models
      if (!limitReq && !limitTok && !skipDummyFallback) {
        console.log("[ModelManager] Rate limits not in models response. Fetching via dummy chat completion...");
        try {
          const dummyResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: models.length > 0 ? models[0].id : 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: 'h' }],
              max_tokens: 1
            })
          });
          limitReq = dummyResponse.headers.get('x-ratelimit-limit-requests');
          remainReq = dummyResponse.headers.get('x-ratelimit-remaining-requests');
          limitTok = dummyResponse.headers.get('x-ratelimit-limit-tokens');
          remainTok = dummyResponse.headers.get('x-ratelimit-remaining-tokens');
          resetReq = dummyResponse.headers.get('x-ratelimit-reset-requests');
          resetTok = dummyResponse.headers.get('x-ratelimit-reset-tokens');
        } catch (dummyErr) {
          console.warn("[ModelManager] Dummy chat completion rate limit check failed:", dummyErr);
        }
      }
      
      let limits = null;
      if (limitReq || limitTok) {
        limits = {
          limitRequests: limitReq ? parseInt(limitReq, 10) : 0,
          remainingRequests: remainReq ? parseInt(remainReq, 10) : 0,
          limitTokens: limitTok ? parseInt(limitTok, 10) : 0,
          remainingTokens: remainTok ? parseInt(remainTok, 10) : 0,
          resetRequests: resetReq || '',
          resetTokens: resetTok || '',
        };
        
        if (limitReq) await AsyncStorage.setItem('@padhai_groq_limit_requests', limitReq);
        if (remainReq) await AsyncStorage.setItem('@padhai_groq_remaining_requests', remainReq);
        if (limitTok) await AsyncStorage.setItem('@padhai_groq_limit_tokens', limitTok);
        if (remainTok) await AsyncStorage.setItem('@padhai_groq_remaining_tokens', remainTok);
        if (resetReq) await AsyncStorage.setItem('@padhai_groq_reset_requests', resetReq);
        if (resetTok) await AsyncStorage.setItem('@padhai_groq_reset_tokens', resetTok);
        await AsyncStorage.setItem('@padhai_groq_limits_last_updated', String(Date.now()));
      }
      
      await AsyncStorage.setItem('@padhai_groq_fetched_models', JSON.stringify(models));
      return { models, limits };
    } catch (e) {
      console.error("[ModelManager] Error fetching Groq limits/models:", e);
      throw e;
    }
  }
}

export const ModelManager = new ModelManagerService();
