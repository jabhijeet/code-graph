# RELEASE NOTES

### v4.7.0 (2026-04-22)
- **Improvement on prompts:** Enhanced prompt clarity and version synchronization across documentation.
- **Maintenance:** Synchronized runtime version, package metadata, lockfile metadata, README version references, and release notes.

### v4.6.0 (2026-04-18)
- **Skills (Merge):** `RepoContext` has been merged into `ProjectMap`. One skill now covers both architecture awareness and raw-file triage. `code-graph install-skills <platform> repocontext` is no longer accepted — use `projectmap` (or install all).
- **Skills (Hook coverage):** Claude's `PreToolUse` matcher is now `Read|Grep|Glob` (previously `Grep|Glob`), so the knowledge-graph reminder also fires before direct file reads, which was the most common raw-file tool missing coverage.
- **Upgrade cleanup:** Every `install-skills` and `uninstall-skills` run now unconditionally scrubs legacy `repocontext` artifacts — `🔎 Skill: RepoContext` sections in CLAUDE.md/AGENTS.md/GEMINI.md/.clinerules/.roorules/.github/copilot-instructions.md, `.claude/skills/repocontext/`, `.cursor/rules/repocontext.mdc`, `.agent/skills/repocontext/`, `.agent/rules/repocontext.md`, `.kiro/steering/repocontext.md`, and the per-platform global skill dir. Upgraders no longer have to clean up by hand.
- **Refactor:** `SkillManager` replaced three parallel per-skill installers with a single `installSkill(platform, spec)` dispatcher driven by per-skill specs (`projectMapSpec()`, `reflectionsSpec()`). Shared `removeSkillArtifacts()` + `removeLegacySkills()` helpers replace the duplicated uninstall branches. Net: ~100 lines removed, drift between platforms becomes harder.
- **Behavior parity:** IntelliJ install path unified to "AGENTS.md only, no global skill" for all skills (previously inconsistent between ProjectMap and Reflections). Matches what `test/platform-audit.js` already asserted.
- **Tests:** `test/platform-audit.js` now supports `absent:` content assertions (currently used to guarantee no `RepoContext` text leaks back into instruction files), and the Claude hook assertion explicitly verifies `Read`, `Grep`, and `Glob` are all in the matcher.
- **Maintenance:** Synchronized runtime version, package metadata, lockfile metadata, README version references, and release notes.

### v4.5.0 (2026-04-18)
- **Docs (Codex Skills):** Documented stale invalid skill cleanup for `~/.codex/skills` entries whose `SKILL.md` files lack required YAML frontmatter.
- **Maintenance:** Synchronized runtime version, package metadata, lockfile metadata, README version references, and release notes for the minor documentation release.

### v4.4.0 (2026-04-18)
- **Docs (Codex Skills):** Documented the required YAML frontmatter format for installed Codex `SKILL.md` files so Codex does not skip them as invalid.
- **Maintenance:** Synchronized runtime version, package metadata, lockfile metadata, README version references, and release notes for the minor documentation release.

### v4.3.0 (2026-04-18)
- **MCP:** Added `code-graph mcp`, a stdio MCP server exposing `code_graph_generate`. Claude and Cursor agent registration now points to this server instead of the one-shot `generate` command.
- **Fix (Uninstall Safety):** `uninstall-skills` now removes only Code-Graph managed sections, hooks, plugin entries, and generated skill files. It preserves user-owned `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.clinerules`, `.roorules`, `.github/copilot-instructions.md`, and `opencode.json` content.
- **Fix (Graph Accuracy):** Default ES import bindings are no longer treated as dependencies. `import React from 'react'` records `react`, not `React`.
- **Fix (Graph Output):** Inheritance edges collected from `extends` / `implements` now render in `## EDGES` instead of being silently dropped.
- **Docs:** Updated README for stdio MCP behavior and corrected the Gemini agent path to `~/.gemini/agents/code-graph.md`.
- **Tests:** Added regression tests for import edge extraction, inheritance edge rendering, safe uninstall preservation, and MCP config shape.

