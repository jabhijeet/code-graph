# CODE-GRAPH (v6.0.0)

> Inspired by [Andrej Karpathy skills](https://github.com/forrestchang/andrej-karpathy-skills), [juliusbrussee/caveman](https://github.com/juliusbrussee/caveman), and the community's work building better agent workflows.

A language-agnostic, ultra-compact codebase mapper and **agent memory system** for LLM agents. Code-Graph gives agents a compact file, symbol, and dependency index, then pairs it with persistent project learnings so agents can avoid repeating mistakes across sessions.

## New in v6.0.0

- **Tree-sitter parsing:** Symbols, imports, inheritance, and comment tags are now read from a real syntax tree for JavaScript, TypeScript, TSX, Python, Go, Rust, Java, C#, C/C++, PHP, Ruby, and Bash. Other languages keep the regex parser. See [Parsing](#parsing).
- **JSON graph (`llm-code-graph.json`):** Complete, uncapped, machine-readable graph written next to the markdown map. MCP tools read it first.
- **Incremental scans:** Unchanged files (same mtime and size) reuse cached parse results from `.code-graph-cache.json`. Use `--no-cache` to re-parse everything.
- **`code-graph check`:** Exits 1 when the committed map is stale. Intended for CI.
- **`--max-tokens N`:** Trims the lowest-ranked files from the markdown map to fit a token budget. The header now shows `TOKENS: ~N (est.)`.
- **Better import resolution:** `./dir` → `dir/index.*`, `.js` specifiers that point at `.ts` sources, `compilerOptions.paths` aliases, and Python relative imports.
- **MCP `get_dependents`:** Transitive importers of a file with hop distance (9 tools total).
- **Fixes:** MCP stdio stream no longer corrupted by progress logs; symbol lists with `[]`/`,` in their context parse completely; strings containing `//` or mixed quotes no longer hide code; `export async function` no longer yields a `function` symbol; prose such as "Deprecated:" is no longer a tag; watcher respects `.gitignore` and never overlaps runs; pre-commit hook survives a cleared npx cache and stages the map only after a successful generate.

**Upgrading from 5.x** — see the breaking changes in [RELEASE_NOTES.md](RELEASE_NOTES.md#v600-2026-10-23). Regenerate the map once after upgrading, and add `.code-graph-cache.json` to your `.gitignore`.

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for full history.

## Installation

```bash
# Zero-install: always runs the latest published version
npx code-graph-llm@latest generate

# Global installation (or upgrade an existing one to the latest version)
npm install -g code-graph-llm@latest

# Project-level installation
npm install --save-dev code-graph-llm@latest
```

Every command below works through npx by replacing `code-graph` with `npx code-graph-llm@latest`, for example `npx code-graph-llm@latest install claude`. `@latest` makes npx check the registry instead of reusing an older cached copy. Requires Node.js 20.19 or newer.

## Quick Start

```bash
# 0. Check version and help
code-graph --version
code-graph --help

# 1. Initialize rules and memory
code-graph init

# 2. Build the graph (writes llm-code-graph.md + llm-code-graph.json)
code-graph generate

# 2a. Cap the markdown map at ~4000 tokens (lowest-ranked files are omitted; JSON stays complete)
code-graph generate --max-tokens 4000

# 2b. CI: exit 1 when the committed map is stale
code-graph check

# 3. Install all bundled skills for one agent
code-graph install-skills claude

# 4. Or install globally for all projects
code-graph install-skills -g claude
```

Every install prints each target it writes:

```text
[Code-Graph v6.0.0] Installed/updated: /absolute/path/to/AGENTS.md
[Code-Graph v6.0.0] Installed/updated: /absolute/path/to/.codex/hooks.json
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
- **ThinkBeforeCoding:** Surfaces assumptions, ambiguity, tradeoffs, and simpler options before non-trivial work.
- **Simplicity:** Keeps changes limited to what the task actually requires.
- **SurgicalChanges:** Prevents unrelated refactors, style churn, and scope creep while allowing cleanup caused by your own diff.
- **GoalDriven:** Forces explicit success criteria and verification before completion.
- **FreshDeps:** Forces latest stable compatible dependencies and current, non-deprecated APIs.
- **ContextBudget:** Periodically condenses working context to reduce token load and stale detail.

```bash
# Install all bundled skills
code-graph install-skills gemini

# Install one skill
code-graph install-skills cursor projectmap

# Install only dependency freshness rules
code-graph install-skills codex freshdeps

# Install surgical diff rules (CLI alias remains changelimit-compatible)
code-graph install-skills claude surgicalchanges

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

Claude Code receives focused sub-agents when available:

- `code-graph`: Use INSTEAD of reading source files for architectural overviews, refreshing the map, or persisting lessons after failures.
- `code-graph-locator`: Use INSTEAD of Read/Grep when finding relevant files before exploring source. Trigger: "which files relate to X", "where is Y defined".
- `code-graph-tracer`: Use INSTEAD of manual import tracing when assessing change impact. Trigger: "what depends on X", "what breaks if I change Y".
- `code-graph-reviewer`: Use AFTER making changes to verify Code-Graph protocol compliance. Trigger: "check code-graph protocol", "is the map stale".

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

Every supported platform receives all bundled skills when installing all skills. Platforms with native skill or rule formats get native artifacts; the rest receive the same mandatory instructions through their project instruction file, usually `AGENTS.md`.

| Platform | Action Taken | Directory / Files |
| :--- | :--- | :--- |
| **Claude Code** | Injects instructions and installs `PreToolUse` hooks for `Read`, `Grep`, and `Glob`; agent install creates split Code-Graph sub-agents. | `CLAUDE.md`, `.claude/settings.json`, `.claude/agents/` |
| **Cursor** | Writes always-on `.mdc` rule files for each bundled skill with `alwaysApply: true`. | `.cursor/rules/` |
| **Gemini CLI** | Installs global skills with YAML frontmatter and `GEMINI.md` memory imports. | `~/.gemini/skills/`, `GEMINI.md` |
| **Antigravity** | Writes always-on skills and rules locally, plus the specialized Code-Graph agent skill globally. | `.agent/skills/`, `.agent/rules/`, `~/.gemini/antigravity/skills/code-graph/` |
| **Kiro IDE/CLI** | Writes steering files locally; the specialized Code-Graph agent is registered globally. | `.kiro/steering/`, `~/.kiro/agents/code-graph/` |
| **Codex** | Updates `AGENTS.md` and installs enabled nested `PreToolUse` hooks for `Bash`. | `AGENTS.md`, `.codex/hooks.json` |
| **OpenCode** | Registers per-skill plugins and preserves existing plugin entries. | `AGENTS.md`, `.opencode/plugins/`, `opencode.json` |
| **Roo Code** | Injects instructions into project rule files. | `.clinerules`, `.roorules` |
| **IntelliJ / JetBrains** | Adds architectural context to a discoverable file. | `AGENTS.md` |
| **GitHub Copilot CLI** | Copies skills globally for persistence. | `~/.copilot/skills/` |
| **VS Code Copilot** | Writes session-persistent instructions. | `.github/copilot-instructions.md` |
| **Aider / Trae / Others** | Updates project instructions and copies skills globally when supported. | `AGENTS.md`, `~/.<platform>/skills/` |

## Agent Workflow

Instruct your agent to follow the strict protocol in `llm-agent-rules.md`:

1. Treat every bundled skill as mandatory: ProjectMap, Reflections, ThinkBeforeCoding, Simplicity, SurgicalChanges, GoalDriven, FreshDeps, and ContextBudget.
2. Read `llm-agent-project-learnings.md` before starting any task.
3. Read `llm-code-graph.md` before raw file searches or architecture analysis.
4. Surface assumptions and ambiguity before non-trivial work.
5. Define success criteria and report verification results or blockers.
6. Use latest stable compatible dependencies and current APIs; avoid deprecated packages, methods, functions, flags, and patterns.
7. Update reflections after failures, corrections, repeated mistakes, or non-obvious project behavior.
8. Regenerate `llm-code-graph.md` after structural code changes (or run `code-graph watch`).

Recommended generic prompt:

```text
Before acting, read llm-code-graph.md and follow llm-agent-rules.md. Treat all bundled skills as mandatory. Use latest stable compatible dependencies and current APIs; avoid deprecated choices. If you encounter a bug, environment quirk, or reusable project lesson, record it with code-graph reflect <CAT> <LESSON>.
```

### Reading the Map

`llm-code-graph.md` is a compact index generated from the project. Each file entry is designed to help an agent decide which files matter before opening raw source:

- `TOKENS: ~N (est.)` in the header is the estimated size of the map (characters / 4).
- `*` marks a core entry point (`index`, `main`, `app`, `server`, or `cli` plus one extension).
- `(↑out ↓in)` shows dependency counts. Outgoing dependencies are files or packages this file references; incoming dependencies are files that reference it.
- `d:` is a short description extracted from file comments or nearby context.
- `s:` lists important symbols found in the file, such as classes, functions, types, and exported values. Each symbol carries its doc comment or signature in brackets. The list is capped per file; the JSON graph keeps every symbol.
- Files are ordered by core status, then incoming references, then path, so output is stable across machines.
- The `## EDGES` section lists imports as `[source] -> [targets]` and inheritance as `[child] -> [inherits] -> [parent]`.

For example:

```markdown
# CODE_GRAPH
MISSION: COMPACT PROJECT MAP FOR LLM AGENTS.
PROTOCOL: Follow llm-agent-rules.md
MEMORY: See llm-agent-project-learnings.md
TOKENS: ~412 (est.)

> Legend: * core, (↑out ↓in deps), s: symbols, d: desc

- *src/auth.js (3↑ 5↓) [TODO: Add JWT rotation] | d: Handles user authentication.
  - s: [AdminUser [extends BaseUser], login [(username, password)], validateToken [(token: string)]]

## EDGES
[AdminUser] -> [inherits] -> [BaseUser]
[src/auth.js] -> [jwt-lib, src/db.js, src/user.js]
```

This means `src/auth.js` is a core file with 3 outgoing dependencies and 5 incoming references. It contains the `login` and `validateToken` symbols, has a TODO about JWT rotation, depends on the `jwt-lib` package and two project files, and `AdminUser` extends `BaseUser`.

When a budget is set with `--max-tokens`, a line `> OMITTED: N lower-ranked file(s) ...` records how many files were dropped from the markdown map.

### JSON Graph

`llm-code-graph.json` holds the same data uncapped, for tools and scripts:

```json
{
  "version": "6.0.0",
  "files": [
    {
      "path": "src/auth.js", "core": true, "out": 3, "in": 5,
      "desc": "Handles user authentication.", "parser": "tree-sitter",
      "symbols": [{ "name": "login", "context": "(username, password)" }],
      "tags": ["TODO: Add JWT rotation"]
    }
  ],
  "imports": { "src/auth.js": ["jwt-lib", "src/db.js", "src/user.js"] },
  "inheritance": [{ "child": "AdminUser", "parent": "BaseUser" }]
}
```

`parser` is `tree-sitter`, `regex`, or `none` (files over 100KB are indexed by description only).

## Parsing

Code-Graph uses [tree-sitter](https://tree-sitter.github.io/) grammars compiled to WebAssembly (via `@vscode/tree-sitter-wasm`). No native build step or compiler is needed, so it installs the same way on Windows, macOS, and Linux.

| Grammar | Extensions | Symbols | Imports | Inheritance |
|---------|------------|---------|---------|-------------|
| JavaScript | `.js .jsx .mjs .cjs` | functions, classes, methods, function-valued and exported variables | `import`, `export … from`, `require()`, `import()` | `extends` |
| TypeScript / TSX | `.ts .mts .cts` / `.tsx` | + interfaces, type aliases, enums | as JavaScript | `extends`, `implements` |
| Python | `.py` | functions, classes | `import`, `from … import` (relative imports become paths) | base classes |
| Go | `.go` | functions, methods, types | `import` | — |
| Rust | `.rs` | functions, structs, enums, traits, types, modules, macros | `use` | `impl Trait for Type`, trait bounds |
| Java | `.java` | classes, interfaces, enums, records, methods (with first annotation) | `import` | `extends`, `implements` |
| C# | `.cs` | classes, interfaces, structs, enums, records, methods, namespaces | `using` | base list |
| C / C++ | `.c .h .cpp .hpp .cc` | functions, prototypes, classes, structs, unions, enums, namespaces | `#include` | base classes |
| PHP | `.php` | functions, classes, interfaces, traits, enums, methods | `use`, `include`/`require` | `extends`, `implements` |
| Ruby | `.rb` | methods, classes, modules | `require`, `require_relative`, `load` | superclass |
| Bash | `.sh` | functions | `source`, `.` | — |

Tags (`TODO`, `FIXME`, `BUG`, `DEPRECATED`) are read only from comment nodes, so string contents never produce tags.

**Regex fallback.** Kotlin, Swift, Dart, Scala, Objective-C, Lua, Vue, and Svelte use the built-in regex parser. If the WASM runtime or a grammar fails to load, Code-Graph prints one warning and uses the regex parser for those files. The scan summary line `Parsers: N tree-sitter, M regex, K unparsed.` shows which engine handled how many files.

## Sub-Agent Registration

Register `code-graph` as an active sub-agent to enable explicit delegation.

| Platform | Command | Action Taken |
| :--- | :--- | :--- |
| **Gemini CLI** | `code-graph install-agent gemini` | Registers global agent in `~/.gemini/agents/code-graph.md`. |
| **Claude Code** | `code-graph install-agent claude` | Registers split sub-agents in `.claude/agents/`: `code-graph`, `code-graph-locator`, `code-graph-tracer`, and `code-graph-reviewer`. |
| **Antigravity** | `code-graph install-agent antigravity` | Registers agent skill in `~/.gemini/antigravity/skills/`. |
| **Kiro IDE/CLI** | `code-graph install-agent kiro` | Registers agent in `~/.kiro/agents/`. |
| **Generic Agent** | `code-graph install-agent generic` | Generates `.code-graph-agent.md` persona prompt. |

## MCP Server (Claude Code integration)

Any Claude Code project can connect to code-graph as an MCP tool server.

Add to your project's `.mcp.json` (npx starts the latest published version, no install needed):

```json
{
  "mcpServers": {
    "code-graph": {
      "command": "npx",
      "args": ["-y", "code-graph-llm@latest", "mcp"]
    }
  }
}
```

On Windows, if your client cannot start `npx` directly, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "code-graph-llm@latest", "mcp"]`.

With a global install (`npm install -g code-graph-llm@latest`), use `"command": "code-graph"` and `"args": ["mcp"]`.

Or if using a local dev install:

```json
{
  "mcpServers": {
    "code-graph": {
      "command": "node",
      "args": ["/absolute/path/to/code-graph/index.js", "mcp"]
    }
  }
}
```

### Available tools

| Tool | When to use | Description |
|------|-------------|-------------|
| `get_project_graph` | INSTEAD of Read on the graph file | Read full `llm-code-graph.md` — fastest way to get project structure |
| `search_symbols` | INSTEAD of Grep for symbol lookup | Search symbol names across all files (case-insensitive) |
| `trace_dependencies` | INSTEAD of manual EDGES parsing | Outgoing + incoming deps for a file, plus `blast_radius` count |
| `get_dependents` | Before risky edits | Transitive importers of a file with hop distance (`depth` 1–10, default 3) |
| `generate_graph` | When map is stale or missing | Build/refresh `llm-code-graph.md` and `llm-code-graph.json` for a project directory |
| `get_file_symbols` | Targeted file lookup | Return symbols for one specific file from the graph |
| `search_graph` | Broad search | Search file paths, symbols, and descriptions together with scoring |
| `add_reflection` | INSTEAD of `code-graph reflect` CLI | Append a lesson to `llm-agent-project-learnings.md` |
| `get_reflections` | INSTEAD of reading the reflections file | Return all lessons, optionally filtered by category |

All tools require `project_path` (absolute path to an existing directory) — one running server handles multiple projects. Lookups read `llm-code-graph.json` when present and fall back to parsing `llm-code-graph.md`.

**Generated files:** `llm-code-graph.json` (complete machine-readable graph) and `.code-graph-cache.json` (per-file parse cache keyed by mtime + size; safe to delete, add it to `.gitignore`). Import resolution covers relative paths, `dir/index.*`, `.js` specifiers that point at `.ts` sources, and `compilerOptions.paths` from a root `tsconfig.json`/`jsconfig.json`.

**Error format:** All tools return structured errors with `isError: true` and JSON content: `{ error_type, message, retryable, suggested_action? }`. Agents can branch on `error_type` (e.g. `GRAPH_NOT_FOUND` → call `generate_graph` first).

## Implementation Details

### Project Structure

```text
index.js              CLI entry point, watcher, git hook, public re-exports
lib/
  config.js           Constants, regex patterns, shared utilities
  treesitter.js       TreeSitterParser: syntax-tree extraction for 12 grammars
  parser.js           CodeParser: regex fallback extraction, symbol context helpers
  mapper.js           ProjectMapper: walking, cache, import resolution, markdown/JSON output, check
  reflections.js      ReflectionManager: lesson persistence
  initializer.js      ProjectInitializer: rule and reflection scaffolding
  install-log.js      Shared versioned install target logging
  mcp-server.js       MCP stdio server: 9 tools, structured errors, per-tool timeouts
  skills/             SkillManager: platform skill installation (core, platforms, specs)
  agents.js           AgentManager: sub-agent registration
test/
  index.test.js       Unit tests for parser, mapper, skills, and CLI behavior
  treesitter.test.js  Unit tests for tree-sitter extraction and engine selection
  mcp-server.test.js  Unit tests for MCP server tool handlers and the stdio stream
  platform-audit.js   Integration checks across supported platforms
```

### Pipeline

1. **File Scanning:** Recursively walks the directory while respecting nested `.gitignore` patterns.
2. **Cache Lookup:** Reuses the previous parse of any file whose mtime and size are unchanged.
3. **Parsing:** Tree-sitter extracts symbols, imports, inheritance, and comment tags where a grammar exists; the regex parser handles the rest. Each symbol gets its doc comment or signature as context.
4. **Import Resolution:** Relative imports, index files, `.js`→`.ts`, and tsconfig/jsconfig `paths` aliases resolve to project files; anything else is kept as an external package name.
5. **Ranking:** Files are ordered by core status, incoming references, then path.
6. **Compilation:** Writes `llm-code-graph.md` (capped, optional token budget) and `llm-code-graph.json` (complete), then saves the cache.
7. **Reflection Management:** Deduplicates and persists agent learnings into a standardized Markdown file.
