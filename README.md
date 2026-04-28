# CODE-GRAPH (v4.9.1)

> Inspired by Andrej Karpathy's llm-wiki Gist and the community's work building on it.

A language-agnostic, ultra-compact codebase mapper and **agent memory system** designed specifically for LLM agents. It optimizes context and token usage while enabling agents to learn from their own mistakes across sessions.

## 📝 New in v4.9.1

- **Fix (OpenCode plugins):** `install-skills opencode all` now merges and deduplicates plugin registrations instead of replacing earlier entries or user-owned plugins.
- **Fix (Skill uninstall):** `uninstall-skills` now removes OpenCode plugin files/config entries and Codex hook entries for every managed skill, including `simplicity` and `changelimit`.
- **Maintenance:** Synchronized runtime version, package metadata, lockfile metadata, README version references, and release notes.

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

# 3. Connect your agent (project-level)
code-graph install-skills claude

# 3b. Or install globally for all projects
code-graph install-skills -g claude
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

*   **ProjectMap Skill:** The canonical file/symbol/dependency index from `llm-code-graph.md`. Agents read it before any Read, Grep, or Glob — covers both architecture awareness and fast raw-file triage.
*   **Reflections Skill:** Persistent project memory via `llm-agent-project-learnings.md`.
*   **Simplicity Skill:** Forces agents to write only what the task requires — no extra features, no premature abstractions, no unnecessary flexibility.
*   **ChangeLimit Skill:** Forces agents to change only what is explicitly required — no refactoring nearby code, no style "improvements", no scope creep.

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

*   **Native Sub-Agents:** Gemini, Antigravity, Kiro, and Claude register `code-graph` as an expert in their global config.
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

Configure your agent to use these skills by running `install-skills`. Add `-g` before the platform to install globally (all projects). **All bundled skills are installed by default.**

| Agent | Command |
| :--- | :--- |
| **Claude Code** | `code-graph install-skills claude` |
| **Cursor** | `code-graph install-skills cursor` |
| **Gemini CLI** | `code-graph install-skills gemini` or `gemini-cli` |
| **Antigravity** | `code-graph install-skills antigravity` |
| **Kiro IDE/CLI** | `code-graph install-skills kiro` or `kiro-cli` |
| **Roo Code** | `code-graph install-skills roocode` or `roo` |
| **IntelliJ / JetBrains** | `code-graph install-skills intellij` |
| **Codex** | `code-graph install-skills codex` |
| **OpenCode** | `code-graph install-skills opencode` |
| **GitHub Copilot** | `code-graph install-skills copilot` or `github-copilot` |
| **VS Code Copilot Chat** | `code-graph install-skills vscode` |
| **Windsurf** | `code-graph install-skills windsurf` |
| **Cursor** | `code-graph install-skills cursor` |
| **Cline / Warp** | `code-graph install-skills cline` or `warp` |
| **AiderDesk** | `code-graph install-skills aider-desk` |
| **Aider / Trae / Hermes** | `code-graph install-skills aider` |
| **Amp** | `code-graph install-skills amp` |
| **Augment** | `code-graph install-skills augment` |
| **IBM Bob** | `code-graph install-skills bob` |
| **OpenClaw** | `code-graph install-skills openclaw` |
| **CodeArts Agent** | `code-graph install-skills codearts-agent` |
| **CodeBuddy** | `code-graph install-skills codebuddy` |
| **Codemaker** | `code-graph install-skills codemaker` |
| **Code Studio** | `code-graph install-skills codestudio` |
| **Command Code** | `code-graph install-skills command-code` |
| **Continue** | `code-graph install-skills continue` |
| **Cortex Code** | `code-graph install-skills cortex` |
| **Crush** | `code-graph install-skills crush` |
| **Deep Agents** | `code-graph install-skills deepagents` |
| **Devin for Terminal** | `code-graph install-skills devin` |
| **Droid** | `code-graph install-skills droid` |
| **Firebender** | `code-graph install-skills firebender` |
| **ForgeCode** | `code-graph install-skills forgecode` |
| **Goose** | `code-graph install-skills goose` |
| **Junie** | `code-graph install-skills junie` |
| **iFlow CLI** | `code-graph install-skills iflow-cli` |
| **Kilo Code** | `code-graph install-skills kilo` |
| **Kimi Code CLI** | `code-graph install-skills kimi-cli` |
| **Kode** | `code-graph install-skills kode` |
| **MCPJam** | `code-graph install-skills mcpjam` |
| **Mistral Vibe** | `code-graph install-skills mistral-vibe` |
| **Mux** | `code-graph install-skills mux` |
| **OpenHands** | `code-graph install-skills openhands` |
| **Pi** | `code-graph install-skills pi` |
| **Qoder** | `code-graph install-skills qoder` |
| **Qwen Code** | `code-graph install-skills qwen-code` |
| **Replit** | `code-graph install-skills replit` |
| **Rovo Dev** | `code-graph install-skills rovodev` |
| **Tabnine CLI** | `code-graph install-skills tabnine-cli` |
| **Trae CN** | `code-graph install-skills trae-cn` |
| **Universal** | `code-graph install-skills universal` |
| **Zencoder** | `code-graph install-skills zencoder` |
| **Neovate** | `code-graph install-skills neovate` |
| **Pochi** | `code-graph install-skills pochi` |
| **AdaL** | `code-graph install-skills adal` |

## 🤖 Supported Agents

Skills can be installed to any of these agents. Use `-g` to install globally (available across all projects) or omit it for project-level install only.

```bash
# Project-level (current directory only)
code-graph install-skills <agent>

# Global (available in all projects)
code-graph install-skills -g <agent>
```

Global install paths per agent:

