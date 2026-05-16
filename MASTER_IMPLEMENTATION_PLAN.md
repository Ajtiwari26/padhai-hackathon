# Master Implementation Plan: Padh.ai System Redesign
## Unified Architecture + Mobile Optimization + Tool Audit

**Date**: May 17, 2026  
**Status**: 🎯 **READY FOR EXECUTION**  
**Timeline**: 8 weeks (2 months)  
**Priority**: P0 CRITICAL

---

## Executive Summary

This plan integrates:
1. **SD2**: Architecture refactor (event-driven, memory unification)
2. **SD3**: Mobile LLM optimization (LiteRT-LM, thermal management, KV cache)
3. **Tool Audit**: Evaluation of existing tools (Memoir, SigMap, CRG, Caveman, Obsidian)

**Goal**: Transform Padh.ai from a crash-prone prototype into a production-ready, high-performance mobile AI tutor.

---

## Part 1: Tool Audit & Decisions

### 🔍 **Existing Tools Analysis**

#### 1. **Memoir (Hierarchical Memory System)** ✅ **KEEP & ENHANCE**

**Current Status**: Partially implemented, inspired by [zhangfengcdt/memoir](https://github.com/zhangfengcdt/memoir)

**What it does**:
- Hierarchical memory storage with taxonomy paths
- On-device classification (no LLM calls)
- Path-selective retrieval (~50 tokens vs 200 tokens)

**Files**:
- `src/core/memory/HierarchicalMemoryStore.ts` (368 lines)
- `src/core/memory/PatternClassifier.ts` (classification logic)
- `src/core/memory/TaxonomyTree.ts` (semantic hierarchy)

**Verdict**: ✅ **KEEP - This is excellent architecture**

**Why**:
- Solves context bloat problem
- On-device (no API calls)
- Well-designed taxonomy for education domain
- Already integrated with native SQLite

**Action**: 
- ✅ Keep as primary memory system
- ✅ Delete `SemanticMemory.ts` (legacy facade) as planned in SD2
- ✅ Enhance with KV cache compression for long sessions

---

#### 2. **SigMap (Signature Map Generator)** ❌ **DELETE**

**Current Status**: Dead code, not used in production

**What it does**:
- Extracts code signatures (classes, functions, methods)
- Designed for codebase navigation
- Used in `ContextMapper.ask()` for "structure" queries

**Files**:
- `src/core/context/SigMapGenerator.ts` (95 lines)
- `src/core/context/ContextMapper.ts` (50 lines)
- `src/core/skills/ToolRegistry.ts` (query_app_structure tool)

**Verdict**: ❌ **DELETE - Not relevant for tutoring app**

**Why**:
- Designed for code navigation, not education
- Only triggers on keywords: "structure", "how do you", "where is"
- These are student questions, not codebase queries
- Returns hardcoded string in ToolRegistry
- No other code depends on it (verified via grep)

**Action**:
- ❌ Delete `SigMapGenerator.ts`
- ❌ Delete `ContextMapper.ts`
- ❌ Remove `query_app_structure` from `ToolRegistry.ts`
- ❌ Remove SigMap references from `TutorOrchestrator.ts` (lines 68-81)

---

#### 3. **CRG (Code Review Graph)** ⚠️ **KEEP BUT SCOPE LIMITED**

**Current Status**: Installed as MCP tool, used for codebase analysis

**What it does**:
- Knowledge graph for code relationships
- Semantic search, impact analysis, architecture overview
- Used by AI agents (Kiro, Claude, Gemini) for development

**Files**:
- `.code-review-graph/graph.db` (SQLite database)
- `.kiro/steering/code-review-graph.md` (usage guide)
- `.github/code-review-graph.instruction.md` (instructions)

**Verdict**: ⚠️ **KEEP - But NOT for runtime app logic**

**Why**:
- Useful for **development** (AI agents helping you code)
- NOT useful for **production** (students using the app)
- Should not be bundled with the app

**Action**:
- ✅ Keep for development workflow
- ❌ Do NOT integrate into app runtime
- ✅ Use for architecture analysis during refactoring
- ✅ Keep steering files for AI agent guidance

---

#### 4. **Caveman Mode** ✅ **KEEP & EXPAND**

**Current Status**: Implemented, working well

**What it does**:
- Token-optimized inference mode
- Drops filler words, uses telegraphic style
- Maintains technical accuracy
- User can toggle with `/caveman on|off`

**Files**:
- `src/core/api/ModelManager.ts` (CAVEMAN_SYSTEM_PROMPT)
- `src/ui/screens/MentorChat.tsx` (user toggle)
- `src/core/curriculum/AISyllabusGenerator.ts` (background tasks)

**Verdict**: ✅ **KEEP - Excellent optimization**

**Why**:
- Reduces token usage by 30-40%
- Perfect for background tasks (syllabus generation, enrichment)
- User-controllable for foreground chat
- Already integrated with priority system

**Action**:
- ✅ Keep current implementation
- ✅ Auto-enable for all background tasks
- ✅ Fix recursive tool call bug (SD2 Phase 1)
- ✅ Add to thermal throttling strategy (enable when device is hot)

---

#### 5. **Obsidian Integration** ❓ **NOT FOUND - CLARIFY**

**Current Status**: Found `docs/obsidian/` folder but no integration code

**What it could do**:
- Note-taking integration
- Knowledge graph visualization
- Study material organization

**Files**:
- `docs/obsidian/` (empty or minimal)

**Verdict**: ❓ **CLARIFY WITH USER**

**Questions**:
- Is this planned or already implemented?
- Should we integrate Obsidian for student notes?
- Or is this just documentation storage?

**Action**:
- ⏸️ HOLD - Need user clarification
- If planned: Consider after core optimizations (Week 8+)
- If just docs: Keep as-is

---

### 📊 **Tool Audit Summary**

| Tool | Status | Action | Reason |
|------|--------|--------|--------|
| **Memoir** | ✅ Keep | Enhance | Excellent memory architecture |
| **SigMap** | ❌ Delete | Remove | Dead code, not relevant |
| **CRG** | ⚠️ Keep | Dev only | Useful for development, not runtime |
| **Caveman** | ✅ Keep | Expand | Great optimization, fix bugs |
| **Obsidian** | ❓ Clarify | TBD | Need user input |

---

## Part 2: Unified System Architecture

### 🏗️ **New Architecture Layers**

```
┌─────────────────────────────────────────────────────────────┐
│                     Layer 1: UI Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ MentorChat   │  │ Onboarding   │  │ Curriculum   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Layer 2: Event Bus (NEW)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Events: user:message, ai:response, topic:changed,   │   │
│  │  inference:start, inference:end, memory:updated,     │   │
│  │  convergence:update, thermal:warning                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Layer 3: Orchestration Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Tutor        │  │ Module       │  │ Convergence  │      │
│  │ Orchestrator │  │ Manager      │  │ Tracker      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                Layer 4: Memory Layer (Memoir)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Hierarchical │  │ Context      │  │ Memory       │      │
│  │ Store        │  │ Budget       │  │ Condenser    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│           Layer 5: Inference Engine (LiteRT-LM)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ LiteRT       │  │ Thermal      │  │ Adaptive     │      │
│  │ Manager      │  │ Manager      │  │ Scheduler    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Layer 6: Native Layer (Android/iOS)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ LiteRT-LM    │  │ Memory       │  │ Thermal      │      │
│  │ SDK          │  │ Monitor      │  │ Monitor      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 3: 8-Week Implementation Timeline

### **Week 1: Critical Fixes (SD3 Phase 1)** 🔴 IMMEDIATE

**Goal**: Stop the crashes, buy time for bigger refactors

**Tasks**:
1. ✅ Add memory pressure detection (4 hours)
2. ✅ Implement 8K context hard limit (2 hours)
3. ✅ Add auto-pause after 60s idle (3 hours)
4. ✅ Add basic thermal monitoring (3 hours)
5. ✅ Create native modules (Android) (4 hours)

**Deliverables**:
- `PadhMemoryMonitor.kt` (native module)
- `PadhThermalMonitor.kt` (native module)
- Updated `ModelManager.ts` with memory checks
- Updated `ContextBudget.ts` with hard limits
- Updated `LocalServerManager.ts` with auto-pause

**Expected Impact**:
- 70% reduction in crashes
- 50% reduction in memory usage
- Can sustain 30-minute sessions

**Testing**:
- 30-minute stress test
- Memory profiler monitoring
- Thermal state logging

---

### **Week 2: Architecture Refactor Part 1 (SD2 Phase 1-2)**

**Goal**: Create event bus, fix critical bugs

**Tasks**:
1. ✅ Create EventBus.ts (4 hours)
2. ✅ Fix ModelManager caveman recursion bug (1 hour)
3. ✅ Add circuit breaker to ModelManager (3 hours)
4. ✅ Delete SigMap/ContextMapper (2 hours)
5. ✅ Update TutorOrchestrator to use EventBus (4 hours)

**Deliverables**:
- `src/core/bus/EventBus.ts` (new file)
- Updated `ModelManager.ts` (caveman fix + circuit breaker)
- Deleted `SigMapGenerator.ts`, `ContextMapper.ts`
- Updated `TutorOrchestrator.ts` (emit events)

**Expected Impact**:
- Cleaner code architecture
- Fixed caveman bug (background tasks optimized)
- Circuit breaker prevents repeated failures

---

### **Week 3: Architecture Refactor Part 2 (SD2 Phase 2-3)**

**Goal**: Unify memory systems, wire event-driven flow

**Tasks**:
1. ✅ Add SemanticMemory API to HierarchicalStore (4 hours)
2. ✅ Migrate all imports from SemanticMemory → HierarchicalStore (3 hours)
3. ✅ Delete SemanticMemory.ts (1 hour)
4. ✅ Consolidate ContextBudget (4 hours)
5. ✅ Wire TopicConvergenceTracker to events (2 hours)
6. ✅ Wire ModuleManager to events (2 hours)

**Deliverables**:
- Enhanced `HierarchicalMemoryStore.ts`
- Deleted `SemanticMemory.ts`
- Updated `ContextBudget.ts` (single source of truth)
- Event-driven `TopicConvergenceTracker.ts`
- Event-driven `ModuleManager.ts`

**Expected Impact**:
- 30-40% token usage reduction (no double classification)
- Cleaner memory architecture
- Better testability

---

### **Week 4: LiteRT-LM Migration Prep (SD3 Phase 2 Part 1)**

**Goal**: Set up LiteRT-LM infrastructure

**Tasks**:
1. ✅ Add LiteRT-LM dependency to Android (2 hours)
2. ✅ Create LiteRTInferenceEngine.kt (6 hours)
3. ✅ Create React Native bridge (4 hours)
4. ✅ Add feature flag for gradual rollout (2 hours)
5. ✅ Set up A/B testing infrastructure (2 hours)

**Deliverables**:
- Updated `android/app/build.gradle`
- `LiteRTInferenceEngine.kt` (native module)
- `src/core/api/LiteRTManager.ts` (RN bridge)
- Feature flag system
- A/B testing telemetry

**Expected Impact**:
- Infrastructure ready for migration
- Can test LiteRT-LM with 10% of users

---

### **Week 5: LiteRT-LM Migration (SD3 Phase 2 Part 2)**

**Goal**: Enable Multi-Token Prediction, migrate inference

**Tasks**:
1. ✅ Download Gemma 4 E4B LiteRT model (2 hours)
2. ✅ Implement LiteRT-LM inference (8 hours)
3. ✅ Enable MTP (Multi-Token Prediction) (2 hours)
4. ✅ Migrate ModelManager to use LiteRT (4 hours)
5. ✅ Test and validate output quality (4 hours)

**Deliverables**:
- Gemma 4 E4B model in app bundle
- Working LiteRT-LM inference
- MTP enabled (2.2x speedup)
- Migrated `ModelManager.ts`
- Quality validation report

**Expected Impact**:
- 2.2x inference speed (8-12 tok/s → 18-25 tok/s)
- 40% memory reduction
- Better battery life

---

### **Week 6: Advanced Memory Management (SD3 Phase 3)**

**Goal**: KV cache optimization, context window management

**Tasks**:
1. ✅ Implement KV cache compression (6 hours)
2. ✅ Add context window summarization (4 hours)
3. ✅ Implement sliding window (3 hours)
4. ✅ Add memory pressure-based compression (3 hours)

**Deliverables**:
- `src/core/memory/KVCacheManager.ts` (new file)
- `src/core/memory/ContextWindowManager.ts` (new file)
- Updated `ContextBudget.ts` (sliding window)
- Adaptive compression based on memory pressure

**Expected Impact**:
- Support for 60+ minute sessions
- Memory stays under 3GB
- No quality degradation

---

### **Week 7: Thermal & Energy Optimization (SD3 Phase 4)**

**Goal**: Adaptive core selection, thermal management

**Tasks**:
1. ✅ Implement adaptive core selection (6 hours)
2. ✅ Add thermal throttling (4 hours)
3. ✅ Implement background task scheduling (4 hours)
4. ✅ Add power-aware inference (2 hours)

**Deliverables**:
- `src/core/thermal/ThermalManager.ts` (enhanced)
- `src/core/scheduler/AdaptiveScheduler.ts` (new file)
- `CoreSelector.kt` (native module)
- Power-aware inference modes

**Expected Impact**:
- 60% reduction in thermal throttling
- 40-50% power reduction for background tasks
- 3x longer sustained performance

---

### **Week 8: Polish & Testing**

**Goal**: Integration testing, bug fixes, documentation

**Tasks**:
1. ✅ End-to-end integration testing (8 hours)
2. ✅ Performance benchmarking (4 hours)
3. ✅ Bug fixes from testing (8 hours)
4. ✅ Update documentation (4 hours)
5. ✅ Prepare for production rollout (4 hours)

**Deliverables**:
- Test suite (unit + integration)
- Performance benchmark report
- Bug fix log
- Updated README and docs
- Production deployment plan

**Expected Impact**:
- Production-ready app
- All KPIs met
- Ready for 100% rollout

---

## Part 4: File Changes Summary

### **Files to DELETE** ❌

```
src/core/memory/SemanticMemory.ts              (293 lines)
src/core/context/ContextMapper.ts              (50 lines)
src/core/context/SigMapGenerator.ts            (95 lines)
```

**Total deleted**: ~438 lines

---

### **Files to CREATE** ✅

```
src/core/bus/EventBus.ts                       (~80 lines)
src/core/api/LiteRTManager.ts                  (~120 lines)
src/core/memory/KVCacheManager.ts              (~200 lines)
src/core/memory/ContextWindowManager.ts        (~150 lines)
src/core/thermal/ThermalManager.ts             (~180 lines)
src/core/scheduler/AdaptiveScheduler.ts        (~220 lines)

android/.../PadhMemoryMonitor.kt               (~80 lines)
android/.../PadhThermalMonitor.kt              (~100 lines)
android/.../LiteRTInferenceEngine.kt           (~300 lines)
android/.../CoreSelector.kt                    (~150 lines)
```

**Total created**: ~1,580 lines

---

### **Files to MODIFY** 🔧

```
src/core/api/ModelManager.ts                   (Fix caveman bug, add circuit breaker, memory checks)
src/core/memory/HierarchicalMemoryStore.ts     (Absorb SemanticMemory API)
src/core/memory/ContextBudget.ts               (Hard limits, sliding window, single source of truth)
src/core/orchestrator/TutorOrchestrator.ts     (Simplify to ~80 lines, emit events)
src/core/orchestrator/TopicConvergenceTracker.ts (Subscribe to events)
src/core/modules/ModuleManager.ts              (Subscribe to events, wire aiDecideSwitch)
src/core/planner/ResourcePlanner.ts            (Auto-pause via events)
src/core/skills/ToolRegistry.ts                (Remove query_app_structure)
src/core/memory/MemoryCondenser.ts             (Keep generateSessionCheatsheet only)

android/app/build.gradle                       (Add LiteRT-LM dependency)
android/app/src/main/java/.../MainApplication.kt (Register native modules)
```

---

## Part 5: Success Metrics & KPIs

### **Primary KPIs** (Must Achieve)

| Metric | Baseline | Week 1 | Week 3 | Week 5 | Week 8 (Target) |
|--------|----------|--------|--------|--------|-----------------|
| **Crash Rate** | 80% @ 15min | 20% @ 30min | 15% @ 45min | 10% @ 60min | <5% @ 60min |
| **Memory Peak** | 8GB+ | 4GB | 3.5GB | 3GB | 3GB |
| **Inference Speed** | 8-12 tok/s | 8-12 tok/s | 8-12 tok/s | 18-25 tok/s | 18-25 tok/s |
| **Session Length** | 10-15 min | 30 min | 45 min | 60 min | 60+ min |

### **Secondary KPIs** (Nice to Have)

| Metric | Baseline | Target |
|--------|----------|--------|
| **Battery Drain** | 15%/hour | 7-8%/hour |
| **Thermal Events** | 5-8/session | <2/session |
| **Token Usage** | 100% | 60-70% |
| **Code Quality** | Mixed | Clean architecture |

---

## Part 6: Risk Management

### **High-Risk Items** 🔴

| Risk | Mitigation | Contingency |
|------|------------|-------------|
| LiteRT-LM migration breaks features | Feature flag + gradual rollout | Rollback to old engine |
| MTP not available on all devices | Runtime detection + fallback | Use standard inference |
| Memory compression loses quality | A/B test compression ratios | Reduce compression |
| Users complain about auto-pause | Make timeout configurable | Add "Keep Awake" toggle |

### **Medium-Risk Items** 🟡

| Risk | Mitigation | Contingency |
|------|------------|-------------|
| Event bus adds complexity | Comprehensive testing | Add event logging |
| Thermal API not on old Android | Graceful degradation | Skip thermal features |
| KV cache compression bugs | Extensive testing | Disable compression |

---

## Part 7: Testing Strategy

### **Week 1-3: Unit Testing**
- Memory pressure detection
- Context window limits
- Event bus pub/sub
- Circuit breaker logic

### **Week 4-5: Integration Testing**
- LiteRT-LM inference
- MTP speedup validation
- Feature flag system
- A/B testing infrastructure

### **Week 6-7: Performance Testing**
- 60-minute stress test
- Memory profiler monitoring
- Thermal state tracking
- Battery drain measurement

### **Week 8: User Acceptance Testing**
- Beta rollout (10% → 50% → 100%)
- Crash rate monitoring
- User feedback collection
- Performance benchmarking

---

## Part 8: Rollout Strategy

### **Phase 1: Internal Testing (Week 1-3)**
- Dev team only
- Fix critical bugs
- Validate architecture changes

### **Phase 2: Beta Testing (Week 4-5)**
- 10% of users (feature flag)
- Monitor crash rate
- Collect performance metrics

### **Phase 3: Gradual Rollout (Week 6-7)**
- 50% of users
- A/B test LiteRT-LM vs old engine
- Monitor KPIs daily

### **Phase 4: Full Production (Week 8)**
- 100% of users
- LiteRT-LM as default
- Old engine as fallback

---

## Part 9: Open Questions

> **Q1**: Should we support Gemma 4 E2B as a "lite mode" for older devices?

**Answer**: Yes, add as opt-in setting after Week 8.

> **Q2**: What should the idle timeout be before auto-pause?

**Answer**: 60 seconds default, configurable in settings (30s / 60s / 120s / Never).

> **Q3**: Should we integrate Obsidian for student notes?

**Answer**: ⏸️ HOLD - Clarify with user first. If yes, plan for Week 9+.

> **Q4**: Should we keep CRG in the app bundle?

**Answer**: No, CRG is for development only. Do not bundle with production app.

---

## Part 10: Next Steps

### **Immediate Actions** (This Week)

1. ✅ Review this plan with the team
2. ✅ Set up project board (Jira/Trello/GitHub Projects)
3. ✅ Create feature branches for each week
4. ✅ Set up telemetry infrastructure
5. ✅ Start Week 1 implementation

### **Weekly Cadence**

- **Monday**: Sprint planning, review previous week
- **Wednesday**: Mid-week check-in, unblock issues
- **Friday**: Demo, retrospective, plan next week

### **Communication**

- Daily standups (15 min)
- Weekly demos to stakeholders
- Bi-weekly user feedback sessions

---

## Conclusion

This master plan unifies SD2 (architecture) + SD3 (optimization) + Tool Audit into a single, executable 8-week roadmap. By the end:

- ✅ App will be production-ready
- ✅ Crashes reduced by 95%
- ✅ Inference 2x faster
- ✅ Memory usage 60% lower
- ✅ Clean, maintainable architecture
- ✅ Only useful tools retained

**Let's build the best on-device AI tutor! 🚀**

---

**Prepared by**: Kiro AI  
**Date**: May 17, 2026  
**Status**: Ready for Execution  
**Approval**: [Pending]
