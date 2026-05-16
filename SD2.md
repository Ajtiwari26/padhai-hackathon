# Padh.ai System Design v2 — Full Architecture Refactor

> **Status**: Awaiting User Approval
> **Scope**: Complete system redesign based on audit of all core modules

## Executive Summary

After reviewing every file in `src/core/`, `src/skills/`, and `App.tsx`, the current architecture suffers from **5 critical anti-patterns** that cause the timeouts, crashes, and inefficiencies you've been experiencing. This plan consolidates all subsystems into a unified, event-driven pipeline.

---

## 🔴 Critical Problems Found

### P1: Singleton Spaghetti (God Objects)
Every service is a singleton that directly imports other singletons:
- `TutorOrchestrator` → imports `ModelManager`, `HierarchicalStore`, `SemanticMemory`, `ChatStore`, `SyllabusGuardrail`, `TopicConvergenceTracker`, `ContextMapper`, `ContextBudget`, `LocalServerManager`, `StudentProfileStore` (10 direct deps)
- `ResourcePlanner` → imports `AISyllabusGenerator`, `AdaptiveQuestionGenerator`, `TestGenerator`, `DPPGenerator`, `SummaryGenerator` (5 deps)
- **Impact**: No testability, circular risk, impossible to swap implementations.

### P2: Dual Memory Systems (Legacy Tax)
`SemanticMemory.ts` (293 lines) exists purely as a facade over `HierarchicalMemoryStore.ts` (368 lines). Both are active:
- `SemanticMemory.extractFacts()` calls `Classifier.classify()` → returns `MemoryFact[]`
- `HierarchicalStore.processExchange()` ALSO calls `Classifier.classify()` → stores in SQLite
- `TutorOrchestrator` calls BOTH systems in parallel (lines 51-66)
- **Impact**: Double classification work, double storage writes, confused retrieval.

### P3: No Event Bus (Tight Coupling)
Module communication is hardcoded:
- `ModuleManager.aiDecideSwitch()` returns a decision but nobody calls it in the main flow
- `TopicConvergenceTracker.evaluateTurn()` runs fire-and-forget after every turn
- `DiagramOrchestrator.shouldGenerateDiagram()` is never called from `TutorOrchestrator` (diagrams are tool-only now)
- **Impact**: Dead code, missed optimizations, no way to add new behaviors.

### P4: Unsafe Inference Pipeline
`ModelManager._streamChatInternal()` has critical issues:
- Recursive tool calls re-enter `_streamChatInternal` without the `caveman` flag (line 295-304)
- Port lock is held during recursive calls (potential deadlock avoided only because it reuses the same internal method)
- No circuit breaker after repeated failures — `localCircuitBroken` flag is set in `boot()` but never checked
- **Impact**: Background tasks can crash, tool call responses lose caveman optimization.

### P5: Context Budget Fragmentation
Context assembly is split across 3 files:
- `ContextBudget.assembleFinalMessages()` — builds the message array
- `TutorOrchestrator.handleMessage()` — manually fetches hierarchical facts, sigmap context
- `ModelManager._streamChatInternal()` — does its own token safety trimming
- **Impact**: Triple token estimation, conflicting budgets, OOM risk.

---

## Proposed Architecture

### Layer 1: Event Bus (New)

```
┌─────────────────────────────────────────────┐
│                  EventBus                    │
│  ─────────────────────────────────────────   │
│  Events:                                     │
│    user:message     → Orchestrator           │
│    ai:response      → Memory, Tracker        │
│    topic:changed    → Guardrail, Module       │
│    chapter:enriched → ResourcePlanner         │
│    convergence:high → ModuleManager           │
│    inference:start  → ResourcePlanner.pause   │
│    inference:end    → ResourcePlanner.resume  │
└─────────────────────────────────────────────┘
```

#### [NEW] `src/core/bus/EventBus.ts`
Simple typed pub/sub. No external deps.

```typescript
type EventMap = {
  'user:message': { text: string; topic: string };
  'ai:response': { text: string; topic: string; duration: number };
  'topic:changed': { topic: string; subtopic?: string };
  'inference:start': { priority: 'foreground' | 'background' };
  'inference:end': { priority: 'foreground' | 'background' };
  'convergence:update': { progress: TopicProgress };
};
```

