# Tool Audit: Keep, Delete, or Modify?

**Quick Reference Guide for Implementation**

---

## ✅ KEEP (Enhance & Integrate)

### 1. **Memoir (Hierarchical Memory System)**

**Status**: ✅ **KEEP - Core Feature**

**Files**:
- `src/core/memory/HierarchicalMemoryStore.ts` ✅
- `src/core/memory/PatternClassifier.ts` ✅
- `src/core/memory/TaxonomyTree.ts` ✅

**Why Keep**:
- Solves context bloat (50 tokens vs 200 tokens)
- On-device classification (no API calls)
- Well-designed education taxonomy
- Already integrated with native SQLite

**Actions**:
- ✅ Keep as primary memory system
- ✅ Delete `SemanticMemory.ts` (legacy facade)
- ✅ Enhance with KV cache compression
- ✅ Add to Week 3 refactor

---

### 2. **Caveman Mode**

**Status**: ✅ **KEEP - Excellent Optimization**

**Files**:
- `src/core/api/ModelManager.ts` (CAVEMAN_SYSTEM_PROMPT) ✅
- `src/ui/screens/MentorChat.tsx` (user toggle) ✅
- `src/core/curriculum/AISyllabusGenerator.ts` (background) ✅

**Why Keep**:
- 30-40% token reduction
- Perfect for background tasks
- User-controllable
- Already working well

**Actions**:
- ✅ Keep current implementation
- ✅ Fix recursive tool call bug (Week 2)
- ✅ Auto-enable for background tasks
- ✅ Use during thermal throttling

**Bug to Fix**:
```typescript
// ModelManager.ts line 295-304
// BEFORE (BUG):
fullText = await this._streamChatInternal(
  [...messages, assistantMsg, ...toolMessages],
  onToken, port, localConfig, signal, priority,
  maxOutputTokensOverride, includeTools  // ← caveman missing!
);

// AFTER (FIXED):
fullText = await this._streamChatInternal(
  [...messages, assistantMsg, ...toolMessages],
  onToken, port, localConfig, signal, priority,
  maxOutputTokensOverride, includeTools, caveman  // ← preserved
);
```

---

### 3. **Memory Condenser**

**Status**: ✅ **KEEP - But Simplify**

**Files**:
- `src/core/memory/MemoryCondenser.ts` ✅

**Why Keep**:
- `generateSessionCheatsheet()` is useful
- Creates learning digests for context injection
- Uses KaTeX for math formatting

**Actions**:
- ✅ Keep `generateSessionCheatsheet()`
- ❌ Remove `getRelevantContext()` (duplicates HierarchicalStore)
- ❌ Remove `updateKnowledgeMap()` (no-op, just logs)
- ✅ Simplify to ~100 lines (Week 3)

---

## ❌ DELETE (Dead Code)

### 1. **SigMap (Signature Map Generator)**

**Status**: ❌ **DELETE - Not Relevant**

**Files to Delete**:
- `src/core/context/SigMapGenerator.ts` ❌
- `src/core/context/ContextMapper.ts` ❌

**Why Delete**:
- Designed for code navigation, not education
- Only triggers on keywords: "structure", "how do you", "where is"
- These are student questions, not codebase queries
- Returns hardcoded string in ToolRegistry
- No other code depends on it

**Actions**:
```bash
# Week 2: Delete these files
rm src/core/context/SigMapGenerator.ts
rm src/core/context/ContextMapper.ts
```

**Code to Remove**:

1. **TutorOrchestrator.ts** (lines 68-81):
```typescript
// DELETE THIS BLOCK:
// 1c. SigMap Context Injection (Codebase/Knowledge Structure)
let sigMapContext = '';
if (userInput.toLowerCase().includes('structure') || ...) {
  if (ContextMapper) {
    try {
      const matches = await ContextMapper.ask(userInput);
      // ...
    } catch (e) {
      console.warn('[Orchestrator] SigMap query failed:', e);
    }
  }
}
```

2. **ToolRegistry.ts** (query_app_structure tool):
```typescript
// DELETE THIS METHOD:
async query_app_structure(args: { query: string }): Promise<string> {
  console.log('[Tool] query_app_structure:', args.query);
  return "SigMap structure context would be returned here.";
}
```

---

## ⚠️ KEEP BUT SCOPE LIMITED

### 1. **CRG (Code Review Graph)**

**Status**: ⚠️ **KEEP - Development Only**

**Files**:
- `.code-review-graph/graph.db` ✅ (dev only)
- `.kiro/steering/code-review-graph.md` ✅ (dev only)
- `.github/code-review-graph.instruction.md` ✅ (dev only)

**Why Keep**:
- Useful for **development** (AI agents helping you code)
- NOT useful for **production** (students using the app)

