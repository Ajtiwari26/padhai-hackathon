# Padh.ai — On-Device Adaptive STEM Tutor (Gemma 4 Hackathon)

**Padh.ai** is an offline-first, AI-native mobile learning environment that runs a heavy-duty LLM directly on the student’s Android device. By optimizing every layer from raw C++ LiteRT models to the React Native UI, Padh.ai delivers sub-100ms streaming latency, absolute data privacy, and a customized Socratic teaching experience tailored directly to the student’s local curriculum.

Built specifically for STEM students, Padh.ai runs **fully on-device** using the **Google LiteRT-LM SDK** and **Gemma 4**, requiring zero network bandwidth and protecting privacy.

---

## ⚡ Key Engineering & Performance Optimizations

Running a 2B parameter LLM on mobile hardware requires extensive system-level tuning. Padh.ai integrates deep native optimizations:

### 1. Multi-Token Prediction (MTP) Acceleration
We integrated Multi-Token Prediction support directly inside the native Kotlin/C++ LiteRT-LM bridge, providing the engine with speculative generation capabilities to achieve accelerated tokens-per-second and reduce typing latency.

### 2. Adaptive Core Selection (CoreAffinity)
Our `CoreSelector` directly binds the LiteRT inference thread to the CPU's high-performance **big cores** cluster (`setCoreAffinity()`) before starting text generation. This ensures 100% of the hardware's computational capacity is utilized when streaming answers.

### 3. Thermal & Memory-Aware Throttling
* **PadhMemoryMonitor & PadhThermalMonitor**: Real-time native monitors that track device memory usage and temperature, emitting warning events to our central event bus.
* **AdaptiveScheduler**: Auto-pauses background heavy-lifting tasks (like syllabus outline indexing or chapter enrichment generation) when system memory pressure or thermals exceed high thresholds, freeing up 100% of system overhead for the active chat window.

### 4. Engine Sleep Mode
To conserve mobile battery life, an idle watcher automatically triggers `system:pause` and spins down the LiteRT engine resources after 60 seconds of inactivity, waking it up instantly when the student sends a new prompt.

---

## 💾 Advanced Context & Memory Systems

To keep prompt sizes small and stay within strict model token limits, we designed a custom, multi-tier context system:

### 1. PadhMemoir (HierarchicalMemoryStore)
Instead of stuffing the entire historical context into the prompt, we built a path-selective vector database using the native `PadhVectorDB` backend. It retrieves only the **state-vector facts** relevant to the current topic (budgeted at ~60 tokens), keeping input sizes tiny and inference speeds high.

### 2. Automated Memory Condensation
When a student completes a topic, `MemoryCondenser` automatically generates a highly condensed **session cheatsheet**. If the student returns to a past topic, the orchestrator injects this cheatsheet, giving the model instant "long-term recall" of past concepts without bloating the active chat window.

### 3. ContextBudget & Windowing
An active `ContextWindowManager` dynamically calculates attention budgets, running ultra-fast local extractive summarization and sliding window filters in JS to guarantee prompt sizes never exceed LiteRT constraints.

---

## 🎨 Interactive STEM Diagramming Skills

A great STEM teacher needs a whiteboard. We developed a highly interactive diagram rendering engine called **DiagramGenerator** and guided it with **DiagramOrchestrator**:

### 1. Smart Library Selector
The system analyzes the subject, topic, complexity, and message keywords to render the most optimal visual layout:
* **KaTeX (Math)**: Renders beautiful, publication-grade mathematical derivations and LaTeX blocks as distinct interactive cards.
* **JSXGraph (Physics/Geometry)**: Plots interactive 2D trajectories, physics vectors, and geometric shapes that students can tap and explore.
* **SmilesDrawer (Chemistry)**: Generates clear, high-resolution organic molecule structures from raw SMILES strings.
* **SVG Vectors (Biology/Flowcharts)**: Auto-frames and scales custom-designed vector diagrams, biological cells, processes, and flowcharts styled with fluid, modern typography.

### 2. Sequential Whiteboard Gating (The Crash Fix)
Running visual diagram generation concurrently with standard chat inference on a mobile device immediately exhausts memory, crashing with `std::bad_alloc`. 

We implemented a custom sequential scheduler in `ConceptTeacherDiagramIntegration.ts`. It detects when the direct native LiteRT engine is active and forces the tasks to run sequentially: the main Socratic text streams and completes, and only when the engine enters an idle state does it trigger the visual diagram generator, safely rendering the whiteboard within the device's physical memory footprint.

---

## 🛡️ Industrial-Grade Safeguards & Error Handling

To bridge the gap between volatile native C++ environments and high-level TypeScript UIs:
* **Engine Crash Gating**: A JavaScript-side regex filter intercepts low-level native engine crashes (`[⚠️ Engine Crash:` or C-level `std::bad_alloc` exceptions) during the streaming phase and presents clean, friendly native native pop-up `Alert` widgets instead of leaving empty, broken chat bubbles.
* **EADDRINUSE Port Safety**: Pre-emptively calls `stopServer()` before binding the NanoHTTPD local server, preventing lingering port conflicts on mobile wake events.

---

## 🏗️ Technical Stack & Architecture

* **Framework**: React Native (TypeScript) + Android Native (Kotlin/Java)
* **AI Core**: Google LiteRT-LM (speculative MTP execution) + Gemma 4 (2B)
* **Local DB**: AsyncStorage + PadhVectorDB C++ Bridge
* **Whiteboard**: React Native WebView + SmilesDrawer / JSXGraph / KaTeX / SVG

Padh.ai is not just an assistant; it is a highly optimized, fully reactive, hardware-tuned private school on a chip, proving the massive potential of edge AI with Gemma 4.