---

### Layer 2: Unified Memory (Merge)

Kill `SemanticMemory.ts`. Promote `HierarchicalMemoryStore` as the single source of truth.

#### [DELETE] `src/core/memory/SemanticMemory.ts`

#### [MODIFY] `src/core/memory/HierarchicalMemoryStore.ts`
- Absorb `SemanticMemory.getRelevantContext()` sync fallback
- Absorb `SemanticMemory.getSummary()` for profile
- Add `subscribeTo('ai:response')` for auto-extraction
- Remove all `SemanticMemoryInstance` references across codebase

#### [MODIFY] `src/core/memory/ContextBudget.ts`
- Absorb ALL token estimation (remove from ModelManager)
- New method: `assembleFromTopic(topic, userMessage, history)` that internally fetches hierarchical facts + cheatsheet
- Single responsibility: given inputs → produce budget-safe message array

---

### Layer 3: Inference Engine (Harden)

#### [MODIFY] `src/core/api/ModelManager.ts`
- **Fix recursive tool calls**: Pass `caveman` flag through recursive `_streamChatInternal`
- **Circuit breaker**: Check `localCircuitBroken` before every call, auto-reset after 30s
- **Remove token trimming**: Delegate entirely to `ContextBudget`
- **Emit events**: `inference:start` / `inference:end` so ResourcePlanner can auto-pause
- **Port lock scope**: Use RAII pattern, add timeout to prevent infinite waits

Before:
```typescript
// Line 295-304: recursive call DROPS caveman flag
fullText = await this._streamChatInternal(
  [...messages, assistantMsg, ...toolMessages],
  onToken, port, localConfig, signal, priority,
  maxOutputTokensOverride, includeTools  // ← caveman missing!
);
```

After:
```typescript
fullText = await this._streamChatInternal(
  [...messages, assistantMsg, ...toolMessages],
  onToken, port, localConfig, signal, priority,
  maxOutputTokensOverride, includeTools, caveman  // ← preserved
);
```

---

### Layer 4: Orchestrator (Simplify)

#### [MODIFY] `src/core/orchestrator/TutorOrchestrator.ts`
Current: 176 lines doing 5 jobs (context fetch, prompt build, inference dispatch, post-process, state update)

Refactored responsibilities:
1. Listen to `user:message` event
2. Call `ContextBudget.assembleFromTopic()` (single call replaces lines 50-101)
3. Call `ModelManager.streamChat()`
4. Emit `ai:response` event (memory/tracker listen to this)

Target: ~80 lines. All side-effects move to event subscribers.

#### [MODIFY] `src/core/orchestrator/TopicConvergenceTracker.ts`
- Subscribe to `ai:response` instead of being called fire-and-forget
- Emit `convergence:update` when progress changes significantly

#### [MODIFY] `src/core/modules/ModuleManager.ts`
- Subscribe to `convergence:update` to auto-suggest module switches
- Subscribe to `topic:changed` to reset state
- Remove unused `aiDecideSwitch()` integration gap

---

### Layer 5: Background Pipeline (Decouple)

#### [MODIFY] `src/core/planner/ResourcePlanner.ts`
- Subscribe to `inference:start` → auto-pause
- Subscribe to `inference:end` → auto-resume
- Subscribe to `chapter:enriched` → process dependent tasks
- Remove hardcoded imports of generators; use a task handler registry

Before:
```typescript
import { AdaptiveQuestionGenerator } from '../questions/...';
import { AISyllabusGenerator } from '../curriculum/...';
import { TestGenerator } from '../tests/...';
// ... 5 more imports
```

After:
```typescript
// Task handlers registered at boot
const handlers: Record<string, TaskHandler> = {};
export function registerHandler(type: string, handler: TaskHandler) { ... }
```

---

### Layer 6: Dead Code Removal

#### [DELETE or SIMPLIFY] `src/core/context/ContextMapper.ts`
- `ask()` method queries `PadhVectorDB.getSignaturesByPath()` which is a dev-only feature
- Used in `TutorOrchestrator` only when message contains 'structure'/'how do you'/'where is'
- These are student questions, not codebase queries. **This is dead logic.**

