# RELEASE NOTES

### v4.13.0 (2026-05-06)
- **Enforcement (UserPromptSubmit hook):** Claude Code and Codex now install a `UserPromptSubmit` hook that injects a compact mandatory-skills checklist at the start of every agent turn. The agent sees all 8 mandatory skills before thinking, not mid-execution when context is bloated. Owned by `projectmap` so it installs and uninstalls with that skill.
- **Enforcement (Stop hook):** Claude Code and Codex now install a `Stop` hook that fires before the agent completes any task. It requires the agent to either run `code-graph reflect` for any failure or correction, or explicitly state no new lesson was learned, and to report verification against stated success criteria or the exact blocker. Owned by `reflections`.
- **Enforcement (Write/Edit hook):** A `PreToolUse` hook on `Write|Edit|MultiEdit` (Claude Code) and `Write|Edit` (Codex) now fires before any file write, reminding the agent of SurgicalChanges and Simplicity constraints before code lands on disk. Owned by `changelimit`.
- **OpenCode plugins:** All 8 skill plugins are now context-aware — each `beforeExecute` fires only for relevant tool types (e.g., write/edit for changelimit, bash/read for projectmap) and uses explicit `VIOLATION(...)` language with task failure conditions.
- **Stronger hook messages:** All `PreToolUse` hook commands (Claude, Codex) changed from advisory `MANDATORY(...)` language to hard-stop `VIOLATION(...)` language. Agents treat the hook output as an intercepted violation, not a suggestion.
- **Uninstall cleanup:** `uninstall-skills` for projectmap, reflections, and changelimit now also removes the corresponding UserPromptSubmit, Stop, and Write hook entries from `.claude/settings.json` and `.codex/hooks.json`.
- **Maintenance:** Synchronized runtime version, package metadata, lockfile metadata, README version references, and release notes.

### v4.12.1 (2026-05-06)
- **Fix (Windows junction paths):** `code-graph` installed globally via npm on Windows silently exited with code 0 and produced no output. Root cause: `process.argv[1]` resolves to the junction path (`node_global/node_modules/code-graph-llm/index.js`) while `import.meta.url` resolves through the junction to the real path (`D:\Projects\code-graph\index.js`). `path.resolve` does not dereference Windows junctions, so the CLI entry guard (`argv[1] === __filename`) always failed and `main()` was never called. Fixed by using `realpathSync` on both sides of the comparison.
- **Fix (Self-referential dependency):** `package.json` listed `code-graph-llm` as its own dependency. On global install, npm resolved the self-reference from the registry (4.11.0, latest published) instead of the local source, making the global binary permanently stale. Removed the self-dependency.
- **Maintenance:** Synchronized runtime version, package metadata, lockfile metadata, README version references, and release notes.

### v4.12.0 (2026-05-05)
- **Skills (Karpathy-inspired):** Added `thinkbeforecoding`, requiring agents to surface assumptions, ambiguity, tradeoffs, and simpler options before non-trivial work.
- **Skills (Karpathy-inspired):** Added `goaldriven`, requiring explicit success criteria, verification planning, bug reproduction when feasible, and final verification reporting.
- **Naming:** Installed `ChangeLimit` instructions are now presented as `SurgicalChanges` while preserving `changelimit` as a backward-compatible CLI alias. The new guidance allows cleanup only for artifacts introduced by the current diff.
- **Rules:** Updated `llm-agent-rules.md` and initializer scaffolding so ProjectMap, Reflections, ThinkBeforeCoding, Simplicity, SurgicalChanges, GoalDriven, FreshDeps, and ContextBudget are all mandatory.
- **Docs:** Updated README command docs, bundled skill descriptions, agent workflow guidance, and added `EXAMPLES.md` with weak-vs-better examples.
- **Tests:** Added coverage for new skill installation, platform coverage, alias compatibility, mandatory rule generation, and audit expectations that now distinguish project-scope installs from global installs.
- **Fix (Codex hooks):** Project-level Codex skill installs now write the enabled nested hook shape with `codex_hooks: true`, `hooks.PreToolUse`, `matcher: "Bash"`, and nested command hooks. Reinstalls remove matching stale hook entries before writing current ones.
- **UX (Install visibility):** Skill and agent installs now print each absolute path written or updated via `[Code-Graph v4.12.0] Installed/updated: ...`, covering local project files, project hooks, global skill files, and agent registrations through the shared `lib/install-log.js` helper.
- **Agents (Delegation):** Claude agent install now creates focused sub-agents: `code-graph`, `code-graph-locator`, `code-graph-tracer`, and `code-graph-reviewer`. Generic agent install documents the same roles for platforms without native sub-agent files.
- **Map size control:** Default ignores now exclude generated Code-Graph and agent artifacts such as `AGENTS.md`, `.code-graph-agent.md`, `.claude/`, `.codex/`, `.agent/`, `.kiro/`, `.cursor/`, `.opencode/`, and temporary test directories from maps.
- **Map output caps:** `llm-code-graph.md` now caps per-file descriptions, symbol lists, and tag lists, appending `... +N more` when dense files would otherwise bloat context.
- **Tests:** Added coverage for Codex hook shape, install target logs, split agent registration, generated-artifact ignores, and map payload caps.
- **Maintenance:** Synchronized runtime version, package metadata, lockfile metadata, README version references, and release notes.

