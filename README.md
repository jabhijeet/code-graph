# CODE-GRAPH (v4.10.0)

> Inspired by Andrej Karpathy's llm-wiki Gist and the community's work building on it.

A language-agnostic, ultra-compact codebase mapper and **agent memory system** for LLM agents. Code-Graph gives agents a compact file, symbol, and dependency index, then pairs it with persistent project learnings so agents can avoid repeating mistakes across sessions.

## New in v4.10.0

- **Skill (FreshDeps):** New mandatory bundled skill that forces latest stable compatible dependencies and current, non-deprecated APIs.
- **Agent rules:** `llm-agent-rules.md` now makes every bundled skill mandatory for agents: ProjectMap, Reflections, Simplicity, ChangeLimit, and FreshDeps.
- **Coverage:** `freshdeps` is installed by `all` and uses the same dispatcher as the other bundled skills, so every supported platform receives either its native skill/rule artifact or the generic project instruction fallback.
- **Maintenance:** Synchronized runtime version, package metadata, lockfile metadata, README version references, and release notes.

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for full history.

## Installation

```bash
# Global installation (recommended for CLI usage)
npm install -g code-graph-llm

# Project-level installation
npm install --save-dev code-graph-llm
```

## Quick Start

```bash
# 0. Check version and help
code-graph --version
code-graph --help

# 1. Initialize rules and memory
code-graph init

# 2. Build the graph
code-graph generate

# 3. Install all bundled skills for one agent
code-graph install-skills claude

# 4. Or install globally for all projects
code-graph install-skills -g claude
```

## Core Concepts

Code-Graph operates in two modes: **Passive Skills** and **Active Agents**.

| Mode | Paradigm | Benefit | Command |
| :--- | :--- | :--- | :--- |
| **Unified** | Both | Installs skills and the active agent together. | `code-graph install <platform>` |
| **Skills** | Passive Context | Injects the graph and memory rules into the agent's normal workflow. | `code-graph install-skills <platform>` |
| **Agents** | Active Delegation | Registers `code-graph` as a specialized sub-agent. | `code-graph install-agent <platform>` |

### Unified Installation

Get the full Code-Graph experience by installing both skills and the active sub-agent in one command.

```bash
code-graph install gemini
```

Uninstall with:

```bash
code-graph uninstall <platform>
```

### Passive Skills

Skills are always-on configurations that tell your agent how to use the project map and memory files. `code-graph install-skills <platform>` installs all bundled skills by default for every supported platform.

- **ProjectMap:** Reads `llm-code-graph.md`, the canonical file, symbol, and dependency index, before raw file searches.
- **Reflections:** Reads and updates `llm-agent-project-learnings.md` so agents retain project-specific lessons.
- **Simplicity:** Keeps changes limited to what the task actually requires.
- **ChangeLimit:** Prevents unrelated refactors, style churn, and scope creep.
- **FreshDeps:** Forces latest stable compatible dependencies and current, non-deprecated APIs.

```bash
# Install all bundled skills
code-graph install-skills gemini

# Install one skill
code-graph install-skills cursor projectmap

# Install only dependency freshness rules
code-graph install-skills codex freshdeps

# Uninstall one skill
code-graph uninstall-skills claude reflections

# Uninstall all skills for a platform
code-graph uninstall-skills claude
```

### Active Agents

Agents are specialized personas. Instead of only reading project files, a main orchestrator such as Gemini CLI or Claude Code can delegate mapping and analysis work to the Code-Graph agent.

```bash
# Register code-graph as a sub-agent
code-graph install-agent claude

# Example delegation:
# "Hey code-graph, analyze the dependency chain of the auth module."
```

Uninstall with:

```bash
code-graph uninstall-agent <platform>
```

## Supported Platforms

Use `-g` before the platform to install skills globally. Without `-g`, skills are installed for the current project when the platform supports project-level instructions.

