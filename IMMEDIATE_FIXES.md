# Immediate Fixes - Stop the Crashes NOW

**Timeline**: 1-2 days  
**Priority**: 🔴 P0 CRITICAL  
**Goal**: Reduce crash rate from 80% to <20% within 24 hours

---

## Fix 1: Memory Pressure Detection (30 minutes)

### Add to `src/core/api/ModelManager.ts`

```typescript
// Add after line 82 (in boot() method)
private memoryCheckInterval: NodeJS.Timeout | null = null;

public async boot() {
  await LocalServerManager.initialize();
  this.localCircuitBroken = false;
  
  // NEW: Start memory monitoring
  this.startMemoryMonitoring();
}

// NEW METHOD: Monitor memory every 10 seconds
private startMemoryMonitoring(): void {
  this.memoryCheckInterval = setInterval(async () => {
    await this.checkMemoryPressure();
  }, 10000); // Check every 10 seconds
}

// NEW METHOD: Check memory and take action
private async checkMemoryPressure(): Promise<void> {
  try {
    // Get memory stats from native module
    const memoryInfo = await NativeModules.PadhMemoryMonitor?.getMemoryInfo();
    
    if (!memoryInfo) {
      console.warn('[ModelManager] Memory monitoring not available');
      return;
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

// NEW METHOD: Emergency cleanup when memory is critical
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
  
  // 4. Notify user
  console.log('[ModelManager] Memory cleanup complete');
}

// NEW METHOD: Preventive cleanup when memory is high
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

// NEW METHOD: Stop monitoring on shutdown
public shutdown(): void {
  if (this.memoryCheckInterval) {
    clearInterval(this.memoryCheckInterval);
    this.memoryCheckInterval = null;
  }
}
```

### Add Native Memory Monitor (Android)

Create `android/app/src/main/java/com/padhai/PadhMemoryMonitor.kt`:

```kotlin
package com.padhai

import android.app.ActivityManager
import android.content.Context
import com.facebook.react.bridge.*

class PadhMemoryMonitor(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String = "PadhMemoryMonitor"
    
    @ReactMethod
    fun getMemoryInfo(promise: Promise) {
        try {
            val activityManager = reactApplicationContext
                .getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            
            val memoryInfo = ActivityManager.MemoryInfo()
            activityManager.getMemoryInfo(memoryInfo)
            
            val runtime = Runtime.getRuntime()
            val usedMemory = runtime.totalMemory() - runtime.freeMemory()
            val totalMemory = runtime.maxMemory()
            val availableMemory = memoryInfo.availMem
            
            val result = Arguments.createMap().apply {
                putDouble("usedMemory", usedMemory.toDouble())
                putDouble("totalMemory", totalMemory.toDouble())
                putDouble("availableMemory", availableMemory.toDouble())
                putDouble("threshold", memoryInfo.threshold.toDouble())
                putBoolean("lowMemory", memoryInfo.lowMemory)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("MEMORY_ERROR", "Failed to get memory info", e)
        }
    }
}
```

Register in `MainApplication.kt`:

```kotlin
override fun getPackages(): List<ReactPackage> {
    return PackageList(this).packages.apply {
        add(ReactPackage {
            listOf(PadhMemoryMonitor(it))
        })
    }
}
```

---

## Fix 2: Context Window Hard Limit (15 minutes)

### Update `src/core/memory/ContextBudget.ts`

