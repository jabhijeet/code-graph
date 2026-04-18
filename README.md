# CODE-GRAPH (v4.2.0)

A language-agnostic, ultra-compact codebase mapper and **agent memory system** designed specifically for LLM agents. It optimizes context and token usage while enabling agents to learn from their own mistakes across sessions.

## 🔒 New in v4.2.0: Security & Production Hardening

- **Path traversal fix:** Platform names are whitelisted + regex-validated. Prior versions could be abused to write outside the user's home (e.g. `/etc/...`).
- **Prototype pollution defense:** `writeJson` strips `__proto__`/`constructor`/`prototype` from parsed JSON before merging.
- **Resource limits:** Files >5 MB are skipped; directory walk capped at depth 32.
- **Symlink safety:** `ProjectMapper.walk` ignores symbolic links to prevent escape and infinite loops.
- **Input sanitization:** `reflect` sanitizes category (20 chars, alphanumeric) and lesson (500 chars, newlines collapsed).
- **Immutable config:** `CONFIG` and default arrays are `Object.freeze`-d.
- **Tests:** 30 unit tests (9 new security tests) + 75 platform-audit checks.

## 🚀 v4.1.0: Quality & Integration Fixes

- **Parser Quality:** Symbols now show real declaration signatures instead of call-site args or string literals. File descriptions skip shebang lines and preserve path separators.
- **Claude Hooks:** `.claude/settings.json` writes modern `PreToolUse` shape with `matcher` + `hooks:[{type,command}]`. Previous format was silently ignored.
- **MCP Discovery:** Writes `.mcp.json` (Claude) and `.cursor/mcp.json` (Cursor) — the locations each tool actually reads. Existing configs are merged.
- **CLI:** `generate` now auto-initializes rule/reflection files on first run.
- **Tests:** Added platform audit (75 integration checks across 12 platforms).

### v4.0.0: Architecture Overhaul
- **Breaking:** Monolithic `index.js` split into 7 focused modules under `lib/`. Public exports remain identical.
- **Security:** Fixed regex injection vulnerability in symbol context extraction.
- **Fix:** Garbled graph output, hook overwrites, silent error swallowing, fragile entry point guard.
- **CLI:** Added `--help` / `-h`.
- **Quality:** Fully async I/O, 21 tests.

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for full history.

## 📥 Installation

```bash
# Global installation (recommended for CLI usage)
npm install -g code-graph-llm

# Project-level installation
npm install --save-dev code-graph-llm
```

## 🚀 Quick Start
```bash
# 0. Check version & help
code-graph --version
code-graph --help

# 1. Initialize rules & memory
code-graph init

# 2. Build the graph
code-graph generate

# 3. Connect your favorite agent
code-graph install gemini
```

## 🛠️ The Code-Graph Architecture

Code-Graph operates in two modes: **Passive Skills** and **Active Agents**.

| Mode | Paradigm | Benefit | Command |
| :--- | :--- | :--- | :--- |
| **Unified** | Both | Complete setup of skills and agent. | `code-graph install <platform>` |
| **Skills** | Passive Context | Injects the graph into the agent's existing loop. | `code-graph install-skills` |
| **Agents** | Active Delegation | Registers `code-graph` as a specialized sub-agent. | `code-graph install-agent` |

---

### 1. Unified Installation (Recommended)
Get the full Code-Graph experience by installing both skills and the active sub-agent in one command.

```bash
# Recommended: Standard full setup
code-graph install gemini
```

**Uninstall** using `code-graph uninstall <platform>`.

---

### 2. Code-Graph Skills (Passive)
**Skills** are "always-on" configurations. They ensure your agent *always* sees the codebase map before it acts.

*   **ProjectMap Skill:** Architectural awareness and navigation via `llm-code-graph.md`.
*   **Reflections Skill:** Persistent project memory via `llm-agent-project-learnings.md`.

**Usage:**
```bash
# Install all skills for a platform
code-graph install-skills gemini

# Selective installation
code-graph install-skills cursor projectmap
```

---

### 3. Code-Graph Agents (Active)
**Agents** are specialized personas. Instead of just reading a file, the main orchestrator (like Gemini CLI or Claude) can **delegate** complex mapping or analysis tasks to the Code-Graph agent.

*   **Native Sub-Agents:** Gemini, Antigravity, and Kiro register `code-graph` as an expert in their global config.
*   **MCP Servers:** Claude and Cursor use the Model Context Protocol to call `code-graph` as a live tool.
*   **Persona Prompts:** Aider and others use a `.code-graph-agent.md` system prompt to "become" the specialist.

**Usage:**
```bash
# Register code-graph as a sub-agent
code-graph install-agent claude

# The main agent can now say:
# "Hey code-graph, analyze the dependency chain of the auth module."
```

---

## 🚀 Platform Support Matrix

Configure your agent to use these skills by running the `install-skills` command. **Both skills are installed by default.**

| Platform | Command |
| :--- | :--- |
| **Claude Code** | `code-graph install-skills claude` |
| **Cursor** | `code-graph install-skills cursor` |
| **Gemini CLI** | `code-graph install-skills gemini` |
| **Antigravity** | `code-graph install-skills antigravity` |
| **Kiro IDE/CLI** | `code-graph install-skills kiro` |
| **Roo Code (Cline)** | `code-graph install-skills roocode` |
| **IntelliJ / JetBrains** | `code-graph install-skills intellij` |
| **Codex** | `code-graph install-skills codex` |
| **OpenCode** | `code-graph install-skills opencode` |
| **GitHub Copilot CLI** | `code-graph install-skills copilot` |
| **VS Code Copilot Chat** | `code-graph install-skills vscode` |
| **Aider / Trae / Hermes** | `code-graph install-skills aider` |

