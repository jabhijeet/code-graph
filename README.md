# CODE-GRAPH (v3.0.0)

A language-agnostic, ultra-compact codebase mapper and **agent memory system** designed specifically for LLM agents. It optimizes context and token usage while enabling agents to learn from their own mistakes across sessions.

## 🚀 New in v3.0: Major Version Upgrade
- **Project Initializer:** Automated bootstrapping with `code-graph init`.
- **Intelligent Reflection:** Deduplication and categorization in `llm-agent-project-learnings.md`.
- **Commit Advisories:** Soft-nudge git hooks to remind agents of missing reflections.
- **Production-Ready Core:** Refactored Service-based architecture with full async support.

## 🛠️ The Code-Graph Skillset

Code-Graph transforms your codebase into an agent-friendly environment using five core skills:

### 1. **Structural Mapping (`generate`)**
*   **What it does:** Scans your project for symbols (classes, functions, interfaces) and builds a dense dependency graph (`imports`, `requires`, `inheritance`).
*   **How to use:** Run `code-graph generate`. This creates `llm-code-graph.md`, which agents use as their "Source of Truth" for navigation.
*   **Agent Benefit:** Prevents "hallucinating" file paths and reduces token usage by giving the agent a compact map instead of raw file content.

### 2. **Memory Persistence (`reflect`)**
*   **What it does:** Logs non-obvious fixes, environment quirks, and architectural lessons into `llm-agent-project-learnings.md`.
*   **How to use:** `code-graph reflect <CATEGORY> "The lesson learned"`.
*   **Agent Benefit:** Enables "Cross-Session Memory." If an agent fixes a Windows-specific bug in one session, the next agent reads the reflection and avoids the same pitfall.

### 3. **Automated Integration (`install-skills`)**
*   **What it does:** Bridges the gap between the graph and your LLM platform (Claude, Cursor, Gemini, etc.).
*   **How to use:** `code-graph <platform> install`.
*   **Agent Benefit:** Installs **Tool Hooks** and **Always-On Rules** that force the agent to consult the graph before using search tools. It effectively "bakes" the graph into the agent's internal loop.

### 4. **Self-Healing Sync (`install-hook`)**
*   **What it does:** Installs a Git pre-commit hook to keep the map and memory in sync with code changes.
*   **How to use:** `code-graph install-hook`.
*   **Agent Benefit:** Ensures the agent is never working with an outdated map. It also nudges the agent to record a reflection if significant code changed but no lesson was logged.

### 5. **Real-Time Context (`watch`)**
*   **What it does:** Monitors your filesystem and rebuilds the graph instantly as you or the agent edits code.
*   **How to use:** `code-graph watch`.
*   **Agent Benefit:** Vital for long-running agent sessions where the project structure is rapidly evolving.

---

## 🧠 Workflow: The Reflection Cycle

To get the most out of Code-Graph, force your agent to follow this **Strict Protocol** (defined in `llm-agent-rules.md`):

1.  **PRE-TASK (Read):** The agent MUST read `llm-agent-project-learnings.md` to check for existing pitfalls and `llm-code-graph.md` to locate the relevant "God Nodes" (core logic).
2.  **EXECUTION (Monitor):** During the task, the agent monitors for "Learned Moments"—failures, unexpected OS behaviors, or complex regex fixes.
3.  **POST-TASK (Reflect):** If a lesson was learned, the agent MUST run `code-graph reflect`.
4.  **COMMIT (Sync):** Upon commit, the Git hook automatically runs `code-graph generate` to update the map for the next agent.

---

## 🚀 Automated Agent Integration

After generating a graph, you can automatically configure your favorite LLM agent to use it by running the matching install command.

| Platform | Command |
| :--- | :--- |
| **Claude Code** | `code-graph claude install` |
| **Cursor** | `code-graph cursor install` |
| **Gemini CLI** | `code-graph gemini install` |
| **Codex** | `code-graph codex install` |
| **OpenCode** | `code-graph opencode install` |
| **GitHub Copilot CLI** | `code-graph copilot install` |
| **VS Code Copilot Chat** | `code-graph vscode install` |
| **Aider** | `code-graph aider install` |
| **OpenClaw** | `code-graph openclaw install` |
| **Factory Droid** | `code-graph droid install` |
| **Trae** | `code-graph trae install` |
| **Hermes** | `code-graph hermes install` |
| **Kiro IDE/CLI** | `code-graph kiro install` |
| **Google Antigravity** | `code-graph antigravity install` |

### What this does:
- **Always-on Rules:** Writes project-level rule files (e.g., `CLAUDE.md`, `.cursor/rules/`, `AGENTS.md`) telling the agent to read `llm-code-graph.md` before answering architecture questions.
- **Pre-Tool Hooks:** For platforms that support it (Claude, Codex, Gemini, OpenCode), it installs hooks that fire before every file-search or bash call, injecting a reminder to check the graph first. This prevents the agent from grepping every file when a high-level map already exists.
- **Global Skills:** Copies the Code-Graph skill to the platform's global skill directory for persistence across projects.

**Uninstall** by replacing `install` with `uninstall` (e.g., `code-graph claude uninstall`).

### Skill Installation Details