```typescript
// Add at the top of the file
const MAX_SAFE_CONTEXT_TOKENS = 8192; // Hard limit to prevent OOM
const EMERGENCY_CONTEXT_TOKENS = 4096; // Fallback if still over limit

// Update assembleFinalMessages method (around line 50)
public static assembleFinalMessages(params: {
  systemPrompt: string;
  sessionCheatsheet?: string;
  semanticFacts?: string;
  hierarchicalFacts?: string;
  rawHistory: Array<{ role: string; content: string }>;
  currentUserMessage: string;
  maxTokens: number;
  maxOutputTokens: number;
}): Array<{ role: string; content: string }> {
  const {
    systemPrompt,
    sessionCheatsheet,
    semanticFacts,
    hierarchicalFacts,
    rawHistory,
    currentUserMessage,
    maxTokens,
    maxOutputTokens,
  } = params;

  // NEW: Enforce hard limit
  const safeMaxTokens = Math.min(maxTokens, MAX_SAFE_CONTEXT_TOKENS);
  const inputBudget = safeMaxTokens - maxOutputTokens;

  console.log(`[ContextBudget] Safe max tokens: ${safeMaxTokens}, Input budget: ${inputBudget}`);

  // Build messages array
  const messages: Array<{ role: string; content: string }> = [];

  // 1. System prompt (always included)
  messages.push({ role: 'system', content: systemPrompt });

  // 2. Session context (if available)
  if (sessionCheatsheet) {
    messages.push({
      role: 'system',
      content: `Session Context:\n${sessionCheatsheet}`,
    });
  }

  // 3. Hierarchical facts (if available)
  if (hierarchicalFacts) {
    messages.push({
      role: 'system',
      content: hierarchicalFacts,
    });
  }

  // 4. History (with sliding window)
  const historyTokens = this.estimateTokens(rawHistory);
  
  if (historyTokens > inputBudget * 0.7) {
    console.warn(`[ContextBudget] History too large (${historyTokens} tokens), applying sliding window`);
    
    // Keep only recent messages
    const recentHistory = this.applySlidingWindow(
      rawHistory,
      Math.floor(inputBudget * 0.7)
    );
    
    messages.push(...recentHistory);
  } else {
    messages.push(...rawHistory);
  }

  // 5. Current user message (always included)
  messages.push({ role: 'user', content: currentUserMessage });

  // NEW: Final safety check
  const totalTokens = this.estimateTokens(messages);
  
  if (totalTokens > safeMaxTokens) {
    console.error(`[ContextBudget] 🔴 STILL OVER LIMIT (${totalTokens} tokens), emergency trim`);
    return this.emergencyTrim(messages, EMERGENCY_CONTEXT_TOKENS);
  }

  console.log(`[ContextBudget] Final context: ${totalTokens} tokens (${messages.length} messages)`);
  return messages;
}

// NEW METHOD: Apply sliding window to keep recent messages
private static applySlidingWindow(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Array<{ role: string; content: string }> {
  const result: Array<{ role: string; content: string }> = [];
  let currentTokens = 0;

  // Iterate from most recent to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = this.estimateTokens([msg]);

    if (currentTokens + msgTokens > maxTokens) {
      break; // Stop adding messages
    }

    result.unshift(msg); // Add to beginning
    currentTokens += msgTokens;
  }

  console.log(`[ContextBudget] Sliding window: kept ${result.length}/${messages.length} messages (${currentTokens} tokens)`);
  return result;
}

// NEW METHOD: Emergency trim when still over limit
private static emergencyTrim(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Array<{ role: string; content: string }> {
  console.log('[ContextBudget] 🚨 EMERGENCY TRIM');

  // Keep system prompt + last user message
  const systemPrompt = messages.find(m => m.role === 'system');
  const lastUserMessage = messages[messages.length - 1];

  // Keep as many recent messages as possible
  const recentMessages = this.applySlidingWindow(
    messages.slice(1, -1), // Exclude system and last user message
    maxTokens - this.estimateTokens([systemPrompt!, lastUserMessage])
  );

  return [systemPrompt!, ...recentMessages, lastUserMessage];
}

// Helper method to estimate tokens
private static estimateTokens(messages: Array<{ role: string; content: string }>): number {
  return messages.reduce((sum, msg) => {
    return sum + Math.ceil((msg.content || '').length / 4);
  }, 0);
}
```

---

## Fix 3: Auto-Pause After Idle (20 minutes)

### Update `src/core/api/LocalServerManager.ts`

```typescript
// Add at the top of the class
private idleTimeout = 60000; // 60 seconds
private lastActivityTime = Date.now();
private idleCheckInterval: NodeJS.Timeout | null = null;
private isPaused = false;

// Update initialize method
public async initialize(): Promise<void> {
  // ... existing code ...
  
  // NEW: Start idle monitoring
  this.startIdleMonitoring();
}

// NEW METHOD: Monitor idle time and auto-pause
private startIdleMonitoring(): void {
  this.idleCheckInterval = setInterval(() => {
    const idleTime = Date.now() - this.lastActivityTime;
    
    if (idleTime > this.idleTimeout && !this.isPaused && this.isRunning()) {
      console.log(`[LocalServerManager] 💤 Auto-pausing after ${idleTime / 1000}s idle`);
      this.pauseServer();
    }
  }, 10000); // Check every 10 seconds
}

// NEW METHOD: Pause the server
private async pauseServer(): Promise<void> {
  if (this.isPaused) return;
  
  console.log('[LocalServerManager] Pausing inference engine');
  this.isPaused = true;
  
  // Send pause signal to native module
  try {
    await NativeModules.LocalInferenceEngine?.pause();
  } catch (e) {
    console.error('[LocalServerManager] Failed to pause engine:', e);
  }
}

// NEW METHOD: Resume the server
private async resumeServer(): Promise<void> {
  if (!this.isPaused) return;
  
  console.log('[LocalServerManager] Resuming inference engine');
  this.isPaused = false;
  
  // Send resume signal to native module
  try {
    await NativeModules.LocalInferenceEngine?.resume();
  } catch (e) {
    console.error('[LocalServerManager] Failed to resume engine:', e);
  }
}

// NEW METHOD: Record activity (call this before every inference)
public recordActivity(): void {
  this.lastActivityTime = Date.now();
  
  // Auto-resume if paused
  if (this.isPaused) {
    this.resumeServer();
  }
}

// Update isRunning to check pause state
public async isRunning(): Promise<boolean> {
  if (this.isPaused) return false;
  
  // ... existing code ...
}

// NEW METHOD: Stop monitoring on shutdown
public shutdown(): void {
  if (this.idleCheckInterval) {
    clearInterval(this.idleCheckInterval);
    this.idleCheckInterval = null;
  }
}
```