| Agent | Command | Global Path |
| :--- | :--- | :--- |
| AiderDesk | `code-graph install-skills aider-desk` | `~/.aider-desk/skills/` |
| Amp | `code-graph install-skills amp` | `~/.config/agents/skills/` |
| Antigravity | `code-graph install-skills antigravity` | `~/.gemini/antigravity/skills/` |
| Augment | `code-graph install-skills augment` | `~/.augment/skills/` |
| IBM Bob | `code-graph install-skills bob` | `~/.bob/skills/` |
| Claude Code | `code-graph install-skills claude` | `~/.claude/skills/` |
| OpenClaw | `code-graph install-skills openclaw` | `~/.openclaw/skills/` |
| Cline | `code-graph install-skills cline` | `~/.agents/skills/` |
| Warp | `code-graph install-skills warp` | `~/.agents/skills/` |
| CodeArts Agent | `code-graph install-skills codearts-agent` | `~/.codeartsdoer/skills/` |
| CodeBuddy | `code-graph install-skills codebuddy` | `~/.codebuddy/skills/` |
| Codemaker | `code-graph install-skills codemaker` | `~/.codemaker/skills/` |
| Code Studio | `code-graph install-skills codestudio` | `~/.codestudio/skills/` |
| Codex | `code-graph install-skills codex` | `~/.codex/skills/` |
| Command Code | `code-graph install-skills command-code` | `~/.commandcode/skills/` |
| Continue | `code-graph install-skills continue` | `~/.continue/skills/` |
| Cortex Code | `code-graph install-skills cortex` | `~/.snowflake/cortex/skills/` |
| Crush | `code-graph install-skills crush` | `~/.config/crush/skills/` |
| Cursor | `code-graph install-skills cursor` | `~/.cursor/skills/` |
| Deep Agents | `code-graph install-skills deepagents` | `~/.deepagents/agent/skills/` |
| Devin for Terminal | `code-graph install-skills devin` | `~/.config/devin/skills/` |
| Droid | `code-graph install-skills droid` | `~/.factory/skills/` |
| Firebender | `code-graph install-skills firebender` | `~/.firebender/skills/` |
| ForgeCode | `code-graph install-skills forgecode` | `~/.forge/skills/` |
| Gemini CLI | `code-graph install-skills gemini` | `~/.gemini/skills/` |
| GitHub Copilot | `code-graph install-skills copilot` | `~/.copilot/skills/` |
| Goose | `code-graph install-skills goose` | `~/.config/goose/skills/` |
| Junie | `code-graph install-skills junie` | `~/.junie/skills/` |
| iFlow CLI | `code-graph install-skills iflow-cli` | `~/.iflow/skills/` |
| Kilo Code | `code-graph install-skills kilo` | `~/.kilocode/skills/` |
| Kimi Code CLI | `code-graph install-skills kimi-cli` | `~/.config/agents/skills/` |
| Kiro CLI | `code-graph install-skills kiro` | `~/.kiro/skills/` |
| Kode | `code-graph install-skills kode` | `~/.kode/skills/` |
| MCPJam | `code-graph install-skills mcpjam` | `~/.mcpjam/skills/` |
| Mistral Vibe | `code-graph install-skills mistral-vibe` | `~/.vibe/skills/` |
| Mux | `code-graph install-skills mux` | `~/.mux/skills/` |
| OpenCode | `code-graph install-skills opencode` | `~/.config/opencode/skills/` |
| OpenHands | `code-graph install-skills openhands` | `~/.openhands/skills/` |
| Pi | `code-graph install-skills pi` | `~/.pi/agent/skills/` |
| Qoder | `code-graph install-skills qoder` | `~/.qoder/skills/` |
| Qwen Code | `code-graph install-skills qwen-code` | `~/.qwen/skills/` |
| Replit | `code-graph install-skills replit` | `~/.config/agents/skills/` |
| Rovo Dev | `code-graph install-skills rovodev` | `~/.rovodev/skills/` |
| Roo Code | `code-graph install-skills roocode` | `~/.roo/skills/` |
| Tabnine CLI | `code-graph install-skills tabnine-cli` | `~/.tabnine/agent/skills/` |
| Trae | `code-graph install-skills trae` | `~/.trae/skills/` |
| Trae CN | `code-graph install-skills trae-cn` | `~/.trae-cn/skills/` |
| Universal | `code-graph install-skills universal` | `~/.config/agents/skills/` |
| Windsurf | `code-graph install-skills windsurf` | `~/.codeium/windsurf/skills/` |
| Zencoder | `code-graph install-skills zencoder` | `~/.zencoder/skills/` |
| Neovate | `code-graph install-skills neovate` | `~/.neovate/skills/` |
| Pochi | `code-graph install-skills pochi` | `~/.pochi/skills/` |
| AdaL | `code-graph install-skills adal` | `~/.adal/skills/` |

---

### Selective Installation
You can choose to install or uninstall specific skills:

```bash
# Install only the project map
code-graph install-skills gemini projectmap

# Install only reflections
code-graph install-skills cursor reflections

# Install only simplicity rules
code-graph install-skills claude simplicity

# Install only change-limit rules
code-graph install-skills claude changelimit

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
| **OpenCode** | Registers per-skill plugins and preserves existing `opencode.json` plugin entries. | `AGENTS.md`, `.opencode/plugins/`, `opencode.json` |
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
| **Gemini CLI** | `code-graph install-agent gemini` | Registers global agent in `~/.gemini/agents/code-graph.md`. |
| **Claude Code** | `code-graph install-agent claude` | Registers sub-agent in `.claude/agents/code-graph.md`. |
| **Antigravity** | `code-graph install-agent antigravity` | Registers agent skill in `~/.gemini/antigravity/skills/`. |
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