**Actions**:
- ✅ Keep for development workflow
- ❌ Do NOT integrate into app runtime
- ❌ Do NOT bundle with production app
- ✅ Use for architecture analysis during refactoring
- ✅ Keep steering files for AI agent guidance

**Important**: CRG is an MCP tool for AI agents (Kiro, Claude, Gemini) to help YOU develop the app. It should NOT be part of the app that students use.

---

## ❓ CLARIFY WITH USER

### 1. **Obsidian Integration**

**Status**: ❓ **CLARIFY - Not Found**

**Files**:
- `docs/obsidian/` (exists but empty/minimal)

**Questions**:
1. Is Obsidian integration planned or already implemented?
2. Should we integrate Obsidian for student notes?
3. Or is this just documentation storage?

**Possible Actions**:
- If planned: Add to Week 9+ (after core optimizations)
- If just docs: Keep as-is
- If not needed: Remove folder

---

## Summary Table

| Tool | Decision | Timeline | Impact |
|------|----------|----------|--------|
| **Memoir** | ✅ Keep & Enhance | Week 3 | High (core feature) |
| **Caveman** | ✅ Keep & Fix Bug | Week 2 | High (30-40% token reduction) |
| **Memory Condenser** | ✅ Keep & Simplify | Week 3 | Medium (useful for cheatsheets) |
| **SigMap** | ❌ Delete | Week 2 | Low (dead code) |
| **ContextMapper** | ❌ Delete | Week 2 | Low (dead code) |
| **CRG** | ⚠️ Keep (Dev Only) | N/A | Medium (dev productivity) |
| **Obsidian** | ❓ Clarify | TBD | Unknown |

---

## Implementation Checklist

### Week 2: Deletions
- [ ] Delete `SigMapGenerator.ts`
- [ ] Delete `ContextMapper.ts`
- [ ] Remove SigMap imports from `TutorOrchestrator.ts`
- [ ] Remove `query_app_structure` from `ToolRegistry.ts`
- [ ] Fix caveman recursion bug in `ModelManager.ts`

### Week 3: Enhancements
- [ ] Delete `SemanticMemory.ts`
- [ ] Enhance `HierarchicalMemoryStore.ts` (absorb SemanticMemory API)
- [ ] Simplify `MemoryCondenser.ts` (keep only cheatsheet generation)
- [ ] Update all imports to use HierarchicalStore

### Week 4+: New Features
- [ ] Add KV cache compression to Memoir
- [ ] Integrate Caveman with thermal throttling
- [ ] Add context window management

---

## Code Snippets for Quick Reference

### Caveman Bug Fix (Week 2)

**File**: `src/core/api/ModelManager.ts`  
**Line**: 295-304

```typescript
// BEFORE (BUG):
fullText = await this._streamChatInternal(
  [...messages, assistantMsg, ...toolMessages],
  onToken, port, localConfig, signal, priority,
  maxOutputTokensOverride, includeTools  // ← missing caveman
);

// AFTER (FIXED):
fullText = await this._streamChatInternal(
  [...messages, assistantMsg, ...toolMessages],
  onToken, port, localConfig, signal, priority,
  maxOutputTokensOverride, includeTools, caveman  // ← added
);
```

### SigMap Removal (Week 2)

**File**: `src/core/orchestrator/TutorOrchestrator.ts`  
**Lines**: 68-81

```typescript
// DELETE THIS ENTIRE BLOCK:
// 1c. SigMap Context Injection (Codebase/Knowledge Structure)
let sigMapContext = '';
if (userInput.toLowerCase().includes('structure') || 
    userInput.toLowerCase().includes('how do you') || 
    userInput.toLowerCase().includes('where is')) {
  if (ContextMapper) {
    try {
      const matches = await ContextMapper.ask(userInput);
      if (matches && matches.length > 0) {
        sigMapContext = matches.map((m: { path: string, name: string, type: string }) => 
          `[SigMap] ${m.path} > ${m.name} (${m.type})`
        ).join('\n');
        console.log(`[Orchestrator] SigMap Context found: ${matches.length} matches`);
      }
    } catch (e) {
      console.warn('[Orchestrator] SigMap query failed:', e);
    }
  }
}
```

### SemanticMemory Deletion (Week 3)

**Files to Update**:
1. `src/ui/screens/OnboardingChat.tsx` - Change import
2. `src/core/skills/ToolRegistry.ts` - Change import
3. Any other files importing `SemanticMemoryInstance`

```typescript
// BEFORE:
import { SemanticMemoryInstance } from '../core/memory/SemanticMemory';

// AFTER:
import { HierarchicalStore } from '../core/memory/HierarchicalMemoryStore';

// BEFORE:
const facts = SemanticMemoryInstance.getRelevantContext(query);

// AFTER:
const facts = await HierarchicalStore.getContextForTopic(topic, 60);
```

---

**Prepared by**: Kiro AI  
**Date**: May 17, 2026  
**Status**: Ready for Implementation