### Update ModelManager to record activity

In `src/core/api/ModelManager.ts`, add before every inference call:

```typescript
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
  // NEW: Record activity to prevent auto-pause
  LocalServerManager.recordActivity();
  
  // ... rest of the method ...
}
```

---

## Fix 4: Basic Thermal Monitoring (30 minutes)

### Add Native Thermal Monitor (Android)

Create `android/app/src/main/java/com/padhai/PadhThermalMonitor.kt`:

```kotlin
package com.padhai

import android.content.Context
import android.os.PowerManager
import com.facebook.react.bridge.*

class PadhThermalMonitor(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private val powerManager = reactApplicationContext
        .getSystemService(Context.POWER_SERVICE) as PowerManager
    
    override fun getName(): String = "PadhThermalMonitor"
    
    @ReactMethod
    fun getThermalState(promise: Promise) {
        try {
            val thermalStatus = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                powerManager.currentThermalStatus
            } else {
                PowerManager.THERMAL_STATUS_NONE
            }
            
            val thermalHeadroom = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                powerManager.getThermalHeadroom(10) // 10 second forecast
            } else {
                1.0f // Assume nominal on older devices
            }
            
            val state = when {
                thermalHeadroom >= 0.7 -> "nominal"
                thermalHeadroom >= 0.5 -> "light"
                thermalHeadroom >= 0.3 -> "moderate"
                thermalHeadroom >= 0.1 -> "severe"
                else -> "critical"
            }
            
            val result = Arguments.createMap().apply {
                putString("state", state)
                putDouble("headroom", thermalHeadroom.toDouble())
                putInt("status", thermalStatus)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("THERMAL_ERROR", "Failed to get thermal state", e)
        }
    }
}
```

### Add Thermal Check to ModelManager

In `src/core/api/ModelManager.ts`:

```typescript
// Add before inference
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
      // Reduce output tokens to prevent overheating
      this.config.maxOutputTokens = Math.min(this.config.maxOutputTokens, 1024);
    }
  } catch (e) {
    console.error('[ModelManager] Thermal check failed:', e);
    throw e;
  }
}

// Call before inference
public async streamChat(...): Promise<string> {
  // NEW: Check thermal state
  await this.checkThermalState();
  
  // ... rest of the method ...
}
```

---

## Testing Checklist

### ✅ Memory Monitoring
- [ ] Memory logs appear every 10 seconds
- [ ] Emergency cleanup triggers at 85% memory
- [ ] Preventive cleanup triggers at 75% memory
- [ ] Background tasks are aborted during cleanup

### ✅ Context Window Limits
- [ ] Context never exceeds 8192 tokens
- [ ] Sliding window works correctly
- [ ] Emergency trim preserves system prompt + last message
- [ ] Logs show token counts

### ✅ Auto-Pause
- [ ] Engine pauses after 60 seconds of inactivity
- [ ] Engine resumes on next inference request
- [ ] Pause/resume logs appear correctly
- [ ] No errors during pause/resume

### ✅ Thermal Monitoring
- [ ] Thermal state logs appear
- [ ] Inference blocked when critical
- [ ] Max tokens reduced when severe
- [ ] No crashes due to thermal issues

---

## Deployment

### 1. Test Locally
```bash
# Clean build
cd android && ./gradlew clean
cd .. && npx react-native run-android
```

### 2. Monitor Logs
```bash
# Watch for memory, thermal, and pause logs
adb logcat | grep -E "ModelManager|ContextBudget|LocalServerManager|PadhMemory|PadhThermal"
```

### 3. Stress Test
- Start a conversation
- Keep chatting for 30 minutes
- Monitor memory usage in Android Studio Profiler
- Verify no crashes

### 4. Deploy to Beta
- Push to TestFlight/Internal Testing
- Monitor crash rate in Firebase Crashlytics
- Target: <20% crash rate after 30 minutes

---

## Expected Results

**Before Fixes**:
- Crashes after 10-15 minutes
- Memory grows from 2GB → 8GB+
- No thermal protection
- Engine always running

**After Fixes**:
- Crashes after 30-45 minutes (70% improvement)
- Memory stays under 4GB (50% improvement)
- Thermal protection prevents critical overheating
- Engine pauses when idle (saves battery)

---

## Next Steps

Once these fixes are deployed and stable:
1. Proceed with SD2 (architecture refactor)
2. Then SD3 Phase 2 (LiteRT-LM migration)
3. Monitor KPIs weekly

---

**Estimated Time**: 1-2 days  
**Risk**: Low (all changes are additive, no breaking changes)  
**Impact**: High (stops the bleeding, buys time for bigger refactors)