### Selective Installation
You can choose to install or uninstall specific skills:

```bash
# Install only the project map
code-graph install-skills gemini projectmap

# Install only reflections
code-graph install-skills cursor reflections

# Uninstall only reflections
code-graph uninstall-skills claude reflections
```

**Uninstall all skills** by using `uninstall-skills <platform>`.


## 🧠 Workflow: The Reflection Cycle

### Skill Installation Details

| Platform | Action Taken | Directory / Files |
| :--- | :--- | :--- |
| **Claude Code** | Injects instructions and installs `preToolUse` hooks for `glob` and `grep`. | `CLAUDE.md`, `.claude/settings.json` |
| **Cursor** | Writes global rule files with `alwaysApply: true`. | `.cursor/rules/projectmap.mdc`, `.cursor/rules/reflections.mdc` |
| **Gemini CLI** | Global skills with YAML frontmatter and `GEMINI.md` Memory Imports. | `~/.gemini/skills/`, `GEMINI.md` |
| **Antigravity** | Writes always-on rules and registers slash command workflows. | `.agent/rules/`, `.agent/workflows/` |
| **Kiro IDE/CLI** | Writes global skills and steering files. | `~/.kiro/skills/`, `.kiro/steering/` |
| **Codex** | Updates `AGENTS.md` and installs a `preToolUse` hook for `bash`. | `AGENTS.md`, `.codex/hooks.json` |
| **OpenCode** | Registers a plugin that fires before `bash` tool calls. | `AGENTS.md`, `.opencode/plugins/`, `opencode.json` |
| **Roo Code** | Injects instructions into project rule files. | `.clinerules`, `.roorules` |
| **IntelliJ / JetBrains** | Adds architectural context to a discoverable file. | `AGENTS.md` |
| **GitHub Copilot CLI** | Copies skills globally for persistence. | `~/.copilot/skills/` |
| **VS Code Copilot** | Writes session-persistent instructions. | `.github/copilot-instructions.md` |
| **Aider / Trae / etc.** | Updates `AGENTS.md` and copies skills globally. | `~/.<platform>/skills/`, `AGENTS.md` |

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
The `llm-code-graph.md` file provides a high-level map and structural graph for relational reasoning. It is minified for maximum token efficiency.

**Notation Legend:**
*   `*` : Core Entry Point (God Node).
*   `(↑out ↓in)` : Dependency counts (Outgoing ↑ / Incoming ↓).
*   `s:` : Symbols (Classes, Functions, Types).
*   `d:` : Description (Contextual Summary).

**Example Map Entry:**
```markdown
- *src/auth.js (3↑ 5↓) [TODO:Add JWT rotation] | d: Handles user authentication.
  - s: [login [ (username, password) ], validateToken [ (token: string) ]]

## EDGES
[src/auth.js] -> [jwt-lib, db-connector]
[AdminUser] -> [BaseUser]
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

## 🤖 Sub-Agent Registration

Register `code-graph` as an active sub-agent to enable explicit delegation.

| Platform | Command | Action Taken |
| :--- | :--- | :--- |
| **Gemini CLI** | `code-graph install-agent gemini` | Registers global agent in `~/.gemini/subagents/`. |
| **Claude / Cursor** | `code-graph install-agent claude` | Creates `mcp-server-code-graph.json` (MCP tool config). |
| **Antigravity** | `code-graph install-agent antigravity` | Registers agent in `~/.agent/subagents/`. |
| **Kiro IDE/CLI** | `code-graph install-agent kiro` | Registers agent in `~/.kiro/agents/`. |
| **Generic Agent** | `code-graph install-agent generic` | Generates `.code-graph-agent.md` persona prompt. |

**Uninstall** using `uninstall-agent <platform>`.

## 🛠️ Implementation Details

### Project Structure
```
index.js              CLI entry point & public re-exports
lib/
  config.js           Constants, regex patterns, shared utilities
  parser.js           CodeParser — symbol, edge, and tag extraction
  mapper.js           ProjectMapper — file walking, graph generation
  reflections.js      ReflectionManager — lesson persistence
  initializer.js      ProjectInitializer — scaffolds rule/reflection files
  skills.js           SkillManager — platform skill installation
  agents.js           AgentManager — sub-agent registration
test/
  index.test.js       21 unit tests covering parser, mapper, skills, CLI
  platform-audit.js   75 integration checks across 12 platforms
```

### Pipeline
1. **File Scanning:** Recursively walks the directory, respecting nested `.gitignore` patterns.
2. **Context Extraction:** Scans for classes, functions, and variables. Strips comments and string literals to avoid false matches.
3. **Graph Extraction:** Identifies `imports`, `requires`, `extends`, and `implements`.
4. **Tag Extraction:** Captures `TODO`, `FIXME`, `BUG`, `DEPRECATED` from comments while ignoring code literals.
5. **Reflection Management:** Deduplicates and persists agent learnings into a standardized Markdown format.
6. **Compilation:** Writes a single, minified `llm-code-graph.md` file with a dedicated `## EDGES` section.