| Agent | Command | Install Target |
| :--- | :--- | :--- |
| AdaL | `code-graph install-skills adal` | `~/.adal/skills/` |
| AiderDesk | `code-graph install-skills aider-desk` | `~/.aider-desk/skills/` |
| Aider | `code-graph install-skills aider` | `~/.aider/skills/` |
| Amp | `code-graph install-skills amp` | `~/.config/agents/skills/` |
| Antigravity | `code-graph install-skills antigravity` | `~/.gemini/antigravity/skills/` |
| Augment | `code-graph install-skills augment` | `~/.augment/skills/` |
| Claude Code | `code-graph install-skills claude` | `~/.claude/skills/` |
| Cline / Warp | `code-graph install-skills cline` or `code-graph install-skills warp` | `~/.agents/skills/` |
| Codex | `code-graph install-skills codex` | `~/.codex/skills/` |
| CodeArts Agent | `code-graph install-skills codearts-agent` | `~/.codeartsdoer/skills/` |
| CodeBuddy | `code-graph install-skills codebuddy` | `~/.codebuddy/skills/` |
| Codemaker | `code-graph install-skills codemaker` | `~/.codemaker/skills/` |
| Code Studio | `code-graph install-skills codestudio` | `~/.codestudio/skills/` |
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
| Gemini CLI | `code-graph install-skills gemini` or `code-graph install-skills gemini-cli` | `~/.gemini/skills/` |
| Generic Agent | `code-graph install-skills generic` | `~/.generic/skills/` |
| GitHub Copilot | `code-graph install-skills copilot` or `code-graph install-skills github-copilot` | `~/.copilot/skills/` |
| Goose | `code-graph install-skills goose` | `~/.config/goose/skills/` |
| Hermes | `code-graph install-skills hermes` | `~/.hermes/skills/` |
| IBM Bob | `code-graph install-skills bob` | `~/.bob/skills/` |
| IntelliJ / JetBrains | `code-graph install-skills intellij` | `AGENTS.md` or `~/.intellij/skills/` with `-g` |
| iFlow CLI | `code-graph install-skills iflow-cli` | `~/.iflow/skills/` |
| Junie | `code-graph install-skills junie` | `~/.junie/skills/` |
| Kilo Code | `code-graph install-skills kilo` | `~/.kilocode/skills/` |
| Kimi Code CLI | `code-graph install-skills kimi-cli` | `~/.config/agents/skills/` |
| Kiro IDE/CLI | `code-graph install-skills kiro` or `code-graph install-skills kiro-cli` | `~/.kiro/skills/` |
| Kode | `code-graph install-skills kode` | `~/.kode/skills/` |
| MCPJam | `code-graph install-skills mcpjam` | `~/.mcpjam/skills/` |
| Mistral Vibe | `code-graph install-skills mistral-vibe` | `~/.vibe/skills/` |
| Mux | `code-graph install-skills mux` | `~/.mux/skills/` |
| Neovate | `code-graph install-skills neovate` | `~/.neovate/skills/` |
| OpenClaw | `code-graph install-skills openclaw` | `~/.openclaw/skills/` |
| OpenCode | `code-graph install-skills opencode` | `~/.config/opencode/skills/` |
| OpenHands | `code-graph install-skills openhands` | `~/.openhands/skills/` |
| Pi | `code-graph install-skills pi` | `~/.pi/agent/skills/` |
| Pochi | `code-graph install-skills pochi` | `~/.pochi/skills/` |
| Qoder | `code-graph install-skills qoder` | `~/.qoder/skills/` |
| Qwen Code | `code-graph install-skills qwen-code` | `~/.qwen/skills/` |
| Replit | `code-graph install-skills replit` | `~/.config/agents/skills/` |
| Roo Code | `code-graph install-skills roocode` or `code-graph install-skills roo` | `~/.roo/skills/` |
| Rovo Dev | `code-graph install-skills rovodev` | `~/.rovodev/skills/` |
| Tabnine CLI | `code-graph install-skills tabnine-cli` | `~/.tabnine/agent/skills/` |
| Trae | `code-graph install-skills trae` | `~/.trae/skills/` |
| Trae CN | `code-graph install-skills trae-cn` | `~/.trae-cn/skills/` |
| Universal | `code-graph install-skills universal` | `~/.config/agents/skills/` |
| VS Code Copilot Chat | `code-graph install-skills vscode` | `.github/copilot-instructions.md` or `~/.vscode/skills/` with `-g` |
| Windsurf | `code-graph install-skills windsurf` | `~/.codeium/windsurf/skills/` |
| Zencoder | `code-graph install-skills zencoder` | `~/.zencoder/skills/` |

## Platform Integration Details

Every supported platform receives `freshdeps` when installing all skills. Platforms with native skill or rule formats get native artifacts; the rest receive the same mandatory FreshDeps instructions through their project instruction file, usually `AGENTS.md`.

| Platform | Action Taken | Directory / Files |
| :--- | :--- | :--- |
| **Claude Code** | Injects instructions and installs `preToolUse` hooks for `glob` and `grep`. | `CLAUDE.md`, `.claude/settings.json` |
| **Cursor** | Writes global rule files with `alwaysApply: true`. | `.cursor/rules/projectmap.mdc`, `.cursor/rules/reflections.mdc` |
| **Gemini CLI** | Installs global skills with YAML frontmatter and `GEMINI.md` memory imports. | `~/.gemini/skills/`, `GEMINI.md` |
| **Antigravity** | Writes always-on rules and registers slash command workflows. | `.agent/rules/`, `.agent/workflows/` |
| **Kiro IDE/CLI** | Writes global skills and steering files. | `~/.kiro/skills/`, `.kiro/steering/` |
| **Codex** | Updates `AGENTS.md` and installs a `preToolUse` hook for `bash`. | `AGENTS.md`, `.codex/hooks.json` |
| **OpenCode** | Registers per-skill plugins and preserves existing plugin entries. | `AGENTS.md`, `.opencode/plugins/`, `opencode.json` |
| **Roo Code** | Injects instructions into project rule files. | `.clinerules`, `.roorules` |
| **IntelliJ / JetBrains** | Adds architectural context to a discoverable file. | `AGENTS.md` |
| **GitHub Copilot CLI** | Copies skills globally for persistence. | `~/.copilot/skills/` |
| **VS Code Copilot** | Writes session-persistent instructions. | `.github/copilot-instructions.md` |
| **Aider / Trae / Others** | Updates project instructions and copies skills globally when supported. | `AGENTS.md`, `~/.<platform>/skills/` |