### v4.2.0 (2026-04-18)
- **Security (Path Traversal):** Platform name is now strictly validated against a whitelist (`SUPPORTED_PLATFORMS`) plus a `/^[a-z0-9_-]{1,32}$/i` regex. Previously, values like `/../../etc` could traverse out of the user's home via the template-literal path construction in `installGlobalSkill`, potentially writing files under `/etc/skills/...` when run as root.
- **Security (Prototype Pollution):** `writeJson` now strips `__proto__`, `constructor`, and `prototype` keys from parsed JSON and incoming data. Exposed `stripDangerousKeys` helper. Prevents pollution via a malicious pre-existing `.claude/settings.json` / `.mcp.json`.
- **Security (Symlink Escape):** `ProjectMapper.walk` skips symbolic-link entries entirely. Prevents escaping `cwd` or infinite loops.
- **Security (Resource Exhaustion):** `processFile` stats files first and skips anything larger than `CONFIG.MAX_FILE_BYTES` (5 MB). Walker caps recursion at `CONFIG.MAX_WALK_DEPTH` (32).
- **Security (Injection):** `ReflectionManager.add` sanitizes category (strips non-word chars, 20-char cap) and lesson (collapses newlines, 500-char cap). Prevents markdown/file-format injection via newlines.
- **Hardening:** `CONFIG` object and `SUPPORTED_EXTENSIONS` / `DEFAULT_IGNORES` arrays are now `Object.freeze`-d. Read-only imports can no longer mutate shared state.
- **Hardening:** `walk` handles `EACCES`/`EPERM` gracefully (warns + skips) instead of throwing.
- **Hardening:** `relPath.startsWith('..')` guard added in walk to defense-in-depth against path escape via ignore-rule bypass.
- **Tests:** Added 9 security tests (30 total). Covers path traversal rejection, prototype pollution resistance, size/symlink limits, input sanitization.
- **API:** New exports from `index.js`: `SUPPORTED_PLATFORMS`, `isValidPlatform`, `stripDangerousKeys`.

### v4.1.0 (2026-04-18)
- **Fix (Parser Quality):** `findSymbolContext` now prefers declaration sites over the first textual occurrence. Prior behavior captured call-site args or string literals as "signatures" (e.g., `install [-skills <platform>')]`). Symbols now show real declarations: `install [(p)]`, `writeFile [(filename, content)]`.
- **Fix (Parser Quality):** `extractFileDesc` skips shebang lines (`#!/usr/bin/env node`) and no longer strips `/` from path references in docstrings. File descriptions are now readable.
- **Fix (Parser Quality):** Signature fallback limited to 80 chars and stops at newlines/braces, preventing multi-line string bodies from being captured.
- **Fix (Claude Hooks):** `.claude/settings.json` now writes modern `PreToolUse` shape with `matcher` + `hooks:[{type:"command", command}]`. Previous `preToolUse` (lowercase) + `{tools, message}` format was silently ignored by Claude Code.
- **Fix (MCP Discovery):** MCP server registration now writes to `.mcp.json` (Claude) and `.cursor/mcp.json` (Cursor) — the locations actually read by each tool. Previously wrote to `mcp-server-code-graph.json` which was never loaded. Existing config is merged rather than overwritten.
- **Fix (Platform List):** Removed dead references to `openclaw`, `droid`, `trae-cn` from the platforms array in `index.js`. These had no corresponding skill or agent handlers.
- **CLI:** `generate` now auto-initializes `llm-agent-rules.md` and `llm-agent-project-learnings.md` if missing, so first-run users don't need to `init` separately.
- **Quality:** `mergeHooks` now dedupes by JSON equivalence, supporting any hook payload shape (not just `{message}` entries).
- **Tests:** Added `test/platform-audit.js` — 75 integration checks across 12 platforms validating file layout, content, JSON schema, and agent registration.

