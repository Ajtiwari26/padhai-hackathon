# SigMap Query Context
Generated: 2026-05-09T01:50:49.595Z

## src/ui/screens/TaskSchedulerScreen.tsx
```
props Props
hook useState
hook useEffect
export TaskSchedulerScreen
handler onPress
handler onRefresh
```

## src/core/memory/HierarchicalMemoryStore.ts
```
export interface MemoryNode
path: string
content: string
summary: string
confidence: number
count: number
createdAt: number
updatedAt: number
export interface AggregatedSummary
prefix: string
nodeCount: number
totalMemories: number
topContent: { path: string
export interface StoreStats
totalNodes: number
distinctPaths: number
totalMemories: number
topPaths: { path: string
class HierarchicalMemoryStoreService
async processExchange(userMessage, _aiResponse, currentTopic?,) → Promise<Classificati
```

## src/core/memory/MemoryCondenser.ts
```
export interface StudentKnowledgeMap
topic: string
confidence: number
weakPoints: string[]
lastPhase: 'BREADTH_SWEEP' | 'SOCRATIC_MOLDING
unresolvedQuestions: string[]
class MemoryCondenserService
async generateSessionCheatsheet(topic, history) → Promise<string>
async getRelevantContext(query) → Promise<string[]>
async updateKnowledgeMap(topic, delta) → Promise<void>
```

## src/core/memory/SemanticMemory.ts
```
export interface MemoryFact
category: 'personal' | 'academic' | 'goals' |
key: string
value: string
confidence: number
timestamp: number
export interface SemanticMemoryData
facts: MemoryFact[]
lastUpdated: number
export class SemanticMemory
extractFacts(userMessage, aiResponse) → MemoryFact[]
async addFacts(facts) → Promise<void>
getRelevantContext(query, maxFacts) → string
async getRelevantContextAsync(topic, maxTokens) → Promise<string>
getAllFacts() → MemoryFact[]
async loadFacts() → Promise<void>
```

## src/core/api/ParallelLLMManager.ts
```
export interface LLMInstance
port: number
role: 'main' | 'diagram' | 'formula' | 'a
status: 'idle' | 'busy' | 'error'
lastUsed: number
export interface ParallelTask
main: (port: number) => Promise<string>
diagram?: (port: number) => Promise<any>
formula?: (port: number) => Promise<Generated
auxiliary?: (port: number) => Promise<any>
export interface ParallelResult
text: string
diagram?: any
formula?: GeneratedDiagram
auxiliary?: any
executionTime: number
class ParallelLLMManagerService
async executeParallel(tasks) → Promise<ParallelResu
```