#### [DELETE or SIMPLIFY] `src/core/context/SigMapGenerator.ts`
- Only used by `ContextMapper` which is dead
- `extractSignatures()` uses regex on source code — irrelevant for a tutoring app

#### [SIMPLIFY] `src/core/memory/MemoryCondenser.ts`
- `getRelevantContext()` duplicates `HierarchicalStore.searchContent()`
- `updateKnowledgeMap()` is a no-op (line 96-98: only logs)
- Keep only `generateSessionCheatsheet()`, merge into HierarchicalStore

---

## File Change Summary

| Action | File | Reason |
|--------|------|--------|
| **NEW** | `src/core/bus/EventBus.ts` | Typed pub/sub, ~60 lines |
| **DELETE** | `src/core/memory/SemanticMemory.ts` | Replaced by HierarchicalStore |
| **DELETE** | `src/core/context/ContextMapper.ts` | Dead code (SigMap for tutoring) |
| **DELETE** | `src/core/context/SigMapGenerator.ts` | Dead code |
| **MODIFY** | `src/core/api/ModelManager.ts` | Fix recursive caveman bug, add events, circuit breaker |
| **MODIFY** | `src/core/memory/HierarchicalMemoryStore.ts` | Absorb SemanticMemory API |
| **MODIFY** | `src/core/memory/ContextBudget.ts` | Single source of token budgeting |
| **MODIFY** | `src/core/orchestrator/TutorOrchestrator.ts` | Slim down to ~80 lines |
| **MODIFY** | `src/core/orchestrator/TopicConvergenceTracker.ts` | Event-driven |
| **MODIFY** | `src/core/modules/ModuleManager.ts` | Event-driven |
| **MODIFY** | `src/core/planner/ResourcePlanner.ts` | Auto-pause via events, handler registry |
| **MODIFY** | `src/core/skills/ToolRegistry.ts` | Point to HierarchicalStore |
| **MODIFY** | `src/core/memory/MemoryCondenser.ts` | Remove dead methods |
| **MODIFY** | `App.tsx` | Wire EventBus at boot |

---

## Execution Order

```
Phase 1: Foundation (No breaking changes)
  1.1  Create EventBus.ts
  1.2  Fix ModelManager recursive caveman bug (1-line fix)
  1.3  Add circuit breaker to ModelManager

Phase 2: Memory Unification
  2.1  Add SemanticMemory API surface to HierarchicalStore
  2.2  Update all imports (ToolRegistry, TutorOrchestrator)
  2.3  Delete SemanticMemory.ts
  2.4  Consolidate ContextBudget

Phase 3: Event-Driven Wiring
  3.1  TutorOrchestrator emits/subscribes events
  3.2  TopicConvergenceTracker subscribes to ai:response
  3.3  ResourcePlanner subscribes to inference:start/end
  3.4  ModuleManager subscribes to convergence:update

Phase 4: Cleanup
  4.1  Delete ContextMapper.ts + SigMapGenerator.ts
  4.2  Simplify MemoryCondenser.ts
  4.3  Remove dead SigMap references from TutorOrchestrator
```

---

## Verification Plan

### Automated
- `npx react-native run-android` — build succeeds
- Trigger syllabus generation → verify no double-classification logs
- Trigger background enrichment → verify caveman mode preserved in tool calls
- Verify ResourcePlanner auto-pauses during foreground chat

### Manual
- Chat with mentor → confirm response quality unchanged
- Generate curriculum → confirm chapter enrichment works
- Check memory retrieval → confirm `STATE: {...}` format in logs

---

## Open Questions

> [!IMPORTANT]
> **Q1**: Should we keep `SemanticMemory.loadFacts()` migration logic for existing users who have data in AsyncStorage? I recommend keeping a one-time migration in `HierarchicalStore.initialize()` then deleting the AsyncStorage key.

> [!IMPORTANT]
> **Q2**: The `ModuleManager.aiDecideSwitch()` method (lines 108-208) has sophisticated logic but is never called from the main chat flow. Should we wire it into the event system, or is it intentionally manual-only?

> [!WARNING]
> **Q3**: Deleting `ContextMapper`/`SigMapGenerator` removes the `/query_app_structure` tool from `ToolRegistry`. This tool currently returns a hardcoded string. Confirm this is OK to remove?
