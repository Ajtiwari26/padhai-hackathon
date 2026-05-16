# How the Memory Graph Works

The "Memory Graph" (or Brain) is the persistence layer used by the Antigravity agent to maintain context across sessions, plan implementations, and store knowledge. If you are integrating Kiro IDE with this system, it is vital to understand its architecture.

## Architecture Overview

All agent data is stored locally on your machine, ensuring complete privacy. 
The base directory is: `~/.gemini/antigravity/`

This directory is split into two primary components:
1. **The Brain** (`/brain/`): Contains the raw execution logs, scratchpads, and planning artifacts for every individual conversation.
2. **The Knowledge Base** (`/knowledge/`): Contains distilled, curated, and explicitly saved knowledge items (KIs) that span across all conversations.

## 1. The Brain (`/brain/<uuid>/`)

Every time a new session is started, a UUID is generated. Inside this directory, the agent works autonomously.

### The Logs (`.system_generated/logs/overview.txt`)
This is the single source of truth for a conversation. It is a plain-text transcript where each line represents an action taken by either the User or the Model.
* **Why Kiro IDE struggles with it:** If Kiro IDE expects a structured `.json` array of messages (like standard OpenAI chat histories), it will fail to load the chat when clicked. Kiro IDE needs a parser that reads the `overview.txt` text file line-by-line to reconstruct the chat UI.

### Planning Artifacts (`task.md`, `implementation_plan.md`, `walkthrough.md`)
When the agent tackles a complex task, it enters "Planning Mode". It uses these markdown files to structure its thoughts. 
* **Implementation Plan:** The architectural design before code is written.
* **Task:** The checklist of things to do.
* **Walkthrough:** The final summary of what was achieved.
Kiro IDE can extract these files to give users a high-level summary of what happened in a session, rather than forcing them to read the raw chat logs.

## 2. The Knowledge Base (`/knowledge/`)

While the Brain stores what *happened*, the Knowledge Base stores what is *true*.

When the agent solves a difficult bug or establishes a new architectural pattern, it creates a Knowledge Item (KI).
A KI consists of:
* `metadata.json`: Contains the title, a summary of the knowledge, timestamps, and references to the original session UUID that generated it.
* `artifacts/`: The actual markdown notes or code snippets associated with this knowledge.

### How Kiro IDE Should Use KIs
At the start of every session, the Antigravity agent reads the `metadata.json` of all KIs to orient itself in the repository. If Kiro IDE wants to provide a seamless experience, it should expose a UI tab for "Knowledge Items" that simply reads from the `~/.gemini/antigravity/knowledge/` directory, allowing users to manually edit or delete stale KIs.

## Data Flow Summary
1. **User requests task** -> Kiro IDE/Terminal sends to Agent.
2. **Agent reads `/knowledge/`** -> Understands repository context.
3. **Agent writes to `/brain/<uuid>/`** -> Creates logs, plans, and scratch files.
4. **Task completes** -> Agent optionally distills learnings back into `/knowledge/`.