| Platform | Action Taken | Directory / Files |
| :--- | :--- | :--- |
| **Claude Code** | Adds instructions to `CLAUDE.md` and installs a `preToolUse` hook for `glob` and `grep`. | `.claude/settings.json` |
| **Cursor** | Writes a global rule with `alwaysApply: true`. | `.cursor/rules/code-graph.mdc` |
| **Gemini CLI** | Copies skill globally and adds a `beforeTool` hook for `read_file`. | `~/.gemini/skills/code-graph/SKILL.md`, `.gemini/settings.json`, `GEMINI.md` |
| **Codex** | Updates `AGENTS.md` and installs a `preToolUse` hook for `bash`. | `.codex/hooks.json` |
| **OpenCode** | Registers a plugin that fires before `bash` tool calls. | `.opencode/plugins/code-graph.js`, `opencode.json`, `AGENTS.md` |
| **GitHub Copilot CLI** | Copies the Code-Graph skill to the global skill directory. | `~/.copilot/skills/code-graph/SKILL.md` |
| **VS Code Copilot** | Writes session-persistent instructions. | `.github/copilot-instructions.md` |
| **Aider / Trae / etc.** | Updates `AGENTS.md` and copies skill to global platform directory. | `~/.<platform>/skills/code-graph/SKILL.md`, `AGENTS.md` |
| **Kiro IDE/CLI** | Writes global skill and steering file for automatic inclusion. | `.kiro/skills/code-graph/SKILL.md`, `.kiro/steering/code-graph.md` |
| **Antigravity** | Writes always-on rules and registers a slash command workflow. | `.agent/rules/code-graph.md`, `.agent/workflows/code-graph.md` |

### How agents use it:
1.  **Direct Instructions:** Most platforms are configured to read project-level files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, etc.) automatically. These files tell the agent: "Before searching files, read `llm-code-graph.md`."
2.  **Tool Hooks (The "Always-On" Mechanism):** For Claude, Gemini, and Codex, the tool installs a **blocking hook**. When the agent tries to use a search tool (like `grep`), the hook intercepts the call and injects a reminder: "Knowledge graph exists. Read `llm-code-graph.md` first." This forces the agent to use the graph for navigation instead of brute-force searching.
3.  **Slash Commands:** Some platforms (Kiro, Antigravity) register `/code-graph` as a command to manually invoke or refresh the graph context.

## 🧠 LLM Agent Strategy

### 1. The Mandatory Protocol
Instruct your agent to follow the **STRICT AGENT PROTOCOL** in `llm-agent-rules.md`. This ensures the agent:
1. Reads `llm-agent-project-learnings.md` before starting any task.
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
> "Before acting, read `llm-code-graph.md`. Follow the protocol in `llm-agent-rules.md`. If you encounter a bug or an environment quirk, use the `code-graph reflect` tool to record the lesson in `llm-agent-project-learnings.md`."

## 🤖 Agent-Specific Integration

Maximize efficiency by pointing your agent directly to the `llm-code-graph.md` and `llm-agent-rules.md` files.

### Roo Code (Cline)
Add this to your `.clinerules` file:
```markdown
Before starting any task:
1. Read `llm-code-graph.md` for project structure.
2. Read `llm-agent-rules.md` for operational protocol.
3. Read `llm-agent-project-learnings.md` for past lessons.
4. **MANDATORY:** After any fix or learning event, you MUST update `llm-agent-project-learnings.md` using `code-graph reflect`.
```

### Cursor / Windsurf
Add to `.cursorrules` or `.windsurfrules`:
```text
Always reference `llm-code-graph.md` before editing. You are REQUIRED to follow the "Reflection Cycle" in `llm-agent-rules.md`. If a task involves a non-obvious fix or an environment quirk, you MUST record it in `llm-agent-project-learnings.md` immediately.
```

### GitHub Copilot
Add to `.github/copilot-instructions.md`:
```markdown
When answering questions about this codebase, prioritize the mapping data in `llm-code-graph.md`. You MUST suggest or perform a reflection entry for `llm-agent-project-learnings.md` after every bug fix or identified pitfall.
```

### Gemini CLI
Create a `GEMINI.md` file (if not already using `llm-agent-rules.md`):
```markdown
- Always read `llm-code-graph.md` as the primary source of truth.
- **CRITICAL:** Use `run_shell_command` to execute `code-graph reflect` after any bug fix or discovered quirk. Memory persistence is a mandatory part of every task completion.
```

### OpenCode / OpenDevin / Aider
In your project instructions or session startup:
> "Read `llm-code-graph.md` for a high-level overview. You are FORCED to record any project-specific quirk or non-obvious lesson using `code-graph reflect <CAT> <LESSON>` before finishing a task."

### Codex / GPT-Engineer / AutoGPT
Add to your project prompt or `prompts.md`:
> "Use `llm-code-graph.md` to navigate. Strictly adhere to the reflection cycle in `llm-agent-rules.md`. You MUST persist project memory by updating `llm-agent-project-learnings.md` on every failure or learned moment."

### Generic Agent (System Prompt)
For any other agent, add this to your system instructions:
> "This project uses `code-graph-llm` for context management. Always consult `llm-code-graph.md`. You ARE REQUIRED to persist new knowledge about the environment or logic using the `code-graph reflect` tool. Failure to update memory is a failure of the task."

## How it works
1. **File Scanning:** Recursively walks the directory, ignoring patterns in `.gitignore`.
2. **Context Extraction:** Scans for classes, functions, and variables while ignoring matches in comments.
3. **Graph Extraction:** Identifies `imports`, `requires`, `extends`, and `implements`.
4. **Reflection Management:** Deduplicates and persists agent learning into a standardized Markdown format.
5. **Compilation:** Writes a single, minified `llm-code-graph.md` file with a dedicated `## GRAPH EDGES` section.
