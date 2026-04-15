# CODE-GRAPH (v2.1.3)

A language-agnostic, ultra-compact codebase mapper and **agent memory system** designed specifically for LLM agents. It optimizes context and token usage while enabling agents to learn from their own mistakes across sessions.

## 🚀 New in v2.1: Intelligent Reflection & Hard-Soft Enforcement
- **Project Initializer:** Automated bootstrapping with `code-graph init`.
- **Intelligent Reflection:** Deduplication and categorization in `PROJECT_REFLECTIONS.md`.
- **Commit Advisories:** Soft-nudge git hooks to remind agents of missing reflections.
- **Production-Ready Core:** Refactored Service-based architecture with full async support.

## Features
- **Structural Knowledge Graph:** Captures `imports`, `requires`, `extends`, and `implements`.
- **Smart Context Extraction:** Captures JSDoc, Python docstrings, and preceding comments.
- **Signature Fallback:** Extracts function signatures (parameters/types) if documentation is missing.
- **Recursive .gitignore Support:** Deeply respects both root and nested `.gitignore` files.
- **Compact & Dense:** Optimized for LLM token efficiency with a dedicated `## GRAPH EDGES` section.
- **Language-Agnostic:** Support for JS/TS, Python, Go, Rust, Java, C#, C/C++, Swift, PHP, Ruby, Dart, and more.

## Installation

### 1. Install via NPM
```bash
npm install -g code-graph-llm
# OR
npm install --save-dev code-graph-llm
```

### 2. Core Commands
```bash
# Initialize Agent Rules and Reflection files (Scaffolding)
code-graph init

# Generate the llm-code-graph.md map
code-graph generate

# Record a project reflection (Memory)
code-graph reflect <CATEGORY> "Lesson learned"
# Example: code-graph reflect ENV "Always use 'cmd /c npm' on Windows."

# Start the live watcher for real-time updates
code-graph watch

# Install the Git pre-commit hook (Enforces Map & Memory sync)
code-graph install-hook
```

## 🧠 LLM Agent Strategy

### 1. The Mandatory Protocol
Instruct your agent to follow the **STRICT AGENT PROTOCOL** in `AGENT_RULES.md`. This ensures the agent:
1. Reads `PROJECT_REFLECTIONS.md` before starting any task.
2. Updates reflections after any failure or "learned moment."
3. Regenerates the project map (`llm-code-graph.md`) after structural changes.

### 2. The "Read First" Strategy
The `llm-code-graph.md` file provides a high-level map and structural graph for relational reasoning:

**Example Map Entry:**
```markdown
- [CORE] src/auth.js (↑3 ↓5) [TODO: Add JWT rotation] | desc: Handles user authentication.
  - syms: [login [ (username, password) ], validateToken [ (token: string) ]]

## GRAPH EDGES
[src/auth.js] -> [imports] -> [jwt-library]
[AdminUser] -> [inherits] -> [BaseUser]
```

### 3. Example System Prompt
> "Before acting, read `llm-code-graph.md`. Follow the protocol in `AGENT_RULES.md`. If you encounter a bug or an environment quirk, use the `code-graph reflect` tool to record the lesson in `PROJECT_REFLECTIONS.md`."

## 🤖 Agent-Specific Integration

Maximize efficiency by pointing your agent directly to the `llm-code-graph.md` and `AGENT_RULES.md` files.

### Roo Code (Cline)
Add this to your `.clinerules` file:
```markdown
Before starting any task:
1. Read `llm-code-graph.md` for project structure.
2. Read `AGENT_RULES.md` for operational protocol.
3. Read `PROJECT_REFLECTIONS.md` for past lessons.
4. **MANDATORY:** After any fix or learning event, you MUST update `PROJECT_REFLECTIONS.md` using `code-graph reflect`.
```

### Cursor / Windsurf
Add to `.cursorrules` or `.windsurfrules`:
```text
Always reference `llm-code-graph.md` before editing. You are REQUIRED to follow the "Reflection Cycle" in `AGENT_RULES.md`. If a task involves a non-obvious fix or an environment quirk, you MUST record it in `PROJECT_REFLECTIONS.md` immediately.
```

### GitHub Copilot
Add to `.github/copilot-instructions.md`:
```markdown
When answering questions about this codebase, prioritize the mapping data in `llm-code-graph.md`. You MUST suggest or perform a reflection entry for `PROJECT_REFLECTIONS.md` after every bug fix or identified pitfall.
```

### Gemini CLI
Create a `GEMINI.md` file (if not already using `AGENT_RULES.md`):
```markdown
- Always read `llm-code-graph.md` as the primary source of truth.
- **CRITICAL:** Use `run_shell_command` to execute `code-graph reflect` after any bug fix or discovered quirk. Memory persistence is a mandatory part of every task completion.
```

### OpenCode / OpenDevin / Aider
In your project instructions or session startup:
> "Read `llm-code-graph.md` for a high-level overview. You are FORCED to record any project-specific quirk or non-obvious lesson using `code-graph reflect <CAT> <LESSON>` before finishing a task."

### Codex / GPT-Engineer / AutoGPT
Add to your project prompt or `prompts.md`:
> "Use `llm-code-graph.md` to navigate. Strictly adhere to the reflection cycle in `AGENT_RULES.md`. You MUST persist project memory by updating `PROJECT_REFLECTIONS.md` on every failure or learned moment."

### Generic Agent (System Prompt)
For any other agent, add this to your system instructions:
> "This project uses `code-graph-llm` for context management. Always consult `llm-code-graph.md`. You ARE REQUIRED to persist new knowledge about the environment or logic using the `code-graph reflect` tool. Failure to update memory is a failure of the task."

## How it works
1. **File Scanning:** Recursively walks the directory, ignoring patterns in `.gitignore`.
2. **Context Extraction:** Scans for classes, functions, and variables while ignoring matches in comments.
3. **Graph Extraction:** Identifies `imports`, `requires`, `extends`, and `implements`.
4. **Reflection Management:** Deduplicates and persists agent learning into a standardized Markdown format.
5. **Compilation:** Writes a single, minified `llm-code-graph.md` file with a dedicated `## GRAPH EDGES` section.