### v4.0.0 (2026-04-16)
- **Breaking: Modular Architecture** — Split monolithic `index.js` (776 lines) into 7 modules under `lib/`. All public exports (`CodeParser`, `ProjectMapper`, `ReflectionManager`, `SkillManager`, `AgentManager`, `ProjectInitializer`, `CONFIG`) remain available from `index.js` via re-exports, but direct imports from internal paths will break.
- **Security:** Fixed regex injection in `CodeParser.findSymbolContext` — symbol names with regex metacharacters (e.g., `$`, `+`) are now escaped before interpolation.
- **Fix (Graph Output):** Tag extraction no longer matches regex patterns embedded in source code. Strips string/regex literals while preserving comments where `TODO`/`FIXME` tags live.
- **Fix (Hook Merge):** `writeJson` now appends new hook entries to existing arrays instead of overwriting. Deduplicates by `message` field.
- **Fix (Error Handling):** JSON parse failures and global skill install errors now emit warnings instead of being silently swallowed.
- **Fix (Entry Point):** CLI guard uses `path.resolve()` comparison instead of fragile `endsWith('index.js')`.
- **Fix (README):** Removed duplicated Implementation Details lines.
- **CLI:** Added `--help` / `-h` flag with full command, flag, and platform reference.
- **Quality:** Converted all synchronous `fs` calls to async `fsp` equivalents. Removed `fs` sync import entirely.
- **Tests:** Expanded from 10 to 21 tests covering regex safety, tag extraction, hook merging, CLI commands, and error paths.
- **Docs:** Updated README with project structure, pipeline details, and v4 changelog.

### v3.5.4 (2026-04-16)
- **Fix (Roo Code):** Final correction for persistent Markdown injection into `.roomodes` (YAML).
- **Stability:** Consolidated all instructions into `.roorules` and `.clinerules`.
- **Maintenance:** Synchronized version across all metadata files.

### v3.5.3 (2026-04-16)
- **Fix (Roo Code):** Completely removed Markdown injection into `.roomodes` (YAML) across all skill installations.
- **Fix (Roo Code):** Unified global instructions into `.roorules` and `.clinerules` for reliable rule propagation.
- **CLI:** Added `--version` / `-v` command for better troubleshooting and stale installation detection.
- **CLI:** Added versioned headers to `generate` command output.

### v3.5.2 (2026-04-16)
- **Fix (Roo Code):** Removed incorrect Markdown appends to `.roomodes` (YAML) to prevent syntax errors.
- **Fix (Roo Code):** Switched to `.roorules` for global instructions, ensuring compatibility with Roo's hierarchical rule system.

### v3.5.1 (2026-04-16)
- **Fix (Gemini CLI):** Modernized integration with YAML frontmatter for global skills and agents.
- **Fix (Gemini CLI):** Transitioned from unsupported tool hooks to standard `GEMINI.md` Memory Import syntax (`@import`).
- **Fix (Roo Code):** Restored missing `.roomodes` synchronization for mode-agnostic rules.
- **Stability:** Improved `writeJson` to perform deep-merging of `hooks`, preventing configuration overwrites.
- **Tests:** Aligned `ProjectMapper` header with test suite expectations.

### v3.4.1 (2026-04-16)
- **Docs:** Synchronized NPM installation documentation.
- **Docs:** Reconciled platform integration tables for consistency across all 15+ supported platforms.

### v3.4.0 (2026-04-16)
- **Hyper-Condensed Context:** Minified project map and reflection outputs (30-50% token reduction).
- **Architecture:** Implemented edge grouping and metadata stripping for extreme density.
- **Maintenance:** Refactored defensive uninstallation for global and local data.

### v3.3.0 (2026-04-16)
- **Active Agent Orchestration:** Added `install-agent` for explicit delegation to Code-Graph specialists.
- **Automation:** Unified `install` commands and automated `preuninstall` cleanup logic.
- **Tooling:** Model Context Protocol (MCP) support for Claude and Cursor.

### v3.2.1 (2026-04-16)
- **Docs:** Exhaustive documentation of platform-specific installation details.
- **Registry:** Integration table synchronization.

### v3.2.0 (2026-04-16)
- **Universal Agent OS:** Restored full surgical integration for Antigravity, Kiro, Codex, and OpenCode.
- **Interceptors:** Implemented segregated skill hooks for platforms that support them.

### v3.1.0 (2026-04-16)
- **Selective Skills:** Segregated skills into `projectmap` and `reflections`.
- **Command:** Standardized on `install-skills` command.

### v3.0.0 (2026-04-16)
- **Unified Naming:** Major refactor to `llm-agent-*` naming convention.
- **Integration:** Automated platform integration for Claude, Cursor, Gemini, etc.

### v2.1.x
- **Memory:** Initial implementation of `reflect` command and lesson persistence.