### v4.11.0 (2026-04-29)
- **Skill (ContextBudget):** Added `contextbudget`, a mandatory bundled skill that periodically condenses working context to reduce token load and stale detail.
- **Agent enforcement:** `llm-agent-rules.md` and newly initialized rule files now mark ProjectMap, Reflections, Simplicity, ChangeLimit, FreshDeps, and ContextBudget as mandatory for every agent.
- **Platform coverage:** `contextbudget` is included in `install-skills <platform>` / `install-skills <platform> all` and uses the shared platform dispatcher, giving every supported platform either native skill/rule files or the generic project instruction fallback.
- **Docs:** Updated README to describe ContextBudget, all-skill default installation, and cross-platform coverage.
- **Tests:** Added regression coverage for ContextBudget install/uninstall, mandatory rule generation, and supported-platform install coverage.
- **Maintenance:** Synchronized runtime version, package metadata, lockfile metadata, README version references, and release notes.

### v4.10.0 (2026-04-28)
- **Skill (FreshDeps):** Added `freshdeps`, a mandatory bundled skill that requires latest stable compatible dependency/library versions and current APIs. It explicitly rejects deprecated packages, methods, functions, flags, import paths, configuration keys, and stale examples.
- **Agent enforcement:** `llm-agent-rules.md` and newly initialized rule files now mark ProjectMap, Reflections, Simplicity, ChangeLimit, and FreshDeps as mandatory for every agent.
- **Platform coverage:** `freshdeps` is included in `install-skills <platform>` / `install-skills <platform> all` and uses the shared platform dispatcher, giving every supported platform either native skill/rule files or the generic project instruction fallback.
- **Docs:** Updated README to describe FreshDeps, all-skill default installation, and cross-platform coverage.
- **Tests:** Added regression coverage for FreshDeps install/uninstall, mandatory rule generation, and supported-platform install coverage.
- **Maintenance:** Synchronized runtime version, package metadata, lockfile metadata, README version references, and release notes.

### v4.9.1 (2026-04-28)
- **Fix (OpenCode plugins):** `install-skills opencode all` now merges and deduplicates `opencode.json` plugin entries instead of replacing previously installed Code-Graph plugins or user-owned plugins.
- **Fix (OpenCode uninstall):** `uninstall-skills opencode simplicity`, `changelimit`, and `all` now remove each managed `.opencode/plugins/*.js` file plus its `opencode.json` registration.
- **Fix (Codex uninstall):** `uninstall-skills codex` now removes managed hook entries for `projectmap`, `simplicity`, and `changelimit`, preventing removed mandatory hooks from staying active.
- **Tests:** Added regression coverage for OpenCode plugin merging, OpenCode plugin cleanup, Codex hook cleanup, and metadata/runtime version synchronization.
- **Maintenance:** Synchronized runtime version, package metadata, lockfile metadata, README version references, and release notes.

