# CODE-GRAPH (v2.1.1)

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

## How it works
1. **File Scanning:** Recursively walks the directory, ignoring patterns in `.gitignore`.
2. **Context Extraction:** Scans for classes, functions, and variables while ignoring matches in comments.
3. **Graph Extraction:** Identifies `imports`, `requires`, `extends`, and `implements`.
4. **Reflection Management:** Deduplicates and persists agent learning into a standardized Markdown format.
5. **Compilation:** Writes a single, minified `llm-code-graph.md` file with a dedicated `## GRAPH EDGES` section.