## Agent Workflow

Instruct your agent to follow the strict protocol in `llm-agent-rules.md`:

1. Treat every bundled skill as mandatory: ProjectMap, Reflections, Simplicity, ChangeLimit, and FreshDeps.
2. Read `llm-agent-project-learnings.md` before starting any task.
3. Read `llm-code-graph.md` before raw file searches or architecture analysis.
4. Use latest stable compatible dependencies and current APIs; avoid deprecated packages, methods, functions, flags, and patterns.
5. Update reflections after failures, corrections, repeated mistakes, or non-obvious project behavior.
6. Regenerate `llm-code-graph.md` after structural code changes.

Recommended generic prompt:

```text
Before acting, read llm-code-graph.md and follow llm-agent-rules.md. Treat all bundled skills as mandatory. Use latest stable compatible dependencies and current APIs; avoid deprecated choices. If you encounter a bug, environment quirk, or reusable project lesson, record it with code-graph reflect <CAT> <LESSON>.
```

### Reading the Map

`llm-code-graph.md` is a compact index generated from the project. Each file entry is designed to help an agent decide which files matter before opening raw source:

- `*` marks a core entry point or high-importance file.
- `(↑out ↓in)` shows dependency counts. Outgoing dependencies are files or packages this file references; incoming dependencies are files that reference it.
- `d:` is a short description extracted from file comments or nearby context.
- `s:` lists important symbols found in the file, such as classes, functions, types, and exported values.
- The `## EDGES` section lists dependency relationships in the form `[source] -> [targets]`.

For example:

```markdown
- *src/auth.js (3↑ 5↓) [TODO:Add JWT rotation] | d: Handles user authentication.
  - s: [login [(username, password)], validateToken [(token: string)]]

## EDGES
[src/auth.js] -> [jwt-lib, db-connector]
[AdminUser] -> [BaseUser]
```

This means `src/auth.js` is a core file with 3 outgoing dependencies and 5 incoming references. It contains the `login` and `validateToken` symbols, has a TODO about JWT rotation, depends on `jwt-lib` and `db-connector`, and includes an inheritance relationship where `AdminUser` extends or implements `BaseUser`.

## Sub-Agent Registration

Register `code-graph` as an active sub-agent to enable explicit delegation.

| Platform | Command | Action Taken |
| :--- | :--- | :--- |
| **Gemini CLI** | `code-graph install-agent gemini` | Registers global agent in `~/.gemini/agents/code-graph.md`. |
| **Claude Code** | `code-graph install-agent claude` | Registers sub-agent in `.claude/agents/code-graph.md`. |
| **Antigravity** | `code-graph install-agent antigravity` | Registers agent skill in `~/.gemini/antigravity/skills/`. |
| **Kiro IDE/CLI** | `code-graph install-agent kiro` | Registers agent in `~/.kiro/agents/`. |
| **Generic Agent** | `code-graph install-agent generic` | Generates `.code-graph-agent.md` persona prompt. |

## Implementation Details

### Project Structure

```text
index.js              CLI entry point and public re-exports
lib/
  config.js           Constants, regex patterns, shared utilities
  parser.js           CodeParser: symbol, edge, and tag extraction
  mapper.js           ProjectMapper: file walking and graph generation
  reflections.js      ReflectionManager: lesson persistence
  initializer.js      ProjectInitializer: rule and reflection scaffolding
  skills.js           SkillManager: platform skill installation
  agents.js           AgentManager: sub-agent registration
test/
  index.test.js       Unit tests for parser, mapper, skills, and CLI behavior
  platform-audit.js   Integration checks across supported platforms
```

### Pipeline

1. **File Scanning:** Recursively walks the directory while respecting nested `.gitignore` patterns.
2. **Context Extraction:** Scans for classes, functions, variables, and comments while stripping literals to reduce false matches.
3. **Graph Extraction:** Identifies imports, requires, extends, and implements edges.
4. **Tag Extraction:** Captures `TODO`, `FIXME`, `BUG`, and `DEPRECATED` tags from comments.
5. **Reflection Management:** Deduplicates and persists agent learnings into a standardized Markdown file.
6. **Compilation:** Writes a compact `llm-code-graph.md` file with a dedicated `## EDGES` section.