### v4.9.0 (2026-04-28)
- **Feature (Agent Support):** Expanded supported platforms from 15 to 62. All 53 agents listed on [vercel-labs/skills](https://github.com/vercel-labs/skills) are now supported — `PLATFORM_GLOBAL_PATHS` maps each agent to its correct user-level skills directory (handles XDG paths, nested dirs, and renamed dirs like `~/.codeium/windsurf/skills/`, `~/.snowflake/cortex/skills/`, `~/.factory/skills/`, etc.).
- **Feature (`-g` flag):** Added `-g` / `--global` flag to `install-skills`, `uninstall-skills`, `install`, and `uninstall`. Without `-g`: writes only to project files (CLAUDE.md, AGENTS.md, cursor rules, hooks). With `-g`: writes only to the agent's user-level skills directory, available across all projects. Follows `npm install -g` convention.
- **Skills (Simplicity):** New built-in skill installed by default (`all`). Injects a MANDATORY prompt enforcing minimal code — no extra parameters, no abstractions for single-use logic, no error handling for impossible cases, no refactoring during bug fixes. Installs to Claude, Cursor, Kiro, Antigravity, and all other agents via AGENTS.md + global skill dir.
- **Skills (ChangeLimit):** New built-in skill installed by default (`all`). Injects a MANDATORY prompt enforcing minimal diffs — no renaming, reformatting, or "improving" surrounding code, exact style matching, only fix breakage caused by your own change. Same platform coverage as Simplicity.
- **Credits:** Added attribution to Andrej Karpathy's llm-wiki Gist in README.
- **Maintenance:** Synchronized runtime version, package metadata, README version references, and release notes.

### v4.8.0 (2026-04-27)
- **Fix (MCP auto-install):** Removed MCP server registration from `install-agent`. Previously, `install-agent claude` wrote a `.mcp.json` to the project root and `install-agent cursor` wrote `.cursor/mcp.json`, causing platforms to prompt users to install `code-graph` as an MCP server — an unintended side-effect. Agent install for Claude now only creates the `.claude/agents/code-graph.md` sub-agent file. Cursor falls back to the generic persona prompt.
- **Fix (uninstall cleanup):** `uninstall-agent claude` now removes any previously generated `.mcp.json` and legacy `mcp-server-code-graph.json` files so existing installs are cleaned up on next uninstall.
- **Fix (.gitignore):** Added `.mcp.json` and `.cursor/mcp.json` to `.gitignore` to prevent machine-specific MCP config from being committed.
- **Docs:** Updated README sub-agent table and agent-type bullet points to reflect removal of MCP registration.

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
- **Fix (Parser Noise):** Flutter `const SizedBox()` no longer appears as a symbol; only real functions/methods like `realFunction()` are captured.
- **Fix (Edge Extraction):** Default import bindings (e.g., `import React from 'react'`) no longer create spurious dependency entries. Only the module name `react` is recorded.
- **Fix (Edge Extraction):** Inheritance edges from `extends` / `implements` are now rendered in the `## EDGES` section instead of being silently dropped.
- **Fix (Regex Safety):** `findSymbolContext` now escapes regex metacharacters (e.g., `$` in `test$func`) before searching, preventing silent failures.
- **Fix (Tag Extraction):** `extractTags` now strips code literals before scanning, so regex patterns like `TAGS = /\b(TODO|FIXME).../` in source no longer produce fake tag entries.
- **Docs:** Updated README with parser fix details and added examples for edge-case behavior.
- **Tests:** Added 7 new tests (21 total). Covers Flutter noise reduction, default import handling, inheritance edges, regex metacharacter safety, and tag extraction correctness.
- **Maintenance:** Synchronized runtime version, package metadata, lockfile metadata, README version references, and release notes.

### v4.0.0 (2026-04-17)
- **Initial release:** Compact codebase mapper with `generate`, `init`, `reflect`, `install-skills`, `uninstall-skills`, `install-agent`, `uninstall-agent`, `install-hook`, `watch`, and `mcp` commands.
- **Core:** `ProjectMapper` walks directories, `CodeParser` extracts symbols/edges/tags, `ProjectInitializer` scaffolds `llm-agent-rules.md` and `llm-agent-project-learnings.md`.
- **Skills:** Bundled mandatory skills: `projectmap`, `reflections`, `simplicity`, `changelimit`, `freshdeps`, `contextbudget`.
- **Platforms:** Supports 15+ AI coding agents with native skill/rule file generation.
- **Security:** Path traversal protection, prototype pollution prevention, symlink skipping, file size limits.
- **Tests:** 14 tests covering parser, mapper, skills, agents, CLI, and security.
