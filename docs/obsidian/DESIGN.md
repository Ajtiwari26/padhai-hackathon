# Padh.ai Design Document

## 1. Vision
Padh.ai is an offline-first AI learning assistant built on React Native. It uses on-device LLMs (Gemma 4) to generate personalized curricula and enrichment content without requiring an internet connection.

## 2. Technical Architecture

### 2.1 Inference Engine (`ModelManager.ts`)
- **Native LiteRT**: Uses a custom React Native module to interface with the LiteRT runtime.
- **Port Locking**: Ensures only one inference request happens at a time per port to prevent engine crashes.
- **Circuit Breaker**: Detects engine hangs and prevents cascading failures.
- **Caveman Mode**: A token-efficient prompting mode that reduces output length by ~70% for background tasks.

### 2.2 Background Task Orchestration (`ResourcePlanner.ts`)
- **Serial Queue**: Tasks like chapter enrichment are processed one-by-one to respect hardware constraints.
- **Stale Task Recovery**: On app boot, any task stuck in 'running' status is reset to 'queued'.
- **Persistence**: Task state and curriculum data are stored in `AsyncStorage`.

### 2.3 Curriculum Generation (`AISyllabusGenerator.ts`)
- **Phase 1 (Outline)**: Generates a high-level list of chapters from user goals.
- **Phase 2 (Enrichment)**: Expands each chapter into detailed subtopics and concepts. Uses **Caveman Mode** to maximize inference speed.

### 2.4 UI Layer
- **New Architecture**: Uses Fabric and Bridgeless mode.
- **Layout**: Strict adherence to `react-native-safe-area-context` for notch/dynamic island compatibility.
- **State Management**: Context API for global app state and task progress.

## 3. Efficiency Stack
- **Caveman**: Applied to background tasks for reduced latency.
- **Code Review Graph (CRG)**: Used for structural code analysis and impact radius detection.
- **Obsidian**: Acts as the project's living knowledge base.

## 4. Key Workflows
- **Onboarding**: User provides goal -> AI generates outline -> Background enrichment starts.
- **Enrichment**: `ResourcePlanner` wakes up `LocalServerManager` -> Chapter prompt sent to `ModelManager` -> Result parsed and saved.
